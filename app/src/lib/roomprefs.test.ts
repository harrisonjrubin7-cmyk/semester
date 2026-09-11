// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { change, markFor, markRead, marks, parse, remember } from './roomprefs';

beforeEach(() => localStorage.clear());

describe('parse', () => {
  it('reads back what was written', () => {
    const raw = JSON.stringify({ 'vu/ECON 1020': { pinned: true, muted: false, read: 'x' } });
    expect(parse(raw)).toEqual({ 'vu/ECON 1020': { pinned: true, muted: false, read: 'x' } });
  });

  it('treats anything it does not recognise as nothing remembered', () => {
    // A room that looks unvisited is the worst this may cost. A chat list that
    // will not draw because of an old key is not.
    expect(parse(null)).toEqual({});
    expect(parse('not json')).toEqual({});
    expect(parse('[]')).toEqual({});
    expect(parse('{"a": 3}')).toEqual({});
    expect(parse('{"a": {"pinned": "yes"}}')).toEqual({ a: { pinned: false, muted: false, read: '' } });
  });
});

describe('change', () => {
  it('leaves the other rooms alone', () => {
    const was = { a: { pinned: true, muted: false, read: '' } };
    const now = change(was, 'b', { muted: true });
    expect(now.a).toEqual(was.a);
    expect(now.b).toEqual({ pinned: false, muted: true, read: '' });
  });

  it('only ever moves a read mark forward', () => {
    // Two tabs on one room would otherwise take turns marking each other
    // unread: the one showing the older message writes its own timestamp and
    // the count comes back.
    const was = { a: { pinned: false, muted: false, read: '2026-09-11T10:00:00Z' } };
    expect(change(was, 'a', { read: '2026-09-11T09:00:00Z' }).a.read).toBe('2026-09-11T10:00:00Z');
    expect(change(was, 'a', { read: '2026-09-11T11:00:00Z' }).a.read).toBe('2026-09-11T11:00:00Z');
  });

  it('keeps the read mark when something else changes', () => {
    const was = { a: { pinned: false, muted: false, read: '2026-09-11T10:00:00Z' } };
    expect(change(was, 'a', { pinned: true }).a).toEqual({
      pinned: true,
      muted: false,
      read: '2026-09-11T10:00:00Z',
    });
  });
});

describe('what the device remembers', () => {
  it('has nothing to say about a room nobody has opened', () => {
    expect(markFor('vu/ECON 1020')).toEqual({ pinned: false, muted: false, read: '' });
    expect(marks()).toEqual({});
  });

  it('keeps a pin across a reload', () => {
    remember('vu/ECON 1020', { pinned: true });
    expect(markFor('vu/ECON 1020').pinned).toBe(true);
    expect(marks()['vu/ECON 1020'].pinned).toBe(true);
  });

  it('hands back the whole set, so the screen can redraw from it', () => {
    remember('a', { pinned: true });
    const all = remember('b', { muted: true });
    expect(Object.keys(all).sort()).toEqual(['a', 'b']);
  });

  it('moves the read mark and no further back', () => {
    markRead('a', '2026-09-11T10:00:00Z');
    markRead('a', '2026-09-11T09:00:00Z');
    expect(markFor('a').read).toBe('2026-09-11T10:00:00Z');
  });
});
