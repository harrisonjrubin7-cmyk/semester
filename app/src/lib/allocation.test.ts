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
