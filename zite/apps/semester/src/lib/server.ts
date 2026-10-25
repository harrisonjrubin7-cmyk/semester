import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import { authorize, Action } from './authz';
import { pg } from './pg';
import { roleForApp } from './roleApps';

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
};

/** Deny by default: caller must hold an active membership in a tenant. */
export async function requireAccess(userId: string, needRoles?: string[]): Promise<Access> {
  const { records } = await zite.memberships.findAll({ filters: { member: userId }, limit: 20 });
  const m = records.find((r) => r.status === 'Active' && first(r.institution));
  if (!m) throw new ZiteError({ code: 'FORBIDDEN', message: 'No active membership', userFacingMessage: 'You need an active workspace to do this.' });
  const roles = m.roles ?? [];
  if (needRoles && !needRoles.some((r) => roles.includes(r))) {
    throw new ZiteError({ code: 'FORBIDDEN', message: 'Role not permitted', userFacingMessage: 'Your role does not allow this.' });
  }
  const institutionId = first(m.institution)!;
  const inst = await zite.institutions.findOne({ id: institutionId });
  return { userId, membershipId: m.id, institutionId, institutionName: inst?.name ?? '', roles, isSample: !!inst?.isSample };
}

/**
 * Unified gate: loads the caller's membership and asks lib/authz.authorize() (deny by default, unit-tested).
 * The resource is the caller's own tenant here; record-level checks (ownership, tenantScope) still run in each endpoint.
 */
export async function requireAction(userId: string, action: Action, extra: { policyBlocks?: string[]; authorityGranted?: boolean } = {}): Promise<Access> {
  const { records } = await zite.memberships.findAll({ filters: { member: userId }, limit: 20 });
  const m = records.find((r) => r.status === 'Active' && first(r.institution));
  const tenantId = m ? first(m.institution)! : '';
  const activeRole = m ? await activeRoleOf(tenantId, userId, m.roles ?? []) : undefined;
  const d = authorize({ actorId: userId, membership: m ? { status: m.status ?? '', tenantId, roles: m.roles ?? [], templates: m.roleTemplates ?? [], activeRole } : null, action,
    resource: { tenantId, classification: 'directory' }, ...extra });
  if (!d.allow) throw new ZiteError({ code: 'FORBIDDEN', message: `authz:${d.failed}:${action}`, userFacingMessage: d.reason });
  const inst = await zite.institutions.findOne({ id: tenantId });
  return { userId, membershipId: m!.id, institutionId: tenantId, institutionName: inst?.name ?? '', roles: m!.roles ?? [], isSample: !!inst?.isSample };
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

export async function audit(a: Access | { userId: string; institutionId?: string }, action: string, recordRef: string, details = '', authority = '', viaAssistant = false) {
  await zite.auditEvents.create({
    record: {
      action, actor: a.userId, institution: a.institutionId ?? null, recordRef,
      authority, viaAssistant, details,
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
