import { describe, expect, it } from 'vitest';
import { ENOUGH_SEEN, OFFER, dayOf, offer, offerable, seenLine, seenShare, unseen } from './unseen';
import type { Visited } from './unseen';

/** Everything visited except the named few. */
const allBut = (...keep: string[]): Visited =>
  Object.fromEntries(
    offerable()
      .map((d) => d.screen)
      .filter((s) => !keep.includes(s))
      .map((s) => [s, true]),
  );

describe('what can be suggested at all', () => {
  it('leaves out the screens that mean nothing arrived at cold', () => {
    // An empty note editor and a search box are reached *through* something.
    // Offered on their own they are a dead end with a heading.
    const screens = offerable().map((d) => d.screen);
    expect(screens).not.toContain('note');
    expect(screens).not.toContain('search');
    expect(screens).not.toContain('edit');
  });

  it('is everything else', () => {
    expect(offerable().length).toBeGreaterThan(25);
  });
});

describe('counting what has been opened', () => {
  it('is everything on a first run', () => {
    expect(unseen({}).length).toBe(offerable().length);
    expect(unseen(undefined).length).toBe(offerable().length);
    expect(seenShare({})).toBe(0);
  });

  it('is nothing once they have been everywhere', () => {
    const been = allBut();
    expect(unseen(been)).toEqual([]);
    expect(seenShare(been)).toBe(1);
    expect(offer(been, 0)).toEqual([]);
  });

  it('ignores a screen that is not offerable', () => {
    // Opening the search box should not count towards having seen the app.
    expect(seenShare({ search: true })).toBe(0);
  });
});

describe('the three it offers', () => {
  it('offers three, from what is left', () => {
    const out = offer({ home: true }, 0);
    expect(out).toHaveLength(OFFER);
    expect(out.map((d) => d.screen)).not.toContain('home');
  });

  it('offers the same three all day, and different ones tomorrow', () => {
    // A panel that changes on every render is one nobody can point at twice;
    // a fixed three are three they learn to ignore together.
    expect(offer({}, 100)).toEqual(offer({}, 100));
    expect(offer({}, 100)).not.toEqual(offer({}, 101));
  });

  it('never offers the same screen twice in one day', () => {
    const out = offer(allBut('maps', 'meals', 'housing', 'runway'), 7);
    expect(new Set(out.map((d) => d.screen)).size).toBe(out.length);
  });

  it('is always three or nothing, never one or two', () => {
    // The two rules interact: by the time fewer than three are left, the
    // student is past the threshold and the panel has already gone. So a
    // half-empty row of suggestions is not a state this can reach — which is
    // worth pinning, because it is the state that would look broken.
    const nearlyAll = allBut('maps', 'meals');
    expect(offer(nearlyAll, 0)).toEqual([]);
    for (const day of [0, 1, 17, 200]) {
      const n = offer({ home: true }, day).length;
      expect(n === 0 || n === OFFER).toBe(true);
    }
  });

  it('stops entirely once they have seen most of the app', () => {
    // Past this it is chrome, and chrome is what people learn to look past —
    // including on the day it has something worth saying.
    const most = offerable()
      .slice(0, Math.ceil(offerable().length * ENOUGH_SEEN))
      .reduce<Visited>((acc, d) => ({ ...acc, [d.screen]: true }), {});
    expect(seenShare(most)).toBeGreaterThanOrEqual(ENOUGH_SEEN);
    expect(offer(most, 0)).toEqual([]);
  });

  it('copes with a day index that is negative or enormous', () => {
    expect(offer({}, -5)).toHaveLength(OFFER);
    expect(offer({}, 9_999_999)).toHaveLength(OFFER);
  });
});

describe('the sentence about it', () => {
  it('says nothing on a first run, when there is nothing to have opened', () => {
    expect(seenLine({})).toBe('');
  });

  it('counts honestly once there is something to count', () => {
    const said = seenLine({ home: true, courses: true });
    expect(said).toMatch(/^You have opened 2 of the \d+ places in here\.$/);
  });

  it('falls silent once they have seen the app', () => {
    expect(seenLine(allBut())).toBe('');
  });
});

describe('the day it rotates on', () => {
  it('is the same all day and different tomorrow', () => {
    expect(dayOf(new Date(2026, 8, 4, 1, 0))).toBe(dayOf(new Date(2026, 8, 4, 23, 59)));
    expect(dayOf(new Date(2026, 8, 5, 0, 1))).toBe(dayOf(new Date(2026, 8, 4, 12, 0)) + 1);
  });
});
