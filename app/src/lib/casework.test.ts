import { describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import {
  QUANTITATIVE,
  casePrompt,
  filled,
  material,
  numeric,
  readCases,
  says,
  shapeFor,
} from './casework';
import { exampleKind, type Unit } from './types';

const unit = (cards: { q: string; a: string }[], name = '5 · A unit'): Unit => ({
  name,
  mastery: 0,
  cards,
});

const ECON = unit([
  { q: 'Price $4→$6, quantity 100→80. Elastic or inelastic?', a: '%ΔQ = −20/90 = −22.2%; %ΔP = 2/5 = 40%; ε = −0.56 → inelastic.' },
  { q: 'What is the midpoint formula?', a: 'ε = [(Q₂−Q₁)/((Q₁+Q₂)/2)] ÷ [(P₂−P₁)/((P₁+P₂)/2)]' },
  { q: 'Why use the midpoint?', a: 'It gives the same answer in both directions.' },
]);

const said = (kind: string, over: Record<string, unknown> = {}) => ({
  kind,
  tag: 'Elasticity',
  t: 'A title',
  from: 'Why use the midpoint?',
  ...over,
});

describe('an example, whatever shape it is', () => {
  it('has one body, so six readers do not each grow a switch', () => {
    // A cram sheet, a document template, a changeset summary, a review sheet,
    // the paste reader and the Cases tab all read `.d` before the union.
    expect(says({ tag: 'T', t: 'A', d: 'The paragraph.' })).toBe('The paragraph.');
    expect(
      says({ kind: 'worked', tag: 'T', t: 'A', statement: 'Given.', steps: ['One.', 'Two.'], result: 'So.' }),
    ).toBe('Given. One. Two. So.');
    expect(
      says({ kind: 'study', tag: 'T', t: 'A', situation: 'It.', question: 'Q?', analysis: 'A.', turned: 'On.' }),
    ).toBe('It. Q? A. On.');
  });

  it('reads an absent discriminator as the shape the shipped courses use', () => {
    // Thirty-two examples ship without one. A union that required it would
    // have been a migration rather than a widening.
    expect(exampleKind({ tag: 'T', t: 'A', d: 'D' })).toBe('applied');
  });

  it('is empty when it says nothing, whatever fields it has', () => {
    expect(filled({ tag: 'T', t: 'A', d: '' })).toBe(false);
    expect(filled({ kind: 'worked', tag: 'T', t: 'A', statement: '', steps: [], result: '' })).toBe(false);
    expect(filled({ tag: 'T', t: 'A', d: 'Something.' })).toBe(true);
  });
});

describe('the shape a unit calls for, read off the unit', () => {
  it('asks for a worked problem where the cards carry arithmetic', () => {
    expect(numeric(ECON)).toBeGreaterThanOrEqual(QUANTITATIVE);
    expect(shapeFor(ECON)).toBe('worked');
  });

  it('does not read a bare year as arithmetic', () => {
    // A digit on its own is a date or a page number. Counting it would make
    // every history unit quantitative.
    const dates = unit([
      { q: 'When was the Act passed?', a: 'In 1979, after two years of debate.' },
      { q: 'And repealed?', a: 'In 1986.' },
    ]);
    expect(numeric(dates)).toBe(0);
  });

  it('asks for an applied scenario for a unit of definitions', () => {
    const defs = unit([
      { q: 'What is a norm?', a: 'A shared expectation about behaviour.' },
      { q: 'What is an institution?', a: 'A rule that persists beyond the people in it.' },
    ]);
    expect(shapeFor(defs)).toBe('applied');
  });

  it('asks for a case study only where there is somebody in the material', () => {
    // A case study needs a situation and a situation needs an actor. Asked of
    // a unit of definitions it produces an invented company doing an invented
    // thing, which is the fabrication the grounding check exists to refuse —
    // arrived at by asking the wrong question rather than getting a bad answer.
    const peopled = unit([
      { q: 'What did Bartels find?', a: 'That the thesis does not survive in the 1952–2004 data.' },
      { q: 'What did the firm do next?', a: 'It withdrew the product in 1998 and relaunched it.' },
      { q: 'Who tested the claim?', a: 'Ruffini, two decades later, found the same.' },
    ]);
    expect(shapeFor(peopled)).toBe('study');
  });

  it('names the shape it is asking for, in the prompt', () => {
    expect(casePrompt(ECON)).toContain('"kind":"worked"');
    expect(casePrompt(ECON)).toContain('word for word');
    expect(casePrompt(ECON, 'study')).toContain('"kind":"study"');
  });
});

describe('what the material supports, and what it refuses', () => {
  it('keeps an example whose sentence is in the unit, word for word', () => {
    const got = readCases([said('applied', { d: 'A meal plan is close to perfectly inelastic.' })], ECON);
    expect(got).toHaveLength(1);
    expect(got[0].from).toBe('Why use the midpoint?');
  });

  it('refuses one whose sentence is not in the unit at all', () => {
    // The whole of §3.4's grounding condition. A case that introduces a fact
    // the course does not support is refused rather than shown with a caveat.
    const got = readCases(
      [said('applied', { d: 'Something true.', from: 'Marshall proved this in 1890.' })],
      ECON,
    );
    expect(got).toEqual([]);
  });

  it('refuses a paraphrase of a sentence that is in the unit', () => {
    // Close is not the same. `lib/covers.ts` draws the line in the same place
    // and for the same reason: a model that may paraphrase its citation can
    // support an invented claim with an invented one.
    const got = readCases([said('applied', { d: 'X.', from: 'Why do we use the midpoint?' })], ECON);
    expect(got).toEqual([]);
  });

  it('refuses one that cites nothing', () => {
    const got = readCases([said('applied', { d: 'X.', from: '' })], ECON);
    expect(got).toEqual([]);
  });

  it('drops the bad one and keeps the good ones', () => {
    // A reply of three with one ungrounded item is not a reason to lose two
    // good examples — the difference between this and `lib/figure.ts`, where
    // a malformed arm makes the whole figure unusable.
    const got = readCases(
      [
        said('applied', { d: 'First.' }),
        said('applied', { d: 'Second.', from: 'Not in this unit anywhere.' }),
        said('applied', { d: 'Third.', t: 'Another title' }),
      ],
      ECON,
    );
    expect(got).toHaveLength(2);
  });

  it('refuses a worked problem with no steps, which is a paragraph claiming to be one', () => {
    expect(
      readCases([said('worked', { statement: 'Given p and q.', steps: [], result: '0.5' })], ECON),
    ).toEqual([]);
    expect(
      readCases([said('worked', { statement: 'Given p and q.', steps: ['One step.'], result: '0.5' })], ECON),
    ).toEqual([]);
  });

  it('keeps a worked problem that shows its working', () => {
    const got = readCases(
      [said('worked', { statement: 'Given p and q.', steps: ['%ΔQ = −22.2%', '%ΔP = 40%'], result: 'ε = −0.56' })],
      ECON,
    );
    expect(got).toHaveLength(1);
    expect(exampleKind(got[0].example)).toBe('worked');
  });

  it('refuses a case study missing any of its four parts', () => {
    for (const missing of ['situation', 'question', 'analysis', 'turned']) {
      const whole = { situation: 'S.', question: 'Q?', analysis: 'A.', turned: 'T.' };
      expect(readCases([said('study', { ...whole, [missing]: '' })], ECON), missing).toEqual([]);
    }
  });

  it('reads a reply that is not a list, or is nonsense, as nothing', () => {
    expect(readCases(null, ECON)).toEqual([]);
    expect(readCases({ kind: 'applied' }, ECON)).toEqual([]);
    expect(readCases(['a string', 7, null], ECON)).toEqual([]);
  });

  it('takes at most three, however many were sent', () => {
    const many = Array.from({ length: 9 }, (_, i) => said('applied', { d: `Body ${i}.`, t: `Title ${i}` }));
    expect(readCases(many, ECON)).toHaveLength(3);
  });

  it('checks against the unit, not the whole course', () => {
    // A case written from unit three and quoting unit nine has wandered, and
    // the point of the check is that it came from the material it names.
    const other = unit([{ q: 'What is a Nash equilibrium?', a: 'Both players best-responding.' }]);
    expect(readCases([said('applied', { d: 'X.', from: 'Why use the midpoint?' })], other)).toEqual([]);
  });
});

describe('the material the shipped courses hold', () => {
  it('has a shape for every unit of every course, and no unit is empty', () => {
    return loadSeed().then((mods) => {
      let units = 0;
      for (const m of mods) {
        for (const u of m.guide.units) {
          units += 1;
          expect(['applied', 'worked', 'study']).toContain(shapeFor(u));
          expect(material(u).length, `${m.guide.code} ${u.name}`).toBeGreaterThan(40);
        }
      }
      expect(units).toBe(44);
    });
  });

  it('finds the quantitative units where a reader would expect them', () => {
    // Measured rather than asserted from taste: ECON and PSCI carry formulas,
    // and a rule that found none of them would be describing its author's
    // expectations rather than the material.
    return loadSeed().then((mods) => {
      const worked = mods.flatMap((m) =>
        m.guide.units.filter((u) => shapeFor(u) === 'worked').map(() => m.guide.code),
      );
      expect(worked.length).toBeGreaterThan(3);
      expect(new Set(worked)).toContain('ECON 1020');
    });
  });
});
