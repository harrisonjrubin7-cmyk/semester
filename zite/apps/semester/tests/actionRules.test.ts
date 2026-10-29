import { test, eq } from './harness';
import { ownOverrideActions, deskOverrideActions, planActions, offerActions, rankActions } from '../src/lib/actionRules';

const NOW = Date.parse('2027-01-10T12:00:00Z');
const day = (n: number) => new Date(NOW + n * 86400e3).toISOString();
const o = (id: number, kind: string, state: string, student = 'st1', expires: string | null = null) => ({ id, kind, term: 'Spring 2027', state, expires_at: expires, student_id: student });

test('an approval expiring within a week rises to due-soon; a later one stays informational; expired ones vanish', () => {
  const r = ownOverrideActions([o(1, 'prerequisite', 'approved', 'st1', day(3)), o(2, 'credit_overload', 'approved', 'st1', day(20)), o(3, 'late_registration', 'approved', 'st1', day(-1))], NOW);
  eq(r.map((a) => [a.id, a.priority, a.state]), [['ovr:1', 4, 'Expiring'], ['ovr:2', 5, 'Approved']]);
});
test('open requests say who they wait on', () => {
  eq(ownOverrideActions([o(1, 'credit_overload', 'requested'), o(2, 'credit_overload', 'endorsed'), o(3, 'prerequisite', 'requested')], NOW).map((a) => a.state),
    ['Waiting on your advisor', 'Waiting on the registrar', 'Waiting on the registrar']);
});
test('the desk shows an advisor only advisees, a registrar only decidable requests, and nobody their own', () => {
  const rows = [o(1, 'credit_overload', 'requested', 'st1'), o(2, 'credit_overload', 'requested', 'st2'), o(3, 'prerequisite', 'requested', 'st2'), o(4, 'late_registration', 'endorsed', 'st2'), o(5, 'prerequisite', 'requested', 'me')];
  eq(deskOverrideActions(rows, 'me', new Set(['st1']), false).map((a) => a.id), ['ovr:1']);
  eq(deskOverrideActions(rows, 'me', new Set(), true).map((a) => a.id), ['ovr:3', 'ovr:4']);
});
test('plans: changes requested is on the student, a submitted advisee plan is on the advisor', () => {
  eq(planActions({ id: 1, state: 'changes_requested', student_id: 'st1', review_note: 'Move ECON 301.' }, [{ id: 2, state: 'submitted', student_id: 'st2' }, { id: 3, state: 'draft', student_id: 'st3' }])
    .map((a) => [a.id, a.priority, a.reason]), [['dpl:1', 2, 'Your advisor: Move ECON 301.'], ['dpl:2', 2, 'An advisee sent their plan for review.']]);
  eq(planActions({ id: 1, state: 'approved', student_id: 'st1' }, []), []);
});
test('only offered assistantships wait on the student', () => eq(offerActions([{ id: 1, title: 'TA', state: 'offered' }, { id: 2, title: 'RA', state: 'applied' }]).map((a) => a.id), ['gas:1']));
test('ranking is by fixed priority then title, and the same item appears once', () => {
  const r = rankActions([...offerActions([{ id: 1, title: 'B', state: 'offered' }]), ...ownOverrideActions([o(9, 'prerequisite', 'approved', 'st1', day(2))], NOW),
    ...offerActions([{ id: 1, title: 'B', state: 'offered' }]), ...offerActions([{ id: 2, title: 'A', state: 'offered' }])]);
  eq(r.map((a) => a.id), ['gas:2', 'gas:1', 'ovr:9']);
});
