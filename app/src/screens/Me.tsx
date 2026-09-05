import { useState } from 'react';
import { useStore } from '../state/store';
import { learned, showSpan } from '../lib/pace';
import { permission, requestPermission, type Permission } from '../lib/notify';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, EmptyState, Meter, SectionLabel, Segmented } from '../components/ui';
import { NotYetOpened } from '../components/NotYetOpened';
import { Bell, ChevronRight } from '../components/Icons';
import { NOTIFICATIONS } from '../data/misc';
import { loadByCourse, upcomingItems } from '../lib/select';
import { countHits, findEverything, type Hit } from '../lib/find';
import { destinationsIn, lately, listed, saysFor, type Group } from '../lib/nav';

import type { CourseModule, Screen } from '../lib/types';
import { cardKey } from '../lib/review';
import { TypeToConfirm } from '../components/TypeToConfirm';
import { SettingsIndex } from './settings/Index';

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
  const { dispatch, school } = useStore();
  // The directory in the school's own words. See `lib/nav.ts` — the meal row
  // promised everyone "Commodore Cash" until this existed.
  const said = saysFor(to, school.capabilities);
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
          {to.screen === 'account' && account ? 'Account · synced' : said.label}
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
          {to.screen === 'account' && !account ? 'Not signed in — this device only.' : said.blurb}
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
export function CourseRow({ module: c }: { module: CourseModule }) {
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

export function Me() {
  const { state, dispatch, now, catalog, account , courseCode, school, facts } = useStore();
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
        // Two gates, and they are different things. `school.ts` hides what
        // this university has no equivalent of — absent, not pending.
        // `reveal.ts` hides what is real and not useful yet, and gives it back
        // the moment there is something for it to work on.
        const rows = listed(group, school.capabilities, facts, state.visited, state.showAll).filter(
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

/**
 * Settings.
 *
 * The screen itself is now an index of pages — see `screens/settings/`. This
 * is left here as the entry point the tab of Me and the router both already
 * import, so nothing had to learn a new name.
 *
 * @param bare - rendered inside Me, which has already padded the page.
 */
export function Settings({ bare = false }: { bare?: boolean } = {}) {
  return (
    <div style={{ padding: bare ? '0' : '18px 0 0' }}>
      <SettingsIndex />
    </div>
  );
}
