import { useStore } from '../state/store';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, EmptyState, SectionLabel, Segmented } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { HourGrid } from '../components/HourGrid';
import { KindKey } from '../components/KindKey';
import { WeekGrid } from '../components/WeekGrid';
import { kindOf } from '../lib/kinds';
import {
  DOW,
  DOW_INITIALS,
  MONTHS,
  dateToIso,
  isoToDate,
  longLabel,
  minutesNow,
  monthGrid,
  sameDay,
} from '../lib/date';
import {
  appointmentsOn,
  datedEvents,
  datedItems,
  feedEventsOn,
  hoursFor,
  itemsOn,
  railFor,
} from '../lib/select';
import type { Course, CourseId, DatedEvent, DatedItem, EventKind } from '../lib/types';

/**
 * The calendar has two independent axes.
 *
 * The **view** decides the grain — a single day hour by hour, a month grid, or
 * the whole semester at once. The **source** decides what is on it: classes,
 * deadlines and campus events combined, or any one of them on its own. Keeping
 * them independent means "just my classes, for the whole semester" and "every
 * single thing happening today" are both one tap away.
 */

const SOURCES = [
  { id: 'all', label: 'All' },
  { id: 'classes', label: 'Classes' },
  { id: 'deadlines', label: 'Due' },
  { id: 'campus', label: 'Campus' },
] as const;

type Source = (typeof SOURCES)[number]['id'];

const EV_FILTERS = ['All', 'Athletics', 'Clubs', 'University', 'Saved'] as const;

/** Colour a course consistently wherever it appears on the calendar. */
function courseTint(courses: Course[], id: CourseId | null): string {
  if (!id) return 'var(--app-accent-deep)';
  const index = courses.findIndex((c) => c.id === id);
  // A single accent, stepped in opacity — the system is mono by design, so
  // courses are distinguished by weight rather than by inventing new hues.
  const steps = [1, 0.78, 0.56, 0.38];
  return `color-mix(in srgb, var(--app-accent) ${(steps[index % steps.length] ?? 0.5) * 100}%, transparent)`;
}

// ── Day ───────────────────────────────────────────────────────────────────

function DayView() {
  const { state, dispatch, now, catalog } = useStore();
  const day = state.calDay ? isoToDate(state.calDay) : now;
  const isToday = sameDay(day, now);
  const source = state.calSource;

  const rail = source === 'all' || source === 'classes' ? railFor(catalog, day, state.appointments) : [];
  const due = source === 'all' || source === 'deadlines'
    ? datedItems(catalog, now).filter((i) => sameDay(i.date, day))
    : [];
  const events = source === 'all' || source === 'campus'
    ? datedEvents(now, state.sample).filter((e) => sameDay(e.date, day))
    : [];
  const tasks = source === 'all' || source === 'deadlines' ? appointmentsOn([], day) : [];
  const myTasks = source === 'all' || source === 'deadlines'
    ? state.tasks.filter((t) => t.date === dateToIso(day))
    : [];

  // Anything a connected calendar says is on — Brightspace, Outlook, Zoom.
  // It sits in its own section, labelled, so a feed can never be mistaken for
  // a date the syllabus stated.
  const feedToday =
    source === 'all' || source === 'campus' ? feedEventsOn(state.feedEvents, day) : [];

  const empty =
    rail.length === 0 &&
    due.length === 0 &&
    events.length === 0 &&
    myTasks.length === 0 &&
    feedToday.length === 0;

  return (
    <div style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepDay', delta: -1 })}
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="bare"
          onClick={() => dispatch({ type: 'setCalDay', date: null })}
          style={{ width: 'auto', textAlign: 'center' }}
        >
          <span className="chrome-text" style={{ fontSize: 20, display: 'block' }}>
            {isToday ? 'Today' : DOW[day.getDay()]}
          </span>
          <span className="kicker" style={{ display: 'block' }}>
            {MONTHS[day.getMonth()]} {day.getDate()}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepDay', delta: 1 })}
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {empty && (
        <EmptyState
          title="Nothing on."
          body={
            source === 'all'
              ? 'No classes, no deadlines, no events. A genuinely free day.'
              : 'Nothing from this source. Try another filter.'
          }
        />
      )}

      {/*
        The grid first, the list under it. They answer different questions: the
        grid shows the shape of the day — where the gaps are, what collides —
        and the list gives each thing room for its detail. Neither replaces the
        other, and the grid is the one you want first.
      */}
      {rail.length > 0 && (
        <>
          <SectionLabel style={{ margin: '0 0 6px' }}>By the hour</SectionLabel>
          <KindKey compact />
          <HourGrid
            blocks={hoursFor(catalog, day, state.appointments)}
            now={isToday ? minutesNow(now) : null}
            style={{ margin: '14px 0 26px' }}
          />
        </>
      )}

      {rail.length > 0 && (
        <>
          <SectionLabel style={{ margin: '0 0 12px' }}>The rail</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rail.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <div
                  style={{
                    width: 56,
                    flex: 'none',
                    textAlign: 'right',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 14,
                    paddingTop: 12,
                    opacity: 0.6,
                  }}
                >
                  {b.time}
                </div>
                <div style={{ width: 1, background: 'var(--app-line)', position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      left: -3,
                      width: 7,
                      height: 7,
                      background: b.canceled
                        ? 'var(--app-track)'
                        : b.mine
                          ? 'transparent'
                          : courseTint(catalog.courses, b.c),
                      border: b.mine ? '1px solid var(--app-accent)' : 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1, padding: '11px 0 15px', minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 18,
                      lineHeight: 1.15,
                      opacity: b.canceled ? 0.45 : 1,
                      textDecoration: b.canceled ? 'line-through' : 'none',
                    }}
                  >
                    {b.title}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    {b.mine && (
                      <span className="tag tag-neutral" style={{ marginRight: 6 }}>
                        Yours
                      </span>
                    )}
                    {b.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {due.length > 0 && (
        <>
          <SectionLabel>Due</SectionLabel>
          {due.map((i) => (
            <button
              key={i.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: i.id })}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span className="tag tag-accent">{catalog.byId[i.c]?.code}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{i.title}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>{i.dueTime}</span>
              </span>
            </button>
          ))}
        </>
      )}

      {myTasks.length > 0 && (
        <>
          <SectionLabel>Yours</SectionLabel>
          {myTasks.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
                opacity: t.done ? 0.45 : 1,
              }}
            >
              <span className="tag tag-neutral">
                {t.courseId ? catalog.byId[t.courseId]?.code : 'Personal'}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 14,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}
              >
                {t.title}
              </span>
            </div>
          ))}
        </>
      )}

      {events.length > 0 && (
        <>
          <SectionLabel>On campus</SectionLabel>
          {events.map((e) => (
            <button
              key={e.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openEvent', id: e.id })}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span className="tag tag-outline">{e.kind}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{e.title}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>
                  {e.time} · {e.where}
                </span>
              </span>
            </button>
          ))}
        </>
      )}

      {feedToday.length > 0 && (
        <>
          <SectionLabel>From your calendars</SectionLabel>
          {feedToday.map((e) => {
            const feed = state.feeds.find((f) => f.id === e.sourceId);
            return (
              <div
                key={e.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--app-line)',
                }}
              >
                <span
                  style={{
                    width: 54,
                    flex: 'none',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 12,
                    opacity: 0.6,
                  }}
                >
                  {e.time}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>
                    {e.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>
                    {feed?.name ?? 'Calendar'}
                    {e.where ? ` · ${e.where}` : ''}
                  </span>
                </span>
              </div>
            );
          })}
        </>
      )}

      {tasks.length > 0 && null}
      <div style={{ height: 22 }} />
    </div>
  );
}

// ── Week ──────────────────────────────────────────────────────────────────

/**
 * The week as a timetable.
 *
 * The question most calendar-opening is really asking is when you are free,
 * and that is a comparison across days — which needs the days beside each
 * other, on the same hours. Seven day views in sequence cannot answer it.
 *
 * Tapping a column opens that day, because this view is deliberately short on
 * detail: at phone width a column is forty pixels and a block gets a short
 * label, so the week is for shape and the day is for reading.
 */
function WeekView() {
  const { state, dispatch, now, catalog } = useStore();
  const anchor = state.calDay ? isoToDate(state.calDay) : now;
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      date,
      isToday: sameDay(date, now),
      blocks: hoursFor(catalog, date, state.appointments),
      onOpen: () => {
        dispatch({ type: 'setCalDay', date: dateToIso(date) });
        dispatch({ type: 'setCalView', view: 'day' });
      },
    };
  });

  const step = (delta: number) => {
    const to = new Date(start);
    to.setDate(start.getDate() + delta * 7);
    dispatch({ type: 'setCalDay', date: dateToIso(to) });
  };

  const last = new Date(start);
  last.setDate(start.getDate() + 6);
  const total = days.reduce((n, d) => n + d.blocks.length, 0);

  return (
    <div style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => step(-1)}
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="bare"
          onClick={() => dispatch({ type: 'setCalDay', date: null })}
          style={{ width: 'auto', textAlign: 'center' }}
        >
          <span className="chrome-text" style={{ fontSize: 18, display: 'block' }}>
            {MONTHS[start.getMonth()]} {start.getDate()} –{' '}
            {start.getMonth() === last.getMonth() ? '' : `${MONTHS[last.getMonth()]} `}
            {last.getDate()}
          </span>
          <span className="kicker" style={{ display: 'block' }}>
            {total} {total === 1 ? 'thing' : 'things'} on
          </span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => step(1)}
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <KindKey compact />
      {total === 0 ? (
        <EmptyState
          title="Nothing this week."
          body="No classes and nothing of your own. Add something under Mine → Events."
        />
      ) : (
        <>
          <WeekGrid days={days} now={minutesNow(now)} style={{ marginTop: 14 }} />
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 14, lineHeight: 1.5 }}>
            Tap a date to open that day in full. Deadlines are not on this grid — they are a due
            time rather than a span, and the month view is where they read best.
          </div>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

// ── Month ─────────────────────────────────────────────────────────────────

function MonthView() {
  const { state, dispatch, now, catalog } = useStore();
  const { calYear, calMonth, calSource } = state;
  const cells = monthGrid(calYear, calMonth);

  // What lands on each day of this month, per the current source filter.
  const marks: Record<number, { c: CourseId | null; kind: string; tint?: string }[]> = {};
  const add = (d: Date, mark: { c: CourseId | null; kind: string; tint?: string }) => {
    if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) return;
    (marks[d.getDate()] ??= []).push(mark);
  };

  if (calSource === 'all' || calSource === 'deadlines') {
    datedItems(catalog, now).forEach((i) => add(i.date, { c: i.c, kind: 'due' }));
    state.tasks.forEach((t) => {
      if (t.date) add(isoToDate(t.date), { c: t.courseId, kind: 'mine' });
    });
  }
  // Your own events, in the colour the day and week grids give them, so the
  // three views agree about what a colour means.
  if (calSource === 'all' || calSource === 'classes') {
    state.appointments.forEach((a) =>
      add(isoToDate(a.date), { c: null, kind: 'appt', tint: kindOf(a.kind).tint }),
    );
  }
  if (calSource === 'all' || calSource === 'campus') {
    datedEvents(now, state.sample).forEach((e) => add(e.date, { c: null, kind: 'event' }));
    state.feedEvents.forEach((e) => add(isoToDate(e.date), { c: e.courseId, kind: 'feed' }));
  }
  if (calSource === 'classes') {
    // Mark every day that has a class on it, so a term's teaching days show up.
    for (let d = 1; d <= new Date(calYear, calMonth + 1, 0).getDate(); d++) {
      const date = new Date(calYear, calMonth, d);
      railFor(catalog, date, []).forEach((b) => add(date, { c: b.c, kind: 'class' }));
    }
  }

  // Nothing was selected until you tapped, so the month opened with an empty
  // half-screen under a heading that said "Pick a day". Today is the day you
  // came to look at nine times out of ten, so it starts selected — and when
  // you are looking at another month, its first day stands in rather than
  // nothing at all.
  const inThisMonth = now.getFullYear() === calYear && now.getMonth() === calMonth;
  const selectedDay = state.selDate
    ? Number(state.selDate.split('-')[2])
    : inThisMonth
      ? now.getDate()
      : 1;
  const selItems = itemsOn(catalog, now, calYear, calMonth, selectedDay);

  return (
    <div style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepMonth', delta: -1 })}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div
          className="chrome-text"
          style={{ fontSize: 20, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {MONTHS[calMonth]} {calYear}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepMonth', delta: 1 })}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 6 }}
      >
        {DOW_INITIALS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-heading)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.45,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <Blueprint
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7,1fr)',
          gap: 1,
          background: 'var(--app-line)',
          padding: 1,
        }}
      >
        {cells.map((d, i) => {
          if (d === null) {
            return <div key={i} style={{ aspectRatio: '1', background: 'var(--app-bg)' }} />;
          }
          const isToday = sameDay(now, new Date(calYear, calMonth, d));
          const isSelected = selectedDay === d;
          const dots = (marks[d] ?? []).slice(0, 4);
          return (
            <button
              key={i}
              type="button"
              className="bare"
              onClick={() => dispatch({ type: 'selectDate', date: `${calYear}-${calMonth}-${d}` })}
              style={{
                aspectRatio: '1',
                background: isSelected ? 'var(--app-hero)' : 'var(--app-bg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                border: isToday ? '1px solid var(--app-accent)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 15,
                  opacity: isToday || isSelected ? 1 : 0.8,
                  color: isToday ? 'var(--app-accent)' : 'var(--app-fg)',
                }}
              >
                {d}
              </span>
              <span style={{ display: 'flex', gap: 2, height: 4 }}>
                {dots.map((m, k) => (
                  <span
                    key={k}
                    style={{
                      width: 4,
                      height: 4,
                      background:
                        m.kind === 'mine'
                          ? 'transparent'
                          : (m.tint ?? courseTint(catalog.courses, m.c)),
                      border: m.kind === 'mine' ? '1px solid var(--app-accent)' : 'none',
                      borderRadius: m.kind === 'event' || m.kind === 'appt' ? '50%' : 0,
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </Blueprint>

      {/*
        The grid draws three different marks and, until now, explained none of
        them: a square meant a deadline in that course's colour, a circle meant
        a campus event, an outline meant something of your own. Nobody was ever
        going to work that out, which made the whole month view decorative.
      */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          marginTop: 10,
          fontSize: 10.5,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.5,
        }}
      >
        {(
          [
            ['Due', { background: 'var(--app-accent)' }],
            ['Campus', { background: 'var(--app-accent)', borderRadius: '50%' }],
            ['Yours', { border: '1px solid var(--app-accent)' }],
          ] as const
        ).map(([label, mark]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 5, height: 5, flex: 'none', ...mark }} />
            {label}
          </span>
        ))}
        <span style={{ opacity: 0.8 }}>Colour = course</span>
      </div>
      {/* The same key the day and week grids carry, so a colour means the same
          thing in every view rather than three private schemes. */}
      <KindKey compact />

      <SectionLabel style={{ margin: '20px 0 6px' }}>
        {DOW[new Date(calYear, calMonth, selectedDay).getDay()]} · {MONTHS[calMonth]}{' '}
        {selectedDay}
        {inThisMonth && selectedDay === now.getDate() ? ' · today' : ''}
      </SectionLabel>

      {selItems.map((i) => (
        <button
          key={i.id}
          type="button"
          className="bare tappable"
          onClick={() => dispatch({ type: 'openItem', id: i.id })}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <span className="tag tag-accent">{catalog.byId[i.c]?.code}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{i.title}</span>
            <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>{i.dueTime}</span>
          </span>
        </button>
      ))}

      {selItems.length === 0 && (
        <div style={{ padding: '12px 0 2px', fontSize: 14, opacity: 0.55 }}>
          Nothing due this day.
        </div>
      )}

      {/* Always offered, including on an empty day: this list is deadlines
          only, and classes and anything of your own live in the day view. */}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => {
          dispatch({
            type: 'setCalDay',
            date: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`,
          });
          dispatch({ type: 'setCalView', view: 'day' });
        }}
        style={{
          height: 42,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontSize: 11,
          marginTop: 14,
        }}
      >
        See classes and events that day
      </button>
      <div style={{ height: 22 }} />
    </div>
  );
}

// ── Semester ──────────────────────────────────────────────────────────────

/**
 * The whole term on one screen, week by week.
 *
 * A month grid answers "what is this week"; this answers "how bad does October
 * get" — the question you actually have when deciding whether to take on
 * something new.
 */
function SemesterView() {
  const { state, dispatch, now, catalog } = useStore();
  const source = state.calSource;

  const items = source === 'all' || source === 'deadlines' ? datedItems(catalog, now) : [];
  const events = source === 'all' || source === 'campus' ? datedEvents(now, state.sample) : [];

  // Weeks from the first Sunday on or before the earliest thing, to the last.
  const dates = [...items.map((i) => i.date), ...events.map((e) => e.date)];
  if (dates.length === 0) {
    return (
      <div style={{ padding: 18 }}>
        <EmptyState title="Nothing to plot." body="Try another source filter." />
      </div>
    );
  }
  const first = new Date(Math.min(...dates.map((d) => d.getTime())));
  const last = new Date(Math.max(...dates.map((d) => d.getTime())));
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());

  const weeks: { start: Date; items: DatedItem[]; events: DatedEvent[] }[] = [];
  for (let cursor = new Date(start); cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weeks.push({
      start: weekStart,
      items: items.filter((i) => i.date >= weekStart && i.date < weekEnd),
      events: events.filter((e) => e.date >= weekStart && e.date < weekEnd),
    });
  }

  const busiest = Math.max(1, ...weeks.map((w) => w.items.length));

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 16, textWrap: 'pretty' }}>
        {items.length} deadlines and {events.length} events across {weeks.length} weeks. The bar is
        how loaded each week is; exams are marked.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {weeks.map((w, i) => {
          const isNow = now >= w.start && now < new Date(w.start.getTime() + 7 * 86400000);
          const exams = w.items.filter((it) => it.kind === 'Exam');
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '10px 0',
                borderBottom: '1px solid var(--app-line)',
                background: isNow ? 'var(--app-panel)' : 'transparent',
              }}
            >
              <div
                style={{
                  width: 46,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.05,
                  color: isNow ? 'var(--app-accent)' : 'var(--app-fg)',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.12em', opacity: 0.5 }}>
                  {MONTHS[w.start.getMonth()].toUpperCase()}
                </div>
                <div style={{ fontSize: 19 }}>{w.start.getDate()}</div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    height: 8,
                    alignItems: 'stretch',
                    marginTop: 4,
                    marginBottom: 6,
                  }}
                >
                  {w.items.length === 0 && w.events.length === 0 ? (
                    <div
                      style={{ flex: 1, background: 'var(--app-track)', opacity: 0.4, height: 2, alignSelf: 'center' }}
                    />
                  ) : (
                    <>
                      {w.items.map((it) => (
                        <div
                          key={it.id}
                          title={it.title}
                          style={{
                            flex: 1,
                            maxWidth: `${100 / busiest}%`,
                            background: courseTint(catalog.courses, it.c),
                            border: it.kind === 'Exam' ? '1px solid var(--app-accent-bright)' : 'none',
                          }}
                        />
                      ))}
                      {w.events.map((e) => (
                        <div
                          key={e.id}
                          title={e.title}
                          style={{
                            width: 6,
                            background: 'transparent',
                            border: '1px solid var(--app-accent-deep)',
                            borderRadius: '50%',
                            alignSelf: 'center',
                            height: 6,
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>

                {w.items.length > 0 && (
                  <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.35 }}>
                    {w.items.slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className="bare"
                        onClick={() => dispatch({ type: 'openItem', id: it.id })}
                        style={{ width: 'auto', display: 'block', textAlign: 'left' }}
                      >
                        <span style={{ opacity: 0.55 }}>{catalog.byId[it.c]?.code.split(' ')[0]}</span>{' '}
                        {it.title.length > 42 ? `${it.title.slice(0, 40)}…` : it.title}
                      </button>
                    ))}
                    {w.items.length > 3 && (
                      <div style={{ opacity: 0.5 }}>+{w.items.length - 3} more</div>
                    )}
                  </div>
                )}

                {exams.length > 0 && (
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--app-accent)',
                      marginTop: 4,
                    }}
                  >
                    {exams.length} exam{exams.length > 1 ? 's' : ''} this week
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

// ── Campus list (unchanged behaviour, now reachable as a source) ───────────

function CampusList() {
  const { state, dispatch, now } = useStore();
  const events = datedEvents(now, state.sample).filter((e) => {
    if (state.evFilter === 'All') return !e.isPast;
    if (state.evFilter === 'Saved') return !!state.saved[e.id];
    return e.kind === (state.evFilter as EventKind) && !e.isPast;
  });

  return (
    <>
      <div style={{ padding: '14px 0 10px 18px', borderBottom: '1px solid var(--app-line)' }}>
        <ChipRow
          options={EV_FILTERS}
          value={state.evFilter as (typeof EV_FILTERS)[number]}
          onChange={(f) => dispatch({ type: 'setEvFilter', filter: f })}
        />
      </div>

      <div style={{ padding: '14px 18px' }}>
        <div className="section-label" style={{ marginBottom: 12 }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((e) => {
            const saved = !!state.saved[e.id];
            return (
              <Blueprint
                key={e.id}
                style={{ display: 'flex', gap: 13, padding: '13px 14px', alignItems: 'flex-start' }}
              >
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', lineHeight: 1 }}
                >
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5 }}>
                    {e.mon}
                  </div>
                  <div style={{ fontSize: 26 }}>{e.day}</div>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5 }}>
                    {e.dow}
                  </div>
                </button>
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                    <span
                      className={`tag ${e.kind === 'Athletics' ? 'tag-accent' : e.kind === 'University' ? 'tag-outline' : 'tag-neutral'}`}
                    >
                      {e.kind}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.55,
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {e.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.25 }}>{e.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    {e.time} · {e.where}
                  </div>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => dispatch({ type: 'toggleSaved', id: e.id })}
                  style={{ flex: 'none', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 6px' }}
                >
                  {saved ? 'Saved' : 'Save'}
                </button>
              </Blueprint>
            );
          })}
        </div>

        {events.length === 0 && (
          <EmptyState
            title={state.evFilter === 'Saved' ? 'Nothing saved yet.' : 'Nothing coming up.'}
            body={
              state.evFilter === 'Saved'
                ? 'Hit save on a game and it lands on your Today rail.'
                : 'Try another filter — the season may have moved on.'
            }
          />
        )}
        <div style={{ height: 22 }} />
      </div>
    </>
  );
}

export function Calendar() {
  const { state, dispatch, catalog } = useStore();
  if (catalog.empty) return <FirstRun where="on the calendar" />;

  return (
    <>
      <div style={{ padding: '14px 18px 0' }}>
        <Segmented
          options={[
            { id: 'day', label: 'Day' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
            { id: 'semester', label: 'Semester' },
          ]}
          value={state.calView}
          onChange={(view) => dispatch({ type: 'setCalView', view })}
        />
      </div>

      <div style={{ padding: '10px 0 0 18px' }}>
        <ChipRow
          options={SOURCES.map((s) => s.label)}
          value={SOURCES.find((s) => s.id === state.calSource)?.label ?? 'All'}
          onChange={(label) => {
            const found = SOURCES.find((s) => s.label === label);
            if (found) dispatch({ type: 'setCalSource', source: found.id as Source });
          }}
        />
      </div>

      {/* Campus on its own is better as the browsable list than as a grid. */}
      {state.calSource === 'campus' && state.calView === 'month' ? (
        <CampusList />
      ) : state.calView === 'day' ? (
        <DayView />
      ) : state.calView === 'week' ? (
        <WeekView />
      ) : state.calView === 'semester' ? (
        <SemesterView />
      ) : (
        <MonthView />
      )}
    </>
  );
}

export function EventDetail() {
  const { state, dispatch, now } = useStore();
  const all = datedEvents(now, state.sample);
  const event = all.find((e) => e.id === state.eventId) ?? all[0];
  if (!event) return null;
  const saved = !!state.saved[event.id];

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
        <div className="kicker">
          {event.kind} · {event.tag}
        </div>
        <div
          className="chrome-text"
          style={{
            fontSize: 28,
            lineHeight: 1.08,
            letterSpacing: '-0.01em',
            marginTop: 8,
            textWrap: 'pretty',
          }}
        >
          {event.title}
        </div>
        <div style={{ display: 'flex', marginTop: 14, borderTop: '1px solid var(--app-line)' }}>
          <div style={{ flex: 1, padding: '11px 0' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              When
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>
              {event.dow} {event.mon} {event.day}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{event.time}</div>
          </div>
          <div style={{ width: 1, background: 'var(--app-line)' }} />
          <div style={{ flex: 1, padding: '11px 0 11px 14px' }}>
            <div className="kicker" style={{ fontSize: 10 }}>
              Where
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, lineHeight: 1.15 }}>
              {event.where}
            </div>
          </div>
        </div>
      </Blueprint>

      <div
        style={{ fontSize: 14, lineHeight: 1.55, marginTop: 18, opacity: 0.85, textWrap: 'pretty' }}
      >
        {event.detail}
      </div>

      <SectionLabel style={{ margin: '22px 0 6px' }}>Getting in</SectionLabel>
      <div style={{ fontSize: 14, opacity: 0.8 }}>{event.ticket}</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'toggleSaved', id: event.id })}
          style={{ flex: 1, height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            dispatch({ type: 'setCalDay', date: dateToIso(event.date) });
            dispatch({ type: 'setCalView', view: 'day' });
            dispatch({ type: 'go', screen: 'calendar' });
          }}
          style={{ height: 46, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          That day
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

export { longLabel };
