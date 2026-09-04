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
 */

/** Minutes past midnight, or null when the wording holds no clock time. */
export function readDue(text: string): number | null {
  const s = text.trim();
  if (!s) return null;

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
