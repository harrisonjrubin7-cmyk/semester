import { describe, expect, it } from 'vitest';
import { loadPersisted } from './shape';

/**
 * Storage is not a trusted input, and the app opens whatever it finds.
 *
 * It holds whatever an older build wrote, a half-finished sync left behind, a
 * quota error truncated, or somebody typed into devtools. The reads were
 * written as `saved.tasks ?? []`, which looks like a guard and is not: `??`
 * catches null and undefined only, so a `tasks` that came back as a string
 * went straight through and the first `.map` on it killed the page.
 *
 * Measured in a browser before the fix, with `{"tasks":"none"}` in storage:
 * zero characters rendered and `e.tasks.map is not a function`. The screen
 * boundary could not help — that happens while the store is being built,
 * before any screen is drawn — so the only way out was clearing site data.
 *
 * Twenty-three arrays were read that way. `list()` is the one guard now, and
 * these are the shapes that found the hole.
 */
function withStorage<T>(raw: string | null, run: () => T): T {
  const store: Record<string, string> = raw === null ? {} : { 'semester.v1': raw };
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() { return Object.keys(store).length; },
    },
    configurable: true,
  });
  try {
    return run();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  }
}

/** Every field the app will call an array method on. */
const LISTS = [
  'tasks', 'appointments', 'notes', 'updates', 'feeds', 'feedEvents', 'extraLinks',
  'courses', 'places', 'commitments', 'timers', 'alarms', 'courseOrder', 'recent',
  'sittings', 'sources', 'registrar', 'spent', 'windows', 'costs', 'balances', 'residences',
] as const;

describe('opening the app on damaged storage', () => {
  it.each([
    ['a string where a list belongs', '{"tasks":"none","notes":"gone"}'],
    ['a number', '{"tasks":7,"timers":0}'],
    ['an object', '{"tasks":{"0":"a"},"costs":{}}'],
    ['booleans', '{"tasks":true,"notes":false}'],
    ['nulls', '{"tasks":null,"notes":null,"courses":null}'],
    ['a truncated write', '{"nav":"tabs","tasks":[{"id":"a"'],
    ['not an object at all', '"hello"'],
    ['an empty string', ''],
    ['an array at the top level', '[1,2,3]'],
    ['a future version', '{"v":99,"tasks":[],"somethingNew":{"deep":[1,2]}}'],
  ])('survives %s', (_name, raw) => {
    const state = withStorage(raw, () => loadPersisted());
    // Every list is a list. This is the property the app relies on
    // everywhere and checked nowhere.
    for (const field of LISTS) {
      expect(Array.isArray(state[field as keyof typeof state]), `${field} came back a non-array`).toBe(true);
    }
    // And the navigation is one it can actually draw. See `navOf`.
    expect(['tabs', 'feed', 'springboard', 'shelves']).toContain(state.nav);
  });

  it('keeps a good list rather than emptying it', () => {
    const raw = JSON.stringify({ tasks: [{ id: 'a' }, { id: 'b' }], recent: ['home', 'courses'] });
    const state = withStorage(raw, () => loadPersisted());
    expect(state.tasks).toHaveLength(2);
    expect(state.recent).toEqual(['home', 'courses']);
  });

  /*
   * The hole one level inside the one above.
   *
   * `[null]` is an array, so every assertion in this file passed while the app
   * did not open. Measured in a browser with `{"timers":[null]}` in storage:
   * zero characters rendered and `Cannot read properties of null (reading
   * 'endsAt')`, thrown from `components/Ringing.tsx`, which is drawn beside
   * every screen rather than inside one — so no boundary caught it and a
   * reload could not, the value that kills it being the value being read.
   *
   * A hole gets into a list the same ways the container itself went wrong: a
   * sync that half-finished, a build that wrote a row it could no longer
   * name, a backup opened from another device. So it is dropped on the way
   * in, and the rows around it are kept — losing one timer is recoverable
   * and an app that will not open is not.
   */
  it.each([
    ['a hole in the middle', '{"timers":[null],"tasks":[{"id":"a"},null,{"id":"b"}]}'],
    ['undefined, as a sparse array writes it', '{"notes":[null,null]}'],
    ['holes in every list at once', JSON.stringify(
      Object.fromEntries(LISTS.map((f) => [f, [null]])),
    )],
  ])('drops %s rather than opening on nothing', (_name, raw) => {
    const state = withStorage(raw, () => loadPersisted());
    for (const field of LISTS) {
      const rows = state[field as keyof typeof state];
      expect(Array.isArray(rows), `${field} came back a non-array`).toBe(true);
      for (const row of rows as unknown[]) {
        expect(row, `${field} kept a hole, which is what blanks the app`).not.toBe(null);
        expect(row, `${field} kept a hole, which is what blanks the app`).not.toBe(undefined);
      }
    }
  });

  /*
   * The same hole under a key rather than at an index.
   *
   * Found the same way and one field along: `reviews: saved.reviews ?? {}`
   * checked the record and not its values, and `{"reviews":{"econ-1":null}}`
   * rendered zero characters with `Cannot read properties of null (reading
   * 'seen')`. A term is here too, because it is read as a string by every
   * lookup that takes one and was only ever checked for being present.
   */
  it.each([
    ['a hole under a key', '{"reviews":{"econ-1":null},"grades":{"econ":null}}'],
    ['every keyed field holed at once', '{"done":{"a":null},"saved":{"e1":null},"picked":{"x":null},"linkUrls":{"a":null},"reviews":{"a":null},"grades":{"a":null},"notifs":{"a":null}}'],
    ['a record that is not one', '{"reviews":"none","grades":[1,2],"picked":7,"linkUrls":true}'],
    ['a term that is not an id', '{"term":[]}'],
    ['a term that is an object', '{"term":{"deep":null}}'],
  ])('survives %s', (_name, raw) => {
    const state = withStorage(raw, () => loadPersisted());
    for (const field of ['done', 'saved', 'picked', 'linkUrls', 'reviews', 'grades', 'notifs'] as const) {
      const rows = state[field] as Record<string, unknown>;
      expect(rows, `${field} came back something other than a record`).toBeTypeOf('object');
      expect(Array.isArray(rows), `${field} came back an array`).toBe(false);
      for (const [key, row] of Object.entries(rows)) {
        expect(row, `${field}.${key} kept a hole, which is what blanks the app`).not.toBe(null);
        expect(row, `${field}.${key} kept a hole, which is what blanks the app`).not.toBe(undefined);
      }
    }
    // Every lookup that takes a term calls a string method on it.
    expect(typeof state.term, 'the term came back as something other than an id').toBe('string');
  });

  it('keeps the entries either side of a hole', () => {
    const raw = JSON.stringify({
      reviews: { a: { seen: 1 }, b: null, c: { seen: 2 } },
      grades: { econ: 'A', psci: null },
    });
    const state = withStorage(raw, () => loadPersisted());
    expect(Object.keys(state.reviews)).toEqual(['a', 'c']);
    expect(Object.keys(state.grades)).toEqual(['econ']);
  });

  it('keeps the rows either side of a hole', () => {
    const raw = JSON.stringify({
      tasks: [{ id: 'a' }, null, { id: 'b' }],
      recent: ['home', null, 'courses'],
    });
    const state = withStorage(raw, () => loadPersisted());
    expect(state.tasks.map((t) => t.id)).toEqual(['a', 'b']);
    // Strings, not objects: `courseOrder` and `recent` are why the filter is
    // for holes rather than for things that are objects.
    expect(state.recent).toEqual(['home', 'courses']);
  });
});
