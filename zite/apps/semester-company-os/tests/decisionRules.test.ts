import { test, eq } from './harness';
import { DECISION_SEEDS, checkTransition, nextStatus } from '../src/lib/decisionRules';

test('13 blueprint inputs, unique keys', () => { eq(DECISION_SEEDS.length, 13); eq(new Set(DECISION_SEEDS.map((s) => s[0])).size, 13); });
test('propose needs answer and source; blocked once decided', () => {
  eq(checkTransition({ status: 'open', proposedBy: null }, { kind: 'propose', answer: 'Neon + Zite', evidence: 'Founder, 2026-10-24' }, 'a'), null);
  eq(typeof checkTransition({ status: 'open', proposedBy: null }, { kind: 'propose', answer: 'Neon', evidence: 'x' }, 'a'), 'string');
  eq(typeof checkTransition({ status: 'decided', proposedBy: 'a' }, { kind: 'propose', answer: 'Neon + Zite', evidence: 'Founder, 2026-10-24' }, 'b'), 'string');
});
test('the proposer cannot confirm their own answer', () => {
  eq(typeof checkTransition({ status: 'proposed', proposedBy: 'a' }, { kind: 'confirm' }, 'a'), 'string');
  eq(checkTransition({ status: 'proposed', proposedBy: 'a' }, { kind: 'confirm' }, 'b'), null);
  eq(typeof checkTransition({ status: 'open', proposedBy: null }, { kind: 'confirm' }, 'b'), 'string');
});
test('reopen only from decided, with a reason', () => {
  eq(checkTransition({ status: 'decided', proposedBy: 'a' }, { kind: 'reopen', reason: 'Contract changed' }, 'a'), null);
  eq(typeof checkTransition({ status: 'proposed', proposedBy: 'a' }, { kind: 'reopen', reason: 'Contract changed' }, 'a'), 'string');
  eq(nextStatus({ kind: 'reopen', reason: 'x' }), 'open'); eq(nextStatus({ kind: 'confirm' }), 'decided');
});
