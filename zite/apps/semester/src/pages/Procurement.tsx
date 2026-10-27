import { useState } from 'react';
import { toast } from 'sonner';
import { procurement } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { money } from '../lib/procureRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const cents = (s: string) => Math.round(Number(s || 0) * 100);

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Req({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const has = (x: string) => d.roles.includes(x);
  const [note, setNote] = useState('');
  const [bid, setBid] = useState({ supplier: '', amount: '', reference: '' });
  const [pick, setPick] = useState('');
  const [rc, setRc] = useState({ amount: '', note: '' });
  const [inv, setInv] = useState({ no: '', amount: '' });
  const [iv, setIv] = useState<Record<number, string>>({});
  const big = d.rules && r.amount >= d.rules.bidThreshold;
  return (
    <li className="rounded border border-border p-3 text-sm">
      <p className="font-medium">{r.description} <span className="text-xs font-normal text-muted-foreground">· {r.supplier} · {money(r.amount)} · budget {r.budget}</span></p>
      <p className="text-xs"><Status value={r.state} /> requested by {r.requester}{r.approver1 ? ` · approved by ${r.approver1}` : ''}{r.approver2 ? ` and ${r.approver2}` : ''}{r.needsTwo ? ' · needs two approvers' : ''}</p>
      {r.split && <p className="text-xs">⚠ Possible threshold split: {r.splitNote}</p>}
      {r.decisionNote && <p className="text-xs">Note: {r.decisionNote}</p>}
      {has('approver') && r.state === 'submitted' && !r.mine && !r.approver1IsMe && <div className="mt-1 flex flex-wrap gap-2">
        <Input aria-label="Decision note" placeholder="Note (needed to reject)" className="h-8 max-w-sm" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" onClick={() => act(() => procurement({ action: 'decide', reqId: r.id, approve: true, note, expectedVersion: r.version }), 'Approved.')}>{r.needsTwo && !r.approver1 ? 'First approval' : 'Approve'}</Button>
        <Button size="sm" variant="outline" disabled={note.trim().length < 5} onClick={() => act(() => procurement({ action: 'decide', reqId: r.id, approve: false, note, expectedVersion: r.version }), 'Rejected.')}>Reject</Button></div>}
      {r.state === 'approved' && has('buyer') && <div className="mt-2 space-y-1">
        {r.bids.length > 0 && <ul className="text-xs">{r.bids.map((b: any) => <li key={b.id}><label className="flex items-center gap-1"><input type="radio" name={`bid-${r.id}`} checked={pick === String(b.id)} onChange={() => setPick(String(b.id))} />{b.supplier} · {money(b.amount)}{b.reference ? ` · ${b.reference}` : ''}</label></li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Bidder" placeholder="Bidder" className="h-8 max-w-[12rem]" value={bid.supplier} onChange={(e) => setBid({ ...bid, supplier: e.target.value })} />
          <Input aria-label="Bid amount" type="number" min={0} step={0.01} placeholder="Amount ($)" className="h-8 w-32" value={bid.amount} onChange={(e) => setBid({ ...bid, amount: e.target.value })} />
          <Input aria-label="Quote reference" placeholder="Quote reference" className="h-8 max-w-[10rem]" value={bid.reference} onChange={(e) => setBid({ ...bid, reference: e.target.value })} />
          <Button size="sm" variant="outline" disabled={bid.supplier.length < 2 || !bid.amount} onClick={async () => { if (await act(() => procurement({ action: 'bid', reqId: r.id, supplier: bid.supplier, amount: cents(bid.amount), reference: bid.reference }), 'Bid recorded.')) setBid({ supplier: '', amount: '', reference: '' }); }}>Record bid</Button>
          {!r.mine && <Button size="sm" disabled={big && !pick} onClick={() => act(() => procurement({ action: 'po', reqId: r.id, bidId: pick ? Number(pick) : null, expectedVersion: r.version }), 'Purchase order issued.')}>Issue purchase order</Button>}
        </div>
        {big && <p className="text-xs text-muted-foreground">At this amount the order needs bids from at least two suppliers.</p>}
      </div>}
      {r.po && <div className="mt-2 rounded border border-border p-2 text-xs">
        <p>PO #{r.po.id} · {r.po.supplier} · {money(r.po.amount)} · received {money(r.po.received)} · <Status value={r.po.state} /> · buyer {r.po.issuedBy}</p>
        {r.po.invoices.map((i: any) => <div key={i.id} className="mt-1 flex flex-wrap items-center gap-2">
          <span>Invoice {i.no} · {money(i.amount)} · <Status value={i.state} />{i.reason ? ` — ${i.reason}` : ''}{i.decidedBy ? ` · ${i.decidedBy}: ${i.note}` : ''}{i.postingRef ? ` · posted ${i.postingRef}` : ''}</span>
          {i.state === 'exception' && has('approver') && !r.po.issuedByMe && !i.enteredByMe && <>
            <Input aria-label="Exception note" placeholder="Reason" className="h-7 w-48" value={iv[i.id] ?? ''} onChange={(e) => setIv({ ...iv, [i.id]: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => act(() => procurement({ action: 'invoiceStep', invoiceId: i.id, step: 'accept', note: iv[i.id] ?? '' }), 'Accepted.')}>Accept</Button>
            <Button size="sm" variant="ghost" onClick={() => act(() => procurement({ action: 'invoiceStep', invoiceId: i.id, step: 'dispute', note: iv[i.id] ?? '' }), 'Disputed.')}>Dispute</Button></>}
          {['matched', 'accepted'].includes(i.state) && has('buyer') && <Button size="sm" variant="outline" onClick={() => act(() => procurement({ action: 'invoiceStep', invoiceId: i.id, step: 'handoff' }), 'Handed to finance.')}>Authorize finance handoff</Button>}
          {i.state === 'handed_off' && has('finance') && <><Input aria-label="Posting reference" placeholder="Finance reference" className="h-7 w-40" value={iv[i.id] ?? ''} onChange={(e) => setIv({ ...iv, [i.id]: e.target.value })} />
            <Button size="sm" variant="outline" onClick={() => act(() => procurement({ action: 'invoiceStep', invoiceId: i.id, step: 'posted', note: iv[i.id] ?? '' }), 'Posted.')}>Record posting</Button></>}
        </div>)}
        {r.po.state === 'issued' && <div className="mt-2 flex flex-wrap gap-2">
          {has('receiver') && !r.po.issuedByMe && <><Input aria-label="Received amount" type="number" step={0.01} placeholder="Received $ (negative = return)" className="h-8 w-52" value={rc.amount} onChange={(e) => setRc({ ...rc, amount: e.target.value })} />
            <Input aria-label="Receipt note" placeholder="Note (needed for returns)" className="h-8 max-w-[12rem]" value={rc.note} onChange={(e) => setRc({ ...rc, note: e.target.value })} />
            <Button size="sm" variant="outline" disabled={!rc.amount || Number(rc.amount) === 0} onClick={async () => { if (await act(() => procurement({ action: 'receive', poId: r.po.id, amount: cents(rc.amount), note: rc.note }), 'Recorded.')) setRc({ amount: '', note: '' }); }}>Record receipt</Button></>}
          {(has('buyer') || has('finance')) && <><Input aria-label="Invoice number" placeholder="Invoice number" className="h-8 w-36" value={inv.no} onChange={(e) => setInv({ ...inv, no: e.target.value })} />
            <Input aria-label="Invoice amount" type="number" min={0} step={0.01} placeholder="Amount ($)" className="h-8 w-32" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} />
            <Button size="sm" variant="outline" disabled={!inv.no || !inv.amount} onClick={async () => { if (await act(() => procurement({ action: 'invoice', poId: r.po.id, invoiceNo: inv.no, amount: cents(inv.amount) }), 'Invoice entered and matched.')) setInv({ no: '', amount: '' }); }}>Enter invoice</Button></>}
          {has('buyer') && <Button size="sm" variant="ghost" onClick={() => act(() => procurement({ action: 'closePo', poId: r.po.id }), 'Closed; unused commitment released.')}>Close order</Button>}
        </div>}
      </div>}
    </li>
  );
}

export default function Procurement() {
  const s = useLoad(() => procurement({ action: 'get' }));
  const act = useAct(s.reload);
  const [q, setQ] = useState({ budget: '', supplier: '', description: '', amount: '', key: crypto.randomUUID() });
  const [ru, setRu] = useState({ a: '5000', b: '10000', d: '30', t: '5' });
  const [bg, setBg] = useState({ code: '', name: '', amount: '' });
  const [st, setSt] = useState({ email: '', role: 'buyer' });
  return (
    <>
      <PageHeader eyebrow="Operations" title="Procurement" sub="Request, approve, order, receive and match. Payment is finance's: matched invoices are handed over, never paid from here." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Request a purchase">
            {!d.rules ? <Empty>Purchasing rules are not set up yet.</Empty> : <div className="grid gap-2 text-sm sm:grid-cols-4">
              <select aria-label="Budget" className={sel} value={q.budget} onChange={(e) => setQ({ ...q, budget: e.target.value })}><option value="">Budget…</option>{d.budgets.map((b: any) => <option key={b.code} value={b.code}>{b.code} {b.name}</option>)}</select>
              <Input aria-label="Supplier" placeholder="Supplier" value={q.supplier} onChange={(e) => setQ({ ...q, supplier: e.target.value })} />
              <Input aria-label="What" placeholder="What you need" value={q.description} onChange={(e) => setQ({ ...q, description: e.target.value })} />
              <Input aria-label="Amount" type="number" min={0} step={0.01} placeholder="Amount ($)" value={q.amount} onChange={(e) => setQ({ ...q, amount: e.target.value })} />
              <div><Button size="sm" disabled={!q.budget || q.supplier.length < 2 || q.description.length < 5 || !q.amount} onClick={async () => { if (await act(() => procurement({ action: 'submit', budget: q.budget, supplier: q.supplier, description: q.description, amount: cents(q.amount), requestKey: q.key }), 'Submitted for approval.')) setQ({ budget: '', supplier: '', description: '', amount: '', key: crypto.randomUUID() }); }}>Submit</Button></div>
            </div>}
          </Panel>
          <Panel title={d.staff ? 'Requisitions' : 'Your requests'}>{d.requisitions.length ? <ul className="space-y-2">{d.requisitions.map((r: any) => <Req key={r.id} r={r} d={d} reload={s.reload} />)}</ul> : <Empty>Nothing yet.</Empty>}</Panel>
          {d.staff && <Panel title="Budgets">{d.budgets.length ? <ul className="text-xs">{d.budgets.map((b: any) => <li key={b.code}><b>{b.code}</b> {b.name}: {money(b.amount)} · committed or spent {money(b.used)} · remaining {money(b.amount - b.used)}</li>)}</ul> : <Empty>No budgets.</Empty>}</Panel>}
          {d.isAdmin && <Panel title="Rules, budgets and roles">
            <div className="grid gap-2 text-sm sm:grid-cols-5">
              <label className="text-xs">Two approvers from ($)<Input type="number" value={ru.a} onChange={(e) => setRu({ ...ru, a: e.target.value })} /></label>
              <label className="text-xs">Two bids from ($)<Input type="number" value={ru.b} onChange={(e) => setRu({ ...ru, b: e.target.value })} /></label>
              <label className="text-xs">Split window (days)<Input type="number" value={ru.d} onChange={(e) => setRu({ ...ru, d: e.target.value })} /></label>
              <label className="text-xs">Match tolerance (%)<Input type="number" value={ru.t} onChange={(e) => setRu({ ...ru, t: e.target.value })} /></label>
              <div className="self-end"><Button size="sm" variant="outline" onClick={() => act(() => procurement({ action: 'rules', approvalThreshold: cents(ru.a), bidThreshold: cents(ru.b), splitDays: Number(ru.d), tolerancePct: Number(ru.t) }), 'Rules saved.')}>Save rules</Button></div>
            </div>
            {d.rules && <p className="mt-1 text-xs text-muted-foreground">Current: two approvers from {money(d.rules.approvalThreshold)}, two bids from {money(d.rules.bidThreshold)}, split window {d.rules.splitDays} days, tolerance {d.rules.tolerancePct}%.</p>}
            <div className="mt-2 flex flex-wrap gap-2"><Input aria-label="Budget code" placeholder="Budget code" className="w-32" value={bg.code} onChange={(e) => setBg({ ...bg, code: e.target.value.toUpperCase() })} />
              <Input aria-label="Budget name" placeholder="Name" className="max-w-xs" value={bg.name} onChange={(e) => setBg({ ...bg, name: e.target.value })} />
              <Input aria-label="Budget amount" type="number" placeholder="Amount ($)" className="w-36" value={bg.amount} onChange={(e) => setBg({ ...bg, amount: e.target.value })} />
              <Button size="sm" variant="outline" disabled={bg.code.length < 2 || bg.name.length < 2 || !bg.amount} onClick={async () => { if (await act(() => procurement({ action: 'budget', code: bg.code, name: bg.name, amount: cents(bg.amount) }), 'Budget saved.')) setBg({ code: '', name: '', amount: '' }); }}>Save budget</Button></div>
            <p className="mt-3 text-xs">{d.team.map((t: any) => `${t.name} (${t.role})`).join(', ') || 'No procurement roles yet.'}</p>
            <div className="mt-1 flex flex-wrap gap-2"><Input aria-label="Member email" placeholder="Member email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <select aria-label="Role" className={sel} value={st.role} onChange={(e) => setSt({ ...st, role: e.target.value })}>{['buyer', 'approver', 'receiver', 'finance'].map((r) => <option key={r}>{r}</option>)}</select>
              <Button size="sm" disabled={!st.email.includes('@')} onClick={() => act(() => procurement({ action: 'setStaff', email: st.email, role: st.role as never, on: true }), 'Granted.')}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => procurement({ action: 'setStaff', email: st.email, role: st.role as never, on: false }), 'Revoked.')}>Revoke</Button></div>
          </Panel>}
        </div>)}
      </Loadable>
    </>
  );
}
