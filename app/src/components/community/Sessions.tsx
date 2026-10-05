import { useCallback, useEffect, useState } from 'react';
import { MAX_SESSION_CAPACITY } from '../../community/communities';
import {
  createSession,
  joinSession,
  leaveSession,
  loadSessions,
  type SessionRow,
  type Venue,
} from '../../community/client';
import { ActionButton, Notice, SectionLabel } from '../ui';
import { formatDateTime } from '../../lib/locale';

const when = (iso: string) =>
  formatDateTime(new Date(iso), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Study sessions in one course or study-group community.
 *
 * A venue comes from the school's approved list — never a free-text place — so
 * nobody is asked to meet at somebody's room. The list shows how many places
 * are taken, never who took them.
 */
export function Sessions({ communityId }: { communityId: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [hosting, setHosting] = useState(false);
  const [title, setTitle] = useState('');
  const [venueId, setVenueId] = useState('');
  const [starts, setStarts] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [capacity, setCapacity] = useState(6);

  const refresh = useCallback(async () => {
    try {
      const next = await loadSessions(communityId);
      setSessions(next.sessions);
      setVenues(next.venues);
      setVenueId((old) => old || next.venues[0]?.id || '');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not load study sessions.');
    }
  }, [communityId]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const act = (work: () => Promise<void>, done: string) => {
    setBusy(true);
    void work()
      .then(async () => {
        await refresh();
        setNotice(done);
      })
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? 'Approved venue';

  return (
    <section aria-labelledby={`sessions-${communityId}`} style={{ marginTop: 'var(--sp-6)' }}>
      <SectionLabel aside={sessions.length ? `${sessions.length}` : undefined}>
        <span id={`sessions-${communityId}`}>Study with others</span>
      </SectionLabel>
      {notice && <p role="status">{notice}</p>}
      {sessions.length === 0 && <p style={{ color: 'var(--app-dim)' }}>No upcoming sessions.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-3)' }}>
        {sessions.map((s) => (
          <li key={s.id} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            <strong>{s.title}</strong>
            <span>
              {when(s.startsAt)} · {venueName(s.venueId)}
            </span>
            <span style={{ color: 'var(--app-dim)' }}>
              {s.taken} of {s.capacity} places taken{s.joined ? ' · you’re going' : ''}
            </span>
            <div>
              {s.joined ? (
                <ActionButton disabled={busy} onClick={() => act(() => leaveSession(s.id), 'You left the session.')}>
                  Leave session
                </ActionButton>
              ) : (
                <ActionButton
                  disabled={busy || s.taken >= s.capacity}
                  onClick={() => act(() => joinSession(s.id), 'You’re in. It’s on your list here.')}
                >
                  {s.taken >= s.capacity ? 'Full' : 'Join session'}
                </ActionButton>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!hosting ? (
        <ActionButton style={{ marginTop: 'var(--sp-4)' }} onClick={() => setHosting(true)}>
          Host a session
        </ActionButton>
      ) : venues.length === 0 ? (
        <Notice>Your school hasn’t approved any study venues yet, so sessions can’t be hosted here.</Notice>
      ) : (
        <form
          aria-label="Host a study session"
          style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}
          onSubmit={(event) => {
            event.preventDefault();
            const start = new Date(starts);
            if (Number.isNaN(start.getTime())) return;
            act(
              () =>
                createSession({
                  communityId,
                  venueId,
                  title: title.trim(),
                  startsAt: start.toISOString(),
                  endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
                  capacity,
                }),
              'Session created.',
            );
            setHosting(false);
            setTitle('');
          }}
        >
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            What you’ll work on
            <input className="input" required minLength={2} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Where (approved campus venues only)
            <select className="input" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Starts
            <input className="input" type="datetime-local" required value={starts} onChange={(e) => setStarts(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Length
            <select className="input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[30, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? '' : 's'}`}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Places
            <select className="input" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
              {Array.from({ length: MAX_SESSION_CAPACITY - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button className="btn btn-primary" disabled={busy || !title.trim() || !starts || !venueId}>
              Create session
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setHosting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
