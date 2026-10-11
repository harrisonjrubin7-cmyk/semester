import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuditLog } from '../src/control/audit.ts';
import { MAX_HANDOFF_DEPTH, createScheduler, type AgentLookup } from '../src/control/scheduler.ts';
import { SUITES, suiteRouteAllowed } from '../src/agents/suites.ts';
import { agent } from '../src/agents/roster.ts';
import { fixedClock } from '../src/store/clock.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { createFileStore } from '../src/store/store.ts';
import type { AcceptanceCriterion } from '../types.ts';
import { tempDir } from './helpers.ts';

const accept: AcceptanceCriterion[] = [{ id: 'c1', statement: 'exists', check: { kind: 'file_exists', path: 'x' } }];
const lookup: AgentLookup = {
  limitsFor: (id) => agent(id)?.limits,
  modeFor: () => 'develop',
  routeAllowed: (a, b) => { const x = agent(a); const y = agent(b); return !!x && !!y && suiteRouteAllowed(x.suite, y.suite); },
};

function harness() {
  const clock = fixedClock('2026-10-11T12:00:00Z');
  const store = createFileStore(tempDir());
  const audit = createAuditLog(store, clock);
  const scheduler = createScheduler(store, clock, sequentialIds(), audit, lookup, { maxConcurrent: 2, environment: 'development' });
  const now = clock.now().toISOString();
  store.saveGoal({ id: 'goal_1', title: 'g', requestedBy: 'o', source: 's', status: 'open', createdAt: now, updatedAt: now });
  return { clock, store, audit, scheduler };
}

test('twelve suites, every roster agent in one of them, routes as the runner design lists them', () => {
  assert.equal(SUITES.length, 12);
  assert.ok(suiteRouteAllowed('product', 'backend'));
  assert.ok(!suiteRouteAllowed('growth', 'release'));
  assert.ok(suiteRouteAllowed('qa', 'qa'), 'a suite may hand off within itself');
});

test('enqueue validates agent, goal, title, acceptance, dependencies and cycles, and deduplicates', () => {
  const { scheduler } = harness();
  assert.throws(() => scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 't', agentId: 'A99', acceptance: accept }), /Unknown agent/);
  assert.throws(() => scheduler.enqueue({ goalId: 'goal_9', type: 'x', title: 't', agentId: 'A10', acceptance: accept }), /Unknown goal/);
  assert.throws(() => scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 't', agentId: 'A10', acceptance: [] }), /acceptance/);
  assert.throws(() => scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 't', agentId: 'A10', acceptance: accept, dependsOn: ['task_404'] }), /does not exist/);
  const a = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'a', agentId: 'A10', acceptance: accept });
  const again = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'a', agentId: 'A10', acceptance: accept });
  assert.equal(again.id, a.id, 'same dedupe key returns the open task');
  assert.throws(() => scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'too deep', agentId: 'A10', acceptance: accept, depth: MAX_HANDOFF_DEPTH + 1 }), /depth/);
});

test('ready joins on every dependency being complete; claim refuses otherwise', () => {
  const { scheduler } = harness();
  const frontend = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'frontend', agentId: 'A07', acceptance: accept });
  const backend = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'backend', agentId: 'A10', acceptance: accept });
  const qa = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'qa', agentId: 'A15', acceptance: accept, dependsOn: [frontend.id, backend.id] });
  assert.deepEqual(scheduler.ready().map((task) => task.id), [frontend.id, backend.id]);
  assert.match((scheduler.claim(qa.id) as { error: string }).error, /waits on/);
  scheduler.transition(frontend.id, 'verified');
  assert.ok(!scheduler.ready().some((task) => task.id === qa.id), 'one complete dependency is not enough');
  scheduler.transition(backend.id, 'failed');
  assert.ok(!scheduler.ready().some((task) => task.id === qa.id), 'a failed dependency the task does not review is not complete');
  scheduler.transition(backend.id, 'awaiting_verification');
  assert.ok(scheduler.ready().some((task) => task.id === qa.id), 'finished work may be checked before it is verified');
  const claimed = scheduler.claim(qa.id);
  assert.ok('task' in claimed && claimed.task.status === 'running' && claimed.execution.status === 'running');
  assert.match((scheduler.claim(qa.id) as { error: string }).error, /not ready/);
  const verifier = scheduler.enqueue({ goalId: 'goal_1', type: 'verify', title: 'verify', agentId: 'A16', acceptance: accept, dependsOn: [backend.id], spec: { reviews: [backend.id] } });
  scheduler.transition(backend.id, 'failed');
  assert.ok(scheduler.ready().some((task) => task.id === verifier.id), 'a verifier may run on failed work it reviews, to record the verdict');
});

test('concurrency: the global and per-agent limits hold', () => {
  const { scheduler } = harness();
  const a = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'a', agentId: 'A10', acceptance: accept });
  const b = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'b', agentId: 'A10', acceptance: accept });
  const c = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'c', agentId: 'A07', acceptance: accept });
  const d = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'd', agentId: 'A15', acceptance: accept });
  assert.ok('task' in scheduler.claim(a.id));
  assert.match((scheduler.claim(b.id) as { error: string }).error, /concurrency limit/, 'A10 allows one at a time');
  assert.ok('task' in scheduler.claim(c.id));
  assert.match((scheduler.claim(d.id) as { error: string }).error, /Concurrency limit 2/);
});

test('attempts are bounded by maxRetries + 1', () => {
  const { scheduler } = harness();
  const a = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'a', agentId: 'A10', acceptance: accept });
  for (let attempt = 0; attempt < agent('A10')!.limits.maxRetries + 1; attempt += 1) {
    assert.ok('task' in scheduler.claim(a.id));
    scheduler.transition(a.id, 'failed');
    scheduler.requeue(a.id, 'owner');
  }
  assert.match((scheduler.claim(a.id) as { error: string }).error, /permitted attempts/);
});

test('handoffs queue only along allowed routes, within depth and count, and only when enabled', () => {
  const { scheduler } = harness();
  const parent = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'product', agentId: 'A03', acceptance: accept });
  const proposal = (agentId: string, title = `to ${agentId}`) => ({ agentId, type: 'x', title, acceptance: accept, spec: {} });
  const disabled = scheduler.handoff(parent, [proposal('A10')], false);
  assert.equal(disabled.queued.length, 0);
  assert.equal(disabled.rejected[0]!.reason, 'handoffs_disabled');
  const result = scheduler.handoff(parent, [proposal('A10'), proposal('A20'), proposal('A99')], true);
  assert.deepEqual(result.queued.map((task) => task.agentId), ['A10']);
  assert.deepEqual(result.rejected.map((item) => item.reason).sort(), ['route_not_allowed', 'unknown_agent']);
  assert.deepEqual(result.queued[0]!.dependsOn, [parent.id]);
  assert.equal(result.queued[0]!.depth, 1);
  assert.equal(scheduler.handoff(parent, [proposal('A10', '1'), proposal('A10', '2'), proposal('A10', '3'), proposal('A10', '4')], true).rejected[0]!.reason, 'too_many_handoffs');
  let deep = result.queued[0]!;
  for (let depth = 2; depth <= MAX_HANDOFF_DEPTH; depth += 1) {
    const next = scheduler.handoff(deep, [proposal('A15', `depth ${depth}`)], true);
    assert.equal(next.queued.length, 1, `depth ${depth} is allowed`);
    deep = next.queued[0]!;
  }
  assert.equal(scheduler.handoff(deep, [proposal('A15', 'one too deep')], true).rejected[0]!.reason, 'depth_exceeded');
  assert.equal(scheduler.handoff(parent, [{ ...proposal('A10', 'no acceptance'), acceptance: [] }], true).rejected[0]!.reason, 'missing_acceptance');
});

test('cancel ends a task and its execution; recover marks stale running work interrupted without re-queueing', () => {
  const { scheduler, store } = harness();
  const a = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'a', agentId: 'A10', acceptance: accept });
  const b = scheduler.enqueue({ goalId: 'goal_1', type: 'x', title: 'b', agentId: 'A07', acceptance: accept });
  scheduler.claim(a.id); scheduler.claim(b.id);
  scheduler.cancel(a.id, 'owner', 'no longer needed');
  assert.equal(store.task(a.id)!.status, 'cancelled');
  assert.equal(store.executions().find((record) => record.taskId === a.id)!.status, 'cancelled');
  const recovered = scheduler.recover('restart');
  assert.equal(recovered.interrupted.length, 1);
  assert.equal(store.task(b.id)!.status, 'interrupted');
  assert.deepEqual(scheduler.ready(), []);
  scheduler.requeue(b.id, 'owner');
  assert.deepEqual(scheduler.ready().map((task) => task.id), [b.id]);
});

test('a schedule creates one bounded task per period and nothing else', () => {
  const { scheduler, clock } = harness();
  scheduler.schedule({ key: 'weekly-capacity', agentId: 'A21', type: 'capacity.review', title: 'Weekly capacity review', goalId: 'goal_1', period: 'P7D', spec: {}, acceptance: accept, registryKeys: [] });
  assert.equal(scheduler.tick().length, 1);
  assert.equal(scheduler.tick().length, 0, 'same period, no duplicate');
  clock.advance(7 * 24 * 60 * 60 * 1000);
  assert.equal(scheduler.tick().length, 1);
  assert.equal(scheduler.ready()[0]!.mode, 'develop', 'the schedule granted nothing beyond the agent lookup');
});
