import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { TRN_MIGRATION } from '../lib/trnMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of TRN_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const term = z.string().min(2).max(40);

// Transition and orientation: first-year cohorts and checklists, outreach, belonging check-ins, onboarding blockers,
// orientation sessions and attendance, enrollment intent, deposit records (paid outside Semester) and placement.
// The actor is always the signed-in user; roles come from trn_staff, granted by an administrator.
export default createEndpoint({
  description: 'Transition and orientation: cohorts, checklists, outreach, belonging, onboarding blockers, orientation sessions, enrollment intent, deposits and placement',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('staff'), email: z.string().email().max(200), role: z.enum(['first_year', 'leader', 'admissions']), on: z.boolean() }),
    z.object({ action: z.literal('cohort'), name: z.string().min(3).max(120), term, emails: z.array(z.string().email().max(200)).max(200).default([]) }),
    z.object({ action: z.literal('item'), cohortId: z.number().int(), title: z.string().min(3).max(200), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), verify: z.boolean() }),
    z.object({ action: z.literal('mark'), itemId: z.number().int(), studentId: z.string().default(''), step: z.enum(['done', 'verify']) }),
    z.object({ action: z.literal('outreach'), studentId: z.string(), channel: z.enum(['message', 'call', 'meeting', 'email']), note: z.string().min(5).max(2000), outcome: z.enum(['reached', 'no_response', 'follow_up']), notify: z.boolean().default(false) }),
    z.object({ action: z.literal('checkin'), term, score: z.number().int().min(1).max(5), note: z.string().max(1000).default(''), shared: z.boolean() }),
    z.object({ action: z.literal('blocker'), studentId: z.string().default(''), category: z.enum(['housing', 'financial', 'registration', 'technology', 'health_access', 'other']), detail: z.string().min(5).max(2000) }),
    z.object({ action: z.literal('blockerStep'), blockerId: z.number().int(), step: z.enum(['escalate', 'claim', 'resolve']), text: z.string().max(2000).default('') }),
    z.object({ action: z.literal('session'), title: z.string().min(3).max(120), startsAt: z.string().datetime(), location: z.string().max(200).default(''), capacity: z.number().int().positive().max(5000), leaderEmails: z.array(z.string().email()).max(20).default([]) }),
    z.object({ action: z.literal('register'), sessionId: z.number().int(), on: z.boolean() }),
    z.object({ action: z.literal('attend'), sessionId: z.number().int(), studentId: z.string(), attended: z.boolean() }),
    z.object({ action: z.literal('intent'), term, intent: z.enum(['enroll', 'decline', 'undecided']) }),
    z.object({ action: z.literal('deposit'), studentId: z.string(), term, reference: z.string().max(100) }),
    z.object({ action: z.literal('placement'), studentId: z.string(), subject: z.string().min(2).max(60), level: z.string().min(1).max(60), basis: z.string().min(3).max(300) }),
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
    const ok = (out: string | null) => { if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.'); return Number(out!.slice(3)); };
    const members = (await tenantScope(T)).members;
    const inTenant = (uid: string) => { if (!members.has(uid)) forbid('That person is not a member of your institution.'); return uid; };
    const byEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      return inTenant(rows[0] ? String((rows[0] as Row).id) : '');
    };
    const roles = ((await sql.query(`SELECT role FROM trn_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role));
    const fy = roles.includes('first_year'), leader = roles.includes('leader'), adm = roles.includes('admissions');
    let result: unknown = null;

    switch (input.action) {
      case 'staff': {
        if (!isAdmin) forbid('Only administrators grant transition roles.');
        const uid = await byEmail(input.email);
        fail(await one(`SELECT trn_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
        await audit(a, `Transition role ${input.on ? 'granted' : 'revoked'}`, `user:${uid}`, input.role, 'Administrator');
        break;
      }
      case 'cohort': {
        const uids: string[] = [];
        for (const e of input.emails) uids.push(await byEmail(e));
        result = ok(await one(`SELECT trn_cohort($1,$2,$3,$4,$5) AS r`, [me, T, input.name, input.term, uids]));
        break;
      }
      case 'item': fail(await one(`SELECT trn_item($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.cohortId, input.title, input.due, input.verify])); break;
      case 'mark': fail(await one(`SELECT trn_mark($1,$2,$3,$4,$5) AS r`, [me, T, input.itemId, input.step === 'done' ? me : input.studentId, input.step])); break;
      case 'outreach': {
        inTenant(input.studentId);
        fail(await one(`SELECT trn_outreach_log($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.studentId, input.channel, input.note, input.outcome]));
        if (input.notify) await zite.messages.create({ record: { body: 'Your first-year team reached out to check in. Reply here any time, or open Transition in Semester.', sender: me, recipients: [input.studentId], isNotification: true } as never }).catch(() => undefined);
        break;
      }
      case 'checkin': fail(await one(`SELECT trn_checkin($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.term, input.score, input.note, input.shared])); break;
      case 'blocker': {
        const sid = input.studentId ? inTenant(input.studentId) : me;
        result = ok(await one(`SELECT trn_blocker($1,$2,$3,$4,$5) AS r`, [me, T, sid, input.category, input.detail]));
        break;
      }
      case 'blockerStep': fail(await one(`SELECT trn_blocker_step($1,$2,$3,$4,$5) AS r`, [me, T, input.blockerId, input.step, input.text])); break;
      case 'session': {
        const leaders: string[] = [];
        for (const e of input.leaderEmails) leaders.push(await byEmail(e));
        result = ok(await one(`SELECT trn_session($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.title, input.startsAt, input.location, input.capacity, leaders]));
        break;
      }
      case 'register': fail(await one(`SELECT trn_register($1,$2,$3,$4) AS r`, [me, T, input.sessionId, input.on])); break;
      case 'attend': fail(await one(`SELECT trn_attend($1,$2,$3,$4,$5) AS r`, [me, T, input.sessionId, input.studentId, input.attended])); break;
      case 'intent': fail(await one(`SELECT trn_intent($1,$2,$3,$4) AS r`, [me, T, input.term, input.intent])); break;
      case 'deposit': inTenant(input.studentId); fail(await one(`SELECT trn_deposit($1,$2,$3,$4,$5) AS r`, [me, T, input.studentId, input.term, input.reference])); break;
      case 'placement': inTenant(input.studentId); fail(await one(`SELECT trn_placement($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.studentId, input.subject, input.level, input.basis])); break;
      case 'get': break;
    }

    // Student view: own cohorts, checklist, sessions, intent, placement, blockers, check-ins.
    const myCohorts = (await sql.query(`SELECT c.id, c.name, c.term FROM trn_cohorts c JOIN trn_members m ON m.cohort_id = c.id WHERE c.tenant_id = $1 AND m.student_id = $2 ORDER BY c.id`, [T, me])) as Row[];
    const myItems = (await sql.query(`SELECT i.id, i.cohort_id, i.title, i.due, i.needs_verification, d.done_at, d.verified_at FROM trn_items i JOIN trn_members m ON m.cohort_id = i.cohort_id AND m.student_id = $2
      JOIN trn_cohorts c ON c.id = i.cohort_id AND c.tenant_id = $1 LEFT JOIN trn_done d ON d.item_id = i.id AND d.student_id = $2 ORDER BY i.due NULLS LAST, i.id`, [T, me])) as Row[];
    const sessions = (await sql.query(`SELECT s.id, s.title, s.starts_at, s.location, s.capacity, (SELECT count(*) FROM trn_registrations r WHERE r.session_id = s.id)::int AS n,
      EXISTS (SELECT 1 FROM trn_registrations r WHERE r.session_id = s.id AND r.student_id = $2) AS mine, EXISTS (SELECT 1 FROM trn_session_leaders l WHERE l.session_id = s.id AND l.leader_id = $2) AS leading
      FROM trn_sessions s WHERE s.tenant_id = $1 AND NOT s.cancelled ORDER BY s.starts_at`, [T, me])) as Row[];
    const intents = (await sql.query(`SELECT term, intent, deposit_ref <> '' AS deposit FROM trn_intents WHERE tenant_id = $1 AND student_id = $2 ORDER BY term`, [T, me])) as Row[];
    const placements = (await sql.query(`SELECT subject, level, basis, at FROM trn_placements WHERE tenant_id = $1 AND student_id = $2 ORDER BY at DESC`, [T, me])) as Row[];
    const myBlockers = (await sql.query(`SELECT id, category, detail, state, escalated, resolution, created_at FROM trn_blockers WHERE tenant_id = $1 AND student_id = $2 ORDER BY id DESC`, [T, me])) as Row[];
    const myCheckins = (await sql.query(`SELECT term, score, shared, at FROM trn_checkins WHERE tenant_id = $1 AND student_id = $2 ORDER BY at DESC LIMIT 10`, [T, me])) as Row[];

    // Staff view (first-year staff): cohorts with progress and belonging aggregate, outreach, open blockers, shared check-ins.
    let staff: unknown = null;
    if (fy || leader || adm) {
      const cohorts = fy ? (await sql.query(`SELECT c.id, c.name, c.term, trn_belonging(c.id) AS belonging, (SELECT count(*) FROM trn_members m WHERE m.cohort_id = c.id)::int AS n FROM trn_cohorts c WHERE c.tenant_id = $1 ORDER BY c.id DESC`, [T])) as Row[] : [];
      const mem = fy ? (await sql.query(`SELECT m.cohort_id, m.student_id FROM trn_members m JOIN trn_cohorts c ON c.id = m.cohort_id WHERE c.tenant_id = $1`, [T])) as Row[] : [];
      const items = fy ? (await sql.query(`SELECT i.id, i.cohort_id, i.title, i.due, i.needs_verification FROM trn_items i JOIN trn_cohorts c ON c.id = i.cohort_id WHERE c.tenant_id = $1 ORDER BY i.id`, [T])) as Row[] : [];
      const done = fy ? (await sql.query(`SELECT d.item_id, d.student_id, d.verified_at FROM trn_done d JOIN trn_items i ON i.id = d.item_id JOIN trn_cohorts c ON c.id = i.cohort_id WHERE c.tenant_id = $1`, [T])) as Row[] : [];
      const outreach = fy ? (await sql.query(`SELECT student_id, staff_id, channel, note, outcome, at FROM trn_outreach WHERE tenant_id = $1 ORDER BY at DESC LIMIT 100`, [T])) as Row[] : [];
      const blockers = (fy || leader) ? (await sql.query(`SELECT id, student_id, category, detail, raised_by, escalated, assigned_to, state, resolution FROM trn_blockers WHERE tenant_id = $1 ORDER BY state, escalated DESC, id DESC LIMIT 200`, [T])) as Row[] : [];
      const shared = fy ? (await sql.query(`SELECT student_id, term, score, note, at FROM trn_checkins WHERE tenant_id = $1 AND shared ORDER BY at DESC LIMIT 100`, [T])) as Row[] : [];
      const regs = leader ? (await sql.query(`SELECT r.session_id, r.student_id, r.attended FROM trn_registrations r JOIN trn_session_leaders l ON l.session_id = r.session_id AND l.leader_id = $2 JOIN trn_sessions s ON s.id = r.session_id AND s.tenant_id = $1`, [T, me])) as Row[] : [];
      const intentsAll = adm ? (await sql.query(`SELECT student_id, term, intent, deposit_ref, updated_at FROM trn_intents WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 200`, [T])) as Row[] : [];
      const nm = await userNames([...new Set([...mem, ...outreach, ...blockers, ...shared, ...regs, ...intentsAll].flatMap((r) => [r.student_id, r.staff_id, r.raised_by, r.assigned_to]).filter(Boolean).map(String))]);
      const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
      staff = {
        cohorts: cohorts.map((c) => ({ id: Number(c.id), name: String(c.name), term: String(c.term), n: Number(c.n), belonging: c.belonging == null ? null : Number(c.belonging),
          items: items.filter((i) => String(i.cohort_id) === String(c.id)).map((i) => ({ id: Number(i.id), title: String(i.title), due: day(i.due), verify: !!i.needs_verification })),
          students: mem.filter((m) => String(m.cohort_id) === String(c.id)).map((m) => ({ id: String(m.student_id), name: n(m.student_id),
            done: done.filter((d) => d.student_id === m.student_id).map((d) => ({ item: Number(d.item_id), verified: !!d.verified_at })) })) })),
        outreach: outreach.map((o) => ({ student: n(o.student_id), staff: n(o.staff_id), channel: String(o.channel), note: String(o.note), outcome: String(o.outcome), at: iso(o.at) })),
        blockers: blockers.map((b) => ({ id: Number(b.id), student: n(b.student_id), mine: b.student_id === me, category: String(b.category), detail: String(b.detail), raisedBy: n(b.raised_by), escalated: !!b.escalated, assigned: n(b.assigned_to), state: String(b.state), resolution: String(b.resolution) })),
        shared: shared.map((s) => ({ student: n(s.student_id), term: String(s.term), score: Number(s.score), note: String(s.note), at: iso(s.at) })),
        attendance: regs.map((r) => ({ session: Number(r.session_id), studentId: String(r.student_id), student: n(r.student_id), attended: r.attended == null ? null : !!r.attended })),
        intents: intentsAll.map((i) => ({ studentId: String(i.student_id), student: n(i.student_id), term: String(i.term), intent: String(i.intent), deposit: String(i.deposit_ref), at: iso(i.updated_at) })),
      };
    }

    return {
      result, roles, isAdmin, me,
      cohorts: myCohorts.map((c) => ({ id: Number(c.id), name: String(c.name), term: String(c.term),
        items: myItems.filter((i) => String(i.cohort_id) === String(c.id)).map((i) => ({ id: Number(i.id), title: String(i.title), due: day(i.due), verify: !!i.needs_verification, done: !!i.done_at, verified: !!i.verified_at })) })),
      sessions: sessions.map((s) => ({ id: Number(s.id), title: String(s.title), startsAt: iso(s.starts_at), location: String(s.location), capacity: Number(s.capacity), n: Number(s.n), mine: !!s.mine, leading: !!s.leading })),
      intents: intents.map((i) => ({ term: String(i.term), intent: String(i.intent), deposit: !!i.deposit })),
      placements: placements.map((p) => ({ subject: String(p.subject), level: String(p.level), basis: String(p.basis), at: iso(p.at) })),
      blockers: myBlockers.map((b) => ({ id: Number(b.id), category: String(b.category), detail: String(b.detail), state: String(b.state), escalated: !!b.escalated, resolution: String(b.resolution), at: iso(b.created_at) })),
      checkins: myCheckins.map((k) => ({ term: String(k.term), score: Number(k.score), shared: !!k.shared, at: iso(k.at) })),
      staff,
      staffList: isAdmin ? await (async () => { const r = (await sql.query(`SELECT user_id, role FROM trn_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]; const nm = await userNames(r.map((x) => String(x.user_id)));
        return r.map((x) => ({ name: nm[String(x.user_id)] ?? 'Someone', role: String(x.role) })); })() : [],
    };
  },
});
