import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { COMPANY_TENANT, ensureFinSchema, pg, sha256 } from '../lib/fin';
import { DSP_MIGRATION } from '../lib/dspMigration';

let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureFinSchema(); const sql = pg(); for (const s of DSP_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); return ready; };

// Invoice disputes (Billing Contact): a finance preparer records the contact's dispute; another approver decides; credits are
// proposed only (never posted). Roles come from fin_roles on the server.
export default createEndpoint({
  description: 'Invoice disputes: record a billing contact dispute, decide it with a second person; credits are proposed, never posted',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('run'), commandKey: z.string().min(8).max(80), step: z.enum(['raise', 'reject', 'uphold', 'withdraw']), disputeId: z.string().optional(), version: z.number().int().optional(),
      invoiceId: z.string().optional(), category: z.enum(['amount', 'service', 'duplicate', 'not_received', 'other']).optional(), contactName: z.string().max(120).optional(),
      detail: z.string().max(4000).optional(), disputedMinor: z.number().int().min(1).max(1_000_000_000).optional(), creditMinor: z.number().int().min(0).max(1_000_000_000).optional(),
      seenHash: z.string().max(64).optional(), note: z.string().max(2000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const roles = ((await sql.query(`SELECT role FROM fin_roles WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [COMPANY_TENANT, me])) as { role: string }[]).map((r) => r.role);
    if (!roles.length) { const m = 'Disputes need a finance role (preparer or approver).'; throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); }
    if (input.op === 'run') {
      const { commandKey, step, disputeId, ...p } = input;
      if (step !== 'raise' && !disputeId) throw new ZiteError('Choose a dispute.');
      const hash = await sha256(JSON.stringify({ step, disputeId, ...p }));
      const r = ((await sql.query(`SELECT dsp_cmd($1,$2,$3,$4,$5,$6,$7::jsonb) AS r`, [COMPANY_TENANT, me, commandKey, hash, step, disputeId ?? null, JSON.stringify(p)])) as { r: { id: string | null; resultCode: string; message: string; replay?: boolean } }[])[0].r;
      return { id: r.id ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
    }
    const [disputes, invoices, ev, { records: users }] = await Promise.all([
      sql.query(`SELECT d.*, dsp_hash(d) AS hash, i.customer, i.amount_minor, i.currency FROM dsp_disputes d JOIN fin_invoices i ON i.tenant_id = d.tenant_id AND i.id = d.invoice_id WHERE d.tenant_id = $1 ORDER BY d.number DESC LIMIT 200`, [COMPANY_TENANT]) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT id, number, customer, amount_minor, currency, status FROM fin_invoices WHERE tenant_id = $1 AND status IN ('Approved','Paid','Mismatch') ORDER BY number DESC LIMIT 200`, [COMPANY_TENANT]) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT e.dispute_id, e.actor_id, e.action, e.detail, e.at FROM dsp_events e JOIN dsp_disputes d ON d.id = e.dispute_id WHERE d.tenant_id = $1 ORDER BY e.id DESC LIMIT 1000`, [COMPANY_TENANT]) as Promise<Record<string, unknown>[]>,
      zite.auth.findAllUsers({ limit: 200 }),
    ]);
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      me, roles,
      invoices: invoices.map((i) => ({ id: String(i.id), number: Number(i.number), customer: String(i.customer), amountMinor: Number(i.amount_minor), currency: String(i.currency), status: String(i.status) })),
      disputes: disputes.map((d) => ({
        id: String(d.id), number: Number(d.number), invoiceId: String(d.invoice_id), customer: String(d.customer), invoiceMinor: Number(d.amount_minor), currency: String(d.currency),
        contactName: String(d.contact_name), category: String(d.category), detail: String(d.detail), disputedMinor: Number(d.disputed_minor), state: String(d.state), version: Number(d.version), hash: String(d.hash),
        raisedBy: name(d.raised_by), mine: String(d.raised_by) === me, decidedBy: name(d.decided_by), decisionNote: String(d.decision_note), creditMinor: Number(d.credit_minor), createdAt: iso(d.created_at),
        history: ev.filter((e) => e.dispute_id === d.id).reverse().map((e) => ({ actor: name(e.actor_id), action: String(e.action), detail: String(e.detail), at: iso(e.at) })),
      })),
    };
  },
});
