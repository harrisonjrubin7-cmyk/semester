import { useState } from 'react';
import { toast } from 'sonner';
import { reslife } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const REFS = ['advising', 'counseling', 'housing', 'financial_aid', 'disability_services'];
const CATS = ['noise', 'facilities_safety', 'policy', 'roommate', 'wellbeing_concern', 'emergency_followup'];
const lbl = (s: string) => s.replace(/_/g, ' ');

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { await reslife(body as never); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}

function Programs({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [f, setF] = useState({ title: '', description: '', startsAt: '', capacity: '', budget: '' });
  const [note, setNote] = useState<Record<number, string>>({});
  return (
    <Panel title={d.raBuilding ? `Programs in ${d.raBuilding}` : 'Building programs'}>
      {!d.programs.length ? <Empty>{d.home ? `No programs in ${d.home} yet.` : 'Programs appear here once you live in residence.'}</Empty> : d.programs.map((p: any) => (
        <div key={p.id} className="border-b border-border py-1 text-sm">
          <p><span className="font-medium">{p.title}</span> · {p.building} · {fmt(p.startsAt)} · {p.n}/{p.capacity} <Status value={p.state} /></p>
          {p.description && <p className="text-xs">{p.description}</p>}
          <p className="text-xs text-muted-foreground">By {p.proposedBy}{p.budgetCents ? ` · budget $${(p.budgetCents / 100).toFixed(2)}` : ''}{p.decidedBy ? ` · ${p.state === 'declined' ? 'declined' : 'approved'} by ${p.decidedBy}` : ''}{p.decisionNote ? `: ${p.decisionNote}` : ''}</p>
          {p.state === 'approved' && !p.mineToRun && d.home === p.building && (p.rsvpd
            ? <Button size="sm" variant="outline" onClick={() => act({ action: 'rsvp', id: p.id, on: false }, 'RSVP cancelled.')}>Cancel RSVP</Button>
            : <Button size="sm" disabled={p.n >= p.capacity} onClick={() => act({ action: 'rsvp', id: p.id, on: true }, 'You are on the list.')}>{p.n >= p.capacity ? 'Full' : 'RSVP'}</Button>)}
          {d.kind === 'staff' && p.state === 'proposed' && !p.mineToRun && <div className="mt-1 flex flex-wrap gap-2">
            <Input aria-label="Decision note" placeholder="Note (required to decline)" className="h-8 w-52" value={note[p.id] ?? ''} onChange={(e) => setNote({ ...note, [p.id]: e.target.value })} />
            <Button size="sm" onClick={() => act({ action: 'programStep', id: p.id, step: 'approve', note: note[p.id] ?? '', expectedVersion: p.version }, 'Approved.')}>Approve</Button>
            <Button size="sm" variant="outline" disabled={(note[p.id] ?? '').length < 5} onClick={() => act({ action: 'programStep', id: p.id, step: 'decline', note: note[p.id] ?? '', expectedVersion: p.version }, 'Declined.')}>Decline</Button></div>}
          {(p.mineToRun || d.kind === 'staff') && ['proposed', 'approved'].includes(p.state) && <div className="mt-1 flex gap-2">
            {p.state === 'approved' && <Button size="sm" variant="outline" onClick={() => act({ action: 'programStep', id: p.id, step: 'held', expectedVersion: p.version }, 'Marked as held.')}>Mark held</Button>}
            <Button size="sm" variant="ghost" onClick={() => act({ action: 'programStep', id: p.id, step: 'cancel', expectedVersion: p.version }, 'Cancelled.')}>Cancel</Button></div>}
          {p.attendees.map((r: any) => <div key={r.id} className="flex items-center gap-2 text-xs"><span>{r.name}</span>{r.attended != null && <Status value={r.attended ? 'present' : 'absent'} />}
            <Button size="sm" variant="ghost" onClick={() => act({ action: 'attend', id: p.id, residentId: r.id, attended: true }, 'Present.')}>Present</Button>
            <Button size="sm" variant="ghost" onClick={() => act({ action: 'attend', id: p.id, residentId: r.id, attended: false }, 'Absent.')}>Absent</Button></div>)}
        </div>))}
      {d.raBuilding && <div className="mt-2 space-y-1"><p className="text-xs font-medium">Propose a program (housing staff approve it)</p>
        <div className="flex flex-wrap gap-2"><Input aria-label="Title" placeholder="Title" className="w-44" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input aria-label="Starts" type="datetime-local" className="w-52" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
          <Input aria-label="Capacity" type="number" placeholder="Capacity" className="w-24" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
          <Input aria-label="Budget in dollars" type="number" placeholder="Budget $" className="w-24" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></div>
        <Textarea aria-label="Description" rows={2} placeholder="What residents will do" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Button size="sm" disabled={f.title.length < 3 || !f.startsAt || !(Number(f.capacity) > 0)} onClick={async () => { if (await act({ action: 'propose', title: f.title, description: f.description, startsAt: new Date(f.startsAt).toISOString(), capacity: Number(f.capacity), budgetCents: Math.round(Number(f.budget || 0) * 100) }, 'Proposed to housing staff.')) setF({ title: '', description: '', startsAt: '', capacity: '', budget: '' }); }}>Propose</Button></div>}
    </Panel>
  );
}

function CheckIns({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [f, setF] = useState({ residentId: '', outcome: 'ok', referral: '', note: '' });
  return (
    <Panel title="Resident check-ins">
      {d.raBuilding && <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Keep notes brief. Refer to a service rather than writing private details.</p>
        <div className="flex flex-wrap gap-2"><select aria-label="Resident" className={sel} value={f.residentId} onChange={(e) => setF({ ...f, residentId: e.target.value })}><option value="">Resident…</option>{d.residents.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <select aria-label="Outcome" className={sel} value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>{['ok', 'follow_up', 'referred'].map((x) => <option key={x} value={x}>{lbl(x)}</option>)}</select>
          {f.outcome === 'referred' && <select aria-label="Referred to" className={sel} value={f.referral} onChange={(e) => setF({ ...f, referral: e.target.value })}><option value="">Referred to…</option>{REFS.map((x) => <option key={x} value={x}>{lbl(x)}</option>)}</select>}</div>
        <Input aria-label="Note" placeholder="Brief note (optional)" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <Button size="sm" disabled={!f.residentId || (f.outcome === 'referred' && !f.referral)} onClick={async () => { if (await act({ action: 'checkin', residentId: f.residentId, outcome: f.outcome, referral: f.outcome === 'referred' ? f.referral : null, note: f.note }, 'Check-in logged.')) setF({ residentId: '', outcome: 'ok', referral: '', note: '' }); }}>Log check-in</Button></div>}
      {!d.checkins.length ? <Empty>No check-ins logged.</Empty> : d.checkins.slice(0, 30).map((c: any, i: number) => <p key={i} className="mt-1 text-xs">{fmt(c.at)} · {c.ra} with {c.resident} ({c.building}) · <Status value={lbl(c.outcome)} />{c.referral ? ` → ${lbl(c.referral)}` : ''}{c.note ? ` · ${c.note}` : ''}</p>)}
    </Panel>
  );
}

function Incidents({ d, act }: { d: any; act: ReturnType<typeof useAct> }) {
  const [f, setF] = useState({ area: '', category: 'noise', occurredAt: '', description: '', building: '' });
  const [t, setT] = useState<Record<number, string>>({});
  return (
    <Panel title="Incident reports">
      <p className="text-xs text-muted-foreground">Bounded reports: building, general area, category and what happened. Do not name residents. For an emergency, call campus safety first.</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {d.kind === 'staff' && <Input aria-label="Building" placeholder="Building" className="w-28" value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })} />}
        <Input aria-label="Area" placeholder="General area (e.g. floor 2 lounge)" className="w-48" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />
        <select aria-label="Category" className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((x) => <option key={x} value={x}>{lbl(x)}</option>)}</select>
        <Input aria-label="When" type="datetime-local" className="w-52" value={f.occurredAt} onChange={(e) => setF({ ...f, occurredAt: e.target.value })} /></div>
      <Textarea aria-label="What happened" rows={2} maxLength={1000} className="mt-1" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <Button size="sm" className="mt-1" disabled={f.area.length < 2 || !f.occurredAt || f.description.length < 10 || (d.kind === 'staff' && !f.building)} onClick={async () => { if (await act({ action: 'report', ...f, occurredAt: new Date(f.occurredAt).toISOString() }, 'Report filed with housing staff.')) setF({ ...f, area: '', description: '' }); }}>File report</Button>
      {!d.incidents.length ? <Empty>No reports.</Empty> : d.incidents.map((i: any) => <div key={i.id} className="mt-2 border-b border-border pb-1 text-xs">
        <p><Status value={i.state} /> <Status value={lbl(i.category)} /> {i.building} · {i.area} · {fmt(i.occurredAt)}</p><p>{i.description}</p>
        <p className="text-muted-foreground">Filed by {i.filedBy}{i.handledBy ? ` · handled by ${i.handledBy}` : ''}{i.outcome ? `: ${i.outcome}` : ''}</p>
        {d.kind === 'staff' && i.state !== 'closed' && !i.mine && <div className="mt-1 flex flex-wrap gap-2">
          {i.state === 'filed' && <Button size="sm" variant="outline" onClick={() => act({ action: 'incidentStep', id: i.id, step: 'acknowledge', expectedVersion: i.version }, 'Acknowledged.')}>Acknowledge</Button>}
          <Input aria-label="Referral or outcome" placeholder="Referred to / outcome" className="h-8 w-52" value={t[i.id] ?? ''} onChange={(e) => setT({ ...t, [i.id]: e.target.value })} />
          <Button size="sm" variant="outline" disabled={(t[i.id] ?? '').length < 5} onClick={() => act({ action: 'incidentStep', id: i.id, step: 'refer', text: t[i.id], expectedVersion: i.version }, 'Referred.')}>Refer</Button>
          <Button size="sm" disabled={(t[i.id] ?? '').length < 5} onClick={() => act({ action: 'incidentStep', id: i.id, step: 'close', text: t[i.id], expectedVersion: i.version }, 'Closed.')}>Close</Button></div>}
      </div>)}
    </Panel>
  );
}

export default function ResLife() {
  const state = useLoad(() => reslife({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Campus" title="Residence life" sub="Building programs, RA check-ins and referrals, and incident reports. Roles are granted in Housing by an administrator." />
      <Loadable state={state}>{(d: any) => <div className="grid gap-4 lg:grid-cols-2">
        <Programs d={d} act={act} />
        {d.kind && <CheckIns d={d} act={act} />}
        {d.kind && <Incidents d={d} act={act} />}
      </div>}</Loadable>
    </div>
  );
}
