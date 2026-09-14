/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The list of test files that still need a worker to themselves.
 *
 * `vite.config.ts` runs the suite in two projects: everything in shared
 * workers, and a short list isolated. Shared workers took the suite from 47
 * seconds to 28 — 363 spawns at ~224ms each was more than half of it, and CI
 * pays that three times over, because `test:zones` runs the whole thing again
 * in Chicago and again in Kiritimati.
 *
 * What isolation buys is a fresh module registry per file, and `vi.mock` is
 * the feature that needs one: a mock can only rebind a module the worker has
 * not already evaluated. Whether it has depends on which file ran first, so a
 * file that mocks and is not on the list does not fail — it fails *sometimes*,
 * which is worse than failing.
 *
 * Hence this. The list is written out in the config, where somebody reading it
 * can see what it is; the grep that keeps it true is here, where a grep
 * belongs.
 */

const ROOT = new URL('..', import.meta.url).pathname;

/** Every test file under `src`, as the config spells them. */
function testFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const at = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...testFiles(at));
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(at);
  }
  return out;
}

const mocks = (path: string) => /\bvi\.mock\(/.test(readFileSync(join(ROOT, path), 'utf8'));

/** The list, read out of the config rather than duplicated here. */
function listed(): string[] {
  const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
  const block = /const MOCKS_MODULES = \[([\s\S]*?)\]/.exec(config);
  expect(block, 'MOCKS_MODULES should be declared in vite.config.ts').toBeTruthy();
  return [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('which test files run isolated', () => {
  it('is every file that calls vi.mock, and no other', () => {
    const shouldBe = testFiles().filter(mocks).sort();
    expect(listed().sort()).toEqual(shouldBe);
  });

  /*
   * The half that is easy to get wrong in the other direction.
   *
   * A file listed but no longer mocking costs a worker for nothing, which is
   * a small waste and an invisible one — so it is asserted rather than left to
   * be noticed. The message is what matters: it says which way the list is
   * wrong, because "expected A to equal B" on two sorted paths is not obvious
   * at a glance.
   */
  it('names only files that exist', () => {
    const all = new Set(testFiles());
    for (const path of listed()) {
      expect(all.has(path), `${path} is listed in MOCKS_MODULES but is not a test file`).toBe(true);
    }
  });
});
