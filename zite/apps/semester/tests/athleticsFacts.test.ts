import { test, eq } from './harness';
import { computeFacts, gradePoints, passes } from '../src/lib/athleticsFacts';

const rows = [
  { status: 'Completed', term: 'Spring 2026', credits: 3, grade: 'A' },
  { status: 'Completed', term: 'Spring 2026', credits: 4, grade: 'B-' },
  { status: 'Completed', term: 'Spring 2026', credits: 3, grade: 'F' },
  { status: 'Completed', term: 'Spring 2026', credits: 1, grade: 'P' },
  { status: 'Completed', term: 'Spring 2026', credits: 3, grade: 'W' },
  { status: 'Enrolled', term: 'Fall 2026', credits: 4, grade: null },
  { status: 'Enrolled', term: 'fall 2026 ', credits: 3, grade: null },
  { status: 'Dropped', term: 'Fall 2026', credits: 3, grade: null },
  { status: 'Waitlisted', term: 'Fall 2026', credits: 3, grade: null },
];

test('letter grades map to the 4.0 scale; others are not letter grades', () => eq([gradePoints('a-'), gradePoints('B+'), gradePoints('P'), gradePoints(null)], [3.7, 3.3, null, null]));
test('passing: letters above F and P/S/CR; W and F do not pass', () => eq([passes('D-'), passes('F'), passes('P'), passes('W'), passes(null)], [true, false, true, false, false]));
test('term credits count enrolled and completed courses in the term only (dropped and waitlisted excluded, term matched loosely)', () => eq(computeFacts(rows, 'Fall 2026').term_credits, 7));
test('completed credits count only passing completed courses', () => eq(computeFacts(rows, 'Fall 2026').completed_credits, 8));
test('GPA is credit-weighted over letter grades, F included, P and W excluded', () => eq(computeFacts(rows, 'Fall 2026').cumulative_gpa, Math.round(((4 * 3 + 2.7 * 4 + 0 * 3) / 10) * 100) / 100));
test('no letter-graded work gives no GPA', () => eq(computeFacts([{ status: 'Enrolled', term: 'Fall 2026', credits: 4, grade: null }], 'Fall 2026'), { term_credits: 4, completed_credits: 0, cumulative_gpa: null }));
test('zero or bad credits are ignored', () => eq(computeFacts([{ status: 'Completed', term: 'X', credits: Number.NaN, grade: 'A' }, { status: 'Completed', term: 'X', credits: 0, grade: 'F' }], 'X'), { term_credits: 0, completed_credits: 0, cumulative_gpa: null }));
