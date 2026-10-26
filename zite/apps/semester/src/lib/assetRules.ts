// Assets and Inventory (S-76 E14). Pure; mirrors lib/astMigration.ts and is unit-tested in tests/assets.test.ts.
// Rules: inventory clerks and controllers are granted by an administrator, never themselves. Tracked assets carry a unique
// tag and an append-only custody history; disposal is requested with a reason and approved by a controller who did not
// request it (Finance decides accounting treatment outside Semester). Stock never goes negative and reservations never
// exceed what is on hand (the stock row is locked while checking); issuing consumes a reservation; returns cannot exceed
// what was issued; a count that differs creates an adjustment that a controller other than the counter approves.
export type AssetState = 'in_service' | 'in_repair' | 'retire_requested' | 'disposed';
export type AssetStep = 'repair' | 'restore' | 'request_disposal' | 'approve_disposal' | 'reject_disposal';
export type Role = 'clerk' | 'controller';

export function nextAsset(state: AssetState, step: AssetStep, role: Role | null, requestedByMe: boolean): AssetState | null {
  if (!role) return null;
  switch (step) {
    case 'repair': return state === 'in_service' ? 'in_repair' : null;
    case 'restore': return state === 'in_repair' ? 'in_service' : null;
    case 'request_disposal': return state === 'in_service' || state === 'in_repair' ? 'retire_requested' : null;
    case 'approve_disposal': return role === 'controller' && !requestedByMe && state === 'retire_requested' ? 'disposed' : null;
    case 'reject_disposal': return role === 'controller' && !requestedByMe && state === 'retire_requested' ? 'in_service' : null;
  }
}

/** Upper-case asset tag, letters, digits and dashes. */
export const normTag = (t: string) => t.toUpperCase().replace(/[^A-Z0-9-]/g, '');

/** Quantity free to reserve. */
export const free = (onHand: number, reserved: number) => Math.max(0, onHand - reserved);

export function reserveBlocker(onHand: number, reserved: number, qty: number): string | null {
  if (!Number.isInteger(qty) || qty < 1) return 'Ask for at least one.';
  return qty > free(onHand, reserved) ? `Only ${free(onHand, reserved)} available.` : null;
}

export function returnBlocker(issued: number, alreadyReturned: number, qty: number): string | null {
  if (!Number.isInteger(qty) || qty < 1) return 'Return at least one.';
  return alreadyReturned + qty > issued ? `Only ${issued - alreadyReturned} can still be returned.` : null;
}

/** The adjustment a count implies, or null when the count matches. A count below what is reserved cannot be approved. */
export function countDelta(onHand: number, counted: number): number | null {
  return counted === onHand ? null : counted - onHand;
}
export function adjustBlocker(o: { controller: boolean; countedByMe: boolean; onHand: number; reserved: number; delta: number }): string | null {
  if (!o.controller) return 'Only an inventory controller approves adjustments.';
  if (o.countedByMe) return 'Someone other than the person who counted must approve.';
  if (o.onHand + o.delta < 0) return 'Stock cannot go below zero.';
  if (o.onHand + o.delta < o.reserved) return 'This would leave less than is already reserved; release reservations first.';
  return null;
}
