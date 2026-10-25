import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { COMPANY_TENANT, ensureFinSchema, pg, sha256 } from '../lib/fin';

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) || '';

export default createEndpoint({
  description: 'Runs one synthetic finance command (create, submit, approve, reject, record payment, reconcile) atomically',
  authenticated: true,
  inputSchema: z.object({
    commandKey: z.string().min(8).max(80),
    action: z.enum(['create', 'submit', 'approve', 'reject', 'payment', 'reconcile']),
    invoiceId: z.string().optional(),
    contractId: z.string().optional(),
    amountMinor: z.number().int().optional(),
    currency: z.string().length(3).optional(),
    memo: z.string().max(300).optional(),
    snapshot: z.string().optional(),
    reference: z.string().max(80).optional(),
  }),
  outputSchema: z.object({ invoiceId: z.string(), resultCode: z.string(), message: z.string(), replay: z.boolean() }),
  execute: async ({ input, context }) => {
    const { commandKey, action, invoiceId, contractId, ...rest } = input;
    const p: Record<string, unknown> = { ...rest };
    if (action === 'create') {
      if (!contractId || !rest.amountMinor || rest.amountMinor <= 0 || !rest.currency) throw new ZiteError('A contract, a positive amount and currency are required.');
      // Customer comes from the CRM contract and its account, never from free text.
      const contract = await zite.contracts.findOne({ id: contractId }).catch(() => null);
      if (!contract) throw new ZiteError('That contract no longer exists.');
      if (contract.state !== 'Active') throw new ZiteError('Invoices can only be raised against an active contract.');
      const accountId = one(contract.account);
      const account = accountId ? await zite.customerAccounts.findOne({ id: accountId }).catch(() => null) : null;
      if (!account?.legalName) throw new ZiteError('This contract has no customer account. Link one in the CRM first.');
      Object.assign(p, { contractId, accountId, customer: account.legalName });
    }
    if (action === 'payment' && (!rest.amountMinor || rest.amountMinor <= 0 || !rest.reference?.trim())) throw new ZiteError('Payment amount and reference are required.');
    if (action !== 'create' && !invoiceId) throw new ZiteError('Choose an invoice.');
    await ensureFinSchema();
    const hash = await sha256(JSON.stringify({ action, invoiceId, ...p }));
    const rows = (await pg().query(`SELECT fin_cmd($1,$2,$3,$4,$5,$6,$7::jsonb) AS r`,
      [COMPANY_TENANT, commandKey, hash, context.user.id, action, invoiceId ?? null, JSON.stringify(p)])) as { r: { invoiceId: string | null; resultCode: string; message: string; replay?: boolean } }[];
    const r = rows[0].r;
    return { invoiceId: r.invoiceId ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
  },
});
