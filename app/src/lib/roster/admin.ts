import { cloud } from '../cloud';
import { serviceError } from '../attempt';

/**
 * The roster desk's client: a school administrator's view of the roster
 * people nobody has bound to an account yet, binding one, and the school's
 * absence-means-removal switch.
 *
 * Every call is one of the four definers in
 * `supabase/migrations/20261021090000_roster_admin_desk.sql`, each of which
 * raises unless the caller holds `roster:administer` over the school. What the
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

export type RosterDesk =
  | { state: 'ready'; config: RosterConfig; people: UnboundPerson[] }
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

/** The desk in one read: the settings and the unbound people, or why there is no desk. */
export async function loadRosterDesk(tenant: string): Promise<RosterDesk> {
  const db = await cloud();
  const [config, people] = await Promise.all([
    db.rpc('roster_admin_config', { want_tenant: tenant }),
    db.rpc('roster_admin_unbound', { want_tenant: tenant }),
  ]);
  if (notSetUp(config.error) || notSetUp(people.error)) return { state: 'not-set-up' };
  const refused = config.error ?? people.error;
  if (refused && denied(refused)) {
    return { state: 'denied', message: serviceError(refused, 'You cannot open the roster desk at this school.').message };
  }
  if (refused) throw serviceError(refused, 'Could not load the roster.');
  return { state: 'ready', config: readConfig(config.data), people: list(people.data).map(readPerson) };
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

/** The server's "someone changed this since you looked". */
export const stale = (e: unknown): boolean => e instanceof Error && /^stale\b/i.test(e.message);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why a pasted account id cannot be sent, or null when it can. */
export function accountIdProblem(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Paste the Semester account id of the person to bind.';
  if (!UUID.test(v)) return 'That is not an account id. One looks like 1b2c3d4e-0000-4000-8000-000000000000.';
  return null;
}

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
export const personName = (p: UnboundPerson): string => [p.givenName, p.familyName].filter(Boolean).join(' ') || p.sourcedId;
