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

  it('puts the boundary for added units past the end', () => {
    expect(mergeGuide(guide(), []).firstAddedUnit).toBe(2);
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
    expect(out.firstAddedUnit).toBe(2);
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
    expect(out.firstAddedUnit).toBe(1);
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
