import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { EmptyState, Meter, SectionLabel, Segmented, Toggle } from '../components/ui';
import { SEED_SUMMARY } from '../data/seed';
import { Bell } from '../components/Icons';
import { NOTIFICATIONS, NOTIF_DEFS, SOURCES } from '../data/misc';
import { loadByCourse, searchItems, upcomingItems } from '../lib/select';

export function Me() {
  const { state, dispatch, now, catalog, account } = useStore();
  const ahead = upcomingItems(catalog, now);
  const bars = loadByCourse(catalog, now, state.done);
  const doneCount = Object.values(state.done).filter(Boolean).length;

  const stats = [
    { n: String(catalog.courses.length), l: 'Courses' },
    { n: '11', l: 'Credits' },
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

      <SectionLabel style={{ margin: '24px 0 6px' }}>Load by course</SectionLabel>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22 }}>
        {/* The feed has no tab bar, so this screen is where the rest of the app
            stays reachable in that mode. */}
        {state.nav === 'feed' &&
          (
            [
              ['courses', 'Courses'],
              ['study', 'Study'],
              ['calendar', 'Calendar'],
            ] as const
          ).map(([screen, label]) => (
            <button
              key={screen}
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => dispatch({ type: 'go', screen })}
              style={{ height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            >
              {label}
            </button>
          ))}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'import' })}
          style={{ height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Import a syllabus
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'account' })}
          style={{ height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {account ? 'Account · synced' : 'Sign in to sync'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'connect' })}
          style={{ height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Connect accounts
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'ask' })}
          style={{ height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Ask Claude
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'settings' })}
          style={{ height: 44, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Settings
        </button>
      </div>
      <div style={{ height: 22 }} />
    </div>
  );
}

export function Search() {
  const { state, dispatch, now, catalog } = useStore();
  const results = searchItems(catalog, now, state.query);
  const typed = state.query.trim().length > 0;

  return (
    <div style={{ padding: 18 }}>
      <input
        className="input"
        value={state.query}
        onChange={(e) => dispatch({ type: 'setQuery', query: e.target.value })}
        placeholder="Quiz, pset, Trounstine, Friday…"
        style={{ height: 44, fontSize: 15 }}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-label="Search deadlines"
      />

      {typed && results.length > 0 && (
        <>
          <SectionLabel style={{ margin: '20px 0 4px' }}>
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </SectionLabel>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: r.id })}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span className="tag tag-accent">{catalog.byId[r.c].code}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, lineHeight: 1.25 }}>{r.title}</span>
                <span style={{ display: 'block', fontSize: 11, opacity: 0.55 }}>
                  {r.dueShort} · {r.kind}
                </span>
              </span>
            </button>
          ))}
        </>
      )}

      {typed && results.length === 0 && (
        <EmptyState
          title={`Nothing matches “${state.query}”.`}
          body="Try a course code, a professor, or a week."
        />
      )}

      {!typed && (
        <EmptyState
          title="Search the semester."
          body="Titles, professors, kinds and dates across all four courses."
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
