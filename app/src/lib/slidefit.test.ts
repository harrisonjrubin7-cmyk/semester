import { describe, expect, it } from 'vitest';
import { slideScale, type SlideMetrics } from '../../../video/src/fit';

/**
 * Whether a rendered lesson slide fits the frame it is drawn in.
 *
 * `video/src/fit.ts` lives with the composition, because the geometry it
 * reasons about is the video's and the app has a scrollbar instead. The guard
 * lives *here* because this is where CI runs: adding Remotion to the app's
 * install would pull a browser down on every run to check sixteen lines of
 * arithmetic. The module is pure — no React, no `remotion` import — so vitest
 * reads it across the repo root for nothing.
 *
 * The case that made this exist is the last one. CORE unit 4 at 25.66s is the
 * longest slide in the four courses, and at the base sizes its card grew past
 * the space between the running head and the progress track: the first render
 * of it covered the unit title completely.
 */

/** The composition's real geometry at 1920×1080. See `LessonVideo`. */
const FRAME: Omit<SlideMetrics, 'chars'> = {
  innerWidth: 1920 - 2 * 144 - 2 * 106,
  available: 1080 - 2 * 144 - 119 - 2 * 106,
  bodySize: 45,
  lineHeight: 1.5,
  overhead: 28 + 56 * 1.15 + 63,
};

const at = (chars: number): number => slideScale({ ...FRAME, chars });

describe('fitting a slide to the frame', () => {
  it('leaves a short answer at full size', () => {
    // The type is as large as the words allow — that is the whole reason to
    // draw type rather than record a screen.
    expect(at(90)).toBe(1);
  });

  it('never enlarges anything', () => {
    expect(at(1)).toBe(1);
    expect(at(0)).toBe(1);
  });

  it('shrinks a long answer rather than letting it run off the frame', () => {
    expect(at(352)).toBeLessThan(1);
  });

  it('shrinks monotonically — more words is never bigger type', () => {
    let last = 1;
    for (let n = 0; n <= 900; n += 25) {
      const s = at(n);
      expect(s).toBeLessThanOrEqual(last + 1e-9);
      last = s;
    }
  });

  it('stops at a floor rather than shrinking to nothing', () => {
    // Past this the slide is smaller than the running head above it, which
    // reads as a bug rather than as a long answer.
    expect(at(5000)).toBe(0.66);
    expect(at(50000)).toBe(0.66);
  });

  it('brings the worst slide in the four courses inside the frame', () => {
    /*
     * CORE unit 4: a 61-character question and a 291-character answer. The
     * estimate must land the scaled height inside `available`, or the card
     * covers the running head the way the first render of it did.
     *
     * Recomputed here rather than trusted: this is the arithmetic the
     * composition will do, with the scale the function returned.
     */
    const chars = 352;
    const s = at(chars);
    const perLine = FRAME.innerWidth / (0.53 * FRAME.bodySize * s);
    const lines = Math.ceil(chars / perLine);
    const height = lines * FRAME.bodySize * s * FRAME.lineHeight + FRAME.overhead * s;
    expect(height).toBeLessThanOrEqual(FRAME.available);
  });
});
