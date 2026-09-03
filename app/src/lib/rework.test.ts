import { describe, expect, it } from 'vitest';
import { SYSTEM, brief, readPlan, survey, verdict } from './rework';
import type { CourseUpdate, Guide } from './types';

const guide = (): Guide => ({
  code: 'ECON 1020',
  name: 'Macro',
  blurb: 'The first half of macro.',
  source: 'syllabus.pdf',
  mastery: 40,
  audio: false,
  units: [
    { name: '1 · What economics is', mastery: 40, cards: [{ q: 'What is scarcity?', a: 'Wants exceed means.' }] },
    { name: '2 · Supply', mastery: 20, cards: [{ q: 'What shifts supply?', a: 'Costs, technology.' }] },
  ],
  terms: [{ t: 'Scarcity', d: 'Wants exceed means.' }],
});

const update = (over: Partial<CourseUpdate> = {}): CourseUpdate =>
  ({
    id: 'u1',
    courseId: 'econ',
    unit: null,
    title: 'Reading 7',
    source: 'Posted Oct 8',
    body: 'Inflation expectations anchor when a central bank is credible.',
    cards: [],
    terms: [],
    fileIds: [],
    created: 0,
    ...over,
  }) as CourseUpdate;

describe('SYSTEM', () => {
  it('states the rule that protects answer history, and why', () => {
    expect(SYSTEM).toContain('character');
    expect(SYSTEM).toContain('answer history');
    expect(SYSTEM).toContain('streak');
  });

  it('forbids inventing anything into a revised guide', () => {
    expect(SYSTEM).toContain('Never invent a fact');
  });
});

describe('brief', () => {
  it('shows the guide as it stands, with every question', () => {
    const text = brief(guide(), [update()]);
    expect(text).toContain('What is scarcity?');
    expect(text).toContain('Unit 2: 2 · Supply');
    expect(text).toContain('Scarcity — Wants exceed means.');
  });

  it('says where added material was filed', () => {
    expect(brief(guide(), [update({ unit: 1 })])).toContain('filed against unit 2');
    expect(brief(guide(), [update({ unit: null })])).toContain('filed against no unit');
  });

  it('carries the prose that never became cards', () => {
    expect(brief(guide(), [update()])).toContain('Inflation expectations anchor');
  });

  it('says plainly when there is nothing added, rather than leaving a gap', () => {
    expect(brief(guide(), [])).toContain('(nothing)');
  });
});

describe('readPlan', () => {
  const good = JSON.stringify({
    blurb: 'Macro, now with inflation.',
    units: [
      { name: '1 · What economics is', cards: [{ q: 'What is scarcity?', a: 'Wants exceed means.' }] },
      { name: '3 · Inflation', cards: [{ q: 'What anchors expectations?', a: 'Credibility.' }] },
    ],
    terms: [{ t: 'Anchoring', d: 'Expectations stay put.' }],
    notes: ['Added a unit for the October reading.'],
  });

  it('reads the revised guide', () => {
    const plan = readPlan(good, guide());
    expect(plan.guide.units).toHaveLength(2);
    expect(plan.guide.blurb).toBe('Macro, now with inflation.');
    expect(plan.notes[0]).toContain('October');
  });

  it('finds the JSON even with chatter around it', () => {
    expect(readPlan(`Here you go:\n${good}\nHope that helps.`, guide()).guide.units).toHaveLength(2);
  });

  it('starts every unit at zero mastery, because mastery is measured not declared', () => {
    for (const u of readPlan(good, guide()).guide.units) expect(u.mastery).toBe(0);
  });

  it('refuses a reply with no units rather than emptying the guide', () => {
    // Replacing a working guide with an empty one is the worst outcome here.
    expect(() => readPlan(JSON.stringify({ units: [] }), guide())).toThrow(/no units/);
  });

  it('refuses a reply whose units are all empty', () => {
    const hollow = JSON.stringify({ units: [{ name: 'One', cards: [] }] });
    expect(() => readPlan(hollow, guide())).toThrow(/no cards/);
  });

  it('refuses a reply with no JSON object in it at all', () => {
    expect(() => readPlan('I could not do that.', guide())).toThrow(/Nothing usable/);
    // No closing brace either, so there is nothing even to attempt.
    expect(() => readPlan('{ truncated mid', guide())).toThrow(/Nothing usable/);
  });

  it('refuses a reply that looks like an object but will not parse', () => {
    expect(() => readPlan('{ units: broken, }', guide())).toThrow(/not valid JSON/);
  });

  it('drops a malformed card without dropping the unit', () => {
    const mixed = JSON.stringify({
      units: [{ name: 'One', cards: [{ q: 'Good?', a: 'Yes.' }, { q: 'No answer' }, { a: 'no q' }] }],
    });
    expect(readPlan(mixed, guide()).guide.units[0].cards).toHaveLength(1);
  });

  it('keeps the old glossary when none comes back', () => {
    const bare = JSON.stringify({ units: [{ name: 'One', cards: [{ q: 'a', a: 'b' }] }] });
    expect(readPlan(bare, guide()).guide.terms).toEqual(guide().terms);
  });

  it('does not define a term twice', () => {
    const dupes = JSON.stringify({
      units: [{ name: 'One', cards: [{ q: 'a', a: 'b' }] }],
      terms: [{ t: 'Scarcity', d: 'One' }, { t: 'scarcity', d: 'Two' }],
    });
    expect(readPlan(dupes, guide()).guide.terms).toHaveLength(1);
  });
});

describe('survey', () => {
  it('counts a question kept word for word as kept', () => {
    const after = { ...guide(), units: guide().units };
    const s = survey(guide(), after);
    expect(s.kept).toBe(2);
    expect(s.reworded).toBe(0);
    expect(s.dropped).toBe(0);
    expect(s.fresh).toBe(0);
  });

  it('counts a reworded question as lost, not as kept', () => {
    // The app hashes the question text, so a reworded card is a card it has
    // never seen — the streak and the due date go with the wording.
    const before = guide();
    const after = {
      ...before,
      units: [
        { name: 'One', mastery: 0, cards: [{ q: 'What does scarcity mean?', a: 'x' }] },
        before.units[1],
      ],
    };
    const s = survey(before, after);
    expect(s.kept).toBe(1);
    expect(s.reworded).toBe(1);
    expect(s.dropped).toBe(0);
  });

  it('separates a question that simply vanished from one that was reworded', () => {
    const before = guide();
    const after = { ...before, units: [before.units[0]] };
    const s = survey(before, after);
    expect(s.kept).toBe(1);
    expect(s.reworded).toBe(0);
    expect(s.dropped).toBe(1);
  });

  it('counts genuinely new questions', () => {
    const before = guide();
    const after = {
      ...before,
      units: [...before.units, { name: 'Three', mastery: 0, cards: [{ q: 'New?', a: 'Yes.' }] }],
    };
    expect(survey(before, after).fresh).toBe(1);
  });

  it('does not treat whitespace as the same question, because the hash does not', () => {
    const before = guide();
    const after = {
      ...before,
      units: [
        { name: 'One', mastery: 0, cards: [{ q: 'What is  scarcity?', a: 'x' }] },
        before.units[1],
      ],
    };
    expect(survey(before, after).kept).toBe(1);
  });
});

describe('verdict', () => {
  it('says plainly when nothing is lost', () => {
    const said = verdict({ kept: 12, reworded: 0, dropped: 0, fresh: 4, unitsBefore: 3, unitsAfter: 4, examples: [] });
    expect(said).toContain('nothing you have drilled is lost');
  });

  it('leads with the cost when there is one', () => {
    const said = verdict({ kept: 8, reworded: 3, dropped: 1, fresh: 5, unitsBefore: 3, unitsAfter: 4, examples: [] });
    expect(said).toContain('loses the answers you have given it');
    expect(said).toContain('3 look reworded');
    expect(said).toContain('1 are gone');
  });
});
