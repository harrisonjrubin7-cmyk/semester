import { describe, expect, it } from 'vitest';
import {
  applyDateConflictChoices,
  applyReimportConflictChoices,
  dateConflicts,
  diff,
  keepIds,
  movedLine,
  summary,
  ticksKept,
  unresolvedDateConflictIds,
  unresolvedReimportConflictIds,
} from './rediff';
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

  it('reports a reworded title independently when its date also moved', () => {
    const d = diff(
      module([item('a', 'Reflection #1', 8, 10)]),
      module([item('x', 'Reflection 1 — play', 8, 17)]),
      YEAR,
    );
    expect(d.moved).toHaveLength(1);
    expect(d.renamed).toHaveLength(1);
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

  it('preserves local term and AI-policy controls that are not extracted fields', () => {
    const before = module([], [], {
      term: '2026FA',
      ai: { stance: 'limited', note: 'Brainstorming only' },
    });
    const kept = keepIds(before, module([]));
    expect(kept.course.term).toBe('2026FA');
    expect(kept.course.ai).toEqual({ stance: 'limited', note: 'Brainstorming only' });
  });

  it('files every item against the course that is being replaced', () => {
    const after = module([item('x', 'Quiz', 8, 1)], [], { id: 'econ-abc123' });
    for (const i of keepIds(module([]), after).items) expect(i.c).toBe('econ');
  });
});

describe('date conflict choices', () => {
  const before = module([
    item('move-me', 'Problem Set 3', 8, 10),
    item('keep-me', 'Quiz 7', 9, 1),
  ]);
  const after = module([item('fresh-id', 'Problem Set 3', 8, 17)]);

  it('names every moved or removed deadline and refuses an incomplete decision map', () => {
    const changes = diff(before, after, YEAR);
    expect(dateConflicts(changes).map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'removed:keep-me', kind: 'removed' },
      { id: 'moved:move-me', kind: 'moved' },
    ]);
    expect(unresolvedDateConflictIds(changes, { 'moved:move-me': 'use_imported' })).toEqual([
      'removed:keep-me',
    ]);
    expect(unresolvedDateConflictIds(changes, { 'moved:move-me': 'unexpected' } as never)).toEqual([
      'removed:keep-me',
      'moved:move-me',
    ]);
    expect(() => applyDateConflictChoices(before, after, YEAR, {})).toThrow(/Every moved or removed date/);
  });

  it('keeps a current moved date and restores a removed reminder when explicitly chosen', () => {
    const merged = applyDateConflictChoices(before, after, YEAR, {
      'moved:move-me': 'keep_current',
      'removed:keep-me': 'keep_current',
    });
    expect(merged.items.map(({ id, month, day }) => ({ id, month, day }))).toEqual([
      { id: 'move-me', month: 8, day: 10 },
      { id: 'keep-me', month: 9, day: 1 },
    ]);
  });

  it('uses the imported move and accepts removal only after explicit choices', () => {
    const merged = applyDateConflictChoices(before, after, YEAR, {
      'moved:move-me': 'use_imported',
      'removed:keep-me': 'use_imported',
    });
    expect(merged.items.map(({ id, month, day }) => ({ id, month, day }))).toEqual([
      { id: 'move-me', month: 8, day: 17 },
    ]);
  });

  it('uses each item year when a re-import crosses a calendar year', () => {
    const current = module([{ ...item('a', 'Final exam', 11, 15), year: 2026 }]);
    const imported = module([{ ...item('b', 'Final exam', 0, 15), year: 2027 }]);
    expect(diff(current, imported, YEAR).moved[0].days).toBe(31);
  });
});

describe('course and grading conflict choices', () => {
  const before = module([], [
    { what: 'Exams', pct: '40%' },
    { what: 'Essays', pct: '30%' },
  ]);
  const after = module([], [
    { what: 'Exams', pct: '45%' },
    { what: 'Projects', pct: '20%' },
  ], { room: 'Wilson 103', lms: 'https://canvas.example.edu/courses/1020' });

  it('requires a choice for every changed field and grading row', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual([
      'field:Room',
      'field:Course site',
      'grading:reweighted:Exams',
      'grading:removed:Essays',
      'grading:added:Projects',
    ]);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {
      'field:Room': 'use_imported',
      'field:Course site': 'use_imported',
      'grading:reweighted:Exams': 'use_imported',
      'grading:removed:Essays': 'use_imported',
    })).toThrow(/Every re-import source conflict/);
  });

  it('applies mixed explicit choices without silently accepting another source', () => {
    const merged = applyReimportConflictChoices(before, after, YEAR, {
      'field:Room': 'keep_current',
      'field:Course site': 'keep_current',
      'grading:reweighted:Exams': 'use_imported',
      'grading:removed:Essays': 'keep_current',
      'grading:added:Projects': 'keep_current',
    });
    expect(merged.course.room).toBe('Buttrick 101');
    expect(merged.course.lms).toBeUndefined();
    expect(merged.course.grading).toEqual([
      { what: 'Exams', pct: '45%' },
      { what: 'Essays', pct: '30%' },
    ]);
  });

  it('uses all imported metadata and grading only after explicit choices', () => {
    const merged = applyReimportConflictChoices(before, after, YEAR, {
      'field:Room': 'use_imported',
      'field:Course site': 'use_imported',
      'grading:reweighted:Exams': 'use_imported',
      'grading:removed:Essays': 'use_imported',
      'grading:added:Projects': 'use_imported',
    });
    expect(merged.course.room).toBe('Wilson 103');
    expect(merged.course.lms).toBe('https://canvas.example.edu/courses/1020');
    expect(merged.course.grading).toEqual(after.course.grading);
  });
});

describe('title conflict choices', () => {
  const before = module([item('current-id', 'Reflection #1', 8, 10)]);
  const after = module([item('fresh-id', 'Reflection 1 — play', 8, 17)]);

  it('requires independent choices for a reworded title and moved date', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual([
      'moved:current-id',
      'title:current-id',
    ]);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {
      'moved:current-id': 'use_imported',
    })).toThrow(/Every re-import source conflict/);
  });

  it('preserves the stable id while applying title and date choices independently', () => {
    const keepTitle = applyReimportConflictChoices(before, after, YEAR, {
      'moved:current-id': 'use_imported',
      'title:current-id': 'keep_current',
    });
    expect(keepTitle.items[0]).toMatchObject({
      id: 'current-id',
      title: 'Reflection #1',
      month: 8,
      day: 17,
    });

    const keepDate = applyReimportConflictChoices(before, after, YEAR, {
      'moved:current-id': 'keep_current',
      'title:current-id': 'use_imported',
    });
    expect(keepDate.items[0]).toMatchObject({
      id: 'current-id',
      title: 'Reflection 1 — play',
      month: 8,
      day: 10,
    });
  });
});

describe('due-time conflict choices', () => {
  const before = module([item('current-id', 'Reflection #1', 8, 10)]);
  const afterItem = { ...item('fresh-id', 'Reflection 1 — play', 8, 17), dueTime: '5:00p' };
  const after = module([afterItem]);

  it('requires a choice independent of a reworded title and moved date', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual([
      'moved:current-id',
      'title:current-id',
      'time:current-id',
    ]);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {
      'moved:current-id': 'use_imported',
      'title:current-id': 'use_imported',
    })).toThrow(/Every re-import source conflict/);
  });

  it('preserves the stable id while applying time, title, and date choices independently', () => {
    const keepTime = applyReimportConflictChoices(before, after, YEAR, {
      'moved:current-id': 'use_imported',
      'title:current-id': 'use_imported',
      'time:current-id': 'keep_current',
    });
    expect(keepTime.items[0]).toMatchObject({
      id: 'current-id',
      title: 'Reflection 1 — play',
      month: 8,
      day: 17,
      dueTime: '11:59p',
    });

    const keepDateAndTitle = applyReimportConflictChoices(before, after, YEAR, {
      'moved:current-id': 'keep_current',
      'title:current-id': 'keep_current',
      'time:current-id': 'use_imported',
    });
    expect(keepDateAndTitle.items[0]).toMatchObject({
      id: 'current-id',
      title: 'Reflection #1',
      month: 8,
      day: 10,
      dueTime: '5:00p',
    });
  });
});

describe('deadline-kind conflict choices', () => {
  const beforeItem = { ...item('current-id', 'Midterm', 9, 8), kind: 'Paper' };
  const afterItem = { ...item('fresh-id', 'Midterm', 9, 8), kind: 'Exam' };
  const before = module([beforeItem]);
  const after = module([afterItem]);

  it('requires a stable explicit choice when the imported deadline kind changes', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual(['kind:current-id']);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {})).toThrow(/Every re-import source conflict/);
  });

  it('applies either source only after a choice and preserves the stable item id', () => {
    const kept = applyReimportConflictChoices(before, after, YEAR, {
      'kind:current-id': 'keep_current',
    });
    expect(kept.items[0]).toMatchObject({ id: 'current-id', kind: 'Paper' });

    const imported = applyReimportConflictChoices(before, after, YEAR, {
      'kind:current-id': 'use_imported',
    });
    expect(imported.items[0]).toMatchObject({ id: 'current-id', kind: 'Exam' });
  });
});

describe('deadline-weight conflict choices', () => {
  const beforeItem = { ...item('current-id', 'Midterm', 9, 8), weight: '20% of grade' };
  const afterItem = { ...item('fresh-id', 'Midterm', 9, 8), weight: '25% of grade' };
  const before = module([beforeItem]);
  const after = module([afterItem]);

  it('requires a stable explicit choice separate from course-level grading rows', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual(['weight:current-id']);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {})).toThrow(/Every re-import source conflict/);
  });

  it('applies either source only after a choice and preserves the stable item id', () => {
    const kept = applyReimportConflictChoices(before, after, YEAR, {
      'weight:current-id': 'keep_current',
    });
    expect(kept.items[0]).toMatchObject({ id: 'current-id', weight: '20% of grade' });

    const imported = applyReimportConflictChoices(before, after, YEAR, {
      'weight:current-id': 'use_imported',
    });
    expect(imported.items[0]).toMatchObject({ id: 'current-id', weight: '25% of grade' });
  });
});

describe('deadline-location conflict choices', () => {
  const beforeItem = { ...item('current-id', 'Midterm', 9, 8), where: 'Buttrick 101' };
  const afterItem = { ...item('fresh-id', 'Midterm', 9, 8), where: 'Wilson 103' };
  const before = module([beforeItem]);
  const after = module([afterItem]);

  it('requires a stable explicit choice separate from course room metadata', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual(['where:current-id']);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {})).toThrow(/Every re-import source conflict/);
  });

  it('applies either source only after a choice and preserves the stable item id', () => {
    const kept = applyReimportConflictChoices(before, after, YEAR, {
      'where:current-id': 'keep_current',
    });
    expect(kept.items[0]).toMatchObject({ id: 'current-id', where: 'Buttrick 101' });

    const imported = applyReimportConflictChoices(before, after, YEAR, {
      'where:current-id': 'use_imported',
    });
    expect(imported.items[0]).toMatchObject({ id: 'current-id', where: 'Wilson 103' });
  });
});

describe('deadline-detail conflict choices', () => {
  const beforeItem = { ...item('current-id', 'Midterm', 9, 8), detail: 'Chapters 1–4; bring a calculator.' };
  const afterItem = { ...item('fresh-id', 'Midterm', 9, 8), detail: 'Chapters 1–5; one note card allowed.' };
  const before = module([beforeItem]);
  const after = module([afterItem]);

  it('requires a stable explicit choice separate from citation provenance', () => {
    const changes = diff(before, after, YEAR);
    expect(unresolvedReimportConflictIds(changes, {})).toEqual(['detail:current-id']);
    expect(() => applyReimportConflictChoices(before, after, YEAR, {})).toThrow(/Every re-import source conflict/);
  });

  it('applies either source only after a choice and preserves the stable item id', () => {
    const kept = applyReimportConflictChoices(before, after, YEAR, {
      'detail:current-id': 'keep_current',
    });
    expect(kept.items[0]).toMatchObject({ id: 'current-id', detail: 'Chapters 1–4; bring a calculator.' });

    const imported = applyReimportConflictChoices(before, after, YEAR, {
      'detail:current-id': 'use_imported',
    });
    expect(imported.items[0]).toMatchObject({ id: 'current-id', detail: 'Chapters 1–5; one note card allowed.' });
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
