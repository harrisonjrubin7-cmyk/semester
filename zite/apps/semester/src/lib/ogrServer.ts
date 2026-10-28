import { zite } from 'zitejs/db';
import { pg } from './pg';
import { ids, first } from './server';
import { OGR_MIGRATION } from './ogrMigration';

// Server helpers for course grade → official grade. The gradebook snapshot (basis) is always computed here from the
// section's assignments and submissions, never accepted from the client.
type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
export const ensureOgr = () => { if (!ready) ready = (async () => { for (const q of OGR_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
export const one = async (q: string, p: unknown[]) => ((await pg().query(q, p)) as { r: string | null }[])[0]?.r ?? null;

export async function gradebookBasis(sectionId: string, studentId: string) {
  const tasks = (await zite.tasks.findAll({ filters: { section: sectionId, type: 'Assignment' }, limit: 300 })).records;
  const subs = (await Promise.all(tasks.map((t) => zite.submissions.findAll({ filters: { task: t.id, student: studentId }, limit: 5 })))).flatMap((x) => x.records);
  const items = tasks.map((t) => {
    const s = subs.find((x) => first(x.task) === t.id);
    return { task: t.id, title: t.title ?? '', points: Number(t.points ?? 100), score: s && typeof s.score === 'number' ? s.score : null, state: s?.state ?? 'Missing' };
  });
  const scored = items.filter((i) => i.score !== null);
  const earned = scored.reduce((n, i) => n + (i.score as number), 0);
  const possible = items.reduce((n, i) => n + i.points, 0);
  return { at: new Date().toISOString(), items, earned, possible, percent: possible ? Math.round((earned / possible) * 1000) / 10 : null, missing: items.filter((i) => i.state === 'Missing').length };
}

/** Instructor of record: listed on the section and holding the Faculty role. Delegates (TAs) are not instructors of record. */
export async function isInstructorOfRecord(sectionId: string, userId: string, roles: string[]) {
  const s = await zite.sections.findOne({ id: sectionId });
  return !!s && ids(s.instructors).includes(userId) && roles.includes('Faculty');
}

export async function propose(tenant: string, actor: string, roles: string[], enrollmentId: string, grade: string, expected: number) {
  await ensureOgr();
  const e = await zite.enrollments.findOne({ id: enrollmentId });
  if (!e) return 'Enrollment not found.';
  const section = first(e.section) ?? ''; const student = first(e.student) ?? '';
  const ok = await isInstructorOfRecord(section, actor, roles);
  const basis = ok ? await gradebookBasis(section, student) : {};
  return one(`SELECT ogr_propose($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) AS r`, [actor, tenant, enrollmentId, section, student, ok, grade, JSON.stringify(basis), expected]);
}

/** Write an official entry into the institution's records — only in pilot/authoritative mode, or for a sample institution. */
export async function project(tenant: string, isSample: boolean, entryId: number, actor: string): Promise<'projected' | 'held' | 'failed'> {
  const e = ((await pg().query(`SELECT e.*, aum_mode(e.tenant_id, 'records') AS mode, (SELECT 1 FROM ogr_projections p WHERE p.entry_id = e.id) AS done FROM ogr_entries e WHERE e.id = $1 AND e.tenant_id = $2`, [entryId, tenant])) as Row[])[0];
  if (!e) return 'failed';
  if (e.done) return 'projected';
  const live = e.mode === 'pilot' || e.mode === 'authoritative';
  if (!live && !isSample) return 'held';
  try {
    const enrollment = String(e.enrollment_id);
    const prior = (await zite.officialGradeRecords.findAll({ filters: { enrollment }, limit: 50 })).records.filter((r) => r.recordState === 'Current');
    for (const p of prior) await zite.officialGradeRecords.update({ id: p.id, record: { recordState: 'Superseded' } as never });
    await zite.officialGradeRecords.create({ record: { label: `Official grade r${e.revision}`, enrollment, grade: String(e.grade), recordVersion: Number(e.revision), recordState: 'Current',
      authorityMode: live ? 'Semester authoritative' : 'Sample', releasedBy: actor } as never });
    await zite.enrollments.update({ id: enrollment, record: { finalGrade: String(e.grade), gradeReleased: true } as never });
    await pg().query(`SELECT ogr_mark_projected($1,$2,$3)`, [entryId, tenant, live ? 'records' : 'sample-records']);
    return 'projected';
  } catch { return 'failed'; }
}
