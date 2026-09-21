/**
 * The character reference sheet for one persona of the animated series.
 *
 *     node pipeline/persona-sheet.mjs host-nell
 *     node pipeline/persona-sheet.mjs --all --dry-run
 *     node pipeline/persona-sheet.mjs host-nell --note "low afternoon light"
 *     node pipeline/persona-sheet.mjs host-nell --image <provider>   (not wired)
 *
 * Step 4 of `docs/VIDEO_PODCAST_ROADMAP.md`. The sheet is the reference every
 * later clip of a course is generated against, so it is the one artefact worth
 * looking at before anything is bought — and `--layout` renders exactly that,
 * for nothing, through Remotion.
 *
 * `--image <provider>` is not wired to anything and exits non-zero saying so,
 * the same as `--broll`. No per-image price is written into this repository:
 * those move faster than the code, and a stale one quoted in a `--dry-run`
 * reads like a measurement. Choosing a provider and a price is a spending
 * decision, left to whoever spends.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dollars, estimate, EMPTY, unspent } from '../video/src/clipspend.ts';
import { check, describe, panels, PERSONA_IDS, PERSONAS, sheetJob, sheetPrompt } from './personas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app/public/video/personas');

function usage(message) {
  console.error(
    `${message}\n\nnode pipeline/persona-sheet.mjs <persona…> | --all  ` +
      '[--note "…"] [--layout] [--image <provider>] [--dry-run]\n\n' +
      `personas: ${PERSONA_IDS.join(', ')}`,
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const dry = argv.includes('--dry-run');
const layout = argv.includes('--layout');
const provider = flag('image');
const note = flag('note');

const named = argv.filter((a) => !a.startsWith('--') && PERSONA_IDS.includes(a));
const ids = argv.includes('--all') ? PERSONA_IDS : named;
if (ids.length === 0) usage('Name a persona, or --all.');

const unknown = argv.filter(
  (a) => !a.startsWith('--') && !PERSONA_IDS.includes(a) && a !== note && a !== provider,
);
if (unknown.length) usage(`No persona called "${unknown[0]}".`);
if (note !== undefined && ids.length > 1) {
  usage('--note applies to one persona; name it rather than --all.');
}

/*
 * Every persona is checked, including the ones committed here.
 *
 * `personas.mjs` keeps a likeness out of the appearance by making it a choice
 * from enumerated axes, and `check` is what makes that true rather than
 * intended — an axis that quietly accepts anything is a free-text field with
 * an enumeration's name on it. Running it over the presets as well as over
 * `--note` costs nothing and means a preset edited by hand gets the same
 * reading as an argument typed at a terminal.
 */
const chosen = ids.map((id) => ({ id, persona: note ? { ...PERSONAS[id], note } : PERSONAS[id] }));
let refused = 0;
for (const { id, persona } of chosen) {
  const problems = check(persona);
  if (problems.length === 0) continue;
  console.error(`${id}: refused\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  refused += 1;
}
if (refused) {
  console.error(
    '\nAppearance is chosen from the axes in pipeline/personas.mjs, and a note\n' +
      'describes rather than compares. §7 of the roadmap: no real person’s name,\n' +
      'voice or likeness in any persona preset or character sheet.',
  );
  process.exit(1);
}

for (const { id, persona } of chosen) {
  console.log(
    `${id} — ${persona.name}, ${persona.label} (${persona.role})\n` +
      `  ${describe(persona)}\n` +
      `  ${panels().length} panels, one image, accent ${persona.accent}`,
  );
  if (dry) console.log(`  prompt: ${sheetPrompt(persona)}`);
}

/*
 * ── what a generation run would cost ──────────────────────────────────────
 *
 * The accounting runs whether or not a provider is named, against the manifest
 * the sheets would be recorded in. `video/src/clipspend.ts` has the argument
 * for building it first; the part that matters here is that a sheet is a
 * *still*, so it is priced per image and a per-second rate reads it as free.
 */
const manifestPath = join(OUT, 'clipspend.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : EMPTY;
const jobs = chosen.map(({ id, persona }) => sheetJob(id, persona, provider ?? '(unset)', '(unset)'));
const todo = unspent(manifest, jobs);
console.log(
  `\n${todo.length} of ${jobs.length} sheets not already bought` +
    (jobs.length - todo.length
      ? ` (${jobs.length - todo.length} in ${manifestPath.replace(`${ROOT}/`, '')})`
      : ''),
);

if (provider) {
  console.error(
    `\n--image ${provider} is not wired to a provider.\n\n` +
      'What it would cost: unknown — no rate is configured, and no per-image price\n' +
      'is written into this repository on purpose, because those move faster than\n' +
      "the code and a stale number quoted in a --dry-run reads like a measurement.\n" +
      "Read the provider's current price, put it in the run, and the estimate\n" +
      `becomes real:\n  at 3c an image that would be ` +
      `${dollars(estimate(todo, { centsPerImage: 3 }).cents)}.\n\n` +
      'Choosing a provider is a spending decision, so it is left to whoever is\n' +
      'spending. Use --layout for the sheet that costs nothing.',
  );
  process.exit(1);
}

if (!layout) {
  console.log('\nNothing rendered. --layout draws the sheet; --image <provider> would buy one.');
  process.exit(0);
}
if (dry) {
  console.log(`\n--dry-run: would render ${chosen.length} layout(s) into ${OUT.replace(`${ROOT}/`, '')}`);
  process.exit(0);
}

/*
 * The layout, which is not the sheet and does not pretend to be.
 *
 * It draws the nine panels at the size and arrangement the prompt asks for,
 * each one labelled with the view and expression that belongs in it, in the
 * persona's own accent. It is the storyboard for an image nobody has bought:
 * something to argue with before the money, and something to hold the
 * generated sheet against afterwards.
 */
mkdirSync(OUT, { recursive: true });
for (const { id, persona } of chosen) {
  const spec = join(OUT, `${id}.json`);
  writeFileSync(spec, `${JSON.stringify({ id, persona, panels: panels(), prompt: sheetPrompt(persona) }, null, 2)}\n`);
  console.log(`\n${id}: rendering the layout…`);
  execFileSync('node', [join(ROOT, 'video/render-persona.mjs'), id], {
    stdio: 'inherit',
    cwd: join(ROOT, 'video'),
  });
}
