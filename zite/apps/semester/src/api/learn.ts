import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { CRS_MIGRATION } from '../lib/crsMigration';
import { ensureFil, attachmentsFor, readAttached } from '../lib/filServer';

let crsReady: Promise<void> | null = null;
const ensureCrs = () => {
  if (!crsReady) { const sql = pg(); crsReady = (async () => { for (const q of CRS_MIGRATION) await sql.query(q); })().catch((e) => { crsReady = null; throw e; }); }
  return crsReady;
};

export default createEndpoint({
  description: 'Course spaces: sections, assignments, private drafts, submissions, grading and release',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('section'), sectionId: z.string() }),
    z.object({ action: z.literal('saveDraft'), taskId: z.string(), fileId: z.string().uuid().optional() }),
    z.object({ action: z.literal('detachFile'), submissionId: z.string(), fileId: z.string().uuid() }),
    z.object({ action: z.literal('openAttachment'), submissionId: z.string(), fileId: z.string().uuid() }),
    z.object({ action: z.literal('submit'), submissionId: z.string() }),
    z.object({ action: z.literal('grade'), submissionId: z.string(), score: z.number().min(0), feedback: z.string() }),
    z.object({ action: z.literal('release'), sectionId: z.string() }),
    z.object({ action: z.literal('setPolicy'), sectionId: z.string(), policy: z.enum(['Allowed', 'Outlining Only', 'Not Allowed']) }),
    z.object({ action: z.literal('teach'), sectionId: z.string() }),
    z.object({ action: z.literal('publishSyllabus'), sectionId: z.string(), body: z.string().min(20).max(40000), note: z.string().max(300), expectedVersion: z.number().int().min(0) }),
    z.object({ action: z.literal('addMaterial'), sectionId: z.string(), title: z.string().min(2).max(160), url: z.string().url().max(800).refine((u) => u.startsWith('https://'), 'Use an https link'), note: z.string().max(500) }),
    z.object({ action: z.literal('hideMaterial'), sectionId: z.string(), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const isFaculty = a.roles.includes('Faculty');
    const loadSection = async (id: string) => {
      const s = await zite.sections.findOne({ id });
      if (!s) forbid();
      const teaching = ids(s!.instructors).includes(uid);
      const enrolled = !!(await zite.enrollments.findOne({ filters: { student: uid, section: id } }));
      if (!teaching && !enrolled) forbid('You are not enrolled in or teaching this section.');
      return { s: s!, teaching };
    };

    if (input.action === 'list') {
      const [mine, secs, courses] = await Promise.all([
        zite.enrollments.findAll({ filters: { student: uid }, limit: 500 }),
        zite.sections.findAll({ limit: 1000 }),
        zite.courses.findAll({ limit: 1000 }),
      ]);
      const cById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
      const tenant = isFaculty ? await tenantScope(a.institutionId) : null;
      const enrolledIds = new Set(mine.records.filter((e) => e.status === 'Enrolled').map((e) => first(e.section)));
      const row = (s: (typeof secs.records)[0], role: string) => ({ id: s.id, label: s.label ?? '', code: cById[first(s.course) ?? '']?.code ?? '', title: cById[first(s.course) ?? '']?.title ?? '', term: s.term ?? '', times: s.meetingTimes ?? '', policy: s.courseAiPolicy ?? 'Allowed', role });
      return {
        learning: secs.records.filter((s) => enrolledIds.has(s.id)).map((s) => row(s, 'Student')),
        teaching: secs.records.filter((s) => ids(s.instructors).includes(uid)).map((s) => row(s, 'Faculty')),
        canTeach: isFaculty ? secs.records.filter((s) => tenant!.sections.has(s.id) && s.term === 'Fall 2026' && !ids(s.instructors).includes(uid)).map((s) => row(s, 'Faculty')) : [],
      };
    }
    if (input.action === 'teach') {
      if (!isFaculty) forbid('Only faculty can teach a section.');
      const tenant = await tenantScope(a.institutionId);
      if (!tenant.sections.has(input.sectionId)) forbid('That section is not in your institution.');
      const s = await zite.sections.findOne({ id: input.sectionId });
      await zite.sections.update({ id: input.sectionId, record: { instructors: [...ids(s?.instructors), uid] } as never });
      await audit(a, 'Instructor assigned (sample)', `section:${input.sectionId}`, '', 'Faculty');
      return { ok: true };
    }
    if (input.action === 'publishSyllabus' || input.action === 'addMaterial' || input.action === 'hideMaterial') {
      const { s, teaching } = await loadSection(input.sectionId);
      if (!teaching) forbid('Only an instructor of this section can change it.');
      if (input.action === 'publishSyllabus') {
        await ensureCrs();
        const e = ((await pg().query(`SELECT crs_publish_syllabus($1,$2,$3,$4,$5,$6) AS e`, [a.institutionId, s.id, uid, input.body, input.note, input.expectedVersion])) as { e: string | null }[])[0].e;
        if (e) throw new ZiteError({ code: 'CONFLICT', message: e, userFacingMessage: e });
        await zite.sections.update({ id: s.id, record: { syllabus: input.body.trim() } as never });
        const students = (await zite.enrollments.findAll({ filters: { section: s.id }, limit: 2000 })).records.filter((x) => x.status === 'Enrolled').map((x) => first(x.student)).filter(Boolean) as string[];
        if (students.length) await zite.messages.create({ record: { body: `The syllabus for ${s.label} was updated${input.note ? `: ${input.note}` : ''}.`, sender: uid, recipients: students, isNotification: true, read: false } as never });
        await audit(a, 'Syllabus published', `section:${s.id}`, input.note, 'Instructor of record');
      } else if (input.action === 'addMaterial') {
        await zite.resources.create({ record: { title: input.title, kind: 'Material', owner: uid, section: s.id, visibility: 'Course', source: 'Official', body: `${input.url}${input.note ? `\n${input.note}` : ''}` } as never });
        await audit(a, 'Course material added', `section:${s.id}`, input.title, 'Instructor of record');
      } else {
        const r = await zite.resources.findOne({ id: input.id });
        if (!r || first(r.section) !== s.id || r.visibility !== 'Course') forbid('Material not found in this section.');
        // Hidden, not deleted: it leaves the course view and stays with its author.
        await zite.resources.update({ id: r!.id, record: { visibility: 'Only Me' } as never });
        await audit(a, 'Course material hidden', `resource:${r!.id}`, r!.title ?? '', 'Instructor of record');
      }
      return { ok: true };
    }
    if (input.action === 'section') {
      const { s, teaching } = await loadSection(input.sectionId);
      await ensureCrs();
      const history = (await pg().query(`SELECT version, change_note, author_id, published_at FROM crs_syllabus_versions WHERE section_id = $1 ORDER BY version DESC LIMIT 20`, [s.id])) as Record<string, unknown>[];
      const course = await zite.courses.findOne({ id: first(s.course) ?? '' });
      const { records: tasks } = await zite.tasks.findAll({ filters: { section: s.id, type: 'Assignment' }, limit: 500 });
      const visibleTasks = teaching ? tasks : tasks.filter((t) => ids(t.owner).includes(uid));
      // Dedupe assignments by title for the faculty view (sample assignments are per-student)
      const assignments = [...new Map(visibleTasks.map((t) => [teaching ? t.title : t.id, t])).values()];
      const subs = (await zite.submissions.findAll({ limit: 2000 })).records.filter((x) => tasks.some((t) => t.id === first(x.task)));
      const visibleSubs = subs.filter((x) => teaching ? x.state !== 'Private Draft' : ids(x.student).includes(uid));
      const attached = await attachmentsFor(a.institutionId, 'submission', visibleSubs.map((x) => x.id));
      const names = teaching ? await userNames(visibleSubs.map((x) => first(x.student) ?? '')) : {};
      const resources = (await zite.resources.findAll({ filters: { section: s.id }, limit: 300 })).records
        .filter((r) => r.visibility === 'Course' || ids(r.owner).includes(uid));
      return {
        section: { id: s.id, label: s.label ?? '', code: course?.code ?? '', title: course?.title ?? '', term: s.term ?? '', times: s.meetingTimes ?? '', syllabus: s.syllabus ?? '', policy: s.courseAiPolicy ?? 'Allowed' },
        teaching,
        assignments: assignments.map((t) => ({ id: t.id, title: t.title ?? '', dueAt: t.dueAt ?? null, points: t.points ?? null, rubric: t.rubric ?? '', source: t.source ?? 'Official' })),
        submissions: visibleSubs.map((x) => {
          const t = tasks.find((tt) => tt.id === first(x.task));
          return { id: x.id, taskId: first(x.task) ?? '', taskTitle: t?.title ?? '', student: names[first(x.student) ?? ''] ?? 'You', state: x.state ?? 'Private Draft', score: x.score ?? null, feedback: (teaching || x.state === 'Released') ? x.feedback ?? '' : '', files: (x.files ?? []).map((f) => ({ name: f.originalName || f.filename, url: f.url })), attachments: (attached[x.id] ?? []).map((f) => ({ fileId: f.fileId, name: f.name, size: f.size })) };
        }).map((x) => teaching ? x : { ...x, score: x.state === 'Released' ? x.score : null }),
        materials: resources.map((r) => { const [first_, ...rest] = (r.body ?? '').split('\n'); const url = /^https:\/\//.test(first_ ?? '') ? first_ : null;
          return { id: r.id, title: r.title ?? '', kind: r.kind ?? 'Material', source: r.source ?? 'Yours', url, note: url ? rest.join(' ') : '', course: r.visibility === 'Course' }; }),
        syllabusVersion: Number(history[0]?.version ?? 0),
        syllabusUpdatedAt: history[0]?.published_at ? new Date(String(history[0].published_at)).toISOString() : null,
        syllabusHistory: teaching ? await (async () => { const n = await userNames(history.map((h) => String(h.author_id))); return history.map((h) => ({ version: Number(h.version), note: String(h.change_note ?? ''), by: n[String(h.author_id)] ?? 'Instructor', at: new Date(String(h.published_at)).toISOString() })); })() : [],
      };
    }
    if (input.action === 'saveDraft') {
      const t = await zite.tasks.findOne({ id: input.taskId });
      if (!t || !ids(t.owner).includes(uid)) forbid();
      const existing = (await zite.submissions.findAll({ filters: { student: uid, task: input.taskId }, limit: 1 })).records[0];
      if (existing && existing.state !== 'Private Draft') forbid('This work was already submitted.');
      // Files come from the private store (decision D2): the student uploads to You -> Files storage, then attaches here.
      const sub = existing ?? await zite.submissions.create({ record: { label: `${t!.title} · draft`, task: t!.id, student: uid, state: 'Private Draft' } as never });
      if (input.fileId) {
        await ensureFil();
        const e = ((await pg().query(`SELECT fil_attach($1,$2,$3,'submission',$4) AS e`, [a.institutionId, uid, input.fileId, sub.id])) as { e: string | null }[])[0].e;
        if (e) forbid(e);
      }
      return { ok: true, submissionId: sub.id };
    }
    if (input.action === 'detachFile') {
      const x = await zite.submissions.findOne({ id: input.submissionId });
      if (!x || !ids(x.student).includes(uid) || x.state !== 'Private Draft') forbid('Files can be removed only from your own draft.');
      await ensureFil();
      const e = ((await pg().query(`SELECT fil_detach($1,$2,$3,'submission',$4) AS e`, [a.institutionId, uid, input.fileId, x!.id])) as { e: string | null }[])[0].e;
      if (e) forbid(e);
      return { ok: true };
    }
    if (input.action === 'openAttachment') {
      // Who may see this work: the student, or the instructor of its section once it is submitted.
      const x = await zite.submissions.findOne({ id: input.submissionId });
      if (!x) forbid('You do not have access to this file.');
      const own = ids(x!.student).includes(uid);
      if (!own) {
        const t = await zite.tasks.findOne({ id: first(x!.task) ?? '' });
        const s2 = t ? await zite.sections.findOne({ id: first(t.section) ?? '' }) : null;
        if (!s2 || !ids(s2.instructors).includes(uid) || x!.state === 'Private Draft') forbid('You do not have access to this file.');
      }
      const f = await readAttached(a.institutionId, input.fileId, uid, 'submission', x!.id);
      if (!f) forbid('You do not have access to this file.');
      return f!;
    }
    if (input.action === 'submit') {
      const x = await zite.submissions.findOne({ id: input.submissionId });
      if (!x || !ids(x.student).includes(uid) || x.state !== 'Private Draft') forbid();
      await zite.submissions.update({ id: x!.id, record: { state: 'Submitted' } as never });
      await ensureFil();
      await pg().query(`SELECT fil_lock($1,'submission',$2)`, [a.institutionId, x!.id]);
      const tid = first(x!.task);
      if (tid) await zite.tasks.update({ id: tid, record: { status: 'Done' } as never });
      await audit(a, 'Work submitted', `submission:${x!.id}`, '', 'Student');
      return { ok: true };
    }
    if (input.action === 'grade') {
      const x = await zite.submissions.findOne({ id: input.submissionId });
      const t = x ? await zite.tasks.findOne({ id: first(x.task) ?? '' }) : undefined;
      if (!x || !t) forbid();
      const { teaching } = await loadSection(first(t!.section) ?? '');
      if (!teaching || x!.state === 'Private Draft') forbid('Only the instructor can grade submitted work.');
      if (first(x!.student) === uid) forbid('You cannot grade your own submission.');
      await zite.submissions.update({ id: x!.id, record: { score: input.score, feedback: input.feedback, state: 'Graded' } as never });
      await audit(a, 'Submission graded', `submission:${x!.id}`, `Score ${input.score}`, 'Instructor of record');
      return { ok: true };
    }
    if (input.action === 'setPolicy') {
      const { teaching } = await loadSection(input.sectionId);
      if (!teaching) forbid();
      await zite.sections.update({ id: input.sectionId, record: { courseAiPolicy: input.policy } as never });
      await audit(a, 'Course AI policy changed', `section:${input.sectionId}`, input.policy, 'Instructor of record');
      return { ok: true };
    }
    // release
    const { teaching } = await loadSection(input.sectionId);
    if (!teaching) forbid();
    const { records: tasks } = await zite.tasks.findAll({ filters: { section: input.sectionId }, limit: 1000 });
    const tIds = new Set(tasks.map((t) => t.id));
    const graded = (await zite.submissions.findAll({ filters: { state: 'Graded' }, limit: 2000 })).records.filter((x) => tIds.has(first(x.task) ?? ''));
    for (const g of graded) await zite.submissions.update({ id: g.id, record: { state: 'Released' } as never });
    await audit(a, 'Grades released', `section:${input.sectionId}`, `${graded.length} submissions`, 'Instructor of record');
    return { ok: true, released: graded.length };
  },
});
