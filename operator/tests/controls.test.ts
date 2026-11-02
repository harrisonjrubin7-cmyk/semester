import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, writeFileSync } from 'node:fs';
import { createApprovalService } from '../src/control/approvals.ts';
import { createAuditLog, createKillSwitch } from '../src/control/audit.ts';
import { globToRegExp, matchesAny } from '../src/control/glob.ts';
import { createAggregateLimiter, createRunLimiter } from '../src/control/limits.ts';
import { createPolicyController, repositoryPath, validatePolicy } from '../src/control/policy.ts';
import { fixedClock } from '../src/store/clock.ts';
import { payloadHash } from '../src/store/hash.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { REDACTED, redact, redactString } from '../src/store/redact.ts';
import { createFileStore } from '../src/store/store.ts';
import type { PolicyContext, ToolName } from '../types.ts';
import { tempDir, testPolicy } from './helpers.ts';

const READ: ToolName[] = ['read_file', 'list_files', 'search'];
const DEV: ToolName[] = [...READ, 'write_file', 'run_check', 'git_diff'];

function harness() {
  const clock = fixedClock('2026-10-11T12:00:00Z');
  const store = createFileStore(tempDir());
  const audit = createAuditLog(store, clock);
  const killSwitch = createKillSwitch(store, clock, audit);
  const approvals = createApprovalService(store, clock, sequentialIds());
  const policy = createPolicyController(testPolicy, { killSwitchEngaged: () => killSwitch.engaged(), approvals });
  const context = (overrides: Partial<PolicyContext> = {}): PolicyContext => ({ taskId: 'task_001', agentId: 'A10', mode: 'develop', environment: 'development', workspaceRoot: '/ws/task_001', repositoryRoot: '/repo', allowedWrites: ['src/**'], agentTools: DEV, ...overrides });
  return { clock, store, audit, killSwitch, approvals, policy, context };
}

test('glob: ** crosses directories, * stays in one segment', () => {
  assert.ok(globToRegExp('src/**').test('src/a/b/c.ts'));
  assert.ok(globToRegExp('**/.env').test('app/.env'));
  assert.ok(globToRegExp('.env').test('.env'));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/b.ts'));
  assert.ok(matchesAny('packages/x/package.json', ['packages/*/package.json']));
});

test('redaction removes secret-looking values and secret-named keys, and leaves ordinary text', () => {
  assert.equal(redactString('token sk-live-abcdefghijklmnopqrstuvwxyz0123456789 here'), `token ${REDACTED} here`);
  assert.equal(redactString('Authorization: Bearer abcdefghijklmnopqrstuvwxyz'), `Authorization: ${REDACTED}`);
  assert.deepEqual(redact({ apiKey: 'plain', nested: { password: 'x', ok: 'fine' }, list: ['ghp_abcdefghijklmnopqrstuvwxyz1234'] }), { apiKey: REDACTED, nested: { password: REDACTED, ok: 'fine' }, list: [REDACTED] });
  assert.equal(redactString('exit code 0; 12 files changed'), 'exit code 0; 12 files changed');
});

test('policy is validated at construction and fails closed on a bad policy', () => {
  assert.deepEqual(validatePolicy(testPolicy), []);
  assert.throws(() => createPolicyController({ ...testPolicy, commands: { bad: { argv: [], cwd: '.', timeoutMs: 1 } } }, { killSwitchEngaged: () => false, approvals: harness().approvals }), /refusing to start/);
  assert.ok(validatePolicy(null).length > 0);
});

test('policy object is frozen: a worker holding the controller cannot widen it', () => {
  const { policy } = harness();
  assert.throws(() => { (policy.policy.protectedPaths as string[]).push('x'); });
  assert.throws(() => { (policy.policy as { approvalRequiredFrom: string }).approvalRequiredFrom = 'critical'; });
});

test('policy denies, in order: kill switch, ungranted tool, observe mode, outside workspace, protected path, disallowed write', () => {
  const { policy, context, killSwitch } = harness();
  const write = { tool: 'write_file' as const, target: '/ws/task_001/src/a.ts', risk: 'medium' as const, payloadHash: 'p' };
  assert.equal(policy.evaluate(write, context()).code, 'allowed');
  assert.equal(policy.evaluate(write, context({ agentTools: READ })).code, 'tool_not_granted');
  assert.equal(policy.evaluate(write, context({ mode: 'observe' })).code, 'observe_mode');
  assert.equal(policy.evaluate({ ...write, target: '/repo/src/a.ts' }, context()).code, 'outside_workspace');
  assert.equal(policy.evaluate({ ...write, target: '/ws/task_001/policy/p.json' }, context({ allowedWrites: ['**'] })).code, 'protected_path');
  assert.equal(policy.evaluate({ ...write, target: '/ws/task_001/docs/x.md' }, context()).code, 'write_not_allowed');
  assert.equal(policy.evaluate({ ...write, target: '/ws/task_001/../other/a.ts' }, context()).code, 'outside_workspace');
  killSwitch.engage('drill', 'owner');
  assert.equal(policy.evaluate(write, context()).code, 'kill_switch');
  assert.equal(policy.evaluate({ tool: 'read_file', target: '/repo/README.md', risk: 'low' }, context()).code, 'kill_switch');
});

test('policy protects reads of secrets and commands off the allowlist', () => {
  const { policy, context } = harness();
  assert.equal(policy.evaluate({ tool: 'read_file', target: '/repo/.env', risk: 'low' }, context()).code, 'protected_read');
  assert.equal(policy.evaluate({ tool: 'read_file', target: '/ws/task_001/app/.env', risk: 'low' }, context()).code, 'protected_read');
  assert.equal(policy.evaluate({ tool: 'read_file', target: '/elsewhere/x', risk: 'low' }, context()).code, 'outside_repository');
  assert.equal(policy.evaluate({ tool: 'run_check', target: 'rm -rf', risk: 'low' }, context()).code, 'command_not_allowed');
  assert.equal(policy.evaluate({ tool: 'run_check', target: 'fixture:check', risk: 'low' }, context()).code, 'allowed');
  assert.equal(policy.evaluate({ tool: 'run_check', target: 'fixture:check', risk: 'low' }, context({ mode: 'observe' })).code, 'observe_mode');
});

test('consequential actions need an exact, live, unconsumed approval from someone other than the actor', () => {
  const { policy, context, approvals, clock } = harness();
  const hash = payloadHash({ target: 'staging', artifact: 'abc' });
  const action = { tool: 'release_adapter' as const, target: 'staging', risk: 'high' as const, payloadHash: hash, external: true };
  const ctx = context({ agentTools: ['release_adapter'], mode: 'operate', environment: 'staging' });
  const first = policy.evaluate(action, ctx);
  assert.equal(first.code, 'approval_required');
  assert.equal(first.requiresApproval, true);
  assert.equal(policy.evaluate({ ...action, payloadHash: undefined }, ctx).code, 'payload_hash_required');
  assert.equal(policy.evaluate(action, context({ agentTools: ['release_adapter'], mode: 'develop', environment: 'staging' })).code, 'operate_mode_required');

  const approval = approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: hash, approver: 'owner', ttlMs: 60_000, usesAllowed: 1 });
  assert.equal(policy.evaluate({ ...action, payloadHash: payloadHash({ target: 'staging', artifact: 'changed' }) }, ctx).code, 'approval_required', 'a changed payload finds no approval');
  assert.equal(policy.evaluate({ ...action, target: 'production' }, ctx).code, 'approval_required', 'a different target finds no approval');
  assert.equal(policy.evaluate(action, { ...ctx, agentId: 'owner' }).code, 'approval_required', 'the approver cannot act on their own approval');
  // An approval bound to an artifact is consumed through the gate only by an action carrying that exact artifact hash.
  const bound = approvals.grant({ tool: 'release_adapter', target: 'preview', payloadHash: hash, artifactHash: 'sha256:artifact-1', approver: 'owner', ttlMs: 60_000, usesAllowed: 1 });
  const release = { ...action, target: 'preview' };
  assert.equal(policy.evaluate(release, ctx).code, 'approval_required', 'an action without an artifact hash cannot consume an artifact-bound approval');
  assert.equal(policy.evaluate({ ...release, artifactHash: 'sha256:artifact-2' }, ctx).code, 'approval_required', 'a different artifact finds no approval');
  assert.equal(policy.evaluate({ ...release, artifactHash: 'sha256:artifact-1' }, ctx).code, 'approved', 'the exact artifact consumes it');
  assert.equal(approvals.find({ tool: 'release_adapter', target: 'preview', payloadHash: hash, artifactHash: 'sha256:artifact-1', taskId: ctx.taskId, actor: ctx.agentId })?.id, undefined, `${bound.id} is spent`);
  assert.equal(policy.evaluate(action, ctx).code, 'approved');
  assert.equal(policy.evaluate(action, ctx).code, 'approval_required', 'a consumed approval is spent');
  assert.equal(approvals.list()[0]!.usesConsumed, 1);
  assert.equal(approvals.list()[0]!.id, approval.id);

  approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: hash, approver: 'owner', ttlMs: 1000 });
  clock.advance(1001);
  assert.equal(policy.evaluate(action, ctx).code, 'approval_required', 'an expired approval is stale');

  const third = approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: hash, approver: 'owner', ttlMs: 60_000, taskId: 'task_999' });
  assert.equal(policy.evaluate(action, ctx).code, 'approval_required', 'an approval bound to another task does not transfer');
  approvals.revoke(third.id, 'owner');
  const fourth = approvals.grant({ tool: 'release_adapter', target: 'staging', payloadHash: hash, approver: 'owner', ttlMs: 60_000 });
  approvals.revoke(fourth.id, 'owner');
  assert.equal(policy.evaluate(action, ctx).code, 'approval_required', 'a revoked approval is gone');
});

test('development writes to staging and production environments need approval even at low risk', () => {
  const { policy, context } = harness();
  const write = { tool: 'write_file' as const, target: '/ws/task_001/src/a.ts', risk: 'low' as const, payloadHash: 'p' };
  assert.equal(policy.evaluate(write, context({ environment: 'production' })).code, 'approval_required');
  assert.equal(policy.evaluate({ tool: 'read_file', target: '/repo/README.md', risk: 'low' }, context({ environment: 'production' })).code, 'allowed', 'reads never need approval');
});

test('repositoryPath normalises and refuses escapes', () => {
  assert.equal(repositoryPath('/repo', '/repo/a/b.ts'), 'a/b.ts');
  assert.equal(repositoryPath('/repo', 'a/b.ts'), 'a/b.ts');
  assert.equal(repositoryPath('/repo', '/repo/../x'), undefined);
  assert.equal(repositoryPath('/repo', '/repo'), '.');
});

test('run limiter stops at each threshold and a worker cannot raise it', () => {
  const clock = fixedClock('2026-10-11T12:00:00Z');
  const limiter = createRunLimiter({ maxTurns: 2, maxToolCalls: 3, maxElapsedMs: 1000, maxRetries: 0, maxConcurrent: 1, costCeilingUsd: 0.5 }, clock);
  assert.equal(limiter.consume('turn').ok, true);
  assert.equal(limiter.consume('turn').ok, true);
  assert.equal((limiter.consume('turn') as { code: string }).code, 'turn_limit');
  assert.throws(() => { (limiter.limits() as { maxTurns: number }).maxTurns = 99; });
  const second = createRunLimiter({ maxTurns: 10, maxToolCalls: 1, maxElapsedMs: 1000, maxRetries: 0, maxConcurrent: 1 }, clock);
  assert.equal(second.consume('tool').ok, true);
  assert.equal((second.consume('tool') as { code: string }).code, 'tool_limit');
  assert.equal((second.consume('retry') as { code: string }).code, 'tool_limit', 'the first failing limit stays reported');
  const third = createRunLimiter({ maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 1000, maxRetries: 0, maxConcurrent: 1, costCeilingUsd: 0.5 }, clock);
  assert.equal((third.addCost(0.6) as { code: string }).code, 'cost_limit');
  clock.advance(1001);
  assert.equal((createRunLimiter({ maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 1000, maxRetries: 0, maxConcurrent: 1 }, fixedClock('2026-10-11T12:00:00Z')).consume('turn')).ok, true);
  const timed = createRunLimiter({ maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 1000, maxRetries: 0, maxConcurrent: 1 }, clock);
  clock.advance(1001);
  assert.equal((timed.consume('turn') as { code: string }).code, 'time_limit');
});

test('aggregate limiter spans runs', () => {
  const clock = fixedClock('2026-10-11T12:00:00Z');
  const aggregate = createAggregateLimiter({ maxToolCallsTotal: 3, maxElapsedTotalMs: 60_000 }, clock);
  const a = aggregate.child({ maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 60_000, maxRetries: 0, maxConcurrent: 1 });
  const b = aggregate.child({ maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 60_000, maxRetries: 0, maxConcurrent: 1 });
  a.consume('tool'); a.consume('tool'); b.consume('tool');
  assert.equal((b.consume('tool') as { code: string }).code, 'aggregate_tool_limit');
  assert.equal(aggregate.usage().toolCalls, 4);
});

test('audit events are redacted and hash-chained; tampering is detected', () => {
  const { audit, store } = harness();
  audit.record('x', 'tester', { note: 'ok', token: 'sk-live-abcdefghijklmnopqrstuvwxyz0123456789' });
  audit.record('y', 'tester', {});
  assert.equal(audit.verifyChain().ok, true);
  assert.equal(audit.events()[0]!.detail.token, REDACTED);
  const events = store.audit();
  events[0]!.detail.note = 'edited';
  writeFileSync(`${store.root}/audit.jsonl`, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  assert.deepEqual(audit.verifyChain(), { ok: false, events: 2, brokenAt: 1 });
});

test('kill switch interrupts running executions and records pending external actions', () => {
  const { killSwitch, store, clock } = harness();
  const now = clock.now().toISOString();
  store.saveGoal({ id: 'goal_1', title: 'g', requestedBy: 'o', source: 's', status: 'open', createdAt: now, updatedAt: now });
  store.saveTask({ id: 'task_1', goalId: 'goal_1', type: 'x', title: 't', agentId: 'A10', status: 'running', priority: 1, dependsOn: [], depth: 0, dedupeKey: 'k', acceptance: [], spec: {}, registryKeys: [], mode: 'develop', environment: 'development', limits: { maxTurns: 1, maxToolCalls: 1, maxElapsedMs: 1, maxRetries: 0, maxConcurrent: 1 }, attempts: 1, createdAt: now, updatedAt: now });
  store.saveExecution({ id: 'run_1', taskId: 'task_1', agentId: 'A10', status: 'running', startedAt: now, usage: { turns: 0, toolCalls: 0, elapsedMs: 0, retries: 0 }, evidence: [], pendingExternalActions: ['deploy staging (outcome unknown)'] });
  const result = killSwitch.engage('incident', 'owner');
  assert.deepEqual(result.interrupted, ['run_1']);
  assert.equal(store.executions()[0]!.status, 'interrupted');
  assert.deepEqual(store.executions()[0]!.pendingExternalActions, ['deploy staging (outcome unknown)']);
  assert.equal(store.task('task_1')!.status, 'interrupted');
  assert.equal(killSwitch.engaged(), true);
  killSwitch.release('owner');
  assert.equal(killSwitch.engaged(), false);
  assert.equal(store.task('task_1')!.status, 'interrupted', 'release does not resume interrupted work on its own');
});

test('file store writes atomically and refuses a malformed collection', () => {
  const store = createFileStore(tempDir());
  const now = '2026-10-11T12:00:00.000Z';
  store.saveGoal({ id: 'g1', title: 'a', requestedBy: 'o', source: 's', status: 'open', createdAt: now, updatedAt: now });
  store.saveGoal({ id: 'g1', title: 'b', requestedBy: 'o', source: 's', status: 'open', createdAt: now, updatedAt: now });
  assert.equal(store.goals().length, 1);
  assert.equal(store.goals()[0]!.title, 'b');
  assert.deepEqual(readdirSync(store.root).filter((name) => name.endsWith('.tmp')), []);
  writeFileSync(`${store.root}/tasks.json`, '{"not":"an array"}');
  assert.throws(() => store.tasks(), /not a JSON array/);
});

test('glob patterns are bounded: metacharacters are literal, and traversal never reaches the matcher', () => {
  const started = Date.now();
  assert.equal(matchesAny('(a+)+$', ['(a+)+$']), true, 'a pathological regular expression is only a literal path here');
  assert.equal(matchesAny('a'.repeat(40) + '!', ['(a+)+$']), false);
  assert.equal(matchesAny('a'.repeat(40) + '!', ['**/**/**/**/**/*.ts']), false);
  assert.ok(Date.now() - started < 1000, 'matching is quick on inputs built to be slow');
  assert.equal(globToRegExp('.env').source, '^\\.env$');
  assert.equal(repositoryPath('/repo', '/repo/../other/.env'), undefined, 'a path that escapes the root is rejected before any glob is consulted');
  assert.equal(repositoryPath('/repo', '../.env'), undefined);
});
