/**
 * A course's agreement, in a student's words.
 *
 * `lib/toolkit/policy.ts` resolves what each kind of AI use comes to for a
 * course — from the instructor's published rules if there are any, otherwise
 * from the student's own record of the syllabus — and `courserules.ts` gates
 * the Study Studio on it. What was missing was the reading: one place that says
 * plainly, for one course, what Semester may be used for, on whose word, and
 * what stays the student's own responsibility.
 *
 * It holds no policy of its own and cannot loosen one. A use nobody has said
 * anything about is shown as "not on file — check with your instructor", never
 * as allowed.
 */

import { USES, permits, resolve, type PolicySource, type Resolved, type Use } from './toolkit/policy';

export type Bucket = 'may' | 'disclose' | 'not' | 'unknown';

export interface Line {
  use: Use;
  label: string;
  bucket: Bucket;
  /** Who said so, or '' when nobody did. */
  by: string;
}

const who = (p: PolicySource | undefined) =>
  !p ? '' : p.by === 'instructor' ? 'your instructor' : p.by === 'institution' ? 'your school' : 'your own record of the syllabus';

const bucketOf = (r: Resolved): Bucket =>
  r.state === 'unavailable' ? 'unknown' : r.state === 'prohibited' ? 'not' : r.state === 'limited' || r.state === 'required' ? 'disclose' : permits(r.state) ? 'may' : 'unknown';

export function agreementLines(layers: readonly (PolicySource | undefined)[]): Line[] {
  return USES.map(([use, label]) => {
    const r = resolve(use, layers);
    return { use, label, bucket: bucketOf(r), by: who(r.from) };
  });
}

export const HEADINGS: Record<Bucket, string> = {
  may: 'You may use Semester to',
  disclose: 'You may, and you should say how you used it',
  not: 'Not allowed in this course',
  unknown: 'Not on file — check with your instructor',
};

/** The words that never change with the course: what stays the student's. */
export const RESPONSIBILITY = [
  'For graded work, check your instructor’s instructions.',
  'You are responsible for your final work, its facts and its citations.',
  'Semester will not complete a prohibited or active assessment for you.',
] as const;

export function summary(lines: Line[]): string {
  const n = (b: Bucket) => lines.filter((l) => l.bucket === b).length;
  if (n('unknown') === lines.length) return 'Nothing is on file for this course yet. Treat every AI use as unconfirmed until you have checked.';
  return `${n('may')} allowed, ${n('disclose')} with disclosure, ${n('not')} not allowed, ${n('unknown')} not on file.`;
}
