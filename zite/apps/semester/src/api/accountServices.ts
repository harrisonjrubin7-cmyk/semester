import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, first, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { SA_MIGRATION } from '../lib/saMigration';

let ready: Promise<void> | null = null;
const ensureSa = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of SA_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const money = (n: number) => Math.round(n * 100) / 100;

// Student-account services (lib/saMigration.ts): term statements, disputes, adjustment proposals and refund requests.
// The official ledger is read-only; approved items are "approved, not posted" and no money moves from Semester.
export default createEndpoint({
  description: 'Student account services: term statements, disputes, adjustment proposals and refund requests with second-person approval (nothing posted or paid)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('dispute'), id: z.string().min(8).max(80), entryId: z.string(), reason: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('requestRefund'), id: z.string().min(8).max(80), amount: z.number().positive().max(100000), reason: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('staff') }),
    z.object({ action: z.literal('explain'), id: z.string(), response: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('propose'), id: z.string().min(8).max(80), studentId: z.string(), kind: z.enum(['credit_adjustment', 'charge_adjustment']), amount: z.number().positive().max(100000), reason: z.string().min(10).max(2000), disputeId: z.string().nullable() }),
    z.object({ action: z.literal('decide'), id: z.string(), approve: z.boolean(), note: z.string().min(5).max(1000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureSa();
    const sql = pg();
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    const one = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    const notify = (from: string, to: string, body: string) => zite.messages.create({ record: { body, sender: from, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    const prop = (p: Row, names: Record<string, string> = {}) => ({ id: String(p.id), number: Number(p.number), kind: String(p.kind), amount: Number(p.amount), reason: String(p.reason), state: String(p.state),
      decisionNote: (p.decision_note as string) ?? '', createdAt: iso(p.created_at), student: names[String(p.student_id)] ?? null, proposedBy: names[String(p.proposed_by)] ?? null, studentId: String(p.student_id), proposerId: String(p.proposed_by) });
    const disp = (d: Row, names: Record<string, string> = {}) => ({ id: String(d.id), number: Number(d.number), entryLabel: String(d.entry_label), entryAmount: Number(d.entry_amount), reason: String(d.reason),
      state: String(d.state), response: (d.response as string) ?? '', createdAt: iso(d.created_at), student: names[String(d.student_id)] ?? null, studentId: String(d.student_id) });

    if (['mine', 'dispute', 'requestRefund'].includes(input.action)) {
      const a = await requireAccess(context.user.id);
      const uid = a.userId, T = a.institutionId;
      const entries = (await zite.accountLedgerEntries.findAll({ filters: { student: uid, institution: T }, limit: 500 })).records;
      const signed = (e: (typeof entries)[0]) => (e.entryType === 'Charge' ? 1 : -1) * Number(e.amount ?? 0);
      const balance = money(entries.reduce((n, e) => n + signed(e), 0));
      if (input.action === 'dispute') {
        const e = entries.find((x) => x.id === input.entryId);
        if (!e) fail('That item is not on your account.');
        await one(`SELECT sa_dispute($1,$2,$3,$4,$5,$6,$7) AS e`, [uid, T, input.id, e!.id, e!.label ?? 'Item', Number(e!.amount ?? 0), input.reason]);
        await audit(a, 'Account item disputed', `dispute:${input.id}`, e!.label ?? '', 'Owner');
      }
      if (input.action === 'requestRefund') {
        // Only a credit balance can be refunded, and never more than it.
        if (balance >= 0 || input.amount > -balance) fail(balance >= 0 ? 'Your account has no credit balance to refund.' : `You can request up to ${money(-balance)}.`);
        await one(`SELECT sa_propose($1,$2,$3,$4,'refund',$5,$6,NULL) AS e`, [uid, T, input.id, uid, input.amount, input.reason]);
        await audit(a, 'Refund requested', `refund:${input.id}`, String(input.amount), 'Owner');
      }
      // Term statements derived from the read-only official ledger.
      const terms = [...new Set(entries.map((e) => e.term ?? 'Unassigned'))].sort();
      const statements = terms.map((term) => {
        const rows = entries.filter((e) => (e.term ?? 'Unassigned') === term);
        const charges = money(rows.filter((e) => e.entryType === 'Charge').reduce((n, e) => n + Number(e.amount ?? 0), 0));
        const credits = money(rows.filter((e) => e.entryType !== 'Charge').reduce((n, e) => n + Number(e.amount ?? 0), 0));
        return { term, charges, credits, balance: money(charges - credits), lines: rows.map((e) => ({ id: e.id, type: e.entryType ?? 'Charge', label: e.label ?? '', amount: Number(e.amount ?? 0), dueDate: e.dueDate ?? '', source: e.source ?? 'Official' })) };
      });
      const [d, p] = await Promise.all([
        sql.query(`SELECT * FROM sa_disputes WHERE tenant_id = $1 AND student_id = $2 ORDER BY number DESC`, [T, uid]) as Promise<Row[]>,
        sql.query(`SELECT * FROM sa_proposals WHERE tenant_id = $1 AND student_id = $2 ORDER BY number DESC`, [T, uid]) as Promise<Row[]>,
      ]);
      return { institution: a.institutionName, balance, statements, disputes: d.map((x) => disp(x)), proposals: p.map((x) => prop(x)) };
    }

    const a = await requireAction(context.user.id, 'accounts.read');
    const uid = a.userId, T = a.institutionId;
    switch (input.action) {
      case 'explain': {
        await one(`SELECT sa_explain($1,$2,$3,$4) AS e`, [uid, T, input.id, input.response]);
        const d = ((await sql.query(`SELECT student_id FROM sa_disputes WHERE id = $1`, [input.id])) as Row[])[0];
        if (d) await notify(uid, String(d.student_id), 'Student Accounts answered your dispute.');
        await audit(a, 'Dispute explained', `dispute:${input.id}`, '', 'Student accounts');
        break;
      }
      case 'propose': {
        const isStudent = (await zite.memberships.findAll({ filters: { institution: T }, limit: 500 })).records.some((m) => first(m.member) === input.studentId && (m.roles ?? []).includes('Student'));
        if (!isStudent) fail('That student is not at your institution.');
        await one(`SELECT sa_propose($1,$2,$3,$4,$5,$6,$7,$8) AS e`, [uid, T, input.id, input.studentId, input.kind, input.amount, input.reason, input.disputeId]);
        await audit(a, 'Account adjustment proposed', `adjustment:${input.id}`, `${input.kind} ${input.amount}`, 'Student accounts');
        break;
      }
      case 'decide': {
        await one(`SELECT sa_decide($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.approve, input.note]);
        const p = ((await sql.query(`SELECT student_id, kind FROM sa_proposals WHERE id = $1`, [input.id])) as Row[])[0];
        if (p) await notify(uid, String(p.student_id), `Your ${String(p.kind).replace('_', ' ')} was ${input.approve ? 'approved (it is posted by the billing office separately)' : 'not approved'}.`);
        await audit(a, input.approve ? 'Account item approved (not posted)' : 'Account item rejected', `proposal:${input.id}`, input.note, 'Student accounts');
        break;
      }
    }
    const [d, p] = await Promise.all([
      sql.query(`SELECT * FROM sa_disputes WHERE tenant_id = $1 AND state IN ('open','adjustment_proposed') ORDER BY number`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM sa_proposals WHERE tenant_id = $1 ORDER BY (state = 'proposed') DESC, number DESC LIMIT 100`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames([...d.map((x) => String(x.student_id)), ...p.flatMap((x) => [String(x.student_id), String(x.proposed_by)])]);
    return { me: uid, disputes: d.map((x) => disp(x, names)), proposals: p.map((x) => prop(x, names)) };
  },
});
