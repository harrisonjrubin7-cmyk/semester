import { test, eq } from './harness';
import { validateRubric, rubricScore, rubricMax, Criterion } from '../src/lib/rubricRules';

const cs: Criterion[] = [
  { id: 'thesis', name: 'Thesis', levels: [{ label: 'Missing', points: 0 }, { label: 'Clear', points: 4 }] },
  { id: 'evidence', name: 'Evidence', levels: [{ label: 'Weak', points: 1 }, { label: 'Some', points: 3 }, { label: 'Strong', points: 6 }] },
];
test('a valid rubric passes (control)', () => { eq(validateRubric('Essay rubric', cs), null); eq(rubricMax(cs), 10); });
test('invalid rubrics are refused', () => {
  eq(typeof validateRubric('E', cs), 'string');
  eq(typeof validateRubric('Essay', []), 'string');
  eq(typeof validateRubric('Essay', [{ ...cs[0], levels: [{ label: 'Only', points: 1 }] }]), 'string');
  eq(typeof validateRubric('Essay', [cs[0], { ...cs[1], id: 'thesis' }]), 'string');
  eq(typeof validateRubric('Essay', [{ ...cs[0], levels: [{ label: 'A', points: -1 }, { label: 'B', points: 1 }] }]), 'string');
});
test('score sums one level per criterion', () => { eq(rubricScore(cs, { thesis: 1, evidence: 2 }), 10); eq(rubricScore(cs, { thesis: 0, evidence: 0 }), 1); });
test('incomplete or out-of-range selections give no score', () => {
  eq(rubricScore(cs, { thesis: 1 }), null);
  eq(rubricScore(cs, { thesis: 1, evidence: 3 }), null);
  eq(rubricScore(cs, { thesis: 1.5, evidence: 0 } as never), null);
});
