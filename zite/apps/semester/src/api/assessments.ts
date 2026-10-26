import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { ASM_MIGRATION } from '../lib/asmMigration';
import { courseRole } from '../lib/teamServer';
import { validateQuestions, totalPoints, studentView, scoreAttempt, cleanAnswers, Question, Answers } from '../lib/assessRules';

let ready: Promise<void> | null = null;
const ensureAsm = () => { if (!ready) ready = (async () => { for (const q of ASM_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
type Row = Record<string, unknown>;
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const QSchema = z.object({ id: z.string().min(1).max(40), type: z.enum(['single', 'multi', 'short']), prompt: z.string().max(4000), options: z.array(z.string().max(500)).max(10), answer: z.array(z.number().int()).max(10), points: z.number() });
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Course Studio assessments (Faculty app "assessments"). Instructors of the section author, publish, grade and release;
// enrolled students take them. Answer keys never leave the server for students; scores show only after release.
export default createEndpoint({
  description: 'Course assessments: author and publish frozen question versions, take attempts within a window, auto-score choice questions, grade short answers, release',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list'), sectionId: z.string() }),
    z.object({ action: z.literal('create'), sectionId: z.string(), title: z.string().max(200), opensAt: z.string(), closesAt: z.string(), timeLimitMin: z.number().int().nullable(), attemptsAllowed: z.number().int() }),
    z.object({ action: z.literal('publish'), sectionId: z.string(), id: z.number().int(), questions: z.array(QSchema).max(100), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('start'), sectionId: z.string(), id: z.number().int() }),
    z.object({ action: z.literal('submit'), sectionId: z.string(), attemptId: z.number().int(), answers: z.record(z.union([z.array(z.number().int()), z.string().max(10000)])) }),
    z.object({ action: z.literal('grade'), sectionId: z.string(), attemptId: z.number().int(), manual: z.number(), feedback: z.string().max(4000) }),
    z.object({ action: z.literal('release'), sectionId: z.string(), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensureAsm();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const tenant = await tenantScope(T);
    if (!tenant.sections.has(input.sectionId)) forbid('That section is not in your institution.');
    const section = await zite.sections.findOne({ id: input.sectionId });
    const teaching = ids(section?.instructors).includes(me);
    // Grading delegates may view attempts and grade; only instructors author, publish and release.
    const delegate = !teaching && (await courseRole(T, input.sectionId, me)) === 'delegate';
    const grader = teaching || delegate;
    const enrolled = !grader && (await zite.enrollments.findAll({ filters: { student: me, section: input.sectionId }, limit: 5 })).records.some((e) => e.status !== 'Dropped');
    if (!grader && !enrolled) forbid('You are not enrolled in or teaching this section.');
    const teacherOnly = () => { if (!teaching) forbid('Only the instructor of this section can do that.'); };
    const own = async (id: number) => {
      const r = ((await sql.query(`SELECT * FROM asm_assessments WHERE id = $1 AND tenant_id = $2 AND section_id = $3`, [id, T, input.sectionId])) as Row[])[0];
      if (!r) forbid('Assessment not found in this section.');
      return r!;
    };
    const frozen = async (id: number, version: number) => (((await sql.query(`SELECT questions FROM asm_versions WHERE assessment_id = $1 AND version = $2`, [id, version])) as Row[])[0]?.questions ?? []) as Question[];

    if (input.action === 'create') {
      teacherOnly();
      const o = new Date(input.opensAt), c = new Date(input.closesAt);
      if (isNaN(+o) || isNaN(+c) || c <= o) forbid('The assessment must close after it opens.');
      if (input.attemptsAllowed < 1 || input.attemptsAllowed > 10) forbid('Allow 1 to 10 attempts.');
      if (input.timeLimitMin != null && (input.timeLimitMin < 1 || input.timeLimitMin > 600)) forbid('Time limits are 1 to 600 minutes.');
      if (input.title.trim().length < 3) forbid('Give the assessment a title.');
      await sql.query(`INSERT INTO asm_assessments (tenant_id, section_id, title, opens_at, closes_at, time_limit_min, attempts_allowed, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [T, input.sectionId, input.title.trim(), o.toISOString(), c.toISOString(), input.timeLimitMin, input.attemptsAllowed, me]);
      await audit(a, 'Assessment created', `section:${input.sectionId}`, input.title, 'Instructor of record');
    }
    if (input.action === 'publish') {
      teacherOnly(); await own(input.id);
      const qs = input.questions as Question[];
      fail(validateQuestions(qs));
      fail(((await sql.query(`SELECT asm_publish($1,$2,$3,$4::jsonb,$5,$6) AS e`, [T, input.id, me, JSON.stringify(qs), totalPoints(qs), input.expectedVersion])) as { e: string | null }[])[0].e);
      await audit(a, 'Assessment published', `assessment:${input.id}`, `${qs.length} questions, ${totalPoints(qs)} points`, 'Instructor of record');
    }
    if (input.action === 'start') {
      if (grader) forbid('Instructors and grading delegates do not take assessments in their own section.');
      await own(input.id);
      const r = ((await sql.query(`SELECT asm_start($1,$2,$3) AS r`, [T, input.id, me])) as { r: Row }[])[0].r;
      if (r.error) forbid(String(r.error));
      return { attemptId: Number(r.attemptId), limitMin: r.limitMin == null ? null : Number(r.limitMin), extraMin: Number(r.extraMin ?? 0), questions: studentView(await frozen(input.id, Number(r.version))) };
    }
    if (input.action === 'submit') {
      const t = ((await sql.query(`SELECT * FROM asm_attempts WHERE id = $1 AND tenant_id = $2 AND student_id = $3`, [input.attemptId, T, me])) as Row[])[0];
      if (!t) forbid('Attempt not found.');
      await own(Number(t!.assessment_id));
      const qs = await frozen(Number(t!.assessment_id), Number(t!.version));
      const answers = cleanAnswers(qs, input.answers as Answers);
      const sc = scoreAttempt(qs, answers);
      fail(((await sql.query(`SELECT asm_submit($1,$2,$3,$4::jsonb,$5,$6) AS e`, [T, input.attemptId, me, JSON.stringify(answers), sc.auto, sc.needsManual])) as { e: string | null }[])[0].e);
      await audit(a, 'Assessment submitted', `assessmentAttempt:${input.attemptId}`, '', 'Student');
      return { ok: true };
    }
    if (input.action === 'grade') {
      if (!grader) forbid('Only the instructor or a grading delegate can grade.');
      const t = ((await sql.query(`SELECT assessment_id FROM asm_attempts WHERE id = $1 AND tenant_id = $2`, [input.attemptId, T])) as Row[])[0];
      if (!t) forbid('Attempt not found.');
      await own(Number(t!.assessment_id));
      fail(((await sql.query(`SELECT asm_grade($1,$2,$3,$4,$5) AS e`, [T, input.attemptId, me, input.manual, input.feedback])) as { e: string | null }[])[0].e);
      await audit(a, 'Assessment attempt graded', `assessmentAttempt:${input.attemptId}`, `manual ${input.manual}`, teaching ? 'Instructor of record' : 'Grading delegate');
    }
    if (input.action === 'release') {
      teacherOnly(); await own(input.id);
      const n = Number(((await sql.query(`SELECT asm_release($1,$2) AS n`, [T, input.id])) as { n: number }[])[0].n);
      await audit(a, 'Assessment scores released', `assessment:${input.id}`, `${n} attempts`, 'Instructor of record');
      const st = ((await sql.query(`SELECT DISTINCT student_id FROM asm_attempts WHERE assessment_id = $1 AND state = 'released' AND released_at > now() - interval '1 minute'`, [input.id])) as Row[]).map((r) => String(r.student_id));
      if (st.length) await zite.messages.create({ record: { body: 'An assessment score was released. Open the course to see it.', sender: me, recipients: st, isNotification: true } as never }).catch(() => undefined);
    }

    // List for this section.
    const list = (await sql.query(`SELECT a.*, (SELECT max(version) FROM asm_versions v WHERE v.assessment_id = a.id) AS version,
        (SELECT total_points FROM asm_versions v WHERE v.assessment_id = a.id ORDER BY version DESC LIMIT 1) AS total
      FROM asm_assessments a WHERE a.tenant_id = $1 AND a.section_id = $2 ORDER BY a.opens_at DESC`, [T, input.sectionId])) as Row[];
    const visible = teaching ? list : list.filter((x) => x.state !== 'draft');
    const seesAll = grader;
    const attempts = (await sql.query(`SELECT * FROM asm_attempts WHERE tenant_id = $1 AND assessment_id = ANY($2)${seesAll ? '' : ' AND student_id = $3'} ORDER BY id`,
      seesAll ? [T, visible.map((x) => Number(x.id))] : [T, visible.map((x) => Number(x.id)), me])) as Row[];
    const names = seesAll ? await userNames(attempts.map((t) => String(t.student_id))) : {};
    const out = await Promise.all(visible.map(async (x) => {
      const mine = attempts.filter((t) => Number(t.assessment_id) === Number(x.id));
      const base = { id: Number(x.id), title: String(x.title), state: String(x.state), opensAt: iso(x.opens_at), closesAt: iso(x.closes_at), timeLimitMin: x.time_limit_min == null ? null : Number(x.time_limit_min), attemptsAllowed: Number(x.attempts_allowed), version: x.version == null ? 0 : Number(x.version), total: x.total == null ? null : Number(x.total) };
      if (seesAll) {
        return { ...base, questions: !teaching ? [] : base.version ? await frozen(base.id, base.version) : [],
          attempts: mine.map((t) => ({ id: Number(t.id), student: names[String(t.student_id)] ?? 'Student', state: String(t.state), late: !!t.late, extended: Number(t.extra_min ?? 0) > 0, auto: t.auto_score == null ? null : Number(t.auto_score), manual: t.manual_score == null ? null : Number(t.manual_score), feedback: String(t.feedback), submittedAt: iso(t.submitted_at), answers: t.answers })) };
      }
      return { ...base, attempts: mine.map((t) => {
        const rel = t.state === 'released';
        return { id: Number(t.id), state: rel ? 'released' : t.state === 'in_progress' ? 'in_progress' : 'submitted', late: !!t.late, submittedAt: iso(t.submitted_at),
          score: rel ? Number(t.auto_score ?? 0) + Number(t.manual_score ?? 0) : null, feedback: rel ? String(t.feedback) : '' };
      }) };
    }));
    return { teaching, grader, assessments: out };
  },
});
