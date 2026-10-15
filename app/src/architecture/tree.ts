/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph, type Graph } from './graph.ts';

/** Every `.ts`/`.tsx` under `dir`, as posix paths relative to it. Declaration files and vendored code are not source. */
export function sourcePaths(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...sourcePaths(dir, rel));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(rel);
  }
  return out.sort();
}

export function readSources(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of sourcePaths(dir)) out[p] = readFileSync(join(dir, p), 'utf8');
  return out;
}

/** The real graph of `app/src`. */
export const loadGraph = (srcDir: string): Graph => buildGraph(readSources(srcDir));

/**
 * Files under `src` that something *outside* the browser bundle loads: the
 * build scripts, the gateway, the desktop client and the contract packages
 * name them by path. The import scanner cannot see those edges, so reachability
 * starts from here as well as from `main.tsx`.
 */
export function externalEntries(appDir: string, srcPaths: ReadonlySet<string>): string[] {
  const found = new Set<string>(['main.tsx', 'site/render.tsx', 'site/tools/client.tsx']);
  const roots = ['scripts', 'server', 'api', '../video', '../packages'].map((r) => join(appDir, r));
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    let names: import('node:fs').Dirent[];
    try { names = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const e of names) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...walk(p)); }
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  for (const root of roots) {
    for (const file of walk(root)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/src\/((?:lib|state|ai|community|data|insights|intelligence|components|screens|site|a11y|content|styles|kernel|domains|composition)\/[A-Za-z0-9_./-]+?)(?=['"`\s)]|$)/g)) {
        const base = m[1].replace(/\.(tsx?|js)$/, '');
        for (const c of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (srcPaths.has(c)) found.add(c);
      }
    }
  }
  return [...found].sort();
}
