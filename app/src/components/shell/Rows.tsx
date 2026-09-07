import { useId, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight } from '../Icons';
import { ForcedProvider, InsetProvider, SIDE, useGrouped } from './useShell';
import { Blueprint } from '../Blueprint';
import { SectionLabel } from '../ui';

/**
 * The pieces every screen is built from, in whichever layout is on.
 *
 * Each of these renders what the app renders today when the layout is `plain`,
 * and an inset grouped-list row when it is `grouped`. That is the whole
 * mechanism: a screen that uses these gets the second layout without knowing
 * the second layout exists.
 *
 * ## Where the explanation goes
 *
 * Under the group, never inside a row and never behind a tooltip. A row is a
 * label and a control; the moment it also carries a paragraph, the list stops
 * being scannable and the thing somebody came for is three sentences further
 * down than it looks.
 *
 * ## The theme, not a borrowed one
 *
 * Every colour is one of the app's own tokens, and the corner radius is the
 * `corners` look key rather than a fixed 12px. Grouped mode on Parchment has
 * to look like Parchment; a settings-shaped layout that hardcodes system greys
 * looks right on one ground and wrong on the other nine. Nothing is fixed in
 * pixels that text size, density or line height should be able to move.
 *
 * ## What grouped mode drops, and why
 *
 * `Blueprint`'s four registration marks. The Industry system's rule is that a
 * framed element never drops them, and that rule is right for the layout it
 * was written for — but an inset panel with crosses in its corners is neither
 * thing. This is the one deliberate departure, it is confined to one mode, and
 * `plain` keeps the marks exactly as they are.
 */

/** The smallest a row may be before density and text size grow it. */
export const ROW_HEIGHT = 44;

/**
 * The hairline between rows, inset to start under the label.
 *
 * Drawn as a background rather than a border: a border paints outside the
 * padding box, so nothing inside a row can cover its left end, and every
 * attempt to inset one with a shadow leaves the full-width line underneath.
 * Decorative, and invisible to a screen reader either way.
 */
const DIVIDER: CSSProperties = {
  backgroundImage: 'linear-gradient(var(--app-line-soft), var(--app-line-soft))',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `${SIDE}px 100%`,
  backgroundSize: `calc(100% - ${SIDE}px) 1px`,
};

/**
 * A section: a heading, its rows, and the sentence explaining them.
 *
 * In `plain` this is what a screen writes today — a `SectionLabel`, the
 * blurb under it, and the content. In `grouped` the content moves into an
 * inset panel and the blurb moves below it.
 */
export function Group({
  header,
  footer,
  children,
  framed = true,
  lit = false,
  style,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * Briefly outlined, after a search sent somebody to this group.
   *
   * Only settings uses it today, and only in the grouped layout, where there
   * is a panel edge to outline. In the drawn layout there is nothing to draw
   * it on and it is ignored rather than invented.
   */
  lit?: boolean;
  /**
   * Whether `plain` draws a frame around this at all.
   *
   * False for a section that is a run of rows on the page rather than a card,
   * which is most of them. Grouped mode always insets.
   */
  framed?: boolean;
  style?: CSSProperties;
}) {
  const grouped = useGrouped();
  const id = useId();

  if (!grouped) {
    return (
      <section aria-labelledby={header ? id : undefined} style={style}>
        {header ? <SectionLabel style={{ marginBottom: 6 }}>{<span id={id}>{header}</span>}</SectionLabel> : null}
        {footer ? (
          <div
            style={{
              fontSize: 'var(--type-base)',
              opacity: 0.65,
              lineHeight: 'var(--leading-relaxed)',
              marginBottom: 10,
              textWrap: 'pretty',
            }}
          >
            {footer}
          </div>
        ) : null}
        {framed ? <Blueprint style={{ padding: 14 }}>{children}</Blueprint> : children}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={header ? id : undefined}
      /*
       * No horizontal margin of its own.
       *
       * Every screen already sets its own page padding, and a panel that also
       * pushed outwards would either double the gutter or need a negative
       * margin tuned to whichever padding that screen happened to choose.
       * Insetting within the page's own gutter is one pixel different from
       * the phone's settings app and survives all fifty screens.
       */
      style={{ margin: `0 0 calc(16px * var(--density, 1))`, ...style }}
    >
      {header ? (
        <h2
          id={id}
          className="section-label"
          style={{
            margin: `0 0 calc(5px * var(--density, 1)) ${SIDE}px`,
            fontSize: 'var(--type-xs)',
            fontWeight: 'inherit',
            opacity: 0.55,
          }}
        >
          {header}
        </h2>
      ) : null}
      <div
        style={{
          background: 'var(--app-panel)',
          // The `corners` look key, not a fixed radius: somebody who chose
          // square corners chose them for the whole app.
          borderRadius: 'var(--r-lg)',
          border: `1px solid ${lit ? 'var(--app-accent)' : 'var(--app-line-soft)'}`,
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
            lineHeight: 'var(--leading-relaxed)',
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
  as = 'div',
  role,
  ariaChecked,
  ariaLabel,
  tall = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  as?: 'div' | 'button';
  role?: string;
  ariaChecked?: boolean;
  ariaLabel?: string;
  tall?: boolean;
}) {
  const grouped = useGrouped();
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    // The minimum, not the height: text size and line height have to grow a
    // row rather than clip it.
    minHeight: `calc(${tall ? 60 : ROW_HEIGHT}px * var(--density, 1))`,
    padding: grouped
      ? `calc(7px * var(--density, 1)) ${SIDE}px`
      : 'calc(11px * var(--density, 1)) 0',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    textAlign: 'left',
    font: 'inherit',
    cursor: onClick ? 'pointer' : 'default',
    ...(grouped ? DIVIDER : { borderBottom: '1px solid var(--app-line)' }),
  };

  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} role={role} aria-checked={ariaChecked} aria-label={ariaLabel} style={style}>
        {children}
      </button>
    );
  }
  return <div style={style}>{children}</div>;
}

function Label({ label, sub }: { label: ReactNode; sub?: ReactNode }) {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 1.35 }}>
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

/** Pushes a screen. The whole row is the target, not just the label. */
export function NavRow({
  label,
  sub,
  value,
  onClick,
  tall = false,
}: {
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  onClick: () => void;
  tall?: boolean;
}) {
  return (
    <Row as="button" onClick={onClick} tall={tall}>
      <Label label={label} sub={sub} />
      {value ? <Value>{value}</Value> : null}
      <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
    </Row>
  );
}

/**
 * One thing in a list — a deadline, a course, a source, a person.
 *
 * The row this app did not have. Thirty-one screens drew their own, each with
 * slightly different padding and each having independently decided what a
 * hairline is; this is the one every list can share.
 */
export function ItemRow({
  title,
  meta,
  trailing,
  onClick,
  leading,
}: {
  title: ReactNode;
  meta?: ReactNode;
  /** A tag, a count, a tick box — whatever sits at the end of the row. */
  trailing?: ReactNode;
  /** A tick box or an icon, before the title. */
  leading?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Row as={onClick ? 'button' : 'div'} onClick={onClick}>
      {leading ? <span style={{ flex: 'none', display: 'flex' }}>{leading}</span> : null}
      <Label label={title} sub={meta} />
      {trailing ? <span style={{ flex: 'none' }}>{trailing}</span> : null}
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
 * A choice, with the options underneath.
 *
 * A checkmark on the chosen one rather than a radio: a radio column costs a
 * fixed width on every row for a mark only one of them ever carries.
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
    <div role="radiogroup" aria-labelledby={id}>
      <Row>
        <span
          id={id}
          className="section-label"
          style={{ flex: 1, fontSize: 'var(--type-xs)', opacity: 0.5 }}
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
              fontSize: 'var(--type-md)',
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
  const grouped = useGrouped();
  const id = useId();
  return (
    <div
      style={{
        padding: grouped ? `calc(11px * var(--density, 1)) ${SIDE}px` : 'calc(11px * var(--density, 1)) 0',
        ...(grouped ? DIVIDER : { borderBottom: '1px solid var(--app-line)' }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <label htmlFor={id} style={{ flex: 1, fontSize: 'var(--type-md)' }}>
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

/** Something the app knows and you cannot change. */
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
          fontSize: 'var(--type-md)',
        }}
      >
        {label}
      </span>
    </Row>
  );
}

/**
 * A row whose insides the screen draws itself.
 *
 * The workhorse of the conversion, and the reason most screens can move
 * without their drawn layout shifting by a pixel. `ItemRow` puts the meta line
 * *under* the title; nearly every list in this app puts it *beside* the title,
 * in a flex row with two or three columns of its own. Forcing those into
 * `ItemRow` would change how they look in the layout that is meant to be
 * unchanged.
 *
 * So this takes the screen's own markup and supplies only the two things that
 * differ between layouts: the padding and the hairline. Plain gets exactly the
 * border the screen drew by hand; grouped gets the inset one and the panel
 * around it from `Group`.
 *
 * Also the home for anything that is not a row at all — a colour grid, a chip
 * row, a chart — so it sits inside the panel and the page reads as one thing.
 */
export function CustomRow({
  children,
  pad = 11,
  line = true,
}: {
  children: ReactNode;
  /** The vertical padding the drawn layout had. Grouped uses its own. */
  pad?: number;
  /** False for the last row in a group, or one that draws its own edge. */
  line?: boolean;
}) {
  const grouped = useGrouped();
  return (
    <div
      style={{
        padding: grouped
          ? `calc(12px * var(--density, 1)) ${SIDE}px`
          : `${pad}px 0`,
        ...(line ? (grouped ? DIVIDER : { borderBottom: '1px solid var(--app-line)' }) : {}),
      }}
    >
      {/* This row has already stepped in from the panel edge. A shared
          component in `children` that insets itself as well would sit 15px
          right of the heading above it, so it is told not to. */}
      <InsetProvider value={grouped}>{children}</InsetProvider>
    </div>
  );
}

/**
 * Content that must not become a list.
 *
 * A field guide, the calendar's month grid, a flashcard, a map, a chart. Each
 * of these is one object rather than a run of rows, and putting it in an inset
 * panel makes it narrower and harder to read for nothing. In grouped mode this
 * renders edge to edge with no panel and no dividers; in plain mode it is not
 * there at all.
 *
 * A layout mode that makes reading worse is a bug, and this is what stops it
 * being one.
 */
export function FullBleed({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const grouped = useGrouped();
  // Not a marker: everything below this draws itself as it always has, so a
  // guide keeps its reading width, a flashcard keeps its frame and the
  // calendar keeps its grid. The page around it is still grouped.
  if (!grouped) return <>{children}</>;
  return (
    <ForcedProvider value="plain">
      <div style={style}>{children}</div>
    </ForcedProvider>
  );
}
