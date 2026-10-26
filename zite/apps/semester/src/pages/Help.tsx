import { useState } from 'react';
import { toast } from 'sonner';
import { help, approvals } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import Caseload from '../components/Caseload';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';

type Case = { id: string; title: string; category: string; status: string; reference: string; student?: string; notes?: string };
type Appr = { id: string; title: string; status: string; reason: string; requestedBy: string; requestedById: string; approver: string };

function StaffQueue({ isStaff, reloadAll }: { isStaff: boolean; reloadAll: () => void }) {
  const state = useLoad(() => approvals({ action: 'list' }));
  if (!isStaff) return null;
  const decide = async (id: string, approve: boolean) => { try { await approvals({ action: 'decide', id, approve }); toast.success(approve ? 'Approved' : 'Rejected'); state.reload(); reloadAll(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Panel title="Approval queue">
      <Loadable state={state}>{(d) => {
        const pending = d.items.filter((x: Appr) => x.status === 'Pending Approval');
        return pending.length === 0 ? <Empty>✓ No pending requests.</Empty> : <div className="space-y-3">{pending.map((x: Appr) => (
          <div key={x.id} className="border-b border-border pb-3 text-sm last:border-0">
            <p className="font-medium">{x.title}</p><p className="text-xs text-muted-foreground">Requested by {x.requestedById === d.me ? 'you' : x.requestedBy} · {x.reason}</p>
            {x.requestedById === d.me ? <p className="mt-1 text-xs">… Needs a second person. You can’t approve your own request.</p> :
              <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => decide(x.id, false)}>Reject</Button><Button size="sm" onClick={() => decide(x.id, true)}>Approve</Button></div>}
          </div>))}</div>;
      }}</Loadable>
    </Panel>
  );
}

export default function Help() {
  const state = useLoad(() => help({ action: 'get' }));
  const [title, setTitle] = useState(''); const [notes, setNotes] = useState('');
  const act = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); await state.reload(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <>
      <PageHeader eyebrow="Help" title="Who can help?" sub="Book advising and tutoring, and track requests with the office that owns them." />
      <Loadable state={state}>{(d) => (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {d.holds.map((h: { id: string; title: string; office: string }) => (
              <Panel key={h.id}><p className="font-medium">! {h.title}</p><p className="text-sm text-muted-foreground">Owned by {h.office}</p><p className="mt-1 text-xs text-muted-foreground">Only that office can release it. Book an advising slot below to resolve it.</p></Panel>))}
            <Panel title="Book a slot">
              {d.slots.length === 0 ? <Empty>No open slots right now.</Empty> : <div className="grid gap-2 sm:grid-cols-2">{d.slots.map((s: { id: string; label: string; startsAt: string | null }) => (
                <button key={s.id} onClick={() => act(() => help({ action: 'book', id: s.id }), 'Booked. It’s on your calendar.')} className="rounded-sm border border-border p-3 text-left font-sans text-sm transition-colors hover:border-primary hover:bg-accent">
                  <p className="font-medium">{s.label}</p><p className="text-xs text-muted-foreground">{fmt(s.startsAt)}</p></button>))}</div>}
            </Panel>
            {d.isStaff && <Caseload cases={d.caseload} team={d.team} reload={state.reload} />}
            <StaffQueue isStaff={d.isStaff} reloadAll={state.reload} />
          </div>
          <div className="space-y-4">
            <Panel title="Your appointments">
              {d.booked.length === 0 ? <Empty>None booked.</Empty> : d.booked.map((b: { id: string; label: string; startsAt: string | null }) => (
                <div key={b.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"><span>{b.label}<span className="block text-xs text-muted-foreground">{fmt(b.startsAt)}</span></span><Button size="sm" variant="ghost" onClick={() => act(() => help({ action: 'cancel', id: b.id }))}>Cancel</Button></div>))}
            </Panel>
            <Panel title="Your requests">
              {d.cases.length === 0 ? <Empty>No requests yet.</Empty> : d.cases.map((c: Case) => (
                <div key={c.id} className="border-b border-border py-2 text-sm last:border-0"><p>{c.title}</p><p className="flex justify-between text-xs"><span className="font-mono text-muted-foreground">{c.reference}</span><Status value={c.status} /></p></div>))}
            </Panel>
            <Panel title="Ask for support">
              <Input placeholder="What do you need?" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea className="mt-2" placeholder="Details (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button className="mt-2 w-full" disabled={title.trim().length < 3} onClick={() => act(() => help({ action: 'request', title, notes }), 'Request sent to Student Services').then(() => { setTitle(''); setNotes(''); })}>Send to Student Services</Button>
              <p className="mt-2 text-xs text-muted-foreground">In-app message · Mon–Fri 8–5</p>
            </Panel>
          </div>
        </div>
      )}</Loadable>
    </>
  );
}
