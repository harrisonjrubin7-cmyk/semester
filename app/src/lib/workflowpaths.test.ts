import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A workflow names files and directories in prose that nothing resolves until
 * the job runs. On 4 October the lockfile moved from `app/` to the repository
 * root (D-1193) and `supply-chain.yml`, merged minutes earlier, still said
 * `cache-dependency-path: app/package-lock.json`: every push to `main` then
 * failed in `setup-node` before a single step of the job ran, and nothing
 * local could have shown it. This resolves the paths a workflow depends on
 * against the tree, so a move that strands one fails here instead.
 */

const root = join(import.meta.dirname, '../../..');
const dir = join(root, '.github/workflows');

export interface Ref {
  file: string;
  key: 'cache-dependency-path' | 'working-directory';
  path: string;
}

/** Every `cache-dependency-path` and `working-directory` value in a workflow's text. */
export function refs(file: string, text: string): Ref[] {
  const out: Ref[] = [];
  for (const m of text.matchAll(/^\s*(cache-dependency-path|working-directory):\s*['"]?([^\s'"#]+)['"]?\s*(?:#.*)?$/gm)) {
    const path = m[2];
    // Expressions and globs are resolved by the runner, not by the tree.
    if (path.includes('${{') || /[*?]/.test(path)) continue;
    out.push({ file, key: m[1] as Ref['key'], path });
  }
  return out;
}

const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
const all = workflows.flatMap((f) => refs(f, readFileSync(join(dir, f), 'utf8')));

describe('the paths a workflow depends on exist', () => {
  it('reads the workflows, and finds paths to check in them', () => {
    expect(workflows.length).toBeGreaterThan(5);
    expect(all.length).toBeGreaterThan(10);
  });

  it('resolves every cache-dependency-path and working-directory against the tree', () => {
    const missing = all.filter((r) => !existsSync(join(root, r.path))).map((r) => `${r.file}: ${r.key} ${r.path}`);
    expect(missing, 'a path a workflow names does not exist; update the workflow with the move').toEqual([]);
  });

  // Controls. A resolver that found nothing, or called everything missing,
  // would pass or fail the test above for the wrong reason.
  it('reads the keys, ignores expressions, globs and comments', () => {
    const text = [
      '        with:',
      '          cache-dependency-path: app/package-lock.json',
      '        working-directory: app # the app',
      "        working-directory: 'video'",
      '        working-directory: ${{ matrix.dir }}',
      '          cache-dependency-path: "**/package-lock.json"',
      '        run: echo working-directory: nowhere',
    ].join('\n');
    expect(refs('x.yml', text)).toEqual([
      { file: 'x.yml', key: 'cache-dependency-path', path: 'app/package-lock.json' },
      { file: 'x.yml', key: 'working-directory', path: 'app' },
      { file: 'x.yml', key: 'working-directory', path: 'video' },
    ]);
  });

  it('would have failed on the file D-1193 deleted', () => {
    expect(existsSync(join(root, 'app/package-lock.json'))).toBe(false);
    expect(existsSync(join(root, 'package-lock.json'))).toBe(true);
    const stale = refs('supply-chain.yml', '          cache-dependency-path: app/package-lock.json');
    expect(stale.filter((r) => !existsSync(join(root, r.path)))).toHaveLength(1);
  });
});
