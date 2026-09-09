import { useMemo, useState, type HTMLAttributes } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { learned, showSpan } from '../lib/pace';
import { permission, requestPermission, type Permission } from '../lib/notify';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, EmptyState, Meter, SectionLabel, Segmented } from '../components/ui';
import { NotYetOpened } from '../components/NotYetOpened';
import { Group as Panel, NavRow } from '../components/shell/Rows';
import { Bell } from '../components/Icons';
import { NOTIFICATIONS } from '../data/misc';
import { datedItems, loadByCourse } from '../lib/select';
import {
  GROUPS,
  byTask,
  destinationsIn,
  lately,
  listed,
  offered,
  saysFor,
  type Group as Shelves,
} from '../lib/nav';
import { arranged, useMovable } from '../lib/arrange';
import { readOrder, tilesFor, writeOrder } from '../lib/launcher';
import { currentLook } from '../state/shape';
import { Launcher } from '../components/nav/Launcher';
import { directoryOf } from '../lib/look';

import type { CourseModule, Screen } from '../lib/types';
import { cardKey, dueCount, tallyKeys } from '../lib/review';
import { TypeToConfirm } from '../components/TypeToConfirm';
import { CourseTag } from '../components/CourseTag';
import { Insights } from '../components/Insights';
import { weekLine, whereYouStand } from '../lib/you';
import { allCards } from '../data/catalog';
import { liveGuide } from '../lib/live';

/**
 * The shelves, in the order they read: what you study, what you make with it,
 * the semester itself, the upkeep of it, the campus around it, and then you.
 *
 * One at a time rather than all five stacked. The list was a single scroll of
 * twenty-eight rows under five headings, which is a directory you read once
 * and then never again because you cannot remember which heading a thing was
 * under. Five short shelves you can flick between is the same information and
 * a different object.
 */


/** Already a tab on the phone, so listing them again is noise. */
// Settings is not hidden: it is a screen of its own, and this row is the one
// way in from here. It used to be a third tab of this screen as well, which
// meant the same index existed twice — once inline, once as the screen the
// Settings button opens — and the tab was the copy that had to go.
const HIDE_IN_ME: Screen[] = ['home', 'me', 'notifs'];

/**
 * One row of the directory.
 *
 * Pulled out so the Lately list and the shelves are the same object rather
 * than two copies of the same markup that drift — the second copy is where
 * the account's "synced" label would have been forgotten.
 */
function Destination({
  to,
  account,
  drag,
  tookDrop,
}: {
  to: ReturnType<typeof destinationsIn>[number];
  account: { email: string } | null;
  /** Its place on the shelf, on the shelves where that is the student's. */
  drag?: HTMLAttributes<HTMLElement> & { 'data-drop'?: string };
  tookDrop?: () => boolean;
}) {
  const { dispatch, school } = useStore();
  // The directory in the school's own words. See `lib/nav.ts` — the meal row
  // promised everyone "Commodore Cash" until this existed.
  const said = saysFor(to, school.capabilities);
  return (
    <NavRow
      label={to.screen === 'account' && account ? 'Account · synced' : said.label}
      sub={to.screen === 'account' && !account ? 'Not signed in — this device only.' : said.blurb}
      drag={drag}
      // A drop ends in a click on the row it started from, so without this
      // the row you have just moved also opens.
      onClick={() => {
        if (tookDrop?.()) return;
        dispatch({ type: 'go', screen: to.screen });
      }}
    />
  );
}

/**
 * One shelf of the directory, in the order the student put it in.
 *
 * The same look key the launcher's tiles and the Everything screen's rows are
 * dragged into — one arrangement, honoured wherever the shelf is drawn. Three
 * lists of the same shelf that disagreed about its order would be the app
 * arguing with itself.
 *
 * Its own component because a drag is a hook, and a hook cannot be set up
 * inside a loop over the shelves.
 *
 * ## What is dropped on is not always all there is
 *
 * `reveal.ts` hides rows that are real but not useful yet, so this list can be
 * a subset of the shelf. The drop is worked out against the *whole* shelf and
 * only drawn from the visible part: moving Costs above Books then leaves
 * anything hidden between them where it was, rather than silently sending it
 * to the end of the shelf the moment it comes back.
 */
function Shelf({
  group,
  rows,
  account,
}: {
  group: Shelves;
  rows: ReturnType<typeof destinationsIn>;
  account: { email: string } | null;
}) {
  const { state, dispatch, school } = useStore();
  const order = readOrder(currentLook(state).groupOrder);
  const whole = tilesFor(group, school.capabilities, order).map((d) => d.screen);
  const shown = arranged(
    rows.map((d) => d.screen),
    whole,
  );

  const drag = useMovable<Screen>({
    items: whole,
    onMove: (moved) =>
      dispatch({
        type: 'setLook',
        look: { groupOrder: writeOrder({ ...order, [group]: moved }) },
      }),
  });

  const byScreen = new Map(rows.map((d) => [d.screen, d]));
  return (
    <Panel header={group}>
      {shown.map((screen) => (
        <Destination
          key={screen}
          to={byScreen.get(screen)!}
          account={account}
          drag={drag.props(screen)}
          tookDrop={drag.tookDrop}
        />
      ))}
    </Panel>
  );
}

/**
 * One course in the list, with the one question the app still asks.
 *
 * Removing a course is the single thing here that an undo cannot fix — it takes
 * the guide, the units, the cards and every answer recorded against them — so
 * this is where `TypeToConfirm` earns its place. Everything else in the app
 * removes immediately and offers the toast in `Undone.tsx` instead.
 *
 * The row owns its own asking state rather than `Me` owning a "which course is
 * being confirmed" field, because a row is exactly the scope the question has.
 */
export function CourseRow({ module: c }: { module: CourseModule }) {
  const { state, dispatch } = useStore();
  const rowThirteen = useRowStyle(13);
  const [asking, setAsking] = useState(false);

  const cards = c.guide.units.reduce((n, u) => n + u.cards.length, 0);
  const answered = c.guide.units.reduce(
    (n, u) => n + u.cards.filter((card) => state.reviews[cardKey(c.course.id, card.q)]).length,
    0,
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-6)',
        ...rowThirteen,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--type-md)' }}>{c.course.code}</div>
        <div style={{ fontSize: 'var(--type-xs)', opacity: 0.5 }}>
          {c.guide.units.length} units · {c.items.length} deadlines · from {c.course.source}
        </div>
      </div>
      <button
        type="button"
        className="bare"
        onClick={() => setAsking(true)}
        style={{ fontSize: 'var(--type-xs)', opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
      >
        REMOVE
      </button>

      {asking && (
        <TypeToConfirm
          title={`Remove ${c.course.code}`}
          what={[
            `${c.guide.units.length} units and ${cards} cards go with it.`,
            `${c.items.length} deadlines from this syllabus go with it.`,
            answered > 0
              ? `${answered} ${answered === 1 ? 'card you have answered' : 'cards you have answered'} — that history goes too.`
              : 'You have not answered any of its cards yet.',
            'Importing the syllabus again brings the course back, but not the answers.',
          ]}
          want={c.course.code}
          describe="the course code"
          confirmLabel="Remove it"
          onConfirm={() => {
            setAsking(false);
            dispatch({ type: 'removeCourse', id: c.course.id });
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}

export function Me() {
  const { state, dispatch, now, catalog, account , courseCode, school, facts, tint } = useStore();
  const rowNine = useRowStyle(9);
  const rowTen = useRowStyle(10);
  const bars = loadByCourse(catalog, now, state.done);
  const pace = learned(state.spent);

  /*
   * One pass over the deadlines, and every figure on this tab comes out of it.
   *
   * The arithmetic is in `lib/you.ts` rather than here, and the header of that
   * file says why at length. The short version is that this screen has now got
   * a headline number wrong twice, and both times inline: `Credits` was once
   * the literal string '11', and `Done` counted the whole `state.done` map,
   * which keeps the ticks of courses you have since removed and so could
   * report more finished deadlines than the app holds.
   */
  const dated = datedItems(catalog, now);
  const where = whereYouStand({ courses: catalog.courses, items: dated, done: state.done, now });

  /*
   * The drilling record, counted against the decks that actually exist.
   *
   * `tally` over the whole review map would have had the same fault `Done`
   * had — an answer given to a course you removed in September is not part of
   * this term's record — so every deck's keys are recomputed and `tallyKeys`
   * is handed those, which is what it was added for.
   *
   * Two numbers rather than one, because they answer different questions and
   * a screen showing only the second flatters you. `seen` is how much of the
   * deck you have been through at all; `pct` is how you did on it. 90% right
   * across nine of three hundred cards is not a report on the term, and
   * putting the coverage first is what stops it reading as one.
   */
  const cards = useMemo(() => {
    const keys = catalog.courses.flatMap((c) =>
      allCards(liveGuide(catalog, c.id, state.updates, state.reviews)).map((q) => cardKey(c.id, q.q)),
    );
    const t = tallyKeys(keys, state.reviews);
    return {
      deck: keys.length,
      seen: t.cards,
      pct: t.pct,
      due: dueCount(keys, state.reviews, now.getTime()),
    };
  }, [catalog, state.updates, state.reviews, now]);

  /*
   * Four cells at most, and every one of them a door.
   *
   * They used to be four dead numbers, which is the difference between a
   * dashboard and a screen: reading "3 ahead" and then having to remember
   * which tab shows you the three is the app asking you to do its job. Late
   * appears only when something is late — a permanent zero in that column is
   * a red number you learn to stop seeing — and Credits gives its place up
   * when it does, because five columns at 402px is five columns nobody reads.
   */
  const stats: { n: string; l: string; to?: Screen }[] = [
    { n: String(where.ahead), l: 'Ahead', to: 'ahead' },
    ...(where.late > 0 ? [{ n: String(where.late), l: 'Late', to: 'behind' as Screen }] : []),
    { n: String(where.done), l: 'Done' },
    ...(where.late === 0 && where.credits > 0 ? [{ n: String(where.credits), l: 'Credits' }] : []),
    { n: String(where.courses), l: 'Courses', to: 'courses' },
  ];

  const tab = state.meTab;

  // The rule lives in `lib/nav.ts` so the springboard applies exactly the same
  // one against its own dock. It also gates on the school, which this did not:
  // a screen visited before somebody changed university could come back here
  // after the directory had already dropped it.
  const recent = lately(state.recent, state.tabs, school.capabilities, HIDE_IN_ME);

  return (
    <Page>
      {/*
        Every other tab opens on a switcher and then one view. Me was the one
        long scroll in the app — a stats card, then a chart, then five headed
        lists of links — which meant Settings was below five sections of things
        that are not settings.

        Two tabs, not three. Settings was the third, and it rendered the very
        index the Settings screen is: pressing the tab and pressing the
        Settings button landed on the same list, so the app had two homes for
        one thing. The screen kept its own — this keeps the row that opens it.
      */}
      <Segmented
        options={[
          { id: 'you', label: 'You' },
          { id: 'all', label: 'Everything' },
          { id: 'task', label: 'By task' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setMeTab', tab: next })}
        style={{ marginBottom: 'var(--sp-7)' }}
      />

      {tab === 'you' && (
        <>
      {/*
        Nothing imported yet, so there is nothing to report.

        This tab used to answer a fresh install with four zeroes and then stop
        — no chart, no pace, no advice, because every one of those sections
        hides itself when it has nothing. Four zeroes and white space is the
        app's own progress screen telling somebody it is broken, when what is
        actually true is that it has not been given a syllabus yet. So it says
        that, and offers the one thing that would fix it.

        `EmptyState` rather than the `FirstRun` the eight other empty screens
        return, and not by preference: `FirstRun` opens its own `<Page>`, and
        this is a tab inside one that already has the Everything directory in
        its other half. A screen that swapped itself wholesale for the first
        run would take the app's index off the tab that holds it.
      */}
      {catalog.empty ? (
        <EmptyState
          title="Nothing to report yet"
          body="This is where the semester gets counted back to you — what is left, what is late, how the drilling is going and how long things actually take you. All of it comes off a syllabus."
          action={{ label: 'Add a course', onClick: () => dispatch({ type: 'go', screen: 'import' }) }}
        />
      ) : (
        <>
      <Blueprint style={{ padding: 'var(--sp-7)', display: 'flex' }}>
        {stats.map((s, i) => {
          const cell = (
            <>
              <div className="chrome-text" style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1 }}>
                {s.n}
              </div>
              <div
                style={{
                  fontSize: 'calc(10px * var(--text-scale, 1))',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  opacity: 0.5,
                  fontFamily: 'var(--font-heading)',
                  marginTop: 'var(--sp-2)',
                }}
              >
                {s.l}
              </div>
            </>
          );
          const frame = {
            flex: 1,
            textAlign: 'center' as const,
            borderLeft: i === 0 ? 'none' : '1px solid var(--app-line)',
          };
          // A cell with somewhere to go is a button; one without stays a div
          // rather than becoming a button that does nothing when pressed.
          return s.to ? (
            <button
              key={s.l}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'go', screen: s.to as Screen })}
              style={{ ...frame, width: 'auto' }}
            >
              {cell}
            </button>
          ) : (
            <div key={s.l} style={frame}>
              {cell}
            </div>
          );
        })}
      </Blueprint>

      {/*
        What the app noticed, and the one thing to do about each.

        The engine has existed in `src/insights/` since the reports were built
        and ran on two screens, neither of which is the one called Progress.
        That was the gap: somebody who wants to know how the term is going
        opens this tab, and this tab was four counts and a chart — true, and
        none of it advice. `Insights` renders nothing when it has nothing, so
        no placeholder arrives with it.
      */}
      <Insights most={3} />

      {/*
        The two spans that matter — the week you are in, and the term around it.

        One heading over both because they are one question asked at two
        zooms, and because a screen of six headings is a screen you scroll
        past. The week is tappable and the term is not: there is a screen that
        shows the next seven days in hours, and there is no screen that shows
        a semester, so only one of them is a door.
      */}
      <SectionLabel>Where you stand</SectionLabel>

      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'go', screen: 'ahead' })}
        style={{ ...rowTen, display: 'block', textAlign: 'left', width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)' }}>
            This week
          </div>
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>{weekLine(where.week)}</div>
        </div>
        {where.week.due > 0 && (
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <Meter pct={Math.round((where.week.done / where.week.due) * 100)} />
          </div>
        )}
      </button>

      {where.through !== null && (
        <div style={rowTen}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-lg)' }}>
              The term
            </div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>
              {where.done} of {where.total} done
            </div>
          </div>
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <Meter pct={Math.round(where.through * 100)} />
          </div>
          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            {Math.round(where.through * 100)}% of the way from the first deadline on your syllabi to
            the last. The app has not been told a term's dates, so that span is the term it knows.
          </div>
        </div>
      )}

      {/*
        The drilling, told back in three numbers.

        Cards answered rather than cards owned: a deck of two hundred you have
        never opened says nothing about you. The percentage is every answer
        ever given and not a rolling window, which is why it moves slowly and
        why it is worth trusting. Due is the one number here you can act on
        this minute, so the row opens Study.
      */}
      {cards.deck > 0 && (
        <>
          <SectionLabel>Cards</SectionLabel>
          <button
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: 'study' })}
            style={{ ...rowTen, display: 'block', textAlign: 'left', width: '100%' }}
          >
            <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'baseline' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-lg)', fontFamily: 'var(--font-heading)' }}>
                {cards.seen === 0
                  ? `${cards.deck} cards, none answered yet`
                  : `${cards.seen} of ${cards.deck} seen · ${cards.pct}% right`}
              </div>
              {/*
                Silent until it says something the headline has not.

                Before a single card is answered every card is due, so the row
                read "325 cards, none answered yet · 325 due" — one number
                twice, and the second copy dressed as a backlog somebody has
                fallen behind on. It is a full deck, which is what a full deck
                looks like.
              */}
              {cards.seen > 0 && (
                <div style={{ flex: 'none', fontSize: 'var(--type-sm)', opacity: 0.55 }}>
                  {cards.due === 0 ? 'None due' : `${cards.due} due`}
                </div>
              )}
            </div>
            {/*
              The bar is coverage, not accuracy.

              Accuracy is already the second half of the line above it, and a
              bar drawn at 73% beside "73% right" is the same fact twice. What
              the line does not show is how much of the deck that 73% rests
              on, which is the thing a bar is good at.
            */}
            {cards.seen > 0 && (
              <div style={{ marginTop: 'var(--sp-3)' }}>
                <Meter pct={Math.round((cards.seen / cards.deck) * 100)} />
              </div>
            )}
          </button>
        </>
      )}

      {/* An empty section headed "Load by course" is worse than no section. */}
      {bars.length > 0 && <SectionLabel style={{ margin: 'calc(24px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Load by course</SectionLabel>}
      {/*
        A bar per course, and each one opens its course.
        
        The bars were the only chart in the app you could not press. Reading
        "MATH 3620 · 5 left" and then having to find the course by hand in
        another tab is the same fault the stat cells had, drawn in colour.
      */}
      {bars.map((b) => (
        <button
          key={b.code}
          type="button"
          className="bare tappable"
          onClick={() => dispatch({ type: 'openCourse', id: b.id })}
          style={{ ...rowTen, display: 'block', textAlign: 'left', width: '100%' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))' }}>{b.code}</div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}>{b.n} left</div>
          </div>
          <div style={{ marginTop: 'var(--sp-3)' }}>
            {/* Four bars in one metal are four bars you have to read the label
                of. In their courses' colours they are the same four facts,
                comparable at a glance and matched to every other list. */}
            <Meter pct={b.pct} fill={tint(b.id).fill} />
          </div>
        </button>
      ))}

      {/*
        What the app has learned about your pace, shown back to you.

        Only appears once there is something in it, and every row says how many
        reports it rests on — a median of one is a data point wearing a
        median's clothes, and hiding that would make the list look surer than
        it is. There is no comparison with anybody else and no score: it is
        your own arithmetic, told back.
      */}
      {pace.length > 0 && (
        <>
          <SectionLabel>How long things take you</SectionLabel>
          {pace.map((r) => (
            <div
              key={`${r.courseId}-${r.kind}`}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'baseline',
                ...rowNine,
              }}
            >
              <CourseTag id={r.courseId} style={{ flex: 'none' }}>
                {courseCode(r.courseId)}
              </CourseTag>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{r.kind}</span>
              <span style={{ flex: 'none', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{showSpan(r.minutes / 60)}</span>
              <span style={{ flex: 'none', fontSize: 'var(--type-xs)', opacity: 0.45, minWidth: 46, textAlign: 'right' }}>
                {r.from === 1 ? 'from 1' : `from ${r.from}`}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            The middle figure of what you reported, so one all-nighter does not move it. Tick
            something off and the app asks once — it stops asking a kind of work after five.
          </div>
        </>
      )}
        </>
      )}
        </>
      )}

      {tab === 'all' && (
        <>
      {/*
        This used to be seven identical grey buttons in a column, each labelled
        with two words and explaining nothing. "Files & mail" and "Connect
        accounts" sounded like the same thing until you had opened both — and
        largely were, which is why only Connect accounts is left. Now
        everything is grouped and says what it is for, which is most of what
        made the app hard to find your way around.
      */}
      {/*
        Recency above taxonomy. Five shelves fixed "which heading was that
        under", but Take it with you and Connect accounts were still Me →
        Everything → Yours → row. Nobody remembers a shelf for the three
        things they actually revisit; the app already knows what those are.
      */}
      {/*
        Grouped, always, and every shelf at once.

        This was a chip row over one shelf at a time — six chips, and whichever
        you were not on was hidden. That solved the wrong half of the problem.
        The reason a long directory is hard is not that it is long; it is that
        nothing tells you where one kind of thing stops and the next begins, so
        a chip row traded "I cannot see the boundaries" for "I cannot see the
        other five shelves", which is worse: you now have to guess a shelf
        before you are allowed to look at it.

        Drawn panels with headers give the boundaries without hiding anything,
        which is exactly what the settings index does, and what iOS Settings
        does. One scroll, six headed panels, no chip to get wrong. It is the
        same set of rows either way — nothing has been dropped.

        Drawn in whichever layout the app is set to, like everything else.
        This used to force `grouped` on itself, on the argument that a
        directory is findable because every row looks like every other row —
        which it does in all three layouts, because `Panel` and `Destination`
        are the same components either way. Settings forced itself for the
        same reason and has stopped; a directory of the app that does not look
        like the app is one more thing that does not match.
      */}
      {/*
        Tiles or panels — a choice, not a consequence of the layout.

        The two are the same fifty-five rows arranged two ways, and showing
        both would be a directory with a directory on top of it. So one of
        them is drawn, and which one is `state.directory`, chosen on **Layout
        and navigation** beside everything else about the shape of the app.

        It arrived gated on `shell === 'soft'`, which meant the only way to
        get the tiles was to accept a different set of colours, cards and
        type with them, and the only way to keep the drawn look was to give
        the tiles up. Two good ideas soldered together, and unsoldering them
        is what the setting is.

        Read through `directoryOf` rather than off the state, because the
        setting has three states and only two of them are choices. Empty is
        nobody having chosen, and there the layout answers: soft draws the
        tiles, which is the arrangement it was designed alongside. Choosing
        either one ends that for good, in every layout.

        `Lately` and `NotYetOpened` go with the panels. Both are answers to
        "where was that", and the grid answers it by position instead — a
        Lately panel above a grid whose whole claim is that Data is always
        bottom-left would be arguing with the thing under it.
      */}
      {directoryOf(state.directory, state.shell) === 'tiles' ? (
        <Launcher />
      ) : (
        <>
        <nav aria-label="Everything" style={{ margin: '0 -18px' }}>
          {recent.length > 0 && (
            <Panel header="Lately">
              {recent.map((d) => (
                <Destination key={d.screen} to={d} account={account} />
              ))}
            </Panel>
          )}

          {/* Silent for anybody who has been round the app. See `lib/unseen.ts`. */}
          <NotYetOpened />

          {GROUPS.map((group) => {
            // Two gates, and they are different things. `school.ts` hides what
            // this university has no equivalent of — absent, not pending.
            // `reveal.ts` hides what is real and not useful yet, and gives it
            // back the moment there is something for it to work on.
            const rows = listed(group, school.capabilities, facts, state.visited, state.showAll).filter(
              (d) => !HIDE_IN_ME.includes(d.screen),
            );
            if (rows.length === 0) return null;
            return <Shelf key={group} group={group} rows={rows} account={account} />;
          })}
        </nav>
        </>
      )}
        </>
      )}

      {tab === 'task' && (
        <>
          {/*
            The same screens, filed under what somebody is trying to do.

            This was a screen of its own — Everything — whose four views were
            these task headings, the shelves above, the never-opened list that
            `NotYetOpened` already draws, and the shortcut sheet that `?` and
            the guide already carry. Three of the four were this tab with
            different headings, so the screen went and the one view that was
            genuinely its own came here, drawn with the same `Panel` and the
            same rows as the shelves beside it.

            A screen appears under every task it serves, so several appear more
            than once. That is the difference from the shelves, where a screen
            sits on exactly one: a shelf is where a thing lives, and a task is
            what you wanted when you went looking for it.
          */}
          <p
            style={{
              fontSize: 'var(--type-sm)',
              opacity: 0.6,
              lineHeight: 'var(--leading-normal)',
              margin: '0 0 var(--sp-6)',
            }}
          >
            The same screens, filed under what you would be trying to do. Several appear more than
            once, because they answer more than one question.
          </p>
          <nav aria-label="By task" style={{ margin: '0 -18px' }}>
            {byTask(
              offered(school.capabilities).filter((d) => !HIDE_IN_ME.includes(d.screen)),
            ).map((section) => (
              <Panel key={section.tag} header={section.label}>
                {section.rows.map((d) => (
                  <Destination key={d.screen} to={d} account={account} />
                ))}
              </Panel>
            ))}
          </nav>
        </>
      )}
    </Page>
  );
}

export function Notifications() {
  const { state, dispatch } = useStore();

  if (state.cleared) {
    return (
      <Page>
        <EmptyState
          title="All caught up."
          body="We’ll poke you 24 hours before the next deadline."
          icon={<Bell size={18} />}
        />
      </Page>
    );
  }

  return (
    <Page>
      {NOTIFICATIONS.map((n, i) => (
        <Blueprint
          key={n.id}
          plain
          style={{
            padding: '13px 14px',
            marginBottom: 'var(--sp-5)',
            background: i < 2 ? 'var(--app-panel)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
            <span className="tag tag-accent">{n.code}</span>
            <span
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.5,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.1em',
              }}
            >
              {n.when}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(19px * var(--text-scale, 1))',
              lineHeight: 1.15,
              marginTop: 'var(--sp-4)',
            }}
          >
            {n.title}
          </div>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-1)' }}>{n.body}</div>
        </Blueprint>
      ))}
      <ActionButton
        onClick={() => dispatch({ type: 'clearNotifs' })}
        spacing="0.12em"
        style={{ marginTop: 'var(--sp-4)' }}
      >
        Clear all
      </ActionButton>
    </Page>
  );
}

/**
 * The permission the toggles below need, and an honest note about their reach.
 *
 * These switches did nothing for the whole life of the app: no permission was
 * ever requested, no notification ever shown. They work now while the app is
 * running. What they cannot do is wake a closed phone, and saying so here is
 * the difference between a limitation and a lie.
 */
export function Reminders() {
  const [perm, setPerm] = useState<Permission>(() => permission());

  const line =
    perm === 'granted'
      ? 'Reminders are on for this device.'
      : perm === 'denied'
        ? 'This browser is blocking notifications. Turn them back on in its site settings — the app cannot ask again.'
        : perm === 'unsupported'
          ? 'This browser has no notification support, so these stay off.'
          : 'These need permission before anything can be shown.';

  return (
    <div style={{ marginBottom: 'var(--sp-6)' }}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        {line} They arrive while the app is open or running in the background. Waking a phone whose
        browser is closed needs a push server, which this deployment does not have — so treat these
        as a nudge while you are working, not an alarm clock.
      </div>
      {perm === 'default' && (
        <ActionButton
          onClick={() => void requestPermission().then(setPerm)}
          style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--type-xs)' }}
        >
          Allow notifications
        </ActionButton>
      )}
    </div>
  );
}

