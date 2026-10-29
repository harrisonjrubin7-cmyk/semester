import { test, eq } from './harness';
import { controlProblem, subprocessorProblem, decideProblem } from '../src/lib/trustRules';

const pending = { proposed_by: 'p1', status: 'pending' };
test('control needs section, name and status', () => eq(controlProblem({ section: 'security', control: 'MF', status: 'In progress', evidence: 'planned' }), 'Choose a section, a control name and a status.'));
test('a verified status needs real evidence', () => eq(controlProblem({ section: 'security', control: 'MFA for staff', status: 'Verified in test', evidence: 'we think so' }), 'A verified status needs evidence: what was checked, how, and when.'));
test('a verified status with dated evidence is accepted', () => eq(controlProblem({ section: 'security', control: 'MFA for staff', status: 'Verified in test', evidence: 'Login test run 2026-10-27, 12/12 accounts' }), null));
test('an in-progress status still needs a reason', () => eq(controlProblem({ section: 'ai', control: 'Model card', status: 'In progress', evidence: '' }), 'Say why this change is needed.'));
test('subprocessor needs what it does with data', () => eq(subprocessorProblem({ name: 'Neon', purpose: 'db', evidence: 'DPA ref 12' }), 'Give the service name and what it does with data.'));
test('removing a subprocessor needs no purpose', () => eq(subprocessorProblem({ name: 'Neon', active: false, evidence: 'Contract ended' }), null));
test('only a privacy officer decides', () => eq(decideProblem({ canDecide: false, me: 'd1', change: pending, action: 'approve' }), 'Only a privacy officer can decide Trust Center changes.'));
test('the proposer cannot decide their own change', () => eq(decideProblem({ canDecide: true, me: 'p1', change: pending, action: 'approve' }), 'You proposed this change, so someone else has to decide it.'));
test('a decided change cannot be decided again', () => eq(decideProblem({ canDecide: true, me: 'd1', change: { proposed_by: 'p1', status: 'approved' }, action: 'reject', note: 'Changed mind' }), 'This change was already decided.'));
test('a missing change is refused', () => eq(decideProblem({ canDecide: true, me: 'd1', action: 'approve' }), 'This change was already decided.'));
test('a rejection needs a reason', () => eq(decideProblem({ canDecide: true, me: 'd1', change: pending, action: 'reject', note: 'no' }), 'Add a short reason.'));
test('a second privacy officer approves', () => eq(decideProblem({ canDecide: true, me: 'd1', change: pending, action: 'approve' }), null));
