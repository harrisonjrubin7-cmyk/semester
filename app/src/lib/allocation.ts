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
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly holdMs: number;
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
  | 'assignment_unknown'
  | 'invalid_input'
  | 'duplicate_id';

export type Outcome =
  | { readonly ok: true; readonly state: AllocationState; readonly id: string }
  | { readonly ok: false; readonly refusal: Refusal };

const accept = (state: AllocationState, id: string): Outcome => ({ ok: true, state, id });
const refuse = (refusal: Refusal): Outcome => ({ ok: false, refusal });

/** Own-property lookup, so an id such as "toString" never resolves to Object.prototype. */
const own = <T>(record: Readonly<Record<string, T>>, id: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(record, id) ? record[id] : undefined;

export function initialState(beds: readonly Bed[]): AllocationState {
  // Inventory is built once from configuration; a repeated id is a configuration error, not a bed to drop.
  const ids = new Set(beds.map((b) => b.id));
  if (ids.size !== beds.length) throw new Error('duplicate bed id in inventory');
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

/**
 * Whether recorded history for a bed or student starts after `now`, or runs past it. Ended assignments
 * still count: a clock earlier than what has already happened cannot place a new hold beside it.
 */
function recordedAfter(state: AllocationState, bedId: string, studentId: string, now: number): 'bed' | 'student' | null {
  const assignments = Object.values(state.assignments);
  const after = (a: Assignment) => a.startedAt > now || (a.endedAt !== null && a.endedAt > now);
  if (assignments.some((a) => a.bedId === bedId && after(a))) return 'bed';
  if (assignments.some((a) => a.studentId === studentId && after(a))) return 'student';
  return null;
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
  // An empty key would match every other keyless request, so it is refused before lookup.
  if (input.key.trim() === '' || input.id.trim() === '') return refuse('invalid_input');
  // A hold must be bounded and positive: zero or NaN never blocks the bed, Infinity never lapses.
  if (!Number.isFinite(input.holdMs) || input.holdMs <= 0) return refuse('invalid_input');
  // A blank student would own a hold no one can claim, and every other blank request would collide with it.
  if (input.studentId.trim() === '') return refuse('invalid_input');
  // A bad clock is invalid input on a retry too, not an answer about the prior hold.
  if (!Number.isFinite(input.now)) return refuse('invalid_input');
  const prior = Object.values(state.reservations).find((r) => r.key === input.key);
  if (prior) {
    if (prior.bedId !== input.bedId || prior.studentId !== input.studentId || prior.holdMs !== input.holdMs) {
      return refuse('idempotency_conflict');
    }
    // A retry returns what the first attempt made, without touching state. A confirmed hold is live
    // only while its assignment is still open; once it has ended, replaying it would be stale.
    const open = prior.assignmentId !== null && own(state.assignments, prior.assignmentId)?.endedAt === null;
    const live = prior.status === 'confirmed' ? open : prior.status === 'held' && input.now < prior.expiresAt;
    return live ? accept(state, prior.id) : refuse('reservation_expired');
  }
  if (input.expectedInventoryVersion !== state.inventoryVersion) return refuse('stale_inventory');
  if (!own(state.beds, input.bedId)) return refuse('bed_unknown');
  if (own(state.reservations, input.id)) return refuse('duplicate_id');
  if (bedIsHeld(state, input.bedId, input.now)) return refuse('bed_taken');
  if (studentIsPlaced(state, input.studentId, input.now)) return refuse('student_placed');
  const backdated = recordedAfter(state, input.bedId, input.studentId, input.now);
  if (backdated) return refuse(backdated === 'bed' ? 'bed_taken' : 'student_placed');

  const expiresAt = input.now + input.holdMs;
  // A tiny hold can round back to now, and a clock near the float limit can overflow to Infinity;
  // either way the hold would not be live when it is written.
  if (!Number.isFinite(expiresAt) || expiresAt <= input.now) return refuse('invalid_input');
  const reservation: Reservation = {
    id: input.id,
    key: input.key,
    bedId: input.bedId,
    studentId: input.studentId,
    status: 'held',
    createdAt: input.now,
    expiresAt,
    holdMs: input.holdMs,
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
  // A blank id would be stored as the assignment, and its retry would then miss the idempotent branch.
  if (input.id.trim() === '' || !Number.isFinite(input.now)) return refuse('invalid_input');
  const r = own(state.reservations, input.reservationId);
  if (!r) return refuse('reservation_unknown');
  if (r.studentId !== input.studentId) return refuse('reservation_not_yours');
  if (r.status === 'confirmed' && r.assignmentId) {
    return own(state.assignments, r.assignmentId)?.endedAt === null
      ? accept(state, r.assignmentId)
      : refuse('reservation_expired');
  }
  // Expiry is checked here, at the moment of confirmation, not only when the
  // hold lapses: a hold that ran out during checkout must not become a bed.
  if (r.status !== 'held' || input.now >= r.expiresAt) return refuse('reservation_expired');
  // A confirmation stamped before its own hold existed belongs to no valid history.
  if (input.now < r.createdAt) return refuse('invalid_input');
  // reserve only admits a bed or student that is free at its own clock, so any later reservation
  // for either means this hold had already lapsed; a delayed confirmation must not revive it.
  const others = Object.values(state.reservations).filter((o) => o.id !== r.id);
  if (others.some((o) => o.bedId === r.bedId && o.createdAt >= r.createdAt)) return refuse('bed_taken');
  if (others.some((o) => o.studentId === r.studentId && o.createdAt >= r.createdAt)) return refuse('student_placed');
  // An override or room change that has since ended still proves the bed or student moved on after this hold began.
  if (Object.values(state.assignments).some((a) => a.bedId === r.bedId && a.startedAt >= r.createdAt)) {
    return refuse('bed_taken');
  }
  if (Object.values(state.assignments).some((a) => a.studentId === r.studentId && a.startedAt >= r.createdAt)) {
    return refuse('student_placed');
  }
  if (Object.values(state.assignments).some((a) => a.bedId === r.bedId && a.endedAt === null)) {
    return refuse('bed_taken');
  }
  if (Object.values(state.assignments).some((a) => a.studentId === r.studentId && a.endedAt === null)) {
    return refuse('student_placed');
  }
  if (own(state.assignments, input.id)) return refuse('duplicate_id');

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
  if (input.id.trim() === '' || input.studentId.trim() === '' || !Number.isFinite(input.now)) {
    return refuse('invalid_input');
  }
  if (input.expectedInventoryVersion !== state.inventoryVersion) return refuse('stale_inventory');
  if (!own(state.beds, input.bedId)) return refuse('bed_unknown');
  if (own(state.assignments, input.id)) return refuse('duplicate_id');
  if (bedIsHeld(state, input.bedId, input.now)) return refuse('bed_taken');
  if (studentIsPlaced(state, input.studentId, input.now)) return refuse('student_placed');
  const backdated = recordedAfter(state, input.bedId, input.studentId, input.now);
  if (backdated) return refuse(backdated === 'bed' ? 'bed_taken' : 'student_placed');

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
  // A NaN or infinite end would free the bed, since only null counts as open; an end before the start corrupts history.
  if (!Number.isFinite(input.now)) return refuse('invalid_input');
  const a = own(state.assignments, input.assignmentId);
  if (!a) return refuse('assignment_unknown');
  if (input.now < a.startedAt) return refuse('invalid_input');
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
  // Infinity satisfies every expiry comparison, so a non-finite clock would release every hold.
  if (!Number.isFinite(now)) return state;
  const lapsed = Object.values(state.reservations).filter((r) => r.status === 'held' && now >= r.expiresAt);
  if (lapsed.length === 0) return state;
  const reservations = { ...state.reservations };
  for (const r of lapsed) reservations[r.id] = { ...r, status: 'expired' };
  return changed(state, { reservations, assignments: state.assignments });
}
