import { Fragment, lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle, useSoft } from '../components/shell/useShell';
import { ClashList, WorstDay } from '../components/Clashes';
import { TimerLine } from '../components/TimerLine';
import { ApplyingSoon } from '../components/Applying';
import { ReadingsOnTheGo } from '../components/ReadingProgress';
import { Waiting } from '../components/Waiting';
import { ClosingWindows } from '../components/Windows';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, ChipRow, EmptyState, Meter, SectionLabel, Segmented, TickBox } from '../components/ui';
import { Check, ChevronRight } from '../components/Icons';
import { homeShape } from '../lib/chrome';
import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import {
  appointmentsOn,
  railFor,
  tasksOn,
  feedFilters,
  feed,
  filterFeed,
  itemsDueToday,
  lengthOf,
  nextClass,
  nothingYet,
  punchline,
  upcomingItems,
  type FeedFilter,
} from '../lib/select';
import { MONTHS, clock, minutesNow } from '../lib/date';
import { dueByDay, weekDates, weekLabel, weekLine } from '../lib/weekpage';
import { hasTime, readDue } from '../lib/duetime';
import { clockOf } from '../lib/atrisk';
import { nowAt, readDay, worthMarking } from '../lib/rail';
import { said } from '../lib/arrive';
import { campusHours, datedEvents, datedItems } from '../lib/select';
import { overdueCount, claimed } from '../lib/standing';
import { ordered, sectionLabel, visible } from '../lib/feed';
import { MOVE_HINT, useMovable } from '../lib/arrange';
import { line, pressing, standing } from '../lib/registrar';
import { billFor, money } from '../lib/bill';
import { HowLong } from '../components/HowLong';
import { DropBy } from '../components/DropBy';
import { Walks } from '../components/Walks';
import { BehindOffer } from '../components/BehindOffer';
import { StartList, StartToday } from '../components/StartToday';
import { changes, line as sinceLine, shouldSpeak, sinceLabel } from '../lib/since';
import { GapOffer } from './GapOffer';
import { HomeWalk } from '../components/HomeWalk';
import { tally } from '../lib/review';
import { hoursFor } from '../lib/select';
import { HourGrid } from '../components/HourGrid';
import { KindKey } from '../components/KindKey';
import { CourseTag } from '../components/CourseTag';
import { Folding } from '../components/Fold';
import { goMine } from '../lib/openmine';
import { dateToIso } from '../lib/date';
import { goCal } from '../lib/opencal';
import { INSTITUTIONAL_PREVIEW } from '../lib/institutional-preview';
import { JourneyCards } from '../components/JourneyCards';
import { journeysFor, recommendJourney } from '../lib/journeys';
import { offered } from '../lib/nav';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { TodayDecisionSurface } from '../components/TodayDecisionSurface';

const FlightPlanHome = lazy(() =>
  import('../components/institutional/FlightPlanHome').then((module) => ({
    default: module.FlightPlanHome,
  })),
);

function FlightPlanHomeSlot() {
  const { dispatch } = useStore();
  if (!INSTITUTIONAL_PREVIEW) return null;
  return (
    <div className="today-synthetic-flight-plan">
      <Suspense fallback={null}>
        <FlightPlanHome enabled onNavigate={(screen) => dispatch({ type: 'go', screen })} />
      </Suspense>
    </div>
  );
}

function RecommendedJourney() {
  const { state, dispatch, catalog, school } = useStore();
  const now = useNow();
  if (EXPERIENCE_FLAGS.journeyNavigation === 'off') return null;
  const nowMs = now.getTime();
  const inAWeek = nowMs + 7 * 86_400_000;
  const confirmedDueSoon = upcomingItems(catalog, now).filter(
    (item) => item.daysAway <= 3 && item.checked?.confirmed,
  ).length;
  const reviewDue = Object.values(state.reviews).filter((review) => review.due <= nowMs).length;
  const collaborationDue = state.tasks.filter(
    (task) =>
      !task.done &&
      /\b(group|team|meet|partner|classmate)\b/i.test(`${task.title} ${task.note}`),
  ).length;
  const careerDue = state.applications.filter((application) => {
    const due = application.nextBy || application.due;
    if (!due) return false;
    const at = new Date(`${due}T23:59:59`).getTime();
    return at >= nowMs && at <= inAWeek;
  }).length;
  const ranked = recommendJourney({
    confirmedDueSoon,
    setupIncomplete: catalog.empty,
    reviewDue,
    collaborationDue,
    careerDue,
  });
  const available = journeysFor(offered(school.capabilities, state.role));
  const recommendation = ranked.find((candidate) =>
    available.some((journey) => journey.id === candidate.id && journey.screens.length > 0),
  );
  if (!recommendation) return null;
  const journey = available.find((candidate) => candidate.id === recommendation.id)!;

  return (
    <section className="today-journey today-secondary-journey" aria-label="Also useful">
      <div className="kicker">Also useful</div>
      <JourneyCards
        journeys={[journey]}
        reasons={{ [journey.id]: recommendation.reason }}
        onOpen={(screen) => dispatch({ type: 'go', screen })}
      />
    </section>
  );
}

/** The next-class card, shared by both nav modes. */
function NextClassCard() {
  const { catalog, tint } = useStore();
  const now = useNow();
  const next = nextClass(catalog, now);
  if (!next) return null;

  return (
    <Blueprint
      className="today-next-class-legacy"
      style={{
        padding: 'var(--sp-7)',
        background: 'var(--app-hero)',
        // The card names the class in words; the edge says which one it is in
        // the same colour the block on the grid below it is drawn in.
        borderLeft: `3px solid ${tint(next.block.c).edge}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="kicker">Next class</div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--app-accent-deep)',
          }}
        >
          {next.untilLabel}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-6)', marginTop: 'var(--sp-5)' }}>
        <div className="chrome-text" style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 'var(--leading-none)' }}>
          {next.block.time}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-display-sm)', lineHeight: 'var(--leading-display-lg)' }}>
            {next.block.title}
          </div>
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
            {next.block.c ? catalog.byId[next.block.c].room : next.block.meta}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 'var(--sp-6)',
          paddingTop: 'calc(11px * var(--density, 1))',
          borderTop: '1px solid var(--app-line)',
          fontSize: 'var(--type-base)',
          // A colour, not a fade: `--app-dim` is the rung `contrast.test.ts`
          // walks on every ground, and it is the one "Increase contrast" can
          // reach. An `opacity` is neither. See `lib/dim.ts`.
          color: 'var(--app-dim)',
          textWrap: 'pretty',
        }}
      >
        {next.note}
      </div>
    </Blueprint>
  );
}

/**
 * Your own tasks for today, below the coursework and clearly labelled as yours.
 * The app's premise is that syllabus content is trustworthy because it has a
 * citation attached; this does not, and says so.
 */
function YourTasks() {
  const { state, dispatch, courseCode, tint } = useStore();
  const now = useNow();
  const rowTen = useRowStyle(10);
  const mine = tasksOn(state.tasks, now);
  const appts = appointmentsOn(state.appointments, now);
  if (mine.length === 0 && appts.length === 0) return null;

  const left = mine.filter((t) => !t.done).length;

  return (
    <Folding name="YourTasks">
      <SectionLabel
        style={{ marginTop: 'calc(26px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(12px * var(--density, 1))' }}
        aside={
          <button
            type="button"
            className="bare"
            // `tasks`, not whatever Mine last showed: the label beside this button
            // is a count of undone tasks, so landing on Events would be a button
            // that counts one list and opens another. See `lib/openmine.ts`.
            onClick={() => goMine(dispatch, 'tasks')}
            style={{
              width: 'auto',
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--app-accent)',
            }}
          >
            {left > 0 ? `${left} left` : 'All done'}
          </button>
        }
      >
        Yours today
      </SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {mine.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              gap: 'var(--sp-6)',
              alignItems: 'flex-start',
              ...rowTen,
            }}
          >
            <button
              type="button"
              className="bare"
              onClick={() => dispatch({ type: 'toggleTask', id: t.id })}
              aria-label={t.done ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
              // 20px was the icon's size, not a target. This is the most
              // tapped control in the app and it was less than half the
              // size a thumb needs; the padding grows the hit area without
              // moving the box, which is what DeadlineRow already did.
              //
              // Real pixels, not density-scaled. A thumb does not get
              // smaller because somebody asked for a tighter screen, and a
              // sweep read these as spacing once already: scaled, the most
              // tapped control in the app goes 42px to 36 at Tight. Same
              // argument as `components/Fold.tsx`'s FoldHead, which carries
              // the measurement that was taken when it happened there.
              style={{ width: 34, flex: 'none', paddingTop: '11px', paddingRight: '12px', paddingBottom: '11px', paddingLeft: '0', marginBlock: '-9px', marginInline: '0' }}
            >
              <TickBox on={t.done} />
            </button>
            <div style={{ flex: 1, minWidth: 0, opacity: t.done ? DIMMED_ROW : 1 }}>
              <div
                style={{
                  fontSize: 'var(--type-md)',
                  lineHeight: 'var(--leading-tight)',
                  textDecoration: t.done ? 'line-through' : 'none',
                }}
              >
                {t.title}
              </div>
              {(t.time || t.courseId) && (
                <div style={{ fontSize: 'var(--type-xs)', ...secondLine(t.done), marginTop: 'var(--sp-1)' }}>
                  {/* The code in its course's colour rather than in the dim
                      grey the time is set in: a task you filed against ECON
                      belongs to ECON, and this is the only mark on the row
                      that says so. */}
                  {t.courseId ? (
                    <>
                      <span style={{ color: tint(t.courseId).ink, opacity: 1 }}>{courseCode(t.courseId)}</span>
                      {' · '}
                    </>
                  ) : (
                    ''
                  )}
                  {t.time}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Folding>
  );
}

/**
 * What went by without being ticked.
 *
 * Silence was the old behaviour: a deadline passed, the list it lived in
 * dropped it, and the only signal was a count going down — which looks
 * identical to finishing everything. This says the number out loud on the
 * screen you open first, and goes straight to the list of them.
 *
 * ## Only what is actually yours
 *
 * It used to count the shipped semester's deadlines too, so a first run
 * opened on "14 deadlines went by without being ticked off" — warning
 * coloured, above everything else, about a term the visitor had never seen
 * and had not yet been asked whether they wanted. Seen on the deployed site.
 *
 * `claimed` in `lib/standing.ts` holds the rule and says why; the short
 * version is that `state.sample` is the "these are mine / not mine" question
 * still being open, and a deadline belonging to nobody is not a deadline
 * anybody missed. Answering it — either way — makes this the plain count
 * again.
 */
function OverdueBanner() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const missed = overdueCount(
    claimed(
      datedItems(catalog, now),
      state.courses.map((c) => c.course.id),
      state.sample,
    ),
    state.done,
  );
  if (missed === 0) return null;

  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() => {
        dispatch({ type: 'setDueTab', tab: 'overdue' });
        dispatch({ type: 'setCoursesTab', tab: 'due' });
        dispatch({ type: 'go', screen: 'courses' });
      }}
      style={{
        display: 'flex',
        gap: 'var(--sp-5)',
        alignItems: 'center',
        width: '100%',
        marginTop: 'var(--sp-6)',
        paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
        borderRadius: 12,
        textAlign: 'left',
        border: '1px solid var(--app-warn-line)',
        background: 'var(--app-warn-wash)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 'var(--leading-tight-plus)' }}>
        <strong style={{ fontWeight: 600 }}>
          {missed} {missed === 1 ? 'deadline' : 'deadlines'} went by
        </strong>{' '}
        without being ticked off.
      </span>
      <span
        style={{
          flex: 'none',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--app-dim)',
        }}
      >
        See them
      </span>
    </button>
  );
}

/** Nav mode 1A — a fixed sequence: next class, checklist, rail, campus, week. */
/**
 * The week ahead, as a week rather than as the next five things.
 *
 * The tab was called "This week" and showed an unbounded list of what was
 * coming, cut off at five rows with nothing to say it had been cut. On the
 * semester this app ships with that is three of the five falling on one
 * Tuesday and the sixth thing invisible — so the tab hid both facts a week
 * view exists for: which days are loaded, and which are clear.
 *
 * Seven days from today, every one of them listed. The empty ones are the
 * point as much as the full ones: a Wednesday with nothing on it is a place
 * to put something, and it cannot be seen in a list that only prints the days
 * that are busy.
 *
 * The arithmetic is `dueByDay` from `lib/weekpage.ts` — the same function
 * behind the printed week on the Calendar, so the two cannot come to disagree
 * about what a week is. What differs is the presentation: there a page you
 * pin up, here rows you tap to open.
 */
function ThisWeek() {
  const { state, dispatch, catalog, tint, courseCode } = useStore();
  const now = useNow();
  const row = useRowStyle(9);
  const nextEvent = datedEvents(now, state.schoolId, state.sample).find((e) => !e.isPast);

  // Your own tasks alongside the deadlines, day by day. Same reason as
  // everywhere else in this change: a week that shows only what a syllabus
  // asked for is not this week.
  const days = useMemo(
    () => dueByDay(datedItems(catalog, now), now, state.tasks),
    [catalog, now, state.tasks],
  );
  // Everything still ahead that the seven days do not reach, and the date it
  // is "after" — written out, because "after 14" is not a date.
  const last = weekDates(now)[6];
  const lastDay = `${MONTHS[last.getMonth()]} ${last.getDate()}`;
  // The list, not just its length: the aside below offers to show these, and
  // "show them" means landing on the first of them rather than wherever the
  // calendar was left. `datedItems` sorts by date, so `[0]` is the first.
  const rest = useMemo(
    () => upcomingItems(catalog, now).filter((i) => i.date > last),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, now],
  );
  const beyond = rest.length;
  // Counted from the syllabi rather than from anything drawn, and cancelled
  // meetings left out — the same rule the Calendar's own week line uses.
  const classes = useMemo(
    () =>
      weekDates(now).reduce(
        (n, date) => n + railFor(catalog, date, []).filter((b) => b.c && !b.canceled).length,
        0,
      ),
    [catalog, now],
  );

  return (
    <>
      {nextEvent && (
        <>
          <SectionLabel>On campus</SectionLabel>
          <Blueprint
            onClick={() => dispatch({ type: 'openEvent', id: nextEvent.id })}
            style={{ paddingBlock: 'calc(13px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', display: 'flex', gap: 'calc(13px * var(--density, 1))', alignItems: 'center' }}
          >
            <div
              style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', lineHeight: 'var(--leading-none)' }}
            >
              <div
                style={{
                  fontSize: 'var(--type-2xs)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--app-dim)',
                }}
              >
                {nextEvent.mon}
              </div>
              <div style={{ fontSize: 'var(--type-xl)' }}>{nextEvent.day}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-display-xs)' }}>{nextEvent.title}</div>
              <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
                {nextEvent.time} · {nextEvent.where}
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--app-dim)', flex: 'none' }} />
          </Blueprint>
        </>
      )}

      {/*
        The two lists this tab inherited and did not receive.
       *
       * `80fbc5c` merged `#/ahead` into this tab, and its "What the merge had
       * to carry" note lists the keywords, the context provider and the
       * header. `screens/Ahead.tsx` rendered four things: `Capacity` and
       * `DayBudget`, both of which went to Settings → Workload, and these
       * two, which went nowhere. The controls were carried and the content
       * was not, and nothing has drawn either list since — found by the
       * twenty-sixth simplify pass, reading the dead exports one at a time.
       *
       * Here rather than on the feed, which is the split both modules were
       * written around: Today's feed gets the one-line form — `WorstDay`, the
       * nearest hard day, and `StartToday`, what must begin today — because a
       * screen that opens with four warnings is a screen people learn to
       * scroll past. The full fortnight belongs where somebody has come to
       * look at the shape of a week, and since that merge this tab is that
       * place.
       *
       * Above the seven days for `Ahead.tsx`'s own reason: a day that will
       * not fit is the shape of the fortnight, and everything below is
       * scheduling inside it. Both draw nothing on a quiet week.
       */}
      <ClashList />
      <StartList />

      <SectionLabel>The next seven days</SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          marginBottom: 'var(--sp-4)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      >
        {weekLabel(now)} · {weekLine(days, classes)}
      </div>

      {days.map((d, i) => (
        <div
          key={d.date.toISOString()}
          style={{
            display: 'flex',
            gap: 'var(--sp-6)',
            alignItems: 'baseline',
            ...row,
            /*
             * A day with nothing on it is one state of one row, so it is the
             * row that dims — label and word together. It was two numbers
             * instead, 0.35 on the label and 0.3 on the word, each picked by
             * eye on the dark ground and held to no threshold; on Parchment
             * the same pair fades faster. `--app-row-dim` carries the
             * ground's own audited alpha and rises when the device asks for
             * more contrast. See `lib/dim.ts`.
             */
            opacity: d.items.length + d.tasks.length === 0 ? DIMMED_ROW : 1,
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 52,
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              // Quiet beside a day that has something on it. Inside a dimmed
              // row it takes no colour of its own, which is the
              // multiplication `secondLine` exists to stop.
              ...secondLine(d.items.length + d.tasks.length === 0),
            }}
          >
            {i === 0 ? 'Today' : d.label}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {d.items.length + d.tasks.length === 0 ? (
              <span style={{ fontSize: 'var(--type-sm)' }}>Clear</span>
            ) : (
              d.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="bare tappable"
                  onClick={() => dispatch({ type: 'openItem', id: item.id })}
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-5)',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    width: '100%',
                    padding: 'var(--sp-2) 0',
                    /*
                     * Ticked off dims the row, which is what `DeadlineRow`
                     * already does with the same token. It was on the title
                     * alone at 0.45, so the coloured edge, the chevron and
                     * the line under it all stayed at full strength — a row
                     * half-dimmed reads as a rendering fault rather than as a
                     * state, and the line under it was compounding besides:
                     * `--app-dim` inside a 0.45 title is 0.29 on the ground.
                     */
                    opacity: state.done[item.id] ? DIMMED_ROW : 1,
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: 2,
                      alignSelf: 'stretch',
                      background: tint(item.c).edge,
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--type-base)',
                        lineHeight: 'var(--leading-normal)',
                        textDecoration: state.done[item.id] ? 'line-through' : 'none',
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--type-xs)',
                        ...secondLine(state.done[item.id]),
                        marginTop: 'var(--sp-1)',
                      }}
                    >
                      {[courseCode(item.c), item.weight, hasTime(item.dueTime) ? clock(item.dueAt) : item.dueTime.trim()]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--app-dim)', flex: 'none' }} />
                </button>
              ))
            )}
            {/* Yours, under the syllabus's and marked as yours — the app's
                one rule about these two never being drawn as one thing. */}
            {d.tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className="bare tappable"
                onClick={() => {
                  goMine(dispatch, 'tasks');
                }}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-5)',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  width: '100%',
                  padding: 'var(--sp-2) 0',
                }}
              >
                <span
                  style={{
                    flex: 'none',
                    width: 2,
                    alignSelf: 'stretch',
                    background: tint(t.courseId).edge,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-base)',
                      lineHeight: 'var(--leading-normal)',
                      opacity: t.done ? DIMMED_ROW : 1,
                      textDecoration: t.done ? 'line-through' : 'none',
                    }}
                  >
                    {t.title}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-xs)',
                      ...secondLine(t.done),
                      marginTop: 'var(--sp-1)',
                    }}
                  >
                    {['Yours', t.courseId ? courseCode(t.courseId) : '', t.time.trim()]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/*
        What a seven-day window cannot show, said out loud.
        The list this replaced was cut off at five rows with nothing to mark
        the cut, so a midterm the following Tuesday was simply absent. A window
        has the same failure unless it names what falls outside it.
      */}
      {beyond > 0 && (
        <button
          type="button"
          className="bare tappable"
          // The week holding the first of them. This sentence names a period
          // rather than a date, so the day grain would be too narrow. Going
          // without a day at all, which is what this did, left you on
          // whichever day the session last showed — often one inside the very
          // week this line calls insufficient.
          //
          // It used to say `month` was not available here, because the month
          // view anchored on fields `setCalDay` did not touch. That stopped
          // being true when the calendar's position was merged onto `calDay`,
          // and the sentence outlived it — see the note in `lib/opencal.ts`,
          // which carried the same claim. `month` is a real option now.
          //
          // `week` is kept rather than widened on the strength of that: this
          // aside points at the first thing past a seven-day window, and the
          // week holding it shows that thing with its neighbours, which is
          // what "the calendar has the rest" promises. A month would show more
          // and locate it less. Recorded in the audit as a question for
          // whoever owns the wording, not settled here by a comment going
          // stale in the other direction.
          onClick={() => goCal(dispatch, dateToIso(rest[0].date), 'week')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            marginTop: 'var(--sp-5)',
            fontSize: 'var(--type-sm)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {beyond === 1 ? 'One deadline falls' : `${beyond} deadlines fall`} after {lastDay} — the
          calendar has the rest →
        </button>
      )}
    </>
  );
}

function TabHome() {
  // Today's own sections derive what they need themselves, and so does the
  // week's, so what is left here is the switcher.
  const { state, dispatch } = useStore();
  const tab = state.homeTab;

  return (
    <Page bottom={26}>
      {/*
        Four tabs, not five. The fifth was Report, and it rendered the Reports
        screen inline — the same body, sharing the same `state.report` grain,
        so pressing it and opening Reports were two doors onto one room. The
        screen kept its own, the way Settings did when Progress stopped
        carrying a copy of it.

        "This week" is back at full length because of it: the label was cut to
        "Week" only because a fifth tab made the switcher wrap to two lines on
        every Today view.
      */}
      <Segmented
        options={[
          { id: 'today', label: 'Today' },
          { id: 'hours', label: 'Hours' },
          { id: 'week', label: 'This week' },
          { id: 'done', label: 'Done' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setHomeTab', tab: next })}
        style={{ marginTop: '0', marginInline: '0', marginBottom: 'calc(16px * var(--density, 1))' }}
      />

      <TodayDecisionSurface />
      <FlightPlanHomeSlot />
      <RecommendedJourney />

      {tab === 'today' && <TodayFeed />}

      {tab === 'week' && <ThisWeek />}

      {tab === 'hours' && <HoursToday />}

      {tab === 'done' && <DoneToday />}
    </Page>
  );
}

/** One section of the Today feed, so its place in the order can be yours. */
function Feed_next() {
  return (
    <>
      <NextClassCard />
      <OverdueBanner />
      {/*
       * After the overdue banner, deliberately. That one is about work of
       * yours that has already slipped; this is about somebody else waiting on
       * you. Your own missed deadline outranks another person's message, and
       * both are silent when they have nothing, so on most days this section
       * is still just the next class.
       */}
      <Waiting />
    </>
  );
}

/** One section of the Today feed, so its place in the order can be yours. */
function Feed_due() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const today = itemsDueToday(catalog, now);
  const doneCount = today.filter((i) => state.done[i.id]).length;
  const left = today.length - doneCount;
  // Used only by the all-clear line, which names what is next after today.
  const ahead = upcomingItems(catalog, now).filter((i) => !i.isToday);
  return (
    <Folding name="Feed_due">
      <SectionLabel
        style={{ marginTop: 'calc(26px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(4px * var(--density, 1))' }}
        aside={
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.12em',
              // Outside the 0.60–0.70 band the rest of this pass kept to, and
              // converted anyway because it is not a look decision: at 0.5 on
              // Fog this counter renders at 3.28:1 against the panel, which
              // `scripts/paint.mjs` fails on. See `ENGINEERING-AUDIT.md` §7.
              color: 'var(--app-dim)',
            }}
          >
            {doneCount} of {today.length} done
          </div>
        }
      >
        Due today
      </SectionLabel>
      <div
        className="chrome-text"
        style={{
          fontSize: 'var(--type-2xl)',
          lineHeight: 'var(--leading-display-xl)',
          marginBottom: 'calc(14px * var(--density, 1))',
          textWrap: 'pretty',
        }}
      >
        {punchline(left, today.length, state.tone)}
      </div>

      {left === 0 && (
        <Blueprint style={{ paddingBlock: 'calc(26px * var(--density, 1))', paddingInline: 'calc(18px * var(--density, 1))', textAlign: 'center' }}>
          <div
            style={{
              width: 34,
              height: 34,
              marginTop: '0', marginInline: 'auto', marginBottom: 'calc(12px * var(--density, 1))',
              border: '1.5px solid var(--app-accent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--app-accent)',
            }}
          >
            <Check size={18} />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-display-sm)' }}>
            {today.length === 0 ? 'Nothing due today.' : 'Nothing left today.'}
          </div>
          <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)' }}>
            {/* Not lowercased. It was, to make the date sit inside the
                sentence, and "tue sep 15" reads as a typo rather than as
                prose — a date is a name, and the app writes it one way
                everywhere else. */}
            {/* Three cases, not two. This screen is reached with no courses
                at all now — somebody who has added a task or an appointment
                before their first syllabus — and "the semester is clear" is
                not true of a semester the app has never been told about. */}
            {ahead[0]
              ? `Next up is ${ahead[0].title}, ${ahead[0].dueShort}.`
              : catalog.empty
                ? 'No syllabus yet. Add one and its deadlines land here.'
                : 'The semester is clear.'}
          </div>
        </Blueprint>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(9px * var(--density, 1))' }}>
        {today.map((it) => {
          const done = !!state.done[it.id];
          return (
            <Blueprint
              key={it.id}
              plain
              style={{
                paddingBlock: 'calc(13px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))',
                background: done ? 'transparent' : 'var(--app-panel)',
              }}
            >
            <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'flex-start' }}>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'toggleDone', id: it.id })}
                aria-label={done ? `Mark ${it.title} not done` : `Mark ${it.title} done`}
                // 20px was the icon's size, not a target. This is the most
              // tapped control in the app and it was less than half the
              // size a thumb needs; the padding grows the hit area without
              // moving the box, which is what DeadlineRow already did.
              //
              // Real pixels, not density-scaled. A thumb does not get
              // smaller because somebody asked for a tighter screen, and a
              // sweep read these as spacing once already: scaled, the most
              // tapped control in the app goes 42px to 36 at Tight. Same
              // argument as `components/Fold.tsx`'s FoldHead, which carries
              // the measurement that was taken when it happened there.
              style={{ width: 34, flex: 'none', paddingTop: '11px', paddingRight: '12px', paddingBottom: '11px', paddingLeft: '0', marginBlock: '-9px', marginInline: '0' }}
              >
                <TickBox on={done} />
              </button>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'openItem', id: it.id })}
                style={{ flex: 1, minWidth: 0, opacity: done ? DIMMED_ROW : 1 }}
              >
                <div style={{ display: 'flex', gap: 'calc(7px * var(--density, 1))', alignItems: 'center', marginBottom: 'calc(3px * var(--density, 1))' }}>
                  <CourseTag id={it.c} />
                  <span
                    style={{
                      fontSize: 'var(--type-xs)',
                      ...secondLine(done),
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {it.kind}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-lg)',
                    lineHeight: 'var(--leading-tight)',
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {it.title}
                </div>
                <div style={{ fontSize: 'var(--type-sm)', ...secondLine(done), marginTop: 'calc(3px * var(--density, 1))' }}>
                  {it.dueTime} · {it.where}
                </div>
              </button>
            </div>
            {/* Asked only of something just ticked, and only while the app
                still has something to learn from the answer. */}
            {done && <HowLong id={it.id} courseId={it.c} kind={it.kind} />}
            </Blueprint>
          );
        })}
      </div>
    </Folding>
  );
}

/** One section of the Today feed, so its place in the order can be yours. */
function Feed_tasks() {
  return (
    <>
      <YourTasks />
    </>
  );
}

/**
 * When this run of the app began.
 *
 * Module scope, so it is fixed for as long as the tab is open. Anything
 * ticked after this was ticked here, on this device, in front of the person
 * reading — which is exactly what the line must not report back to them.
 */
const sessionStart = Date.now();

/**
 * What moved while you were not looking.
 *
 * Silent almost always — within a sitting, on a first run, and whenever
 * nothing arrived from anywhere else. It never lists what *you* did: a person
 * who just ticked four things does not need telling they ticked four things.
 */
function Feed_since() {
  const { state, lastSeen } = useStore();
  const now = useNow();

  const list = useMemo(
    () =>
      shouldSpeak(lastSeen, now)
        ? changes({
            lastSeen,
            now,
            tickedAt: state.tickedAt,
            // Anything ticked since this session started was ticked here.
            mine: Object.entries(state.tickedAt)
              .filter(([, at]) => at >= sessionStart)
              .map(([id]) => id),
            feeds: state.feeds.map((f) => ({
              id: f.id,
              name: f.name,
              synced: f.synced,
              count: f.count,
            })),
            updates: state.updates.map((u) => ({ id: u.id, created: u.created })),
            sittings: state.sittings.map((s) => ({ id: s.id, at: s.at })),
          })
        : [],
    [lastSeen, now, state.tickedAt, state.feeds, state.updates, state.sittings],
  );

  if (list.length === 0) return null;

  return (
    <div
      style={{
        paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
        marginBottom: 'calc(14px * var(--density, 1))',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    >
      <div className="kicker">{sinceLabel(lastSeen, now)}</div>
      <div style={{ fontSize: 'var(--type-base-plus)', lineHeight: 'var(--leading-relaxed)', marginTop: 'calc(5px * var(--density, 1))', textWrap: 'pretty' }}>
        {sinceLine(list)}
      </div>
    </div>
  );
}

/** One section of the Today feed. Silent when nothing moves buildings. */
function Feed_walks() {
  return <Walks />;
}

/** One section of the Today feed, so its place in the order can be yours. */
/**
 * The rail's own two measurements, written once.
 *
 * The gutter holds a clock time and the gap separates it from the spine; the
 * rows and the line marking the present both have to sit on them, and two
 * copies of a number is how one of them drifts. Neither is on the spacing
 * scale — a 56px column is a measurement of the widest time this app writes,
 * not a step of the layout's rhythm.
 */
const RAIL_GUTTER = 56;
const RAIL_GAP = 14;

function Feed_rail() {
  const { state, catalog, tint } = useStore();
  const now = useNow();
  // Deadlines with a real hour on them belong on the rail where they happen,
  // not only in a list above it. See `lib/duetime.ts`.
  const due = datedItems(catalog, now).filter((i) => i.isToday && !state.done[i.id]);
  const rail = railFor(catalog, now, state.appointments, state.commitments, due);
  const minutes = minutesNow(now);
  /*
   * Where the day has got to.
   *
   * The rail listed four times and said nothing about which of them you were
   * in the middle of, so the one thing it is opened for — what is on now, what
   * is next — was left to be worked out against the clock on your own phone.
   * `lib/rail.ts` does that arithmetic; everything below only draws it.
   *
   * A deadline drawn on the rail is a moment rather than an hour, so it has no
   * length and is never "on now". A class's length comes from the syllabus's
   * own meeting line where it states one, and is fifty minutes where it does
   * not — `lengthOf`, which the hour grid already reads.
   */
  const read = readDay(rail, minutes, (b) => b.at, (b) => (b.from?.kind === 'item' ? 0 : lengthOf(catalog, b)));
  const line = nowAt(rail, minutes, (b) => b.at);
  const marker = worthMarking(rail, minutes, (b) => b.at);

  /** The rule that says where the present is, drawn between two blocks. */
  const nowRule = (
    <div
      key="now"
      aria-label={`Now, ${clockOf(minutes)}`}
      style={{ display: 'flex', gap: RAIL_GAP, alignItems: 'center', padding: 'var(--sp-2) 0' }}
    >
      <div
        style={{
          width: RAIL_GUTTER,
          flex: 'none',
          textAlign: 'right',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-sm)',
          color: 'var(--app-warn)',
        }}
      >
        {clockOf(minutes)}
      </div>
      <div style={{ width: 1, flex: 'none', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--app-warn)',
          }}
        />
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--app-warn-line)' }} />
    </div>
  );

  return (
    <Folding name="Feed_rail">
      <SectionLabel>Today’s schedule</SectionLabel>
      {rail.length === 0 ? (
        <div style={{ fontSize: 'var(--type-md)', color: 'var(--app-dim)', paddingBottom: 'var(--sp-4)' }}>
          No classes today. Your schedule picks up again on your next teaching day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rail.map((b, i) => {
            const mark = read[i];
            const gone = mark.when === 'past';
            return (
              <Fragment key={i}>
                {marker && i === line && nowRule}
                <div
                  style={{
                    display: 'flex',
                    gap: RAIL_GAP,
                    alignItems: 'stretch',
                    // Everything behind you at once — the hour, the dot and
                    // the words together — rather than the title alone, which
                    // left a column of bright times above a dimmed day.
                    opacity: gone ? DIMMED_ROW : 1,
                  }}
                >
                  {/*
                    A deadline states its hour in prose — "Before class, 1:15p"
                    — which is the right wording in a list and four words too
                    many for a 56px gutter: it wrapped to two lines and pushed
                    the row off the rail's own rhythm. The gutter takes the
                    clock time, in the same format the classes use, and the
                    wording moves down to the meta line where there is room
                    for it.
                  */}
                  <div
                    style={{
                      width: RAIL_GUTTER,
                      flex: 'none',
                      textAlign: 'right',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'var(--type-md)',
                      paddingTop: 'var(--sp-6)',
                      ...secondLine(gone),
                    }}
                  >
                    {b.from?.kind === 'item' ? said(b.at) : b.time}
                  </div>
                  <div style={{ width: 1, background: 'var(--app-line)', position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 16,
                        left: mark.when === 'now' ? -4 : -3,
                        width: mark.when === 'now' ? 9 : 7,
                        height: mark.when === 'now' ? 9 : 7,
                        // The course's own colour, so the rail and the grid
                        // under it say the same thing about the same class.
                        // Office hours stay quieter than the class they belong
                        // to — the same course, at half the presence.
                        background: b.canceled
                          ? 'var(--app-track)'
                          : b.mine
                            ? 'transparent'
                            : b.optional
                              ? tint(b.c).edge
                              : tint(b.c).fill,
                        border: b.mine ? '1px solid var(--app-accent)' : 'none',
                        // The one you are inside gets a ring, so it is found
                        // by the eye before any of the words are read.
                        boxShadow: mark.when === 'now' ? '0 0 0 3px var(--app-warn-wash)' : 'none',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, paddingTop: 'calc(11px * var(--density, 1))', paddingInline: '0', paddingBottom: 'calc(15px * var(--density, 1))', minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 'var(--type-display-sm)',
                        lineHeight: 'var(--leading-display)',
                        opacity: b.canceled ? DIMMED_ROW : 1,
                        textDecoration: b.canceled ? 'line-through' : 'none',
                      }}
                    >
                      {b.title}
                    </div>
                    <div style={{ fontSize: 'var(--type-sm)', ...secondLine(gone || b.canceled) }}>
                      {b.mine && (
                        <span className="tag tag-neutral" style={{ marginRight: 'var(--sp-3)' }}>
                          Yours
                        </span>
                      )}
                      {[b.meta, b.from?.kind === 'item' && b.time !== said(b.at) ? b.time : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {/*
                      Only two blocks in a day ever say anything here: the one
                      running and the one after it. A countdown beside every
                      row is a column nobody reads.
                    */}
                    {mark.said && (
                      <div
                        style={{
                          fontSize: 'var(--type-xs)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          marginTop: 'var(--sp-2)',
                          color: mark.when === 'now' ? 'var(--app-warn)' : 'var(--app-accent-deep)',
                        }}
                      >
                        {mark.said}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            );
          })}
          {marker && line === rail.length && nowRule}
        </div>
      )}
    </Folding>
  );
}

/** One section of the Today feed. Silent unless there is a reason to speak. */
function Feed_dropby() {
  return <DropBy limit={2} />;
}

/**
 * The university's own deadlines, when one is close.
 *
 * Silent the rest of the time, and silent entirely until somebody has filled
 * the sheet in — an empty section that nags is how a person learns to scroll
 * past a whole part of a screen. When it does speak it says the consequence
 * rather than the name, because "last day to drop without a W" means nothing
 * to a first-year and "after this it stays on your transcript" means
 * everything.
 */
function Feed_registrar() {
  const { state, dispatch } = useStore();
  const now = useNow();
  const soon = pressing(state.registrar, now);
  if (soon.length === 0) return null;

  return (
    <Folding name="Feed_registrar">
      <SectionLabel style={{ marginTop: 'calc(14px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(12px * var(--density, 1))' }}>From the registrar</SectionLabel>
      {soon.slice(0, 3).map((d) => (
        <Blueprint
          plain
          key={d.id}
          onClick={() => dispatch({ type: 'go', screen: 'registrar' })}
          style={{ paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', marginBottom: 'var(--sp-4)' }}
        >
          <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)' }}>{d.label}</span>
            <span
              style={{
                flex: 'none',
                fontSize: 'var(--type-sm)',
                color: standing(d, now) === 'ahead' ? undefined : 'var(--app-warn)',
              }}
            >
              {line(d, now)}
            </span>
          </div>
          {d.cost ? (
            <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(5px * var(--density, 1))', lineHeight: 'var(--leading-normal)' }}>
              {d.cost}
            </div>
          ) : null}
        </Blueprint>
      ))}
    </Folding>
  );
}

/**
 * The next tuition instalment, once it is close enough to act on.
 *
 * A fortnight, which is longer than the registrar section's week, because a
 * payment is not a thing you do in an afternoon: it needs money moved, or a
 * parent told, or a plan changed. Silent outside that window, silent for
 * anybody who has not entered a bill, and silent once the balance is settled —
 * so for most students this section never draws at all, which is the point.
 */
function Feed_bill() {
  const { state, dispatch } = useStore();
  const now = useNow();
  const { next } = billFor(state, state.term, now);
  if (!next) return null;
  if (next.daysAway > 14) return null;

  const late = next.overdue;
  return (
    <Folding name="Feed_bill">
      <SectionLabel style={{ marginTop: 'calc(14px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(12px * var(--density, 1))' }}>Money</SectionLabel>
      <Blueprint
        plain
        onClick={() => {
          dispatch({ type: 'setCostsTab', tab: 'bill' });
          dispatch({ type: 'go', screen: 'costs' });
        }}
        style={{ paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', marginBottom: 'var(--sp-4)' }}
      >
        <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-lg)', lineHeight: 'var(--leading-tight)' }}>
            {money(next.shortCents)} due
          </span>
          <span
            style={{ flex: 'none', fontSize: 'var(--type-sm)', color: late ? 'var(--app-warn)' : undefined }}
          >
            {late
              ? next.daysAway === -1
                ? 'yesterday'
                : `${-next.daysAway} days ago`
              : next.daysAway === 0
                ? 'today'
                : `in ${next.daysAway} ${next.daysAway === 1 ? 'day' : 'days'}`}
          </span>
        </div>
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'calc(5px * var(--density, 1))', lineHeight: 'var(--leading-normal)' }}>
          {late
            ? "An unpaid balance is what puts a hold on next term's registration."
            : `Instalment ${next.instalment.n} of your payment plan.`}
        </div>
      </Blueprint>
    </Folding>
  );
}

/**
 * Today, in the order you asked for.
 *
 * Every section is its own component so the list can be reordered and switched
 * off from Settings rather than being one fixed scroll. `visible()` drops what
 * is turned off and appends any section a saved order predates, so an older
 * preference can never hide something that exists now.
 */
const FEED_PARTS: Record<string, () => React.JSX.Element | null> = {
  next: Feed_next,
  due: Feed_due,
  dropby: Feed_dropby,
  registrar: Feed_registrar,
  bill: Feed_bill,
  tasks: Feed_tasks,
  rail: Feed_rail,
  walks: Feed_walks,
  behind: BehindOffer,
  begin: StartToday,
  since: Feed_since,
  gap: GapOffer,
  home: HomeWalk,
  // A section like any other, so its place in the order stays the student's —
  // somebody who wants the warning under the checklist rather than above it
  // can have that without a second setting.
  clash: WorstDay,
  timers: TimerLine,
  applying: ApplyingSoon,
  reading: ReadingsOnTheGo,
  windows: ClosingWindows,
};

/**
 * One section of Today, with the grip that moves it.
 *
 * ## Why a grip rather than the section itself
 *
 * Everywhere else in the app a movable row is its own handle: hold it
 * anywhere and it moves. That cannot be the rule here, because a hold already
 * means something inside these sections — it is how you ask the assistant
 * about the deadline under your thumb, and two press-and-hold gestures on one
 * element cannot both win. So the section is what a drop lands on, and a grip
 * beside its heading is the only thing that starts a drag. Everything inside
 * still answers a hold exactly as it did.
 *
 * ## Where the grip goes, and when it appears at all
 *
 * At the top of its section, in the flow, taking twenty-four pixels of its
 * own. That is the second answer to this question. The first was to measure
 * the section's own first heading and hang the handle in the margin above it,
 * on the reasoning that eighteen sections written over months head themselves
 * differently — `SectionLabel`, a kicker, or nothing at all — so a fixed
 * offset would sit beside the title on some and in mid-air on others.
 *
 * True, and it bought a handle that could not be made big enough. The gap it
 * hung in is about twenty pixels, WCAG 2.2's 2.5.8 wants 24×24 or 24px of
 * clear space, and no overlay reaching out of twenty pixels can find either
 * without reaching into the heading below — which on half of these sections
 * is itself a button, and which it was measurably stealing presses from. A
 * handle that takes its own room needs no measurement and can overlap
 * nothing, so it does that instead.
 *
 * What is still measured is whether the section drew anything at all. Most of
 * them are silent most days: `Feed_since` draws nothing within a sitting,
 * `WorstDay` nothing on an ordinary fortnight. A handle above a section that
 * drew nothing would be a control for a thing that is not there — and the
 * measurement has to ignore the handle itself, or the handle is the thing it
 * finds and every empty section keeps one for ever.
 */
function FeedPart({
  id,
  label,
  feed,
}: {
  id: string;
  label: string;
  feed: ReturnType<typeof useMovable<string>>;
}) {
  const box = useRef<HTMLElement>(null);
  const Part = FEED_PARTS[id];
  /** Whether this section has laid anything out — see the note above. */
  const [drew, setDrew] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const look = () => {
      /*
       * Anything but the handle.
       *
       * The question is whether the *section* drew something, and the handle
       * is part of the section now rather than floating over it — so asking
       * "is this section taller than nothing" would answer yes the moment the
       * handle appeared, and the handle would keep itself alive on every
       * section that draws nothing all term.
       */
      const drawn = [...el.children].some(
        (c) => !c.classList.contains('grip') && c.getBoundingClientRect().height > 0,
      );
      setDrew((was) => (was === drawn ? was : drawn));
    };
    look();
    // A section can fill in after its first paint — a fetch, a timer, a store
    // change — and the grip has to arrive with it rather than at the next
    // render that happens to touch this component.
    const watch = new ResizeObserver(look);
    watch.observe(el);
    return () => watch.disconnect();
  });

  if (!Part) return null;

  return (
    <section
      ref={box}
      {...feed.zone(id, { style: { position: 'relative' } })}
      aria-label={drew ? label : undefined}
    >
      {!drew ? null : (
        <button
          type="button"
          {...feed.grip(id, {
            /*
             * No `tap` class, because the handle is now the size a handle
             * should be.
             *
             * It was 17×16 with a `tap` overlay reaching 44×44 around it, and
             * then `tap-x` reaching sideways only. Both were ways of buying a
             * target for a glyph too small to be one, and the first was worse
             * than the fault it fixed: a 44×44 box centred on the glyph
             * reaches 22px below its middle, and what sits directly below is
             * the heading — which on half of these sections *is* a button,
             * 296×25, the full width of the column. Probed with
             * `document.elementFromPoint` at 420×900, in the grip's own
             * column: a press on the top 14 pixels of "Due today" and the top
             * 8 of "Office hours worth going to" landed on the grip, so
             * tapping a heading to fold its section started a drag hold
             * instead.
             *
             * An overlay cannot fix that, because there is no free direction:
             * the handle lived in a twenty-pixel gap with the section above it
             * and the heading below, and WCAG 2.2's 2.5.8 wants either 24×24
             * or 24px of clear space, neither of which fits in twenty.
             *
             * So the handle takes the room instead of borrowing it. In the
             * flow at the top of its section it is a real 24×24 target that
             * cannot overlap anything, above or below, by construction — and
             * the arithmetic that used to place it in a margin, and the
             * measurement that fed it, are gone with it. The box is in
             * `app.css` under `.grip`, with the heading's own top margin
             * zeroed there so this is the air above a heading rather than air
             * on top of air.
             */
            style: {
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: 'var(--type-sm)',
              // How it looks, and what it does on hover and focus, is in
              // `app.css` under `.grip`. No `touch-action: none` here, unlike
              // the folder's tiles: a finger that lands on the grip and
              // flicks is still scrolling the page, and only a hold means
              // otherwise. What stops the page moving under a drag is in
              // `lib/drag.ts`, and it starts when the hold does.
            },
          })}
          aria-label={`Move ${label}. ${MOVE_HINT}`}
        >
          ⠿
        </button>
      )}
      <Part />
    </section>
  );
}

function TodayFeed() {
  const { state, dispatch } = useStore();
  const soft = useSoft();
  /*
   * The soft shell's hero already is the next class, so the feed drops that
   * one section rather than printing the same fact twice. Everything else the
   * student has ordered or hidden is untouched — this is one part removed,
   * not a second feed.
   */
  const order = visible(state.feedOrder, state.feedHidden).filter((id) => !(soft && id === 'next'));

  /*
   * Arranging Today on Today.
   *
   * Against the *whole* order rather than what is on screen: sections that
   * are switched off, and the one the soft shell drops, are still in it. Drag
   * the checklist above the rail and anything hidden between them stays where
   * it was, rather than being quietly sent to the end of the feed the moment
   * it is switched back on.
   *
   * The same list is arranged in Settings, from the same key. Two places, one
   * order — this is the one you are looking at when you decide.
   */
  const feed = useMovable<string>({
    items: ordered(state.feedOrder),
    onMove: (next) => dispatch({ type: 'setFeedOrder', order: next }),
  });

  if (order.length === 0) {
    return (
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', paddingBlock: 'calc(20px * var(--density, 1))', paddingInline: '0', lineHeight: 'var(--leading-relaxed)' }}>
        Every section of Today is switched off. Turn one back on under Me → Settings.
      </div>
    );
  }

  return (
    <>
      {order.map((id) => (
        <FeedPart key={id} id={id} label={sectionLabel(id)} feed={feed} />
      ))}
    </>
  );
}


/**
 * What you have finished, which nothing in the app showed.
 *
 * The checklist hides an item the moment it is ticked, which is right for
 * getting through a day and wrong at the end of one — the evidence that you did
 * the work disappears exactly when it would be worth seeing.
 */
function DoneToday() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const rowTwelve = useRowStyle(12);
  const done = datedItems(catalog, now).filter((i) => state.done[i.id]);
  const cards = tally(state.reviews);

  return (
    <Folding name="DoneToday">
      <Blueprint style={{ paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(15px * var(--density, 1))', background: 'var(--app-hero)' }}>
        <div className="kicker">Finished</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)', marginTop: 'var(--sp-3)' }}>
          <div className="chrome-text" style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 'var(--leading-none)' }}>
            {done.length}
          </div>
          <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)' }}>
            {done.length === 1 ? 'thing ticked off' : 'things ticked off'}
          </div>
        </div>
        {cards.cards > 0 && (
          <div
            style={{
              marginTop: 'var(--sp-6)',
              paddingTop: 'calc(11px * var(--density, 1))',
              borderTop: '1px solid var(--app-line)',
              fontSize: 'var(--type-base)',
              color: 'var(--app-dim)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            {cards.cards} cards answered, {cards.pct}% right — every one of those moved a unit's
            mastery.
          </div>
        )}
      </Blueprint>

      {done.length === 0 ? (
        <EmptyState
          inline
          title="Nothing ticked off yet"
          body="Anything you finish shows up here, so a day leaves a trace rather than just emptying out."
        />
      ) : (
        <>
          <SectionLabel>What you did</SectionLabel>
          {done.map((i) => (
            <button
              key={i.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: i.id })}
              style={{
                display: 'flex',
                gap: 'var(--sp-6)',
                alignItems: 'center',
                textAlign: 'left',
                ...rowTwelve,
              }}
            >
              <CourseTag id={i.c} style={{ flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--type-md)',
                    lineHeight: 'var(--leading-tight)',
                    textDecoration: 'line-through',
                    color: 'var(--app-dim)',
                  }}
                >
                  {i.title}
                </span>
                <span style={{ display: 'block', fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
                  {i.dueShort} · {i.kind}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
      <div style={{ height: 22 }} />
    </Folding>
  );
}

/**
 * Today by the hour.
 *
 * The rail below tells you what is on, in order. This tells you the shape of
 * the day — that the morning is stacked and the afternoon is free, that the
 * shift starts an hour after the last class, that two things collide. A list
 * cannot show a gap, and a gap is usually the thing you are looking for.
 */
function HoursToday() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  /*
   * Your tasks are on this grid, which for a long time they were not.
   *
   * The tab said "anything you add is tinted by what it is for" and drew
   * classes, appointments and standing commitments — every kind of thing you
   * can add except the one most people add most often. A task you had given
   * an hour to appeared nowhere on any grid in the app. `hoursFor` takes them
   * now, so this tab, the day view and the week grid all get them from the
   * same place rather than three of them being taught separately.
   *
   * And the campus calendar, plus any feed you have connected: on the grid
   * rather than only in a card further down the screen, which is the rule the
   * calendar's day and week grids follow. See `campusHours` in
   * `lib/select.ts`.
   */
  const blocks = [
    ...hoursFor(catalog, now, state.appointments, state.commitments, [], state.tasks),
    ...campusHours(datedEvents(now, state.schoolId, state.sample), state.feedEvents, now).map(
      (b) => ({
        ...b,
        onClick: b.eventId ? () => dispatch({ type: 'openEvent', id: b.eventId! }) : undefined,
      }),
    ),
  ];
  /*
   * The rest of today's tasks: the ones whose time is not a clock.
   *
   * A task's time is your wording and is never parsed into an hour it did not
   * state, so "before work" cannot be a block. Listed under the grid rather
   * than dropped, because a task that is invisible on the one screen that
   * claims to be your day is the bug this whole change is about.
   */
  const untimed = tasksOn(state.tasks, now).filter((t) => !t.done && readDue(t.time) === null);

  return (
    <>
      <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-3)' }}>
        Classes from your syllabi, in the app's own colour. Anything you add is tinted by what it
        is for, and what is on around campus carries its own.
      </div>
      <KindKey />
      {blocks.length === 0 && untimed.length === 0 ? (
        <EmptyState
          inline
          title="Nothing on today"
          body="Add something below and it appears on the grid."
        />
      ) : (
        blocks.length > 0 && (
          <HourGrid blocks={blocks} now={minutesNow(now)} style={{ marginTop: 'calc(14px * var(--density, 1))' }} />
        )
      )}
      {untimed.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 'var(--sp-7)' }}>No hour on them</SectionLabel>
          {untimed.map((t) => (
            <button
              key={t.id}
              type="button"
              className="bare tappable"
              onClick={() => {
                goMine(dispatch, 'tasks');
              }}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                width: '100%',
                textAlign: 'left',
                padding: 'var(--sp-3) 0',
              }}
            >
              <span className="tag tag-neutral">Yours</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)' }}>
                {t.title}
                {t.time.trim() && (
                  <span style={{ color: 'var(--app-dim)' }}> · {t.time.trim()}</span>
                )}
              </span>
            </button>
          ))}
        </>
      )}
      <ActionButton
        onClick={() => {
        goMine(dispatch, 'appointments');
        }}
        style={{ marginTop: 'calc(18px * var(--density, 1))', fontSize: 'var(--type-xs)' }}
      >
        + Add something to the day
      </ActionButton>
      <div style={{ height: 22 }} />
    </>
  );
}

/** Nav mode 1B — one chronological scroll, sliced by the chip row. */
function FeedHome() {
  const { state, dispatch, catalog, tint } = useStore();
  const now = useNow();
  const rowThirteen = useRowStyle(13);
  const entries = filterFeed(catalog, feed(catalog, now, state.done), state.filter as FeedFilter);

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--app-bg)',
          borderBottom: '1px solid var(--app-line)',
          paddingTop: 'calc(10px * var(--density, 1))', paddingRight: '0', paddingBottom: 'calc(10px * var(--density, 1))', paddingLeft: 'calc(18px * var(--density, 1))',
        }}
      >
        <ChipRow
          options={feedFilters(catalog)}
          value={state.filter as FeedFilter}
          onChange={(f) => dispatch({ type: 'setFilter', filter: f })}
        />
      </div>

      <div style={{ padding: 'var(--page-pad)' }}>
        <TodayDecisionSurface />
        <NextClassCard />
        <FlightPlanHomeSlot />
        <RecommendedJourney />

        <div style={{ marginTop: 'calc(22px * var(--density, 1))', display: 'flex', flexDirection: 'column' }}>
          {entries.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`bare${f.itemId ? ' tappable' : ''}`}
              onClick={f.itemId ? () => dispatch({ type: 'openItem', id: f.itemId! }) : undefined}
              style={{
                display: 'flex',
                gap: 'var(--sp-6)',
                alignItems: 'flex-start',
                ...rowThirteen,
                cursor: f.itemId ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  width: 54,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.05,
                  paddingTop: 'var(--sp-1)',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--type-2xs)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--app-dim)',
                  }}
                >
                  {f.top}
                </div>
                <div style={{ fontSize: 'var(--type-display-xs)', color: 'var(--app-dim)' }}>{f.bottom}</div>
              </div>
              <div
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  // The spine of the timeline, in the colour of whatever it
                  // is holding: a day of four courses reads as four threads
                  // rather than one.
                  background: tint(f.c).edge,
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  // Done or cancelled is a state of the whole row. 0.42 was
                  // one of five call sites that had each arrived at 0.40,
                  // 0.42 or 0.45 by eye on the dark ground; the token is
                  // audited on every ground and rises with "Increase
                  // contrast". See `lib/dim.ts`.
                  opacity: f.done || f.canceled ? DIMMED_ROW : 1,
                }}
              >
                <div style={{ display: 'flex', gap: 'calc(7px * var(--density, 1))', alignItems: 'center', marginBottom: 'calc(3px * var(--density, 1))' }}>
                  {/*
                    The chip said "class" a second time by fading to 0.75, and
                    it was the only place in the app that did. The kind is
                    already written out in words immediately beside it, and
                    the filter above the feed separates Classes from Due, so
                    the fade was a third channel carrying nothing — at the
                    cost of the chip's audited ink-on-wash pair, and of 0.32
                    on a row that is also done.
                  */}
                  <CourseTag id={f.c}>
                    {f.code}
                  </CourseTag>
                  <span
                    style={{
                      fontSize: 'var(--type-xs)',
                      ...secondLine(f.done || f.canceled),
                      fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {f.kind}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-lg)',
                    lineHeight: 'var(--leading-tight)',
                    textDecoration: f.done || f.canceled ? 'line-through' : 'none',
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 'var(--type-sm)', ...secondLine(f.done || f.canceled), marginTop: 'var(--sp-1)' }}>{f.meta}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ height: 70 }} />
      </div>
    </>
  );
}

/**
 * Whether Today has nothing to draw — which depends on which Today it is.
 *
 * `TabHome` shows the student's own tasks and appointments in sections of
 * their own, so it has something to draw the moment either exists. `FeedHome`
 * is one list built from `feed(catalog, …)`, which reads classes and deadlines
 * and nothing else — so on a catalogue with only personal entries in it, it
 * drew a header, three chips and nothing at all.
 *
 * Measured under all four navigations with one task and one appointment and no
 * courses: tabs, springboard and shelves each showed both, and feed showed
 * "WED · SEP 9 Today ALL DUE CLASSES" and stopped. That is worse than the
 * first-run screen it replaced, which at least said what to do next.
 *
 * So the feed keeps the old question. It leaves the feed navigation still
 * telling somebody with a task that there is nothing on today, which is the
 * defect this change is about — but fixing it there means putting personal
 * entries into `feed()` itself, and that changes the feed for everybody who
 * uses it rather than only for the empty case. That is a change with its own
 * design in it, and it is not this one.
 */
export function nothingOnToday(
  shape: ReturnType<typeof homeShape>,
  catalog: Catalog,
  state: Pick<State, 'tasks' | 'appointments' | 'feedEvents'>,
): boolean {
  return shape === 'feed' ? catalog.empty : nothingYet(catalog, state);
}

export function Today() {
  const { state, catalog } = useStore();
  // `homeShape` rather than a second `nav === 'feed'` written here. This test
  // and the one in `App.tsx` used to be separate, so a navigation added to
  // one and not the other got the feed's home screen inside the bar's chrome.
  const shape = homeShape(state.nav);
  if (nothingOnToday(shape, catalog, state)) return <FirstRun where="on today" />;
  return shape === 'feed' ? <FeedHome /> : <TabHome />;
}

/** Re-exported for the Me screen's load bars. */
export { Meter };
