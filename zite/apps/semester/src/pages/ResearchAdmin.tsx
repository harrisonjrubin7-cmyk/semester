import { useState } from 'react';
import { toast } from 'sonner';
import { researchAdmin } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { money } from '../lib/procureRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const cents = (s: string) => Math.round(Number(s || 0) * 100);
const KIND: Record<string, string> = { internal: 'Internal', external: 'External', collaboration: 'Collaboration' };

function useAct(reload: () => void) {
  return async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function RequestCard({ r, d, reload }: { r: any; d: any; reload: () => void }) {
  const act = useAct(reload);
  const [dec, setDec] = useState({ note: '', code: '' });
  const open = ['submitted', 'under_review'].includes(r.state);
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{r.title} <span className="text-xs font-normal text-muted-foreground">· {KIND[r.kind]}{r.org ? ` · from ${r.org}` : ''} · {r.requester}{r.amountCents ? ` · ${money(r.amountCents)} requested` : ''}</span></p>
        <Status value={r.state} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
      {r.projectCode && <p className="mt-1 text-xs">Project code <span className="font-mono">{r.projectCode}</span></p>}
      {r.decisionNote && <p className="mt-1 text-xs text-muted-foreground">{r.state === 'declined' ? 'Declined' : 'Note'}: {r.decisionNote}{r.decidedBy ? ` — ${r.decidedBy}` : ''}</p>}
      {d.isRsaAdmin && open && <div className="mt-2 flex flex-wrap items-center gap-2">
        {r.state === 'submitted' && <Button size="sm" variant="outline" onClick={() => act(() => researchAdmin({ action: 'review', id: r.id }), 'Request under review.')}>Start review</Button>}
        <Input aria-label="Project code" placeholder="Project code (to approve)" className="w-44" value={dec.code} onChange={(e) => setDec({ ...dec, code: e.target.value.toUpperCase() })} />
        <Input aria-label="Decision note" placeholder="Note (required to decline)" className="max-w-xs flex-1" value={dec.note} onChange={(e) => setDec({ ...dec, note: e.target.value })} />
        <Button size="sm" disabled={dec.code.trim().length < 3} onClick={() => act(() => researchAdmin({ action: 'decide', id: r.id, approve: true, note: dec.note, code: dec.code }), 'Approved and registered.')}>Approve</Button>
        <Button size="sm" variant="outline" disabled={dec.note.trim().length < 5} onClick={() => act(() => researchAdmin({ action: 'decide', id: r.id, approve: false, note: dec.note, code: '' }), 'Request declined.')}>Decline</Button>
      </div>}
      {d.isRsaAdmin && r.state === 'approved' && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => act(() => researchAdmin({ action: 'close', id: r.id }), 'Project closed.')}>Close project</Button></div>}
    </li>
  );
}

export default function ResearchAdmin() {
  const s = useLoad(() => researchAdmin({ action: 'get' }));
  const act = useAct(s.reload);
  const [f, setF] = useState({ title: '', summary: '', kind: 'internal', amount: '' });
  const [st, setSt] = useState({ email: '', on: true });
  return (
    <>
      <PageHeader eyebrow="Operations" title="Research administration" sub="Research requests and the project registry. Approval registers the project under its code; partner organizations send collaboration requests through their agreement." />
      <Loadable state={s}>{(d: any) => (
        <div className="space-y-4">
          <Panel title="Request research support">
            <div className="grid gap-2 sm:grid-cols-3">
              <Input aria-label="Title" placeholder="Working title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <select aria-label="Kind" className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <Input aria-label="Amount requested in dollars" type="number" min={0} step={0.01} placeholder="Amount requested ($, optional)" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
            </div>
            <Textarea className="mt-2" rows={3} aria-label="Summary" placeholder="What the research is, who it serves, and what support you need (at least a sentence or two)." value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
            <div className="mt-2"><Button size="sm" disabled={f.title.trim().length < 5 || f.summary.trim().length < 20} onClick={async () => { if (await act(() => researchAdmin({ action: 'submit', title: f.title, summary: f.summary, kind: f.kind as never, amountCents: cents(f.amount) }), 'Request submitted.')) setF({ title: '', summary: '', kind: 'internal', amount: '' }); }}>Submit request</Button></div>
          </Panel>
          <Panel title={d.isRsaAdmin ? 'All requests' : 'Your requests'}>{d.requests.length ? <ul className="space-y-2">{d.requests.map((r: any) => <RequestCard key={r.id} r={r} d={d} reload={s.reload} />)}</ul> : <Empty>No requests yet.</Empty>}</Panel>
          {d.isAdmin && <Panel title="Research administrators">
            <p className="text-xs">{d.admins.map((m: any) => m.name).join(', ') || 'No research administrators yet.'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input aria-label="Administrator email" placeholder="Email" className="max-w-xs" value={st.email} onChange={(e) => setSt({ ...st, email: e.target.value })} />
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={async () => { if (await act(() => researchAdmin({ action: 'setStaff', email: st.email, on: true }), 'Research administrator granted.')) setSt({ email: '', on: true }); }}>Grant</Button>
              <Button size="sm" variant="outline" disabled={!st.email.includes('@')} onClick={() => act(() => researchAdmin({ action: 'setStaff', email: st.email, on: false }), 'Research administrator removed.')}>Remove</Button>
            </div>
          </Panel>}
        </div>
      )}</Loadable>
    </>
  );
}
