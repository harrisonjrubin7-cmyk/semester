import { test, eq } from './harness';
import { checkPlan, cleanPlan, PlanCourse } from '../src/lib/planRules';

const C: Record<string, PlanCourse> = {
  m1: { code: 'MATH 101', credits: 3, satisfies: ['core'], prerequisites: [] },
  m2: { code: 'MATH 201', credits: 3, satisfies: ['core'], prerequisites: ['m1'] },
  e1: { code: 'ECON 101', credits: 4, satisfies: ['major'], prerequisites: [] },
  e2: { code: 'ECON 301', credits: 4, satisfies: ['major'], prerequisites: ['e1', 'm1'] },
};
const R = [{ id: 'core', name: 'Core', required: 6, earned: 0, pending: 0 }, { id: 'major', name: 'Major', required: 8, earned: 0, pending: 0 }];
const base = { courses: C, completed: new Set<string>(), inProgress: new Set<string>(), requirements: R, maxCredits: 7 };

test('a sound plan projects every requirement complete with no issues', () => {
  const r = checkPlan({ ...base, terms: [{ term: 'Fall', courseIds: ['m1', 'e1'] }, { term: 'Spring', courseIds: ['m2'] }, { term: 'Fall 2', courseIds: ['e2'] }] });
  eq(r.issues, []); eq(r.complete, true); eq(r.terms.map((t) => t.credits), [7, 3, 4]);
});
test('a prerequisite in the same term does not count; one in an earlier term does', () => {
  const r = checkPlan({ ...base, terms: [{ term: 'Fall', courseIds: ['m1', 'm2'] }] });
  eq(r.issues.map((i) => i.kind), ['prerequisite']);
  eq(r.issues[0].text, 'MATH 201 needs MATH 101 in an earlier term.');
});
test('in-progress work satisfies a prerequisite and its credits are not planned again', () => {
  const r = checkPlan({ ...base, inProgress: new Set(['m1']), terms: [{ term: 'Spring', courseIds: ['m1', 'm2'] }] });
  eq(r.issues.map((i) => i.kind), ['already_taken']);
});
test('duplicates, unknown courses, empty terms and the credit cap are each reported', () => {
  const r = checkPlan({ ...base, terms: [{ term: 'Fall', courseIds: ['e1', 'e2x', 'm1', 'e1'] }, { term: 'Spring', courseIds: [] }] });
  eq(r.issues.map((i) => i.kind), ['unknown_course', 'duplicate', 'empty_term']);
  const cap = checkPlan({ ...base, terms: [{ term: 'Fall', courseIds: ['e1', 'm1', 'm2'] }] });
  eq(cap.issues.map((i) => i.kind), ['prerequisite', 'over_cap']);
});
test('projection never exceeds the requirement and reports what is still short', () => {
  const r = checkPlan({ ...base, requirements: [{ ...R[0], earned: 3 }, R[1]], terms: [{ term: 'Fall', courseIds: ['m1', 'e1'] }] });
  eq(r.requirements.map((x) => [x.projected, x.short]), [[6, 0], [4, 4]]); eq(r.complete, false);
});
test('cleanPlan trims names and refuses repeated or unnamed terms', () => {
  eq(cleanPlan([{ term: ' Fall 2027 ', courseIds: ['m1'] }]), [{ term: 'Fall 2027', courseIds: ['m1'] }]);
  eq(cleanPlan([{ term: 'Fall', courseIds: [] }, { term: 'fall', courseIds: [] }]), 'fall appears twice.');
  eq(cleanPlan([{ term: 'F', courseIds: [] }]), 'Name each term (3 to 40 characters).');
});
