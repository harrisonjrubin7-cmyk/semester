/**
 * Render the audio that is out of date, and nothing else.
 *
 *     npm run audio -- --dry-run     what is stale, and what skipping costs
 *     npm run audio -- --adopt       take the files already on disk as current
 *     npm run audio                  render what is stale
 *     npm run audio -- econ          one course
 *
 * Forty-eight assets ship: forty-four narrated lessons and four podcast
 * editions. Both renderers work and neither has ever known what it made.
 * `pipeline/lessons.py econ` speaks all eleven of econ's units whether one
 * card changed or none did, and `audio/synth.py` re-speaks a thirty-minute
 * episode to correct a sentence in it. Measured with the shipped voices, that
 * is 1.9 minutes to fix one card and 26.4 minutes to build the four courses —
 * see `scripts/audiocache.ts` for the rate and where it came from.
 *
 * COMPLETION-PLAN.md §3.5 asks for the other arrangement: audio built once per
 * topic, keyed by the topic's content hash, so an edited unit re-renders and an
 * untouched one does not. That is this. The deciding is all in
 * `scripts/audiocache.ts`, which is pure and tested; this file is the part that
 * reads the repository, runs the renderers and times them.
 *
 * ## It runs the renderers rather than replacing them
 *
 * `audio/synth.py` and `pipeline/lessons.py` are what produced the audio that
 * ships, they work, and `--unit` was already there. A batch job that
 * re-implemented the synthesis to add a cache in front of it would be the
 * second renderer in a repository that needs one, and the two would disagree
 * about a gap length within a month. So this decides and they speak.
 *
 * ## Four editions it cannot see, and says so
 *
 * Eight episode MP3s sit in `public/audio` and four of them — `core-full`,
 * `econ-guide`, `psci-condensed`, `psci-full` — are the older single-narrator
 * recordings, which predate `audio/scripts/` and have no script in this
 * repository at all. Nothing can re-render them and nothing can say what they
 * were made from, so they get no manifest row: a row is a claim to know, and
 * writing one for a file nobody can rebuild would be the wrong kind of
 * complete. The run names them instead, so "48 assets" is not read as "all the
 * audio".
 *
 * ## It reports staleness; it does not enforce it
 *
 * There is no `--check` wired into CI, and the suite does not fail when a card
 * has moved and its unit has not been re-spoken. It could not: rendering needs
 * Piper and two voice models, which is not a thing to install on a runner to
 * decide a course is out of date. What `src/lib/audiobatch.test.ts` does hold
 * is the shape — every asset the repository wants has a row and a file, and the
 * units are numbered the way the renderer numbers them — because that is the
 * part a machine without a synthesiser can still be sure of.
 *
 * ## Why it can read the app's own modules
 *
 * Node strips types, so the guides — one `import type` each, and nothing else —
 * load here exactly as they do in the app. That matters more than it sounds:
 * `pipeline/lessons.py` reads `guide.ts` with a regular expression, which is
 * how it comes to have its own copy of `speakable` and its own idea of which
 * units count. Nothing here parses TypeScript. The material this job hashes is
 * the guide the app itself holds.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  EMPTY,
  after,
  keyOf,
  lessonAssets,
  orphans,
  perCourse,
  plan,
  recipeOf,
  saidMs,
  saved,
  type Asset,
  type Made,
  type Manifest,
} from './audiocache.ts';
import { isEpisodeScript } from '../src/lib/episodes.ts';
import type { Guide } from '../src/lib/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
const COURSES = join(ROOT, 'app', 'src', 'data', 'courses');
const SCRIPTS = join(ROOT, 'audio', 'scripts');
const MANIFEST = join(ROOT, 'audio', 'manifest.json');

/** The programs whose source decides what a given sentence sounds like. */
const RENDERER: Record<string, string[]> = {
  lesson: ['audio/synth.py', 'pipeline/lessons.py'],
  episode: ['audio/synth.py'],
};

interface Episode {
  id: string;
  course: string;
  voices: Record<string, string>;
  lines: { v: string; t: string; chapter?: string; pause?: number }[];
}

/** The course a manifest row belongs to, read from the row's own id. */
export function courseOf(id: string): string {
  return id.includes('/') ? id.slice(0, id.indexOf('/')) : id.slice(0, id.indexOf('-'));
}

async function guideOf(course: string): Promise<Guide> {
  const mod = (await import(pathToFileURL(join(COURSES, course, 'guide.ts')).href)) as Record<string, unknown>;
  const found = Object.entries(mod).find(([name]) => name.endsWith('_GUIDE'));
  if (!found) throw new Error(`${course}/guide.ts exports no guide`);
  return found[1] as Guide;
}

/**
 * Every asset the repository is supposed to have, with what it is made of.
 *
 * The numbering is `lessonAssets`, which is where the rule about units with no
 * cards is written down and tested. This part is the walk: which courses there
 * are, and which scripts.
 */
export async function wanted(only: string | null = null): Promise<Asset[]> {
  const out: Asset[] = [];

  for (const course of readdirSync(COURSES).sort()) {
    if (only && course !== only) continue;
    if (!existsSync(join(COURSES, course, 'guide.ts'))) continue;
    const guide = await guideOf(course);
    out.push(...lessonAssets(course, guide.code, guide.units));
  }

  for (const name of readdirSync(SCRIPTS).sort()) {
    if (!isEpisodeScript(name)) continue;
    const ep = JSON.parse(readFileSync(join(SCRIPTS, name), 'utf8')) as Episode;
    if (only && ep.course !== only) continue;
    out.push({
      id: ep.id,
      course: ep.course,
      kind: 'episode',
      material: [
        ...Object.entries(ep.voices).sort().flat(),
        ...ep.lines.flatMap((l) => [l.v, l.t, l.chapter ?? '', String(l.pause ?? 0)]),
      ],
      file: `app/public/audio/${ep.id}.mp3`,
    });
  }

  return out;
}

/**
 * How long the file already on disk is, from the metadata its renderer wrote.
 *
 * Not from the MP3 itself: reading a duration out of one means a decoder, and
 * both renderers already wrote the figure down beside it. `null` where there is
 * no metadata, which is the honest answer and stops an adopted row claiming a
 * length nobody measured.
 */
function secondsOf(asset: Asset): number | null {
  if (asset.kind === 'lesson') {
    const meta = join(ROOT, 'app', 'public', 'audio', 'lessons', asset.course, 'lessons.json');
    if (!existsSync(meta)) return null;
    const unit = asset.id.slice(asset.id.lastIndexOf('-') + 1);
    const rows = JSON.parse(readFileSync(meta, 'utf8')) as Record<string, { seconds?: number }>;
    return rows[unit]?.seconds ?? null;
  }
  const name = readdirSync(SCRIPTS).find(
    (f) => f.endsWith('.chapters.json') && JSON.parse(readFileSync(join(SCRIPTS, f), 'utf8')).id === asset.id,
  );
  if (!name) return null;
  return (JSON.parse(readFileSync(join(SCRIPTS, name), 'utf8')) as { seconds?: number }).seconds ?? null;
}

function bytesOf(asset: Asset): number {
  const path = join(ROOT, asset.file);
  return existsSync(path) ? statSync(path).size : 0;
}

/** The command that makes this asset, and the directory it runs from. */
function command(asset: Asset): string[] {
  if (asset.kind === 'lesson') {
    return ['python3', 'pipeline/lessons.py', asset.course, '--unit', asset.id.slice(asset.id.lastIndexOf('-') + 1)];
  }
  const name = readdirSync(SCRIPTS).find(
    (f) => isEpisodeScript(f) && JSON.parse(readFileSync(join(SCRIPTS, f), 'utf8')).id === asset.id,
  );
  if (!name) throw new Error(`no script for ${asset.id}`);
  return ['python3', 'audio/synth.py', `audio/scripts/${name}`, 'app/public/audio'];
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST)) return EMPTY;
  const read = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Partial<Manifest>;
  return { recipes: read.recipes ?? {}, made: read.made ?? {} };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const adopt = args.includes('--adopt');
  const only = args.find((a) => !a.startsWith('--')) ?? null;

  const recipes: Record<string, string> = {};
  for (const [kind, sources] of Object.entries(RENDERER)) {
    recipes[kind] = recipeOf(sources.map((s) => readFileSync(join(ROOT, s), 'utf8')));
  }

  const assets = await wanted(only);
  const manifest = readManifest();
  // A run over one course must not sweep the other three off the manifest.
  const cut = plan(assets, manifest, recipes);
  const sweep = only ? [] : cut.sweep;

  console.log(`${assets.length} assets · ${cut.reuse.length} current · ${cut.render.length} stale`);
  const loose = orphans(readdirSync(join(ROOT, 'app', 'public', 'audio')), assets);
  if (!only && loose.length > 0) {
    console.log(`  ${loose.length} episodes here have no script in this repository and cannot be rebuilt: ${loose.join(', ')}`);
  }
  for (const kind of cut.recipeChanged) {
    console.log(`  ${kind}: the renderer changed, so every ${kind} is stale`);
  }
  for (const id of sweep) console.log(`  sweep ${id} — nothing asks for it any more`);

  const could = saved(cut, manifest);
  if (could.known > 0) {
    console.log(
      `  not re-rendering ${could.of} · ${saidMs(could.ms)} measured across the ${could.known} of them this repository has ever timed`,
    );
  } else if (cut.reuse.length > 0) {
    console.log(`  not re-rendering ${cut.reuse.length} · none of them has ever been timed here, so there is no figure to give`);
  }

  if (dry) {
    for (const asset of cut.render) console.log(`  would render ${asset.id}`);
    return 0;
  }

  const made: Record<string, Made> = {};
  for (const asset of cut.render) {
    const key = keyOf(recipes[asset.kind], asset.material);

    if (adopt) {
      // Adoption is for what is already right: forty-eight files a person
      // rendered before this job existed. A missing file is not adopted —
      // recording a row for audio that is not there would make the first real
      // run skip the one asset it has to build.
      if (!existsSync(join(ROOT, asset.file))) {
        console.log(`  ${asset.id} — no file to adopt`);
        continue;
      }
      made[asset.id] = { key, at: Date.now(), ms: 0, seconds: secondsOf(asset) ?? 0, bytes: bytesOf(asset) };
      continue;
    }

    const [cmd, ...rest] = command(asset);
    process.stdout.write(`  ${asset.id} … `);
    const began = Date.now();
    execFileSync(cmd, rest, { cwd: ROOT, stdio: 'ignore' });
    const ms = Date.now() - began;
    made[asset.id] = { key, at: Date.now(), ms, seconds: secondsOf(asset) ?? 0, bytes: bytesOf(asset) };
    console.log(saidMs(ms));
  }

  writeFileSync(MANIFEST, `${JSON.stringify(after(manifest, recipes, made, sweep), null, 2)}\n`);

  const rows = perCourse(readManifest(), courseOf);
  console.log('\ncourse    assets  timed   measured      audio');
  for (const r of rows) {
    const audio = `${Math.round(r.seconds / 60)} min`;
    console.log(
      `${r.course.padEnd(9)} ${String(r.assets).padStart(5)} ${String(r.timed).padStart(6)}  ${(r.timed ? saidMs(r.ms) : '—').padStart(10)} ${audio.padStart(10)}`,
    );
  }
  console.log(`\n${MANIFEST}`);
  return 0;
}

/*
 * Only when run, never when imported.
 *
 * `src/lib/audiobatch.test.ts` asks this file what the repository is supposed
 * to hold and checks it against what is on disk. Without this line that import
 * would start rendering audio inside the test suite.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
