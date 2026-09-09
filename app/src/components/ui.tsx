import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { ChevronRight } from './Icons';
import { useRowStyle } from './shell/useShell';

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
  aside,
  style,
}: {
  children: ReactNode;
  /**
   * What sits at the right-hand end of the heading's line.
   *
   * "0 of 3 done" beside Due today, "4 left" beside Yours today. Two screens
   * used to build that row by hand — a flex `<div>` with an `<h2
   * className="section-label">` inside it — because this component had no way
   * to say it, and a hand-built heading is a heading nothing else can
   * recognise. When sections became foldable those two were the ones that
   * folded the count instead of the section.
   *
   * It stays outside the fold control on purpose: on Today it is a button of
   * its own, and a button inside a button is not markup any browser agrees
   * about.
   */
  aside?: ReactNode;
  style?: CSSProperties;
}) {
  // An <h2>, not a styled div. The screen's name is the <h1>; these are the
  // sections under it, and until they were headings a screen reader had no
  // structure to move through — the whole app read as one long run of
  // buttons with no way to skip. The reset keeps it looking identical.
  const heading = (
    <h2
      className="section-label"
      style={{
        margin: 'calc(26px * var(--density, 1)) 0 calc(12px * var(--density, 1))',
        fontSize: 'var(--type-sm)',
        fontWeight: 'inherit',
        // Wide enough for the whole line when something shares it, so the
        // fold control reaches as far as the words do rather than stopping
        // where they stop.
        ...(aside === undefined ? null : { flex: 1, minWidth: 0 }),
        ...style,
      }}
    >
      {children}
    </h2>
  );

  if (aside === undefined) return heading;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-4)' }}>
      {heading}
      {aside}
    </div>
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
      <div style={{ display: 'flex', gap: 'var(--sp-3)', paddingRight: 18 }}>
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              /* No `tap-y` here, deliberately, and the measurement is why.
                 A chip is 25–29px tall, which already clears the 24×24 that
                 WCAG 2.2 AA asks for, and screens stack these rows: Calendar
                 puts a `Segmented` directly above a `ChipRow`. Growing both
                 to 44px made their targets overlap by 4px, and in that band
                 the lower row wins a tap meant for the upper one. A chip at
                 29px is a worse target than one at 44; a chip that sometimes
                 does the wrong thing is a worse control. */
              className="btn"
              onClick={() => onChange(o)}
              aria-pressed={on}
              style={{
                flex: 'none',
                padding: '5px 12px',
                fontSize: 'var(--type-sm)',
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

/**
 * The app's other chip, named at last.
 *
 * There are two chip idioms here and only one of them had a component. This is
 * the second: an outlined pick, accented when chosen, drawn at a size a finger
 * can hit. Ten screens were each writing the same twenty lines of it — "how
 * long have you got" on Tonight, the unit picker on a reading, the course
 * picker on Check the writing, two on The degree — with the padding drifting
 * between 7px and 9px and the radius between `--r-sm` and `--r-md`, because
 * the fastest way to write a chip was to copy the nearest one.
 *
 * ## Why this is not `ChipRow`
 *
 * `ChipRow` above is a filled, uppercase, 29px chip that scrolls sideways in
 * one row, and its comment explains at length why it must *not* grow to 44px:
 * the calendar stacks a `Segmented` directly above one, and at 44px their
 * targets overlapped by 4px, in which band the lower row silently won taps
 * meant for the upper. That argument is right and it is specific to a chip
 * that sits in a scrolling row under another control.
 *
 * These are not that. They wrap onto several lines and stand alone under a
 * heading, so nothing is stacked above them to collide with, and they are
 * drawn at about 37px rather than 29 — comfortably clear of the 24×24 that
 * WCAG 2.2 AA asks for, without needing `tap-y` either. Folding them into
 * `ChipRow` would shrink them, uppercase them and put them in a row that
 * scrolls sideways, which is three changes nobody asked for. Two components,
 * because they are two controls — the same rule that keeps two screens apart
 * when they answer two questions.
 *
 * (`tappable` on each is the cursor and hover treatment, not a target: the
 * growth classes are `tap`, `tap-x` and `tap-y` in `app.css`, and these do
 * not need one.)
 */
export function PickChips<T extends string | number>({
  options,
  value,
  onChange,
  labels,
  style,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** What to show instead of the option, where the two differ. */
  labels?: (option: T) => string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', ...style }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            className="bare tappable"
            aria-pressed={on}
            onClick={() => onChange(o)}
            style={{
              width: 'auto',
              padding: 'var(--sp-4) var(--sp-6)',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'var(--type-sm)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {labels ? labels(o) : String(o)}
          </button>
        );
      })}
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
    <div style={{ display: 'flex', gap: 'var(--sp-3)', ...style }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            // No `tap-y`, for the reason in `ChipRow` above: these clear
            // 24×24 already, and the rows stack close enough that expanding
            // them made adjacent rows fight over a 4px band.
            className="btn"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: 'var(--type-sm)',
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
  edge,
}: {
  top: string;
  bottom: string;
  title: string;
  meta: string;
  onClick?: () => void;
  /**
   * A colour for the spine at the row's left — the course this belongs to.
   *
   * Passed in rather than looked up, so this stays a row that draws what it is
   * given. Five of these stacked is the "What's coming" list, and without it
   * five rows from four courses are five identical rows whose only difference
   * is a course code set in 11px caps at the end of a meta line.
   */
  edge?: string;
}) {
  // Spread rather than wrapped: the whole button is the tap target, and
  // `CustomRow` would put the padding outside it.
  const row = useRowStyle(12);
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 'var(--sp-6)',
        alignItems: 'center',
        ...row,
      }}
    >
      {edge ? (
        <span
          aria-hidden
          style={{ width: 3, alignSelf: 'stretch', flex: 'none', borderRadius: 2, background: edge }}
        />
      ) : null}
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
        <div style={{ fontSize: 'var(--type-md)', lineHeight: 1.25 }}>{title}</div>
        <div
          style={{
            fontSize: 'var(--type-xs)',
            opacity: 0.55,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 'var(--sp-1)',
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
  const row = useRowStyle(13);
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
        gap: 'var(--sp-6)',
        ...row,
      }}
    >
      <span style={{ flex: 1, fontSize: 'var(--type-md)' }}>{label}</span>
      <span
        style={{
          width: 42,
          height: 24,
          padding: 'var(--sp-1)',
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
export function Meter({
  pct,
  height = 6,
  fill,
}: {
  pct: number;
  height?: number;
  /** The bar's colour. Defaults to the brushed metal every other meter is. */
  fill?: string;
}) {
  // Named so Windows High Contrast can give it an edge: forced colours drop
  // both of these backgrounds, and a bar drawn only in colour disappears
  // entirely. See `styles/app.css`.
  return (
    <div className="meter" style={{ height, background: 'var(--app-track)' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: fill ?? 'var(--chrome)',
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
          fontSize: 'var(--type-base)',
          opacity: 0.6,
          marginTop: inline ? 5 : 6,
          textWrap: 'pretty',
          lineHeight: 'var(--leading-relaxed)',
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
            marginTop: 'var(--sp-6)',
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

/**
 * The button that does the thing, across the width of the screen.
 *
 * Written out seventy times before this — "Save a backup and go ahead", "Build
 * the project file", "Add the requirement", "+ New note" — as the same
 * `type="button"`, the same `btn btn-* btn-block`, the same
 * `textTransform: 'uppercase'` and the same `letterSpacing`, with only the
 * height and the words differing. Seventy copies of a control is seventy
 * places to fix the next thing wrong with it, which is the argument
 * `components/Reorder.tsx` already makes about two arrows and three copies.
 *
 * ## The height, settled
 *
 * `HEIGHT`, and there is no prop for it. Nine were in use when these were
 * gathered — 34, 36, 40, 42, 44, 46, 48, 50 and 52 — which is what seventy
 * separate decisions look like rather than a scale anybody designed. 46 was
 * already thirty of the seventy and is the number kept.
 *
 * Two of the nine were below the tap-target minimum: Onboarding's "Skip" at 34
 * and Work's "Stop" at 36, neither wearing a `tap` overlay. `styles/taps.test.ts`
 * puts a fingertip at about 44px, so those two were not a smaller size of this
 * button, they were this button too small to hit. Both are `tone="ghost"` with
 * their own `fontSize` and opacity, so what made them quiet was never the
 * height, and they stay quiet at 46.
 *
 * There is deliberately no `height` prop. A prop with a default is a prop
 * somebody passes, and seventy call sites each passing "just this once" is how
 * the nine happened. A call site that genuinely needs a different height can
 * still say so in `style`, which is spread last — but it has to mean it.
 *
 * `spacing` is the same story at smaller scale: 0.1em on fifty-seven of the
 * seventy, and the other four values kept as they were. Note that `.btn` in
 * `app.css` sets 0.08em, so almost every one of these is an override — the
 * default here is the one the app actually uses, not the one the stylesheet
 * declares.
 *
 * Anything else — `marginTop`, `fontSize` — stays the caller's, through
 * `style`, and is spread last so a call site that needs to disagree still can.
 *
 * `type="button"` is fixed, which is the one thing this cannot express: a
 * submit button inside a form is a different control and `screens/Account.tsx`
 * still writes its own.
 *
 * ## Why `className` and `type` are not passable
 *
 * `...rest` is spread after both, so a call site that passed either would win
 * — and the two it could overwrite are the two that make this button what it
 * is. `className` carries the tone and `btn-block`; `type` is fixed by the
 * paragraph above. Worse than the appearance changing, `lib/onecontrol.test.ts`
 * recognises a hand-written copy of this button by exactly that markup, so a
 * call site that overrode either would be a copy the guard could not see.
 *
 * `style` stays passable and stays spread last, deliberately: that is the
 * documented way to disagree about a height or a margin. These two are not a
 * disagreement, they are a different control — and the type says so, so it is
 * a compile error rather than a review note.
 */
/** The one height. See the note above for why it is not a prop. */
export const HEIGHT = 46;

export function ActionButton({
  tone = 'secondary',
  spacing = '0.1em',
  style,
  children,
  ...rest
}: {
  tone?: 'primary' | 'secondary' | 'ghost';
  spacing?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'children' | 'className' | 'type'>) {
  return (
    <button
      type="button"
      className={`btn btn-${tone} btn-block`}
      style={{ height: HEIGHT, letterSpacing: spacing, textTransform: 'uppercase', ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
