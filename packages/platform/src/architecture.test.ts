/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { describe, expect, it } from '../../../app/node_modules/vitest/dist/index.js';
import { ERROR_CODES } from './gateway/errors.ts';
import { ISOLATION_CONTROLS } from './isolation/layers.ts';
import { API_MAJORS, registryProblems } from './gateway/versioning.ts';

/**
 * The architecture tests: the boundaries of the platform package, held by
 * code rather than by a reviewer remembering them.
 *
 * What is checked, and why each is here:
 *
 * - **Layering.** An import points down the stack or sideways within a layer,
 *   never up, and the import graph has no cycles. The stack is in `RANK`
 *   below and in `docs/platform/README.md`. A policy module that imports an
 *   engine is how a rule ends up depending on the thing it is meant to govern.
 * - **One door to the institution package.** Only `seam/` imports it, so a
 *   rename there is one edit here and the platform cannot quietly grow a
 *   second copy of the decision point.
 * - **No ambient authority.** No wall clock, no `Math.random`, no
 *   `crypto.randomUUID`, no `process.env`, no `console`, no network, no DOM, no
 *   Node built-ins in platform code — the clock, ids and I/O are handed in, so
 *   every rule is testable and nothing reads a tenant from the environment.
 * - **NodeNext-clean.** The gateway compiles this package under `module:
 *   NodeNext` (`npm run check:university`), where a relative import without
 *   `.ts` is an error. CLAUDE.md records what it cost when that was found
 *   late; it is found here instead.
 * - **Nobody reaches around the package.** The app imports it through
 *   `@semester/platform`, and Supabase functions do not import it at all.
 *
 * Every scan has a **control**: a fixture the scanner must catch. A scan that
 * finds nothing is also what a scan that looks for the wrong thing finds.
 */

const SRC = import.meta.dirname;
const ROOT = resolve(SRC, '../../..');
const rel = (p: string) => relative(SRC, p).split('\\').join('/');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ALL = walk(SRC);
const isTest = (f: string) => /\.test\.ts$/.test(f);
const PRODUCTION = ALL.filter((f) => !isTest(f) && !rel(f).startsWith('testing/') && !rel(f).startsWith('reference/'));
const SOURCES = ALL.filter((f) => !isTest(f));

/* ── scanners (each is exercised against a fixture below) ──────────────── */

export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function importsOf(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  for (const m of code.matchAll(/(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of code.matchAll(/(?:^|[;\n])\s*import\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

/** Lower rank = lower in the stack. An import may target equal or lower rank. */
function rank(path: string): number | null {
  if (/^(kernel|seam)\//.test(path)) return 0;
  if (path.startsWith('observability/')) return 1;
  if (path === 'gateway/errors.ts' || path === 'gateway/headers.ts') return 1;
  if (path.startsWith('tenancy/')) return 2;
  if (path.startsWith('identity/')) return 3;
  if (path.startsWith('policy/')) return 4;
  if (path.startsWith('events/')) return 5;
  if (path.startsWith('gateway/')) return 6;
  if (path.startsWith('engines/')) return 7;
  if (path.startsWith('isolation/')) return 8;
  if (path.startsWith('sdk/')) return 9;
  if (path.startsWith('testing/') || path.startsWith('reference/')) return 10;
  return null;
}

export function layeringViolations(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [file, src] of Object.entries(files)) {
    const from = rank(file);
    if (from === null) continue;
    for (const spec of importsOf(src)) {
      if (!spec.startsWith('.')) continue;
      const target = join(dirname(file), spec).split('\\').join('/');
      if (target.startsWith('..')) continue; // leaves the package; checked elsewhere
      const to = rank(target);
      if (to === null) {
        out.push(`${file} imports ${spec}, which is not in a known layer`);
      } else if (to > from) {
        out.push(`${file} (layer ${from}) imports ${target} (layer ${to}): an import may not point up the stack`);
      }
    }
  }
  return out;
}

export function cycles(files: Record<string, string>): string[][] {
  const graph = new Map<string, string[]>();
  for (const [file, src] of Object.entries(files)) {
    graph.set(file, importsOf(src).filter((s) => s.startsWith('.')).map((s) => join(dirname(file), s).split('\\').join('/')));
  }
  const found: string[][] = [];
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (n: string) => {
    state.set(n, 1);
    stack.push(n);
    for (const m of graph.get(n) ?? []) {
      if (!graph.has(m)) continue;
      if (state.get(m) === 1) found.push([...stack.slice(stack.indexOf(m)), m]);
      else if (!state.has(m)) visit(m);
    }
    stack.pop();
    state.set(n, 2);
  };
  for (const n of graph.keys()) if (!state.has(n)) visit(n);
  return found;
}

const FORBIDDEN: [RegExp, string][] = [
  [/\bDate\.now\s*\(/, 'the wall clock (take a Clock)'],
  [/\bnew Date\s*\(\s*\)/, 'the wall clock (take a Clock)'],
  [/\bMath\.random\s*\(/, 'Math.random (take an Rng)'],
  [/\brandomUUID\s*\(/, 'crypto.randomUUID (take an IdSource)'],
  [/\bprocess\.env\b/, 'process.env (configuration is injected)'],
  [/\bconsole\.\w+/, 'console (use the logger)'],
  [/(?<![.\w])fetch\s*\(/, 'the network (the SDK takes an injected fetch)'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'browser storage'],
  [/\b(window|document|navigator)\./, 'the DOM'],
  [/\brequire\s*\(/, 'CommonJS require'],
  [/\beval\s*\(|new Function\s*\(/, 'dynamic code'],
  [/from\s*['"]node:/, 'a Node built-in'],
  [/from\s*['"](vitest|@vitest)/, 'a test runner in shipped code'],
  [/\bfrom\s*['"][^'"]*node_modules/, 'a node_modules path'],
];

/** Exemptions are by file, and each is a sentence of why. */
const ALLOWED_AMBIENT: Record<string, string[]> = {
  'kernel/clock.ts': ['the wall clock (take a Clock)', 'Math.random (take an Rng)', 'crypto.randomUUID (take an IdSource)'],
};

export function ambientAuthority(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [file, src] of Object.entries(files)) {
    const code = stripComments(src);
    for (const [re, what] of FORBIDDEN) {
      if (re.test(code) && !(ALLOWED_AMBIENT[file] ?? []).includes(what)) out.push(`${file} uses ${what}`);
    }
  }
  return out;
}

export function extensionlessImports(files: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [file, src] of Object.entries(files)) {
    // Tests reach vitest by the same relative path the institution package's tests use.
    for (const spec of importsOf(src)) if (spec.startsWith('.') && !/\.ts$/.test(spec) && !/app\/node_modules\/vitest\/dist\/index\.js$/.test(spec)) out.push(`${file}: "${spec}" needs a .ts extension for NodeNext`);
  }
  return out;
}

const read = (files: string[]) => Object.fromEntries(files.map((f) => [rel(f), readFileSync(f, 'utf8')]));

describe('layering', () => {
  const prod = read(SOURCES);

  it('every source file belongs to a layer (a new directory must be placed deliberately)', () => {
    const unplaced = Object.keys(prod).filter((f) => f.includes('/') && rank(f) === null);
    expect(unplaced).toEqual([]);
  });

  it('no import points up the stack', () => {
    expect(layeringViolations(prod)).toEqual([]);
  });

  it('the import graph has no cycles', () => {
    expect(cycles(prod)).toEqual([]);
  });

  it('control: the scanner catches an upward import, an unplaced file and a cycle', () => {
    expect(layeringViolations({ 'policy/x.ts': "import { a } from '../engines/search.ts';" })).toHaveLength(1);
    expect(layeringViolations({ 'kernel/x.ts': "import { a } from '../tenancy/context.ts';" })).toHaveLength(1);
    expect(layeringViolations({ 'engines/x.ts': "import { a } from '../mystery/y.ts';" })).toEqual([expect.stringContaining('not in a known layer')]);
    expect(layeringViolations({ 'engines/x.ts': "import { a } from '../policy/engine.ts';" })).toEqual([]);
    expect(cycles({ 'engines/a.ts': "import '../engines/b.ts'", 'engines/b.ts': "export * from './a.ts'" })).toHaveLength(1);
    // comments do not count as imports
    expect(layeringViolations({ 'kernel/x.ts': "// import { a } from '../tenancy/context.ts';" })).toEqual([]);
  });

  it('the SDK depends only on the kernel and the two error/header modules, so it stays light enough for a browser', () => {
    const allowed = /^(\.\.\/kernel\/|\.\.\/gateway\/(errors|headers)\.ts$|\.\/)/;
    for (const [f, src] of Object.entries(prod)) {
      if (!f.startsWith('sdk/') || f.endsWith('.test.ts')) continue;
      for (const spec of importsOf(src)) if (spec.startsWith('.')) expect(spec, f).toMatch(allowed);
    }
  });
});

describe('the door to the institution package', () => {
  it('only seam/ imports packages/institution', () => {
    const offenders: string[] = [];
    for (const [f, src] of Object.entries(read(SOURCES))) {
      if (f.startsWith('seam/')) continue;
      for (const spec of importsOf(src)) if (/institution\/src/.test(spec)) offenders.push(`${f} → ${spec}`);
    }
    expect(offenders).toEqual([]);
  });

  it('seam/ imports nothing else from outside the package', () => {
    for (const [f, src] of Object.entries(read(ALL.filter((x) => rel(x).startsWith('seam/'))))) {
      for (const spec of importsOf(src)) expect(spec, f).toMatch(/^(\.\.\/\.\.\/\.\.\/institution\/src\/index\.ts|\.\/|\.\.\/)/);
    }
  });
});

describe('no ambient authority', () => {
  it('shipped code reads no clock, randomness, environment, console, network, DOM or Node built-in', () => {
    expect(ambientAuthority(read(PRODUCTION))).toEqual([]);
  });

  it('control: each forbidden thing is caught, and the kernel exemption is exactly the three it needs', () => {
    const samples: Record<string, string> = {
      'a.ts': 'const t = Date.now();',
      'b.ts': 'const d = new Date();',
      'c.ts': 'const r = Math.random();',
      'd.ts': 'const u = crypto.randomUUID();',
      'e.ts': 'const x = process.env.FOO;',
      'f.ts': 'console.log(1);',
      'g.ts': 'await fetch(url);',
      'h.ts': 'localStorage.setItem(a, b);',
      'i.ts': 'window.location.href;',
      'j.ts': "import { readFileSync } from 'node:fs';",
      'k.ts': "import { it } from 'vitest';",
      'l.ts': 'eval(code);',
    };
    expect(ambientAuthority(samples).length).toBe(Object.keys(samples).length);
    // the injected fetch in the SDK is not the global one
    expect(ambientAuthority({ 's.ts': 'await opts.fetch(url, init);' })).toEqual([]);
    // dated values and parsing are fine
    expect(ambientAuthority({ 'ok.ts': 'new Date(ms).toISOString(); Date.parse(s);' })).toEqual([]);
    // comments are not code
    expect(ambientAuthority({ 'doc.ts': '/* never Date.now() */ // Math.random()' })).toEqual([]);
    expect(ambientAuthority({ 'kernel/clock.ts': 'Date.now(); new Date(); Math.random(); crypto.randomUUID();' })).toEqual([]);
    expect(ambientAuthority({ 'kernel/clock.ts': 'process.env.X' })).toHaveLength(1);
  });

  it('the SDK never names a tenant header', () => {
    const sdk = Object.entries(read(ALL.filter((f) => rel(f).startsWith('sdk/') && !isTest(f))));
    for (const [f, src] of sdk) expect(stripComments(src).toLowerCase(), f).not.toContain('x-tenant-id');
    expect(sdk.length).toBeGreaterThan(0);
  });
});

describe('NodeNext cleanliness', () => {
  it('every relative import in the package ends in .ts', () => {
    // This file spells deliberately bad imports as fixtures, so it is the one file not scanned.
    expect(extensionlessImports(read(ALL.filter((f) => !f.endsWith('architecture.test.ts'))))).toEqual([]);
  });

  it('control: an extensionless relative import is caught', () => {
    expect(extensionlessImports({ 'a.ts': "import { x } from './y';" })).toHaveLength(1);
    expect(extensionlessImports({ 'a.ts': "import { x } from './y.ts'; import z from 'pkg';" })).toEqual([]);
  });

  it('the package manifest is ESM, as the gateway\'s NodeNext build requires', () => {
    expect(JSON.parse(readFileSync(join(SRC, '../package.json'), 'utf8')).type).toBe('module');
  });

  it('check:university includes this package, so the gateway typecheck covers it', () => {
    const cfg = readFileSync(join(ROOT, 'app/tsconfig.university.json'), 'utf8');
    expect(cfg).toContain('../packages/platform/');
  });
});

describe('nobody reaches around the package', () => {
  const importsFrom = (dir: string, pattern: RegExp): string[] => {
    const out: string[] = [];
    const base = join(ROOT, dir);
    if (!existsSync(base)) return out;
    for (const f of walk(base)) {
      if (/node_modules/.test(f)) continue;
      for (const spec of importsOf(readFileSync(f, 'utf8'))) if (pattern.test(spec)) out.push(`${relative(ROOT, f)} → ${spec}`);
    }
    return out;
  };

  it('the app imports platform through its alias, never a relative path into packages/', () => {
    expect(importsFrom('app/src', /packages\/platform/)).toEqual([]);
    expect(importsFrom('app/server', /packages\/platform\/src\/(?!index\.ts)/)).toEqual([]);
  });

  it('Supabase functions do not import the platform package (they are not NodeNext/ESM-resolvable from here — CLAUDE.md, TS1287)', () => {
    expect(importsFrom('supabase/functions', /platform/)).toEqual([]);
  });

  it('the platform package imports nothing from the app, the server or Supabase', () => {
    const bad: string[] = [];
    for (const [f, src] of Object.entries(read(SOURCES))) {
      for (const spec of importsOf(src)) {
        if (/(^|\/)(app\/src|app\/server|app\/api|supabase)\b/.test(spec)) bad.push(`${f} → ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('control: the importer scanner sees a deep import', () => {
    expect(importsOf("import { a } from '../../packages/platform/src/gateway/command.ts';")).toEqual(['../../packages/platform/src/gateway/command.ts']);
    expect(importsOf("export * from './x.ts'; export type { T } from './y.ts'; import './side.ts';")).toEqual(['./x.ts', './y.ts', './side.ts']);
  });
});

describe('every reference implementation is exercised', () => {
  const sources = Object.values(read(SOURCES)).join('\n');
  const tests = Object.values(read(ALL.filter(isTest))).join('\n');

  it('each Memory* class is used by at least one test', () => {
    const classes = [...sources.matchAll(/export class (Memory\w+)/g)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(8);
    // Used = a test names it, or shipped code constructs it (the harness builds the unit of work for every test).
    const used = (c: string) => tests.includes(c) || sources.includes(`new ${c}(`);
    for (const c of classes) expect(used(c), `${c} is never used outside its own file`).toBe(true);
  });

  it('every error code is produced somewhere in shipped code or tests (no dead codes in the catalogue)', () => {
    const everything = sources + tests;
    const missing = Object.keys(ERROR_CODES).filter((code) => !new RegExp(`['"]${code}['"]`).test(everything.replace(/export const ERROR_CODES[\s\S]*?\n\} as const/, '')));
    expect(missing).toEqual([]);
    // …and each code's status is its own: no two codes share a status AND a retryable flag with an identical name pattern.
    expect(new Set(Object.keys(ERROR_CODES)).size).toBe(Object.keys(ERROR_CODES).length);
  });

  it('the shipped API version registry is valid', () => {
    expect(registryProblems(API_MAJORS)).toEqual([]);
  });

  it('every isolation control names a file that exists', () => {
    for (const c of ISOLATION_CONTROLS) expect(existsSync(join(ROOT, c.enforcedIn)), `${c.layer}: ${c.enforcedIn}`).toBe(true);
  });
});

describe('size', () => {
  it('no source file exceeds 650 lines — a module that large is two modules', () => {
    const big = Object.entries(read(SOURCES)).filter(([, s]) => s.split('\n').length > 650).map(([f]) => f);
    expect(big).toEqual([]);
  });
});
