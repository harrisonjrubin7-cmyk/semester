/**
 * The financial-aid record's rules: which steps an award may take, which awards
 * need a second person, who may be that person, and what one more disbursement
 * does to an award.
 *
 * The TypeScript twin of `private.aid_status_legal`, `private.aid_is_high`,
 * `private.aid_approval_problem` and `private.aid_disbursement_after` in
 * `supabase/migrations/20260930270000_admissions_aid.sql`. `fixtures.json` beside
 * it is what both must reproduce: `admissionsaid.test.ts` runs every case, and
 * `supabase/admissions-aid.check.sql` runs the same file through the SQL
 * functions.
 *
 * Nothing here determines who gets aid, how much, or whether. An award is what a
 * person at the school recorded; these rules only say whether the record may
 * take the next step.
 */

export const AID_STATUSES = ['offered', 'accepted', 'declined', 'disbursed', 'cancelled'] as const;
export type AidStatus = (typeof AID_STATUSES)[number];

export const AWARD_TYPES = ['grant', 'scholarship', 'loan', 'work_study', 'waiver', 'other'] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

export const isAidStatus = (v: unknown): v is AidStatus => (AID_STATUSES as readonly unknown[]).includes(v);
export const isAwardType = (v: unknown): v is AwardType => (AWARD_TYPES as readonly unknown[]).includes(v);

const FORWARD: Record<AidStatus, readonly AidStatus[]> = {
  offered: ['accepted', 'declined', 'cancelled'],
  accepted: ['disbursed', 'declined', 'cancelled'],
  declined: [],
  disbursed: [],
  cancelled: [],
};

/** May an award go from one status to another without a correction? */
export function statusLegal(from: AidStatus, to: AidStatus): boolean {
  return FORWARD[from].includes(to);
}

/**
 * The steps a person may record by hand. `disbursed` is reached by recording
 * the disbursements, never by saying so.
 */
export function recordableFrom(from: AidStatus): AidStatus[] {
  return AID_STATUSES.filter((s) => s !== 'disbursed' && statusLegal(from, s));
}

/**
 * The school's high-value threshold when it has set none. This is D-146's own
 * default for the student-accounts ledger, not a new decision: one number
 * serves aid and the ledger, and a school that has set its own is read from
 * `student_account_settings`.
 */
export const DEFAULT_HIGH_VALUE_CENTS = 100000;

/** At or above the threshold, a second person must approve. `null` is no setting. */
export function isHigh(amountCents: number, thresholdCents: number | null): boolean {
  return amountCents >= (thresholdCents ?? DEFAULT_HIGH_VALUE_CENTS);
}

export type ApprovalProblem = 'not_high' | 'no_capability' | 'same_person';

/** Why a second person's approval is refused, or null when it stands. Said in this order. */
export function approvalProblem(high: boolean, recorder: string | null, approver: string, holdsCapability: boolean): ApprovalProblem | null {
  if (!high) return 'not_high';
  if (!holdsCapability) return 'no_capability';
  if (recorder !== null && recorder === approver) return 'same_person';
  return null;
}

export type DisbursementAfter = 'invalid' | 'over' | 'full' | 'partial';

/** What one more disbursement does to an award, in cents. */
export function disbursementAfter(awardCents: number, soFarCents: number, addCents: number): DisbursementAfter {
  if (addCents <= 0) return 'invalid';
  if (soFarCents + addCents > awardCents) return 'over';
  if (soFarCents + addCents === awardCents) return 'full';
  return 'partial';
}
