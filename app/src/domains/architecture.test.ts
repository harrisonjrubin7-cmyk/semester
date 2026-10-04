/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The architecture, as tests.
 *
 * `docs/architecture/modular-monolith.md` says what the module graph is and why.
 * This file is what keeps it true. It reads imports as text — no new
 * dependency, the way `isolation.test.ts` and `rootunmount.test.ts` do — and
 * holds three kinds of rule:
 *
 * 1. **Domain rules**, which must hold with no exceptions: who may import whom,
 *    that only an anti-corruption layer touches legacy code, and that a rule
 *    never reads the clock, the network, storage or React.
 * 2. **Layer rules** for the existing app, which hold *today* with zero
 *    violations and so are enforced outright: `lib/`, `state/` and `data/` never
 *    import UI, and a component never imports a screen. A screen-centric
 *    monolith is what you get when that stops being true.
 * 3. **Ratchets** for what is already wrong. Each is a list of today's
 *    violators in `legacy-baseline.json`. A *new* violator fails, and so does a
 *    *fixed* one still listed — the list can only shrink. Regenerate with
 *    `ARCH=write npx vitest run src/domains/architecture.test.ts` after fixing
 *    one, and the diff of the JSON is the review.
 *
 * Every rule is also run against a synthetic tree that breaks it, because a
 * checker that finds nothing in the real tree is only evidence if it finds
 * something when there is something to find.
 */

const APP = new URL('../..', import.meta.url).pathname; // …/app/
const SRC = join(APP, 'src');
const BASELINE_PATH = join(SRC, 'domains', 'legacy-baseline.json');

// ─── the target module graph ─────────────────────────────────────────────────

/** Each domain, and the domains it may import (always through their `index`). `kernel` imports nothing. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  kernel: [],
  identity: ['kernel'],
  policy: ['kernel', 'identity'],
  tasks: ['kernel', 'policy'],
  calendar: ['kernel'],
  today: ['kernel', 'calendar', 'policy', 'tasks'],
};

/** The wiring file: sees every domain's public surface and the legacy app, and is seen by screens. */
const COMPOSITION = 'composition';

/** Where a domain may reach into legacy code. */
const isAcl = (path: string) => /\/acl\.ts$/.test(path);

/** The one file that is allowed to read the real clock. */
const CLOCK_FILE = 'domains/kernel/clock.ts';

// ─── reading imports ─────────────────────────────────────────────────────────

interface Source {
  /** Path relative to `app/src`, e.g. `domains/tasks/model.ts`. */
  path: string;
  text: string;
}

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(text: string): string[] {
  const code = stripComments(text);
  const out: string[] = [];
  for (const m of code.matchAll(IMPORT)) out.push((m[1] ?? m[2] ?? m[3]) as string);
  return out;
}

/**
 * A specifier as a repo-relative path without extension (`app/src/lib/date`,
 * `packages/institution/src/workflow`), or `null` for a bare package. A
 * directory import and its `index` are the same module, so both resolve to the
 * directory.
 */
function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const target = posix.normalize(posix.join('app/src', posix.dirname(from), spec));
  return target.replace(/\/index$/, '').replace(/\.(tsx?|json)$/, '');
}

const segment = (repoPath: string, prefix: string) => repoPath.slice(prefix.length).split('/')[0];

// ─── rule 1: the domains ─────────────────────────────────────────────────────

/** Things a rule must not do. Each is a way a domain stops being testable by calling it. */
const IMPURE: readonly [RegExp, string][] = [
  [/\bDate\.now\s*\(/, 'reads the wall clock (inject a Clock)'],
  [/\bnew Date\s*\(/, 'builds a Date (inject a Clock, or use kernel date arithmetic)'],
  [/\bMath\.random\s*\(/, 'is not deterministic (inject an id source)'],
  [/\bcrypto\.\w+/, 'reaches for crypto (inject an id source)'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'touches browser storage (go through a port)'],
  [/\bfetch\s*\(/, 'calls the network (go through a port)'],
  [/\b(window|document|navigator)\./, 'touches the DOM (a domain has no screen)'],
  [/\bimport\.meta\b/, 'reads build-time configuration (receive it as data)'],
  [/\bprocess\.env\b/, 'reads the environment (receive it as data)'],
];

function domainViolations(files: readonly Source[]): string[] {
  const out: string[] = [];
  const known = new Set(Object.keys(ALLOWED));

  for (const f of files) {
    if (!f.path.startsWith('domains/') || isTest(f.path)) continue;
    const parts = f.path.split('/');
    const owner = parts.length === 2 ? parts[1].replace(/\.ts$/, '') : parts[1];
    if (owner !== COMPOSITION && !known.has(owner)) {
      out.push(`${f.path}: "${owner}" is not a declared domain — add it to ALLOWED, with what it may import`);
      continue;
    }

    for (const spec of importsOf(f.text)) {
      const target = resolve(f.path, spec);
      if (target === null) {
        out.push(`${f.path}: imports the package "${spec}" — a domain depends on nothing it does not own`);
        continue;
      }
      if (target.startsWith('app/src/domains/')) {
        const dep = segment(target, 'app/src/domains/');
        if (dep === owner) continue;
        if (dep === COMPOSITION) out.push(`${f.path}: imports the composition root — only screens and hooks do`);
        else if (!known.has(dep)) out.push(`${f.path}: imports "${spec}", which is not a declared domain`);
        else if (target !== `app/src/domains/${dep}`) {
          out.push(`${f.path}: reaches into ${dep} through "${spec}" — import its index, not its insides`);
        } else if (owner !== COMPOSITION && !ALLOWED[owner].includes(dep)) {
          out.push(`${f.path}: ${owner} may not depend on ${dep} (allowed: ${ALLOWED[owner].join(', ') || 'nothing'})`);
        }
      } else if (target.startsWith('packages/institution/')) {
        if (owner !== 'kernel') out.push(`${f.path}: ${owner} imports the institution package — only the kernel wraps it`);
      } else if (target.startsWith('app/src/')) {
        if (owner !== COMPOSITION && !isAcl(f.path)) {
          out.push(`${f.path}: imports legacy code "${spec}" outside an anti-corruption layer (acl.ts)`);
        }
      } else {
        out.push(`${f.path}: imports "${spec}", outside the application`);
      }
    }

    if (f.path !== CLOCK_FILE) {
      const code = stripComments(f.text);
      for (const [pattern, why] of IMPURE) if (pattern.test(code)) out.push(`${f.path}: ${why}`);
    }
  }
  return out;
}

/** A domain's `index.ts` is its public surface; the in-memory test adapter must never be on it. */
function leakedTestAdapters(files: readonly Source[]): string[] {
  return files
    .filter((f) => /^domains\/[^/]+\/index\.ts$/.test(f.path))
    .filter((f) => importsOf(f.text).some((s) => /\/(memory|testing|fake)(\.ts)?$/.test(s)))
    .map((f) => `${f.path}: exports a test adapter from the public surface`);
}

/** Code outside `domains/` may use a domain only through its index or the composition root. */
function outsideViolations(files: readonly Source[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.path.startsWith('domains/') || isTest(f.path)) continue;
    for (const spec of importsOf(f.text)) {
      const target = resolve(f.path, spec);
      if (!target?.startsWith('app/src/domains/')) continue;
      const rest = target.slice('app/src/domains/'.length);
      const ok = rest === COMPOSITION || (Object.hasOwn(ALLOWED, rest) && rest !== 'kernel');
      if (!ok) out.push(`${f.path}: imports "${spec}" — use domains/composition or a domain's index`);
    }
  }
  return out;
}

/** Cycles among domains, by name. Found on the *declared* graph and on the real one. */
function domainCycles(graph: Readonly<Record<string, readonly string[]>>): string[][] {
  const cycles: string[][] = [];
  const visit = (node: string, path: string[]) => {
    if (path.includes(node)) {
      cycles.push([...path.slice(path.indexOf(node)), node]);
      return;
    }
    for (const next of graph[node] ?? []) visit(next, [...path, node]);
  };
  for (const node of Object.keys(graph)) visit(node, []);
  return cycles;
}

function actualDomainGraph(files: readonly Source[]): Record<string, string[]> {
  const graph: Record<string, string[]> = Object.fromEntries(Object.keys(ALLOWED).map((d) => [d, []]));
  for (const f of files) {
    if (!f.path.startsWith('domains/') || isTest(f.path)) continue;
    const owner = f.path.split('/')[1];
    if (!(owner in graph)) continue;
    for (const spec of importsOf(f.text)) {
      const target = resolve(f.path, spec);
      if (!target?.startsWith('app/src/domains/')) continue;
      const dep = segment(target, 'app/src/domains/');
      if (dep !== owner && dep in graph && !graph[owner].includes(dep)) graph[owner].push(dep);
    }
  }
  return graph;
}

// ─── rule 2 and 3: the existing app ──────────────────────────────────────────

const UI = /^(components|screens)\//;
/** Inside-`src` paths are extensionless, so the shell files are `App`, `screens` (the registry) and `main`. */
const ROOT_UI = /^(App|screens|main)$/;
const isUi = (path: string) => UI.test(path) || ROOT_UI.test(path);

/** Source-relative path of an import target inside `app/src`, or null. */
function inside(from: string, spec: string): string | null {
  const target = resolve(from, spec);
  return target?.startsWith('app/src/') ? target.slice('app/src/'.length) : null;
}

/** `from → to` edges where the dependency points the wrong way. Zero today, so zero is the rule. */
function layerViolations(files: readonly Source[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (isTest(f.path)) continue;
    const layer = f.path.split('/')[0];
    for (const spec of importsOf(f.text)) {
      const to = inside(f.path, spec);
      if (!to) continue;
      const lower = ['lib', 'state', 'data', 'domains'].includes(layer);
      if (lower && isUi(to)) out.push(`${f.path} → ${to}: ${layer} must not import UI`);
      if (layer === 'components' && (/^screens\//.test(to) || ROOT_UI.test(to))) {
        out.push(`${f.path} → ${to}: a component must not import a screen`);
      }
      if (layer === 'screens' && ROOT_UI.test(to)) out.push(`${f.path} → ${to}: a screen must not import the app shell`);
    }
  }
  return out.sort();
}

/** Each ratchet: a name, what it measures, and the function that lists today's violators. */
const RATCHETS = {
  uiTouchesStorage: {
    says: 'screens and components that read or write browser storage themselves instead of asking a store or port',
    find: (files: readonly Source[]) =>
      files
        .filter((f) => !isTest(f.path) && UI.test(f.path))
        .filter((f) => /\b(localStorage|sessionStorage|indexedDB)\b/.test(stripComments(f.text)))
        .map((f) => f.path),
  },
  uiTalksToBackend: {
    says: 'screens and components that call the network or the Supabase client themselves, bypassing the sync facade in lib/cloud',
    find: (files: readonly Source[]) =>
      files
        .filter((f) => !isTest(f.path) && UI.test(f.path))
        .filter((f) => {
          const code = stripComments(f.text);
          return /\bfetch\s*\(/.test(code) || importsOf(f.text).includes('@supabase/supabase-js');
        })
        .map((f) => f.path),
  },
  libImportsState: {
    says: 'lib modules that import the store, so the domain logic they hold cannot be used without it',
    find: (files: readonly Source[]) =>
      files
        .filter((f) => !isTest(f.path) && f.path.startsWith('lib/'))
        .filter((f) => importsOf(f.text).some((s) => inside(f.path, s)?.startsWith('state/')))
        .map((f) => f.path),
  },
  screenImportsScreen: {
    says: 'a screen importing a different screen, which is how one route becomes load-bearing for another',
    find: (files: readonly Source[]) =>
      files
        .filter((f) => !isTest(f.path) && f.path.startsWith('screens/'))
        .flatMap((f) =>
          importsOf(f.text)
            .map((s) => inside(f.path, s))
            .filter((to): to is string => !!to && to.startsWith('screens/') && to !== f.path)
            // Files in one screen's own folder belong to it; only crossing to a different top-level screen counts.
            .filter((to) => topScreen(to) !== topScreen(f.path))
            .map((to) => `${f.path} → ${to}`),
        ),
  },
  inACycle: {
    says: 'modules that sit in an import cycle, where changing one means re-reading all of them',
    find: (files: readonly Source[]) => filesInCycles(files),
  },
} as const;

const topScreen = (path: string) => path.replace(/^screens\//, '').split('/')[0].replace(/\.tsx?$/, '').toLowerCase();

/** Strongly connected components of size > 1, over non-test files (Tarjan). */
function filesInCycles(files: readonly Source[]): string[] {
  const live = files.filter((f) => !isTest(f.path));
  const known = new Set(live.map((f) => f.path.replace(/\.tsx?$/, '')));
  const index = new Map<string, string>();
  for (const f of live) index.set(f.path.replace(/\.tsx?$/, '').replace(/\/index$/, ''), f.path);
  const edges = new Map<string, string[]>();
  for (const f of live) {
    const deps = importsOf(f.text)
      .map((s) => inside(f.path, s))
      .filter((t): t is string => t !== null)
      .map((t) => index.get(t))
      .filter((t): t is string => t !== undefined);
    edges.set(f.path, deps);
  }
  void known;

  let n = 0;
  const low = new Map<string, number>();
  const idx = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const out: string[] = [];
  const connect = (v: string) => {
    idx.set(v, n);
    low.set(v, n++);
    stack.push(v);
    on.add(v);
    for (const w of edges.get(v) ?? []) {
      if (!idx.has(w)) {
        connect(w);
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
      } else if (on.has(w)) {
        low.set(v, Math.min(low.get(v) as number, idx.get(w) as number));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const group: string[] = [];
      let w: string;
      do {
        w = stack.pop() as string;
        on.delete(w);
        group.push(w);
      } while (w !== v);
      if (group.length > 1) out.push(...group);
    }
  };
  for (const v of edges.keys()) if (!idx.has(v)) connect(v);
  return out.sort();
}

// ─── the real tree ───────────────────────────────────────────────────────────

function load(): Source[] {
  const out: Source[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(SRC, dir), { withFileTypes: true })) {
      const rel = dir === '' ? e.name : `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === '__pix' || e.name === '__docs' || e.name === 'assets') continue;
        walk(rel);
      } else if (/\.tsx?$/.test(e.name)) {
        out.push({ path: rel, text: readFileSync(join(SRC, rel), 'utf8') });
      }
    }
  };
  walk('');
  return out;
}

const tree = load();
const sorted = (xs: readonly string[]) => [...new Set(xs)].sort();

type Baseline = Record<keyof typeof RATCHETS, string[]>;

function measure(): Baseline {
  return Object.fromEntries(Object.entries(RATCHETS).map(([k, r]) => [k, sorted(r.find(tree))])) as Baseline;
}

if (process.env.ARCH === 'write') {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(measure(), null, 2)}\n`);
}

const baseline: Baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : ({} as Baseline);

describe('the domains hold their boundaries', () => {
  it('read the tree, so the rest of this means something', () => {
    expect(tree.length).toBeGreaterThan(1000);
    expect(tree.filter((f) => f.path.startsWith('domains/') && !isTest(f.path)).length).toBeGreaterThan(20);
  });

  it('import only what the module graph allows, and only through an index', () => {
    expect(domainViolations(tree)).toEqual([]);
  });

  it('keep test adapters off the public surface', () => {
    expect(leakedTestAdapters(tree)).toEqual([]);
  });

  it('are used from outside only through an index or the composition root', () => {
    expect(outsideViolations(tree)).toEqual([]);
  });

  it('have no cycle, declared or actual, and use no edge the table does not declare', () => {
    expect(domainCycles(ALLOWED)).toEqual([]);
    const actual = actualDomainGraph(tree);
    expect(domainCycles(actual)).toEqual([]);
    for (const [domain, deps] of Object.entries(actual)) {
      for (const dep of deps) expect(ALLOWED[domain], `${domain} → ${dep}`).toContain(dep);
    }
  });

  it('each have a test beside them, so a domain cannot ship unexamined', () => {
    for (const domain of Object.keys(ALLOWED)) {
      const has = tree.some((f) => f.path.startsWith(`domains/${domain}/`) && isTest(f.path));
      expect(has, `${domain} has no test file`).toBe(true);
    }
  });
});

describe('the existing layers do not run backwards', () => {
  it('keeps lib, state and data from importing UI, and components from importing screens', () => {
    expect(layerViolations(tree)).toEqual([]);
  });
});

describe('the ratchets only tighten', () => {
  for (const [name, ratchet] of Object.entries(RATCHETS) as [keyof typeof RATCHETS, (typeof RATCHETS)[keyof typeof RATCHETS]][]) {
    const now = sorted(ratchet.find(tree));
    const was = baseline[name] ?? [];

    it(`${name}: no new ${ratchet.says}`, () => {
      expect(now.filter((x) => !was.includes(x))).toEqual([]);
    });

    it(`${name}: nothing fixed is still listed (regenerate the baseline)`, () => {
      expect(was.filter((x) => !now.includes(x))).toEqual([]);
    });
  }

  it('measured something, so an empty list is a fact and not a broken probe', () => {
    // The controls: today each of these is known to be non-empty. If a probe
    // started returning nothing because of a typo, this is what would say so.
    for (const name of ['uiTouchesStorage', 'uiTalksToBackend', 'libImportsState', 'screenImportsScreen', 'inACycle'] as const) {
      expect(baseline[name]?.length, name).toBeGreaterThan(0);
    }
  });
});

// ─── the checkers, against trees built to break them ─────────────────────────

const src = (path: string, text: string): Source => ({ path, text });

describe('the checkers find what they are for', () => {
  const clean = [
    src('domains/kernel/index.ts', `export const a = 1;`),
    src('domains/tasks/model.ts', `import { a } from '../kernel';\nimport { x } from '../policy';\nexport const t = a + x;`),
    src('domains/tasks/acl.ts', `import type { T } from '../../lib/types';`),
    src('domains/policy/index.ts', `export const x = 1;`),
    src('domains/composition.ts', `import { t } from './tasks';\nimport type { T } from '../lib/types';`),
  ];

  it('accepts a tree that follows the rules', () => {
    expect(domainViolations(clean)).toEqual([]);
  });

  const cases: [string, Source, RegExp][] = [
    ['an undeclared dependency', src('domains/calendar/x.ts', `import { t } from '../tasks';`), /calendar may not depend on tasks/],
    ['a deep import', src('domains/tasks/y.ts', `import { z } from '../policy/internal';`), /reaches into policy/],
    ['legacy code outside an ACL', src('domains/tasks/model2.ts', `import { d } from '../../lib/date';`), /outside an anti-corruption layer/],
    ['a package', src('domains/tasks/r.ts', `import { useState } from 'react';`), /imports the package "react"/],
    ['the composition root', src('domains/tasks/c.ts', `import { x } from '../composition';`), /composition root/],
    ['the institution package from a non-kernel', src('domains/policy/p.ts', `import { d } from '../../../../packages/institution/src/policy';`), /only the kernel wraps it/],
    ['an undeclared domain', src('domains/billing/x.ts', `export const b = 1;`), /not a declared domain/],
    ['the wall clock', src('domains/tasks/now.ts', `export const n = () => Date.now();`), /wall clock/],
    ['a Date', src('domains/tasks/d.ts', `export const n = () => new Date();`), /builds a Date/],
    ['storage', src('domains/tasks/s.ts', `export const n = localStorage.getItem('x');`), /browser storage/],
    ['the network', src('domains/tasks/f.ts', `export const n = () => fetch('/x');`), /network/],
    ['build config', src('domains/tasks/e.ts', `export const n = import.meta.env.X;`), /build-time configuration/],
  ];
  for (const [name, file, why] of cases) {
    it(`flags ${name}`, () => {
      expect(domainViolations([...clean, file]).join('\n')).toMatch(why);
    });
  }

  it('is not fooled by a forbidden word in a comment', () => {
    const quiet = src('domains/tasks/q.ts', `/** never Date.now() or fetch( or localStorage */\n// import x from 'react'\nexport const q = 1;`);
    expect(domainViolations([...clean, quiet])).toEqual([]);
  });

  it('sees an import split across lines', () => {
    const wide = src('domains/calendar/w.ts', `import {\n  a,\n  b,\n} from '../tasks';`);
    expect(domainViolations([...clean, wide]).join('\n')).toMatch(/calendar may not depend on tasks/);
  });

  it('exempts the clock file and nothing else from the purity rule', () => {
    const clock = src(CLOCK_FILE, `export const now = () => Date.now();`);
    expect(domainViolations([...clean, clock])).toEqual([]);
  });

  it('flags a test adapter on a public surface', () => {
    expect(leakedTestAdapters([src('domains/tasks/index.ts', `export { memoryTaskRepository } from './memory';`)])).toHaveLength(1);
    expect(leakedTestAdapters(clean)).toEqual([]);
  });

  it('flags a screen reaching into a domain’s insides, and allows the two doors', () => {
    expect(outsideViolations([src('screens/A.tsx', `import { c } from '../domains/tasks/usecases';`)])).toHaveLength(1);
    expect(outsideViolations([src('screens/A.tsx', `import { c } from '../domains/kernel';`)])).toHaveLength(1);
    expect(outsideViolations([src('screens/A.tsx', `import { c } from '../domains/composition';`)])).toEqual([]);
    expect(outsideViolations([src('screens/A.tsx', `import { c } from '../domains/tasks';`)])).toEqual([]);
  });

  it('finds a cycle between domains', () => {
    expect(domainCycles({ a: ['b'], b: ['c'], c: ['a'] })).toHaveLength(3);
    expect(domainCycles({ a: ['b'], b: [], c: ['a'] })).toEqual([]);
    const loop = [src('domains/tasks/x.ts', `import { p } from '../policy';`), src('domains/policy/x.ts', `import { t } from '../tasks';`)];
    expect(domainCycles(actualDomainGraph(loop))).not.toEqual([]);
  });

  it('flags a layer running backwards', () => {
    const bad = [
      src('lib/a.ts', `import { B } from '../components/B';`),
      src('state/s.ts', `import { S } from '../screens/S';`),
      src('components/C.tsx', `import { S } from '../screens/S';`),
      src('data/d.ts', `import { A } from '../App';`),
      src('screens/S.tsx', `export const S = 1;`),
      src('components/B.tsx', `export const B = 1;`),
      src('lib/ok.ts', `import { x } from './a';`),
    ];
    expect(layerViolations(bad)).toHaveLength(4);
    expect(layerViolations([src('lib/ok.ts', `import { x } from './a';`), src('screens/S.tsx', `import { C } from '../components/C';`)])).toEqual([]);
  });

  it('finds the files of an import cycle and only those', () => {
    const files = [
      src('lib/a.ts', `import { b } from './b';`),
      src('lib/b.ts', `import { c } from './c';`),
      src('lib/c.ts', `import { a } from './a';`),
      src('lib/d.ts', `import { a } from './a';`),
    ];
    expect(filesInCycles(files)).toEqual(['lib/a.ts', 'lib/b.ts', 'lib/c.ts']);
    expect(filesInCycles(files.slice(0, 2))).toEqual([]);
  });

  it('finds a screen importing another screen, but not its own folder', () => {
    const files = [
      src('screens/Calendar.tsx', `import { M } from './calendar/Move';`),
      src('screens/calendar/Move.tsx', `import { C } from '../Calendar';`),
      src('screens/Today.tsx', `import { C } from './Calendar';`),
      src('screens/Calendar2.tsx', `export const x = 1;`),
    ];
    expect(RATCHETS.screenImportsScreen.find(files)).toEqual(['screens/Today.tsx → screens/Calendar']);
  });

  it('finds a screen that touches storage or the network', () => {
    const files = [
      src('screens/A.tsx', `localStorage.setItem('k', 'v');`),
      src('components/B.tsx', `await fetch('/api');`),
      src('components/C.tsx', `import { createClient } from '@supabase/supabase-js';`),
      src('components/F.tsx', `import { cloud } from '../lib/cloud'; // the facade is the sanctioned door`),
      src('components/D.tsx', `// localStorage is mentioned here only in a comment\nexport const d = 1;`),
      src('lib/E.ts', `localStorage.getItem('k');`),
    ];
    expect(RATCHETS.uiTouchesStorage.find(files)).toEqual(['screens/A.tsx']);
    expect(RATCHETS.uiTalksToBackend.find(files).sort()).toEqual(['components/B.tsx', 'components/C.tsx']);
  });
});
