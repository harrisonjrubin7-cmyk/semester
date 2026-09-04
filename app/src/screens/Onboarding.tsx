import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { Toggle } from '../components/ui';
import { NOTIF_DEFS } from '../data/misc';
import { Check } from '../components/Icons';
import type { Catalog } from '../data/catalog';
import { SchoolPicker } from '../components/SchoolPicker';

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
      k: 'Step 2 of 4',
      t: empty ? 'Drop one in.' : 'Dropped in. Read.',
      b: empty
        ? 'A syllabus goes in as a PDF, a Word file or pasted text. What comes back is checked before you see it — dates forced into the real calendar, and every quote tested against your own document.'
        : `${items} dated ${items === 1 ? 'obligation' : 'obligations'} across ${n} ${n === 1 ? 'course' : 'courses'} — including the ones buried in prose.`,
      cta: empty ? 'Good' : 'Looks right',
    },
    {
      k: 'Step 3 of 4',
      t: 'Where do you study?',
      /*
       * Asked, and genuinely optional.
       *
       * What it buys is small and specific: the meal screen, the move-out
       * countdown, the campus map, and the app calling your registrar by the
       * name you call it. What it does not touch is everything anybody comes
       * here for — so the skip below is a real path and is worded like one.
       */
      b: 'It switches on the handful of screens that only make sense on a campus, and changes a few words. Everything else works without it.',
      cta: 'Next',
    },
    {
      k: 'Step 4 of 4',
      t: 'When should I bug you?',
      b: 'Change any of this later. Nothing here is permanent.',
      cta: empty ? 'Get started' : 'Start the semester',
    },
  ];
}

/** Four screens: the promise, what it read, where you study, and the alerts. */
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
        {all.map((_, i) => (
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
          fontSize: 'calc(42px * var(--text-scale, 1))',
          lineHeight: 1.04,
          letterSpacing: '-0.01em',
          margin: '10px 0 14px',
          textWrap: 'pretty',
        }}
      >
        {step.t}
      </div>
      <div style={{ fontSize: 'calc(16px * var(--text-scale, 1))', lineHeight: 1.5, opacity: 0.72, maxWidth: '30ch' }}>
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
                  fontSize: 'calc(17px * var(--text-scale, 1))',
                  width: 88,
                  color: 'var(--app-accent)',
                }}
              >
                {c.code}
              </div>
              <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, flex: 1 }}>{c.name}</div>
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
                  color: 'var(--chrome-ink)',
                }}
              >
                <Check size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'calc(13px * var(--text-scale, 1))',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.source || c.code}
                </div>
                <div
                  style={{
                    fontSize: 'calc(11px * var(--text-scale, 1))',
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
        <div style={{ marginTop: 26 }}>
          <SchoolPicker />
        </div>
      )}

      {state.onb === 3 && (
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
        style={{ height: 52, fontSize: 'calc(16px * var(--text-scale, 1))', letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {step.cta}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={() => dispatch({ type: 'finishOnboarding' })}
        style={{
          height: 34,
          fontSize: 'calc(12px * var(--text-scale, 1))',
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
