/**
 * The podcasts' transcripts, written from the scripts they were spoken from.
 *
 * `npm run transcripts`. Reads `audio/scripts/*.json` — the same files
 * `audio/synth.py` renders the MP3s from — and writes one module per course
 * into `src/data/transcripts/`.
 *
 * An audio recording with no text alternative is unusable by somebody who is
 * deaf or hard of hearing, and awkward for everybody else: you cannot search
 * it, skim it, quote it, or follow it on a bus with no headphones. Four
 * episodes, nineteen thousand words, and every one of those words was already
 * in this repository — sitting in the directory that produced the audio, one
 * step away from the app and never taken.
 *
 * ## Generated, not copied
 *
 * The alternative was pasting the lines into the course data, which is the
 * duplication every registry in this app exists to prevent: re-record an
 * episode with a changed script and the transcript would go on saying what
 * the old one said, silently, because nothing compares them. Running this is
 * the same act as running the synthesiser, and `transcripts.test.ts` fails if
 * a generated file has drifted from its script.
 *
 * `--check` writes nothing and fails if it would have.
 *
 * ## One file per course
 *
 * Not one file for all four. The transcripts are 120KB of prose, and a phone
 * opening Today has no use for any of it — so each is its own module, loaded
 * by a dynamic import when somebody opens Listen for that course, and cached
 * by the service worker like any other chunk. Bundling them into the app
 * would put nineteen thousand words in front of a first paint.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, '..', '..', 'audio', 'scripts');
const out = join(here, '..', 'src', 'data', 'transcripts');

/**
 * The app's data is typographically clean and the scripts are not.
 *
 * `The 5 C's` in the script is `The 5 C’s` in the course data — the same
 * chapter, spelled with the apostrophe a typesetter would use. Chapter names
 * are what join a transcript to its edition, so they are compared and written
 * in the app's spelling rather than the script's; without this one episode of
 * four would come out with its transcript unattached to any chapter.
 */
export function tidy(s) {
  return s
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/ -- /g, ' — ')
    .trim();
}

/** `Cold open` → the lines spoken in it, in order, with who says each. */
function chapters(lines) {
  const out = [];
  for (const line of lines) {
    if (line.chapter) out.push({ name: tidy(line.chapter), said: [] });
    // A script that opens with a line before its first chapter mark would
    // otherwise drop that line on the floor. Nothing does today; a re-record
    // easily could, and losing the cold open is not a thing to find out by
    // reading the app.
    if (out.length === 0) out.push({ name: '', said: [] });
    out[out.length - 1].said.push({ who: line.v, text: tidy(line.t) });
  }
  return out;
}

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function render(script) {
  const parts = chapters(script.lines);
  const words = script.lines.reduce((n, l) => n + l.t.split(/\s+/).length, 0);
  const voices = Object.keys(script.voices);
  return `/*
 * ${script.title} — the transcript, generated.
 *
 * Written by \`npm run transcripts\` from \`audio/scripts/${script.file}\`, which is
 * the script \`audio/synth.py\` spoke to make \`${script.id}.mp3\`. Do not edit
 * this file: change the script and run the generator, or the words on the
 * page stop being the words in the recording.
 *
 * ${parts.length} chapters · ${words.toLocaleString('en-GB')} words.
 */
import type { Transcript } from '../../lib/transcript';

const transcript: Transcript = {
  episode: ${quote(script.id)},
  voices: [${voices.map(quote).join(', ')}],
  chapters: [
${parts
  .map(
    (c) => `    {
      name: ${quote(c.name)},
      said: [
${c.said.map((l) => `        { who: ${quote(l.who)}, text: ${quote(l.text)} },`).join('\n')}
      ],
    },`,
  )
  .join('\n')}
  ],
};

export default transcript;
`;
}

const check = process.argv.includes('--check');
if (!existsSync(out)) mkdirSync(out, { recursive: true });

let stale = 0;
const written = [];
for (const file of readdirSync(scripts).sort()) {
  if (!file.endsWith('.json') || file.endsWith('.chapters.json')) continue;
  const script = { ...JSON.parse(readFileSync(join(scripts, file), 'utf8')), file };
  const path = join(out, `${script.course}.ts`);
  const next = render(script);
  const now = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (now === next) {
    written.push(`${script.course} (unchanged)`);
    continue;
  }
  stale++;
  if (check) {
    console.error(`${script.course}.ts is not what ${file} says it should be.`);
    continue;
  }
  writeFileSync(path, next);
  written.push(`${script.course} (written)`);
}

if (check && stale > 0) {
  console.error(`\n${stale} transcript${stale === 1 ? '' : 's'} stale. Run \`npm run transcripts\`.`);
  process.exit(1);
}
console.log(`transcripts ok — ${written.join(', ')}`);
