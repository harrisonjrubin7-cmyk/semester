import { useMemo } from 'react';
import { useStore } from '../state/store';
import { WorstDay } from '../components/Clashes';
import { TimerLine } from '../components/TimerLine';
import { ApplyingSoon } from '../components/Applying';
import { ReadingsOnTheGo } from '../components/ReadingProgress';
import { ClosingWindows } from '../components/Windows';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, DateRow, Meter, SectionLabel, Segmented, TickBox } from '../components/ui';
import { Check, ChevronRight } from '../components/Icons';
import {
  appointmentsOn,
  railFor,
  tasksOn,
  feedFilters,
  feed,
  filterFeed,
  itemsDueToday,
  nextClass,
  punchline,
  upcomingItems,
  type FeedFilter,
} from '../lib/select';
import { minutesNow } from '../lib/date';
import { datedEvents, datedItems } from '../lib/select';
import { overdueCount } from '../lib/standing';
import { visible } from '../lib/feed';
import { line, pressing, standing } from '../lib/registrar';
import { HowLong } from '../components/HowLong';
import { DropBy } from '../components/DropBy';
import { Walks } from '../components/Walks';
import { BehindOffer } from '../components/BehindOffer';
import { StartToday } from '../components/StartToday';
import { changes, line as sinceLine, shouldSpeak, sinceLabel } from '../lib/since';
import { GapOffer } from './Gap';
import { HomeWalk } from '../components/HomeWalk';
import { Brief } from './Brief';
import { tally } from '../lib/review';
import { hoursFor } from '../lib/select';
import { HourGrid } from '../components/HourGrid';
import { KindKey } from '../components/KindKey';

/** The next-class card, shared by both nav modes. */
function NextClassCard() {
  const { now, catalog } = useStore();
  const next = nextClass(catalog, now);
  if (!next) return null;

  return (
    <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="kicker">Next class</div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(11px * var(--text-scale, 1))',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--app-accent-deep)',
          }}
        >
          {next.untilLabel}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
        <div className="chrome-text" style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 1 }}>
          {next.block.time}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(21px * var(--text-scale, 1))', lineHeight: 1.1 }}>
            {next.block.title}
          </div>
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.7 }}>
            {next.block.c ? catalog.byId[next.block.c].room : next.block.meta}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          paddingTop: 11,
          borderTop: '1px solid var(--app-line)',
          fontSize: 'calc(13px * var(--text-scale, 1))',
          opacity: 0.85,
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
  const { state, dispatch, now, courseCode } = useStore();
  const mine = tasksOn(state.tasks, now);
  const appts = appointmentsOn(state.appointments, now);
  if (mine.length === 0 && appts.length === 0) return null;

  const left = mine.filter((t) => !t.done).length;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '26px 0 12px',
        }}
      >
        <h2 className="section-label" style={{ margin: 0, fontSize: 'calc(12px * var(--text-scale, 1))', fontWeight: 'inherit' }}>
          Yours today
        </h2>
        <button
          type="button"
          className="bare"
          onClick={() => dispatch({ type: 'go', screen: 'mine' })}
          style={{
            width: 'auto',
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--app-accent)',
          }}
        >
          {left > 0 ? `${left} left` : 'All done'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mine.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '10px 0',
              borderBottom: '1px solid var(--app-line)',
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
              style={{ width: 34, flex: 'none', padding: '11px 12px 11px 0', margin: '-9px 0' }}
            >
              <TickBox on={t.done} />
            </button>
            <div style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.42 : 1 }}>
              <div
                style={{
                  fontSize: 'calc(14px * var(--text-scale, 1))',
                  lineHeight: 1.3,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}
              >
                {t.title}
              </div>
              {(t.time || t.courseId) && (
                <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                  {t.courseId ? `${courseCode(t.courseId)} · ` : ''}
                  {t.time}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * What went by without being ticked.
 *
 * Silence was the old behaviour: a deadline passed, the list it lived in
 * dropped it, and the only signal was a count going down — which looks
 * identical to finishing everything. This says the number out loud on the
 * screen you open first, and goes straight to the list of them.
 */
function OverdueBanner() {
  const { state, dispatch, now, catalog } = useStore();
  const missed = overdueCount(datedItems(catalog, now), state.done);
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
        gap: 10,
        alignItems: 'center',
        width: '100%',
        marginTop: 12,
        padding: '11px 13px',
        borderRadius: 12,
        textAlign: 'left',
        border: '1px solid var(--app-warn-line)',
        background: 'var(--app-warn-wash)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.35 }}>
        <strong style={{ fontWeight: 600 }}>
          {missed} {missed === 1 ? 'deadline' : 'deadlines'} went by
        </strong>{' '}
        without being ticked off.
      </span>
      <span
        style={{
          flex: 'none',
          fontFamily: 'var(--font-heading)',
          fontSize: 'calc(11px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        See them
      </span>
    </button>
  );
}

/** Nav mode 1A — a fixed sequence: next class, checklist, rail, campus, week. */
function TabHome() {
  // Today's own sections derive what they need themselves, so what is left
  // here is only what the week tab and the switcher use.
  const { state, dispatch, now, catalog } = useStore();
  const ahead = upcomingItems(catalog, now).filter((i) => !i.isToday);
  const nextEvent = datedEvents(now, state.sample).find((e) => !e.isPast);
  const tab = state.homeTab;

  return (
    <div style={{ padding: 18 }}>
      <Segmented
        options={[
          { id: 'today', label: 'Today' },
          { id: 'hours', label: 'Hours' },
          // "This week" wrapped to two lines once Report made a fifth tab,
          // which made the switcher taller on every Today view.
          { id: 'week', label: 'Week' },
          { id: 'done', label: 'Done' },
          { id: 'brief', label: 'Report' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setHomeTab', tab: next })}
        style={{ margin: '0 0 16px' }}
      />

      {tab === 'brief' && <Brief bare />}

      {tab === 'today' && <TodayFeed />}

      {tab === 'week' && (
        <>
      {nextEvent && (
        <>
          <SectionLabel style={{ margin: '14px 0 12px' }}>On campus</SectionLabel>
          <Blueprint
            onClick={() => dispatch({ type: 'openEvent', id: nextEvent.id })}
            style={{ padding: '13px 14px', display: 'flex', gap: 13, alignItems: 'center' }}
          >
            <div
              style={{ width: 44, flex: 'none', fontFamily: 'var(--font-heading)', lineHeight: 1 }}
            >
              <div
                style={{
                  fontSize: 'calc(10px * var(--text-scale, 1))',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.5,
                }}
              >
                {nextEvent.mon}
              </div>
              <div style={{ fontSize: 'calc(26px * var(--text-scale, 1))' }}>{nextEvent.day}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.25 }}>{nextEvent.title}</div>
              <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6 }}>
                {nextEvent.time} · {nextEvent.where}
              </div>
            </div>
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          </Blueprint>
        </>
      )}

      <SectionLabel>What’s coming</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ahead.slice(0, 5).map((u) => (
          <DateRow
            key={u.id}
            top={u.dow}
            bottom={String(u.day)}
            title={u.title}
            meta={`${catalog.byId[u.c].code} · ${u.weight}`}
            onClick={() => dispatch({ type: 'openItem', id: u.id })}
          />
        ))}
      </div>
        </>
      )}

      {tab === 'hours' && <HoursToday />}

      {tab === 'done' && <DoneToday />}

      <div style={{ height: 26 }} />
    </div>
  );
}

/** One section of the Today feed, so its place in the order can be yours. */
function Feed_next() {
  return (
    <>
      <NextClassCard />
      <OverdueBanner />
    </>
  );
}

/** One section of the Today feed, so its place in the order can be yours. */
function Feed_due() {
  const { state, dispatch, now, catalog } = useStore();
  const today = itemsDueToday(catalog, now);
  const doneCount = today.filter((i) => state.done[i.id]).length;
  const left = today.length - doneCount;
  // Used only by the all-clear line, which names what is next after today.
  const ahead = upcomingItems(catalog, now).filter((i) => !i.isToday);
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '26px 0 4px',
        }}
      >
        <h2 className="section-label" style={{ margin: 0, fontSize: 'calc(12px * var(--text-scale, 1))', fontWeight: 'inherit' }}>
          Due today
        </h2>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            opacity: 0.5,
          }}
        >
          {doneCount} of {today.length} done
        </div>
      </div>
      <div
        className="chrome-text"
        style={{
          fontSize: 'calc(27px * var(--text-scale, 1))',
          lineHeight: 1.08,
          marginBottom: 14,
          textWrap: 'pretty',
        }}
      >
        {punchline(left, today.length)}
      </div>

      {left === 0 && (
        <Blueprint style={{ padding: '26px 18px', textAlign: 'center' }}>
          <div
            style={{
              width: 34,
              height: 34,
              margin: '0 auto 12px',
              border: '1.5px solid var(--app-accent)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--app-accent)',
            }}
          >
            <Check size={18} />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(21px * var(--text-scale, 1))' }}>
            {today.length === 0 ? 'Nothing due today.' : 'Nothing left today.'}
          </div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.6, marginTop: 4 }}>
            {ahead[0]
              ? `Next up is ${ahead[0].title}, ${ahead[0].dueShort.toLowerCase()}.`
              : 'The semester is clear.'}
          </div>
        </Blueprint>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {today.map((it) => {
          const done = !!state.done[it.id];
          return (
            <Blueprint
              key={it.id}
              plain
              style={{
                padding: '13px 14px',
                background: done ? 'transparent' : 'var(--app-panel)',
              }}
            >
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'toggleDone', id: it.id })}
                aria-label={done ? `Mark ${it.title} not done` : `Mark ${it.title} done`}
                // 20px was the icon's size, not a target. This is the most
              // tapped control in the app and it was less than half the
              // size a thumb needs; the padding grows the hit area without
              // moving the box, which is what DeadlineRow already did.
              style={{ width: 34, flex: 'none', padding: '11px 12px 11px 0', margin: '-9px 0' }}
              >
                <TickBox on={done} />
              </button>
              <button
                type="button"
                className="bare"
                onClick={() => dispatch({ type: 'openItem', id: it.id })}
                style={{ flex: 1, minWidth: 0, opacity: done ? 0.4 : 1 }}
              >
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                  <span className="tag tag-accent">{catalog.byId[it.c].code}</span>
                  <span
                    style={{
                      fontSize: 'calc(11px * var(--text-scale, 1))',
                      opacity: 0.55,
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
                    fontSize: 'calc(15px * var(--text-scale, 1))',
                    lineHeight: 1.3,
                    textDecoration: done ? 'line-through' : 'none',
                  }}
                >
                  {it.title}
                </div>
                <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 3 }}>
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
    </>
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
  const { state, now, lastSeen } = useStore();

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
        padding: '11px 13px',
        marginBottom: 14,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    >
      <div className="kicker">{sinceLabel(lastSeen, now)}</div>
      <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.5, marginTop: 5, textWrap: 'pretty' }}>
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
function Feed_rail() {
  const { state, now, catalog } = useStore();
  // Deadlines with a real hour on them belong on the rail where they happen,
  // not only in a list above it. See `lib/duetime.ts`.
  const due = datedItems(catalog, now).filter((i) => i.isToday && !state.done[i.id]);
  const rail = railFor(catalog, now, state.appointments, state.commitments, due);
  const minutes = minutesNow(now);
  return (
    <>
      <SectionLabel>Today’s rail</SectionLabel>
      {rail.length === 0 ? (
        <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.5, paddingBottom: 8 }}>
          No classes today. The rail picks up again on your next teaching day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rail.map((b, i) => {
            const past = b.at < minutes;
            return (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <div
                  style={{
                    width: 56,
                    flex: 'none',
                    textAlign: 'right',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'calc(14px * var(--text-scale, 1))',
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
                          : b.optional
                            ? 'var(--app-accent-deep)'
                            : 'var(--app-accent)',
                      border: b.mine ? '1px solid var(--app-accent)' : 'none',
                    }}
                  />
                </div>
                <div style={{ flex: 1, padding: '11px 0 15px', minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'calc(19px * var(--text-scale, 1))',
                      lineHeight: 1.15,
                      opacity: b.canceled ? 0.45 : past ? 0.6 : 1,
                      textDecoration: b.canceled ? 'line-through' : 'none',
                    }}
                  >
                    {b.title}
                  </div>
                  <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6 }}>
                    {b.mine && (
                      <span className="tag tag-neutral" style={{ marginRight: 6 }}>
                        Yours
                      </span>
                    )}
                    {b.meta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
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
  const { state, dispatch, now } = useStore();
  const soon = pressing(state.registrar, now);
  if (soon.length === 0) return null;

  return (
    <>
      <SectionLabel style={{ margin: '14px 0 12px' }}>From the registrar</SectionLabel>
      {soon.slice(0, 3).map((d) => (
        <Blueprint
          key={d.id}
          onClick={() => dispatch({ type: 'go', screen: 'registrar' })}
          style={{ padding: '12px 14px', marginBottom: 8 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.3 }}>{d.label}</span>
            <span
              style={{
                flex: 'none',
                fontSize: 'calc(12px * var(--text-scale, 1))',
                color: standing(d, now) === 'ahead' ? undefined : 'var(--app-warn)',
              }}
            >
              {line(d, now)}
            </span>
          </div>
          {d.cost ? (
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 5, lineHeight: 1.45 }}>
              {d.cost}
            </div>
          ) : null}
        </Blueprint>
      ))}
    </>
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

function TodayFeed() {
  const { state } = useStore();
  const order = visible(state.feedOrder, state.feedHidden);

  if (order.length === 0) {
    return (
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.55, padding: '20px 0', lineHeight: 1.5 }}>
        Every section of Today is switched off. Turn one back on under Me → Settings.
      </div>
    );
  }

  return (
    <>
      {order.map((id) => {
        const Part = FEED_PARTS[id];
        return Part ? <Part key={id} /> : null;
      })}
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
  const { state, dispatch, now, catalog } = useStore();
  const done = datedItems(catalog, now).filter((i) => state.done[i.id]);
  const cards = tally(state.reviews);

  return (
    <>
      <Blueprint style={{ padding: 15, background: 'var(--app-hero)' }}>
        <div className="kicker">Finished</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
          <div className="chrome-text" style={{ fontSize: 'calc(34px * var(--text-scale, 1))', lineHeight: 1 }}>
            {done.length}
          </div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75 }}>
            {done.length === 1 ? 'thing ticked off' : 'things ticked off'}
          </div>
        </div>
        {cards.cards > 0 && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 11,
              borderTop: '1px solid var(--app-line)',
              fontSize: 'calc(13px * var(--text-scale, 1))',
              opacity: 0.8,
              lineHeight: 1.5,
            }}
          >
            {cards.cards} cards answered, {cards.pct}% right — every one of those moved a unit's
            mastery.
          </div>
        )}
      </Blueprint>

      {done.length === 0 ? (
        <div style={{ padding: '22px 0', fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 1.5 }}>
          Nothing ticked off yet. Anything you finish shows up here, so a day leaves a trace rather
          than just emptying out.
        </div>
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
                gap: 12,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
                textAlign: 'left',
              }}
            >
              <span className="tag tag-accent" style={{ flex: 'none' }}>
                {catalog.byId[i.c]?.code}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'calc(14px * var(--text-scale, 1))',
                    lineHeight: 1.3,
                    textDecoration: 'line-through',
                    opacity: 0.7,
                  }}
                >
                  {i.title}
                </span>
                <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, marginTop: 2 }}>
                  {i.dueShort} · {i.kind}
                </span>
              </span>
            </button>
          ))}
        </>
      )}
      <div style={{ height: 22 }} />
    </>
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
  const { state, dispatch, now, catalog } = useStore();
  const blocks = hoursFor(catalog, now, state.appointments, state.commitments);

  return (
    <>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.5, marginBottom: 6 }}>
        Classes from your syllabi, in the app's own colour. Anything you add is tinted by what it
        is for.
      </div>
      <KindKey />
      {blocks.length === 0 ? (
        <div style={{ padding: '22px 0', fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 1.5 }}>
          Nothing on today. Add something below and it appears on the grid.
        </div>
      ) : (
        <HourGrid blocks={blocks} now={minutesNow(now)} style={{ marginTop: 14 }} />
      )}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => {
          dispatch({ type: 'setMineTab', tab: 'appointments' });
          dispatch({ type: 'go', screen: 'mine' });
        }}
        style={{
          height: 44,
          marginTop: 18,
          fontSize: 'calc(11px * var(--text-scale, 1))',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        + Add something to the day
      </button>
      <div style={{ height: 22 }} />
    </>
  );
}

/** Nav mode 1B — one chronological scroll, sliced by the chip row. */
function FeedHome() {
  const { state, dispatch, now, catalog } = useStore();
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
          padding: '10px 0 10px 18px',
        }}
      >
        <ChipRow
          options={feedFilters(catalog)}
          value={state.filter as FeedFilter}
          onChange={(f) => dispatch({ type: 'setFilter', filter: f })}
        />
      </div>

      <div style={{ padding: 18 }}>
        <NextClassCard />

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column' }}>
          {entries.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`bare${f.itemId ? ' tappable' : ''}`}
              onClick={f.itemId ? () => dispatch({ type: 'openItem', id: f.itemId! }) : undefined}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '13px 0',
                borderBottom: '1px solid var(--app-line)',
                cursor: f.itemId ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  width: 54,
                  flex: 'none',
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.05,
                  paddingTop: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 'calc(10px * var(--text-scale, 1))',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                  }}
                >
                  {f.top}
                </div>
                <div style={{ fontSize: 'calc(17px * var(--text-scale, 1))', opacity: 0.85 }}>{f.bottom}</div>
              </div>
              <div
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  background: f.isClass ? 'var(--app-line)' : 'var(--app-accent)',
                }}
              />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  opacity: f.done || f.canceled ? 0.42 : 1,
                }}
              >
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                  <span className={`tag ${f.isClass ? 'tag-neutral' : 'tag-accent'}`}>{f.code}</span>
                  <span
                    style={{
                      fontSize: 'calc(11px * var(--text-scale, 1))',
                      opacity: 0.55,
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
                    fontSize: 'calc(15px * var(--text-scale, 1))',
                    lineHeight: 1.3,
                    textDecoration: f.done || f.canceled ? 'line-through' : 'none',
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginTop: 2 }}>{f.meta}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ height: 70 }} />
      </div>
    </>
  );
}

export function Today() {
  const { state, catalog } = useStore();
  if (catalog.empty) return <FirstRun where="on today" />;
  return state.nav === 'feed' ? <FeedHome /> : <TabHome />;
}

/** Re-exported for the Me screen's load bars. */
export { Meter };
