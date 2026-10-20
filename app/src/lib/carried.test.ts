// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERSISTED } from '../state/shape';
import { CARRIED_BASELINE, CARRIED_KEY, carriedInStep, forgetCarried, rememberCarried, unknownFields, withCarried } from './carried';

/*
 * A field a newer build wrote goes back up with this build's push.
 *
 * Found reviewing #1501: an older device pulled a copy holding `repairs`,
 * could not name the field, left it out of its next push, and the push
 * replaced the account's row — every repair gone, from a device that never
 * opened Housing.
 */
const known = new Set(['notes', 'tasks', 'role']);

afterEach(() => {
  forgetCarried();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('fields this build cannot read', () => {
  it('keeps only what this build does not know', () => {
    expect(unknownFields({ notes: [], repairs: [{ id: 'm' }], later: 1 }, known)).toEqual({
      repairs: [{ id: 'm' }],
      later: 1,
    });
  });

  it('puts them back on the way up, and never over a field the push holds', () => {
    rememberCarried('u1', { notes: ['old'], repairs: [{ id: 'm' }] }, known);
    const out = withCarried('u1', { notes: ['new'], tasks: [] });
    expect(out).toEqual({ notes: ['new'], tasks: [], repairs: [{ id: 'm' }] });
    const own = withCarried('u1', { notes: [], repairs: [] });
    expect(own.repairs, 'the outgoing copy wins a key it holds').toEqual([]);
  });

  it('carries nothing into another account', () => {
    rememberCarried('u1', { repairs: [{ id: 'm' }] }, known);
    expect(withCarried('u2', { notes: [] })).toEqual({ notes: [] });
  });

  it('outlives a reload, and is forgotten with the rest of the sync memory', () => {
    rememberCarried('u1', { repairs: [{ id: 'm' }] }, known);
    expect(JSON.parse(localStorage.getItem(CARRIED_KEY)!).fields).toEqual({ repairs: [{ id: 'm' }] });
    forgetCarried();
    expect(localStorage.getItem(CARRIED_KEY)).toBeNull();
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
  });

  it('follows the account: a pull with nothing unknown carries nothing after it', () => {
    rememberCarried('u1', { repairs: [{ id: 'm' }] }, known);
    rememberCarried('u1', { notes: [] }, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
    expect(JSON.parse(localStorage.getItem(CARRIED_KEY)!).fields, 'stored as empty, so another tab reads it too').toEqual({});
    rememberCarried('u1', null, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
  });

  it('still carries for this session when the browser refuses to store it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    rememberCarried('u1', { repairs: [{ id: 'm' }] }, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], repairs: [{ id: 'm' }] });
  });

  // Found reviewing 60dd44c: after a refused write, the stale stored copy was
  // read first, and the push put old values back over newer ones.
  it('carries this session\u2019s pull over an older stored one a failed write left behind', () => {
    rememberCarried('u1', { later: 'old' }, known, '2026-10-12T10:00:00Z');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    rememberCarried('u1', { later: 'new' }, known, '2026-10-12T10:01:00Z');
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
    rememberCarried('u1', { notes: [] }, known, '2026-10-12T10:02:00Z');
    expect(withCarried('u1', { notes: [] }), 'a field the account dropped stays dropped').toEqual({ notes: [] });
    forgetCarried();
    expect(withCarried('u1', { notes: [] }), 'and a forget a blocked removal could not finish holds').toEqual({ notes: [] });
  });

  // Found reviewing c714dc3 and bffd8da: another open tab stored a copy from
  // a newer account version, and this tab's older one won — first because
  // memory always won, then because its slower pull finished later.
  describe('with another tab open on the same account', () => {
    const v1 = '2026-10-12T10:00:00.000+00:00';
    const v2 = '2026-10-12T10:05:00.000+00:00';
    async function otherTab() {
      vi.resetModules();
      return import('./carried');
    }

    it('takes the copy the other tab stored from a newer account version', async () => {
      rememberCarried('u1', { later: 'old' }, known, v1);
      (await otherTab()).rememberCarried('u1', { later: 'new' }, known, v2);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
    });

    it('drops a field the other tab\u2019s newer version no longer has', async () => {
      rememberCarried('u1', { later: 'old' }, known, v1);
      (await otherTab()).rememberCarried('u1', { notes: [] }, known, v2);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
    });

    // Found reviewing afe376f: the database keeps microseconds, and two
    // versions in the same millisecond tied, so the older memory stood.
    it('tells apart two versions in the same millisecond', async () => {
      rememberCarried('u1', { later: 'old' }, known, '2026-10-12T10:00:00.123100+00:00');
      (await otherTab()).rememberCarried('u1', { later: 'new' }, known, '2026-10-12T10:00:00.123900+00:00');
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
    });

    it('keeps the newer version when this tab\u2019s slower pull of an older one lands last', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      (await otherTab()).rememberCarried('u1', { later: 'new' }, known, v2);
      vi.advanceTimersByTime(5_000);
      rememberCarried('u1', { later: 'old' }, known, v1);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
      vi.useRealTimers();
    });

    // Found reviewing 36c7453: a newer build knows the field this one carries,
    // so the copy it stored left the field out, and this tab took that copy.
    it('takes a field from a newer build’s copy even though that build knows it', async () => {
      rememberCarried('u1', { later: 'old' }, known, v1);
      (await otherTab()).rememberCarried('u1', { later: 'new' }, new Set([...known, 'later']), v2);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
    });

    it('never puts back a field this build knows and left out, from an older build’s copy', async () => {
      rememberCarried('u1', { later: 'mine' }, new Set([...known, 'later']), v1);
      (await otherTab()).rememberCarried('u1', { later: 'theirs' }, known, v2);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
    });
  });

  it('holds back only fields every build from this one on can read', () => {
    const persisted = new Set([...Object.keys(DEFAULT_PERSISTED), 'courses']);
    expect([...CARRIED_BASELINE].filter((f) => !persisted.has(f)), 'retire a field here only on purpose').toEqual([]);
  });

  // Found reviewing f31ef80: a pull that finds no state row stored its empty
  // copy at version 0, so the copy from the row before outranked it and the
  // next push put the removed fields back.
  it('lets a pull that finds no state row clear the copy from the row before', () => {
    rememberCarried('u1', { later: 'old' }, known, '2026-10-12T10:00:00.000+00:00');
    rememberCarried('u1', null, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
  });

  it('clears it even when storage refuses the empty copy', () => {
    rememberCarried('u1', { later: 'old' }, known, '2026-10-12T10:00:00.000+00:00');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    rememberCarried('u1', null, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
  });

  it('says when storage refused the copy memory holds, until a write lands', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    rememberCarried('u1', { later: 1 }, known, '2026-10-12T10:00:00.000+00:00');
    expect(carriedInStep()).toBe(false);
    spy.mockRestore();
    rememberCarried('u1', { later: 2 }, known, '2026-10-12T10:05:00.000+00:00');
    expect(carriedInStep()).toBe(true);
  });

  // Found reviewing 80dce17: `onb` was persisted but missing here, so the first
  // build to retire it would have read it as unknown and pushed it back forever.
  // A field added after the baseline goes in this list, never in the baseline.
  const ADDED_AFTER_BASELINE: string[] = [];
  it('holds back every field this build persists', () => {
    const persisted = [...Object.keys(DEFAULT_PERSISTED), 'courses'];
    expect(persisted.filter((f) => !CARRIED_BASELINE.has(f) && !ADDED_AFTER_BASELINE.includes(f))).toEqual([]);
  });

  // Found reviewing df5dd87: after an account switch whose storage writes were
  // refused, the old account's later-stamped copy outranked the new account's
  // memory, failed the account check, and the push went up without its fields.
  it('never lets another account\u2019s stored copy outrank this account\u2019s memory', () => {
    rememberCarried('u1', { theirs: 1 }, known, '2026-10-12T10:05:00Z');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    rememberCarried('u2', { mine: 2 }, known, '2026-10-12T10:00:00Z');
    expect(withCarried('u2', { notes: [] })).toEqual({ notes: [], mine: 2 });
  });

  it('reads the stored copy after a reload', async () => {
    rememberCarried('u1', { later: 1 }, known);
    vi.resetModules();
    const fresh = await import('./carried');
    expect(fresh.withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 1 });
  });
});
