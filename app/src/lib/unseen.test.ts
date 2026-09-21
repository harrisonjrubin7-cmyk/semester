import { describe, expect, it } from 'vitest';
import { ENOUGH_SEEN, OFFER, dayOf, offer, offerable, seenLine, seenShare, unseen } from './unseen';
import type { Visited } from './unseen';
import { DESTINATIONS } from './nav';

/**
 * The whole registry, named here rather than defaulted in `unseen.ts`.
 *
 * These tests are about the rotation and the counting rather than about who is
 * holding the phone, so the ungated registry is the right pool *for them* —
 * and that sentence is the reason this constant exists instead of a default
 * parameter. The default said it silently, on behalf of every caller, and the
 * callers it was wrong for were the real ones.
 */
const ALL = DESTINATIONS;

/** Everything visited except the named few. */
const allBut = (...keep: string[]): Visited =>
  Object.fromEntries(
    offerable(ALL)
      .map((d) => d.screen)
      .filter((s) => !keep.includes(s))
      .map((s) => [s, true]),
  );

describe('what can be suggested at all', () => {
  it('leaves out the screens that mean nothing arrived at cold', () => {
    // An empty note editor and a course detail with no course chosen are
    // reached *through* something. Offered on their own they are a dead end
    // with a heading.
    const screens = offerable(ALL).map((d) => d.screen);
    expect(screens).not.toContain('note');
    expect(screens).not.toContain('edit');
  });

  it('is everything else', () => {
    expect(offerable(ALL).length).toBeGreaterThan(25);
  });
});

describe('counting what has been opened', () => {
  it('is everything on a first run', () => {
    expect(unseen({}, ALL).length).toBe(offerable(ALL).length);
    expect(unseen(undefined, ALL).length).toBe(offerable(ALL).length);
    expect(seenShare({}, ALL)).toBe(0);
  });

  it('is nothing once they have been everywhere', () => {
    const been = allBut();
    expect(unseen(been, ALL)).toEqual([]);
    expect(seenShare(been, ALL)).toBe(1);
    expect(offer(been, 0, ALL)).toEqual([]);
  });

  it('ignores a screen that is not offerable', () => {
    // Opening the search box should not count towards having seen the app.
    expect(seenShare({ search: true }, ALL)).toBe(0);
  });
});

describe('the three it offers', () => {
  it('offers three, from what is left', () => {
    const out = offer({ home: true }, 0, ALL);
    expect(out).toHaveLength(OFFER);
    expect(out.map((d) => d.screen)).not.toContain('home');
  });

  it('offers the same three all day, and different ones tomorrow', () => {
    // A panel that changes on every render is one nobody can point at twice;
    // a fixed three are three they learn to ignore together.
    expect(offer({}, 100, ALL)).toEqual(offer({}, 100, ALL));
    expect(offer({}, 100, ALL)).not.toEqual(offer({}, 101, ALL));
  });

  it('never offers the same screen twice in one day', () => {
    const out = offer(allBut('maps', 'meals', 'housing', 'runway'), 7, ALL);
    expect(new Set(out.map((d) => d.screen)).size).toBe(out.length);
  });

  it('is always three or nothing, never one or two', () => {
    // The two rules interact: by the time fewer than three are left, the
    // student is past the threshold and the panel has already gone. So a
    // half-empty row of suggestions is not a state this can reach — which is
    // worth pinning, because it is the state that would look broken.
    const nearlyAll = allBut('maps', 'meals');
    expect(offer(nearlyAll, 0, ALL)).toEqual([]);
    for (const day of [0, 1, 17, 200]) {
      const n = offer({ home: true }, day, ALL).length;
      expect(n === 0 || n === OFFER).toBe(true);
    }
  });

  it('stops entirely once they have seen most of the app', () => {
    // Past this it is chrome, and chrome is what people learn to look past —
    // including on the day it has something worth saying.
    const most = offerable(ALL)
      .slice(0, Math.ceil(offerable(ALL).length * ENOUGH_SEEN))
      .reduce<Visited>((acc, d) => ({ ...acc, [d.screen]: true }), {});
    expect(seenShare(most, ALL)).toBeGreaterThanOrEqual(ENOUGH_SEEN);
    expect(offer(most, 0, ALL)).toEqual([]);
  });

  it('copes with a day index that is negative or enormous', () => {
    expect(offer({}, -5, ALL)).toHaveLength(OFFER);
    expect(offer({}, 9_999_999, ALL)).toHaveLength(OFFER);
  });
});

describe('the sentence about it', () => {
  it('says nothing on a first run, when there is nothing to have opened', () => {
    expect(seenLine({}, ALL)).toBe('');
  });

  it('counts honestly once there is something to count', () => {
    const said = seenLine({ home: true, courses: true }, ALL);
    expect(said).toMatch(/^You have opened 2 of the \d+ places in here\.$/);
  });

  it('falls silent once they have seen the app', () => {
    expect(seenLine(allBut(), ALL)).toBe('');
  });
});

describe('the day it rotates on', () => {
  it('is the same all day and different tomorrow', () => {
    expect(dayOf(new Date(2026, 8, 4, 1, 0))).toBe(dayOf(new Date(2026, 8, 4, 23, 59)));
    expect(dayOf(new Date(2026, 8, 5, 0, 1))).toBe(dayOf(new Date(2026, 8, 4, 12, 0)) + 1);
  });
});

/**
 * The default, gone, and held gone by the compiler rather than by a reader.
 *
 * `offerable` defaulted its pool to `DESTINATIONS` — the registry before the
 * school gate, the role gate or `lib/reveal.ts` have said anything. The
 * twenty-first pass fixed the one caller and wrote the rest down: *"if a
 * second caller ever appears it will get the registry unless it says
 * otherwise, which is the shape of the fault this pass just fixed."* Three
 * passes carried that line.
 *
 * ## `@ts-expect-error` is the assertion, not a suppression
 *
 * It is the repository's first, and it earns the exception by being the only
 * instrument that fails in the right direction. A directive that expects an
 * error is an error itself when the error does not happen — so each of these
 * lines is red today if the pool is optional, and red tomorrow if a default
 * comes back. A test asserting `fn.length` would catch a restored default and
 * miss a bare `pool?: Destination[]`; a grep over the source would be the
 * fourth probe this file's audit has thrown away for reading text instead of
 * asking the thing itself.
 *
 * `tsc -b` covers `src`, tests included, so these run on the types gate rather
 * than this one. Vitest only needs the file to have a case in it.
 */
describe('the pool has to be said out loud', () => {
  it('will not compile a call that leaves it out', () => {
    // @ts-expect-error - offerable requires a pool; the registry is not a default
    expect(() => offerable()).toBeTypeOf('function');
    // @ts-expect-error - unseen requires a pool
    expect(() => unseen({})).toBeTypeOf('function');
    // @ts-expect-error - seenShare requires a pool
    expect(() => seenShare({})).toBeTypeOf('function');
    // @ts-expect-error - offer requires a pool
    expect(() => offer({}, 0)).toBeTypeOf('function');
    // @ts-expect-error - seenLine requires a pool
    expect(() => seenLine({})).toBeTypeOf('function');
  });
});
