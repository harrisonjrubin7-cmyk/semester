/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGraph, codeOf, cycles, importsIn, productionOnly } from './graph.ts';
import { loadGraph, readSources } from './tree.ts';
import {
  STRICT_RULES,
  SLICE_FILE_BUDGET,
  applicationDependsInward,
  adaptersAreTheOnlyDoor,
  coreIsPure,
  errorCodesNameTheirSlice,
  kernelIsALeaf,
  legacyDoesNotReachIntoComposition,
  lockedScreensStayLocked,
  packagesDoNotImportTheApp,
  placement,
  ratchetCycles,
  ratchetUpward,
  sliceDoorsStayShut,
  sliceShape,
  slicesAreAcyclic,
  treeOf,
  upwardEdges,
  type Ratchet,
} from './rules.ts';

/**
 * The architecture, held by tests.
 *
 * Three groups, in the order they should be trusted:
 *
 * 1. **The scanner.** Every rule below is a function of the import graph, so
 *    a scanner that quietly found fewer imports would turn every rule green.
 *    It is shown the inputs that fool naive ones.
 * 2. **Each rule against a fixture that breaks it.** A rule that has never
 *    failed is not known to be a rule. Every fixture starts from one clean
 *    slice and changes exactly one thing, so the control is inside each test
 *    and a rule that refused everything would fail the clean case.
 * 3. **The real tree.** Strict rules must find nothing; the ratchets must find
 *    exactly what `legacy.json` says, no more and no less.
 */

const SRC = join(import.meta.dirname, '..');
const PACKAGES = join(SRC, '../../packages');
const ratchet = JSON.parse(readFileSync(join(import.meta.dirname, 'legacy.json'), 'utf8')) as Ratchet;

// ── 1. the scanner ─────────────────────────────────────────────────────────

describe('the import scanner', () => {
  it('reads static, type-only, re-exported, side-effect and dynamic imports', () => {
    const got = importsIn(`
      import a from './a';
      import type { B } from './b';
      import { c,
        d } from "./c";
      export * from './d';
      export type { E } from './e';
      import './f.css';
      const g = await import('./g');
    `);
    expect(got.map((i) => i.spec)).toEqual(['./a', './b', './c', './d', './e', './f.css', './g']);
    expect(got.filter((i) => i.typeOnly).map((i) => i.spec)).toEqual(['./b', './e']);
    expect(got.filter((i) => i.kind === 'dynamic').map((i) => i.spec)).toEqual(['./g']);
  });

  it('is not fooled by text that only looks like an import', () => {
    const got = importsIn(`
      // import nope from './line-comment';
      /* import nope from './block-comment'; */
      /**
       * export * from './doc-comment';
       */
      const url = 'http://example.com/import x from "./in-a-string"';
      import real from './real';
    `);
    expect(got.map((i) => i.spec)).toEqual(['./real']);
  });

  it('is not blinded by a regular expression holding a quote', () => {
    // The scanner that ignored regex literals reads the quote in `/'/g` as the
    // start of a string and loses every import after it.
    const got = importsIn(`
      const clean = (s: string) => s.replace(/'/g, '').replace(/"/g, '');
      const lazy = () => import('./after-the-regex');
    `);
    expect(got.map((i) => i.spec)).toEqual(['./after-the-regex']);
  });

  it('keeps a division a division', () => {
    expect(codeOf('const half = total / 2; // gone\nconst x = a / b / c;')).toBe('const half = total / 2; \nconst x = a / b / c;');
  });

  it('resolves files, indexes, packages, third-party modules, assets and escapes from src', () => {
    const g = buildGraph({
      'lib/a.ts': `import './b'; import './dir'; import './s.css'; import 'react'; import '@semester/institution'; import '../../../packages/x/y';`,
      'lib/b.ts': '',
      'lib/dir/index.ts': '',
    });
    const e = g.byFile.get('lib/a.ts')!;
    expect(e.map((x) => x.to ?? x.pkg ?? x.external ?? x.outside ?? x.asset)).toEqual(['lib/b.ts', 'lib/dir/index.ts', 'lib/s.css', 'react', '@semester/institution', '../../packages/x/y']);
  });

  it('finds an import cycle, and not a diamond', () => {
    const loop = buildGraph({ 'a.ts': `import './b'`, 'b.ts': `import './c'`, 'c.ts': `import './a'` });
    expect(cycles(loop)).toEqual([['a.ts', 'b.ts', 'c.ts']]);
    const diamond = buildGraph({ 'a.ts': `import './b'; import './c'`, 'b.ts': `import './d'`, 'c.ts': `import './d'`, 'd.ts': '' });
    expect(cycles(diamond)).toEqual([]);
  });

  // The honest check of the scanner on the real tree: it has to find the
  // edges the app is known to have. The number is not a target; it is a floor
  // that a scanner which had stopped reading would fall through.
  it('sees the real tree: well over a thousand files and five thousand imports', () => {
    const g = productionOnly(loadGraph(SRC));
    expect(g.files.size).toBeGreaterThan(1000);
    expect(g.edges.filter((e) => e.to).length).toBeGreaterThan(5000);
  });
});

// ── 2. each rule, against a fixture that breaks it ─────────────────────────

/** One slice that satisfies every strict rule. Each test below changes one thing. */
const clean = (): Record<string, string> => ({
  'kernel/index.ts': `export const k = 1;`,
  'lib/legacy.ts': `export const legacy = 1;`,
  'domains/a/index.ts': `export { x } from './domain/x';\nexport { use } from './application/use';`,
  'domains/a/domain/x.ts': `import { k } from '../../../kernel';\nexport const x = k;`,
  'domains/a/application/use.ts': `import { x } from '../domain/x';\nexport const use = x;`,
  'domains/a/adapters/legacy.ts': `import { legacy } from '../../../lib/legacy';\nimport { use } from '../application/use';\nexport const adapt = [legacy, use];`,
  'domains/a/adapters/index.ts': `export { adapt } from './legacy';`,
  'domains/a/a.test.ts': `export {};`,
  'domains/b/index.ts': `export { y } from './domain/y';`,
  'domains/b/domain/y.ts': `export const y = 1;`,
  'domains/b/b.test.ts': `export {};`,
  'composition/root.ts': `import { adapt } from '../domains/a/adapters/index';\nimport { use } from '../domains/a/index';\nexport const root = [adapt, use];`,
});

const run = (rule: (t: ReturnType<typeof treeOf>) => unknown[], files: Record<string, string>) => rule(treeOf(files));
const changed = (patch: Record<string, string>) => ({ ...clean(), ...patch });

describe('the strict rules, on fixtures', () => {
  it('pass on one clean slice, so a rule that refused everything would fail here', () => {
    for (const [name, rule] of STRICT_RULES) expect(run(rule, clean()), name).toEqual([]);
  });

  it('kernel-is-a-leaf: the kernel may not import the app', () => {
    expect(run(kernelIsALeaf, changed({ 'kernel/index.ts': `import { legacy } from '../lib/legacy';\nexport const k = legacy;` }))).toHaveLength(1);
    expect(run(kernelIsALeaf, changed({ 'kernel/index.ts': `import 'react';` }))).toHaveLength(1);
  });

  it('core-is-pure: no legacy, no other slice, no third-party module, no ambient state', () => {
    const bad = (body: string) => run(coreIsPure, changed({ 'domains/a/domain/x.ts': body }));
    expect(bad(`import { legacy } from '../../../lib/legacy';`)).toHaveLength(1);
    expect(bad(`import { y } from '../../b/index';`)).toHaveLength(1);
    expect(bad(`import { createElement } from 'react';`)).toHaveLength(1);
    expect(bad(`import { use } from '../application/use';`)).toHaveLength(1);
    expect(bad(`export const t = Date.now();`)).toHaveLength(1);
    expect(bad(`export const t = new Date();`)).toHaveLength(1);
    expect(bad(`export const s = localStorage.getItem('k');`)).toHaveLength(1);
    expect(bad(`export const r = Math.random();`)).toHaveLength(1);
    expect(bad(`export const e = import.meta.env.MODE;`)).toHaveLength(1);
    // The control the other way: what a pure layer may do.
    expect(bad(`import type { Result } from '@semester/institution';\nexport const d = new Date(86_400_000);`)).toEqual([]);
    // And a comment that mentions the wall clock is not the wall clock.
    expect(bad(`// never call Date.now() here\nexport const ok = 1;`)).toEqual([]);
  });

  it('application-depends-inward: ports, not legacy; other slices only by their front door', () => {
    const bad = (body: string) => run(applicationDependsInward, changed({ 'domains/a/application/use.ts': body }));
    expect(bad(`import { legacy } from '../../../lib/legacy';`)).toHaveLength(1);
    expect(bad(`import { adapt } from '../adapters/legacy';`)).toHaveLength(1);
    expect(bad(`import { y } from '../../b/domain/y';`)).toHaveLength(1);
    expect(bad(`export const t = Date.now();`)).toHaveLength(1);
    expect(bad(`import { y } from '../../b/index';`)).toEqual([]);
  });

  it('adapters-are-the-only-door: an adapter may take legacy logic, not a screen or a component', () => {
    const bad = (body: string, extra: Record<string, string> = {}) => run(adaptersAreTheOnlyDoor, changed({ 'domains/a/adapters/legacy.ts': body, 'screens/Today.tsx': '', 'components/ui.tsx': '', ...extra }));
    expect(bad(`import '../../../screens/Today';`)).toHaveLength(1);
    expect(bad(`import '../../../components/ui';`)).toHaveLength(1);
    expect(bad(`import 'react';`)).toHaveLength(1);
    expect(bad(`import '../../b/domain/y';`)).toHaveLength(1);
    expect(bad(`export const t = Date.now();`)).toHaveLength(1);
    expect(bad(`import '../../../lib/legacy';\nimport '../../b/index';`)).toEqual([]);
  });

  it('slice-doors-stay-shut: from outside, only index.ts — and adapters/index.ts from composition/', () => {
    expect(run(sliceDoorsStayShut, changed({ 'lib/legacy.ts': `import '../domains/a/domain/x';` }))).toHaveLength(1);
    expect(run(sliceDoorsStayShut, changed({ 'domains/b/domain/y.ts': `import '../../a/application/use';` }))).toHaveLength(1);
    expect(run(sliceDoorsStayShut, changed({ 'lib/legacy.ts': `import '../domains/a/adapters/index';` }))).toHaveLength(1);
    expect(run(sliceDoorsStayShut, changed({ 'lib/legacy.ts': `import '../domains/a/index';` }))).toEqual([]);
  });

  it('slices-are-acyclic: a depends on b depends on a is a refusal', () => {
    const two = changed({ 'domains/a/application/use.ts': `import { y } from '../../b/index';\nexport const use = y;`, 'domains/b/index.ts': `import { use } from '../a/index';\nexport const y = use;` });
    const got = run(slicesAreAcyclic, two) as { message: string }[];
    expect(got).toHaveLength(1);
    expect(got[0].message).toContain('a → b → a');
  });

  it('legacy-does-not-reach-into-composition: lib is not the shell', () => {
    expect(run(legacyDoesNotReachIntoComposition, changed({ 'lib/legacy.ts': `import '../composition/root';` }))).toHaveLength(1);
    expect(run(legacyDoesNotReachIntoComposition, changed({ 'screens/Today.tsx': `import '../composition/root';` }))).toEqual([]);
  });

  it('slice-shape: a front door, tests beside the code, nothing loose, nothing enormous', () => {
    const without = clean();
    delete without['domains/b/index.ts'];
    expect(run(sliceShape, without)).toHaveLength(1);
    const untested = clean();
    delete untested['domains/b/b.test.ts'];
    expect(run(sliceShape, untested)).toHaveLength(1);
    expect(run(sliceShape, changed({ 'domains/b/loose.ts': 'export {};' }))).toHaveLength(1);
    expect(run(sliceShape, changed({ 'domains/b/domain/y.ts': 'export const y = 1;\n'.repeat(SLICE_FILE_BUDGET + 1) }))).toHaveLength(1);
  });

  it('error-codes-name-their-slice: a code says whose refusal it is', () => {
    expect(run(errorCodesNameTheirSlice, changed({ 'domains/a/domain/x.ts': `import { fail } from '../../../kernel';\nexport const f = fail('forbidden', 'tasks.not_yours', 'no');` }))).toHaveLength(1);
    expect(run(errorCodesNameTheirSlice, changed({ 'domains/a/domain/x.ts': `import { fail } from '../../../kernel';\nexport const f = fail('forbidden', 'a.not_yours', 'no');` }))).toEqual([]);
  });

  it('placement reads a path the way the rules do', () => {
    expect(placement('domains/tasks/domain/task.ts')).toEqual({ slice: 'tasks', layer: 'domain', rest: 'task.ts' });
    expect(placement('domains/tasks/index.ts')).toEqual({ slice: 'tasks', layer: 'public', rest: 'index.ts' });
    expect(placement('lib/date.ts')).toBeNull();
  });
});

describe('the ratchets, on fixtures', () => {
  const legacy = buildGraph({ 'lib/a.ts': `import '../state/s';`, 'state/s.ts': `import '../lib/b';`, 'lib/b.ts': '', 'screens/S.tsx': `import '../lib/b';` });

  it('see an upward import, and only that', () => {
    expect(upwardEdges(legacy)).toEqual(['lib/a.ts -> state/s.ts']);
  });

  it('refuse a new upward import, and a recorded one that has gone', () => {
    expect(ratchetUpward(legacy, ['lib/a.ts -> state/s.ts'])).toEqual([]);
    expect(ratchetUpward(legacy, [])).toHaveLength(1);
    expect(ratchetUpward(legacy, ['lib/a.ts -> state/s.ts', 'lib/gone.ts -> state/s.ts'])).toHaveLength(1);
  });

  it('refuse a new cycle, a longer one, and a baseline that has gone stale', () => {
    const loop = buildGraph({ 'a.ts': `import './b'`, 'b.ts': `import './a'` });
    expect(ratchetCycles(loop, { count: 1, largest: 2 })).toEqual([]);
    expect(ratchetCycles(loop, { count: 0, largest: 0 })).toHaveLength(2);
    expect(ratchetCycles(loop, { count: 2, largest: 3 })).toHaveLength(1);
  });

  it('lock a migrated screen to the domain layer', () => {
    const t = treeOf({ 'screens/Today.tsx': `import '../lib/date';\nimport '../composition/root';`, 'lib/date.ts': '', 'composition/root.ts': '' });
    expect(lockedScreensStayLocked(t, ['screens/Today.tsx'])).toHaveLength(1);
    expect(lockedScreensStayLocked(t, [])).toEqual([]);
    expect(lockedScreensStayLocked(t, ['screens/Gone.tsx'])).toHaveLength(1);
  });

  it('keep the contract packages from importing the app', () => {
    expect(packagesDoNotImportTheApp({ 'institution/src/x.ts': `import '../../../app/src/lib/date';` })).toHaveLength(1);
    expect(packagesDoNotImportTheApp({ 'institution/src/x.ts': `import './y.ts';` })).toEqual([]);
  });
});

// ── 3. the real tree ───────────────────────────────────────────────────────

describe('the real tree', () => {
  const sources = readSources(SRC);
  const tree = treeOf(sources);
  const prod = productionOnly(tree.graph);

  for (const [name, rule] of STRICT_RULES) {
    it(`${name}: no violations`, () => {
      expect(rule(tree)).toEqual([]);
    });
  }

  it('legacy-imports-do-not-point-up: exactly the recorded imports (legacy.json)', () => {
    expect(ratchetUpward(prod, ratchet.upwardImports)).toEqual([]);
  });

  it('legacy-cycles-do-not-grow: exactly the recorded cycles (legacy.json)', () => {
    expect(ratchetCycles(prod, ratchet.cycles)).toEqual([]);
  });

  it('locked-screens-stay-locked: every locked screen reads only the domain layer', () => {
    expect(lockedScreensStayLocked(tree, ratchet.lockedScreens)).toEqual([]);
  });

  it('packages-do-not-import-the-app', () => {
    expect(packagesDoNotImportTheApp(readSources(PACKAGES))).toEqual([]);
  });
});
