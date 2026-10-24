import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { COMPANY_TENANT, ensureFinSchema, pg, sha256 } from '../lib/fin';

export default createEndpoint({
  description: 'Runs one synthetic finance command (create, submit, approve, reject, record payment, reconcile) atomically',
  authenticated: true,
  inputSchema: z.object({
    commandKey: z.string().min(8).max(80),
    action: z.enum(['create', 'submit', 'approve', 'reject', 'payment', 'reconcile']),
    invoiceId: z.string().optional(),
    customer: z.string().max(120).optional(),
    amountMinor: z.number().int().optional(),
    currency: z.string().length(3).optional(),
    memo: z.string().max(300).optional(),
    snapshot: z.string().optional(),
    reference: z.string().max(80).optional(),
  }),
  outputSchema: z.object({ invoiceId: z.string(), resultCode: z.string(), message: z.string(), replay: z.boolean() }),
  execute: async ({ input, context }) => {
    const { commandKey, action, invoiceId, ...p } = input;
    if (action === 'create' && (!p.customer?.trim() || !p.amountMinor || p.amountMinor <= 0 || !p.currency)) throw new ZiteError('Customer, a positive amount and currency are required.');
    if (action === 'payment' && (!p.amountMinor || p.amountMinor <= 0 || !p.reference?.trim())) throw new ZiteError('Payment amount and reference are required.');
    if (action !== 'create' && !invoiceId) throw new ZiteError('Choose an invoice.');
    await ensureFinSchema();
    const hash = await sha256(JSON.stringify({ action, invoiceId, ...p }));
    const rows = (await pg().query(`SELECT fin_cmd($1,$2,$3,$4,$5,$6,$7::jsonb) AS r`,
      [COMPANY_TENANT, commandKey, hash, context.user.id, action, invoiceId ?? null, JSON.stringify(p)])) as { r: { invoiceId: string | null; resultCode: string; message: string; replay?: boolean } }[];
    const r = rows[0].r;
    return { invoiceId: r.invoiceId ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
  },
});
