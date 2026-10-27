import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PRC_MIGRATION } from '../lib/prcMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of PRC_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const CENTS = z.number().int().positive().max(1_000_000_000);

// Procurement (S-76 E08). Any member requests; approvers (one, or two different ones at the threshold or on a suspected split)
// approve against the budget; buyers source and issue orders; receivers confirm receipts and returns; invoices are matched
// automatically within tolerance or become exceptions an independent approver resolves; buyers hand only matched or accepted
// invoices to finance, who records the posting reference. No payment is made here. Rules: lib/prcMigration.ts.
export default createEndpoint({
  description: 'Procurement: purchasing rules and budgets, requisitions with split detection and independent approvals, bids, purchase orders, receipts and returns, invoice matching, exceptions and finance handoff',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), role: z.enum(['buyer', 'approver', 'receiver', 'finance']), on: z.boolean() }),
    z.object({ action: z.literal('rules'), approvalThreshold: CENTS, bidThreshold: CENTS, splitDays: z.number().int().min(1).max(365), tolerancePct: z.number().int().min(0).max(20) }),
    z.object({ action: z.literal('budget'), code: z.string().regex(/^[A-Za-z0-9-]{2,20}$/), name: z.string().min(2).max(120), amount: z.number().int().min(0).max(1_000_000_000_00) }),
    z.object({ action: z.literal('submit'), budget: z.string().min(2).max(20), supplier: z.string().min(2).max(200), description: z.string().min(5).max(2000), amount: CENTS, requestKey: z.string().min(8).max(80) }),
    z.object({ action: z.literal('decide'), reqId: z.number().int(), approve: z.boolean(), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('bid'), reqId: z.number().int(), supplier: z.string().min(2).max(200), amount: CENTS, reference: z.string().max(200).default('') }),
    z.object({ action: z.literal('po'), reqId: z.number().int(), bidId: z.number().int().nullable(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('receive'), poId: z.number().int(), amount: z.number().int().refine((n) => n !== 0), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('invoice'), poId: z.number().int(), invoiceNo: z.string().min(1).max(60), amount: CENTS }),
    z.object({ action: z.literal('invoiceStep'), invoiceId: z.number().int(), step: z.enum(['accept', 'dispute', 'handoff', 'posted']), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('closePo'), poId: z.number().int() }),
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
    const roles = ((await sql.query(`SELECT role FROM prc_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role));
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out || !(out.startsWith('ok:') || out.startsWith('replay:'))) forbid(out ?? 'Failed.'); return Number(out!.split(':')[1]); };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage procurement roles.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT prc_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
      await audit(a, `Procurement role ${input.on ? 'granted' : 'revoked'}`, `prc_staff:${uid}`, input.role, 'Administrator');
    }
    if (input.action === 'rules') {
      if (!isAdmin) forbid('Only administrators set purchasing rules.');
      fail(await one(`SELECT prc_set_rules($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.approvalThreshold, input.bidThreshold, input.splitDays, input.tolerancePct]));
      await audit(a, 'Purchasing rules set', 'prc_rules', JSON.stringify(input), 'Administrator');
    }
    if (input.action === 'budget') {
      if (!isAdmin) forbid('Only administrators set budgets.');
      fail(await one(`SELECT prc_set_budget($1,$2,$3,$4,$5) AS r`, [me, T, input.code, input.name, input.amount]));
    }
    if (input.action === 'submit') result = { reqId: ok(await one(`SELECT prc_submit($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.budget, input.supplier, input.description, input.amount, input.requestKey])) };
    if (input.action === 'decide') fail(await one(`SELECT prc_decide($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.reqId, input.approve, input.note, input.expectedVersion]));
    if (input.action === 'bid') ok(await one(`SELECT prc_bid($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.reqId, input.supplier, input.amount, input.reference]));
    if (input.action === 'po') result = { poId: ok(await one(`SELECT prc_issue_po($1,$2,$3,$4,$5) AS r`, [me, T, input.reqId, input.bidId, input.expectedVersion])) };
    if (input.action === 'receive') fail(await one(`SELECT prc_receive($1,$2,$3,$4,$5) AS r`, [me, T, input.poId, input.amount, input.note]));
    if (input.action === 'invoice') result = { invoiceId: ok(await one(`SELECT prc_invoice($1,$2,$3,$4,$5) AS r`, [me, T, input.poId, input.invoiceNo, input.amount])) };
    if (input.action === 'invoiceStep') fail(await one(`SELECT prc_invoice_step($1,$2,$3,$4,$5) AS r`, [me, T, input.invoiceId, input.step, input.note]));
    if (input.action === 'closePo') fail(await one(`SELECT prc_close_po($1,$2,$3) AS r`, [me, T, input.poId]));

    const staff = roles.length > 0 || isAdmin;
    const rules = ((await sql.query(`SELECT * FROM prc_rules WHERE tenant_id = $1`, [T])) as Row[])[0] ?? null;
    const budgets = (await sql.query(`SELECT b.*, prc_used(b.tenant_id, b.code) AS used FROM prc_budgets b WHERE b.tenant_id = $1 ORDER BY code`, [T])) as Row[];
    const reqs = (await sql.query(`SELECT * FROM prc_requisitions WHERE tenant_id = $1 AND ($2 OR requester_id = $3) ORDER BY created_at DESC LIMIT 300`, [T, staff, me])) as Row[];
    const rids = reqs.map((r) => Number(r.id));
    const bids = rids.length ? (await sql.query(`SELECT * FROM prc_bids WHERE req_id = ANY($1::bigint[]) ORDER BY amount`, [rids])) as Row[] : [];
    const pos = rids.length ? (await sql.query(`SELECT p.*, (SELECT coalesce(sum(amount),0) FROM prc_receipts WHERE po_id = p.id)::int AS received FROM prc_pos p WHERE req_id = ANY($1::bigint[])`, [rids])) as Row[] : [];
    const pids = pos.map((p) => Number(p.id));
    const invoices = pids.length ? (await sql.query(`SELECT * FROM prc_invoices WHERE po_id = ANY($1::bigint[]) ORDER BY created_at`, [pids])) as Row[] : [];
    const team = isAdmin ? (await sql.query(`SELECT user_id, role FROM prc_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY role`, [T])) as Row[] : [];
    const names = await userNames([...reqs.flatMap((r) => [r.requester_id, r.approver1, r.approver2]), ...pos.map((p) => p.issued_by), ...invoices.flatMap((i) => [i.decided_by, i.entered_by, i.handed_by, i.posted_by]), ...team.map((t) => t.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);

    return {
      result, roles, isAdmin, staff,
      rules: rules ? { approvalThreshold: Number(rules.approval_threshold), bidThreshold: Number(rules.bid_threshold), splitDays: Number(rules.split_days), tolerancePct: Number(rules.tolerance_pct) } : null,
      budgets: budgets.map((b) => ({ code: String(b.code), name: String(b.name), amount: Number(b.amount), used: Number(b.used) })),
      requisitions: reqs.map((r) => {
        const p = pos.find((x) => String(x.req_id) === String(r.id));
        return { id: Number(r.id), budget: String(r.budget_code), supplier: String(r.supplier), description: String(r.description), amount: Number(r.amount), state: String(r.state), version: Number(r.version),
          needsTwo: !!r.needs_two, split: !!r.split_flag, splitNote: String(r.split_note), requester: nm(r.requester_id), mine: r.requester_id === me, approver1: nm(r.approver1), approver1IsMe: r.approver1 === me, approver2: nm(r.approver2),
          decisionNote: String(r.decision_note), createdAt: iso(r.created_at),
          bids: bids.filter((b) => String(b.req_id) === String(r.id)).map((b) => ({ id: Number(b.id), supplier: String(b.supplier), amount: Number(b.amount), reference: String(b.reference) })),
          po: p ? { id: Number(p.id), supplier: String(p.supplier), amount: Number(p.amount), received: Number(p.received), state: String(p.state), issuedBy: nm(p.issued_by), issuedByMe: p.issued_by === me,
            invoices: invoices.filter((i) => String(i.po_id) === String(p.id)).map((i) => ({ id: Number(i.id), no: String(i.invoice_no), amount: Number(i.amount), state: String(i.state), reason: String(i.exception_reason),
              decidedBy: nm(i.decided_by), note: String(i.decision_note), enteredByMe: i.entered_by === me, postingRef: String(i.posting_ref) })) } : null };
      }),
      team: team.map((t) => ({ name: nm(t.user_id), role: String(t.role) })),
    };
  },
});
