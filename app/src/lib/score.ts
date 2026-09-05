/**
 * Reading a score the way it was written down.
 *
 * A grade comes back in whatever shape the professor wrote it: 88, 88%, 17/20,
 * "17 out of 20", B+. The app took a number and nothing else, so a course that
 * hands back letters could not be tracked at all, and a rubric marked out of
 * 20 had to be divided by hand before it could be typed. Both of those are the
 * app making somebody do arithmetic so that it does not have to.
 *
 * `lib/grades.ts` reads the numeric shapes; it cannot read a letter, because a
 * letter only means something against a set of cutoffs and that file has no
 * business knowing which course this is. This one composes the two.
 *
 * ## What a letter is worth, and why the low end
 *
 * A letter is a band, not a point. "B+" says somewhere from 87 to 89, and any
 * single number this app picks is an assertion nobody made. It takes the
 * **bottom** of the band, for one reason: a projection that guesses high tells
 * somebody they are fine when they are not, and there is no version of this
 * app where that is the safer error. The screen says which number it used and
 * why, so anybody who knows their actual mark can type it instead.
 *
 * Cutoffs come from the course, or the school, or a common American scale —
 * `lib/cutoffs.ts` tracks which, and a letter read against an assumed scale is
 * said to be exactly that.
 */

import { readScore } from './grades';
import type { GradeSystem } from './cutoffs';

/** How a typed score was understood. */
export type How = 'number' | 'percent' | 'fraction' | 'proportion' | 'letter' | 'none';

export interface Reading {
  /** The percentage, or null when nothing could be read from it. */
  pct: number | null;
  how: How;
  /**
   * What the app did, when it did something worth admitting to. Empty when the
   * reading was a plain number and there is nothing to explain.
   */
  said: string;
}

const NOTHING: Reading = { pct: null, how: 'none', said: '' };

/** Both minus signs, both dashes, and any case. "b-" is "B−". */
function tidyLetter(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .replace(/[–—−-]/g, '−')
    .replace(/\s+/g, '');
}

/** The band a typed letter names, or null when it names none. */
export function bandFor(text: string, system: GradeSystem): { label: string; min: number } | null {
  const typed = tidyLetter(text);
  if (!typed) return null;
  for (const band of system.scale ?? []) {
    if (tidyLetter(band.label) === typed && typeof band.min === 'number') {
      return { label: band.label, min: band.min };
    }
  }
  return null;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * One typed score, and what the app made of it.
 *
 * Tried in the order that avoids collisions: a letter first, because no
 * numeric shape starts with a letter, then the numeric shapes.
 */
export function interpret(text: string, system: GradeSystem, assumed = false): Reading {
  const s = text.trim();
  if (!s) return NOTHING;

  if (/[A-Za-z]/.test(s) && !/\d\s*(?:out\s+of|of)\s*\d/i.test(s)) {
    const band = bandFor(s, system);
    if (!band) return { pct: null, how: 'none', said: `Nothing here reads ${s} as a grade.` };
    return {
      pct: band.min,
      how: 'letter',
      said:
        `${band.label} counted as ${band.min}% — the bottom of that band, so the projection ` +
        `never flatters you.${assumed ? ' On a common scale, because this course has not said its own.' : ''}`,
    };
  }

  const pct = readScore(s);
  if (pct === null) return { pct: null, how: 'none', said: `That is not a score this can read.` };

  if (/(?:\/|\bout\s+of\b|\bof\b)/i.test(s)) {
    return { pct, how: 'fraction', said: `${s} is ${round(pct)}%.` };
  }
  if (/^0?\.\d+$/.test(s)) {
    return { pct, how: 'proportion', said: `${s} read as ${round(pct)}%.` };
  }
  if (s.includes('%')) return { pct, how: 'percent', said: '' };
  return { pct, how: 'number', said: '' };
}

/**
 * What to store, once the field has been left.
 *
 * The number, when the app had to work to get there — so what the projection
 * uses is what the person can see, and can correct. A plain number is left
 * exactly as typed: rewriting "88" to "88" only moves the cursor.
 */
export function settled(text: string, system: GradeSystem): string {
  const read = interpret(text, system);
  if (read.pct === null) return text;
  if (read.how === 'number' || read.how === 'percent') return text;
  return String(round(read.pct));
}

/** What the field will accept, said once rather than guessed at. */
export const ACCEPTS = 'A number, a percentage, 17/20, 17 out of 20, or a letter.';
