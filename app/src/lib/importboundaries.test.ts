/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BROWSER_ENTRY, GATEWAY_EXTERNAL_EXCEPTIONS, SERVER_USES_CLIENT_LIB, checkBoundaries, type Violation } from './importboundaries';
import { WORKSPACE_ALIASES, reachableFrom, treeOf, zoneOf } from './importgraph';

/**
 * The import boundaries, held — on the repository, and on trees built to break
 * each rule once.
 *
 * Both halves are needed. The real-tree test is the guard; it is also the thing
 * that passes if the reader reads nothing, or a rule is written so loosely that
 * nothing could trip it, so it is never evidence on its own. Each rule is
 * therefore shown to fail: a small tree with exactly one violation in it, and
 * the assertion that this rule — and only this rule — says so. Every control was
 * also run the other way, by deleting the rule and watching it go red.
 */

const root = join(__dirname, '..', '..', '..');
const SKIP = new Set(['node_modules', 'dist', 'dist-site', '.git']);

function sourcesUnder(dir: string, into: Record<string, string>) {
  for (const name of readdirSync(join(root, dir))) {
    if (SKIP.has(name)) continue;
    const at = `${dir}/${name}`;
    if (statSync(join(root, at)).isDirectory()) sourcesUnder(at, into);
    else if (/\.(ts|tsx|mts|mjs|js|jsx)$/.test(name) && !/\.d\.ts$/.test(name)) into[at] = readFileSync(join(root, at), 'utf8');
  }
}

const real = (() => {
  const sources: Record<string, string> = {};
  for (const dir of ['packages', 'app', 'supabase/functions']) sourcesUnder(dir, sources);
  return treeOf(sources);
})();

const show = (v: Violation[]) => v.map((x) => `[${x.rule}] ${x.file} imports ${x.spec}\n    → ${x.fix}`).join('\n');
const rulesIn = (v: Violation[]) => [...new Set(v.map((x) => x.rule))].sort();

/** A tree that breaks nothing: the entry, one screen, one package, one function, one gateway file. */
const clean = (extra: Record<string, string> = {}) =>
  treeOf({
    'app/src/main.tsx': "import './screen'; import '@semester/contract';",
    'app/src/screen.tsx': "import react from 'react';",
    'packages/contract/src/index.ts': 'export {};',
    'supabase/functions/_shared/a.ts': "import b from './b.ts'; import { x } from 'jsr:@supabase/supabase-js@2';",
    'supabase/functions/_shared/b.ts': 'export {};',
    'app/server/gateway.ts': "import '../../packages/contract/src/index.ts'; import s from '@supabase/supabase-js';",
    ...extra,
  });

/** `clean` with `ledger` standing in for the recorded inversions: it has none. */
const check = (tree = clean()) => checkBoundaries(tree, { ledger: [] });

describe('the repository', () => {
  it('breaks none of the import boundaries', () => {
    const violations = checkBoundaries(real);
    expect(violations, `\n${show(violations)}\n`).toEqual([]);
  });

  /*
   * The two assertions that keep the one above from being a green light on an
   * empty room. If the reader stops finding imports, or the walk stops finding
   * files, the rules pass; these are what fail instead.
   */
  it('was read: the files are there, and the browser reaches most of the app', () => {
    expect(real.files.size).toBeGreaterThan(2500);
    expect(real.files.has(BROWSER_ENTRY)).toBe(true);
    const reached = reachableFrom(real, BROWSER_ENTRY).files;
    expect(reached.size).toBeGreaterThan(1000);
    expect([...reached].some((f) => zoneOf(f) === 'packages')).toBe(true);
  });

  it('keeps its ratchet honest: every recorded inversion exists, and the list has no repeats', () => {
    expect(new Set(SERVER_USES_CLIENT_LIB).size).toBe(SERVER_USES_CLIENT_LIB.length);
    for (const pair of SERVER_USES_CLIENT_LIB) {
      const [from, to] = pair.split(' => ');
      expect(real.files.has(from), `${from} is on the ledger and gone`).toBe(true);
      expect(real.files.has(to), `${to} is on the ledger and gone`).toBe(true);
    }
  });

  it('names its one gateway-dependency exception, and the file still imports it', () => {
    for (const [file, { spec }] of Object.entries(GATEWAY_EXTERNAL_EXCEPTIONS)) {
      expect(real.imports.get(file), `${file} is named as an exception and does not import ${spec}`).toContain(spec);
    }
  });
});

describe('the workspace aliases', () => {
  /*
   * `WORKSPACE_ALIASES` is a copy of a map other people edit: the app's own
   * `tsconfig.app.json` and `vite.config.ts` decide what `@semester/x` means.
   * `packages/platform` arrived after the map was written and nobody was
   * told, so an import of it would have been read as a third-party package and
   * passed every rule. A copy that can fall behind is checked against what it
   * copies.
   */
  const packages = readdirSync(join(root, 'packages'))
    .filter((d) => statSync(join(root, 'packages', d)).isDirectory())
    .map((dir) => ({ dir, name: (JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8')) as { name: string }).name }));
  const tsconfig = readFileSync(join(root, 'app/tsconfig.app.json'), 'utf8');
  const vite = readFileSync(join(root, 'app/vite.config.ts'), 'utf8');

  it('names every workspace package, at its source entry', () => {
    for (const { dir, name } of packages) {
      expect(WORKSPACE_ALIASES[name], `${name} (packages/${dir}) has no entry in WORKSPACE_ALIASES in lib/importgraph.ts`).toBe(`packages/${dir}/src/index.ts`);
    }
  });

  it('names nothing that is not a workspace package', () => {
    const real = new Set(packages.map((p) => p.name));
    for (const name of Object.keys(WORKSPACE_ALIASES)) expect(real.has(name), `${name} is aliased and no package has that name`).toBe(true);
  });

  it('agrees with the app’s tsconfig and vite aliases', () => {
    for (const { dir, name } of packages) {
      expect(tsconfig, `${name} is not in tsconfig.app.json paths`).toContain(`"${name}": ["../packages/${dir}/src/index.ts"]`);
      expect(vite, `${name} is not aliased in vite.config.ts`).toContain(`'${name}'`);
    }
  });
});

describe('each rule can fail', () => {
  it('passes a tree that breaks none', () => {
    expect(check()).toEqual([]);
  });

  it('packages-are-a-leaf: a package importing the app', () => {
    const v = check(clean({ 'packages/contract/src/leak.ts': "import '../../../app/src/screen';" }));
    expect(rulesIn(v)).toEqual(['packages-are-a-leaf']);
  });

  it('packages-are-a-leaf: a package gaining a dependency, or a built-in, outside a test', () => {
    expect(rulesIn(check(clean({ 'packages/contract/src/dep.ts': "import z from 'zod';" })))).toEqual(['packages-are-a-leaf']);
    expect(rulesIn(check(clean({ 'packages/contract/src/fs.ts': "import fs from 'node:fs';" })))).toEqual(['packages-are-a-leaf']);
  });

  it('packages-are-a-leaf: and a test may import vitest and a built-in, and nothing more', () => {
    expect(check(clean({ 'packages/contract/src/a.test.ts': "import { it } from 'vitest'; import fs from 'node:fs';" }))).toEqual([]);
    expect(rulesIn(check(clean({ 'packages/contract/src/a.test.ts': "import z from 'zod';" })))).toEqual(['packages-are-a-leaf']);
  });

  it('functions-are-self-contained: a function importing the app, or a bare specifier', () => {
    expect(rulesIn(check(clean({ 'supabase/functions/x/index.ts': "import '../../../app/src/screen';" })))).toEqual(['functions-are-self-contained']);
    expect(rulesIn(check(clean({ 'supabase/functions/x/index.ts': "import z from 'zod';" })))).toEqual(['functions-are-self-contained']);
  });

  it('functions-are-self-contained: even in a test', () => {
    expect(rulesIn(check(clean({ 'supabase/functions/x/x.test.ts': "import '../../../packages/contract/src/index.ts';" })))).toEqual(['functions-are-self-contained']);
  });

  it('gateway-stays-out-of-the-functions: #803', () => {
    const v = check(clean({ 'app/server/billing.ts': "import '../../supabase/functions/_shared/b.ts';" }));
    expect(rulesIn(v)).toEqual(['gateway-stays-out-of-the-functions']);
    expect(v[0].fix).toContain('#803');
  });

  it('api-reaches-only-the-server: the Vercel entry point importing the client', () => {
    expect(rulesIn(check(clean({ 'app/api/institution/[...path].ts': "import '../../src/screen';" })))).toEqual(['api-reaches-only-the-server']);
    expect(check(clean({ 'app/api/institution/[...path].ts': "import '../../server/gateway';" }))).toEqual([]);
  });

  it('gateway-dependencies-are-named: a new package in code that ships, not in a test', () => {
    expect(rulesIn(check(clean({ 'app/server/new.ts': "import pg from 'pg';" })))).toEqual(['gateway-dependencies-are-named']);
    expect(check(clean({ 'app/server/new.test.ts': "import { it } from 'vitest'; import pg from 'pg';" }))).toEqual([]);
    expect(check(clean({ 'app/server/ai.ts': "import o from 'openai'; import s from '@supabase/supabase-js/dist/main';" }))).toEqual([]);
  });

  it('browser-graph-is-clean: a built-in anywhere the entry reaches', () => {
    const v = check(clean({ 'app/src/screen.tsx': "import fs from 'node:fs';" }));
    expect(rulesIn(v)).toEqual(['browser-graph-is-clean']);
    expect(v[0].fix).toContain('main.tsx → app/src/screen.tsx');
  });

  it('browser-graph-is-clean: but the same import in a file nothing reaches is not a finding', () => {
    // This is `lib/counts.ts` today: five audit modules under app/src import node:fs.
    expect(check(clean({ 'app/src/audit.ts': "import fs from 'node:fs';" }))).toEqual([]);
  });

  it('browser-graph-is-clean: the server, a test or a script reached by the entry', () => {
    expect(rulesIn(check(clean({ 'app/src/screen.tsx': "import '../server/gateway';" })))).toEqual(['browser-graph-is-clean']);
    expect(rulesIn(check(clean({ 'app/src/screen.tsx': "import './x.test';", 'app/src/x.test.ts': 'export {};' })))).toEqual(['browser-graph-is-clean']);
    expect(rulesIn(check(clean({ 'app/src/screen.tsx': "import '../scripts/audio';", 'app/scripts/audio.ts': 'export {};' })))).toEqual(['browser-graph-is-clean']);
  });

  it('browser-graph-is-clean: through a lazy import, which is most of the app', () => {
    const v = check(clean({ 'app/src/main.tsx': "const s = () => import('./lazy');", 'app/src/lazy.tsx': "import fs from 'node:fs';" }));
    expect(rulesIn(v)).toEqual(['browser-graph-is-clean']);
  });

  it('browser-graph-is-clean: an import that resolves to nothing, which hides what is under it', () => {
    expect(rulesIn(check(clean({ 'app/src/screen.tsx': "import './gone';" })))).toEqual(['browser-graph-is-clean']);
    // …but a stylesheet is not code, and is fine.
    expect(check(clean({ 'app/src/screen.tsx': "import './app.css';" }))).toEqual([]);
  });

  describe('the ratchet', () => {
    const inversion = { 'app/server/integration/worker.ts': "import '../../src/lib/integration/adapter';", 'app/src/lib/integration/adapter.ts': 'export {};' };
    const pair = 'app/server/integration/worker.ts => app/src/lib/integration/adapter.ts';

    it('refuses a new inversion', () => {
      const v = checkBoundaries(clean(inversion), { ledger: [] });
      expect(rulesIn(v)).toEqual(['server-uses-client-lib-only-as-recorded']);
      expect(v[0].spec).toBe('app/src/lib/integration/adapter.ts');
    });

    it('allows a recorded one', () => {
      expect(checkBoundaries(clean(inversion), { ledger: [pair] })).toEqual([]);
    });

    it('refuses a recorded one that has gone, so the list can only shrink', () => {
      const v = checkBoundaries(clean(), { ledger: [pair] });
      expect(rulesIn(v)).toEqual(['server-uses-client-lib-only-as-recorded']);
      expect(v[0].spec).toMatch(/^stale: /);
    });

    it('does not count a test, which is never shipped', () => {
      const tree = clean({ 'app/server/integration/worker.test.ts': "import '../../src/lib/integration/adapter';", 'app/src/lib/integration/adapter.ts': 'export {};' });
      expect(checkBoundaries(tree, { ledger: [] })).toEqual([]);
    });
  });
});
