/**
 * Course Outcome Scenarios: what a course could finish at if the work still to
 * come averages a number the student picks.
 *
 * It is a planning tool, never a grade source, so three things are fixed here
 * rather than left to whoever renders it:
 *
 * - The caution sentence travels with every result (`CAUTION`).
 * - It refuses, rather than computing anyway, when the weights do not add to
 *   100, when nothing has been scored yet, or when nothing is left to play for.
 *   `needCaveat` in `grades.ts` warns and carries on; a scenario is a
 *   forecast, and a forecast on the wrong denominator is worse than none.
 * - It returns numbers and words only. No colour, no "at risk", no standing:
 *   the screen cannot paint a scenario red because nothing here says which
 *   scenario is bad.
 *
 * The arithmetic is `standing`'s own (`earned`, `remaining`, `extraCredit`,
 * `pointsOff`), so a scenario and the grade screen cannot disagree.
 */

import { needFor, type Standing } from './grades';

/** The scenarios offered by default: a low, a middling and a strong stretch. */
export const DEFAULT_AVERAGES = [75, 85, 92] as const;

export const CAUTION =
  'This is a planning estimate, not an official course grade. Semester uses the grading weights and scores available here. It may not know about a curve, unpublished adjustments, instructor discretion, future course policy changes, incomplete scores, or rules not represented in the source. Check the official course gradebook or ask your instructor for official guidance.';

export type Refusal = 'weights_incomplete' | 'nothing_scored' | 'nothing_left';

export const REFUSAL_TEXT: Record<Refusal, string> = {
  weights_incomplete:
    'The grading weights for this course do not add up to 100%, so any estimate would be built on the wrong total. Fix the weights first.',
  nothing_scored: 'No scores are posted yet, so there is nothing to build a scenario on.',
  nothing_left: 'Every weighted category already has a score, so there is no remaining work to estimate.',
};

export interface ScenarioRow {
  /** What the remaining work is assumed to average, 0–100. */
  average: number;
  /** The estimated course outcome, to one decimal place. */
  outcome: number;
}

export type Scenarios =
  | { ok: false; refusal: Refusal; text: string }
  | {
      ok: true;
      /** Share of the weighted work that has a posted score, whole percent. */
      confirmedShare: number;
      /** The weighted result of posted work alone, or null. */
      confirmed: number | null;
      rows: ScenarioRow[];
      caution: string;
    };

const round1 = (n: number) => Math.round(n * 10) / 10;

function refuse(refusal: Refusal): Scenarios {
  return { ok: false, refusal, text: REFUSAL_TEXT[refusal] };
}

/** The outcome if everything remaining averaged `average`. */
export function outcomeAt(s: Standing, average: number): number {
  const a = Math.min(100, Math.max(0, average));
  return Math.max(0, s.earned + (s.remaining * a) / 100 + s.extraCredit - s.pointsOff);
}

export function scenarios(s: Standing, averages: readonly number[] = DEFAULT_AVERAGES): Scenarios {
  if (s.incomplete) return refuse('weights_incomplete');
  if (s.counted <= 0 || s.current === null) return refuse('nothing_scored');
  if (s.remaining <= 0) return refuse('nothing_left');
  const total = s.counted + s.remaining;
  return {
    ok: true,
    confirmedShare: Math.round((s.counted / total) * 100),
    confirmed: round1(s.current),
    rows: averages.map((average) => ({ average, outcome: round1(outcomeAt(s, average)) })),
    caution: CAUTION,
  };
}

/**
 * "What would I need to reach X?" Same refusals as `scenarios`; otherwise the
 * average the remaining work must reach, which can exceed 100 and is then
 * said plainly rather than clipped.
 */
export function requiredFor(
  s: Standing,
  target: number,
): { ok: false; refusal: Refusal; text: string } | { ok: true; required: number; line: string } {
  const base = scenarios(s, []);
  if (!base.ok) return base;
  const need = needFor(s, target);
  if (need === null) return refuse('nothing_left') as { ok: false; refusal: Refusal; text: string };
  const required = Math.max(0, Math.round(need));
  const left = Math.round(s.remaining);
  const line =
    need > 100
      ? `To reach an estimated ${target}% outcome you would need more than 100% on the remaining ${left}% of the course, which these weights do not allow.`
      : `To reach an estimated ${target}% outcome you would need approximately ${required}% on the remaining ${left}% of the course, if the current weights and posted scores are complete and unchanged.`;
  return { ok: true, required, line };
}
