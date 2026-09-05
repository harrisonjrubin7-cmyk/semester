import { useId, type ReactNode } from 'react';
import { ChevronRight } from '../Icons';

/**
 * The pieces a settings page is built from.
 *
 * One set of rows, used everywhere, so that every page in settings has the
 * same tap target, the same divider inset and the same place for an
 * explanation. The old screen had each section inventing its own spacing, and
 * the result read as thirty small decisions rather than one screen.
 *
 * ## Where the explanation goes
 *
 * Under the group, never inside a row and never behind a tooltip. A row is a
 * control and a label; the moment it also carries a paragraph, the list stops
 * being scannable and the thing somebody came for is three sentences further
 * down than it looks. `footer` is that paragraph's home.
 *
 * ## The theme, not a borrowed one
 *
 * Every colour here is one of the app's own tokens. A settings screen that
 * hardcodes system greys looks correct on exactly one ground and wrong on the
 * other nine — Parchment has to look like Parchment. Nothing is fixed in
 * pixels that text size, density or line height should be able to move.
 */

/** The smallest a row may be, before density and text size grow it. */
export const ROW_HEIGHT = 44;
export const PROFILE_HEIGHT = 60;

/** How far a divider is inset from the left, so it lines up under the label. */
const DIVIDER_INSET = 15;

/** How far the row label sits from the card's own edge. */
const SIDE = 15;

/** How far the card sits from the edge of the screen, so the inset reads. */
const OUTSIDE = 16;

/**
 * The hairline between rows, inset to start under the label.
 *
 * Drawn as a background rather than a border: a border paints outside the
 * padding box, so nothing inside a row can cover its left end, and every
 * attempt to inset one with a shadow leaves the full-width line underneath.
 */
const DIVIDER = {
  backgroundImage: 'linear-gradient(var(--app-line-soft), var(--app-line-soft))',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `${DIVIDER_INSET}px 100%`,
  backgroundSize: `calc(100% - ${DIVIDER_INSET}px) 1px`,
} as const;

export function SettingsGroup({
  header,
  footer,
  children,
  lit = false,
}: {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  /** Briefly, after search sends somebody here. */
  lit?: boolean;
}) {
  return (
    <section style={{ margin: `0 ${OUTSIDE}px calc(16px * var(--density, 1))` }}>
      {header ? (
        <h2
          style={{
            margin: `0 0 calc(5px * var(--density, 1)) ${SIDE}px`,
            fontSize: 'calc(11px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--font-heading-weight)' as never,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.55,
          }}
        >
          {header}
        </h2>
      ) : null}
      <div
        style={{
          background: 'var(--app-panel)',
          borderRadius: 'var(--r-lg)',
          border: lit ? '1px solid var(--app-accent)' : '1px solid var(--app-line-soft)',
          overflow: 'hidden',
          transition: 'border-color 220ms ease',
        }}
      >
        {children}
      </div>
      {footer ? (
        <div
          style={{
            margin: `calc(7px * var(--density, 1)) ${SIDE}px 0`,
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.55,
            lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** The shared skin. Everything below is this plus its right-hand side. */
function Row({
  children,
  onClick,
  tall = false,
  as = 'div',
  role,
  ariaChecked,
  ariaLabel,
  lit = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tall?: boolean;
  as?: 'div' | 'button';
  role?: string;
  ariaChecked?: boolean;
  ariaLabel?: string;
  lit?: boolean;
}) {
  const style = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    // The minimum, not the height: text size and line height have to be able
    // to grow a row rather than clip it.
    minHeight: `calc(${tall ? PROFILE_HEIGHT : ROW_HEIGHT}px * var(--density, 1))`,
    padding: `calc(7px * var(--density, 1)) ${SIDE}px`,
    backgroundColor: lit ? 'var(--app-accent-wash)' : 'transparent',
    ...DIVIDER,
    border: 'none',
    color: 'inherit',
    textAlign: 'left' as const,
    font: 'inherit',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'background-color 220ms ease',
  };

  if (as === 'button') {
    return (
      <button
        type="button"
        onClick={onClick}
        role={role}
        aria-checked={ariaChecked}
        aria-label={ariaLabel}
        style={style}
      >
        {children}
      </button>
    );
  }
  return <div style={style}>{children}</div>;
}

function Label({ label, sub }: { label: ReactNode; sub?: ReactNode }) {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.35 }}>
        {label}
      </span>
      {sub ? (
        <span
          style={{
            display: 'block',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.55,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </span>
      ) : null}
    </span>
  );
}

/** The right-hand value. Truncated, because the label is what matters. */
function Value({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 'calc(12.5px * var(--text-scale, 1))',
        opacity: 0.55,
        maxWidth: '45%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {children}
    </span>
  );
}

/** Pushes a page. The whole row is the target, not just the label. */
export function NavRow({
  label,
  sub,
  value,
  onClick,
  tall = false,
  lit = false,
}: {
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  onClick: () => void;
  tall?: boolean;
  lit?: boolean;
}) {
  return (
    <Row as="button" onClick={onClick} tall={tall} lit={lit}>
      <Label label={label} sub={sub} />
      {value ? <Value>{value}</Value> : null}
      <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
    </Row>
  );
}

/** A real switch, so a screen reader says "on" rather than "button". */
export function ToggleRow({
  label,
  sub,
  on,
  onChange,
}: {
  label: string;
  sub?: ReactNode;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <Row as="button" onClick={onChange} role="switch" ariaChecked={on} ariaLabel={label}>
      <Label label={label} sub={sub} />
      <span
        aria-hidden
        style={{
          width: 42,
          height: 24,
          padding: 2,
          flex: 'none',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--app-line)',
          background: on ? 'var(--app-accent-fill)' : 'transparent',
          display: 'flex',
          justifyContent: on ? 'flex-end' : 'flex-start',
          transition: 'background-color 160ms ease',
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 'var(--r-sm)',
            background: on ? 'var(--app-bg)' : 'var(--app-faint)',
            display: 'block',
          }}
        />
      </span>
    </Row>
  );
}

/**
 * A label and its current value, with the choices underneath.
 *
 * A checkmark on the chosen one rather than a radio: a radio column costs a
 * fixed 24px on every row for a mark that only one of them ever carries.
 */
export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; sub?: string }[];
  onChange: (id: T) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <Row>
        <span
          id={id}
          style={{
            flex: 1,
            fontSize: 'calc(11px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.5,
          }}
        >
          {label}
        </span>
      </Row>
      {options.map((o) => (
        <Row key={o.id} as="button" onClick={() => onChange(o.id)} role="radio" ariaChecked={o.id === value}>
          <Label label={o.label} sub={o.sub} />
          <span
            aria-hidden
            style={{
              flex: 'none',
              width: 18,
              textAlign: 'center',
              color: 'var(--app-accent)',
              opacity: o.id === value ? 1 : 0,
              fontSize: 'calc(14px * var(--text-scale, 1))',
            }}
          >
            ✓
          </span>
        </Row>
      ))}
    </div>
  );
}

/** A number chosen by dragging, with what each end means written on it. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  low,
  high,
  said,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  low: string;
  high: string;
  /** The current value in words, which is the part anybody reads. */
  said?: string;
}) {
  const id = useId();
  return (
    <div style={{ padding: `calc(11px * var(--density, 1)) ${SIDE}px`, ...DIVIDER }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <label htmlFor={id} style={{ flex: 1, fontSize: 'calc(14px * var(--text-scale, 1))' }}>
          {label}
        </label>
        {said ? <Value>{said}</Value> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.45, flex: 'none' }}>{low}</span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--app-accent-fill)', minHeight: 28 }}
        />
        <span style={{ fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.45, flex: 'none' }}>{high}</span>
      </div>
    </div>
  );
}

/** Something the app knows and you cannot change. Version, space used. */
export function ValueRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <Row>
      <Label label={label} />
      <Value>{value}</Value>
    </Row>
  );
}

/** The one that takes something away. Centred, and the warn colour. */
export function DestructiveRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Row as="button" onClick={onClick}>
      <span
        style={{
          flex: 1,
          textAlign: 'center',
          color: 'var(--app-warn)',
          fontSize: 'calc(14px * var(--text-scale, 1))',
        }}
      >
        {label}
      </span>
    </Row>
  );
}

/**
 * Anything that is not a row.
 *
 * A colour grid, a course list, a set of chips — controls that already exist
 * and are not a label with something on the right. They sit inside the group
 * so the page still reads as one thing.
 */
export function CustomRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: `calc(12px * var(--density, 1)) ${SIDE}px`, ...DIVIDER }}>
      {children}
    </div>
  );
}
