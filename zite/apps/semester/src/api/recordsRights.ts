import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { PRV_MIGRATION } from '../lib/prvMigration';

let ready: Promise<void> | null = null;
const ensurePrv = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of PRV_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
const KINDS = ['inspect', 'amend', 'directory_optout', 'restrict_disclosure'] as const;
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Records rights and access reviews (APP-013; lib/prvMigration.ts). The tenant and every role come from the caller's
// membership on the server: members see their own requests; the records-privacy office sees its institution's queue;
// administrators run access reviews and manage the office. Nothing here edits or deletes an academic record.
export default createEndpoint({
  description: 'Records-rights requests (inspect, amend, directory opt-out, restrict disclosure) and periodic membership access reviews',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('submit'), id: z.string().min(8).max(80), kind: z.enum(KINDS), detail: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('withdraw'), id: z.string() }),
    z.object({ action: z.literal('handle'), id: z.string(), version: z.number().int(), decision: z.enum(['acknowledge', 'fulfill', 'deny']), note: z.string().max(2000) }),
    z.object({ action: z.literal('setOffice'), userId: z.string(), on: z.boolean() }),
    z.object({ action: z.literal('openReview'), id: z.string().min(8).max(80) }),
    z.object({ action: z.literal('decideLine'), reviewId: z.string(), membershipId: z.string(), decision: z.enum(['keep', 'remove']), note: z.string().max(500) }),
    z.object({ action: z.literal('closeReview'), reviewId: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensurePrv();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const isAdmin = a.roles.includes('Administrator');
    const office = ((await sql.query(`SELECT prv_is_staff($1,$2) AS ok`, [T, uid])) as { ok: boolean }[])[0].ok;
    const call = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    const adminOnly = () => { if (!isAdmin) fail('Only institution administrators can do this.'); };

    if (input.action === 'submit') {
      await call(`SELECT prv_submit($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.kind, input.detail]);
      await audit(a, 'Records-rights request submitted', `recordsRights:${input.id}`, input.kind, 'Owner');
    }
    if (input.action === 'withdraw') {
      await call(`SELECT prv_withdraw($1,$2,$3) AS e`, [uid, T, input.id]);
      await audit(a, 'Records-rights request withdrawn', `recordsRights:${input.id}`, '', 'Owner');
    }
    if (input.action === 'handle') {
      await call(`SELECT prv_handle($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.version, input.decision, input.note]);
      await audit(a, `Records-rights request ${input.decision}`, `recordsRights:${input.id}`, '', 'Records-privacy office');
      if (input.decision !== 'acknowledge') {
        const r = ((await sql.query(`SELECT requester_id FROM prv_requests WHERE id = $1`, [input.id])) as Row[])[0];
        if (r) await zite.messages.create({ record: { body: 'Your records request has an answer. Open You → Privacy & data to read it.', sender: uid, recipients: [String(r.requester_id)], isNotification: true } as never }).catch(() => undefined);
      }
    }
    if (input.action === 'setOffice') {
      adminOnly();
      await call(`SELECT prv_set_staff($1,$2,$3,$4) AS e`, [uid, T, input.userId, input.on]);
      await audit(a, input.on ? 'Records-privacy office granted' : 'Records-privacy office revoked', `user:${input.userId}`, '', 'Administrator');
    }
    if (input.action === 'openReview') {
      adminOnly();
      const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 500 });
      const names = await userNames(mems.records.map((m) => first(m.member) ?? ''));
      const lines = mems.records.filter((m) => first(m.member)).map((m) => ({ membershipId: m.id, subjectId: first(m.member), name: names[first(m.member) ?? ''] ?? m.label ?? '', roles: m.roles ?? [], status: m.status ?? '' }));
      await call(`SELECT arv_open($1,$2,$3,$4::jsonb) AS e`, [uid, T, input.id, JSON.stringify(lines)]);
      await audit(a, 'Access review opened', `accessReview:${input.id}`, `${lines.length} memberships`, 'Administrator');
    }
    if (input.action === 'decideLine') {
      adminOnly();
      await call(`SELECT arv_decide($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.reviewId, input.membershipId, input.decision, input.note]);
      await audit(a, `Access certified: ${input.decision}`, `membership:${input.membershipId}`, input.note, 'Administrator');
    }
    if (input.action === 'closeReview') {
      adminOnly();
      await call(`SELECT arv_close($1,$2,$3) AS e`, [uid, T, input.reviewId]);
      await audit(a, 'Access review closed', `accessReview:${input.reviewId}`, '', 'Administrator');
    }

    const map = (r: Row) => ({ id: String(r.id), number: Number(r.number), kind: String(r.kind), detail: String(r.detail), state: String(r.state), version: Number(r.version),
      dueAt: iso(r.due_at), createdAt: iso(r.created_at), handledAt: iso(r.handled_at), outcome: (r.outcome_note as string) ?? '', overdue: !!r.overdue });
    const mine = (await sql.query(`SELECT *, (state IN ('submitted','acknowledged') AND due_at < now()) AS overdue FROM prv_requests WHERE tenant_id = $1 AND requester_id = $2 ORDER BY number DESC LIMIT 50`, [T, uid])) as Row[];
    const out: Record<string, unknown> = { isAdmin, office, mine: mine.map(map) };
    if (office) {
      const q = (await sql.query(`SELECT *, (state IN ('submitted','acknowledged') AND due_at < now()) AS overdue FROM prv_requests WHERE tenant_id = $1 ORDER BY (state IN ('submitted','acknowledged')) DESC, due_at ASC LIMIT 200`, [T])) as Row[];
      const names = await userNames(q.map((r) => String(r.requester_id)));
      out.queue = q.map((r) => ({ ...map(r), requester: names[String(r.requester_id)] ?? 'Member', own: r.requester_id === uid }));
    }
    if (isAdmin) {
      const [staff, reviews] = await Promise.all([
        sql.query(`SELECT user_id FROM prv_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T]) as Promise<Row[]>,
        sql.query(`SELECT * FROM arv_reviews WHERE tenant_id = $1 ORDER BY number DESC LIMIT 10`, [T]) as Promise<Row[]>,
      ]);
      const open = reviews.find((r) => r.state === 'open');
      const lines = open ? ((await sql.query(`SELECT * FROM arv_lines WHERE review_id = $1 ORDER BY subject_name`, [open.id])) as Row[]) : [];
      const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 500 });
      const staffIds = staff.map((s) => String(s.user_id));
      const names = await userNames([...staffIds, ...mems.records.map((m) => first(m.member) ?? ''), ...lines.map((l) => String(l.decided_by ?? ''))]);
      out.officeStaff = staffIds.map((id) => ({ id, name: names[id] ?? 'Member' }));
      out.members = mems.records.map((m) => first(m.member)).filter((id): id is string => !!id && id !== uid && !staffIds.includes(id)).map((id) => ({ id, name: names[id] ?? 'Member' }));
      out.reviews = reviews.map((r) => ({ id: String(r.id), number: Number(r.number), state: String(r.state), openedAt: iso(r.opened_at), closedAt: iso(r.closed_at) }));
      out.openReview = open ? { id: String(open.id), number: Number(open.number), lines: lines.map((l) => ({ membershipId: String(l.membership_id), name: String(l.subject_name), roles: l.roles as string[],
        status: String(l.status), decision: (l.decision as string) ?? null, decidedBy: l.decided_by ? names[String(l.decided_by)] ?? 'Administrator' : '', note: (l.note as string) ?? '',
        self: l.subject_id === uid, currentStatus: mems.records.find((m) => m.id === l.membership_id)?.status ?? 'Removed' })) } : null;
    }
    return out;
  },
});
