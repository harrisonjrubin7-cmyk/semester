/**
 * Copies the sync tick and everything it imports into
 * `supabase/functions/_shared/integration/`, where the `integration-tick`
 * Edge Function can import it.
 *
 * The code is written once, under `app/`, and tested there. An Edge Function
 * is bundled from `supabase/functions/` alone — every function in this
 * repository imports only from its own directory and `_shared` — so the copy
 * is what gets deployed. The copy is generated, never edited:
 * `edge-integration.test.ts` fails when it differs from what this script
 * writes, so a change to the tick that is not re-copied cannot reach main.
 *
 * What changes on the way: the two `server/` files import the library as
 * `../../src/lib/integration/x.ts`, which becomes `./x.ts` because everything
 * lands in one directory; and the type-only `@supabase/supabase-js` import
 * becomes the `jsr:` specifier the other functions use. Any other bare import
 * is refused, because Deno would have nothing to resolve it to.
 *
 *     cd app && node scripts/edge-integration.ts
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(APP, '..', 'supabase', 'functions', '_shared', 'integration');

/** Every file the tick reaches, relative to `app/`. `registry.ts` is the adapters it runs. */
export const SOURCES = [
  'server/integration/tick.ts',
  'server/integration/registry.ts',
  '../packages/platform/src/engines/canvas-read-adapter.ts',
  '../packages/platform/src/engines/provider-error.ts',
  '../packages/platform/src/kernel/clock.ts',
  'server/integration/worker.ts',
  'src/lib/integration/adapter.ts',
  '../packages/institution/src/ai-data-class.ts',
  'src/lib/integration/catalog.ts',
  'src/lib/integration/classification.ts',
  'src/lib/integration/crypto.ts',
  'src/lib/integration/fallback.ts',
  'src/lib/integration/freshness.ts',
  'src/lib/integration/governance-envelope.ts',
  'src/lib/integration/health.ts',
  'src/lib/integration/oauth.ts',
  'src/lib/integration/pipeline.ts',
  'src/lib/integration/provider-client.ts',
  'src/lib/integration/rate-control.ts',
  'src/lib/integration/redact.ts',
  'src/lib/integration/retry.ts',
  'src/lib/integration/vault.ts',
] as const;

const SPECIFIER = /(\bfrom\s+|\bimport\s*\(\s*)(['"])([^'"]+)\2/g;

function rewrite(source: string, from: string): string {
  return source.replace(SPECIFIER, (whole, lead: string, quote: string, spec: string) => {
    let out: string;
    if (spec === '@supabase/supabase-js') out = 'jsr:@supabase/supabase-js@2';
    else if (spec.startsWith('../../src/lib/integration/')) out = `./${spec.slice('../../src/lib/integration/'.length)}`;
    else if (spec === '../../../packages/platform/src/index.ts' && from === 'server/integration/registry.ts') out = './canvas-read-adapter.ts';
    else if (spec === '@semester/platform' && from === 'src/lib/integration/provider-client.ts') out = './provider-error.ts';
    else if (spec === '../kernel/clock.ts' && from.endsWith('/canvas-read-adapter.ts')) out = './clock.ts';
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
    files.set(name, `// Generated from app/${path} by app/scripts/edge-integration.ts. Do not edit;\n// change the source and run \`cd app && node scripts/edge-integration.ts\`.\n\n${body}`);
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
