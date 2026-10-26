// Facilities (S-76 E13). Pure; mirrors lib/facMigration.ts and is unit-tested in tests/facilities.test.ts.
// Rules: coordinators, technicians and contractors are granted by an administrator, never themselves; contractor access
// carries an end date and stops working after it. Requesters see only a plain status of their own reports. A coordinator
// triages a report (or marks it a duplicate of one already open) and turns it into a work order; work is authorized
// before it is assigned; contractors are never assigned to restricted locations; only the assignee starts and completes
// work, and completion needs evidence; a coordinator other than the assignee inspects and closes or reopens it.
// Scheduled maintenance generates each due work order once. Residence-hall repairs stay in Housing.
export type OrderState = 'new' | 'authorized' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
export type OrderStep = 'authorize' | 'assign' | 'start' | 'complete' | 'close' | 'reopen' | 'cancel';
export type Kind = 'coordinator' | 'technician' | 'contractor';

export function nextOrder(state: OrderState, step: OrderStep, who: { kind: Kind | null; assignee: boolean }): OrderState | null {
  const coord = who.kind === 'coordinator';
  switch (step) {
    case 'authorize': return coord && state === 'new' ? 'authorized' : null;
    case 'assign': return coord && (state === 'authorized' || state === 'assigned') ? 'assigned' : null;
    case 'start': return who.assignee && who.kind !== null && state === 'assigned' ? 'in_progress' : null;
    case 'complete': return who.assignee && who.kind !== null && state === 'in_progress' ? 'completed' : null;
    case 'close': return coord && !who.assignee && state === 'completed' ? 'closed' : null;
    case 'reopen': return coord && !who.assignee && state === 'completed' ? 'assigned' : null;
    case 'cancel': return coord && ['new', 'authorized', 'assigned'].includes(state) ? 'cancelled' : null;
  }
}

/** Whether a person may be assigned work at a location now. */
export function assignBlocker(o: { kind: Kind | null; expiresAt: Date | null; now: Date; restricted: boolean }): string | null {
  if (o.kind !== 'technician' && o.kind !== 'contractor') return 'Assign work to a technician or contractor.';
  if (o.kind === 'contractor' && o.expiresAt && o.expiresAt.getTime() <= o.now.getTime()) return 'That contractor’s access has ended.';
  if (o.kind === 'contractor' && o.restricted) return 'Contractors are not assigned to restricted locations.';
  return null;
}

export const evidenceOk = (text: string) => text.trim().length >= 20;

/** What a requester is told — no names, notes or internal detail. */
export function requesterStatus(req: 'open' | 'triaged' | 'duplicate' | 'declined' | 'converted', order: OrderState | null): string {
  if (req === 'duplicate') return 'Already reported — being handled';
  if (req === 'declined') return 'Not taken forward';
  if (req !== 'converted' || !order) return req === 'triaged' ? 'Reviewed' : 'Received';
  return ({ new: 'Scheduled', authorized: 'Scheduled', assigned: 'Scheduled', in_progress: 'Work in progress', completed: 'Work done — being checked', closed: 'Fixed', cancelled: 'Not taken forward' } as Record<OrderState, string>)[order];
}

/** Next due date after generating a plan's work. */
export const nextDue = (due: Date, everyDays: number) => new Date(due.getTime() + everyDays * 86_400_000);
