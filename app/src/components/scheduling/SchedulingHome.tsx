import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import {
  cancelBooking, decideBooking, loadBookings, loadRuns, loadSpaces, makeBooking, publishRun, requestBooking, retireSpace, saveRun, saveSpace,
  schedulingCapabilities, toInstant, type Booking, type BookingPurpose, type RunRow, type SchedulingCapability, type Space,
} from '../../lib/scheduling/client';
import { parseSections, patternWords, proposalConflicts, solveTimetable, type Assignment, type RoomInput, type SectionInput, type Unplaced } from '../../lib/timetable/solver';
import { ActionButton, EmptyState, Notice, SectionLabel, TabList } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
type View = 'book' | 'office' | 'timetable';

/**
 * Rooms, bookings and the timetable, in a school that runs scheduling in Core.
 * In Connect it says the school’s own system holds them and stops. Whether a
 * booking is allowed, whether two overlap and whether a timetable has a conflict
 * is the database’s answer (`20261001080000_scheduling.sql`); the solver here
 * proposes and a person publishes.
 */
export function SchedulingHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [view, setView] = useState<View>('book');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to book a space. It is your school’s, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs scheduling in Semester…</p>;
  const mode = resolveModuleMode('scheduling', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own system holds room booking and the timetable. Semester shows them here only when your school switches scheduling to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  const held = schedulingCapabilities(grants, school.id);
  const tabs: { id: View; label: string }[] = [{ id: 'book', label: 'Book a space' }];
  if (held.has('space:manage') || held.has('space:approve')) tabs.push({ id: 'office', label: 'Scheduling office' });
  if (held.has('timetable:run') || held.has('timetable:publish')) tabs.push({ id: 'timetable', label: 'Timetable' });
  const showing: View = tabs.some((t) => t.id === view) ? view : 'book';
  return (
    <>
      {tabs.length > 1 && <TabList label="Scheduling views" value={showing} onChange={setView} tabs={tabs} />}
      {showing === 'book' && <Book school={school.id} me={me} />}
      {showing === 'office' && <Office school={school.id} me={me} held={held} />}
      {showing === 'timetable' && <Timetable school={school.id} me={me} held={held} />}
    </>
  );
}

function useWrite(): { said: Said | null; busy: boolean; write: <T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string) => Promise<boolean> } {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
    setBusy(true); setSaid(null);
    try {
      const v = await attempt(what, run);
      const t = done(v);
      setSaid({ tone: 'ok', text: t }); say(t);
      return true;
    } catch (e) {
      const t = e instanceof Error ? e.message : 'That was not saved.';
      setSaid(e instanceof ServiceError && !e.answered ? { tone: 'unknown', text: t, retry: () => void write(what, run, done) } : { tone: 'refused', text: t });
      return false;
    } finally { setBusy(false); }
  }
  return { said, busy, write };
}

function useSpacesAndBookings(school: string, me: string, reads: number) {
  const [spaces, setSpaces] = useState<Space[] | string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all([loadSpaces(school), loadBookings(school, me)]).then(
      ([s, b]) => { if (live) { setSpaces(s); setBookings(b); } },
      (e: unknown) => { if (live) setSpaces(e instanceof Error ? e.message : 'The spaces could not be read.'); },
    );
    return () => { live = false; };
  }, [school, me, reads]);
  return { spaces, bookings };
}

function Book({ school, me }: { school: string; me: string }): ReactNode {
  const [reads, setReads] = useState(0);
  const { spaces, bookings } = useSpacesAndBookings(school, me, reads);
  const { said, busy, write } = useWrite();
  const [form, setForm] = useState({ space: '', purpose: 'meeting' as 'meeting' | 'event' | 'study', title: '', date: '', from: '', to: '' });
  const [now] = useState(() => Date.now());
  const bookable = Array.isArray(spaces) ? spaces.filter((s) => s.bookable && !s.retired) : [];
  const chosen = bookable.find((s) => s.code === form.space) ?? bookable[0];
  const starts = toInstant(form.date, form.from);
  const ends = toInstant(form.date, form.to);
  const name = (id: string) => (Array.isArray(spaces) ? spaces.find((s) => s.id === id)?.code : undefined) ?? 'a space';
  const mine = bookings.filter((b) => b.mine && b.status !== 'cancelled' && b.status !== 'declined');
  const taken = chosen ? bookings.filter((b) => b.status === 'confirmed' && b.spaceId === chosen.id && Date.parse(b.endsAt) > now) : [];

  return (
    <section aria-label="Book a space">
      <SectionLabel>Book a space</SectionLabel>
      <Result said={said} />
      {spaces === null && <p role="status">Reading the spaces…</p>}
      {typeof spaces === 'string' && <p role="alert">{spaces}</p>}
      {Array.isArray(spaces) && bookable.length === 0 && <EmptyState inline title="No bookable spaces" body="Your school’s scheduling office adds the rooms you can book." />}
      {bookable.length > 0 && chosen && (
        <Stack label="Request a booking">
          <Row end>
            <Field label="Space">
              {(ids) => (
                <select id={ids.id} className="input" value={chosen.code} onChange={(e) => setForm({ ...form, space: e.target.value })}>
                  {bookable.map((s) => <option key={s.id} value={s.code}>{s.code} · {s.name} · holds {s.capacity}{s.features.length ? ` · ${s.features.join(', ')}` : ''}</option>)}
                </select>
              )}
            </Field>
            <Field label="For">
              {(ids) => (
                <select id={ids.id} className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value as typeof form.purpose })}>
                  <option value="meeting">A meeting</option><option value="event">An event</option><option value="study">Study</option>
                </select>
              )}
            </Field>
          </Row>
          <Field label="Title">{(ids) => <input id={ids.id} className="input" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
          <Row end>
            <Field label="Date">{(ids) => <input id={ids.id} className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
            <Field label="From">{(ids) => <input id={ids.id} className="input" type="time" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />}</Field>
            <Field label="To">{(ids) => <input id={ids.id} className="input" type="time" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />}</Field>
          </Row>
          {taken.length > 0 && <Sub>Already booked: {taken.slice(0, 6).map((b) => `${at(b.startsAt)} to ${at(b.endsAt)}`).join(' · ')}</Sub>}
          <ActionButton tone="primary" disabled={busy || form.title.trim() === '' || starts === null || ends === null}
            onClick={() => void write(`request:${chosen.code}:${form.purpose}:${form.title}:${starts}:${ends}`, (k) => requestBooking(chosen.code, form.purpose, form.title.trim(), starts ?? '', ends ?? '', k),
              () => 'Requested. Someone in the scheduling office confirms or declines it.').then((ok) => { if (ok) { setForm({ ...form, title: '' }); setReads((n) => n + 1); } })}>
            Request it
          </ActionButton>
        </Stack>
      )}
      {mine.length > 0 && (
        <Rows label="Your bookings">
          {mine.map((b) => (
            <RowItem key={b.id}>
              <div><strong>{b.title}</strong> · {name(b.spaceId)} · {at(b.startsAt)} to {at(b.endsAt)} · {b.status}</div>
              {b.note && <Sub>{b.note}</Sub>}
              <Row><ActionButton tone="ghost" disabled={busy} onClick={() => void write(`cancel:${b.id}`, (k) => cancelBooking(b.id, k), () => 'Cancelled.').then((ok) => { if (ok) setReads((n) => n + 1); })}>Cancel</ActionButton></Row>
            </RowItem>
          ))}
        </Rows>
      )}
    </section>
  );
}

const PURPOSES: BookingPurpose[] = ['class', 'exam', 'meeting', 'event'];

function Office({ school, me, held }: { school: string; me: string; held: ReadonlySet<SchedulingCapability> }): ReactNode {
  const [reads, setReads] = useState(0);
  const { spaces, bookings } = useSpacesAndBookings(school, me, reads);
  const { said, busy, write } = useWrite();
  const [form, setForm] = useState({ code: '', name: '', building: '', capacity: '30', features: '', bookable: true });
  const [make, setMake] = useState({ space: '', purpose: 'class' as BookingPurpose, title: '', date: '', from: '', to: '' });
  const refresh = () => setReads((n) => n + 1);
  const list = Array.isArray(spaces) ? spaces : [];
  const name = (id: string) => list.find((s) => s.id === id)?.code ?? 'a space';
  const pending = bookings.filter((b) => b.status === 'requested');
  const starts = toInstant(make.date, make.from);
  const ends = toInstant(make.date, make.to);

  return (
    <section aria-label="Scheduling office">
      <SectionLabel>Scheduling office</SectionLabel>
      <Result said={said} />
      {typeof spaces === 'string' && <p role="alert">{spaces}</p>}
      {held.has('space:approve') && (
        <>
          <SectionLabel>Requests waiting</SectionLabel>
          {pending.length === 0 ? <p>Nothing is waiting.</p> : (
            <Rows label="Booking requests">
              {pending.map((b) => (
                <RowItem key={b.id}>
                  <div><strong>{b.title}</strong> · {name(b.spaceId)} · {b.purpose} · {at(b.startsAt)} to {at(b.endsAt)}</div>
                  {b.mine
                    ? <Sub>You requested this, so someone else decides it.</Sub>
                    : (
                      <Row>
                        <ActionButton disabled={busy} onClick={() => void write(`confirm:${b.id}`, (k) => decideBooking(b.id, true, '', k), () => 'Confirmed.').then((ok) => { if (ok) refresh(); })}>Confirm</ActionButton>
                        <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`decline:${b.id}`, (k) => decideBooking(b.id, false, '', k), () => 'Declined.').then((ok) => { if (ok) refresh(); })}>Decline</ActionButton>
                      </Row>
                    )}
                </RowItem>
              ))}
            </Rows>
          )}
          <Stack label="Book a class, an exam, a meeting or an event">
            <Row end>
              <Field label="Space">
                {(ids) => (
                  <select id={ids.id} className="input" value={make.space} onChange={(e) => setMake({ ...make, space: e.target.value })}>
                    <option value="">Choose a space</option>
                    {list.filter((s) => !s.retired).map((s) => <option key={s.id} value={s.code}>{s.code} · {s.name}</option>)}
                  </select>
                )}
              </Field>
              <Field label="For">
                {(ids) => (
                  <select id={ids.id} className="input" value={make.purpose} onChange={(e) => setMake({ ...make, purpose: e.target.value as BookingPurpose })}>
                    {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                )}
              </Field>
            </Row>
            <Field label="Title">{(ids) => <input id={ids.id} className="input" value={make.title} onChange={(e) => setMake({ ...make, title: e.target.value })} />}</Field>
            <Row end>
              <Field label="Date">{(ids) => <input id={ids.id} className="input" type="date" value={make.date} onChange={(e) => setMake({ ...make, date: e.target.value })} />}</Field>
              <Field label="From">{(ids) => <input id={ids.id} className="input" type="time" value={make.from} onChange={(e) => setMake({ ...make, from: e.target.value })} />}</Field>
              <Field label="To">{(ids) => <input id={ids.id} className="input" type="time" value={make.to} onChange={(e) => setMake({ ...make, to: e.target.value })} />}</Field>
            </Row>
            <ActionButton tone="primary" disabled={busy || make.space === '' || make.title.trim() === '' || starts === null || ends === null}
              onClick={() => void write(`make:${make.space}:${make.purpose}:${make.title}:${starts}:${ends}`, (k) => makeBooking(make.space, make.purpose, make.title.trim(), starts ?? '', ends ?? '', k), () => 'Booked.').then((ok) => { if (ok) refresh(); })}>
              Book it
            </ActionButton>
          </Stack>
        </>
      )}
      {held.has('space:manage') && (
        <>
          {list.length > 0 && (
            <Rows label="Spaces">
              {list.map((s) => (
                <RowItem key={s.id}>
                  <div><strong>{s.code}</strong> · {s.name}{s.building ? ` · ${s.building}` : ''} · holds {s.capacity}{s.features.length ? ` · ${s.features.join(', ')}` : ''}{s.bookable ? '' : ' · not bookable'}{s.retired ? ' · retired' : ''}</div>
                  {!s.retired && (
                    <Row>
                      <ActionButton tone="ghost" onClick={() => setForm({ code: s.code, name: s.name, building: s.building, capacity: String(s.capacity), features: s.features.join(', '), bookable: s.bookable })}>Edit</ActionButton>
                      <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`retire:${s.code}`, (k) => retireSpace(s.code, k), () => 'Retired. It stays in the history.').then((ok) => { if (ok) refresh(); })}>Retire</ActionButton>
                    </Row>
                  )}
                </RowItem>
              ))}
            </Rows>
          )}
          <Stack label="Save a space">
            <Row end>
              <Field label="Code" hint="Letters, digits, spaces, dots and hyphens, for example HALL-101.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />}</Field>
              <Field label="Name">{(ids) => <input id={ids.id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            </Row>
            <Row end>
              <Field label="Building">{(ids) => <input id={ids.id} className="input" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />}</Field>
              <Field label="Capacity">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />}</Field>
            </Row>
            <Field label="Features" hint="Comma-separated, for example projector, whiteboard.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />}</Field>
            <label><input type="checkbox" checked={form.bookable} onChange={(e) => setForm({ ...form, bookable: e.target.checked })} /> Members can request it</label>
            <ActionButton tone="primary" disabled={busy || form.code.trim() === '' || form.name.trim() === '' || !(Number(form.capacity) >= 1)}
              onClick={() => void write(`space:${form.code}:${form.name}:${form.capacity}:${form.features}:${form.bookable}`,
                (k) => saveSpace({ code: form.code.trim(), name: form.name.trim(), building: form.building.trim(), capacity: Number(form.capacity), features: form.features.split(',').map((f) => f.trim()).filter((f) => f !== ''), bookable: form.bookable }, k),
                () => 'Saved. The change is kept in the space’s history.').then((ok) => { if (ok) refresh(); })}>
              Save the space
            </ActionButton>
          </Stack>
        </>
      )}
    </section>
  );
}

function Timetable({ school, me, held }: { school: string; me: string; held: ReadonlySet<SchedulingCapability> }): ReactNode {
  const [reads, setReads] = useState(0);
  const { spaces } = useSpacesAndBookings(school, me, reads);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runsError, setRunsError] = useState('');
  const { said, busy, write } = useWrite();
  const [term, setTerm] = useState('2027SP');
  const [text, setText] = useState('ECON 1010 | 01 | 30 | Dr Rao | | MWF 09:00-09:50, MWF 10:00-10:50');
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<{ sections: SectionInput[]; assignments: Assignment[]; unplaced: Unplaced[]; conflicts: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadRuns(school, me).then((r) => { if (live) { setRuns(r); setRunsError(''); } }, (e: unknown) => { if (live) setRunsError(e instanceof Error ? e.message : 'The saved runs could not be read.'); });
    return () => { live = false; };
  }, [school, me, reads]);

  const rooms: RoomInput[] = Array.isArray(spaces) ? spaces.filter((s) => !s.retired).map((s) => ({ code: s.code, capacity: s.capacity, features: s.features, bookable: s.bookable })) : [];

  return (
    <section aria-label="Timetable">
      <SectionLabel>Timetable</SectionLabel>
      <Result said={said} />
      {held.has('timetable:run') && (
        <Stack label="Propose a timetable">
          <Field label="Term">{(ids) => <input id={ids.id} className="input" value={term} placeholder="2027SP" onChange={(e) => setTerm(e.target.value.toUpperCase())} />}</Field>
          <Field label="Sections" hint="One per line: COURSE | section | enrolment | instructor | needs | patterns the section may meet in.">
            {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          {error !== '' && <p role="alert">{error}</p>}
          <Row>
            <ActionButton tone="primary" disabled={busy || rooms.length === 0}
              onClick={() => {
                const parsed = parseSections(text);
                if ('error' in parsed) { setError(parsed.error); setProposal(null); return; }
                setError('');
                const r = solveTimetable(parsed.sections, rooms);
                setProposal({ sections: parsed.sections, assignments: r.assignments, unplaced: r.unplaced, conflicts: proposalConflicts(parsed.sections, rooms, r.assignments).length });
              }}>
              Propose a timetable
            </ActionButton>
          </Row>
          {rooms.length === 0 && <Sub>Add spaces in the scheduling office first; the solver needs rooms.</Sub>}
        </Stack>
      )}
      {proposal && (
        <section aria-label="The proposal">
          <SectionLabel>The proposal · {proposal.assignments.length} placed · {proposal.unplaced.length} not placed · {proposal.conflicts} conflicts</SectionLabel>
          <Sub>A rule proposed this, not a person; nothing is decided until a run is saved and a different person publishes it.</Sub>
          <Rows label="Proposed assignments">
            {proposal.assignments.map((a) => <RowItem key={`${a.course}${a.section}`}><div><strong>{a.course} {a.section}</strong> · {a.room} · {patternWords(a.meeting)}</div></RowItem>)}
          </Rows>
          {proposal.unplaced.map((u) => <Notice key={`${u.course}${u.section}`}>{u.course} {u.section} was not placed: {u.reason}.</Notice>)}
          <ActionButton tone="primary" disabled={busy || proposal.assignments.length === 0}
            onClick={() => void write(`run:${term}:${JSON.stringify(proposal.assignments)}`, (k) => saveRun(term, proposal.sections, proposal.assignments, k),
              (r) => `Saved. The database found ${r.conflicts} conflict${r.conflicts === 1 ? '' : 's'}. Someone else publishes it.`).then((ok) => { if (ok) setReads((n) => n + 1); })}>
            Save this run
          </ActionButton>
        </section>
      )}
      {runsError !== '' && <p role="alert">{runsError}</p>}
      {runs.length > 0 && (
        <Rows label="Saved runs">
          {runs.map((r) => (
            <RowItem key={r.id}>
              <div><strong>{r.term}</strong> · {at(r.savedAt)} · {r.assignments} assignments · {r.conflicts.length === 0 ? 'no conflicts' : `${r.conflicts.length} conflict${r.conflicts.length === 1 ? '' : 's'}`}{r.published ? ' · published' : ''}</div>
              {r.conflicts.length > 0 && <Sub>{r.conflicts.map((c) => `${c.kind}${c.sections ? ` (${c.sections.join(' and ')})` : c.section ? ` (${c.section})` : ''}`).join(' · ')}</Sub>}
              {held.has('timetable:publish') && !r.published && (r.mine
                ? <Sub>You saved this run, so someone else publishes it.</Sub>
                : <Row><ActionButton disabled={busy || r.conflicts.length > 0} onClick={() => void write(`publish:${r.id}`, (k) => publishRun(r.id, k), (v) => `Published. ${String(v.sections)} section${v.sections === 1 ? '' : 's'} now carry these meeting times.`).then((ok) => { if (ok) setReads((n) => n + 1); })}>Publish</ActionButton></Row>)}
            </RowItem>
          ))}
        </Rows>
      )}
    </section>
  );
}
