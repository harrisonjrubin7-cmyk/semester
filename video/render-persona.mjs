/**
 * Draw the layout of one persona's character reference sheet.
 *
 *     node render-persona.mjs host-nell
 *
 * A still, not a video: `app/public/video/personas/<id>.png`. Normally
 * reached through `node pipeline/persona-sheet.mjs <id> --layout`, which
 * writes the spec this reads and checks the persona first.
 *
 * Nothing here is generated and nothing is spent — `src/Persona.tsx` says at
 * length what this is and what it is not.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIR = join(ROOT, 'app/public/video/personas');

const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
if (!id) {
  console.error('node render-persona.mjs <persona> [--ground id]');
  process.exit(1);
}

const spec = join(DIR, `${id}.json`);
if (!existsSync(spec)) {
  console.error(`No spec at ${spec.replace(`${ROOT}/`, '')} — run pipeline/persona-sheet.mjs first.`);
  process.exit(1);
}
const { persona, panels } = JSON.parse(readFileSync(spec, 'utf8'));

const serveUrl = await bundle({
  entryPoint: join(HERE, 'src/index.ts'),
  publicDir: join(ROOT, 'app/public'),
});
const browserExecutable = process.env.REMOTION_BROWSER || null;

/*
 * `describe` again rather than a sentence assembled here. The layout has to
 * carry the same sentence the prompt does, or the thing somebody approves is
 * not the thing that gets generated.
 */
const { describe } = await import('../pipeline/personas.mjs');
const inputProps = {
  id,
  name: persona.name,
  role: persona.role,
  label: persona.label,
  described: describe(persona),
  note: persona.note ?? '',
  panels,
  ground: flag('ground', 'ink'),
  accent: persona.accent,
};

const composition = await selectComposition({
  serveUrl,
  id: 'Persona',
  inputProps,
  browserExecutable,
});
const out = join(DIR, `${id}.png`);
await renderStill({ composition, serveUrl, output: out, inputProps, browserExecutable });
console.log(`  → ${out.replace(`${ROOT}/`, '')}`);
