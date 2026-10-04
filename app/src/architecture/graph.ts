/**
 * The import graph of `app/src`, built from source text alone.
 *
 * TypeScript 7 has no JavaScript API to ask for a file's imports, so this
 * reads them. The two ways that goes wrong are the reason for the structure:
 *
 * - **Text that only looks like an import** — a doc comment that says
 *   "import 'x'", a string that contains `//` or a whole import statement.
 *   `mask` removes comments and lifts strings out before anything is matched.
 * - **Code that hides an import** — a regex literal with a quote in it
 *   (`/'/g`) can fool a scanner into thinking a string never ended, and
 *   everything after it vanishes. The scanner recognises a regex literal by
 *   what precedes the slash.
 *
 * `architecture.test.ts` carries a fixture for each, because a scanner that
 * silently finds fewer edges makes every rule built on it pass.
 *
 * Pure: no file system. `tree.ts` reads the files and hands them in.
 */

export interface ImportRef {
  readonly spec: string;
  readonly kind: 'static' | 'dynamic';
  /** `import type` / `export type`: erased at build time, still a compile-time dependency. */
  readonly typeOnly: boolean;
}

/** Where an import landed. Exactly one of `to`, `pkg`, `external`, `outside`, `asset` is set. */
export interface Edge extends ImportRef {
  readonly from: string;
  /** Another file under `src`, as a posix path relative to it. */
  readonly to?: string;
  /** A workspace package: `@semester/contract`, `@semester/institution`. */
  readonly pkg?: string;
  /** A third-party module: `react`, `@supabase/supabase-js`. */
  readonly external?: string;
  /** A relative path that leaves `src` (the one that reaches into `packages/` by `../`). */
  readonly outside?: string;
  /** Resolved to nothing in the file set: a stylesheet, an image, a JSON file. */
  readonly asset?: string;
}

const PREV_ALLOWS_REGEX = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

export interface Masked {
  /** The source with comments removed and every string literal replaced by `'§<n>'`. */
  readonly code: string;
  /** What each `§<n>` stood for. */
  readonly literals: readonly string[];
}

/**
 * Remove comments and lift string literals out of the code.
 *
 * Not a tokenizer. It tracks the three things that decide whether a `//` or a
 * quote means what it appears to: string delimiters, comment openers, and
 * whether a `/` begins a regular expression.
 *
 * Strings are replaced rather than kept because a string can *contain* an
 * import — a fixture, a code sample in a register — and text inside a string
 * is not a dependency. The specifier of a real import is itself a string, so
 * it is looked up in `literals` after the statement has matched.
 */
export function mask(src: string): Masked {
  let out = '';
  const literals: string[] = [];
  let i = 0;
  let prev = ''; // last significant character emitted, for the regex-or-divide question
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let body = '';
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') {
          body += src[i];
          i++;
        }
        if (i < n) body += src[i];
        i++;
      }
      i++;
      out += `${c}§${literals.length}${c}`;
      literals.push(body);
      prev = c;
      continue;
    }
    if (c === '/' && PREV_ALLOWS_REGEX.has(prev)) {
      // A regular expression literal: skip to the closing slash, honouring
      // escapes and character classes, where an unescaped `/` does not end it.
      out += c;
      i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const r = src[i];
        out += r;
        i++;
        if (r === '\\') {
          if (i < n) out += src[i++];
        } else if (r === '[') inClass = true;
        else if (r === ']') inClass = false;
        else if (r === '/' && !inClass) break;
      }
      prev = '/';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { code: out, literals };
}

/** Source with comments gone and string contents lifted out: what a rule that reads *code* should read. */
export const codeOf = (src: string): string => mask(src).code;

const STATIC = /\b(?:import|export)\s+(type\s+)?(?:[\w*${}\s,]*?\sfrom\s+)?(['"])§(\d+)\2/g;
const DYNAMIC = /\bimport\(\s*(['"])§(\d+)\1\s*\)/g;

/** Every module a file imports, re-exports or loads on demand. */
export function importsIn(source: string): ImportRef[] {
  const { code, literals } = mask(source);
  const out: ImportRef[] = [];
  for (const m of code.matchAll(STATIC)) out.push({ spec: literals[Number(m[3])], kind: 'static', typeOnly: Boolean(m[1]) });
  for (const m of code.matchAll(DYNAMIC)) out.push({ spec: literals[Number(m[2])], kind: 'dynamic', typeOnly: false });
  return out;
}

export const isTestFile = (path: string): boolean => /\.(test|spec)\.tsx?$/.test(path) || /\.live\.test\./.test(path);

const normalize = (path: string): string => {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
    } else out.push(part);
  }
  return out.join('/');
};

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** Which package a bare specifier names: `@scope/name/deep` → `@scope/name`, `react-dom/client` → `react-dom`. */
const packageOf = (spec: string): string => {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const CANDIDATES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

export interface Graph {
  /** Every source file, prod and test, as posix paths relative to `src`. */
  readonly files: ReadonlySet<string>;
  /** Every import of every file, resolved. */
  readonly edges: readonly Edge[];
  /** `edges` grouped by importer. */
  readonly byFile: ReadonlyMap<string, readonly Edge[]>;
}

/** Build a graph from `{ path: source }`. Paths are relative to `src`, posix. */
export function buildGraph(sources: Readonly<Record<string, string>>): Graph {
  const files = new Set(Object.keys(sources));
  const edges: Edge[] = [];
  const byFile = new Map<string, Edge[]>();
  for (const [from, text] of Object.entries(sources)) {
    const own: Edge[] = [];
    for (const ref of importsIn(text)) {
      const { spec } = ref;
      let edge: Edge;
      if (spec.startsWith('.')) {
        const base = normalize(`${dirOf(from)}/${spec}`);
        if (base.startsWith('..')) edge = { ...ref, from, outside: base };
        else {
          const hit = CANDIDATES.map((c) => base + c).find((c) => files.has(c));
          edge = hit ? { ...ref, from, to: hit } : { ...ref, from, asset: base };
        }
      } else if (spec.startsWith('@semester/')) edge = { ...ref, from, pkg: packageOf(spec) };
      else edge = { ...ref, from, external: packageOf(spec) };
      own.push(edge);
      edges.push(edge);
    }
    byFile.set(from, own);
  }
  return { files, edges, byFile };
}

/** A graph without its test files: what ships, and so what the layering is about. */
export function productionOnly(graph: Graph): Graph {
  const files = new Set([...graph.files].filter((f) => !isTestFile(f)));
  const edges = graph.edges.filter((e) => files.has(e.from) && (e.to === undefined || files.has(e.to)));
  const byFile = new Map<string, Edge[]>();
  for (const f of files) byFile.set(f, []);
  for (const e of edges) byFile.get(e.from)!.push(e);
  return { files, edges, byFile };
}

/**
 * Strongly connected components with more than one member: the import cycles.
 * Tarjan, iterative — the app's import chains are deep enough to matter.
 */
export function cycles(graph: Graph): string[][] {
  const next = new Map<string, string[]>();
  for (const f of graph.files) next.set(f, []);
  for (const e of graph.edges) if (e.to) next.get(e.from)!.push(e.to);

  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const found: string[][] = [];

  for (const root of graph.files) {
    if (index.has(root)) continue;
    const work: Array<{ v: string; i: number }> = [{ v: root, i: 0 }];
    index.set(root, counter);
    low.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);
    while (work.length) {
      const frame = work[work.length - 1];
      const out = next.get(frame.v)!;
      if (frame.i < out.length) {
        const w = out[frame.i++];
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter);
          counter++;
          stack.push(w);
          onStack.add(w);
          work.push({ v: w, i: 0 });
        } else if (onStack.has(w)) low.set(frame.v, Math.min(low.get(frame.v)!, index.get(w)!));
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1].v;
          low.set(parent, Math.min(low.get(parent)!, low.get(frame.v)!));
        }
        if (low.get(frame.v) === index.get(frame.v)) {
          const component: string[] = [];
          let w: string;
          do {
            w = stack.pop()!;
            onStack.delete(w);
            component.push(w);
          } while (w !== frame.v);
          if (component.length > 1) found.push(component.sort());
        }
      }
    }
  }
  return found.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}
