import { describe, expect, it } from 'vitest';
import { importSpecifiers, reachableFrom, resolveImport, treeOf, zoneOf } from './importgraph';

/**
 * What the import reader reads, and — as much — what it does not.
 *
 * A boundary rule that finds no imports passes every tree, so the way this goes
 * wrong is silent: not a false alarm but a false all-clear. Each case below is
 * therefore a shape that appears in this repository, and half of them are things
 * that look like an import and are not. The reader was compared, once, against a
 * real parser over 2,879 files and 12,754 specifiers with no disagreement (the
 * header of `importgraph.ts` says how); these are the cases that comparison
 * turned up or that the first draft of the tokenizer got wrong.
 */

const of = (source: string) => importSpecifiers(source).sort();

describe('what counts as an import', () => {
  it('reads every form this repository writes', () => {
    const source = `
      import a from './default';
      import { b, type C } from './named';
      import * as d from './namespace';
      import type { E } from './type-only';
      import './side-effect';
      export * from './export-star';
      export * as f from './export-namespace';
      export { g } from './re-export';
      const h = await import('./dynamic');
      const i = require('./common');
      import j = require('./equals');
      type K = typeof import('./import-type');
      type L = import('./import-type-qualified').M;
    `;
    expect(of(source)).toEqual(
      ['./common', './default', './dynamic', './equals', './export-namespace', './export-star', './import-type', './import-type-qualified', './named', './namespace', './re-export', './side-effect', './type-only'].sort(),
    );
  });

  it('reads an import inside a template substitution, which is code', () => {
    expect(of('const x = `a ${await import("./inside")} b`;')).toEqual(['./inside']);
  });

  it('keeps reading after a string, a template and a regular expression that hold quotes', () => {
    const source = `
      const quoted = "it's";
      const text = \`don't \${1 + 1} 'quote'\`;
      const pattern = /['"\`]/g;
      const divided = 4 / 2 / 1;
      import after from './after-all-of-it';
    `;
    expect(of(source)).toEqual(['./after-all-of-it']);
  });

  it('is not thrown by an apostrophe in JSX text, which opens no string', () => {
    const source = `
      const view = <p>Don't read this as a string, and it isn't one</p>;
      import later from './after-jsx-text';
    `;
    expect(of(source)).toEqual(['./after-jsx-text']);
  });
});

describe('what only looks like one', () => {
  it('ignores a specifier in a comment, a string or a template', () => {
    const source = `
      // import a from './line-comment';
      /* import b from './block-comment'; */
      /** export * from './doc-comment'; */
      const s = "import c from './in-a-string'";
      const t = 'require("./single-quoted")';
      const u = \`import('./in-a-template')\`;
    `;
    expect(of(source)).toEqual([]);
  });

  it('ignores a method and a property that share a keyword’s name', () => {
    const source = `
      Array.from('abc');
      loader.import('./method');
      module.require('./method-too');
      const o = { from: 'x', import: 'y', require: 'z' };
    `;
    expect(of(source)).toEqual([]);
  });

  it('reports nothing for a dynamic import whose path is built at run time', () => {
    // The one way to cross a boundary unseen. No parser reports it either, and
    // `importboundaries` says so rather than pretend.
    expect(of('const m = await import(`./screens/${name}`); const n = await import(path);')).toEqual([]);
  });
});

describe('where an import lands', () => {
  const files = new Set([
    'app/src/lib/a.ts',
    'app/src/lib/b.tsx',
    'app/src/lib/c.jsx',
    'app/src/lib/dir/index.ts',
    'app/server/x.ts',
    'packages/contract/src/index.ts',
    'packages/institution/src/index.ts',
  ]);
  const at = (from: string, spec: string) => resolveImport(from, spec, files);

  it('adds the extension the source leaves off', () => {
    expect(at('app/src/lib/z.ts', './a')).toEqual({ kind: 'file', path: 'app/src/lib/a.ts' });
    expect(at('app/src/lib/z.ts', './b')).toEqual({ kind: 'file', path: 'app/src/lib/b.tsx' });
    expect(at('app/src/lib/z.ts', './c.jsx')).toEqual({ kind: 'file', path: 'app/src/lib/c.jsx' });
    expect(at('app/src/lib/z.ts', './dir')).toEqual({ kind: 'file', path: 'app/src/lib/dir/index.ts' });
  });

  it('reads NodeNext’s .js for a .ts file, and an explicit .ts', () => {
    expect(at('app/src/lib/z.ts', './a.js')).toEqual({ kind: 'file', path: 'app/src/lib/a.ts' });
    expect(at('app/src/lib/z.ts', './a.ts')).toEqual({ kind: 'file', path: 'app/src/lib/a.ts' });
  });

  it('climbs out of a directory', () => {
    expect(at('app/src/lib/dir/q.ts', '../a')).toEqual({ kind: 'file', path: 'app/src/lib/a.ts' });
    expect(at('app/server/y.ts', '../src/lib/a')).toEqual({ kind: 'file', path: 'app/src/lib/a.ts' });
  });

  it('follows the workspace aliases to the packages', () => {
    expect(at('app/src/lib/z.ts', '@semester/contract')).toEqual({ kind: 'file', path: 'packages/contract/src/index.ts' });
    expect(at('app/src/lib/z.ts', '@semester/institution')).toEqual({ kind: 'file', path: 'packages/institution/src/index.ts' });
    expect(at('app/src/lib/z.ts', '@semester/platform')).toEqual({ kind: 'file', path: 'packages/platform/src/index.ts' });
  });

  it('tells a built-in, a package, an asset and a missing file apart', () => {
    expect(at('app/src/lib/z.ts', 'node:fs')).toEqual({ kind: 'builtin', spec: 'node:fs' });
    expect(at('app/src/lib/z.ts', 'react')).toEqual({ kind: 'external', spec: 'react' });
    expect(at('app/src/lib/z.ts', 'jsr:@supabase/supabase-js@2')).toEqual({ kind: 'external', spec: 'jsr:@supabase/supabase-js@2' });
    expect(at('app/src/lib/z.ts', '../styles/app.css')).toEqual({ kind: 'asset', spec: '../styles/app.css' });
    expect(at('app/src/lib/z.ts', './data.json?raw')).toEqual({ kind: 'asset', spec: './data.json?raw' });
    expect(at('app/src/lib/z.ts', './missing')).toEqual({ kind: 'unresolved', spec: './missing' });
  });

  it('puts a path in its zone', () => {
    expect(zoneOf('packages/contract/src/index.ts')).toBe('packages');
    expect(zoneOf('packages/platform-control/scripts/build-atlas.ts')).toBe('tooling');
    expect(zoneOf('supabase/functions/_shared/cors.ts')).toBe('functions');
    expect(zoneOf('app/src/main.tsx')).toBe('app-src');
    expect(zoneOf('app/server/institution/gateway.ts')).toBe('app-server');
    expect(zoneOf('app/api/institution/[...path].ts')).toBe('app-api');
    expect(zoneOf('app/scripts/budgets.ts')).toBe('app-scripts');
    expect(zoneOf('app/vite.config.ts')).toBe('app-other');
    expect(zoneOf('pipeline/align.mjs')).toBe('other');
  });
});

describe('what an entry point reaches', () => {
  it('follows every import, through a cycle, and nothing it does not import', () => {
    const tree = treeOf({
      'app/src/main.tsx': "import './a'; const lazy = () => import('./b');",
      'app/src/a.ts': "import { b } from './b';",
      'app/src/b.ts': "import { a } from './a'; import './c';",
      'app/src/c.ts': 'export {};',
      'app/src/orphan.ts': "import './c';",
    });
    const { files, via } = reachableFrom(tree, 'app/src/main.tsx');
    expect([...files].sort()).toEqual(['app/src/a.ts', 'app/src/b.ts', 'app/src/c.ts', 'app/src/main.tsx']);
    expect(via.get('app/src/c.ts')).toBe('app/src/b.ts');
  });
});
