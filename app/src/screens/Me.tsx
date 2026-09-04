import { useState } from 'react';
import { PushSwitch } from '../components/PushSwitch';
import { useStore } from '../state/store';
import { learned, showSpan } from '../lib/pace';
import { WorkWindows } from '../components/WorkWindows';
import { SECTIONS, move, ordered } from '../lib/feed';
import {
  ACCENTS,
  BADGES,
  BODYFACES,
  CORNERS,
  DENSITIES,
  FEEDS,
  GROUNDS,
  ICON_SHAPES,
  LABELS,
  LINE_HEIGHTS,
  READING_WIDTHS,
  SIZES,
  TYPEFACES,
  accentFromHue,
  contrast,
  contrastVerdict,
  ground as groundOf,
} from '../lib/look';
import { permission, requestPermission, type Permission } from '../lib/notify';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, EmptyState, Meter, SectionLabel, Segmented, TickBox, Toggle } from '../components/ui';
import { TabChooser } from '../components/TabChooser';
import { NotYetOpened } from '../components/NotYetOpened';
import { MyRules } from '../components/MyRules';
import { YourCourses } from '../components/YourCourses';
import { SEED_SUMMARY } from '../data/seed';
import { Bell, ChevronRight } from '../components/Icons';
import { NOTIFICATIONS, NOTIF_DEFS, SOURCES } from '../data/misc';
import { loadByCourse, upcomingItems } from '../lib/select';
import { countHits, findEverything, type Hit } from '../lib/find';
import { DESTINATIONS, destinationsFor, destinationsIn, type Group } from '../lib/nav';
import { hiddenFor, schoolLine } from '../lib/school';
import { bundledList } from '../data/schools';

import type { CourseModule, Screen } from '../lib/types';
import { cardKey } from '../lib/review';
import { TypeToConfirm } from '../components/TypeToConfirm';

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
const GROUPS: Group[] = ['Study', 'Make', 'Semester', 'Upkeep', 'Campus', 'Yours'];

/** Already a tab on the phone, so listing them again is noise. */
// Settings is a tab of this screen now, so listing it in the directory would
// send you to a separate copy of what is one tap to the left.
const HIDE_IN_ME: Screen[] = ['home', 'me', 'notifs', 'settings'];

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
}: {
  to: ReturnType<typeof destinationsIn>[number];
  account: { email: string } | null;
}) {
  const { dispatch } = useStore();
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() => dispatch({ type: 'go', screen: to.screen })}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '13px 0',
        borderBottom: '1px solid var(--app-line)',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 'calc(15.5px * var(--text-scale, 1))' }}>
          {to.screen === 'account' && account ? 'Account · synced' : to.label}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(12px * var(--text-scale, 1))',
            opacity: 0.55,
            lineHeight: 1.4,
            marginTop: 2,
            textWrap: 'pretty',
          }}
        >
          {to.screen === 'account' && !account ? 'Not signed in — this device only.' : to.blurb}
        </span>
      </span>
      <ChevronRight size={16} />
    </button>
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
function CourseRow({ module: c }: { module: CourseModule }) {
  const { state, dispatch } = useStore();
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
        gap: 12,
        padding: '13px 0',
        borderBottom: '1px solid var(--app-line)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}>{c.course.code}</div>
        <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}>
          {c.guide.units.length} units · {c.items.length} deadlines · from {c.course.source}
        </div>
      </div>
      <button
        type="button"
        className="bare"
        onClick={() => setAsking(true)}
        style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
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

/**
 * A hue you can drag, with the reason it is safe to offer.
 *
 * A colour picker without a contrast readout is a way to let somebody make
 * their own app unreadable and then wonder why it happened. So the number moves
 * with the slider, in words rather than as a standard nobody outside the trade
 * has heard of: "Easy to read", "Readable", "Hard work at small sizes", "Too
 * faint to read".
 *
 * The check is against `shade` rather than `base`, because `shade` is what
 * section labels are set in — small, uppercase and tracked out, which is the
 * hardest thing on any screen to read and therefore the one worth measuring.
 *
 * It never refuses a colour. Somebody who wants a faint accent for a reason of
 * their own is allowed to have it; what they are not allowed is to have it
 * without being told.
 */
function HuePicker() {
  const { state, dispatch } = useStore();
  const on = state.hue >= 0;
  const g = groundOf(state.ground);
  const derived = accentFromHue(on ? state.hue : 210, g.light);
  // The second entry of the ramp is `--app-bg`, which is the surface a section
  // label actually sits on.
  const ratio = contrast(derived.shade, g.ramp[1]);
  const verdict = contrastVerdict(ratio);

  return (
    <>
      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
        Your own accent
      </SectionLabel>
      <Toggle
        label="Pick a hue instead of one of the accents"
        on={on}
        onChange={() => dispatch({ type: 'setLook', look: { hue: on ? -1 : 210 } })}
      />
      {on && (
        <>
          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={state.hue}
            aria-label="Accent hue"
            onChange={(e) => dispatch({ type: 'setLook', look: { hue: Number(e.target.value) } })}
            style={{
              width: '100%',
              marginTop: 12,
              accentColor: derived.base,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                flex: 'none',
                borderRadius: 'var(--r-sm)',
                background: derived.base,
                border: '1px solid var(--app-line)',
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                fontFamily: 'var(--font-heading)',
                color: derived.shade,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Section label
            </span>
            <span
              style={{
                flex: 'none',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: verdict.ok ? 0.65 : 1,
                color: verdict.ok ? undefined : 'var(--app-warn, #d9534f)',
                textAlign: 'right',
              }}
            >
              {verdict.label}
            </span>
          </div>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
            Measured against the ground you are on, using the smallest thing the accent is
            ever set in — a section label. Nothing stops you keeping a faint one; this only
            makes sure you know.
          </div>
        </>
      )}
    </>
  );
}

export function Me() {
  const { state, dispatch, now, catalog, account , courseCode, school } = useStore();
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

  // The four most recent destinations that are in the directory and not
  // already a tab — a tab is one tap, so listing it here would be noise.
  const recent = state.recent
    .filter((screen) => !HIDE_IN_ME.includes(screen))
    .map((screen) => DESTINATIONS.find((d) => d.screen === screen))
    .filter((d): d is (typeof DESTINATIONS)[number] => Boolean(d))
    // Already on the bar is one tap, so a Lately row for it is noise. Read
    // from the student's own bar rather than a copy of the shipped seven,
    // which stopped being the answer when the bar became theirs to arrange.
    .filter((d) => !state.tabs.includes(d.screen))
    .slice(0, 4);

  return (
    <div style={{ padding: 18 }}>
      {/*
        Every other tab opens on a switcher and then one view. Me was the one
        long scroll in the app — a stats card, then a chart, then five headed
        lists of links — which meant Settings was below five sections of things
        that are not settings.
      */}
      <Segmented
        options={[
          { id: 'you', label: 'You' },
          { id: 'all', label: 'Everything' },
          { id: 'settings', label: 'Settings' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setMeTab', tab: next })}
        style={{ marginBottom: 16 }}
      />

      {tab === 'settings' && <Settings bare />}

      {tab === 'you' && (
        <>
      <Blueprint style={{ padding: 16, display: 'flex' }}>
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
                marginTop: 4,
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
        <div key={b.code} style={{ padding: '10px 0', borderBottom: '1px solid var(--app-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))' }}>{b.code}</div>
            <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55 }}>{b.n} left</div>
          </div>
          <div style={{ marginTop: 6 }}>
            <Meter pct={b.pct} />
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
                gap: 10,
                alignItems: 'baseline',
                padding: '9px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span className="tag tag-accent" style={{ flex: 'none' }}>
                {courseCode(r.courseId)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{r.kind}</span>
              <span style={{ flex: 'none', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{showSpan(r.minutes / 60)}</span>
              <span style={{ flex: 'none', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, minWidth: 46, textAlign: 'right' }}>
                {r.from === 1 ? 'from 1' : `from ${r.from}`}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 8, lineHeight: 1.45 }}>
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
        accounts" sound like the same thing until you have opened both. Now
        everything is grouped and says what it is for, which is most of what
        made the app hard to find your way around.
      */}
      {/*
        Recency above taxonomy. Five shelves fixed "which heading was that
        under", but Take it with you and Connect accounts were still Me →
        Everything → Yours → row. Nobody remembers a shelf for the three
        things they actually revisit; the app already knows what those are.
      */}
      {recent.length > 0 && (
        <>
          <SectionLabel style={{ margin: '4px 0 2px' }}>Lately</SectionLabel>
          {recent.map((d) => (
            <Destination key={d.screen} to={d} account={account} />
          ))}
          <div style={{ height: 20 }} />
        </>
      )}

      {/* Silent for anybody who has been round the app. See `lib/unseen.ts`. */}
      <NotYetOpened />

      <ChipRow
        options={GROUPS}
        value={GROUPS.includes(state.meGroup as Group) ? (state.meGroup as Group) : GROUPS[0]}
        onChange={(next) => dispatch({ type: 'setMeGroup', group: next })}
      />
      {GROUPS.filter((g) => g === (state.meGroup as Group)).map((group) => {
        // Filtered by what this school has: a screen with no equivalent here
        // disappears rather than offering an empty state about somebody's
        // university. See `lib/school.ts`.
        const rows = destinationsFor(group, school.capabilities).filter(
          (d) => !HIDE_IN_ME.includes(d.screen),
        );
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <div style={{ height: 6 }} />
            {rows.map((d) => (
              <Destination key={d.screen} to={d} account={account} />
            ))}
          </div>
        );
      })}
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

/**
 * Search, across the whole app rather than the deadlines alone.
 *
 * It also finds screens, so somebody who wants their Gmail readings does not
 * have to know that the thing they want is called "Files & mail" and lives two
 * taps under Me. Typing what you want is allowed to be the way you get there.
 */
export function Search() {
  const { state, dispatch, now, catalog, school } = useStore();
  const groups = findEverything(catalog, now, state.query, state.notes, state.tasks, school.capabilities);
  const total = countHits(groups);
  const typed = state.query.trim().length > 0;

  const open = (hit: Hit) => {
    switch (hit.kind) {
      case 'item':
        return dispatch({ type: 'openItem', id: hit.id });
      case 'course':
        return dispatch({ type: 'openCourse', id: hit.id });
      case 'unit':
        return dispatch({ type: 'openGuide', id: hit.courseId, mode: hit.mode, unit: hit.unit });
      case 'note':
        return dispatch({ type: 'openNote', id: hit.id });
      case 'task':
        return dispatch({ type: 'setMineTab', tab: 'tasks' }), dispatch({ type: 'go', screen: 'mine' });
      case 'screen':
        return dispatch({ type: 'go', screen: hit.screen });
    }
  };

  return (
    <div style={{ padding: 18 }}>
      <input
        className="input"
        value={state.query}
        onChange={(e) => dispatch({ type: 'setQuery', query: e.target.value })}
        placeholder="A course, a topic, a deadline, a screen…"
        style={{ height: 44, fontSize: 'calc(15px * var(--text-scale, 1))' }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Search everything"
      />

      {typed && total > 0 && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 10 }}>
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
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
                textAlign: 'left',
              }}
            >
              <span className={hit.kind === 'screen' ? 'tag tag-outline' : 'tag tag-accent'}>
                {hit.tag}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.25 }}>{hit.title}</span>
                <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 1.35 }}>
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
      <div style={{ height: 22 }} />
    </div>
  );
}

export function Notifications() {
  const { state, dispatch } = useStore();

  if (state.cleared) {
    return (
      <div style={{ padding: 18 }}>
        <EmptyState
          title="All caught up."
          body="We’ll poke you 24 hours before the next deadline."
          icon={<Bell size={18} />}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      {NOTIFICATIONS.map((n, i) => (
        <Blueprint
          key={n.id}
          plain
          style={{
            padding: '13px 14px',
            marginBottom: 10,
            background: i < 2 ? 'var(--app-panel)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span className="tag tag-accent">{n.code}</span>
            <span
              style={{
                fontSize: 'calc(11px * var(--text-scale, 1))',
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
              marginTop: 8,
            }}
          >
            {n.title}
          </div>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 2 }}>{n.body}</div>
        </Blueprint>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'clearNotifs' })}
        style={{
          height: 42,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginTop: 8,
        }}
      >
        Clear all
      </button>
      <div style={{ height: 22 }} />
    </div>
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
function Reminders() {
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        {line} They arrive while the app is open or running in the background. Waking a phone whose
        browser is closed needs a push server, which this deployment does not have — so treat these
        as a nudge while you are working, not an alarm clock.
      </div>
      {perm === 'default' && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => void requestPermission().then(setPerm)}
          style={{ height: 40, marginTop: 10, fontSize: 'calc(11px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Allow notifications
        </button>
      )}
    </div>
  );
}

export function Settings({ bare = false }: { bare?: boolean } = {}) {
  const { state, dispatch, school } = useStore();
  const hidden = hiddenFor(school.capabilities);

  // `bare` when it is a tab of Me, which has already padded the page; the
  // standalone screen still exists so search and a deep link can reach it.
  return (
    <div style={{ padding: bare ? 0 : 18 }}>
      <SectionLabel style={{ margin: '0 0 6px' }}>Your name</SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 8, textWrap: 'pretty' }}>
        Only used to address you in the app. Never sent anywhere, never guessed at from your
        email, and leaving it blank costs nothing — the app just says "you".
      </div>
      <input
        className="input"
        value={state.myName}
        maxLength={40}
        placeholder="What should the app call you?"
        aria-label="Your name"
        onChange={(e) => dispatch({ type: 'setMyName', name: e.target.value })}
        style={{ width: '100%', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
      />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Navigation</SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
        Two structures, the same screens. The tab bar gives every thing a fixed home. The feed
        interleaves classes and deadlines in one scroll and slices it with a filter row.
      </div>
      <Segmented
        options={[
          { id: 'tabs', label: 'Tab bar' },
          { id: 'feed', label: 'One feed' },
        ]}
        value={state.nav}
        onChange={(nav) => dispatch({ type: 'setNav', nav })}
      />

      {/* Only in tab-bar mode: in feed mode there is no bar to arrange, and
          offering the setting anyway would be a control that does nothing. */}
      {state.nav === 'tabs' && <TabChooser />}

      <YourCourses />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Your Today</SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
        The right order is not the same for everyone. Somebody with a job and one class wants the
        rail first; somebody with a paper due wants the checklist and would rather not scroll past
        a countdown to a lecture they are already walking to.
      </div>
      {ordered(state.feedOrder).map((id, i, all) => {
        const on = !state.feedHidden[id];
        const section = SECTIONS.find((sx) => sx.id === id);
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              borderBottom: '1px solid var(--app-line)',
            }}
          >
            <button
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'toggleFeedSection', id })}
              aria-label={on ? `Hide ${section?.label}` : `Show ${section?.label}`}
              style={{ flex: 'none', width: 30, padding: '12px 2px 12px 0' }}
            >
              <TickBox on={on} />
            </button>
            <div style={{ flex: 1, minWidth: 0, padding: '11px 0', opacity: on ? 1 : 0.5 }}>
              <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}>{section?.label ?? id}</div>
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>{section?.blurb}</div>
            </div>
            <button
              type="button"
              className="bare"
              disabled={i === 0}
              onClick={() => dispatch({ type: 'setFeedOrder', order: move(state.feedOrder, id, -1) })}
              aria-label={`Move ${section?.label} up`}
              style={{ width: 26, flex: 'none', opacity: i === 0 ? 0.2 : 0.6, fontSize: 'calc(15px * var(--text-scale, 1))' }}
            >
              ↑
            </button>
            <button
              type="button"
              className="bare"
              disabled={i === all.length - 1}
              onClick={() => dispatch({ type: 'setFeedOrder', order: move(state.feedOrder, id, 1) })}
              aria-label={`Move ${section?.label} down`}
              style={{
                width: 26,
                flex: 'none',
                opacity: i === all.length - 1 ? 0.2 : 0.6,
                fontSize: 'calc(15px * var(--text-scale, 1))',
              }}
            >
              ↓
            </button>
          </div>
        );
      })}

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>The accent</SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
        All metals and stones. The accent being a metal rather than a colour is most of why the
        app looks drawn instead of like a dashboard, so these change the shade and not that.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ACCENTS.map((a) => {
          const on = state.accent === a.id;
          return (
            <button
              key={a.id}
              type="button"
              className="btn"
              onClick={() => dispatch({ type: 'setLook', look: { accent: a.id } })}
              aria-pressed={on}
              style={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 12px',
                fontSize: 'calc(12px * var(--text-scale, 1))',
                borderColor: on ? a.base : 'var(--app-line)',
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: a.base,
                  flex: 'none',
                }}
              />
              {a.label}
            </button>
          );
        })}
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>The ground</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {GROUNDS.map((g) => {
          const on = state.ground === g.id;
          return (
            <button
              key={g.id}
              type="button"
              className="bare tappable"
              aria-pressed={on}
              onClick={() => dispatch({ type: 'setLook', look: { ground: g.id } })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              {/* The ramp itself, as five squares — quicker to judge than a name. */}
              <span style={{ display: 'flex', flex: 'none', borderRadius: 3, overflow: 'hidden' }}>
                {/* Keyed by position, not by colour: three of the grounds
                    repeat a step — ink starts on black twice, paper and fog
                    both end on white — and keying by the value made React
                    drop the duplicate, so those swatches showed four bars
                    where every other one showed five. */}
                {g.ramp.map((step, i) => (
                  <span key={i} style={{ width: 8, height: 22, background: step }} />
                ))}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))' }}>{g.label}</span>
                <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
                  {g.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {groundOf(state.ground).light && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
          On a light ground the brushed-metal type inverts to a dark sweep, so display headings
          keep their lustre instead of disappearing.
        </div>
      )}

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Headings</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TYPEFACES.map((t) => {
          const on = state.typeface === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className="btn"
              aria-pressed={on}
              onClick={() => dispatch({ type: 'setLook', look: { typeface: t.id } })}
              style={{
                flex: 'none',
                padding: '7px 12px',
                fontSize: 'calc(13px * var(--text-scale, 1))',
                fontFamily: t.heading,
                borderColor: on ? 'var(--app-accent)' : 'var(--app-line)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {TYPEFACES.find((t) => t.id === state.typeface)?.blurb}
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Body text</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {BODYFACES.map((b) => {
          const on = state.bodyface === b.id;
          return (
            <button
              key={b.id}
              type="button"
              className="btn"
              aria-pressed={on}
              onClick={() => dispatch({ type: 'setLook', look: { bodyface: b.id } })}
              style={{
                flex: 'none',
                padding: '7px 12px',
                fontSize: 'calc(13px * var(--text-scale, 1))',
                fontFamily: b.body,
                borderColor: on ? 'var(--app-accent)' : 'var(--app-line)',
              }}
            >
              {b.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {BODYFACES.find((b) => b.id === state.bodyface)?.blurb}
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Line spacing</SectionLabel>
      <Segmented
        options={LINE_HEIGHTS.map((l) => ({ id: l.id, label: l.label }))}
        value={state.lineHeight}
        onChange={(lineHeight) => dispatch({ type: 'setLook', look: { lineHeight } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        Separate from text size on purpose. “I cannot see this” and “this is a wall” are two
        different complaints, and one control for both fixes neither properly.
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Reading width</SectionLabel>
      <Segmented
        options={READING_WIDTHS.map((w) => ({ id: w.id, label: w.label }))}
        value={state.readingWidth}
        onChange={(readingWidth) => dispatch({ type: 'setLook', look: { readingWidth } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {READING_WIDTHS.find((w) => w.id === state.readingWidth)?.blurb} Applies to the screens
        that are read rather than scanned — a guide, an essay. The app’s column is already close to
        the comfortable measure, so in practice this narrows it rather than widening it: past about
        75 characters the eye loses the start of the next line coming back, and the column does not
        get that far.
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Today’s feed</SectionLabel>
      <Segmented
        options={FEEDS.map((f) => ({ id: f.id, label: f.label }))}
        value={state.feed}
        onChange={(feed) => dispatch({ type: 'setLook', look: { feed } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {FEEDS.find((f) => f.id === state.feed)?.blurb}
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Tab bar</SectionLabel>
      <Segmented
        options={LABELS.map((l) => ({ id: l.id, label: l.label }))}
        value={state.labels}
        onChange={(labels) => dispatch({ type: 'setLook', look: { labels } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {LABELS.find((l) => l.id === state.labels)?.blurb} The names stay for a screen reader
        either way.
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Icon shape</SectionLabel>
      <Segmented
        options={ICON_SHAPES.map((i) => ({ id: i.id, label: i.label }))}
        value={state.iconShape}
        onChange={(iconShape) => dispatch({ type: 'setLook', look: { iconShape } })}
      />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Badges</SectionLabel>
      <Segmented
        options={BADGES.map((b) => ({ id: b.id, label: b.label }))}
        value={state.badges}
        onChange={(badges) => dispatch({ type: 'setLook', look: { badges } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        {BADGES.find((b) => b.id === state.badges)?.blurb} A number is a claim on your attention,
        and an app that puts one on everything has made them all mean nothing.
      </div>

      <HuePicker />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Corners</SectionLabel>
      <Segmented
        options={CORNERS.map((c) => ({ id: c.id, label: c.label }))}
        value={state.corners}
        onChange={(corners) => dispatch({ type: 'setLook', look: { corners } })}
      />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Spacing</SectionLabel>
      <Segmented
        options={DENSITIES.map((d) => ({ id: d.id, label: d.label }))}
        value={state.density}
        onChange={(density) => dispatch({ type: 'setLook', look: { density } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        Tightens the space around every section heading, which is the app’s vertical rhythm.
        Tap targets do not shrink with it — a 30px button is a miss, and a miss costs more than
        the line it saved.
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Text size</SectionLabel>
      <Segmented
        options={SIZES.map((z) => ({ id: z.id, label: z.label }))}
        value={state.textSize}
        onChange={(textSize) => dispatch({ type: 'setLook', look: { textSize } })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
        Scales the text. Buttons and the tab bar keep their size on purpose — a tap target that
        grew with the type would push the bar off the bottom of a phone.
      </div>

      {/* The one setting that changes an arithmetic rather than a look. */}
      <WorkWindows />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
        Testing-centre lead time
      </SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, marginBottom: 9 }}>
        If you book exams through Student Access, its lead time is stated in business days and
        counting those backwards over a weekend is easy to get wrong. Set it here and the exam
        runway does it. Leave it at zero if you do not use one.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="input"
          type="number"
          min={0}
          max={30}
          value={state.accessLeadDays}
          aria-label="Business days before an exam"
          onChange={(e) => dispatch({ type: 'setAccessLead', days: Number(e.target.value) })}
          style={{ width: 90, flex: 'none' }}
        />
        <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6 }}>
          {state.accessLeadDays === 0
            ? 'not used'
            : `business days before an exam`}
        </span>
      </div>

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}>Tell me when</SectionLabel>
      <Reminders />
      {NOTIF_DEFS.map((n) => (
        <Toggle
          key={n.k}
          label={n.label}
          on={state.notifs[n.k]}
          onChange={() => dispatch({ type: 'toggleNotif', k: n.k })}
        />
      ))}

      <MyRules />

      <PushSwitch />

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Where you study</SectionLabel>
      <Segmented
        options={[
          ...bundledList().map((sc) => ({ id: sc.id, label: sc.shortName ?? sc.name })),
          { id: '', label: 'Somewhere else' },
        ]}
        value={state.schoolId}
        onChange={(id) => dispatch({ type: 'setSchool', id })}
      />
      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45, textWrap: 'pretty' }}>
        {schoolLine(school)}
      </div>
      {hidden.length > 0 && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45, textWrap: 'pretty' }}>
          {/* Named rather than counted. "3 screens are hidden" invites the
              question this answers. */}
          Hidden: {hidden.map((h) => DESTINATIONS.find((d) => d.screen === h)?.label ?? h).join(', ')}.
          Everything else — your courses, deadlines, grades, cards, papers, essays, the weekly
          report — works the same wherever you are.
        </div>
      )}

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}>Your courses</SectionLabel>
      <Toggle
        label={`Sample semester — ${SEED_SUMMARY.courses} courses, ${SEED_SUMMARY.cards} cards, ${SEED_SUMMARY.lessons} lessons`}
        on={state.sample}
        onChange={() => dispatch({ type: 'setSample', on: !state.sample })}
      />
      {state.courses.map((c) => (
        <CourseRow key={c.course.id} module={c} />
      ))}

      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}>Sources</SectionLabel>
      {SOURCES.map((s) => (
        <div
          key={s.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}>{s.label}</div>
            <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}>{s.meta}</div>
          </div>
          <span className="tag tag-outline">{s.state}</span>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => dispatch({ type: 'restartOnboarding' })}
        style={{
          height: 44,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: 24,
        }}
      >
        Replay onboarding
      </button>
      <div style={{ height: 22 }} />
    </div>
  );
}
