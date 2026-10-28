/**
 * Caption tracks for every recording the app plays.
 *
 *     npm run captions            # write them
 *     npm run captions -- --check # write nothing, fail if anything would change
 *
 * Reads the text the recordings were spoken from — `audio/scripts/*.json` with
 * their `.lines.json` times, each course's `lessons.json` cue list, and the
 * exact-audio-hash-pinned recovered cues under `audio/transcripts/` — and
 * writes a WebVTT file beside every MP3 in `public/audio/`. The rules are in
 * `src/lib/webvtt.ts`; `src/lib/webvtt.test.ts` fails if a file here has
 * drifted from its source, the way `transcripts.test.ts` does for the
 * transcripts.
 *
 * `audio/synth.py`, `pipeline/lessons.py` and `pipeline/align-audio.mjs` run
 * this after they write new times, so re-rendering a recording re-captions it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { episodeCues, format, lessonCues, type EpisodeScript, type EpisodeTimes, type LessonSource } from '../src/lib/webvtt.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const SCRIPTS = join(ROOT, 'audio', 'scripts');
const TRANSCRIPTS = join(ROOT, 'audio', 'transcripts');
const PUBLIC = join(here, '..', 'public');

interface RecoveredTranscript {
  id: string;
  audio: string;
  audioSha256: string;
  durationSeconds: number;
  generatedOn: string;
  language: 'en';
  model: string;
  review: 'machine-generated-unreviewed';
  cues: [start: number, end: number, text: string][];
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

export function planned(): Map<string, string> {
  const out = new Map<string, string>();
  // Episodes. The same "a script is a file with no second dot" rule as
  // `isEpisodeScript` in `src/lib/episodes.ts`.
  for (const file of readdirSync(SCRIPTS).sort()) {
    if (!/^[^.]+\.json$/.test(file)) continue;
    const script = JSON.parse(readFileSync(join(SCRIPTS, file), 'utf8')) as EpisodeScript;
    const timesPath = join(SCRIPTS, file.replace(/\.json$/, '.lines.json'));
    if (!existsSync(timesPath)) {
      console.warn(`! ${file}: no .lines.json, so no captions — run pipeline/align-audio.mjs`);
      continue;
    }
    const times = JSON.parse(readFileSync(timesPath, 'utf8')) as EpisodeTimes;
    out.set(join(PUBLIC, 'audio', `${script.id}.vtt`), format(episodeCues(script, times)));
  }
  // Lessons.
  const lessons = join(PUBLIC, 'audio', 'lessons');
  for (const course of readdirSync(lessons).sort()) {
    const meta = join(lessons, course, 'lessons.json');
    if (!existsSync(meta)) continue;
    const units = JSON.parse(readFileSync(meta, 'utf8')) as Record<string, LessonSource & { file: string }>;
    for (const unit of Object.values(units)) {
      out.set(join(PUBLIC, unit.file.replace(/\.mp3$/, '.vtt')), format(lessonCues(unit)));
    }
  }
  // The four legacy full-read editions have no renderer source. Their timed
  // cues were recovered from the actual MP3s and stay explicitly unreviewed.
  // Pinning each source hash means replacing a recording fails closed until a
  // new transcript is recovered; it does not turn machine output into a human
  // accuracy review.
  for (const file of readdirSync(TRANSCRIPTS).filter((name) => name.endsWith('.json')).sort()) {
    const transcript = JSON.parse(readFileSync(join(TRANSCRIPTS, file), 'utf8')) as RecoveredTranscript;
    if (!/^[a-z0-9-]+$/.test(transcript.id)) throw new Error(`${file}: invalid recording id`);
    if (file !== `${transcript.id}.json`) throw new Error(`${file}: filename does not match its recording id`);
    if (transcript.audio !== `app/public/audio/${transcript.id}.mp3`) throw new Error(`${file}: audio path does not match its id`);
    const audio = join(ROOT, transcript.audio);
    if (!existsSync(audio)) throw new Error(`${file}: missing audio ${transcript.audio}`);
    if (sha256(audio) !== transcript.audioSha256) throw new Error(`${file}: audio hash changed; recover its captions again`);
    if (transcript.review !== 'machine-generated-unreviewed') throw new Error(`${file}: unsupported review label`);
    if (transcript.cues.length === 0) throw new Error(`${file}: no cues`);
    let previousStart = -1;
    const cues = transcript.cues.map(([start, end, text]) => ({ start, end, text }));
    for (const cue of cues) {
      if (!cue.text.trim()) throw new Error(`${file}: empty cue`);
      if (!(cue.start >= previousStart && cue.end > cue.start)) throw new Error(`${file}: unordered or empty-duration cue`);
      previousStart = cue.start;
    }
    const last = cues.at(-1)!;
    if (Math.abs(last.end - transcript.durationSeconds) > 2) throw new Error(`${file}: cues do not reach the measured end`);
    out.set(join(PUBLIC, 'audio', `${transcript.id}.vtt`), format(cues));
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  let stale = 0;
  const plan = planned();
  for (const [path, body] of plan) {
    const was = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (was === body) continue;
    stale++;
    if (check) console.error(`stale: ${path}`);
    else writeFileSync(path, body);
  }
  const total = plan.size;
  if (check && stale > 0) {
    console.error(`${stale} of ${total} caption files are out of date — run \`npm run captions\` in app/.`);
    process.exit(1);
  }
  console.log(check ? `${total} caption files, all current.` : `${total} caption files, ${stale} written.`);
}
