import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { Toggle } from '../components/ui';
import { NOTIF_DEFS } from '../data/misc';
import { Check } from '../components/Icons';
import type { Catalog } from '../data/catalog';

/**
 * The first three screens, written from what is actually loaded.
 *
 * These used to be four fixed sentences about one student's four PDFs — a new
 * user was told "We found 38 dated obligations across four courses" before
 * they had uploaded anything, and shown four filenames that were not theirs.
 * The first thing the app said was false, which is a bad way to be trusted
 * with a semester. Now it counts what is there, and when nothing is there it
 * says what will happen instead of pretending it already has.
 */
function steps(cat: Catalog) {
  const n = cat.courses.length;
  const items = cat.items.length;
  const empty = n === 0;

  return [
    {
      k: 'Semester',
      t: empty ? 'Your syllabi. One brain.' : `${n} ${n === 1 ? 'syllabus' : 'syllabi'}. One brain.`,
      b: empty
        ? 'Upload the PDFs your professors posted and get the semester back — every deadline, a study guide you can drill, and a calendar that knows when your classes are.'
        : 'Every deadline in your semester, pulled straight out of the PDFs your professors posted.',
      cta: empty ? 'Show me' : 'Set it up',
    },
    {
      k: 'Step 2 of 3',
      t: empty ? 'Drop one in.' : 'Dropped in. Read.',
      b: empty
        ? 'A syllabus goes in as a PDF, a Word file or pasted text. What comes back is checked before you see it — dates forced into the real calendar, and every quote tested against your own document.'
        : `${items} dated ${items === 1 ? 'obligation' : 'obligations'} across ${n} ${n === 1 ? 'course' : 'courses'} — including the ones buried in prose.`,
      cta: empty ? 'Good' : 'Looks right',
    },
    {
      k: 'Step 3 of 3',
      t: 'When should I bug you?',
      b: 'Change any of this later. Nothing here is permanent.',
      cta: empty ? 'Get started' : 'Start the semester',
    },
  ];
}

/** Three screens: the promise, what it read, and the alerts. */
export function Onboarding() {
  const { state, dispatch, catalog } = useStore();
  const all = steps(catalog);
  const step = all[state.onb] ?? all[0];

  return (
    <div
      className="safe-top"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '70px 24px 42px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 34 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 3, flex: 1, background: 'var(--app-line)' }}>
            <div
              style={{
                height: '100%',
                width: '100%',
                background: 'var(--chrome)',
                opacity: i <= state.onb ? 1 : 0,
              }}
            />
          </div>
        ))}
      </div>

      <div className="kicker">{step.k}</div>
      <div
        className="chrome-text"
        style={{
          fontSize: 42,
          lineHeight: 1.04,
          letterSpacing: '-0.01em',
          margin: '10px 0 14px',
          textWrap: 'pretty',
        }}
      >
        {step.t}
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.5, opacity: 0.72, maxWidth: '30ch' }}>
        {step.b}
      </div>

      {/* Empty boxes on a first run look like something failed to load. */}
      {state.onb === 0 && catalog.courses.length > 0 && (
        <Blueprint
          style={{
            marginTop: 34,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {catalog.courses.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 17,
                  width: 88,
                  color: 'var(--app-accent)',
                }}
              >
                {c.code}
              </div>
              <div style={{ fontSize: 13, opacity: 0.7, flex: 1 }}>{c.name}</div>
            </div>
          ))}
        </Blueprint>
      )}

      {state.onb === 1 && catalog.courses.length > 0 && (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {catalog.courses.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: '1px solid var(--app-line)',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  flex: 'none',
                  border: '1.5px solid var(--app-accent)',
                  background: 'var(--chrome)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#0a0b0e',
                }}
              >
                <Check size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.source || c.code}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.5,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {catalog.items.filter((i) => i.c === c.id).length} dates ·{' '}
                  {catalog.guides[c.id]?.units.length ?? 0} units
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {state.onb === 2 && (
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column' }}>
          {NOTIF_DEFS.map((n) => (
            <Toggle
              key={n.k}
              label={n.label}
              on={state.notifs[n.k]}
              onChange={() => dispatch({ type: 'toggleNotif', k: n.k })}
            />
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 24 }} />

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => dispatch({ type: 'onbNext' })}
        style={{ height: 52, fontSize: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {step.cta}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => dispatch({ type: 'finishOnboarding' })}
        style={{
          height: 34,
          fontSize: 12,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          opacity: 0.55,
        }}
      >
        Skip
      </button>
    </div>
  );
}
