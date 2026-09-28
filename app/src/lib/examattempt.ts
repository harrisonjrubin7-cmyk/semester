import { outstanding, type Answer, type Question } from './exam';
import { formatDate, formatTime } from './locale';

/**
 * The practice paper you were sitting, still there when you come back.
 *
 * Until this file, a paper lived in `useState` on the Exam screen: close the
 * tab, follow a link, let the phone put the browser to sleep, and twenty
 * questions' worth of answers were gone with no way to say so. Every other
 * long field in the app is a draft (`lib/draft.ts`); the paper was the one
 * piece of work a student types for half an hour that nothing kept.
 *
 * It is not a draft, though, and it is kept apart from them for two reasons.
 * A draft is one field's text; a paper is the questions, the answers, the
 * title, the seed it was drawn with and the moment it began — put back
 * without the questions, the answers are answers to nothing. And a draft ages
 * out over fourteen days of quiet, whereas a paper is over the moment
 * "Another paper" is pressed, and long before that it stops being worth
 * offering: nobody wants last month's half-finished paper put in front of
 * them, so it is kept for a week and then forgotten.
 *
 * Three rules, each a decision:
 *
 * **One paper at a time.** There is one slot, not a set. Beginning a paper
 * replaces whatever was there, because the only way to have two is to have
 * abandoned one, and an abandoned paper is not something to keep offering.
 *
 * **The clock is the wall clock.** `secondsLeft` is worked out from when the
 * paper began, not from how many ticks the screen counted. A paper closed
 * with twelve minutes left and reopened an hour later has none, which is what
 * a paper does; the screen already says "Time is up. Nothing has been taken
 * away from you", and it stays true.
 *
 * **Finishing is a fact, with a time.** `finishedAt` is set when Finish is
 * pressed, and the receipt says so. A practice paper has no marker to hand it
 * to, but "you finished this at 3:52, 14 of 20 answered" is still the line
 * that lets somebody trust the app held on to their work.
 */

export const ATTEMPT_KEY = 'semester.exam-attempt.v1';

/** A week. After this much quiet the paper is forgotten rather than offered. */
export const KEEP_MS = 7 * 86_400_000;

export interface Attempt {
  title: string;
  /** The course code the paper was set for; empty when none was. */
  course: string;
  /** The guide it was built from, so it is only offered back on that guide. */
  guideId: string;
  /** The seed it was drawn with, or null for a paper a model wrote. */
  seed: number | null;
  minutes: number;
  questions: Question[];
  answers: Record<string, Answer>;
  /** Milliseconds, when the paper began. */
  startedAt: number;
  /** Milliseconds, last written. */
  at: number;
  /** Milliseconds, when Finish was pressed. Absent while sitting. */
  finishedAt?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function readQuestion(v: unknown): Question | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== 'string' || typeof v.prompt !== 'string' || typeof v.answer !== 'string') return null;
  if (v.kind !== 'choice' && v.kind !== 'short' && v.kind !== 'long') return null;
  if (!Array.isArray(v.options) || !v.options.every((o) => typeof o === 'string')) return null;
  if (typeof v.points !== 'number' || !Number.isFinite(v.points)) return null;
  return {
    id: v.id,
    kind: v.kind,
    prompt: v.prompt,
    options: v.options,
    answer: v.answer,
    why: typeof v.why === 'string' ? v.why : '',
    points: v.points,
    ...(typeof v.from === 'string' && v.from ? { from: v.from } : {}),
  };
}

function readAnswer(v: unknown): Answer | null {
  if (!isRecord(v) || typeof v.given !== 'string') return null;
  const out: Answer = { given: v.given };
  if (v.mark === 'right' || v.mark === 'partly' || v.mark === 'wrong') out.mark = v.mark;
  if (v.flagged === true) out.flagged = true;
  return out;
}

/**
 * The kept paper, or null when there is none worth putting back.
 *
 * Anything malformed reads as nothing: a paper with a question missing is
 * not a paper with one fewer question, it is one whose numbering, marks and
 * key no longer agree, and offering that back is worse than offering nothing.
 */
export function readAttempt(raw: string | null, now: number): Attempt | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const p = parsed;
  if (typeof p.title !== 'string' || typeof p.guideId !== 'string') return null;
  if (typeof p.minutes !== 'number' || typeof p.startedAt !== 'number' || typeof p.at !== 'number') return null;
  if (!Array.isArray(p.questions) || p.questions.length === 0) return null;
  const questions: Question[] = [];
  for (const q of p.questions) {
    const read = readQuestion(q);
    if (!read) return null;
    questions.push(read);
  }
  const answers: Record<string, Answer> = {};
  if (isRecord(p.answers)) {
    for (const [id, a] of Object.entries(p.answers)) {
      const read = readAnswer(a);
      if (read) answers[id] = read;
    }
  }
  if (now - p.at > KEEP_MS) return null;
  return {
    title: p.title,
    course: typeof p.course === 'string' ? p.course : '',
    guideId: p.guideId,
    seed: typeof p.seed === 'number' && Number.isFinite(p.seed) ? p.seed : null,
    minutes: p.minutes,
    questions,
    answers,
    startedAt: p.startedAt,
    at: p.at,
    ...(typeof p.finishedAt === 'number' ? { finishedAt: p.finishedAt } : {}),
  };
}

/** A paper just begun. Answers empty, the clock started now. */
export function begun(
  a: Omit<Attempt, 'answers' | 'startedAt' | 'at' | 'finishedAt'>,
  now: number,
): Attempt {
  return { ...a, answers: {}, startedAt: now, at: now };
}

/** The same paper with the answers as they now stand. */
export function withAnswers(a: Attempt, answers: Record<string, Answer>, now: number): Attempt {
  return { ...a, answers, at: now };
}

/** The same paper, closed. Finishing twice keeps the first time. */
export function finished(a: Attempt, now: number): Attempt {
  return { ...a, at: now, finishedAt: a.finishedAt ?? now };
}

/**
 * How long the paper has left, by the wall clock, never below zero.
 *
 * A finished paper has nothing left to count; what it shows is its score.
 */
export function secondsLeft(a: Attempt, now: number): number {
  if (a.finishedAt !== undefined) return 0;
  const elapsed = Math.floor((now - a.startedAt) / 1000);
  return Math.max(0, a.minutes * 60 - elapsed);
}

/** How many of the questions have something written or chosen. */
export function answered(a: Attempt): number {
  return a.questions.length - outstanding(a.questions, a.answers).blank.length;
}

/**
 * The time, in the reader's own hours and their chosen locale.
 *
 * Through `lib/locale.ts` rather than written by hand: a clock assembled
 * from `% 12` reads "3:52 pm" to a German reader whose Settings say "15:52",
 * which is the fault the locale guard exists to catch.
 */
export function timeOf(ms: number): string {
  return formatTime(ms, { hour: 'numeric', minute: '2-digit' });
}

/** The day and month, with the year only when it was not this year. */
export function dayOf(ms: number, now: number): string {
  const thisYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return formatDate(ms, { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
}

const sameDay = (a: number, b: number) => {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

const when = (ms: number, now: number) => (sameDay(ms, now) ? `at ${timeOf(ms)}` : `on ${dayOf(ms, now)} at ${timeOf(ms)}`);

/**
 * What the offer to pick the paper up says.
 *
 * The count is the part that decides whether anybody wants it back: "2 of 20
 * answered" is a paper to start again, "17 of 20" is one to finish.
 */
export function offerLine(a: Attempt, now: number): string {
  const n = answered(a);
  const count = `${n} of ${a.questions.length} answered`;
  if (a.finishedAt !== undefined) return `Finished ${when(a.finishedAt, now)}, ${count}. The marking is still here.`;
  const left = secondsLeft(a, now);
  const clock = left === 0 ? 'time is up' : `${Math.ceil(left / 60)} min left`;
  return `Begun ${when(a.startedAt, now)}, ${count}, ${clock}.`;
}

/** Said once, when the paper has been put back on the screen. */
export function putBackLine(a: Attempt, now: number): string {
  if (a.finishedAt !== undefined) return `Put back as you finished it ${when(a.finishedAt, now)}.`;
  const left = secondsLeft(a, now);
  if (left === 0) return `Put back where you left it. The clock kept running while you were away, and it has run out.`;
  return `Put back where you left it, with ${Math.ceil(left / 60)} min still on the clock.`;
}

/**
 * The receipt, shown with the marks.
 *
 * It says what was kept and where, because a paper that was silently held
 * on to is indistinguishable from one that was not until the day it matters.
 */
export function receiptLine(a: Attempt, now: number): string {
  const at = a.finishedAt ?? now;
  return `Finished ${when(at, now)} — ${answered(a)} of ${a.questions.length} answered. Kept on this device until you start another paper.`;
}

/** Said under the paper while sitting it, so the autosave is visible. */
export const KEPT_LINE = 'Your answers are kept on this device as you go. Close the tab and this paper is still here.';

/**
 * Said instead when the device refused the write — storage off in a private
 * window, or full. The one thing worse than not keeping a paper is saying it
 * is kept: a student who reads KEPT_LINE closes the tab on that promise.
 */
export const NOT_KEPT_LINE =
  'This device is not keeping your answers — its storage is off or full. Finish in this tab, or copy what matters before you leave.';
