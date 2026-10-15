import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AcceptanceCriterion } from '../types.ts';
import { createRuntime } from '../src/runtime/operator.ts';
import type { SendAdapter } from '../src/runtime/send.ts';
import { fixedClock } from '../src/store/clock.ts';
import { payloadHash } from '../src/store/hash.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { recordingSend, tempDir, tempRepository, testPolicy } from './helpers.ts';

/**
 * communication.send is the one task type that speaks for the company. These
 * tests drive it with a recording adapter: nothing is drafted or sent
 * anywhere, and what is asserted is the order of refusals, that an approval
 * to draft never sends, and the one call that gets through.
 */
const manual = (id: string): AcceptanceCriterion => ({ id, statement: 'n/a', check: { kind: 'manual', note: 'n/a' } });
const CONTENT = { channel: 'email', recipient: 'pilot-lead@example.edu', subject: 'Pilot week 3 notes', body: 'The export now covers every cohort. Plans for grading are plans.' };
const HASH = payloadHash(CONTENT);
const approvalFor = (action: 'draft' | 'send', contentHash = HASH) => ({ tool: 'external_send' as const, target: `${CONTENT.channel}:${CONTENT.recipient}`, payloadHash: payloadHash({ action, channel: CONTENT.channel, recipient: CONTENT.recipient, contentHash }), artifactHash: contentHash, approver: 'owner', ttlMs: 60_000 });

function runtimeWith(send?: SendAdapter) {
  const runtime = createRuntime({ repositoryRoot: tempRepository(), stateRoot: tempDir('operator-state-'), policy: testPolicy, clock: fixedClock('2026-10-12T00:00:00Z'), ids: sequentialIds(), send });
  const goal = runtime.addGoal({ title: 'communicate', requestedBy: 'owner', source: 's' });
  return { runtime, goal };
}
const plan = (runtime: ReturnType<typeof createRuntime>, goalId: string, action?: 'draft' | 'send', mode: 'operate' | 'observe' = 'operate', title = `${action ?? 'draft'} the pilot note`) =>
  runtime.plan(goalId, [{ type: 'communication.send', title, agentId: 'A27', acceptance: [manual('s')], spec: { ...CONTENT, ...(action ? { action } : {}) }, ...(mode === 'operate' ? { mode } : {}) }])[0]!;

test('without an adapter, communication.send is blocked before any approval is spent', async () => {
  const { runtime, goal } = runtimeWith();
  const approval = runtime.approvals.grant(approvalFor('draft'));
  const result = await runtime.run(plan(runtime, goal.id).id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'send_adapter_unavailable');
  assert.equal(runtime.approvals.list().find((item) => item.id === approval.id)?.usesConsumed, 0, 'the approval is untouched');
  assert.deepEqual(result.execution.pendingExternalActions, []);
});

test('A27 starts in observe; operate mode is granted per task and the gate requires it', async () => {
  const { runtime, goal } = runtimeWith(recordingSend());
  const observe = plan(runtime, goal.id, 'draft', 'observe');
  assert.equal(observe.mode, 'observe');
  const result = await runtime.run(observe.id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'operate_mode_required');
});

test('a drafts-only adapter refuses to send before the gate is asked, so no approval is spent', async () => {
  const adapter = recordingSend();
  const { runtime, goal } = runtimeWith(adapter);
  const approval = runtime.approvals.grant(approvalFor('send'));
  const result = await runtime.run(plan(runtime, goal.id, 'send').id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'send_action_unsupported');
  assert.equal(runtime.approvals.list().find((item) => item.id === approval.id)?.usesConsumed, 0, 'the approval is untouched');
  assert.equal(adapter.requests.length, 0);
  assert.ok(!result.execution.evidence.some((item) => item.kind === 'decision' && item.tool === 'external_send'), 'the gate was never asked');
});

test('the approval binds action, channel, recipient and content: a draft approval never sends, an edit is caught, the exact one drafts once', async () => {
  const adapter = recordingSend({ sends: true });
  const { runtime, goal } = runtimeWith(adapter);

  const sendTask = plan(runtime, goal.id, 'send');
  const draftApproval = runtime.approvals.grant(approvalFor('draft'));
  const sent = await runtime.run(sendTask.id);
  assert.equal(sent.task.status, 'awaiting_approval', 'an approval to draft does not send');
  assert.equal(sent.execution.report?.status, 'approval_required');
  assert.match(sent.execution.report?.nextStep ?? '', /external_send send email:pilot-lead@example.edu content=[0-9a-f]{12}: tool external_send/);
  assert.equal(adapter.requests.length, 0);
  runtime.approvals.revoke(draftApproval.id, 'owner');

  const draftTask = plan(runtime, goal.id, 'draft');
  runtime.approvals.grant(approvalFor('draft', payloadHash({ ...CONTENT, body: `${CONTENT.body} Grading ships Friday.` })));
  const edited = await runtime.run(draftTask.id);
  assert.equal(edited.task.status, 'awaiting_approval', 'an approval for other content does not draft this one, and a revoked one does not either');
  assert.equal(adapter.requests.length, 0);

  const exact = runtime.approvals.grant(approvalFor('draft'));
  runtime.scheduler.requeue(draftTask.id, 'owner');
  const drafted = await runtime.run(draftTask.id);
  assert.equal(drafted.task.status, 'awaiting_verification', drafted.execution.report?.status ?? '');
  assert.deepEqual(adapter.requests.map((request) => [request.action, request.channel, request.recipient, request.subject, request.body, request.contentHash, request.taskId]), [['draft', CONTENT.channel, CONTENT.recipient, CONTENT.subject, CONTENT.body, HASH, draftTask.id]], 'the adapter was called once, with the exact content');
  assert.deepEqual(drafted.execution.pendingExternalActions, [], 'the pending record is cleared on a confirmed result');
  assert.ok(drafted.execution.evidence.some((item) => item.kind === 'note' && item.label === 'send' && item.detail.includes('draft-1')));
  assert.ok(drafted.execution.evidence.some((item) => item.kind === 'decision' && item.tool === 'external_send' && item.code === 'approved'));
  assert.equal(runtime.approvals.list().find((item) => item.id === exact.id)?.usesConsumed, 1);
  const persisted = JSON.stringify(runtime.store.executions().find((record) => record.id === drafted.execution.id));
  assert.ok(!persisted.includes(CONTENT.body), 'the body is not in the execution record; only its hash is');
  assert.ok(!JSON.stringify(runtime.audit.events()).includes(CONTENT.body), 'nor in the audit');

  const again = await runtime.run(plan(runtime, goal.id, 'draft', 'operate', 'draft the pilot note again').id);
  assert.equal(again.task.status, 'awaiting_approval', 'a spent approval does not draft twice');
  assert.equal(adapter.requests.length, 1);
});

test('when the adapter fails after the approval is spent, the action stays recorded as pending and is never repeated', async () => {
  const adapter = recordingSend({ fail: true });
  const { runtime, goal } = runtimeWith(adapter);
  const task = plan(runtime, goal.id, 'draft');
  runtime.approvals.grant(approvalFor('draft'));
  const result = await runtime.run(task.id);
  assert.equal(result.task.status, 'failed');
  assert.equal(result.execution.report?.status, 'send_adapter_error');
  assert.deepEqual(result.execution.pendingExternalActions, [`external_send draft email:pilot-lead@example.edu content=${HASH.slice(0, 12)} via recording`]);
  assert.match(result.execution.report?.risks[0] ?? '', /may have taken effect/);
  runtime.scheduler.requeue(task.id, 'owner');
  const retry = await runtime.run(task.id);
  assert.equal(retry.task.status, 'awaiting_approval', 'the spent approval is not reused; a person decides');
  assert.equal(adapter.requests.length, 1, 'the runtime never repeated the external action');
});
