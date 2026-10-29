import { useState } from 'react';
import { toast } from 'sonner';
import { disputes } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Header, Panel, Chip, Loadable, useLoad, fmt, errMsg } from './ui';

type Inv = { id: string; number: number; customer: string; amountMinor: number; currency: string; status: string };
type D = { id: string; number: number; invoiceId: string; customer: string; invoiceMinor: number; currency: string; contactName: string; category: string; detail: string; disputedMinor: number; state: string; version: number; hash: string; raisedBy: string; mine: boolean; decidedBy: string; decisionNote: string; creditMinor: number; createdAt: string | null; history: { actor: string; action: string; detail: string; at: string | null }[] };
const CATS = [['amount', 'Amount is wrong'], ['service', 'Service not as agreed'], ['duplicate', 'Billed twice'], ['not_received', 'Not received'], ['other', 'Other']] as const;
const money = (minor: number, cur: string) => `${cur} ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const toMinor = (s: string) => Math.round(Number(s) * 100);

function useRun(reload: () => void) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const run = async (input: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = (await disputes({ op: 'run', commandKey: key, ...input } as never)) as { resultCode: string; message: string; replay: boolean };
      (r.resultCode === 'OK' ? toast.success : toast.error)(`${r.replay ? '(already done) ' : ''}${r.message}`);
      if (r.resultCode === 'OK') { setKey(crypto.randomUUID()); reload(); return true; }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    return false;
  };
  return { run, busy };
}

function Dispute({ d, approver, reload }: { d: D; approver: boolean; reload: () => void }) {
  const { run, busy } = useRun(reload);
  const [note, setNote] = useState(''); const [credit, setCredit] = useState(String(d.disputedMinor / 100));
  const step = (s: string, extra: Record<string, unknown> = {}) => run({ step: s, disputeId: d.id, version: d.version, seenHash: d.hash, note, ...extra });
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-medium">Dispute #{d.number} · {d.customer} · {money(d.disputedMinor, d.currency)} of {money(d.invoiceMinor, d.currency)}</p>
          <p className="text-xs text-muted-foreground">{CATS.find((c) => c[0] === d.category)?.[1]} · from {d.contactName} · recorded by {d.raisedBy} · {fmt(d.createdAt)}</p></div>
        <Chip value={d.state.replace('_', ' ')} />
      </div>
      <p className="mt-1 whitespace-pre-wrap">“{d.detail}”</p>
      {d.state !== 'open' && <p className="mt-1 text-xs">Decision{d.decidedBy ? ` by ${d.decidedBy}` : ''}: {d.decisionNote}{d.creditMinor > 0 ? ` · credit ${money(d.creditMinor, d.currency)} proposed, not posted` : ''}</p>}
      {d.state === 'open' && (
        <div className="mt-2 space-y-2">
          <Textarea aria-label="Reason the billing contact will be given" placeholder="Reason the billing contact will be given (10+ characters)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            {approver && !d.mine && <>
              <label htmlFor={`cr-${d.id}`} className="text-xs">Credit ({d.currency})</label><Input id={`cr-${d.id}`} className="h-8 w-28" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} />
              <Button size="sm" disabled={busy || note.trim().length < 10 || !(toMinor(credit) > 0)} onClick={() => step('uphold', { creditMinor: toMinor(credit) })}>Uphold with this credit</Button>
              <Button size="sm" variant="outline" disabled={busy || note.trim().length < 10} onClick={() => step('reject')}>Reject</Button>
            </>}
            {d.mine && <Button size="sm" variant="outline" disabled={busy || note.trim().length < 10} onClick={() => step('withdraw')}>Withdraw</Button>}
          </div>
          {d.mine && <p className="text-xs text-muted-foreground">You recorded this dispute, so another approver decides it.</p>}
        </div>
      )}
      {d.history.length > 0 && <details className="mt-2 text-xs"><summary>History</summary><ul>{d.history.map((h, i) => <li key={i}>{fmt(h.at)} · {h.actor} · {h.action}{h.detail ? ` · ${h.detail}` : ''}</li>)}</ul></details>}
    </div>
  );
}

export default function DisputesPage() {
  const state = useLoad(() => disputes({ op: 'list' }) as Promise<{ roles: string[]; invoices: Inv[]; disputes: D[] }>);
  const { run, busy } = useRun(state.reload);
  const [f, setF] = useState({ invoiceId: '', category: 'amount', contactName: '', detail: '', amount: '' });
  return (
    <>
      <Header eyebrow="Customers" title="Invoice disputes" sub="Record what the billing contact said; another approver decides. A credit is proposed only — no money moves and nothing is sent to the customer." />
      <Loadable state={state}>{(d) => {
        const open = d.disputes.filter((x) => x.state === 'open'), done = d.disputes.filter((x) => x.state !== 'open');
        const inv = d.invoices.find((i) => i.id === f.invoiceId);
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel title={`Open (${open.length})`}>{open.length === 0 ? <p className="text-sm text-muted-foreground">No open disputes.</p> : open.map((x) => <Dispute key={x.id} d={x} approver={d.roles.includes('approver')} reload={state.reload} />)}</Panel>
              <Panel title="Decided">{done.length === 0 ? <p className="text-sm text-muted-foreground">Nothing decided yet.</p> : done.map((x) => <Dispute key={x.id} d={x} approver={false} reload={state.reload} />)}</Panel>
            </div>
            {d.roles.includes('preparer') && <Panel title="Record a dispute">
              {d.invoices.length === 0 ? <p className="text-sm text-muted-foreground">No issued invoices to dispute.</p> : <>
                <label htmlFor="dp-i" className="text-xs">Invoice</label>
                <select id="dp-i" className="mt-1 w-full rounded-sm border border-border bg-transparent p-2 text-sm" value={f.invoiceId} onChange={(e) => setF({ ...f, invoiceId: e.target.value })}><option value="">Choose</option>{d.invoices.map((i) => <option key={i.id} value={i.id}>#{i.number} {i.customer} · {money(i.amountMinor, i.currency)} · {i.status}</option>)}</select>
                <label htmlFor="dp-c" className="mt-3 block text-xs">About</label>
                <select id="dp-c" className="mt-1 w-full rounded-sm border border-border bg-transparent p-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <label htmlFor="dp-n" className="mt-3 block text-xs">Billing contact</label><Input id="dp-n" className="mt-1" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} />
                <label htmlFor="dp-d" className="mt-3 block text-xs">What they said</label><Textarea id="dp-d" className="mt-1" value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
                <label htmlFor="dp-a" className="mt-3 block text-xs">Amount disputed{inv ? ` (${inv.currency}, up to ${(inv.amountMinor / 100).toFixed(2)})` : ''}</label><Input id="dp-a" className="mt-1" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
                <Button className="mt-3 w-full" disabled={busy || !inv || f.contactName.trim().length < 2 || f.detail.trim().length < 20 || !(toMinor(f.amount) > 0)} onClick={async () => { if (await run({ step: 'raise', invoiceId: f.invoiceId, category: f.category, contactName: f.contactName, detail: f.detail, disputedMinor: toMinor(f.amount) })) setF({ invoiceId: '', category: 'amount', contactName: '', detail: '', amount: '' }); }}>Record dispute</Button>
              </>}
            </Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
