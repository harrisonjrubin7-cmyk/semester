import { useState } from 'react';
import { toast } from 'sonner';
import { studentAccount } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Loadable, useLoad, Status, fmtDay, errMsg } from './kit';
import { ConfirmAction } from './overlays';

export const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

type Plan = { id: string; student: string; term: string; amount: number; installments: number; reason: string; status: string; decidedBy: string; decisionNote: string; requestedAt: string };
type Bal = { studentId: string; student: string; balance: number; entries: number };

/** Staff side: decide payment plan requests and see official balances. Nobody decides their own request. */
export function PaymentPlansPanel() {
  const s = useLoad(() => studentAccount({ action: 'staff' }));
  const [note, setNote] = useState('');
  const decide = async (id: string, approve: boolean) => {
    try { await studentAccount({ action: 'decidePlan', planId: id, approve, note }); toast(approve ? 'Plan approved. The student sees it now.' : 'Plan declined. The student sees your note.'); setNote(''); s.reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <Loadable state={s}>{(d: { plans: Plan[]; balances: Bal[] }) => (
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Payment plan requests">
          {d.plans.length ? <ul className="divide-y divide-border text-sm">{d.plans.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{p.student} · {p.term}</span><Status value={p.status} /></div>
              <p className="mt-1 text-muted-foreground">{money(p.amount)} in {p.installments} installments of {money(p.amount / p.installments)} · requested {fmtDay(p.requestedAt)}</p>
              <p className="mt-1">“{p.reason}”</p>
              {p.decisionNote && <p className="mt-1 text-xs text-muted-foreground">{p.decidedBy}: {p.decisionNote}</p>}
              {p.status === 'Requested' && <div className="mt-2 flex gap-2">
                {[true, false].map((ok) => (
                  <ConfirmAction key={String(ok)} trigger={<Button size="sm" variant={ok ? 'default' : 'outline'}>{ok ? 'Approve' : 'Decline'}</Button>} title={`${ok ? 'Approve' : 'Decline'} ${p.student}’s plan?`} confirmLabel={ok ? 'Approve plan' : 'Decline plan'} onConfirm={() => decide(p.id, ok)}>
                    <p className="text-sm text-muted-foreground">The student sees this decision and your note. Set up the schedule itself in your finance system; Semester doesn’t collect payments.</p>
                    <Textarea rows={2} placeholder="Note to the student (required)" value={note} onChange={(e) => setNote(e.target.value)} />
                  </ConfirmAction>))}
              </div>}
            </li>))}</ul> : <Empty>No payment plan requests.</Empty>}
        </Panel>
        <Panel title="Official balances">
          {d.balances.length ? <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Student</th><th className="text-right">Balance</th></tr></thead>
            <tbody>{d.balances.map((b) => <tr key={b.studentId} className="border-t border-border"><td className="py-2">{b.student}</td><td className={`text-right tabular-nums ${b.balance > 0 ? 'font-medium' : 'text-muted-foreground'}`}>{money(b.balance)}</td></tr>)}</tbody></table>
            : <Empty>No balances imported yet. They arrive from your finance system.</Empty>}
        </Panel>
      </div>
    )}</Loadable>
  );
}
