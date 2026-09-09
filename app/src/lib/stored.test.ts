import { describe, expect, it } from 'vitest';
import { readIncoming, readList, readModule, readWindow } from './stored';
import { buildCatalog } from '../data/catalog';
import { hoursOn } from './windows';
import type { CourseModule } from './types';

/**
 * The two rows that took the whole document down.
 *
 * Measured against the running app, one damaged row at a time in one list at
 * a time, across twenty routes and twenty-eight lists. Two were not one
 * screen's error boundary but an uncaught TypeError and an empty `#root`:
 *
 *     courses   #/home     Cannot read properties of undefined (reading 'map')
 *     windows   #/behind   Cannot read properties of undefined (reading 'includes')
 *
 * After: 0 of 30, the extra two being the same lists with every field present
 * and every one the wrong type.
 */
const damaged = (extra: Record<string, unknown> = {}) =>
  ({ course: { id: 'c1', term: '2026FA' }, ...extra }) as unknown;

describe('a course read out of storage', () => {
  it('survives the catalogue being built from it', () => {
    const mod = readModule(damaged());
    expect(mod).not.toBeNull();
    // The actual crash: `modules.flatMap((m) => m.items.map(...))`.
    expect(() => buildCatalog([mod as CourseModule])).not.toThrow();
  });

  it('guarantees every field the catalogue walks', () => {
    const mod = readModule(damaged()) as CourseModule;
    expect(Array.isArray(mod.items)).toBe(true);
    expect(Array.isArray(mod.schedule)).toBe(true);
    expect(Array.isArray(mod.guide.units)).toBe(true);
    expect(Array.isArray(mod.course.grading)).toBe(true);
    // Split in two places to make the filter chips.
    expect(() => mod.course.code.split(/\s+/)).not.toThrow();
  });

  it('replaces a field of the wrong type rather than trusting it', () => {
    // A string has a `length`, which is how `lib/generate.ts` says its own
    // guard on the guide let one through.
    const mod = readModule(
      damaged({ items: 'x', schedule: 7, guide: 'oops' }),
    ) as CourseModule;
    expect(mod.items).toEqual([]);
    expect(mod.schedule).toEqual([]);
    expect(mod.guide.units).toEqual([]);
  });

  it('keeps everything it can rather than narrowing to what it knows', () => {
    // The opposite of `justTheCourse`, and on purpose: nothing leaves the
    // device here, and `lib/migrate.ts` says a copy from a newer build is read
    // for what is recognised and the rest ignored — not deleted on next save.
    const mod = readModule(
      damaged({ items: [{ id: 'i1' }], somethingAddedLater: 'keep me' }),
    ) as unknown as Record<string, unknown>;
    expect(mod.somethingAddedLater).toBe('keep me');
    expect(mod.items).toHaveLength(1);
  });

  it('drops only a course that cannot be addressed at all', () => {
    // No id means no way to open it, and indexing by `undefined` would make
    // two damaged courses overwrite each other in `byId`.
    expect(readModule({ course: {} })).toBeNull();
    expect(readModule({})).toBeNull();
    expect(readModule('not a course')).toBeNull();
    expect(readModule(null)).toBeNull();
    // But a course with an id and nothing else is kept, because it is
    // somebody's data and it can be shown and edited.
    expect(readModule({ course: { id: 'c1' } })).not.toBeNull();
  });
});

describe('a study window read out of storage', () => {
  it('never takes the hour arithmetic down', () => {
    const w = readWindow({ id: 'w1' });
    expect(w).not.toBeNull();
    // `hoursOn` filters on `w.days.includes(day)`, and every hour figure in
    // the week ahead comes off that.
    expect(() => hoursOn([w!], 1)).not.toThrow();
    expect(hoursOn([w!], 1)).toBe(0);
  });

  it('keeps only the days that are days', () => {
    const w = readWindow({ id: 'w1', days: [1, 'tue', null, 3] });
    expect(w!.days).toEqual([1, 3]);
  });

  it('refuses a number that is not one', () => {
    // NaN through `from`/`to` makes every downstream figure NaN, and NaN is
    // drawn rather than caught.
    const w = readWindow({ id: 'w1', days: [1], from: 'x', to: null });
    expect(Number.isFinite(w!.from)).toBe(true);
    expect(Number.isFinite(w!.to)).toBe(true);
    expect(hoursOn([w!], 1)).toBe(0);
  });

  it('drops a window with no id', () => {
    expect(readWindow({ days: [1] })).toBeNull();
  });
});

describe('every door, through one reader', () => {
  it('reads both lists wherever a blob arrives', () => {
    const out = readIncoming({
      courses: [damaged(), { course: {} }],
      windows: [{ id: 'w1' }, { label: 'no id' }],
    }) as { courses: unknown[]; windows: unknown[] };
    // The addressable one of each pair survives; the other is dropped.
    expect(out.courses).toHaveLength(1);
    expect(out.windows).toHaveLength(1);
  });

  it('leaves a partial partial', () => {
    // `restore` replaces exactly what the copy held. A copy taken before a
    // field existed carries no key for it, and emptying a setting somebody
    // never chose to revert would be its own kind of data loss.
    const out = readIncoming({ notes: [{ id: 'n1' }] });
    expect('courses' in out).toBe(false);
    expect('windows' in out).toBe(false);
  });

  it('empties a list that is not a list, rather than passing it through', () => {
    const out = readIncoming({ courses: 'none' } as Record<string, unknown>) as {
      courses: unknown[];
    };
    expect(out.courses).toEqual([]);
  });

  it('reads a list through whichever reader it is given', () => {
    expect(readList([{ id: 'w1' }, null, { nope: 1 }], readWindow)).toHaveLength(1);
  });

  /*
   * The holes, in the lists and records this reader cannot name.
   *
   * `courses` and `windows` have a per-row parser; the other two dozen fields
   * do not, and until this they rode through untouched. That was fine on the
   * localStorage boot, where `list` and `record` see them — and it was the
   * whole hole on the other two doors, which never go near `loadPersisted`:
   * a backup somebody opens, and a sync from another device that opens
   * itself. `{"timers":[null]}` blanked the app out of storage; it blanked it
   * out of a restore too, and out of a hydrate nobody had to open at all.
   */
  it('takes the holes out of a list it has no reader for', () => {
    const out = readIncoming({
      timers: [{ id: 't1' }, null, { id: 't2' }],
      recent: ['home', null, 'courses'],
    }) as { timers: unknown[]; recent: unknown[] };
    expect(out.timers).toHaveLength(2);
    // Strings, not objects: a filter for objects would empty this one.
    expect(out.recent).toEqual(['home', 'courses']);
  });

  it('takes the holes out of a record it has no reader for', () => {
    const out = readIncoming({
      reviews: { a: { seen: 1 }, b: null, c: { seen: 2 } },
    }) as { reviews: Record<string, unknown> };
    expect(Object.keys(out.reviews)).toEqual(['a', 'c']);
  });

  it('leaves a top-level null alone, because one of them means something', () => {
    // `lastSync` is legitimately null, and "only the keys actually carried are
    // returned" has to keep meaning what it says: the rule goes one level in,
    // matching the boot read, and not to the keys themselves.
    const out = readIncoming({ lastSync: null } as Record<string, unknown>);
    expect('lastSync' in out).toBe(true);
    expect(out.lastSync).toBe(null);
  });

  it('keeps the reference of a field with nothing wrong with it', () => {
    // `state/persist/` diffs by reference to decide what to write. A field
    // this reader did not have to change must not look changed.
    const timers = [{ id: 't1' }];
    const reviews = { a: { seen: 1 } };
    const out = readIncoming({ timers, reviews } as Record<string, unknown>);
    expect(out.timers).toBe(timers);
    expect(out.reviews).toBe(reviews);
  });
});
