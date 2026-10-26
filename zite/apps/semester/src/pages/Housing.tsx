import { useState } from 'react';
import { toast } from 'sonner';
import { housing } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg, fmt } from '../components/kit';
import { needsReason, AppStep } from '../lib/housingRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const words = (s: string) => s.replace(/_/g, ' ');
const STATE: Record<string, string> = {
  submitted: 'Submitted — waiting for an offer', offered: 'Room offered — your answer needed', accepted: 'Contract accepted', moved_in: 'Moved in',
  moved_out: 'Moved out', declined: 'Offer declined', withdrawn: 'Withdrawn', cancelled: 'Cancelled by housing',
  open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};
const LABEL: Record<AppStep, string> = {
  offer: 'Offer a room', accept: 'Accept this contract', decline: 'Decline the offer', withdraw: 'Withdraw my application',
  cancel: 'Cancel the application', move_in: 'Record move-in', move_out: 'Record move-out',
};
const CATEGORIES = ['plumbing', 'electrical', 'heating_cooling', 'furniture', 'pests', 'lock_or_key', 'cleaning', 'other'];
const sel = 'mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm';

function Step({ x, step, rooms, reload }: { x: any; step: AppStep; rooms: any[]; reload: () => void }) {
  const [text, setText] = useState('');
  const [roomId, setRoomId] = useState<number | null>(rooms.find((r) => r.active && r.held < r.capacity)?.id ?? null);
  const [agree, setAgree] = useState(false);
  const need = step === 'offer' ? 40 : needsReason(step) ? 5 : 0;
  const ready = step === 'accept' ? agree : step === 'offer' ? !!roomId && text.trim().length >= need : text.trim().length >= need;
  const go = async () => {
    try {
      await housing({ action: 'step', id: x.id, step, expectedVersion: x.version, text: step === 'accept' ? x.contractHash : text, roomId: step === 'offer' ? roomId : null });
      toast('Recorded.'); reload();
    } catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-2">
      {step === 'offer' && (
        <label className="block text-xs">Room
          <select className={sel} value={roomId ?? ''} onChange={(e) => setRoomId(Number(e.target.value) || null)}>
            <option value="">Choose…</option>
            {rooms.map((r) => <option key={r.id} value={r.id} disabled={!r.active || r.held >= r.capacity}>{r.building} {r.room} · {r.held}/{r.capacity}{!r.active ? ' · inactive' : r.held >= r.capacity ? ' · full' : ''}</option>)}
          </select>
        </label>
      )}
      {step === 'accept' && (
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I have read the contract above and accept it for {x.term}.</label>
      )}
      {need > 0 && <Textarea aria-label={step === 'offer' ? 'Contract terms' : 'Reason or condition note'} placeholder={step === 'offer' ? 'Contract terms the student will accept: dates, rate, rules, cancellation' : step === 'cancel' ? 'Reason (the student will see it)' : 'Room condition'} value={text} onChange={(e) => setText(e.target.value)} />}
      <Button size="sm" variant={['decline', 'withdraw', 'cancel'].includes(step) ? 'outline' : 'default'} disabled={!ready} onClick={go}>{LABEL[step]}</Button>
      {need > 0 && text.trim().length < need && <span className="ml-2 text-xs text-muted-foreground">At least {need} characters.</span>}
    </div>
  );
}

function AppCard({ x, rooms, reload }: { x: any; rooms: any[]; reload: () => void }) {
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{x.mine ? 'My application' : x.student} · {x.term}{x.room ? ` · ${x.room}` : ''}</span><Status value={STATE[x.state] ?? x.state} /></div>
      {x.preferences && <p className="mt-1 text-xs text-muted-foreground">Preferences: {x.preferences}</p>}
      {x.contractTerms && <details className="mt-2" open={x.state === 'offered' && x.mine}><summary className="cursor-pointer text-xs font-medium">Contract</summary><p className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 text-xs">{x.contractTerms}</p>{x.acceptedAt && <p className="text-xs text-muted-foreground">Accepted {fmt(x.acceptedAt)}</p>}</details>}
      {x.moveInNote && <p className="mt-1 text-xs">Move-in condition: {x.moveInNote}</p>}
      {x.moveOutNote && <p className="mt-1 text-xs">Move-out condition: {x.moveOutNote}</p>}
      {x.steps.map((s: AppStep) => <Step key={s} x={x} step={s} rooms={rooms} reload={reload} />)}
    </li>
  );
}

function Apply({ reload }: { reload: () => void }) {
  const [term, setTerm] = useState('');
  const [prefs, setPrefs] = useState('');
  const [key, setKey] = useState(() => crypto.randomUUID());
  const send = async () => {
    try { const r: any = await housing({ action: 'apply', requestKey: key, term, preferences: prefs }); toast(r.result?.replayed ? 'Already sent.' : 'Application sent to housing.'); setTerm(''); setPrefs(''); setKey(crypto.randomUUID()); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">Term<Input className="mt-1" placeholder="e.g. Fall 2027" value={term} onChange={(e) => setTerm(e.target.value)} /></label>
      <label className="text-xs sm:col-span-2">Preferences (optional; housing staff see this)<Textarea className="mt-1" placeholder="Building, roommate, quiet floor…" value={prefs} onChange={(e) => setPrefs(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground sm:col-span-2">Accessibility needs are arranged through Disability Services, not here.</p>
      <div><Button size="sm" disabled={term.trim().length < 2} onClick={send}>Apply</Button></div>
    </div>
  );
}

function Report({ rooms, reload }: { rooms: any[]; reload: () => void }) {
  const [f, setF] = useState({ roomId: rooms[0]?.id ?? 0, category: 'plumbing', description: '', urgent: false });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const send = async () => {
    try { await housing({ action: 'report', requestKey: key, ...f, category: f.category as never }); toast('Request sent.'); setF({ ...f, description: '', urgent: false }); setKey(crypto.randomUUID()); reload(); }
    catch (e) { toast(`! ${errMsg(e)}`); }
  };
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">Room<select className={sel} value={f.roomId} onChange={(e) => setF({ ...f, roomId: Number(e.target.value) })}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
      <label className="text-xs">Problem<select className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{words(c)}</option>)}</select></label>
      <label className="text-xs sm:col-span-2">What is wrong<Textarea className="mt-1" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} />Urgent (no heat, flooding, cannot lock the door)</label>
      <p className="text-xs text-muted-foreground sm:col-span-2">For danger to anyone, call campus safety or emergency services first.</p>
      <div><Button size="sm" disabled={f.description.trim().length < 10 || !f.roomId} onClick={send}>Send request</Button></div>
    </div>
  );
}

function Ticket({ m, kind, reload }: { m: any; kind: string | null; reload: () => void }) {
  const [text, setText] = useState('');
  const staff = kind === 'staff';
  const steps = [
    staff && m.state === 'open' && 'start', staff && ['open', 'in_progress'].includes(m.state) && 'resolve',
    m.mine && m.state === 'resolved' && 'reopen', (staff || m.mine) && m.state === 'resolved' && 'close',
  ].filter(Boolean) as ('start' | 'resolve' | 'reopen' | 'close')[];
  const go = async (step: 'start' | 'resolve' | 'reopen' | 'close') => {
    try { await housing({ action: 'maint', id: m.id, step, expectedVersion: m.version, text }); toast('Recorded.'); setText(''); reload(); } catch (e) { toast(`! ${errMsg(e)}`); reload(); }
  };
  const needText = steps.includes('resolve') || steps.includes('reopen');
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{m.room} · {words(m.category)}{m.urgent ? ' · ⚠ urgent' : ''}</span><Status value={STATE[m.state] ?? m.state} /></div>
      <p className="text-xs text-muted-foreground">{m.mine ? 'You reported this' : `Reported by ${m.reporter}`} · updated {fmt(m.updatedAt)}</p>
      <p className="mt-1 whitespace-pre-wrap">{m.description}</p>
      {m.resolution && <p className="mt-1 text-xs">What was done: {m.resolution}</p>}
      {steps.length > 0 && (
        <div className="mt-2 space-y-2">
          {needText && <Input aria-label="Note" placeholder={staff ? 'What was done' : 'What is still wrong'} value={text} onChange={(e) => setText(e.target.value)} />}
          <div className="flex flex-wrap gap-2">{steps.map((s) => <Button key={s} size="sm" variant={s === 'close' ? 'outline' : 'default'} disabled={(s === 'resolve' || s === 'reopen') && text.trim().length < 5} onClick={() => go(s)}>{s === 'start' ? 'Start work' : s === 'resolve' ? 'Mark resolved' : s === 'reopen' ? 'Still a problem' : 'Close'}</Button>)}</div>
        </div>
      )}
    </li>
  );
}

function Rooms({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ building: '', room: '', capacity: 2, active: true });
  const save = async (v = f) => { try { await housing({ action: 'room', ...v }); toast('Room saved.'); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title={`Rooms · ${d.rooms.length}`}>
      {d.rooms.length ? (
        <ul className="mb-3 divide-y divide-border text-sm">{d.rooms.map((r: any) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{r.building} {r.room} · {r.held}/{r.capacity} beds held{r.active ? '' : ' · inactive'}</span>
            <Button size="sm" variant="outline" onClick={() => save({ building: r.building, room: r.room, capacity: r.capacity, active: !r.active })}>{r.active ? 'Take offline' : 'Make available'}</Button></li>))}
        </ul>
      ) : <Empty>No rooms yet. Add the rooms you assign.</Empty>}
      <div className="grid gap-2 sm:grid-cols-4">
        <Input aria-label="Building" placeholder="Building" value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })} />
        <Input aria-label="Room" placeholder="Room" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} />
        <Input aria-label="Beds" type="number" min={1} max={8} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
        <Button size="sm" disabled={!f.building.trim() || !f.room.trim() || f.capacity < 1 || f.capacity > 8} onClick={() => save()}>Save room</Button>
      </div>
    </Panel>
  );
}

function Access({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ email: '', kind: 'staff' as 'staff' | 'ra' | 'none', building: '' });
  const save = async () => { try { await housing({ action: 'setStaff', ...f }); toast('Saved.'); setF({ ...f, email: '' }); reload(); } catch (e) { toast(`! ${errMsg(e)}`); } };
  return (
    <Panel title="Housing access">
      {d.staff.length ? <ul className="mb-2 space-y-1 text-sm">{d.staff.map((s: any, i: number) => <li key={i}>{s.name} · {s.kind === 'ra' ? `Resident assistant, ${s.building}` : 'Housing staff'}</li>)}</ul> : <Empty>No housing staff yet.</Empty>}
      <div className="grid gap-2 sm:grid-cols-4">
        <Input aria-label="Email" placeholder="Member’s email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select aria-label="Role" className="rounded-md border border-border bg-background p-2 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as never })}><option value="staff">Housing staff</option><option value="ra">Resident assistant</option><option value="none">Remove access</option></select>
        <Input aria-label="Building" placeholder="Building (RAs)" value={f.building} disabled={f.kind !== 'ra'} onChange={(e) => setF({ ...f, building: e.target.value })} />
        <Button size="sm" disabled={!f.email.includes('@') || (f.kind === 'ra' && !f.building.trim())} onClick={save}>Save</Button>
      </div>
    </Panel>
  );
}

export default function Housing() {
  const s = useLoad(() => housing({ action: 'get' }));
  return (
    <>
      <PageHeader eyebrow="Residence life" title="Housing" sub="Apply for a room, accept your contract and report maintenance. Housing staff see applications; resident assistants see only their building." />
      <Loadable state={s}>{(d: any) => {
        const mine = d.applications.filter((x: any) => x.mine);
        const queue = d.applications.filter((x: any) => !x.mine);
        const live = queue.filter((x: any) => ['submitted', 'offered', 'accepted', 'moved_in'].includes(x.state));
        const openTickets = d.tickets.filter((m: any) => !['closed'].includes(m.state));
        return (
          <div className="space-y-4">
            <Panel title="My housing">
              {mine.length ? <ul className="mb-3 space-y-2">{mine.map((x: any) => <AppCard key={x.id} x={x} rooms={d.rooms} reload={s.reload} />)}</ul> : <Empty>You have not applied for housing.</Empty>}
              {!mine.some((x: any) => ['submitted', 'offered', 'accepted', 'moved_in'].includes(x.state)) && <Apply reload={s.reload} />}
            </Panel>
            {d.reportRooms.length > 0 && <Panel title="Report a maintenance problem"><Report rooms={d.reportRooms} reload={s.reload} /></Panel>}
            <Panel title={`Maintenance · ${openTickets.length} open`}>{d.tickets.length ? <ul className="space-y-2">{d.tickets.map((m: any) => <Ticket key={m.id} m={m} kind={d.kind} reload={s.reload} />)}</ul> : <Empty>No maintenance requests.</Empty>}</Panel>
            {d.kind === 'ra' && <Panel title={`Residents · ${d.myBuilding}`}>{d.residents.length ? <ul className="space-y-1 text-sm">{d.residents.map((r: any, i: number) => <li key={i}>{r.name} · {r.room} · {STATE[r.state] ?? r.state}</li>)}</ul> : <Empty>No residents yet.</Empty>}</Panel>}
            {d.kind === 'staff' && <Panel title={`Applications · ${live.length} live`}>{queue.length ? <ul className="space-y-2">{queue.map((x: any) => <AppCard key={x.id} x={x} rooms={d.rooms} reload={s.reload} />)}</ul> : <Empty>No applications yet.</Empty>}</Panel>}
            {d.kind === 'staff' && <Rooms d={d} reload={s.reload} />}
            {d.isAdmin && <Access d={d} reload={s.reload} />}
          </div>
        );
      }}</Loadable>
    </>
  );
}
