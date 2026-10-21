import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AcceptanceCriterion, EvidenceItem, ExecutionRecord, Task, WorkerReport } from '../../types.ts';
import { payloadHash, sha256 } from '../store/hash.ts';
import type { OperatorStore } from '../store/store.ts';
import type { RunLimiter } from '../control/limits.ts';
import { ToolDenied, literalPattern, type Toolbox } from '../tools/adapters.ts';
import { modelDriven } from './agentloop.ts';
import type { ModelPort } from './model.ts';
import { ReleaseUnavailable, type ReleaseAdapter } from './release.ts';
import { SendUnavailable, type SendAction, type SendAdapter } from './send.ts';

/**
 * Deterministic worker handlers. Each one executes a structured task spec
 * through the toolbox and returns the structured report every contract
 * requires. No handler reasons; a handler that would need judgement is
 * routed to the model port, which refuses when none is configured.
 */
export interface HandlerContext {
  task: Task;
  tools: Toolbox;
  store: OperatorStore;
  model: ModelPort;
  release: ReleaseAdapter;
  send: SendAdapter;
  /** The run's limiter: a handler may only spend. */
  limiter: RunLimiter;
  workspaceRoot: string;
  repositoryRoot: string;
  /** The execution record so far, for verifiers that need prior records of other tasks. */
  execution: ExecutionRecord;
}

export type Handler = (context: HandlerContext) => Promise<WorkerReport>;

const report = (context: HandlerContext, partial: Partial<WorkerReport> & Pick<WorkerReport, 'outcome' | 'status'>): WorkerReport => ({
  taskId: context.task.id, agentId: context.task.agentId, evidenceInspected: [], changes: [], verification: [], risks: [], approvalsRequired: [], artifacts: [], nextStep: '', handoffs: [], ...partial,
});

function asStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(`spec.${name} must be a string array.`);
  return value as string[];
}

/** A04 — inspect.repository: report presence, size and hash of named paths, and matches of named patterns. */
export const inspectRepository: Handler = async (context) => {
  const paths = asStringArray(context.task.spec.paths, 'paths');
  const patterns = asStringArray(context.task.spec.patterns ?? [], 'patterns');
  const inspected: string[] = [];
  const verification: WorkerReport['verification'] = [];
  for (const path of paths) {
    const absolute = resolve(context.workspaceRoot || context.repositoryRoot, path);
    if (!existsSync(absolute)) { verification.push({ name: path, passed: false, detail: 'absent' }); continue; }
    const text = context.tools.readFile(path);
    inspected.push(`${path} sha256=${sha256(text).slice(0, 12)} bytes=${Buffer.byteLength(text)}`);
    verification.push({ name: path, passed: true, detail: `present, ${text.split('\n').length} lines` });
  }
  for (const pattern of patterns) {
    const matches = context.tools.search('.', literalPattern(pattern), 50);
    verification.push({ name: `pattern ${pattern}`, passed: matches.length > 0, detail: `${matches.length} matches${matches.length ? `, first ${matches[0]!.path}:${matches[0]!.line}` : ''}` });
  }
  return report(context, { outcome: 'completed', status: 'inspection complete', evidenceInspected: inspected, verification, nextStep: 'Hand the findings to the implementing agent.' });
};

interface Edit { path: string; kind: 'create' | 'replace'; content?: string; find?: string; replace?: string }

/** A07 / A10 / A19 — implement.patch: apply structured edits inside the isolated workspace and record the diff. */
export const implementPatch: Handler = async (context) => {
  const edits = context.task.spec.edits;
  if (!Array.isArray(edits) || edits.length === 0) throw new Error('spec.edits must be a non-empty array.');
  const changes: string[] = [];
  const denied: EvidenceItem[] = [];
  for (const edit of edits as Edit[]) {
    try {
      if (edit.kind === 'create') {
        if (typeof edit.content !== 'string') throw new Error(`create ${edit.path} needs content.`);
        context.tools.writeFile(edit.path, edit.content);
        changes.push(`create ${edit.path}`);
      } else if (edit.kind === 'replace') {
        if (typeof edit.find !== 'string' || typeof edit.replace !== 'string') throw new Error(`replace ${edit.path} needs find and replace.`);
        const current = context.tools.readFile(edit.path);
        if (!current.includes(edit.find)) throw new Error(`replace ${edit.path}: the text to find is not present.`);
        // A function replacer: the replacement is literal text, so `$&`, `$1` or `$$` in it are written as they are.
        const replacement = edit.replace;
        context.tools.writeFile(edit.path, current.replace(edit.find, () => replacement));
        changes.push(`replace in ${edit.path}`);
      } else throw new Error(`Unknown edit kind ${String((edit as { kind: unknown }).kind)}.`);
    } catch (error) {
      if (error instanceof ToolDenied) { denied.push({ kind: 'decision', label: `${error.tool}:${error.target}`, tool: error.tool, target: error.target, allowed: false, code: error.code }); break; }
      throw error;
    }
  }
  if (denied.length) {
    const first = denied[0]!;
    return report(context, { outcome: 'blocked', status: `policy denied ${first.kind === 'decision' ? first.code : 'write'}`, changes, risks: [`Policy denied ${first.label}; no further edits were attempted.`], nextStep: 'Narrow the edit to the agent\'s allowed writes or obtain the applicable approval.' });
  }
  const diff = context.tools.gitDiff();
  return report(context, {
    outcome: 'completed', status: `${changes.length} edit(s) applied in the workspace`, changes, artifacts: [`diff sha256=${diff.sha256}`, ...diff.files],
    verification: [{ name: 'workspace diff', passed: diff.files.length > 0, detail: `${diff.files.length} file(s), ${diff.bytes} bytes` }],
    nextStep: 'Run the checks the acceptance criteria name, then independent verification.',
  });
};

/** A15 — run.checks: run allowlisted checks and record exact command, exit code and output hashes. */
export const runChecks: Handler = async (context) => {
  const checks = asStringArray(context.task.spec.checks, 'checks');
  const verification: WorkerReport['verification'] = [];
  let allPassed = true;
  for (const key of checks) {
    try {
      const result = context.tools.runCheck(key);
      verification.push({ name: key, passed: result.exitCode === 0, detail: `exit ${result.exitCode}; ${result.command}` });
      if (result.exitCode !== 0) allPassed = false;
    } catch (error) {
      if (error instanceof ToolDenied) { verification.push({ name: key, passed: false, detail: `denied: ${error.code}` }); allPassed = false; continue; }
      throw error;
    }
  }
  return report(context, { outcome: allPassed ? 'completed' : 'failed', status: allPassed ? 'all checks passed' : 'at least one check failed or was denied', verification, nextStep: allPassed ? 'Independent verification.' : 'Fix the failing check in the implementing task; do not weaken the check.' });
};

function evaluateCriterion(criterion: AcceptanceCriterion, root: string, records: ExecutionRecord[], tools: Toolbox): WorkerReport['verification'][number] {
  const check = criterion.check;
  if (check.kind === 'file_exists') {
    const exists = existsSync(resolve(root, check.path));
    return { name: criterion.id, passed: exists, detail: exists ? `${check.path} exists` : `${check.path} is absent` };
  }
  if (check.kind === 'file_contains') {
    if (!existsSync(resolve(root, check.path))) return { name: criterion.id, passed: false, detail: `${check.path} is absent` };
    const found = tools.readFile(check.path).includes(check.text);
    return { name: criterion.id, passed: found, detail: found ? `${check.path} contains the expected text` : `${check.path} lacks the expected text` };
  }
  if (check.kind === 'command_passed') {
    const commands = records.flatMap((record) => record.evidence.filter((item): item is Extract<EvidenceItem, { kind: 'command' }> => item.kind === 'command' && item.label === check.command));
    if (!commands.length) return { name: criterion.id, passed: false, detail: `no execution record ran ${check.command}` };
    const passed = commands.every((item) => item.exitCode === 0);
    return { name: criterion.id, passed, detail: `${check.command}: exit ${commands.map((item) => item.exitCode).join(',')}` };
  }
  if (check.kind === 'policy_denied') {
    const decisions = records.flatMap((record) => record.evidence.filter((item): item is Extract<EvidenceItem, { kind: 'decision' }> => item.kind === 'decision'));
    const found = decisions.some((item) => !item.allowed && item.code === check.code);
    return { name: criterion.id, passed: found, detail: found ? `policy denied with ${check.code}` : `no denial with ${check.code} recorded` };
  }
  return { name: criterion.id, passed: false, detail: `manual: ${check.note}` };
}

/** A16 — verify: recompute the artifact, evaluate every criterion of the reviewed tasks, return a verdict. */
export const verify: Handler = async (context) => {
  const reviewed = asStringArray(context.task.spec.reviews, 'reviews');
  const executions = context.store.executions();
  const verification: WorkerReport['verification'] = [];
  const inspected: string[] = [];
  let insufficient = false;
  for (const taskId of reviewed) {
    const task = context.store.task(taskId);
    if (!task) { verification.push({ name: taskId, passed: false, detail: 'unknown task' }); insufficient = true; continue; }
    // Any run that returned a report is reviewable: a failed or blocked run is evidence too, and its verdict is recorded rather than skipped.
    const records = executions.filter((record) => record.taskId === taskId && record.report !== undefined);
    if (!records.length) { verification.push({ name: taskId, passed: false, detail: 'no execution record with a report' }); insufficient = true; continue; }
    const last = records.at(-1)!;
    inspected.push(`${taskId} run ${last.id}`);
    const recordedDiff = last.evidence.find((item): item is Extract<EvidenceItem, { kind: 'diff' }> => item.kind === 'diff');
    if (recordedDiff) {
      const current = context.tools.gitDiff();
      const same = current.sha256 === recordedDiff.sha256;
      verification.push({ name: `${taskId}:artifact`, passed: same, detail: same ? `diff ${current.sha256.slice(0, 12)} matches the record` : `workspace diff ${current.sha256.slice(0, 12)} differs from recorded ${recordedDiff.sha256.slice(0, 12)}` });
      if (!same) { insufficient = false; }
    }
    for (const criterion of task.acceptance) verification.push(evaluateCriterion(criterion, context.workspaceRoot || context.repositoryRoot, executions.filter((record) => record.taskId === taskId || reviewed.includes(record.taskId)), context.tools));
  }
  const manual = verification.filter((item) => item.detail.startsWith('manual:'));
  const failed = verification.filter((item) => !item.passed && !item.detail.startsWith('manual:'));
  const outcome: WorkerReport['outcome'] = failed.length ? 'rejected' : insufficient || manual.length ? 'insufficient_evidence' : 'accepted';
  return report(context, {
    outcome, status: outcome === 'accepted' ? 'every criterion passed against the exact artifact' : outcome === 'rejected' ? `${failed.length} criterion(s) failed` : 'evidence is incomplete',
    evidenceInspected: inspected, verification, risks: manual.map((item) => `${item.name} needs a person: ${item.detail}`), nextStep: outcome === 'accepted' ? 'Coordinator may close the reviewed tasks.' : 'Return the work to its implementing agent with the failed criteria.',
  });
};

/** A02 — coverage.refresh: the coverage matrix is generated from the registry and the store (build.ts); this handler verifies it is in step. */
export const coverageRefresh: Handler = async (context) => {
  const { buildCoverageMatrix, coverageSummary, loadEcosystemRegistry } = await import('../registry/coverage.ts');
  const registry = loadEcosystemRegistry(context.repositoryRoot);
  const rows = buildCoverageMatrix(registry, context.store.tasks());
  const summary = coverageSummary(rows);
  const committed = resolve(context.repositoryRoot, 'operator/generated/coverage-matrix.json');
  const inStep = existsSync(committed) && JSON.parse(readFileSync(committed, 'utf8')).rows?.length === rows.length;
  return report(context, {
    outcome: 'completed', status: `${rows.length} rows; ${Object.entries(summary).map(([k, v]) => `${k}=${v}`).join(' ')}`,
    evidenceInspected: ['packages/platform-control/registry/**', 'operator task store'],
    verification: [{ name: 'generated matrix in step', passed: inStep, detail: inStep ? 'row count matches the committed matrix' : 'run `npm run operator:build` from the repository root and commit generated/' }],
    artifacts: ['operator/generated/coverage-matrix.json'], nextStep: inStep ? 'None.' : 'Regenerate and commit the matrix.',
  });
};

/** A33 — docs.continuation: write a continuation record from the store, inside the agent's allowed writes. */
export const docsContinuation: Handler = async (context) => {
  const path = context.task.spec.path;
  if (typeof path !== 'string') throw new Error('spec.path must be a string.');
  const goal = context.store.goals().find((item) => item.id === context.task.goalId);
  const tasks = context.store.tasks().filter((task) => task.goalId === context.task.goalId);
  const executions = context.store.executions();
  const lines = [
    `# Continuation record: ${goal?.title ?? context.task.goalId}`, '',
    `Goal ${context.task.goalId} requested by ${goal?.requestedBy ?? 'unknown'}; source: ${goal?.source ?? 'unknown'}.`, '',
    '## Tasks', '', '| Task | Agent | Type | Status | Attempts | Blocked reason |', '| --- | --- | --- | --- | ---: | --- |',
    ...tasks.map((task) => `| ${task.id} | ${task.agentId} | ${task.type} | ${task.status} | ${task.attempts} | ${task.blockedReason ?? ''} |`), '',
    '## Executions', '', '| Run | Task | Status | Tool calls | Evidence items | Outcome |', '| --- | --- | --- | ---: | ---: | --- |',
    ...executions.filter((record) => tasks.some((task) => task.id === record.taskId)).map((record) => `| ${record.id} | ${record.taskId} | ${record.status} | ${record.usage.toolCalls} | ${record.evidence.length} | ${record.report?.outcome ?? ''} |`), '',
    '## Unresolved', '',
    ...tasks.filter((task) => !['verified', 'cancelled'].includes(task.status)).map((task) => `- ${task.id} (${task.agentId}) is ${task.status}${task.blockedReason ? `: ${task.blockedReason}` : ''}`),
    ...(tasks.every((task) => ['verified', 'cancelled'].includes(task.status)) ? ['- Nothing open under this goal.'] : []), '',
    '## Next executable task', '',
    `- ${tasks.find((task) => task.status === 'ready')?.id ?? 'none ready; see unresolved'}`, '',
  ];
  const item = context.tools.writeFile(path, `${lines.join('\n')}\n`);
  return report(context, { outcome: 'completed', status: 'continuation record written', changes: [`wrote ${path}`], artifacts: [`${path} sha256=${item.kind === 'file' ? item.sha256 : ''}`], verification: [{ name: 'file written', passed: true, detail: `${item.kind === 'file' ? item.bytes : 0} bytes` }], nextStep: 'Commit the record with the evidence it describes.' });
};

/** A20 — release.prepare: no deployment adapter exists; the task records what it would need and stops. */
export const releasePrepare: Handler = async (context) => {
  const target = context.task.spec.target;
  const artifactHash = context.task.spec.artifactHash;
  if (typeof target !== 'string' || typeof artifactHash !== 'string') throw new Error('spec.target and spec.artifactHash must be strings.');
  return report(context, {
    outcome: 'needs_approval', status: 'release prepared; no adapter and no approval',
    risks: ['No deployment adapter is implemented; release.execute is unreachable until one exists and is tested.'],
    approvalsRequired: [`release_adapter target=${target} artifact=${artifactHash}`],
    nextStep: 'An owner grants an exact-target, exact-artifact approval; a tested adapter executes it.',
  });
};

/**
 * A20 — release.execute: the one path that leaves the repository. Order matters:
 * refuse before spending when no adapter exists; let the gate consume the
 * approval bound to this exact target and artifact; record the external action
 * as pending before it fires, so an interruption leaves a record and never a
 * repeat; clear it only on a confirmed result.
 */
export const releaseExecute: Handler = async (context) => {
  const target = context.task.spec.target;
  const artifactHash = context.task.spec.artifactHash;
  if (typeof target !== 'string' || typeof artifactHash !== 'string') throw new Error('spec.target and spec.artifactHash must be strings.');
  const needed = `release_adapter target=${target} artifact=${artifactHash}`;
  if (context.release.name === 'none') {
    return report(context, { outcome: 'blocked', status: 'release_adapter_unavailable', risks: [new ReleaseUnavailable().message], approvalsRequired: [needed], nextStep: 'An owner wires a release adapter with its credential in the operator process.' });
  }
  let decision: EvidenceItem & { kind: 'decision' };
  try {
    decision = context.tools.release(target, artifactHash);
  } catch (error) {
    if (error instanceof ToolDenied) {
      const needsApproval = APPROVAL_CODES.includes(error.code);
      return report(context, {
        outcome: needsApproval ? 'needs_approval' : 'blocked', status: error.code, risks: [error.message], approvalsRequired: needsApproval ? [needed] : [],
        nextStep: needsApproval ? `An owner grants an approval for ${needed}: tool release_adapter, target ${target}, payload {target, artifactHash}, artifact ${artifactHash}, approver not ${context.task.agentId}.` : 'Grant operate mode to this task by a planner decision, or stop.',
      });
    }
    throw error;
  }
  const pending = `${needed} via ${context.release.name}`;
  context.execution.pendingExternalActions.push(pending);
  try {
    const result = await context.release.release({ target, artifactHash, taskId: context.task.id, environment: context.task.environment });
    context.execution.pendingExternalActions.splice(context.execution.pendingExternalActions.indexOf(pending), 1);
    context.execution.evidence.push({ kind: 'note', label: 'release', detail: `${context.release.name} released ${artifactHash} to ${target}: ${result.reference}${result.detail ? ` (${result.detail})` : ''}` });
    return report(context, {
      outcome: 'completed', status: `released to ${target}`, changes: [`${target} now serves ${artifactHash}`], artifacts: [`release ${result.reference}`, `approval ${decision.code}`],
      verification: [{ name: 'adapter confirmed', passed: true, detail: result.reference }], nextStep: 'Verify the deployed target against the artifact hash; keep the rollback written before this release at hand.',
    });
  } catch (error) {
    // The action may have happened. It stays pending in the record and is never retried by the runtime.
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    return report(context, { outcome: 'failed', status: 'release_adapter_error', risks: [`The external action may have taken effect: ${message}. It stays recorded as pending for a person to confirm; the runtime never repeats it.`], artifacts: [`approval ${decision.code}`], nextStep: 'A person confirms the state of the target before anything else touches it.' });
  }
};

/**
 * A27 — communication.send: the one path that speaks for the company. Drafts
 * first: the action is `draft` unless the spec says `send`, and an adapter
 * that cannot perform the action refuses it before the gate is asked. Then
 * the same order as a release: refuse before spending when no adapter exists;
 * let the gate consume the approval bound to this exact action, channel,
 * recipient and content hash (an approval to draft never sends, and an edit
 * to the content after approval is `artifact_changed`); record the external
 * action as pending before it fires; clear it only on a confirmed result.
 * The body never appears in the report or the audit, only its hash.
 */
export const communicationSend: Handler = async (context) => {
  const { channel, recipient, subject, body } = context.task.spec;
  const action: SendAction = context.task.spec.action === 'send' ? 'send' : 'draft';
  if (typeof channel !== 'string' || typeof recipient !== 'string' || typeof body !== 'string' || (subject !== undefined && typeof subject !== 'string')) {
    throw new Error('spec.channel, spec.recipient and spec.body must be strings; spec.subject, when present, a string.');
  }
  if (!channel || !recipient || !body.trim()) throw new Error('spec.channel, spec.recipient and spec.body must not be empty.');
  const contentHash = payloadHash({ channel, recipient, subject, body });
  const needed = `external_send ${action} ${channel}:${recipient} content=${contentHash.slice(0, 12)}`;
  if (context.send.name === 'none') {
    return report(context, { outcome: 'blocked', status: 'send_adapter_unavailable', risks: [new SendUnavailable().message], approvalsRequired: [needed], nextStep: 'An owner wires a sending adapter with its credential in the operator process; a drafts-only adapter is enough to begin.' });
  }
  if (!context.send.supports[action]) {
    return report(context, { outcome: 'blocked', status: 'send_action_unsupported', risks: [`The ${context.send.name} adapter does not ${action}; no approval was asked for.`], nextStep: action === 'send' ? 'Plan the task as a draft, or have the owner wire an adapter that sends.' : 'Have the owner wire an adapter that drafts.' });
  }
  let decision: EvidenceItem & { kind: 'decision' };
  try {
    decision = context.tools.send(action, channel, recipient, contentHash);
  } catch (error) {
    if (error instanceof ToolDenied) {
      const needsApproval = APPROVAL_CODES.includes(error.code);
      return report(context, {
        outcome: needsApproval ? 'needs_approval' : 'blocked', status: error.code, risks: [error.message], approvalsRequired: needsApproval ? [needed] : [],
        nextStep: needsApproval ? `An owner reads the exact content and grants an approval for ${needed}: tool external_send, target ${channel}:${recipient}, payload {action, channel, recipient, contentHash}, artifact the content hash, approver not ${context.task.agentId}.` : 'Grant operate mode to this task by a planner decision, or stop.',
      });
    }
    throw error;
  }
  const pending = `${needed} via ${context.send.name}`;
  context.execution.pendingExternalActions.push(pending);
  try {
    const request = { action, channel, recipient, subject, body, contentHash, taskId: context.task.id, environment: context.task.environment };
    const result = action === 'send' ? await context.send.send(request) : await context.send.draft(request);
    context.execution.pendingExternalActions.splice(context.execution.pendingExternalActions.indexOf(pending), 1);
    context.execution.evidence.push({ kind: 'note', label: 'send', detail: `${context.send.name} ${action === 'send' ? 'sent' : 'drafted'} content ${contentHash.slice(0, 12)} to ${channel}:${recipient}: ${result.reference}${result.detail ? ` (${result.detail})` : ''}` });
    return report(context, {
      outcome: 'completed', status: action === 'send' ? `sent to ${channel}:${recipient}` : `drafted for ${channel}:${recipient}`,
      changes: [action === 'send' ? `${channel}:${recipient} received content ${contentHash.slice(0, 12)}` : `a draft for ${channel}:${recipient} holds content ${contentHash.slice(0, 12)}`],
      artifacts: [`${action} ${result.reference}`, `approval ${decision.code}`],
      verification: [{ name: 'adapter confirmed', passed: true, detail: result.reference }],
      nextStep: action === 'send' ? 'Record the send in the communications log; nothing is re-sent by the runtime.' : 'A person reviews the draft where it was placed and sends it themselves, or plans a send task against the same content.',
    });
  } catch (error) {
    // The action may have happened. It stays pending in the record and is never retried by the runtime.
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    return report(context, { outcome: 'failed', status: 'send_adapter_error', risks: [`The external action may have taken effect: ${message}. It stays recorded as pending for a person to confirm; the runtime never repeats it.`], artifacts: [`approval ${decision.code}`], nextStep: 'A person checks the channel before anything else is drafted or sent to this recipient.' });
  }
};

/** Gate denials that an approval, granted by someone other than the actor, would clear. */
const APPROVAL_CODES = ['approval_required', 'payload_hash_required', 'artifact_changed', 'payload_changed', 'target_mismatch', 'tool_mismatch', 'task_mismatch', 'self_approval', 'expired', 'consumed', 'revoked'];

export const HANDLERS: Record<string, Handler> = {
  'inspect.repository': inspectRepository,
  'implement.patch': implementPatch,
  'repair': implementPatch,
  'run.checks': runChecks,
  'verify': verify,
  'coverage.refresh': coverageRefresh,
  'docs.continuation': docsContinuation,
  'release.prepare': releasePrepare,
  'release.execute': releaseExecute,
  'communication.send': communicationSend,
};

export function handlerFor(type: string): Handler { return HANDLERS[type] ?? modelDriven; }
