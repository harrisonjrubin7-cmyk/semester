import { useRef, useState, type HTMLAttributes } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { DeadlineRow } from '../components/DeadlineRow';
import { MarkClass } from '../components/MarkClass';
import { ApplyingOn } from '../components/Applying';
import { standingOf } from '../lib/standing';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, ChipRow, EmptyState, SectionLabel, Segmented, TickBox } from '../components/ui';
import { ChevronLeft, ChevronRight } from '../components/Icons';
import { HourGrid } from '../components/HourGrid';
import { KindKey } from '../components/KindKey';
import { WeekGrid } from '../components/WeekGrid';
import { WeekDue } from '../components/WeekDue';
import { PrintButton } from '../components/PrintButton';
import { kindOf } from '../lib/kinds';
import { dayLabel, monthLabel, moveBy } from '../lib/monthgrid';
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
  shiftIso,
} from '../lib/date';
import {
  datedEvents,
  datedItems,
  feedEventsOn,
  hoursFor,
  itemsOn,
  railFor,
} from '../lib/select';
import { timeLabel, useDragToMove } from '../lib/drag';
import { keepBlock, shows, sourceName, type CalSource } from '../lib/calsource';
import { useRowStyle } from '../components/shell/useShell';
import { useCalendarMove, type Movable } from './calendar/Move';
import { AddHere } from './calendar/AddHere';
import type { CourseId, DatedEvent, DatedItem, EventKind, PersonalTask } from '../lib/types';
import { Folding } from '../components/Fold';

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

type Source = CalSource;

const EV_FILTERS = ['All', 'Athletics', 'Clubs', 'University', 'Saved'] as const;

/*
 * Courses used to be told apart here by opacity: one accent at 100, 78, 56 and
 * 38 percent. It was the honest thing to do while the app had one colour, and
 * it did not work — the third and fourth course are a pair of greys, the steps
 * repeat at the fifth course, and a dot at 38% on a month grid is a dot nobody
 * sees at all. The palette is `lib/tint.ts` now, it is the reader's own accent
 * turned rather than four new colours, and it is the same in every view
 * instead of being the calendar's private scheme. Ask the store: `tint(id)`.
 */

/**
 * Back to today, said out loud.
 *
 * Every view could already be walked away from and only two could be walked
 * back, by tapping a heading that gave no sign it was a control: the day's
 * date and the week's range reset when tapped, which nobody knows unless they
 * have read this file. The month had nothing at all, so a term browsed to
 * December came back six taps at a time, and it is the view most people are in.
 *
 * One control, in one place, that appears only when it would do something.
 * Drawn where the view's own arrows are, because that is where the hand
 * already is when it has gone too far.
 */
function BackToToday({ onClick }: { onClick: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--sp-5)' }}>
      <button
        type="button"
        className="btn"
        onClick={onClick}
        style={{
          flex: 'none',
          padding: 'var(--sp-2) var(--sp-6)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          background: 'transparent',
        }}
      >
        Back to today
      </button>
    </div>
  );
}

// ── Day ───────────────────────────────────────────────────────────────────

function DayView() {
  // A row's padding and hairline, from the layout rather than hard-coded.
  const dayRow = useRowStyle(12);
  const { state, dispatch, now, catalog, say, tint } = useStore();
  const moving = useCalendarMove();
  const [addAt, setAddAt] = useState<number | null>(null);
  const day = state.calDay ? isoToDate(state.calDay) : now;
  /*
   * A task dragged onto the hour grid gets a time.
   *
   * The grid moves its own blocks; this is the other direction — a row from
   * the list below, dropped onto the day. A task's time is free text and is
   * never parsed, so what lands in it is the hour as this app writes one.
   */
  const taskDrag = useDragToMove<Movable>({
    onDrop: ({ payload, point }) => {
      if (!point || payload.kind !== 'task') return;
      dispatch({
        type: 'moveTask',
        id: payload.id,
        date: dateToIso(day),
        time: timeLabel(point.minutes),
      });
      say(`Moved · ${payload.title} to ${timeLabel(point.minutes)}.`, 'mine');
    },
  });
  const isToday = sameDay(day, now);
  const source = state.calSource;
  // What this source includes, from `lib/calsource.ts` rather than from three
  // conditions written out here. Day's buckets were the right ones and are
  // what that file records; asking it is what stops the other three views
  // drifting from them again.
  const on = shows(source);

  const rail = on.classes
    ? railFor(
        catalog,
        day,
        state.appointments,
        state.commitments,
        // A deadline with an hour on it sits on the rail at that hour.
        datedItems(catalog, day).filter((i) => !state.done[i.id]),
      )
    : [];
  const due = on.deadlines
    ? datedItems(catalog, now).filter((i) => sameDay(i.date, day))
    : [];
  const events = on.campus
    ? datedEvents(now, state.sample).filter((e) => sameDay(e.date, day))
    : [];
  const myTasks = on.deadlines ? state.tasks.filter((t) => t.date === dateToIso(day)) : [];

  // Anything a connected calendar says is on — Brightspace, Outlook, Zoom.
  // It sits in its own section, labelled, so a feed can never be mistaken for
  // a date the syllabus stated.
  const feedToday = on.campus ? feedEventsOn(state.feedEvents, day) : [];

  const empty =
    rail.length === 0 &&
    due.length === 0 &&
    events.length === 0 &&
    myTasks.length === 0 &&
    feedToday.length === 0;

  return (
    <div style={{ padding: 'var(--page-pad)' }}>
      <Folding name="DayView">
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
        <div style={{ textAlign: 'center' }}>
          <span className="chrome-text" style={{ fontSize: 'calc(20px * var(--text-scale, 1))', display: 'block' }}>
            {isToday ? 'Today' : DOW[day.getDay()]}
          </span>
          <span className="kicker" style={{ display: 'block' }}>
            {MONTHS[day.getMonth()]} {day.getDate()}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => dispatch({ type: 'stepDay', delta: 1 })}
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {!isToday && <BackToToday onClick={() => dispatch({ type: 'setCalDay', date: null })} />}

      {empty && (
        <EmptyState
          title="Nothing on."
          body={
            source === 'all'
              ? 'No classes, no deadlines, no events. A genuinely free day.'
              : `Nothing from ${sourceName(source)} on this day. There may be something under another chip.`
          }
          // A free day is a fact and there is nothing to do about it. An empty
          // filter is a question — is the day free, or am I looking through a
          // narrow slot? — and the answer is one tap away, so offer it here
          // rather than telling somebody to go and find the control.
          action={
            source === 'all'
              ? undefined
              : { label: 'Show everything', onClick: () => dispatch({ type: 'setCalSource', source: 'all' }) }
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
            blocks={hoursFor(
              catalog,
              day,
              state.appointments,
              state.commitments,
              datedItems(catalog, day).filter((i) => !state.done[i.id]),
            )}
            now={isToday ? minutesNow(now) : null}
            style={{ margin: '14px 0 26px' }}
            /*
             * What a block is drawn from decides whether it moves. A class is
             * the timetable repeating and a commitment is a standing
             * arrangement; neither has a single record to change, and
             * `railFor` gives a `from` only to the two that do.
             */
            canMove={(b) => Boolean(b.from)}
            onMove={(b, minutes) => {
              if (!b.from) {
                moving.refuse('class');
                return;
              }
              moving.move(
                b.from.kind === 'appointment'
                  ? { kind: 'appointment', id: b.from.id, title: b.title, minutes: b.at }
                  : {
                      kind: 'item',
                      id: b.from.id,
                      courseId:
                        catalog.items.find((i) => i.id === b.from!.id)?.c ?? ('' as CourseId),
                      title: b.title,
                      code: b.meta.split(' · ')[0] ?? '',
                    },
                { date: dateToIso(day), at: minutes },
              );
            }}
            onAddAt={(minutes) => setAddAt(minutes)}
          />
          {moving.notice}
          {addAt !== null && (
            <AddHere date={dateToIso(day)} at={addAt} onClose={() => setAddAt(null)} />
          )}
        </>
      )}

      {rail.length > 0 && (
        <>
          <SectionLabel style={{ margin: '0 0 12px' }}>The schedule</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rail.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <div
                  style={{
                    width: 56,
                    flex: 'none',
                    textAlign: 'right',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-md)',
                    paddingTop: 'var(--sp-6)',
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
                          : tint(b.c).fill,
                      border: b.mine ? '1px solid var(--app-accent)' : 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1, padding: '11px 0 15px', minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'calc(18px * var(--text-scale, 1))',
                      lineHeight: 1.15,
                      opacity: b.canceled ? 0.45 : 1,
                      textDecoration: b.canceled ? 'line-through' : 'none',
                    }}
                  >
                    {b.title}
                  </div>
                  <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6 }}>
                    {b.mine && (
                      <span className="tag tag-neutral" style={{ marginRight: 'var(--sp-3)' }}>
                        Yours
                      </span>
                    )}
                    {b.meta}
                  </div>
                  {/* Only a real class, only once it has started. An
                      appointment you added is not attendance, and marking
                      Friday's lecture on Tuesday records nothing. */}
                  {b.c && !b.mine && !b.canceled ? (
                    <MarkClass
                      courseId={b.c}
                      date={dateToIso(day)}
                      started={day < now || (isToday && minutesNow(now) >= b.at)}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recruiting deadlines on the same day as the coursework they collide
          with, which is the whole reason they are in this app. */}
      <ApplyingOn day={day} />

      {due.length > 0 && (
        <>
          <SectionLabel>Due</SectionLabel>
          {due.map((i) => (
            <DeadlineRow
              key={i.id}
              item={i}
              tone={standingOf(i, state.done)}
              meta={i.dueTime}
              trail={null}
            />
          ))}
        </>
      )}

      {myTasks.length > 0 && (
        <>
          <SectionLabel>Yours</SectionLabel>
          {myTasks.map((t) => (
            <DayTask key={t.id} task={t} drag={taskDrag.handlers({ kind: 'task', id: t.id, title: t.title })} />
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
                gap: 'var(--sp-5)',
                alignItems: 'center',
                ...dayRow,
              }}
            >
              <span className="tag tag-outline">{e.kind}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 1.25 }}>{e.title}</span>
                <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55 }}>
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
                  gap: 'var(--sp-5)',
                  alignItems: 'center',
                  ...dayRow,
                }}
              >
                <span
                  style={{
                    width: 54,
                    flex: 'none',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-sm)',
                    opacity: 0.6,
                  }}
                >
                  {e.time}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 1.25 }}>
                    {e.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55 }}>
                    {feed?.name ?? 'Calendar'}
                    {e.where ? ` · ${e.where}` : ''}
                  </span>
                </span>
              </div>
            );
          })}
        </>
      )}

      <div style={{ height: 22 }} />
      </Folding>
    </div>
  );
}

/**
 * One of your own tasks on a day, and the two things you want to do to it.
 *
 * This row used to be a `<div>` — the only inert thing on a day where every
 * other row is a button. You could see that a task was on Tuesday and do
 * nothing about it: not tick it, not move it. Both are exactly what somebody
 * looking at a day is there to do.
 *
 * ## A day at a time, and now a drag as well
 *
 * This used to argue that dragging was the obvious gesture and the wrong one,
 * on two grounds. One of them was about the wrong API: HTML drag events do not
 * fire on touch, but pointer events do, which is what `lib/drag.ts` uses and
 * why the drag here works with a thumb. The other has been kept rather than
 * dropped — a change that lands with no confirmation is not this app's habit —
 * and it is answered by an Undo on every move rather than by refusing the
 * gesture.
 *
 * The arrows stay. They are the precise version: one day, in a named
 * direction, reachable with a thumb and by a keyboard, and pressing the other
 * one puts it back. A drag is the fast version of the same edit, not a
 * replacement for it.
 *
 * Only *your* tasks move freely. A syllabus deadline is a fact a professor
 * stated; it can be dragged, and it asks first and keeps the date it came
 * from. See `screens/calendar/Move.tsx`.
 */
function DayTask({ task: t, drag }: { task: PersonalTask; drag?: HTMLAttributes<HTMLElement> }) {
  const taskRow = useRowStyle(8);
  const { dispatch, courseCode, say } = useStore();
  if (!t.date) return null;

  const move = (days: number) => {
    const to = shiftIso(t.date ?? '', days);
    dispatch({ type: 'editTask', id: t.id, patch: { date: to } });
    say(`Moved · ${t.title} to ${longLabel(isoToDate(to))}.`, 'mine');
  };

  return (
    <div
      {...drag}
      style={{
        display: 'flex',
        gap: 'var(--sp-5)',
        alignItems: 'center',
        ...taskRow,
        opacity: t.done ? 0.45 : 1,
      }}
    >
      <button
        type="button"
        className="bare"
        onClick={() => dispatch({ type: 'toggleTask', id: t.id })}
        aria-label={t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
        style={{ width: 20, flex: 'none' }}
      >
        <TickBox on={t.done} />
      </button>
      <span className="tag tag-neutral" style={{ flex: 'none' }}>
        {t.courseId ? courseCode(t.courseId) : 'Personal'}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 'var(--type-md)',
          textDecoration: t.done ? 'line-through' : 'none',
        }}
      >
        {t.title}
      </span>
      {/* Hidden once it is done. Moving something you have finished is not a
          thing anybody means to do, and two more targets beside a ticked row
          is two more ways to mis-tap. */}
      {!t.done && (
        <span style={{ display: 'flex', gap: 'var(--sp-1)', flex: 'none' }}>
          <button
            type="button"
            className="bare tappable"
            onClick={() => move(-1)}
            aria-label={`Move ${t.title} a day earlier`}
            style={arrow}
          >
            &minus;1d
          </button>
          <button
            type="button"
            className="bare tappable"
            onClick={() => move(1)}
            aria-label={`Move ${t.title} a day later`}
            style={arrow}
          >
            +1d
          </button>
        </span>
      )}
    </div>
  );
}

/** The Move control on a row: quiet until it is wanted, then a live target. */
const CARRY = {
  width: 'auto',
  flex: 'none',
  padding: 'var(--sp-2) var(--sp-3)',
  fontFamily: 'var(--font-heading)',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.08em',
  opacity: 0.55,
} as const;

const arrow = {
  width: 'auto',
  padding: '6px 7px',
  fontFamily: 'var(--font-heading)',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.06em',
  opacity: 0.55,
} as const;

// ── Week ──

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
  const weekEventRow = useRowStyle(11);
  const { state, dispatch, now, catalog } = useStore();
  const moving = useCalendarMove();
  const [adding, setAdding] = useState<{ date: string; at: number } | null>(null);
  const anchor = state.calDay ? isoToDate(state.calDay) : now;
  const start = new Date(anchor);
  start.setDate(start.getDate() - start.getDay());
  /*
   * The source axis, which this view ignored entirely.
   *
   * Choosing "Due" left every class on the grid and choosing "Campus" changed
   * nothing at all — the chips moved and the week did not. They are read here
   * exactly as Day reads them, through `lib/calsource.ts`, so the two views
   * cannot mean different things by the same chip.
   */
  const on = shows(state.calSource);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return {
      date,
      isToday: sameDay(date, now),
      blocks: hoursFor(
        catalog,
        date,
        on.classes ? state.appointments : [],
        on.classes ? state.commitments : [],
        on.deadlines ? datedItems(catalog, date).filter((i) => !state.done[i.id]) : [],
        // Classes come out of the catalogue rather than out of the arguments
        // above, so the filter is what drops them. The rule is in
        // `lib/calsource.ts` so the day rail and this grid cannot disagree.
      ).filter((b) => keepBlock(b.from, on)),
      onOpen: () => {
        dispatch({ type: 'setCalDay', date: dateToIso(date) });
        dispatch({ type: 'setCalView', view: 'day' });
      },
    };
  });

  /*
   * What is on around campus this week.
   *
   * Not on the grid: a football game is not yours to move and has no course,
   * so drawing it as a block would give it a colour that means "an
   * uncategorised thing you added" and a drag that gets refused. It goes under
   * the week as a list, which is how the Day view and the month's day panel
   * already show campus — one idiom, three places.
   */
  const weekEnd = new Date(start);
  weekEnd.setDate(start.getDate() + 7);
  const inWeek = (d: Date) => d >= start && d < weekEnd;
  const campus = on.campus
    ? datedEvents(now, state.sample).filter((e) => inWeek(e.date))
    : [];
  const feedWeek = on.campus
    // `e.date &&` for the same reason the month grid below carries it: an
    // event with no date is not in any week, and `isoToDate('')` does not say
    // so — it answers 1 January 1900, which this happens to filter out. Right
    // answer, wrong reason, and the reason is the part that survives an edit.
    ? state.feedEvents.filter((e) => e.date && inWeek(isoToDate(e.date)))
    : [];

  const step = (delta: number) => {
    const to = new Date(start);
    to.setDate(start.getDate() + delta * 7);
    dispatch({ type: 'setCalDay', date: dateToIso(to) });
  };

  const last = new Date(start);
  last.setDate(start.getDate() + 6);
  const total = days.reduce((n, d) => n + d.blocks.length, 0);
  // What the week holds under this source, grid and list together — so the
  // count above the week and the empty state below it agree with each other.
  const anything = total + campus.length + feedWeek.length;
  /*
   * Class meetings this week, counted from the syllabi rather than from the
   * grid.
   *
   * `WeekDue`'s line says "N classes and M deadlines this week" and was being
   * handed the number of *blocks drawn*, which already counted appointments
   * and timed deadlines as classes and, once the source filter reached this
   * view, would have called two deadlines "2 classes" under the Due chip.
   * Zero when classes are filtered out, so the sentence does not describe
   * something the week is not showing.
   */
  const classMeetings = on.classes
    ? days.reduce((n, d) => n + railFor(catalog, d.date, []).filter((b) => b.c && !b.canceled).length, 0)
    : 0;

  return (
    <div style={{ padding: 'var(--page-pad)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--sp-5)',
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
        {/* Marked so it survives the printer. A pinned-up week wants its
            dates at the top of the page; the arrows either side of it do not
            print, and should not. */}
        <div className="wk-head" style={{ textAlign: 'center' }}>
          <span className="chrome-text" style={{ fontSize: 'calc(18px * var(--text-scale, 1))', display: 'block' }}>
            {MONTHS[start.getMonth()]} {start.getDate()} –{' '}
            {start.getMonth() === last.getMonth() ? '' : `${MONTHS[last.getMonth()]} `}
            {last.getDate()}
          </span>
          <span className="kicker" style={{ display: 'block' }}>
            {anything} {anything === 1 ? 'thing' : 'things'} on
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={() => step(1)}
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {!days.some((d) => d.isToday) && (
        <BackToToday onClick={() => dispatch({ type: 'setCalDay', date: null })} />
      )}

      {total > 0 && <KindKey compact />}
      {anything === 0 ? (
        <EmptyState
          title="Nothing this week."
          // Names what is missing rather than "this source", which describes
          // the chips to somebody who has forgotten which one is lit.
          body={`Nothing from ${sourceName(state.calSource)} in this week.`}
          // The sentence used to end "Add something under Mine → Events",
          // which is a set of directions to a screen the app could simply
          // open. Naming a destination in prose is what a dead end sounds
          // like when it is trying to be helpful.
          action={{
            label: 'Add an event',
            onClick: () => {
              // Onto the right tab, not just the right screen — landing on
              // Mine's task list is a second thing to work out.
              dispatch({ type: 'setMineTab', tab: 'appointments' });
              dispatch({ type: 'go', screen: 'mine' });
            },
          }}
        />
      ) : (
        <>
          {total > 0 && (
          <WeekGrid
            days={days}
            now={minutesNow(now)}
            style={{ marginTop: 14 }}
            canMove={(b) => Boolean(b.from)}
            /* The only view with both axes, so a drop here moves the day and
               the hour together — which is what rearranging a week is. */
            onMove={(b, dayIndex, minutes) => {
              const to = days[dayIndex]?.date;
              if (!to) return;
              if (!b.from) {
                moving.refuse('class');
                return;
              }
              moving.move(
                b.from.kind === 'appointment'
                  ? { kind: 'appointment', id: b.from.id, title: b.title, minutes: b.at }
                  : {
                      kind: 'item',
                      id: b.from.id,
                      courseId: catalog.items.find((i) => i.id === b.from!.id)?.c ?? ('' as CourseId),
                      title: b.title,
                      code: b.meta.split(' · ')[0] ?? '',
                    },
                { date: dateToIso(to), at: minutes },
              );
            }}
            onAddAt={(dayIndex, minutes) => {
              const to = days[dayIndex]?.date;
              if (to) setAdding({ date: dateToIso(to), at: minutes });
            }}
          />
          )}
          {total > 0 && (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 14, lineHeight: 'var(--leading-relaxed)' }}>
              Tap a date to open that day in full, hold a block to move it, and double-tap an empty
              hour to put something there. Deadlines with no hour on them are listed under the grid
              rather than drawn on it.
            </div>
          )}
          {moving.notice}
          {adding && (
            <AddHere date={adding.date} at={adding.at} onClose={() => setAdding(null)} />
          )}

          {(campus.length > 0 || feedWeek.length > 0) && (
            <>
              <SectionLabel>On campus this week</SectionLabel>
              {campus.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="bare tappable"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{ display: 'flex', gap: 'var(--sp-5)', width: '100%', textAlign: 'left', ...weekEventRow }}
                >
                  <span
                    style={{
                      width: 52,
                      flex: 'none',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--type-xs)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      opacity: 0.55,
                    }}
                  >
                    {DOW_INITIALS[e.date.getDay()]} {e.date.getDate()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
                      {e.title}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
                      {e.time} · {e.where}
                    </span>
                  </span>
                  <ChevronRight size={14} style={{ opacity: 0.4, flex: 'none' }} />
                </button>
              ))}
              {feedWeek.map((e) => (
                <div
                  key={e.id}
                  style={{ display: 'flex', gap: 'var(--sp-5)', ...weekEventRow }}
                >
                  <span
                    style={{
                      width: 52,
                      flex: 'none',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--type-xs)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      opacity: 0.55,
                    }}
                  >
                    {DOW_INITIALS[isoToDate(e.date).getDay()]} {isoToDate(e.date).getDate()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
                      {e.title}
                    </span>
                    {/* Said out loud, every time: a feed is what somebody
                        else's calendar claims, not what a syllabus stated. */}
                    <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
                      From a connected calendar
                    </span>
                  </span>
                </div>
              ))}
            </>
          )}

          {on.deadlines && <WeekDue start={start} classes={classMeetings} />}
          <PrintButton label="Print the week" style={{ marginTop: 14 }} />
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

// ── Month ─────────────────────────────────────────────────────────────────

function MonthView() {
  const monthTaskRow = useRowStyle('var(--sp-5) 0');
  const { state, dispatch, now, catalog, tint } = useStore();
  const { calYear, calMonth, calSource } = state;
  const cells = monthGrid(calYear, calMonth);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  // The flat run of cells, cut into weeks, so each can be a row.
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7),
  );
  /**
   * The day focus should move to, once it exists.
   *
   * Set only by the arrow keys. Focusing on every render would take focus off
   * whatever somebody was actually using every time the month redrew.
   */
  const [chasing, setChasing] = useState<number | null>(null);
  /** The day a double-tap opened the composer on, as a day of this month. */
  const [adding, setAdding] = useState<number | null>(null);
  const moving = useCalendarMove();
  const iso = (day: number) =>
    `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  /*
   * A month cell is a day and nothing finer, so a drop here moves the date and
   * leaves the hour alone. `data-drop` on each cell is what `lib/drag.ts`
   * looks for under the pointer.
   */
  const drag = useDragToMove<Movable>({
    onDrop: ({ payload, target }) => {
      const day = Number(target?.replace('d:', ''));
      if (!Number.isFinite(day)) return;
      moving.move(payload, { date: iso(day) });
    },
  });

  /*
   * The same move, without a pointer.
   *
   * A calendar whose only way to move something is a drag is a calendar
   * nobody can use with a keyboard or a screen reader, and this app does not
   * ship that anywhere else. Pick a row up with Move, walk it with the arrow
   * keys — a day at a time, a week with up and down, matching the grid's own
   * roving focus — and Enter puts it down. Escape leaves it where it was.
   *
   * The day it would land on is announced rather than only drawn, which is the
   * whole point: the person using this cannot see the cell light up.
   */
  const [carrying, setCarrying] = useState<{ what: Movable; day: number } | null>(null);
  const carryKeys = (e: React.KeyboardEvent) => {
    if (!carrying) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      const to = Math.min(daysInMonth, Math.max(1, carrying.day + step));
      setCarrying({ ...carrying, day: to });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      moving.move(carrying.what, { date: iso(carrying.day) });
      setCarrying(null);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setCarrying(null);
    }
  };

  /** The Move control every draggable row carries, for the keyboard path. */
  const moveButton = (what: Movable, from: number) =>
    carrying && carrying.what.id === what.id ? (
      <button
        type="button"
        className="bare tappable"
        autoFocus
        onKeyDown={carryKeys}
        onBlur={() => setCarrying(null)}
        aria-label={`Carrying ${what.title}. Arrow keys choose a day, Enter drops it, Escape cancels.`}
        style={CARRY}
      >
        {MONTHS[calMonth]} {carrying.day} · ENTER
      </button>
    ) : (
      <button
        type="button"
        className="bare tappable"
        onClick={() => setCarrying({ what, day: from })}
        aria-label={`Move ${what.title} to another day`}
        style={CARRY}
      >
        MOVE
      </button>
    );

  // What lands on each day of this month, per the current source filter.
  const marks: Record<number, { c: CourseId | null; kind: string; tint?: string; title?: string }[]> = {};
  const add = (d: Date, mark: { c: CourseId | null; kind: string; tint?: string; title?: string }) => {
    if (d.getFullYear() !== calYear || d.getMonth() !== calMonth) return;
    (marks[d.getDate()] ??= []).push(mark);
  };

  const on = shows(calSource);

  if (on.deadlines) {
    datedItems(catalog, now).forEach((i) => add(i.date, { c: i.c, kind: 'due', title: i.title }));
    state.tasks.forEach((t) => {
      if (t.date) add(isoToDate(t.date), { c: t.courseId, kind: 'mine', title: t.title });
    });
  }
  // Your own events, in the colour the day and week grids give them, so the
  // three views agree about what a colour means.
  if (on.classes) {
    // `if (a.date)` for the same reason your own tasks carry it three lines
    // above: a record with no day is not on a day, and `isoToDate` given
    // nothing lands it on 1 January 1900 — or, before `readAppointments`
    // guaranteed the field, threw and took the month grid with it.
    state.appointments.forEach((a) => {
      if (a.date) add(isoToDate(a.date), { c: null, kind: 'appt', tint: kindOf(a.kind).tint, title: a.title });
    });
  }
  if (on.campus) {
    datedEvents(now, state.sample).forEach((e) => add(e.date, { c: null, kind: 'event', title: e.title }));
    state.feedEvents.forEach((e) => {
      if (e.date) add(isoToDate(e.date), { c: e.courseId, kind: 'feed', title: e.title });
    });
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
  const selTasks = state.tasks.filter((t) => t.date === iso(selectedDay) && !t.done);

  return (
    <div style={{ padding: 'var(--page-pad)' }}>
      <Folding name="MonthView">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--sp-6)',
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
          style={{ fontSize: 'calc(20px * var(--text-scale, 1))', letterSpacing: '0.06em', textTransform: 'uppercase' }}
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

      {/* The month is the view somebody browses furthest from today, and it
          was the one with no way back: December to September was six taps of
          an arrow. The step is arithmetic on the month already displayed, so
          this needs no action of its own; the selection is cleared with it,
          or the panel underneath would still be showing a day in December. */}
      {!inThisMonth && (
        <BackToToday
          onClick={() => {
            dispatch({
              type: 'stepMonth',
              delta: (now.getFullYear() - calYear) * 12 + (now.getMonth() - calMonth),
            });
            dispatch({ type: 'selectDate', date: null });
          }}
        />
      )}

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 1, marginBottom: 'var(--sp-3)' }}
        aria-hidden="true"
      >
        {DOW_INITIALS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(10px * var(--text-scale, 1))',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.45,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/*
        A grid, said out loud.

        Forty-two buttons called "1", "2", "3" is what this was: no month, no
        weekday, nothing about whether a day held anything, and Tab the only
        way across it. Every fact the grid knew was carried by the colour of a
        dot, which is precisely the channel that does not survive being read
        aloud. `lib/monthgrid.ts` turns each cell into a sentence and the arrow
        keys into movement.

        One tab stop, not forty-two: only the selected day is reachable by Tab
        and the arrows move from there, which is the roving-focus pattern every
        date grid uses and the difference between a usable month and a wall.
      */}
      <Blueprint style={{ background: 'var(--app-line)', padding: 1 }}>
      <div
        role="grid"
        aria-label={`${monthLabel(calYear, calMonth)}. Arrow keys move by day, Page Up and Page Down change month.`}
        onKeyDown={(e) => {
          const move = moveBy(e.key, selectedDay, daysInMonth, new Date(calYear, calMonth, 1).getDay());
          if (!move) return;
          e.preventDefault();
          if (move.step) {
            dispatch({ type: 'stepMonth', delta: move.step === 'next' ? 1 : -1 });
            return;
          }
          if (move.day === null || move.day === selectedDay) return;
          dispatch({ type: 'selectDate', date: `${calYear}-${calMonth}-${move.day}` });
          setChasing(move.day);
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 1 }}
      >
        {/*
          One row element per week. `display: contents` keeps the seven-column
          layout exactly as it was while giving the grid the row structure ARIA
          requires — a gridcell has to be inside a row, and forty-two cells
          loose in a grid is not a table to a screen reader, it is a pile.
        */}
        {weeks.map((week, w) => (
        <div key={w} role="row" style={{ display: 'contents' }}>
        {week.map((d, i) => {
          if (d === null) {
            // Padding, not a day. Kept out of the reading order entirely rather
            // than announced as an empty cell.
            return (
              <div
                key={i}
                role="gridcell"
                aria-hidden="true"
                /* The same cell shape as a real day, or the week a month
                   begins mid-way through is a row of its own height. */
                className="mcell"
                style={{ background: 'var(--app-bg)' }}
              />
            );
          }
          const isToday = sameDay(now, new Date(calYear, calMonth, d));
          const isSelected = selectedDay === d;
          const dots = (marks[d] ?? []).slice(0, 4);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              // The whole sentence, so the weekday, the standing and what is on
              // the day all survive without the colour.
              aria-label={dayLabel(new Date(calYear, calMonth, d), marks[d] ?? [], {
                today: isToday,
                selected: isSelected,
              })}
              aria-selected={isSelected}
              {...(isToday ? { 'aria-current': 'date' as const } : {})}
              tabIndex={isSelected ? 0 : -1}
              data-drop={`d:${d}`}
              ref={(node) => {
                // Focus follows the arrow keys, but only when the arrow keys
                // were what moved it — otherwise opening the month would steal
                // focus from wherever somebody actually was.
                if (node && chasing === d) {
                  node.focus();
                  setChasing(null);
                }
              }}
              onClick={() => dispatch({ type: 'selectDate', date: `${calYear}-${calMonth}-${d}` })}
              /*
               * Two taps on a day is "put something here".
               *
               * The gesture nobody has to be taught, and the one every desktop
               * calendar has had for thirty years. It selects the day first —
               * the single tap has already fired — so the list below is the
               * day being added to, which is what makes it checkable.
               */
              onDoubleClick={() => {
                dispatch({ type: 'selectDate', date: `${calYear}-${calMonth}-${d}` });
                setAdding(d);
              }}
              /*
               * The cell's shape is a class, not an inline style, because it
               * is the one thing about this grid that differs between a phone
               * and a desktop: a square that holds a numeral and four dots at
               * 55px, and a landscape cell with room to name what is on the
               * day at 170. An inline style cannot be answered by a media
               * query — it wins over every selector — so what varies lives in
               * `.mcell` and only what depends on this day stays here.
               */
              className="bare mcell"
              style={{
                // Where a dragged thing would land, drawn on the cell under
                // the finger. A drag with no target is a guess.
                outline:
                  drag.over === `d:${d}` || carrying?.day === d
                    ? '2px solid var(--app-accent)'
                    : undefined,
                outlineOffset: -2,
                background: isSelected ? 'var(--app-hero)' : 'var(--app-bg)',
                border: isToday ? '1px solid var(--app-accent)' : 'none',
              }}
            >
              <span
                className="mcell-day"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'var(--type-lg)',
                  opacity: isToday || isSelected ? 1 : 0.8,
                  color: isToday ? 'var(--app-accent)' : 'var(--app-fg)',
                }}
              >
                {d}
              </span>
              <span aria-hidden="true" className="mcell-dots">
                {dots.map((m, k) => (
                  <span
                    key={k}
                    style={{
                      width: 4,
                      height: 4,
                      background:
                        m.kind === 'mine'
                          ? 'transparent'
                          : (m.tint ?? tint(m.c).fill),
                      border: m.kind === 'mine' ? '1px solid var(--app-accent)' : 'none',
                      borderRadius: m.kind === 'event' || m.kind === 'appt' ? '50%' : 0,
                    }}
                  />
                ))}
              </span>
              {/*
                What is actually on the day, for a cell wide enough to say it.
                Drawn in the markup at every width and shown by `.mcell-names`
                only on a desktop: three spans per cell is nothing, and the
                alternative — a width read in JavaScript — is a second source
                of truth about the same breakpoint.

                `aria-hidden`, because the cell's own label already reads the
                whole day out and a screen reader saying it twice is worse
                than a dot.
              */}
              <span aria-hidden="true" className="mcell-names">
                {(marks[d] ?? [])
                  .filter((m) => m.title)
                  .slice(0, 3)
                  .map((m, k) => (
                    <span key={k} className="mcell-name">
                      <i
                        style={{
                          background: m.kind === 'mine' ? 'transparent' : (m.tint ?? tint(m.c).fill),
                          border: m.kind === 'mine' ? '1px solid var(--app-accent)' : 'none',
                        }}
                      />
                      <span>{m.title}</span>
                    </span>
                  ))}
                {(marks[d] ?? []).filter((m) => m.title).length > 3 && (
                  <span className="mcell-more">
                    +{(marks[d] ?? []).filter((m) => m.title).length - 3} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
        </div>
        ))}
      </div>
      </Blueprint>

      {/*
        The grid draws three different marks and, until now, explained none of
        them: a square meant a deadline in that course's colour, a circle meant
        a campus event, an outline meant something of your own. Nobody was ever
        going to work that out, which made the whole month view decorative.

        Handed to `KindKey` rather than drawn above it: this and the colours
        are one key about one grid, and two stacked legends — each with its own
        fold, or worse one folded and one not — is the shape of a screen nobody
        maintained. One tap opens both. It is also the same key the day and
        week grids carry, so a colour means the same thing in every view
        rather than three private schemes.
      */}
      <KindKey
        compact
        lead={
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 14px',
              marginTop: 'var(--sp-3)',
              fontSize: 'calc(10.5px * var(--text-scale, 1))',
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
        }
      />

      <SectionLabel style={{ margin: '20px 0 6px' }}>
        {DOW[new Date(calYear, calMonth, selectedDay).getDay()]} · {MONTHS[calMonth]}{' '}
        {selectedDay}
        {inThisMonth && selectedDay === now.getDate() ? ' · today' : ''}
      </SectionLabel>

      {selItems.map((i) => {
        const what: Movable = {
          kind: 'item',
          id: i.id,
          courseId: i.c,
          title: i.title,
          code: catalog.byId[i.c]?.code ?? i.c,
        };
        return (
          /*
            The Move control sits beside the row rather than inside it.

            `trail` renders inside the row's own button, and a button inside a
            button is markup a browser silently unnests — so the keyboard path
            would have been a control that existed in the JSX and not in the
            page.
          */
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DeadlineRow
                item={i}
                tone={standingOf(i, state.done)}
                meta={i.dueTime}
                trail={null}
                /*
                 * Held, this row moves; the cell it is dropped on is the new
                 * date. A syllabus deadline asks first — see
                 * `screens/calendar/Move.tsx`.
                 */
                drag={drag.handlers(what)}
              />
            </div>
            {moveButton(what, selectedDay)}
          </div>
        );
      })}

      {/*
        Your own things on the same day, which the month list did not show.

        It was a list of syllabus deadlines only, with a button underneath
        saying the rest was in the day view — which was true and is the wrong
        answer now that a row is how you move something. The tasks are the ones
        people actually move, and leaving them out would have made the whole
        gesture apply to everything except the thing it is for.
      */}
      {selTasks.map((t) => (
        <button
          key={t.id}
          type="button"
          className="bare tappable"
          {...drag.handlers({ kind: 'task', id: t.id, title: t.title })}
          onClick={() => {
            if (drag.tookDrop()) return;
            dispatch({ type: 'setMineTab', tab: 'tasks' });
            dispatch({ type: 'go', screen: 'mine' });
          }}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'baseline',
            width: '100%',
            textAlign: 'left',
            ...monthTaskRow,
            opacity: drag.held && 'id' in drag.held && drag.held.id === t.id ? 0.4 : 1,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
            {t.title}
          </span>
          <span style={{ flex: 'none', fontSize: 'var(--type-xs)', opacity: 0.55 }}>
            {t.courseId ? (catalog.byId[t.courseId]?.code ?? '') : 'Yours'}
          </span>
        </button>
      ))}

      {/* The row's Move control lives outside the row for a task, because the
          row is itself a button and a button inside a button is not markup a
          browser will keep. */}
      {selTasks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)' }}>
          {selTasks.map((t) => (
            <span key={`m:${t.id}`}>
              {moveButton({ kind: 'task', id: t.id, title: t.title }, selectedDay)}
            </span>
          ))}
        </div>
      )}

      {/* Where a carried thing would land, said rather than only drawn. */}
      <div role="status" aria-live="polite" className="sr-only">
        {carrying
          ? `${carrying.what.title} would move to ${MONTHS[calMonth]} ${carrying.day}.`
          : ''}
      </div>

      {selItems.length === 0 && selTasks.length === 0 && (
        <EmptyState inline title="Nothing due this day" body="Double-tap it to put something there." />
      )}

      {moving.notice}

      {adding !== null && (
        <AddHere date={iso(adding)} onClose={() => setAdding(null)} />
      )}

      {/* Always offered, including on an empty day: this list is deadlines
          only, and classes and anything of your own live in the day view. */}
      <ActionButton
        onClick={() => {
        dispatch({
        type: 'setCalDay',
        date: `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`,
        });
        dispatch({ type: 'setCalView', view: 'day' });
        }}
        style={{ fontSize: 'var(--type-xs)', marginTop: 14 }}
      >
        See classes and events that day
      </ActionButton>
      <div style={{ height: 22 }} />
      </Folding>
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
  const weekRow = useRowStyle(10);
  const { state, dispatch, now, catalog, tint } = useStore();
  const moving = useCalendarMove();
  const [adding, setAdding] = useState<string | null>(null);
  const source = state.calSource;

  /*
   * A week row has no day axis — it is a bar, not a grid — so a drop moves by
   * whole weeks and keeps the weekday.
   *
   * That is the honest reading of the gesture rather than a compromise:
   * dragging a Wednesday problem set down one row means "next Wednesday", and
   * landing it on the Monday of that week because the row could not say which
   * day would be the view inventing a precision it does not have.
   *
   * Declared here, above the empty-state return below it: a hook that runs
   * only on some renders is a hook that runs in a different order on the next
   * one. `weeks` is read out of a ref rather than closed over for the same
   * reason — it is built after this point.
   */
  const weeksRef = useRef<{ start: Date }[]>([]);
  const drag = useDragToMove<Movable & { weekday: number }>({
    onDrop: ({ payload, target }) => {
      const w = Number(target?.replace('w:', ''));
      const week = weeksRef.current[w];
      if (!week) return;
      const to = new Date(week.start);
      to.setDate(to.getDate() + payload.weekday);
      moving.move(payload, { date: dateToIso(to) });
    },
  });

  const on = shows(source);
  const items = on.deadlines ? datedItems(catalog, now) : [];
  const events = on.campus ? datedEvents(now, state.sample) : [];

  // Weeks from the first Sunday on or before the earliest thing, to the last.
  const dates = [...items.map((i) => i.date), ...events.map((e) => e.date)];
  /*
   * The term's teaching, which this view had no branch for at all.
   *
   * "Just my classes, for the whole semester" is the combination the comment
   * at the top of this file offers as the reason the two axes are independent,
   * and choosing it produced "Nothing from this source across the whole
   * semester" — about four courses that meet all week, every week. The
   * catalogue knows the meeting pattern; a semester of it is one pass.
   *
   * The bounds come from the deadlines rather than from the classes: a course
   * with a recurring schedule and no dates would otherwise run to the end of
   * whatever range this loop was given. When classes are all there is, the
   * term's own dated obligations still say where it starts and stops.
   */
  const spanFrom = catalog.items.length
    ? datedItems(catalog, now).map((i) => i.date)
    : [];
  if (on.classes) dates.push(...spanFrom);
  if (dates.length === 0) {
    return (
      <div style={{ padding: 'var(--page-pad)' }}>
        {/* Only the filtered case reaches here. A calendar with nothing on it
            at all is caught further up by the screen's own empty state, which
            offers "Add your first course" — so there is no unfiltered branch
            to write, and writing one would be writing dead copy. */}
        <EmptyState
          title="Nothing to plot."
          body={`Nothing from ${sourceName(source)} across the whole semester.`}
          action={{
            label: 'Show everything',
            onClick: () => dispatch({ type: 'setCalSource', source: 'all' }),
          }}
        />
      </div>
    );
  }
  const first = new Date(Math.min(...dates.map((d) => d.getTime())));
  const last = new Date(Math.max(...dates.map((d) => d.getTime())));
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());

  const weeks: { start: Date; items: DatedItem[]; events: DatedEvent[]; classes: number }[] = [];
  for (let cursor = new Date(start); cursor <= last; cursor.setDate(cursor.getDate() + 7)) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 7);
    let classes = 0;
    if (on.classes) {
      for (let d = 0; d < 7; d += 1) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + d);
        classes += railFor(catalog, date, []).filter((b) => b.c && !b.canceled).length;
      }
    }
    weeks.push({
      start: weekStart,
      items: items.filter((i) => i.date >= weekStart && i.date < weekEnd),
      events: events.filter((e) => e.date >= weekStart && e.date < weekEnd),
      classes,
    });
  }

  const busiest = Math.max(1, ...weeks.map((w) => w.items.length));
  // The fullest teaching week, so the rule below can be read against it. A
  // fixed width per meeting made every week the same length, which is a mark
  // that says "there are classes" and nothing a person did not already know.
  const busiestTeaching = Math.max(1, ...weeks.map((w) => w.classes));
  /*
   * The ordinary teaching week, and whether any week departs from it.
   *
   * The syllabi give a recurring pattern — days and times, no term dates and
   * no holidays — so most terms this is the same number sixteen times over.
   * Printing it on all sixteen rows says "there are classes", which nobody
   * needed telling; it is said once above instead, and a row speaks up only
   * when its week is not the usual one, which is a thing worth seeing.
   */
  const usualWeek = weeks.length
    ? weeks.map((w) => w.classes).sort((a, b) => b - a)[Math.floor(weeks.length / 2)]
    : 0;
  const teachingVaries = weeks.some((w) => w.classes !== usualWeek);
  weeksRef.current = weeks;

  return (
    <div style={{ padding: 'var(--page-pad)' }}>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-7)', textWrap: 'pretty' }}>
        {[
          on.deadlines && `${items.length} ${items.length === 1 ? 'deadline' : 'deadlines'}`,
          on.campus && `${events.length} ${events.length === 1 ? 'event' : 'events'}`,
          on.classes &&
            (teachingVaries
              ? `${weeks.reduce((n, w) => n + w.classes, 0)} class meetings`
              : `${usualWeek} class meetings a week`),
        ]
          .filter(Boolean)
          .join(', ')}{' '}
        across {weeks.length} weeks. The bar is how loaded each week is; exams are marked.
        {on.classes && !teachingVaries && (
          <>
            {' '}
            The teaching is the same every week: the syllabi give a recurring pattern, with no
            term breaks in it.
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {weeks.map((w, i) => {
          const isNow = now >= w.start && now < new Date(w.start.getTime() + 7 * 86400000);
          const exams = w.items.filter((it) => it.kind === 'Exam');
          return (
            <div
              key={i}
              data-drop={`w:${i}`}
              /* Two taps on a week is "put something in this week". There is no
                 day in a bar, so it opens on the Monday and says so. */
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                const monday = new Date(w.start);
                monday.setDate(monday.getDate() + 1);
                setAdding(dateToIso(monday));
              }}
              style={{
                display: 'flex',
                gap: 'var(--sp-6)',
                alignItems: 'flex-start',
                ...weekRow,
                background: isNow ? 'var(--app-panel)' : 'transparent',
                outline: drag.over === `w:${i}` ? '2px solid var(--app-accent)' : undefined,
                outlineOffset: -2,
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
                <div style={{ fontSize: 'calc(10px * var(--text-scale, 1))', letterSpacing: '0.12em', opacity: 0.5 }}>
                  {MONTHS[w.start.getMonth()].toUpperCase()}
                </div>
                <div style={{ fontSize: 'calc(19px * var(--text-scale, 1))' }}>{w.start.getDate()}</div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    height: 8,
                    alignItems: 'stretch',
                    marginTop: 'var(--sp-2)',
                    marginBottom: 'var(--sp-3)',
                  }}
                >
                  {w.items.length === 0 && w.events.length === 0 && w.classes === 0 ? (
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
                            background: tint(it.c).fill,
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
                      {/* The teaching, as a quiet rule behind the week rather
                          than one mark per meeting: twelve blocks for a normal
                          week would drown the two deadlines that make one week
                          different from the next, which is what this view is
                          for. Reading week shows up as the gap it is. */}
                      {w.classes > 0 && (
                        <div
                          title={`${w.classes} class meetings`}
                          style={{
                            flex: 'none',
                            width: `${Math.round((w.classes / busiestTeaching) * 38)}%`,
                            background: 'var(--app-track)',
                            height: 2,
                            alignSelf: 'center',
                            order: -1,
                          }}
                        />
                      )}
                    </>
                  )}
                </div>

                {w.items.length > 0 && (
                  <div style={{ fontSize: 'var(--type-sm)', opacity: 0.72, lineHeight: 1.35 }}>
                    {w.items.slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className="bare"
                        {...drag.handlers({
                          kind: 'item',
                          id: it.id,
                          courseId: it.c,
                          title: it.title,
                          code: catalog.byId[it.c]?.code ?? it.c,
                          weekday: it.date.getDay(),
                        })}
                        onClick={() => {
                          if (drag.tookDrop()) return;
                          dispatch({ type: 'openItem', id: it.id });
                        }}
                        style={{
                          width: 'auto',
                          display: 'block',
                          textAlign: 'left',
                          opacity: drag.held?.id === it.id ? 0.4 : 1,
                        }}
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

                {on.classes && w.classes !== usualWeek && (
                  <div style={{ opacity: 0.6 }}>
                    {w.classes === 0
                      ? 'No classes this week'
                      : `${w.classes} class ${w.classes === 1 ? 'meeting' : 'meetings'} — ${
                          w.classes < usualWeek ? 'fewer' : 'more'
                        } than usual`}
                  </div>
                )}

                {exams.length > 0 && (
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--type-xs)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--app-accent)',
                      marginTop: 'var(--sp-2)',
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
      {moving.notice}
      {adding && <AddHere date={adding} onClose={() => setAdding(null)} />}
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
        <div className="section-label" style={{ marginBottom: 'var(--sp-6)' }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          {events.map((e) => {
            const saved = !!state.saved[e.id];
            return (
              <Blueprint
                plain
                key={e.id}
                style={{ display: 'flex', gap: 13, padding: '13px 14px', alignItems: 'flex-start' }}
              >
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', lineHeight: 1 }}
                >
                  <div style={{ fontSize: 'calc(10px * var(--text-scale, 1))', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5 }}>
                    {e.mon}
                  </div>
                  <div style={{ fontSize: 'var(--type-xl)' }}>{e.day}</div>
                  <div style={{ fontSize: 'calc(10px * var(--text-scale, 1))', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.5 }}>
                    {e.dow}
                  </div>
                </button>
                <button
                  type="button"
                  className="bare"
                  onClick={() => dispatch({ type: 'openEvent', id: e.id })}
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--sp-2)' }}>
                    <span
                      className={`tag ${e.kind === 'Athletics' ? 'tag-accent' : e.kind === 'University' ? 'tag-outline' : 'tag-neutral'}`}
                    >
                      {e.kind}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--type-xs)',
                        opacity: 0.55,
                        fontFamily: 'var(--font-heading)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {e.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--type-lg)', lineHeight: 1.25 }}>{e.title}</div>
                  <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-1)' }}>
                    {e.time} · {e.where}
                  </div>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => dispatch({ type: 'toggleSaved', id: e.id })}
                  style={{ flex: 'none', fontSize: 'calc(10px * var(--text-scale, 1))', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 6px' }}
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
                : 'Nothing under this filter — the season may have moved on.'
            }
            // Both roads lead back to All: from Saved, to find something worth
            // saving; from a kind with nothing in it, to see what there is.
            action={
              state.evFilter === 'All'
                ? undefined
                : {
                    label: state.evFilter === 'Saved' ? 'Browse what is on' : 'Show everything',
                    onClick: () => dispatch({ type: 'setEvFilter', filter: 'All' }),
                  }
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
    /*
     * `wide`, and no filter of its own.
     *
     * This screen was the one that had neither a frame nor a search box: the
     * `<Page>` further down this file belongs to `EventDetail`, which is how
     * a count of the screens on the frame read Calendar as done. It was not.
     *
     * `wide` because the four views draw to their own edges and already carry
     * their own padding — that is the nesting the note at the top of
     * `components/Page.tsx` describes, and giving the frame the side padding
     * too would indent a month grid inside an indent.
     *
     * No adapter because a calendar is a grid by date, not a list. Filtering
     * it would empty days rather than shorten a list, and the box saying
     * plainly that it searches the whole app is the honest answer here. See
     * the note about screens with nothing of their own to filter.
     */
    <Page wide bottom={0}>
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
    </Page>
  );
}

export function EventDetail() {
  const { state, dispatch, now } = useStore();
  const all = datedEvents(now, state.sample);
  const event = all.find((e) => e.id === state.eventId) ?? all[0];
  if (!event) return null;
  const saved = !!state.saved[event.id];

  return (
    <Page>
      <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
        <div className="kicker">
          {event.kind} · {event.tag}
        </div>
        <div
          className="chrome-text"
          style={{
            fontSize: 'calc(28px * var(--text-scale, 1))',
            lineHeight: 1.08,
            letterSpacing: '-0.01em',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {event.title}
        </div>
        <div style={{ display: 'flex', marginTop: 14, borderTop: '1px solid var(--app-line)' }}>
          <div style={{ flex: 1, padding: '11px 0' }}>
            <div className="kicker" style={{ fontSize: 'calc(10px * var(--text-scale, 1))' }}>
              When
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(18px * var(--text-scale, 1))' }}>
              {event.dow} {event.mon} {event.day}
            </div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6 }}>{event.time}</div>
          </div>
          <div style={{ width: 1, background: 'var(--app-line)' }} />
          <div style={{ flex: 1, padding: '11px 0 11px 14px' }}>
            <div className="kicker" style={{ fontSize: 'calc(10px * var(--text-scale, 1))' }}>
              Where
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(18px * var(--text-scale, 1))', lineHeight: 1.15 }}>
              {event.where}
            </div>
          </div>
        </div>
      </Blueprint>

      <div
        style={{ fontSize: 'var(--type-md)', lineHeight: 1.55, marginTop: 18, opacity: 0.85, textWrap: 'pretty' }}
      >
        {event.detail}
      </div>

      <SectionLabel style={{ margin: '22px 0 6px' }}>Getting in</SectionLabel>
      <div style={{ fontSize: 'var(--type-md)', opacity: 0.8 }}>{event.ticket}</div>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 24 }}>
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
    </Page>
  );
}

export { longLabel };
