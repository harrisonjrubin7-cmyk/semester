import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { CNE_MIGRATION } from '../lib/cneMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of CNE_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const ROLE = z.enum(['coordinator', 'authority', 'finance']);

// Continuing Education (S-76 E02). Offerings are published by coordinators; anyone signed in may enroll in a public offering
// (independent learners included, no membership needed), members only in their own institution's members-only ones.
// Finance records payments, sponsorships and refunds with external references (no money moves here); the authority waives fees,
// decides completion and issues or revokes credentials. Schedule changes and cancellations notify enrolled learners in-app.
// Rules: lib/cneMigration.ts.
export default createEndpoint({
  description: 'Continuing education: offerings, sessions, enrollment, payment and sponsorship records, attendance, completion, credentials, cancellations and refunds',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), role: ROLE, on: z.boolean() }),
    z.object({ action: z.literal('saveOffering'), id: z.number().int().nullable(), code: z.string().min(3).max(20), title: z.string().min(3).max(200), description: z.string().max(4000).default(''),
      feeCents: z.number().int().min(0).max(10000000), capacity: z.number().int().min(1).max(5000), prereqs: z.array(z.string().max(20)).max(10).default([]), minAttendance: z.number().int().min(0).max(100),
      openToPublic: z.boolean(), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('addSession'), offeringId: z.number().int(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), location: z.string().max(200).default('') }),
    z.object({ action: z.literal('publish'), offeringId: z.number().int(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('changeSession'), sessionId: z.number().int(), cancel: z.boolean(), startsAt: z.string().datetime().nullable(), endsAt: z.string().datetime().nullable(), location: z.string().max(200).nullable(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('cancelOffering'), offeringId: z.number().int(), reason: z.string().min(5).max(500), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('enroll'), offeringId: z.number().int() }),
    z.object({ action: z.literal('withdraw'), enrollmentId: z.number().int() }),
    z.object({ action: z.literal('requestRefund'), enrollmentId: z.number().int(), reason: z.string().min(10).max(1000) }),
    z.object({ action: z.literal('pay'), enrollmentId: z.number().int(), kind: z.enum(['paid', 'sponsored', 'waived']), reference: z.string().max(100).default(''), sponsor: z.string().max(200).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('attend'), enrollmentId: z.number().int(), sessionId: z.number().int(), present: z.boolean() }),
    z.object({ action: z.literal('complete'), enrollmentId: z.number().int(), passed: z.boolean(), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('refund'), enrollmentId: z.number().int(), step: z.enum(['approve', 'deny', 'issued']), cents: z.number().int().min(0).nullable().default(null), text: z.string().max(500).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('revoke'), credentialId: z.number().int(), reason: z.string().min(5).max(500) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    let a: Awaited<ReturnType<typeof requireAccess>> | null = null;
    try { a = await requireAccess(me); } catch { a = null; }
    const T = a?.institutionId ?? null;
    let isAdmin = false;
    if (a) { try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ } }
    const roles = T ? ((await sql.query(`SELECT role FROM cne_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role)) : [];
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out || !(out.startsWith('ok:') || out.startsWith('replay:'))) forbid(out ?? 'Failed.'); return Number(out!.split(':')[1]); };
    const staffT = () => { if (!T) forbid('You need an active institution workspace for this.'); return T!; };
    const notify = (to: string[], body: string) => to.length ? zite.messages.create({ record: { body, sender: me, recipients: to, isNotification: true } as never }).catch(() => undefined) : Promise.resolve();
    const learnersOf = async (offeringId: number) => ((await sql.query(`SELECT learner_id FROM cne_enrollments WHERE offering_id = $1 AND state = 'enrolled'`, [offeringId])) as Row[]).map((r) => String(r.learner_id));
    const enrollment = async (id: number) => ((await sql.query(`SELECT e.*, o.title FROM cne_enrollments e JOIN cne_offerings o ON o.id = e.offering_id WHERE e.id = $1`, [id])) as Row[])[0];
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage continuing-education roles.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(staffT())).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT cne_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
      await audit(a!, `Continuing education role ${input.on ? 'granted' : 'revoked'}`, `cne_staff:${uid}`, input.role, 'Administrator');
    }
    if (input.action === 'saveOffering') result = { offeringId: ok(await one(`SELECT cne_offering_save($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10,$11,$12) AS r`,
      [me, staffT(), input.id, input.code, input.title, input.description, input.feeCents, input.capacity, input.prereqs.map((p) => p.trim().toUpperCase()).filter(Boolean), input.minAttendance, input.openToPublic, input.expectedVersion])) };
    if (input.action === 'addSession') result = { sessionId: ok(await one(`SELECT cne_session_add($1,$2,$3,$4,$5,$6) AS r`, [me, staffT(), input.offeringId, input.startsAt, input.endsAt, input.location])) };
    if (input.action === 'publish') fail(await one(`SELECT cne_publish($1,$2,$3,$4) AS r`, [me, staffT(), input.offeringId, input.expectedVersion]));
    if (input.action === 'changeSession') {
      const s = ((await sql.query(`SELECT s.*, o.title FROM cne_sessions s JOIN cne_offerings o ON o.id = s.offering_id WHERE s.id = $1`, [input.sessionId])) as Row[])[0];
      if (!s) forbid('Session not found.');
      fail(await one(`SELECT cne_session_change($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, staffT(), input.sessionId, input.cancel, input.startsAt, input.endsAt, input.location, input.expectedVersion]));
      await notify(await learnersOf(Number(s.offering_id)), input.cancel
        ? `A session of ${s.title} on ${new Date(String(s.starts_at)).toUTCString()} was cancelled.`
        : `A session of ${s.title} moved to ${new Date(String(input.startsAt)).toUTCString()}${input.location ? ` · ${input.location}` : ''}.`);
    }
    if (input.action === 'cancelOffering') {
      const to = await learnersOf(input.offeringId);
      fail(await one(`SELECT cne_cancel_offering($1,$2,$3,$4,$5) AS r`, [me, staffT(), input.offeringId, input.reason, input.expectedVersion]));
      await notify(to, `A continuing-education offering you enrolled in was cancelled: ${input.reason}. Any payment is queued for a refund.`);
      await audit(a!, 'Continuing education offering cancelled', `cne_offering:${input.offeringId}`, input.reason, 'Coordinator');
    }
    if (input.action === 'enroll') {
      const o = ((await sql.query(`SELECT tenant_id FROM cne_offerings WHERE id = $1`, [input.offeringId])) as Row[])[0];
      result = { enrollmentId: ok(await one(`SELECT cne_enroll($1,$2,$3) AS r`, [me, input.offeringId, !!o && String(o.tenant_id) === T])) };
    }
    if (input.action === 'withdraw') fail(await one(`SELECT cne_withdraw($1,$2) AS r`, [me, input.enrollmentId]));
    if (input.action === 'requestRefund') fail(await one(`SELECT cne_refund_request($1,$2,$3) AS r`, [me, input.enrollmentId, input.reason]));
    if (input.action === 'pay') fail(await one(`SELECT cne_pay($1,$2,$3,$4,$5,$6,$7) AS r`, [me, staffT(), input.enrollmentId, input.kind, input.reference, input.sponsor, input.expectedVersion]));
    if (input.action === 'attend') fail(await one(`SELECT cne_attend($1,$2,$3,$4,$5) AS r`, [me, staffT(), input.enrollmentId, input.sessionId, input.present]));
    if (input.action === 'complete') {
      fail(await one(`SELECT cne_complete($1,$2,$3,$4,$5,$6) AS r`, [me, staffT(), input.enrollmentId, input.passed, input.note, input.expectedVersion]));
      const e = await enrollment(input.enrollmentId);
      await notify([String(e.learner_id)], input.passed ? `You completed ${e.title}. Your credential is in Continuing education.` : `${e.title}: completion requirements were not met. ${input.note}`);
    }
    if (input.action === 'refund') {
      fail(await one(`SELECT cne_refund_decide($1,$2,$3,$4,$5,$6,$7) AS r`, [me, staffT(), input.enrollmentId, input.step, input.cents, input.text, input.expectedVersion]));
      const e = await enrollment(input.enrollmentId);
      await notify([String(e.learner_id)], `${e.title}: your refund was ${input.step === 'approve' ? 'approved' : input.step === 'deny' ? 'denied' : 'issued'}.`);
    }
    if (input.action === 'revoke') fail(await one(`SELECT cne_revoke($1,$2,$3,$4) AS r`, [me, staffT(), input.credentialId, input.reason]));

    // Reads
    const mine = (await sql.query(`SELECT e.*, o.code, o.title, o.tenant_id AS o_tenant, o.state AS o_state, o.cancel_reason, o.fee_cents, cne_attendance_pct(e.id) AS pct, o.min_attendance,
      c.id AS cred_id, c.verify_code, c.issued_at, c.revoked_at AS cred_revoked, c.revoke_reason FROM cne_enrollments e JOIN cne_offerings o ON o.id = e.offering_id
      LEFT JOIN cne_credentials c ON c.enrollment_id = e.id WHERE e.learner_id = $1 ORDER BY e.created_at DESC LIMIT 200`, [me])) as Row[];
    const catalog = (await sql.query(`SELECT o.*, (SELECT count(*)::int FROM cne_enrollments e WHERE e.offering_id = o.id AND e.state = 'enrolled') AS taken FROM cne_offerings o
      WHERE o.state = 'published' AND (o.open_to_public OR o.tenant_id = $1) ORDER BY o.created_at DESC LIMIT 200`, [T ?? ''])) as Row[];
    const staff = roles.length > 0;
    const offerings = staff ? (await sql.query(`SELECT * FROM cne_offerings WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`, [T])) as Row[] : [];
    const offIds = [...new Set([...catalog, ...offerings].map((o) => Number(o.id)).concat(mine.map((e) => Number(e.offering_id))))];
    const sessions = offIds.length ? (await sql.query(`SELECT * FROM cne_sessions WHERE offering_id = ANY($1::bigint[]) ORDER BY starts_at`, [offIds])) as Row[] : [];
    const enrollments = staff ? (await sql.query(`SELECT e.*, cne_attendance_pct(e.id) AS pct, c.id AS cred_id, c.verify_code, c.revoked_at AS cred_revoked FROM cne_enrollments e
      LEFT JOIN cne_credentials c ON c.enrollment_id = e.id WHERE e.tenant_id = $1 ORDER BY e.created_at LIMIT 2000`, [T])) as Row[] : [];
    const attendance = enrollments.length ? (await sql.query(`SELECT * FROM cne_attendance WHERE enrollment_id = ANY($1::bigint[])`, [enrollments.map((e) => Number(e.id))])) as Row[] : [];
    const team = isAdmin ? (await sql.query(`SELECT user_id, role FROM cne_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY role`, [T])) as Row[] : [];
    const names = await userNames([...enrollments.map((e) => String(e.learner_id)), ...team.map((t) => String(t.user_id))]);
    const instIds = [...new Set([...catalog.map((o) => String(o.tenant_id)), ...mine.map((e) => String(e.o_tenant))])];
    const instName: Record<string, string> = {};
    for (const id of instIds) instName[id] = (await zite.institutions.findOne({ id }).catch(() => null))?.name ?? 'Institution';
    const sess = (oid: unknown) => sessions.filter((s) => String(s.offering_id) === String(oid)).map((s) => ({ id: Number(s.id), startsAt: iso(s.starts_at), endsAt: iso(s.ends_at), location: String(s.location), cancelled: !!s.cancelled, version: Number(s.version) }));
    const enr = (e: Row) => ({ id: Number(e.id), state: String(e.state), payment: String(e.payment_state), paidCents: Number(e.paid_cents), paymentRef: String(e.payment_ref), sponsor: String(e.sponsor),
      completion: String(e.completion_state), completionNote: String(e.completion_note), refund: String(e.refund_state), refundCents: e.refund_cents == null ? null : Number(e.refund_cents),
      refundReason: String(e.refund_reason), refundRef: String(e.refund_ref), refundRequestedBy: String(e.refund_requested_by ?? ''), version: Number(e.version), pct: Number(e.pct),
      credential: e.cred_id ? { id: Number(e.cred_id), code: String(e.verify_code), revoked: !!e.cred_revoked } : null });

    return {
      result, roles, isAdmin, hasInstitution: !!T, institutionName: a?.institutionName ?? null,
      catalog: catalog.map((o) => ({ id: Number(o.id), code: String(o.code), title: String(o.title), description: String(o.description), institution: instName[String(o.tenant_id)], feeCents: Number(o.fee_cents),
        seatsLeft: Number(o.capacity) - Number(o.taken), prereqs: o.prereqs as string[], minAttendance: Number(o.min_attendance), openToPublic: !!o.open_to_public, sessions: sess(o.id),
        enrolled: mine.some((e) => String(e.offering_id) === String(o.id) && e.state === 'enrolled') })),
      mine: mine.map((e) => ({ ...enr(e), code: String(e.code), title: String(e.title), institution: instName[String(e.o_tenant)], offeringState: String(e.o_state), cancelReason: String(e.cancel_reason),
        feeCents: Number(e.fee_cents), minAttendance: Number(e.min_attendance), issuedAt: iso(e.issued_at), revokeReason: String(e.revoke_reason ?? ''), sessions: sess(e.offering_id) })),
      offerings: offerings.map((o) => ({ id: Number(o.id), code: String(o.code), title: String(o.title), description: String(o.description), feeCents: Number(o.fee_cents), capacity: Number(o.capacity),
        prereqs: o.prereqs as string[], minAttendance: Number(o.min_attendance), openToPublic: !!o.open_to_public, state: String(o.state), cancelReason: String(o.cancel_reason), version: Number(o.version), sessions: sess(o.id),
        enrollments: enrollments.filter((e) => String(e.offering_id) === String(o.id)).map((e) => ({ ...enr(e), learner: names[String(e.learner_id)] ?? 'Learner', mine: e.learner_id === me,
          attendance: Object.fromEntries(attendance.filter((x) => String(x.enrollment_id) === String(e.id)).map((x) => [String(x.session_id), !!x.present])) })) })),
      team: team.map((t) => ({ name: names[String(t.user_id)] ?? 'Member', role: String(t.role) })),
    };
  },
});
