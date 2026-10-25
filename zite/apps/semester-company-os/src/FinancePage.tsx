import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { finance, financeCommand, FinanceOutputType, FinanceCommandInputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Header, Panel, Figure, Chip, Loadable, useLoad, fmt, errMsg } from './ui';
import InvoiceDetail from './InvoiceDetail';

export type Inv = FinanceOutputType['invoices'][0];
export const money = (minor: number, cur: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(minor / 100);

/** Runs a command with a key fixed per user intent, so a retry or double-click replays instead of duplicating. */
export async function run(input: Omit<FinanceCommandInputType, 'commandKey'>, key: string) {
  try {
    const r = await financeCommand({ ...input, commandKey: key });
    (r.resultCode === 'OK' ? toast.success : toast.error)(`${r.replay ? '(already done) ' : ''}${r.message}`);
    return r.resultCode === 'OK';
  } catch (e) { toast.error(errMsg(e)); return false; }
}

function NewInvoice({ contracts, onDone }: { contracts: FinanceOutputType['contracts']; onDone: () => void }) {
  const blank = { contractId: '', amount: '', currency: 'USD', memo: '' };
  const [f, setF] = useState(blank);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const amt = Math.round(Number(f.amount) * 100);
  const valid = f.contractId && amt > 0 && /^[A-Z]{3}$/.test(f.currency);
  const go = async () => {
    setBusy(true);
    if (await run({ action: 'create', contractId: f.contractId, amountMinor: amt, currency: f.currency, memo: f.memo }, key)) { setF(blank); setKey(crypto.randomUUID()); onDone(); }
    setBusy(false);
  };
  return (
    <Panel title="New draft invoice (synthetic)">
      {contracts.length === 0 ? <p className="text-sm text-muted-foreground">No active contracts. Invoices are raised against an active CRM contract; the customer comes from its account.</p> : (
      <form className="grid gap-2 sm:grid-cols-[2fr_1fr_80px_2fr_auto]" onSubmit={(e) => { e.preventDefault(); if (valid) go(); }}>
        <Select value={f.contractId} onValueChange={(v) => setF({ ...f, contractId: v })}>
          <SelectTrigger aria-label="Contract"><SelectValue placeholder="Active contract" /></SelectTrigger>
          <SelectContent>{contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}{c.account ? ` · ${c.account}` : ''}</SelectItem>)}</SelectContent>
        </Select>
        <Input aria-label="Amount" inputMode="decimal" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input aria-label="Currency" maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
        <Input aria-label="Memo" placeholder="Memo" value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} />
        <Button type="submit" disabled={!valid || busy}>Create draft</Button>
      </form>)}
    </Panel>
  );
}

export default function FinancePage() {
  const s = useLoad(() => finance({}));
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <Header eyebrow="Company finance · synthetic" title="Invoices & approvals" sub="Draft → approval by a second person → recorded payment → reconciliation. Every step is one transaction in the controlled Postgres backend, with a receipt and audit entry. No money moves and no notices are sent." />
      <Loadable state={s}>{(d) => <Body d={d} q={q} setQ={setQ} status={status} setStatus={setStatus} open={open} setOpen={setOpen} reload={s.reload} />}</Loadable>
    </div>
  );
}

function Body({ d, q, setQ, status, setStatus, open, setOpen, reload }: { d: FinanceOutputType; q: string; setQ: (v: string) => void; status: string; setStatus: (v: string) => void; open: string | null; setOpen: (v: string | null) => void; reload: () => void }) {
  const STAT = ['All', 'Draft', 'Pending approval', 'Approved', 'Mismatch', 'Paid', 'Rejected'];
  const rows = useMemo(() => d.invoices.filter((i) => (status === 'All' || i.status === status) && `${i.number} ${i.customer} ${i.memo}`.toLowerCase().includes(q.toLowerCase())), [d, q, status]);
  const sel = d.invoices.find((i) => i.id === open);
  const waiting = d.invoices.filter((i) => i.status === 'Pending approval' && i.createdBy !== d.me).length;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Figure label="Awaiting your approval" value={waiting} />
        <Figure label="Mismatched" value={d.invoices.filter((i) => i.status === 'Mismatch').length} />
        <Figure label="Reconciled" value={d.invoices.filter((i) => i.status === 'Paid').length} note={`${d.invoices.filter((i) => i.entitled).length} with entitlement`} />
        <Figure label="Notices held" value={d.outboxDisabled} note="Outbound sending is disabled" />
      </div>
      <NewInvoice contracts={d.contracts} onDone={reload} />
      <Panel title="Queue">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Search number, customer, memo" value={q} onChange={(e) => setQ(e.target.value)} />
          <div role="tablist" className="flex flex-wrap gap-1">{STAT.map((s) => <Button key={s} role="tab" aria-selected={status === s} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>{s}</Button>)}</div>
        </div>
        {rows.length ? (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">#</th><th>Customer</th><th className="text-right">Amount</th><th className="pl-3">Status</th><th className="hidden sm:table-cell">Updated</th></tr></thead>
            <tbody>{rows.map((i) => (
              <tr key={i.id} tabIndex={0} onClick={() => setOpen(i.id)} onKeyDown={(e) => e.key === 'Enter' && setOpen(i.id)} className="cursor-pointer border-t border-border hover:bg-muted/50 focus:bg-muted/50 focus:outline-none">
                <td className="py-2 font-mono text-xs">INV-{i.number}</td><td>{i.customer}<span className="block text-xs text-muted-foreground">{i.contractTitle}{i.entitled ? ' · Entitlement active' : ''}</span></td><td className="text-right tabular-nums">{money(i.amountMinor, i.currency)}</td>
                <td className="pl-3"><Chip value={i.status} /></td><td className="hidden text-xs text-muted-foreground sm:table-cell">{fmt(i.updatedAt)}</td>
              </tr>))}</tbody></table>
        ) : <p className="py-6 text-center text-sm text-muted-foreground">{d.invoices.length ? 'No invoices match.' : 'No invoices yet — create a synthetic draft above.'}</p>}
      </Panel>
      {sel && <InvoiceDetail inv={sel} me={d.me} audit={d.audit.filter((a) => a.invoiceId === sel.id)} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}
