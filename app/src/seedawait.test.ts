/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A test that mounts the store has to wait for the sample it starts fetching.
 *
 * `StoreProvider` pulls the four shipped courses in with a dynamic import the
 * moment it mounts with `sample` on, which is the default, and it does not
 * await it. That is right in an app — the screen fills in when they land. In a
 * test it is a promise still in flight when the file ends, and Vitest tears
 * the environment down underneath it:
 *
 *     EnvironmentTeardownError: Cannot load '/src/data/courses/psci/lessons.ts'
 *       … after the environment was torn down
 *
 * Three things make that a bad failure to be left to remember by hand. Every
 * assertion in the guilty file passes, so the file looks fine. The error is
 * reported against whatever file happened to be *running* when the import
 * landed, which is somebody else's. And whether it happens at all depends on
 * whether the import wins the race, so it is intermittent — it went unnoticed
 * in `components/tabsound.test.tsx` until a shuffled run pinned the blame on
 * `screens/Calendar.keyboard.test.tsx`, which was innocent and already did
 * this correctly.
 *
 * `loadSeed` caches its promise, so one `await` in a `beforeAll` means the
 * store's own call is already resolved by the time it makes it. Six files had
 * worked that out independently; two had not. This is so the ninth does not
 * have to work it out at all.
 *
 * ## What counts
 *
 * A *call* — `loadSeed(` — rather than a mention. The first version of this
 * looked for the name, which the import line satisfies on its own: deleting
 * the `await` and leaving the import kept the guard green, and a guard that
 * passes on the bug it was written for is worse than none. Not the exact shape
 * of the await, though; pinning that would make this a formatting rule rather
 * than a correctness one.
 */

const ROOT = new URL('.', import.meta.url);

function testFiles(dir = ROOT, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const at = new URL(entry, dir);
    if (statSync(at).isDirectory()) {
      testFiles(new URL(`${entry}/`, dir), found);
    } else if (/\.test\.tsx?$/.test(entry)) {
      found.push(at.pathname.slice(ROOT.pathname.length));
    }
  }
  return found;
}

const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

describe('every test that mounts the store', () => {
  it('waits for the sample it sets going', () => {
    const mounting = testFiles()
      .filter((f) => /\bStoreProvider\b/.test(read(f)))
      .sort();

    // If this is ever empty the filter has stopped matching and the test has
    // stopped testing anything — which is the one way a guard like this fails
    // silently.
    expect(mounting.length).toBeGreaterThan(4);

    const forgot = mounting.filter((f) => !read(f).includes('loadSeed('));
    expect(
      forgot,
      'add `beforeAll(async () => { await loadSeed(); })` — see the note at the top of this file',
    ).toEqual([]);
  });
});
