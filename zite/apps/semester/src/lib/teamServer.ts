import { zite } from 'zitejs/db';
import { ids } from './server';
import { pg } from './pg';
import { TEAM_MIGRATION } from './teamMigration';

let ready: Promise<void> | null = null;
export const ensureTeam = () => { if (!ready) ready = (async () => { for (const q of TEAM_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

export type CourseRole = 'instructor' | 'delegate' | null;
/** Instructor of record (Zite section) or a live grading delegate (team-001). Delegates grade; only instructors release. */
export async function courseRole(tenant: string, sectionId: string, userId: string): Promise<CourseRole> {
  const s = await zite.sections.findOne({ id: sectionId });
  if (s && ids(s.instructors).includes(userId)) return 'instructor';
  await ensureTeam();
  const r = ((await pg().query(`SELECT crs_is_delegate($1,$2,$3) AS ok`, [tenant, sectionId, userId])) as { ok: boolean }[])[0];
  return r?.ok ? 'delegate' : null;
}

/** Sections this user currently grades as a delegate. */
export async function delegatedSections(tenant: string, userId: string): Promise<string[]> {
  await ensureTeam();
  return ((await pg().query(`SELECT section_id FROM crs_delegations WHERE tenant_id = $1 AND delegate_id = $2 AND revoked_at IS NULL AND expires_at > now()`, [tenant, userId])) as { section_id: string }[]).map((r) => r.section_id);
}
