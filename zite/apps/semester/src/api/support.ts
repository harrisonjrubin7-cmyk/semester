import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids } from '../lib/server';
import { pg } from '../lib/pg';
import { TUT_MIGRATION } from '../lib/tutMigration';
import { SUP_MIGRATION } from '../lib/supMigration';
import { courseRole, delegatedSections } from '../lib/teamServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...TUT_MIGRATION, ...SUP_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Peer mentoring, teaching-assistant escalation to instructors, and tutoring quality review.
export default createEndpoint({
  description: 'Peer mentoring (matches, check-ins, goals, supervisor escalation), TA questions to instructors, tutoring ratings and quality review',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('supervisor'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('join'), role: z.enum(['mentor', 'mentee']), interests: z.string().max(500).default(''), on: z.boolean() }),
    z.object({ action: z.literal('approve'), userId: z.string() }),
    z.object({ action: z.literal('match'), mentorId: z.string(), menteeId: z.string() }),
    z.object({ action: z.literal('checkin'), matchId: z.number().int(), mood: z.enum(['good', 'okay', 'struggling']), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('goal'), matchId: z.number().int(), goalId: z.number().int().nullable().default(null), title: z.string().max(200).nullable().default(null), state: z.enum(['open', 'met', 'dropped']).nullable().default(null), progress: z.string().max(1000).nullable().default(null) }),
    z.object({ action: z.literal('end'), matchId: z.number().int() }),
    z.object({ action: z.literal('escalate'), matchId: z.number().int(), category: z.enum(['wellbeing', 'academic', 'conduct', 'boundary', 'other']), note: z.string().min(10).max(1000) }),
    z.object({ action: z.literal('resolve'), id: z.number().int(), text: z.string().max(1000) }),
    z.object({ action: z.literal('ask'), sectionId: z.string(), topic: z.enum(['grading', 'integrity_concern', 'student_request', 'content', 'other']), question: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('answer'), id: z.number().int(), answer: z.string().max(2000) }),
    z.object({ action: z.literal('rate'), requestId: z.string(), score: z.number().int().min(1).max(5), comment: z.string().max(1000).default('') }),
    z.object({ action: z.literal('review'), tutorId: z.string(), note: z.string().min(10).max(2000), outcome: z.enum(['no_action', 'coaching', 'observe', 'pause']) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out && !out.startsWith('ok:')) forbid(out); return out; };
    const sup = !!((await sql.query(`SELECT pmn_is_sup($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    const center = !!((await sql.query(`SELECT tut_is_staff($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    const tell = (to: string[], body: string) => { const r = to.filter((x) => x && x !== me); return r.length ? zite.messages.create({ record: { body, sender: me, recipients: r, isNotification: true } as never }).catch(() => undefined) : undefined; };
    const supervisors = async () => ((await sql.query(`SELECT user_id FROM pmn_supervisors WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((r) => String(r.user_id));
    let result: unknown = null;

    switch (input.action) {
      case 'supervisor': {
        if (!isAdmin) forbid('Only administrators appoint mentoring supervisors.');
        const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
        const uid = rows[0] ? String((rows[0] as Row).id) : '';
        if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
        fail(await one(`SELECT pmn_set_sup($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
        await audit(a, `Mentoring supervisor ${input.on ? 'appointed' : 'removed'}`, `user:${uid}`, '', 'Administrator');
        break;
      }
      case 'join': fail(await one(`SELECT pmn_join($1,$2,$3,$4,$5) AS r`, [me, T, input.role, input.interests, input.on])); break;
      case 'approve': fail(await one(`SELECT pmn_approve($1,$2,$3) AS r`, [me, T, input.userId])); await tell([input.userId], 'You are approved as a peer mentor. Open Peer support in Semester.'); break;
      case 'match': result = fail(await one(`SELECT pmn_match($1,$2,$3,$4) AS r`, [me, T, input.mentorId, input.menteeId])); await tell([input.mentorId, input.menteeId], 'You have a new peer-mentoring match. Open Peer support in Semester.'); break;
      case 'checkin': fail(await one(`SELECT pmn_checkin($1,$2,$3,$4,$5) AS r`, [me, T, input.matchId, input.mood, input.note])); break;
      case 'goal': fail(await one(`SELECT pmn_goal($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.matchId, input.goalId, input.title, input.state, input.progress])); break;
      case 'end': fail(await one(`SELECT pmn_end($1,$2,$3) AS r`, [me, T, input.matchId])); break;
      case 'escalate': {
        result = fail(await one(`SELECT pmn_escalate($1,$2,$3,$4,$5) AS r`, [me, T, input.matchId, input.category, input.note]));
        await audit(a, 'Peer mentoring escalation raised', `match:${input.matchId}`, input.category, 'Peer mentor');
        await tell(await supervisors(), 'A peer mentor raised an escalation. Open Peer support in Semester.');
        break;
      }
      case 'resolve': fail(await one(`SELECT pmn_resolve($1,$2,$3,$4) AS r`, [me, T, input.id, input.text])); break;
      case 'ask': {
        if (!(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
        const isDelegate = (await courseRole(T, input.sectionId, me)) === 'delegate';
        result = fail(await one(`SELECT tae_ask($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.sectionId, isDelegate, input.topic, input.question]));
        const s = await zite.sections.findOne({ id: input.sectionId });
        await tell(ids(s?.instructors), 'Your teaching assistant asked a question. Open Peer support in Semester.');
        break;
      }
      case 'answer': {
        const q = ((await sql.query(`SELECT section_id, ta_id FROM tae_questions WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
        if (!q) forbid('Question not found.');
        const isInstructor = (await courseRole(T, String(q.section_id), me)) === 'instructor';
        fail(await one(`SELECT tae_answer($1,$2,$3,$4,$5) AS r`, [me, T, input.id, isInstructor, input.answer]));
        await tell([String(q.ta_id)], 'An instructor answered your question. Open Peer support in Semester.');
        break;
      }
      case 'rate': fail(await one(`SELECT tqr_rate($1,$2,$3,$4,$5) AS r`, [me, T, input.requestId, input.score, input.comment])); break;
      case 'review': fail(await one(`SELECT tqr_review($1,$2,$3,$4,$5) AS r`, [me, T, input.tutorId, input.note, input.outcome])); await audit(a, 'Tutor quality review', `tutor:${input.tutorId}`, input.outcome, 'Learning center staff'); break;
      case 'get': break;
    }

    // Peer mentoring.
    const myRoles = (await sql.query(`SELECT role, state, interests FROM pmn_people WHERE tenant_id = $1 AND user_id = $2`, [T, me])) as Row[];
    const matches = (await sql.query(`SELECT * FROM pmn_matches WHERE tenant_id = $1 AND ($3 OR mentor_id = $2 OR mentee_id = $2) ORDER BY state, id DESC LIMIT 200`, [T, me, sup])) as Row[];
    const mids = matches.map((x) => Number(x.id));
    const goals = mids.length ? (await sql.query(`SELECT * FROM pmn_goals WHERE match_id = ANY($1) ORDER BY id`, [mids])) as Row[] : [];
    const checkins = mids.length ? (await sql.query(`SELECT * FROM pmn_checkins WHERE match_id = ANY($1) ORDER BY at DESC`, [mids])) as Row[] : [];
    const escalations = mids.length ? (await sql.query(`SELECT * FROM pmn_escalations WHERE match_id = ANY($1) ORDER BY state, id DESC`, [mids])) as Row[] : [];
    const people = sup ? (await sql.query(`SELECT * FROM pmn_people WHERE tenant_id = $1 AND state <> 'withdrawn'`, [T])) as Row[] : [];
    // TA questions: mine as TA, and those for sections I teach.
    const delegated = await delegatedSections(T, me);
    const scope = await tenantScope(T);
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => scope.sections.has(s.id));
    const label = (id: unknown) => secs.find((s) => s.id === String(id))?.label ?? 'Section';
    const teaching = secs.filter((s) => ids(s.instructors).includes(me)).map((s) => s.id);
    const questions = (await sql.query(`SELECT * FROM tae_questions WHERE tenant_id = $1 AND (ta_id = $2 OR section_id = ANY($3)) ORDER BY state, id DESC LIMIT 200`, [T, me, teaching])) as Row[];
    // Tutoring quality.
    const toRate = (await sql.query(`SELECT r.id, r.subject, r.tutor_id, r.session_at, t.score FROM tut_requests r LEFT JOIN tqr_ratings t ON t.request_id = r.id
      WHERE r.tenant_id = $1 AND r.student_id = $2 AND r.state = 'completed' ORDER BY r.session_at DESC NULLS LAST LIMIT 50`, [T, me])) as Row[];
    const summary = center ? (await sql.query(`SELECT * FROM tqr_summary($1)`, [T])) as Row[] : [];
    const reviews = center ? (await sql.query(`SELECT * FROM tqr_reviews WHERE tenant_id = $1 ORDER BY at DESC LIMIT 100`, [T])) as Row[] : [];
    const supList = isAdmin ? await supervisors() : [];
    const nm = await userNames([...new Set([...matches.flatMap((x) => [x.mentor_id, x.mentee_id]), ...people.map((p) => p.user_id), ...questions.flatMap((q) => [q.ta_id, q.answered_by]),
      ...toRate.map((r) => r.tutor_id), ...summary.map((s) => s.tutor_id), ...reviews.flatMap((r) => [r.tutor_id, r.reviewer_id]), ...supList].filter(Boolean).map(String))]);
    const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
    return {
      result, me, sup, center, isAdmin,
      myRoles: myRoles.map((r) => ({ role: String(r.role), state: String(r.state), interests: String(r.interests) })),
      matches: matches.map((x) => { const id = String(x.id);
        return { id: Number(x.id), mentor: n(x.mentor_id), mentee: n(x.mentee_id), iMentor: x.mentor_id === me, iMentee: x.mentee_id === me, state: String(x.state), at: iso(x.created_at),
          goals: goals.filter((g) => String(g.match_id) === id).map((g) => ({ id: Number(g.id), title: String(g.title), state: String(g.state), progress: String(g.progress) })),
          checkins: x.mentor_id === me || sup ? checkins.filter((c) => String(c.match_id) === id).slice(0, 10).map((c) => ({ mood: String(c.mood), note: String(c.note), at: iso(c.at) })) : [],
          escalations: x.mentor_id === me || sup ? escalations.filter((e) => String(e.match_id) === id).map((e) => ({ id: Number(e.id), category: String(e.category), note: String(e.note), state: String(e.state), resolution: String(e.resolution), mine: e.raised_by === me })) : [] }; }),
      pendingMentors: people.filter((p) => p.role === 'mentor' && p.state === 'pending').map((p) => ({ id: String(p.user_id), name: n(p.user_id), interests: String(p.interests) })),
      mentors: people.filter((p) => p.role === 'mentor' && p.state === 'approved').map((p) => ({ id: String(p.user_id), name: n(p.user_id), interests: String(p.interests) })),
      mentees: people.filter((p) => p.role === 'mentee' && p.state === 'opted_in' && !matches.some((x) => x.mentee_id === p.user_id && x.state === 'active')).map((p) => ({ id: String(p.user_id), name: n(p.user_id), interests: String(p.interests) })),
      delegated: delegated.map((id) => ({ id, label: label(id) })),
      questions: questions.map((q) => ({ id: Number(q.id), section: label(q.section_id), ta: n(q.ta_id), mine: q.ta_id === me, canAnswer: teaching.includes(String(q.section_id)) && q.ta_id !== me,
        topic: String(q.topic), question: String(q.question), state: String(q.state), answer: String(q.answer), answeredBy: n(q.answered_by), at: iso(q.created_at) })),
      toRate: toRate.map((r) => ({ id: String(r.id), subject: String(r.subject), tutor: n(r.tutor_id), at: iso(r.session_at), score: r.score == null ? null : Number(r.score) })),
      tutors: summary.map((s) => ({ id: String(s.tutor_id), name: n(s.tutor_id), n: Number(s.n), avg: s.avg_score == null ? null : Number(s.avg_score), self: s.tutor_id === me })),
      reviews: reviews.map((r) => ({ tutor: n(r.tutor_id), reviewer: n(r.reviewer_id), note: String(r.note), outcome: String(r.action), at: iso(r.at) })),
      supervisors: supList.map(n),
    };
  },
});
