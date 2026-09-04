/**
 * Timers and alarms — the ordinary kind, for anything.
 *
 * The app already had a work-session clock (`lib/session.ts`), and it is the
 * wrong instrument for most of what a day asks for. That one exists to measure
 * how long a piece of coursework took, so it counts up, it belongs to an
 * assignment, and what it records goes into `lib/pace.ts`. None of that is what
 * somebody wants when the answer is "ten minutes for the pasta", "twenty before
 * I have to leave", or "wake me at 6:40".
 *
 * So: a countdown that belongs to nothing, and an alarm that rings at a time.
 *
 * ## What it can honestly promise
 *
 * It rings while the app is open. A web page cannot wake a sleeping phone, and
 * this file will not pretend otherwise — the screen says so where the alarm is
 * set, rather than letting somebody find out by missing a lecture. A permitted
 * notification survives the tab being in the background, which is the most that
 * can be offered, and it is offered rather than assumed.
 *
 * ## The end time, not the seconds left
 *
 * A timer stores when it will fire, not how much is left. Storing the
 * remainder means something has to decrement it, and anything that decrements
 * loses time whenever the tab is backgrounded, the laptop sleeps or a render
 * is skipped — the classic bug where a twenty-minute timer takes
 * twenty-three. From an end time the remainder is arithmetic against the
 * clock, right on the first frame after a phone wakes up. A paused timer is
 * the one case that has to store a remainder, because it has no end time yet.
 *
 * ## Written the way people say it
 *
 * "25", "1:30", "90s", "1h20", "2 hours 5 minutes" — `readDuration` takes the
 * lot, because a field that only accepts one of those is a field somebody has
 * to think about, and the whole point of a timer is not thinking about it. It
 * wants a digit somewhere: "an hour" is refused rather than guessed at, and
 * refusing is visible where a wrong guess is not.
 */

/** A countdown. */
export interface Timer {
  id: string;
  /** What it is for. Optional — most timers are just a number. */
  label: string;
  /** What was asked for, so Reset has something to go back to. */
  seconds: number;
  /** Epoch ms it fires at. Null while paused. */
  endsAt: number | null;
  /** Seconds left, kept only while paused. */
  left: number;
  /** Epoch ms it started ringing, so a ring can be seen and silenced. */
  rangAt: number | null;
  created: number;
}

/** A time of day it goes off. */
export interface Alarm {
  id: string;
  label: string;
  /** Minutes past midnight. */
  at: number;
  /** Weekdays it repeats on, 0 = Sunday. Empty means the next one only. */
  days: number[];
  on: boolean;
  /** `YYYY-MM-DD` it last rang, so a repeat rings once a day, not every minute. */
  lastRang: string;
  /**
   * Epoch ms it started ringing; 0 when it is not.
   *
   * Without this an alarm was only going off during its own minute, so being
   * on another tab for ninety seconds meant missing it entirely — which is the
   * one thing an alarm may not do. Now the minute *starts* the ringing and
   * only Stop ends it.
   */
  ringingAt: number;
  created: number;
}

/**
 * How long an alarm goes on ringing with nobody there.
 *
 * It has to end somewhere: `ringingAt` is saved, so an alarm that fired into
 * an empty room would otherwise still be on the screen when the laptop is
 * opened at dinner, claiming to be this morning's. Ten minutes is long enough
 * to come back from the shower and short enough that a stale one is obviously
 * stale.
 */
export const RINGS_FOR = 10 * 60 * 1000;

/** Longest countdown worth offering. Beyond a day it is an alarm, not a timer. */
export const LONGEST = 24 * 60 * 60;

/** Shortest. A five-second timer is a misread field, not an intention. */
export const SHORTEST = 10;

/** The ones people actually set, in minutes. */
export const PRESETS = [5, 10, 15, 20, 25, 45, 60];

/**
 * How long, from however it was written.
 *
 * Returns null for anything it cannot read, rather than a zero that would
 * start a timer that fires immediately.
 *
 * A bare number is minutes, because that is what a bare number means when
 * somebody is setting a timer — "25" is twenty-five minutes and has never once
 * meant twenty-five seconds.
 */
export function readDuration(text: string): number | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;

  // "1:30" is a minute and a half; "1:02:30" is an hour and a bit. Same
  // reading as a stopwatch, smallest unit last.
  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(s)) {
    const parts = s.split(':').map(Number);
    const [h, m, sec] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
    if (m > 59 || sec > 59) return null;
    return clampDuration(h * 3600 + m * 60 + sec);
  }

  // "1h20", "90 min", "2 hours 5 minutes", "45s".
  const units = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)?/g)];
  let total = 0;
  let read = false;
  for (const [, n, unit] of units) {
    if (n === undefined) continue;
    const value = Number(n);
    if (!Number.isFinite(value)) continue;
    read = true;
    // No unit means minutes — see above.
    const scale = unit?.startsWith('h') ? 3600 : unit?.startsWith('s') ? 1 : 60;
    total += value * scale;
  }
  if (!read) return null;
  return clampDuration(Math.round(total));
}

function clampDuration(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(LONGEST, Math.max(SHORTEST, Math.round(seconds)));
}

/** "25:00", "1:05:00", "0:09". Always at least mm:ss, the way a clock reads. */
export function clockFace(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** How long it is for, said rather than counted: "25 minutes", "1h 20m". */
export function lengthLine(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${h}h ${rest}m`;
}

export function newTimer(label: string, seconds: number, at: number): Timer {
  return {
    id: `t${at}${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim(),
    seconds,
    endsAt: at + seconds * 1000,
    left: seconds,
    rangAt: null,
    created: at,
  };
}

/**
 * Seconds left, from the clock rather than from a counter.
 *
 * Never negative: an overdue timer has zero left and is `ringing`, which is a
 * different question.
 */
export function remaining(t: Timer, at: number): number {
  if (t.endsAt === null) return Math.max(0, Math.round(t.left));
  return Math.max(0, Math.round((t.endsAt - at) / 1000));
}

export function running(t: Timer): boolean {
  return t.endsAt !== null;
}

/** Whether it has reached zero and has not been silenced. */
export function ringing(t: Timer, at: number): boolean {
  return t.endsAt !== null && at >= t.endsAt;
}

export function pause(t: Timer, at: number): Timer {
  if (t.endsAt === null) return t;
  return { ...t, left: remaining(t, at), endsAt: null };
}

export function resume(t: Timer, at: number): Timer {
  if (t.endsAt !== null || t.left <= 0) return t;
  return { ...t, endsAt: at + t.left * 1000 };
}

/** Back to what was asked for, stopped. Reset does not restart it. */
export function reset(t: Timer): Timer {
  return { ...t, endsAt: null, left: t.seconds, rangAt: null };
}

/** Silence a ring. The timer stays, at zero, so it can be reset and reused. */
export function silence(t: Timer): Timer {
  return { ...t, endsAt: null, left: 0, rangAt: null };
}

/** Add a minute without losing the rest, which is the commonest correction. */
export function stretch(t: Timer, seconds: number, at: number): Timer {
  const left = remaining(t, at) + seconds;
  if (left <= 0) return t;
  const capped = Math.min(LONGEST, left);
  return t.endsAt === null
    ? { ...t, left: capped, seconds: Math.max(t.seconds, capped) }
    : { ...t, endsAt: at + capped * 1000, seconds: Math.max(t.seconds, capped) };
}

export function newAlarm(label: string, at: number, days: number[], created: number): Alarm {
  return {
    id: `a${created}${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim(),
    at: Math.max(0, Math.min(24 * 60 - 1, Math.round(at))),
    days: [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort(),
    on: true,
    lastRang: '',
    ringingAt: 0,
    created,
  };
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * When it next goes off, or null if it is off.
 *
 * A repeat looks forward for the next listed weekday; a one-off is today if
 * the time has not passed and tomorrow if it has. Both skip a day it has
 * already rung on, so silencing an alarm at 6:40 does not have it ring again
 * at 6:41.
 */
export function nextRing(a: Alarm, now: Date): Date | null {
  if (!a.on) return null;
  for (let ahead = 0; ahead <= 7; ahead++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    if (a.days.length > 0 && !a.days.includes(day.getDay())) continue;
    if (isoOf(day) === a.lastRang) continue;
    const when = new Date(day);
    when.setHours(Math.floor(a.at / 60), a.at % 60, 0, 0);
    if (when.getTime() > now.getTime()) return when;
  }
  return null;
}

/**
 * Whether its moment has just arrived — the trigger, not the ringing.
 *
 * A one-minute window, because a tab opened at lunchtime should not fire the
 * 7am alarm it slept through: that is a missed alarm, and pretending otherwise
 * is worse than silence. The ringing that follows is not limited to the minute
 * — see `startRing` and `stillRinging`.
 */
export function alarmDue(a: Alarm, now: Date): boolean {
  if (!a.on) return false;
  if (a.ringingAt > 0) return false;
  const today = isoOf(now);
  if (a.lastRang === today) return false;
  if (a.days.length > 0 && !a.days.includes(now.getDay())) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= a.at && minutes < a.at + 1;
}

/** Start it ringing. It keeps ringing until stopped, or until it gives up. */
export function startRing(a: Alarm, now: Date): Alarm {
  return { ...a, ringingAt: now.getTime() };
}

/** Whether it is going off right now — the state Stop ends. */
export function stillRinging(a: Alarm, now: Date): boolean {
  return a.ringingAt > 0 && now.getTime() - a.ringingAt < RINGS_FOR;
}

/** Rang into an empty room and gave up. Wants clearing, not showing. */
export function gaveUp(a: Alarm, now: Date): boolean {
  return a.ringingAt > 0 && now.getTime() - a.ringingAt >= RINGS_FOR;
}

/** "6:40 AM". */
export function timeLine(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Weekdays", "Every day", "Mon, Wed, Fri", "Once". */
export function daysLine(days: number[]): string {
  if (days.length === 0) return 'Once';
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return [...set].sort().map((d) => DAY_NAMES[d]).join(', ');
}

/** "In 7 hours", "In 12 minutes", "Tomorrow, 6:40 AM". */
export function untilLine(a: Alarm, now: Date): string {
  // Said first: an alarm going off right now should not have its row quietly
  // announcing when it will next go off.
  if (stillRinging(a, now)) return 'Ringing';
  const next = nextRing(a, now);
  if (!next) return a.on ? 'Not set to ring again' : 'Off';
  const mins = Math.round((next.getTime() - now.getTime()) / 60000);
  if (mins < 1) return 'Any moment';
  if (mins < 60) return `In ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  if (next.getDate() === now.getDate() && next.getMonth() === now.getMonth()) {
    const h = Math.round(mins / 60);
    return `In about ${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const when = timeLine(a.at);
  if (isoOf(next) === isoOf(tomorrow)) return `Tomorrow, ${when}`;
  return `${DAY_NAMES[next.getDay()]}, ${when}`;
}

/** Stop it: rung for today, silent, and off if it was only ever for once. */
export function rang(a: Alarm, now: Date): Alarm {
  return { ...a, lastRang: isoOf(now), ringingAt: 0, on: a.days.length > 0 ? a.on : false };
}

/**
 * What is going off, timers before alarms.
 *
 * One list, because the screen showing it does not care which kind woke it —
 * it has to be dismissed either way.
 */
export function whatIsRinging(
  timers: Timer[],
  alarms: Alarm[],
  now: Date,
): { timers: Timer[]; alarms: Alarm[] } {
  const at = now.getTime();
  return {
    timers: timers.filter((t) => ringing(t, at)),
    alarms: alarms.filter((a) => stillRinging(a, now)),
  };
}
