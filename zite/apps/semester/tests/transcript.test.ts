import { test, eq } from './harness';
import { buildTranscript, termOrder, gpaOf, type Entry } from '../src/lib/transcriptRules';

const e = (o: Partial<Entry>): Entry => ({ enrollmentId: 'e1', revision: 1, grade: 'A', authority: 'design', term: 'Fall 2026', termOrder: termOrder('Fall 2026'), course: 'ECON 101', title: 'Micro', credits: 3, ...o });

test('empty record: no GPA, not official (control)', () => { const t = buildTranscript([]); eq([t.gpa, t.official, t.terms.length], [null, false, 0]); });
test('term and cumulative GPA from credits and quality points', () => {
  const t = buildTranscript([e({ enrollmentId: 'a', grade: 'A', credits: 3 }), e({ enrollmentId: 'b', grade: 'B+', credits: 4, course: 'MATH 140' }),
    e({ enrollmentId: 'c', grade: 'C', credits: 3, term: 'Spring 2027', termOrder: termOrder('Spring 2027'), course: 'HIST 214' })]);
  eq(t.terms.map((x) => [x.term, x.gpaCredits, x.qualityPoints, x.gpa]), [['Fall 2026', 7, 25.2, 3.6], ['Spring 2027', 3, 6, 2]]);
  eq([t.gpaCredits, t.qualityPoints, t.gpa, t.earned], [10, 31.2, 3.12, 10]);
});
test('only the latest revision counts; corrections are flagged', () => {
  const t = buildTranscript([e({ revision: 1, grade: 'B' }), e({ revision: 2, grade: 'A-' })]);
  eq([t.terms[0].rows.length, t.terms[0].rows[0].grade, t.terms[0].rows[0].corrected, t.gpa], [1, 'A-', true, 3.7]);
});
test('P earns credit outside GPA; F counts in GPA with no credit; W attempts nothing; I has no credit yet', () => {
  const t = buildTranscript([e({ enrollmentId: 'p', grade: 'P' }), e({ enrollmentId: 'f', grade: 'F' }), e({ enrollmentId: 'w', grade: 'W' }), e({ enrollmentId: 'i', grade: 'I' }), e({ enrollmentId: 'a', grade: 'A' })]);
  eq([t.attempted, t.earned, t.gpaCredits, t.gpa], [12, 6, 6, 2]);
});
test('GPA is truncated, not rounded; terms sort by year and season', () => {
  eq(gpaOf(10, 3), 3.33); eq(gpaOf(11, 3), 3.66);
  eq(['Fall 2026', 'Spring 2026', 'Summer 2026', 'Spring 2027'].sort((a, b) => termOrder(a) - termOrder(b)), ['Spring 2026', 'Summer 2026', 'Fall 2026', 'Spring 2027']);
});
test('official only when every entry is from pilot/authoritative records', () => {
  eq(buildTranscript([e({ authority: 'pilot' }), e({ enrollmentId: 'x', authority: 'authoritative' })]).official, true);
  eq(buildTranscript([e({ authority: 'pilot' }), e({ enrollmentId: 'x', authority: 'design' })]).official, false);
});
