import type { CSSProperties } from 'react';
import { TRUST_MEANING, TRUST_TEXT, freshnessLine, wantsAttention, type TrustKind } from '../lib/source';

/**
 * Where a fact came from and how old it is, beside the fact.
 *
 * Text, not an icon or a colour: `a11y/tellings.test.ts` holds the app to
 * never saying something only with shape or colour, and "Estimated" is
 * exactly the kind of word that must reach a screen reader. The meaning
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
  onReport,
  style,
}: {
  /**
   * One of the five stored labels, or `ai_assisted` / `external` — the two
   * display-only kinds in `lib/source.ts`. One badge for all seven, so an AI
   * answer and a registrar record read in the same vocabulary.
   */
  label: TrustKind;
  /** When the fact was last updated or synced, epoch ms. Omit when unknown. */
  at?: number | null;
  now?: number;
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
        {TRUST_TEXT[label]}
      </span>
      <span className="sr-only">{TRUST_MEANING[label]}</span>
      {fresh ? <span>{fresh}</span> : null}
      {onReport ? (
        <button type="button" className="btn btn-ghost" onClick={onReport}>
          Report incorrect information
        </button>
      ) : null}
    </span>
  );
}
