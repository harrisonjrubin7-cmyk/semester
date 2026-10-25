import { test, eq } from './harness';
import { pathComparison } from '../src/lib/transferPath';

const reqs = [{ id: 'math', name: 'Math', required: 6 }, { id: 'eng', name: 'English', required: 3 }];
const catalog = [{ code: 'MATH 155', credits: 4, satisfies: ['math'] }, { code: 'ENGL 100', credits: 3, satisfies: ['eng'] }];
const line = (o: Partial<{ outcome: string | null; code: string | null; awarded: number | null; credits: number; rule: { outcome: string; code: string | null } | null }>) => ({ outcome: null, code: null, awarded: null, credits: 3, rule: null, ...o });

test('official work only (control)', () => { const r = pathComparison(reqs, [catalog[0]], [], catalog); eq(r.requirements[0].official, 4); eq(r.requirements[0].withProvisional, 4); });
test('evaluated and provisional layers stay separate', () => {
  const r = pathComparison(reqs, [], [{ state: 'decided', lines: [line({ outcome: 'equivalent', code: 'math 155', awarded: 4 }), line({ rule: { outcome: 'equivalent', code: 'ENGL 100' } })] }], catalog);
  eq(r.requirements[0].official, 0); eq(r.requirements[0].withEvaluated, 4); eq(r.requirements[1].withEvaluated, 0); eq(r.requirements[1].withProvisional, 3);
});
test('a requirement is never filled past what it needs', () => {
  const r = pathComparison(reqs, [catalog[0]], [{ state: 'decided', lines: [line({ outcome: 'equivalent', code: 'MATH 155', awarded: 4 })] }], catalog);
  eq(r.requirements[0].withEvaluated, 6);
});
test('no-credit and student suggestions never count', () => {
  const r = pathComparison(reqs, [], [{ state: 'decided', lines: [line({ outcome: 'no_credit', code: null, awarded: 0 })] }, { state: 'submitted', lines: [line({})] }], catalog);
  eq(r.requirements.every((x) => x.withProvisional === 0), true);
});
test('electives counted apart; withdrawn requests ignored; unknown codes listed', () => {
  const r = pathComparison(reqs, [], [{ state: 'decided', lines: [line({ outcome: 'elective', awarded: 3 }), line({ outcome: 'equivalent', code: 'XYZ 999', awarded: 3 })] }, { state: 'withdrawn', lines: [line({ outcome: 'elective', awarded: 9 })] }], catalog);
  eq(r.electiveEvaluated, 3); eq(r.unmatched.join(), 'XYZ 999');
});
