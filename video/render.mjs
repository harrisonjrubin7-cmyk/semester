/**
 * Render one narrated lesson into a real video.
 *
 *     node render.mjs econ --unit 3
 *     node render.mjs econ --unit 3 --dry-run
 *     node render.mjs econ --ground parchment --accent copper
 *
 * Reads the lesson data `pipeline/lessons.py` already wrote — this does not
 * synthesise anything and never touches a voice. Re-rendering the video for a
 * unit whose narration has not changed is therefore free and safe.
 *
 * Normally reached through `python3 pipeline/lessons.py <course> --remotion`,
 * which is where the rest of the course pipeline lives.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FPS = 30;
const TAIL_SECONDS = 1.5;

function usage(message) {
  console.error(`${message}\n\nnode render.mjs <course> [--unit N] [--ground id] [--accent id] [--dry-run]`);
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
const ground = flag('ground', 'ink');
const accent = flag('accent', 'sterling');
const dry = argv.includes('--dry-run');

const meta = join(ROOT, 'app/public/audio/lessons', course, 'lessons.json');
if (!existsSync(meta)) {
  usage(`No lessons for "${course}" — run: python3 pipeline/lessons.py ${course}`);
}
const lessons = JSON.parse(readFileSync(meta, 'utf8'));

const units = Object.keys(lessons)
  .map(Number)
  .sort((a, b) => a - b)
  .filter((u) => only === null || u === only);

if (units.length === 0) usage(`No unit ${only} in ${course}.`);

/*
 * What this would cost, before it costs it.
 *
 * Nothing here spends money — Remotion renders locally — but the discipline is
 * the one `lessons.py --dry-run` already has and the one the AI-video steps in
 * `docs/VIDEO_PODCAST_ROADMAP.md` will need, where the number is dollars
 * rather than minutes. Better for it to be there from the first generator.
 */
let frames = 0;
for (const u of units) {
  const l = lessons[String(u)];
  frames += Math.round((l.seconds + TAIL_SECONDS) * FPS);
}
console.log(`${course}: ${units.length} unit${units.length === 1 ? '' : 's'}, ${frames} frames at ${FPS}fps`);
for (const u of units) {
  const l = lessons[String(u)];
  console.log(`  unit ${String(u).padStart(2)}  ${l.len}  ${l.cues.length.toString().padStart(3)} cues  ${l.title}`);
}
console.log(`  ground ${ground}, accent ${accent}, 1920x1080`);
if (dry) {
  console.log('\n--dry-run: nothing rendered. $0 either way — this is compute, not an API call.');
  process.exit(0);
}

/*
 * Which Chromium to drive.
 *
 * Remotion downloads its own Chrome Headless Shell when this is unset, which
 * is half a gigabyte and — on a machine whose egress is filtered — a 403 from
 * a host that is not on the allowlist. `REMOTION_BROWSER` points at one that
 * is already installed. Both calls below need it: `selectComposition` opens a
 * browser to read the composition's metadata before `renderMedia` opens one to
 * draw with, and setting it on only the second is a download either way.
 */
const browserExecutable = process.env.REMOTION_BROWSER || null;

const outDir = join(ROOT, 'app/public/audio/lessons', course);
mkdirSync(outDir, { recursive: true });

console.log('\nbundling…');
const serveUrl = await bundle({
  entryPoint: join(HERE, 'src/index.ts'),
  publicDir: join(ROOT, 'app/public'),
});

// The course code is on the guide, not on the lesson — read it from the module
// `lessons.py` writes beside the data rather than asking for it on the command
// line, so the video cannot be labelled with a code the app disagrees with.
const code = (() => {
  const guide = join(ROOT, 'app/src/data/courses', course, 'index.ts');
  if (!existsSync(guide)) return course.toUpperCase();
  const m = readFileSync(guide, 'utf8').match(/code:\s*'([^']+)'/);
  return m ? m[1] : course.toUpperCase();
})();

for (const u of units) {
  const lesson = lessons[String(u)];
  const inputProps = { lesson, code, ground, accent };
  const composition = await selectComposition({ serveUrl, id: 'Lesson', inputProps, browserExecutable });
  const out = join(outDir, `unit-${u}.mp4`);
  process.stdout.write(`  unit ${u} → ${out} `);
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
