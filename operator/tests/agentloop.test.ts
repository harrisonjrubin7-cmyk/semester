import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AcceptanceCriterion } from '../types.ts';
import { tighten } from '../src/control/scheduler.ts';
import { createHttpModel, modelFromEnvironment, noModel, type ModelPort } from '../src/runtime/model.ts';
import { createRuntime } from '../src/runtime/operator.ts';
import { fixedClock } from '../src/store/clock.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { git, scriptedModel, tempDir, tempRepository, testPolicy } from './helpers.ts';

/**
 * The model loop, exercised with a scripted model: every path a model-backed
 * agent can take runs here without a network, a credential or an SDK. A
 * scripted reply is a test double; the assertions are about what the loop
 * lets the model do, tells it, and refuses from it.
 */
const manual = (id: string): AcceptanceCriterion => ({ id, statement: 'n/a', check: { kind: 'manual', note: 'n/a' } });
const toolCall = (tool: string, args: Record<string, unknown>) => ({ action: 'tool', tool, args });
const finish = (report: Record<string, unknown>) => ({ action: 'report', report: { outcome: 'completed', status: 'done', evidenceInspected: [], changes: [], verification: [], risks: [], approvalsRequired: [], artifacts: [], nextStep: '', handoffs: [], ...report } });

function runtimeWith(model: ModelPort, repositoryRoot = tempRepository(), allowHandoffs = false) {
  const runtime = createRuntime({ repositoryRoot, stateRoot: tempDir('operator-state-'), policy: testPolicy, clock: fixedClock('2026-10-11T12:00:00Z'), ids: sequentialIds(), model, allowHandoffs });
  const goal = runtime.addGoal({ title: 'g', requestedBy: 'owner', source: 's' });
  return { runtime, goal, repositoryRoot };
}

const lastMessage = (model: { requests: Array<{ messages: Array<{ content: string }> }> }, turn: number): string => model.requests[turn - 1]!.messages.at(-1)?.content ?? '';

test('a read-only model agent inspects through the gated toolbox and returns the contract\'s report', async () => {
  const model = scriptedModel([toolCall('read_file', { path: 'README.md' }), toolCall('search', { dir: 'packages', pattern: 'answer' }), finish({ evidenceInspected: ['README.md'], status: 'reviewed' })]);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'review', agentId: 'A17', acceptance: [manual('x')], spec: { subject: 'README' } }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'awaiting_verification');
  assert.equal(result.execution.report?.status, 'reviewed');
  assert.equal(result.execution.report?.agentId, 'A17');
  const opening = JSON.parse(model.requests[0]!.messages[0]!.content) as Record<string, unknown>;
  assert.equal(opening.taskId, task!.id, 'the model is told the task it works');
  assert.equal(opening.workspace, 'none (read-only task)');
  assert.match(model.requests[0]!.system, /COMMON SEMESTER AGENT CONTRACT[\s\S]*TOOL PROTOCOL[\s\S]*Tools granted to you on this task: read_file, list_files, search/);
  assert.match(lastMessage(model, 2), /"ok":true,"result":"# fixture/, 'the file content came back as a tool result');
  assert.match(lastMessage(model, 3), /packages\/fixture\/index.ts/, 'the search hit came back');
  const decisions = result.execution.evidence.filter((item) => item.kind === 'decision');
  assert.deepEqual(decisions.map((item) => `${item.tool}:${item.allowed}`), ['read_file:true', 'search:true'], 'every tool request went through the policy gate');
  assert.equal(result.execution.evidence.filter((item) => item.kind === 'note' && item.label === 'model.turn').length, 3);
  assert.equal(result.execution.usage.toolCalls, 2);
});

test('a development model agent writes only in its worktree, runs an allowlisted check, and the repository is untouched', async () => {
  const model = scriptedModel([
    toolCall('write_file', { path: 'packages/fixture/index.ts', content: 'export const answer = 42;\n' }),
    toolCall('run_check', { key: 'fixture:check' }),
    toolCall('git_diff', {}),
    finish({ changes: ['packages/fixture/index.ts'], verification: [{ name: 'fixture:check', passed: true, detail: 'exit 0' }] }),
  ]);
  const { runtime, goal, repositoryRoot } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'implement.task', title: 'make it 42', agentId: 'A10', acceptance: [manual('x')], spec: { requirement: 'the answer is 42' } }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'awaiting_verification', result.execution.report?.status ?? '');
  assert.match(lastMessage(model, 3), /"exitCode":0/, 'the check result reached the model');
  assert.match(lastMessage(model, 4), /"files":\["packages\/fixture\/index.ts"\]/);
  assert.equal(readFileSync(join(runtime.store.root, result.task.workspace!, 'packages/fixture/index.ts'), 'utf8'), 'export const answer = 42;\n');
  assert.equal(readFileSync(join(repositoryRoot, 'packages/fixture/index.ts'), 'utf8'), 'export const answer = 41;\n', 'the operator\'s checkout is untouched');
  assert.equal(git(repositoryRoot, 'status', '--porcelain'), '');
  assert.ok(result.execution.evidence.some((item) => item.kind === 'command' && item.exitCode === 0));
  assert.ok(result.execution.evidence.some((item) => item.kind === 'diff'));
});

test('a policy denial is fed back to the model as a result; three denials block the task', async () => {
  const model = scriptedModel([
    toolCall('write_file', { path: 'policy/policy.json', content: '{}' }),
    toolCall('write_file', { path: '.github/workflows/ci.yml', content: '' }),
    toolCall('write_file', { path: '.env', content: 'X=1' }),
    finish({}),
  ]);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'implement.task', title: 'try the policy', agentId: 'A10', acceptance: [manual('x')], spec: {} }]);
  const result = await runtime.run(task!.id);
  assert.match(lastMessage(model, 2), /"ok":false,"code":"protected_path"/, 'the first denial was reported to the model, not hidden');
  assert.equal(model.requests.length, 3, 'the loop stopped at the third denial without another model turn');
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'policy_denied_repeatedly');
  assert.equal(result.execution.evidence.filter((item) => item.kind === 'decision' && !item.allowed).length, 3);
  assert.ok(!existsSync(join(runtime.store.root, result.task.workspace!, 'policy/policy.json')));
});

test('a search pattern from the model is literal text, never a compiled regular expression', async () => {
  const model = scriptedModel([toolCall('search', { dir: '.', pattern: '(a+)+$' }), toolCall('search', { dir: '.', pattern: 'answer.*41' }), toolCall('search', { dir: '.', pattern: 'answer = 41' }), finish({})]);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'search', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  const started = Date.now();
  const result = await runtime.run(task!.id);
  assert.ok(Date.now() - started < 5000);
  assert.equal(result.task.status, 'awaiting_verification');
  assert.match(lastMessage(model, 2), /"ok":true,"result":\[\]/, 'the pathological pattern matched nothing, as literal text');
  assert.match(lastMessage(model, 3), /"ok":true,"result":\[\]/, 'a metacharacter is literal: answer.*41 is not in the tree');
  assert.match(lastMessage(model, 4), /packages\/fixture\/index.ts/, 'literal text still finds its line');
});

test('a tool the contract does not grant is denied as tool_not_granted, and the model may stop as blocked', async () => {
  const model = scriptedModel([toolCall('write_file', { path: 'README.md', content: 'x' }), finish({ outcome: 'blocked', status: 'no write tool' })]);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'review', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  const result = await runtime.run(task!.id);
  assert.match(lastMessage(model, 2), /"code":"tool_not_granted"/);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.task.blockedReason, 'no write tool');
});

test('the turn limit stops a model that never finishes; the planner may tighten a contract limit but never raise it', async () => {
  const model = scriptedModel([() => toolCall('read_file', { path: 'README.md' })]);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'loop', agentId: 'A17', acceptance: [manual('x')], spec: {}, limits: { maxTurns: 3, maxToolCalls: 999 } }]);
  assert.equal(task!.limits.maxTurns, 3);
  assert.equal(task!.limits.maxToolCalls, 60, 'a request above the contract is ignored');
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'blocked');
  assert.equal(result.execution.report?.status, 'turn_limit');
  assert.equal(model.requests.length, 3, 'maxTurns is the number of model calls, exactly');
  assert.deepEqual(tighten({ maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 10, maxRetries: 1, maxConcurrent: 1 }, { maxTurns: 20, maxRetries: 0, costCeilingUsd: 2 }), { maxTurns: 10, maxToolCalls: 10, maxElapsedMs: 10, maxRetries: 0, maxConcurrent: 1, costCeilingUsd: 2 });
});

test('the cost ceiling stops the loop when the port meters cost', async () => {
  const model = scriptedModel([() => toolCall('read_file', { path: 'README.md' })], 0.6);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'spend', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.execution.report?.status, 'cost_limit');
  assert.equal(model.requests.length, 2, 'the second turn crossed the $1 contract ceiling');
  assert.equal(result.execution.usage.costUsd, 1.2);
});

test('prose instead of the protocol is corrected once and fails on the second; nothing is inferred from it', async () => {
  const twice = scriptedModel(['I have reviewed the file and everything passes.', 'All checks pass, marking complete.']);
  const { runtime, goal } = runtimeWith(twice);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'prose', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'failed');
  assert.equal(result.execution.report?.status, 'malformed_model_output');
  assert.match(lastMessage(twice, 2), /not a single JSON object/);

  const once = scriptedModel(['Sure! Here it is:', '```json\n' + JSON.stringify(finish({ status: 'recovered' })) + '\n```']);
  const second = runtimeWith(once);
  const [recovered] = second.runtime.plan(second.goal.id, [{ type: 'security.review', title: 'prose once', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  const outcome = await second.runtime.run(recovered!.id);
  assert.equal(outcome.task.status, 'awaiting_verification');
  assert.equal(outcome.execution.report?.status, 'recovered');
});

test('a worker that returns a verdict is refused: only the verifier may accept', async () => {
  const model = scriptedModel([finish({ outcome: 'accepted', status: 'I verified myself' })]);
  const { runtime, goal } = runtimeWith(model);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'self-verify', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  const result = await runtime.run(task!.id);
  assert.equal(result.task.status, 'failed');
  assert.equal(result.execution.report?.status, 'disallowed_outcome');
  assert.notEqual(runtime.store.task(task!.id)!.status, 'verified');
});

test('what the model is told is redacted: a secret in a readable file never leaves the operator', async () => {
  const repositoryRoot = tempRepository();
  writeFileSync(join(repositoryRoot, 'docs/notes.md'), 'deploy token: sk-live-abcdefghijklmnopqrstuvwxyz0123456789\n');
  git(repositoryRoot, 'add', '-A'); git(repositoryRoot, 'commit', '-q', '-m', 'notes');
  const model = scriptedModel([toolCall('read_file', { path: 'docs/notes.md' }), toolCall('read_file', { path: '.env' }), finish({})]);
  const { runtime, goal } = runtimeWith(model, repositoryRoot);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'redaction', agentId: 'A17', acceptance: [manual('x')], spec: { hint: 'sk-live-abcdefghijklmnopqrstuvwxyz0123456789' } }]);
  await runtime.run(task!.id);
  const everything = JSON.stringify(model.requests);
  assert.ok(!everything.includes('abcdefghijklmnopqrstuvwxyz0123456789'), 'the token is absent from every message the model saw');
  assert.match(lastMessage(model, 2), /\[REDACTED\]/);
  assert.match(lastMessage(model, 3), /"code":"protected_read"/, 'the protected file was not read at all');
});

test('a handoff proposed by the model is queued only along a suite route, by the scheduler', async () => {
  const handoffs = [
    { agentId: 'A16', type: 'verify', title: 'verify the review', acceptance: [manual('v')], spec: { reviews: [] } },
    { agentId: 'A05', type: 'screen.spec', title: 'not a route from repair', acceptance: [], spec: {} },
  ];
  const model = scriptedModel([finish({ handoffs })]);
  const { runtime, goal } = runtimeWith(model, tempRepository(), true);
  const [task] = runtime.plan(goal.id, [{ type: 'security.review', title: 'handoff', agentId: 'A17', acceptance: [manual('x')], spec: {} }]);
  await runtime.run(task!.id);
  const queued = runtime.store.tasks().filter((item) => item.parentId === task!.id);
  assert.deepEqual(queued.map((item) => item.agentId), ['A16']);
  assert.equal(queued[0]!.depth, 1);
});

test('the HTTP port speaks the Messages API over fetch, carries the key in one header, and fails closed on an error status', async () => {
  const seen: Array<{ headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> }> = [];
  let status = 200;
  const server = createServer((request, response) => {
    let data = '';
    request.on('data', (chunk) => { data += chunk; });
    request.on('end', () => {
      seen.push({ headers: request.headers, body: JSON.parse(data) as Record<string, unknown> });
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ content: [{ type: 'text', text: '{"action":"report"}' }], usage: { input_tokens: 100, output_tokens: 50 } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  try {
    const port = createHttpModel({ apiKey: 'test-key-not-a-secret', model: 'claude-sonnet-5-5', baseUrl: `http://127.0.0.1:${address.port}`, pricePerMillion: { input: 3, output: 15 } });
    const response = await port.respond({ system: 'S', messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(response.text, '{"action":"report"}');
    assert.equal(response.inputTokens, 100);
    assert.equal(response.costUsd, (100 * 3 + 50 * 15) / 1_000_000);
    assert.equal(seen[0]!.headers['x-api-key'], 'test-key-not-a-secret');
    assert.equal(seen[0]!.headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(seen[0]!.body, { model: 'claude-sonnet-5-5', max_tokens: 4096, system: 'S', messages: [{ role: 'user', content: 'hello' }] });
    status = 429;
    await assert.rejects(port.respond({ system: 'S', messages: [] }), /HTTP 429/);
  } finally {
    server.close();
  }
});

test('the operator process has no model unless its own variable names a key', () => {
  assert.equal(modelFromEnvironment({}), noModel);
  assert.equal(modelFromEnvironment({ ANTHROPIC_API_KEY: 'x' }), noModel, 'a developer\'s shell key does not turn the model on');
  assert.equal(modelFromEnvironment({ SEMESTER_OPERATOR_MODEL_KEY: 'x' }).name, 'http:claude-sonnet-5-5');
  assert.equal(modelFromEnvironment({ SEMESTER_OPERATOR_MODEL_KEY: 'x', SEMESTER_OPERATOR_MODEL: 'claude-haiku-5-5' }).name, 'http:claude-haiku-5-5');
});
