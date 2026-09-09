import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DESTINATIONS } from './nav';
import { DEFAULT_TABS } from './tabbar';
import { modesFor } from './modes';
import { buildCatalog } from '../data/catalog';
import type { CourseModule, Guide } from './types';

/**
 * The numbers the README states about itself, read from the lists they count.
 *
 * The README says how many screens the app has, how many tabs the bar opens
 * with, how many ways there are to read a guide, and how much audio ships.
 * Every one of those is a fact about a registry sitting somewhere else in this
 * repo, and every one of them had drifted at least once — "five sections,
 * twenty screens" written when there were twenty, "nine modes" over a list of
 * ten, "five recordings" over two bullets that already said four and four.
 *
 * ## Written by a script, not by hand
 *
 * The screen count is why this file exists rather than a test on its own.
 * `DESTINATIONS` went from forty-nine to fifty and back inside twenty
 * minutes — two pull requests open at once, touching different files, neither
 * conflicting, one adding a screen and the other merging two away. Three
 * branches wrote a correction; two of them were wrong by the time they landed,
 * and main was red on a word either way.
 *
 * A test that only *checks* the number turns every one of those into a
 * failure somebody has to hand-fix, which is why the honest reading of that
 * fortnight was "stop stating the count". But the count is worth stating: it
 * is the first thing that tells a reader how big this app is. So the number
 * is generated — `npm run counts` writes it — and the test's job shrinks to
 * proving the script was run. Churn stops being a failure, and rot is still
 * caught.
 *
 * ## One implementation, two ways in
 *
 * The same rule as `styles/rules.ts`: `scripts/counts.mjs` writes from this
 * and `readme.test.ts` reads from it, so a count cannot pass the suite and be
 * wrong in the file, or the reverse. Adding a number to the README means
 * adding it here and marking where it goes — nowhere else.
 */

/** A number the README states, and where in it that number sits. */
export interface Count {
  /** Names the marker in the README: `<!--screens-->forty-nine<!--/-->`. */
  key: string;
  /** What the registries say right now. */
  n: number;
  /** The words the README should be carrying. */
  said: string;
  /** Where the number comes from, for a failure that explains itself. */
  from: string;
}

/**
 * The thinnest guide `modesFor` will read.
 *
 * Counting modes, not cards: one unit with one card is enough to make every
 * mode that exists offer itself, and a real guide would make this depend on
 * the term's course data.
 */
const GUIDE: Guide = {
  code: 'ECON 1020',
  name: '',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: [{ name: 'Unit 1', mastery: 0, cards: [{ q: 'q', a: 'a' }] }],
  terms: [],
};

const MODULE: CourseModule = {
  course: {
    id: 'econ',
    code: 'ECON 1020',
    name: '',
    prof: '',
    email: '',
    meets: '',
    room: '',
    credits: '',
    source: '',
    grading: [],
  },
  items: [],
  schedule: [],
  guide: GUIDE,
  planMinutes: '45 min',
  frameLabel: 'Frames',
};

/** How many `.mp3` files are directly in a directory. */
function recordings(dir: string): number {
  return readdirSync(dir).filter((f) => f.endsWith('.mp3')).length;
}

/**
 * Every count the README states, with what it should say.
 *
 * `root` is the app directory — the one holding the README and `public`. It is
 * a parameter rather than `process.cwd()` because the two callers run from
 * different places: vitest from `app/`, the script from wherever it was typed.
 */
export function counts(root: string): Count[] {
  const audio = join(root, 'public', 'audio');
  const lessons = join(audio, 'lessons');

  const perUnit = readdirSync(lessons, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .reduce((total, d) => total + recordings(join(lessons, d.name)), 0);

  const said = (key: string, n: number, from: string): Count => ({
    key,
    n,
    said: inWords(n),
    from,
  });

  return [
    said('screens', DESTINATIONS.length, 'lib/nav.ts'),
    said('tabs', DEFAULT_TABS.length, 'lib/tabbar.ts'),
    said('modes', modesFor(buildCatalog([MODULE]), 'econ', {
      guide: GUIDE,
      lessons: {},
      figures: {},
      extras: [],
    }).length, 'lib/modes.ts'),
    said('recordings', recordings(audio), 'public/audio'),
    said('lessons', perUnit, 'public/audio/lessons'),
  ];
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

/**
 * A count as the README writes it: a word, not a digit.
 *
 * Computed rather than looked up in a table. The table this replaced threw on
 * any number nobody had written down yet — so a registry passing fifty-one
 * failed the build with "add it to WORDS", which is the same maintenance
 * burden this whole file exists to remove, just moved one step back.
 *
 * Up to nine hundred and ninety-nine, which is two orders more than the
 * largest thing here counts and the point past which a README should be
 * saying "hundreds" anyway.
 */
export function inWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) {
    throw new Error(`inWords is for whole numbers from 0 to 999, not ${n}.`);
  }
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    // Hyphenated, which is how English writes them and how the README does.
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
  }
  const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
  const rest = n % 100;
  return rest === 0 ? hundreds : `${hundreds} and ${inWords(rest)}`;
}

/**
 * The marker a generated number sits in.
 *
 * An HTML comment on each side, so the README renders as prose — GitHub drops
 * comments — while the file itself says which numbers are written by hand and
 * which are not. Without them the script would be guessing at which word
 * before "screens" it was allowed to overwrite, and "the screens on it" three
 * sections down is the same shape as the one it wants.
 */
export function marker(key: string): RegExp {
  return new RegExp(`(<!--${key}-->)([^<]*)(<!--/-->)`);
}

/** The README with every generated number brought up to date. */
export function fill(readme: string, all: Count[]): { text: string; missing: string[] } {
  const missing: string[] = [];
  let text = readme;
  for (const count of all) {
    const at = marker(count.key);
    if (!at.test(text)) {
      missing.push(count.key);
      continue;
    }
    text = text.replace(at, (_whole, open: string, was: string, close: string) => {
      // A count can open a sentence, so the case that was there is kept: the
      // README should not have to be written wrong to be generated.
      const cased = /^[A-Z]/.test(was.trim())
        ? count.said.charAt(0).toUpperCase() + count.said.slice(1)
        : count.said;
      return `${open}${cased}${close}`;
    });
  }
  return { text, missing };
}

/**
 * The README as prose, for reading a claim back out of it.
 *
 * The markers go, because they are not something anybody reads; then it is
 * flattened onto one line, because these sentences wrap and "eleven\n modes"
 * is the same claim as "eleven modes" with only one of them greppable; then
 * lower-cased, because a count can start a sentence.
 */
export function prose(readme: string): string {
  return readme
    .replace(/<!--.*?-->/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
