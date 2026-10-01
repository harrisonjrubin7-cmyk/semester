/**
 * The admissions record's rules, and the field-level refusals both halves of
 * this slice share (admissions and financial aid).
 *
 * This is the TypeScript twin of `private.adm_status_legal` and
 * `private.adm_aid_text_refused` in `supabase/migrations/20260930270000_admissions_aid.sql`.
 * `fixtures.json` beside it is what both must reproduce: `admissionsaid.test.ts`
 * runs every case here, and `supabase/admissions-aid.check.sql` runs the same
 * file through the SQL functions.
 *
 * Nothing here computes anything about an applicant. There is no score, no
 * rank, no recommendation and no ordering by merit: a rule here says only
 * whether a step the school's staff wants to record is one the record allows,
 * and whether a text is one the record refuses to hold.
 */

export const ADMISSION_STATUSES = ['submitted', 'in_review', 'admitted', 'denied', 'waitlisted', 'withdrawn', 'enrolled'] as const;
export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

/** The statuses that are a person's decision. Recording one needs `admissions:decide`. */
export const DECISIONS: readonly AdmissionStatus[] = ['admitted', 'denied', 'waitlisted'];

/** Where an application may go next, going forward. Anything else is a correction. */
const FORWARD: Record<AdmissionStatus, readonly AdmissionStatus[]> = {
  submitted: ['in_review', 'withdrawn'],
  in_review: ['admitted', 'denied', 'waitlisted', 'withdrawn'],
  waitlisted: ['admitted', 'denied', 'withdrawn'],
  admitted: ['enrolled', 'withdrawn'],
  denied: [],
  withdrawn: [],
  enrolled: ['withdrawn'],
};

export const isAdmissionStatus = (v: unknown): v is AdmissionStatus => (ADMISSION_STATUSES as readonly unknown[]).includes(v);

/** May an application go from one status to another without a correction? */
export function statusLegal(from: AdmissionStatus, to: AdmissionStatus): boolean {
  return FORWARD[from].includes(to);
}

/** The statuses an application may go to next, in the list's own order. */
export function forwardFrom(from: AdmissionStatus): AdmissionStatus[] {
  return ADMISSION_STATUSES.filter((s) => statusLegal(from, s));
}

/** The capability recording this status needs: a decision needs `admissions:decide`. */
export function capabilityFor(to: AdmissionStatus): 'admissions:decide' | 'admissions:record' {
  return DECISIONS.includes(to) ? 'admissions:decide' : 'admissions:record';
}

/** A card number, as the database refuses it: 13 to 19 digits with spaces or dashes between (D-146). */
const CARD = /[0-9](?:[ -]?[0-9]){12,18}/;
/** A social security number's shape: a run of exactly nine digits, bounded by anything but a digit. */
const SSN = /(?:^|[^0-9])[0-9]{3}[- ]?[0-9]{2}[- ]?[0-9]{4}(?:[^0-9]|$)/;

/**
 * Why a typed text is refused, or null. A card is checked first, as in the
 * database. This is a net, not a promise: it does not catch a number spelled
 * out in words, and a school whose own identifiers are nine digits must give
 * applicants and awards a reference that is not one.
 */
export function textRefused(text: string): 'card' | 'ssn' | null {
  if (CARD.test(text)) return 'card';
  if (SSN.test(text)) return 'ssn';
  return null;
}

/** The sentence a form shows for a refused text, or null. */
export function textProblem(label: string, text: string): string | null {
  const why = textRefused(text);
  if (why === 'card') return `${label} looks like a card number. Card numbers are never recorded here.`;
  if (why === 'ssn') return `${label} looks like a social security number. Those are never recorded here.`;
  return null;
}
