/**
 * Who the shared Anthropic key serves, and what a school has to have decided before its students are
 * among them.
 *
 * `claude/index.ts` says the shared key "serves individual accounts with no school". Until the first
 * slice of this file nothing enforced it: an account that belonged to a school was served like any
 * other, and the school's own decision (`tenant_feature_policy` for `semester_intelligence`,
 * `ai_policy`, its cohort, its kill switch) was never read on this path. The institutional gateway
 * reads all of it (`app/server/institution/intelligence-repository.ts`); this function now reads the
 * parts that decide *whether* a school's student may be served at all.
 *
 * ## The rule
 *
 * **An account with no school is served as before. An account that belongs to a school is served only
 * if the school has turned AI on for that account**, which means every one of these holds, read live:
 *
 *  1. the school's `semester_intelligence` feature row exists and its state is `production`
 *     (`preview` and `sandbox` are not a launch to the school's students on a shared key);
 *  2. if the feature names release cohorts, the account is a live member of one;
 *  3. the account has exactly one `institution_membership` in that school, active, whose roles
 *     include one the feature permits;
 *  4. the school's `ai_policy` row exists and lists `anthropic` among its allowed providers;
 *  5. the school has a monthly budget and has not spent it (`ai_usage_spent`);
 *  6. the school's own kill-switch row is not engaged (`killswitch.ts`, asked by the caller).
 *
 * ## The direction a failure takes
 *
 * **Anything that cannot be read is a refusal, never a service.** The plan lookup in the same function
 * falls back to `free`, because the cost of being wrong there is a paying student offered fewer models.
 * Here the cost of being wrong is serving a school's student against their school's decision, so every
 * missing row, malformed value and failed read goes the other way.
 *
 * ## What this does not do
 *
 * It does not copy the gateway's per-request rules (allowed modes, models, the course's approved
 * sources, its output limits), which the shared key has no request shape to apply, and it does not
 * bind a first sign-in to a membership (`bind_institution_sso_membership`): an account with no
 * membership row is refused until it has signed in through the school's path. It does not charge the
 * school's meter: the shared key's spend is metered per account (`add_spend`), so a school's budget is
 * checked here but not drawn down by these calls. It does not reach a model call the browser makes
 * itself with a student's own key (`app/src/lib/claude.ts`). A school is identified by
 * `profiles.school_id`, the model row-level security uses (`private.school_of()`); the other ways the
 * repository derives a tenant are ADR-0002.
 *
 * Every decision is a pure function over what was read, so the app's test suite can hold it
 * (`app/src/lib/tenantai.test.ts`) without a database; `schoolOf` and `loadSchoolAi` are the I/O around it.
 */

/** Said to a school account whose school has not turned AI on for it. One sentence of what, one of what to do. */
export const TENANT_MANAGED_MESSAGE =
  'Your school manages AI for your account and has not turned it on for you. Ask your school which AI tools it has turned on.';

/** Said when the school's budget for the month is spent or unset. Nothing was counted. */
export const TENANT_BUDGET_MESSAGE =
  'Your school\'s AI allowance for this month has been used, so nothing was sent. Ask your school about it.';

/** Said when the membership or the school's decision could not be checked. Nothing was counted. */
export const MEMBERSHIP_UNREADABLE_MESSAGE =
  'Your school settings could not be checked just now, so nothing was sent. Try again in a moment.';

export type AudienceDecision =
  | { serve: true; school: string | null }
  | { serve: false; reason: 'membership-unreadable' };

export interface SchoolLookup {
  /** The school the account belongs to, or null when it belongs to none. Meaningless when `failed`. */
  school: string | null;
  /** The read did not return a trustworthy answer. Never to be read as "no school". */
  failed: boolean;
}

/** Whether the account is an individual (served) or a school's (the school's decision comes next). */
export function sharedKeyAudience(lookup: SchoolLookup): AudienceDecision {
  if (lookup.failed) return { serve: false, reason: 'membership-unreadable' };
  return { serve: true, school: lookup.school };
}

/** What was read about a school and one of its accounts. A field that could not be read is not here: the load returns null. */
export interface SchoolAiFacts {
  feature: { state?: unknown; permitted_roles?: unknown; permitted_cohorts?: unknown } | null;
  policy: { allowed_providers?: unknown; monthly_budget_cents?: unknown } | null;
  /** Live cohort rows for the account among the permitted cohorts; only meaningful when cohorts are named. */
  cohortRows: number;
  memberships: ReadonlyArray<{ status?: unknown; roles?: unknown }>;
  spentCents: unknown;
}

export type SchoolAiDecision =
  | { serve: true }
  | { serve: false; reason: 'not-turned-on' | 'budget'; };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Whether a school's account may be served by the shared key. Everything missing or odd is a refusal. */
export function schoolAiDecision(f: SchoolAiFacts): SchoolAiDecision {
  const no: SchoolAiDecision = { serve: false, reason: 'not-turned-on' };
  if (!f.feature || !f.policy || f.feature.state !== 'production') return no;
  if (strings(f.feature.permitted_cohorts).length > 0 && !(f.cohortRows > 0)) return no;
  if (f.memberships.length !== 1) return no;
  const m = f.memberships[0]!;
  const permitted = strings(f.feature.permitted_roles);
  if (m.status !== 'active' || !strings(m.roles).some((r) => permitted.includes(r))) return no;
  if (!strings(f.policy.allowed_providers).includes('anthropic')) return no;
  const budget = Number(f.policy.monthly_budget_cents);
  // A spend that is null or not a number is unknown, not zero: `Number(null)` is 0.
  const spent = typeof f.spentCents === 'number' || (typeof f.spentCents === 'string' && f.spentCents.trim() !== '') ? Number(f.spentCents) : NaN;
  if (!(budget > 0) || !Number.isFinite(spent) || spent < 0 || spent >= budget) return { serve: false, reason: 'budget' };
  return { serve: true };
}

/** The part of a Supabase client `schoolOf` uses, so a test can stand in for it. */
export interface ProfileReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
}

/**
 * The school an account belongs to. An error, a throw, or a row of a shape it does not know is a
 * failed read; only a row with a null `school_id`, or no row, is "no school".
 */
export async function schoolOf(db: ProfileReader, userId: string): Promise<SchoolLookup> {
  try {
    const { data, error } = await db.from('profiles').select('school_id').eq('user_id', userId).maybeSingle();
    if (error) return { school: null, failed: true };
    if (data === null || data === undefined) return { school: null, failed: false };
    const id = (data as { school_id?: unknown }).school_id;
    if (id === null) return { school: null, failed: false };
    if (typeof id === 'string' && id.length > 0) return { school: id, failed: false };
    return { school: null, failed: true };
  } catch {
    return { school: null, failed: true };
  }
}

/** The part of a Supabase client `loadSchoolAi` uses; a chain of `eq`/`is`/`in` ends in a promise of rows. */
// deno-lint-ignore no-explicit-any
export type PolicyReader = { from(table: string): any; rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

/**
 * Reads what `schoolAiDecision` needs, with the service client, the way the gateway reads it. Returns
 * null when any read fails, throws, or returns a shape it does not know: the caller refuses.
 */
export async function loadSchoolAi(db: PolicyReader, school: string, userId: string): Promise<SchoolAiFacts | null> {
  try {
    const [feature, policy, members, spent] = await Promise.all([
      db.from('tenant_feature_policy').select('state, permitted_roles, permitted_cohorts').eq('tenant_id', school).eq('capability', 'semester_intelligence').maybeSingle(),
      db.from('ai_policy').select('allowed_providers, monthly_budget_cents').eq('tenant_id', school).maybeSingle(),
      db.from('institution_membership').select('status, roles').eq('auth_user_id', userId).eq('tenant_id', school).limit(2),
      db.rpc('ai_usage_spent', { want_tenant: school }),
    ]);
    if (feature.error || policy.error || members.error || spent.error) return null;
    if (!Array.isArray(members.data)) return null;
    const cohorts = strings(feature.data?.permitted_cohorts);
    let cohortRows = 0;
    if (cohorts.length > 0) {
      const c = await db.from('feature_cohort_members').select('cohort').eq('tenant_id', school).eq('user_id', userId).is('removed_at', null).in('cohort', cohorts);
      if (c.error || !Array.isArray(c.data)) return null;
      cohortRows = c.data.length;
    }
    return { feature: feature.data ?? null, policy: policy.data ?? null, cohortRows, memberships: members.data, spentCents: spent.data };
  } catch {
    return null;
  }
}
