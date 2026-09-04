import { describe, expect, it } from 'vitest';
import {
  bandFor,
  examsAhead,
  headline,
  isExam,
  paperLine,
  runway,
  stageFor,
  standing,
  weakest,
  type UnitState,
} from './runway';
import type { DatedItem } from './types';
import type { Sitting } from './sitting';

const NOW = new Date(2026, 8, 3, 9, 0); // Thursday 3 September 2026

const item = (over: Partial<DatedItem>): DatedItem =>
  ({
    id: 'i1',
    c: 'econ',
    title: 'Midterm 1',
    kind: 'Exam',
    weight: '25%',
    daysAway: 21,
    date: new Date(2026, 8, 24),
    ...over,
  }) as DatedItem;

const unit = (over: Partial<UnitState> = {}): UnitState => ({
  name: 'Unit',
  cards: 10,
  seen: 10,
  due: 0,
  ...over,
});

const paper = (over: Partial<Sitting>): Sitting =>
  ({
    id: 's1',
    courseId: 'econ',
    title: 'Paper',
    at: NOW.getTime(),
    minutes: 30,
    got: 0,
    outOf: 100,
    pct: 50,
    code: '',
    missed: [],
    ...over,
  }) as Sitting;

const base = { units: [], papers: [], others: [] };

describe('the bands', () => {
  it('are the distances where the work differs in kind', () => {
    expect(bandFor(40)).toBe('far');
    expect(bandFor(21)).toBe('three');
    expect(bandFor(12)).toBe('two');
    expect(bandFor(5)).toBe('one');
    expect(bandFor(2)).toBe('days');
    expect(bandFor(0)).toBe('today');
    expect(bandFor(-1)).toBe('past');
  });

  it('name the shape of the work without prescribing it', () => {
    expect(stageFor(21).shape).toMatch(/finding out what you do not know/);
    expect(stageFor(2).shape).toMatch(/Rehearsal/);
  });

  it('start the runway at four weeks, and say so', () => {
    expect(stageFor(40).shape).toMatch(/four weeks/);
  });
});

describe('what counts as an exam', () => {
  it('takes the obvious names', () => {
    expect(isExam({ kind: 'Exam', title: 'Midterm 1', weight: '' })).toBe(true);
    expect(isExam({ kind: '', title: 'Final', weight: '' })).toBe(true);
    expect(isExam({ kind: 'Quiz', title: 'Unit test', weight: '' })).toBe(true);
  });

  it('takes anything heavy enough to be one in all but name', () => {
    expect(isExam({ kind: 'Project', title: 'Group case', weight: '30%' })).toBe(true);
  });

  it('leaves a problem set alone', () => {
    expect(isExam({ kind: 'Problem set', title: 'PS4', weight: '5%' })).toBe(false);
  });

  it('is not fooled by a weight it cannot read', () => {
    expect(isExam({ kind: 'Reading', title: 'Ch. 4', weight: 'see syllabus' })).toBe(false);
  });
});

describe('the headline', () => {
  it('says how long, and what is in the way', () => {
    const r = runway({ ...base, exam: item({ daysAway: 21 }) });
    expect(headline(r)).toBe('21 days, and nothing else due before it.');
  });

  it('counts the things standing between now and it', () => {
    const r = runway({
      ...base,
      exam: item({ daysAway: 21 }),
      others: [item({ id: 'a', daysAway: 3 }), item({ id: 'b', daysAway: 10 })],
    });
    expect(headline(r)).toBe('21 days, with 2 other deadlines in the way.');
  });

  it('does not count the exam as standing in its own way', () => {
    const exam = item({ id: 'x', daysAway: 21 });
    expect(runway({ ...base, exam, others: [exam] }).between).toEqual([]);
  });

  it('does not count something falling after it', () => {
    const r = runway({ ...base, exam: item({ daysAway: 10 }), others: [item({ id: 'a', daysAway: 30 })] });
    expect(r.between).toEqual([]);
  });

  it('handles today and the past', () => {
    expect(headline(runway({ ...base, exam: item({ daysAway: 0 }) }))).toBe('Today.');
    expect(headline(runway({ ...base, exam: item({ daysAway: -2 }) }))).toBe('Sat.');
    expect(headline(runway({ ...base, exam: item({ daysAway: 1 }) }))).toBe(
      'Tomorrow, and nothing else due before it.',
    );
  });
});

describe('days you could actually work', () => {
  it('takes out the days another deadline stands on', () => {
    const r = runway({
      ...base,
      exam: item({ daysAway: 10 }),
      others: [item({ id: 'a', daysAway: 3 }), item({ id: 'b', daysAway: 5 })],
    });
    // Ten days, less the exam's own day, less two spoken for.
    expect(r.clearDays).toBe(7);
  });

  it('counts two deadlines on the same day as one lost day', () => {
    const r = runway({
      ...base,
      exam: item({ daysAway: 10 }),
      others: [item({ id: 'a', daysAway: 3 }), item({ id: 'b', daysAway: 3 })],
    });
    expect(r.clearDays).toBe(8);
  });

  it('never goes below zero', () => {
    expect(runway({ ...base, exam: item({ daysAway: 0 }) }).clearDays).toBe(0);
  });
});

describe('where you stand', () => {
  it('says nothing when the course has no cards', () => {
    expect(standing(runway({ ...base, exam: item({}) }))).toBe('');
    expect(standing(runway({ ...base, exam: item({}), units: [unit({ cards: 0 })] }))).toBe(
      'This course has no cards to drill.',
    );
  });

  it('does not read an empty history as evidence', () => {
    const r = runway({ ...base, exam: item({}), units: [unit({ seen: 0 }), unit({ seen: 0 })] });
    expect(standing(r)).toBe('2 units, and you have not drilled any of them yet.');
  });

  it('counts untouched units, unseen cards and cards due back', () => {
    const r = runway({
      ...base,
      exam: item({}),
      units: [unit({ seen: 10 }), unit({ seen: 0 }), unit({ seen: 6, due: 3 })],
    });
    expect(standing(r)).toBe('1 of 3 units untouched, 14 cards never answered, 3 due back.');
  });

  it('says so plainly when there is nothing outstanding', () => {
    const r = runway({ ...base, exam: item({}), units: [unit(), unit()] });
    expect(standing(r)).toBe('Every card in this course has been answered at least once.');
  });
});

describe('which unit to open', () => {
  it('prefers one never touched over one merely behind', () => {
    const r = runway({
      ...base,
      exam: item({}),
      units: [unit({ name: 'Behind', seen: 2, due: 5 }), unit({ name: 'Never', seen: 0 })],
    });
    expect(weakest(r)?.name).toBe('Never');
  });

  it('then takes the one with most outstanding', () => {
    const r = runway({
      ...base,
      exam: item({}),
      units: [unit({ name: 'A', seen: 9 }), unit({ name: 'B', seen: 3 })],
    });
    expect(weakest(r)?.name).toBe('B');
  });

  it('offers nothing when nothing is outstanding', () => {
    expect(weakest(runway({ ...base, exam: item({}), units: [unit()] }))).toBeNull();
  });
});

describe('the practice papers', () => {
  it('admits when there are none', () => {
    expect(paperLine(runway({ ...base, exam: item({}) }))).toMatch(/No practice papers/);
  });

  it('states a single one without pretending to a trend', () => {
    const r = runway({ ...base, exam: item({}), papers: [paper({ pct: 62 })] });
    expect(paperLine(r)).toBe('One paper sat, at 62%.');
  });

  it('reads the movement from the first to the latest', () => {
    const r = runway({
      ...base,
      exam: item({}),
      papers: [paper({ id: 'a', at: 1, pct: 50 }), paper({ id: 'b', at: 2, pct: 71 })],
    });
    expect(paperLine(r)).toBe('2 papers, latest 71% — up 21 from the first.');
  });

  it('says level rather than inventing a direction', () => {
    const r = runway({
      ...base,
      exam: item({}),
      papers: [paper({ id: 'a', at: 1, pct: 60 }), paper({ id: 'b', at: 2, pct: 60 })],
    });
    expect(paperLine(r)).toMatch(/level/);
  });
});

describe('choosing a runway', () => {
  it('lists exams ahead, soonest first', () => {
    const items = [
      item({ id: 'far', daysAway: 40 }),
      item({ id: 'soon', daysAway: 6 }),
      item({ id: 'ps', kind: 'Problem set', title: 'PS4', weight: '5%', daysAway: 2 }),
      item({ id: 'gone', daysAway: -3 }),
    ];
    expect(examsAhead(items, {}).map((i) => i.id)).toEqual(['soon', 'far']);
  });

  it('leaves out one already ticked', () => {
    const items = [item({ id: 'soon', daysAway: 6 })];
    expect(examsAhead(items, { soon: true })).toEqual([]);
  });
});
