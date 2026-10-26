import { test, eq } from './harness';
import { extractDates, extractWeights, compareVersions, weightsProposal } from '../src/lib/syllabusExtract';

const SYL = `ECON 1010 Principles of Economics
Midterm exam: Oct 14
Problem set 3 due 10/21
Final exam December 9, 2026 in Room 101
Grading: Homework 20%, Quizzes 10 %
Exams – 60 percent
Participation: 10%
Office hours Tue 2-4`;

test('dates in several formats keep their source line (control)', () => {
  const d = extractDates(SYL, 2026);
  eq(d.map((x) => x.date).join(), '2026-10-14,2026-10-21,2026-12-09');
  eq(d[0].label, 'Midterm exam');
  eq(d[0].line, 2);
  eq(d[2].text.includes('Room 101'), true);
});
test('impossible dates are dropped, not corrected; ISO dates work', () => {
  eq(extractDates('Quiz Feb 30', 2026).length, 0);
  eq(extractDates('Project due 2027-01-15', 2026)[0].date, '2027-01-15');
  eq(extractDates('Office hours Tue 2-4', 2026).length, 0);
});
test('weights from text', () => {
  const w = extractWeights(SYL);
  eq(w.map((x) => `${x.name}=${x.weight}`).join(), 'Homework=20,Quizzes=10,Exams=60,Participation=10');
});
test('weights proposal applies only when it totals 100', () => {
  eq(weightsProposal([{ name: 'A', weight: 60 }, { name: 'B', weight: 40 }]).applicable, true);
  eq(weightsProposal([{ name: 'A', weight: 60 }]).applicable, false);
  eq(weightsProposal([]).applicable, false);
});
test('version comparison', () => {
  const c = compareVersions('Midterm Oct 14\nFinal Dec 9', 'Midterm Oct 16\nFinal Dec 9');
  eq(c.removed.join(), 'Midterm Oct 14');
  eq(c.added.join(), 'Midterm Oct 16');
});
