/**
 * Render a documentary cut of a course's two-voice episode.
 *
 *     node render-documentary.mjs econ --seconds 90
 *     node render-documentary.mjs econ --dry-run
 *     node render-documentary.mjs econ --broll <provider>     (not wired — see below)
 *
 * The spine is the podcast MP3 and the picture is its chapter marks. With
 * `--broll none`, which is the only mode that exists, nothing is bought and
 * the whole thing costs frames.
 *
 * Normally reached through `python3 pipeline/documentary.py <course>`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { dollars, estimate, EMPTY, unspent } from './src/clipspend.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FPS = 30;

function usage(message) {
  console.error(
    `${message}\n\nnode render-documentary.mjs <course> [--seconds N] [--broll none] ` +
      '[--ground id] [--accent id] [--dry-run]',
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const course = argv.find((a) => !a.startsWith('--'));
if (!course) usage('Name a course.');

const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const broll = flag('broll', 'none');
const ground = flag('ground', 'ink');
const accent = flag('accent', 'sterling');
const dry = argv.includes('--dry-run');

/*
 * The chapter file is the input, and it is the one `audio/synth.py` wrote
 * beside the MP3 it rendered — so the marks are the episode's own, measured
 * where each line started, rather than recovered afterwards.
 */
const scripts = join(ROOT, 'audio/scripts');
const chapterFile = existsSync(scripts)
  ? (await import('node:fs')).readdirSync(scripts).find((f) => {
      if (!f.endsWith('.chapters.json')) return false;
      try {
        return JSON.parse(readFileSync(join(scripts, f), 'utf8')).course === course;
      } catch {
        return false;
      }
    })
  : undefined;

if (!chapterFile) usage(`No chapter marks for "${course}" in ${scripts}.`);
const episode = JSON.parse(readFileSync(join(scripts, chapterFile), 'utf8'));

const file = `/audio/${episode.id}.mp3`;
if (!existsSync(join(ROOT, 'app/public', file.slice(1)))) {
  usage(`No episode audio at app/public${file}`);
}

const renderSeconds = flag('seconds') === undefined ? episode.seconds : Number(flag('seconds'));
if (!Number.isFinite(renderSeconds) || renderSeconds <= 0) usage('--seconds wants a number.');
const covered = Math.min(renderSeconds, episode.seconds);

const code = (() => {
  const guide = join(ROOT, 'app/src/data/courses', course, 'index.ts');
  if (!existsSync(guide)) return course.toUpperCase();
  const m = readFileSync(guide, 'utf8').match(/code:\s*'([^']+)'/);
  return m ? m[1] : course.toUpperCase();
})();

console.log(
  `${course}: ${episode.title}\n` +
    `  ${episode.chapters.length} chapters, ${episode.len} total, rendering ${mmss(covered)} ` +
    `(${Math.round(covered * FPS).toLocaleString()} frames at ${FPS}fps)`,
);

/*
 * ── what a B-roll run would cost ───────────────────────────────────────────
 *
 * `--broll none` is the only mode implemented. The accounting below runs
 * anyway, against an empty manifest, because the point of building it before
 * a provider is wired is that the first paid run cannot happen without it —
 * `video/src/clipspend.ts` has the argument in full.
 */
if (broll !== 'none') {
  const manifestPath = join(ROOT, 'app/public/audio/documentary', course, 'clipspend.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : EMPTY;

  // One establishing shot per chapter is the shape the roadmap describes.
  const jobs = episode.chapters.map((c, i) => ({
    slot: `${course}/chapter-${i}`,
    prompt: c.name,
    seconds: 6,
    provider: broll,
    model: '(unset)',
  }));
  const todo = unspent(manifest, jobs);

  console.error(
    `\n--broll ${broll} is not wired to a provider.\n\n` +
      `What it would ask for: ${todo.length} of ${jobs.length} clips ` +
      `(${jobs.length - todo.length} already in ${manifestPath.replace(`${ROOT}/`, '')}).\n` +
      'What it would cost: unknown — no rate is configured, and no per-second price is\n' +
      'written into this repository on purpose, because those move faster than the code\n' +
      "and a stale number quoted in a --dry-run reads like a measurement. Read the\n" +
      "provider's current price, put it in the run, and the estimate becomes real:\n" +
      `  at 10c/s that would be ${dollars(estimate(todo, { centsPerSecond: 10 }).cents)}.\n\n` +
      'Choosing a provider is a spending decision, so it is left to whoever is spending.\n' +
      'Use --broll none for the cut that costs nothing.',
  );
  process.exit(1);
}

console.log(`  --broll none: nothing to buy, nothing to spend`);

if (dry) {
  console.log('\n--dry-run: nothing rendered.');
  process.exit(0);
}

const outDir = join(ROOT, 'app/public/audio/documentary', course);
mkdirSync(outDir, { recursive: true });

console.log('\nbundling…');
const serveUrl = await bundle({
  entryPoint: join(HERE, 'src/index.ts'),
  publicDir: join(ROOT, 'app/public'),
});
const browserExecutable = process.env.REMOTION_BROWSER || null;

const inputProps = {
  code,
  title: episode.title,
  file,
  chapters: episode.chapters,
  seconds: episode.seconds,
  render: covered,
  ground,
  accent,
};
const composition = await selectComposition({
  serveUrl,
  id: 'Documentary',
  inputProps,
  browserExecutable,
});
const out = join(outDir, `${episode.id}.mp4`);
process.stdout.write(`  → ${out} `);
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: out,
  inputProps,
  browserExecutable,
});
console.log('done');

function mmss(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
