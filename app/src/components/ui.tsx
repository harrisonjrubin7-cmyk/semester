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
    <div
      className="section-label"
      style={{
        margin: 'calc(26px * var(--density, 1)) 0 calc(12px * var(--density, 1))',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A horizontally scrolling row of filter chips. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  style?: CSSProperties;
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
                fontSize: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                background: on ? 'var(--chrome)' : 'transparent',
                color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                fontWeight: on ? 600 : 400,
              }}
            >
              {o}
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
              fontSize: 12,
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
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.5,
          }}
        >
          {top}
        </div>
        <div style={{ fontSize: 24 }}>{bottom}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, lineHeight: 1.25 }}>{title}</div>
        <div
          style={{
            fontSize: 11,
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
      <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
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

/** The centred empty state used by search, alerts and saved events. */
export function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
}) {
  return (
    <div style={{ padding: '62px 10px', textAlign: 'center' }}>
      {icon && (
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
      <div className="chrome-text" style={{ fontSize: 24 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6, textWrap: 'pretty' }}>{body}</div>
    </div>
  );
}
