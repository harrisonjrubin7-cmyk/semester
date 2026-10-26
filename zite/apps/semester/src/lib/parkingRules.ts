// Transportation and Parking (S-76 E17). Pure; mirrors lib/prkMigration.ts and is unit-tested in tests/parking.test.ts.
// Rules: parking staff and appeal adjudicators are granted by an administrator, never themselves, and are separate roles,
// so whoever issued a citation can never decide its appeal. A zone never holds more issued permits than its capacity
// (the zone row is locked while counting); a full zone waitlists. One live permit per person per term. Plates are
// compared normalised. A citation can be appealed once, by the vehicle's registered owner, within 21 days; a reduction
// must be lower than the original amount. Semester takes no payments and tracks no locations.
export const APPEAL_DAYS = 21;

/** Upper-case, letters and digits only: "abc-12 3" → "ABC123". */
export const normPlate = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const plateOk = (p: string) => normPlate(p).length >= 2 && normPlate(p).length <= 10;

export type PermitState = 'applied' | 'waitlisted' | 'issued' | 'declined' | 'revoked' | 'withdrawn' | 'expired';
export type PermitStep = 'allocate' | 'waitlist' | 'decline' | 'revoke' | 'withdraw';
export const LIVE_PERMIT: PermitState[] = ['applied', 'waitlisted', 'issued'];

export function nextPermit(state: PermitState, step: PermitStep, who: { staff: boolean; holder: boolean }, zoneFull: boolean): PermitState | null {
  if (step === 'withdraw') return who.holder && LIVE_PERMIT.includes(state) ? 'withdrawn' : null;
  if (!who.staff || who.holder) return null;
  if (step === 'allocate') return (state === 'applied' || state === 'waitlisted') && !zoneFull ? 'issued' : null;
  if (step === 'waitlist') return state === 'applied' && zoneFull ? 'waitlisted' : null;
  if (step === 'decline') return state === 'applied' || state === 'waitlisted' ? 'declined' : null;
  if (step === 'revoke') return state === 'issued' ? 'revoked' : null;
  return null;
}

/** An issued permit past its end date counts as expired. */
export const effectivePermit = (state: PermitState, validTo: Date | null, now: Date): PermitState =>
  state === 'issued' && validTo && validTo.getTime() < now.getTime() ? 'expired' : state;

export type CitationState = 'issued' | 'appealed' | 'upheld' | 'dismissed' | 'reduced' | 'voided';

/** Why the vehicle owner cannot appeal now, or null. */
export function appealBlocker(state: CitationState, issuedAt: Date, now: Date, isOwner: boolean, text: string): string | null {
  if (!isOwner) return 'Only the registered owner of the vehicle can appeal.';
  if (state !== 'issued') return state === 'appealed' ? 'This citation is already under appeal.' : 'This citation can no longer be appealed.';
  if (now.getTime() - issuedAt.getTime() > APPEAL_DAYS * 86_400_000) return `Appeals must be made within ${APPEAL_DAYS} days.`;
  if (text.trim().length < 20) return 'Explain the appeal (at least 20 characters).';
  return null;
}

/** Why an adjudicator cannot record this decision, or null. */
export function decisionBlocker(o: { state: CitationState; adjudicator: boolean; issuedByMe: boolean; outcome: 'upheld' | 'dismissed' | 'reduced'; amount: number; newAmount: number | null; note: string }): string | null {
  if (!o.adjudicator) return 'Only an appeal adjudicator decides appeals.';
  if (o.issuedByMe) return 'You issued this citation, so someone else must decide the appeal.';
  if (o.state !== 'appealed') return 'There is no open appeal on this citation.';
  if (o.note.trim().length < 10) return 'Give the reason for the decision (at least 10 characters).';
  if (o.outcome === 'reduced' && (o.newAmount === null || o.newAmount < 0 || o.newAmount >= o.amount)) return 'A reduction must be lower than the original amount.';
  return null;
}
