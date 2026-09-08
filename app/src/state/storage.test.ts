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
