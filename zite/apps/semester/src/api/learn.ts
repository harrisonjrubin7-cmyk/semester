import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { CRS_MIGRATION } from '../lib/crsMigration';
import { ensureFil, attachmentsFor, readAttached } from '../lib/filServer';
import { courseRole, ensureTeam, delegatedSections } from '../lib/teamServer';
import { rubricScore, Criterion } from '../lib/rubricRules';
import { SBM_MIGRATION } from '../lib/sbmMigration';
import { ACC_MIGRATION } from '../lib/accMigration';

let sbmReady: Promise<void> | null = null;
let accReady: Promise<void> | null = null;
const ensureAcc = () => { if (!accReady) accReady = (async () => { for (const q of ACC_MIGRATION) await pg().query(q); })().catch((e) => { accReady = null; throw e; }); return accReady; };
const ensureSbm = () => { if (!sbmReady) sbmReady = (async () => { for (const q of SBM_MIGRATION) await pg().query(q); })().catch((e) => { sbmReady = null; throw e; }); return sbmReady; };

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
    z.object({ action: z.literal('submit'), submissionId: z.string(), requestKey: z.string().min(8).max(80).optional() }),
    z.object({ action: z.literal('grade'), submissionId: z.string(), score: z.number().min(0), feedback: z.string().max(4000), rubric: z.object({ key: z.string().max(60), version: z.number().int(), selections: z.record(z.number().int()) }).optional() }),
    z.object({ action: z.literal('release'), sectionId: z.string() }),
    z.object({ action: z.literal('setPolicy'), sectionId: z.string(), policy: z.enum(['Allowed', 'Outlining Only', 'Not Allowed']) }),
    z.object({ action: z.literal('teach'), sectionId: z.string() }),
    z.object({ action: z.literal('publishSyllabus'), sectionId: z.string(), body: z.string().min(20).max(40000), note: z.string().max(300), expectedVersion: z.number().int().min(0) }),
    z.object({ action: z.literal('addMaterial'), sectionId: z.string(), title: z.string().min(2).max(160), url: z.string().url().max(800).refine((u) => u.startsWith('https://'), 'Use an https link'), note: z.string().max(500) }),
    z.object({ action: z.literal('hideMaterial'), sectionId: z.string(), id: z.string() }),
    z.object({ action: z.literal('extensions'), sectionId: z.string() }),
    z.object({ action: z.literal('grantExtension'), sectionId: z.string(), taskId: z.string(), studentId: z.string(), newDue: z.string().datetime(), kind: z.enum(['instructor', 'accommodation']), accRequestId: z.string().max(80).optional(), note: z.string().max(500) }),
    z.object({ action: z.literal('revokeExtension'), sectionId: z.string(), id: z.number().int() }),
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
      // Grading delegates (team-001) see and grade submitted work but cannot change the course or release grades.
      const grader = teaching || (await courseRole(a.institutionId, id, uid)) === 'delegate';
      const enrolled = !grader && !!(await zite.enrollments.findOne({ filters: { student: uid, section: id } }));
      if (!grader && !enrolled) forbid('You are not enrolled in or teaching this section.');
      return { s: s!, teaching, grader };
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
        grading: await (async () => { const d = new Set(await delegatedSections(a.institutionId, uid)); return secs.records.filter((s) => d.has(s.id) && !ids(s.instructors).includes(uid)).map((s) => row(s, 'Grading delegate')); })(),
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
      const { s, teaching, grader } = await loadSection(input.sectionId);
      await ensureCrs();
      const history = (await pg().query(`SELECT version, change_note, author_id, published_at FROM crs_syllabus_versions WHERE section_id = $1 ORDER BY version DESC LIMIT 20`, [s.id])) as Record<string, unknown>[];
      const course = await zite.courses.findOne({ id: first(s.course) ?? '' });
      const { records: tasks } = await zite.tasks.findAll({ filters: { section: s.id, type: 'Assignment' }, limit: 500 });
      const visibleTasks = grader ? tasks : tasks.filter((t) => ids(t.owner).includes(uid));
      // Dedupe assignments by title for the faculty view (sample assignments are per-student)
      const assignments = [...new Map(visibleTasks.map((t) => [grader ? t.title : t.id, t])).values()];
      const subs = (await zite.submissions.findAll({ limit: 2000 })).records.filter((x) => tasks.some((t) => t.id === first(x.task)));
      const visibleSubs = subs.filter((x) => grader ? x.state !== 'Private Draft' : ids(x.student).includes(uid));
      const attached = await attachmentsFor(a.institutionId, 'submission', visibleSubs.map((x) => x.id));
      await ensureSbm();
      const receipts = visibleSubs.length ? ((await pg().query(`SELECT submission_id, receipt_code, submitted_at, due_at, due_source, late, late_seconds, files FROM sbm_receipts WHERE tenant_id = $1 AND submission_id = ANY($2)`, [a.institutionId, visibleSubs.map((x) => x.id)])) as Record<string, unknown>[]) : [];
      const receiptOf = (id: string) => { const r = receipts.find((x) => x.submission_id === id); return r ? { code: String(r.receipt_code), submittedAt: new Date(String(r.submitted_at)).toISOString(), dueAt: r.due_at ? new Date(String(r.due_at)).toISOString() : null, dueSource: String(r.due_source ?? 'assignment'), late: !!r.late, lateMinutes: Math.ceil(Number(r.late_seconds) / 60), files: (r.files as { name: string; size: number; sha256: string }[]).map((f) => ({ name: f.name, size: f.size, sha256: f.sha256 })) } : null; };
      const names = grader ? await userNames(visibleSubs.map((x) => first(x.student) ?? '')) : {};
      const myExt = grader ? [] : (await pg().query(`SELECT task_id, new_due, kind FROM dln_extensions WHERE tenant_id = $1 AND section_id = $2 AND student_id = $3 AND revoked_at IS NULL`, [a.institutionId, s.id, uid])) as Record<string, unknown>[];
      const resources = (await zite.resources.findAll({ filters: { section: s.id }, limit: 300 })).records
        .filter((r) => r.visibility === 'Course' || ids(r.owner).includes(uid));
      return {
        section: { id: s.id, label: s.label ?? '', code: course?.code ?? '', title: course?.title ?? '', term: s.term ?? '', times: s.meetingTimes ?? '', syllabus: s.syllabus ?? '', policy: s.courseAiPolicy ?? 'Allowed' },
        teaching,
        grader,
        assignments: assignments.map((t) => ({ id: t.id, title: t.title ?? '', dueAt: t.dueAt ?? null, extendedTo: (() => { const e = myExt.find((x) => x.task_id === t.id); return e ? { dueAt: new Date(String(e.new_due)).toISOString(), kind: String(e.kind) } : null; })(), points: t.points ?? null, rubric: t.rubric ?? '', source: t.source ?? 'Official' })),
        submissions: visibleSubs.map((x) => {
          const t = tasks.find((tt) => tt.id === first(x.task));
          return { id: x.id, receipt: receiptOf(x.id), taskId: first(x.task) ?? '', taskTitle: t?.title ?? '', student: names[first(x.student) ?? ''] ?? 'You', state: x.state ?? 'Private Draft', score: x.score ?? null, feedback: (grader || x.state === 'Released') ? x.feedback ?? '' : '', files: (x.files ?? []).map((f) => ({ name: f.originalName || f.filename, url: f.url })), attachments: (attached[x.id] ?? []).map((f) => ({ fileId: f.fileId, name: f.name, size: f.size })) };
        }).map((x) => grader ? x : { ...x, score: x.state === 'Released' ? x.score : null }),
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
        if (!s2 || !(await courseRole(a.institutionId, s2.id, uid)) || x!.state === 'Private Draft') forbid('You do not have access to this file.');
      }
      const f = await readAttached(a.institutionId, input.fileId, uid, 'submission', x!.id);
      if (!f) forbid('You do not have access to this file.');
      return f!;
    }
    if (input.action === 'extensions' || input.action === 'grantExtension' || input.action === 'revokeExtension') {
      // Deadline extensions (spec §7 Workflow B): only the instructor of record, never a delegate, and never from client-sent roles.
      const { s, teaching } = await loadSection(input.sectionId);
      const isInstructor = teaching && isFaculty;
      if (!isInstructor) forbid('Only the instructor of record manages extensions.');
      await ensureFil(); await ensureSbm(); await ensureAcc();
      const T = a.institutionId;
      if (input.action === 'grantExtension') {
        const task = await zite.tasks.findOne({ id: input.taskId });
        if (!task || first(task.section) !== s.id || task.type !== 'Assignment') forbid('That assignment is not in this section.');
        if (!ids(task!.owner).includes(input.studentId)) forbid('That assignment does not belong to this student.');
        if (!task!.dueAt) forbid('This assignment has no due date to extend.');
        const enrolled = !!(await zite.enrollments.findOne({ filters: { student: input.studentId, section: s.id } }));
        const letters = input.accRequestId ? (await pg().query(`SELECT 1 FROM acc_instructor_letters($1, $2) WHERE request_id = $3 AND student_id = $4`, [T, [s.id], input.accRequestId, input.studentId])) as unknown[] : [];
        const r = String(((await pg().query(`SELECT dln_grant($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10,$11,$12,$13) AS r`,
          [uid, T, task!.id, s.id, input.studentId, true, enrolled, input.newDue, task!.dueAt, input.kind, input.accRequestId ?? null, letters.length > 0, input.note])) as { r: string | null }[])[0].r ?? '');
        if (!r.startsWith('ok:')) forbid(r);
        await audit(a, 'Extension granted', `task:${task!.id}`, `${input.kind} to ${input.newDue}`, 'Faculty');
        return { ok: true, id: Number(r.slice(3)) };
      }
      if (input.action === 'revokeExtension') {
        const own = (await pg().query(`SELECT task_id FROM dln_extensions WHERE tenant_id = $1 AND id = $2 AND section_id = $3`, [T, input.id, s.id])) as unknown[];
        if (!own.length) forbid('Extension not found in this section.');
        const r = String(((await pg().query(`SELECT dln_revoke($1,$2,$3,$4) AS r`, [uid, T, input.id, true])) as { r: string | null }[])[0].r ?? '');
        if (!r.startsWith('ok')) forbid(r);
        await audit(a, 'Extension revoked', `extension:${input.id}`, '', 'Faculty');
        return { ok: true };
      }
      const { records: tasks } = await zite.tasks.findAll({ filters: { section: s.id, type: 'Assignment' }, limit: 500 });
      const studentIds = [...new Set(tasks.flatMap((t) => ids(t.owner)))];
      const names = await userNames(studentIds);
      const ext = (await pg().query(`SELECT id, task_id, student_id, new_due, original_due, kind, acc_request_id, note, granted_at FROM dln_extensions WHERE tenant_id = $1 AND section_id = $2 AND revoked_at IS NULL`, [T, s.id])) as Record<string, unknown>[];
      const subd = (await pg().query(`SELECT task_id, student_id FROM sbm_receipts WHERE tenant_id = $1 AND section_id = $2`, [T, s.id])) as Record<string, unknown>[];
      const letters = (await pg().query(`SELECT request_id, student_id, arrangements, valid_until FROM acc_instructor_letters($1, $2)`, [T, [s.id]])) as Record<string, unknown>[];
      const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
      return {
        rows: tasks.flatMap((t) => ids(t.owner).map((sid) => {
          const e = ext.find((x) => x.task_id === t.id && x.student_id === sid);
          return { taskId: t.id, title: t.title ?? '', studentId: sid, student: names[sid] ?? 'Student', dueAt: t.dueAt ?? null, submitted: subd.some((x) => x.task_id === t.id && x.student_id === sid),
            extension: e ? { id: Number(e.id), newDue: iso(e.new_due), kind: String(e.kind), note: String(e.note ?? ''), grantedAt: iso(e.granted_at) } : null };
        })),
        letters: letters.map((l) => ({ requestId: String(l.request_id), studentId: String(l.student_id), student: names[String(l.student_id)] ?? 'Student', arrangements: (l.arrangements as string[]) ?? [], validUntil: l.valid_until ? String(l.valid_until).slice(0, 10) : null })),
      };
    }
    if (input.action === 'submit') {
      // Spec §4.2/§7 Workflow B: the receipt is the submission. sbm_submit builds the file manifest (name, size, SHA-256)
      // from the database, locks the files and stamps on-time/late in one transaction; a retry replays the same receipt.
      const x = await zite.submissions.findOne({ id: input.submissionId });
      if (!x || !ids(x.student).includes(uid)) forbid('You can only submit your own work.');
      const task = await zite.tasks.findOne({ id: first(x!.task) ?? '' });
      await ensureFil(); await ensureSbm();
      const r = String(((await pg().query(`SELECT sbm_submit($1,$2,$3,$4,$5,$6,$7::timestamptz,$8) AS r`,
        [uid, a.institutionId, x!.id, task?.id ?? '', first(task?.section) ?? '', true, task?.dueAt ?? null, input.requestKey ?? `sub:${x!.id}`])) as { r: string | null }[])[0].r ?? '');
      if (!r.startsWith('ok:')) forbid(r);
      const [, code, replay] = r.split(':');
      // Project into Zite (idempotent; a replay repairs a projection that failed after the receipt was issued).
      if (x!.state === 'Private Draft') await zite.submissions.update({ id: x!.id, record: { state: 'Submitted' } as never });
      if (task && task.status !== 'Done') await zite.tasks.update({ id: task.id, record: { status: 'Done' } as never });
      if (!replay) await audit(a, 'Work submitted', `submission:${x!.id}`, `receipt ${code}`, 'Student');
      const rc = ((await pg().query(`SELECT receipt_code, submitted_at, due_at, due_source, late, late_seconds, files FROM sbm_receipts WHERE tenant_id = $1 AND submission_id = $2`, [a.institutionId, x!.id])) as Record<string, unknown>[])[0];
      return { ok: true, replay: !!replay, receipt: { code: String(rc.receipt_code), submittedAt: new Date(String(rc.submitted_at)).toISOString(), dueAt: rc.due_at ? new Date(String(rc.due_at)).toISOString() : null, dueSource: String(rc.due_source ?? 'assignment'), late: !!rc.late, lateMinutes: Math.ceil(Number(rc.late_seconds) / 60), files: rc.files } };
    }
    if (input.action === 'grade') {
      const x = await zite.submissions.findOne({ id: input.submissionId });
      const t = x ? await zite.tasks.findOne({ id: first(x.task) ?? '' }) : undefined;
      if (!x || !t) forbid();
      const sectionId = first(t!.section) ?? '';
      const { teaching, grader } = await loadSection(sectionId);
      if (!grader || x!.state === 'Private Draft') forbid('Only the section instructor or a grading delegate can grade submitted work.');
      if (x!.state === 'Released') forbid('This grade is already released. Changes go through a regrade request.');
      if (first(x!.student) === uid) forbid('You cannot grade your own submission.');
      let score = input.score;
      if (input.rubric) {
        // The score comes from the frozen rubric version, not from the client.
        await ensureTeam();
        const rv = ((await pg().query(`SELECT criteria FROM rbr_versions WHERE tenant_id = $1 AND section_id = $2 AND rubric_key = $3 AND version = $4`, [a.institutionId, sectionId, input.rubric.key, input.rubric.version])) as { criteria: Criterion[] }[])[0];
        if (!rv) forbid('That rubric version does not exist for this section.');
        const sc = rubricScore(rv!.criteria, input.rubric.selections);
        if (sc == null) forbid('Choose one level for every criterion.');
        score = sc!;
        await pg().query(`INSERT INTO rbr_scores (tenant_id, submission_id, section_id, rubric_key, version, selections, score, grader_id) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
          [a.institutionId, x!.id, sectionId, input.rubric.key, input.rubric.version, JSON.stringify(input.rubric.selections), score, uid]);
      }
      await zite.submissions.update({ id: x!.id, record: { score, feedback: input.feedback, state: 'Graded' } as never });
      await audit(a, 'Submission graded', `submission:${x!.id}`, `Score ${score}${input.rubric ? ` (rubric ${input.rubric.key} v${input.rubric.version})` : ''}`, teaching ? 'Instructor of record' : 'Grading delegate');
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
