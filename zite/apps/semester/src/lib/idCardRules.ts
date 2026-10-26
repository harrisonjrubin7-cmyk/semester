// Campus Identity and Card (S-76 E16). Pure; mirrors lib/idcMigration.ts and is unit-tested in tests/idcard.test.ts.
// Semester records credentials and access entitlements; it never actuates a door controller or card system. So every
// change the access system must make is first "requested" and only becomes active or revoked when card-office staff
// record the controller's confirmation. Rules: card-office officers and physical-security approvers are granted by an
// administrator, never themselves; a card stores only an office reference (never a raw card number or secret); one live
// card per person; restricted-zone access is approved by security staff who did not request it; a lost or terminated card
// asks for every grant to be revoked, and a replacement is issued only after the old card's revocation is confirmed.
export type CardState = 'active' | 'suspended' | 'revoke_requested' | 'revoked';
export type GrantState = 'requested' | 'provision_requested' | 'active' | 'revoke_requested' | 'revoked' | 'denied';
export type Role = 'officer' | 'security';

/** A card reference is an office label, not a card number: no run of 8+ digits, 3–32 safe characters. */
export function cardRefOk(ref: string): boolean {
  const r = ref.trim();
  return /^[A-Za-z0-9-]{3,32}$/.test(r) && !/\d{8,}/.test(r);
}

export function nextGrant(state: GrantState, step: 'approve' | 'deny' | 'confirm' | 'revoke', who: { role: Role | null; requester: boolean; restricted: boolean }): GrantState | null {
  const approver = who.restricted ? who.role === 'security' : who.role === 'officer' || who.role === 'security';
  switch (step) {
    case 'approve': return state === 'requested' && approver && !who.requester ? 'provision_requested' : null;
    case 'deny': return state === 'requested' && approver && !who.requester ? 'denied' : null;
    case 'confirm':
      if (who.role !== 'officer') return null;
      return state === 'provision_requested' ? 'active' : state === 'revoke_requested' ? 'revoked' : null;
    case 'revoke': return (state === 'active' || state === 'provision_requested') && who.role !== null ? 'revoke_requested' : null;
  }
}

/** Plain status for the card holder. "Requested" is never shown as done. */
export function holderGrantStatus(s: GrantState): string {
  return ({ requested: 'Waiting for approval', provision_requested: 'Approved — waiting for the door system to confirm', active: 'Active',
    revoke_requested: 'Being removed — not yet confirmed', revoked: 'Removed', denied: 'Not approved' } as Record<GrantState, string>)[s];
}

/** A replacement card may be issued only once the old card's revocation and all its grants' revocations are confirmed. */
export function replaceBlocker(oldCard: CardState, grants: GrantState[]): string | null {
  if (oldCard !== 'revoked') return 'Confirm the old card is revoked before issuing a replacement.';
  if (grants.some((g) => g === 'revoke_requested' || g === 'active' || g === 'provision_requested')) return 'Some door access on the old card is not yet confirmed removed.';
  return null;
}

/** Requests the controller has not confirmed within this many hours are flagged for follow-up (it may be offline). */
export const STALE_HOURS = 24;
export const isStale = (requestedAt: Date, now: Date) => now.getTime() - requestedAt.getTime() > STALE_HOURS * 3_600_000;
