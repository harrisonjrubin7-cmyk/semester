import { describe, expect, it } from 'vitest';
import {
  SYSTEM,
  SYSTEM_ONE,
  brief,
  oneUnit,
  readOneUnit,
  readPlan,
  storedUnit,
  survey,
  verdict,
} from './rework';
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

describe('regenerating one unit', () => {
  const reply = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      name: '2 · Supply and its shifters',
      cards: [
        { q: 'What shifts supply?', a: 'Costs, technology.' },
        { q: 'What is a supply shock?', a: 'A sudden change in input costs.' },
      ],
      terms: [{ t: 'Supply shock', d: 'A sudden change in input costs.' }],
      notes: ['Added a card on shocks from the week-seven reading.'],
      ...over,
    });

  it('shows the other units as names only, so nothing is moved or duplicated', () => {
    const said = oneUnit(guide(), [], 1);
    expect(said).toContain('1 · What economics is');
    // Unit 1's card must not be in the brief: sending it invites the model to
    // move it, and costs tokens for context it does not need.
    expect(said).not.toContain('What is scarcity?');
    expect(said).toContain('What shifts supply?');
    expect(said).toContain('← THE ONE TO REVISE');
  });

  it('leaves out material filed against another unit', () => {
    expect(oneUnit(guide(), [update({ unit: 0, body: 'ONLY-IN-UNIT-ONE' })], 1)).not.toContain(
      'ONLY-IN-UNIT-ONE',
    );
  });

  it('refuses a unit that is not in the guide rather than guessing at one', () => {
    expect(() => oneUnit(guide(), [], 9)).toThrow();
    expect(() => readOneUnit(reply(), guide(), 9)).toThrow();
  });

  it('replaces the one unit and returns the rest untouched', () => {
    const { guide: after } = readOneUnit(reply(), guide(), 1);
    expect(after.units).toHaveLength(2);
    expect(after.units[0]).toEqual(guide().units[0]);
    expect(after.units[1].name).toBe('2 · Supply and its shifters');
    expect(after.units[1].cards).toHaveLength(2);
  });

  /*
   * The boundary the whole scoped path rests on, enforced in code rather than
   * asked for in the prompt: a model that decides to reorganise the course
   * changes nothing but the unit it was asked about.
   */
  it('ignores extra units the model returns, and anything else it renames', () => {
    const wild = JSON.stringify({
      name: 'Renamed',
      cards: [{ q: 'What shifts supply?', a: 'Costs, technology.' }],
      units: [{ name: 'A whole new structure', cards: [] }],
      blurb: 'A blurb it was not asked for',
      code: 'NOT 1010',
    });
    const { guide: after } = readOneUnit(wild, guide(), 1);
    expect(after.units).toHaveLength(2);
    expect(after.blurb).toBe(guide().blurb);
    expect(after.code).toBe('ECON 1020');
  });

  it('folds new terms in and keeps the definition the guide already had', () => {
    const { guide: after } = readOneUnit(
      reply({
        terms: [
          { t: 'Scarcity', d: 'A DIFFERENT DEFINITION' },
          { t: 'Supply shock', d: 'A sudden change.' },
        ],
      }),
      guide(),
      1,
    );
    expect(after.terms.find((t) => t.t === 'Scarcity')?.d).toBe('Wants exceed means.');
    expect(after.terms.map((t) => t.t)).toContain('Supply shock');
  });

  it('never drops a term the rest of the guide uses', () => {
    expect(readOneUnit(reply({ terms: [] }), guide(), 1).guide.terms).toEqual(guide().terms);
  });

  // The one outcome worse than not regenerating at all.
  it('refuses to replace a unit with nothing', () => {
    expect(() => readOneUnit(reply({ cards: [] }), guide(), 1)).toThrow(/no cards/);
    expect(() => readOneUnit('not json at all', guide(), 1)).toThrow();
    expect(() => readOneUnit('{"name":"x"}', guide(), 1)).toThrow(/no cards/);
  });

  it('keeps the old name when none comes back', () => {
    expect(readOneUnit(reply({ name: '  ' }), guide(), 1).guide.units[1].name).toBe('2 · Supply');
  });

  it('resets the unit’s declared mastery, which is measured and never stated', () => {
    const { guide: after } = readOneUnit(reply(), guide(), 1);
    expect(after.units[1].mastery).toBe(0);
    // The untouched unit keeps its own, because nothing about it changed.
    expect(after.units[0].mastery).toBe(40);
  });

  it('reports what it changed', () => {
    expect(readOneUnit(reply(), guide(), 1).notes).toEqual([
      'Added a card on shocks from the week-seven reading.',
    ]);
  });

  /*
   * The point of scoping it: the same cost preview, over far less. A card
   * whose wording changes loses its answer history, and here only one unit's
   * wording is even at risk.
   */
  it('is measured by the same survey, and leaves the other unit’s history alone', () => {
    const before = guide();
    const s = survey(before, readOneUnit(reply(), before, 1).guide);
    expect(s.kept).toBe(2);
    expect(s.reworded).toBe(0);
    expect(s.dropped).toBe(0);
    expect(s.fresh).toBe(1);
  });

  it('tells the model to stay inside the unit, and why the others are shown', () => {
    expect(SYSTEM_ONE).toContain('Stay inside the unit');
    expect(SYSTEM_ONE).toContain('do not return any other unit');
    // Carried over verbatim from the whole-guide path — a scoped rework must
    // not be the one that loses a semester of drilling.
    expect(SYSTEM_ONE).toContain('EXACTLY as written');
    expect(SYSTEM_ONE).toContain('Never invent');
  });
});

describe('the unit on screen is not the unit on disk', () => {
  /*
   * `mergeGuide` splices an unfiled update in as a unit of its own at the
   * session it names, so the guide a person is looking at can have more units
   * than the one stored, and every unit at or after an insertion is displayed
   * one higher than it is stored. `CourseUpdate.unit` is a stored index.
   * Assuming the two were the same number sent the wrong week's reading to
   * the model — silently, because the result still looked like a unit.
   */
  it('shifts a displayed index back past every insertion before it', () => {
    expect(storedUnit(0, [])).toBe(0);
    expect(storedUnit(3, [])).toBe(3);
    // One unit spliced in at 1: displayed 2 is stored 1, displayed 5 is 4.
    expect(storedUnit(0, [1])).toBe(0);
    expect(storedUnit(2, [1])).toBe(1);
    expect(storedUnit(5, [1])).toBe(4);
    // Two insertions, at 1 and 4.
    expect(storedUnit(6, [1, 4])).toBe(4);
  });

  it('says an inserted unit has no stored counterpart', () => {
    expect(storedUnit(1, [1])).toBeNull();
    expect(storedUnit(4, [1, 4])).toBeNull();
  });

  it('sends the material filed against the stored unit, not the displayed one', () => {
    const g = guide();
    // Displayed unit 1 is stored unit 0 once something is spliced in at 0.
    const filed = update({ id: 'u0', unit: 0, body: 'BELONGS-TO-STORED-ZERO' });
    const other = update({ id: 'u1', unit: 1, body: 'BELONGS-TO-STORED-ONE' });
    const said = oneUnit(g, [filed, other], 1, storedUnit(1, [0]));
    expect(said).toContain('BELONGS-TO-STORED-ZERO');
    expect(said).not.toContain('BELONGS-TO-STORED-ONE');
  });

  it('sends only unfiled material for a unit that was spliced in', () => {
    const g = guide();
    const said = oneUnit(
      g,
      [update({ id: 'u1', unit: 1, body: 'FILED-SOMEWHERE' }), update({ id: 'u2', unit: null, body: 'UNFILED' })],
      1,
      storedUnit(1, [1]),
    );
    expect(said).toContain('UNFILED');
    expect(said).not.toContain('FILED-SOMEWHERE');
  });

  it('behaves as it did when nothing was spliced in', () => {
    const g = guide();
    const ups = [update({ id: 'u1', unit: 1, body: 'FILED-AT-ONE' })];
    expect(oneUnit(g, ups, 1, storedUnit(1, []))).toContain('FILED-AT-ONE');
    // The default keeps every caller that has no merge to consult working.
    expect(oneUnit(g, ups, 1)).toContain('FILED-AT-ONE');
  });
});
