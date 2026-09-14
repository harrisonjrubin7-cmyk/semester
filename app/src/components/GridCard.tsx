import type { CSSProperties, ReactNode } from 'react';
import { secondLine } from '../lib/dim';

/**
 * One tile in a wrapping grid of choices.
 *
 * This is the shape the whole app is built out of now. It started as the
 * guide's "Ways to study this" picker — eleven ways through a course, all
 * visible at once, each carrying what is actually behind it — and it turned
 * out to be the right answer to every "pick one of these" in the app. So it
 * is a component rather than a block of style inside `ModePicker`, and the
 * course list on the home screen, the mode picker on a guide and the row of
 * everything else are three uses of one thing.
 *
 * That matters more than the saved lines. Two grids drawn by two files drift:
 * one gets a new selected state, the other keeps the old border, and the app
 * reads as two apps a fortnight later. See `screens/Guides.tsx`.
 *
 * ## Empty is dimmed, not hidden, and never disabled
 *
 * A tile with nothing behind it stays tappable and says so when you arrive.
 * Knowing Listen exists and is empty beats not knowing Listen exists, and a
 * disabled button that will not say why is worse than an empty screen that
 * will.
 */
export function GridCard({
  label,
  meta,
  selected = false,
  dim = false,
  title,
  onClick,
  style,
}: {
  /** The name, set in the heading face. */
  label: ReactNode;
  /** The line under it — "68 cards", "11 units". What is actually there. */
  meta?: ReactNode;
  selected?: boolean;
  /** True when there is nothing behind this one. Dims; does not disable. */
  dim?: boolean;
  /** The long form, for a pointer that rests here. */
  title?: string;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      style={{
        textAlign: 'left',
        paddingBlock: 'var(--sp-5)',
        paddingInline: 'var(--sp-5)',
        border: `1px solid ${selected ? 'var(--app-accent)' : 'var(--app-line)'}`,
        borderRadius: 'var(--r-md)',
        background: selected
          ? 'var(--app-hero)'
          : 'linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,0) 60%)',
        boxShadow: selected ? '0 0 0 3px var(--app-accent-wash)' : '0 1px 0 var(--app-line-top) inset',
        transition: 'border-color var(--fast), box-shadow var(--fast), background var(--fast)',
        opacity: dim ? 0.45 : 1,
        display: 'block',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--type-md)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: selected ? 'var(--app-accent)' : 'var(--app-fg)',
        }}
      >
        {label}
      </span>
      {meta !== undefined && (
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-xs)',
            ...secondLine(),
            marginTop: 'var(--sp-2)',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {meta}
        </span>
      )}
    </button>
  );
}

/**
 * The grid they sit in.
 *
 * `auto-fit` rather than a fixed column count, so the same grid is two columns
 * on a phone and five on a laptop without anything asking how wide the window
 * is. That is also what lets the guides be a navigation that draws no chrome
 * at either width — see `lib/chrome.ts`.
 */
export function CardGrid({ children, min = 148 }: { children: ReactNode; min?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap: 'var(--sp-4)',
      }}
    >
      {children}
    </div>
  );
}
