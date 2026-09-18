import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSISTED, initialEphemeral, loadPersisted, pickPersisted, type Persisted, type State } from './shape';
import { SCHEMA, migrate } from '../lib/migrate';
import { NAVS } from '../lib/look';

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
    // And the navigation is one it can actually draw. Read from `NAVS`
    // rather than written out, so adding one does not turn this into a check
    // that the app has not changed. See `navOf`.
    expect(NAVS.map((n) => n.id)).toContain(state.nav);
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
    /*
     * `picked` is deliberately absent from this list and deliberately still in
     * the payloads above. It was a persisted field no build ever read, removed
     * in the whole-app audit — so every copy written before that still has it,
     * and the case worth keeping is that a stale key this build has never
     * heard of is ignored rather than breaking the load. `lib/migrate.ts` says
     * the same of a copy from a newer build: "the app reads what it recognises
     * and ignores the rest."
     */
    for (const field of ['done', 'saved', 'linkUrls', 'reviews', 'grades', 'notifs'] as const) {
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

describe('the version written back', () => {
  /*
   * `migrate` takes trouble over a payload from a newer build: it passes it
   * through untouched rather than walking it backwards through steps written
   * for an older shape. `pickPersisted` decides whether that survives the next
   * save, and it used to write the constant.
   *
   * This used to say nothing was wrong because every step in `STEPS` was
   * idempotent. Step 5 is the one that ended that: steps 4 and 5 both rewrite
   * `nav` unconditionally, so a copy whose marker never got written back
   * would have a chosen navigation overruled on the next load. The marker is
   * what stops it, which makes this the test holding that door shut.
   */
  const state = (over: Partial<Persisted> = {}) =>
    ({ ...DEFAULT_PERSISTED, ...initialEphemeral(), ...over }) as State;

  it('stamps this build for a copy this build understands', () => {
    expect(pickPersisted(state({ schemaVersion: SCHEMA })).schemaVersion).toBe(SCHEMA);
    expect(pickPersisted(state({ schemaVersion: 1 })).schemaVersion).toBe(SCHEMA);
  });

  it('never writes a copy back older than it was read', () => {
    // A phone on next month's build wrote it; a laptop a release behind opens
    // it once. It must not go back to disk claiming to be this build's shape.
    expect(pickPersisted(state({ schemaVersion: SCHEMA + 2 })).schemaVersion).toBe(SCHEMA + 2);
  });

  it('agrees with the way in about what counts as a version', () => {
    // `versionOf` is what the read path asks, so a nonsense marker lands the
    // same on both sides rather than being preserved out and rejected in.
    const odd = pickPersisted(state({ schemaVersion: Number.NaN }));
    expect(Number.isFinite(odd.schemaVersion)).toBe(true);
    expect(odd.schemaVersion).toBe(SCHEMA);
  });

  it('survives a round trip through migrate at its own version', () => {
    const written = pickPersisted(state({ schemaVersion: SCHEMA + 2 }));
    const read = migrate(JSON.parse(JSON.stringify(written)));
    expect(read.fromFuture).toBe(true);
    expect(read.ran).toEqual([]);
  });
});

/**
 * One unreadable field costs that field, and nothing else.
 *
 * `loadPersisted` wraps the whole read in one `try`, and its `catch` returns
 * `DEFAULT_PERSISTED` with the note "A private window, or storage disabled."
 * For that case defaults are exactly right. The catch cannot tell that case
 * from a save that is present, readable, and wrong in one place — so any
 * reader that throws takes the entire term with it.
 *
 * Measured, before `readDrop` was made total: a save holding three ticked
 * deadlines, a chosen navigation, three recents and a five-hour day budget,
 * plus `drops: {"ECON": {"toString": null}}` — valid JSON, and the shape
 * `Number()` refuses to coerce — came back as defaults on every one of them.
 * The next dispatch then wrote those defaults back over the real save, so it
 * was not hidden, it was gone.
 *
 * `lib/readers.test.ts` holds the general rule this is the consequence of: a
 * reader of untrusted input may refuse with a sentence or fall back, and may
 * never throw a `TypeError`. This one holds the cost of breaking it, in the
 * fields a student would actually miss.
 */
describe('a save that is wrong in one place', () => {
  const SOUND = {
    schemaVersion: SCHEMA,
    nav: 'shelves',
    done: { 'econ-1': true, 'econ-2': true, 'psci-9': true },
    recent: ['courses', 'calendar', 'study'],
    dayBudget: 5,
  };

  it('keeps everything the bad field is not', () => {
    const kept = withStorage(
      JSON.stringify({ ...SOUND, drops: { ECON: JSON.parse('{"toString":null}') } }),
      () => loadPersisted(),
    );
    expect(Object.keys(kept.done).length, 'the ticked deadlines').toBe(3);
    expect(kept.recent.length, 'where you have been').toBe(3);
    expect(kept.dayBudget, 'the day budget').toBe(5);
    expect(kept.nav, 'the chosen navigation').toBe('shelves');
  });

  it('falls back on the bad field itself rather than keeping nonsense', () => {
    const kept = withStorage(
      JSON.stringify({ ...SOUND, drops: { ECON: JSON.parse('{"toString":null}'), PSCI: 2 } }),
      () => loadPersisted(),
    );
    expect(kept.drops.ECON, 'unreadable, so no drops').toBe(0);
    expect(kept.drops.PSCI, 'and its neighbour is untouched').toBe(2);
  });
});

/**
 * The plan, across a reload.
 *
 * Two facts have to survive it and they survive for opposite reasons. What a
 * student did tonight has to still be there in the morning, or a sitting
 * resumed would start its count again — and what an older build wrote has to
 * be left exactly as it is, because those `doneAt` stamps were written by
 * opening a row and cannot now be shown to be study. They also cannot be shown
 * not to be. Re-judging them would tell somebody they had studied less than
 * their app has been telling them all term, which is the one outcome worse
 * than the bug that made them. See `progressOf` in `lib/sessions.ts`.
 */
describe('a half-finished sitting, across a reload', () => {
  it('keeps the count and the sitting it belongs to', () => {
    const raw = JSON.stringify({
      sessions: [
        { id: 'a', courseId: 'econ', index: 0, name: 'Monopoly', code: 'ECON 1020', minutes: 30, on: '2026-09-15', cards: 12, startedAt: 1_700_000, answered: 5 },
      ],
      liveSession: 'a',
    });
    const state = withStorage(raw, () => loadPersisted());
    expect(state.liveSession).toBe('a');
    expect(state.sessions[0]).toMatchObject({ answered: 5, startedAt: 1_700_000, cards: 12 });
    expect(state.sessions[0].doneAt).toBeUndefined();
  });

  it('leaves an older build\u2019s finished sittings finished', () => {
    const raw = JSON.stringify({
      sessions: [
        { id: 'a', courseId: 'econ', index: 0, name: 'Monopoly', code: 'ECON 1020', minutes: 30, on: '2026-09-14', doneAt: 1_600_000 },
      ],
    });
    const state = withStorage(raw, () => loadPersisted());
    expect(state.sessions[0].doneAt).toBe(1_600_000);
  });

  it('takes a pointer that is not a string as no pointer at all', () => {
    // Storage is not a trusted input; the field is read for an id and a
    // number here would be compared against every session's for ever.
    const state = withStorage('{"liveSession":7}', () => loadPersisted());
    expect(state.liveSession).toBeNull();
  });
});
