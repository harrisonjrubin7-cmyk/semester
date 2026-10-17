/**
 * Copies the access saga tick and everything it imports into
 * `supabase/functions/_shared/access-saga/`, where the `access-saga-tick`
 * Edge Function can import it. The same arrangement as
 * `edge-integration.ts`, for the same reason: the code is written once under
 * `app/` and tested there, an Edge Function is bundled from
 * `supabase/functions/` alone, and the copy is what gets deployed. The copy
 * is generated, never edited: `edge-access-saga.test.ts` fails when it
 * differs from what this script writes.
 *
 * What changes on the way: the two `server/institution/` files import the
 * saga library through `packages/institution/src/index.ts`, which becomes
 * `./access-saga.ts` — every name they use is that module's own, so nothing
 * else from the index is carried; and the `@supabase/supabase-js` import
 * becomes the `jsr:` specifier the other functions use. Any other bare import
 * is refused, because Deno would have nothing to resolve it to.
 *
 *     cd app && node scripts/edge-access-saga.ts
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(APP, '..', 'supabase', 'functions', '_shared', 'access-saga');

/** Every file the tick reaches, relative to `app/`. `access-saga-registry.ts` is the participants it runs. */
export const SOURCES = [
  'server/institution/access-saga-tick.ts',
  'server/institution/access-saga-registry.ts',
  'server/institution/postgres-access-saga.ts',
  '../packages/institution/src/access-saga.ts',
  '../packages/institution/src/policy.ts',
  '../packages/institution/src/workflow.ts',
] as const;

const SPECIFIER = /(\bfrom\s+|\bimport\s*\(\s*)(['"])([^'"]+)\2/g;

function rewrite(source: string, from: string): string {
  return source.replace(SPECIFIER, (_whole, lead: string, quote: string, spec: string) => {
    let out: string;
    if (spec === '@supabase/supabase-js') out = 'jsr:@supabase/supabase-js@2';
    else if (spec === '../../../packages/institution/src/index.ts') out = './access-saga.ts';
    else if (/^\.\/[a-z-]+\.ts$/.test(spec)) out = spec;
    else throw new Error(`${from}: cannot carry the import ${JSON.stringify(spec)} into an Edge Function`);
    const name = out.startsWith('./') ? out.slice(2) : null;
    if (name && !SOURCES.some((s) => s.endsWith(`/${name}`))) {
      throw new Error(`${from} imports ${spec}, which is not in SOURCES`);
    }
    return `${lead}${quote}${out}${quote}`;
  });
}

/** The generated files, by name, exactly as they should be on disk. */
export function render(): Map<string, string> {
  const files = new Map<string, string>();
  for (const path of SOURCES) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const body = rewrite(readFileSync(join(APP, path), 'utf8'), path);
    files.set(name, `// Generated from app/${path} by app/scripts/edge-access-saga.ts. Do not edit;\n// change the source and run \`cd app && node scripts/edge-access-saga.ts\`.\n\n${body}`);
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = render();
  mkdirSync(OUT, { recursive: true });
  for (const stale of readdirSync(OUT)) if (!files.has(stale)) rmSync(join(OUT, stale));
  for (const [name, text] of files) writeFileSync(join(OUT, name), text);
  console.log(`wrote ${files.size} files to ${OUT}`);
}
