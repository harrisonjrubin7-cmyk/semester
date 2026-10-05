import { finite, obj } from './device-library';

/**
 * "Did this help you understand what to do next?"
 *
 * The pilot's one survey question (`docs/PRODUCT-ROADMAP.md`, north star), asked
 * on Today under the Action Center — the screen whose job it is to answer it.
 *
 * Answers stay on this device. `ANALYTICS.md` promises exactly three server
 * marks and D-005 keeps it that way: a fourth, if the owner wants the answer
 * counted, arrives with its question written into that file and a migration
 * widening the check constraint, in its own PR. Until then the student can
 * choose to send a note through the existing feedback form, which they see
 * before it goes.
 *
 * Asked at most once a week, and "Not now" puts it away for a week too: a
 * question asked every visit stops being a question.
 */

export const CLARITY_PREFIX = 'semester.clarity.v1';
export const CLARITY_ANSWERS = ['yes', 'somewhat', 'no'] as const;
export type ClarityAnswer = (typeof CLARITY_ANSWERS)[number];
export const CLARITY_TEXT: Record<ClarityAnswer, string> = { yes: 'Yes', somewhat: 'Somewhat', no: 'No' };
export const ASK_EVERY_DAYS = 7;
export const KEEP_ANSWERS = 52;

export interface ClarityStore {
  version: 1;
  answers: { at: number; answer: ClarityAnswer }[];
  /** "Not now" until this time. */
  quietUntil: number | null;
}

export const EMPTY_CLARITY: ClarityStore = { version: 1, answers: [], quietUntil: null };

const DAY = 86_400_000;
const isAnswer = (v: unknown): v is ClarityAnswer =>
  typeof v === 'string' && (CLARITY_ANSWERS as readonly string[]).includes(v);

export function readClarity(value: unknown): ClarityStore {
  if (!obj(value) || value.version !== 1) throw new Error('Not a clarity store.');
  const answers = Array.isArray(value.answers)
    ? value.answers
        .filter((a): a is { at: number; answer: ClarityAnswer } => obj(a) && finite(a.at, 0, Number.MAX_SAFE_INTEGER) && isAnswer(a.answer))
        .map((a) => ({ at: a.at, answer: a.answer }))
        .slice(-KEEP_ANSWERS)
    : [];
  return {
    version: 1,
    answers,
    quietUntil: finite(value.quietUntil, 0, Number.MAX_SAFE_INTEGER) ? value.quietUntil : null,
  };
}

/** Whether to ask now: not answered this week, and not put away. */
export function shouldAsk(s: ClarityStore, now: number): boolean {
  if (s.quietUntil !== null && s.quietUntil > now) return false;
  const last = s.answers.at(-1);
  return !last || now - last.at >= ASK_EVERY_DAYS * DAY;
}

export function answer(s: ClarityStore, a: ClarityAnswer, now: number): ClarityStore {
  return { ...s, answers: [...s.answers, { at: now, answer: a }].slice(-KEEP_ANSWERS), quietUntil: null };
}

export function notNow(s: ClarityStore, now: number): ClarityStore {
  return { ...s, quietUntil: now + ASK_EVERY_DAYS * DAY };
}

/** The student's own answers, counted — what they can see, and all there is. */
export function tally(s: ClarityStore): Record<ClarityAnswer, number> {
  const out: Record<ClarityAnswer, number> = { yes: 0, somewhat: 0, no: 0 };
  for (const a of s.answers) out[a.answer] += 1;
  return out;
}

