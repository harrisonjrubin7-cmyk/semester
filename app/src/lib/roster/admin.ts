import { cloud } from '../cloud';
import { serviceError } from '../attempt';

/**
 * The roster desk's client: a school administrator's view of the roster
 * people nobody has bound to an account yet, finding the account and binding
 * one, the people who are bound and unbinding one, and the school's
 * absence-means-removal switch.
 *
 * Every call is one of the definers in
 * `supabase/migrations/20261021090000_roster_admin_desk.sql` and
 * `20261021100000_roster_admin_unbind_search.sql`, each of which raises unless
 * the caller holds `roster:administer` over the school. What the
 * screen offers follows `rosterAdminAllowed`; what is allowed is the
 * database's (`supabase/roster-admin-desk.check.sql`).
 */

/** Held over a school scope, it opens the desk at that school. */
export const ROSTER_ADMIN_CAPABILITY = 'roster:administer';

export const rosterAdminAllowed = (verified: readonly string[]): boolean => verified.includes(ROSTER_ADMIN_CAPABILITY);

/**
 * The migration has not reached this project: a missing table, a missing
 * function, or PostgREST not knowing the function or table. The desk then
 * says it is not set up rather than showing an error.
 */
const NOT_SET_UP = new Set(['42P01', '42883', 'PGRST202', 'PGRST205']);

export function notSetUp(error: { code?: unknown } | null | undefined): boolean {
  return typeof error?.code === 'string' && NOT_SET_UP.has(error.code);
}

/** The server refused the caller: no `roster:administer` over this school. */
export const denied = (error: { code?: unknown } | null | undefined): boolean => error?.code === '42501';

export interface RosterCourse {
  course: string;
  term: string;
  /** The grant a binding would give: student, faculty or teaching_assistant. */
  role: string;
}

export interface UnboundPerson {
  sourcedId: string;
  /** The roster's own word: student, teacher, aide… */
  role: string;
  givenName: string;
  familyName: string;
  courses: RosterCourse[];
}

export interface RosterConfig {
  /** Whether the school has a roster import at all. */
  configured: boolean;
  absenceRevokesAccess: boolean;
  /** Whether the live roster rests on a complete batch, so absence can be read. */
  rosterComplete: boolean;
  /** Roster-given grants that would end now if the switch were turned on. */
  wouldEnd: number;
  unbound: number;
  lastPromotedAt: string | null;
}

export interface BoundPerson {
  sourcedId: string;
  /** The roster's word; empty once the person has left the live roster. */
  role: string;
  givenName: string;
  familyName: string;
  /** The account the person is bound to, and its chosen handle. */
  account: string;
  handle: string;
  /** How the binding was made: admin_review, scim or sso_subject. */
  method: string;
  boundAt: string;
}

export type RosterDesk =
  /** `bound` is null where the unbind migration has not reached the project. */
  | { state: 'ready'; config: RosterConfig; people: UnboundPerson[]; bound: BoundPerson[] | null }
  | { state: 'not-set-up' }
  | { state: 'denied'; message: string };

type Row = Record<string, unknown>;
const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const object = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});
const list = (v: unknown): Row[] => (Array.isArray(v) ? v.map(object) : []);

export function readConfig(v: unknown): RosterConfig {
  const c = object(v);
  return {
    configured: c.configured === true,
    absenceRevokesAccess: c.absence_revokes_access === true,
    rosterComplete: c.roster_complete === true,
    wouldEnd: num(c.would_end),
    unbound: num(c.unbound),
    lastPromotedAt: c.last_promoted_at ? text(c.last_promoted_at) : null,
  };
}

export function readPerson(r: Row): UnboundPerson {
  return {
    sourcedId: text(r.sourced_id),
    role: text(r.role),
    givenName: text(r.given_name),
    familyName: text(r.family_name),
    courses: list(r.courses).map((c) => ({ course: text(c.course), term: text(c.term), role: text(c.role) })),
  };
}

export function readBound(r: Row): BoundPerson {
  return {
    sourcedId: text(r.sourced_id),
    role: text(r.role),
    givenName: text(r.given_name),
    familyName: text(r.family_name),
    account: text(r.account),
    handle: text(r.handle),
    method: text(r.method),
    boundAt: text(r.bound_at),
  };
}

/** The desk in one read: the settings, the unbound and the bound people, or why there is no desk. */
export async function loadRosterDesk(tenant: string): Promise<RosterDesk> {
  const db = await cloud();
  const [config, people, bound] = await Promise.all([
    db.rpc('roster_admin_config', { want_tenant: tenant }),
    db.rpc('roster_admin_unbound', { want_tenant: tenant }),
    db.rpc('roster_admin_bound', { want_tenant: tenant }),
  ]);
  if (notSetUp(config.error) || notSetUp(people.error)) return { state: 'not-set-up' };
  const boundMissing = notSetUp(bound.error);
  const refused = config.error ?? people.error ?? (boundMissing ? null : bound.error);
  if (refused && denied(refused)) {
    return { state: 'denied', message: serviceError(refused, 'You cannot open the roster desk at this school.').message };
  }
  if (refused) throw serviceError(refused, 'Could not load the roster.');
  return {
    state: 'ready',
    config: readConfig(config.data),
    people: list(people.data).map(readPerson),
    bound: boundMissing ? null : list(bound.data).map(readBound),
  };
}

/** The server answers at most this many accounts per search. */
export const SEARCH_LIMIT = 20;
/** And refuses a search shorter than this. */
export const SEARCH_MIN = 3;

export interface FoundAccount {
  account: string;
  handle: string;
  /** The address masked to its first letter and domain: `m•••@school.edu`. */
  emailHint: string | null;
}

/** Why a search cannot be sent, or null when it can. */
export function searchProblem(raw: string): string | null {
  const v = raw.trim();
  if (v.length < SEARCH_MIN) return `Type at least ${SEARCH_MIN} characters of the person’s handle or school address.`;
  if (v.length > 100) return 'A search is at most 100 characters.';
  return null;
}

/**
 * Accounts at this school that could be bound: not already bound here, never
 * the caller's own. At most `SEARCH_LIMIT`.
 */
export async function findAccounts(tenant: string, query: string): Promise<FoundAccount[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('roster_admin_find_accounts', { want_tenant: tenant, want_query: query.trim() });
  if (error) throw serviceError(error, 'The search did not run.');
  return list(data).map((r) => ({ account: text(r.account), handle: text(r.handle), emailHint: r.email_hint ? text(r.email_hint) : null }));
}

export interface GrantMade {
  role: string;
  /** `<school>/<CODE>/<TERM>`. */
  scope: string;
}

export interface BindReceipt {
  outcome: 'bound' | 'already-bound';
  grants: GrantMade[];
  replayed: boolean;
}

/** Bind one roster person to one account at this school. The key is kept across a retry after a lost reply. */
export async function bindPerson(tenant: string, sourcedId: string, account: string, key: string): Promise<BindReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('roster_admin_bind', {
    want_tenant: tenant, want_sourced_id: sourcedId, want_subject: account, want_key: key,
  });
  if (error) throw serviceError(error, 'The binding was not made.');
  const r = object(data);
  return {
    outcome: r.outcome === 'already-bound' ? 'already-bound' : 'bound',
    grants: list(r.grants).map((g) => ({ role: text(g.role), scope: text(g.scope) })),
    replayed: r.replayed === true,
  };
}

export interface AbsenceReceipt {
  outcome: 'turned-on' | 'turned-off' | 'unchanged';
  on: boolean;
  /** Roster grants the re-projection ended, when the switch changed. */
  revoked: number;
  replayed: boolean;
}

/**
 * Turn absence-means-removal on or off. `expect` is the value the
 * administrator saw; if it changed since, the server refuses (`stale`) and
 * nothing is written.
 */
export async function setAbsence(tenant: string, on: boolean, expect: boolean, key: string): Promise<AbsenceReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('roster_admin_set_absence', {
    want_tenant: tenant, want_on: on, want_expect: expect, want_key: key,
  });
  if (error) throw serviceError(error, 'The setting was not changed.');
  const r = object(data);
  const outcome = r.outcome === 'turned-on' || r.outcome === 'turned-off' ? r.outcome : 'unchanged';
  return { outcome, on: r.on === true, revoked: num(object(r.grants).revoked), replayed: r.replayed === true };
}

export interface UnbindReceipt {
  outcome: 'unbound' | 'already-unbound';
  /** The roster-given course grants that ended with the binding. */
  revoked: GrantMade[];
  replayed: boolean;
}

/**
 * Remove one roster person's binding. `expect` is the account the
 * administrator saw bound; if the person is bound to another one now, the
 * server refuses (`stale`) and nothing is written. The course access the
 * roster gave that account ends in the same step.
 */
export async function unbindPerson(tenant: string, sourcedId: string, expect: string, key: string): Promise<UnbindReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('roster_admin_unbind', {
    want_tenant: tenant, want_sourced_id: sourcedId, want_expect: expect, want_key: key,
  });
  if (error) throw serviceError(error, 'The binding was not removed.');
  const r = object(data);
  return {
    outcome: r.outcome === 'already-unbound' ? 'already-unbound' : 'unbound',
    revoked: list(r.revoked).map((g) => ({ role: text(g.role), scope: text(g.scope) })),
    replayed: r.replayed === true,
  };
}

/** The server's "someone changed this since you looked". */
export const stale = (e: unknown): boolean => e instanceof Error && /^stale\b/i.test(e.message);

const ROLE_WORD: Record<string, string> = { student: 'student', faculty: 'instructor', teaching_assistant: 'teaching assistant' };

/** "HIST 2100 · 2026FA as student". */
export const courseLabel = (c: RosterCourse): string => `${c.course} · ${c.term} as ${ROLE_WORD[c.role] ?? c.role}`;

/** "hr-u/HIST 2100/2026FA" → "HIST 2100 · 2026FA". */
export function scopeLabel(scope: string): string {
  const [, code, term] = scope.split('/');
  return code && term ? `${code} · ${term}` : scope;
}

export const grantLabel = (g: GrantMade): string => `${scopeLabel(g.scope)} as ${ROLE_WORD[g.role] ?? g.role}`;

/** "Maya Rostered", or the sourcedId when the roster gave no name. */
export const personName = (p: Pick<UnboundPerson, 'givenName' | 'familyName' | 'sourcedId'>): string =>
  [p.givenName, p.familyName].filter(Boolean).join(' ') || p.sourcedId;

/** "maya_two · m•••@school.edu", or the handle alone. */
export const accountLabel = (a: Pick<FoundAccount, 'handle' | 'emailHint'>): string => [a.handle, a.emailHint].filter(Boolean).join(' · ');
