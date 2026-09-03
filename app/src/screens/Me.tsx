import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { EmptyState, Meter, SectionLabel, Segmented, Toggle } from '../components/ui';
import { SEED_SUMMARY } from '../data/seed';
import { Bell, ChevronRight } from '../components/Icons';
import { NOTIFICATIONS, NOTIF_DEFS, SOURCES } from '../data/misc';
import { loadByCourse, upcomingItems } from '../lib/select';
import { countHits, findEverything, type Hit } from '../lib/find';
import { destinationsIn, type Group } from '../lib/nav';
import type { Screen } from '../lib/types';

/** The order the directory reads in: what you study, then where, then you. */
const GROUPS: Group[] = ['Study', 'Semester', 'Yours', 'Accounts', 'App'];

/** Already a tab on the phone, so listing them again is noise. */
const HIDE_IN_ME: Screen[] = ['home', 'me', 'notifs'];

export function Me() {
  const { state, dispatch, now, catalog, account } = useStore();
  const ahead = upcomingItems(catalog, now);
  const bars = loadByCourse(catalog, now, state.done);
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

  return (
    <div style={{ padding: 18 }}>
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
            <div className="chrome-text" style={{ fontSize: 30, lineHeight: 1 }}>
              {s.n}
            </div>
            <div
              style={{
                fontSize: 10,
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
      {bars.length > 0 && <SectionLabel style={{ margin: '24px 0 6px' }}>Load by course</SectionLabel>}
      {bars.map((b) => (
        <div key={b.code} style={{ padding: '10px 0', borderBottom: '1px solid var(--app-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{b.code}</div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>{b.n} left</div>
          </div>
          <div style={{ marginTop: 6 }}>
            <Meter pct={b.pct} />
          </div>
        </div>
      ))}

      {/*
        This used to be seven identical grey buttons in a column, each labelled
        with two words and explaining nothing. "Files & mail" and "Connect
        accounts" sound like the same thing until you have opened both. Now
        everything is grouped and says what it is for, which is most of what
        made the app hard to find your way around.
      */}
      {GROUPS.map((group) => {
        const rows = destinationsIn(group).filter((d) => !HIDE_IN_ME.includes(d.screen));
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <SectionLabel style={{ margin: '24px 0 2px' }}>{group}</SectionLabel>
            {rows.map((d) => (
              <button
                key={d.screen}
                type="button"
                className="bare tappable"
                onClick={() => dispatch({ type: 'go', screen: d.screen })}
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
                  <span
                    style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 15.5 }}
                  >
                    {d.screen === 'account' && account ? 'Account · synced' : d.label}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      opacity: 0.55,
                      lineHeight: 1.4,
                      marginTop: 2,
                      textWrap: 'pretty',
                    }}
                  >
                    {d.screen === 'account' && !account ? 'Not signed in — this device only.' : d.blurb}
                  </span>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        );
      })}
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
  const { state, dispatch, now, catalog } = useStore();
  const groups = findEverything(catalog, now, state.query, state.notes, state.tasks);
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
        style={{ height: 44, fontSize: 15 }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Search everything"
      />

      {typed && total > 0 && (
        <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 10 }}>
          {total} {total === 1 ? 'result' : 'results'}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <SectionLabel style={{ margin: '18px 0 4px' }}>{group.label}</SectionLabel>
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
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{hit.title}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.55, lineHeight: 1.35 }}>
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
                fontSize: 11,
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
              fontSize: 19,
              lineHeight: 1.15,
              marginTop: 8,
            }}
          >
            {n.title}
          </div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{n.body}</div>
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

export function Settings() {
  const { state, dispatch } = useStore();

  return (
    <div style={{ padding: 18 }}>
      <SectionLabel style={{ margin: '0 0 6px' }}>Navigation</SectionLabel>
      <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
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

      <SectionLabel style={{ margin: '26px 0 2px' }}>Tell me when</SectionLabel>
      {NOTIF_DEFS.map((n) => (
        <Toggle
          key={n.k}
          label={n.label}
          on={state.notifs[n.k]}
          onChange={() => dispatch({ type: 'toggleNotif', k: n.k })}
        />
      ))}

      <SectionLabel style={{ margin: '26px 0 2px' }}>Your courses</SectionLabel>
      <Toggle
        label={`Sample semester — ${SEED_SUMMARY.courses} courses, ${SEED_SUMMARY.cards} cards, ${SEED_SUMMARY.lessons} lessons`}
        on={state.sample}
        onChange={() => dispatch({ type: 'setSample', on: !state.sample })}
      />
      {state.courses.map((c) => (
        <div
          key={c.course.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>{c.course.code}</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>
              {c.guide.units.length} units · {c.items.length} deadlines · from {c.course.source}
            </div>
          </div>
          <button
            type="button"
            className="bare"
            onClick={() => dispatch({ type: 'removeCourse', id: c.course.id })}
            style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
          >
            REMOVE
          </button>
        </div>
      ))}

      <SectionLabel style={{ margin: '26px 0 2px' }}>Sources</SectionLabel>
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
            <div style={{ fontSize: 14 }}>{s.label}</div>
            <div style={{ fontSize: 11, opacity: 0.5 }}>{s.meta}</div>
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
