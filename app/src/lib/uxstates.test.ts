import { describe, expect, it } from 'vitest';
import {
  SYNC_POLICY,
  UX_STATES,
  emptyStateFor,
  mayShowBeforeConfirmed,
  sortStates,
  type SyncObject,
} from './uxstates';

describe('the state matrix', () => {
  it('has one row per id', () => {
    const ids = UX_STATES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never lets something that needs the system of record claim to work offline', () => {
    for (const r of UX_STATES) {
      if (r.requiresServerConfirmation) expect(r.supportsOffline, r.id).toBe(false);
    }
  });

  it('interrupts a screen reader only for errors, blocks and the moments that need a decision', () => {
    for (const r of UX_STATES.filter((x) => x.announcement === 'assertive')) {
      expect(['error', 'warning', 'success'], r.id).toContain(r.severity);
    }
  });

  it('covers every category the brief names', () => {
    const have = new Set(UX_STATES.map((r) => r.category));
    for (const c of ['loading', 'first-use', 'zero', 'search', 'offline', 'sync', 'conflict', 'draft', 'stale', 'ai'] as const) {
      expect(have.has(c), c).toBe(true);
    }
  });
});

describe('sortStates', () => {
  it('sorts on a column both ways and filters by category', () => {
    const up = sortStates(UX_STATES, 'state');
    const down = sortStates(UX_STATES, 'state', 'desc');
    expect(up.map((r) => r.id)).toEqual([...down].reverse().map((r) => r.id));
    expect(up[0].state.localeCompare(up[1].state)).toBeLessThanOrEqual(0);
    const sync = sortStates(UX_STATES, 'id', 'asc', 'sync');
    expect(sync.length).toBeGreaterThan(0);
    expect(sync.every((r) => r.category === 'sync')).toBe(true);
  });

  it('does not reorder the table it was given', () => {
    const before = UX_STATES.map((r) => r.id);
    sortStates(UX_STATES, 'severity', 'desc');
    expect(UX_STATES.map((r) => r.id)).toEqual(before);
  });
});

describe('sync policy', () => {
  it('never shows an official change before the server confirms it', () => {
    for (const o of ['registration', 'financial-aid', 'accommodation', 'official-record', 'appointment-booking', 'data-export-or-delete', 'registration-plan'] as SyncObject[]) {
      expect(mayShowBeforeConfirmed(o), o).toBe(false);
    }
  });

  it('shows personal, reversible work at once', () => {
    for (const o of ['personal-action', 'personal-note', 'study-plan', 'preference'] as SyncObject[]) {
      expect(mayShowBeforeConfirmed(o), o).toBe(true);
    }
  });

  it('gives every object a conflict rule', () => {
    for (const [k, p] of Object.entries(SYNC_POLICY)) expect(p.conflict.length, k).toBeGreaterThan(0);
  });
});

describe('emptyStateFor', () => {
  it('answers each reason on its own', () => {
    expect(emptyStateFor({ loading: true })).toBe('loading');
    expect(emptyStateFor({ failed: true })).toBe('error');
    expect(emptyStateFor({ sourceDown: true })).toBe('source-unavailable');
    expect(emptyStateFor({ allowed: false })).toBe('no-permission');
    expect(emptyStateFor({ setUp: false })).toBe('no-setup');
    expect(emptyStateFor({ filtered: true, everHad: true })).toBe('no-results');
    expect(emptyStateFor({})).toBe('first-use');
    expect(emptyStateFor({ everHad: true })).toBe('complete');
  });

  it('says "complete" only once every other reason is ruled out', () => {
    const reasons = [{ loading: true }, { failed: true }, { sourceDown: true }, { allowed: false }, { setUp: false }, { filtered: true }];
    for (const r of reasons) expect(emptyStateFor({ ...r, everHad: true })).not.toBe('complete');
  });

  it('waits for loading before believing anything else', () => {
    expect(emptyStateFor({ loading: true, failed: true, allowed: false, filtered: true })).toBe('loading');
  });
});
