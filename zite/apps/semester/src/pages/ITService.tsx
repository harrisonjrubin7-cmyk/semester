import { useState } from 'react';
import { toast } from 'sonner';
import { itService } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';
const key = () => `it-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const KIND: Record<string, string> = { request: 'Request', incident: 'Something is broken', security_incident: 'Security concern' };
const STATE: Record<string, string> = { open: 'Open — waiting for IT', assigned: 'Being worked on', fulfilled: 'Done — please check', closed: 'Closed', cancelled: 'Cancelled' };
const TLABEL: Record<string, string> = { assign: 'Assign', fulfill: 'Mark done', review: 'Record problem review', confirm: 'Yes, it’s fixed', reopen: 'Still not fixed', close: 'Close without confirmation', cancel: 'Cancel my ticket', link: 'Link a change' };
const CLABEL: Record<string, string> = { edit: 'Edit plan', approve: 'Approve this plan', reject: 'Reject', implement: 'Record that it was made', verify: 'Verified working', roll_back: 'Rolled back', review: 'Retrospective review' };
const NEED: Record<string, number> = { fulfill: 10, review: 20, reopen: 5, close: 5, reject: 5, verify: 10, roll_back: 10 };

function TicketStep({ t, step, reload }: { t: any; step: string; reload: () => void }) {
  const [note, setNote] = useState('');
  const [who, setWho] = useState('');
  const [changeId, setChangeId] = useState('');
  const need = step === 'close' && t.kind !== 'request' ? 20 : NEED[step] ?? 0;
  const go = async () => {
    try { await itService({ action: 'tstep', id: t.id, step: step as never, expectedVersion: t.version, note, assigneeEmail: who, changeId: step === 'link' ? Number(changeId) : null }); toast('Recorded.'); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2 text-sm">
      {step === 'assign' && <Input aria-label="Assign to (email, blank for yourself)" placeholder="Assign to (email) — leave blank for yourself" value={who} onChange={(e) => setWho(e.target.value)} />}
      {step === 'link' && <Input aria-label="Change number" placeholder="Change number" inputMode="numeric" value={changeId} onChange={(e) => setChangeId(e.target.value.replace(/\D/g, ''))} />}
      {need > 0 && <Textarea aria-label={TLABEL[step]} placeholder={step === 'review' || (step === 'close' && t.kind !== 'request') ? 'Cause, and what prevents it happening again' : step === 'close' ? 'Why are you closing without the requester’s confirmation?' : 'Details'} value={note} onChange={(e) => setNote(e.target.value)} />}
      {step === 'close' && <p className="text-xs text-muted-foreground">The ticket will show it was closed without the requester confirming.</p>}
      <Button size="sm" disabled={note.trim().length < need || (step === 'link' && !changeId)} onClick={go}>{TLABEL[step]}</Button>
    </div>
  );
}

function Ticket({ t, reload }: { t: any; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><b>#{t.id} {t.title}</b><span className="block text-xs text-muted-foreground">{KIND[t.kind]}{t.service ? ` · ${t.service}` : ''}{t.mine ? '' : ` · from ${t.requester}`}{t.assignee ? ` · with ${t.assignee}` : ''} · opened {fmt(t.createdAt)}</span></span>
        <span className="flex gap-2">{t.overdue && <Status value="Overdue" />}<Status value={STATE[t.state] ?? t.state} /></span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs">{t.description}</p>
      {t.resolution && <p className="mt-2 text-xs"><b>What IT did:</b> {t.resolution}</p>}
      {t.review && <p className="mt-1 text-xs"><b>Problem review:</b> {t.review}</p>}
      {t.state === 'closed' && <p className="mt-1 text-xs">{t.confirmed ? 'Closed — the requester confirmed it was fixed.' : 'Closed by IT without the requester’s confirmation.'}</p>}
      {t.changeId && <p className="mt-1 text-xs"><b>Linked change #{t.changeId}:</b> {t.changeOutcome ?? 'not visible to you'} <span className="text-muted-foreground">(a closed ticket does not mean the change worked)</span></p>}
      {t.mine && t.kind !== 'request' && t.state === 'fulfilled' && !t.steps.includes('confirm') && <p className="mt-1 text-xs text-muted-foreground">Service was restored. IT records what caused it before you can confirm; you can say it is still broken now.</p>}
      {t.steps.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{t.steps.map((s: string) => <Button key={s} size="sm" variant={open === s ? 'default' : 'outline'} aria-expanded={open === s} onClick={() => setOpen(open === s ? null : s)}>{TLABEL[s]}</Button>)}</div>}
      {open && <TicketStep t={t} step={open} reload={() => { setOpen(null); reload(); }} />}
    </li>
  );
}

function OpenTicket({ services, reload }: { services: any[]; reload: () => void }) {
  const [f, setF] = useState({ kind: 'request', serviceId: '', title: '', description: '' });
  const [k, setK] = useState(key());
  const go = async () => {
    try { await itService({ action: 'open', requestKey: k, kind: f.kind as never, serviceId: f.serviceId ? Number(f.serviceId) : null, title: f.title, description: f.description });
      toast(f.kind === 'security_incident' ? 'Sent to IT security only.' : 'Ticket opened.'); setF({ kind: 'request', serviceId: '', title: '', description: '' }); setK(key()); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">What kind<select className={sel} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-xs">Service (optional)<select className={sel} value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}><option value="">Not sure</option>{services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <Input aria-label="Title" className="sm:col-span-2" placeholder="Short title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Textarea aria-label="Description" className="sm:col-span-2" placeholder="What happened, and what you need" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      {f.kind === 'security_incident' && <p className="text-xs text-muted-foreground sm:col-span-2">Only IT security staff will see this. If someone is in danger, call campus emergency services — Semester is not an emergency line.</p>}
      <div><Button size="sm" disabled={f.title.trim().length < 5 || f.description.trim().length < 10} onClick={go}>Send to IT</Button></div>
    </div>
  );
}

function Change({ c, reload }: { c: any; reload: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState(c.plan);
  const [rollback, setRollback] = useState(c.rollback);
  const need = NEED[open ?? ''] ?? (open === 'review' ? 20 : 0);
  const go = async () => {
    try { await itService({ action: 'cstep', id: c.id, step: open as never, expectedVersion: c.version, note, plan, rollback }); toast(open === 'edit' ? 'Plan changed — it needs approval again.' : 'Recorded.'); setOpen(null); setNote(''); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><b>Change #{c.id} {c.title}</b><span className="block text-xs text-muted-foreground">{c.service} · {c.emergency ? 'Emergency' : `${c.risk} risk`} · raised by {c.raiser}{c.approvedBy ? ` · approved by ${c.approvedBy}` : ''} · plan {c.planHash}</span></span>
        <Status value={c.outcome} />
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs"><b>Plan:</b> {c.plan}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs"><b>Rollback:</b> {c.rollback}</p>
      {c.outcomeNote && <p className="mt-1 text-xs"><b>Checked:</b> {c.outcomeNote}</p>}
      {c.reviewNote && <p className="mt-1 text-xs"><b>Retrospective review:</b> {c.reviewNote}</p>}
      {c.emergency && !c.approved && ['verified', 'rolled_back'].includes(c.state) && <p className="mt-1 text-xs">Made without prior approval — stays open until the service owner reviews it.</p>}
      {c.steps.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.steps.map((s: string) => <Button key={s} size="sm" variant={open === s ? 'default' : 'outline'} onClick={() => setOpen(open === s ? null : s)}>{CLABEL[s]}</Button>)}</div>}
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-border p-2">
          {open === 'edit' ? <>
            <Textarea aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
            <Textarea aria-label="Rollback plan" value={rollback} onChange={(e) => setRollback(e.target.value)} />
            {c.approved && <p className="text-xs">Saving withdraws the current approval.</p>}
          </> : need > 0 && <Textarea aria-label={CLABEL[open]} placeholder="Details" value={note} onChange={(e) => setNote(e.target.value)} />}
          {open === 'approve' && <p className="text-xs">You are approving exactly the plan above (fingerprint {c.planHash}). Any edit sends it back to you.</p>}
          <Button size="sm" disabled={open === 'edit' ? plan.trim().length < 20 || rollback.trim().length < 10 : note.trim().length < need} onClick={go}>{CLABEL[open]}</Button>
        </div>
      )}
    </li>
  );
}

function RaiseChange({ services, reload }: { services: any[]; reload: () => void }) {
  const [f, setF] = useState({ serviceId: '', title: '', plan: '', rollback: '', risk: 'low', emergency: false });
  const [k, setK] = useState(key());
  const go = async () => {
    try { await itService({ action: 'raise', requestKey: k, serviceId: Number(f.serviceId), title: f.title, plan: f.plan, rollback: f.rollback, risk: f.risk as never, emergency: f.emergency });
      toast('Change raised — waiting for the service owner.'); setF({ serviceId: '', title: '', plan: '', rollback: '', risk: 'low', emergency: false }); setK(key()); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">Service<select className={sel} value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}><option value="">Choose…</option>{services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} (owner {s.owner})</option>)}</select></label>
      <label className="text-xs">Risk<select className={sel} value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <Input aria-label="Change title" className="sm:col-span-2" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Textarea aria-label="Plan" className="sm:col-span-2" placeholder="Exactly what will be changed" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} />
      <Textarea aria-label="Rollback plan" className="sm:col-span-2" placeholder="How to undo it if it goes wrong" value={f.rollback} onChange={(e) => setF({ ...f, rollback: e.target.value })} />
      <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={f.emergency} onChange={(e) => setF({ ...f, emergency: e.target.checked })} /> Emergency — may be made before approval, then the owner must review it</label>
      <div><Button size="sm" disabled={!f.serviceId || f.title.trim().length < 5 || f.plan.trim().length < 20 || f.rollback.trim().length < 10} onClick={go}>Raise change</Button></div>
    </div>
  );
}

function Admin({ d, reload }: { d: any; reload: () => void }) {
  const [s, setS] = useState({ email: '', agent: true, security: false });
  const [svc, setSvc] = useState({ name: '', description: '', ownerEmail: '' });
  const staff = async () => { try { await itService({ action: 'setStaff', ...s }); toast('IT access saved.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  const service = async () => { try { await itService({ action: 'service', id: null, ...svc, active: true }); toast('Service added.'); setSvc({ name: '', description: '', ownerEmail: '' }); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-medium">IT staff · {d.staff.length}</p>
        <ul className="text-xs">{d.staff.map((x: any, i: number) => <li key={i}>{x.name} — {[x.agent && 'agent', x.security && 'security'].filter(Boolean).join(', ')}</li>)}</ul>
        <Input aria-label="Staff email" placeholder="Member email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={s.agent} onChange={(e) => setS({ ...s, agent: e.target.checked })} /> IT agent</label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={s.security} onChange={(e) => setS({ ...s, security: e.target.checked })} /> Security staff</label>
        <Button size="sm" disabled={!s.email.includes('@')} onClick={staff}>{s.agent || s.security ? 'Grant' : 'Remove access'}</Button>
        <p className="text-xs text-muted-foreground">You cannot change your own IT access.</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium">Add a service and its owner</p>
        <Input aria-label="Service name" placeholder="Service name" value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
        <Input aria-label="Service description" placeholder="Description" value={svc.description} onChange={(e) => setSvc({ ...svc, description: e.target.value })} />
        <Input aria-label="Owner email" placeholder="Service owner email (approves its changes)" value={svc.ownerEmail} onChange={(e) => setSvc({ ...svc, ownerEmail: e.target.value })} />
        <Button size="sm" disabled={svc.name.trim().length < 2 || !svc.ownerEmail.includes('@')} onClick={service}>Add service</Button>
      </div>
    </div>
  );
}

export default function ITService() {
  const s = useLoad(() => itService({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Campus" title="IT help" sub="Ask IT for something, report what is broken, or raise a security concern. You see your own tickets; IT staff see the queue." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.tickets.filter((t: any) => t.mine), queue = d.tickets.filter((t: any) => !t.mine);
        return (
          <div className="space-y-4">
            <Panel title="New ticket"><OpenTicket services={d.services} reload={s.reload} /></Panel>
            <Panel title={`My tickets · ${mine.length}`}>{mine.length ? <ul className="space-y-2">{mine.map((t: any) => <Ticket key={t.id} t={t} reload={s.reload} />)}</ul> : <Empty>You have no IT tickets.</Empty>}</Panel>
            {(d.agent || d.security) && <Panel title={`Queue · ${queue.filter((t: any) => !['closed', 'cancelled'].includes(t.state)).length} open`}>{queue.length ? <ul className="space-y-2">{queue.map((t: any) => <Ticket key={t.id} t={t} reload={s.reload} />)}</ul> : <Empty>The queue is empty.</Empty>}</Panel>}
            {(d.agent || d.ownsServices) && (
              <Panel title={`Changes · ${d.changes.filter((c: any) => !c.done).length} open`}>
                {d.changes.length ? <ul className="space-y-2">{d.changes.map((c: any) => <Change key={c.id} c={c} reload={s.reload} />)}</ul> : <Empty>No changes yet.</Empty>}
                {d.agent && <div className="mt-4"><p className="mb-2 text-xs font-medium">Raise a change</p>{d.services.length ? <RaiseChange services={d.services} reload={s.reload} /> : <Empty>An administrator needs to add a service first.</Empty>}</div>}
              </Panel>
            )}
            {d.isAdmin && <Panel title="IT access and services"><Admin d={d} reload={s.reload} /></Panel>}
          </div>
        );
      }}</Loadable>
    </>
  );
}
