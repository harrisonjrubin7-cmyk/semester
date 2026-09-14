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
 * A getter, so the answer is read when the import is, not when the factory
 * ran.
 *
 * A factory that throws on `failing` bakes in whichever value `failing` had
 * the first time anything in this file imported the module: vitest runs it
 * once and keeps the result, and `vi.resetModules()` below does not reach it.
 * So the two tests here passed in the order they are written and failed in
 * the other one — whichever ran first decided for both, and the failure only
 * appeared under `npm run test:shuffle`.
 *
 * `loadSeed` reads `.default` off each module inside its own `.then`, so a
 * getter that throws there rejects the promise exactly as a failed chunk
 * does, and it is asked afresh on every attempt.
 */
vi.mock('./courses/econ', () => ({
  get default() {
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
