import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { approvalBlocker, commercialChanges, deleteBlocker, type HistoryEntry } from '../lib/companyRules';

const first = (v: unknown): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : typeof v === 'string' && v ? v : null;

const ALL_GATES = [
  'Scope signed off', 'Tenant configured', 'SSO validated', 'Integrations validated',
  'Security evidence reviewed', 'Accessibility evidence reviewed', 'Training complete', 'Institution acceptance',
];

// Only these fields may be written through this endpoint, per table.
const FIELDS: Record<string, string[]> = {
  accounts: ['legalName', 'segment', 'lifecycleStage', 'owner', 'website', 'notes', 'isSample'],
  deals: ['name', 'account', 'stage', 'amountMinor', 'currency', 'nextStep', 'closeDate', 'owner', 'isSample'],
  contracts: ['title', 'account', 'deal', 'state', 'startsOn', 'endsOn', 'annualValueMinor', 'signedDocumentLink', 'obligations', 'isSample'],
  projects: ['name', 'account', 'contract', 'state', 'gatesPassed', 'targetLaunch', 'owner', 'gateEvidence', 'isSample'],
  tickets: ['subject', 'account', 'severity', 'state', 'assignee', 'safeDescription', 'isSample'],
};

const client = {
  accounts: zite.customerAccounts,
  deals: zite.deals,
  contracts: zite.contracts,
  projects: zite.implementationProjects,
  tickets: zite.supportTickets,
} as const;

type Table = keyof typeof client;

export default createEndpoint({
  description: 'Creates, updates, approves or deletes Company OS records, enforcing lifecycle rules and writing an audit entry',
  authenticated: true,
  inputSchema: z.object({
    table: z.enum(['accounts', 'deals', 'contracts', 'projects', 'tickets']),
    op: z.enum(['create', 'update', 'delete', 'approveDeal']),
    id: z.string().optional(),
    values: z.record(z.string(), z.any()).optional(),
  }),
  outputSchema: z.object({ id: z.string(), notes: z.array(z.string()) }),
  execute: async ({ input, context }) => {
    const table = input.table as Table;
    const me = context.user.id;
    const notes: string[] = [];
    // Single audit log: company actions go to auditEvents (institution: null, authority 'Semester company').
    // companyAuditLog is read-only legacy history, still read so approvals started before the merge keep their trail.
    const audit = (action: string, targetTable: string, targetId: string, detail: string) =>
      zite.auditEvents.create({ record: { action, actor: me, institution: null, recordRef: `${targetTable}:${targetId}`, authority: 'Semester company', viaAssistant: false, details: detail } as never });

    const fail = (msg: string): never => { throw new Error(msg); };
    const dealHistory = async (id: string): Promise<HistoryEntry[]> => {
      const [cur, legacy] = await Promise.all([
        zite.auditEvents.findAll({ filters: { recordRef: `deals:${id}` }, limit: 500 }),
        zite.companyAuditLog.findAll({ filters: { targetTable: 'deals', targetId: id }, limit: 500 }),
      ]);
      return [
        ...legacy.records.map((r) => ({ actor: first(r.actor) ?? '', action: String(r.action ?? ''), detail: String(r.detail ?? '') })),
        ...cur.records.map((r) => ({ actor: first(r.actor) ?? '', action: String(r.action ?? ''), detail: String(r.details ?? '') })),
      ];
    };

    if (input.op === 'delete') {
      if (!input.id) fail('Missing record id.');
      const rec = await (client[table] as typeof zite.deals).findOne({ id: input.id! }) as Record<string, unknown> | undefined;
      if (!rec) fail('Record not found.');
      let linked = 0;
      if (table === 'accounts') {
        const [d, c, p] = await Promise.all([
          zite.deals.findAll({ filters: { account: input.id! }, limit: 1 }),
          zite.contracts.findAll({ filters: { account: input.id! }, limit: 1 }),
          zite.implementationProjects.findAll({ filters: { account: input.id! }, limit: 1 }),
        ]);
        linked = d.records.length + c.records.length + p.records.length;
      }
      const blocker = deleteBlocker(table, rec!, linked);
      if (blocker) fail(blocker);
      await (client[table] as typeof zite.deals).delete({ id: input.id! });
      await audit('deleted', table, input.id!, '');
      return { id: input.id!, notes };
    }

    if (input.op === 'approveDeal') {
      const deal = input.id ? await zite.deals.findOne({ id: input.id }) : undefined;
      if (!deal) fail('Deal not found.');
      if (deal!.stage !== 'Commercial Approval') fail('Only deals in Commercial Approval can be approved.');
      if (deal!.approvedAt) fail('This deal is already approved.');
      const blocker = approvalBlocker(first(deal!.owner), me, await dealHistory(deal!.id));
      if (blocker) fail(blocker);
      await zite.deals.update({ id: deal!.id, record: { approvedBy: me, approvedAt: new Date().toISOString() } });
      await audit('approved', 'deals', deal!.id, `Commercial approval for ${deal!.name ?? ''}`);
      return { id: deal!.id, notes: ['Deal approved. It can now be marked Won.'] };
    }

    // create / update: whitelist fields
    const raw = input.values ?? {};
    const values: Record<string, unknown> = {};
    for (const k of FIELDS[table]) if (k in raw) values[k] = raw[k] === '' ? null : raw[k];

    const existing = input.op === 'update'
      ? await (client[table] as typeof zite.deals).findOne({ id: input.id ?? fail('Missing record id.') }) as Record<string, unknown> | undefined
      : undefined;
    if (input.op === 'update' && !existing) fail('Record not found.');
    const merged = { ...(existing ?? {}), ...values } as Record<string, unknown>;

    // ---- Lifecycle rules ----
    // An approval covers the terms that were approved. Changing them voids it; a won deal's terms are fixed.
    if (table === 'deals' && input.op === 'update' && existing) {
      const changes = commercialChanges(existing, values);
      if (changes.length && existing.stage === 'Won') fail(`A won deal’s terms can’t change (${changes.join(', ')}).`);
      if (changes.length && existing.approvedAt) {
        values.approvedBy = null; values.approvedAt = null;
        notes.push(`Commercial approval was cleared because ${changes.join(', ')} changed. It needs approving again.`);
      }
    }
    if (table === 'deals' && values.stage === 'Won' && existing?.stage !== 'Won') {
      const approvedAt = 'approvedAt' in values ? values.approvedAt : existing?.approvedAt; // a voided approval does not count
      if (!approvedAt) fail('A deal needs commercial approval before it can be marked Won.');
      if (!first(merged.account)) fail('Link the deal to an account before marking it Won.');
    }
    if (table === 'contracts' && values.state === 'Active' && existing?.state !== 'Active') {
      if (!merged.signedDocumentLink) fail('Add the signed document link before activating a contract.');
      if (!merged.startsOn) fail('Set a start date before activating a contract.');
      if (!first(merged.account)) fail('Link the contract to an account before activating it.');
    }
    if (table === 'projects' && values.state === 'Activated' && existing?.state !== 'Activated') {
      const gates = (merged.gatesPassed as string[] | undefined) ?? [];
      const missing = ALL_GATES.filter((g) => !gates.includes(g));
      if (missing.length) fail(`Cohort activation is blocked. Missing gates: ${missing.join(', ')}.`);
      const contractId = first(merged.contract);
      const contract = contractId ? await zite.contracts.findOne({ id: contractId }) : undefined;
      if (contract?.state !== 'Active') fail('Activation requires a linked, Active contract.');
    }
    if (table === 'tickets') {
      if (input.op === 'create') values.openedAt = new Date().toISOString();
      if (values.state && ['Resolved', 'Closed'].includes(values.state as string) && !existing?.resolvedAt)
        values.resolvedAt = new Date().toISOString();
    }

    let id: string;
    if (input.op === 'create') {
      const rec = await (client[table] as typeof zite.deals).create({ record: values as never });
      id = rec.id;
    } else {
      id = input.id!;
      await (client[table] as typeof zite.deals).update({ id, record: values as never });
    }
    const changed = Object.keys(values).join(', ');
    await audit(input.op === 'create' ? 'created' : 'updated', table, id, changed);

    // ---- Linked lifecycle side effects ----
    if (table === 'deals' && values.stage === 'Won' && existing?.stage !== 'Won') {
      const already = await zite.contracts.findAll({ filters: { deal: id }, limit: 1 });
      if (!already.records.length) {
        const c = await zite.contracts.create({ record: {
          title: `${merged.name ?? 'Deal'} agreement`, account: first(merged.account), deal: id, state: 'Draft',
          annualValueMinor: (merged.amountMinor as number) ?? null, isSample: !!merged.isSample,
        } });
        await audit('created', 'contracts', c.id, 'Draft contract created from won deal');
        notes.push('A draft contract was created for this deal.');
      }
    }
    if (table === 'contracts' && values.state === 'Active' && existing?.state !== 'Active') {
      const acct = first(merged.account)!;
      await zite.customerAccounts.update({ id: acct, record: { lifecycleStage: 'Customer' } });
      const already = await zite.implementationProjects.findAll({ filters: { contract: id }, limit: 1 });
      if (!already.records.length) {
        const p = await zite.implementationProjects.create({ record: {
          name: `${merged.title ?? 'Contract'} implementation`, account: acct, contract: id, state: 'Kickoff',
          owner: me, isSample: !!merged.isSample,
        } });
        await audit('created', 'projects', p.id, 'Implementation project created from active contract');
        notes.push('The account is now a Customer and an implementation project was opened.');
      }
    }
    return { id, notes };
  },
});
