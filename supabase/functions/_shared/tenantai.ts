/**
 * Who the shared Anthropic key serves, and the one rule that keeps a school's AI decision from being
 * walked around.
 *
 * `claude/index.ts` says the shared key "serves individual accounts with no school". Until this file
 * existed nothing enforced it. An account that belonged to a school was served like any other: the
 * school's own decision (`tenant_feature_policy` for `semester_intelligence`, `ai_policy`, the course's
 * rules, its budget) was never read on this path, so a school that had turned AI off, or limited it to
 * a pilot cohort, was not obeyed by the function students call most. The institutional gateway reads
 * all of it (`app/server/institution/intelligence.ts`); this function reads none of it, and it has no
 * tenant to read it for.
 *
 * ## The rule
 *
 * **An account that belongs to a school is not served by the shared key.** Its AI goes through the
 * gateway, where the school's policy is evaluated before a model is called. That is the one rule that
 * cannot serve an account against its school's decision, and it needs no policy engine on the edge,
 * where the finer parts (permitted roles, cohorts, modes, models, the course's rules) cannot be
 * evaluated faithfully and a half-copy would drift from the gateway's.
 *
 * ## The direction a failure takes
 *
 * **A membership that cannot be read is refused, not served.** The plan lookup in the same function
 * falls back to `free`, because the cost of being wrong there is a paying student offered fewer models.
 * Here the cost of being wrong is serving a school's student against their school's decision, so the
 * failure goes the other way: unknown is not "no school".
 *
 * ## What this does not do
 *
 * It does not reach a model call the browser makes itself with a student's own key
 * (`app/src/lib/claude.ts`), which no server decides; that is recorded as open in ADR-0005. It
 * identifies a school by `profiles.school_id`, the model row-level security uses
 * (`private.school_of()`); the other ways the repository derives a tenant are ADR-0002.
 *
 * The decision is a pure function over what was read, so the app's test suite can hold it
 * (`app/src/lib/tenantai.test.ts`) without a database; `schoolOf` is the one line of I/O around it.
 */

/** Said to a school account. One sentence of what, one of what to do, no promise of a way round. */
export const TENANT_MANAGED_MESSAGE =
  'Your school manages AI for your account, so the shared key does not serve it. Ask your school which AI tools it has turned on.';

/** Said when the membership could not be checked. Nothing was counted. */
export const MEMBERSHIP_UNREADABLE_MESSAGE =
  'Your school settings could not be checked just now, so nothing was sent. Try again in a moment.';

export type AudienceDecision =
  | { serve: true }
  | { serve: false; reason: 'tenant-managed' | 'membership-unreadable' };

export interface SchoolLookup {
  /** The school the account belongs to, or null when it belongs to none. Meaningless when `failed`. */
  school: string | null;
  /** The read did not return a trustworthy answer. Never to be read as "no school". */
  failed: boolean;
}

/** Whether the shared key may serve an account, given what was read about its school. */
export function sharedKeyAudience(lookup: SchoolLookup): AudienceDecision {
  if (lookup.failed) return { serve: false, reason: 'membership-unreadable' };
  if (lookup.school !== null) return { serve: false, reason: 'tenant-managed' };
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
