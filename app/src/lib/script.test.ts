import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isScriptEpisode, scriptEpisodeId, scriptFor, speakable } from './script';
import { hasTranscript } from './transcript';
import type { Guide } from './types';

/**
 * The script a course writes for itself.
 *
 * Every assertion here is about one of two things: that the words come from
 * the guide and nowhere else, and that nothing in the result claims to be a
 * recording.
 */

const guide = (over: Partial<Guide> = {}): Guide => ({
  code: 'CHEM 1601',
  name: 'General Chemistry',
  blurb: 'The course about what atoms do when they meet.',
  source: 'chem1601.pdf',
  mastery: 0,
  audio: false,
  terms: [],
  units: [
    {
      name: '1 · Stoichiometry',
      mastery: 0,
      cards: [
        { q: 'What is a mole?', a: 'Avogadro’s number of particles — 6.022 × 10²³ of them.' },
        { q: 'What is the limiting reagent?', a: 'The one that runs out first and caps the yield.' },
      ],
    },
    {
      name: '2 · Thermodynamics',
      mastery: 0,
      cards: [{ q: 'What is enthalpy?', a: 'Heat exchanged at constant pressure.' }],
    },
  ],
  ...over,
});

describe('a script written from a guide', () => {
  it('opens, takes a chapter per unit, and closes on the self-test', () => {
    const s = scriptFor('chem', guide({ selfTest: [{ q: 'Define enthalpy.', a: 'Heat at constant pressure.' }] }))!;
    expect(s.transcript.chapters.map((c) => c.name)).toEqual([
      'Cold open',
      'Stoichiometry',
      'Thermodynamics',
      'Self-test',
    ]);
  });

  it('drops the numbering a unit name carries, since a chapter is not numbered twice', () => {
    const s = scriptFor('chem', guide())!;
    expect(s.transcript.chapters[1].name).toBe('Stoichiometry');
  });

  it('turns each card into the question asked and the answer given', () => {
    const s = scriptFor('chem', guide())!;
    const unit = s.transcript.chapters.find((c) => c.name === 'Stoichiometry')!;
    expect(unit.said.map((l) => l.who)).toEqual(['host', 'host', 'expert', 'host', 'expert']);
    expect(unit.said[1].text).toBe('What is a mole?');
    expect(unit.said[2].text).toContain('Avogadro');
  });

  it('says nothing the guide did not', () => {
    /*
     * The claim this file exists to protect. Every line is a card's question,
     * a card's answer, the guide's own blurb, or one of the four countable
     * sentences the opening and the self-test heading are made of — so a
     * reader can check the script against the guide and find nothing extra.
     */
    const g = guide({ selfTest: [{ q: 'Define enthalpy.', a: 'Heat at constant pressure.' }] });
    const s = scriptFor('chem', g)!;
    const fromGuide = new Set<string>([
      g.blurb,
      ...g.units.flatMap((u) => u.cards.flatMap((c) => [c.q, c.a])),
      ...(g.selfTest ?? []).flatMap((c) => [c.q, c.a]),
    ]);

    const written = s.transcript.chapters
      .flatMap((c) => c.said)
      .map((l) => l.text)
      // A line counts as the guide's if what the guide says is in it: the
      // framings ("And this. ", "1. ") wrap a card's words, they do not add
      // a claim to them.
      .filter((text) => ![...fromGuide].some((said) => text.includes(speakable(said))));

    expect(written).toEqual([
      'CHEM 1601, General Chemistry. 2 units, and we are going through all of them.',
      'We finish with a self-test, so keep something to write on.',
      'Next. Stoichiometry.',
      'Next. Thermodynamics.',
      'Self-test. 1 question. Answer out loud, then listen for the answer.',
    ]);
  });

  it('is null for a guide with no cards, rather than an opening and a closing', () => {
    expect(scriptFor('chem', guide({ units: [] }))).toBeNull();
    expect(
      scriptFor('chem', guide({ units: [{ name: 'Empty', mastery: 0, cards: [] }] })),
    ).toBeNull();
  });

  it('leaves out a unit that has no cards, without leaving a gap in the run', () => {
    const s = scriptFor(
      'chem',
      guide({
        units: [
          { name: '1 · Stoichiometry', mastery: 0, cards: [{ q: 'q', a: 'a' }] },
          { name: '2 · Nothing here', mastery: 0, cards: [] },
        ],
      }),
    )!;
    expect(s.transcript.chapters.map((c) => c.name)).toEqual(['Cold open', 'Stoichiometry']);
    expect(s.transcript.chapters[0].said[0].text).toContain('1 unit,');
  });
});

describe('what the episode claims', () => {
  it('claims no timings, because it has none', () => {
    /*
     * A recorded edition's chapter carries the second it starts at, known
     * exactly because the synthesiser put it there. A number estimated from a
     * word count, printed in the column those live in, would be the failure
     * `lib/where.ts` is about. So the column is the chapter's number.
     */
    const s = scriptFor('chem', guide())!;
    expect(s.episode.chapters.map((c) => c.t)).toEqual(['1', '2', '3']);
    expect(s.episode.chapters.every((c) => c.s === 0)).toBe(true);
  });

  it('is not playable, and says so in the fields the screen reads', () => {
    const s = scriptFor('chem', guide())!;
    expect(s.episode.ready).toBe(false);
    expect(s.episode.file).toBe('');
    expect(s.episode.seconds).toBe(0);
  });

  it('states a reading time, said as one', () => {
    // Not a duration: this is text, and "18 min" beside a play button that is
    // not there would read as how long the audio is.
    const s = scriptFor('chem', guide())!;
    expect(s.episode.len).toMatch(/^\d+ min read$/);
  });

  it('runs the same chapters as its transcript, because they are one pass', () => {
    const s = scriptFor('chem', guide())!;
    expect(s.episode.chapters.map((c) => c.name)).toEqual(
      s.transcript.chapters.map((c) => c.name),
    );
    expect(s.transcript.episode).toBe(s.episode.id);
  });

  it('is its own transcript, with no module to fetch', () => {
    const id = scriptEpisodeId('chem');
    expect(isScriptEpisode(id)).toBe(true);
    // `chem` is in no `LOADERS` entry and never will be — that is the point.
    expect(hasTranscript('chem', id)).toBe(true);
    expect(hasTranscript('chem', 'chem-podcast')).toBe(false);
  });
});

describe('speech, not prose', () => {
  it('spells out what a voice cannot say', () => {
    expect(speakable('Elasticity ≈ 1.2, so a 10% rise')).toBe(
      'Elasticity about 1.2, so a 10 percent rise',
    );
    expect(speakable('r² ≥ 0.8')).toBe('r squared at least 0.8');
    expect(speakable('$1,200 per term')).toBe('1,200 dollars per term');
  });

  it('reads an exponent as one number, not as a character each', () => {
    /*
     * The bug the rendered screen found and the tests did not.
     *
     * `6.022 × 10²³` came out as "6.022 times 10 squared³": the `²`
     * substitution fired on the first character of the exponent and left the
     * second as a glyph no voice can say. Avogadro's number is the first line
     * of a chemistry course, which is the sort of course this feature exists
     * for.
     */
    expect(speakable('6.022 × 10²³ particles')).toBe('6.022 times 10 to the 23 particles');
    expect(speakable('2⁻ is not handled, 10⁻ stays')).toContain('⁻');
  });

  it('keeps the English forms for a single power', () => {
    // "r squared" is what somebody says out loud; "r to the 2" is not.
    expect(speakable('r² = 0.81')).toBe('r squared = 0.81');
    expect(speakable('x³ grows fast')).toBe('x cubed grows fast');
    expect(speakable('10⁴ of them')).toBe('10 to the 4 of them');
  });

  it('is the same list the drafting tool uses', () => {
    /*
     * Two copies, and this is what holds them together.
     *
     * `pipeline/make-script.mjs` cannot import this module: the pipeline is
     * dependency-free Node with no build step, and it reads the app's
     * TypeScript as text rather than importing it. So the substitutions are
     * read back out of it and compared — the arrangement `functions.test.ts`
     * uses to hold the spreadsheet's catalogue to its engine, for the same
     * reason: a copy that drifts is worse than no copy, because the words
     * somebody reads and the words that get synthesised stop being the same
     * document.
     */
    const substitutions = (source: string): string[] => {
      const start = source.indexOf('function speakable(');
      expect(start, 'no speakable() to compare against').toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf('\n}', start));
      return [...body.matchAll(/\.replace\(([\s\S]*?)\)\n/g)].map((m) =>
        m[1].replace(/\s+/g, ' ').trim(),
      );
    };

    const here = substitutions(readFileSync(join(process.cwd(), 'src/lib/script.ts'), 'utf8'));
    const pipeline = substitutions(
      readFileSync(join(process.cwd(), '..', 'pipeline/make-script.mjs'), 'utf8'),
    );

    expect(here.length).toBeGreaterThan(10);
    expect(here).toEqual(pipeline);
  });
});
