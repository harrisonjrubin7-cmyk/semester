import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DESTINATIONS } from './nav';
import { DEFAULT_TABS } from './tabbar';
import { modesFor } from './modes';
import { buildCatalog } from '../data/catalog';
import type { CourseModule, Guide } from './types';

/**
 * The counts in the README, against the registries they are counting.
 *
 * Three of them had drifted, all in the same direction and for the same
 * reason: a screen or a mode is added to a registry because the app needs it,
 * and the sentence in the README that happens to count them is somewhere else.
 * "Five sections, twenty screens" was written when there were twenty; there
 * are fifty. "Each guide has nine modes" was followed by a list of ten, of
 * eleven that exist. "Five recordings ship" — there are eight, and the two
 * bullets under that sentence already said four and four.
 *
 * None of those is a bug in the app. All three are the app telling a new
 * reader something untrue about itself on its first page, which is the kind of
 * error that survives for years because nothing is wrong when you run it.
 *
 * So the numbers are read here, from the lists they are about. A registry can
 * still grow — this fails when it does, and the fix is the same diff.
 */

const README = readFileSync(join(process.cwd(), 'README.md'), 'utf8');

/**
 * The same text, on one line and in lower case.
 *
 * A count can start a sentence — "Five tabs, forty-nine screens." — so
 * matching it case-sensitively would ask the README to be written wrong. And
 * flattened, because these sentences wrap: "eleven\n  modes" is the same
 * claim as "eleven modes" and only one of them is greppable.
 */
const SAID = README.replace(/\s+/g, ' ').toLowerCase();

/** The number words the README uses. It writes counts as words, not digits. */
const WORDS: Record<number, string> = {
  4: 'four',
  5: 'five',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
  13: 'thirteen',
  20: 'twenty',
  30: 'thirty',
  40: 'forty',
  44: 'forty-four',
  49: 'forty-nine',
  50: 'fifty',
  60: 'sixty',
  70: 'seventy',
};

/**
 * A count, as the README would write it.
 *
 * Throwing on a number with no word is the point: the alternative is a test
 * that quietly stops checking the day a registry passes fifty-one.
 */
function inWords(n: number): string {
  const word = WORDS[n];
  if (!word) {
    throw new Error(
      `No word for ${n}. Add it to WORDS in readme.test.ts, and write it into the README.`,
    );
  }
  return word;
}

/** The thinnest guide `modesFor` will read — this is counting modes, not cards. */
const guide: Guide = {
  code: 'ECON 1020',
  name: '',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: [{ name: 'Unit 1', mastery: 0, cards: [{ q: 'q', a: 'a' }] }],
  terms: [],
};

const module_: CourseModule = {
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
  guide,
  planMinutes: '45 min',
  frameLabel: 'Frames',
};

const MODES = modesFor(buildCatalog([module_]), 'econ', {
  guide,
  lessons: {},
  figures: {},
  extras: [],
});

describe('the README counts', () => {
  it('says how many screens there are', () => {
    const n = DESTINATIONS.length;
    expect(
      SAID,
      `lib/nav.ts has ${n} destinations, so the README should say "${inWords(n)} screens".`,
    ).toContain(`${inWords(n)} screens`);
  });

  it('says how many tabs the bar opens with', () => {
    // Distinct from the screen count, and easy to conflate: Today's own
    // switcher went from five segments to four while this was being written,
    // which is a different five.
    const n = DEFAULT_TABS.length;
    expect(
      SAID,
      `lib/tabbar.ts opens with ${n} tabs, so the README should say "${inWords(n)} tabs".`,
    ).toContain(`${inWords(n)} tabs`);
  });

  it('says how many ways there are to read a guide', () => {
    const n = MODES.length;
    expect(
      SAID,
      `lib/modes.ts offers ${n} modes, so the README should say "${inWords(n)} modes".`,
    ).toContain(`${inWords(n)} modes`);
  });

  it('says how many recordings ship', () => {
    const audio = join(process.cwd(), 'public', 'audio');
    const n = readdirSync(audio).filter((f) => f.endsWith('.mp3')).length;
    expect(
      SAID,
      `public/audio holds ${n} .mp3 files, so the README should say "${inWords(n)} recordings".`,
    ).toContain(`${inWords(n)} recordings`);
  });

  it('says how many narrated lessons there are', () => {
    // One per unit per course, rendered by the pipeline. The number moves when
    // a guide gains a unit, which is a thing that happens in a term.
    const lessons = join(process.cwd(), 'public', 'audio', 'lessons');
    const n = readdirSync(lessons, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .reduce((total, d) => total + readdirSync(join(lessons, d.name)).filter((f) => f.endsWith('.mp3')).length, 0);
    expect(
      SAID,
      `public/audio/lessons holds ${n} .mp3 files, so the README should say "${inWords(n)} narrated lessons".`,
    ).toContain(`${inWords(n)} narrated lessons`);
  });

  it('lists every mode it says there are', () => {
    // The count and the list drifted apart once already — nine claimed, ten
    // written, eleven real. Both halves, or neither is worth checking.
    const listed = SAID.slice(SAID.indexOf('modes: **cards**'));
    expect(listed, 'The README no longer has a mode list to check.').not.toBe('');
    for (const mode of MODES) {
      expect(listed, `The README's mode list is missing ${mode.label}.`).toContain(
        `**${mode.label.toLowerCase()}**`,
      );
    }
  });
});
