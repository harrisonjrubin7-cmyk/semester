import { test, eq } from './harness';
import { approvalBlocker, commercialChanges, deleteBlocker } from '../src/lib/companyRules';

const ok = (v: string | null) => eq(v, null);
const blocked = (v: string | null) => eq(typeof v, 'string');

test('owner cannot approve', () => blocked(approvalBlocker('alice', 'alice', [])));
test('an unrelated colleague can approve (control)', () => ok(approvalBlocker('bob', 'carol', [{ actor: 'alice', action: 'created', detail: 'name, owner' }])));
test('creator cannot approve after handing the deal to someone else', () =>
  blocked(approvalBlocker('bob', 'alice', [{ actor: 'alice', action: 'created', detail: 'name, owner' }])));
test('reassign-then-approve is refused for whoever set the owner', () =>
  blocked(approvalBlocker('bob', 'dave', [{ actor: 'alice', action: 'created', detail: 'name' }, { actor: 'dave', action: 'updated', detail: 'stage, owner' }])));
test('editing other fields does not disqualify an approver', () =>
  ok(approvalBlocker('bob', 'dave', [{ actor: 'alice', action: 'created', detail: 'name' }, { actor: 'dave', action: 'updated', detail: 'nextStep' }])));
test('a field merely named "ownerNote" is not an owner change', () =>
  ok(approvalBlocker('bob', 'dave', [{ actor: 'dave', action: 'updated', detail: 'ownerNote' }])));

test('changing amount or owner counts as a commercial change', () =>
  eq(commercialChanges({ amountMinor: 100, owner: ['a'] }, { amountMinor: 200, owner: ['b'], nextStep: 'x' }), ['amountMinor', 'owner']));
test('resending the same values is not a change', () =>
  eq(commercialChanges({ amountMinor: 100, owner: ['a'] }, { amountMinor: 100, owner: ['a'] }), []));

test('approved or won deals cannot be deleted', () => { blocked(deleteBlocker('deals', { approvedAt: '2026-01-01' }, 0)); blocked(deleteBlocker('deals', { stage: 'Won' }, 0)); });
test('an early, unapproved deal can be deleted (control)', () => ok(deleteBlocker('deals', { stage: 'Discovery' }, 0)));
test('only bare draft contracts can be deleted', () => {
  blocked(deleteBlocker('contracts', { state: 'Active' }, 0));
  blocked(deleteBlocker('contracts', { state: 'Draft', signedDocumentLink: 'x' }, 0));
  ok(deleteBlocker('contracts', { state: 'Draft' }, 0));
});
test('projects with gate evidence or past kickoff are kept', () => {
  blocked(deleteBlocker('projects', { state: 'Kickoff', gatesPassed: ['Scope signed off'] }, 0));
  blocked(deleteBlocker('projects', { state: 'Activated' }, 0));
  ok(deleteBlocker('projects', { state: 'Kickoff', gatesPassed: [] }, 0));
});
test('tickets are never deleted', () => blocked(deleteBlocker('tickets', { state: 'New' }, 0)));
test('accounts with linked records are kept', () => { blocked(deleteBlocker('accounts', {}, 2)); ok(deleteBlocker('accounts', {}, 0)); });
