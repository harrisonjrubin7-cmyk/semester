import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { Toggle } from '../components/ui';
import { NOTIF_DEFS, ONBOARDING, ONBOARDING_FILES } from '../data/misc';
import { Check } from '../components/Icons';

/** Three screens: the promise, the four PDFs it just read, and the alerts. */
export function Onboarding() {
  const { state, dispatch, catalog } = useStore();
  const step = ONBOARDING[state.onb] ?? ONBOARDING[0];

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

      {state.onb === 0 && (
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

      {state.onb === 1 && (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ONBOARDING_FILES.map((f) => (
            <div
              key={f.file}
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
                  {f.file}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.5,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {f.found}
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
