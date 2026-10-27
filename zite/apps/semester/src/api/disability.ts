import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids } from '../lib/server';
import { pg } from '../lib/pg';
import { ACC_MIGRATION } from '../lib/accMigration';
import { DSA_MIGRATION } from '../lib/dsaMigration';
import { courseRole } from '../lib/teamServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...ACC_MIGRATION, ...DSA_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Disability services workflow: intake assignment and meetings, document tracking (status only, never contents), appeals,
// instructor acknowledgment of letters and implementation checks. Coordinators never receive the student's description.
export default createEndpoint({
  description: 'Disability services: intake, document tracking, appeals, letter acknowledgment and implementation checks',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('coordinator'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('assign'), requestId: z.string(), coordinatorId: z.string() }),
    z.object({ action: z.literal('intake'), requestId: z.string(), step: z.enum(['schedule', 'held', 'no_show']), at: z.string().datetime().nullable().default(null) }),
    z.object({ action: z.literal('doc'), requestId: z.string(), docId: z.number().int().nullable().default(null), kind: z.enum(['provider_letter', 'prior_plan', 'self_report', 'other']).nullable().default(null), state: z.enum(['received', 'verified', 'insufficient']).nullable().default(null), note: z.string().max(200).default('') }),
    z.object({ action: z.literal('appeal'), requestId: z.string(), reason: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('decideAppeal'), requestId: z.string(), outcome: z.enum(['upheld', 'modified', 'overturned']), arrangements: z.array(z.string().min(3).max(200)).max(12).default([]), validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), note: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('ack'), requestId: z.string(), sectionId: z.string() }),
    z.object({ action: z.literal('check'), requestId: z.string(), sectionId: z.string(), delivered: z.boolean(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('clearFlag'), checkId: z.number().int() }),
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
    const fail = (out: string | null) => { if (out) forbid(out); };
    const officer = !!((await sql.query(`SELECT acc_is_staff($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    const coord = !!((await sql.query(`SELECT dsa_is_coord($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    const scope = await tenantScope(T);
    const tell = (to: string[], body: string) => { const r = to.filter((x) => x && x !== me); return r.length ? zite.messages.create({ record: { body, sender: me, recipients: r, isNotification: true } as never }).catch(() => undefined) : undefined; };
    const officers = async () => ((await sql.query(`SELECT user_id FROM acc_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((r) => String(r.user_id));

    switch (input.action) {
      case 'coordinator': {
        if (!isAdmin) forbid('Only administrators appoint disability services coordinators.');
        const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
        const uid = rows[0] ? String((rows[0] as Row).id) : '';
        if (!uid || !scope.members.has(uid)) forbid('That person is not a member of your institution.');
        fail(await one(`SELECT dsa_set_coord($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
        await audit(a, `Disability services coordinator ${input.on ? 'appointed' : 'removed'}`, `user:${uid}`, '', 'Administrator');
        break;
      }
      case 'assign': fail(await one(`SELECT dsa_assign($1,$2,$3,$4) AS r`, [me, T, input.requestId, input.coordinatorId])); await tell([input.coordinatorId], 'An accommodation intake was assigned to you. Open Disability services in Semester.'); break;
      case 'intake': fail(await one(`SELECT dsa_intake_step($1,$2,$3,$4,$5) AS r`, [me, T, input.requestId, input.step, input.at])); break;
      case 'doc': fail(await one(`SELECT dsa_doc($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.requestId, input.docId, input.kind, input.state, input.note])); break;
      case 'appeal': fail(await one(`SELECT dsa_appeal($1,$2,$3,$4) AS r`, [me, T, input.requestId, input.reason])); await tell(await officers(), 'A student appealed an accommodation decision. Open Disability services in Semester.'); break;
      case 'decideAppeal': {
        fail(await one(`SELECT dsa_decide_appeal($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.requestId, input.outcome, input.arrangements, input.note, input.validUntil]));
        await audit(a, `Accommodation appeal ${input.outcome}`, `accommodation:${input.requestId}`, '', 'Accessibility office');
        const s = ((await sql.query(`SELECT student_id FROM acc_requests WHERE id = $1`, [input.requestId])) as Row[])[0]?.student_id;
        await tell([String(s ?? '')], 'Your accommodation appeal has a decision. Open Disability services in Semester.');
        break;
      }
      case 'ack': {
        if (!scope.sections.has(input.sectionId)) forbid('That section is not in your institution.');
        const isInstructor = (await courseRole(T, input.sectionId, me)) === 'instructor';
        fail(await one(`SELECT dsa_ack($1,$2,$3,$4,$5) AS r`, [me, T, input.requestId, input.sectionId, isInstructor]));
        break;
      }
      case 'check': {
        fail(await one(`SELECT dsa_check($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.requestId, input.sectionId, input.delivered, input.note]));
        if (!input.delivered) await tell(await officers(), 'An accommodation was reported as not delivered. Open Disability services in Semester.');
        break;
      }
      case 'clearFlag': fail(await one(`SELECT dsa_clear_flag($1,$2,$3) AS r`, [me, T, input.checkId])); break;
      case 'get': break;
    }

    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => scope.sections.has(s.id));
    const label = (id: unknown) => secs.find((s) => s.id === String(id))?.label ?? 'Section';
    // Student: own decided requests and appeals.
    const mine = (await sql.query(`SELECT r.id, r.number, r.category, r.state, r.arrangements, ap.state AS appeal, ap.note AS appeal_note FROM acc_requests r LEFT JOIN dsa_appeals ap ON ap.request_id = r.id
      WHERE r.tenant_id = $1 AND r.student_id = $2 ORDER BY r.number DESC`, [T, me])) as Row[];
    // Instructor: active letters for sections I teach (arrangements only).
    const teaching = secs.filter((s) => ids(s.instructors).includes(me)).map((s) => s.id);
    const letters = teaching.length ? (await sql.query(`SELECT l.*, (SELECT 1 FROM dsa_acks k WHERE k.request_id = l.request_id AND k.section_id = l.section_id) AS acked FROM acc_instructor_letters($1, $2) l`, [T, teaching])) as Row[] : [];
    // Office and coordinators. Coordinators see category, state and name only for intakes assigned to them.
    const queue = officer ? (await sql.query(`SELECT r.id, r.number, r.student_id, r.category, r.state, r.decided_by, i.coordinator_id, i.state AS intake, i.meeting_at FROM acc_requests r
      LEFT JOIN dsa_intake i ON i.request_id = r.id WHERE r.tenant_id = $1 AND r.student_id <> $2 ORDER BY r.number DESC LIMIT 200`, [T, me])) as Row[]
      : coord ? (await sql.query(`SELECT r.id, r.number, r.student_id, r.category, r.state, i.coordinator_id, i.state AS intake, i.meeting_at FROM acc_requests r JOIN dsa_intake i ON i.request_id = r.id
      WHERE r.tenant_id = $1 AND i.coordinator_id = $2 ORDER BY r.number DESC LIMIT 200`, [T, me])) as Row[] : [];
    const qids = queue.map((q) => String(q.id));
    const docs = qids.length ? (await sql.query(`SELECT * FROM dsa_docs WHERE request_id = ANY($1) ORDER BY id`, [qids])) as Row[] : [];
    const appeals = officer ? (await sql.query(`SELECT ap.*, r.arrangements, r.number FROM dsa_appeals ap JOIN acc_requests r ON r.id = ap.request_id WHERE r.tenant_id = $1 AND ap.state = 'open' AND ap.student_id <> $2`, [T, me])) as Row[] : [];
    const active = officer || coord ? (await sql.query(`SELECT l.request_id, l.section_id, r.student_id, (SELECT 1 FROM dsa_acks k WHERE k.request_id = l.request_id AND k.section_id = l.section_id) AS acked
      FROM acc_letters l JOIN acc_requests r ON r.id = l.request_id WHERE r.tenant_id = $1 AND r.state = 'approved' AND l.withdrawn_at IS NULL AND r.student_id <> $2
      AND ($3 OR EXISTS (SELECT 1 FROM dsa_intake i WHERE i.request_id = r.id AND i.coordinator_id = $2))`, [T, me, officer])) as Row[] : [];
    const flags = officer ? (await sql.query(`SELECT c.* FROM dsa_checks c JOIN acc_requests r ON r.id = c.request_id WHERE r.tenant_id = $1 AND c.flagged AND c.resolved_by IS NULL`, [T])) as Row[] : [];
    const coordinators = officer || isAdmin ? ((await sql.query(`SELECT user_id FROM dsa_coordinators WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((r) => String(r.user_id)) : [];
    const nm = await userNames([...new Set([...queue.flatMap((q) => [q.student_id, q.coordinator_id]), ...letters.map((l) => l.student_id), ...appeals.map((p) => p.student_id), ...active.map((x) => x.student_id), ...coordinators].filter(Boolean).map(String))]);
    const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
    return {
      me, officer, coord, isAdmin,
      mine: mine.map((r) => ({ id: String(r.id), number: Number(r.number), category: String(r.category), state: String(r.state), arrangements: (r.arrangements as string[] | null) ?? [], appeal: r.appeal ? String(r.appeal) : null, appealNote: String(r.appeal_note ?? '') })),
      letters: letters.map((l) => ({ requestId: String(l.request_id), sectionId: String(l.section_id), section: label(l.section_id), student: n(l.student_id), arrangements: (l.arrangements as string[]) ?? [], validUntil: l.valid_until ? String(l.valid_until).slice(0, 10) : null, acked: !!l.acked })),
      queue: queue.map((q) => ({ id: String(q.id), number: Number(q.number), student: n(q.student_id), category: String(q.category), state: String(q.state), coordinator: n(q.coordinator_id), coordinatorId: q.coordinator_id ? String(q.coordinator_id) : null,
        intake: q.intake ? String(q.intake) : null, meetingAt: iso(q.meeting_at), mineToCoordinate: q.coordinator_id === me,
        docs: docs.filter((d) => d.request_id === q.id).map((d) => ({ id: Number(d.id), kind: String(d.kind), state: String(d.state), note: String(d.note) })) })),
      appeals: appeals.map((p) => ({ requestId: String(p.request_id), number: Number(p.number), student: n(p.student_id), reason: String(p.reason), arrangements: (p.arrangements as string[] | null) ?? [], iDecidedOriginally: p.original_decider === me })),
      active: active.map((x) => ({ requestId: String(x.request_id), sectionId: String(x.section_id), section: label(x.section_id), student: n(x.student_id), acked: !!x.acked })),
      flags: flags.map((c) => ({ id: Number(c.id), section: label(c.section_id), note: String(c.note), mine: c.checked_by === me, at: iso(c.at) })),
      coordinators: coordinators.map((id) => ({ id, name: n(id) })),
    };
  },
});
