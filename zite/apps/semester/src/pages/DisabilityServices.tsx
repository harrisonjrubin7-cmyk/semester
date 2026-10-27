import { useState } from 'react';
import { toast } from 'sonner';
import { disability } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const lbl = (s: string) => s.replace(/_/g, ' ');

function useAct(reload: () => void) {
  return async (body: any, msg: string) => { try { await disability(body as never); toast(msg); reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); reload(); return false; } };
}
type P = { d: any; act: ReturnType<typeof useAct> };

function Student({ d, act }: P) {
  const [why, setWhy] = useState<Record<string, string>>({});
  const decided = d.mine.filter((r: any) => ['approved', 'declined'].includes(r.state));
  if (!decided.length) return null;
  return (
    <Panel title="Your accommodation decisions">
      {decided.map((r: any) => <div key={r.id} className="border-b border-border py-1 text-sm">
        <p>Request {r.number} · {lbl(r.category)} <Status value={r.state} />{r.arrangements.length ? ` · ${r.arrangements.join('; ')}` : ''}</p>
        {r.appeal ? <p className="text-xs">Appeal: <Status value={r.appeal} /> {r.appealNote}</p> : <div className="mt-1 space-y-1">
          <Textarea aria-label="Reason for appeal" rows={2} placeholder="If you disagree, explain why the decision should change" value={why[r.id] ?? ''} onChange={(e) => setWhy({ ...why, [r.id]: e.target.value })} />
          <Button size="sm" variant="outline" disabled={(why[r.id] ?? '').length < 20} onClick={() => act({ action: 'appeal', requestId: r.id, reason: why[r.id] }, 'Appeal sent. An officer who did not make the decision will review it.')}>Appeal</Button></div>}
      </div>)}
    </Panel>
  );
}

function Instructor({ d, act }: P) {
  if (!d.letters.length) return null;
  return (
    <Panel title="Accommodation letters for your sections">
      <p className="text-xs text-muted-foreground">Arrangements only. Contact the accessibility office with questions; do not ask the student for documentation.</p>
      {d.letters.map((l: any) => <div key={l.requestId + l.sectionId} className="flex flex-wrap items-center gap-2 border-b border-border py-1 text-sm">
        <span>{l.section} · {l.student} · {l.arrangements.join('; ')}{l.validUntil ? ` · until ${l.validUntil}` : ''}</span>
        {l.acked ? <Status value="acknowledged" /> : <Button size="sm" variant="outline" onClick={() => act({ action: 'ack', requestId: l.requestId, sectionId: l.sectionId }, 'Acknowledged.')}>Acknowledge</Button>}</div>)}
    </Panel>
  );
}

function Queue({ d, act }: P) {
  const [asg, setAsg] = useState<Record<string, string>>({});
  const [when, setWhen] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Record<string, string>>({});
  return (
    <Panel title={d.officer ? 'Intake and documents' : 'Your assigned intakes'}>
      <p className="text-xs text-muted-foreground">Semester records document type and status only. Keep documents and any diagnosis in the office's records system.</p>
      {!d.queue.length ? <Empty>Nothing here.</Empty> : d.queue.map((q: any) => <div key={q.id} className="border-b border-border py-2 text-sm">
        <p>Request {q.number} · {q.student} · {lbl(q.category)} <Status value={lbl(q.state)} /> {q.intake && <Status value={`intake ${lbl(q.intake)}`} />} {q.meetingAt && <span className="text-xs">{fmt(q.meetingAt)}</span>}</p>
        {q.coordinatorId && <p className="text-xs">Coordinator: {q.coordinator}</p>}
        {d.officer && <div className="mt-1 flex flex-wrap gap-2"><select aria-label="Coordinator" className={sel} value={asg[q.id] ?? ''} onChange={(e) => setAsg({ ...asg, [q.id]: e.target.value })}><option value="">Assign coordinator…</option>{d.coordinators.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <Button size="sm" variant="outline" disabled={!asg[q.id]} onClick={() => act({ action: 'assign', requestId: q.id, coordinatorId: asg[q.id] }, 'Assigned.')}>Assign</Button></div>}
        {q.mineToCoordinate && <div className="mt-1 flex flex-wrap gap-2"><Input aria-label="Meeting time" type="datetime-local" className="h-8 w-52" value={when[q.id] ?? ''} onChange={(e) => setWhen({ ...when, [q.id]: e.target.value })} />
          <Button size="sm" variant="outline" disabled={!when[q.id]} onClick={() => act({ action: 'intake', requestId: q.id, step: 'schedule', at: new Date(when[q.id]).toISOString() }, 'Scheduled.')}>Schedule intake</Button>
          {q.intake === 'scheduled' && <><Button size="sm" variant="ghost" onClick={() => act({ action: 'intake', requestId: q.id, step: 'held' }, 'Marked held.')}>Held</Button>
            <Button size="sm" variant="ghost" onClick={() => act({ action: 'intake', requestId: q.id, step: 'no_show' }, 'Marked no-show.')}>No-show</Button></>}</div>}
        {q.docs.map((x: any) => <div key={x.id} className="flex flex-wrap items-center gap-2 text-xs"><span>{lbl(x.kind)}</span><Status value={x.state} />{x.note && <span>{x.note}</span>}
          {['requested', 'insufficient'].includes(x.state) && <Button size="sm" variant="ghost" onClick={() => act({ action: 'doc', requestId: q.id, docId: x.id, state: 'received' }, 'Marked received.')}>Received</Button>}
          {d.officer && x.state === 'received' && <><Button size="sm" variant="ghost" onClick={() => act({ action: 'doc', requestId: q.id, docId: x.id, state: 'verified' }, 'Verified.')}>Verified</Button>
            <Button size="sm" variant="ghost" onClick={() => act({ action: 'doc', requestId: q.id, docId: x.id, state: 'insufficient' }, 'Marked insufficient.')}>Insufficient</Button></>}</div>)}
        {(d.officer || q.mineToCoordinate) && <div className="mt-1 flex gap-2"><select aria-label="Document type" className={sel} value={kind[q.id] ?? ''} onChange={(e) => setKind({ ...kind, [q.id]: e.target.value })}><option value="">Request a document…</option>{['provider_letter', 'prior_plan', 'self_report', 'other'].map((k) => <option key={k} value={k}>{lbl(k)}</option>)}</select>
          <Button size="sm" variant="ghost" disabled={!kind[q.id]} onClick={() => act({ action: 'doc', requestId: q.id, kind: kind[q.id] }, 'Document requested.')}>Add</Button></div>}
      </div>)}
    </Panel>
  );
}

function Delivery({ d, act }: P) {
  const [note, setNote] = useState<Record<string, string>>({});
  const [ap, setAp] = useState<Record<string, { outcome: string; arrangements: string; note: string; until: string }>>({});
  return (
    <Panel title="Appeals and implementation">
      {d.officer && <><p className="text-xs font-medium">Open appeals</p>
        {!d.appeals.length ? <Empty>No open appeals.</Empty> : d.appeals.map((p: any) => { const f = ap[p.requestId] ?? { outcome: 'upheld', arrangements: p.arrangements.join('\n'), note: '', until: '' };
          return <div key={p.requestId} className="border-b border-border py-1 text-sm"><p>Request {p.number} · {p.student}</p><p className="text-xs">{p.reason}</p>
            {p.iDecidedOriginally ? <p className="text-xs text-muted-foreground">You made the original decision; another officer decides the appeal.</p> : <div className="mt-1 space-y-1">
              <select aria-label="Outcome" className={sel} value={f.outcome} onChange={(e) => setAp({ ...ap, [p.requestId]: { ...f, outcome: e.target.value } })}>{['upheld', 'modified', 'overturned'].map((o) => <option key={o}>{o}</option>)}</select>
              {f.outcome !== 'upheld' && <Input aria-label="Valid until" type="date" className="w-40" value={f.until} onChange={(e) => setAp({ ...ap, [p.requestId]: { ...f, until: e.target.value } })} />}
              {f.outcome !== 'upheld' && <Textarea aria-label="Arrangements" rows={2} placeholder="Arrangements, one per line" value={f.arrangements} onChange={(e) => setAp({ ...ap, [p.requestId]: { ...f, arrangements: e.target.value } })} />}
              <Input aria-label="Decision note" placeholder="Decision note" value={f.note} onChange={(e) => setAp({ ...ap, [p.requestId]: { ...f, note: e.target.value } })} />
              <Button size="sm" disabled={f.note.length < 10 || (f.outcome !== 'upheld' && !f.until)} onClick={() => act({ action: 'decideAppeal', requestId: p.requestId, outcome: f.outcome, validUntil: f.outcome === 'upheld' ? null : f.until, arrangements: f.outcome === 'upheld' ? [] : f.arrangements.split('\n').map((x) => x.trim()).filter((x) => x.length >= 3), note: f.note }, 'Appeal decided.')}>Decide</Button></div>}</div>; })}</>}
      <p className="mt-3 text-xs font-medium">Implementation checks</p>
      {!d.active.length ? <Empty>No active letters to check.</Empty> : d.active.map((x: any) => { const k = x.requestId + x.sectionId;
        return <div key={k} className="flex flex-wrap items-center gap-2 border-b border-border py-1 text-xs"><span>{x.section} · {x.student}</span><Status value={x.acked ? 'acknowledged' : 'not acknowledged'} />
          <Input aria-label="Check note" placeholder="Note (required if not delivered)" className="h-8 w-52" value={note[k] ?? ''} onChange={(e) => setNote({ ...note, [k]: e.target.value })} />
          <Button size="sm" variant="ghost" onClick={() => act({ action: 'check', requestId: x.requestId, sectionId: x.sectionId, delivered: true, note: note[k] ?? '' }, 'Recorded as delivered.')}>Delivered</Button>
          <Button size="sm" variant="ghost" disabled={(note[k] ?? '').length < 5} onClick={() => act({ action: 'check', requestId: x.requestId, sectionId: x.sectionId, delivered: false, note: note[k] }, 'Flagged to the office.')}>Not delivered</Button></div>; })}
      {d.officer && d.flags.length > 0 && <><p className="mt-3 text-xs font-medium">Flags</p>{d.flags.map((f: any) => <p key={f.id} className="text-xs">{fmt(f.at)} · {f.section}: {f.note} {!f.mine && <Button size="sm" variant="ghost" onClick={() => act({ action: 'clearFlag', checkId: f.id }, 'Cleared.')}>Clear</Button>}</p>)}</>}
    </Panel>
  );
}

function Admin({ d, act }: P) {
  const [em, setEm] = useState('');
  return (
    <Panel title="Disability services coordinators (administrators)">
      <div className="flex gap-2"><Input aria-label="Email" placeholder="Email" className="w-56" value={em} onChange={(e) => setEm(e.target.value)} />
        <Button size="sm" disabled={!em.includes('@')} onClick={() => act({ action: 'coordinator', email: em, on: true }, 'Appointed.')}>Appoint</Button>
        <Button size="sm" variant="outline" disabled={!em.includes('@')} onClick={() => act({ action: 'coordinator', email: em, on: false }, 'Removed.')}>Remove</Button></div>
      <p className="mt-1 text-xs">{d.coordinators.length ? d.coordinators.map((c: any) => c.name).join(', ') : 'No coordinators yet.'} Officers are managed in Accommodations.</p>
    </Panel>
  );
}

export default function DisabilityServices() {
  const state = useLoad(() => disability({ action: 'get' } as never) as Promise<any>, []);
  const act = useAct(state.reload);
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Campus" title="Disability services" sub="Appeals, letter acknowledgment, intake, document tracking and implementation checks. Requests start in Accommodations." />
      <Loadable state={state}>{(d: any) => <div className="grid gap-4 lg:grid-cols-2">
        <Student d={d} act={act} /><Instructor d={d} act={act} />
        {(d.officer || d.coord) && <Queue d={d} act={act} />}{(d.officer || d.coord) && <Delivery d={d} act={act} />}
        {d.isAdmin && <Admin d={d} act={act} />}
        {!d.officer && !d.coord && !d.letters.length && !d.mine.some((r: any) => ['approved', 'declined'].includes(r.state)) && <Panel><Empty>Nothing here yet. Request accommodations in Accommodations.</Empty></Panel>}
      </div>}</Loadable>
    </div>
  );
}
