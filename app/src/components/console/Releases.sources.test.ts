import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FLAG_SOURCES } from './Releases';

/**
 * The tab reports "what this build was made with", which is only true if it
 * reads every module that can be switched on by a build variable. This finds
 * those modules the way a person would grep for them — a non-test source file
 * that names all four feature states and reads the build environment — and
 * fails when one is not in `FLAG_SOURCES`. It was written after a reviewer
 * found, one registry at a time, three flags the tab had silently left out.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

const reads = (text: string): boolean =>
  ["'off'", "'preview'", "'sandbox'", "'production'"].every((s) => text.includes(s)) && /VITE_|import\.meta/.test(text);

it('reads every module that takes a four-state flag from the build environment', () => {
  const found = sources(SRC)
    .filter((f) => reads(readFileSync(f, 'utf8')))
    .map((f) => relative(SRC, f).split('\\').join('/'))
    .sort();
  expect(found, 'a flag module is not on the Releases tab: add it to FLAG_SOURCES and to flagRows').toEqual([...FLAG_SOURCES].sort());
});
