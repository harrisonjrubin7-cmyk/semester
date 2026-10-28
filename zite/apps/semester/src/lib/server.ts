import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import { authorize, Action } from './authz';
import { pg } from './pg';
import { roleForApp } from './roleApps';
import { DEC_MIGRATION } from './decMigration';
import { AFF_MIGRATION } from './affMigration';
import { pickMembership } from './affiliationRules';

export const ids = (v: string | string[] | undefined | null): string[] =>
  !v ? [] : Array.isArray(v) ? v : [v];
export const first = (v: string | string[] | undefined | null) => ids(v)[0];

export type Access = {
  userId: string;
  membershipId: string;
  institutionId: string;
  institutionName: string;
  roles: string[];
  /** the tenant is a demo/sample institution: its catalog records are labelled Sample */
  isSample: boolean;
  /** the institution's recorded IANA time zone; undefined until the institution sets one */
  timeZone?: string;
  /** ties this request's authorization decision (authz_decisions) to the audit events it writes */
  correlationId?: string;
};

let affReady: Promise<void> | null = null;
export function ensureAff() {
  if (!affReady) affReady = (async () => { for (const q of AFF_MIGRATION) await pg().query(q); })().catch((e) => { affReady = null; throw e; });
  return affReady;
}

/** The one membership this request acts under (S-76 E28). With several active memberships (a personal workspace and an
 *  institution, say) the member's stored choice wins if still active, else an institution over a personal or sample
 *  workspace. Never taken from the client. */
export async function currentMembership(userId: string) {
  const { records } = await zite.memberships.findAll({ filters: { member: userId }, limit: 20 });
  const active = records.filter((r) => r.status === 'Active' && first(r.institution));
  if (active.length <= 1) return active[0];
  await ensureAff();
  const pref = ((await pg().query(`SELECT membership_id FROM aff_current WHERE user_id = $1`, [userId])) as { membership_id: string }[])[0]?.membership_id ?? null;
  const shaped = await Promise.all(active.map(async (r) => {
    const inst = await zite.institutions.findOne({ id: first(r.institution)! });
    return { id: r.id, personal: (inst?.tenantType ?? '') === 'Personal', sample: !!inst?.isSample };
  }));
  const pick = pickMembership(shaped, pref);
  return active.find((r) => r.id === pick?.id);
}

/** The institution's recorded time zone, read defensively: the generated record type may lag a newly added field. */
const recordedZone = (inst: unknown): string | undefined => {
  const tz = (inst as { timeZone?: unknown } | null | undefined)?.timeZone;
  return typeof tz === 'string' && tz.trim() ? tz : undefined;
};

/** Deny by default: caller must hold an active membership in a tenant. */
export async function requireAccess(userId: string, needRoles?: string[]): Promise<Access> {
  const m = await currentMembership(userId);
  if (!m) throw new ZiteError({ code: 'FORBIDDEN', message: 'No active membership', userFacingMessage: 'You need an active workspace to do this.' });
  const roles = m.roles ?? [];
  if (needRoles && !needRoles.some((r) => roles.includes(r))) {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'Role not permitted', userFacingMessage: 'Your role does not allow this.' });
  }
  const institutionId = first(m.institution)!;
  const inst = await zite.institutions.findOne({ id: institutionId });
  return { userId, membershipId: m.id, institutionId, institutionName: inst?.name ?? '', roles, isSample: !!inst?.isSample, timeZone: recordedZone(inst) };
}

/**
 * Unified gate: loads the caller's membership and asks lib/authz.authorize() (deny by default, unit-tested).
 * The resource is the caller's own tenant here; record-level checks (ownership, tenantScope) still run in each endpoint.
 */
export async function requireAction(userId: string, action: Action, extra: { policyBlocks?: string[]; authorityGranted?: boolean } = {}): Promise<Access> {
  const m = await currentMembership(userId);
  const tenantId = m ? first(m.institution)! : '';
  const activeRole = m ? await activeRoleOf(tenantId, userId, m.roles ?? []) : undefined;
  const d = authorize({ actorId: userId, membership: m ? { status: m.status ?? '', tenantId, roles: m.roles ?? [], templates: m.roleTemplates ?? [], activeRole } : null, action,
    resource: { tenantId, classification: 'directory' }, ...extra });
  const correlationId = crypto.randomUUID();
  await logDecision({ correlationId, actorId: userId, tenantId, action, allow: d.allow, failedRule: d.allow ? null : String(d.failed ?? '') });
  if (!d.allow) throw new ZiteError({ code: 'FORBIDDEN', message: `authz:${d.failed}:${action}:${correlationId}`, userFacingMessage: `${d.reason} (Reference ${correlationId.slice(0, 8)})` });
  const inst = await zite.institutions.findOne({ id: tenantId });
  return { userId, membershipId: m!.id, institutionId: tenantId, institutionName: inst?.name ?? '', roles: m!.roles ?? [], isSample: !!inst?.isSample, correlationId, timeZone: recordedZone(inst) };
}

/** Which of these actions the caller may take in their current context. Used to decide what a screen asks for, so a page
 *  never requests data the viewer cannot have. It reveals only the caller's own permissions and is not an access attempt,
 *  so it is not written to the decision log; every real read or write still goes through requireAction. */
export async function capabilities(userId: string, actions: Action[]): Promise<{ institutionId: string | null; roles: string[]; can: Partial<Record<Action, boolean>> }> {
  const m = await currentMembership(userId);
  const tenantId = m ? first(m.institution)! : '';
  const activeRole = m ? await activeRoleOf(tenantId, userId, m.roles ?? []) : undefined;
  const can: Partial<Record<Action, boolean>> = {};
  for (const action of actions) can[action] = authorize({ actorId: userId, membership: m ? { status: m.status ?? '', tenantId, roles: m.roles ?? [], templates: m.roleTemplates ?? [], activeRole } : null, action,
    resource: { tenantId, classification: 'directory' } }).allow;
  return { institutionId: m ? tenantId : null, roles: m?.roles ?? [], can };
}

let decReady: Promise<void> | null = null;
/** SEC-039: every requireAction decision, allow or deny, goes to the append-only authz_decisions log. A deny is logged before it
 *  throws; if the log write itself fails the request is refused rather than proceeding unlogged. */
async function logDecision(e: { correlationId: string; actorId: string; tenantId: string; action: string; allow: boolean; failedRule: string | null }) {
  const sql = pg();
  if (!decReady) decReady = (async () => { for (const q of DEC_MIGRATION) await sql.query(q); })().catch((x) => { decReady = null; throw x; });
  try {
    await decReady;
    await sql.query(`INSERT INTO authz_decisions (correlation_id, actor_id, tenant_id, action, decision, failed_rule) VALUES ($1,$2,$3,$4,$5,$6)`,
      [e.correlationId, e.actorId, e.tenantId, e.action, e.allow ? 'allow' : 'deny', e.failedRule]);
  } catch {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'authz:log_unavailable', userFacingMessage: 'This action is unavailable right now. Try again in a moment.' });
  }
}

/** The role a multi-role person is acting as, from the app they explicitly switched to. Single-role people, people who never
 *  switched, and stored choices for a role they no longer hold all return undefined (no extra narrowing). */
async function activeRoleOf(tenantId: string, userId: string, roles: string[]): Promise<string | undefined> {
  if (roles.length < 2) return undefined;
  try {
    const rows = (await pg().query(`SELECT app_key FROM ctx_active WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId])) as { app_key: string }[];
    const role = rows[0] ? roleForApp(rows[0].app_key) : null;
    return role && roles.includes(role) ? role : undefined;
  } catch { return undefined; } // context table not created yet: nobody has switched
}

const userIdsOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v == null ? [] : String(v).replace(/[[\]"{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean);

export type Tenant = {
  institutionId: string;
  /** user ids holding any membership (any status) in the institution */
  members: Set<string>;
  courses: Set<string>;
  sections: Set<string>;
  groups: Set<string>;
  requirements: Set<string>;
};

/** Everything that belongs to one institution. Use it to keep every list and decision inside the caller's tenant. */
export async function tenantScope(institutionId: string): Promise<Tenant> {
  const q = (query: string) => zite.sql({ query, params: [institutionId] });
  const [m, c, s, g, r] = await Promise.all([
    q(`SELECT mem."member" AS u FROM "Memberships" mem JOIN "InstitutionsMemberships" l ON l."membershipsId" = mem.id WHERE l."institutionsId" = $1`),
    q(`SELECT ci."coursesId" AS id FROM "CoursesInstitutions" ci WHERE ci."institutionsId" = $1`),
    q(`SELECT cs."sectionsId" AS id FROM "CoursesSections" cs JOIN "CoursesInstitutions" ci ON ci."coursesId" = cs."coursesId" WHERE ci."institutionsId" = $1`),
    q(`SELECT gi."groupsId" AS id FROM "GroupsInstitutions" gi WHERE gi."institutionsId" = $1`),
    q(`SELECT ir."requirementsId" AS id FROM "InstitutionsRequirements" ir WHERE ir."institutionsId" = $1`),
  ]);
  const set = (rows: Record<string, unknown>[]) => new Set(rows.map((x) => String(x.id)));
  return {
    institutionId,
    members: new Set(m.rows.flatMap((x) => userIdsOf(x.u))),
    courses: set(c.rows), sections: set(s.rows), groups: set(g.rows), requirements: set(r.rows),
  };
}

/** True when any id in a linked/user field value is inside the set. */
export const inSet = (v: string | string[] | undefined | null, set: Set<string>) => ids(v).some((x) => set.has(x));

export async function audit(a: Access | { userId: string; institutionId?: string; correlationId?: string }, action: string, recordRef: string, details = '', authority = '', viaAssistant = false) {
  const cid = 'correlationId' in a && a.correlationId ? ` · ref ${a.correlationId}` : '';
  await zite.auditEvents.create({
    record: {
      action, actor: a.userId, institution: a.institutionId ?? null, recordRef,
      authority, viaAssistant, details: `${details}${cid}`,
    },
  });
}

export const forbid = (msg = 'You cannot access this record.') => {
  throw new ZiteError({ code: 'FORBIDDEN', message: msg, userFacingMessage: msg });
};

export async function userNames(userIds: string[]) {
  const uniq = [...new Set(userIds.filter(Boolean))];
  if (!uniq.length) return {} as Record<string, string>;
  const { rows } = await zite.sql({
    query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`,
    params: [uniq],
  });
  const out: Record<string, string> = {};
  rows.forEach((r) => { out[String(r.id)] = String(r.name || r.email || 'Member'); });
  return out;
}

/** Refuses unless the target user has an active membership in this institution. Use before granting any office role. */
export async function requireTenantMember(institutionId: string, userId: string) {
  const { records } = await zite.memberships.findAll({ filters: { member: userId, institution: institutionId }, limit: 5 });
  if (!records.some((r) => r.status === 'Active')) forbid('That person is not an active member of your institution.');
}
