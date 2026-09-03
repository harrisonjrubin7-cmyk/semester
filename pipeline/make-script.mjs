#!/usr/bin/env node
/**
 * Draft a two-voice podcast script from a course's guide.
 *
 *     node pipeline/make-script.mjs econ > audio/scripts/econ1020.draft.json
 *
 * The four hand-written scripts took real authoring effort, and that effort is
 * where the quality is. This gets a new course to a listenable draft in one
 * command by walking its units and turning each card into a question the host
 * asks and an answer the expert gives — which is the shape the hand-written
 * ones already have, because that is how the guides are written.
 *
 * Treat the output as a draft. It will be correct and a little mechanical; the
 * openings, the transitions between units and the closing are the parts worth
 * rewriting by hand. Then:
 *
 *     python3 audio/synth.py audio/scripts/<name>.json app/public/audio
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];

if (!id) {
  console.error('Usage: node pipeline/make-script.mjs <course-id>');
  process.exit(1);
}

const guidePath = join(ROOT, `app/src/data/courses/${id}/guide.ts`);
if (!existsSync(guidePath)) {
  console.error(`No guide at ${guidePath}`);
  process.exit(1);
}

const src = readFileSync(guidePath, 'utf8');

/**
 * Pull the guide's content out of the TypeScript source.
 *
 * Reading the source rather than importing it keeps this dependency-free — no
 * ts-node, no build step — at the cost of being sensitive to formatting. The
 * repo is Prettier-formatted, so the shapes are stable.
 */
function grab(re, text = src) {
  return [...text.matchAll(re)].map((m) => m.slice(1));
}

const codeMatch = src.match(/code: '([^']+)'/);
const nameMatch = src.match(/name: '([^']+)',\n {2}blurb/);
const code = codeMatch ? codeMatch[1] : id.toUpperCase();
const courseName = nameMatch ? nameMatch[1] : '';

// Units and their cards, in order.
const unitBlocks = src.split(/\n {4}\{\n {6}name: '/).slice(1);
const units = unitBlocks.map((block) => {
  const name = block.slice(0, block.indexOf("'"));
  const cards = grab(
    /\{\n\s*q: '((?:[^'\\]|\\.)*)',\n\s*a: '((?:[^'\\]|\\.)*)',\n\s*\}/g,
    block,
  ).map(([q, a]) => ({ q: unescape(q), a: unescape(a) }));
  return { name, cards };
});

const selfTestStart = src.indexOf('selfTest: [');
const selfTest =
  selfTestStart === -1
    ? []
    : grab(
        /\{\n\s*q: '((?:[^'\\]|\\.)*)',\n\s*a:\n?\s*'((?:[^'\\]|\\.)*)',\n\s*\}/g,
        src.slice(selfTestStart),
      ).map(([q, a]) => ({ q: unescape(q), a: unescape(a) }));

function unescape(s) {
  return s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

/**
 * Speech, not prose.
 *
 * A synthesiser reads "%" and "|E|" badly or not at all, and a listener cannot
 * see a formula. The hand-written scripts spell everything out; this does the
 * mechanical part of that so the draft is at least speakable.
 */
function speakable(text) {
  return text
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/\|ε\||\|E\|/g, 'the absolute value of elasticity')
    .replace(/≈/g, ' about ')
    .replace(/≠/g, ' is not equal to ')
    .replace(/≥/g, ' at least ')
    .replace(/≤/g, ' at most ')
    .replace(/>/g, ' greater than ')
    .replace(/</g, ' less than ')
    .replace(/→/g, ' then ')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/±/g, ' plus or minus ')
    .replace(/√/g, ' the square root of ')
    .replace(/²/g, ' squared')
    .replace(/\br²/g, 'r squared')
    .replace(/\$([\d,.]+)/g, '$1 dollars')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const lines = [];
const say = (v, t, extra = {}) => lines.push({ v, t: speakable(t), ...extra });

// ── open ──────────────────────────────────────────────────────────────────
lines.push({
  chapter: 'Cold open',
  v: 'host',
  t: speakable(
    `${code}${courseName ? `, ${courseName}` : ''}. ${units.length} units, and we are going through all of them.`,
  ),
});
say('expert', 'TODO — rewrite this opening by hand. Say what the course is really about in one sentence, and what decides the grade.');
say('host', 'We finish with a self-test, so keep something to write on.');

// ── one chapter per unit ──────────────────────────────────────────────────
for (const unit of units) {
  if (unit.cards.length === 0) continue;
  const title = unit.name.replace(/^\d+(\/\d+)?\s*·\s*/, '');
  lines.push({ chapter: title, v: 'host', t: speakable(`Next. ${title}.`) });

  unit.cards.forEach((card, i) => {
    // Vary the framing so a long stretch does not read as a list.
    const lead =
      i === 0 ? '' : i % 3 === 0 ? 'Next one. ' : i % 3 === 1 ? 'And this. ' : '';
    say('host', `${lead}${card.q}`);
    say('expert', card.a);
  });
}

// ── self-test ─────────────────────────────────────────────────────────────
if (selfTest.length) {
  lines.push({
    chapter: 'Self-test',
    v: 'host',
    t: speakable(
      `Self-test. ${selfTest.length} questions. Answer out loud, then listen for the answer.`,
    ),
  });
  selfTest.forEach((card, i) => {
    say('host', `${i + 1}. ${card.q}`, { pause: 7 });
    say('expert', card.a);
  });
}

lines.push({ chapter: 'Close', v: 'host', t: 'TODO — rewrite the closing.' });
say('expert', 'TODO — one last thing worth remembering.');

const script = {
  id: `${id}-podcast`,
  course: id,
  title: `${code} — TODO give this a title`,
  voices: { host: 'en-us-lessac-medium', expert: 'en-us-ryan-high' },
  lines,
};

process.stdout.write(`${JSON.stringify(script, null, 2)}\n`);

const words = lines.reduce((n, l) => n + l.t.split(/\s+/).length, 0);
console.error(
  `${id}: ${units.length} units, ${lines.length} lines, ~${words} words ` +
    `(roughly ${Math.round(words / 150)} minutes spoken).\n` +
    'Rewrite the TODO lines and the unit transitions before rendering.',
);
