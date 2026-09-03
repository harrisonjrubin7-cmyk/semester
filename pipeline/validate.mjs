#!/usr/bin/env node
/**
 * Check every course module for the mistakes that are easy to make and hard to
 * see. Run it after adding or editing a course:
 *
 *     node pipeline/validate.mjs
 *
 * Every check here exists because the problem actually happened while building
 * the first four courses, or is one line away from happening:
 *
 *   - Figures are keyed by unit index. Insert a unit at the top of a guide and
 *     every figure silently attaches to the wrong one. This was a real bug.
 *   - Chapter marks past the end of the audio seek nowhere.
 *   - Two items sharing an id means one of them is unreachable.
 *   - An audio file named in the data but missing from public/audio is a dead
 *     player with no error.
 *   - A month index off by one puts a September deadline in October.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COURSES_DIR = join(ROOT, 'app/src/data/courses');
const AUDIO_DIR = join(ROOT, 'app/public/audio');
const CATALOG = join(ROOT, 'app/src/data/catalog.ts');

const problems = [];
const warnings = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);

/**
 * These modules are TypeScript, so rather than compiling them we read the
 * source and pull out the specific shapes we care about. It is deliberately
 * shallow — the typechecker already proves the structure, and this is checking
 * the things types cannot express.
 */
function read(path) {
  return readFileSync(path, 'utf8');
}

const courseDirs = readdirSync(COURSES_DIR).filter((d) =>
  statSync(join(COURSES_DIR, d)).isDirectory(),
);

if (courseDirs.length === 0) fail('No courses found under app/src/data/courses.');

const catalog = read(CATALOG);
const seenItemIds = new Map();
const seenEpisodeIds = new Map();

for (const id of courseDirs) {
  const indexPath = join(COURSES_DIR, id, 'index.ts');
  const guidePath = join(COURSES_DIR, id, 'guide.ts');

  if (!existsSync(indexPath)) {
    fail(`${id}: no index.ts — a course folder must export a CourseModule.`);
    continue;
  }
  if (!existsSync(guidePath)) {
    warn(`${id}: no guide.ts — the course will have no study guide.`);
  }

  const src = read(indexPath);
  const guide = existsSync(guidePath) ? read(guidePath) : '';

  // ── registered in the catalog ───────────────────────────────────────────
  if (!new RegExp(`from './courses/${id}'`).test(catalog)) {
    fail(`${id}: not imported in data/catalog.ts — the app will not see it.`);
  } else if (!new RegExp(`CATALOG[^=]*=\\s*\\[[^\\]]*\\b${id}\\b`, 's').test(catalog)) {
    fail(`${id}: imported but missing from the CATALOG array.`);
  }

  // ── figure keys against unit count ──────────────────────────────────────
  const unitNames = [...guide.matchAll(/^\s{4,6}name: '(.+?)',$/gm)].map((m) => m[1]);
  const unitCount = unitNames.length;

  const figuresBlock = src.match(/figures:\s*\{([\s\S]*?)\n {2}\},/);
  if (figuresBlock) {
    const keys = [...figuresBlock[1].matchAll(/^\s{4}(\d+):/gm)].map((m) => Number(m[1]));
    for (const k of keys) {
      if (unitCount && k >= unitCount) {
        fail(
          `${id}: figure keyed to unit ${k}, but the guide has ${unitCount} units ` +
            `(0–${unitCount - 1}). It will render with no unit caption.`,
        );
      }
    }
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length) fail(`${id}: duplicate figure keys ${[...new Set(dupes)].join(', ')}.`);
  }

  // ── item ids unique, months in range ────────────────────────────────────
  for (const m of src.matchAll(/id: '([^']+)',\s*\n\s*c: '([^']+)'/g)) {
    const [, itemId, courseRef] = m;
    if (courseRef !== id) {
      fail(`${id}: item "${itemId}" has c: '${courseRef}' — it should be '${id}'.`);
    }
    if (seenItemIds.has(itemId)) {
      fail(`Duplicate item id "${itemId}" in ${id} and ${seenItemIds.get(itemId)}.`);
    }
    seenItemIds.set(itemId, id);
  }

  for (const m of src.matchAll(/month: (\d+),\s*\n\s*day: (\d+),/g)) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 0 || month > 11) {
      fail(`${id}: month ${month} is out of range — months are 0-based, so August is 7.`);
    }
    if (day < 1 || day > 31) fail(`${id}: day ${day} is out of range.`);
  }

  // ── audio files exist, chapters fit inside them ─────────────────────────
  for (const ep of src.matchAll(
    /id: '([^']+)',\s*\n\s*label: '[^']*',\s*\n\s*file: '([^']*)',\s*\n\s*len: '([^']*)',\s*\n\s*seconds: (\d+)/g,
  )) {
    const [, episodeId, file, , seconds] = ep;
    if (seenEpisodeIds.has(episodeId)) {
      fail(`Duplicate episode id "${episodeId}" in ${id} and ${seenEpisodeIds.get(episodeId)}.`);
    }
    seenEpisodeIds.set(episodeId, id);

    if (file) {
      const onDisk = join(AUDIO_DIR, file.replace(/^\/audio\//, ''));
      if (!existsSync(onDisk)) {
        fail(`${id}: episode "${episodeId}" names ${file}, which is not in app/public/audio.`);
      }
    }
  }

  // Chapter seconds must be inside the episode they belong to.
  const episodes = src.split(/\n\s*\{\s*\n\s*id: '/).slice(1);
  for (const block of episodes) {
    const secondsMatch = block.match(/seconds: (\d+)/);
    if (!secondsMatch) continue;
    const total = Number(secondsMatch[1]);
    const marks = [...block.matchAll(/\{ t: '[^']*', s: (\d+),/g)].map((m) => Number(m[1]));
    const over = marks.filter((s) => s > total);
    if (over.length) {
      fail(
        `${id}: ${over.length} chapter mark(s) past the end of a ${total}s episode ` +
          `(${over.slice(0, 3).join(', ')}). Those seeks go nowhere.`,
      );
    }
    for (let i = 1; i < marks.length; i++) {
      if (marks[i] < marks[i - 1]) {
        warn(`${id}: chapter marks are not in order around ${marks[i]}s.`);
        break;
      }
    }
  }

  // ── lessons: files on disk, cues inside the audio, units that exist ─────
  const lessonPath = join(COURSES_DIR, id, 'lessons.ts');
  if (existsSync(lessonPath)) {
    const lessons = read(lessonPath);
    let lessonCount = 0;
    for (const block of lessons.split(/\n {2}"\d+": \{/).slice(1)) {
      lessonCount += 1;
      const unit = Number(block.match(/"unit": (\d+)/)?.[1] ?? -1);
      const file = block.match(/"file": "([^"]+)"/)?.[1] ?? '';
      const seconds = Number(block.match(/"seconds": (\d+)/)?.[1] ?? 0);
      const cues = [...block.matchAll(/"at": ([\d.]+)/g)].map((m) => Number(m[1]));

      if (unitCount && unit >= unitCount) {
        fail(`${id}: lesson for unit ${unit}, but the guide has ${unitCount} units.`);
      }
      if (file && !existsSync(join(ROOT, 'app/public', file))) {
        fail(`${id}: lesson ${unit} names ${file}, which is not on disk. The player loads nothing.`);
      }
      // A cue past the end never fires, so the slide it carries is never seen.
      const late = cues.filter((c) => c > seconds + 1);
      if (late.length) {
        fail(`${id}: lesson ${unit} has ${late.length} cue(s) past its ${seconds}s of audio.`);
      }
    }
    if (lessonCount && unitCount && lessonCount < unitCount) {
      warn(`${id}: ${lessonCount} lessons for ${unitCount} units — the rest show as not recorded.`);
    }
  }

  // ── the documents the Doc and Slides modes link to ──────────────────────
  for (const [dir, ext] of [
    ['handouts', 'pdf'],
    ['handouts', 'docx'],
    ['decks', 'pptx'],
  ]) {
    if (!existsSync(join(ROOT, 'app/public', dir, `${id}.${ext}`))) {
      warn(
        `${id}: no ${dir}/${id}.${ext} — the link in the app 404s. ` +
          `Run pipeline/${dir === 'decks' ? 'slides' : 'handout'}.py ${id}.`,
      );
    }
  }

  // ── mastery is a percentage ─────────────────────────────────────────────
  for (const m of guide.matchAll(/mastery: (\d+)/g)) {
    const v = Number(m[1]);
    if (v < 0 || v > 100) fail(`${id}: mastery ${v} is not a percentage.`);
  }

  // ── a guide with no cards is a dead study tab ───────────────────────────
  const cardCount = (guide.match(/^\s*\{ q: |^\s*\{\s*$\n\s*q: /gm) || []).length;
  if (existsSync(guidePath) && unitCount === 0) {
    fail(`${id}: guide has no units.`);
  }

  console.log(
    `${id.padEnd(6)} ${String(unitCount).padStart(2)} units  ` +
      `${String(seenItemIds.size).padStart(2)} items so far  ` +
      `${figuresBlock ? [...figuresBlock[1].matchAll(/^\s{4}\d+:/gm)].length : 0} figures`,
  );
}

// ── report ────────────────────────────────────────────────────────────────

console.log('');
for (const w of warnings) console.log(`warn  ${w}`);
for (const p of problems) console.log(`FAIL  ${p}`);

if (problems.length === 0) {
  console.log(
    `\n${courseDirs.length} courses, ${seenItemIds.size} items, ` +
      `${seenEpisodeIds.size} episodes — all checks passed.`,
  );
  process.exit(0);
}
console.log(`\n${problems.length} problem(s).`);
process.exit(1);
