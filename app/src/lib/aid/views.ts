/**
 * What an aid record says, in words, and what a form may ask before it asks the
 * database.
 *
 * Pure: it takes rows the database kept and the form's own fields, and returns
 * sentences and problems. It decides nothing about aid. The only arithmetic is
 * adding up the disbursements a person recorded and subtracting them from the
 * award a person recorded.
 */
import { formatDateTime } from '../locale';
import { money, parseCents } from '../finance/accounts';
import { textProblem } from '../admissions/rules';
import { LIMITS, type Award, type AwardHistoryEntry, type Disbursement } from './model';
import { AWARD_TYPES, type AidStatus, type AwardType } from './rules';

export const STATUS_LABEL: Record<AidStatus, string> = {
  offered: 'Offered',
  accepted: 'Accepted',
  declined: 'Declined',
  disbursed: 'Disbursed',
  cancelled: 'Cancelled',
};

export const TYPE_LABEL: Record<AwardType, string> = {
  grant: 'Grant',
  scholarship: 'Scholarship',
  loan: 'Loan',
  work_study: 'Work-study',
  waiver: 'Waiver',
  other: 'Other',
};

const STUDENT_REF = /^[A-Za-z0-9._-]{1,64}$/;
const AID_YEAR = /^([0-9]{4})-([0-9]{4})$/;

export function studentRefProblem(v: string): string | null {
  const t = v.trim();
  if (t === '') return 'Give the student reference the school’s record uses.';
  if (!STUDENT_REF.test(t)) return 'A student reference is letters, digits, dots, dashes or underscores, up to 64.';
  return null;
}

export function aidYearProblem(v: string): string | null {
  const m = AID_YEAR.exec(v.trim());
  if (!m || Number(m[2]) !== Number(m[1]) + 1) return 'An aid year is two consecutive years, such as 2026-2027.';
  return null;
}

export function fundProblem(v: string): string | null {
  const t = v.trim();
  if (t === '') return 'Name the fund.';
  if (t.length > LIMITS.fundName) return `A fund name is up to ${LIMITS.fundName} characters.`;
  return textProblem('That fund name', t);
}

export function reasonProblem(v: string): string | null {
  const t = v.trim();
  if (t.length < LIMITS.reasonMin) return 'Say why, in a few words. The reason is kept with who recorded it.';
  if (t.length > LIMITS.reasonMax) return `A reason is up to ${LIMITS.reasonMax} characters.`;
  return textProblem('That reason', t);
}

export function noteProblem(v: string): string | null {
  const t = v.trim();
  if (t.length > LIMITS.noteMax) return `A note is up to ${LIMITS.noteMax} characters.`;
  return t === '' ? null : textProblem('That note', t);
}

/** An amount typed as dollars, as whole cents; or the problem. Never a float. */
export function amountProblem(v: string): string | null {
  const cents = parseCents(v);
  if (cents === null || cents < 1) return 'Type an amount in dollars, such as 2500 or 2,500.00.';
  if (cents > LIMITS.amountMaxCents) return 'That amount is larger than a record can hold.';
  return null;
}

export const TYPES_OFFERED: readonly AwardType[] = AWARD_TYPES;

/** What has been disbursed against an award, and what is left, from the disbursements a person recorded. */
export function disbursedOf(award: Award, list: readonly Disbursement[]): { paid: number; left: number } {
  const paid = list.filter((d) => d.awardId === award.id).reduce((n, d) => n + d.amountCents, 0);
  return { paid, left: Math.max(0, award.amountCents - paid) };
}

/** An award, in one line, for a list. */
export function awardLine(a: Award): string {
  return `${a.fundName}: ${TYPE_LABEL[a.awardType]}, ${money(a.amountCents)}, ${STATUS_LABEL[a.status].toLowerCase()}`;
}

/** What a student is told about where an award stands. Words only; nothing is estimated. */
export function studentSentence(a: Award, list: readonly Disbursement[]): string {
  const { paid, left } = disbursedOf(a, list);
  if (a.status === 'declined') return 'This award was declined.';
  if (a.status === 'cancelled') return 'This award was cancelled by your school.';
  if (a.status === 'offered') return 'Your school has offered this award. Nothing has been paid out.';
  if (paid === 0) return 'You accepted this award. Nothing has been paid out yet.';
  if (left === 0) return `All ${money(a.amountCents)} of this award has been paid out.`;
  return `${money(paid)} of ${money(a.amountCents)} has been paid out; ${money(left)} is still to come.`;
}

/** Whether a disbursement was reconciled with the student account, in words. */
export function reconciliationSentence(d: Disbursement): string {
  return d.ledgerEntryId
    ? 'Matched to the aid credit on your student account.'
    : 'Not yet matched to an aid credit on your student account.';
}

const stamp = (iso: string): string => formatDateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
export const dayOf = (iso: string): string => formatDateTime(new Date(`${iso}T12:00:00`), { dateStyle: 'medium' });

/** One history entry as a sentence: who, when, from where to where, and why. */
export function historyLine(h: AwardHistoryEntry, me: string | null): string {
  const who = h.recordedBy === null ? 'Someone whose account was later deleted' : h.recordedBy === me ? 'You' : 'A member of staff';
  const move = h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} to ${STATUS_LABEL[h.toStatus]}` : STATUS_LABEL[h.toStatus];
  const kind = h.kind === 'correction' ? ` as a correction of entry ${h.correctsSeq ?? '?'}` : '';
  return `${stamp(h.recordedAt)}. ${who} recorded ${move}${kind}. Reason: ${h.reason}`;
}

/** Why a high award is waiting, for staff. */
export function waitingSentence(a: Award): string | null {
  if (a.highValue && a.approvedAt === null && (a.status === 'offered' || a.status === 'accepted')) {
    return 'This award is at or above your school’s high-value threshold. It cannot be accepted or paid out until a second person, never the one who recorded it, approves it.';
  }
  return null;
}
