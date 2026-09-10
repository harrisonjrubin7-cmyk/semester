import { describe, expect, it } from 'vitest';
import { applyReviews, extraFigures, forCourse, mergeFigures, mergeGuide } from './live';
import { cardKey } from './review';
import type { Reviews } from './review';
import type { CourseUpdate, Figure, FigureMap, Guide, StudyCard } from './types';

/**
 * The guide as it stands today, which is the only guide any screen sees.
 *
 * No screen holds its own copy: the cards, the reading view, the quiz pool,
 * the cram sheet, the figures and the lesson are all derived here, at read
 * time. That is what makes adding material to a unit reach all of them at
 * once — and it is also why a mistake here is not a mistake on one screen but
 * on every study screen in the app.
 *
 * The tests that matter most are about not losing things. What a student adds
 * is theirs: a reading the professor posted in week six, a photograph of the
 * board. Dropping one silently is worse than any crash, because nothing says
 * it happened and there is nothing to report.
 */

const card = (q: string): StudyCard => ({ q, a: `answer to ${q}` });

/**
 * The file behind a figure, or nothing.
 *
 * `Figure` is a union — a bar chart from the guide has no file behind it, only
 * an image does — so these read through a narrowing rather than asserting.
 */
const fileOf = (f: Figure | undefined): string | undefined =>
  f && f.type === 'image' ? f.fileId : undefined;

const guide = (over: Partial<Guide> = {}): Guide => ({
  code: 'ECON 1020',
  name: 'Principles of Microeconomics',
  blurb: '',
  source: 'Econ.pdf',
  mastery: 50,
  audio: false,
  units: [
    { name: 'Supply', mastery: 80, cards: [card('s1'), card('s2')] },
    { name: 'Demand', mastery: 40, cards: [card('d1')] },
  ],
  terms: [{ t: 'Elasticity', d: 'How much quantity moves' }],
  ...over,
});

const update = (over: Partial<CourseUpdate> = {}): CourseUpdate => ({
  id: 'u1',
  courseId: 'econ',
  unit: 0,
  title: 'Week 6 reading',
  source: 'posted.pdf',
  body: '',
  created: 1,
  cards: [card('new')],
  terms: [],
  fileIds: [],
  ...over,
});

describe('forCourse', () => {
  it('takes only this course’s updates, oldest first', () => {
    const mine = forCourse(
      [
        update({ id: 'c', courseId: 'econ', created: 30 }),
        update({ id: 'a', courseId: 'psci', created: 10 }),
        update({ id: 'b', courseId: 'econ', created: 20 }),
      ],
      'econ',
    );
    expect(mine.map((u) => u.id)).toEqual(['b', 'c']);
  });

  it('gives back nothing for a course with no updates', () => {
    expect(forCourse([update({ courseId: 'psci' })], 'econ')).toEqual([]);
    expect(forCourse([], 'econ')).toEqual([]);
  });

  it('does not disturb the list it was given', () => {
    const list = [update({ id: 'b', created: 20 }), update({ id: 'a', created: 10 })];
    forCourse(list, 'econ');
    expect(list.map((u) => u.id)).toEqual(['b', 'a']);
  });
});

describe('mergeGuide with nothing added', () => {
  it('hands the guide back as it was', () => {
    const out = mergeGuide(guide(), []);
    expect(out.units.map((u) => u.name)).toEqual(['Supply', 'Demand']);
    expect(out.units[0].mastery).toBe(80);
    expect(out.added).toEqual({});
  });

  it('records how big each unit started, for the "what is new" strips', () => {
    expect(mergeGuide(guide(), []).baseCards).toEqual([2, 1]);
  });

  it('marks nothing as added when nothing was', () => {
    expect(mergeGuide(guide(), []).addedUnits).toEqual([]);
  });
});

describe('mergeGuide with material added to a unit', () => {
  it('appends the cards to the unit they were filed against', () => {
    const out = mergeGuide(guide(), [update({ unit: 1, cards: [card('extra')] })]);
    expect(out.units[1].cards.map((c) => c.q)).toEqual(['d1', 'extra']);
    expect(out.units[0].cards).toHaveLength(2);
  });

  it('keeps them identifiable rather than blending them in', () => {
    // The app says what is new. Without this it could only say the unit got
    // bigger, which is not the same thing.
    const out = mergeGuide(guide(), [update({ unit: 1, cards: [card('extra')] })]);
    expect(out.added[1].map((c) => c.q)).toEqual(['extra']);
    expect(out.baseCards[1]).toBe(1);
  });

  it('dilutes mastery by what has not been seen yet', () => {
    /*
     * Two cards at 80% plus two you have never opened is not still 80%. If the
     * app pretended otherwise the unit would drop out of tonight's plan at
     * exactly the moment it should be climbing it.
     */
    const out = mergeGuide(guide(), [update({ unit: 0, cards: [card('n1'), card('n2')] })]);
    expect(out.units[0].mastery).toBe(40);
  });

  it('rounds dilution down, so a unit never looks warmer than it is', () => {
    const out = mergeGuide(guide(), [update({ unit: 1, cards: [card('n1'), card('n2')] })]);
    // 40% across one card, now three: 13.3, kept at 13.
    expect(out.units[1].mastery).toBe(13);
  });

  it('gathers several updates on one unit', () => {
    const out = mergeGuide(guide(), [
      update({ id: 'a', unit: 0, cards: [card('n1')] }),
      update({ id: 'b', unit: 0, cards: [card('n2')] }),
    ]);
    expect(out.added[0].map((c) => c.q)).toEqual(['n1', 'n2']);
    expect(out.units[0].cards).toHaveLength(4);
  });

  it('leaves a unit alone when an update adds no cards to it', () => {
    const out = mergeGuide(guide(), [update({ unit: 0, cards: [] })]);
    expect(out.units[0].mastery).toBe(80);
    expect(out.units[0].cards).toHaveLength(2);
  });

  it('folds added terms into the glossary', () => {
    const out = mergeGuide(guide(), [
      update({ terms: [{ t: 'Deadweight loss', d: 'The triangle' }] }),
    ]);
    expect(out.terms.map((x) => x.t)).toEqual(['Elasticity', 'Deadweight loss']);
  });
});

describe('mergeGuide with material filed against no unit', () => {
  it('gives it a unit of its own at the end, named after the update', () => {
    const out = mergeGuide(guide(), [update({ unit: null, title: 'Posted reading' })]);
    expect(out.units.map((u) => u.name)).toEqual(['Supply', 'Demand', 'Posted reading']);
    expect(out.addedUnits).toEqual([2]);
  });

  it('names an untitled one rather than leaving a blank heading', () => {
    const out = mergeGuide(guide(), [update({ unit: null, title: '' })]);
    expect(out.units[2].name).toBe('Added material');
  });

  it('starts it unmastered, and says it added nothing to begin with', () => {
    const out = mergeGuide(guide(), [update({ unit: null })]);
    expect(out.units[2].mastery).toBe(0);
    expect(out.baseCards[2]).toBe(0);
    expect(out.added[2]).toHaveLength(1);
  });

  it('makes no empty unit for an update that is only a photograph', () => {
    const out = mergeGuide(guide(), [update({ unit: null, cards: [], fileIds: ['photo'] })]);
    expect(out.units).toHaveLength(2);
  });
});

describe('mergeGuide when the unit an update named has gone', () => {
  /*
   * A guide can get shorter. Re-import a syllabus after the professor trims
   * the reading list, and the update filed against unit 5 still says 5.
   *
   * Those cards used to be keyed into `added` at an index nothing rendered:
   * present in the data, on no screen, with nothing said. A student who
   * photographed the board and was told it was added would simply not find it.
   */
  const shorter = guide({ units: [{ name: 'Supply', mastery: 80, cards: [card('s1')] }] });

  it('keeps the cards rather than dropping them on the floor', () => {
    const out = mergeGuide(shorter, [update({ unit: 5, title: 'Week 6 reading' })]);
    expect(out.units.flatMap((u) => u.cards.map((c) => c.q))).toContain('new');
  });

  it('puts them in a unit of their own, like material filed against none', () => {
    const out = mergeGuide(shorter, [update({ unit: 5, title: 'Week 6 reading' })]);
    expect(out.units.map((u) => u.name)).toEqual(['Supply', 'Week 6 reading']);
    expect(out.addedUnits).toEqual([1]);
  });

  it('leaves nothing pointing past the end of the units', () => {
    const out = mergeGuide(shorter, [update({ unit: 5 })]);
    for (const key of Object.keys(out.added)) expect(Number(key)).toBeLessThan(out.units.length);
  });

  it('treats a negative unit the same way', () => {
    const out = mergeGuide(shorter, [update({ unit: -1, title: 'Stray' })]);
    expect(out.units.map((u) => u.name)).toEqual(['Supply', 'Stray']);
  });
});

describe('applyReviews', () => {
  /** One card answered correctly a few times, as the scheduler would record it. */
  const answered = (courseId: string, q: string): Reviews => ({
    [cardKey(courseId, q)]: {
      right: 4,
      wrong: 0,
      streak: 4,
      ease: 2.5,
      interval: 10,
      seen: Date.now(),
      due: Date.now() + 10 * 86_400_000,
    },
  });

  it('measures a unit from the answers rather than the guide’s claim', () => {
    const out = applyReviews(mergeGuide(guide(), []), 'econ', answered('econ', 's1'), Date.now());
    expect(out.units[0].mastery).not.toBe(80);
  });

  it('leaves an empty guide alone rather than dividing by nothing', () => {
    const empty = mergeGuide(guide({ units: [], mastery: 30 }), []);
    expect(applyReviews(empty, 'econ', {}, Date.now())).toEqual(empty);
  });

  it('does not read one course’s answers into another’s guide', () => {
    // Card keys carry the course, so two courses asking the same question do
    // not share a score.
    const mine = applyReviews(mergeGuide(guide(), []), 'econ', answered('psci', 's1'), Date.now());
    const none = applyReviews(mergeGuide(guide(), []), 'econ', {}, Date.now());
    expect(mine.units[0].mastery).toBe(none.units[0].mastery);
  });

  it('weights the guide’s figure by how big each unit is', () => {
    const out = applyReviews(mergeGuide(guide(), []), 'econ', {}, Date.now());
    const total = out.units.reduce((n, u) => n + u.cards.length, 0);
    const expected = Math.round(
      out.units.reduce((n, u) => n + u.mastery * u.cards.length, 0) / total,
    );
    expect(out.mastery).toBe(expected);
  });
});

describe('mergeFigures', () => {
  const withFigure: FigureMap = {
    0: { type: 'image', title: 'The guide’s own diagram', caption: '', fileId: 'guide-fig' },
  };

  it('puts your photograph on the unit you filed it against', () => {
    const out = mergeFigures({}, [update({ unit: 1, fileIds: ['mine'] })]);
    expect(fileOf(out[1])).toBe('mine');
  });

  it('says the picture is yours, and where it came from', () => {
    const out = mergeFigures({}, [update({ unit: 1, fileIds: ['mine'], source: 'board.jpg' })]);
    expect(out[1]?.caption).toBe('Added — board.jpg');
  });

  it('never displaces the guide’s own diagram', () => {
    const out = mergeFigures(withFigure, [update({ unit: 0, fileIds: ['mine'] })]);
    expect(fileOf(out[0])).toBe('guide-fig');
  });

  it('ignores an update with no image on it', () => {
    expect(mergeFigures({}, [update({ unit: 1, fileIds: [] })])).toEqual({});
  });

  it('leaves the map alone when there is nothing to add', () => {
    expect(mergeFigures(withFigure, [])).toBe(withFigure);
  });
});

describe('worked examples, the last thing that could not be added to', () => {
  const own = [{ tag: 'Elasticity', t: 'The dining plan', d: 'Inelastic demand, in one place.' }];
  const mine = { tag: 'Externalities', t: 'The reading’s own case', d: 'What it works through.' };

  it('folds yours in beside the module’s', () => {
    const g = mergeGuide(guide(), [update({ cards: [], examples: [mine] })], own);
    expect(g.examples.map((e) => e.t)).toEqual(['The dining plan', 'The reading’s own case']);
    expect(g.addedLong.examples).toBe(1);
  });

  it('keeps the module’s when there is nothing to add', () => {
    expect(mergeGuide(guide(), [], own).examples).toEqual(own);
    expect(mergeGuide(guide(), [update({ cards: [] })], own).examples).toEqual(own);
  });

  it('does not list one twice, because the tab keys on the title', () => {
    const g = mergeGuide(guide(), [update({ cards: [], examples: [own[0]] })], own);
    expect(g.examples).toHaveLength(1);
    expect(g.addedLong.examples).toBe(0);
  });

  it('is an empty list, never undefined, so a count never reads NaN', () => {
    expect(mergeGuide(guide(), []).examples).toEqual([]);
  });
});

describe('where an added unit lands', () => {
  const numbered = (): Guide =>
    guide({
      units: [
        { name: '0 · How to actually pass this class', mastery: 50, cards: [card('a')] },
        { name: '3 · Optimization', mastery: 50, cards: [card('b')] },
        { name: '7 · Externalities', mastery: 50, cards: [card('c')] },
      ],
    });

  const names = (g: Guide, ups: CourseUpdate[]) => mergeGuide(g, ups).units.map((u) => u.name);

  it('sits by the session it names, not on the end', () => {
    // The bug: "Session 4 slides" posted in week four went after unit 7, where
    // three weeks of material it comes before buried it.
    expect(names(numbered(), [update({ unit: null, title: 'Session 4 slides' })])).toEqual([
      '0 · How to actually pass this class',
      '3 · Optimization',
      '4 · Session 4 slides',
      '7 · Externalities',
    ]);
  });

  it('lands behind the guide’s own unit for the same session', () => {
    // The guide's is the lecture, yours is what you read afterwards.
    expect(names(numbered(), [update({ unit: null, title: 'Session 3 reading' })])[2])
      .toBe('3 · Session 3 reading');
  });

  it('reads the number out of the source when the title has none', () => {
    expect(names(numbered(), [update({ unit: null, title: 'Posted', source: 'week 4 handout.pdf' })])[2])
      .toBe('4 · Posted');
  });

  it('still goes on the end when nothing names a session', () => {
    const out = names(numbered(), [update({ unit: null, title: 'Posted reading' })]);
    expect(out[out.length - 1]).toBe('Posted reading');
  });

  it('keeps two readings for different sessions in order', () => {
    expect(
      names(numbered(), [
        update({ id: 'a', unit: null, title: 'Session 8 reading' }),
        update({ id: 'b', unit: null, title: 'Session 1 reading' }),
      ]),
    ).toEqual([
      '0 · How to actually pass this class',
      '1 · Session 1 reading',
      '3 · Optimization',
      '7 · Externalities',
      '8 · Session 8 reading',
    ]);
  });

  it('keeps the cards with the unit they were inserted in front of', () => {
    /*
     * The part most likely to be got wrong. `added` and `baseCards` are keyed
     * by index, so inserting in the middle has to move every key at or past
     * the insert — otherwise a unit's "what is new here" strip belongs to the
     * unit below it and nobody can see why.
     */
    const out = mergeGuide(numbered(), [
      update({ unit: null, title: 'Session 4 slides', cards: [card('mine')] }),
    ]);
    expect(out.addedUnits).toEqual([2]);
    expect(out.added[2]?.map((c) => c.q)).toEqual(['mine']);
    expect(out.units[2].cards.map((c) => c.q)).toEqual(['mine']);
    // And the guide's own unit that moved down still has its own card.
    expect(out.units[3].name).toBe('7 · Externalities');
    expect(out.units[3].cards.map((c) => c.q)).toEqual(['c']);
    expect(out.baseCards).toEqual([1, 1, 0, 1]);
  });

  it('shifts an earlier insert when a later one lands in front of it', () => {
    const out = mergeGuide(numbered(), [
      update({ id: 'a', unit: null, title: 'Session 8 reading', cards: [card('eight')] }),
      update({ id: 'b', unit: null, title: 'Session 1 reading', cards: [card('one')] }),
    ]);
    expect(out.addedUnits).toEqual([1, 4]);
    expect(out.added[1]?.map((c) => c.q)).toEqual(['one']);
    expect(out.added[4]?.map((c) => c.q)).toEqual(['eight']);
  });

  it('leaves an unnumbered guide exactly as it was', () => {
    expect(names(guide(), [update({ unit: null, title: 'Session 4 slides' })])).toEqual([
      'Supply',
      'Demand',
      'Session 4 slides',
    ]);
  });
});

describe('the field guide and the cram sheet', () => {
  const long = (over: Partial<CourseUpdate> = {}) =>
    update({ cards: [], frames: [{ t: 'The efficiency question', d: 'Why the crossing is efficient.' }], ...over });

  it('gains the frames a reading brought, which is what a cram sheet is', () => {
    // These three fields were the ones adding a reading could not touch, so
    // the guide read in week twelve was the one written in week one.
    const g = mergeGuide(guide({ frames: [{ t: 'Own frame', d: 'x' }] }), [long()]);
    expect(g.frames?.map((f) => f.t)).toEqual(['Own frame', 'The efficiency question']);
    expect(g.addedLong.frames).toBe(1);
  });

  it('gains out-loud questions and cases the same way', () => {
    const g = mergeGuide(guide(), [
      update({
        cards: [],
        selfTest: [{ q: 'Say the whole idea', a: 'Like this.' }],
        cases: [
          {
            title: 'Did zoning follow the grades?',
            when: '1930-1960',
            claim: 'c',
            test: 't',
            verdict: 'v',
            lesson: 'l',
          },
        ],
      }),
    ]);
    expect(g.selfTest).toHaveLength(1);
    expect(g.cases).toHaveLength(1);
    expect(g.addedLong).toEqual({ frames: 0, selfTest: 1, cases: 1, examples: 0 });
  });

  it('does not turn an absent section into an empty one', () => {
    // Three screens test `guide.frames && guide.frames.length`, and an empty
    // array that reads as present is how a heading with nothing under it gets
    // rendered.
    const g = mergeGuide(guide(), [update({ cards: [] })]);
    expect(g.frames).toBeUndefined();
    expect(g.selfTest).toBeUndefined();
    expect(g.cases).toBeUndefined();
  });

  it('never lets a repeat produce two React children with the same key', () => {
    /*
     * The bug this closes, which predates the frames: every one of these lists
     * is rendered with its own text as the key — `key={f.t}`, `key={c.q}`,
     * `key={t.t}`. A reading that restates a term the guide already defines
     * made two children with one key, which React renders wrong and warns
     * about in a console nobody has open. Adding the same reading twice was
     * enough to do it.
     */
    const twice = [long({ id: 'a' }), long({ id: 'b' })];
    const g = mergeGuide(guide({ terms: [{ t: 'Elasticity', d: 'The guide’s own.' }] }), [
      ...twice,
      update({ cards: [], terms: [{ t: 'Elasticity', d: 'A second definition.' }] }),
    ]);
    expect(g.frames).toHaveLength(1);
    expect(new Set(g.terms.map((t) => t.t)).size).toBe(g.terms.length);
    // And the guide's own definition is the one kept.
    expect(g.terms.find((t) => t.t === 'Elasticity')?.d).toBe('The guide’s own.');
  });

  it('counts nothing added when nothing was', () => {
    expect(mergeGuide(guide(), []).addedLong).toEqual({ frames: 0, selfTest: 0, cases: 0, examples: 0 });
  });
});

describe('a figure read out of the material', () => {
  const table = (title = 'Outlays'): Figure => ({
    type: 'bars',
    title,
    caption: 'Federal outlays',
    unit: '%',
    max: 100,
    rows: [
      { l: 'A', v: 21 },
      { l: 'B', v: 14 },
    ],
  });

  it('lands on the unit the reading was filed against', () => {
    // The gap this closes: a reading with a table in it used to produce cards
    // and terms and nothing else, so the Figures tab in week twelve showed
    // exactly what it showed in week one.
    const out = mergeFigures({}, [update({ unit: 1, figures: [table()] })]);
    expect(out[1]).toMatchObject({ type: 'bars', title: 'Outlays' });
  });

  it('says where it came from, the way an added photograph does', () => {
    const out = mergeFigures({}, [update({ unit: 1, figures: [table()], source: 'Reading 7' })]);
    expect(out[1]?.caption).toBe('Federal outlays — Reading 7');
  });

  it('takes the unit ahead of a photograph on the same update', () => {
    // A table the reading contains says more about the unit than a picture of
    // the page it was printed on, and only one of them gets the slot.
    const out = mergeFigures({}, [update({ unit: 1, figures: [table()], fileIds: ['photo'] })]);
    expect(out[1]).toMatchObject({ type: 'bars' });
    // And the photograph is not lost — it goes to the rail.
    const rail = extraFigures([], [update({ unit: 1, figures: [table()], fileIds: ['photo'] })], {});
    expect(rail.map(fileOf)).toEqual(['photo']);
  });

  it('still never displaces the guide’s own figure', () => {
    const mine = [update({ unit: 0, figures: [table()] })];
    expect(fileOf(mergeFigures(withOwn, mine)[0])).toBe('guide-fig');
    expect(extraFigures([], mine, withOwn)).toHaveLength(1);
  });

  it('sends the second and third figures to the rail, in order', () => {
    const mine = [update({ unit: 1, figures: [table('One'), table('Two'), table('Three')] })];
    expect(mergeFigures({}, mine)[1]).toMatchObject({ title: 'One' });
    expect(extraFigures([], mine, {}).map((f) => f.title)).toEqual(['Two', 'Three']);
  });

  it('goes nowhere but the rail when it was filed against no unit', () => {
    const mine = [update({ unit: null, figures: [table()] })];
    expect(mergeFigures({}, mine)).toEqual({});
    expect(extraFigures([], mine, {}).map((f) => f.title)).toEqual(['Outlays']);
  });

  it('is absent on everything added before figures existed', () => {
    // `figures` is optional, and the merge must not read undefined as empty
    // by accident in one place and throw in another.
    expect(mergeFigures({}, [update({ unit: 1, figures: undefined })])).toEqual({});
  });
});

const withOwn: FigureMap = {
  0: { type: 'image', title: 'The guide’s own diagram', caption: '', fileId: 'guide-fig' },
};

describe('which figures belong to one unit', () => {
  const table = (title: string): Figure => ({
    type: 'bars', title, caption: 'c', unit: '%', max: 10,
    rows: [{ l: 'A', v: 1 }, { l: 'B', v: 2 }],
  });

  /** What `useLive` exposes as `figuresOn`, without mounting a component. */
  const on = (base: FigureMap, updates: CourseUpdate[], index: number) => {
    const map = mergeFigures(base, updates);
    const rail = extraFigures([], updates, base);
    const lead = map[index];
    // The screens ask `figuresOn`; this mirrors what it must return, so the
    // assertion is about the arrangement rather than the implementation.
    return { lead, rail };
  };

  it('gives a deck every figure, not just the one the unit leads with', () => {
    // The bug: a slideshow showed `figures[unit]` and ended, so a reading with
    // three tables in it contributed one slide and dropped two, silently.
    const mine = [update({ cards: [], unit: 1, figures: [table('One'), table('Two'), table('Three')] })];
    const { lead, rail } = on({}, mine, 1);
    expect(lead).toMatchObject({ title: 'One' });
    expect(rail.map((f) => f.title)).toEqual(['Two', 'Three']);
  });

  it("keeps the guide’s own leading, with yours behind it", () => {
    const mine = [update({ cards: [], unit: 0, figures: [table('Mine')] })];
    const { lead, rail } = on(withOwn, mine, 0);
    expect(fileOf(lead)).toBe('guide-fig');
    expect(rail.map((f) => f.title)).toEqual(['Mine']);
  });
});

describe('extraFigures', () => {
  const withFigure: FigureMap = {
    0: { type: 'image', title: 'The guide’s own diagram', caption: '', fileId: 'guide-fig' },
  };

  /** Every image that ends up somewhere a person can see it. */
  const shown = (figures: FigureMap, updates: CourseUpdate[]) => [
    ...Object.values(mergeFigures(figures, updates)).map(fileOf),
    ...extraFigures([], updates, figures).map(fileOf),
  ];

  it('shows the images past the first as extras', () => {
    expect(shown({}, [update({ unit: 1, fileIds: ['a', 'b', 'c'] })])).toEqual(['a', 'b', 'c']);
  });

  it('keeps the first image when the unit already has a diagram', () => {
    /*
     * The rule beside `mergeFigures` promises "yours goes to the extras, so
     * the guide's own diagram is never displaced". Half of that was true. The
     * first image was skipped here on the assumption it had been taken as the
     * unit's figure — but it is only taken when the unit has none, so on a
     * unit that already had a diagram it went nowhere at all.
     */
    expect(shown(withFigure, [update({ unit: 0, fileIds: ['mine-a', 'mine-b'] })])).toEqual([
      'guide-fig',
      'mine-a',
      'mine-b',
    ]);
  });

  it('keeps the first image of a second update on the same unit', () => {
    // The same loss, reached without any diagram in the guide: the first
    // update claims the unit, and the second one's first image had nowhere
    // left to go.
    expect(
      shown({}, [
        update({ id: 'a', unit: 0, fileIds: ['first'] }),
        update({ id: 'b', unit: 0, fileIds: ['second'] }),
      ]),
    ).toEqual(['first', 'second']);
  });

  it('shows every image of an update filed against no unit', () => {
    expect(shown({}, [update({ unit: null, fileIds: ['a', 'b'] })])).toEqual(['a', 'b']);
  });

  it('numbers the extras from what is actually shown', () => {
    // An update whose first image is also an extra must not be labelled "(2)"
    // with no "(1)" anywhere.
    const out = extraFigures([], [update({ unit: 0, title: 'Board', fileIds: ['a', 'b'] })], withFigure);
    expect(out.map((f) => f.title)).toEqual(['Board (1)', 'Board (2)']);
  });

  it('numbers them from two when the first became the unit’s figure', () => {
    const out = extraFigures([], [update({ unit: 0, title: 'Board', fileIds: ['a', 'b'] })], {});
    expect(out.map((f) => f.title)).toEqual(['Board (2)']);
  });

  it('leaves the list alone when there is nothing to add', () => {
    const existing = [{ type: 'image' as const, title: 'x', caption: '', fileId: 'x' }];
    expect(extraFigures(existing, [])).toBe(existing);
    expect(extraFigures(existing, [update({ fileIds: [] })])).toBe(existing);
  });
});

describe('material a rebuild has already folded in', () => {
  /*
   * A rebuild folds added material into the guide and saves it, and the
   * updates stay listed — deliberately, so they can still be removed and their
   * files are still attached. Nothing consumed them, so the next render merged
   * the same cards on top of the guide that now contains them: every card from
   * every reading twice, and three times after a second rebuild.
   *
   * This predates scoped rebuilds and applies to the whole-guide one just as
   * much. The scoped path only made it easier to reach, because a rebuild you
   * would actually accept is one you can do without rearranging eleven other
   * units.
   */
  it('is not merged in a second time', () => {
    const baked = guide({
      units: [
        { name: 'Supply', mastery: 80, cards: [card('s1'), card('s2'), card('new')] },
        { name: 'Demand', mastery: 40, cards: [card('d1')] },
      ],
    });
    const out = mergeGuide(baked, [update()]);
    expect(out.units[0].cards.map((c) => c.q)).toEqual(['s1', 's2', 'new']);
  });

  it('still merges what the guide does not have', () => {
    const out = mergeGuide(guide(), [update()]);
    expect(out.units[0].cards.map((c) => c.q)).toEqual(['s1', 's2', 'new']);
  });

  /*
   * A card the rebuild reworded is genuinely a different card — that is what
   * `cardKey` means everywhere else, and it is the same answer the cost
   * preview gives. So it merges, rather than being guessed at as "the same
   * question, differently worded".
   */
  it('treats a reworded question as the different card it is', () => {
    const reworded = guide({
      units: [
        { name: 'Supply', mastery: 80, cards: [card('s1'), card('s2'), card('new, reworded')] },
        { name: 'Demand', mastery: 40, cards: [card('d1')] },
      ],
    });
    expect(mergeGuide(reworded, [update()]).units[0].cards.map((c) => c.q)).toContain('new');
  });

  // The same duplication one level up: an unfiled update becomes a unit of its
  // own, and after a rebuild that unit's cards are in a real unit.
  it('does not splice in a unit for material the guide already holds', () => {
    const baked = guide({
      units: [
        { name: 'Supply', mastery: 80, cards: [card('s1'), card('s2')] },
        { name: 'Demand', mastery: 40, cards: [card('d1')] },
        { name: 'Week 6 reading', mastery: 0, cards: [card('unfiled')] },
      ],
    });
    const out = mergeGuide(baked, [update({ unit: null, cards: [card('unfiled')] })]);
    expect(out.units).toHaveLength(3);
    expect(out.addedUnits).toEqual([]);
  });

  it('still splices one in for material that is genuinely new', () => {
    const out = mergeGuide(guide(), [update({ unit: null, cards: [card('unfiled')] })]);
    expect(out.units).toHaveLength(3);
    expect(out.addedUnits).toHaveLength(1);
  });
});
