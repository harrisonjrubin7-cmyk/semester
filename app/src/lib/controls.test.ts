import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  MOST,
  MOST_CARDS,
  capsFor,
  countsSay,
  line,
  shapeSays,
  type Controls,
} from './controls';
import { STUDY_SHAPES, studyShapes } from './study';

const c = (over: Partial<Controls> = {}): Controls => ({ ...DEFAULTS, ...over });

describe('the defaults are the app as it shipped', () => {
  /*
   * The load-bearing test in this file. The four courses in the app were built
   * by the prompt as it was before any of this existed, and a student who has
   * never opened a control must keep getting exactly that prompt — otherwise a
   * settings screen appearing quietly changed everybody's generation.
   */
  it('adds nothing to the prompt', () => {
    expect(shapeSays()).toBe('');
    expect(shapeSays(DEFAULTS)).toBe('');
    expect(shapeSays(c({ depth: 'standard', level: 'course' }))).toBe('');
  });

  it('leaves every ceiling exactly where it was', () => {
    expect(capsFor()).toEqual(MOST);
    expect(capsFor(DEFAULTS)).toEqual(MOST);
  });

  it('leaves the study shapes byte-for-byte what they were', () => {
    expect(studyShapes(capsFor())).toBe(STUDY_SHAPES);
  });
});

describe('depth', () => {
  it('shortens everything at brief and lengthens everything at full', () => {
    const brief = capsFor(c({ depth: 'brief' }));
    const full = capsFor(c({ depth: 'full' }));
    for (const k of ['cards', 'terms', 'frames', 'tests', 'cases', 'examples', 'figures'] as const) {
      expect(brief[k], k).toBeLessThan(MOST[k]);
      expect(full[k], k).toBeGreaterThan(MOST[k]);
    }
  });

  // A depth that can return nothing is a broken control rather than a short one.
  it('never takes a ceiling to zero, even for the smallest kind', () => {
    expect(MOST.cases).toBe(3);
    expect(capsFor(c({ depth: 'brief' })).cases).toBeGreaterThanOrEqual(1);
  });

  // Figures were the one kind left on a fixed ceiling while everything around
  // them scaled, so `brief` kept three and `full` could never keep more.
  it('scales figures with everything else', () => {
    expect(capsFor(c({ depth: 'full' })).figures).toBeGreaterThan(MOST.figures);
    expect(capsFor(c({ depth: 'brief' })).figures).toBeLessThan(MOST.figures);
  });

  it('keeps every ceiling a whole number', () => {
    for (const depth of ['brief', 'standard', 'full'] as const) {
      for (const n of Object.values(capsFor(c({ depth })))) expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('says what it is doing, in words the model can act on', () => {
    expect(shapeSays(c({ depth: 'brief' }))).toContain('Keep it short');
    expect(shapeSays(c({ depth: 'full' }))).toContain('thoroughly');
  });
});

describe('level', () => {
  it('asks for plain language, or for the hardest the material supports', () => {
    expect(shapeSays(c({ level: 'plainer' }))).toContain('meeting this for the first time');
    expect(shapeSays(c({ level: 'harder' }))).toContain('hardest questions the material genuinely');
  });

  it('changes no ceiling — it is about wording, not quantity', () => {
    for (const level of ['plainer', 'course', 'harder'] as const) {
      expect(capsFor(c({ level }))).toEqual(MOST);
    }
  });

  /*
   * The refusal this file exists for. "Harder" is the one register that
   * creates pressure to invent: a model asked for a harder question about a
   * reading that does not support one will supply an exam question about
   * something the reading never said, and it looks exactly like the good ones.
   */
  it('attaches the no-invention refusal to harder, where the pressure is', () => {
    const said = shapeSays(c({ level: 'harder' }));
    expect(said).toContain('never inventing material to ask about');
    expect(shapeSays(c({ level: 'plainer' }))).not.toContain('never inventing');
  });

  it('carries the refusal even when harder is combined with a depth', () => {
    expect(shapeSays(c({ level: 'harder', depth: 'full' }))).toContain('never inventing');
    expect(shapeSays(c({ level: 'harder', depth: 'brief' }))).toContain('never inventing');
  });
});

describe('how many cards', () => {
  it('takes a number the student names, over the depth', () => {
    expect(capsFor(c({ cards: 30 })).cards).toBe(30);
    expect(capsFor(c({ cards: 30, depth: 'brief' })).cards).toBe(30);
  });

  // "30 cards, brief" means thirty cards and a short cram sheet beside them.
  it('leaves every other kind on the depth', () => {
    const caps = capsFor(c({ cards: 30, depth: 'brief' }));
    expect(caps.cards).toBe(30);
    expect(caps.frames).toBe(capsFor(c({ depth: 'brief' })).frames);
  });

  it('reads zero as "as many as the material supports", not as none', () => {
    expect(capsFor(c({ cards: 0 })).cards).toBe(MOST.cards);
    expect(capsFor(c({ cards: 0, depth: 'full' })).cards).toBeGreaterThan(MOST.cards);
  });

  it('clamps a number outside the range rather than passing it to a model', () => {
    expect(capsFor(c({ cards: 500 })).cards).toBe(MOST_CARDS);
    expect(capsFor(c({ cards: -4 })).cards).toBe(MOST.cards);
    expect(capsFor(c({ cards: 2.6 })).cards).toBe(3);
  });

  it('spells the counts out for the prompt', () => {
    expect(countsSay(capsFor(c({ cards: 12 })))).toBe('At most 12 cards and 20 terms.');
  });

  /*
   * The shape of a bug this had, found by re-reading the diff rather than by a
   * failing test. `generate.ts` gated the counts on `shapeSays`, which is
   * empty whenever depth and level are both untouched — so a student who
   * asked for twelve cards and changed nothing else had the number computed,
   * clamped, and then never sent.
   *
   * The property that makes the gate safe is here rather than in the caller:
   * an explicit count moves the caps even when nothing moves the register, so
   * "did the register change" is never a sound proxy for "is there anything
   * to say".
   */
  it('moves the caps even where it says nothing about the register', () => {
    const only = c({ cards: 12 });
    expect(shapeSays(only)).toBe('');
    expect(capsFor(only).cards).toBe(12);
    expect(capsFor(only).cards).not.toBe(MOST.cards);
  });
});

describe('the line the screen shows', () => {
  it('describes the defaults without pretending something was chosen', () => {
    expect(line()).toBe('The usual amount, at the course’s own level — up to 25 cards, however many it supports.');
  });

  it('names an explicit count as asked for rather than as a guess', () => {
    expect(line(c({ cards: 12 }))).toContain('up to 12 cards, as asked');
  });

  it('reads every combination as a sentence', () => {
    for (const depth of ['brief', 'standard', 'full'] as const) {
      for (const level of ['plainer', 'course', 'harder'] as const) {
        const said = line(c({ depth, level }));
        expect(said.endsWith('.')).toBe(true);
        expect(said.length).toBeGreaterThan(20);
      }
    }
  });
});
