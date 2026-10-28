import { test, eq } from './harness';
import { buildTranscript, termOrder, gpaOf, policyProblems, DEFAULT_POLICY, scaleFromText, scaleToText, gradeList, type Entry } from '../src/lib/transcriptRules';
import { DEFAULT_SCALE as TRACKER_SCALE } from '../src/lib/gradeCalc';

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
  const t = buildTranscript([e({ enrollmentId: 'p', grade: 'P', course: 'PE 100' }), e({ enrollmentId: 'f', grade: 'F', course: 'CHEM 101' }), e({ enrollmentId: 'w', grade: 'W', course: 'BIO 110' }), e({ enrollmentId: 'i', grade: 'I', course: 'ART 120' }), e({ enrollmentId: 'a', grade: 'A' })]);
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

const F26 = termOrder('Fall 2026'), S27 = termOrder('Spring 2027');
const retake = [e({ enrollmentId: 'r1', grade: 'D', term: 'Fall 2026', termOrder: F26 }), e({ enrollmentId: 'r2', grade: 'B', term: 'Spring 2027', termOrder: S27, course: 'econ 101' }),
  e({ enrollmentId: 'o', grade: 'A', course: 'HIST 214', term: 'Fall 2026', termOrder: F26 })];
test('repeat (latest): the later attempt counts; the earlier stays on the record, excluded from GPA and credit', () => {
  const t = buildTranscript(retake);
  eq(t.terms.flatMap((x) => x.rows.map((r) => [r.course, r.grade, r.repeat, r.inGpa, r.earned])), [['ECON 101', 'D', 'excluded', false, 0], ['HIST 214', 'A', null, true, 3], ['econ 101', 'B', 'counted', true, 3]]);
  eq([t.gpaCredits, t.earned, t.gpa, t.policy.repeat], [6, 6, 3.5, 'latest']);
});
test('repeat (latest): a later W or I never wipes out an earlier grade', () => {
  const t = buildTranscript([e({ enrollmentId: 'a', grade: 'C' }), e({ enrollmentId: 'b', grade: 'W', term: 'Spring 2027', termOrder: S27 }), e({ enrollmentId: 'c', grade: 'I', term: 'Spring 2027', termOrder: S27 })]);
  eq([t.gpa, t.earned, t.terms[0].rows[0].repeat], [2, 3, null]);
});
test('repeat (latest): a later F replaces an earlier pass — the rule is "latest", not "best"', () => {
  eq(buildTranscript([e({ enrollmentId: 'a', grade: 'B' }), e({ enrollmentId: 'b', grade: 'F', term: 'Spring 2027', termOrder: S27 })]).gpa, 0);
});
test('repeat rules are institution policy: highest and all give different answers on the same record (control)', () => {
  const later = [e({ enrollmentId: 'a', grade: 'B' }), e({ enrollmentId: 'b', grade: 'C', term: 'Spring 2027', termOrder: S27 })];
  eq(buildTranscript(later).gpa, 2);
  eq(buildTranscript(later, { ...DEFAULT_POLICY, repeat: 'highest' }).gpa, 3);
  eq(buildTranscript(later, { ...DEFAULT_POLICY, repeat: 'all' }).gpa, 2.5);
});
test('sample policy: plus/minus scale incl. A+ = 4.0 and D-; the transcript says a sample policy applies', () => {
  eq([DEFAULT_POLICY.scale['A+'], DEFAULT_POLICY.scale['D-'], DEFAULT_POLICY.scale.F], [4, 0.7, 0]);
  const t = buildTranscript([e({ grade: 'A+' })]); eq([t.gpa, t.scale, t.policy.label.startsWith('Sample policy')], [4, 'default', true]);
  eq(TRACKER_SCALE, DEFAULT_POLICY.scale);
});
test('policy check refuses a grade listed twice, an out-of-range value and a scale with no failing grade', () => {
  eq(policyProblems(DEFAULT_POLICY), []);
  eq(policyProblems({ ...DEFAULT_POLICY, passing: ['P', 'A'] }), ['A is listed twice.']);
  eq(policyProblems({ ...DEFAULT_POLICY, scale: { A: 9, B: 3 } }), ['A must be worth 0 to 5 points.', 'The scale needs a failing grade worth 0.']);
});
test('registrar scale editor round-trips the sample scale and reports bad lines', () => {
  eq(scaleFromText(scaleToText(DEFAULT_POLICY.scale)), { scale: DEFAULT_POLICY.scale, problems: [] });
  eq(scaleFromText('a = 4\nB+ : 3.3\nB = three\na = 3').problems, ['Line 3: write it as "B+ = 3.3".', 'A is listed twice.']);
  eq(gradeList(' p, s ,,cr '), ['P', 'S', 'CR']);
});
