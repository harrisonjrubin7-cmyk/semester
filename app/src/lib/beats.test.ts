import { describe, expect, it } from 'vitest';
import { atFirstBeat, atLastBeat, showingExtra, type BeatPosition } from './beats';

/**
 * The two arrows under a narrated lesson, and whether they have anywhere to go.
 *
 * Found by pressing every control in the app and asking what happened:
 * "Previous beat" on the first beat changed nothing measurable, because it
 * seeked to the cue the playhead was already on. It was not broken — it was
 * enabled while there was nothing behind it, which is the opposite of what
 * `Reorder` does at the ends of a list.
 */

const at = (p: Partial<BeatPosition> = {}): BeatPosition => ({
  index: 0,
  cues: 5,
  added: 0,
  extra: 0,
  finished: false,
  ...p,
});

describe('the start of a lesson', () => {
  it('is the first cue', () => {
    expect(atFirstBeat(at({ index: 0 }))).toBe(true);
  });

  it('is not the second', () => {
    expect(atFirstBeat(at({ index: 1 }))).toBe(false);
  });

  it('is not the first added slide — stepping back off it returns to a cue', () => {
    const tail = at({ index: 4, added: 2, extra: 1, finished: true });
    expect(showingExtra(tail)).toBe(true);
    expect(atFirstBeat(tail)).toBe(false);
  });

  /*
   * The second thing this fixes. `Previous` read `cues[Math.max(0, index - 1)]`
   * and then `.at` on it, so a unit with no cues threw rather than doing
   * nothing. Disabled is the honest answer, and it is also the safe one.
   */
  it('is a unit that arrived with no cues at all', () => {
    expect(atFirstBeat(at({ index: 0, cues: 0 }))).toBe(true);
  });
});

describe('the end of a lesson', () => {
  it('is the last cue, when nothing was added after the recording', () => {
    expect(atLastBeat(at({ index: 4, cues: 5 }))).toBe(true);
    expect(atLastBeat(at({ index: 3, cues: 5 }))).toBe(false);
  });

  it('is not the last cue while added slides are still ahead', () => {
    expect(atLastBeat(at({ index: 4, cues: 5, added: 2, extra: 0, finished: true }))).toBe(false);
    expect(atLastBeat(at({ index: 4, cues: 5, added: 2, extra: 1, finished: true }))).toBe(false);
  });

  it('is the last added slide', () => {
    expect(atLastBeat(at({ index: 4, cues: 5, added: 2, extra: 2, finished: true }))).toBe(true);
  });

  /*
   * The tail only plays once the narration has finished, so slides that exist
   * do not keep the arrow alive while there is still narration to hear. The
   * cue index is what says there is: mid-lesson it is not the end anyway.
   */
  it('ignores the tail until the narration has finished', () => {
    expect(atLastBeat(at({ index: 4, cues: 5, added: 2, extra: 0, finished: false }))).toBe(true);
  });

  it('is a unit that arrived with no cues at all', () => {
    expect(atLastBeat(at({ index: 0, cues: 0 }))).toBe(true);
  });
});

describe('both ends at once', () => {
  it('shut both arrows on a one-cue unit, and on an empty one', () => {
    for (const cues of [0, 1]) {
      const only = at({ index: 0, cues });
      expect(atFirstBeat(only)).toBe(true);
      expect(atLastBeat(only)).toBe(true);
    }
  });

  it('leave both open in the middle', () => {
    const middle = at({ index: 2, cues: 5 });
    expect(atFirstBeat(middle)).toBe(false);
    expect(atLastBeat(middle)).toBe(false);
  });
});
