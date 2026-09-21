import { describe, expect, it } from 'vitest';
import { categoryFor, scoresIn } from './readout';
import { COMMON_LETTER } from './cutoffs';

/**
 * A photograph proposes a number somebody then files as their grade.
 *
 * Every test here is about what is *not* offered. Reading "92%" off a clean
 * line is the easy half and the half that cannot do damage; the half that can
 * is a reader that hands back the first number on the page, because a score
 * screen is mostly not scores and the student tapping the suggestion has no
 * reason to doubt it.
 */

const SYSTEM = COMMON_LETTER;
const read = (text: string) => scoresIn(text, SYSTEM);
const saw = (text: string) => read(text).map((f) => f.saw);

/**
 * A Top Hat page, near enough.
 *
 * The join code is the point: `782449` is the real code out of
 * `data/courses/psci/index.ts`, it is six digits, and it sits two lines from
 * the grade on every Top Hat screen this app's own courses would produce.
 */
const TOP_HAT = `Top Hat
PSCI 1104 — Section 01
Join code 782449
Week 5 of 14
Attendance: 13/14
Participation score 92%
Questions answered 47`;

describe('reading a score off a photographed screen', () => {
  it('reads a percentage and a fraction off the lines that carry them', () => {
    const found = saw(TOP_HAT);
    expect(found).toContain('92%');
    expect(found).toContain('13/14');
  });

  it('does not offer the join code, or the week, or the section', () => {
    // The whole reason this file refuses more than it reads. A student who
    // tapped `782449` would file a 782,449% attendance mark.
    const found = saw(TOP_HAT);
    expect(found).not.toContain('782449');
    expect(found).not.toContain('5');
    expect(found).not.toContain('14 ');
    expect(found).not.toContain('01');
  });

  it('gives every candidate the line it came from, to tell two of a kind apart', () => {
    const found = read('Quiz average 88%\nExam average 88%');
    expect(found).toHaveLength(2);
    expect(found[0].line).toContain('Quiz');
    expect(found[1].line).toContain('Exam');
  });

  it('reads what it offers through the same reader the field uses', () => {
    const [found] = read('Attendance: 13/14');
    expect(found.reading.pct).toBeCloseTo((13 / 14) * 100, 6);
    expect(found.reading.how).toBe('fraction');
  });
});

describe('a bare number, which needs the line to say what it is', () => {
  it('is offered when the line names a score', () => {
    expect(saw('Total points 84')).toContain('84');
    expect(saw('Your grade 91')).toContain('91');
  });

  it('is not offered when the line names anything else', () => {
    // The control for the rule above: the same shape of line, the same shape
    // of number, and nothing about it that means a mark.
    expect(saw('Room 231')).toEqual([]);
    expect(saw('Enrolled 240 students')).toEqual([]);
    expect(saw('Fall 2026')).toEqual([]);
    expect(saw('Due 11:59 PM')).toEqual([]);
  });

  it('is not offered twice when it is already inside a percentage', () => {
    const found = saw('Overall score 92%');
    expect(found).toEqual(['92%']);
  });
});

describe('what is refused outright', () => {
  it('refuses a number too large to be a mark, whatever the line says', () => {
    expect(saw('Total points 782449')).toEqual([]);
    expect(saw('Score 99999')).toEqual([]);
  });

  it('keeps extra credit, which really does go over a hundred', () => {
    // The other side of that ceiling: `lib/grades.ts` counts a bonus, so a
    // reader that capped at 100 would drop a real mark.
    expect(saw('Participation score 103%')).toContain('103%');
  });

  it('says nothing about a photograph with no numbers in it', () => {
    expect(read('Top Hat\nNo grades posted yet')).toEqual([]);
    expect(read('')).toEqual([]);
  });
});

describe('a letter grade', () => {
  it('is read where the line says it is a grade', () => {
    const [found] = read('Course grade: B+');
    expect(found.saw).toBe('B+');
    // Through `lib/score.ts`, which takes the bottom of the band on purpose.
    expect(found.reading.how).toBe('letter');
    expect(found.reading.pct).toBe(87);
  });

  it('is not read out of an ordinary word', () => {
    // "A" and "F" are letters and most lines have some. Without this the
    // reader offers a grade for every sentence on the page.
    expect(saw('Grade posted for a section')).not.toContain('A');
    expect(saw('Final grade F')).toContain('F');
  });
});

describe('which category a line is about', () => {
  const CATEGORIES = [
    'Six quizzes, 5% each',
    'Midterm — Oct 15, in class',
    'Final — Dec 17, 9–11a',
    'Attendance (Top Hat 782449)',
  ];
  const which = (line: string) => categoryFor(line, CATEGORIES);

  it('ties a line to the category that shares its words', () => {
    expect(which('Attendance: 13/14')).toBe(3);
    expect(which('Midterm score 88%')).toBe(1);
    expect(which('Quizzes average 91%')).toBe(0);
  });

  it('proposes nothing when no word is shared', () => {
    // A chooser that opens on an arbitrary category invites the tap that
    // files a mark there.
    expect(which('Participation score 92%')).toBeNull();
    expect(which('Week 5 of 14')).toBeNull();
    expect(which('')).toBeNull();
  });

  it('proposes nothing on a tie, rather than the first of two', () => {
    expect(categoryFor('Quiz average 88%', ['Quiz section', 'Quiz participation'])).toBeNull();
  });

  it('is not fooled by the words every gradebook line carries', () => {
    // "Score", "total" and "grade" are on nearly every line of a score
    // screen. Matching on them would tie the first candidate to whichever
    // category happened to mention one.
    expect(categoryFor('Total score 88', ['Total points earned', 'Final exam'])).toBeNull();
  });

  it('reads Top Hat off a category that names it, which is the case that asked', () => {
    expect(categoryFor('Top Hat participation 92%', ['Problem sets', 'Top Hat participation'])).toBe(1);
  });
});
