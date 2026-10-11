import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createRuntime } from '../src/runtime/operator.ts';
import { fixedClock } from '../src/store/clock.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { createToolbox, ToolDenied } from '../src/tools/adapters.ts';
import { createWorkspace, workspaceDiff } from '../src/tools/workspace.ts';
import { createPolicyController } from '../src/control/policy.ts';
import { createApprovalService } from '../src/control/approvals.ts';
import { createAuditLog } from '../src/control/audit.ts';
import { createRunLimiter } from '../src/control/limits.ts';
import { createFileStore } from '../src/store/store.ts';
import { git, tempDir, tempRepository, testPolicy } from './helpers.ts';
import type { AcceptanceCriterion, ExecutionRecord } from '../types.ts';

function runtimeFor(repositoryRoot: string, stateRoot = tempDir('operator-state-')) {
  const clock = fixedClock('2026-10-11T12:00:00Z');
  return { clock, runtime: createRuntime({ repositoryRoot, stateRoot, policy: testPolicy, clock, ids: sequentialIds() }) };
}

const cmd = (id: string, command: string): AcceptanceCriterion => ({ id, statement: `${command} passes`, check: { kind: 'command_passed', command } });

test('workspace is an isolated worktree from an exact commit; writes stay inside it', () => {
  const repo = tempRepository();
  const state = tempDir('operator-state-');
  const workspace = createWorkspace(repo, state, 'task_x');
  assert.ok(existsSync(join(workspace.path, 'packages/fixture/index.ts')));
  assert.equal(workspace.baseCommit, git(repo, 'rev-parse', 'HEAD'));
  assert.equal(workspace.branch, 'operator/task_x');
  const clock = fixedClock('2026-10-11T12:00:00Z');
  const store = createFileStore(tempDir());
  const audit = createAuditLog(store, clock);
  const approvals = createApprovalService(store, clock, sequentialIds());
  const policy = createPolicyController(testPolicy, { killSwitchEngaged: () => false, approvals });
  const limiter = createRunLimiter({ maxTurns: 5, maxToolCalls: 20, maxElapsedMs: 60_000, maxRetries: 0, maxConcurrent: 1 }, clock);
  const tools = createToolbox(policy, { taskId: 'task_x', agentId: 'A10', mode: 'develop', environment: 'development', workspaceRoot: workspace.path, repositoryRoot: repo, allowedWrites: ['packages/**'], agentTools: ['read_file', 'list_files', 'search', 'write_file', 'run_check', 'git_diff'] }, limiter, audit);
  tools.writeFile('packages/fixture/index.ts', 'export const answer = 42;\n');
  assert.equal(readFileSync(join(repo, 'packages/fixture/index.ts'), 'utf8'), 'export const answer = 41;\n', 'the checkout the operator runs from is untouched');
  assert.throws(() => tools.writeFile('docs/x.md', 'no'), (error: unknown) => error instanceof ToolDenied && error.code === 'write_not_allowed');
  assert.throws(() => tools.writeFile(join(repo, 'packages/fixture/index.ts'), 'no'), (error: unknown) => error instanceof ToolDenied && error.code === 'outside_workspace');
  assert.throws(() => tools.readFile('.env'), (error: unknown) => error instanceof ToolDenied && error.code === 'protected_read');
  // A directory grant does not reach a protected file: the walkers skip what read_file would deny, and say so.
  assert.ok(!tools.listFiles('.').includes('.env'), 'list_files does not list a protected file');
  assert.equal(tools.search('.', /SECRET_TOKEN/).length, 0, 'search does not read a protected file');
  assert.ok(tools.listFiles('.').includes('README.md'));
  assert.ok(tools.evidence.some((item) => item.kind === 'note' && item.label === 'search:protected_reads_skipped' && item.detail.includes('.env')));
  assert.throws(() => tools.runCheck('rm'), (error: unknown) => error instanceof ToolDenied && error.code === 'command_not_allowed');
  const check = tools.runCheck('fixture:check');
  assert.equal(check.exitCode, 0);
  assert.equal(tools.runCheck('fixture:fail').exitCode, 3);
  const diff = workspaceDiff(workspace.path);
  assert.deepEqual(diff.files, ['packages/fixture/index.ts']);
  assert.equal(tools.evidence.filter((item) => item.kind === 'decision' && !item.allowed).length, 4, 'every denial is evidence');
  assert.ok(audit.events().some((event) => event.kind === 'policy.decision' && event.detail.code === 'protected_read'));
});

test('one task end to end: request → persisted task → policy → implementation → checks → verification → evidence → status', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'Make the answer 42', requestedBy: 'owner', source: 'tests/runtime.test.ts' });
  const [inspect, implement, checks, verify] = runtime.plan(goal.id, [
    { type: 'inspect.repository', title: 'inspect', agentId: 'A04', acceptance: [{ id: 'i1', statement: 'index inspected', check: { kind: 'manual', note: 'read by a person' } }], spec: { paths: ['packages/fixture/index.ts', 'missing.ts'], patterns: ['answer'] } },
    { type: 'implement.patch', title: 'implement', agentId: 'A10', acceptance: [{ id: 'a1', statement: 'index says 42', check: { kind: 'file_contains', path: 'packages/fixture/index.ts', text: '42' } }], spec: { edits: [{ path: 'packages/fixture/index.ts', kind: 'replace', find: '41', replace: '42' }] }, dependsOn: ['inspect'] },
    { type: 'run.checks', title: 'checks', agentId: 'A15', acceptance: [cmd('t1', 'fixture:check')], spec: { checks: ['fixture:check'], workspaceOf: 'implement' }, dependsOn: ['implement'] },
    { type: 'verify', title: 'verify', agentId: 'A16', acceptance: [{ id: 'v1', statement: 'verdict returned', check: { kind: 'manual', note: 'n/a' } }], spec: { reviews: ['implement', 'checks'], workspaceOf: 'implement' }, dependsOn: ['checks'] },
  ]);
  assert.deepEqual(runtime.status().ready, [inspect!.id]);

  const first = await runtime.run(inspect!.id);
  assert.equal(first.execution.report?.outcome, 'completed');
  assert.deepEqual(first.execution.report?.verification.map((item) => item.passed), [true, false, true]);
  assert.equal(first.task.status, 'awaiting_verification');
  const second = await runtime.run(implement!.id);
  assert.equal(second.execution.report?.outcome, 'completed');
  assert.ok(second.execution.evidence.some((item) => item.kind === 'diff' && item.files.includes('packages/fixture/index.ts')));
  assert.ok(second.execution.evidence.some((item) => item.kind === 'decision' && item.allowed && item.tool === 'write_file'));
  assert.equal(readFileSync(join(repo, 'packages/fixture/index.ts'), 'utf8'), 'export const answer = 41;\n', 'main checkout untouched');

  const third = await runtime.run(checks!.id);
  const command = third.execution.evidence.find((item): item is Extract<ExecutionRecord['evidence'][number], { kind: 'command' }> => item.kind === 'command');
  assert.equal(command?.exitCode, 0);
  assert.equal(command?.command, 'node check.mjs');
  assert.equal(third.task.status, 'awaiting_verification');

  // Verification runs against the exact artifact: until the verdict, the implementing task waits on it.
  assert.equal(runtime.store.task(implement!.id)!.status, 'awaiting_verification');
  const fourth = await runtime.run(verify!.id);
  assert.equal(fourth.execution.report?.outcome, 'accepted', JSON.stringify(fourth.execution.report?.verification));
  assert.equal(fourth.task.status, 'verified');
  assert.equal(runtime.store.task(implement!.id)!.status, 'verified');
  assert.equal(runtime.store.task(checks!.id)!.status, 'verified');
  assert.equal(runtime.close(implement!.id, 'A01').id, implement!.id);
  assert.throws(() => runtime.close(inspect!.id, 'A01'), /only a verified task closes/);

  const status = runtime.status();
  assert.equal(status.audit.ok, true);
  assert.equal(status.executions, 4);
  assert.ok(status.usage.toolCalls >= 6);
  const persisted = createRuntime({ repositoryRoot: repo, stateRoot: runtime.store.root, policy: testPolicy });
  assert.equal(persisted.store.tasks().length, 4, 'state survives a new runtime over the same directory');
});

test('the verifier rejects a changed artifact and a failed check', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'g', requestedBy: 'owner', source: 's' });
  const [implement, checks, verify] = runtime.plan(goal.id, [
    { type: 'implement.patch', title: 'implement', agentId: 'A10', acceptance: [{ id: 'a1', statement: '42', check: { kind: 'file_contains', path: 'packages/fixture/index.ts', text: '42' } }], spec: { edits: [{ path: 'packages/fixture/index.ts', kind: 'replace', find: '41', replace: '43' }] } },
    { type: 'run.checks', title: 'checks', agentId: 'A15', acceptance: [cmd('t1', 'fixture:check')], spec: { checks: ['fixture:check'], workspaceOf: 'implement' }, dependsOn: ['implement'] },
    { type: 'verify', title: 'verify', agentId: 'A16', acceptance: [{ id: 'v1', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: { reviews: ['implement', 'checks'], workspaceOf: 'implement' }, dependsOn: ['checks'] },
  ]);
  await runtime.run(implement!.id);
  const ran = await runtime.run(checks!.id);
  assert.equal(ran.execution.report?.outcome, 'failed', 'the fixture check wants 42 and got 43');
  assert.equal(ran.task.status, 'failed');
  assert.deepEqual(runtime.scheduler.ready().map((task) => task.id), [verify!.id], 'the verifier may still run, to record the rejection');
  const verdict = await runtime.run(verify!.id);
  assert.equal(verdict.execution.report?.outcome, 'rejected');
  assert.equal(runtime.store.task(implement!.id)!.status, 'rejected');
  assert.ok(verdict.execution.report?.verification.some((item) => item.name === 't1' && !item.passed));

  // Control: tamper with the workspace after the record was written; the artifact hash no longer matches.
  const workspace = join(runtime.store.root, runtime.store.task(implement!.id)!.workspace!);
  const fs = await import('node:fs');
  fs.writeFileSync(join(workspace, 'packages/fixture/index.ts'), 'export const answer = 42;\n');
  runtime.scheduler.transition(verify!.id, 'ready');
  const again = await runtime.run(verify!.id);
  assert.ok(again.execution.report?.verification.some((item) => item.name.endsWith(':artifact') && !item.passed), 'a changed artifact is not the reviewed one');
});

test('policy denial inside a worker blocks the task and is recorded as evidence a verifier can check', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'negative control', requestedBy: 'owner', source: 's' });
  const [attempt, verify] = runtime.plan(goal.id, [
    { type: 'implement.patch', title: 'write policy', agentId: 'A10', acceptance: [{ id: 'n1', statement: 'denied', check: { kind: 'policy_denied', code: 'protected_path' } }], spec: { edits: [{ path: 'policy/policy.json', kind: 'create', content: '{}' }] } },
    { type: 'verify', title: 'verify denial', agentId: 'A16', acceptance: [{ id: 'v', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: { reviews: ['write policy'], workspaceOf: 'write policy' }, dependsOn: ['write policy'] },
  ]);
  const result = await runtime.run(attempt!.id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.status, 'blocked');
  assert.ok(result.execution.evidence.some((item) => item.kind === 'decision' && !item.allowed && item.code === 'write_not_allowed' || item.kind === 'decision' && !item.allowed && item.code === 'protected_path'));
  assert.ok(!existsSync(join(runtime.store.root, result.task.workspace!, 'policy/policy.json')));
  assert.deepEqual(runtime.scheduler.ready().map((task) => task.id), [verify!.id], 'the verifier may review a blocked task');
  const verdict = await runtime.run(verify!.id);
  assert.equal(verdict.execution.report?.outcome, 'accepted', 'the acceptance criterion was that policy denies the write, and it did');
  assert.ok(verdict.execution.report?.verification.some((item) => item.name === 'n1' && item.passed));
  assert.equal(runtime.store.task(attempt!.id)!.status, 'verified');
});

test('a model-only agent is blocked, not faked, when no model port is configured', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'g', requestedBy: 'owner', source: 's' });
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'review', agentId: 'A17', acceptance: [{ id: 'x', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: {} }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'model_unavailable');
  assert.equal(result.task.mode, 'observe');
});

test('a task type the agent does not accept fails; an undefined agent cannot be planned', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'g', requestedBy: 'owner', source: 's' });
  const [task] = runtime.plan(goal.id, [{ type: 'implement.patch', title: 'wrong agent', agentId: 'A16', acceptance: [{ id: 'x', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: { edits: [] } }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'failed');
  assert.match(result.task.lastError ?? '', /does not accept task type/);
});

test('the kill switch stops runReady and cancelled tasks never run', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'g', requestedBy: 'owner', source: 's' });
  const [a, b] = runtime.plan(goal.id, [
    { type: 'inspect.repository', title: 'a', agentId: 'A04', acceptance: [{ id: 'x', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: { paths: ['README.md'] } },
    { type: 'inspect.repository', title: 'b', agentId: 'A04', acceptance: [{ id: 'x', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: { paths: ['README.md'] } },
  ]);
  runtime.scheduler.cancel(b!.id, 'owner', 'not needed');
  runtime.killSwitch.engage('drill', 'owner');
  assert.deepEqual(await runtime.runReady(), []);
  await assert.rejects(runtime.run(a!.id), /Kill switch engaged/);
  runtime.killSwitch.release('owner');
  const ran = await runtime.runReady();
  assert.deepEqual(ran.map((item) => item.task.id), [a!.id]);
  assert.equal(runtime.store.task(b!.id)!.status, 'cancelled');
});

test('release preparation needs an approval that nobody granted, and says so', async () => {
  const repo = tempRepository();
  const { runtime } = runtimeFor(repo);
  const goal = runtime.addGoal({ title: 'g', requestedBy: 'owner', source: 's' });
  const [task] = runtime.plan(goal.id, [{ type: 'release.prepare', title: 'staging', agentId: 'A20', acceptance: [{ id: 'x', statement: 'n/a', check: { kind: 'manual', note: 'n/a' } }], spec: { target: 'staging', artifactHash: 'abc' } }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'awaiting_approval');
  assert.deepEqual(result.execution.report?.approvalsRequired, ['release_adapter target=staging artifact=abc']);
  assert.deepEqual(runtime.status().awaitingApproval, [task!.id]);
});
