/**
 * Campus questions and answers: the source-aware alternative to the group
 * chat where somebody's cousin said the study rooms open at nine.
 *
 * One question, several kinds of answer, and every answer says what it is.
 * The labels are the three Semester already uses everywhere — source, scope,
 * status — and the rule under them is DO-NOT-BUILD rule 7: only a fact an
 * office confirmed carries `institution_verified`, and `verify` refuses to
 * apply it without the office and the confirmation. An answer nobody has
 * looked at for `REVIEW_DAYS` turns to `needs_review` on its own, a student
 * can say it is stale, and an office can claim a question so the next
 * student gets the office's answer first.
 *
 * Nothing here is stored yet; `questions.test.ts` holds the rules the
 * table will be built to.
 */

export const ANSWER_KINDS = [
  { kind: 'institution_verified', text: 'Institution-verified answer' },
  { kind: 'office_owner', text: 'Answer from the office that owns this' },
  { kind: 'student_experience', text: 'A student\'s experience' },
  { kind: 'official_link', text: 'Link to the official system' },
  { kind: 'needs_review', text: 'Outdated or needs review' },
] as const;

export type AnswerKind = (typeof ANSWER_KINDS)[number]['kind'];

export const SCOPES = ['campus', 'course', 'club', 'private'] as const;
export type Scope = (typeof SCOPES)[number];

export const STATUSES = ['current', 'needs_review', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

/** How long an answer stands before somebody must look at it again. */
export const REVIEW_DAYS = 180;

export interface Question {
  id: string;
  text: string;
  scope: Scope;
  /** The office that claimed this question, if one did. */
  claimedBy: string | null;
}

export interface Answer {
  id: string;
  questionId: string;
  kind: AnswerKind;
  body: string;
  /** Required for `institution_verified` and `office_owner`. */
  office: string | null;
  /** The record the office confirmed it against: a page, a policy, a ticket. Required for `institution_verified`. */
  confirmation: string | null;
  link: string | null;
  reviewedOn: string;
  status: Status;
  /** Student reports that it is out of date. Two turn it to `needs_review`. */
  staleReports: number;
}

export const STALE_REPORTS_TO_REVIEW = 2;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** The status an answer has today, whatever it was last saved as. */
export function statusOf(a: Answer, today: string): Status {
  if (a.status === 'archived') return 'archived';
  if (a.kind === 'needs_review') return 'needs_review';
  if (a.staleReports >= STALE_REPORTS_TO_REVIEW) return 'needs_review';
  if (daysBetween(a.reviewedOn, today) > REVIEW_DAYS) return 'needs_review';
  return 'current';
}

/** "Institution verified · Student Affairs · reviewed 12 Sep 2026". */
export function labelLine(a: Answer, today: string): string {
  const kind = ANSWER_KINDS.find((k) => k.kind === a.kind)!.text;
  const who = a.office ? ` · ${a.office}` : '';
  const status = statusOf(a, today);
  return `${kind}${who} · reviewed ${a.reviewedOn}${status === 'current' ? '' : ` · ${status.replace('_', ' ')}`}`;
}

/**
 * Apply the institution's label. Refused without the office that confirmed
 * it and what it confirmed it against — rule 7 in one function.
 */
export function verify(a: Answer, office: string, confirmation: string, today: string): { ok: true; answer: Answer } | { ok: false; reason: string } {
  if (!office.trim()) return { ok: false, reason: 'an institution-verified answer names the office' };
  if (!confirmation.trim()) return { ok: false, reason: 'an institution-verified answer says what it was confirmed against' };
  return { ok: true, answer: { ...a, kind: 'institution_verified', office: office.trim(), confirmation: confirmation.trim(), reviewedOn: today, status: 'current', staleReports: 0 } };
}

/** An office's own answer, without the institution's label: it is the office speaking, not the record. */
export function fromOffice(a: Answer, office: string, today: string): Answer {
  return { ...a, kind: 'office_owner', office: office.trim() || null, reviewedOn: today, status: 'current', staleReports: 0 };
}

export function reportOutdated(a: Answer): Answer {
  return { ...a, staleReports: a.staleReports + 1 };
}

export function rereview(a: Answer, today: string): Answer {
  return { ...a, reviewedOn: today, staleReports: 0, status: 'current', kind: a.kind === 'needs_review' ? 'student_experience' : a.kind };
}

export function claim(q: Question, office: string): Question {
  return { ...q, claimedBy: office.trim() || null };
}

/**
 * The order answers are shown: the institution's, then the office's, then
 * the official link, then students' experiences — and anything needing
 * review last, whatever its kind, so a stale verified answer does not sit
 * above a fresh student one.
 */
const ORDER: Record<AnswerKind, number> = { institution_verified: 0, office_owner: 1, official_link: 2, student_experience: 3, needs_review: 4 };

export function arrange(answers: readonly Answer[], today: string): Answer[] {
  return [...answers]
    .filter((a) => statusOf(a, today) !== 'archived')
    .sort((a, b) => {
      const sa = statusOf(a, today) === 'needs_review' ? 1 : 0;
      const sb = statusOf(b, today) === 'needs_review' ? 1 : 0;
      return sa - sb || ORDER[a.kind] - ORDER[b.kind] || b.reviewedOn.localeCompare(a.reviewedOn);
    });
}

/** Questions an office has not claimed, most-asked first — what the institution reads to see where students cannot find an answer. */
export function unclaimed(questions: readonly Question[], asked: (q: Question) => number): Question[] {
  return questions.filter((q) => !q.claimedBy).sort((a, b) => asked(b) - asked(a) || a.text.localeCompare(b.text));
}
