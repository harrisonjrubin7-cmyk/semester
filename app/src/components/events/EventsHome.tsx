import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import { toInstant } from '../../lib/scheduling/client';
import {
  HOST_WORDS, canManageEvents, cancelEvent, decideEvent, loadEvents, proposeEvent, publishDirect, rsvp, standing, type EventRow, type HostKind,
} from '../../lib/events/client';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

/**
 * Events, in a school that runs them in Core: published events with an RSVP and a
 * waitlist, a form to propose one, and the events office’s queue. In Connect it
 * says the school’s own system holds events and stops. Whether an event is
 * published, whether there is a place and who is next on the waitlist is the
 * database’s answer (`20261001090000_events.sql`).
 */
export function EventsHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see events. They are your school’s, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs events in Semester…</p>;
  const mode = resolveModuleMode('events', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own system holds events. Semester shows them here only when your school switches events to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  return <Events school={school.id} me={me} manager={canManageEvents(grants, school.id)} />;
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

function Events({ school, me, manager }: { school: string; me: string; manager: boolean }): ReactNode {
  const [events, setEvents] = useState<EventRow[] | string | null>(null);
  const [reads, setReads] = useState(0);
  const { said, busy, write } = useWrite();
  const [form, setForm] = useState({ hostKind: 'community' as HostKind, hostRef: '', title: '', description: '', location: '', space: '', date: '', from: '', to: '', capacity: '' });
  const [cancelling, setCancelling] = useState({ id: '', reason: '' });
  const [now] = useState(() => Date.now());
  const refresh = () => setReads((n) => n + 1);

  useEffect(() => {
    let live = true;
    loadEvents(school, me).then((e) => { if (live) setEvents(e); }, (e: unknown) => { if (live) setEvents(e instanceof Error ? e.message : 'The events could not be read.'); });
    return () => { live = false; };
  }, [school, me, reads]);

  const starts = toInstant(form.date, form.from);
  const ends = toInstant(form.date, form.to);
  const cap = form.capacity.trim() === '' ? null : Number(form.capacity);
  const upcoming = Array.isArray(events) ? events.filter((e) => e.state === 'published' && Date.parse(e.endsAt) > now) : [];
  const waiting = Array.isArray(events) ? events.filter((e) => e.state === 'proposed' && (manager || e.mine)) : [];
  const mineOther = Array.isArray(events) ? events.filter((e) => e.mine && (e.state === 'declined' || e.state === 'cancelled')) : [];

  return (
    <section aria-label="Events">
      <SectionLabel>Events</SectionLabel>
      <Result said={said} />
      {events === null && <p role="status">Reading events…</p>}
      {typeof events === 'string' && <p role="alert">{events}</p>}
      {Array.isArray(events) && upcoming.length === 0 && <EmptyState inline title="No upcoming events" body="Propose one below; the events office publishes it." />}
      {upcoming.length > 0 && (
        <Rows label="Upcoming events">
          {upcoming.map((e) => (
            <RowItem key={e.id}>
              <div><strong>{e.title}</strong> · {at(e.startsAt)} to {at(e.endsAt)}{e.location ? ` · ${e.location}` : ''} · {HOST_WORDS[e.hostKind]}: {e.hostRef}</div>
              {e.description && <Sub>{e.description}</Sub>}
              <Sub>{e.going ?? 0} going{e.capacity !== null ? ` of ${e.capacity}` : ''}{(e.waitlisted ?? 0) > 0 ? ` · ${e.waitlisted} waiting` : ''}. {standing(e)}</Sub>
              <Row>
                {(e.myStatus === null || e.myStatus === 'cancelled')
                  ? <ActionButton tone="primary" disabled={busy} onClick={() => void write(`rsvp:${e.id}:yes:${e.myStatus}`, (k) => rsvp(e.id, true, k), (s) => (s === 'going' ? 'You are going.' : 'The event is full; you are on the waitlist.')).then((ok) => { if (ok) refresh(); })}>I’m going</ActionButton>
                  : <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`rsvp:${e.id}:no:${e.myStatus}`, (k) => rsvp(e.id, false, k), () => 'Your RSVP is cancelled.').then((ok) => { if (ok) refresh(); })}>Cancel my RSVP</ActionButton>}
                {(e.mine || manager) && <ActionButton tone="ghost" onClick={() => setCancelling({ id: cancelling.id === e.id ? '' : e.id, reason: '' })}>Cancel the event…</ActionButton>}
              </Row>
              {cancelling.id === e.id && (
                <Stack label="Cancel this event">
                  <Field label="Reason" hint="At least five characters. The RSVPs stay on record.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={cancelling.reason} onChange={(ev) => setCancelling({ ...cancelling, reason: ev.target.value })} />}</Field>
                  <ActionButton tone="primary" disabled={busy || cancelling.reason.trim().length < 5} onClick={() => void write(`cancel:${e.id}:${cancelling.reason}`, (k) => cancelEvent(e.id, cancelling.reason.trim(), k), () => 'Cancelled. A space it booked is free again.').then((ok) => { if (ok) { setCancelling({ id: '', reason: '' }); refresh(); } })}>Cancel it</ActionButton>
                </Stack>
              )}
            </RowItem>
          ))}
        </Rows>
      )}

      {waiting.length > 0 && (
        <Rows label={manager ? 'Proposals waiting' : 'Your proposals'}>
          {waiting.map((e) => (
            <RowItem key={e.id}>
              <div><strong>{e.title}</strong> · {at(e.startsAt)} · {HOST_WORDS[e.hostKind]}: {e.hostRef} · waiting for the events office</div>
              {manager && (e.mine
                ? <Sub>You proposed this, so someone else decides it.</Sub>
                : (
                  <Row>
                    <ActionButton disabled={busy} onClick={() => void write(`publish:${e.id}`, (k) => decideEvent(e.id, true, '', k), () => 'Published.').then((ok) => { if (ok) refresh(); })}>Publish</ActionButton>
                    <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`decline:${e.id}`, (k) => decideEvent(e.id, false, '', k), () => 'Declined.').then((ok) => { if (ok) refresh(); })}>Decline</ActionButton>
                  </Row>
                ))}
            </RowItem>
          ))}
        </Rows>
      )}
      {mineOther.map((e) => <Sub key={e.id}>{e.title}: {e.state === 'declined' ? 'declined by the events office' : `cancelled — ${e.cancelReason}`}</Sub>)}

      <Stack label="Propose an event">
        <Row end>
          <Field label="Hosted by">
            {(ids) => (
              <select id={ids.id} className="input" value={form.hostKind} onChange={(e) => setForm({ ...form, hostKind: e.target.value as HostKind })}>
                {(Object.keys(HOST_WORDS) as HostKind[]).filter((k) => k !== 'office' || manager).map((k) => <option key={k} value={k}>{HOST_WORDS[k]}</option>)}
              </select>
            )}
          </Field>
          <Field label="Host name" hint="The office, community or course code.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={form.hostRef} onChange={(e) => setForm({ ...form, hostRef: e.target.value })} />}</Field>
        </Row>
        <Field label="Title">{(ids) => <input id={ids.id} className="input" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Field label="About it (optional)">{(ids) => <textarea id={ids.id} className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
        <Row end>
          <Field label="Where (optional)">{(ids) => <input id={ids.id} className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
          <Field label="Space code (optional)" hint="A campus space to book for it, for example HALL-101.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={form.space} onChange={(e) => setForm({ ...form, space: e.target.value.toUpperCase() })} />}</Field>
          <Field label="Capacity (optional)">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />}</Field>
        </Row>
        <Row end>
          <Field label="Date">{(ids) => <input id={ids.id} className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          <Field label="From">{(ids) => <input id={ids.id} className="input" type="time" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />}</Field>
          <Field label="To">{(ids) => <input id={ids.id} className="input" type="time" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />}</Field>
        </Row>
        <Row>
          <ActionButton tone="primary" disabled={busy || form.title.trim() === '' || form.hostRef.trim() === '' || starts === null || ends === null || (cap !== null && !(cap >= 1))}
            onClick={() => void write(`propose:${form.hostKind}:${form.hostRef}:${form.title}:${starts}`, (k) => proposeEvent({ hostKind: form.hostKind, hostRef: form.hostRef.trim(), title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), space: form.space.trim(), starts: starts ?? '', ends: ends ?? '', capacity: cap }, k),
              () => 'Proposed. The events office publishes or declines it.').then((ok) => { if (ok) { setForm({ ...form, title: '', description: '' }); refresh(); } })}>
            Propose it
          </ActionButton>
          {manager && (
            <ActionButton disabled={busy || form.title.trim() === '' || form.hostRef.trim() === '' || starts === null || ends === null || (cap !== null && !(cap >= 1))}
              onClick={() => void write(`direct:${form.hostRef}:${form.title}:${starts}`, (k) => publishDirect({ hostRef: form.hostRef.trim(), title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), space: form.space.trim(), starts: starts ?? '', ends: ends ?? '', capacity: cap }, k),
                () => 'Published as an office event.').then((ok) => { if (ok) { setForm({ ...form, title: '', description: '' }); refresh(); } })}>
              Publish as an office event
            </ActionButton>
          )}
        </Row>
      </Stack>
    </section>
  );
}
