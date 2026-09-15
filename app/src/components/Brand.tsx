/**
 * The app's own logo, in the two forms it is ever drawn in.
 *
 * `Mark` is the glyph on its own — three metal slabs — and `Wordmark` is the
 * lockup: the glyph, then SEMESTER. Both read their geometry from
 * `mark.data.ts`, which is also what `scripts/icons.mjs` writes the installed
 * icons from, so the thing on a home screen and the thing at the top of the
 * workspace are one drawing rather than two that drifted.
 *
 * ## Why this is flat and the icon files are not
 *
 * `public/icon.svg` fills each slab with two fixed silver gradients, because a
 * home-screen tile is painted once and never themed. In the app the same shape
 * is a single `currentColor` silhouette, for the reason every other glyph in
 * `Icons.tsx` is: this app has thirteen grounds, five of them light, and
 * `lib/look.ts` re-cuts the brushed-metal gradient for each one. A mark
 * carrying its own baked-in silver would be the one element on a Parchment
 * ground still wearing the dark one — which is exactly the fault the `--chrome`
 * inversion in `look.ts` exists to prevent, arriving through a side door.
 *
 * Flat costs nothing at the sizes it is drawn at. The fold inside each slab is
 * a lighting effect; the silhouette is the logo, and the three gaps carry the
 * form down to 16px, which is where the favicon lives.
 *
 * ## Sized by type, not by prop
 *
 * `Mark` takes a `size` in px for the two places that are a fixed square — the
 * splash and the tile in the workspace bar. Everywhere else it is part of a
 * lockup, and there it is sized in `em` off the word beside it (`.brandlock
 * svg` in `app.css`), so one `font-size` moves both and the glyph cannot drift
 * out of proportion with the word at a breakpoint nobody re-measured. An SVG
 * with a fixed `viewBox` takes an `em` height exactly; there is no dependence
 * on which face actually loaded.
 *
 * `.brandword` is `.chrome-text` with the heading face rather than the display
 * one: Barlow Condensed, uppercase, opened up. It composes with `.chrome-text`
 * rather than restating it, so the `background-clip: text` fallback stays
 * written in one place.
 */

import { BARS, bounds, slabPath } from './mark.data';

const BOX = bounds();
const W = BOX.right - BOX.left;
const H = BOX.bottom - BOX.top;

/** The glyph's width at a given height. Exported for layout that needs it. */
export const markWidth = (height: number) => (height * W) / H;

interface MarkProps {
  /** Height in px. Left off, the glyph is sized by CSS — see above. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Mark({ size, className, style }: MarkProps) {
  return (
    <svg
      {...(size === undefined ? {} : { width: markWidth(size), height: size })}
      viewBox={`${BOX.left} ${BOX.top} ${W} ${H}`}
      fill="currentColor"
      className={className}
      style={{ display: 'block', ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {BARS.map((bar) => (
        <path key={bar.x} d={slabPath(bar)} />
      ))}
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Wordmark({ className, style }: WordmarkProps) {
  return (
    <span className={className ? `brandlock ${className}` : 'brandlock'} style={style}>
      <Mark />
      <span className="brandword chrome-text">Semester</span>
    </span>
  );
}
