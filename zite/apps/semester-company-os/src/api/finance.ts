import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { COMPANY_TENANT, ensureFinSchema, pg } from '../lib/fin';

export default createEndpoint({
  description: 'Lists synthetic company invoices with payments, approval snapshot and audit timeline',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    me: z.string(),
    invoices: z.array(z.object({
      id: z.string(), number: z.number(), customer: z.string(), amountMinor: z.number(), currency: z.string(), memo: z.string(),
      status: z.string(), createdBy: z.string(), approvedBy: z.string(), snapshot: z.string(), paidMinor: z.number(), updatedAt: z.string(),
    })),
    audit: z.array(z.object({ invoiceId: z.string(), action: z.string(), detail: z.string(), actor: z.string(), at: z.string() })),
    outboxDisabled: z.number(),
  }),
  execute: async ({ context }) => {
    await ensureFinSchema();
    const sql = pg();
    const grant = (await sql.query(`SELECT 1 FROM fin_roles WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL LIMIT 1`, [COMPANY_TENANT, context.user.id])) as unknown[];
    if (!grant.length) {
      const m = 'You don’t have a finance role. Ask the owner to grant preparer or approver access.';
      throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m });
    }
    const inv = (await sql.query(
      `SELECT i.*, fin_snapshot(i) AS snap, coalesce((SELECT sum(amount_minor) FROM fin_payments p WHERE p.tenant_id = i.tenant_id AND p.invoice_id = i.id), 0)::bigint AS paid
       FROM fin_invoices i WHERE tenant_id = $1 ORDER BY number DESC LIMIT 200`, [COMPANY_TENANT])) as Record<string, string | number | null>[];
    const audit = (await sql.query(`SELECT coalesce(invoice_id,'') AS invoice_id, action, detail, actor_id, created_at FROM fin_audit WHERE tenant_id = $1 ORDER BY id DESC LIMIT 300`, [COMPANY_TENANT])) as Record<string, string>[];
    const ob = (await sql.query(`SELECT count(*)::int AS n FROM fin_outbox WHERE tenant_id = $1 AND status = 'disabled'`, [COMPANY_TENANT])) as { n: number }[];
    const ids = new Set([...inv.flatMap((i) => [String(i.created_by), String(i.approved_by ?? '')]), ...audit.map((a) => a.actor_id)]);
    const names = new Map<string, string>([[context.user.id, 'You']]);
    if (ids.size) {
      const { records } = await zite.auth.findAllUsers({ limit: 200 });
      records.forEach((u) => { if (ids.has(u.id) && u.id !== context.user.id) names.set(u.id, u.name || u.email); });
    }
    const who = (id: string | number | null) => (id ? names.get(String(id)) ?? 'Unknown user' : '');
    return {
      me: context.user.id,
      invoices: inv.map((i) => ({
        id: String(i.id), number: Number(i.number), customer: String(i.customer), amountMinor: Number(i.amount_minor), currency: String(i.currency), memo: String(i.memo),
        status: String(i.status), createdBy: String(i.created_by), approvedBy: who(i.approved_by), snapshot: String(i.snap), paidMinor: Number(i.paid), updatedAt: new Date(String(i.updated_at)).toISOString(),
      })),
      audit: audit.map((a) => ({ invoiceId: a.invoice_id, action: a.action, detail: a.detail, actor: who(a.actor_id), at: new Date(a.created_at).toISOString() })),
      outboxDisabled: ob[0].n,
    };
  },
});
