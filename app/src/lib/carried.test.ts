// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARRIED_KEY, forgetCarried, rememberCarried, unknownFields, withCarried } from './carried';

/*
 * A field a newer build wrote goes back up with this build's push.
 *
 * Found reviewing #1501: an older device pulled a copy holding `maintenance`,
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
    expect(unknownFields({ notes: [], maintenance: [{ id: 'm' }], later: 1 }, known)).toEqual({
      maintenance: [{ id: 'm' }],
      later: 1,
    });
  });

  it('puts them back on the way up, and never over a field the push holds', () => {
    rememberCarried('u1', { notes: ['old'], maintenance: [{ id: 'm' }] }, known);
    const out = withCarried('u1', { notes: ['new'], tasks: [] });
    expect(out).toEqual({ notes: ['new'], tasks: [], maintenance: [{ id: 'm' }] });
    const own = withCarried('u1', { notes: [], maintenance: [] });
    expect(own.maintenance, 'the outgoing copy wins a key it holds').toEqual([]);
  });

  it('carries nothing into another account', () => {
    rememberCarried('u1', { maintenance: [{ id: 'm' }] }, known);
    expect(withCarried('u2', { notes: [] })).toEqual({ notes: [] });
  });

  it('outlives a reload, and is forgotten with the rest of the sync memory', () => {
    rememberCarried('u1', { maintenance: [{ id: 'm' }] }, known);
    expect(JSON.parse(localStorage.getItem(CARRIED_KEY)!).fields).toEqual({ maintenance: [{ id: 'm' }] });
    forgetCarried();
    expect(localStorage.getItem(CARRIED_KEY)).toBeNull();
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
  });

  it('follows the account: a pull with nothing unknown carries nothing after it', () => {
    rememberCarried('u1', { maintenance: [{ id: 'm' }] }, known);
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
    rememberCarried('u1', { maintenance: [{ id: 'm' }] }, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], maintenance: [{ id: 'm' }] });
  });

  // Found reviewing 60dd44c: after a refused write, the stale stored copy was
  // read first, and the push put old values back over newer ones.
  it('carries this session\u2019s pull over an older stored one a failed write left behind', () => {
    rememberCarried('u1', { later: 'old' }, known);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    rememberCarried('u1', { later: 'new' }, known);
    expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
    rememberCarried('u1', { notes: [] }, known);
    expect(withCarried('u1', { notes: [] }), 'a field the account dropped stays dropped').toEqual({ notes: [] });
    forgetCarried();
    expect(withCarried('u1', { notes: [] }), 'and a forget a blocked removal could not finish holds').toEqual({ notes: [] });
  });

  // Found reviewing c714dc3: another open tab pulled a newer copy and stored
  // it, and this tab's older memory still won, putting stale values back up.
  describe('with another tab open on the same account', () => {
    async function otherTab() {
      vi.advanceTimersByTime(1_000);
      vi.resetModules();
      return import('./carried');
    }

    it('takes the newer copy the other tab stored over this tab\u2019s older one', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      rememberCarried('u1', { later: 'old' }, known);
      (await otherTab()).rememberCarried('u1', { later: 'new' }, known);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 'new' });
      vi.useRealTimers();
    });

    it('drops a field the other tab\u2019s newer pull found gone', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      rememberCarried('u1', { later: 'old' }, known);
      (await otherTab()).rememberCarried('u1', { notes: [] }, known);
      expect(withCarried('u1', { notes: [] })).toEqual({ notes: [] });
      vi.useRealTimers();
    });
  });

  it('reads the stored copy after a reload', async () => {
    rememberCarried('u1', { later: 1 }, known);
    vi.resetModules();
    const fresh = await import('./carried');
    expect(fresh.withCarried('u1', { notes: [] })).toEqual({ notes: [], later: 1 });
  });
});
