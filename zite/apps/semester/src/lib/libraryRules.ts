// Library (S-76 E18). Pure; mirrors lib/lbyMigration.ts and is unit-tested in tests/library.test.ts.
// Rules: a copy or licence seat is never lent twice (copies − active loans − holds kept ready for someone else); a patron
// with a ready hold may always borrow; renewals stop at 2 or when someone else is waiting; a returned loan forgets who
// borrowed it, so nobody — staff included — can read a reading history; library staff are granted by an administrator;
// a resource request is decided by staff other than the requester and needs a licence note and an accessibility check
// before it is approved. No fines: money movement stays disabled.
export type ItemKind = 'print' | 'ebook';
export const LOAN_DAYS: Record<ItemKind, number> = { print: 21, ebook: 14 };
export const MAX_RENEWALS = 2;
export const HOLD_READY_DAYS = 3;

/** Copies or seats free for this patron right now. */
export function available(copies: number, activeLoans: number, readyHoldsForOthers: number) {
  return Math.max(0, copies - activeLoans - readyHoldsForOthers);
}

/** Why this patron cannot borrow now, or null. */
export function borrowBlocker(o: { active: boolean; copies: number; activeLoans: number; readyForOthers: number; hasReadyHold: boolean; alreadyBorrowed: boolean }): string | null {
  if (!o.active) return 'This item is not available in the catalog.';
  if (o.alreadyBorrowed) return 'You already have this item.';
  if (o.hasReadyHold) return o.copies - o.activeLoans > 0 ? null : 'Your hold is ready but no copy is free yet; the library has been told.';
  return available(o.copies, o.activeLoans, o.readyForOthers) > 0 ? null : 'No copy is free. Place a hold and you will be next in line.';
}

/** Why a renewal is refused, or null. */
export function renewBlocker(renewals: number, othersWaiting: number, overdue: boolean): string | null {
  if (renewals >= MAX_RENEWALS) return `Already renewed ${MAX_RENEWALS} times. Please return it.`;
  if (othersWaiting > 0) return 'Someone else is waiting for this item, so it cannot be renewed.';
  if (overdue) return 'Overdue items cannot be renewed online. Return it or ask the library.';
  return null;
}

export const dueDate = (from: Date, kind: ItemKind) => new Date(from.getTime() + LOAN_DAYS[kind] * 86_400_000);

export type ReqState = 'submitted' | 'license_review' | 'approved' | 'declined' | 'published';
export type ReqStep = 'review' | 'approve' | 'decline' | 'publish' | 'withdraw';

/** Next state of a resource request; staff never decide their own request. */
export function nextRequest(state: ReqState, step: ReqStep, who: { staff: boolean; requester: boolean }): ReqState | 'withdrawn' | null {
  if (step === 'withdraw') return who.requester && (state === 'submitted' || state === 'license_review') ? 'withdrawn' : null;
  if (!who.staff || who.requester) return null;
  if (step === 'review') return state === 'submitted' ? 'license_review' : null;
  if (step === 'approve') return state === 'license_review' ? 'approved' : null;
  if (step === 'decline') return state === 'submitted' || state === 'license_review' ? 'declined' : null;
  if (step === 'publish') return state === 'approved' ? 'published' : null;
  return null;
}

/** Approval needs a licence note and an explicit accessibility answer. */
export function approveBlocker(licenseNote: string, accessible: boolean | null): string | null {
  if (licenseNote.trim().length < 10) return 'Record the licence terms (at least 10 characters).';
  if (accessible === null) return 'Record whether the resource meets accessibility needs.';
  return null;
}
