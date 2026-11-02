import { useState } from 'react';
import { toast } from 'sonner';
import { accountServices } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmtDay, useLoad, Loadable, errMsg } from './kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = async (input: any, ok: string, reload: () => void) => { try { await accountServices(input); toast(ok); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
const $ = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const KIND: Record<string, string> = { credit_adjustment: 'Credit adjustment', charge_adjustment: 'Charge adjustment', refund: 'Refund' };
const STATE: Record<string, string> = { proposed: 'waiting for approval', approved_not_posted: 'approved · not yet posted', rejected: 'not approved', withdrawn: 'withdrawn', open: 'open', explained: 'answered', adjustment_proposed: 'adjustment proposed', closed: 'closed' };

/** Student side, under Tuition & payments: statements, disputes, refund requests. */
export function MyAccountServices() {
  const s = useLoad(() => accountServices({ action: 'mine' }));
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [amt, setAmt] = useState(''); const [why, setWhy] = useState('');
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="mt-4 grid gap-4">
        <Panel title="Statements">
          {!d.statements.length ? <Empty>No account activity.</Empty> : d.statements.map((t: any) => (
            <details key={t.term} className="border-t border-border py-2 text-sm first:border-0">
              <summary className="cursor-pointer">{t.term} · charges {$(t.charges)} · credits {$(t.credits)} · balance {$(t.balance)}</summary>
              <ul className="mt-2">{t.lines.map((l: any) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <span>{l.type} · {l.label}{l.dueDate && <span className="text-muted-foreground"> · due {fmtDay(l.dueDate)}</span>}</span>
                  <span className="flex items-center gap-2">{$(l.amount)}{l.type === 'Charge' && <Button size="sm" variant="ghost" onClick={() => { setOpen(l.id); setReason(''); }}>Dispute</Button>}</span>
                  {open === l.id && <div className="w-full space-y-2">
                    <Textarea aria-label="What looks wrong" rows={2} placeholder="What looks wrong with this charge (20+ characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button size="sm" disabled={reason.trim().length < 20} onClick={async () => { if (await run({ action: 'dispute', id: crypto.randomUUID(), entryId: l.id, reason }, 'Dispute sent to Student Accounts.', s.reload)) setOpen(null); }}>Send dispute</Button>
                  </div>}
                </li>))}</ul>
              <p className="text-xs text-muted-foreground">From the official ledger, read-only.</p>
            </details>))}
        </Panel>
        {(d.disputes.length > 0 || d.proposals.length > 0) && <Panel title="Your disputes and requests">
          {d.disputes.map((x: any) => <div key={x.id} className="border-t border-border py-2 text-sm first:border-0"><p><Status value={STATE[x.state]} /> Dispute: {x.entryLabel} ({$(x.entryAmount)})</p>{x.response && <p className="mt-1 text-muted-foreground">{x.response}</p>}</div>)}
          {d.proposals.map((x: any) => <div key={x.id} className="border-t border-border py-2 text-sm first:border-0"><p><Status value={STATE[x.state]} /> {KIND[x.kind]} · {$(x.amount)}</p>{x.decisionNote && <p className="mt-1 text-muted-foreground">{x.decisionNote}</p>}</div>)}
        </Panel>}
        {d.balance < 0 && <Panel title="Request a refund">
          <p className="text-sm">You have a credit balance of {$(-d.balance)}.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input aria-label="Amount" type="number" className="max-w-[9rem]" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <Input aria-label="Reason" className="max-w-sm" placeholder="Reason" value={why} onChange={(e) => setWhy(e.target.value)} />
            <Button size="sm" disabled={!Number(amt) || why.trim().length < 10} onClick={() => run({ action: 'requestRefund', id: crypto.randomUUID(), amount: Number(amt), reason: why }, 'Refund requested.', () => { setAmt(''); setWhy(''); s.reload(); })}>Request</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Approved refunds are paid by the billing office; Semester never moves money.</p>
        </Panel>}
      </div>)}
    </Loadable>
  );
}

function Dispute({ x, reload }: { x: any; reload: () => void }) {
  const [resp, setResp] = useState(''); const [amt, setAmt] = useState(String(x.entryAmount));
  return (
    <div className="border-t border-border py-3 text-sm first:border-0">
      <p><Status value={STATE[x.state]} /> #{x.number} · {x.student} · {x.entryLabel} ({$(x.entryAmount)})</p>
      <p className="mt-1 text-muted-foreground">{x.reason}</p>
      {x.state === 'open' && <div className="mt-2 space-y-2">
        <Textarea aria-label="Response" rows={2} placeholder="Explanation to the student, or reason for the adjustment" value={resp} onChange={(e) => setResp(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={resp.trim().length < 20} onClick={() => run({ action: 'explain', id: x.id, response: resp }, 'Answered.', reload)}>Explain and close</Button>
          <Input aria-label="Credit amount" type="number" className="max-w-[8rem]" value={amt} onChange={(e) => setAmt(e.target.value)} />
          <Button size="sm" disabled={resp.trim().length < 10 || !Number(amt)} onClick={() => run({ action: 'propose', id: crypto.randomUUID(), studentId: x.studentId, kind: 'credit_adjustment', amount: Number(amt), reason: resp, disputeId: x.id }, 'Credit proposed. A second staff member must approve it.', reload)}>Propose credit</Button>
        </div>
      </div>}
    </div>
  );
}

function Decide({ p, me, reload }: { p: any; me: string; reload: () => void }) {
  const [note, setNote] = useState('');
  if (p.state !== 'proposed') return null;
  if (p.proposerId === me || p.studentId === me) return <p className="mt-1 text-xs text-muted-foreground">A second staff member decides this.</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Input aria-label="Note" className="max-w-sm" placeholder="Note the student will see" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button size="sm" disabled={note.trim().length < 5} onClick={() => run({ action: 'decide', id: p.id, approve: true, note }, 'Approved. Posting happens in the billing system.', reload)}>Approve</Button>
      <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => run({ action: 'decide', id: p.id, approve: false, note }, 'Not approved.', reload)}>Reject</Button>
    </div>
  );
}

/** Staff side, on the Student accounts page: disputes and the second-person approval queue. */
export function AccountServicesStaff() {
  const s = useLoad(() => accountServices({ action: 'staff' }));
  return (
    <Loadable state={s}>{(d: any) => (
      <div className="mt-4 grid gap-4">
        <Panel title={`Disputes · ${d.disputes.length}`}>{!d.disputes.length ? <Empty>No open disputes.</Empty> : d.disputes.map((x: any) => <Dispute key={x.id} x={x} reload={s.reload} />)}</Panel>
        <Panel title="Adjustments and refunds">
          {!d.proposals.length ? <Empty>Nothing proposed.</Empty> : d.proposals.map((p: any) => (
            <div key={p.id} className="border-t border-border py-3 text-sm first:border-0">
              <p><Status value={STATE[p.state]} /> #{p.number} · {KIND[p.kind]} · {$(p.amount)} · {p.student} · proposed by {p.proposedBy}</p>
              <p className="mt-1 text-muted-foreground">{p.reason}</p>
              <Decide p={p} me={d.me} reload={s.reload} />
            </div>))}
          <p className="mt-2 text-xs text-muted-foreground">Approval records the decision only. Posting to the ledger and paying refunds stay off until the billing integration is activated.</p>
        </Panel>
      </div>)}
    </Loadable>
  );
}
