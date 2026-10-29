import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { officeService } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Label } from '@project/components/ui/label';
import { Checkbox } from '@project/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { PageHeader, Panel, Empty, Status, fmt, useLoad, Loadable, errMsg } from '../components/kit';
import { osvSteps, OSV_LABEL, OSV_OUTCOMES, OsvStep, OsvState } from '../lib/officeRules';

type Office = { id: number; name: string; description: string; hours: string; active: boolean; staff: boolean; lead: boolean };
type Msg = { id: number; author: string; body: string; internal: boolean; at: string | null };
type Req = { id: number; reference: string; officeId: number; office: string; title: string; details: string; state: OsvState; version: number; requesterId: string; requester: string; assigneeId: string | null; assignee: string | null; outcome: string | null; resolution: string; resolvedAt: string | null; reopenCount: number; createdAt: string | null; mine: boolean; staff: boolean; lead: boolean; messages: Msg[] };
type Member = { officeId: number; userId: string; name: string; lead: boolean };
type Data = { me: string; isAdmin: boolean; offices: Office[]; requests: Req[]; team: Member[]; staffAdmin: Member[] };

const key = () => crypto.randomUUID();
const STEP_LABEL: Record<OsvStep, string> = { claim: 'Take it', assign: 'Assign', ask: 'Ask the student', reply: 'Reply', note: 'Internal note', refer: 'Refer to another office', resolve: 'Resolve', confirm: 'Yes, it’s resolved', reopen: 'Reopen', withdraw: 'Withdraw' };
const NEEDS_NOTE: OsvStep[] = ['ask', 'reply', 'note', 'refer', 'resolve', 'reopen'];

function RequestCard({ r, d, reload }: { r: Req; d: Data; reload: () => Promise<void> }) {
  const [step, setStep] = useState<OsvStep | null>(null);
  const [note, setNote] = useState(''); const [outcome, setOutcome] = useState('answered'); const [target, setTarget] = useState(''); const [office, setOffice] = useState('');
  const steps = osvSteps({ state: r.state, requesterId: r.requesterId, assigneeId: r.assigneeId, reopenCount: r.reopenCount, resolvedAt: r.resolvedAt }, { me: d.me, staff: r.staff, lead: r.lead });
  const run = async (s: OsvStep) => {
    try {
      await officeService({ action: 'step', id: r.id, step: s, expectedVersion: r.version, note, outcome: s === 'resolve' ? outcome : undefined, assigneeId: s === 'assign' ? target : undefined, officeId: s === 'refer' ? Number(office) : undefined });
      toast.success('Saved'); setStep(null); setNote(''); await reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const go = (s: OsvStep) => (NEEDS_NOTE.includes(s) || s === 'assign' ? setStep(s) : run(s));
  const ready = step === 'assign' ? !!target : step === 'refer' ? !!office && note.trim().length >= 10 : step === 'resolve' || step === 'reopen' ? note.trim().length >= 10 : step === 'ask' ? note.trim().length >= 5 : note.trim().length >= 1;
  return (
    <div className="border-b border-border py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground"><span className="font-mono">{r.reference}</span> · {r.office}{r.staff && !r.mine ? ` · from ${r.requester}` : ''}{r.assignee ? ` · handled by ${r.assignee}` : ''} · {fmt(r.createdAt)}</p></div>
        <Status value={r.mine ? OSV_LABEL[r.state] : r.state.replace(/_/g, ' ')} />
      </div>
      {r.details && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.details}</p>}
      {r.messages.length > 0 && <ul className="mt-2 space-y-1 border-l border-border pl-3">{r.messages.map((m) => <li key={m.id} className="text-xs"><span className="font-medium">{m.author}{m.internal ? ' · internal note (staff only)' : ''}</span> · {fmt(m.at)}<p className="whitespace-pre-wrap text-sm">{m.body}</p></li>)}</ul>}
      {(r.state === 'resolved' || r.state === 'closed') && r.resolution && <p className="mt-2 text-xs"><span className="font-medium">Resolution ({OSV_OUTCOMES.find((o) => o[0] === r.outcome)?.[1] ?? r.outcome}):</span> {r.resolution}</p>}
      {steps.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{steps.map((s) => <Button key={s} size="sm" variant={s === 'claim' || s === 'resolve' || s === 'confirm' ? 'default' : 'outline'} onClick={() => go(s)}>{STEP_LABEL[s]}</Button>)}</div>}
      {step && (
        <div className="mt-2 space-y-2 rounded-sm border border-border p-3">
          {step === 'assign' && <div><Label htmlFor={`as-${r.id}`}>Assign to</Label><Select value={target} onValueChange={setTarget}><SelectTrigger id={`as-${r.id}`} className="mt-1"><SelectValue placeholder="Choose staff" /></SelectTrigger><SelectContent>{d.team.filter((t) => t.officeId === r.officeId && t.userId !== r.requesterId).map((t) => <SelectItem key={t.userId} value={t.userId}>{t.name}</SelectItem>)}</SelectContent></Select></div>}
          {step === 'refer' && <div><Label htmlFor={`rf-${r.id}`}>Office</Label><Select value={office} onValueChange={setOffice}><SelectTrigger id={`rf-${r.id}`} className="mt-1"><SelectValue placeholder="Choose an office" /></SelectTrigger><SelectContent>{d.offices.filter((o) => o.active && o.id !== r.officeId).map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent></Select></div>}
          {step === 'resolve' && <div><Label htmlFor={`oc-${r.id}`}>Outcome</Label><Select value={outcome} onValueChange={setOutcome}><SelectTrigger id={`oc-${r.id}`} className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{OSV_OUTCOMES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>}
          {step !== 'assign' && <div><Label htmlFor={`nt-${r.id}`}>{step === 'note' ? 'Note (staff only)' : step === 'resolve' ? 'What was done (the student sees this)' : step === 'refer' ? 'Why it belongs there (the student sees this)' : step === 'reopen' ? 'What is still wrong' : 'Message'}</Label><Textarea id={`nt-${r.id}`} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} /></div>}
          <div className="flex gap-2"><Button size="sm" disabled={!ready} onClick={() => run(step)}>{STEP_LABEL[step]}</Button><Button size="sm" variant="ghost" onClick={() => setStep(null)}>Cancel</Button></div>
        </div>
      )}
    </div>
  );
}

function Setup({ d, reload }: { d: Data; reload: () => Promise<void> }) {
  const [o, setO] = useState({ name: '', description: '', hours: '' });
  const [s, setS] = useState({ officeId: '', email: '', lead: false });
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); await reload(); return true; } catch (e) { toast.error(errMsg(e)); return false; } };
  return (
    <Panel title="Office setup (administrators)">
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label htmlFor="of-n">Office name</Label><Input id="of-n" className="mt-1" value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} /></div>
        <div><Label htmlFor="of-h">Hours</Label><Input id="of-h" className="mt-1" value={o.hours} onChange={(e) => setO({ ...o, hours: e.target.value })} placeholder="Mon–Fri 9–4" /></div>
        <div><Label htmlFor="of-d">What it handles</Label><Input id="of-d" className="mt-1" value={o.description} onChange={(e) => setO({ ...o, description: e.target.value })} /></div>
      </div>
      <Button size="sm" className="mt-2" disabled={o.name.trim().length < 2} onClick={async () => { if (await act(() => officeService({ action: 'office', id: null, active: true, ...o }), 'Office created')) setO({ name: '', description: '', hours: '' }); }}>Add office</Button>
      {d.offices.length > 0 && <ul className="mt-4 space-y-2 text-sm">{d.offices.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
          <span><span className="font-medium">{x.name}</span>{!x.active && ' · not taking requests'}<span className="block text-xs text-muted-foreground">Staff: {d.staffAdmin.filter((m) => m.officeId === x.id).map((m) => m.name + (m.lead ? ' (lead)' : '')).join(', ') || 'none yet'}</span></span>
          <Button size="sm" variant="outline" onClick={() => act(() => officeService({ action: 'office', id: x.id, name: x.name, description: x.description, hours: x.hours, active: !x.active }), x.active ? 'Office paused' : 'Office reopened')}>{x.active ? 'Pause requests' : 'Reopen'}</Button>
        </li>))}</ul>}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div><Label htmlFor="st-o">Office</Label><Select value={s.officeId} onValueChange={(v) => setS({ ...s, officeId: v })}><SelectTrigger id="st-o" className="mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{d.offices.map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="st-e">Staff email</Label><Input id="st-e" className="mt-1" type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></div>
        <div className="flex items-end gap-2 pb-2"><Checkbox id="st-l" checked={s.lead} onCheckedChange={(v) => setS({ ...s, lead: v === true })} /><Label htmlFor="st-l">Office lead (assigns, retires articles)</Label></div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={!s.officeId || !s.email.includes('@')} onClick={() => act(() => officeService({ action: 'setStaff', officeId: Number(s.officeId), email: s.email, lead: s.lead, active: true }), 'Staff appointed')}>Appoint</Button>
        <Button size="sm" variant="outline" disabled={!s.officeId || !s.email.includes('@')} onClick={() => act(() => officeService({ action: 'setStaff', officeId: Number(s.officeId), email: s.email, lead: false, active: false }), 'Appointment revoked')}>Revoke</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">You cannot appoint yourself. A revoked appointment stops working on the next request.</p>
    </Panel>
  );
}

export default function Offices() {
  const state = useLoad(() => officeService({ action: 'get' }) as Promise<Data>);
  const [f, setF] = useState({ officeId: '', title: '', details: '', requestKey: key() });
  const send = async () => {
    try { await officeService({ action: 'open', officeId: Number(f.officeId), title: f.title, details: f.details, requestKey: f.requestKey }); toast.success('Sent. You can follow it here.'); setF({ officeId: f.officeId, title: '', details: '', requestKey: key() }); await state.reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageHeader eyebrow="Help" title="Offices & requests" sub="Send a request to the office that owns it and follow it to a resolution." actions={<Link to="/help/knowledge" className="text-sm underline">Search answers first</Link>} />
      <Loadable state={state}>{(d: Data) => {
        const queues = d.offices.filter((o) => o.staff);
        const mine = d.requests.filter((r) => r.mine);
        const open = d.offices.filter((o) => o.active);
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {queues.map((o) => {
                const q = d.requests.filter((r) => r.officeId === o.id && !r.mine && r.state !== 'closed' && r.state !== 'withdrawn');
                return <Panel key={o.id} title={`${o.name} queue${o.lead ? ' · you lead this office' : ''}`}>{q.length === 0 ? <Empty>✓ Nothing waiting.</Empty> : q.map((r) => <RequestCard key={r.id} r={r} d={d} reload={state.reload} />)}</Panel>;
              })}
              <Panel title="Your requests">{mine.length === 0 ? <Empty>No requests yet.</Empty> : mine.map((r) => <RequestCard key={r.id} r={r} d={d} reload={state.reload} />)}</Panel>
              {d.isAdmin && <Setup d={d} reload={state.reload} />}
            </div>
            <div className="space-y-4">
              <Panel title="Ask an office">
                {open.length === 0 ? <Empty>No offices are taking requests yet. Your institution’s administrators set them up.</Empty> : <>
                  <Label htmlFor="rq-o">Office</Label>
                  <Select value={f.officeId} onValueChange={(v) => setF({ ...f, officeId: v })}><SelectTrigger id="rq-o" className="mt-1"><SelectValue placeholder="Choose an office" /></SelectTrigger><SelectContent>{open.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}</SelectContent></Select>
                  {(() => { const o = open.find((x) => String(x.id) === f.officeId); return o && (o.description || o.hours) ? <p className="mt-1 text-xs text-muted-foreground">{o.description}{o.description && o.hours ? ' · ' : ''}{o.hours}</p> : null; })()}
                  <Label htmlFor="rq-t" className="mt-3 block">What do you need?</Label><Input id="rq-t" className="mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
                  <Label htmlFor="rq-d" className="mt-3 block">Details (optional)</Label><Textarea id="rq-d" className="mt-1" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
                  <Button className="mt-3 w-full" disabled={!f.officeId || f.title.trim().length < 5} onClick={send}>Send request</Button>
                  <p className="mt-2 text-xs text-muted-foreground">Only that office’s staff see it. Don’t include passwords or card numbers.</p>
                </>}
              </Panel>
            </div>
          </div>
        );
      }}</Loadable>
    </>
  );
}
