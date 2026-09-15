/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A test that mounts a React tree has to take it down before the file ends.
 *
 * React's scheduler keeps work queued against a mounted root. When a file
 * finishes with one still mounted, Vitest tears the environment down and the
 * queued callback then runs against a `window` that is no longer there:
 *
 *     ReferenceError: window is not defined
 *       ❯ node_modules/react-dom/cjs/react-dom-client.development.js
 *       ❯ Immediate.performWorkUntilDeadline
 *
 * Three things make it a bad failure to leave to memory, and they are the same
 * three as `src/seedawait.test.ts`. Every assertion in the guilty file passes.
 * The error is reported against whatever file was *running* when the callback
 * fired, which is somebody else's. And whether it happens at all is a race, so
 * it is rare — one run in ten, and unlike an ordering fault **a seed does not
 * bring it back**: `--sequence.seed` fixes the order and not the timing. That
 * last part is what makes it worth a guard rather than a re-run.
 *
 * Seven files were leaving one mounted when this was written. Five unmounted
 * the *previous* test's tree in a `beforeEach`, which is every tree but the
 * last; one never unmounted at all; one handed the root to the test and only
 * one test gave it back.
 *
 * ## What counts, and what this cannot see
 *
 * An `unmount` inside an `afterEach` or an `afterAll` — the two hooks that run
 * after the last test. Unmounting in a `beforeEach` does not count, which is
 * exactly the shape five of the seven had.
 *
 * It reads source rather than running anything, so it is a heuristic: a file
 * could satisfy it and still leak, by unmounting one root and not another. It
 * is the cheap check that catches the shape that actually happened, not a
 * proof. `lib/prefers.test.tsx` is the file to copy when a helper hands roots
 * out — it collects them and takes them all down.
 */

const ROOT = new URL('.', import.meta.url);

function testFiles(dir = ROOT, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const at = new URL(entry, dir);
    if (statSync(at).isDirectory()) testFiles(new URL(`${entry}/`, dir), found);
    else if (/\.test\.tsx$/.test(entry)) found.push(at.pathname.slice(ROOT.pathname.length));
  }
  return found;
}

const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

/** The body of every `afterEach`/`afterAll` in a file, run together. */
function afterHooks(source: string): string {
  return [...source.matchAll(/after(?:Each|All)\(([\s\S]*?)\n\}\);/g)].map((m) => m[1]).join('\n');
}

describe('every test that mounts a React tree', () => {
  it('takes it down in an after hook, not only before the next one', () => {
    const mounting = testFiles()
      .filter((f) => read(f).includes('createRoot'))
      .sort();

    // If this is ever empty the filter has stopped matching and the test has
    // stopped testing anything, which is the one way a guard fails silently.
    expect(mounting.length).toBeGreaterThan(10);

    const leaking = mounting.filter((f) => !afterHooks(read(f)).includes('unmount'));
    expect(
      leaking,
      'unmount in an afterEach or afterAll — see the note at the top of this file',
    ).toEqual([]);
  });
});
