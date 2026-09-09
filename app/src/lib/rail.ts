/**
 * Where the day has got to.
 *
 * Today's schedule listed four blocks in time order and told you nothing about
 * which of them you were in the middle of. At 10:47 on a Tuesday the eleven
 * o'clock, the quarter past one and the quarter to three were drawn the same
 * way, and the one fact the list is opened for — *what is happening now, and
 * what is next* — had to be worked out by reading the clock on your own phone
 * and comparing it against a column of times.
 *
 * The rail knew the times all along. This is the arithmetic that turns them
 * into a position in the day, kept apart from the drawing so it can be tested
 * against a clock that does not move.
 *
 * ## Four states, because they want four different treatments
 *
 * `past` is dimmed — it is context, not instruction. `now` is the one you are
 * in. `next` is the one to leave for, and the only one that earns a countdown:
 * a column of "in 4 hr 12 min" beside every block is a column nobody reads.
 * `later` is the rest of the day, drawn plainly.
 *
 * A block that has been cancelled is still a block at a time, so it takes the
 * state its hour gives it; the screen strikes it through rather than lying
 * about when it would have been.
 */

import { untilLabel } from './date';

export type When = 'past' | 'now' | 'next' | 'later';

export interface Standing {
  when: When;
  /** Minutes until it starts. Negative once it has. */
  inMinutes: number;
  /** Minutes of it left, once it is running. Zero otherwise. */
  leftMinutes: number;
  /** The words beside it, or nothing at all — see the note above. */
  said: string;
}

/**
 * A deadline is a moment rather than an hour.
 *
 * The rail carries both: a class runs for fifty minutes and a quiz due "before
 * class" is a point on the clock. A block with no length is over the moment it
 * arrives, which is what a deadline does, and it is never "on now" — an hour
 * you are inside is a different thing from a time that has passed.
 */
export function readBlock(
  at: number,
  length: number,
  minutes: number,
  isNext: boolean,
): Standing {
  const inMinutes = at - minutes;
  const ends = at + length;

  if (length > 0 && minutes >= at && minutes < ends) {
    const leftMinutes = Math.max(1, ends - minutes);
    return {
      when: 'now',
      inMinutes,
      leftMinutes,
      said: `On now · ${leftMinutes} min left`,
    };
  }
  if (minutes >= ends) return { when: 'past', inMinutes, leftMinutes: 0, said: '' };
  if (isNext) {
    return { when: 'next', inMinutes, leftMinutes: 0, said: untilLabel(inMinutes) };
  }
  return { when: 'later', inMinutes, leftMinutes: 0, said: '' };
}

/**
 * The day, read against the clock.
 *
 * `next` is the first block that has not started — one of them, however many
 * share a minute, because "the next one" is a single thing to walk to. A block
 * already running does not take the label away from it: you can be sitting in
 * one class and still be told what follows, which is the pair of facts this
 * screen exists for.
 */
export function readDay<T>(
  blocks: T[],
  minutes: number,
  at: (b: T) => number,
  length: (b: T) => number,
): Standing[] {
  const first = blocks.findIndex((b) => at(b) > minutes);
  return blocks.map((b, i) => readBlock(at(b), length(b), minutes, i === first));
}

/**
 * Where the line marking the present goes: the index it is drawn above.
 *
 * Everything that has started sits above it and everything still to come below
 * it, so a day half gone reads as a day half gone at a glance. `0` puts it at
 * the top of the list — a morning before the first class — and the list's own
 * length puts it at the bottom, which is a day that is over.
 */
export function nowAt<T>(blocks: T[], minutes: number, at: (b: T) => number): number {
  return blocks.filter((b) => at(b) <= minutes).length;
}

/**
 * Whether drawing that line is worth it.
 *
 * On a day with nothing on it there is no sequence for the present to sit in,
 * and a lone rule labelled with the time is furniture. Two or more blocks, or
 * one that has not happened yet, and it earns its place.
 */
export function worthMarking<T>(blocks: T[], minutes: number, at: (b: T) => number): boolean {
  if (blocks.length === 0) return false;
  return blocks.length > 1 || nowAt(blocks, minutes, at) === 0;
}
