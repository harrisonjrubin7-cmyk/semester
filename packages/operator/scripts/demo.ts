import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRuntime } from '../src/runtime/operator.ts';
import { sequentialIds } from '../src/store/ids.ts';
import { payloadHash } from '../src/store/hash.ts';
import { removeWorkspace, workspaceDiff } from '../src/tools/workspace.ts';
import { packageRoot, repositoryRoot } from './paths.ts';

/**
 * One complete task, end to end, against this repository:
 *
 *   request → persisted goal and tasks → policy check → implementation in an
 *   isolated worktree → allowlisted checks → independent verification →
 *   evidence → status update → continuation record → coverage refresh,
 *
 * plus a negative control (a worker tries to edit policy and is denied) and
 * an approval gate nobody opens (a release that stays awaiting approval).
 *
 * The task: register the operator's policy controller as a control record in
 * the platform-control registry, the repository's existing control plane.
 * Workspaces are created from HEAD, so the operator package must already be
 * committed. The demo writes its state to evidence/demo/state (committed as
 * the record of the run) and exports the workspace diff as a patch; applying
 * that patch to the branch is the operator's step, not the worker's.
 */
const evidenceRoot = resolve(packageRoot, 'evidence/demo');
const stateRoot = resolve(evidenceRoot, 'state');
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout.trim();
const committed = spawnSync('git', ['ls-tree', '--name-only', head, 'packages/operator/'], { cwd: repositoryRoot, encoding: 'utf8' }).stdout.trim();
if (!committed) { console.error('HEAD does not contain packages/operator; commit the package before running the demonstration.'); process.exit(1); }

rmSync(stateRoot, { recursive: true, force: true });
mkdirSync(stateRoot, { recursive: true });
const runtime = createRuntime({ repositoryRoot, stateRoot, ids: sequentialIds(), baseRef: head });

const controlRecord = {
  key: 'control.operator-policy',
  name: 'Semester Operator policy, approval and kill-switch enforcement',
  owner: 'platform-engineering',
  status: 'implemented',
  classification: 'preventive',
  test: 'packages/operator/tests/controls.test.ts',
  evidence: [
    'packages/operator/src/control/policy.ts',
    'packages/operator/src/control/approvals.ts',
    'packages/operator/src/control/audit.ts',
    'packages/operator/policy/policy.json',
    'packages/operator/tests/controls.test.ts',
    'packages/operator/tests/runtime.test.ts',
  ],
};
const recordPath = 'packages/platform-control/registry/controls/operator.json';
const recordText = `${JSON.stringify(controlRecord, null, 2)}\n`;

const goal = runtime.addGoal({ title: 'Register the Semester Operator policy controller as a platform-control control record', requestedBy: 'owner', source: 'packages/platform-control/README.md (controls registry) and the Semester agent-team request' });
const manual = (id: string, note: string) => ({ id, statement: note, check: { kind: 'manual' as const, note } });
const tasks = runtime.plan(goal.id, [
  { type: 'inspect.repository', title: 'inspect the controls registry and its validator', agentId: 'A04', acceptance: [manual('i1', 'inspection read by the implementing agent')], spec: { paths: ['packages/platform-control/registry/controls/tenant-isolation.json', 'packages/platform-control/validators/control-validator.ts', 'packages/operator/policy/policy.json'], patterns: ['validateRegistryRecords'] }, registryKeys: ['control.tenant-isolation'] },
  { type: 'implement.patch', title: 'add the operator control record', agentId: 'A10', acceptance: [
    { id: 'a1', statement: 'the record exists', check: { kind: 'file_exists', path: recordPath } },
    { id: 'a2', statement: 'the record names the operator control key', check: { kind: 'file_contains', path: recordPath, text: '"key": "control.operator-policy"' } },
    { id: 'a3', statement: 'every evidence path it cites exists (registry:validate)', check: { kind: 'command_passed', command: 'registry:validate' } },
    { id: 'a4', statement: 'the platform-control suite still passes', check: { kind: 'command_passed', command: 'platform-control:test' } },
  ], spec: { edits: [{ path: recordPath, kind: 'create', content: recordText }] }, dependsOn: ['inspect the controls registry and its validator'], registryKeys: ['control.operator-policy'] },
  { type: 'run.checks', title: 'validate the registry and run the platform-control tests', agentId: 'A15', acceptance: [{ id: 't1', statement: 'both checks pass', check: { kind: 'command_passed', command: 'registry:validate' } }], spec: { checks: ['registry:validate', 'platform-control:test'], workspaceOf: 'add the operator control record' }, dependsOn: ['add the operator control record'], registryKeys: ['control.operator-policy'] },
  { type: 'verify', title: 'independently verify the record against its criteria', agentId: 'A16', acceptance: [manual('v1', 'verdict recorded')], spec: { reviews: ['add the operator control record', 'validate the registry and run the platform-control tests'], workspaceOf: 'add the operator control record' }, dependsOn: ['validate the registry and run the platform-control tests'], registryKeys: ['control.operator-policy'] },
  { type: 'implement.patch', title: 'negative control: a worker tries to edit the operator policy', agentId: 'A10', acceptance: [{ id: 'n1', statement: 'policy denies the write as a protected path', check: { kind: 'policy_denied', code: 'protected_path' } }], spec: { edits: [{ path: 'packages/operator/policy/policy.json', kind: 'create', content: '{"version":2}' }] }, registryKeys: ['control.operator-policy'] },
  { type: 'verify', title: 'verify the negative control', agentId: 'A16', acceptance: [manual('v2', 'verdict recorded')], spec: { reviews: ['negative control: a worker tries to edit the operator policy'], workspaceOf: 'negative control: a worker tries to edit the operator policy' }, dependsOn: ['negative control: a worker tries to edit the operator policy'], registryKeys: ['control.operator-policy'] },
  { type: 'release.prepare', title: 'prepare a staging release of the verified artifact (gate stays closed)', agentId: 'A20', acceptance: [manual('r1', 'an owner grants an exact-target, exact-artifact approval')], spec: { target: 'staging', artifactHash: 'set-after-verification' }, dependsOn: ['independently verify the record against its criteria'] },
  { type: 'coverage.refresh', title: 'refresh the ecosystem coverage matrix', agentId: 'A02', acceptance: [manual('c1', 'generated matrix committed')], spec: {}, dependsOn: ['independently verify the record against its criteria'] },
  { type: 'docs.continuation', title: 'write the continuation record', agentId: 'A33', acceptance: [{ id: 'd1', statement: 'the record exists', check: { kind: 'file_exists', path: 'packages/operator/evidence/demo/CONTINUATION.md' } }], spec: { path: 'packages/operator/evidence/demo/CONTINUATION.md' }, dependsOn: ['refresh the ecosystem coverage matrix'] },
]);
const byTitle = new Map(tasks.map((task) => [task.title, task]));
console.log(`goal ${goal.id}: ${tasks.length} tasks persisted`);

const results = await runtime.runReady(20);
for (const result of results) console.log(`${result.task.id}  ${result.task.agentId}  ${result.task.type.padEnd(18)} → ${result.execution.report?.outcome ?? result.execution.status} (${result.task.status})`);

// Export the implementing workspace's diff as the artifact to port, and its hash for the release gate's record.
const implement = runtime.store.task(byTitle.get('add the operator control record')!.id)!;
const workspace = resolve(stateRoot, implement.workspace!);
const diff = workspaceDiff(workspace);
writeFileSync(resolve(evidenceRoot, 'implement.patch'), diff.text);
const release = runtime.store.task(byTitle.get('prepare a staging release of the verified artifact (gate stays closed)')!.id)!;
console.log(`artifact diff sha256 ${payloadHash(diff.text)}; release task ${release.id} is ${release.status}`);

// The continuation record was written inside A33's workspace; export it next to the patch.
const docs = runtime.store.task(byTitle.get('write the continuation record')!.id)!;
const docsWorkspace = docs.workspace ? resolve(stateRoot, docs.workspace) : '';
const continuation = docsWorkspace ? resolve(docsWorkspace, 'packages/operator/evidence/demo/CONTINUATION.md') : '';
if (continuation && existsSync(continuation)) writeFileSync(resolve(evidenceRoot, 'CONTINUATION.md'), (await import('node:fs')).readFileSync(continuation, 'utf8'));

// Workspaces are scratch: remove the worktrees and their branches, keep the records.
for (const task of runtime.store.tasks()) if (task.workspace) removeWorkspace(repositoryRoot, resolve(stateRoot, task.workspace), `operator/${task.id}`);
rmSync(resolve(stateRoot, 'workspaces'), { recursive: true, force: true });

const status = runtime.status();
writeFileSync(resolve(evidenceRoot, 'status.json'), `${JSON.stringify({ head, ...status }, null, 2)}\n`);
console.log(JSON.stringify({ tasks: status.tasks, awaitingApproval: status.awaitingApproval, blocked: status.blocked, audit: status.audit }, null, 2));
