import { describe, expect, it } from 'vitest';
import { loadPersisted, readIncoming, readPersisted } from './shape';

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
});

/**
 * The next layer of the same argument: the rows, not just the lists.
 *
 * `list()` above checks that a saved list is a list and says nothing about
 * what is in it — which is the whole of the guard for twenty-two of them. The
 * same sentence at the top of this file applies unchanged one level down: an
 * older build wrote a row without a field this one reads, or a sync stopped
 * halfway through writing it.
 *
 * Found by driving the app with one row carrying nothing but its id in one
 * list at a time. Seven of the twenty-two took a screen down, and one took the
 * app: `hoursOn` is called from a hook the whole tree hangs off rather than
 * from inside a screen's boundary, so a study window with no `days` was an
 * uncaught TypeError and a blank document — every screen after it blank too,
 * with clearing site data the only way out. Exactly the failure this file was
 * written about, one layer in.
 *
 *     windows       hoursOn      w.days.includes    the app
 *     commitments   clashes      c.days.includes    <WorstDay>, <ClashList>
 *     updates       factsFrom    update.cards       <Insights>
 *     spent         courseCode   id.toUpperCase     <Me>
 *     appointments  isoToDate    iso.split          <MonthView>
 *     feedEvents    isoToDate    iso.split          <MonthView>
 *     registrar     daysTo       iso.split          <Feed_registrar>
 */
describe('opening the app on a row that is missing a field', () => {
  const thin = (field: string) => JSON.stringify({ [field]: [{ id: 'x1' }] });

  it('gives a study window the days every hour figure filters on', () => {
    const { windows } = withStorage(thin('windows'), () => loadPersisted());
    expect(Array.isArray(windows[0].days)).toBe(true);
  });

  it('gives a commitment the days the clash detector reads', () => {
    const { commitments } = withStorage(thin('commitments'), () => loadPersisted());
    expect(Array.isArray(commitments[0].days)).toBe(true);
  });

  it('gives an update the two lists five callers iterate', () => {
    const { updates } = withStorage(thin('updates'), () => loadPersisted());
    expect(Array.isArray(updates[0].cards)).toBe(true);
    expect(Array.isArray(updates[0].terms)).toBe(true);
  });

  it('gives a work report the course the pace table names it by', () => {
    const { spent } = withStorage(thin('spent'), () => loadPersisted());
    expect(typeof spent[0].courseId).toBe('string');
  });

  it('gives everything dated a date the month grid can split', () => {
    const { appointments } = withStorage(thin('appointments'), () => loadPersisted());
    const { feedEvents } = withStorage(thin('feedEvents'), () => loadPersisted());
    const { registrar } = withStorage(thin('registrar'), () => loadPersisted());
    expect(typeof appointments[0].date).toBe('string');
    expect(typeof feedEvents[0].date).toBe('string');
    expect(typeof registrar[0].iso).toBe('string');
  });

  it('still keeps what the row did hold', () => {
    const raw = JSON.stringify({
      windows: [{ id: 'w1', label: 'Evenings', days: [1, 2], from: 1140, to: 1380 }],
      spent: [{ id: 's1', courseId: 'econ', kind: 'paper', minutes: 90 }],
    });
    const state = withStorage(raw, () => loadPersisted());
    expect(state.windows[0]).toMatchObject({ label: 'Evenings', days: [1, 2], from: 1140, to: 1380 });
    expect(state.spent[0]).toMatchObject({ courseId: 'econ', kind: 'paper', minutes: 90 });
  });

  it('drops a review with no history in it, rather than iterating a null', () => {
    // Not a list: `reviews` is a record, and `?? {}` guards the record and not
    // what is in it. Three places take `Object.values` and read a number off
    // each; a single null took the app down from Study onward.
    const raw = JSON.stringify({ reviews: { 'econ::c1': null, 'econ::c2': { right: 1, wrong: 0, streak: 1, ease: 2.5, interval: 1, seen: 5, due: 9 } } });
    const { reviews } = withStorage(raw, () => loadPersisted());
    expect(Object.keys(reviews)).toEqual(['econ::c2']);
    expect(() => Object.values(reviews).filter((r) => r.seen > 0)).not.toThrow();
  });

  it('gives a task a date that is a string or nothing', () => {
    // `if (t.date)` answers "is there a date", not "is it one": a number is
    // truthy and `isoToDate` splits it.
    const raw = JSON.stringify({ tasks: [{ id: 't1', date: 9 }, { id: 't2', date: '2026-09-10' }] });
    const { tasks } = withStorage(raw, () => loadPersisted());
    expect(tasks[0].date).toBeNull();
    expect(tasks[1].date).toBe('2026-09-10');
  });

  it('gives a place a label, and leaves out one with nowhere to be', () => {
    const { places } = withStorage(thin('places'), () => loadPersisted());
    expect(places).toEqual([]);
    const kept = withStorage(
      JSON.stringify({ places: [{ id: 'p1', lat: 36.1, lon: -86.8 }] }),
      () => loadPersisted(),
    ).places;
    expect(typeof kept[0].label).toBe('string');
  });

  it('gives a source the project name the screen groups by', () => {
    const { sources } = withStorage(thin('sources'), () => loadPersisted());
    expect(typeof sources[0].project).toBe('string');
  });

  it('gives a timer an end it can be paused by, not a clock face of NaN', () => {
    const { timers } = withStorage(thin('timers'), () => loadPersisted());
    expect(timers[0].endsAt).toBeNull();
    expect(Number.isFinite(timers[0].seconds)).toBe(true);
  });

  it('leaves an alarm off unless it was saved on', () => {
    const { alarms } = withStorage(thin('alarms'), () => loadPersisted());
    expect(alarms[0].on).toBe(false);
    expect(Array.isArray(alarms[0].days)).toBe(true);
  });

  it('gives a stored course the lists the catalogue is built from', () => {
    // The worst of them to get wrong: the catalogue is built before any screen
    // is drawn, so this one was an uncaught TypeError and a blank document.
    const raw = JSON.stringify({ courses: [{ course: { id: 'c1', code: 'HIST 1500' } }] });
    const { courses } = withStorage(raw, () => loadPersisted());
    expect(courses).toHaveLength(1);
    expect(Array.isArray(courses[0].items)).toBe(true);
    expect(Array.isArray(courses[0].schedule)).toBe(true);
    expect(Array.isArray(courses[0].course.grading)).toBe(true);
    expect(Array.isArray(courses[0].guide.units)).toBe(true);
  });

  it('leaves out a course with nothing to address it by', () => {
    const raw = JSON.stringify({ courses: [{ id: 'c1' }, { course: { id: 'c2' } }] });
    expect(withStorage(raw, () => loadPersisted()).courses).toEqual([]);
  });

  /*
   * `lib/migrate.ts` loads a copy written by a newer build and says of it "the
   * app reads what it recognises and ignores the rest". Ignoring a field is not
   * deleting it, and a reader that rebuilt a row from the fields it knows would
   * delete it on the next save — so every one of them keeps the row and writes
   * its guarantees over the top.
   */
  it('does not strip a field a newer build wrote', () => {
    const raw = JSON.stringify({ windows: [{ id: 'w1', days: [1], from: 0, to: 60, colour: 'blue' }] });
    const { windows } = withStorage(raw, () => loadPersisted());
    expect((windows[0] as unknown as { colour: string }).colour).toBe('blue');
  });
});

/**
 * The other door into the same state.
 *
 * Everything above is about what `loadPersisted` reads out of localStorage.
 * `state/slices/library.ts` has a `restore` that put a blob into the state
 * without going near any of it, and its blob is a file somebody opened — which
 * is a good deal easier to reach than editing devtools.
 *
 * `readPersisted` and `readIncoming` are the same reader, so there is one list
 * of what a field means and both doors use it. A restore stays a partial: it
 * replaces the sections the file holds and leaves the rest alone.
 */
describe('a blob handed to a restore', () => {
  it('is read the same way storage is', () => {
    const back = readIncoming({
      courses: [{ id: 'c1' }],
      windows: [{ id: 'w1' }],
      reviews: { 'a::b': null },
      tasks: [{ id: 't1', date: 9 }],
    } as never);
    expect(back.courses).toEqual([]);
    expect(Array.isArray(back.windows![0].days)).toBe(true);
    expect(back.reviews).toEqual({});
    expect(back.tasks![0].date).toBeNull();
  });

  it('hands back only the sections the file carried', () => {
    const back = readIncoming({ notes: [] } as never);
    expect(Object.keys(back)).toEqual(['notes']);
  });

  it('leaves out a section the file said nothing about', () => {
    // `restore` treats null as "not in this file"; repairing it into an empty
    // list here would blank a list the caller meant to leave alone.
    expect(Object.keys(readIncoming({ notes: null, tasks: undefined } as never))).toEqual([]);
  });

  it('takes anything that is not an object as nothing', () => {
    expect(readIncoming('none' as never)).toEqual({});
    expect(readIncoming([1, 2] as never)).toEqual({});
    expect(readIncoming(null as never)).toEqual({});
  });
});

/**
 * Reading twice is reading once.
 *
 * Boot now reads the state twice: `store.tsx` calls `loadPersisted()` and
 * hands the result to a `hydrate`, which reads it again through
 * `readIncoming`. That is a fourth door's worth of complexity avoided at the
 * cost of one extra pass, and it is only sound if the pass is idempotent —
 * `rows()` mints an id for a row that has none, and minting a *different* one
 * on the second pass would give a row two identities between boot and the
 * first sync.
 *
 * Measured on a large account — twenty courses, five thousand tasks, four
 * thousand reviews, 2.18MB of JSON — one pass is about 20ms, and on an
 * ordinary one about 11ms. Small enough that the simpler shape wins.
 */
describe('reading a blob twice', () => {
  const messy = {
    courses: [{ course: { id: 'c1', code: 'HIST 1500' } }, { id: 'nope' }],
    tasks: [{ id: 't1', date: 9 }, { title: 'no id' }],
    windows: [{ id: 'w1' }, {}],
    reviews: { a: null, b: { right: 1, wrong: 0, streak: 1, ease: 2.5, interval: 1, seen: 5, due: 9 } },
    timers: [{ id: 'tm1' }],
    places: [{ id: 'p1', label: 'B', lat: 1, lon: 2 }, { id: 'p2' }],
    appointments: [{ id: 'ap1', time: '6:30p' }],
    applications: [{ stage: 'sent' }, { stage: 'sent' }],
    registrar: [{ id: 'addDrop', iso: 9 }],
    alarms: [{ id: 'al1', on: 'yes' }],
  };

  it('gives the same answer the second time', () => {
    const once = readPersisted(structuredClone(messy) as never);
    expect(readPersisted(structuredClone(once) as never)).toEqual(once);
  });

  it('holds for a partial too', () => {
    const once = readIncoming(structuredClone(messy) as never);
    expect(readIncoming(structuredClone(once) as never)).toEqual(once);
  });

  it('does not renumber a row whose id it minted', () => {
    const once = readPersisted(structuredClone(messy) as never);
    const twice = readPersisted(structuredClone(once) as never);
    expect(twice.tasks.map((t) => t.id)).toEqual(once.tasks.map((t) => t.id));
    expect(twice.applications.map((a) => a.id)).toEqual(once.applications.map((a) => a.id));
    // And the minted ones are distinct, which is the whole reason for minting.
    expect(new Set(once.applications.map((a) => a.id)).size).toBe(once.applications.length);
  });
});
