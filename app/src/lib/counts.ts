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

/**
 * The files that state counts, and which counts each one states.
 *
 * There are two READMEs and only one of them was ever held to the registries.
 * `app/README.md` has carried markers since this file was written; the
 * repository's front page — the one a reader meets first — carried the same
 * kind of claim written by hand, and drifted exactly the way this mechanism
 * exists to stop: a heading saying six ways over eleven modes, a sentence
 * under it naming ten of them, and a table listing seven.
 *
 * So the generator is a list of files rather than one path. A file states the
 * counts it states — the front page says how many ways there are to read a
 * guide and nothing about tab bars — and the strictness is per file: every key
 * named here must have a marker in that file, and a key not named here is not
 * that file's business.
 *
 * Paths are from the repository root, because that is the only directory both
 * READMEs are under.
 */
export interface Stated {
  /** The file, from the repository root. */
  path: string;
  /** The `Count` keys this file is expected to carry a marker for. */
  keys: string[];
  /**
   * The noun each number sits beside, so a count cannot be filled into the
   * wrong sentence. Read back out of the prose by `readme.test.ts`.
   */
  nouns: Record<string, string>;
}

export const STATED: Stated[] = [
  {
    path: 'app/README.md',
    keys: ['screens', 'tabs', 'modes', 'recordings', 'lessons'],
    nouns: {
      screens: 'screens',
      tabs: 'tabs',
      modes: 'modes',
      recordings: 'recordings',
      lessons: 'narrated lessons',
    },
  },
  {
    path: 'README.md',
    keys: ['modes'],
    nouns: { modes: 'ways through the same material' },
  },
  /*
   * The audit opens every pass with a count of the app, and for six passes
   * nobody re-derived it. `134 components` was true once and was copied
   * forward while the tree went to 151; `79 screens` was never the count of
   * anything — not the files, not the `Screen` union, not the destinations.
   *
   * The mechanism to stop that was already in this file, written for the
   * README and for exactly this failure. The audit — the document arguing
   * that every job should have one home — was the one file stating counts
   * that had not been given one.
   *
   * ## Destinations, and not the file counts
   *
   * The first attempt at this row added `screenfiles` and `components` to
   * `counts` as well, and CI caught it inside a minute: main had gained one
   * component between `npm run counts` and the merge, so a generated number
   * committed minutes earlier was already a word out.
   *
   * Which is the fortnight described above, repeated. Generation stops a
   * number *rotting*; it does not stop it *churning*, because the test still
   * compares committed prose against the tree as it is at merge time. What
   * makes the five counts here survive that is not the generator — it is that
   * every one of them is a **decision**. Adding a destination, a tab, a mode
   * or a recording is a thing somebody chose to do, rarely, on purpose. A
   * component file appears in almost every pull request, as a side effect of
   * doing something else.
   *
   * So the honest reading of that fortnight applies unchanged to those two:
   * stop stating them. The audit states the count that means something and
   * that holds still — sixty destinations, unchanged across twelve passes —
   * and the file counts appear in the twelfth pass's table as what they
   * actually are, a measurement of named commits on a named day.
   */
  {
    path: 'SIMPLIFY-AUDIT.md',
    keys: ['screens'],
    nouns: { screens: 'destinations' },
  },
  /*
   * The completion plan states how many study modes there are, and its whole
   * argument is that a claim about this app should be a measurement of it. A
   * hand-written "eleven" in that file would be the one number in it nothing
   * checked — and the count it states is the count of the list its longest
   * section walks, so the two drifting apart is the failure that document
   * exists to stop.
   */
  /*
   * The checklist is the one place a stale count does damage rather than
   * embarrassment. `D3` reads "All N destinations still appear in the
   * launcher" and is meant to be *executed* — a tester who counts fifty-two
   * and finds fifty-eight has either found a bug or found a stale document,
   * and the whole value of a checklist is that they do not have to wonder
   * which. It said fifty-two, which the registry last was before six landed.
   */
  {
    path: 'REGRESSION-CHECKLIST.md',
    keys: ['screens'],
    nouns: { screens: 'destinations' },
  },
  {
    /*
     * `screens` beside `modes`, and the reason is this file's own argument
     * turned on itself.
     *
     * `COMPLETION-PLAN.md` has stated the destination count in three places —
     * a performance line reading "Measured today", a table row naming
     * `lib/nav.ts`, and a `grep -c` with its answer written in the comment
     * beside it. All three said sixty. The registry has said fifty-eight
     * since `80fbc5c`, which this same document explains at length four
     * hundred lines further down: *"Re-taken 18 September 2026 over all 58
     * destinations — 60 until `80fbc5c` made"*.
     *
     * So one file said both numbers, and the half that was generated is the
     * half that stayed right. The mode count in this row has never been
     * wrong; the destination count next to it rotted for three days. That is
     * not an argument about diligence — it is the argument for the marker.
     *
     * A destination is a decision, which is the test the comment above sets
     * for what belongs here: somebody adds one on purpose, rarely. It does
     * not churn the way a component file does.
     */
    path: 'COMPLETION-PLAN.md',
    keys: ['modes', 'screens'],
    nouns: { modes: 'study modes', screens: 'destinations' },
  },
];

/** The counts one of those files states, in the order `counts` returned them. */
export function statedIn(all: Count[], file: Stated): Count[] {
  return all.filter((c) => file.keys.includes(c.key));
}

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
