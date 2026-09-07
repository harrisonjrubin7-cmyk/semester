import { useStore } from '../state/store';
import { SHELLS } from '../lib/look';
import { SectionLabel } from './ui';

/**
 * Choosing between the two layouts, with each one drawn rather than described.
 *
 * A thumbnail, because "grouped inset list" means nothing to anybody who has
 * not built one and everything to anybody who looks at it. Each preview is
 * drawn in the app's own tokens, so it shows what the choice will actually
 * look like on the ground somebody is on rather than a picture of it on some
 * other ground.
 */
export function ShellPicker() {
  const { state, dispatch } = useStore();

  return (
    <>
      <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
        Layout
      </SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-5)', textWrap: 'pretty' }}>
        Two ways of arranging every screen. Neither hides anything — the same controls are on the
        same screens either way.
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
        {SHELLS.map((s) => {
          const on = state.shell === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className="bare tappable"
              aria-pressed={on}
              onClick={() => dispatch({ type: 'setLook', look: { shell: s.id } })}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                padding: 'var(--sp-5)',
                borderRadius: 'var(--r-sm)',
                border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <Preview grouped={s.id === 'grouped'} />
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-base)',
                  marginTop: 9,
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-xs)',
                  opacity: 0.55,
                  marginTop: 3,
                  lineHeight: 1.4,
                  textWrap: 'pretty',
                }}
              >
                {s.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * The same three rows, drawn both ways.
 *
 * Deliberately the same content in both: the choice is about arrangement, and
 * a preview that also changed what was in it would be selling something else.
 */
function Preview({ grouped }: { grouped: boolean }) {
  const bar = (w: string, dim = false) => (
    <span
      style={{
        display: 'block',
        height: 4,
        width: w,
        borderRadius: 2,
        background: dim ? 'var(--app-faint)' : 'var(--app-dim)',
      }}
    />
  );

  if (!grouped) {
    return (
      <span
        aria-hidden
        style={{
          display: 'block',
          height: 74,
          padding: 7,
          background: 'var(--app-bg)',
          border: '1px solid var(--app-line-soft)',
          borderRadius: 'var(--r-sm)',
        }}
      >
        {bar('34%', true)}
        <span
          style={{
            display: 'block',
            marginTop: 'var(--sp-3)',
            padding: 'var(--sp-3)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-sm)',
          }}
        >
          {bar('70%')}
          <span style={{ display: 'block', height: 5 }} />
          {bar('50%', true)}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 5,
            padding: 'var(--sp-3)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-sm)',
          }}
        >
          {bar('60%')}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={{
        display: 'block',
        height: 74,
        padding: 7,
        background: 'var(--app-void, var(--app-bg))',
        border: '1px solid var(--app-line-soft)',
        borderRadius: 'var(--r-sm)',
      }}
    >
      {bar('34%', true)}
      <span
        style={{
          display: 'block',
          marginTop: 'var(--sp-3)',
          background: 'var(--app-panel)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--app-line-soft)',
          overflow: 'hidden',
        }}
      >
        {['70%', '52%', '61%'].map((w, i) => (
          <span
            key={w}
            style={{
              display: 'block',
              padding: '5px 6px',
              // Inset from the left, which is the thing the layout is about.
              backgroundImage:
                i < 2 ? 'linear-gradient(var(--app-line-soft), var(--app-line-soft))' : 'none',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: '6px 100%',
              backgroundSize: 'calc(100% - 6px) 1px',
            }}
          >
            {bar(w)}
          </span>
        ))}
      </span>
    </span>
  );
}
