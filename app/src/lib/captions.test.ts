import { describe, expect, it } from 'vitest';
import {
  CAPTION_HOLD,
  CAPTION_LEADING,
  captionIndexAt,
  captionType,
  type LineTime,
} from '../../../video/src/captions';
import { GLYPH } from '../../../video/src/fit';
import { CUE_LEAD } from './beats';

/**
 * Which line the documentary puts on screen, and when it takes it off.
 *
 * The times themselves are `pipeline/align.mjs`'s problem and
 * `align.test.ts` guards those. This is the other half: a caption that
 * blinks out between every pair of lines is as unwatchable as one that is
 * out of step, and a caption still sitting there through the seven seconds
 * the self-test leaves for answering out loud has misread the silence.
 *
 * The guard lives here rather than in `video/` because the module is pure
 * and this is where CI runs — the arrangement `slidefit.test.ts` and
 * `shorts.test.ts` already use.
 */

/** Three turns and then a self-test pause, at the lengths `synth.py` uses. */
const TIMES: LineTime[] = [
  { i: 0, s: 0, e: 4 },
  { i: 1, s: 4.55, e: 9 },
  { i: 2, s: 9.55, e: 13 }, // the question
  { i: 3, s: 20.55, e: 24 }, // seven seconds later, the answer
];

describe('which line is up', () => {
  it('shows the line that is being spoken', () => {
    expect(captionIndexAt(TIMES, 1)).toBe(0);
    expect(captionIndexAt(TIMES, 6)).toBe(1);
    expect(captionIndexAt(TIMES, 11)).toBe(2);
    expect(captionIndexAt(TIMES, 22)).toBe(3);
  });

  it('hands over across a turn gap without blinking empty', () => {
    /*
     * 0.55s of silence between two speakers. Taking the caption down at the
     * end of the line and putting the next one up at its start leaves a
     * half-second hole between every pair of lines in a 28-minute episode.
     */
    for (let t = 4; t < 4.55; t += 0.05) {
      expect(captionIndexAt(TIMES, t), `at ${t.toFixed(2)}s`).not.toBe(-1);
    }
  });

  it('goes quiet through the pause the self-test leaves', () => {
    // The pause is there so a student can answer out loud. Leaving the
    // question on screen is harmless; leaving it there is not the failure —
    // this is about the screen being as silent as the audio.
    expect(captionIndexAt(TIMES, 14)).toBe(-1);
    expect(captionIndexAt(TIMES, 19)).toBe(-1);
  });

  it('takes a caption down once the hold runs out', () => {
    // Asserted against the literal second, not against `e + CAPTION_HOLD` —
    // which is the expression the function evaluates, and would agree with
    // itself for any hold at all, nought included.
    expect(CAPTION_HOLD).toBe(0.6);
    expect(captionIndexAt(TIMES, 13.5)).toBe(2);
    expect(captionIndexAt(TIMES, 13.7)).toBe(-1);
  });

  it('puts the words up a moment before they are said, like everything else', () => {
    /*
     * `cueIndexAt`'s 150ms lead, which the lesson player and both videos
     * share. Literal seconds again: 9.55 - 0.15 is 9.40, and a caption that
     * arrived exactly on the word would still pass a test written as
     * `9.55 - CUE_LEAD`.
     */
    expect(CUE_LEAD).toBe(0.15);
    expect(captionIndexAt(TIMES, 9.4)).toBe(2);
    expect(captionIndexAt(TIMES, 9.3)).toBe(1);
  });

  it('shows nothing before the episode has said anything', () => {
    const late: LineTime[] = [{ i: 0, s: 3, e: 6 }];
    expect(captionIndexAt(late, 0)).toBe(-1);
    expect(captionIndexAt(late, 2.85)).toBe(0); // the 150ms lead, and no more
  });

  it('shows nothing after the last line, and nothing for an empty track', () => {
    expect(captionIndexAt(TIMES, 25)).toBe(-1);
    expect(captionIndexAt([], 5)).toBe(-1);
  });
});

describe('how big the words are', () => {
  // The lower third of a 1920×1080 frame, as `Documentary.tsx` lays it out.
  const BOX = { width: 1240, height: 173 };
  const lines = (chars: number, size: number) =>
    Math.ceil(chars / Math.max(1, BOX.width / (GLYPH * size)));

  it('fits the longest line in the four shipped scripts', () => {
    /*
     * 556 characters, in PSCI. Not a fixture: a caption that runs off the
     * bottom of the frame is a caption with its last sentence missing, and
     * the frame has no scrollbar to get it back — the argument `fit.ts`
     * makes at length about slides.
     */
    const size = captionType(556, BOX);
    expect(lines(556, size) * size * CAPTION_LEADING).toBeLessThanOrEqual(BOX.height);
  });

  it('never goes past the size it was offered', () => {
    // A short episode does not get billboard-sized captions; the ceiling is
    // the design's size and this only ever comes down from it.
    expect(captionType(20, BOX, 37)).toBe(37);
    expect(captionType(1, BOX, 37)).toBe(37);
  });

  it('comes down as the longest line gets longer, and not before', () => {
    const short = captionType(200, BOX, 37);
    const long = captionType(556, BOX, 37);
    expect(long).toBeLessThan(short);
    expect(long).toBeGreaterThan(8);
  });

  it('sizes for the longest line, not for each one', () => {
    /*
     * One size for the whole episode. Sizing per caption would mean the type
     * changing every few seconds as one speaker's turn ran longer than the
     * last, which is the same restlessness `fit.ts` refuses on slides.
     */
    expect(captionType(556, BOX)).toBe(captionType(556, BOX));
    expect(captionType(556, BOX)).not.toBe(captionType(100, BOX));
  });

  it('gives up rather than shrinking to nothing', () => {
    expect(captionType(100_000, BOX)).toBe(8);
  });
});
