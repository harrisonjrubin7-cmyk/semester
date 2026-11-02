/// <reference types="node" />
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type FileSystem = Pick<typeof import('node:fs'), 'readFileSync' | 'readdirSync'>;

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
function testFiles(fs: FileSystem, dir = 'src'): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const at = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...testFiles(fs, at));
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(at);
  }
  return out;
}

const mocks = (fs: FileSystem, path: string) =>
  /\bvi\.mock\(/.test(fs.readFileSync(join(ROOT, path), 'utf8'));

/** The list, read out of the config rather than duplicated here. */
function listed(fs: FileSystem): string[] {
  const config = fs.readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
  const block = /const MOCKS_MODULES = \[([\s\S]*?)\]/.exec(config);
  expect(block, 'MOCKS_MODULES should be declared in vite.config.ts').toBeTruthy();
  return [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('which test files run isolated', () => {
  it('is every file that calls vi.mock, and no other', async () => {
    // Bypass any filesystem double retained by a worker. This test is the
    // isolation policy itself, so it must inspect the checkout, not a prior
    // test's view of it.
    const fs = await vi.importActual<FileSystem>('node:fs');
    const shouldBe = [...new Set([
      ...testFiles(fs).filter((path) => mocks(fs, path)),
      // This policy test reads the config itself, so it also needs protection
      // from filesystem doubles left by shared-worker tests.
      'src/isolation.test.ts',
    ])].sort();
    const configured = listed(fs);
    expect(new Set(configured).size, 'MOCKS_MODULES contains a duplicate path').toBe(configured.length);
    expect(configured.sort()).toEqual(shouldBe);
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
  it('names only files that exist', async () => {
    const fs = await vi.importActual<FileSystem>('node:fs');
    const all = new Set(testFiles(fs));
    for (const path of listed(fs)) {
      expect(all.has(path), `${path} is listed in MOCKS_MODULES but is not a test file`).toBe(true);
    }
  });
});
