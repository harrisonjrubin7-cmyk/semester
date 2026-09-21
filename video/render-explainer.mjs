/**
 * Render a YouTube-length explainer for a course.
 *
 *     node render-explainer.mjs econ
 *     node render-explainer.mjs econ --from 0 --to 5
 *     node render-explainer.mjs econ --dry-run
 *
 * A run of the course's units played in order, 8–15 minutes of it, with a hook
 * over the opening and a chapter mark on every unit boundary. Nothing is
 * synthesised and no audio file is written — `pipeline/explainer.mjs` has the
 * arithmetic and the argument.
 *
 * Normally reached through `python3 pipeline/explainer.py <course>`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { chapterText, explainerTitle, mmss, planExplainer } from '../pipeline/explainer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FPS = 30;

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const num = (name) => (flag(name) === undefined ? undefined : Number(flag(name)));
const dry = argv.includes('--dry-run');

function usage(message) {
  console.error(
    `${message}\n\nnode render-explainer.mjs <course> [--from N] [--to N] ` +
      '[--ground id] [--accent id] [--dry-run]',
  );
  process.exit(1);
}

const course = argv.find((a) => !a.startsWith('--') && a !== flag('from') && a !== flag('to'));
if (!course) usage('Name a course.');

const lessonsPath = join(ROOT, 'app/public/audio/lessons', course, 'lessons.json');
if (!existsSync(lessonsPath)) usage(`No lesson cues at ${lessonsPath.replace(`${ROOT}/`, '')}`);
const lessons = JSON.parse(readFileSync(lessonsPath, 'utf8'));

const plan = planExplainer(lessons, { from: num('from') ?? 0, to: num('to') });
if (plan.why) usage(`${course}: ${plan.why}`);

const missing = plan.units.filter((u) => !existsSync(join(ROOT, 'app/public', u.file.slice(1))));
if (missing.length) usage(`${course}: no audio for unit ${missing.map((u) => u.unit).join(', ')}`);

const guide = join(ROOT, 'app/src/data/courses', course, 'index.ts');
const field = (key, fallback) => {
  if (!existsSync(guide)) return fallback;
  const m = readFileSync(guide, 'utf8').match(new RegExp(`${key}:\\s*'([^']+)'`));
  return m ? m[1] : fallback;
};
const code = field('code', course.toUpperCase());
const title = explainerTitle(field('name', code), plan);

console.log(
  `${course}: ${title}\n` +
    `  units ${plan.from}–${plan.to} of ${plan.from + plan.units.length + plan.left}, ` +
    `${plan.len} (${Math.round(plan.seconds * FPS).toLocaleString()} frames at ${FPS}fps)\n` +
    `  hook to ${plan.hook.until.toFixed(2)}s over ${plan.hook.questions.length} questions, ` +
    `${plan.chapters.length} chapters, ${plan.cues.length} cues`,
);
if (plan.left) console.log(`  ${plan.left} unit(s) left out to stay under ${mmss(plan.band.max)}`);
if (plan.short) console.log(`  under ${mmss(plan.band.min)}, which the roadmap calls the floor`);

const outDir = join(ROOT, 'app/public/video/explainer', course);
const chapters = join(outDir, 'chapters.txt');

if (dry) {
  console.log(`\n--dry-run: nothing rendered. The chapter list would be:\n`);
  console.log(chapterText(plan.chapters));
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
/*
 * The chapter list as text, beside the video.
 *
 * YouTube reads chapters out of the description box and wants the first at
 * 0:00, which a unit run gives for nothing. Written as a file rather than
 * printed because it is something somebody pastes, and a terminal scrollback
 * is a bad place to keep it.
 */
writeFileSync(chapters, `${chapterText(plan.chapters)}\n`);
console.log(`\n  → ${chapters.replace(`${ROOT}/`, '')}`);

console.log('bundling…');
const serveUrl = await bundle({
  entryPoint: join(HERE, 'src/index.ts'),
  publicDir: join(ROOT, 'app/public'),
});
const browserExecutable = process.env.REMOTION_BROWSER || null;

const inputProps = {
  code,
  title,
  units: plan.units.map((u) => ({
    unit: u.unit,
    title: u.title,
    file: u.file,
    at: u.at,
    seconds: u.seconds,
  })),
  cues: plan.cues,
  hook: plan.hook,
  seconds: plan.seconds,
  ground: flag('ground', 'ink'),
  accent: flag('accent', 'sterling'),
};

const composition = await selectComposition({
  serveUrl,
  id: 'Explainer',
  inputProps,
  browserExecutable,
});
const out = join(outDir, `${course}-explainer.mp4`);
process.stdout.write(`  → ${out.replace(`${ROOT}/`, '')} `);
await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, browserExecutable });
console.log('done');
