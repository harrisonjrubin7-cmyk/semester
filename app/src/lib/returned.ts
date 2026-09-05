/**
 * Work that has come back, and the window for saying something about it.
 *
 * Almost every syllabus carries a sentence like *questions about a grade must
 * be raised in writing within seven days of its return*. It is the most
 * consequential deadline in the document and the only one nobody puts in a
 * calendar, because it does not exist until a grade appears — and by the time
 * you have decided the mark was wrong, four of the seven days have gone.
 *
 * The app had every other date in the syllabus and not this one. It could not
 * have it in advance either: the clock starts when a professor hands something
 * back, which is a fact only the student knows.
 *
 * So it is one tap at the moment the grade appears, and from there it is
 * arithmetic.
 *
 * ## It counts days and holds no opinion about the mark
 *
 * Nothing here decides whether a grade is wrong. There is no "this looks low
 * for you", no comparison against your average, no suggestion to appeal. Those
 * would be the app editorialising about somebody's coursework on evidence it
 * does not have, and the consequences of getting it wrong land on the student
 * in a room with their professor. What it knows is the date it came back, the
 * number of days the syllabus allows, and today.
 *
 * ## The window is entered, never assumed
 *
 * Seven days is common and is not a rule. Some courses say five business days,
 * some say two weeks, some say nothing at all. A default of seven would be
 * wrong quietly and in the dangerous direction — somebody would trust a
 * countdown that had been invented — so a course with no recorded window gets
 * no countdown, and says that is why.
 */

import { readMortem, type PostMortem } from './postmortem';

/** One piece of work, back. */
export interface Returned {
  /** The deadline it belongs to. */
  id: string;
  /** Which course, so the right window applies. */
  courseId: string;
  /** Epoch ms it came back. The clock starts here, not at the due date. */
  at: number;
  /** The mark, exactly as it was written — "17/20", "88", "B+". Never parsed. */
  score: string;
  /** What the feedback said, or what you want to ask about. */
  note: string;
  /** Whether you have raised it. Stops the countdown without hiding the row. */
  raised: boolean;
  /**
   * Where the marks went, if it was ever filled in.
   *
   * Optional and stays optional. The record exists to start the regrade
   * countdown; this is an offer beside it. See `lib/postmortem.ts`.
   */
  mortem?: PostMortem;
}

/** How long a course allows, as its syllabus states it. */
export interface RegradeWindow {
  /** Calendar days. Zero means nothing is recorded, which is not the same as none. */
  days: number;
  /** Whether the syllabus counts business days rather than calendar days. */
  business: boolean;
  /** The syllabus's own words, so the figure can be checked later. */
  note: string;
}

export const NO_WINDOW: RegradeWindow = { days: 0, business: false, note: '' };

export function newReturned(id: string, courseId: string, at: number): Returned {
  return { id, courseId, at, score: '', note: '', raised: false };
}

function startOfDay(at: number): Date {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * N days after a date, skipping weekends where the syllabus counts business
 * days.
 *
 * No holiday calendar, and there will not be one invented: a window that
 * crosses Thanksgiving is a day short and the screen says the app cannot know
 * about holidays, which is better than being confidently a day out. The same
 * refusal `lib/runway.ts` makes about testing-centre lead times.
 */
export function closesOn(r: Returned, w: RegradeWindow): Date | null {
  if (w.days <= 0) return null;
  const out = startOfDay(r.at);
  if (!w.business) {
    out.setDate(out.getDate() + w.days);
    return out;
  }
  let left = w.days;
  while (left > 0) {
    out.setDate(out.getDate() + 1);
    const dow = out.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return out;
}

/** Days until the window shuts. Negative once it has. Null with no window. */
export function daysLeft(r: Returned, w: RegradeWindow, now: Date): number | null {
  const closes = closesOn(r, w);
  if (!closes) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((closes.getTime() - today.getTime()) / 86_400_000);
}

/** Whether there is still time to say something. */
export function stillOpen(r: Returned, w: RegradeWindow, now: Date): boolean {
  if (r.raised) return false;
  const left = daysLeft(r, w, now);
  return left !== null && left >= 0;
}

function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days';
}

/**
 * What the row says about the window.
 *
 * The no-window case is a sentence rather than a blank, because a blank reads
 * as "nothing to worry about" and the truth is "the app does not know".
 */
export function windowLine(r: Returned, w: RegradeWindow, now: Date): string {
  if (r.raised) return 'You have raised it.';
  const left = daysLeft(r, w, now);
  if (left === null) {
    return 'No window recorded for this course, so there is nothing to count down. It is in the syllabus.';
  }
  if (left < 0) {
    return `The window closed ${-left} ${dayWord(-left)} ago.`;
  }
  if (left === 0) return 'The window closes today.';
  if (left === 1) return 'The window closes tomorrow.';
  return `${left} ${dayWord(left)} left to raise it.`;
}

/** "Seven calendar days", for the setting to read back. */
export function windowSummary(w: RegradeWindow): string {
  if (w.days <= 0) return 'Not recorded.';
  return `${w.days} ${dayWord(w.days)}${w.business ? ', business days' : ''}.`;
}

/**
 * Everything whose window is open, closing soonest first.
 *
 * The order is the point: a window with one day left and a window with six are
 * not the same thing, and a list in the order work happened to come back
 * buries the urgent one.
 */
export function closing(
  all: Returned[],
  windowFor: (courseId: string) => RegradeWindow,
  now: Date,
): Returned[] {
  return all
    .filter((r) => stillOpen(r, windowFor(r.courseId), now))
    .sort((a, b) => {
      const la = daysLeft(a, windowFor(a.courseId), now) ?? 0;
      const lb = daysLeft(b, windowFor(b.courseId), now) ?? 0;
      return la - lb;
    });
}

/**
 * How much of the term's graded work has actually come back.
 *
 * A count, and a useful one at the moment somebody is trying to work out where
 * they stand: a projection built on two returned pieces out of eleven is not
 * wrong, but it is resting on very little, and this is the sentence that says
 * so.
 */
export function backLine(all: Returned[], gradedItems: number): string {
  if (gradedItems <= 0) return '';
  const n = all.length;
  if (n === 0) return 'Nothing marked has come back yet.';
  return `${n} of ${gradedItems} graded ${gradedItems === 1 ? 'piece' : 'pieces'} back so far.`;
}

/** A stored list made safe to render from. */
export function readReturned(raw: unknown): Returned[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Returned => Boolean(r) && typeof r === 'object' && typeof r.id === 'string')
    .map((r) => ({
      id: r.id,
      courseId: typeof r.courseId === 'string' ? r.courseId : '',
      at: typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : 0,
      score: typeof r.score === 'string' ? r.score : '',
      note: typeof r.note === 'string' ? r.note : '',
      raised: r.raised === true,
      mortem: readMortem((r as { mortem?: unknown }).mortem),
    }))
    // Newest back first, which is the order somebody looking at this expects.
    .sort((a, b) => b.at - a.at);
}

/** A stored map of per-course windows, made safe. */
export function readWindows(raw: unknown): Record<string, RegradeWindow> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, RegradeWindow> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const w = value as Partial<RegradeWindow>;
    if (!w || typeof w !== 'object') continue;
    out[id] = {
      days: typeof w.days === 'number' && w.days > 0 ? Math.min(90, Math.round(w.days)) : 0,
      business: w.business === true,
      note: typeof w.note === 'string' ? w.note : '',
    };
  }
  return out;
}
