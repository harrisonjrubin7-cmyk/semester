/**
 * How much to shrink a slide's type so the whole slide fits the frame.
 *
 * A video has no scrollbar. The player can let a long answer run past the fold
 * because a thumb can push it back up; a rendered frame cannot, so a slide that
 * does not fit is simply a slide with its last line missing — or, as the first
 * cut of this composition did, a card tall enough to sit over the running head.
 *
 * The longest slide in the four courses is CORE unit 4 at 25.66s: a 61-character
 * question with a 291-character answer under it, 352 in total. At the base sizes
 * that is about 1.3 times the height available between the running head and the
 * progress track, which is what this exists to take back.
 *
 * Estimated rather than measured, deliberately. Measuring means reading layout
 * back out of the DOM during a render, and a frame whose type size depends on
 * when a measurement resolved is a frame that can differ between two renders of
 * the same lesson. An estimate from the text itself is the same on every frame,
 * on every machine, forever — and it only has to be conservative, not exact.
 */

/**
 * Advance width of an average glyph, as a fraction of the font size.
 *
 * Measured off a real 1920×1080 render rather than taken from a table: the
 * first line of the CORE unit 4 answer set 58 characters across 1387px at
 * 45px, which is 0.53em a character in this app's body face at this size.
 *
 * Exported because `captions.ts` sizes the documentary's caption type the same
 * way and off the same face. A second number measured a second time would be
 * a second number to re-measure when the face changes.
 */
export const GLYPH = 0.53;

export interface SlideMetrics {
  /** Characters on the slide, question and answer together. */
  chars: number;
  /** Width the text wraps inside, in pixels. */
  innerWidth: number;
  /** Height the slide may occupy, in pixels. */
  available: number;
  /** Base size of the answer text, in pixels. */
  bodySize: number;
  /** Line height of the answer text, as a multiple. */
  lineHeight: number;
  /** Everything on the slide that is not the answer: kicker, question, padding. */
  overhead: number;
}

/**
 * A multiplier in (0, 1] for every type size on the slide.
 *
 * 1 whenever the slide already fits, so a short answer is never shrunk to match
 * a long one — the type is as large as the words allow, which is the whole
 * reason to draw type rather than record a screen.
 */
export function slideScale(m: SlideMetrics): number {
  if (m.chars <= 0 || m.available <= 0) return 1;

  /*
   * Below about two thirds the slide is smaller than the running head above
   * it, which reads as a mistake rather than as a long answer. A unit that
   * reaches this floor wants its card rewritten, not its video reflowed.
   */
  const FLOOR = 0.66;
  const STEP = 0.01;

  for (let scale = 1; scale > FLOOR; scale -= STEP) {
    if (heightAt(m, scale) <= m.available) return Number(scale.toFixed(2));
  }
  return FLOOR;
}

/**
 * The estimated height of the slide at a given scale.
 *
 * Separate, and stepped towards rather than solved, because the two effects of
 * shrinking do not compose into anything worth inverting: smaller type is
 * shorter per line *and* wraps into fewer lines, and the line count is a
 * ceiling, so height falls in steps rather than smoothly. The first cut of
 * this took a single `sqrt(available / wanted)` on the reasoning that height
 * goes roughly with the square of the scale — and on the longest slide in the
 * four courses that returned a scale whose own estimated height was 508px
 * against 461px available. It was still overflowing at the scale it called
 * the answer. A hundred steps of arithmetic costs nothing once per cue.
 */
function heightAt(m: SlideMetrics, scale: number): number {
  const size = m.bodySize * scale;
  const perLine = Math.max(1, m.innerWidth / (GLYPH * size));
  const lines = Math.ceil(m.chars / perLine);
  return lines * size * m.lineHeight + m.overhead * scale;
}
