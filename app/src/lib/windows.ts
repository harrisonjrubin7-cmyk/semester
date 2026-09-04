/**
 * When you are actually good for work.
 *
 * The hour arithmetic started from sixteen waking hours a day and treated them
 * as interchangeable. They are not. A nine o'clock class after a closing shift
 * is not the same hour as a Sunday afternoon, and an app that says you have
 * eleven free hours on a day you will spend three of them recovering is
 * quietly lying to you — in the direction that makes you plan work you will
 * not do.
 *
 * ## Two or three windows, set once
 *
 * Not a productivity questionnaire and not a chronotype. Two or three spans a
 * week, each with the days it runs on: "weekday evenings, 7 to 11", "Sunday
 * afternoons, 1 to 6". Somebody can set this in a minute and never touch it
 * again, and it makes every hour figure in the app true rather than nominal.
 *
 * ## What it does not do
 *
 * It does not schedule anything into a window, and it does not tell you to
 * work in one. It is an answer to "how many hours are actually there", which
 * the app was previously guessing at with a constant. The default, for
 * somebody who never sets one, is the same sixteen-hour day it always used —
 * stated as a default rather than as a fact.
 */

export interface Window {
  id: string;
  /** "Weekday evenings". Yours, and shown as you wrote it. */
  label: string;
  /** Days of the week it runs on, 0 = Sunday. */
  days: number[];
  /** Minutes past midnight. */
  from: number;
  to: number;
}

/** The day is sixteen waking hours when nobody has said otherwise. */
export const WAKING_HOURS = 16;

/**
 * Offered on the setup screen, because a blank "add a window" is a worse
 * question than three plausible answers to pick from and adjust.
 */
export const SUGGESTED: Omit<Window, 'id'>[] = [
  { label: 'Weekday evenings', days: [1, 2, 3, 4], from: 19 * 60, to: 23 * 60 },
  { label: 'Weekday mornings', days: [1, 2, 3, 4, 5], from: 8 * 60, to: 11 * 60 },
  { label: 'Sunday afternoon', days: [0], from: 13 * 60, to: 18 * 60 },
  { label: 'Saturday morning', days: [6], from: 9 * 60, to: 13 * 60 },
];

function span(w: Window): number {
  return Math.max(0, w.to - w.from);
}

/** Hours a window offers on one day of the week. Zero on days it does not run. */
export function hoursOn(windows: Window[], day: number): number {
  const minutes = windows
    .filter((w) => w.days.includes(day))
    .reduce((n, w) => n + span(w), 0);
  return Math.round((minutes / 60) * 10) / 10;
}

/** Hours a week, across every window. */
export function hoursAWeek(windows: Window[]): number {
  let minutes = 0;
  for (const w of windows) minutes += span(w) * w.days.length;
  return Math.round((minutes / 60) * 10) / 10;
}

/**
 * How much of a day is genuinely available, given what is already promised.
 *
 * Where windows are set, a day offers what its windows offer less anything
 * already standing inside them — but never less than zero, and never more
 * than the windows themselves. Where none are set the old behaviour stands:
 * sixteen hours less what is promised.
 *
 * The overlap is deliberately approximate. Knowing that a shift eats three of
 * your four evening hours needs the shift's start and end against the window's,
 * and most of what fills a student's day is stored as a start with no end. So
 * this subtracts promised hours from window hours on the same day and stops
 * there — which is right whenever the promise falls inside the window, and
 * pessimistic rather than optimistic when it does not. Pessimistic is the
 * safe direction for a figure somebody plans against.
 */
export function freeOn(windows: Window[], day: number, promised: number): number {
  if (windows.length === 0) return Math.max(0, WAKING_HOURS - promised);
  return Math.round(Math.max(0, hoursOn(windows, day) - promised) * 10) / 10;
}

export interface WeekShape {
  /** Hours actually available across the week. */
  free: number;
  /** The most a week could offer before anything was promised. */
  offered: number;
  /** Whether the figure rests on windows or on the sixteen-hour default. */
  fromWindows: boolean;
}

/** A week's worth, given each day's promised hours in order from Sunday. */
export function weekShape(windows: Window[], promisedByDay: number[]): WeekShape {
  const free = promisedByDay.reduce((n, promised, day) => n + freeOn(windows, day, promised), 0);
  return {
    free: Math.round(free * 10) / 10,
    offered: windows.length > 0 ? hoursAWeek(windows) : WAKING_HOURS * 7,
    fromWindows: windows.length > 0,
  };
}

/**
 * The sentence that goes under the figure.
 *
 * Says which of the two it is, because "38 hours" means something different
 * when it came from windows you set than when it came from a constant — and
 * the app has no business presenting the second as though it were the first.
 */
export function basisLine(shape: WeekShape): string {
  if (!shape.fromWindows) {
    return 'Sixteen waking hours a day, which is a default rather than a fact — set the hours you actually work and every figure here gets truer.';
  }
  return `From the hours you said you work: ${shape.offered} a week before anything is promised.`;
}

/** "Mon–Thu" and "Sun" — the days a window runs, said briefly. */
export function daysLine(days: number[]): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return 'no days';
  if (sorted.length === 7) return 'Every day';

  // Runs of consecutive days read as a range. Sunday is day 0 and Saturday is
  // day 6, so a weekend run is two pieces rather than one; naming them
  // separately is clearer than pretending the week wraps.
  const runs: number[][] = [];
  for (const d of sorted) {
    const last = runs[runs.length - 1];
    if (last && d === last[last.length - 1] + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((run) => (run.length > 1 ? `${names[run[0]]}–${names[run[run.length - 1]]}` : names[run[0]]))
    .join(', ');
}

/** "7:00p – 11:00p". */
export function spanLine(w: Window): string {
  const clock = (m: number) => {
    const h = Math.floor(m / 60);
    const mins = String(m % 60).padStart(2, '0');
    const suffix = h >= 12 ? 'p' : 'a';
    const twelve = h % 12 === 0 ? 12 : h % 12;
    return `${twelve}:${mins}${suffix}`;
  };
  return `${clock(w.from)} – ${clock(w.to)}`;
}

/** A window with the obvious things wrong with it fixed, or null if it is unusable. */
export function tidy(w: Window): Window | null {
  const days = [...new Set(w.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) return null;
  const from = Math.max(0, Math.min(24 * 60, w.from));
  const to = Math.max(0, Math.min(24 * 60, w.to));
  if (to <= from) return null;
  return { ...w, days, from, to };
}
