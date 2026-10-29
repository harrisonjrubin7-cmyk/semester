import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, ids, forbid, audit, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { CRS_MIGRATION } from '../lib/crsMigration';
import { ASG_MIGRATION } from '../lib/asgMigration';
import { ASM_MIGRATION } from '../lib/asmMigration';
import { REUSE_MIGRATION } from '../lib/reuseMigration';
import { ensureCal } from '../lib/calendarServer';
import { courseRole } from '../lib/teamServer';
import { sectionLabel } from '../lib/sectionRequestRules';

let ready: Promise<void> | null = null;
const ensureReuse = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of [...CRS_MIGRATION, ...ASG_MIGRATION, ...ASM_MIGRATION, ...REUSE_MIGRATION]) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};

type Row = Record<string, unknown>;

// Course reuse (term completion -> archive -> retention -> course reuse): the instructor of record copies a
// section's teaching shell into a new section for a different term. The shell is the syllabus, assignments as
// fresh drafts (due dates cleared, group sets detached), assessments as drafts (windows shifted by the
// calendar delta when both terms have approved calendars), visible course materials and the AI policy.
// Student data never copies: no enrollments, submissions, attempts, grades, discussions or task links.
export default createEndpoint({
  description: 'Reuse a course in a new term: copies the teaching shell (syllabus, assignment and assessment drafts, materials) into a new section; student data never copies',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('copy'), sectionId: z.string(), newTerm: z.string().min(3).max(40) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const T = a.institutionId, uid = a.userId;
    const tenant = await tenantScope(T);
    if (!tenant.sections.has(input.sectionId)) forbid('That section is not offered by your institution.');
    const src = await zite.sections.findOne({ id: input.sectionId });
    if (!src) throw new ZiteError({ code: 'NOT_FOUND', message: 'Section not found.', userFacingMessage: 'Section not found.' });
    if ((await courseRole(T, input.sectionId, uid)) !== 'instructor') forbid('Only the instructor of record can reuse this course for a new term.');
    const newTerm = input.newTerm.trim();
    const srcTerm = String(src.term ?? '');
    if (newTerm === srcTerm) throw new ZiteError({ code: 'BAD_REQUEST', message: 'Choose a different term for the new section.', userFacingMessage: 'Choose a different term for the new section.' });

    const courseId = first(src.course);
    const course = courseId ? await zite.courses.findOne({ id: courseId }) : null;
    const parts = String(src.label ?? '').split(' · ');
    const label = sectionLabel(String(course?.code ?? parts[0] ?? 'Course'), parts.length === 3 ? parts[1] : '01', newTerm);
    const all = (await zite.sections.findAll({ limit: 2000 })).records.filter((s) => tenant.sections.has(s.id));
    if (all.some((s) => s.label === label)) throw new ZiteError({ code: 'BAD_REQUEST', message: `A section labelled ${label} already exists. Reuse creates a new section; open that one instead.`, userFacingMessage: `A section labelled ${label} already exists. Reuse creates a new section; open that one instead.` });
    const sibling = all.find((s) => String(s.term ?? '') === newTerm && ids(s.academicTerm).length > 0);

    // Assessment windows shift by the difference in class start dates when both terms have approved calendars.
    await ensureCal();
    const sql = pg();
    const starts = ((await sql.query(`SELECT term, classes_start FROM cal_terms WHERE tenant_id = $1 AND state = 'approved' AND term IN ($2, $3) ORDER BY version DESC`, [T, srcTerm, newTerm])) as Row[]);
    const startOf = (t: string) => { const r = starts.find((x) => String(x.term) === t); return r ? new Date(String(r.classes_start)).getTime() : null; };
    const from = startOf(srcTerm), to = startOf(newTerm);
    const shiftDays = from != null && to != null ? Math.round((to - from) / 86_400_000) : null;

    const sec = await zite.sections.create({ record: {
      label, course: courseId ? [courseId] : [], term: newTerm, ...(sibling ? { academicTerm: ids(sibling.academicTerm) } : {}),
      meetingTimes: String(src.meetingTimes ?? ''), instructors: [uid], capacity: Number(src.capacity ?? 30),
      sectionState: 'Open', recordVersion: 1, courseAiPolicy: String(src.courseAiPolicy ?? 'Allowed'), syllabus: String(src.syllabus ?? ''),
    } as never });

    await ensureReuse();
    const r = ((await sql.query(`SELECT reuse_copy_shell($1,$2,$3,$4,$5) AS r`, [T, input.sectionId, sec.id, uid, shiftDays])) as { r: { error?: string; syllabus: boolean; assignments: number; assessments: number } }[])[0].r;
    if (r.error) throw new ZiteError({ code: 'BAD_REQUEST', message: r.error, userFacingMessage: r.error });

    const mats = (await zite.resources.findAll({ limit: 500 })).records.filter((x) => first(x.section) === input.sectionId && x.kind === 'Material' && x.visibility === 'Course');
    for (const m of mats) {
      await zite.resources.create({ record: { title: String(m.title ?? 'Material'), kind: 'Material', owner: uid, section: sec.id, visibility: 'Course', source: String(m.source ?? 'Official'), body: String(m.body ?? '') } as never });
    }
    await audit(a, 'Course reused for a new term', `section:${sec.id}`, `${label}: ${r.assignments} assignments, ${r.assessments} assessments, ${mats.length} materials copied from ${String(src.label ?? input.sectionId)}; no student data copied`, 'Instructor of record');
    return { newSectionId: sec.id, label, syllabusCopied: r.syllabus, assignments: r.assignments, assessments: r.assessments, materials: mats.length, datesShiftDays: shiftDays, datesNeedReview: shiftDays === null };
  },
});
