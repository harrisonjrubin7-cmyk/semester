/**
 * How heavy a term is, worked out the same way every time.
 *
 * Deterministic on purpose (full-beta rule 12): the same credits and the same
 * entries give the same sentences, with no model in the loop. It answers three
 * plain questions about a plan the student built:
 *
 * 1. **Is the credit total inside the limits they entered?** A school's minimum
 *    for full-time and its maximum without approval are the school's, and
 *    Semester does not know them. The student types them, and every sentence
 *    that uses them says whose numbers they are.
 * 2. **Does it match the load they meant to take?** (`creditTarget`, as before.)
 * 3. **Roughly how many hours a week would this ask of them, and do they have
 *    that?** Credits times an hours-per-credit assumption, against the study
 *    hours a week the student says they have left after work and travel.
 *
 * ## What this is not
 *
 * It is not a credit check, a degree audit or a registration rule, and no
 * sentence here says a load is "allowed" or "not allowed". It never blocks
 * anything. The hours are an estimate from one stated assumption (below), and
 * the assumption is shown next to the number so it can be disagreed with.
 */

/** Study hours a week outside class per credit hour. A common planning rule of thumb, not any school's rule. */
export const HOURS_PER_CREDIT = 2;

export interface TermLoadInput {
  /** Credits in the plan now. */
  credits: number;
  /** The load the student means to take, if they said. */
  target?: number | null;
  /** The minimum the student says their school asks of a full-time term. */
  min?: number | null;
  /** The most the student says their school allows without approval. */
  max?: number | null;
  /** Hours a week the student says they can study once work and travel are out. */
  studyHours?: number | null;
  /** Override for the assumption; the default is {@link HOURS_PER_CREDIT}. */
  hoursPerCredit?: number;
}

export type LoadFlag = 'under-min' | 'over-max' | 'off-target' | 'over-capacity' | 'tight' | 'fits';

export interface TermLoad {
  credits: number;
  /** Hours a week this many credits asks for, on the stated assumption. */
  estimatedHours: number;
  flags: LoadFlag[];
  /** One sentence each, in the order a student would read them. */
  lines: string[];
  /** The assumption behind the hours, in words. */
  assumption: string;
  /** Anything that could not be checked because the student has not said. */
  missing: string[];
}

const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const plural = (v: number, w: string) => `${n(v)} ${w}${v === 1 ? '' : 's'}`;

export function termLoad(input: TermLoadInput): TermLoad {
  const per = input.hoursPerCredit && input.hoursPerCredit > 0 ? input.hoursPerCredit : HOURS_PER_CREDIT;
  const credits = Math.max(0, Number.isFinite(input.credits) ? input.credits : 0);
  const estimatedHours = Math.round(credits * per * 10) / 10;
  const flags: LoadFlag[] = [];
  const lines: string[] = [];
  const missing: string[] = [];
  const assumption = `${n(per)} hours a week outside class for each credit — a common planning rule, not your school's.`;

  if (credits === 0) {
    lines.push('Nothing is in the plan yet, so there is no load to estimate.');
    return { credits, estimatedHours, flags, lines, assumption, missing };
  }

  lines.push(`${plural(credits, 'credit')} in the plan.`);

  if (typeof input.min === 'number' && credits < input.min) {
    flags.push('under-min');
    lines.push(`That is ${plural(input.min - credits, 'credit')} under the ${n(input.min)}-credit minimum you entered.`);
  }
  if (typeof input.max === 'number' && credits > input.max) {
    flags.push('over-max');
    lines.push(`That is ${plural(credits - input.max, 'credit')} over the ${n(input.max)}-credit maximum you entered; your school may need approval for that.`);
  }
  if (input.min == null && input.max == null) missing.push('your school’s credit limits');
  if (typeof input.target === 'number' && credits !== input.target) {
    flags.push('off-target');
    const gap = input.target - credits;
    lines.push(`That is ${plural(Math.abs(gap), 'credit')} ${gap > 0 ? 'under' : 'over'} your ${n(input.target)}-credit target.`);
  }
  if (input.target == null) missing.push('the load you mean to take');

  lines.push(`Estimated ${plural(estimatedHours, 'hour')} a week of study outside class.`);
  if (typeof input.studyHours === 'number' && input.studyHours > 0) {
    if (estimatedHours > input.studyHours) {
      flags.push('over-capacity');
      lines.push(`That is ${plural(Math.round((estimatedHours - input.studyHours) * 10) / 10, 'hour')} more than the ${n(input.studyHours)} you said you have.`);
    } else if (estimatedHours > input.studyHours * 0.85) {
      flags.push('tight');
      lines.push(`That leaves little room against the ${n(input.studyHours)} hours you said you have.`);
    } else {
      lines.push(`That fits inside the ${n(input.studyHours)} hours you said you have.`);
    }
  } else {
    missing.push('the study hours you have each week');
  }

  const problems = flags.filter((f) => f !== 'fits');
  if (problems.length === 0 && missing.length === 0) flags.push('fits');
  return { credits, estimatedHours, flags, lines, assumption, missing };
}
