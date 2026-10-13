/**
 * Bed allocation: the rules that decide who holds a bed, and when.
 *
 * Pure state transitions over a snapshot. Every change bumps `inventoryVersion`,
 * so a selection made against an older snapshot is refused as stale rather than
 * applied to a bed that has since moved. The transaction that persists a result
 * must compare-and-set on that version; this module is the rule set that
 * transaction applies. It reads no clock and no store: `now` is passed in.
 *
 * Retries are safe. A reservation is keyed by an idempotency key, so a repeated
 * request returns what the first one made, even though the version has moved.
 */

export interface Bed {
  readonly id: string;
  readonly label: string;
}

export type ReservationStatus = 'held' | 'confirmed' | 'expired';

export interface Reservation {
  readonly id: string;
  readonly key: string;
  readonly bedId: string;
  readonly studentId: string;
  readonly status: ReservationStatus;
  readonly expiresAt: number;
  readonly assignmentId: string | null;
}

export interface Assignment {
  readonly id: string;
  readonly bedId: string;
  readonly studentId: string;
  readonly source: 'selection' | 'override';
  readonly authority: string | null;
  readonly rationale: string | null;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

export interface AllocationState {
  readonly inventoryVersion: number;
  readonly beds: Readonly<Record<string, Bed>>;
  readonly reservations: Readonly<Record<string, Reservation>>;
  readonly assignments: Readonly<Record<string, Assignment>>;
}

export type Refusal =
  | 'bed_unknown'
  | 'bed_taken'
  | 'student_placed'
  | 'stale_inventory'
  | 'reservation_unknown'
  | 'reservation_expired'
  | 'reservation_not_yours'
  | 'idempotency_conflict'
  | 'authority_missing'
  | 'assignment_unknown';

export type Outcome =
  | { readonly ok: true; readonly state: AllocationState; readonly id: string }
  | { readonly ok: false; readonly refusal: Refusal };

const accept = (state: AllocationState, id: string): Outcome => ({ ok: true, state, id });
const refuse = (refusal: Refusal): Outcome => ({ ok: false, refusal });

export function initialState(beds: readonly Bed[]): AllocationState {
  return {
    inventoryVersion: 1,
    beds: Object.fromEntries(beds.map((b) => [b.id, b])),
    reservations: {},
    assignments: {},
  };
}

/** Whether a bed is held now, by an open assignment or an unexpired reservation. */
export function bedIsHeld(state: AllocationState, bedId: string, now: number): boolean {
  return (
    Object.values(state.assignments).some((a) => a.bedId === bedId && a.endedAt === null) ||
    Object.values(state.reservations).some(
      (r) => r.bedId === bedId && r.status === 'held' && now < r.expiresAt,
    )
  );
}

/** Whether a student already holds a bed, or is holding one through a live reservation. */
function studentIsPlaced(state: AllocationState, studentId: string, now: number): boolean {
  return (
    Object.values(state.assignments).some((a) => a.studentId === studentId && a.endedAt === null) ||
    Object.values(state.reservations).some(
      (r) => r.studentId === studentId && r.status === 'held' && now < r.expiresAt,
    )
  );
}

/** Every change to availability moves the version, so older snapshots go stale. */
function changed(
  state: AllocationState,
  patch: Pick<AllocationState, 'reservations' | 'assignments'>,
): AllocationState {
  return { ...state, ...patch, inventoryVersion: state.inventoryVersion + 1 };
}

export interface ReserveInput {
  readonly id: string;
  readonly key: string;
  readonly bedId: string;
  readonly studentId: string;
  readonly expectedInventoryVersion: number;
  readonly now: number;
  readonly holdMs: number;
}

/** Hold a bed for a student for a limited time, against the snapshot they chose from. */
export function reserve(state: AllocationState, input: ReserveInput): Outcome {
  const prior = Object.values(state.reservations).find((r) => r.key === input.key);
  if (prior) {
    if (prior.bedId !== input.bedId || prior.studentId !== input.studentId) {
      return refuse('idempotency_conflict');
    }
    // A retry returns what the first attempt made, without touching state.
    const live = prior.status === 'confirmed' || (prior.status === 'held' && input.now < prior.expiresAt);
    return live ? accept(state, prior.id) : refuse('reservation_expired');
  }
  if (input.expectedInventoryVersion !== state.inventoryVersion) return refuse('stale_inventory');
  if (!state.beds[input.bedId]) return refuse('bed_unknown');
  if (bedIsHeld(state, input.bedId, input.now)) return refuse('bed_taken');
  if (studentIsPlaced(state, input.studentId, input.now)) return refuse('student_placed');

  const reservation: Reservation = {
    id: input.id,
    key: input.key,
    bedId: input.bedId,
    studentId: input.studentId,
    status: 'held',
    expiresAt: input.now + input.holdMs,
    assignmentId: null,
  };
  return accept(
    changed(state, {
      reservations: { ...state.reservations, [reservation.id]: reservation },
      assignments: state.assignments,
    }),
    reservation.id,
  );
}

/** Turn a live reservation into an assignment. Retrying it returns the same assignment. */
export function confirm(
  state: AllocationState,
  input: { readonly id: string; readonly reservationId: string; readonly studentId: string; readonly now: number },
): Outcome {
  const r = state.reservations[input.reservationId];
  if (!r) return refuse('reservation_unknown');
  if (r.studentId !== input.studentId) return refuse('reservation_not_yours');
  if (r.status === 'confirmed' && r.assignmentId) return accept(state, r.assignmentId);
  // Expiry is checked here, at the moment of confirmation, not only when the
  // hold lapses: a hold that ran out during checkout must not become a bed.
  if (r.status !== 'held' || input.now >= r.expiresAt) return refuse('reservation_expired');
  if (Object.values(state.assignments).some((a) => a.bedId === r.bedId && a.endedAt === null)) {
    return refuse('bed_taken');
  }

  const assignment: Assignment = {
    id: input.id,
    bedId: r.bedId,
    studentId: r.studentId,
    source: 'selection',
    authority: null,
    rationale: null,
    startedAt: input.now,
    endedAt: null,
  };
  return accept(
    changed(state, {
      reservations: { ...state.reservations, [r.id]: { ...r, status: 'confirmed', assignmentId: assignment.id } },
      assignments: { ...state.assignments, [assignment.id]: assignment },
    }),
    assignment.id,
  );
}

export interface OverrideInput {
  readonly id: string;
  readonly bedId: string;
  readonly studentId: string;
  readonly authority: string;
  readonly rationale: string;
  readonly expectedInventoryVersion: number;
  readonly now: number;
}

/**
 * Place a student outside the normal selection path. A named authority and a
 * rationale are required, and an override cannot double-book a bed or a student.
 */
export function override(state: AllocationState, input: OverrideInput): Outcome {
  if (input.authority.trim() === '' || input.rationale.trim() === '') return refuse('authority_missing');
  if (input.expectedInventoryVersion !== state.inventoryVersion) return refuse('stale_inventory');
  if (!state.beds[input.bedId]) return refuse('bed_unknown');
  if (bedIsHeld(state, input.bedId, input.now)) return refuse('bed_taken');
  if (studentIsPlaced(state, input.studentId, input.now)) return refuse('student_placed');

  const assignment: Assignment = {
    id: input.id,
    bedId: input.bedId,
    studentId: input.studentId,
    source: 'override',
    authority: input.authority.trim(),
    rationale: input.rationale.trim(),
    startedAt: input.now,
    endedAt: null,
  };
  return accept(
    changed(state, {
      reservations: state.reservations,
      assignments: { ...state.assignments, [assignment.id]: assignment },
    }),
    assignment.id,
  );
}

/**
 * End an assignment, keeping it on record. A room change is an end followed by
 * a new reservation, so the prior assignment and its history survive the move.
 * Ending an assignment that has already ended succeeds without changing state.
 */
export function endAssignment(
  state: AllocationState,
  input: { readonly assignmentId: string; readonly expectedInventoryVersion: number; readonly now: number },
): Outcome {
  const a = state.assignments[input.assignmentId];
  if (!a) return refuse('assignment_unknown');
  if (a.endedAt !== null) return accept(state, a.id);
  if (input.expectedInventoryVersion !== state.inventoryVersion) return refuse('stale_inventory');
  return accept(
    changed(state, {
      reservations: state.reservations,
      assignments: { ...state.assignments, [a.id]: { ...a, endedAt: input.now } },
    }),
    a.id,
  );
}

/** Mark every hold that has run out as expired. Changes availability only when something lapsed. */
export function expire(state: AllocationState, now: number): AllocationState {
  const lapsed = Object.values(state.reservations).filter((r) => r.status === 'held' && now >= r.expiresAt);
  if (lapsed.length === 0) return state;
  const reservations = { ...state.reservations };
  for (const r of lapsed) reservations[r.id] = { ...r, status: 'expired' };
  return changed(state, { reservations, assignments: state.assignments });
}
