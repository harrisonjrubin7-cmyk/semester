import type { ModeInfo } from '../lib/modes';
import type { StudyMode } from '../lib/types';

/**
 * All ten ways through a course, visible at once.
 *
 * The chip row it replaces was one line that scrolled sideways: four ways of
 * studying on screen and six over the edge, which is a good way to own a
 * feature nobody uses. A wrapping grid fits all ten on a phone, and each one
 * carries what is actually behind it — "44 lessons", "12 figures", or a plain
 * statement that there is nothing here yet.
 *
 * A mode with nothing behind it is still tappable. It explains itself when you
 * arrive, and a disabled button that will not say why is worse than an empty
 * screen that will.
 */
export function ModePicker({
  modes,
  value,
  onChange,
}: {
  modes: ModeInfo[];
  value: StudyMode;
  onChange: (mode: StudyMode) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
        gap: 8,
      }}
    >
      {modes.map((m) => {
        const on = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            className="bare tappable"
            onClick={() => onChange(m.id)}
            aria-pressed={on}
            title={m.blurb}
            style={{
              textAlign: 'left',
              padding: '10px 11px',
              border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
              borderRadius: 'var(--r-md)',
              background: on
                ? 'var(--app-hero)'
                : 'linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,0) 60%)',
              boxShadow: on
                ? '0 0 0 3px var(--app-accent-wash)'
                : '0 1px 0 var(--app-line-top) inset',
              transition: 'border-color var(--fast), box-shadow var(--fast), background var(--fast)',
              // A mode with nothing in it is dimmed rather than hidden: knowing
              // Listen exists and is empty beats not knowing Listen exists.
              opacity: m.ready ? 1 : 0.45,
              display: 'block',
            }}
          >
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(14px * var(--text-scale, 1))',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: on ? 'var(--app-accent)' : 'var(--app-fg)',
              }}
            >
              {m.label}
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'calc(10.5px * var(--text-scale, 1))',
                opacity: 0.6,
                marginTop: 3,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {m.ready ? m.count : 'Empty'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
