import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  REGISTRATION_READINESS_EVALUATION,
  REGISTRATION_READINESS_COMPLETED_OUTCOMES,
  startRegistrationReadinessEvaluation,
  transitionRegistrationReadinessEvaluation,
} from '../../institution/src/readiness-workflow.ts';
import type { RegistrySnapshot, WorkflowRecord } from '../types.ts';
import { validateWorkflows } from '../validators/workflow-validator.ts';

const workflow = (changes: Partial<WorkflowRecord> = {}): WorkflowRecord => ({
  key: 'registration.request',
  name: 'Registration request',
  owner: 'registration',
  status: 'implemented',
  evidence: ['packages/institution/src/readiness-workflow.test.ts'],
  version: 1,
  initial: 'requested',
  terminal: ['done'],
  continuous: false,
  cycle_outcomes: [],
  states: ['requested', 'reviewing', 'done'],
  transitions: { requested: ['reviewing'], reviewing: ['done'], done: [] },
  idempotency: 'Commands replay their receipt.',
  retry_policy: 'Unknown results reconcile before retry.',
  escalation_role: 'operations',
  runbook: 'docs/reference/registration-readiness-workflow.md',
  ...changes,
});

const snapshot = (record: WorkflowRecord): RegistrySnapshot => ({
  capabilities: [], systems: [], roles: [], screens: [], workflows: [record],
  integrations: [], controls: [], documents: [], tenants: [], backlog: [],
});

test('accepts a reachable workflow whose branches can finish', () => {
  assert.deepEqual(validateWorkflows(snapshot(workflow())), []);
});

test('rejects an unknown entry and unreachable or non-terminating branches', () => {
  const issues = validateWorkflows(snapshot(workflow({
    initial: 'missing',
    states: ['requested', 'loop', 'done', 'orphan'],
    transitions: { requested: ['loop'], loop: ['requested'], done: [], orphan: [] },
  })));
  assert.deepEqual(issues.map(({ code, path }) => `${code}:${path}`), [
    'unknown_initial:workflows.registration.request.initial',
    'unreachable_state:workflows.registration.request.states.done',
    'unreachable_state:workflows.registration.request.states.loop',
    'unreachable_state:workflows.registration.request.states.orphan',
    'unreachable_state:workflows.registration.request.states.requested',
    'cannot_reach_terminal:workflows.registration.request.states.loop',
    'cannot_reach_terminal:workflows.registration.request.states.orphan',
    'cannot_reach_terminal:workflows.registration.request.states.requested',
  ]);
});

test('requires terminal states to be final', () => {
  const issues = validateWorkflows(snapshot(workflow({ transitions: { requested: ['reviewing'], reviewing: ['done'], done: ['requested'] } })));
  assert.deepEqual(issues.map(({ code }) => code), ['terminal_has_exit']);
});

test('allows an explicitly continuous workflow but rejects a dead end', () => {
  const continuous = workflow({
    continuous: true,
    terminal: [],
    cycle_outcomes: ['ready'],
    states: ['requested', 'evaluating', 'ready'],
    transitions: { requested: ['evaluating'], evaluating: ['ready'], ready: ['evaluating'] },
  });
  assert.deepEqual(validateWorkflows(snapshot(continuous)), []);
  continuous.transitions.evaluating = [];
  assert.ok(validateWorkflows(snapshot(continuous)).some(({ code }) => code === 'continuous_dead_end'));
});

test('reports the same issues regardless of transition and target order', () => {
  const first = workflow({
    states: ['requested', 'done'],
    transitions: { ghost_b: ['missing_b', 'missing_a'], requested: ['done'], done: [], ghost_a: ['missing_a', 'missing_b'] },
  });
  const reordered = workflow({
    states: ['requested', 'done'],
    transitions: { ghost_a: ['missing_b', 'missing_a'], done: [], requested: ['done'], ghost_b: ['missing_a', 'missing_b'] },
  });
  assert.deepEqual(validateWorkflows(snapshot(first)), validateWorkflows(snapshot(reordered)));
});

test('treats a continuous state with only unknown targets as a dead end', () => {
  const issues = validateWorkflows(snapshot(workflow({
    continuous: true,
    terminal: [],
    cycle_outcomes: ['requested'],
    states: ['requested'],
    transitions: { requested: ['missing'] },
  })));
  assert.deepEqual(issues.map(({ code }) => code), ['unknown_transition_target', 'continuous_dead_end']);
});

test('reports an inherited property name with no own transition entry', () => {
  const issues = validateWorkflows(snapshot(workflow({
    continuous: true,
    terminal: [],
    cycle_outcomes: ['requested'],
    states: ['requested', 'constructor'],
    transitions: { requested: ['requested'] },
  })));
  assert.ok(issues.some(({ code, path }) =>
    code === 'missing_transition_source' && path === 'workflows.registration.request.transitions.constructor'));
});

test('continuous mode requires declared cycle outcomes reachable from every state', () => {
  const missing = validateWorkflows(snapshot(workflow({
    continuous: true,
    terminal: [],
    cycle_outcomes: [],
    states: ['requested'],
    transitions: { requested: ['requested'] },
  })));
  assert.deepEqual(missing.map(({ code }) => code), ['missing_cycle_outcome']);

  const stranded = validateWorkflows(snapshot(workflow({
    continuous: true,
    terminal: [],
    cycle_outcomes: ['ready'],
    states: ['requested', 'loop', 'ready'],
    transitions: { requested: ['loop'], loop: ['loop'], ready: ['requested'] },
  })));
  assert.deepEqual(stranded.map(({ code, path }) => `${code}:${path}`), [
    'unreachable_state:workflows.registration.request.states.ready',
    'cannot_reach_cycle_outcome:workflows.registration.request.states.loop',
    'cannot_reach_cycle_outcome:workflows.registration.request.states.requested',
    'outcome_free_cycle:workflows.registration.request.states.loop',
  ]);
});

test('continuous mode rejects a cycle that can avoid every completed outcome', () => {
  const issues = validateWorkflows(snapshot(workflow({
    continuous: true,
    terminal: [],
    cycle_outcomes: ['ready'],
    states: ['requested', 'evaluating', 'reconciling', 'ready'],
    transitions: {
      requested: ['evaluating'],
      evaluating: ['ready', 'reconciling'],
      reconciling: ['evaluating'],
      ready: ['evaluating'],
    },
  })));
  assert.deepEqual(issues.map(({ code, path }) => `${code}:${path}`), [
    'outcome_free_cycle:workflows.registration.request.states.evaluating',
    'outcome_free_cycle:workflows.registration.request.states.reconciling',
  ]);
});

test('the recurring readiness evaluator declares each completed receipt outcome', () => {
  const record = JSON.parse(readFileSync(
    new URL('../registry/workflows/registration-readiness.json', import.meta.url),
    'utf8',
  )) as WorkflowRecord;
  assert.deepEqual(record.cycle_outcomes, REGISTRATION_READINESS_COMPLETED_OUTCOMES);
  assert.deepEqual({
    initial: record.initial,
    terminal: record.terminal,
    states: record.states,
    transitions: record.transitions,
  }, {
    initial: REGISTRATION_READINESS_EVALUATION.initial,
    terminal: REGISTRATION_READINESS_EVALUATION.terminal,
    states: Object.keys(REGISTRATION_READINESS_EVALUATION.transitions),
    transitions: REGISTRATION_READINESS_EVALUATION.transitions,
  });
  assert.deepEqual(validateWorkflows(snapshot(record)), []);
  assert.deepEqual(record.transitions.unknown, ['reconciling']);
  assert.deepEqual(record.transitions.stale, ['reconciling']);
  assert.deepEqual(record.transitions.needs_review, ['reconciling']);
});

test('each declared readiness cycle outcome completes its command receipt', () => {
  for (const [index, targetState] of REGISTRATION_READINESS_COMPLETED_OUTCOMES.entries()) {
    const started = startRegistrationReadinessEvaluation({
      id: `evaluation-${index}`,
      tenantId: 'synthetic-school',
      subjectId: 'synthetic-student',
      termId: '2027-spring',
      requestedBy: 'synthetic-student',
      correlationId: `corr-0123456789-${index}`,
      idempotencyKey: `request-${index}`,
      at: '2026-10-09T18:00:00.000Z',
    });
    const evaluating = transitionRegistrationReadinessEvaluation(started.record, {
      expectedVersion: 1,
      targetState: 'evaluating',
      correlationId: `corr-0123456789-${index}`,
      idempotencyKey: `evaluate-${index}`,
      at: '2026-10-09T18:01:00.000Z',
    });
    const outcome = transitionRegistrationReadinessEvaluation(evaluating.record, {
      expectedVersion: 2,
      targetState,
      projectionVersion: index + 1,
      correlationId: `corr-0123456789-${index}`,
      idempotencyKey: `outcome-${index}`,
      at: '2026-10-09T18:02:00.000Z',
    });
    assert.equal(outcome.receipt.status, 'completed', targetState);
  }
});
