import { useMemo, useState } from 'react';
import { blocksFor } from '../data/catalog';
import { clock, dateToIso, daysBetween } from '../lib/date';
import { readDue } from '../lib/duetime';
import { pathSnapshot, nextTodayDecision, showsTodayDecisionSurface } from '../lib/today-decision';
import { appointmentsOn, tasksOn, upcomingItems } from '../lib/select';
import { useNow, useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { ActionButton, Meter, SectionLabel } from './ui';
import { goMine } from '../lib/openmine';
import { goCal } from '../lib/opencal';

interface TimelineRow {
  id: string;
  at: number;
  when: string;
  title: string;
  meta: string;
  open: () => void;
}

function dayName(date: Date, offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
}

function timeLabel(minutes: number | null, fallback = 'All day'): string {
  return minutes == null || minutes >= 24 * 60 ? fallback : clock(minutes);
}

function syncLabel(lastSync: { at: number } | null | undefined): string {
  if (!lastSync) return 'No account sync recorded on this device';
  const syncedAt = new Date(lastSync.at);
  if (Number.isNaN(syncedAt.getTime())) return 'Last account sync time is unavailable';
  return `Last account sync ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(syncedAt)}`;
}

export function TodayDecisionSurface() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const path = useMemo(
    () => pathSnapshot(state.requirements, state.taken),
    [state.requirements, state.taken],
  );
  const upcoming = useMemo(() => upcomingItems(catalog, now), [catalog, now]);
  const reviewDue = useMemo(
    () => Object.values(state.reviews).filter((review) => review.due <= now.getTime()).length,
    [state.reviews, now],
  );
  const decision = useMemo(
    () => nextTodayDecision({
      path,
      upcoming,
      done: state.done,
      reviewDue,
      catalogEmpty: catalog.empty,
    }),
    [path, upcoming, state.done, reviewDue, catalog.empty],
  );
  const timeline = useMemo(() => {
    const rows: TimelineRow[] = [];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);

    for (const item of upcoming) {
      if (state.done[item.id] || item.date < start || item.date >= end) continue;
      const offset = daysBetween(start, item.date);
      rows.push({
        id: `course:${item.id}`,
        at: item.date.getTime() + Math.min(item.dueAt, 24 * 60 - 1) * 60_000,
        when: `${dayName(item.date, offset)} · ${timeLabel(item.dueAt, item.dueShort)}`,
        title: item.title,
        meta: item.checked?.confirmed ? 'Confirmed course source' : 'Course date · verify source',
        open: () => dispatch({ type: 'openItem', id: item.id }),
      });
    }

    for (let offset = 0; offset < 3; offset += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      const label = dayName(date, offset);
      for (const task of tasksOn(state.tasks, date).filter((candidate) => !candidate.done)) {
        const minutes = readDue(task.time);
        rows.push({
          id: `task:${task.id}`,
          at: date.getTime() + (minutes ?? 24 * 60 - 1) * 60_000,
          when: `${label} · ${timeLabel(minutes, task.time.trim() || 'No time')}`,
          title: task.title,
          meta: 'Your task',
          open: () => goMine(dispatch, 'tasks'),
        });
      }
      for (const appointment of appointmentsOn(state.appointments, date)) {
        rows.push({
          id: `appointment:${appointment.id}:${dateToIso(date)}`,
          at: date.getTime() + (appointment.at ?? 0) * 60_000,
          when: `${label} · ${timeLabel(appointment.at)}`,
          title: appointment.title,
          meta: appointment.where || 'Your appointment',
          open: () => goMine(dispatch, 'appointments'),
        });
      }
      for (const block of blocksFor(catalog, date).filter((candidate) => !candidate.optional && !candidate.canceled)) {
        if (offset === 0 && block.at < now.getHours() * 60 + now.getMinutes()) continue;
        rows.push({
          id: `class:${dateToIso(date)}:${block.c}:${block.at}`,
          at: date.getTime() + block.at * 60_000,
          when: `${label} · ${timeLabel(block.at)}`,
          title: block.title,
          meta: block.c ? catalog.byId[block.c]?.code || 'Class' : block.meta || 'Class',
          open: () => goCal(dispatch, dateToIso(date)),
        });
      }
    }
    return rows.sort((a, b) => a.at - b.at).slice(0, 4);
  }, [catalog, dispatch, now, state.appointments, state.done, state.tasks, upcoming]);

  // Other product roles retain their established home. A degree-path briefing
  // addressed to faculty, staff, applicants or alumni would be false role
  // exposure rather than a helpful empty state.
  if (!showsTodayDecisionSurface(state.role)) return null;

  const openDecision = () => {
    if (decision.itemId) dispatch({ type: 'openItem', id: decision.itemId });
    else dispatch({ type: 'go', screen: decision.destination });
  };
  const syncLine = syncLabel(state.lastSync);

  return (
    <section className="today-decision-surface" aria-label="Today decision briefing">
      <Blueprint className="today-path-snapshot">
        <SectionLabel>Your path</SectionLabel>
        <h2>{path.heading}</h2>
        <p>{path.detail}</p>
        <div className="today-path-numbers">
          <strong>{path.total > 0 ? `${path.covered} / ${path.total}` : 'Details needed'}</strong>
          <span>{path.total > 0 ? 'recorded requirements covered' : path.creditLine}</span>
        </div>
        {path.total > 0 && (
          <Meter
            pct={path.percent}
            height={7}
            label={`${path.covered} of ${path.total} recorded requirements covered by finished or in-progress courses, ${path.percent} percent. This is not degree completion.`}
          />
        )}
        {path.total > 0 && <p className="today-path-credit">{path.creditLine}</p>}
        <button type="button" className="workspace-text-button" onClick={() => dispatch({ type: 'go', screen: 'degree' })}>
          View My Path →
        </button>
        <details className="today-why">
          <summary>How this status is calculated</summary>
          <p>{path.source}</p>
        </details>
      </Blueprint>

      <Blueprint className="today-next-action">
        <SectionLabel>Next best step</SectionLabel>
        {dismissed === decision.id ? (
          <p role="status" className="today-dismissed">
            Hidden for this visit.{' '}
            <button type="button" className="workspace-text-button" onClick={() => setDismissed(null)}>Undo</button>
          </p>
        ) : (
          <>
            <h2>{decision.title}</h2>
            <p>{decision.body}</p>
            <ActionButton tone="primary" onClick={openDecision}>{decision.action}</ActionButton>
            <div className="today-action-tools">
              <details className="today-why">
                <summary>Why am I seeing this?</summary>
                <p>{decision.why}</p>
                <p><strong>Source:</strong> {decision.source}</p>
              </details>
              <button type="button" className="workspace-text-button" onClick={() => setDismissed(decision.id)}>
                Not now
              </button>
            </div>
          </>
        )}
      </Blueprint>

      <aside className="today-near-term" aria-labelledby="today-near-term-heading">
        <SectionLabel>Next 72 hours</SectionLabel>
        <h2 id="today-near-term-heading">What is coming up</h2>
        {timeline.length > 0 ? (
          <div className="today-timeline">
            {timeline.map((row) => (
              <button key={row.id} type="button" className="today-timeline-row" onClick={row.open}>
                <span>
                  <small>{row.when}</small>
                  <strong>{row.title}</strong>
                  <small>{row.meta}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="today-clear">Nothing unfinished is recorded in the next 72 hours.</p>
        )}
        <button type="button" className="workspace-text-button" onClick={() => goCal(dispatch, dateToIso(now))}>
          See full plan →
        </button>
        <p className="today-sync-status">{syncLine}</p>
      </aside>
    </section>
  );
}
