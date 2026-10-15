import { buildGraph, codeOf, cycles, importsIn, isTestFile, mask, productionOnly, type Edge, type Graph } from './graph.ts';

/**
 * The rules that keep Semester from sliding back into a screen-centric
 * monolith, written as functions of a graph so each can be shown a fixture it
 * must refuse. `architecture.test.ts` runs them on the real tree and on those
 * fixtures; `docs/architecture/modularization/06-architecture-tests.md` says
 * what each one is for and what it deliberately leaves alone.
 *
 * Two kinds of rule, and the difference matters:
 *
 * - **Strict** rules apply to code that is new — `kernel/`, `domains/`,
 *   `composition/`. There is nothing to forgive, so there is no allowlist.
 * - **Ratchet** rules apply to the legacy tree, which already breaks them. They
 *   may not get worse, and the recorded exceptions may only be removed
 *   (`legacy.json`). A ratchet that could be raised would be a suggestion.
 */

export interface Violation {
  readonly rule: string;
  readonly file: string;
  readonly message: string;
}

/** Everything a rule may look at: the graph, and the text for the rules that read code. */
export interface Tree {
  readonly sources: Readonly<Record<string, string>>;
  readonly graph: Graph;
}

export const treeOf = (sources: Readonly<Record<string, string>>): Tree => ({ sources, graph: buildGraph(sources) });

// ── where a file sits ──────────────────────────────────────────────────────

/** The top-level area of a file under `src`: `lib`, `screens`, `domains`, …; `root` for `App.tsx` and friends. */
export const areaOf = (path: string): string => (path.includes('/') ? path.slice(0, path.indexOf('/')) : 'root');

export const SLICE_LAYERS = ['domain', 'application', 'adapters'] as const;
export type SliceLayer = (typeof SLICE_LAYERS)[number] | 'public';

export interface Placement {
  readonly slice: string;
  /** `public` for `index.ts` at the slice root. */
  readonly layer: SliceLayer;
  /** Path below the layer. */
  readonly rest: string;
}

/** `domains/tasks/domain/task.ts` → `{ slice: 'tasks', layer: 'domain', rest: 'task.ts' }`; null outside `domains/`. */
export function placement(path: string): Placement | null {
  const m = /^domains\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return null;
  const [layer, ...rest] = m[2].split('/');
  if ((SLICE_LAYERS as readonly string[]).includes(layer) && rest.length) return { slice: m[1], layer: layer as SliceLayer, rest: rest.join('/') };
  return { slice: m[1], layer: 'public', rest: m[2] };
}

/** The legacy areas: everything in `src` that predates the domain layout. */
export const LEGACY_AREAS = ['lib', 'state', 'ai', 'community', 'insights', 'intelligence', 'data', 'components', 'screens', 'site', 'a11y', 'styles', 'content'] as const;
const isLegacy = (path: string): boolean => (LEGACY_AREAS as readonly string[]).includes(areaOf(path));

/**
 * The order the legacy areas already mostly follow, lowest first. An import from
 * a lower number to a higher one points *up*: `lib` reaching into `screens`
 * would be the plain case. Equal ranks may import each other.
 *
 * Measured, not designed: `lib` and `data` import each other (the course
 * content is typed by `lib/types`), `ai` sits above `intelligence` and
 * `community`, and `components` above all of them.
 */
export const RANK: Readonly<Record<string, number>> = {
  kernel: 0,
  styles: 1,
  content: 1,
  a11y: 2,
  data: 2,
  lib: 2,
  state: 3,
  insights: 4,
  community: 4,
  intelligence: 5,
  ai: 6,
  components: 7,
  site: 8,
  screens: 8,
  root: 9,
};

// ── strict rules: new code ─────────────────────────────────────────────────

/** Things a pure layer must not reach for. Each one is a test that has to fake a global. */
export const AMBIENT: readonly (readonly [RegExp, string])[] = [
  [/\b(?:localStorage|sessionStorage|indexedDB)\b/, 'browser storage'],
  [/\b(?:window|document|navigator|globalThis)\./, 'a browser global'],
  [/\bfetch\s*\(/, 'network access'],
  [/\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)/, 'the wall clock (take a Clock)'],
  [/\bMath\.random\s*\(/, 'randomness (take an IdSource)'],
  [/import\.meta\.env|\bprocess\.env/, 'environment configuration (inject it at the composition root)'],
];

const code = codeOf;

function ambientIn(path: string, tree: Tree, rule: string): Violation[] {
  const text = code(tree.sources[path] ?? '');
  return AMBIENT.filter(([re]) => re.test(text)).map(([, what]) => ({ rule, file: path, message: `reaches for ${what}` }));
}

const targetOf = (e: Edge): string => e.to ?? e.pkg ?? e.external ?? e.outside ?? e.asset ?? '?';

/** `domains/x/index.ts` — the one door into a slice from outside it. */
const isPublicEntry = (to: string, slice: string): boolean => to === `domains/${slice}/index.ts`;

export function kernelIsALeaf({ graph }: Tree): Violation[] {
  const out: Violation[] = [];
  for (const f of graph.files) {
    if (areaOf(f) !== 'kernel' || isTestFile(f)) continue;
    for (const e of graph.byFile.get(f) ?? []) {
      if (e.to && areaOf(e.to) === 'kernel') continue;
      if (e.asset) continue;
      out.push({ rule: 'kernel-is-a-leaf', file: f, message: `imports ${targetOf(e)}; the kernel depends on nothing in this app` });
    }
  }
  return out;
}

/**
 * `domain/` is the pure core: its own `domain/` files, the kernel, the
 * contract packages. No React, no legacy, no other slice, no ambient state.
 */
export function coreIsPure(tree: Tree): Violation[] {
  const out: Violation[] = [];
  for (const f of tree.graph.files) {
    const p = placement(f);
    if (!p || p.layer !== 'domain' || isTestFile(f)) continue;
    for (const e of tree.graph.byFile.get(f) ?? []) {
      if (e.pkg || e.asset) continue;
      if (e.to) {
        const q = placement(e.to);
        if (areaOf(e.to) === 'kernel' || (q && q.slice === p.slice && q.layer === 'domain')) continue;
      }
      out.push({ rule: 'core-is-pure', file: f, message: `domain/ imports ${targetOf(e)}; it may import only its own domain/, the kernel and @semester packages` });
    }
    out.push(...ambientIn(f, tree, 'core-is-pure'));
  }
  return out;
}

/**
 * `application/` orchestrates the core through ports. It may import its own
 * `domain/` and `application/`, the kernel, the contract packages, and other
 * slices' **public entry** — never their insides, and never legacy.
 */
export function applicationDependsInward(tree: Tree): Violation[] {
  const out: Violation[] = [];
  for (const f of tree.graph.files) {
    const p = placement(f);
    if (!p || p.layer !== 'application' || isTestFile(f)) continue;
    for (const e of tree.graph.byFile.get(f) ?? []) {
      if (e.pkg || e.asset) continue;
      if (e.to) {
        const q = placement(e.to);
        if (areaOf(e.to) === 'kernel') continue;
        if (q && q.slice === p.slice && (q.layer === 'domain' || q.layer === 'application')) continue;
        if (q && q.slice !== p.slice && isPublicEntry(e.to, q.slice)) continue;
      }
      out.push({ rule: 'application-depends-inward', file: f, message: `application/ imports ${targetOf(e)}; ports belong in application/, implementations in adapters/` });
    }
    out.push(...ambientIn(f, tree, 'application-depends-inward'));
  }
  return out;
}

/**
 * `adapters/` is the only place a slice may touch the legacy tree — the
 * anti-corruption layer. It may import its own slice, the kernel, the
 * packages, other slices' public entries, and legacy *logic* (`lib`, `state`,
 * …) but never a screen, the shell, or a component: an adapter that renders is
 * a screen in disguise.
 */
export function adaptersAreTheOnlyDoor(tree: Tree): Violation[] {
  const out: Violation[] = [];
  const forbiddenLegacy = new Set(['screens', 'components', 'site', 'root']);
  for (const f of tree.graph.files) {
    const p = placement(f);
    if (!p || p.layer !== 'adapters' || isTestFile(f)) continue;
    for (const e of tree.graph.byFile.get(f) ?? []) {
      if (e.pkg || e.asset) continue;
      if (e.external) {
        out.push({ rule: 'adapters-are-the-only-door', file: f, message: `imports the third-party module ${e.external}; reach it through a legacy seam` });
        continue;
      }
      if (e.outside) {
        out.push({ rule: 'adapters-are-the-only-door', file: f, message: `imports ${e.outside}, outside src; use the @semester alias` });
        continue;
      }
      if (!e.to) continue;
      const q = placement(e.to);
      if (areaOf(e.to) === 'kernel') continue;
      if (q) {
        if (q.slice === p.slice) continue;
        if (isPublicEntry(e.to, q.slice)) continue;
        out.push({ rule: 'adapters-are-the-only-door', file: f, message: `imports ${e.to}, inside another slice; use domains/${q.slice}/index.ts` });
        continue;
      }
      if (forbiddenLegacy.has(areaOf(e.to))) out.push({ rule: 'adapters-are-the-only-door', file: f, message: `imports ${e.to}; an adapter translates data, it does not render` });
      else if (!isLegacy(e.to)) out.push({ rule: 'adapters-are-the-only-door', file: f, message: `imports ${e.to}, which is neither legacy logic nor a slice` });
    }
    out.push(...ambientIn(f, tree, 'adapters-are-the-only-door'));
  }
  return out;
}

/** Nothing outside `domains/<x>/` may import its insides: `index.ts`, or `adapters/index.ts` from `composition/` only. */
export function sliceDoorsStayShut(tree: Tree): Violation[] {
  const out: Violation[] = [];
  for (const f of tree.graph.files) {
    if (isTestFile(f)) continue;
    const here = placement(f);
    for (const e of tree.graph.byFile.get(f) ?? []) {
      if (!e.to) continue;
      const q = placement(e.to);
      if (!q || (here && here.slice === q.slice)) continue;
      if (isPublicEntry(e.to, q.slice)) continue;
      if (e.to === `domains/${q.slice}/adapters/index.ts` && areaOf(f) === 'composition') continue;
      out.push({ rule: 'slice-doors-stay-shut', file: f, message: `imports ${e.to}; only domains/${q.slice}/index.ts is public` });
    }
  }
  return out;
}

/** The slices, depending on one another through public entries, must form a DAG. */
export function slicesAreAcyclic({ graph }: Tree): Violation[] {
  const next = new Map<string, Set<string>>();
  for (const f of graph.files) {
    const p = placement(f);
    if (!p || isTestFile(f)) continue;
    next.set(p.slice, next.get(p.slice) ?? new Set());
    for (const e of graph.byFile.get(f) ?? []) {
      const q = e.to ? placement(e.to) : null;
      if (q && q.slice !== p.slice) next.get(p.slice)!.add(q.slice);
    }
  }
  const out: Violation[] = [];
  const state = new Map<string, 1 | 2>();
  const walk = (s: string, trail: string[]): void => {
    state.set(s, 1);
    for (const t of next.get(s) ?? []) {
      if (state.get(t) === 1) out.push({ rule: 'slices-are-acyclic', file: `domains/${s}`, message: `cycle: ${[...trail, s, t].join(' → ')}` });
      else if (!state.has(t)) walk(t, [...trail, s]);
    }
    state.set(s, 2);
  };
  for (const s of [...next.keys()].sort()) if (!state.has(s)) walk(s, []);
  return out;
}

/** The legacy tree reaches a slice only through its public entry — never `composition/`, which is the shell's. */
export function legacyDoesNotReachIntoComposition({ graph }: Tree): Violation[] {
  const out: Violation[] = [];
  for (const f of graph.files) {
    if (isTestFile(f) || areaOf(f) === 'composition' || areaOf(f) === 'root') continue;
    for (const e of graph.byFile.get(f) ?? []) {
      if (e.to && areaOf(e.to) === 'composition' && !['screens', 'components'].includes(areaOf(f))) {
        out.push({ rule: 'legacy-does-not-reach-into-composition', file: f, message: `imports ${e.to}; only the shell and screens compose` });
      }
    }
  }
  return out;
}

/** A slice is a front door, an inside, and tests. A 700-line file in a slice is `Sheet.tsx` again. */
export const SLICE_FILE_BUDGET = 350;

export function sliceShape(tree: Tree): Violation[] {
  const out: Violation[] = [];
  const slices = new Set<string>();
  for (const f of tree.graph.files) {
    const p = placement(f);
    if (p) slices.add(p.slice);
  }
  for (const s of [...slices].sort()) {
    const mine = [...tree.graph.files].filter((f) => placement(f)?.slice === s);
    if (!mine.includes(`domains/${s}/index.ts`)) out.push({ rule: 'slice-shape', file: `domains/${s}`, message: 'has no index.ts: a slice with no public entry has no public contract' });
    if (!mine.some((f) => isTestFile(f))) out.push({ rule: 'slice-shape', file: `domains/${s}`, message: 'has no tests beside its code' });
    for (const f of mine) {
      const p = placement(f)!;
      if (p.layer === 'public' && !isTestFile(f) && f !== `domains/${s}/index.ts`) out.push({ rule: 'slice-shape', file: f, message: 'belongs in domain/, application/ or adapters/' });
      const lines = (tree.sources[f] ?? '').split('\n').length;
      if (!isTestFile(f) && lines > SLICE_FILE_BUDGET) out.push({ rule: 'slice-shape', file: f, message: `is ${lines} lines; a slice file stays under ${SLICE_FILE_BUDGET}` });
    }
  }
  return out;
}

/** Each slice names its errors `<slice>.<reason>`, so a code says whose refusal it is. */
export function errorCodesNameTheirSlice(tree: Tree): Violation[] {
  const out: Violation[] = [];
  for (const f of tree.graph.files) {
    const p = placement(f);
    if (!p || isTestFile(f)) continue;
    const { code: body, literals } = mask(tree.sources[f] ?? '');
    for (const m of body.matchAll(/\bfail\(\s*(['"])§\d+\1\s*,\s*(['"])§(\d+)\2/g)) {
      const named = literals[Number(m[3])];
      if (!named.startsWith(`${p.slice}.`)) out.push({ rule: 'error-codes-name-their-slice', file: f, message: `error code "${named}" should start "${p.slice}."` });
    }
  }
  return out;
}

// ── ratchet rules: legacy ──────────────────────────────────────────────────

/** An import that points up the legacy order, as the exact pair, so a baseline can name it. */
export const upwardKey = (e: Edge): string => `${e.from} -> ${e.to}`;

export function upwardEdges(graph: Graph): string[] {
  const prod = productionOnly(graph);
  const out: string[] = [];
  for (const e of prod.edges) {
    if (!e.to) continue;
    const a = areaOf(e.from);
    const b = areaOf(e.to);
    if (a === b || !(a in RANK) || !(b in RANK)) continue;
    if (RANK[b] > RANK[a]) out.push(upwardKey(e));
  }
  return [...new Set(out)].sort();
}

export interface CycleCensus {
  readonly count: number;
  readonly largest: number;
}

export function cycleCensus(graph: Graph): CycleCensus {
  const found = cycles(productionOnly(graph));
  return { count: found.length, largest: found[0]?.length ?? 0 };
}

export interface Ratchet {
  readonly upwardImports: readonly string[];
  readonly cycles: CycleCensus;
  /** Screens whose imports are locked to the domain layer. Grows as screens migrate; never shrinks. */
  readonly lockedScreens: readonly string[];
}

/**
 * A new upward import fails; so does a recorded one that has gone, because the
 * list has to shrink as the debt is paid or it stops describing the debt.
 */
export function ratchetUpward(graph: Graph, baseline: readonly string[]): Violation[] {
  const now = new Set(upwardEdges(graph));
  const was = new Set(baseline);
  return [
    ...[...now].filter((k) => !was.has(k)).map((k) => ({ rule: 'legacy-imports-do-not-point-up', file: k.split(' -> ')[0], message: `new upward import ${k}; move what is needed down, or invert it through a port` })),
    ...[...was].filter((k) => !now.has(k)).map((k) => ({ rule: 'legacy-imports-do-not-point-up', file: k.split(' -> ')[0], message: `${k} is gone: delete it from legacy.json so the ratchet tightens` })),
  ];
}

export function ratchetCycles(graph: Graph, baseline: CycleCensus): Violation[] {
  const now = cycleCensus(graph);
  const out: Violation[] = [];
  if (now.count > baseline.count) out.push({ rule: 'legacy-cycles-do-not-grow', file: 'src', message: `${now.count} import cycles, up from ${baseline.count}` });
  if (now.largest > baseline.largest) out.push({ rule: 'legacy-cycles-do-not-grow', file: 'src', message: `the largest cycle is ${now.largest} files, up from ${baseline.largest}` });
  if (now.count < baseline.count || now.largest < baseline.largest) out.push({ rule: 'legacy-cycles-do-not-grow', file: 'src', message: `cycles fell to ${now.count} (largest ${now.largest}): lower legacy.json to match` });
  return out;
}

/**
 * A migrated screen talks to the domain layer and to presentation, not to
 * `lib` or `state`. Locking one is the last step of its migration and the
 * thing that stops the next change from quietly re-importing the legacy store.
 */
export function lockedScreensStayLocked(tree: Tree, locked: readonly string[]): Violation[] {
  const out: Violation[] = [];
  for (const f of locked) {
    if (!tree.graph.files.has(f)) {
      out.push({ rule: 'locked-screens-stay-locked', file: f, message: 'is listed as locked but does not exist' });
      continue;
    }
    for (const e of tree.graph.byFile.get(f) ?? []) {
      if (!e.to) continue;
      const a = areaOf(e.to);
      if (a === 'lib' || a === 'state' || a === 'data' || a === 'community' || a === 'insights' || a === 'intelligence' || a === 'ai') {
        out.push({ rule: 'locked-screens-stay-locked', file: f, message: `imports ${e.to}; a migrated screen reads the domain layer through composition/` });
      }
    }
  }
  return out;
}

/** The contract packages are imported by the app, the server and the desktop client. They must not import any of them. */
export function packagesDoNotImportTheApp(packageSources: Readonly<Record<string, string>>): Violation[] {
  const out: Violation[] = [];
  for (const [f, text] of Object.entries(packageSources)) {
    if (isTestFile(f)) continue;
    for (const { spec } of importsIn(text)) {
      if (/(^|\/)app\//.test(spec) || /\.\.\/\.\.\/(app|supabase)\b/.test(spec)) out.push({ rule: 'packages-do-not-import-the-app', file: f, message: `imports ${spec}` });
    }
  }
  return out;
}

/** Every strict rule, for the test and the census to run the same list. */
export const STRICT_RULES: readonly (readonly [string, (t: Tree) => Violation[]])[] = [
  ['kernel-is-a-leaf', kernelIsALeaf],
  ['core-is-pure', coreIsPure],
  ['application-depends-inward', applicationDependsInward],
  ['adapters-are-the-only-door', adaptersAreTheOnlyDoor],
  ['slice-doors-stay-shut', sliceDoorsStayShut],
  ['slices-are-acyclic', slicesAreAcyclic],
  ['legacy-does-not-reach-into-composition', legacyDoesNotReachIntoComposition],
  ['slice-shape', sliceShape],
  ['error-codes-name-their-slice', errorCodesNameTheirSlice],
];
