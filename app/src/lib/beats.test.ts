import { describe, expect, it } from 'vitest';
import {
  atFirstBeat,
  atLastBeat,
  CUE_LEAD,
  cueIndexAt,
  showingExtra,
  type BeatPosition,
} from './beats';

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

/**
 * Which slide is up at a given second.
 *
 * This rule lived inside the player, where only the player could reach it, and
 * `video/` needs the same answer or the type on screen drifts away from the
 * voice under it. The cases below are the ones that decide whether the two
 * agree: the lead, the boundary the lead creates, and a unit with no cues.
 */
const CUES = [
  { at: 0, kind: 'title' as const, text: 'Thinking at the margin' },
  { at: 12.5, kind: 'q' as const, text: 'What is a sunk cost?' },
  { at: 18, kind: 'a' as const, text: 'Spent and unrecoverable.' },
  { at: 40, kind: 'close' as const, text: 'That is the unit' },
];

describe('the slide at a moment', () => {
  it('opens on the title', () => {
    expect(cueIndexAt(CUES, 0)).toBe(0);
  });

  it('stays there until the next cue', () => {
    expect(cueIndexAt(CUES, 12)).toBe(0);
  });

  it('turns a lead before the voice, not after it', () => {
    /*
     * Literal seconds, deliberately.
     *
     * The first draft of this asserted `cueIndexAt(CUES, 12.5 - CUE_LEAD)`,
     * which is the same expression the function evaluates and therefore true
     * for any lead at all, zero included — it passed against a revert that
     * set `CUE_LEAD = 0`, so it was not testing the lead. 12.45 is before the
     * cue's own 12.5 and only reaches it if a lead is really added.
     */
    expect(cueIndexAt(CUES, 12.45)).toBe(1);
    // ...and the lead is a lead, not a landslide: a second early is still the
    // slide before.
    expect(cueIndexAt(CUES, 11.5)).toBe(0);
    expect(CUE_LEAD).toBeGreaterThan(0);
  });

  it('holds the last cue to the end of the narration', () => {
    expect(cueIndexAt(CUES, 400)).toBe(3);
  });

  it('answers 0 for a unit that arrived with no cues', () => {
    // `Previous` used to index `cues` directly and throw here; this is the
    // same emptiness asked of the other half of the rule.
    expect(cueIndexAt([], 9)).toBe(0);
  });

  it('is what the player draws, so the video draws it too', () => {
    // Every second of a lesson, walked: the index never goes backwards and
    // never skips a cue. A renderer that sampled per frame would show the
    // same sequence of slides as a player that sampled on timeupdate.
    let last = 0;
    for (let s = 0; s <= 45; s += 0.5) {
      const i = cueIndexAt(CUES, s);
      expect(i).toBeGreaterThanOrEqual(last);
      expect(i - last).toBeLessThanOrEqual(1);
      last = i;
    }
    expect(last).toBe(3);
  });
});
