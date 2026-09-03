import { describe, expect, it } from 'vitest';
import { diff, keepIds, movedLine, summary, ticksKept } from './rediff';
import type { CourseModule, GradeRow, Item } from './types';

const YEAR = 2026;

const item = (id: string, title: string, month: number, day: number): Item =>
  ({
    id,
    c: 'econ',
    title,
    kind: 'Paper',
    month,
    day,
    dueTime: '11:59p',
    weight: '',
    where: '',
    detail: '',
    quote: '',
    source: '',
  }) as Item;

const module = (
  items: Item[],
  grading: GradeRow[] = [],
  course: Partial<CourseModule['course']> = {},
): CourseModule =>
  ({
    course: {
      id: 'econ',
      code: 'ECON 1020',
      name: 'Principles',
      prof: 'Dr Ito',
      email: 'ito@example.edu',
      meets: 'MWF',
      room: 'Buttrick 101',
      credits: '3',
      source: 'syllabus.pdf',
      grading,
      ...course,
    },
    items,
    schedule: [],
    guide: { code: 'ECON 1020', name: 'Principles', units: [], terms: [] },
    planMinutes: '45',
    frameLabel: 'Frames',
  }) as unknown as CourseModule;

describe('diff', () => {
  it('finds a deadline whose date moved', () => {
    const d = diff(
      module([item('a', 'Problem Set 3', 8, 10)]),
      module([item('x', 'Problem Set 3', 8, 17)]),
      YEAR,
    );
    expect(d.moved).toHaveLength(1);
    expect(d.moved[0].days).toBe(7);
    expect(d.removed).toEqual([]);
    expect(d.added).toEqual([]);
  });

  it('finds one that was reworded but kept its date', () => {
    const d = diff(
      module([item('a', 'Reflection #1', 8, 10)]),
      module([item('x', 'Reflection 1 — play', 8, 10)]),
      YEAR,
    );
    expect(d.renamed).toHaveLength(1);
    expect(d.moved).toEqual([]);
  });

  it('counts an unchanged item rather than reporting it', () => {
    const d = diff(
      module([item('a', 'Final exam', 11, 10)]),
      module([item('x', 'Final exam', 11, 10)]),
      YEAR,
    );
    expect(d.same).toBe(1);
    expect(d.identical).toBe(true);
  });

  it('reports a deadline that disappeared, which is the one people lose', () => {
    const d = diff(module([item('a', 'Quiz 7', 9, 1)]), module([]), YEAR);
    expect(d.removed.map((i) => i.title)).toEqual(['Quiz 7']);
  });

  it('reports a removal and an addition rather than a confident wrong rename', () => {
    const d = diff(
      module([item('a', 'Reflection #1', 8, 10)]),
      module([item('x', 'Group presentation', 8, 10)]),
      YEAR,
    );
    expect(d.renamed).toEqual([]);
    expect(d.removed).toHaveLength(1);
    expect(d.added).toHaveLength(1);
  });

  it('keeps two items in a numbered series apart', () => {
    const d = diff(
      module([item('a', 'Problem Set 1', 8, 10), item('b', 'Problem Set 2', 8, 17)]),
      module([item('x', 'Problem Set 1', 8, 12), item('y', 'Problem Set 2', 8, 19)]),
      YEAR,
    );
    expect(d.moved).toHaveLength(2);
    expect(d.moved.map((m) => m.before.id)).toEqual(['a', 'b']);
  });

  it('finds a corrected weighting', () => {
    const d = diff(
      module([], [{ what: 'Exams', pct: '40%' }]),
      module([], [{ what: 'Exams', pct: '45%' }]),
      YEAR,
    );
    expect(d.reweighted).toEqual([{ what: 'Exams', before: '40%', after: '45%' }]);
  });

  it('treats a re-worded grading row as one dropped and one added', () => {
    // The weights may not correspond, so pretending it is the same row with a
    // new name would be a claim the file does not support.
    const d = diff(
      module([], [{ what: 'Exams', pct: '40%' }]),
      module([], [{ what: 'Examinations', pct: '40%' }]),
      YEAR,
    );
    expect(d.gradingRemoved).toHaveLength(1);
    expect(d.gradingAdded).toHaveLength(1);
    expect(d.reweighted).toEqual([]);
  });

  it('finds a changed room or professor and ignores what did not change', () => {
    const d = diff(module([]), module([], [], { room: 'Wilson 103' }), YEAR);
    expect(d.fields).toEqual([{ field: 'Room', before: 'Buttrick 101', after: 'Wilson 103' }]);
  });

  it('says plainly when two imports are the same', () => {
    expect(diff(module([]), module([]), YEAR).identical).toBe(true);
  });
});

describe('keepIds', () => {
  it('gives a surviving item back the id its tick is filed under', () => {
    // Without this, re-importing a syllabus silently un-ticks everything you
    // had already done.
    const before = module([item('old-1', 'Problem Set 3', 8, 10)]);
    const after = module([item('fresh-9', 'Problem Set 3', 8, 17)]);
    expect(keepIds(before, after).items[0].id).toBe('old-1');
  });

  it('leaves a genuinely new item with its new id', () => {
    const before = module([]);
    const after = module([item('fresh-9', 'Surprise quiz', 8, 17)]);
    expect(keepIds(before, after).items[0].id).toBe('fresh-9');
  });

  it('keeps the course id, or the copy would sit beside the original', () => {
    const before = module([]);
    const after = module([], [], { id: 'econ-abc123' });
    expect(keepIds(before, after).course.id).toBe('econ');
  });

  it('files every item against the course that is being replaced', () => {
    const after = module([item('x', 'Quiz', 8, 1)], [], { id: 'econ-abc123' });
    for (const i of keepIds(module([]), after).items) expect(i.c).toBe('econ');
  });
});

describe('ticksKept', () => {
  it('counts what survives and what does not', () => {
    const before = module([
      item('a', 'Problem Set 3', 8, 10),
      item('b', 'Quiz 7', 9, 1),
      item('c', 'Not ticked', 9, 2),
    ]);
    const after = module([item('x', 'Problem Set 3', 8, 17)]);
    expect(ticksKept(before, after, { a: true, b: true })).toEqual({ kept: 1, lost: 1 });
  });

  it('is zero either way when nothing was ticked', () => {
    expect(ticksKept(module([item('a', 'X', 8, 1)]), module([]), {})).toEqual({ kept: 0, lost: 0 });
  });
});

describe('summary', () => {
  it('leads with what is gone', () => {
    const d = diff(
      module([item('a', 'Quiz 7', 9, 1), item('b', 'Paper', 9, 5)]),
      module([item('y', 'Paper', 9, 12)]),
      YEAR,
    );
    expect(summary(d)).toBe('1 gone, 1 moved.');
  });

  it('says nothing changed rather than an empty list', () => {
    expect(summary(diff(module([]), module([]), YEAR))).toBe('Nothing has changed.');
  });

  it('counts every grading change together', () => {
    const d = diff(
      module([], [{ what: 'Exams', pct: '40%' }]),
      module([], [{ what: 'Exams', pct: '45%' }, { what: 'Quizzes', pct: '10%' }]),
      YEAR,
    );
    expect(summary(d)).toContain('2 to the grading');
  });
});

describe('movedLine', () => {
  it('says which way and by how much', () => {
    const d = diff(
      module([item('a', 'Paper', 8, 10)]),
      module([item('x', 'Paper', 8, 11)]),
      YEAR,
    );
    expect(movedLine(d.moved[0])).toBe('1 day later');
  });
});
