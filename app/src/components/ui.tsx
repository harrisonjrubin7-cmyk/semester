import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { useRowStyle } from './shell/useShell';
import { longhandMargins } from '../lib/margins';

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
        // Written as four longhands, not a `margin` shorthand.
        //
        // `Fold` tightens the bottom of this heading when a section is shut,
        // as a longhand — and React treats a shorthand and one of its own
        // longhands as unrelated names, so reopening cleared the longhand and
        // never put the shorthand back. The heading lost its rhythm on the
        // first fold and did not get it back. See `lib/margins.ts`.
        marginTop: 'calc(26px * var(--density, 1))',
        marginRight: 0,
        marginBottom: 'calc(12px * var(--density, 1))',
        marginLeft: 0,
        fontSize: 'var(--type-sm)',
        fontWeight: 'inherit',
        // Wide enough for the whole line when something shares it, so the
        // fold control reaches as far as the words do rather than stopping
        // where they stop.
        ...(aside === undefined ? null : { flex: 1, minWidth: 0 }),
        // A caller's own `margin` is expanded too, for the same reason: about
        // ninety-five sites write one, and any of them can be handed a
        // longhand override by `Fold`. Only longhands reach the DOM, so
        // overriding one side is a plain overwrite rather than two names
        // fighting.
        ...longhandMargins(style),
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

/**
 * Which ends of a sideways-scrolling row have more beyond them.
 *
 * `.chiprow` hides its scrollbar — right for a row of pills, and it left the
 * row with no way at all to say that it scrolls. On Exam runway the fourth
 * chip was cut through the middle of "PSCI 1104" at the screen edge, which
 * reads as a clipping bug rather than as an invitation, and the exam nobody
 * could see was the one furthest out. It gets worse with every course added:
 * four fit, six do not.
 *
 * The shelves already answered this — `.shelf-nav-row` fades both ends with a
 * `mask-image`, and its comment says why: "the fade says there is more this
 * way without drawing a scrollbar over the pills". This is the same fade, told
 * which end needs it, because a `ChipRow`'s first chip is usually the selected
 * one and a permanent fade across a chrome-filled chip reads as a rendering
 * fault rather than as an edge.
 *
 * The first measurement comes from the observer rather than from a call here:
 * `ResizeObserver` fires once on `observe`, so the state is set from an event
 * either way, and where there is no observer at all — jsdom, in the suite —
 * the row simply keeps the unmasked default it has always had.
 */
type Edge = 'none' | 'start' | 'end' | 'both';

function useEdges(count: number) {
  const row = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<Edge>('none');

  useEffect(() => {
    const el = row.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => {
      // A sub-pixel row is not a row that scrolls: `scrollWidth` and
      // `clientWidth` disagree by a fraction on plenty of layouts that fit.
      const over = el.scrollWidth - el.clientWidth;
      if (over <= 1) return setAt('none');
      const start = el.scrollLeft <= 1;
      const end = el.scrollLeft >= over - 1;
      setAt(start ? 'end' : end ? 'start' : 'both');
    };
    const watch = new ResizeObserver(read);
    watch.observe(el);
    el.addEventListener('scroll', read, { passive: true });
    return () => {
      watch.disconnect();
      el.removeEventListener('scroll', read);
    };
  }, [count]);

  return [row, at] as const;
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
  const [row, more] = useEdges(options.length);

  return (
    <div className="chiprow" data-more={more} ref={row} style={style}>
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
  label,
}: {
  pct: number;
  height?: number;
  /** The bar's colour. Defaults to the brushed metal every other meter is. */
  fill?: string;
  /**
   * What the bar measures, said in words — or `null` where the number is
   * already in the text beside it.
   *
   * Required, and deliberately without a default. A bar is a number drawn as
   * a length: somebody who cannot see the length has the number only if the
   * words carry it, and four of this app's seven meters were the only place
   * their figure appeared. Study's mastery bar sat beside "11 units · 68
   * cards"; the deck-coverage bar on Me has a comment saying in as many words
   * that it shows "what the line does not show". For a screen reader those
   * facts did not exist.
   *
   * The other three are genuine restatements — the term bar has "62% of the
   * way…" under it, the week bar has "3 of 5 done" beside it, the grade bar
   * has the grade above it — and those pass `null`, which hides the bar from
   * a reader rather than saying everything twice.
   *
   * No default, so the choice is made at each site rather than assumed. It is
   * the same bargain `tap-x` and `tap-y` make in `app.css`: the one thing a
   * shared component cannot know is what its caller means by it, and guessing
   * produces either a silent bar or a stutter.
   */
  label: string | null;
}) {
  const value = Math.max(0, Math.min(100, pct));
  const said = Math.round(value);
  // Named so Windows High Contrast can give it an edge: forced colours drop
  // both of these backgrounds, and a bar drawn only in colour disappears
  // entirely. See `styles/app.css`.
  return (
    <div
      className="meter"
      style={{ height, background: 'var(--app-track)' }}
      {...(label === null
        ? { 'aria-hidden': true }
        : {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': said,
            // Without this a reader says "62" and leaves the unit to be
            // guessed at. The bar is always a percentage of itself.
            'aria-valuetext': `${said}%`,
          })}
    >
      <div
        style={{
          height: '100%',
          width: `${value}%`,
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

/**
 * The one control that opens a file picker.
 *
 * Every screen that took a file did the same thing: a `display: none` input, a
 * ref, and a button whose `onClick` called `input.current?.click()`. That is
 * three moving parts to do what the platform does on its own, and each of them
 * is a way for the button to become a button that does nothing:
 *
 *  - **A scripted `.click()` is not always honoured.** It has to happen inside
 *    the browser's idea of a user gesture, and an input that is `display: none`
 *    is one some engines decline to open at all. Nothing throws when they
 *    decline — the press simply does nothing, which is unarguably the worst
 *    thing a button can do and impossible to tell apart from a broken app.
 *  - **A ref can be null**, and then the press is silently a no-op.
 *  - **An input keeps its value**, so choosing the same file twice in a row
 *    fires `change` once. Pick a syllabus, remove it, pick it again — nothing.
 *
 * So the input is the button: it lies across the whole label at zero opacity,
 * which means the press lands on the real control and the browser opens its own
 * picker with no JavaScript in the path at all. It keeps the keyboard, too — the
 * input is focusable, so Tab reaches it and Enter opens the picker, and the
 * focus ring in `app.css` is drawn around the same box the label occupies.
 *
 * The value is cleared on the way out of `onChange`, which is what makes the
 * same file choosable twice.
 *
 * Every file picker in the app is this one. `lib/onefile.test.ts` holds that
 * open: an `<input type="file">` written anywhere but here fails the suite,
 * because the pattern this replaced is the one that comes back — it is four
 * lines and it looks like it works.
 */
export function FilePick({
  accept,
  multiple = true,
  capture,
  disabled = false,
  onPick,
  onOpen,
  tone = 'secondary',
  block = true,
  style,
  children,
}: {
  /**
   * The `accept` list. Keep it in step with what the reader behind it can
   * actually open — a format missing here is not refused with a sentence, it
   * is greyed out in the operating system's own dialog.
   */
  accept?: string;
  multiple?: boolean;
  /**
   * `environment` opens the rear camera straight away on a phone.
   *
   * The one attribute that makes "photograph the board" a different control
   * from "pick a photo", rather than the same picker twice. On a laptop it
   * falls back to the file dialog, which is right there.
   */
  capture?: 'environment' | 'user';
  disabled?: boolean;
  onPick: (files: File[]) => void;
  /**
   * Fired as the picker opens, before the person has chosen anything.
   *
   * The operating system's dialog is a box the app cannot see into or draw
   * on, so this is the only moment a screen has to say something about the
   * choice being made — Import uses it to open the drop box underneath, which
   * is then standing there in the open when the dialog is cancelled.
   *
   * It runs on the keyboard too: Enter on a focused file input is a click.
   */
  onOpen?: () => void;
  /**
   * `bare` is not a button at all — it is the app's quiet text link, for the
   * "…or open a course somebody shared with you" shape. It takes no height
   * and no uppercase; the caller styles it as it would style any `.bare`.
   */
  tone?: 'primary' | 'secondary' | 'ghost' | 'bare';
  /** False for one that shares a row with another control. */
  block?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const bare = tone === 'bare';
  return (
    <label
      className={bare ? 'bare tappable' : `btn btn-${tone}${block ? ' btn-block' : ''}`}
      style={{
        // A `position` of its own, because the input is absolutely positioned
        // against it. Everything else is the block button's own chrome and is
        // skipped for a text link.
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
        ...(bare
          ? null
          : {
              height: HEIGHT,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              overflow: 'hidden',
              opacity: disabled ? 0.55 : 1,
            }),
        ...style,
      }}
    >
      <input
        type="file"
        {...(accept ? { accept } : null)}
        multiple={multiple}
        {...(capture ? { capture } : null)}
        disabled={disabled}
        onClick={() => onOpen?.()}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          // Cleared before the handler runs, so that re-choosing the same file
          // is a change the browser will report next time.
          e.target.value = '';
          if (picked.length > 0) onPick(picked);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'inherit',
        }}
      />
      {children}
    </label>
  );
}
