import { describe, expect, it } from 'vitest';
import {
  addItem,
  blankCourse,
  blankItem,
  courseId,
  dropItem,
  fromInputDate,
  gaps,
  itemId,
  patchItem,
  toInputDate,
  weightNote,
  weightTotal,
  withCourse,
  withGrading,
} from './edit';
import type { CourseModule, Item } from './types';

const item = (id: string, month: number, day: number): Item =>
  ({
    id,
    c: 'econ',
    title: id,
    kind: 'Paper',
    month,
    day,
    dueTime: '11:59p',
    weight: '',
    where: '',
    detail: '',
    quote: '',
    source: 'Syllabus',
  }) as Item;

const module = (over: Partial<CourseModule> = {}): CourseModule =>
  ({
    course: {
      id: 'econ',
      code: 'ECON 1020',
      name: 'Macro',
      prof: 'Dr. Stromme',
      email: 'a@b.edu',
      meets: 'MWF',
      room: 'Buttrick 101',
      credits: '3',
      source: 'syllabus.pdf',
      grading: [{ what: 'Exams', pct: '60%' }],
    },
    items: [item('b', 9, 2), item('a', 8, 14)],
    schedule: [{ days: [1], at: 550, time: '9:10a', title: 'Lecture', meta: '' }],
    guide: {
      code: 'ECON 1020',
      name: 'Macro',
      blurb: '',
      source: '',
      mastery: 0,
      audio: false,
      units: [],
      terms: [],
    },
    planMinutes: '20 min',
    frameLabel: 'x',
    ...over,
  }) as CourseModule;

describe('itemId', () => {
  it('does not collide with what is already there', () => {
    const existing = [item('econ-own1', 8, 1), item('econ-own2', 8, 2)];
    expect(existing.some((i) => i.id === itemId('econ', existing))).toBe(false);
  });
});

describe('blankItem', () => {
  it('does not claim to come from the syllabus', () => {
    // "Straight from the syllabus" must never sit above something typed.
    expect(blankItem('econ', []).source).toBe('Added by you');
    expect(blankItem('econ', []).quote).toBe('');
  });

  it('starts on today', () => {
    const now = new Date(2026, 8, 3);
    const made = blankItem('econ', [], now);
    expect(made.month).toBe(8);
    expect(made.day).toBe(3);
  });
});

describe('withCourse', () => {
  it('carries a rename into the guide as well', () => {
    // The guide holds its own copy for screens that show it without a course;
    // leaving it behind is how half the app keeps the old name.
    const out = withCourse(module(), { code: 'ECON 1010', name: 'Micro' });
    expect(out.guide.code).toBe('ECON 1010');
    expect(out.guide.name).toBe('Micro');
  });

  it('does not mutate what it was given', () => {
    const before = module();
    withCourse(before, { code: 'X' });
    expect(before.course.code).toBe('ECON 1020');
  });
});

describe('items', () => {
  it('keeps them in date order after an addition', () => {
    const out = addItem(module(), item('c', 7, 30));
    expect(out.items.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('re-sorts when a date is moved, not just when one is added', () => {
    // A paper pushed back a month has to move in the list too.
    const out = patchItem(module(), 'a', { month: 10, day: 1 });
    expect(out.items.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('drops one without touching the others', () => {
    const out = dropItem(module(), 'a');
    expect(out.items.map((i) => i.id)).toEqual(['b']);
  });

  it('leaves the original alone', () => {
    const before = module();
    dropItem(before, 'a');
    expect(before.items).toHaveLength(2);
  });
});

describe('weightTotal', () => {
  it('adds the percentages up', () => {
    expect(weightTotal([{ what: 'a', pct: '60%' }, { what: 'b', pct: '40%' }])).toBe(100);
  });

  it('is null when nothing reads as a percentage', () => {
    // A course graded on points or letters is not wrong, and flagging it would
    // train people to ignore the warning that matters.
    expect(weightTotal([{ what: 'a', pct: 'Pass/Fail' }])).toBeNull();
    expect(weightTotal([])).toBeNull();
  });

  it('ignores a row with no percentage rather than counting it as zero', () => {
    expect(weightTotal([{ what: 'a', pct: '60%' }, { what: 'b', pct: 'see below' }])).toBe(60);
  });
});

describe('weightNote', () => {
  it('says nothing when there is nothing to say', () => {
    expect(weightNote([{ what: 'a', pct: 'Pass/Fail' }])).toBe('');
  });

  it('confirms a hundred', () => {
    expect(weightNote([{ what: 'a', pct: '100%' }])).toBe('Adds up to 100%.');
  });

  it('says how much is missing, and how much is over', () => {
    expect(weightNote([{ what: 'a', pct: '60%' }])).toContain('40% unaccounted for');
    expect(weightNote([{ what: 'a', pct: '110%' }])).toContain('10% over');
  });
});

describe('date fields', () => {
  it('round-trips through the input format', () => {
    const iso = toInputDate(8, 14, 2026);
    expect(iso).toBe('2026-09-14');
    expect(fromInputDate(iso)).toEqual({ month: 8, day: 14 });
  });

  it('refuses a date it cannot read rather than returning month zero', () => {
    expect(fromInputDate('')).toBeNull();
    expect(fromInputDate('14/09/2026')).toBeNull();
    expect(fromInputDate('2026-13-01')).toBeNull();
  });
});

describe('gaps', () => {
  it('says nothing about a complete course', () => {
    expect(gaps(module())).toEqual([]);
  });

  it('names what is missing and why it matters', () => {
    const bare = module({
      course: { ...module().course, room: '', grading: [] },
      items: [],
    });
    const found = gaps(bare).join(' ');
    expect(found).toContain('no directions');
    expect(found).toContain('Grades cannot work');
    expect(found).toContain('no deadlines');
  });
});

describe('withGrading', () => {
  it('replaces the rows without disturbing the rest of the course', () => {
    const out = withGrading(module(), [{ what: 'Final', pct: '100%' }]);
    expect(out.course.grading).toHaveLength(1);
    expect(out.course.code).toBe('ECON 1020');
    expect(out.items).toHaveLength(2);
  });
});

describe('courseId', () => {
  it('is the code, and nothing else', () => {
    // This is the whole point of slugging rather than generating an id: type
    // the course today, import the syllabus next week, keep every tick. The
    // two paths disagreed until now — "econ1020" here and "econ-1020" out of
    // the importer — so the sentence above was a comment rather than a fact.
    expect(courseId('ECON 1020')).toBe('econ-1020');
    expect(courseId('  psci 1104 ')).toBe('psci-1104');
    expect(blankCourse('ECON 1020').course.id).toBe(courseId('ECON 1020'));
  });

  it('steps aside for an id already in use', () => {
    // The bug this exists to stop: every PSCI syllabus the model read came
    // back wanting the id `psci`, so a second PSCI course landed on top of the
    // first and every screen keyed by course id served one course's office
    // hours, deadlines and guide under the other's name.
    expect(courseId('PSCI 2200', ['psci-2200'])).toBe('psci-2200-2');
    expect(courseId('PSCI 2200', ['psci-2200', 'psci-2200-2'])).toBe('psci-2200-3');
    expect(blankCourse('PSCI 2200', undefined, ['psci-2200']).course.id).toBe('psci-2200-2');
  });

  it('leaves an unrelated id alone', () => {
    expect(courseId('ECON 1020', ['psci-1104', 'core-2500'])).toBe('econ-1020');
  });
});

describe('blankCourse', () => {

  it('states no grade weights it was not told', () => {
    // An invented "Exams 50%" would be read as fact by every grade screen.
    expect(blankCourse('ECON 1020').course.grading).toEqual([]);
  });

  it('is complete enough for the screens that read a course', () => {
    const made = blankCourse('CORE 2500', '2026FA');
    expect(made.course.term).toBe('2026FA');
    expect(made.guide.units).toEqual([]);
    expect(made.schedule).toEqual([]);
    expect(made.planMinutes).toBeTruthy();
    expect(made.frameLabel).toBeTruthy();
  });

  it('still makes a course when the code is all punctuation', () => {
    expect(blankCourse('???').course.id).toMatch(/^course/);
  });
});
