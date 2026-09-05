import { describe, expect, it } from 'vitest';
import {
  ARCHIVED_LINE,
  asTaken,
  closing,
  isArchived,
  nextTerm,
  offerLine,
  readyLine,
  type Closing,
} from './rollover';
import { gpa, COMMON_SCALE } from './degree';
import type { CourseModule } from './types';
import { LEGACY_TERM } from './term';

const mod = (id: string, code: string, term: string, credits = '3'): CourseModule =>
  ({ course: { id, code, name: `${code} course`, term, credits } }) as CourseModule;

const row = (over: Partial<Closing> = {}): Closing => ({
  courseId: 'econ',
  code: 'ECON 1020',
  title: 'Principles',
  hours: 3,
  grade: '',
  ...over,
});

describe('what comes next', () => {
  it('rolls autumn into the following spring', () => {
    expect(nextTerm('2026FA').id).toBe('2027SP');
  });

  it('rolls spring into the same year’s autumn', () => {
    expect(nextTerm('2027SP').id).toBe('2027FA');
  });

  it('sends a summer session back to the autumn rather than to a winter one', () => {
    // Somebody closing a summer term is going back to the ordinary year, and
    // offering a winter session they do not take is a wrong default in the
    // one place a wrong default is annoying to undo.
    expect(nextTerm('2027SU').id).toBe('2027FA');
    expect(nextTerm('2027WI').id).toBe('2028SP');
  });

  it('does not fall over on something unreadable', () => {
    expect(nextTerm('nonsense').id).toMatch(/^\d{4}(SP|SU|FA|WI)$/);
  });
});

describe('the courses being closed', () => {
  const modules = [
    mod('psci', 'PSCI 1104', '2026FA'),
    mod('econ', 'ECON 1020', '2026FA', '4'),
    mod('next', 'BUS 2100', '2027SP'),
  ];

  it('takes only that term’s', () => {
    expect(closing(modules, '2026FA', {}).map((r) => r.code)).toEqual(['ECON 1020', 'PSCI 1104']);
  });

  it('reads the credit hours the course states', () => {
    expect(closing(modules, '2026FA', {})[0].hours).toBe(4);
  });

  it('carries a grade already typed', () => {
    expect(closing(modules, '2026FA', { econ: 'A-' })[0].grade).toBe('A-');
  });

  it('finds a course saved before terms existed', () => {
    // Those carry no `term` at all and belong to the legacy term. Comparing
    // against an empty string matched none of them, which made the feature
    // say "no courses" for the one person it was built for.
    const old = [{ course: { id: 'econ', code: 'ECON 1020', name: 'Principles', credits: '3' } } as CourseModule];
    expect(closing(old, LEGACY_TERM, {})).toHaveLength(1);
  });

  it('says nothing rather than something for a term with no courses', () => {
    expect(closing(modules, '2030FA', {})).toEqual([]);
    expect(offerLine([], '2030FA')).toContain('No courses');
  });
});

describe('what it writes into the record', () => {
  it('never invents a grade', () => {
    // The app holds a projection off a syllabus a model read. The transcript
    // holds what the registrar awarded. Writing one into the other would put a
    // fabricated grade into a cumulative GPA and nobody would ever know.
    const out = asTaken([row(), row({ courseId: 'psci', code: 'PSCI 1104' })], '2026FA');
    for (const t of out) expect(t.grade).toBe('');
  });

  it('files an ungraded course as still in progress', () => {
    const out = asTaken([row()], '2026FA');
    expect(out[0].current).toBe(true);
  });

  it('keeps an ungraded course out of the GPA entirely', () => {
    // `lib/degree.ts` already does this; the point is that closing a term
    // early cannot drag a cumulative figure down with blanks.
    const out = asTaken([row({ grade: 'A' }), row({ courseId: 'psci', code: 'PSCI 1104' })], '2026FA');
    const g = gpa(out, COMMON_SCALE);
    expect(g?.hours).toBe(3);
    expect(g?.gpa).toBe(4);
  });

  it('labels the term the way a person reads it', () => {
    expect(asTaken([row({ grade: 'B+' })], '2026FA')[0].term).toBe('Fall 2026');
  });

  it('gives each row an id that cannot collide across terms', () => {
    const fall = asTaken([row({ grade: 'A' })], '2026FA')[0];
    const spring = asTaken([row({ grade: 'A' })], '2027SP')[0];
    expect(fall.id).not.toBe(spring.id);
  });
});

describe('what it says before the button is pressed', () => {
  it('says how many, and that the projection is not used', () => {
    const said = offerLine([row(), row({ courseId: 'psci' })], '2026FA');
    expect(said).toContain('2 courses in Fall 2026');
    expect(said).toContain('projection is not a transcript');
    expect(said).toContain('Spring 2027 starts empty');
  });

  it('says nothing is deleted, because that is the actual worry', () => {
    expect(offerLine([row()], '2026FA')).toContain('Nothing is deleted');
    expect(ARCHIVED_LINE).toContain('does not delete');
  });

  it('is honest about closing with no grades typed', () => {
    expect(readyLine([row(), row()])).toContain('Nothing typed yet');
    expect(readyLine([row(), row()])).toContain('you can put them in later');
  });

  it('says which ones will be left out', () => {
    expect(readyLine([row({ grade: 'A' }), row()])).toContain('1 of 2');
    expect(readyLine([row({ grade: 'A' }), row()])).toContain('stay out of the GPA');
  });

  it('adds the hours up when everything is in', () => {
    expect(readyLine([row({ grade: 'A' }), row({ grade: 'B', hours: 4 })])).toContain('7 credit hours');
  });
});

describe('an archived term', () => {
  it('is the ones that were closed and nothing else', () => {
    expect(isArchived('2026FA', ['2026FA'])).toBe(true);
    expect(isArchived('2027SP', ['2026FA'])).toBe(false);
    expect(isArchived('2026FA', [])).toBe(false);
  });
});
