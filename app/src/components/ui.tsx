import type { CSSProperties, ReactNode } from 'react';
import { ChevronRight } from './Icons';

/** The uppercase rule that opens a section. */
/**
 * The heading above a section, and the app's vertical rhythm.
 *
 * The margins are a calc against `--density` rather than fixed pixels, which
 * is what makes the Spacing setting real: this component sets the gap between
 * nearly every section on nearly every screen, so scaling it here scales the
 * whole app without touching a single screen. Call sites that pass their own
 * margin keep it — a few sections genuinely need to sit tighter than the
 * rhythm, and overriding one gap is not worth a second knob.
 */
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    // An <h2>, not a styled div. The screen's name is the <h1>; these are the
    // sections under it, and until they were headings a screen reader had no
    // structure to move through — the whole app read as one long run of
    // buttons with no way to skip. The reset keeps it looking identical.
    <h2
      className="section-label"
      style={{
        margin: 'calc(26px * var(--density, 1)) 0 calc(12px * var(--density, 1))',
        fontSize: 'calc(12px * var(--text-scale, 1))',
        fontWeight: 'inherit',
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

/** A horizontally scrolling row of filter chips. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  style,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  style?: CSSProperties;
  /**
   * What to show instead of the option itself, where the two differ.
   *
   * Every caller until now filtered by a word that was also its own label. A
   * term is '2026FA' on disk and "Fall 2026" on screen, and putting the id on
   * a chip would be showing somebody a storage format.
   */
  labels?: Record<string, string>;
}) {
  return (
    <div className="chiprow" style={style}>
      <div style={{ display: 'flex', gap: 6, paddingRight: 18 }}>
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              className="btn"
              onClick={() => onChange(o)}
              aria-pressed={on}
              style={{
                flex: 'none',
                padding: '5px 12px',
                fontSize: 'calc(12px * var(--text-scale, 1))',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: on ? 'var(--chrome)' : 'transparent',
                color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                fontWeight: on ? 600 : 400,
              }}
            >
              {labels?.[o] ?? o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** An equal-width segmented control — Deadlines / Campus, Tabs / Feed. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            className="btn"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: 'calc(12px * var(--text-scale, 1))',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              background: on ? 'var(--chrome)' : 'transparent',
              color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
              borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
              fontWeight: on ? 600 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A list row with a date block on the left and a chevron on the right. */
export function DateRow({
  top,
  bottom,
  title,
  meta,
  onClick,
}: {
  top: string;
  bottom: string;
  title: string;
  meta: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid var(--app-line)',
      }}
    >
      <div style={{ width: 46, flex: 'none', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
        <div
          style={{
            fontSize: 'calc(10px * var(--text-scale, 1))',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.5,
          }}
        >
          {top}
        </div>
        <div style={{ fontSize: 'calc(24px * var(--text-scale, 1))' }}>{bottom}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.25 }}>{title}</div>
        <div
          style={{
            fontSize: 'calc(11px * var(--text-scale, 1))',
            opacity: 0.55,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {meta}
        </div>
      </div>
      <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
    </button>
  );
}

/** The on/off switch used by the alert preferences. */
export function Toggle({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className="bare"
      onClick={onChange}
      role="switch"
      aria-checked={on}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 0',
        borderBottom: '1px solid var(--app-line)',
      }}
    >
      <span style={{ flex: 1, fontSize: 'calc(14px * var(--text-scale, 1))' }}>{label}</span>
      <span
        style={{
          width: 42,
          height: 24,
          padding: 2,
          border: '1px solid var(--app-line)',
          background: on ? 'var(--chrome)' : 'transparent',
          display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          flex: 'none',
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            background: on ? 'var(--app-bg)' : 'var(--app-faint)',
            display: 'block',
          }}
        />
      </span>
    </button>
  );
}

/** A tick box — today's checklist, the import review rows. */
export function TickBox({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        border: `1.5px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
        background: on ? 'var(--chrome)' : 'transparent',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--chrome-ink)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: on ? 1 : 0, display: 'block' }}
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/** A progress bar in brushed metal. */
export function Meter({ pct, height = 6 }: { pct: number; height?: number }) {
  return (
    <div style={{ height, background: 'var(--app-track)' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: 'var(--chrome)',
        }}
      />
    </div>
  );
}

/**
 * A screen, or a section of one, with nothing in it yet.
 *
 * The app was already good at the sentence — most empty screens explained
 * themselves in plain language rather than showing a blank. What almost none
 * of them did was offer the thing that would fill them. A student reading
 * "no exam ahead in this term" has been told what is wrong and left to work
 * out for themselves that the answer is to import a syllabus.
 *
 * So `action` is the point of this component. Everything else was already
 * here.
 *
 * Two densities. The full form is for a screen that is entirely empty and can
 * afford to be a page; `inline` is for a section inside a screen that has
 * other things on it, where sixty pixels of padding would push the rest off
 * the bottom.
 */
export function EmptyState({
  title,
  body,
  icon,
  action,
  inline = false,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  /** What would put something here. Omitted when there is honestly nothing to offer. */
  action?: { label: string; onClick: () => void };
  inline?: boolean;
}) {
  return (
    <div
      style={
        inline
          ? { padding: '4px 0 2px' }
          : { padding: '62px 10px', textAlign: 'center' }
      }
    >
      {icon && !inline && (
        <div
          style={{
            width: 36,
            height: 36,
            margin: '0 auto 14px',
            border: '1px solid var(--app-line)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--app-accent)',
          }}
        >
          {icon}
        </div>
      )}
      <div
        className={inline ? 'kicker' : 'chrome-text'}
        style={inline ? undefined : { fontSize: 'calc(24px * var(--text-scale, 1))' }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 'calc(13px * var(--text-scale, 1))',
          opacity: 0.6,
          marginTop: inline ? 5 : 6,
          textWrap: 'pretty',
          lineHeight: 1.5,
        }}
      >
        {body}
      </div>
      {action && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={action.onClick}
          style={{
            height: 40,
            marginTop: 12,
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            ...(inline ? { width: '100%' } : { paddingInline: 20 }),
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
