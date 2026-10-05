import type { CSSProperties } from 'react';
import { TRUST_GLYPH, TRUST_MEANING, TRUST_TEXT, freshnessLine, wantsAttention, type TrustKind } from '../lib/source';

/**
 * Where a fact came from and how old it is, beside the fact.
 *
 * A glyph and a word, never a colour alone: `a11y/tellings.test.ts` holds the
 * app to never saying something only with shape or colour, and "Estimated" is
 * exactly the kind of word that must reach a screen reader. The glyph is
 * `aria-hidden`; the word is what is read. The meaning
 * sentence rides in `title` for a pointer and in visually-hidden text for
 * assistive technology, so the badge stays one short line on screen.
 *
 * `onReport`, when given, adds the "report incorrect information" control
 * that every source label is meant to carry (Sprint 1, G). It is a button,
 * not a link, because what it opens is decided by the screen.
 */
export function SourceBadge({
  label,
  at,
  now,
  unknownAge,
  onReport,
  style,
}: {
  /**
   * One of the five stored labels, or a display-only kind in `lib/source.ts`
   * (`ai_assisted`, `external`, `unavailable_stale`, `connected`, `sample`).
   * One badge for all ten, so an AI answer and a registrar record read in the
   * same vocabulary.
   */
  label: TrustKind;
  /** When the fact was last updated or synced, epoch ms. Omit when unknown. */
  at?: number | null;
  now?: number;
  /**
   * Say so when there is no time to show. Most course dates carry no
   * per-item timestamp, and a badge with a label and no age looks as if the
   * age was checked and is fine. Off by default so the badge elsewhere in the
   * app reads as it always has.
   */
  unknownAge?: boolean;
  onReport?: () => void;
  style?: CSSProperties;
}) {
  const fresh = freshnessLine(at, now);
  const loud = wantsAttention(label);
  return (
    <span
      data-source={label}
      title={TRUST_MEANING[label]}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 'var(--sp-2)',
        fontSize: 'var(--type-xs)',
        color: 'var(--app-dim)',
        ...style,
      }}
    >
      <span
        style={{
          border: `1px solid ${loud ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
          background: loud ? 'var(--app-warn-wash)' : 'transparent',
          borderRadius: 'var(--r-sm)',
          paddingInline: 'var(--sp-2)',
          color: 'var(--app-fg)',
        }}
      >
        <span aria-hidden="true" style={{ marginInlineEnd: 'var(--sp-2)' }}>
          {TRUST_GLYPH[label]}
        </span>
        {TRUST_TEXT[label]}
      </span>
      <span className="sr-only">{TRUST_MEANING[label]}</span>
      {fresh ? <span>{fresh}</span> : unknownAge ? <span>Update time not recorded</span> : null}
      {onReport ? (
        <button
          type="button"
          className="bare"
          onClick={onReport}
          style={{
            width: 'auto',
            minHeight: 44,
            fontSize: 'var(--type-xs)',
            color: 'var(--app-accent-deep)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Report incorrect information
        </button>
      ) : null}
    </span>
  );
}
