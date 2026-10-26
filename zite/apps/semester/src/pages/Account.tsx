import { useState } from 'react';
import { toast } from 'sonner';
import { studentAccount } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, SourceTag, fmtDay, errMsg } from '../components/kit';
import { ConfirmAction } from '../components/overlays';
import { money } from '../components/PaymentPlans';

type Term = { term: string; balance: number; nextDue: string };
type Entry = { id: string; type: string; label: string; amount: number; term: string; dueDate: string; source: string };
type Plan = { id: string; term: string; amount: number; installments: number; status: string; decisionNote: string; requestedAt: string };
type Data = { institution: string; balance: number; terms: Term[]; entries: Entry[]; plans: Plan[] };

function PlanRequest({ terms, onDone }: { terms: Term[]; onDone: () => void }) {
  const due = terms.filter((t) => t.balance > 0);
  const [term, setTerm] = useState(due[0]?.term ?? '');
  const [n, setN] = useState('3');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!due.length) return null;
  const amt = due.find((t) => t.term === term)?.balance ?? 0;
  const send = async () => {
    setBusy(true);
    try { await studentAccount({ action: 'requestPlan', term, installments: Number(n), reason }); toast('Request sent to Student Accounts.'); setReason(''); onDone(); }
    catch (e) { toast(`! ${errMsg(e)}`); } finally { setBusy(false); }
  };
  return (
    <Panel title="Ask for a payment plan">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="pp-term">Term</Label><Select value={term} onValueChange={setTerm}><SelectTrigger id="pp-term" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{due.map((t) => <SelectItem key={t.term} value={t.term}>{t.term} · {money(t.balance)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="pp-n">Installments</Label><Select value={n} onValueChange={setN}><SelectTrigger id="pp-n" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{['2', '3', '4', '5', '6'].map((x) => <SelectItem key={x} value={x}>{x} × {money(amt / Number(x))}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label htmlFor="pp-why">Why a plan helps</Label><Textarea id="pp-why" className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A sentence or two for the office" /></div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">The office decides. Semester never takes payments. Pay through your school’s payment site.</p>
      <Button className="mt-3" onClick={send} disabled={busy || reason.trim().length < 10}>{busy ? 'Sending…' : 'Send request'}</Button>
    </Panel>
  );
}

export default function Account() {
  const s = useLoad(() => studentAccount({ action: 'mine' }));
  const withdraw = async (id: string) => { try { await studentAccount({ action: 'withdrawPlan', planId: id }); toast('Request withdrawn.'); s.reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <>
      <PageHeader eyebrow="You" title="Tuition & payments" sub="Your balance comes from your school’s finance office. Semester shows it and never moves money." />
      <Loadable state={s}>{(d: Data) => (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Panel>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Balance due</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums">{money(d.balance)}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">{d.terms.map((t) => <span key={t.term}>{t.term}: <b className="tabular-nums">{money(t.balance)}</b>{t.nextDue && t.balance > 0 ? ` · due ${fmtDay(t.nextDue)}` : ''}</span>)}</div>
            </Panel>
            <Panel title="Activity">
              {d.entries.length ? <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Item</th><th>Term</th><th>Due</th><th className="text-right">Amount</th></tr></thead>
                <tbody>{d.entries.map((e) => <tr key={e.id} className="border-t border-border"><td className="py-2">{e.label || e.type} <SourceTag source={e.source} /></td><td>{e.term}</td><td>{e.dueDate ? fmtDay(e.dueDate) : '—'}</td><td className={`text-right tabular-nums ${e.type === 'Charge' ? '' : 'text-muted-foreground'}`}>{e.type === 'Charge' ? '' : '−'}{money(e.amount)}</td></tr>)}</tbody></table>
                : <Empty>Nothing on your account yet.</Empty>}
            </Panel>
          </div>
          <div className="space-y-4">
            <PlanRequest terms={d.terms} onDone={s.reload} />
            <Panel title="Your plan requests">
              {d.plans.length ? <ul className="divide-y divide-border text-sm">{d.plans.map((p) => (
                <li key={p.id} className="py-2">
                  <div className="flex items-center justify-between"><span>{p.term} · {p.installments} × {money(p.amount / p.installments)}</span><Status value={p.status} /></div>
                  {p.decisionNote && <p className="mt-1 text-xs text-muted-foreground">Office: {p.decisionNote}</p>}
                  {p.status === 'Requested' && <ConfirmAction trigger={<Button size="sm" variant="ghost" className="mt-1 px-0">Withdraw</Button>} title="Withdraw this request?" confirmLabel="Withdraw" onConfirm={() => withdraw(p.id)}><p className="text-sm text-muted-foreground">You can send a new request afterwards.</p></ConfirmAction>}
                </li>))}</ul> : <Empty>No requests yet.</Empty>}
            </Panel>
          </div>
        </div>
      )}</Loadable>
    </>
  );
}
