import type { CSSProperties, ReactNode } from 'react';

/**
 * A block of text something else wrote.
 *
 * Six screens show the same object — the prose that came back from a request,
 * held in a bordered block, wrapping on its own newlines: the read of a data
 * set on Analyse, the day's report on Brief, the draft on Essay, the worked
 * method on Solve, the week on Weekly, the file's text on ProjectFile. Six
 * copies of one thing, and they had drifted to three font sizes and two line
 * heights, which is the whole reason a reader cannot tell whether a screen is
 * showing them the same kind of thing twice.
 *
 * One shape now. The differences it settles are small and deliberate:
 * Analyse, Solve and ProjectFile gain half a pixel to a pixel of type, and
 * Analyse, Essay and Solve lose 0.05 of leading. Nothing else moves.
 *
 * ## Why not `<Blueprint>`
 *
 * `Blueprint` is the app's *card*: a gradient, an inner highlight and a lift,
 * for an object standing above the page. This is a passage of text sitting in
 * a quiet frame — flat on purpose, so a paragraph does not read as a button
 * you have failed to press. They are two treatments and the app has always had
 * both; only one of them had a name.
 */
export function Produced({
  children,
  style,
  scroll = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** For content that can be wider than the column — a table, a diagram. */
  scroll?: boolean;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--app-line)',
        fontSize: 'var(--type-md)',
        /*
         * 1.6, and not `--leading-relaxed`.
         *
         * The token is 1.5, which is right for a sentence under a heading and
         * a little tight for four hundred words of unbroken output — which is
         * what this holds. Written once here rather than six times across the
         * screens, which is the part that was actually wrong.
         */
        lineHeight: 1.6,
        // The newlines are the model's paragraphing. Collapsing them would
        // turn a structured answer into one block.
        whiteSpace: 'pre-wrap',
        textWrap: 'pretty',
        ...(scroll ? { overflowX: 'auto' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The quiet panel: a note, an offer, a row of detail.
 *
 * The other half of what was hand-rolled. Twelve places drew a bordered block
 * around a sentence or two, at `10px 12px`, `11px 13px`, `12px 13px` and
 * `10px 13px` — four paddings for one object, none of them chosen, each of
 * them copied from whichever neighbour was open at the time.
 *
 * `12px 13px` is the most common of the four and is what this uses, so eight
 * of the twelve do not move and the other four move by a pixel.
 */
export function Panel({
  children,
  style,
  tone = 'plain',
}: {
  children: ReactNode;
  style?: CSSProperties;
  /**
   * `raised` fills with the hero ground, for a panel that has to separate
   * itself from the page rather than from the paragraph above it. Still flat —
   * see the note on `Produced` about why neither of these is a card.
   */
  tone?: 'plain' | 'raised' | 'inset';
}) {
  return (
    <div
      style={{
        padding: '12px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        ...(tone === 'raised' ? { background: 'var(--app-hero)' } : {}),
        ...(tone === 'inset' ? { background: 'var(--app-panel)' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
