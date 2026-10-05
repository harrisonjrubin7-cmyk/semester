/**
 * Caption tracks for every recording the app plays.
 *
 *     npm run captions            # write them
 *     npm run captions -- --check # write nothing, fail if anything would change
 *
 * Reads the text the recordings were spoken from — `audio/scripts/*.json` with
 * their `.lines.json` times, and each course's `lessons.json` cue list — and
 * writes a WebVTT file beside every MP3 in `public/audio/`. The rules are in
 * `src/lib/webvtt.ts`; `src/lib/webvtt.test.ts` fails if a file here has
 * drifted from its source, the way `transcripts.test.ts` does for the
 * transcripts.
 *
 * `audio/synth.py`, `pipeline/lessons.py` and `pipeline/align-audio.mjs` run
 * this after they write new times, so re-rendering a recording re-captions it.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { episodeCues, format, lessonCues, type EpisodeScript, type EpisodeTimes, type LessonSource } from '../src/lib/webvtt.ts';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(here, '..', '..', 'audio', 'scripts');
const PUBLIC = join(here, '..', 'public');

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
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [path, body] of planned()) {
    const was = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (was === body) continue;
    stale++;
    if (check) console.error(`stale: ${path}`);
    else writeFileSync(path, body);
  }
  const total = planned().size;
  if (check && stale > 0) {
    console.error(`${stale} of ${total} caption files are out of date — run \`npm run captions\` in app/.`);
    process.exit(1);
  }
  console.log(check ? `${total} caption files, all current.` : `${total} caption files, ${stale} written.`);
}
