/**
 * The shot list for a course's documentary cut.
 *
 *     node pipeline/broll-shots.mjs econ --draft      # write the empty list
 *     node pipeline/broll-shots.mjs econ             # check it
 *     node pipeline/broll-shots.mjs econ --price 10 --max-spend 5.00
 *     node pipeline/broll-shots.mjs --all
 *
 * A shot list lives at `video/shots/<course>.json` and is edited by hand:
 * `--draft` writes one shot per chapter with the subject blank, and nothing
 * here will price or buy a list that still has blanks in it. `broll.mjs` has
 * the argument — the short version is that the prompt used to be the chapter's
 * own name, and "Optimisation and opportunity cost" is not a thing a camera
 * can point at.
 *
 * Buying is still not wired. `--price` is a per-second rate *you* read off a
 * provider's pricing page today, because a number committed here would be
 * quoted in a `--dry-run` next year as though it were measured.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dollars, estimate, EMPTY, unspent } from '../video/src/clipspend.ts';
import { checkAll, draftShots, shotJobs, shotPrompt, SHOT_SECONDS, withinCeiling } from './broll.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'audio/scripts');
const SHOTS = join(ROOT, 'video/shots');

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const draft = argv.includes('--draft');
const dry = argv.includes('--dry-run');
const price = flag('price') === undefined ? undefined : Number(flag('price'));
const ceiling = flag('max-spend') === undefined ? undefined : Math.round(Number(flag('max-spend')) * 100);
const seconds = flag('seconds') === undefined ? SHOT_SECONDS : Number(flag('seconds'));

const episodes = readdirSync(SCRIPTS)
  .filter((f) => f.endsWith('.chapters.json'))
  .map((f) => JSON.parse(readFileSync(join(SCRIPTS, f), 'utf8')));

const wanted = argv.filter((a) => !a.startsWith('--') && a !== flag('price') && a !== flag('max-spend') && a !== flag('seconds'));
const chosen = argv.includes('--all') ? episodes : episodes.filter((e) => wanted.includes(e.course));
if (chosen.length === 0) {
  console.error(
    `Name a course, or --all.\n\ncourses: ${episodes.map((e) => e.course).join(', ')}\n\n` +
      'node pipeline/broll-shots.mjs <course…> | --all [--draft] [--seconds N]\n' +
      '                                       [--price <cents/s>] [--max-spend <dollars>] [--dry-run]',
  );
  process.exit(1);
}

let blocked = 0;
for (const episode of chosen) {
  const path = join(SHOTS, `${episode.course}.json`);
  const short = path.replace(`${ROOT}/`, '');

  if (draft) {
    if (existsSync(path) && !argv.includes('--force')) {
      console.error(`${episode.course}: ${short} already exists — --force to overwrite it`);
      blocked += 1;
      continue;
    }
    mkdirSync(SHOTS, { recursive: true });
    const body = {
      course: episode.course,
      id: episode.id,
      /*
       * The chapter names are copied in beside each shot so that whoever fills
       * this in can see which passage they are writing for without opening a
       * second file. They are not the prompt — `broll.mjs` refuses a subject
       * that is one.
       */
      shots: draftShots(episode, seconds),
    };
    writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
    console.log(`${episode.course}: → ${short}  (${body.shots.length} shots, every subject blank)`);
    continue;
  }

  if (!existsSync(path)) {
    console.error(`${episode.course}: no shot list at ${short} — run with --draft first`);
    blocked += 1;
    continue;
  }
  const list = JSON.parse(readFileSync(path, 'utf8'));
  const problems = checkAll(list.shots);
  const blanks = problems.filter((p) => p.why.startsWith('no subject yet')).length;

  console.log(
    `${episode.course}: ${list.shots.length} shots over ${episode.len}` +
      (blanks ? `, ${blanks} still blank` : ', all written'),
  );
  if (problems.length) {
    for (const p of problems) console.error(`  ${p.slot}: ${p.why}`);
    console.error(
      `\n${episode.course}: ${problems.length} problem(s). Edit ${short} and run this again.\n` +
        'Nothing is priced and nothing is bought while a shot list has problems in it.',
    );
    blocked += 1;
    continue;
  }

  if (dry) for (const shot of list.shots) console.log(`  ${shot.slot}: ${shotPrompt(shot)}`);

  /*
   * ── the money ────────────────────────────────────────────────────────────
   *
   * Three guardrails, and they stop three different things. The manifest stops
   * a second run paying for the first run's clips. The rate has to be supplied
   * because a committed price goes stale into a number that looks measured.
   * And the ceiling stops a run that is correctly priced, correctly
   * deduplicated, and far larger than anybody meant — which is what an edited
   * shot list makes possible for the first time.
   */
  const manifestPath = join(ROOT, 'app/public/audio/documentary', episode.course, 'clipspend.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : EMPTY;
  const jobs = shotJobs(list.shots, flag('provider', '(unset)'), '(unset)');
  const todo = unspent(manifest, jobs);
  console.log(
    `  ${todo.length} of ${jobs.length} not already bought` +
      (jobs.length - todo.length ? ` (${jobs.length - todo.length} in ${manifestPath.replace(`${ROOT}/`, '')})` : ''),
  );

  if (price === undefined) {
    console.log('  no --price given, so nothing is costed. Read the provider\'s current rate.');
    continue;
  }
  if (!Number.isFinite(price) || price < 0) {
    console.error('  --price wants cents per second of generated video.');
    blocked += 1;
    continue;
  }
  const cost = estimate(todo, { centsPerSecond: price });
  console.log(`  ${cost.seconds}s at ${price}c/s = ${dollars(cost.cents)}` + (cost.unpriced ? ` (${cost.unpriced} unpriced)` : ''));

  if (ceiling === undefined) {
    console.error(
      '\n  No --max-spend. A run with a rate and no ceiling is a run whose cost is\n' +
        `  whatever the shot list happens to say — pass --max-spend ${(cost.cents / 100).toFixed(2)} to allow this one.`,
    );
    blocked += 1;
    continue;
  }
  const room = withinCeiling(cost.cents, ceiling);
  if (!room.ok) {
    console.error(`\n  Refused: ${room.why}. Raise --max-spend on purpose, or cut the list.`);
    blocked += 1;
    continue;
  }
  console.log(`  within the ${dollars(ceiling)} ceiling, with ${dollars(ceiling - cost.cents)} to spare`);
  console.error(
    '\n  Buying is not wired to a provider. Everything above is what a run would\n' +
      '  ask for and what it would cost; choosing who to ask is a spending decision.',
  );
  blocked += 1;
}

process.exit(blocked ? 1 : 0);
