/**
 * Who imports whom, read from source text — the half of the boundary checker
 * that has no opinions.
 *
 * `importboundaries.ts` holds the rules; this file only answers "what does this
 * file import, and where does that land". It is separate because it is the part
 * that can be wrong in a way no rule would notice: a rule that reads zero
 * imports passes every tree.
 *
 * ## Why this is a tokenizer and not the compiler
 *
 * TypeScript 7 exposes `version` and nothing else from its JS entry point — no
 * `createSourceFile`, no `preProcessFile` — so there is no AST to ask. Adding a
 * parser is a dependency, and `docs/SUPPLY-CHAIN.md` is the price list for
 * that. So this reads tokens: enough to tell code from comments, strings,
 * template literals and regex literals, which is all an import statement needs.
 *
 * It was checked, once, against a real parser (rolldown's, which ships inside
 * vite 8) on every `.ts`, `.tsx`, `.mjs` and `.js` file under `app/`,
 * `packages/` and `supabase/functions/`: 2,878 files, 12,710 specifiers, and
 * the two agreed on every one. That check is not in the suite — the parser is
 * not a dependency of this repository, only of one that is — so the cases
 * below carry the shapes that mattered, and `importgraph.test.ts` holds them.
 *
 * What it does not read: a template literal with a substitution
 * (`import(\`./${x}\`)`) has no specifier to report, and neither does any
 * parser. A dynamic import whose path is built at run time is the one way to
 * cross a boundary without being seen, and is why the checker counts them.
 */

export type Zone = 'packages' | 'package-tool' | 'functions' | 'app-src' | 'app-server' | 'app-api' | 'app-scripts' | 'app-other' | 'other';

/** Which part of the repository a path belongs to. Paths are repo-relative, forward-slashed. */
export function zoneOf(path: string): Zone {
  if (path.startsWith('packages/platform-control/')) return 'package-tool';
  if (path.startsWith('packages/')) return 'packages';
  if (path.startsWith('supabase/functions/')) return 'functions';
  if (path.startsWith('app/src/')) return 'app-src';
  if (path.startsWith('app/server/')) return 'app-server';
  if (path.startsWith('app/api/')) return 'app-api';
  if (path.startsWith('app/scripts/')) return 'app-scripts';
  if (path.startsWith('app/')) return 'app-other';
  return 'other';
}

export const isTestFile = (path: string): boolean => /\.test\.(tsx?|jsx?|mjs)$/.test(path);

type Token = { t: 'id' | 'str' | 're' | 'num' | 'p'; v: string };

/** After one of these a `/` begins a regular expression rather than dividing. */
const REGEX_AFTER = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

const isIdStart = (c: string) => /[A-Za-z_$]/.test(c) || c > '\x7f';
const isIdPart = (c: string) => /[A-Za-z0-9_$]/.test(c) || c > '\x7f';

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const n = src.length;
  let i = 0;
  /** `b` is an ordinary block; `t` is the `${` of a template literal, which `}` must hand back to it. */
  const braces: Array<'b' | 't'> = [];

  const valueEnded = () => {
    const p = out[out.length - 1];
    if (!p) return false;
    if (p.t === 'str' || p.t === 're' || p.t === 'num') return true;
    if (p.t === 'id') return !REGEX_AFTER.has(p.v);
    return p.v === ')' || p.v === ']' || p.v === '}';
  };

  /** Scan template text from `i` to its closing backtick, or to a `${` that opens code. */
  const template = () => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') i += 2;
      else if (c === '`') {
        i++;
        out.push({ t: 'str', v: '' });
        return;
      } else if (c === '$' && src[i + 1] === '{') {
        i += 2;
        braces.push('t');
        out.push({ t: 'p', v: '${' });
        return;
      } else i++;
    }
  };

  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
    } else if (c === '/' && !valueEnded()) {
      i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const d = src[i];
        if (d === '\\') i += 2;
        else if (d === '[') (inClass = true), i++;
        else if (d === ']') (inClass = false), i++;
        else if (d === '/' && !inClass) {
          i++;
          break;
        } else i++;
      }
      while (i < n && isIdPart(src[i])) i++;
      out.push({ t: 're', v: '' });
    } else if (c === "'" || c === '"') {
      // A string ends at its quote or at the line: JSX text is full of
      // apostrophes that open nothing, and must not swallow the file.
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') {
          value += src[j + 1] ?? '';
          j += 2;
        } else if (src[j] === c) {
          closed = true;
          break;
        } else value += src[j++];
      }
      if (closed) out.push({ t: 'str', v: value });
      i = closed ? j + 1 : j;
    } else if (c === '`') {
      i++;
      template();
    } else if (c === '{') {
      braces.push('b');
      out.push({ t: 'p', v: '{' });
      i++;
    } else if (c === '}') {
      i++;
      if (braces.pop() === 't') template();
      else out.push({ t: 'p', v: '}' });
    } else if (isIdStart(c)) {
      let j = i + 1;
      while (j < n && isIdPart(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
    } else if (c >= '0' && c <= '9') {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) });
      i = j;
    } else {
      out.push({ t: 'p', v: c });
      i++;
    }
  }
  return out;
}

/**
 * Every module specifier a file names, in no particular order and without
 * repeats: `import … from`, `export … from`, a bare `import 'x'`, `import('x')`,
 * `import x = require('x')` and `require('x')`. A specifier written inside a
 * comment, a string or a template is not one.
 */
export function importSpecifiers(source: string): string[] {
  const tokens = tokenize(source);
  const found = new Set<string>();
  const at = (k: number) => tokens[k];
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.t !== 'id' || at(k - 1)?.v === '.') continue; // `x.import(…)` is a method, not the keyword
    const next = at(k + 1);
    if (tok.v === 'import' && next?.t === 'str') found.add(next.v);
    else if (tok.v === 'import' && next?.v === '(' && at(k + 2)?.t === 'str') found.add(at(k + 2).v);
    else if (tok.v === 'from' && next?.t === 'str') found.add(next.v);
    else if (tok.v === 'require' && next?.v === '(' && at(k + 2)?.t === 'str') found.add(at(k + 2).v);
  }
  // A template with no text is a placeholder token, never a specifier.
  found.delete('');
  return [...found];
}

/**
 * `@semester/*` is aliased, in `tsconfig.app.json` and `vite.config.ts`, to the
 * packages' sources. This is a copy of that, and a copy can fall behind: it did,
 * when `packages/platform` arrived. `importboundaries.test.ts` checks it against
 * every package with a browser entry at `src/index.ts` and against both configs,
 * so a new browser package fails there, with the line to add, instead of having
 * its imports read as a third-party package. Node-only workspace tools have no
 * browser entry and are held out of all three alias maps.
 */
export const WORKSPACE_ALIASES: Readonly<Record<string, string>> = {
  '@semester/contract': 'packages/contract/src/index.ts',
  '@semester/institution': 'packages/institution/src/index.ts',
  '@semester/offline-sync': 'packages/offline-sync/src/index.ts',
  '@semester/platform': 'packages/platform/src/index.ts',
};

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'];
/** Files a bundler imports that are not code. */
const ASSET = /\.(css|json|svg|png|jpe?g|gif|webp|avif|woff2?|ttf|mp3|mp4|webm|vtt|txt|md|csv|wasm)(\?.*)?$/i;

export type Resolution =
  | { kind: 'file'; path: string }
  | { kind: 'builtin'; spec: string }
  | { kind: 'external'; spec: string }
  | { kind: 'asset'; spec: string }
  | { kind: 'unresolved'; spec: string };

const join = (dir: string, spec: string): string => {
  const parts = dir === '' ? [] : dir.split('/');
  for (const seg of spec.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
};

/** Where `spec`, written in `from`, lands. `files` is every code file in the repository. */
export function resolveImport(from: string, spec: string, files: ReadonlySet<string>): Resolution {
  if (spec.startsWith('node:')) return { kind: 'builtin', spec };
  if (WORKSPACE_ALIASES[spec]) return { kind: 'file', path: WORKSPACE_ALIASES[spec] };
  if (!spec.startsWith('.')) return { kind: 'external', spec };
  const target = join(from.slice(0, Math.max(0, from.lastIndexOf('/'))), spec);
  // NodeNext writes `./x.js` for a file that is `./x.ts`.
  const stem = target.replace(/\.(m?js)$/, '');
  const candidates = [target, ...CODE_EXTENSIONS.map((e) => target + e), ...CODE_EXTENSIONS.map((e) => stem + e), ...CODE_EXTENSIONS.map((e) => `${target}/index${e}`)];
  for (const c of candidates) if (files.has(c)) return { kind: 'file', path: c };
  return ASSET.test(spec) ? { kind: 'asset', spec } : { kind: 'unresolved', spec };
}

/** A repository's code: every file, and the specifiers each one names. */
export interface Tree {
  files: ReadonlySet<string>;
  imports: ReadonlyMap<string, readonly string[]>;
}

export function treeOf(sources: Readonly<Record<string, string>>): Tree {
  const imports = new Map<string, readonly string[]>();
  for (const [path, text] of Object.entries(sources)) imports.set(path, importSpecifiers(text));
  return { files: new Set(Object.keys(sources)), imports };
}

/** Every file reachable from `entry` by following imports, the entry included. */
export function reachableFrom(tree: Tree, entry: string): { files: Set<string>; via: Map<string, string> } {
  const files = new Set([entry]);
  const via = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const from = queue.shift() as string;
    for (const spec of tree.imports.get(from) ?? []) {
      const r = resolveImport(from, spec, tree.files);
      if (r.kind === 'file' && !files.has(r.path)) {
        files.add(r.path);
        via.set(r.path, from);
        queue.push(r.path);
      }
    }
  }
  return { files, via };
}
