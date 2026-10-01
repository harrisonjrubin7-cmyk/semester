/**
 * What an admissions record says, in words, and what a form may ask before it
 * asks the database.
 *
 * Pure: it takes rows the database kept and the form's own fields, and returns
 * sentences and problems. It computes nothing about an applicant. There is no
 * score here, no rank, no recommendation and no "likely": a status is only what
 * a person recorded, with their reason.
 *
 * Applicants are listed by cycle and then by the school's own applicant
 * reference, alphabetically. That order is chosen so that it cannot be read as
 * a ranking, and `admissionsaid.test.ts` holds this file, the screens and the
 * migration to never using a word that would make it one.
 */
import { formatDateTime } from '../locale';
import { LIMITS, type Applicant, type ApplicantLink, type HistoryEntry } from './model';
import { textProblem, type AdmissionStatus } from './rules';

export const STATUS_LABEL: Record<AdmissionStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  admitted: 'Admitted',
  denied: 'Denied',
  waitlisted: 'Waitlisted',
  withdrawn: 'Withdrawn',
  enrolled: 'Enrolled',
};

export const STATUS_HINT: Record<AdmissionStatus, string> = {
  submitted: 'The school has the application.',
  in_review: 'Staff are reading it.',
  admitted: 'A person at the school decided to admit.',
  denied: 'A person at the school decided to deny.',
  waitlisted: 'A person at the school decided to waitlist.',
  withdrawn: 'The applicant withdrew, or the school closed the file at their request.',
  enrolled: 'The applicant is linked to a student reference and enrolled.',
};

const STUDENT_REF = /^[A-Za-z0-9._-]{1,64}$/;
const APPLICANT_REF = /^[A-Za-z0-9._-]{1,64}$/;
const CYCLE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/;

export function cycleProblem(v: string): string | null {
  const t = v.trim();
  if (t === '') return 'Name the cycle, such as Fall 2027.';
  if (!CYCLE.test(t)) return `A cycle is up to ${LIMITS.cycle} letters, digits, spaces or . _ / -.`;
  return null;
}

export function applicantRefProblem(v: string): string | null {
  const t = v.trim();
  if (t === '') return 'Give the applicant reference your school uses.';
  if (!APPLICANT_REF.test(t)) return 'An applicant reference is letters, digits, dots, dashes or underscores, up to 64.';
  return textProblem('That reference', t);
}

export function programProblem(v: string): string | null {
  const t = v.trim();
  if (t === '') return 'Name the program applied to.';
  if (t.length > LIMITS.program) return `A program is up to ${LIMITS.program} characters.`;
  return textProblem('That program', t);
}

export function reasonProblem(v: string): string | null {
  const t = v.trim();
  if (t.length < LIMITS.reasonMin) return 'Say why, in a few words. The reason is kept with who recorded it.';
  if (t.length > LIMITS.reasonMax) return `A reason is up to ${LIMITS.reasonMax} characters.`;
  return textProblem('That reason', t);
}

export function studentRefProblem(v: string): string | null {
  const t = v.trim();
  if (t === '') return 'Give the student reference the school’s record uses.';
  if (!STUDENT_REF.test(t)) return 'A student reference is letters, digits, dots, dashes or underscores, up to 64.';
  return null;
}

export interface CycleGroup {
  cycle: string;
  applicants: Applicant[];
}

/** Applicants grouped by cycle, each group in the school's own reference order. */
export function byCycle(list: readonly Applicant[]): CycleGroup[] {
  const groups = new Map<string, Applicant[]>();
  for (const a of list) groups.set(a.cycle, [...(groups.get(a.cycle) ?? []), a]);
  return [...groups.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([cycle, applicants]) => ({ cycle, applicants: [...applicants].sort((x, y) => x.applicantRef.localeCompare(y.applicantRef)) }));
}

/** How many applicants hold each status in a list: a tally of what people recorded, not a figure about the applicants. */
export function tally(list: readonly Applicant[]): Record<AdmissionStatus, number> {
  const out: Record<AdmissionStatus, number> = { submitted: 0, in_review: 0, admitted: 0, denied: 0, waitlisted: 0, withdrawn: 0, enrolled: 0 };
  for (const a of list) out[a.status] += 1;
  return out;
}

const stamp = (iso: string): string => formatDateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

/** One history entry as a sentence: who, when, from where to where, and why. */
export function historyLine(h: HistoryEntry, me: string | null): string {
  const who = h.recordedBy === null ? 'Someone whose account was later deleted' : h.recordedBy === me ? 'You' : 'A member of staff';
  const move = h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} to ${STATUS_LABEL[h.toStatus]}` : STATUS_LABEL[h.toStatus];
  const kind = h.kind === 'correction' ? ` as a correction of entry ${h.correctsSeq ?? '?'}` : '';
  return `${stamp(h.recordedAt)}. ${who} recorded ${move}${kind}. Reason: ${h.reason}`;
}

/** The link for an applicant, if the registrar made one. */
export function linkFor(id: string, links: readonly ApplicantLink[]): ApplicantLink | null {
  return links.find((l) => l.applicantId === id) ?? null;
}

/** What the registrar still has to do before an admitted applicant can be enrolled, in words. */
export function enrolmentSentence(a: Applicant, link: ApplicantLink | null): string | null {
  if (a.status === 'admitted' && !link) return 'To enrol this applicant, the registrar links them to a student reference first. Semester never creates a student.';
  if (link) return `Linked to student reference ${link.studentRef}.`;
  return null;
}
