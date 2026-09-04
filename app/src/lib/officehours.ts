/**
 * Office hours, and a reason to go to them.
 *
 * Every syllabus states them. The importer threw them away — a course kept
 * `prof` and `email` and no hours at all — so the one intervention with the
 * best evidence behind it for a first- or second-year student was the one
 * thing the app could not help with. One hand-built course carried them as an
 * `optional: true` block in its schedule, which is the right shape; nothing
 * else did, and nothing could put them there without editing JSON.
 *
 * ## The nudge is evidence, not a calendar
 *
 * A weekly "have you been to office hours?" is a notification people turn off
 * in a fortnight. What the app can do that a calendar cannot is notice *when*,
 * from things it already records: deadlines that went by unticked, a practice
 * paper that went badly, a drill deck you are missing more than you are
 * getting. Those are the weeks worth walking across campus for, and the app
 * sees them before you admit them.
 *
 * So every reason here names its evidence and stops. No score, no ranking of
 * how much trouble you are in, and no advice about what to say when you get
 * there — the mail drafter already helps with that, and this is a nudge, not
 * a diagnosis.
 *
 * Where a course has no hours recorded but the evidence is there anyway, the
 * app says *that* instead: they are on the syllabus, and the useful next
 * action is to put them in.
 */

import type { CourseId, DatedItem, RecurringBlock } from './types';
import { DOW, daysBetween, startOfDay } from './date';
import type { Sitting } from './sitting';

/**
 * Whether a schedule block is office hours rather than a class.
 *
 * The flag first, because that is the field that exists for it; the title as
 * a fallback, because a block typed in by hand is far more likely to be named
 * than flagged.
 */
export function isOfficeHours(block: RecurringBlock): boolean {
  return Boolean(block.optional) || /office hour|drop[- ]?in|help session/i.test(block.title);
}

/**
 * Minutes past midnight, read from the way people write a time.
 *
 * "2:45p", "2:45 PM", "14:45" and "9a" all mean something; "afternoon" does
 * not, and gets null rather than a guess. The hour grid places a block by its
 * minute count, so a block whose written time and minute count disagree
 * appears at the wrong hour — which is what happened to every block added by
 * hand, because the editor let you retype the time and never touched the
 * number underneath it.
 */
export function readClock(text: string): number | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?\s*$/i.exec(text);
  if (m) {
    let hour = Number(m[1]);
    const mins = Number(m[2] ?? 0);
    if (hour < 1 || hour > 12 || mins > 59) return null;
    const pm = m[3].toLowerCase() === 'p';
    if (hour === 12) hour = 0;
    return (hour + (pm ? 12 : 0)) * 60 + mins;
  }
  // 24-hour, which is what a <input type=time> hands back.
  const h = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!h) return null;
  const hour = Number(h[1]);
  const mins = Number(h[2]);
  if (hour > 23 || mins > 59) return null;
  return hour * 60 + mins;
}

/** The next day one of these blocks falls on, from `now`. Null if none do. */
export function nextSitting(blocks: RecurringBlock[], now: Date): { on: Date; block: RecurringBlock } | null {
  let best: { on: Date; block: RecurringBlock } | null = null;
  const from = startOfDay(now);
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const block of blocks) {
    for (const day of block.days) {
      // 0 through 7, so "today, later on" beats "today next week".
      let ahead = (day - from.getDay() + 7) % 7;
      if (ahead === 0 && block.at <= minutes) ahead = 7;
      const on = new Date(from.getFullYear(), from.getMonth(), from.getDate() + ahead);
      if (best === null || on < best.on || (on.getTime() === best.on.getTime() && block.at < best.block.at)) {
        best = { on, block };
      }
    }
  }
  return best;
}

/** "Thursday, 10:30a" — how the next one reads on screen. */
export function whenLine(next: { on: Date; block: RecurringBlock } | null, now: Date): string {
  if (!next) return '';
  const away = daysBetween(startOfDay(now), next.on);
  const day = away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : DOW[next.on.getDay()];
  return `${day}, ${next.block.time}`;
}

export interface Reason {
  courseId: CourseId;
  /** What the app noticed, in one sentence, with the number in it. */
  said: string;
}

export interface NudgeInput {
  /** Every deadline in the app, decorated with how far off it is. */
  items: DatedItem[];
  done: Record<string, boolean>;
  sittings: Sitting[];
  /** Right and wrong answers per course, over the recent window. */
  drilled: Record<string, { right: number; wrong: number }>;
  now: Date;
}

/** A fortnight for a paper, three weeks for slipped deadlines. */
const PAPER_DAYS = 14;
const SLIPPED_DAYS = 21;
const PAPER_FLOOR = 60;
const DRILL_FLOOR = 0.55;
const DRILL_MINIMUM = 10;

/**
 * Courses worth walking across campus for this week, and why.
 *
 * Three signals, each of which has to clear a real bar rather than a nominal
 * one — two slipped deadlines and not one, a paper under 60 and not under 80,
 * ten drilled answers and not three. A nudge that fires most weeks is a nudge
 * nobody reads, and the whole value here is that it fires in the week it
 * matters.
 */
export function worthGoing(input: NudgeInput): Reason[] {
  const { items, done, sittings, drilled, now } = input;
  const out = new Map<CourseId, string[]>();
  const add = (c: CourseId, said: string) => out.set(c, [...(out.get(c) ?? []), said]);

  const slipped = new Map<CourseId, number>();
  for (const i of items) {
    if (done[i.id]) continue;
    if (i.daysAway >= 0 || i.daysAway < -SLIPPED_DAYS) continue;
    slipped.set(i.c, (slipped.get(i.c) ?? 0) + 1);
  }
  for (const [courseId, n] of slipped) {
    if (n < 2) continue;
    add(courseId, `${n} deadlines went by unticked in the last three weeks.`);
  }

  for (const s of sittings) {
    const days = daysBetween(startOfDay(new Date(s.at)), startOfDay(now));
    if (days > PAPER_DAYS || days < 0) continue;
    if (s.pct >= PAPER_FLOOR) continue;
    add(s.courseId, `You sat a practice paper at ${s.pct}%.`);
  }

  for (const [courseId, tally] of Object.entries(drilled)) {
    const answered = tally.right + tally.wrong;
    if (answered < DRILL_MINIMUM) continue;
    const rate = tally.right / answered;
    if (rate >= DRILL_FLOOR) continue;
    add(courseId, `You are missing ${Math.round((1 - rate) * 100)}% of the cards you drill.`);
  }

  // One sentence per course rather than a list of three. The point is to get
  // somebody through a door, and three reasons to go read as a verdict.
  return [...out.entries()].map(([courseId, saids]) => ({ courseId, said: saids[0] }));
}
