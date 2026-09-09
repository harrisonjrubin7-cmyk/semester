import { useState, type HTMLAttributes } from 'react';
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
import { loadByCourse, upcomingItems } from '../lib/select';
import { countHits, findEverything, type Hit } from '../lib/find';
import { openHit } from '../lib/openhit';
import { GROUPS, destinationsIn, lately, listed, saysFor, type Group as Shelves } from '../lib/nav';
import { arranged, useMovable } from '../lib/arrange';
import { readOrder, tilesFor, writeOrder } from '../lib/launcher';
import { currentLook } from '../state/shape';
import { Launcher } from '../components/nav/Launcher';
import { directoryOf } from '../lib/look';

import type { CourseModule, Screen } from '../lib/types';
import { cardKey } from '../lib/review';
import { TypeToConfirm } from '../components/TypeToConfirm';
import { CourseTag } from '../components/CourseTag';

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
  const ahead = upcomingItems(catalog, now);
  const bars = loadByCourse(catalog, now, state.done);
  const pace = learned(state.spent);
  const doneCount = Object.values(state.done).filter(Boolean).length;

  // Credits used to be the literal string '11', which stayed 11 for a new user
  // with no courses at all. It is a sum, and when no syllabus states credits
  // the column is dropped rather than shown as zero.
  const credits = catalog.courses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);
  const stats = [
    { n: String(catalog.courses.length), l: 'Courses' },
    ...(credits > 0 ? [{ n: String(credits), l: 'Credits' }] : []),
    { n: String(ahead.length), l: 'Ahead' },
    { n: String(doneCount), l: 'Done' },
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
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setMeTab', tab: next })}
        style={{ marginBottom: 'var(--sp-7)' }}
      />

      {tab === 'you' && (
        <>
      <Blueprint style={{ padding: 'var(--sp-7)', display: 'flex' }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              flex: 1,
              textAlign: 'center',
              borderLeft: i === 0 ? 'none' : '1px solid var(--app-line)',
            }}
          >
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
          </div>
        ))}
      </Blueprint>

      {/* An empty section headed "Load by course" is worse than no section. */}
      {bars.length > 0 && <SectionLabel style={{ margin: 'calc(24px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Load by course</SectionLabel>}
      {bars.map((b) => (
        <div key={b.code} style={rowTen}>
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
        </div>
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
    </Page>
  );
}

/**
 * Search, across the whole app rather than the deadlines alone.
 *
 * It also finds screens, so somebody who wants their Gmail readings does not
 * have to know that the thing they want is called "Connect accounts" and lives
 * two taps under Me. Typing what you want is allowed to be the way you get
 * there.
 */
export function Search() {
  const { state, dispatch, now, catalog, school } = useStore();
  const rowTwelve = useRowStyle(12);
  const groups = findEverything(catalog, now, state.query, state.notes, state.tasks, school.capabilities, state.updates);
  const total = countHits(groups);
  const typed = state.query.trim().length > 0;

  // Shared with the search overlay rather than repeated. Two copies drift the
  // first time a kind of hit is added, and a result that opens from one place
  // and not the other reads as the app being broken. See `lib/openhit.ts`.
  const open = (hit: Hit) => openHit(hit, dispatch);

  return (
    <Page>
      <input
        className="input"
        value={state.query}
        onChange={(e) => dispatch({ type: 'setQuery', query: e.target.value })}
        placeholder="A course, a topic, a deadline, a screen…"
        style={{ height: 44, fontSize: 'var(--type-lg)' }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Search everything"
      />

      {typed && total > 0 && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-5)' }}>
          {total} {total === 1 ? 'result' : 'results'}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <SectionLabel style={{ margin: 'calc(18px * var(--density, 1)) 0 calc(4px * var(--density, 1))' }}>{group.label}</SectionLabel>
          {group.hits.map((hit) => (
            <button
              key={`${hit.kind}-${hit.title}-${hit.sub}`}
              type="button"
              className="bare tappable"
              onClick={() => open(hit)}
              style={{
                display: 'flex',
                gap: 'var(--sp-5)',
                alignItems: 'center',
                textAlign: 'left',
                ...rowTwelve,
              }}
            >
              <span className={hit.kind === 'screen' ? 'tag tag-outline' : 'tag tag-accent'}>
                {hit.tag}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 1.25 }}>{hit.title}</span>
                <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.55, lineHeight: 1.35 }}>
                  {hit.sub}
                </span>
              </span>
            </button>
          ))}
        </div>
      ))}

      {typed && total === 0 && (
        <EmptyState
          title={`Nothing matches “${state.query}”.`}
          body="Try a course code, a topic from a guide, a professor, or the name of a screen."
        />
      )}

      {!typed && (
        <EmptyState
          title="Search everything."
          body="Deadlines, courses, study units, your own notes and tasks — and the app's own screens, so you can type where you want to go instead of hunting for it."
        />
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

