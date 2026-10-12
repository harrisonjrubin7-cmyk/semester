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
    expect(localStorage.getItem(CARRIED_KEY)).toBeNull();
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
});
