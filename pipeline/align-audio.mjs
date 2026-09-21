/**
 * Recover where every line starts in an episode that already shipped.
 *
 *     node pipeline/align-audio.mjs econ
 *     node pipeline/align-audio.mjs --all --dry-run
 *
 * Writes `audio/scripts/<stem>.lines.json` beside the script it aligned.
 * Episodes rendered from now on do not need this: `audio/synth.py` writes the
 * same file straight out of the counter it already keeps, exactly rather than
 * recovered. This is for the four that were rendered before it did.
 *
 * It refuses rather than guesses. If the quiet runs cannot be made to fit the
 * script, or the recovered times miss any of the chapter marks `synth.py`
 * measured, nothing is written and the reason is printed. A caption track
 * that is seconds out of step reads as a broken player rather than as an
 * approximation, so a missing one is the better failure.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAgainstChapters, lineTimes, quietRuns } from './align.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'audio/scripts');
const RATE = 16000;

const argv = process.argv.slice(2);
const dry = argv.includes('--dry-run');
const all = argv.includes('--all');
const wanted = argv.filter((a) => !a.startsWith('--'));
if (!all && wanted.length === 0) {
  console.error('node pipeline/align-audio.mjs <course…> | --all   [--dry-run]');
  process.exit(1);
}

/*
 * Whichever ffmpeg this machine has.
 *
 * `audio/synth.py` gets one from `imageio_ffmpeg`, which is a Python package,
 * so it is the last thing asked rather than the first. Remotion brings its own
 * and that one has no `s16le` muxer, which is why everything below goes
 * through a wav file instead of a pipe.
 */
function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const candidate of [
    'ffmpeg',
    join(ROOT, 'video/node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg'),
  ]) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      /* next */
    }
  }
  try {
    return execFileSync('python3', ['-c', 'import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    throw new Error('No ffmpeg. Set $FFMPEG, or pip install imageio-ffmpeg.');
  }
}

/** The whole track as mono samples in [-1, 1]. */
function decode(mp3) {
  const dir = mkdtempSync(join(tmpdir(), 'align-'));
  const wav = join(dir, 'mono.wav');
  try {
    execFileSync(ffmpeg(), ['-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', String(RATE), wav]);
    const buf = readFileSync(wav);
    // Walk the RIFF chunks rather than assuming a 44-byte header.
    let at = 12;
    while (at + 8 <= buf.length) {
      const id = buf.toString('ascii', at, at + 4);
      const size = buf.readUInt32LE(at + 4);
      if (id === 'data') {
        const n = Math.min(size, buf.length - at - 8) >> 1;
        const out = new Float32Array(n);
        for (let i = 0; i < n; i += 1) out[i] = buf.readInt16LE(at + 8 + i * 2) / 32768;
        return out;
      }
      at += 8 + size + (size % 2);
    }
    throw new Error(`no data chunk in ${wav}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const stems = readdirSync(SCRIPTS)
  .filter((f) => f.endsWith('.chapters.json'))
  .map((f) => f.replace('.chapters.json', ''))
  .filter((stem) => {
    if (all) return true;
    const meta = JSON.parse(readFileSync(join(SCRIPTS, `${stem}.chapters.json`), 'utf8'));
    return wanted.includes(meta.course) || wanted.includes(meta.id) || wanted.includes(stem);
  });

if (stems.length === 0) {
  console.error(`Nothing in ${SCRIPTS} matches ${wanted.join(', ')}.`);
  process.exit(1);
}

let refused = 0;
for (const stem of stems) {
  const meta = JSON.parse(readFileSync(join(SCRIPTS, `${stem}.chapters.json`), 'utf8'));
  const script = JSON.parse(readFileSync(join(SCRIPTS, `${stem}.json`), 'utf8'));
  const mp3 = join(ROOT, 'app/public/audio', `${meta.id}.mp3`);
  if (!existsSync(mp3)) {
    console.error(`${stem}: no audio at app/public/audio/${meta.id}.mp3`);
    refused += 1;
    continue;
  }

  const samples = decode(mp3);
  const total = samples.length / RATE;
  const runs = quietRuns(samples, RATE);
  const found = lineTimes(script.lines, runs, total);
  if (found.why) {
    console.error(`${stem}: refused — ${found.why}`);
    refused += 1;
    continue;
  }

  const verdict = checkAgainstChapters(script.lines, found.times, meta.chapters);
  const head =
    `${stem}: ${script.lines.length} lines over ${total.toFixed(1)}s · ` +
    `${found.runs} quiet runs for ${found.gaps} gaps · ` +
    `${found.perSecond.toFixed(1)} characters a second`;
  if (!verdict.ok) {
    console.error(`${head}\n  refused — ${verdict.why ?? `${verdict.misses.length} chapter marks missed`}`);
    for (const m of verdict.misses ?? []) {
      console.error(`    ${m.name}: recorded at ${m.want}s, recovered at ${m.got.toFixed(2)}s`);
    }
    refused += 1;
    continue;
  }
  console.log(`${head}\n  all ${verdict.checked} chapter marks land in the second they were recorded in`);

  const out = join(SCRIPTS, `${stem}.lines.json`);
  const body = {
    id: meta.id,
    course: meta.course,
    /*
     * Where these came from, because it changes what they are worth. A
     * "synth" track is the counter that built the file; a "recovered" one is
     * this, good to a fraction of a second. Anything reading them should be
     * able to tell without knowing which came first.
     */
    source: 'recovered',
    seconds: Number(total.toFixed(3)),
    /*
     * Index, start, end — and no text. The words live in `<stem>.json` one
     * file over, and copying them here would let a restyle pass change what
     * is said without changing what is captioned.
     */
    lines: found.times.map((t, i) => ({
      i,
      s: Number(t.s.toFixed(3)),
      e: Number(Math.max(t.e, t.s).toFixed(3)),
    })),
  };
  if (dry) {
    console.log(`  --dry-run: would write ${out.replace(`${ROOT}/`, '')}`);
  } else {
    writeFileSync(out, `${JSON.stringify(body, null, 2)}\n`);
    console.log(`  → ${out.replace(`${ROOT}/`, '')}`);
  }
}

process.exit(refused ? 1 : 0);
