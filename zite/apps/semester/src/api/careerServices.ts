import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { CAR_MIGRATION } from '../lib/carMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of CAR_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Career services: student career plan, resumes and feedback, mock interviews, follow-up actions, fairs and outcomes.
// Coaches see a student's materials only while the student shares them (expiring, per coach).
export default createEndpoint({
  description: 'Career services: plans, resume feedback, mock interviews, follow-up actions, career fairs and outcomes',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('staff'), email: z.string().email().max(200), role: z.enum(['coach', 'center']), on: z.boolean() }),
    z.object({ action: z.literal('share'), coachId: z.string(), until: DATE.nullable().default(null), on: z.boolean() }),
    z.object({ action: z.literal('plan'), goal: z.string().max(1000), targetRoles: z.string().max(1000), steps: z.string().max(4000), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('resume'), label: z.string().min(2).max(80), body: z.string().min(50).max(20000) }),
    z.object({ action: z.literal('comment'), resumeId: z.number().int(), section: z.string().min(2).max(80), comment: z.string().min(5).max(2000) }),
    z.object({ action: z.literal('book'), coachId: z.string(), startsAt: z.string().datetime(), focus: z.string().min(3).max(200) }),
    z.object({ action: z.literal('interviewStep'), id: z.number().int(), step: z.enum(['cancel', 'score', 'no_show']), structure: z.number().int().min(1).max(5).nullable().default(null), evidence: z.number().int().min(1).max(5).nullable().default(null), communication: z.number().int().min(1).max(5).nullable().default(null), notes: z.string().max(2000).default('') }),
    z.object({ action: z.literal('assign'), studentId: z.string(), title: z.string().min(3).max(200), due: DATE.nullable().default(null) }),
    z.object({ action: z.literal('actionStep'), id: z.number().int(), step: z.enum(['done', 'confirm', 'reopen', 'drop']), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('fair'), title: z.string().min(3).max(120), startsAt: z.string().datetime(), location: z.string().max(200).default(''), employers: z.string().max(4000).default(''), capacity: z.number().int().positive().max(20000) }),
    z.object({ action: z.literal('fairReg'), fairId: z.number().int(), on: z.boolean() }),
    z.object({ action: z.literal('checkin'), fairId: z.number().int(), studentId: z.string() }),
    z.object({ action: z.literal('outcome'), cohort: z.string().min(2).max(40), kind: z.enum(['employed', 'grad_school', 'service', 'military', 'seeking', 'not_seeking']), organization: z.string().max(200).default('') }),
    z.object({ action: z.literal('verify'), studentId: z.string(), cohort: z.string().max(40) }),
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
    const roles = ((await sql.query(`SELECT role FROM car_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role));
    const coach = roles.includes('coach'), center = roles.includes('center');
    const tell = (to: string, body: string) => (to && to !== me ? zite.messages.create({ record: { body, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined) : undefined);
    let result: unknown = null;

    switch (input.action) {
      case 'staff': {
        if (!isAdmin) forbid('Only administrators grant career roles.');
        const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
        const uid = rows[0] ? String((rows[0] as Row).id) : '';
        if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
        fail(await one(`SELECT car_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
        await audit(a, `Career role ${input.on ? 'granted' : 'revoked'}`, `user:${uid}`, input.role, 'Administrator');
        break;
      }
      case 'share': fail(await one(`SELECT car_share($1,$2,$3,$4,$5) AS r`, [me, T, input.coachId, input.until, input.on])); if (input.on) await tell(input.coachId, 'A student shared their career materials with you. Open Career services in Semester.'); break;
      case 'plan': fail(await one(`SELECT car_plan($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.goal, input.targetRoles, input.steps, input.expectedVersion])); break;
      case 'resume': result = fail(await one(`SELECT car_resume($1,$2,$3,$4) AS r`, [me, T, input.label, input.body])); break;
      case 'comment': {
        fail(await one(`SELECT car_comment($1,$2,$3,$4,$5) AS r`, [me, T, input.resumeId, input.section, input.comment]));
        const s = ((await sql.query(`SELECT student_id FROM car_resumes WHERE id = $1`, [input.resumeId])) as Row[])[0]?.student_id;
        await tell(String(s ?? ''), 'Your career coach left resume feedback. Open Career services in Semester.');
        break;
      }
      case 'book': result = fail(await one(`SELECT car_book($1,$2,$3,$4,$5) AS r`, [me, T, input.coachId, input.startsAt, input.focus])); await tell(input.coachId, 'A mock interview was booked with you. Open Career services in Semester.'); break;
      case 'interviewStep': fail(await one(`SELECT car_interview_step($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.id, input.step, input.structure, input.evidence, input.communication, input.notes])); break;
      case 'assign': fail(await one(`SELECT car_assign($1,$2,$3,$4,$5) AS r`, [me, T, input.studentId, input.title, input.due])); await tell(input.studentId, 'Your career coach added a follow-up action. Open Career services in Semester.'); break;
      case 'actionStep': fail(await one(`SELECT car_action_step($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.step, input.note])); break;
      case 'fair': result = fail(await one(`SELECT car_fair($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.title, input.startsAt, input.location, input.employers, input.capacity])); break;
      case 'fairReg': fail(await one(`SELECT car_fair_reg($1,$2,$3,$4) AS r`, [me, T, input.fairId, input.on])); break;
      case 'checkin': fail(await one(`SELECT car_checkin($1,$2,$3,$4) AS r`, [me, T, input.fairId, input.studentId])); break;
      case 'outcome': fail(await one(`SELECT car_outcome($1,$2,$3,$4,$5) AS r`, [me, T, input.cohort, input.kind, input.organization])); break;
      case 'verify': fail(await one(`SELECT car_verify($1,$2,$3,$4) AS r`, [me, T, input.studentId, input.cohort])); break;
      case 'get': break;
    }

    // Student's own view.
    const plan = ((await sql.query(`SELECT * FROM car_plans WHERE tenant_id = $1 AND student_id = $2`, [T, me])) as Row[])[0];
    const shares = (await sql.query(`SELECT coach_id, expires_on FROM car_shares WHERE tenant_id = $1 AND student_id = $2 AND revoked_at IS NULL AND expires_on >= current_date`, [T, me])) as Row[];
    const resumes = (await sql.query(`SELECT r.*, (SELECT json_agg(json_build_object('coach', f.coach_id, 'section', f.section, 'comment', f.comment, 'at', f.at) ORDER BY f.at) FROM car_feedback f WHERE f.resume_id = r.id) AS fb
      FROM car_resumes r WHERE r.tenant_id = $1 AND r.student_id = $2 ORDER BY r.label, r.version DESC`, [T, me])) as Row[];
    const interviews = (await sql.query(`SELECT * FROM car_interviews WHERE tenant_id = $1 AND (student_id = $2 OR coach_id = $2) ORDER BY starts_at DESC LIMIT 100`, [T, me])) as Row[];
    const actions = (await sql.query(`SELECT * FROM car_actions WHERE tenant_id = $1 AND (student_id = $2 OR coach_id = $2) ORDER BY state, due NULLS LAST, id DESC LIMIT 200`, [T, me])) as Row[];
    const fairs = (await sql.query(`SELECT f.*, (SELECT count(*) FROM car_fair_regs r WHERE r.fair_id = f.id)::int AS n, EXISTS (SELECT 1 FROM car_fair_regs r WHERE r.fair_id = f.id AND r.student_id = $2) AS mine
      FROM car_fairs f WHERE f.tenant_id = $1 AND NOT f.cancelled ORDER BY f.starts_at DESC LIMIT 50`, [T, me])) as Row[];
    const outcomes = (await sql.query(`SELECT * FROM car_outcomes WHERE tenant_id = $1 AND student_id = $2 ORDER BY cohort DESC`, [T, me])) as Row[];
    const coaches = (await sql.query(`SELECT user_id FROM car_staff WHERE tenant_id = $1 AND role = 'coach' AND revoked_at IS NULL AND user_id <> $2`, [T, me])) as Row[];
    // Coach view: students who share with me.
    const sharedWithMe = coach ? (await sql.query(`SELECT s.student_id, s.expires_on, p.goal, p.target_roles, p.steps FROM car_shares s LEFT JOIN car_plans p ON p.tenant_id = s.tenant_id AND p.student_id = s.student_id
      WHERE s.tenant_id = $1 AND s.coach_id = $2 AND s.revoked_at IS NULL AND s.expires_on >= current_date`, [T, me])) as Row[] : [];
    const sids = sharedWithMe.map((s) => String(s.student_id));
    const theirResumes = sids.length ? (await sql.query(`SELECT DISTINCT ON (student_id, label) id, student_id, label, body, version FROM car_resumes WHERE tenant_id = $1 AND student_id = ANY($2) ORDER BY student_id, label, version DESC`, [T, sids])) as Row[] : [];
    // Center view.
    const regs = center ? (await sql.query(`SELECT r.* FROM car_fair_regs r JOIN car_fairs f ON f.id = r.fair_id WHERE f.tenant_id = $1`, [T])) as Row[] : [];
    const toVerify = center ? (await sql.query(`SELECT * FROM car_outcomes WHERE tenant_id = $1 AND verified_by IS NULL AND student_id <> $2 ORDER BY updated_at DESC LIMIT 200`, [T, me])) as Row[] : [];
    const cohorts = center ? ((await sql.query(`SELECT DISTINCT cohort FROM car_outcomes WHERE tenant_id = $1 ORDER BY cohort DESC LIMIT 10`, [T])) as Row[]).map((c) => String(c.cohort)) : [];
    const report: Record<string, { kind: string; n: number | null }[]> = {};
    for (const c of cohorts) report[c] = ((await sql.query(`SELECT * FROM car_outcome_report($1,$2)`, [T, c])) as Row[]).map((r) => ({ kind: String(r.kind), n: r.n == null ? null : Number(r.n) }));
    const staffList = isAdmin ? (await sql.query(`SELECT user_id, role FROM car_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const nm = await userNames([...new Set([...shares.map((s) => s.coach_id), ...resumes.flatMap((r) => ((r.fb as Row[] | null) ?? []).map((f) => f.coach)), ...interviews.flatMap((i) => [i.student_id, i.coach_id]),
      ...actions.flatMap((x) => [x.student_id, x.coach_id]), ...coaches.map((c) => c.user_id), ...sids, ...regs.map((r) => r.student_id), ...toVerify.map((o) => o.student_id), ...staffList.map((s) => s.user_id)].filter(Boolean).map(String))]);
    const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
    return {
      result, me, roles, isAdmin,
      plan: plan ? { goal: String(plan.goal), targetRoles: String(plan.target_roles), steps: String(plan.steps), version: Number(plan.version) } : { goal: '', targetRoles: '', steps: '', version: 0 },
      shares: shares.map((s) => ({ coachId: String(s.coach_id), coach: n(s.coach_id), until: day(s.expires_on) })),
      coaches: coaches.map((c) => ({ id: String(c.user_id), name: n(c.user_id) })),
      resumes: resumes.map((r) => ({ id: Number(r.id), label: String(r.label), version: Number(r.version), body: String(r.body), at: iso(r.created_at),
        feedback: ((r.fb as Row[] | null) ?? []).map((f) => ({ coach: n(f.coach), section: String(f.section), comment: String(f.comment), at: iso(f.at) })) })),
      interviews: interviews.map((i) => ({ id: Number(i.id), student: n(i.student_id), coach: n(i.coach_id), asCoach: i.coach_id === me, startsAt: iso(i.starts_at), focus: String(i.focus), state: String(i.state),
        scores: i.state === 'scored' ? { structure: Number(i.structure), evidence: Number(i.evidence), communication: Number(i.communication) } : null, notes: String(i.notes), started: new Date(String(i.starts_at)) <= new Date() })),
      actions: actions.map((x) => ({ id: Number(x.id), student: n(x.student_id), coach: n(x.coach_id), asCoach: x.coach_id === me, title: String(x.title), due: day(x.due), state: String(x.state), note: String(x.student_note) })),
      fairs: fairs.map((f) => ({ id: Number(f.id), title: String(f.title), startsAt: iso(f.starts_at), location: String(f.location), employers: String(f.employers), capacity: Number(f.capacity), n: Number(f.n), mine: !!f.mine,
        registrants: center ? regs.filter((r) => String(r.fair_id) === String(f.id)).map((r) => ({ id: String(r.student_id), name: n(r.student_id), checkedIn: !!r.checked_in_by })) : [] })),
      outcomes: outcomes.map((o) => ({ cohort: String(o.cohort), kind: String(o.kind), organization: String(o.organization), verified: !!o.verified_by })),
      shared: sharedWithMe.map((s) => ({ id: String(s.student_id), name: n(s.student_id), until: day(s.expires_on), plan: { goal: String(s.goal ?? ''), targetRoles: String(s.target_roles ?? ''), steps: String(s.steps ?? '') },
        resumes: theirResumes.filter((r) => r.student_id === s.student_id).map((r) => ({ id: Number(r.id), label: String(r.label), version: Number(r.version), body: String(r.body) })) })),
      toVerify: toVerify.map((o) => ({ studentId: String(o.student_id), student: n(o.student_id), cohort: String(o.cohort), kind: String(o.kind), organization: String(o.organization) })),
      report,
      staffList: staffList.map((s) => ({ name: n(s.user_id), role: String(s.role) })),
    };
  },
});
