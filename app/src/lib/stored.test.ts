import { describe, expect, it } from 'vitest';
import {
  readControls,
  readDeck,
  readFolder,
  readIncoming,
  readList,
  readModule,
  readQuiet,
  readWindow,
} from './stored';
import { DEFAULTS as DEFAULT_CONTROLS, capsFor } from './controls';
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

/*
 * Two more rows of the same kind, on the two collections this branch added.
 * `list()` only drops nullish rows and casts the rest, so a folder whose name
 * was not a string took the drive down inside a `localeCompare`, and a deck
 * stored with `slides: null` took its screen down inside a `.map`.
 */
describe('a drive folder read back from storage', () => {
  it('keeps a well-formed one', () => {
    const row = { id: 'a', name: 'Essays', parentId: null, created: 5 };
    expect(readFolder(row)).toEqual(row);
  });

  it('gives a name that is not a string one that is', () => {
    expect(readFolder({ id: 'a', name: 42 })?.name).toBe('Folder');
    expect(readFolder({ id: 'a' })?.name).toBe('Folder');
  });

  it('reads a missing or empty parent as the top of the drive', () => {
    expect(readFolder({ id: 'a', name: 'x' })?.parentId).toBeNull();
    expect(readFolder({ id: 'a', name: 'x', parentId: '' })?.parentId).toBeNull();
    expect(readFolder({ id: 'a', name: 'x', parentId: 'b' })?.parentId).toBe('b');
  });

  it('drops a row with no id, which names nothing', () => {
    expect(readFolder({ name: 'x' })).toBeNull();
    expect(readFolder(null)).toBeNull();
    expect(readList([{ id: 'a', name: 'x' }, null, { name: 'no id' }], readFolder)).toHaveLength(1);
  });
});

describe('a deck read back from storage', () => {
  it('keeps a well-formed one', () => {
    const deck = readDeck({
      id: 'd',
      title: 'A talk',
      subtitle: '',
      courseId: 'econ',
      slides: [{ title: 'One', bullets: ['a'] }],
      hidden: [1],
      created: 1,
      updated: 2,
    });
    expect(deck?.slides).toHaveLength(1);
    expect(deck?.hidden).toEqual([1]);
    expect(deck?.courseId).toBe('econ');
  });

  it('gives slides that are not a list an empty one', () => {
    // `running(deck)` maps over this on every render.
    expect(readDeck({ id: 'd', slides: null })?.slides).toEqual([]);
    expect(readDeck({ id: 'd' })?.slides).toEqual([]);
  });

  it('keeps only the bullets that are strings', () => {
    const deck = readDeck({ id: 'd', slides: [{ title: 'x', bullets: ['a', 3, null, 'b'] }] });
    expect(deck?.slides[0].bullets).toEqual(['a', 'b']);
  });

  it('keeps only the hidden marks that are numbers', () => {
    expect(readDeck({ id: 'd', hidden: [0, 'x', 2] })?.hidden).toEqual([0, 2]);
  });

  it('drops a row with no id', () => {
    expect(readDeck({ title: 'x' })).toBeNull();
    expect(readDeck(undefined)).toBeNull();
  });
});

describe('the settings whose bad values are worse than their absence', () => {
  /*
   * These arrive by the door nobody has to open. A role this build has never
   * heard of is not `student`, so `forRole` hides every student-only screen
   * and the app opens on a directory with twelve things missing; a depth of
   * "bad" indexes a table of multipliers, comes back undefined, and every
   * ceiling is NaN.
   */
  it('normalises a role it has never heard of, rather than hiding twelve screens', () => {
    expect(readIncoming({ role: 'vice-chancellor' }).role).toBe('student');
    expect(readIncoming({ role: 42 } as Record<string, unknown>).role).toBe('student');
    expect(readIncoming({ role: 'faculty' }).role).toBe('faculty');
  });

  it('normalises controls field by field, so one bad value does not take the others', () => {
    const out = readIncoming({ controls: { depth: 'bad', level: 'harder', cards: 12 } });
    expect(out.controls).toEqual({ depth: 'standard', level: 'harder', cards: 12 });
  });

  it('never lets a stored depth produce a NaN ceiling', () => {
    const out = readIncoming({ controls: { depth: 'bad', level: 'course', cards: 'lots' } });
    for (const n of Object.values(capsFor(out.controls as never))) {
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('refuses a quiet window that is not one, rather than half-reading it', () => {
    expect(readIncoming({ quiet: { from: 'ten', to: 480 } }).quiet).toBeNull();
    expect(readIncoming({ quiet: { from: 1320.5, to: 480 } }).quiet).toBeNull();
    expect(readIncoming({ quiet: { from: 1320, to: 1440 } }).quiet).toBeNull();
    expect(readIncoming({ quiet: { from: 1320, to: 480 } }).quiet).toEqual({ from: 1320, to: 480 });
  });

  // "Only the keys actually carried are returned, so a partial stays partial."
  it('leaves a key that did not arrive alone', () => {
    const out = readIncoming({ notes: [] });
    expect('role' in out).toBe(false);
    expect('controls' in out).toBe(false);
    expect('quiet' in out).toBe(false);
  });

  it('reads the same way on its own as it does through the door', () => {
    expect(readControls(undefined)).toEqual(DEFAULT_CONTROLS);
    expect(readControls({ depth: 'brief', level: 'plainer', cards: 3 })).toEqual({
      depth: 'brief',
      level: 'plainer',
      cards: 3,
    });
    expect(readQuiet(null)).toBeNull();
  });
});
