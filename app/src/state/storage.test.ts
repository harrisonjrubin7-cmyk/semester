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
