/**
 * The time inside "Before class, 1:15p".
 *
 * A deadline's `dueTime` is kept exactly as the syllabus words it, which is
 * right — "In class" and "Window is Sep 8–17" mean things no clock can hold,
 * and rewriting them would lose the only wording a person can check against
 * the PDF. But it was never *read*, either, so "due 11:59 PM" sorted
 * alongside "by class" and neither could land anywhere on a day.
 *
 * This reads the obvious ones and leaves the rest alone. Both halves matter:
 * a parser that returns midnight for "In class" would put a deadline at the
 * top of a day it does not belong at the top of.
 *
 * ## The range case, which is where a naive parser goes wrong
 *
 * "3:00–5:00 PM" starts at three in the afternoon, not three in the morning —
 * the meridiem sits on the second time and governs both. "9:00–11:00 AM"
 * starts at nine. A parser that reads the first time in isolation gets one of
 * those right by luck and the other wrong by twelve hours, which is the kind
 * of error that puts an exam before breakfast.
 *
 * ## The two clock times English writes as words
 *
 * "Due at noon" states a time as plainly as "due at 12:00", and this read it
 * as no time at all — so it sorted to the end of its day, below the five
 * o'clock one, and every screen that asks `hasTime` said it named none. The
 * argument in this file for sorting untimed things late is that "you have all
 * day to do something about" them; noon is not all day.
 *
 * `lib/capture.ts` already reads both words, off the line somebody types. The
 * app could understand "noon" from you and not from your syllabus. It reads
 * them the same way here, and a test holds the two to the same answer.
 *
 * Midnight is the end of its day, not the start: "due at midnight on the 8th"
 * is the 8th running out, and 00:00 would put it before every lecture that
 * day. 23:59 is what `capture.ts` chose for the same reason.
 */

/** Twelve o'clock, as the two words English writes instead of digits. */
const NOON = 12 * 60;

/**
 * The end of the day it names, not the start.
 *
 * "Due at midnight on the 8th" is the 8th running out. Reading it as 00:00
 * would sort the deadline above every lecture on the 8th and mark it a day
 * early on any screen that compares clocks.
 */
const MIDNIGHT = 23 * 60 + 59;

/** Minutes past midnight, or null when the wording holds no clock time. */
export function readDue(text: string): number | null {
  // Typed as a string and not always one in practice. A course syncing in from
  // another device — or from a build before this field existed — can arrive
  // with it missing, and this is called from the Header, so a `.trim()` on
  // undefined took the whole app down rather than one deadline's clock.
  if (typeof text !== 'string') return null;
  const s = text.trim();
  if (!s) return null;

  // Before the digits: "12 noon" and "11:59pm (midnight)" hold both, and the
  // word is the one that was meant. `\b` on each side so that *after*noon,
  // which is a part of a day rather than a time, is left alone.
  const said = s.toLowerCase();
  if (/\bnoon\b/.test(said)) return NOON;
  if (/\bmidnight\b/.test(said)) return MIDNIGHT;

  // Every clock-shaped thing, in order. A bare number is only a time when it
  // carries a meridiem — "Sep 8–17" is two dates and "1:15p" is a time.
  const found = [...s.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?\b/gi)].map((m) => ({
    hour: Number(m[1]),
    mins: Number(m[2] ?? 0),
    pm: m[3].toLowerCase() === 'p',
    stated: true,
  }));

  // A range whose first half states no meridiem: "3:00–5:00 PM". The colon is
  // required here, so "Sep 29 – Oct 8" is not mistaken for one.
  const range = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?/i.exec(s);
  if (range) {
    const hour = Number(range[1]);
    const mins = Number(range[2]);
    const pm = range[5].toLowerCase() === 'p';
    // The meridiem governs both halves, unless the range crosses noon —
    // "11:00–1:00 PM" starts in the morning, because it has to.
    const end = Number(range[3]);
    const startsPm = pm && hour <= end;
    return clock(hour, mins, startsPm);
  }

  // Otherwise a lone `H:MM` with no meridiem at all, which a 24-hour syllabus
  // or a form field can produce.
  if (found.length === 0) {
    const bare = /\b(\d{1,2}):(\d{2})\b/.exec(s);
    if (!bare) return null;
    const hour = Number(bare[1]);
    const mins = Number(bare[2]);
    if (hour > 23 || mins > 59) return null;
    return hour * 60 + mins;
  }

  const first = found[0];
  return clock(first.hour, first.mins, first.pm);
}

function clock(hour: number, mins: number, pm: boolean): number | null {
  if (hour < 1 || hour > 12 || mins > 59) return null;
  const h = hour === 12 ? 0 : hour;
  return (h + (pm ? 12 : 0)) * 60 + mins;
}

/**
 * A deadline's place in the day, for sorting and for the rail.
 *
 * Where the wording holds no time, a deadline sorts to the end of its day
 * rather than the start. "In class" and "before the end of the week" are both
 * things you have all day to do something about, and putting them at 00:00
 * would show them above the 9am lecture they are handed in at.
 */
export const NO_TIME = 24 * 60;

export function dueMinutes(dueTime: string): number {
  return readDue(dueTime) ?? NO_TIME;
}

/** Whether a wording actually named a time, for a screen that wants to say. */
export function hasTime(dueTime: string): boolean {
  return readDue(dueTime) !== null;
}
