#!/usr/bin/env node
/**
 * Scaffold a course and register it.
 *
 *     node pipeline/new-course.mjs --id hist --code "HIST 1620" \
 *       --name "The Cold War" --prof "Dr. A. Reed" --email a.reed@vanderbilt.edu \
 *       --meets "MW · 10:10–11:25a" --room "Buttrick 205" --credits "3 credits" \
 *       --source "HIST1620_Fall26.pdf" --days MW --at 10:10
 *
 * Writes app/src/data/courses/<id>/{index.ts,guide.ts} and adds the import and
 * the CATALOG entry in app/src/data/catalog.ts. The result compiles and shows up
 * in the app immediately, carrying TODO markers where the content goes.
 *
 * This does the mechanical half. The content half — reading the syllabus and
 * writing the guide — is what the add-course skill describes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COURSES = join(ROOT, 'app/src/data/courses');
const CATALOG = join(ROOT, 'app/src/data/catalog.ts');

// ── arguments ─────────────────────────────────────────────────────────────

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  args[key] = process.argv[i + 1];
}

const required = ['id', 'code', 'name'];
const missing = required.filter((k) => !args[k]);
if (missing.length) {
  console.error(`Missing required argument(s): ${missing.map((m) => `--${m}`).join(', ')}`);
  console.error('\nRun with at least:');
  console.error('  node pipeline/new-course.mjs --id hist --code "HIST 1620" --name "The Cold War"');
  process.exit(1);
}

const id = args.id.toLowerCase();
if (!/^[a-z][a-z0-9]*$/.test(id)) {
  console.error(`--id must be a lowercase slug like "hist". Got "${args.id}".`);
  process.exit(1);
}

const dir = join(COURSES, id);
if (existsSync(dir)) {
  console.error(`app/src/data/courses/${id} already exists. Use a different --id, or edit it.`);
  process.exit(1);
}

// "MWF" / "TR" / "MW" → the day numbers the schedule wants.
const DAY_LETTERS = { U: 0, M: 1, T: 2, W: 3, R: 4, F: 5, S: 6 };
const days = (args.days ?? 'MW')
  .toUpperCase()
  .split('')
  .map((c) => DAY_LETTERS[c])
  .filter((d) => d !== undefined);

// "10:10" or "14:45" → minutes past midnight, and the app's clock format.
function parseTime(value) {
  const [h, m] = (value ?? '09:00').split(':').map(Number);
  const at = (h || 9) * 60 + (m || 0);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { at, time: `${hour}:${String(m || 0).padStart(2, '0')}${h < 12 ? 'a' : 'p'}` };
}
const { at, time } = parseTime(args.at);

const GUIDE_CONST = `${id.toUpperCase()}_GUIDE`;

// ── guide.ts ──────────────────────────────────────────────────────────────

const guide = `import type { Guide } from '../../../lib/types';

/**
 * TODO — replace this scaffold with the real guide.
 *
 * Every unit below should come from the syllabus and the assigned readings. A
 * card is a question you could be asked and the answer in full prose, with the
 * numbers in it — not a hint. See app/src/data/courses/psci/guide.ts for the
 * shape at full size.
 */
export const ${GUIDE_CONST}: Guide = {
  code: ${JSON.stringify(args.code)},
  name: ${JSON.stringify(args.name)},
  blurb: 'TODO — one line on what this guide covers.',
  source: ${JSON.stringify(args.source ?? 'TODO — the document this was built from')},
  mastery: 0,
  audio: false,
  units: [
    {
      name: '1 · TODO first unit',
      mastery: 0,
      cards: [
        {
          q: 'TODO — a question the exam could actually ask.',
          a: 'TODO — the full answer, with the numbers and names in it.',
        },
      ],
    },
  ],
  frames: [
    {
      t: 'TODO — a recurring exam frame',
      d: 'TODO — how to answer that kind of question.',
    },
  ],
  terms: [{ t: 'TODO — a term', d: 'TODO — its one-line definition.' }],
};
`;

// ── index.ts ──────────────────────────────────────────────────────────────

const index = `import type { CourseModule } from '../../../lib/types';
import { ${GUIDE_CONST} } from './guide';

/**
 * ${args.code} · ${args.name}
 *
 * TODO — note here which documents this was built from, and flag anything that
 * was inferred rather than stated, so a later reader can tell them apart.
 */
const ${id}: CourseModule = {
  course: {
    id: '${id}',
    code: ${JSON.stringify(args.code)},
    name: ${JSON.stringify(args.name)},
    prof: ${JSON.stringify(args.prof ?? 'TODO')},
    email: ${JSON.stringify(args.email ?? 'TODO')},
    meets: ${JSON.stringify(args.meets ?? 'TODO')},
    room: ${JSON.stringify(args.room ?? 'TODO')},
    credits: ${JSON.stringify(args.credits ?? '3 credits')},
    source: ${JSON.stringify(args.source ?? 'TODO')},
    grading: [
      // TODO — every graded component, straight from the syllabus.
      { what: 'TODO', pct: '0%' },
    ],
  },

  schedule: [
    {
      days: ${JSON.stringify(days)},
      at: ${at},
      time: '${time}',
      title: ${JSON.stringify(args.code)},
      meta: ${JSON.stringify(`${args.room ?? 'TODO'} · ${args.prof ?? 'TODO'}`)},
    },
  ],

  items: [
    // TODO — every dated obligation. Months are 0-based: August is 7,
    // September 8, October 9, November 10, December 11.
    {
      id: '${id}-todo1',
      c: '${id}',
      title: 'TODO — first deadline',
      kind: 'Assignment',
      month: 8,
      day: 1,
      dueTime: '11:59 PM',
      weight: 'TODO',
      where: 'Brightspace',
      detail: 'TODO — what it actually asks for.',
      quote: 'TODO — the syllabus line this came from, verbatim.',
      source: ${JSON.stringify(args.source ?? 'TODO')},
    },
  ],

  guide: ${GUIDE_CONST},

  // Figures are keyed by UNIT INDEX. If you insert a unit at the top of the
  // guide, every key below shifts — run \`node pipeline/validate.mjs\` after.
  figures: {},

  examples: [
    // TODO — the concepts pointed at things you can actually see.
  ],

  planMinutes: '5 min',
  frameLabel: 'TODO — what this guide calls its exam frames',
};

export default ${id};
`;

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'guide.ts'), guide);
writeFileSync(join(dir, 'index.ts'), index);

// ── register in the catalog ───────────────────────────────────────────────

let catalog = readFileSync(CATALOG, 'utf8');

if (!catalog.includes(`from './courses/${id}'`)) {
  catalog = catalog.replace(
    /(import \w+ from '\.\/courses\/\w+';\n)(?!import)/,
    `$1import ${id} from './courses/${id}';\n`,
  );
}
catalog = catalog.replace(
  /(export const CATALOG: CourseModule\[\] = \[)([^\]]*)\]/,
  (_m, head, body) => `${head}${body.trim().replace(/,$/, '')}, ${id}]`,
);
writeFileSync(CATALOG, catalog);

console.log(`Created app/src/data/courses/${id}/`);
console.log('  guide.ts   the study guide — replace the TODO unit');
console.log('  index.ts   meta, schedule, deadlines, figures');
console.log(`Registered "${id}" in app/src/data/catalog.ts`);
console.log('\nNext:');
console.log('  1. python3 pipeline/ingest.py <syllabus.pdf> -o /tmp/syllabus.txt');
console.log('  2. Fill in the TODOs from it.');
console.log('  3. node pipeline/validate.mjs');
console.log('  4. cd app && npx tsc -b --noEmit && npm run dev');
