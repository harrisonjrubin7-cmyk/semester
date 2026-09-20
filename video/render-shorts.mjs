/**
 * Render one vertical short per flashcard.
 *
 *     node render-shorts.mjs econ --unit 3
 *     node render-shorts.mjs econ --all --dry-run
 *     node render-shorts.mjs econ --unit 3 --card 2
 *
 * Reads the cue list `pipeline/lessons.py` already wrote and cuts it into one
 * short per card. Nothing is synthesised and no audio file is written: each
 * short plays the seconds it occupies inside the unit's own MP3.
 *
 * Normally reached through `python3 pipeline/shorts.py <course>`.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { shortsFor, shortLength } from './src/shorts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FPS = 30;
const TAIL_SECONDS = 0.6;

function usage(message) {
  console.error(
    `${message}\n\nnode render-shorts.mjs <course> [--unit N] [--card N] [--all] [--ground id] [--accent id] [--dry-run]`,
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
const only = flag('unit') === undefined ? null : Number(flag('unit'));
const onlyCard = flag('card') === undefined ? null : Number(flag('card'));
const ground = flag('ground', 'ink');
const accent = flag('accent', 'sterling');
const dry = argv.includes('--dry-run');

if (only === null && !argv.includes('--all')) {
  usage('Pass --unit N for one unit, or --all for the whole course.');
}

const meta = join(ROOT, 'app/public/audio/lessons', course, 'lessons.json');
if (!existsSync(meta)) {
  usage(`No lessons for "${course}" — run: python3 pipeline/lessons.py ${course}`);
}
const lessons = JSON.parse(readFileSync(meta, 'utf8'));

const code = (() => {
  const guide = join(ROOT, 'app/src/data/courses', course, 'index.ts');
  if (!existsSync(guide)) return course.toUpperCase();
  const m = readFileSync(guide, 'utf8').match(/code:\s*'([^']+)'/);
  return m ? m[1] : course.toUpperCase();
})();

/** Every short this run would make, with the unit it came from. */
const jobs = [];
for (const key of Object.keys(lessons).sort((a, b) => Number(a) - Number(b))) {
  const lesson = lessons[key];
  if (only !== null && Number(key) !== only) continue;
  for (const short of shortsFor(lesson)) {
    if (onlyCard !== null && short.card !== onlyCard) continue;
    jobs.push({ short, lesson });
  }
}

if (jobs.length === 0) usage(`No cards to cut in ${course}${only === null ? '' : ` unit ${only}`}.`);

/*
 * The shot list, before anything is drawn.
 *
 * `lessons.py --dry-run` prints its beats and minutes before synthesising, and
 * this is that discipline carried to a generator that makes 278 files rather
 * than 44. Nothing here spends money — Remotion renders locally — but the
 * count is the thing worth seeing first, and the AI-video steps in
 * docs/VIDEO_PODCAST_ROADMAP.md will put dollars in this same column.
 */
const totalSeconds = jobs.reduce((n, j) => n + shortLength(j.short) + TAIL_SECONDS, 0);
console.log(
  `${course}: ${jobs.length} short${jobs.length === 1 ? '' : 's'}, ` +
    `${Math.round(totalSeconds)}s of video, ${Math.round(totalSeconds * FPS)} frames at ${FPS}fps`,
);
for (const { short, lesson } of jobs) {
  const secs = shortLength(short);
  console.log(
    `  u${String(short.unit).padStart(2)} c${String(short.card).padStart(2)}  ` +
      `${secs.toFixed(1).padStart(5)}s  ${short.question.slice(0, 58)}`,
  );
}
console.log(`  ${ground}/${accent}, 1080x1920`);
if (dry) {
  console.log('\n--dry-run: nothing rendered. $0 either way — this is compute, not an API call.');
  process.exit(0);
}

const outDir = join(ROOT, 'app/public/audio/shorts', course);
mkdirSync(outDir, { recursive: true });

console.log('\nbundling…');
const serveUrl = await bundle({
  entryPoint: join(HERE, 'src/index.ts'),
  publicDir: join(ROOT, 'app/public'),
});

// See render.mjs: both calls need this, and a filtered network makes the
// alternative a 403 rather than a slow download.
const browserExecutable = process.env.REMOTION_BROWSER || null;

let n = 0;
for (const { short, lesson } of jobs) {
  const inputProps = {
    short,
    code,
    unitTitle: lesson.title,
    file: lesson.file,
    ground,
    accent,
  };
  const composition = await selectComposition({
    serveUrl,
    id: 'Short',
    inputProps,
    browserExecutable,
  });
  const out = join(outDir, `unit-${short.unit}-card-${short.card}.mp4`);
  n += 1;
  process.stdout.write(`  [${n}/${jobs.length}] ${out} `);
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: out,
    inputProps,
    browserExecutable,
  });
  console.log('done');
}
