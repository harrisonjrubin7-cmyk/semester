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
const broll = flag('broll', 'auto');
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

/*
 * The captions, if this episode has any.
 *
 * Two files, on purpose. `<stem>.lines.json` is where each line starts —
 * written by `audio/synth.py` for anything rendered since it began recording
 * them, recovered from the audio by `pipeline/align-audio.mjs` for the four
 * that shipped before. `<stem>.json` is what each line says. Keeping the
 * words in the script means a restyle pass cannot change what is spoken
 * without changing what is captioned.
 *
 * An episode with neither still renders. The lower-thirds and the spine
 * never needed a line track, and a cut with no captions is what this format
 * was before there were any.
 */
const stem = chapterFile.replace('.chapters.json', '');
const linesPath = join(scripts, `${stem}.lines.json`);
const scriptPath = join(scripts, `${stem}.json`);
const track = existsSync(linesPath) && existsSync(scriptPath)
  ? JSON.parse(readFileSync(linesPath, 'utf8'))
  : undefined;
const said = track ? JSON.parse(readFileSync(scriptPath, 'utf8')).lines : [];
const times = track ? track.lines.filter((l) => l.i < said.length) : [];

/*
 * B-roll that exists, which is not the same question as B-roll that was asked
 * for.
 *
 * `video/shots/<course>.json` says what each shot is and when it lands;
 * `pipeline/broll-shots.mjs` checks and prices it. This only looks for the
 * files, so a course with a written shot list and nothing generated renders
 * exactly as it did before — which is the state every course is in today.
 */
const shotList = (() => {
  const path = join(ROOT, 'video/shots', `${course}.json`);
  if (broll === 'none' || !existsSync(path)) return [];
  const list = JSON.parse(readFileSync(path, 'utf8'));
  return list.shots
    .map((shot, i) => ({ at: shot.at, seconds: shot.seconds, file: `/video/broll/${course}/chapter-${i}.mp4` }))
    .filter((shot) => existsSync(join(ROOT, 'app/public', shot.file.slice(1))));
})();

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
console.log(
  shotList.length
    ? `  ${shotList.length} B-roll inserts on disk`
    : `  no B-roll: ${broll === 'none' ? '--broll none' : 'nothing generated for this course yet'}` +
      ' — see `node pipeline/broll-shots.mjs ' + course + '`',
);
console.log(
  times.length
    ? `  ${times.length} captions, ${track.source === 'synth' ? 'measured while rendering' : 'recovered from the audio'}`
    : `  no captions: nothing at ${linesPath.replace(`${ROOT}/`, '')}` +
      ' — run `node pipeline/align-audio.mjs ' + course + '`',
);

/*
 * Buying is not this script's job any more.
 *
 * It used to price a run here, one clip per chapter, with `prompt: c.name` —
 * so the fourteen clips it costed for ECON would have been generated from
 * "Cold open" and "The formula sheet". `pipeline/broll.mjs` has the argument
 * against that at length; the short version is that a chapter title names a
 * passage of argument and cannot be filmed. Shot lists, checks, prices and the
 * spend ceiling now live in `pipeline/broll-shots.mjs`, and this renders
 * whatever ended up on disk.
 */
if (broll !== 'none' && broll !== 'auto') {
  console.error(
    `--broll ${broll} is not a provider this script talks to.\n\n` +
      `  node pipeline/broll-shots.mjs ${course} --draft    write the shot list\n` +
      `  node pipeline/broll-shots.mjs ${course} --price <cents/s> --max-spend <dollars>\n\n` +
      'Use --broll none to render with no inserts, or leave it off and this uses\n' +
      'whatever has been generated into app/public/video/broll/.',
  );
  process.exit(1);
}


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
  times,
  said,
  shots: shotList,
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
