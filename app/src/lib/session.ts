/**
 * A clock you start when you sit down to work.
 *
 * `lib/pace.ts` already asks how long something took, once, at the moment you
 * tick it off — five buckets, one tap. That is the right question for work
 * that is already done, and it is a guess. This is the same number measured:
 * press start when you open the reading, press stop when you close it, and the
 * minutes go into the same `spent` record the buckets feed.
 *
 * The two are deliberately the same shape. `estimate` takes a median of
 * minutes and does not care where a figure came from, so a term with three
 * timed sessions and two tapped buckets produces a better estimate than either
 * alone — and the tick-box question stops being asked about anything already
 * timed, because it has its answer.
 *
 * ## It lives on this device only
 *
 * A running timer is not a fact about the student; it is a fact about the
 * thing in front of them. Syncing it would mean a laptop that has not been
 * opened since breakfast can push `no timer running` over a phone that is
 * mid-session, and the first anyone knows about it is that an hour of work
 * was not counted. So it is written to this device's localStorage and never
 * to the account. The *result* syncs — that is a completed measurement, and it
 * belongs to the student.
 *
 * ## What it refuses to record
 *
 * A timer left running overnight is the failure mode that would quietly ruin
 * every estimate the app makes, and it is not rare: closing a laptop is not
 * pressing stop. So a session past `LONGEST` is not silently recorded — it is
 * handed back marked, and the student says what it really was. A session under
 * `SHORTEST` is not work; it is having pressed the button by accident.
 */

/** A session in progress. */
export interface Sitting {
  /**
   * The deadline being worked on, or empty for work against a course in
   * general. An id is what lets `askAbout` stop asking about it later.
   */
  id: string;
  courseId: string;
  /** The item's kind as the syllabus words it; normalised when recorded. */
  kind: string;
  /** What it is called, for the running indicator to name it. */
  title: string;
  /** Epoch ms this run started, or 0 while paused. */
  since: number;
  /** Minutes already banked from earlier runs of the same session. */
  banked: number;
  /** Epoch ms the session was first started, for the ceiling check. */
  opened: number;
}

/**
 * Eight hours. Past this the app assumes the timer was left running rather
 * than that somebody worked eight unbroken hours on one problem set — and it
 * is the safer assumption in both directions, because being asked is a small
 * annoyance and a silent eight-hour median is a wrong app.
 */
export const LONGEST = 8 * 60;

/** Under two minutes it is a mis-tap, not a work session. */
export const SHORTEST = 2;

const KEY = 'semester.sitting.v1';

/** Minutes elapsed: what was banked, plus the run that is going now. */
export function elapsed(s: Sitting, now: number): number {
  const running = s.since > 0 ? Math.max(0, now - s.since) / 60_000 : 0;
  return Math.floor(s.banked + running);
}

export function running(s: Sitting | null): boolean {
  return Boolean(s && s.since > 0);
}

export function begin(
  what: { id: string; courseId: string; kind: string; title: string },
  now: number,
): Sitting {
  return { ...what, since: now, banked: 0, opened: now };
}

export function hold(s: Sitting, now: number): Sitting {
  if (s.since === 0) return s;
  return { ...s, banked: s.banked + Math.max(0, now - s.since) / 60_000, since: 0 };
}

export function carryOn(s: Sitting, now: number): Sitting {
  return s.since > 0 ? s : { ...s, since: now };
}

export interface Finished {
  minutes: number;
  /**
   * Ran past the ceiling. The minutes are still handed back — the caller shows
   * them and asks — but they are not fit to record as they stand.
   */
  tooLong: boolean;
  /** Under the floor. Nothing worth recording happened. */
  tooShort: boolean;
}

export function finish(s: Sitting, now: number): Finished {
  const minutes = elapsed(hold(s, now), now);
  return { minutes, tooLong: minutes > LONGEST, tooShort: minutes < SHORTEST };
}

/**
 * Whether a session looks abandoned rather than paused.
 *
 * A paused timer can sit for days quite legitimately. A *running* one past the
 * ceiling means the phone went in a pocket, and the indicator says so instead
 * of counting up to eleven hours as though that were an achievement.
 */
export function abandoned(s: Sitting | null, now: number): boolean {
  return Boolean(s && s.since > 0 && elapsed(s, now) > LONGEST);
}

/** "1 h 13 min", "47 min", "0 min". */
export function clockLine(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

// ── This device's copy ────────────────────────────────────────────────────

function sane(value: unknown): Sitting | null {
  const s = value as Partial<Sitting> | null;
  if (!s || typeof s !== 'object') return null;
  if (typeof s.courseId !== 'string' || !s.courseId) return null;
  if (typeof s.since !== 'number' || typeof s.banked !== 'number') return null;
  // A negative or non-finite figure would come out of a hand-edited store or a
  // clock that moved backwards, and either would poison every later median.
  if (!Number.isFinite(s.since) || !Number.isFinite(s.banked) || s.banked < 0) return null;
  return {
    id: typeof s.id === 'string' ? s.id : '',
    courseId: s.courseId,
    kind: typeof s.kind === 'string' ? s.kind : '',
    title: typeof s.title === 'string' ? s.title : '',
    since: s.since,
    banked: s.banked,
    opened: typeof s.opened === 'number' && Number.isFinite(s.opened) ? s.opened : Date.now(),
  };
}

export function readSitting(): Sitting | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sane(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeSitting(s: Sitting | null): void {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // A full or disabled store costs the timer, not the app. The session in
    // memory keeps running; it just will not survive a reload.
  }
}
