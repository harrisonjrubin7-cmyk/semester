import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readGuardianCalendarProjection,
  readGuardianProjectionAccessHistory,
  type GuardianCalendarItem,
  type GuardianProjectionAccessEvent,
} from '../lib/guardianprojection';
import { SectionLabel } from './ui';
import { formatDateTime } from '../lib/locale';

type CalendarView = 'closed' | 'loading' | 'ready' | 'denied' | 'stale' | 'error';

interface CalendarState {
  context: string;
  view: CalendarView;
  items: GuardianCalendarItem[];
}

const statusLabel = (status: GuardianCalendarItem['status']) =>
  status === 'complete' ? 'Complete' : status === 'cancelled' ? 'Cancelled' : 'Scheduled';
const when = (value: string) => formatDateTime(value);

/**
 * One already-authorized subject's online-only calendar projection.
 *
 * `studentId` is never typed or searched here. Its only caller receives it
 * from the existing consent-bound family-share reader. The server remains the
 * authority and audits every explicit or timed refresh.
 */
export function GuardianCalendarProjection({
  actorId,
  studentId,
  shownAs,
  revalidateMs = 60_000,
}: {
  actorId: string | null;
  studentId: string;
  shownAs: string;
  revalidateMs?: number;
}) {
  const context = actorId ? `${actorId}:${studentId}` : '';
  const [state, setState] = useState<CalendarState>({ context, view: 'closed', items: [] });
  const generation = useRef(0);
  const running = useRef(false);
  const message = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    generation.current += 1;
    running.current = false;
    setState({ context, view: 'closed', items: [] });
    return () => { generation.current += 1; };
  }, [context]);

  const read = useCallback(async () => {
    if (!actorId || !studentId || running.current) return;
    const mine = ++generation.current;
    running.current = true;
    setState({ context, view: 'loading', items: [] });
    try {
      const result = await readGuardianCalendarProjection(studentId);
      if (mine !== generation.current) return;
      setState({ context, view: result.kind, items: result.items });
    } catch {
      if (mine !== generation.current) return;
      setState({ context, view: 'error', items: [] });
    } finally {
      if (mine === generation.current) running.current = false;
    }
  }, [actorId, context, studentId]);

  useEffect(() => {
    if (state.context !== context || state.view !== 'ready') return;
    const id = window.setInterval(() => void read(), Math.max(60_000, revalidateMs));
    return () => window.clearInterval(id);
  }, [context, read, revalidateMs, state.context, state.view]);

  useEffect(() => {
    if (state.context !== context || state.view !== 'ready' || state.items.length === 0) return;
    const expires = Math.min(...state.items.map((item) => Date.parse(item.expires_at)));
    const id = window.setTimeout(() => {
      generation.current += 1;
      running.current = false;
      setState({ context, view: 'stale', items: [] });
    }, Math.max(0, expires - Date.now()));
    return () => window.clearTimeout(id);
  }, [context, state]);

  useEffect(() => {
    if (state.context === context && (state.view === 'error' || state.view === 'denied' || state.view === 'stale')) {
      message.current?.focus();
    }
  }, [context, state.context, state.view]);

  if (!actorId) return null;
  const current = state.context === context ? state : { context, view: 'closed' as const, items: [] };

  return (
    <section className="guardian-projection" aria-label={`Calendar shared by ${shownAs}`}>
      {current.view === 'closed' && (
        <button type="button" className="btn btn-secondary" onClick={() => void read()}>Open calendar</button>
      )}
      {current.view === 'loading' && <p role="status" className="sharing-lead">Checking current access…</p>}
      {current.view === 'error' && (
        <>
          <p ref={message} tabIndex={-1} role="alert" className="sharing-lead">The calendar could not be checked. No calendar details are being kept on this device.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void read()}>Retry calendar</button>
        </>
      )}
      {current.view === 'denied' && (
        <>
          <p ref={message} tabIndex={-1} role="status" className="sharing-lead">Calendar access is unavailable. This can also mean there are no current notices.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void read()}>Check again</button>
        </>
      )}
      {current.view === 'stale' && (
        <>
          <p ref={message} tabIndex={-1} role="status" className="sharing-lead">This calendar view expired and was cleared.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void read()}>Check again</button>
        </>
      )}
      {current.view === 'ready' && (
        <>
          <div className="guardian-projection-heading">
            <p role="status" className="sharing-lead">Current calendar for {shownAs} · online only</p>
            <button type="button" className="btn btn-secondary" onClick={() => void read()}>Refresh access</button>
          </div>
          <ul className="sharing-list guardian-calendar-list">
            {current.items.map((item) => (
              <li key={item.item_id}>
                <strong>{item.title}</strong>
                <dl className="guardian-projection-fields">
                  <div><dt>Status</dt><dd>{statusLabel(item.status)}</dd></div>
                  <div><dt>Starts</dt><dd>{when(item.starts_at)}</dd></div>
                  <div><dt>Source checked</dt><dd>{when(item.source_observed_at)}</dd></div>
                  <div><dt>Access expires</dt><dd>{when(item.expires_at)}</dd></div>
                  <div><dt>Event reference</dt><dd>{item.item_id}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type HistoryView = 'closed' | 'loading' | 'ready' | 'error';

export function GuardianProjectionAccessHistory({ actorId }: { actorId: string | null }) {
  const [view, setView] = useState<HistoryView>('closed');
  const [owner, setOwner] = useState(actorId ?? '');
  const [events, setEvents] = useState<GuardianProjectionAccessEvent[]>([]);
  const generation = useRef(0);
  const running = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    generation.current += 1;
    running.current = false;
    setOwner(actorId ?? '');
    setEvents([]);
    setView('closed');
    return () => { generation.current += 1; };
  }, [actorId]);

  const read = async () => {
    if (!actorId || running.current) return;
    const mine = ++generation.current;
    running.current = true;
    setEvents([]);
    setView('loading');
    try {
      const next = await readGuardianProjectionAccessHistory();
      if (mine !== generation.current) return;
      setOwner(actorId);
      setEvents(next);
      setView('ready');
    } catch {
      if (mine !== generation.current) return;
      setView('error');
    } finally {
      if (mine === generation.current) running.current = false;
    }
  };

  useEffect(() => {
    if (view === 'error') alert.current?.focus();
  }, [view]);

  if (!actorId) return null;
  const current = owner === actorId ? events : [];
  return (
    <section aria-labelledby="guardian-access-history-title" className="guardian-access-history">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="guardian-access-history-title">Guardian calendar access</span>
      </SectionLabel>
      <p className="sharing-lead">Your latest 200 allow and deny decisions. This history contains counts and field names, never calendar contents.</p>
      {view === 'closed' && <button type="button" className="btn btn-secondary" onClick={() => void read()}>Load access history</button>}
      {view === 'loading' && <p role="status" className="sharing-lead">Loading access history…</p>}
      {view === 'error' && (
        <>
          <p ref={alert} tabIndex={-1} role="alert" className="sharing-lead">Access history could not be loaded.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void read()}>Retry history</button>
        </>
      )}
      {view === 'ready' && (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => void read()}>Refresh history</button>
          {current.length === 0 ? (
            <p role="status" className="sharing-lead">No guardian calendar access has been recorded for this account.</p>
          ) : (
            <ol className="guardian-access-list">
              {current.map((event, index) => (
                <li key={`${event.read_at}:${event.guardian_id}:${index}`}>
                  <strong>{event.decision === 'allow' ? 'Allowed' : 'Denied'}</strong>
                  <span>{when(event.read_at)}</span>
                  <span>Guardian {event.guardian_id}</span>
                  <span>{event.projection_count} calendar {event.projection_count === 1 ? 'notice' : 'notices'} · {event.reason.replaceAll('_', ' ')}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
