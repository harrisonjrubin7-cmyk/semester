import { useState } from 'react';
import { toast } from 'sonner';
import { officeHours } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Panel, Empty, Status, fmt, errMsg } from './kit';
import { validateSlots, SlotKind } from '../lib/aptRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const WORD: Record<string, string> = { booked: 'Booked', cancelled: 'Cancelled', attended: 'Attended', no_show: 'Missed' };
const run = async (fn: () => Promise<unknown>, ok: string, reload: () => void) => { try { await fn(); toast(ok); } catch (e) { toast(`! ${errMsg(e)}`); } reload(); };

/** Student side: open slots you may book (section office hours only for your sections), your bookings and follow-ups. */
export function StudentAppointments({ d, reload }: { d: any; reload: () => void }) {
  const [topic, setTopic] = useState('');
  const upcoming = d.mine.filter((b: any) => b.state === 'booked' && b.start > d.now);
  const past = d.mine.filter((b: any) => !(b.state === 'booked' && b.start > d.now));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Book office hours or an appointment">
        <Input aria-label="What you want to discuss (optional)" placeholder="What you want to discuss (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} className="mb-2" />
        {d.open.length ? <ul className="space-y-2">{d.open.slice(0, 40).map((s: any) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span><span className="font-medium">{s.kind}{s.section ? ` · ${s.section}` : ''}</span><span className="block text-xs text-muted-foreground">{fmt(s.start)} · {s.host} · {s.location} · {s.capacity - s.booked} of {s.capacity} left</span></span>
            <Button size="sm" disabled={s.booked >= s.capacity} onClick={() => run(() => officeHours({ action: 'book', slotId: s.id, topic }), 'Booked. Your host has been told.', reload)}>{s.booked >= s.capacity ? 'Full' : 'Book'}</Button>
          </li>))}</ul> : <Empty>No open times right now. Office hours for a section appear once you are enrolled in it.</Empty>}
      </Panel>
      <Panel title="Your appointments">
        {upcoming.length ? <ul className="space-y-2">{upcoming.map((b: any) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{b.kind}{b.section ? ` · ${b.section}` : ''}<span className="block text-xs text-muted-foreground">{fmt(b.start)} · {b.host} · {b.location}</span></span>
            <Button size="sm" variant="outline" onClick={() => run(() => officeHours({ action: 'cancel', bookingId: b.id }), 'Cancelled.', reload)}>Cancel</Button>
          </li>))}</ul> : <Empty>Nothing booked.</Empty>}
        {past.length > 0 && <><p className="mt-4 text-xs font-medium">Earlier</p><ul className="mt-1 space-y-2">{past.slice(0, 20).map((b: any) => (
          <li key={b.id} className="text-sm"><span className="flex justify-between gap-2"><span>{b.kind} · {fmt(b.start)}</span><Status value={WORD[b.state] ?? b.state} /></span>
            {b.cancelReason && b.state === 'cancelled' && <span className="block text-xs text-muted-foreground">Host’s note: {b.cancelReason}</span>}
            {b.followUp && <span className="block text-xs">Follow-up from {b.host}: {b.followUp}</span>}</li>))}</ul></>}
      </Panel>
    </div>
  );
}

function NewSlots({ d, reload }: { d: any; reload: () => void }) {
  const [f, setF] = useState({ kind: (d.hostKinds[0] ?? 'Office hours') as SlotKind, sectionId: d.firstSection ?? '', startsAt: '', minutes: '15', capacity: '1', weeks: '1', location: '' });
  const startIso = f.startsAt ? new Date(f.startsAt).toISOString() : '';
  const draft = { kind: f.kind, sectionId: f.kind === 'Office hours' ? f.sectionId || null : null, startsAt: startIso, minutes: Number(f.minutes), capacity: Number(f.capacity), weeks: Number(f.weeks), location: f.location };
  const problem = validateSlots(draft, Date.now());
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <label className="text-xs">Kind<select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f.kind} onChange={set('kind')}>{d.hostKinds.map((k: string) => <option key={k}>{k}</option>)}</select></label>
      {f.kind === 'Office hours' && <label className="text-xs">Section<select className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm" value={f.sectionId} onChange={set('sectionId')}>
        <option value="">Choose…</option>{d.teaching.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
      <label className="text-xs">First slot starts<Input className="mt-1" type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></label>
      <label className="text-xs">Minutes each<Input className="mt-1" type="number" min={5} max={240} value={f.minutes} onChange={set('minutes')} /></label>
      <label className="text-xs">People per slot<Input className="mt-1" type="number" min={1} max={50} value={f.capacity} onChange={set('capacity')} /></label>
      <label className="text-xs">Repeat weekly for (weeks)<Input className="mt-1" type="number" min={1} max={16} value={f.weeks} onChange={set('weeks')} /></label>
      <label className="text-xs sm:col-span-2">Where (room or meeting link)<Input className="mt-1" value={f.location} onChange={set('location')} /></label>
      <div className="sm:col-span-2">{problem ? <span role="status" className="text-xs">! {problem}</span>
        : <Button size="sm" onClick={() => run(() => officeHours({ action: 'create', ...draft }), `Published ${f.weeks} slot(s).`, reload)}>Publish</Button>}</div>
    </div>
  );
}

function HostedSlot({ s, now, reload }: { s: any; now: string; reload: () => void }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState<Record<number, string>>({});
  const started = s.start <= now;
  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{s.kind}{s.section ? ` · ${s.section}` : ''} · {fmt(s.start)}</span>
        <Status value={s.cancelled ? 'Cancelled' : `${s.bookings.length} of ${s.capacity} booked`} /></div>
      <p className="text-xs text-muted-foreground">{s.location}{s.cancelled && s.cancelReason ? ` · ${s.cancelReason}` : ''}</p>
      {s.bookings.length > 0 && <ul className="mt-2 space-y-2">{s.bookings.map((b: any) => (
        <li key={b.id}><span className="flex justify-between gap-2"><span>{b.student}{b.topic ? ` — “${b.topic}”` : ''}</span><Status value={WORD[b.state] ?? b.state} /></span>
          {started && !s.cancelled && <div className="mt-1 space-y-1">
            <Textarea aria-label={`Follow-up for ${b.student}`} placeholder="Follow-up the student will see (optional)" defaultValue={b.followUp} onChange={(e) => setNotes({ ...notes, [b.id]: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => run(() => officeHours({ action: 'mark', bookingId: b.id, state: 'attended', followUp: notes[b.id] ?? b.followUp }), 'Recorded.', reload)}>Attended</Button>
              <Button size="sm" variant="outline" onClick={() => run(() => officeHours({ action: 'mark', bookingId: b.id, state: 'no_show', followUp: notes[b.id] ?? b.followUp }), 'Recorded.', reload)}>Missed</Button>
            </div></div>}
        </li>))}</ul>}
      {!s.cancelled && s.end > now && <div className="mt-2 flex gap-2">
        <Input aria-label="Reason for cancelling" placeholder="Reason (students are told)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="outline" disabled={reason.trim().length < 3} onClick={() => run(() => officeHours({ action: 'cancelSlot', slotId: s.id, reason }), 'Cancelled. Booked students were notified.', reload)}>Cancel slot</Button>
      </div>}
    </li>
  );
}

/** Host side: publish slots, see who booked, cancel with a reason, record attendance and follow-up. */
export function HostOfficeHours({ d, reload }: { d: any; reload: () => void }) {
  if (!d.hostKinds.length) return null;
  const soon = d.hosting.filter((s: any) => s.end > d.now);
  const recent = d.hosting.filter((s: any) => s.end <= d.now);
  return (
    <div className="space-y-4">
      <Panel title="Publish office hours">{d.hostKinds.includes('Office hours') && !d.teaching.length && d.hostKinds.length === 1
        ? <Empty>You are not an instructor of any section yet.</Empty> : <NewSlots d={d} reload={reload} />}</Panel>
      <Panel title={`Upcoming · ${soon.length}`}>{soon.length ? <ul className="space-y-2">{soon.map((s: any) => <HostedSlot key={s.id} s={s} now={d.now} reload={reload} />)}</ul> : <Empty>No upcoming slots.</Empty>}</Panel>
      {recent.length > 0 && <Panel title="Last two weeks: record attendance">{<ul className="space-y-2">{recent.map((s: any) => <HostedSlot key={s.id} s={s} now={d.now} reload={reload} />)}</ul>}</Panel>}
    </div>
  );
}
