import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AcceptanceCriterion } from '../types.ts';
import { createRuntime } from '../src/runtime/operator.ts';
import type { ReleaseAdapter } from '../src/runtime/release.ts';
import { fixedClock } from '../src/store/clock.ts';
import { payloadHash } from '../src/store/hash.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { recordingRelease, tempDir, tempRepository, testPolicy } from './helpers.ts';

/**
 * release.execute is the one task type that leaves the repository. These
 * tests drive it with a recording adapter: nothing is deployed anywhere, and
 * what is asserted is the order of refusals and the one call that gets
 * through.
 */
const manual = (id: string): AcceptanceCriterion => ({ id, statement: 'n/a', check: { kind: 'manual', note: 'n/a' } });
const ARTIFACT = 'sha256:0123456789abcdef';

function runtimeWith(release?: ReleaseAdapter) {
  const runtime = createRuntime({ repositoryRoot: tempRepository(), stateRoot: tempDir('operator-state-'), policy: testPolicy, clock: fixedClock('2026-10-12T00:00:00Z'), ids: sequentialIds(), release });
  const goal = runtime.addGoal({ title: 'release', requestedBy: 'owner', source: 's' });
  return { runtime, goal };
}
const plan = (runtime: ReturnType<typeof createRuntime>, goalId: string, mode?: 'operate') =>
  runtime.plan(goalId, [{ type: 'release.execute', title: 'ship staging', agentId: 'A20', acceptance: [manual('r')], spec: { target: 'staging', artifactHash: ARTIFACT }, mode }])[0]!;

test('without an adapter, release.execute is blocked before any approval is spent', async () => {
  const { runtime, goal } = runtimeWith();
  const approval = runtime.approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: payloadHash({ target: 'staging', artifactHash: ARTIFACT }), artifactHash: ARTIFACT, approver: 'owner', ttlMs: 60_000 });
  const result = await runtime.run(plan(runtime, goal.id, 'operate').id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'release_adapter_unavailable');
  assert.equal(runtime.approvals.list().find((item) => item.id === approval.id)?.usesConsumed, 0, 'the approval is untouched');
  assert.deepEqual(result.execution.pendingExternalActions, []);
});

test('operate mode is granted per task by the planner, only to an agent that holds an adapter, and is audited', async () => {
  const { runtime, goal } = runtimeWith(recordingRelease());
  assert.throws(() => runtime.plan(goal.id, [{ type: 'security.review', title: 'x', agentId: 'A17', acceptance: [manual('x')], spec: {}, mode: 'operate' }]), /holds no adapter/);
  const observe = plan(runtime, goal.id);
  assert.equal(observe.mode, 'observe', 'A20 starts in observe like every agent');
  const result = await runtime.run(observe.id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'operate_mode_required');
  const operate = runtime.plan(goal.id, [{ type: 'release.execute', title: 'ship staging, operate', agentId: 'A20', acceptance: [manual('r')], spec: { target: 'staging', artifactHash: ARTIFACT }, mode: 'operate' }])[0]!;
  assert.equal(operate.mode, 'operate');
  assert.ok(runtime.audit.events().some((event) => event.kind === 'mode.granted' && event.taskId === operate.id));
});

test('the approval must bind the exact target and artifact; the exact one releases once and is spent', async () => {
  const adapter = recordingRelease();
  const { runtime, goal } = runtimeWith(adapter);
  const task = plan(runtime, goal.id, 'operate');
  const hash = payloadHash({ target: 'staging', artifactHash: ARTIFACT });

  const none = await runtime.run(task.id);
  assert.equal(none.task.status, 'awaiting_approval');
  assert.equal(none.execution.report?.status, 'approval_required');
  assert.match(none.execution.report?.nextStep ?? '', /artifact sha256:0123456789abcdef, approver not A20/);
  assert.equal(adapter.requests.length, 0);

  runtime.approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: payloadHash({ target: 'staging', artifactHash: 'sha256:other' }), artifactHash: 'sha256:other', approver: 'owner', ttlMs: 60_000 });
  runtime.scheduler.requeue(task.id, 'owner');
  const other = await runtime.run(task.id);
  assert.equal(other.task.status, 'awaiting_approval', 'an approval for another artifact does not release this one');
  assert.equal(adapter.requests.length, 0);

  const exact = runtime.approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: hash, artifactHash: ARTIFACT, approver: 'owner', ttlMs: 60_000 });
  runtime.scheduler.requeue(task.id, 'owner');
  const released = await runtime.run(task.id);
  assert.equal(released.task.status, 'awaiting_verification', released.execution.report?.status ?? '');
  assert.deepEqual(adapter.requests.map((request) => [request.target, request.artifactHash, request.taskId]), [['staging', ARTIFACT, task.id]], 'the adapter was called once, with the exact target and artifact');
  assert.deepEqual(released.execution.pendingExternalActions, [], 'the pending record is cleared on a confirmed result');
  assert.ok(released.execution.evidence.some((item) => item.kind === 'note' && item.label === 'release' && item.detail.includes('deploy-1')));
  assert.ok(released.execution.evidence.some((item) => item.kind === 'decision' && item.tool === 'release_adapter' && item.code === 'approved'));
  assert.equal(runtime.approvals.list().find((item) => item.id === exact.id)?.usesConsumed, 1);

  assert.equal(released.task.attempts, 1, 'waiting on approval handed the attempts back; only the release itself spent one');
  assert.equal(runtime.scheduler.requeue(task.id, 'owner')?.status, 'awaiting_verification', 'a released task is not re-queued');
  const second = runtime.plan(goal.id, [{ type: 'release.execute', title: 'ship staging again', agentId: 'A20', acceptance: [manual('r')], spec: { target: 'staging', artifactHash: ARTIFACT }, mode: 'operate' }])[0]!;
  const again = await runtime.run(second.id);
  assert.equal(again.task.status, 'awaiting_approval', 'a spent approval does not release twice');
  assert.equal(adapter.requests.length, 1);
});

test('when the adapter fails after the approval is spent, the action stays recorded as pending and is never repeated', async () => {
  const adapter = recordingRelease({ fail: true });
  const { runtime, goal } = runtimeWith(adapter);
  const task = plan(runtime, goal.id, 'operate');
  runtime.approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: payloadHash({ target: 'staging', artifactHash: ARTIFACT }), artifactHash: ARTIFACT, approver: 'owner', ttlMs: 60_000 });
  const result = await runtime.run(task.id);
  assert.equal(result.task.status, 'failed');
  assert.equal(result.execution.report?.status, 'release_adapter_error');
  assert.deepEqual(result.execution.pendingExternalActions, [`release_adapter target=staging artifact=${ARTIFACT} via recording`]);
  assert.match(result.execution.report?.risks[0] ?? '', /may have taken effect/);
  runtime.scheduler.requeue(task.id, 'owner');
  const retry = await runtime.run(task.id);
  assert.equal(retry.task.status, 'awaiting_approval', 'the spent approval is not reused; a person decides');
  assert.equal(adapter.requests.length, 1, 'the runtime never repeated the external action');
});
