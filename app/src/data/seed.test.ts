import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The sample, when the four chunks it lives in do not arrive.
 *
 * `loadSeed` is four dynamic imports behind one cached promise, and the cache
 * is what this file is about. Caching the *success* is the point — flicking
 * the toggle should not refetch 330 KB. Caching the *failure* turned "not yet"
 * into "never": both ways these imports fail are temporary, and `??=` is
 * satisfied by a promise whatever it settled to, so one failure meant the
 * sample could not be loaded again for the rest of the session however many
 * times the toggle was touched.
 *
 * The two ways are the two in `components/Boundary.tsx`: no connection and
 * these chunks were never fetched, or the app was updated underneath an
 * installed copy and the files it is asking for are no longer served. Both
 * are over by the next attempt, and there has to be a next attempt.
 */

let failing = true;

const course = (id: string) => ({
  default: { course: { id, code: id.toUpperCase(), title: id, term: '2026FA' }, items: [] },
});

/*
 * The failure is thrown when the module is *read*, not when it is registered.
 *
 * A factory that threw outright read `failing` whenever Vitest chose to
 * evaluate it, which is once per registry and not once per test — so the test
 * that sets `failing = false` could evaluate it for the test that needs it
 * true, and this file passed or failed on the order its two tests ran in.
 * A getter is read on every `m.default`, which is where `loadSeed` reads it,
 * so the flag is consulted at the moment the test means it to be.
 */
vi.mock('./courses/econ', () => ({
  get default(): unknown {
    if (failing) throw new Error('Failed to fetch dynamically imported module');
    return course('econ').default;
  },
}));
vi.mock('./courses/psci', () => course('psci'));
vi.mock('./courses/core', () => course('core'));
vi.mock('./courses/bus', () => course('bus'));

beforeEach(() => {
  vi.resetModules();
  failing = true;
});

describe('loading the sample', () => {
  it('does not hold on to a failure, so the next attempt is a real one', async () => {
    const { loadSeed } = await import('./seed');

    await expect(loadSeed()).rejects.toThrow();

    // The connection is back, or the page has been reloaded onto the new
    // build. Nothing about the app has changed; the chunks are there now.
    failing = false;

    const mods = await loadSeed();
    expect(mods.map((m) => m.course.id)).toEqual(['econ', 'psci', 'core', 'bus']);
  });

  it('still fetches only once when it works', async () => {
    failing = false;
    const { loadSeed } = await import('./seed');

    const first = loadSeed();
    const second = loadSeed();
    expect(second).toBe(first);
    await expect(first).resolves.toHaveLength(4);
  });
});
