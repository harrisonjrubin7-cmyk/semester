import { describe, expect, it } from 'vitest';
import {
  type AllocationState,
  type Outcome,
  bedIsHeld,
  confirm,
  endAssignment,
  expire,
  initialState,
  override,
  reserve,
} from './allocation';

const HOLD = 1_000;

/** The outcome as a success, or a loud failure that names the refusal. */
function must(o: Outcome): { state: AllocationState; id: string } {
  if (!o.ok) throw new Error(`expected success, got ${o.refusal}`);
  return { state: o.state, id: o.id };
}

function oneBed(): AllocationState {
  return initialState([{ id: 'b1', label: 'Branscomb 214' }]);
}

describe('reserve', () => {
  it('lets only one of two selections for the last bed through', () => {
    const start = oneBed();
    const v = start.inventoryVersion;
    const first = must(
      reserve(start, { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: v, now: 0, holdMs: HOLD }),
    );
    // Second student chose from the same snapshot, so the version is stale.
    const second = reserve(first.state, {
      id: 'r2', key: 'k2', bedId: 'b1', studentId: 'B', expectedInventoryVersion: v, now: 0, holdMs: HOLD,
    });
    expect(second).toEqual({ ok: false, refusal: 'stale_inventory' });
    // Even from a fresh snapshot the bed is taken.
    const fresh = reserve(first.state, {
      id: 'r2', key: 'k2', bedId: 'b1', studentId: 'B', expectedInventoryVersion: first.state.inventoryVersion, now: 0, holdMs: HOLD,
    });
    expect(fresh).toEqual({ ok: false, refusal: 'bed_taken' });
  });

  it('refuses a stale snapshot without changing the state', () => {
    const start = oneBed();
    const moved = must(
      reserve(start, { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    ).state;
    const before = JSON.stringify(moved);
    reserve(moved, { id: 'r9', key: 'k9', bedId: 'b1', studentId: 'C', expectedInventoryVersion: 1, now: 0, holdMs: HOLD });
    expect(JSON.stringify(moved)).toBe(before);
  });

  it('returns the original reservation when the same request is retried', () => {
    const start = oneBed();
    const first = must(
      reserve(start, { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    // The retry carries the old version, which is stale now. The key still wins.
    const retry = must(
      reserve(first.state, { id: 'r1-retry', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 10, holdMs: HOLD }),
    );
    expect(retry.id).toBe('r1');
    expect(retry.state).toBe(first.state);
  });

  it('refuses a reused key that names a different bed or student', () => {
    const first = must(
      reserve(initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]), {
        id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD,
      }),
    );
    const clash = reserve(first.state, {
      id: 'r2', key: 'k1', bedId: 'b2', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD,
    });
    expect(clash).toEqual({ ok: false, refusal: 'idempotency_conflict' });
  });

  it('refuses a student who already holds a bed, for a second bed', () => {
    const base = initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]);
    const held = must(
      reserve(base, { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    const second = reserve(held.state, {
      id: 'r2', key: 'k2', bedId: 'b2', studentId: 'A', expectedInventoryVersion: held.state.inventoryVersion, now: 0, holdMs: HOLD,
    });
    expect(second).toEqual({ ok: false, refusal: 'student_placed' });
  });
});

describe('expiry', () => {
  it('refuses to confirm a hold that ran out during checkout', () => {
    const held = must(
      reserve(oneBed(), { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    const late = confirm(held.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: HOLD });
    expect(late).toEqual({ ok: false, refusal: 'reservation_expired' });
  });

  it('frees a lapsed bed for the next selection once expired', () => {
    const held = must(
      reserve(oneBed(), { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    expect(bedIsHeld(held.state, 'b1', HOLD - 1)).toBe(true);
    const lapsed = expire(held.state, HOLD);
    expect(bedIsHeld(lapsed, 'b1', HOLD)).toBe(false);
    const next = reserve(lapsed, {
      id: 'r2', key: 'k2', bedId: 'b1', studentId: 'B', expectedInventoryVersion: lapsed.inventoryVersion, now: HOLD, holdMs: HOLD,
    });
    expect(next.ok).toBe(true);
  });

  it('leaves the state alone when nothing has lapsed', () => {
    const held = must(
      reserve(oneBed(), { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    expect(expire(held.state, 1)).toBe(held.state);
  });
});

describe('confirm', () => {
  it('turns a live hold into an assignment, and a retry does not duplicate it', () => {
    const held = must(
      reserve(oneBed(), { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    const once = must(confirm(held.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: 5 }));
    const twice = must(confirm(once.state, { id: 'a1-retry', reservationId: 'r1', studentId: 'A', now: 6 }));
    expect(twice.id).toBe('a1');
    expect(Object.keys(twice.state.assignments)).toEqual(['a1']);
  });

  it('refuses a confirmation from someone other than the holder', () => {
    const held = must(
      reserve(oneBed(), { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    expect(confirm(held.state, { id: 'a1', reservationId: 'r1', studentId: 'B', now: 5 })).toEqual({
      ok: false,
      refusal: 'reservation_not_yours',
    });
  });
});

describe('override', () => {
  it('requires a named authority and a rationale', () => {
    const base = oneBed();
    const v = base.inventoryVersion;
    expect(
      override(base, { id: 'o1', bedId: 'b1', studentId: 'A', authority: 'Residence Director', rationale: '  ', expectedInventoryVersion: v, now: 0 }),
    ).toEqual({ ok: false, refusal: 'authority_missing' });
    const done = must(
      override(base, { id: 'o1', bedId: 'b1', studentId: 'A', authority: 'Residence Director', rationale: 'Approved accessible room', expectedInventoryVersion: v, now: 0 }),
    );
    expect(done.state.assignments['o1']).toMatchObject({ source: 'override', authority: 'Residence Director', rationale: 'Approved accessible room' });
  });

  it('cannot double-book a bed that is already assigned', () => {
    const a = must(
      override(oneBed(), { id: 'o1', bedId: 'b1', studentId: 'A', authority: 'RD', rationale: 'x', expectedInventoryVersion: 1, now: 0 }),
    );
    const b = override(a.state, { id: 'o2', bedId: 'b1', studentId: 'B', authority: 'RD', rationale: 'x', expectedInventoryVersion: a.state.inventoryVersion, now: 0 });
    expect(b).toEqual({ ok: false, refusal: 'bed_taken' });
  });

  it('cannot double-book a bed that is held by a live reservation', () => {
    const held = must(
      reserve(oneBed(), { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    const o = override(held.state, { id: 'o1', bedId: 'b1', studentId: 'B', authority: 'RD', rationale: 'x', expectedInventoryVersion: held.state.inventoryVersion, now: 1 });
    expect(o).toEqual({ ok: false, refusal: 'bed_taken' });
  });
});

describe('room change', () => {
  it('keeps the prior assignment on record and frees its bed', () => {
    const base = initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]);
    const held = must(
      reserve(base, { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD }),
    );
    const placed = must(confirm(held.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: 1 }));

    const ended = must(endAssignment(placed.state, { assignmentId: 'a1', expectedInventoryVersion: placed.state.inventoryVersion, now: 2 }));
    expect(ended.state.assignments['a1']).toMatchObject({ bedId: 'b1', endedAt: 2 });
    expect(bedIsHeld(ended.state, 'b1', 2)).toBe(false);

    // A retried end succeeds without changing state.
    const again = must(endAssignment(ended.state, { assignmentId: 'a1', expectedInventoryVersion: 0, now: 3 }));
    expect(again.state).toBe(ended.state);
  });
});

describe('input guards', () => {
  const base = { id: 'r1', key: 'k1', bedId: 'b1', studentId: 'A', expectedInventoryVersion: 1, now: 0, holdMs: HOLD };

  it('refuses an empty key, so keyless requests never share one record', () => {
    expect(reserve(oneBed(), { ...base, key: '  ' })).toEqual({ ok: false, refusal: 'invalid_input' });
  });

  it('refuses a hold that is zero, negative, NaN or infinite', () => {
    for (const holdMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(reserve(oneBed(), { ...base, holdMs })).toEqual({ ok: false, refusal: 'invalid_input' });
    }
  });

  it('does not resolve inherited object keys such as toString as beds', () => {
    expect(reserve(oneBed(), { ...base, bedId: 'toString' })).toEqual({ ok: false, refusal: 'bed_unknown' });
    expect(confirm(oneBed(), { id: 'a1', reservationId: 'constructor', studentId: 'A', now: 0 })).toEqual({
      ok: false,
      refusal: 'reservation_unknown',
    });
    expect(endAssignment(oneBed(), { assignmentId: 'toString', expectedInventoryVersion: 1, now: 0 })).toEqual({
      ok: false,
      refusal: 'assignment_unknown',
    });
  });

  it('refuses a reservation id already in use, instead of overwriting the first hold', () => {
    const first = must(reserve(initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]), base));
    const reused = reserve(first.state, {
      ...base, key: 'k2', bedId: 'b2', studentId: 'B', expectedInventoryVersion: first.state.inventoryVersion,
    });
    expect(reused).toEqual({ ok: false, refusal: 'duplicate_id' });
    expect(first.state.reservations['r1']).toMatchObject({ bedId: 'b1', status: 'held' });
  });

  it('refuses an assignment id already in use, instead of overwriting an active assignment', () => {
    const base2 = initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]);
    const a = must(reserve(base2, base));
    const aConfirmed = must(confirm(a.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: 1 }));
    const b = must(reserve(aConfirmed.state, {
      ...base, id: 'r2', key: 'k2', bedId: 'b2', studentId: 'B', expectedInventoryVersion: aConfirmed.state.inventoryVersion,
    }));
    expect(confirm(b.state, { id: 'a1', reservationId: 'r2', studentId: 'B', now: 2 })).toEqual({
      ok: false,
      refusal: 'duplicate_id',
    });
    expect(b.state.assignments['a1']).toMatchObject({ bedId: 'b1', studentId: 'A' });
  });

  it('refuses an override whose assignment id is already in use', () => {
    const placed = must(override(oneBed(), { id: 'o1', bedId: 'b1', studentId: 'A', authority: 'RD', rationale: 'x', expectedInventoryVersion: 1, now: 0 }));
    const dup = override(placed.state, {
      id: 'o1', bedId: 'b1', studentId: 'B', authority: 'RD', rationale: 'x', expectedInventoryVersion: placed.state.inventoryVersion, now: 0,
    });
    expect(dup).toEqual({ ok: false, refusal: 'duplicate_id' });
  });

  it('refuses a blank assignment id on confirm before it writes anything', () => {
    const held = must(reserve(oneBed(), base));
    expect(confirm(held.state, { id: '  ', reservationId: 'r1', studentId: 'A', now: 1 })).toEqual({
      ok: false,
      refusal: 'invalid_input',
    });
    expect(held.state.reservations['r1']).toMatchObject({ status: 'held', assignmentId: null });
  });

  it('refuses a non-finite clock, including a hold whose expiry overflows to Infinity', () => {
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(reserve(oneBed(), { ...base, now })).toEqual({ ok: false, refusal: 'invalid_input' });
      expect(override(oneBed(), { id: 'o1', bedId: 'b1', studentId: 'A', authority: 'RD', rationale: 'x', expectedInventoryVersion: 1, now })).toEqual({
        ok: false,
        refusal: 'invalid_input',
      });
    }
    expect(reserve(oneBed(), { ...base, now: Number.MAX_VALUE, holdMs: Number.MAX_VALUE })).toEqual({
      ok: false,
      refusal: 'invalid_input',
    });
    const held = must(reserve(oneBed(), base));
    expect(confirm(held.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: Number.NaN })).toEqual({
      ok: false,
      refusal: 'invalid_input',
    });
  });

  it('refuses a reused key that asks for a different hold length, instead of returning the first hold', () => {
    const held = must(reserve(oneBed(), base));
    expect(reserve(held.state, { ...base, id: 'r1-retry', holdMs: HOLD * 2, now: 10 })).toEqual({
      ok: false,
      refusal: 'idempotency_conflict',
    });
  });

  it('refuses a hold too small to move the expiry past now, which would never be live', () => {
    expect(reserve(oneBed(), { ...base, now: 1_000_000_000_000, holdMs: Number.MIN_VALUE })).toEqual({
      ok: false,
      refusal: 'invalid_input',
    });
  });

  it('refuses a blank student id on reserve and override, so unowned holds never exist', () => {
    expect(reserve(oneBed(), { ...base, studentId: '  ' })).toEqual({ ok: false, refusal: 'invalid_input' });
    expect(override(oneBed(), { id: 'o1', bedId: 'b1', studentId: '', authority: 'RD', rationale: 'x', expectedInventoryVersion: 1, now: 0 })).toEqual({
      ok: false,
      refusal: 'invalid_input',
    });
  });

  it('refuses to end an assignment at a non-finite clock or before it started', () => {
    const placed = must(override(oneBed(), { id: 'o1', bedId: 'b1', studentId: 'A', authority: 'RD', rationale: 'x', expectedInventoryVersion: 1, now: 100 }));
    const v = placed.state.inventoryVersion;
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, 50]) {
      expect(endAssignment(placed.state, { assignmentId: 'o1', expectedInventoryVersion: v, now })).toEqual({
        ok: false,
        refusal: 'invalid_input',
      });
    }
    expect(placed.state.assignments['o1']).toMatchObject({ endedAt: null });
  });

  it('refuses to expire at a non-finite clock, which would release every hold', () => {
    const held = must(reserve(oneBed(), base));
    expect(expire(held.state, Number.POSITIVE_INFINITY)).toBe(held.state);
    expect(held.state.reservations['r1']).toMatchObject({ status: 'held' });
  });

  it('refuses a confirmation timestamped before its reservation was created', () => {
    const held = must(reserve(oneBed(), { ...base, now: 100 }));
    expect(confirm(held.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: 50 })).toEqual({
      ok: false,
      refusal: 'invalid_input',
    });
  });

  it('refuses a late confirmation of a lapsed hold once another reservation has taken the bed', () => {
    const first = must(reserve(oneBed(), base));
    const second = must(reserve(first.state, {
      ...base, id: 'r2', key: 'k2', studentId: 'B', expectedInventoryVersion: first.state.inventoryVersion, now: HOLD + 10,
    }));
    // r1's hold ended at HOLD; a confirmation stamped just before that must not seat A beside B.
    expect(confirm(second.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: HOLD - 1 })).toEqual({
      ok: false,
      refusal: 'bed_taken',
    });
  });

  it('refuses a late confirmation once the same student has reserved another bed', () => {
    const first = must(reserve(initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]), base));
    const second = must(reserve(first.state, {
      ...base, id: 'r2', key: 'k2', bedId: 'b2', expectedInventoryVersion: first.state.inventoryVersion, now: HOLD + 10,
    }));
    expect(confirm(second.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: HOLD - 1 })).toEqual({
      ok: false,
      refusal: 'student_placed',
    });
  });

  it('refuses a late confirmation once the student has been placed elsewhere', () => {
    const held = must(reserve(initialState([{ id: 'b1', label: 'x' }, { id: 'b2', label: 'y' }]), base));
    const placed = must(override(held.state, {
      id: 'o1', bedId: 'b2', studentId: 'A', authority: 'RD', rationale: 'x',
      expectedInventoryVersion: held.state.inventoryVersion, now: HOLD + 10,
    }));
    expect(confirm(placed.state, { id: 'a1', reservationId: 'r1', studentId: 'A', now: HOLD - 1 })).toEqual({
      ok: false,
      refusal: 'student_placed',
    });
  });
});
