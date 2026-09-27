import { describe, expect, it } from 'vitest';
import { PUSH_SETTLE_MS, SYNC_WORDS, pushWait, retriesOnItsOwn, waiting } from './syncstatus';
import { DEFAULT_PERSISTED, sameFields } from '../state/shape';

/**
 * The words for each sync state, and the edit signal the states depend on.
 */

describe('SYNC_WORDS', () => {
  const statuses = Object.keys(SYNC_WORDS) as (keyof typeof SYNC_WORDS)[];

  it('names the three states the spec asked for', () => {
    expect(statuses).toEqual(expect.arrayContaining(['offline', 'queued', 'conflict']));
  });

  it('gives every state its own word on the Settings row', () => {
    // Two states sharing a word are one state as far as anybody reading it
    // can tell — which is what the old fallbacks did to all three new ones.
    const standing = statuses.map((s) => SYNC_WORDS[s].standing);
    expect(new Set(standing).size).toBe(standing.length);
  });

  it('says in the sentence that nothing is lost, for every state with work waiting', () => {
    for (const s of statuses.filter(waiting)) {
      expect(SYNC_WORDS[s].sentence).toMatch(/saved on this device|nothing has been overwritten/i);
    }
  });
});

describe('sameFields', () => {
  it('is true for two picks of the same state — the control', () => {
    expect(sameFields(DEFAULT_PERSISTED, { ...DEFAULT_PERSISTED })).toBe(true);
  });

  it('is false when one field is a new value', () => {
    expect(sameFields(DEFAULT_PERSISTED, { ...DEFAULT_PERSISTED, tasks: [] })).toBe(false);
  });

  it('is false for equal content under a new reference, which is how the reducer says "changed"', () => {
    // Deliberately by reference: the reducer only replaces what it changes,
    // so a new reference is a change and comparing contents would be work
    // for no answer.
    expect(sameFields(DEFAULT_PERSISTED, { ...DEFAULT_PERSISTED, notes: [...DEFAULT_PERSISTED.notes] })).toBe(false);
  });
});

describe('retriesOnItsOwn', () => {
  it('goes again for what the network or the service did', () => {
    expect(retriesOnItsOwn('INTERNAL_ERROR')).toBe(true);
    expect(retriesOnItsOwn('INTEGRATION_UNAVAILABLE')).toBe(true);
    expect(retriesOnItsOwn('RATE_LIMITED')).toBe(true);
  });

  it('does not loop against a refusal', () => {
    expect(retriesOnItsOwn('AUTH_REQUIRED')).toBe(false);
    expect(retriesOnItsOwn('PERMISSION_DENIED')).toBe(false);
    expect(retriesOnItsOwn('NOT_FOUND')).toBe(false);
  });

  it('does not resend a copy the server called invalid, though a person may retry one', () => {
    // The one place this departs from `FAILURES[code].retry`.
    expect(retriesOnItsOwn('VALIDATION_ERROR')).toBe(false);
  });
});

describe('pushWait', () => {
  it('is the settle time when nothing has gone wrong — the control', () => {
    expect(pushWait(0, 0)).toBe(PUSH_SETTLE_MS);
  });

  it('doubles per failure, up to five minutes', () => {
    expect(pushWait(0, 1)).toBe(5_000);
    expect(pushWait(0, 2)).toBe(10_000);
    expect(pushWait(0, 20)).toBe(300_000);
  });

  it('doubles per lost race, up to a minute', () => {
    expect(pushWait(1, 0)).toBe(5_000);
    expect(pushWait(20, 0)).toBe(60_000);
  });

  it('takes the longer of the two when both are counting', () => {
    expect(pushWait(20, 20)).toBe(300_000);
  });
});
