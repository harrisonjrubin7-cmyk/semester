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
 * ## And noon, which is where the range case in turn went wrong
 *
 * Whether a range crosses noon was decided by comparing the two hours as
 * written, and twelve does not sort where it is written: on a clock face it
 * comes before one, not after eleven. So every range with a twelve at either
 * end was read twelve hours out. "12:00–2:00 PM" became midnight, and
 * "10:00–12:00 PM" — an ordinary morning exam window — became ten at night.
 * Comparing the positions on the face rather than the numerals is the whole
 * fix, and `% 12` is what puts twelve where it belongs.
 *
 * ## Midnight, the other clock time English writes as a word
 *
 * Noon is handled above by becoming a figure. Midnight cannot be, because the
 * figure it reads as literally is the wrong end of the day: "due at midnight
 * on the 8th" is the 8th running out, and 00:00 would put it before every
 * lecture that day. So it is read as 23:59 — which is what `lib/capture.ts`
 * chose, for the same reason, off the line somebody types. The app should not
 * understand "midnight" from you and not from your syllabus, and a test holds
 * the two readers to the same answer.
 *
 * Unread it fell to `NO_TIME` and sorted below the five o'clock deadline on
 * the day it names, and every screen that asks `hasTime` said it named none.
 */

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
  /*
   * Noon, written out, is a time like any other and is turned into one here
   * rather than caught at the end.
   *
   * Read as a special case after the figures, it was found only where a
   * wording held no figure at all — so "Noon–2:00 PM" fell through to the
   * ordinary scan, which takes the first time carrying a meridiem, and that is
   * the *end* of a range. A window from noon was read as two o'clock. Made a
   * figure up front, it takes part in the range reading below like anything
   * else.
   *
   * The word boundaries are load-bearing: "afternoon" and "Noonan Hall" are
   * not noon.
   */
  const s = text.trim().replace(/\bnoon\b/gi, '12:00pm');
  if (!s) return null;

  // Before the digits, because "11:59pm (midnight)" holds both and the word is
  // the one that was meant.
  if (/\bmidnight\b/i.test(s)) return MIDNIGHT;

  // Every clock-shaped thing, in order. A bare number is only a time when it
  // carries a meridiem — "Sep 8–17" is two dates and "1:15p" is a time.
  const found = [...s.matchAll(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?\b/gi)].map((m) => ({
    hour: Number(m[1]),
    mins: Number(m[2] ?? 0),
    pm: m[3].toLowerCase() === 'p',
    stated: true,
  }));

  /*
   * A range whose first half states no meridiem: "3:00–5:00 PM", "9–11 AM",
   * "10:30 to 2:00 PM". Three things about the shape of it, each of which was
   * a wrong answer before:
   *
   * The halves may be joined by a word as readily as a dash. Joined by "to",
   * "through" or "until" this was no range at all, so the scan below took the
   * first time carrying a meridiem — the *end* — and a window from half past
   * ten was read as two o'clock.
   *
   * The first half need not state minutes. "9–11 AM" is an hour range and was
   * read as eleven.
   *
   * What keeps "Sep 29 – Oct 8" out of this is the meridiem, not the colon:
   * a date range carries no am or pm. But the meridiem needs a word boundary
   * after it, or the "a" of "Sep 8–17 at 5pm" is read as an antemeridian and
   * the date range becomes eight in the morning. That one is why the colon
   * looked necessary.
   */
  const range =
    /(\d{1,2})(?::(\d{2}))?(?:\s*[-–—]\s*|\s+(?:to|through|until)\s+)(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?\b/i.exec(
      s,
    );
  if (range) {
    const hour = Number(range[1]);
    const mins = Number(range[2] ?? 0);
    const pm = range[5].toLowerCase() === 'p';
    // The meridiem governs both halves, unless the range crosses noon —
    // "11:00–1:00 PM" starts in the morning, because it has to. Read around
    // the face, where twelve sits at nought and one follows it, or a range
    // with a twelve at either end is read twelve hours out.
    const end = Number(range[3]);
    const face = (h: number) => h % 12;
    const startsPm = pm && face(hour) <= face(end);
    return clock(hour, mins, startsPm);
  }

  if (found.length === 0) {
    // A lone `H:MM` with no meridiem at all, which a 24-hour syllabus or a
    // form field can produce.
    const bare = /\b(\d{1,2}):(\d{2})\b/.exec(s);
    if (bare) {
      const hour = Number(bare[1]);
      const mins = Number(bare[2]);
      if (hour <= 23 && mins <= 59) return hour * 60 + mins;
    }

    // Nothing clock-shaped and neither word: the wording holds no time, which
    // `NO_TIME` sorts to the end of its day.
    return null;
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
