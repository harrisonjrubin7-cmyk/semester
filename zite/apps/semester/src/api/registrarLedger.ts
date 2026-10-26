import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAction } from '../lib/server';
import { pg, ensureSchema, dispatchOutbox } from '../lib/pg';

export default createEndpoint({
  description: 'Shows the registrar ledger (receipts and outbox) and optionally retries pending updates',
  authenticated: true,
  inputSchema: z.object({ reconcile: z.boolean().optional() }),
  outputSchema: z.object({
    dispatched: z.number(), failed: z.number(), pending: z.number(),
    receipts: z.array(z.object({ commandKey: z.string(), state: z.string(), resultCode: z.string(), createdAt: z.string(), outbox: z.string(), lastError: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'registrar.read');
    await ensureSchema();
    const run = input.reconcile ? await dispatchOutbox(a.institutionId) : { dispatched: 0, failed: 0 };
    const sql = pg();
    const rows = (await sql.query(
      `SELECT r.command_key, r.state, r.result_code, r.created_at, o.status, coalesce(o.last_error, '') AS last_error
       FROM reg_receipts r LEFT JOIN reg_outbox o ON o.tenant_id = r.tenant_id AND o.command_key = r.command_key
       WHERE r.tenant_id = $1 ORDER BY r.created_at DESC LIMIT 25`, [a.institutionId])) as Record<string, string>[];
    const p = (await sql.query(`SELECT count(*)::int AS n FROM reg_outbox WHERE tenant_id = $1 AND status = 'pending'`, [a.institutionId])) as { n: number }[];
    return {
      ...run, pending: p[0].n,
      receipts: rows.map((r) => ({ commandKey: r.command_key, state: r.state, resultCode: r.result_code, createdAt: new Date(r.created_at).toISOString(), outbox: r.status ?? 'none', lastError: r.last_error })),
    };
  },
});
