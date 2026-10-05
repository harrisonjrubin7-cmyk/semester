import { obj, textValue } from './device-library';

/**
 * What a student has said about a quiz question, and the only thing that
 * decides whether it is asked again.
 *
 * A quiz here is built from the course's own cards (`lib/quiz.ts`), and a card
 * can be wrong: a prepared guide with a typo in an answer, a card harvested
 * from a lecture that misheard it. A student who sees one had no way to say
 * so, and the same question — or its wrong answer, borrowed as a decoy for a
 * different one — came round again next run.
 *
 * Kept on this device and nowhere else. A report here is a note to yourself
 * and a filter on your own quizzes; nothing is sent to anybody, which is why
 * saying "this is wrong" costs one tap and no confirmation. Every report can
 * be taken back, and taking it back is the only way a card returns.
 */

export const QUIZ_FEEDBACK_PREFIX = 'semester.quizfeedback.v1';

export const quizFeedbackKey = (accountId: string | undefined) => `${QUIZ_FEEDBACK_PREFIX}:${accountId || 'device'}`;

export const QUIZ_REASONS = [
  ['answer', 'The marked answer is wrong'],
  ['two', 'More than one answer is right'],
  ['unclear', 'The question is unclear'],
  ['known', 'I know this — stop asking it'],
] as const;

export type QuizReason = (typeof QUIZ_REASONS)[number][0];

export const REASON_TEXT: Record<QuizReason, string> = Object.fromEntries(QUIZ_REASONS) as Record<QuizReason, string>;

export interface QuizReport {
  /** The card's review key, `cardIdentity(courseId, card)`. */
  key: string;
  courseId: string;
  /** The question as it was asked, so the list of reports can be read. */
  q: string;
  reason: QuizReason;
  at: number;
}

export interface QuizFeedback {
  reports: QuizReport[];
}

export const EMPTY_QUIZ_FEEDBACK: QuizFeedback = { reports: [] };

/** Enough for every card in a heavy term, and a ceiling on a hand-edited file. */
const MOST = 2000;
const reasons = new Set<string>(QUIZ_REASONS.map(([id]) => id));

/** Validated on every read: a report that does not parse is dropped, not guessed at. */
export function readQuizFeedback(value: unknown): QuizFeedback {
  if (!obj(value) || !Array.isArray(value.reports)) return EMPTY_QUIZ_FEEDBACK;
  const reports: QuizReport[] = [];
  const seen = new Set<string>();
  for (const r of value.reports.slice(0, MOST)) {
    if (!obj(r)) continue;
    if (!textValue(r.key, 400) || !r.key || seen.has(r.key)) continue;
    if (!textValue(r.courseId, 200) || !textValue(r.q, 600)) continue;
    if (typeof r.reason !== 'string' || !reasons.has(r.reason)) continue;
    if (typeof r.at !== 'number' || !Number.isFinite(r.at) || r.at < 0) continue;
    seen.add(r.key);
    reports.push({ key: r.key, courseId: r.courseId, q: r.q, reason: r.reason as QuizReason, at: r.at });
  }
  return { reports };
}

/** Say something about a question. A second report on the same card replaces the first. */
export function report(feedback: QuizFeedback, r: QuizReport): QuizFeedback {
  return { reports: [...feedback.reports.filter((x) => x.key !== r.key), { ...r, q: r.q.slice(0, 600) }] };
}

/** Take a report back, which is what brings the card back into quizzes. */
export function withdraw(feedback: QuizFeedback, key: string): QuizFeedback {
  return { reports: feedback.reports.filter((x) => x.key !== key) };
}

/**
 * The cards this student has asked to be left out, for one course.
 *
 * Every reason leaves the card out, and out as a decoy as well as a question:
 * an answer reported wrong is still wrong when it is offered as the wrong
 * option to something else, and a card reported unclear is not made clear by
 * appearing beside another question.
 */
export function leftOut(feedback: QuizFeedback, courseId: string): Set<string> {
  return new Set(feedback.reports.filter((r) => r.courseId === courseId).map((r) => r.key));
}

export function reportFor(feedback: QuizFeedback, key: string): QuizReport | undefined {
  return feedback.reports.find((r) => r.key === key);
}
