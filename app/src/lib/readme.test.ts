import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATED, counts, fill, inWords, marker, prose, statedIn } from './counts';
import { modesFor } from './modes';
import { buildCatalog } from '../data/catalog';
import type { CourseModule, Guide } from './types';

/**
 * The counts in the README, against the registries they are counting.
 *
 * Four of them had drifted, all in the same direction and for the same reason:
 * a screen or a mode is added to a registry because the app needs it, and the
 * sentence in the README that happens to count them is somewhere else. "Five
 * sections, twenty screens" was written when there were twenty; there were
 * fifty. "Each guide has nine modes" was followed by a list of ten, of eleven
 * that exist. "Five recordings ship" — there are eight, and the two bullets
 * under that sentence already said four and four.
 *
 * None of those is a bug in the app. All of them are the app telling a new
 * reader something untrue about itself on its first page, which is the kind of
 * error that survives for years because nothing is wrong when you run it.
 *
 * ## What this checks now, and what it used to
 *
 * It used to hold the README to the registries and fail when they disagreed,
 * leaving a person to work out the word for fifty-one. That caught real rot,
 * and it also cost more than it was worth on the one count that moves: the
 * screen count went forty-nine to fifty and back inside twenty minutes, three
 * branches raced to correct it, and two were wrong by the time they landed.
 *
 * The numbers are generated now — `npm run counts`, from `lib/counts.ts` — so
 * what is left to check is that somebody ran it, which is one assertion: the
 * README filled from the registries is the README that is committed. Churn
 * stops being a failure and rot is still caught, and neither answer needed the
 * README to stop saying how big the app is.
 *
 * The rest is what a generator cannot see: that each number sits in a sentence
 * saying what it counts, and that the mode list under the mode count still has
 * every mode in it.
 */

const ROOT = process.cwd();
const REPO = join(ROOT, '..');

/**
 * Both READMEs, read once.
 *
 * There are two — `app/README.md` and the repository's front page — and until
 * this test loop existed only the first was held to anything. The front page
 * drifted the whole way this mechanism was built to stop: a heading saying six
 * ways over eleven modes, a sentence naming ten of them, and a table listing
 * seven. So the file the test reads is whatever `STATED` names, and adding a
 * third README is adding a row there.
 */
const FILES = STATED.map((file) => {
  const text = readFileSync(join(REPO, file.path), 'utf8');
  return { file, text, said: prose(text) };
});

/** The app's own README, which is where the claims not about counts live. */
const README = FILES.find((f) => f.file.path === 'app/README.md')!.text;
const SAID = prose(README);

describe('the README counts', () => {
  for (const { file, text, said } of FILES) {
    it(`${file.path} is what \`npm run counts\` would write`, () => {
      const { text: filled, missing } = fill(text, statedIn(counts(ROOT), file));
      expect(missing, `${file.path} has no marker for: ${missing.join(', ')}.`).toEqual([]);
      expect(
        filled,
        `${file.path}'s counts are out of date. Run \`npm run counts\` and commit what it writes.`,
      ).toBe(text);
    });

    it(`${file.path} puts them in the sentence a reader would look for them in`, () => {
      /*
       * The generator only fills markers. It cannot tell whether a marker is in
       * a sentence that says what its number means, and a count written into
       * the wrong noun is worse than one that has drifted — it is wrong and
       * confident. So each number is still read back out of the prose beside
       * the word it belongs to, which is what this file used to do by hand.
       *
       * The noun is per file rather than per count, because the same number is
       * "eleven modes" in the app's README and "eleven ways through the same
       * material" on the front page, and both sentences are the right one
       * where they are.
       */
      for (const count of statedIn(counts(ROOT), file)) {
        const noun = file.nouns[count.key];
        expect(
          noun,
          `No noun for the ${count.key} count in ${file.path}. Add one to STATED.`,
        ).toBeTruthy();
        expect(
          said,
          `${count.from} says ${count.n}, so ${file.path} should read "${count.said} ${noun}".`,
        ).toContain(`${count.said} ${noun}`);
      }
    });
  }

  it('name every count in a file that states it', () => {
    // A count nobody states is a count that has quietly stopped being checked.
    // Every key `counts` returns has to appear in at least one `STATED` row,
    // so dropping a sentence from a README is a failure rather than a silence.
    for (const count of counts(ROOT)) {
      expect(
        STATED.some((file) => file.keys.includes(count.key)),
        `No README states the ${count.key} count. Add it to a STATED row, or drop it from counts().`,
      ).toBe(true);
    }
  });

  it('list every mode they say there are', () => {
    // The count and the list drifted apart once already — nine claimed, ten
    // written, eleven real. Both halves, or neither is worth checking, and
    // generating the count does nothing for the list beside it.
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
    const modes = modesFor(buildCatalog([module_]), 'econ', {
      guide,
      lessons: {},
      figures: {},
      extras: [],
    });

    const listed = SAID.slice(SAID.indexOf('modes: **cards**'));
    expect(listed, 'The README no longer has a mode list to check.').not.toBe('');
    for (const mode of modes) {
      expect(listed, `The README's mode list is missing ${mode.label}.`).toContain(
        `**${mode.label.toLowerCase()}**`,
      );
    }

    /*
     * And the front page's, which is a sentence and a table rather than one
     * list — and which was the half that had rotted: ten named in the
     * sentence, seven rowed in the table, of the eleven that exist. Both are
     * checked, because a mode present in one and absent from the other is the
     * same reader misled either way.
     */
    const front = FILES.find((f) => f.file.path === 'README.md')!;
    const section = front.said.slice(front.said.indexOf('ways through the same material'));
    expect(section, 'The front page no longer has a mode section to check.').not.toBe('');
    for (const mode of modes) {
      const label = mode.label.toLowerCase();
      expect(
        section,
        `The front page's mode sentence is missing ${mode.label}.`,
      ).toContain(`**${label}**`);
      expect(section, `The front page's mode table has no row for ${mode.label}.`).toContain(
        `| ${label} |`,
      );
    }
  });
});

describe('writing a count out in words', () => {
  it('reaches past whatever anybody has written down', () => {
    // The point of computing this rather than looking it up. The table it
    // replaced threw on any number nobody had needed yet, so a registry
    // passing fifty-one failed the build asking to be taught the word — the
    // same maintenance this mechanism exists to remove, moved one step back.
    expect(inWords(0)).toBe('zero');
    expect(inWords(11)).toBe('eleven');
    expect(inWords(20)).toBe('twenty');
    expect(inWords(49)).toBe('forty-nine');
    expect(inWords(51)).toBe('fifty-one');
    expect(inWords(100)).toBe('one hundred');
    expect(inWords(137)).toBe('one hundred and thirty-seven');
  });

  it('refuses a number the README could not be written with', () => {
    for (const n of [-1, 1.5, 1000]) expect(() => inWords(n)).toThrow();
  });
});

describe('filling the markers', () => {
  const one = [{ key: 'screens', n: 49, said: 'forty-nine', from: 'lib/nav.ts' }];

  it('replaces what is between them and leaves the prose alone', () => {
    const before = 'Five tabs, <!--screens-->twenty<!--/--> screens on the shelves.';
    expect(fill(before, one).text).toBe(
      'Five tabs, <!--screens-->forty-nine<!--/--> screens on the shelves.',
    );
  });

  it('keeps the case it found, so a count may open a sentence', () => {
    const before = '<!--screens-->Twenty<!--/--> screens.';
    expect(fill(before, one).text).toBe('<!--screens-->Forty-nine<!--/--> screens.');
  });

  it('touches no other run of the same words', () => {
    // The reason for markers at all: "the screens on it" three sections down
    // is the same shape as the number this is allowed to overwrite.
    const before = 'the screens on it, <!--screens-->twenty<!--/--> screens';
    expect(fill(before, one).text).toBe(
      'the screens on it, <!--screens-->forty-nine<!--/--> screens',
    );
  });

  it('names a count with nowhere to go rather than dropping it', () => {
    expect(fill('No marker here.', one).missing).toEqual(['screens']);
  });

  it('reads a claim back without the markers in the way', () => {
    expect(prose('<!--screens-->Forty-nine<!--/--> Screens.')).toBe('forty-nine screens.');
  });

  it('matches a marker only where it is closed', () => {
    expect(marker('screens').test('<!--screens-->forty-nine<!--/-->')).toBe(true);
    expect(marker('screens').test('<!--screens-->forty-nine')).toBe(false);
  });
});
