import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { AgentContract, Environment, ExecutionRecord, Goal, PolicyContext, PolicySet, Task, WorkerReport } from '../../types.ts';
import { ROSTER, agent as findAgent } from '../agents/roster.ts';
import { suite, suiteRouteAllowed } from '../agents/suites.ts';
import { createApprovalService, type ApprovalService } from '../control/approvals.ts';
import { createAuditLog, createKillSwitch, type AuditLog, type KillSwitch } from '../control/audit.ts';
import { createAggregateLimiter, type AggregateLimiter, type AggregateLimits } from '../control/limits.ts';
import { createPolicyController, type PolicyController } from '../control/policy.ts';
import { createScheduler, type EnqueueInput, type Scheduler } from '../control/scheduler.ts';
import { systemClock, type Clock } from '../store/clock.ts';
import { randomIds, type IdFactory } from '../store/ids.ts';
import { redact } from '../store/redact.ts';
import { createFileStore, type OperatorStore } from '../store/store.ts';
import { createToolbox } from '../tools/adapters.ts';
import { createWorkspace } from '../tools/workspace.ts';
import { handlerFor } from './handlers.ts';
import { noModel, type ModelPort } from './model.ts';

/**
 * The runtime. One process, many bounded responsibilities. It owns the
 * store, the control modules and the model port, and runs one task at a
 * time through: kill-switch check → claim → limits → workspace → policy-
 * gated tools → handler → evidence → status transition → audit.
 */
export interface RuntimeOptions {
  repositoryRoot: string;
  stateRoot: string;
  environment?: Environment;
  policy?: PolicySet;
  model?: ModelPort;
  clock?: Clock;
  ids?: IdFactory;
  aggregate?: AggregateLimits;
  maxConcurrent?: number;
  /** Proposed handoffs in worker reports are queued only when true. */
  allowHandoffs?: boolean;
  /** Commit workspaces are created from. Defaults to HEAD. */
  baseRef?: string;
}

export interface Runtime {
  store: OperatorStore;
  scheduler: Scheduler;
  approvals: ApprovalService;
  audit: AuditLog;
  killSwitch: KillSwitch;
  policy: PolicyController;
  limits: AggregateLimiter;
  agents: readonly AgentContract[];
  addGoal(input: { title: string; requestedBy: string; source: string }): Goal;
  plan(goalId: string, tasks: Array<Omit<EnqueueInput, 'goalId'>>): Task[];
  run(taskId: string): Promise<{ task: Task; execution: ExecutionRecord }>;
  runReady(max?: number): Promise<Array<{ task: Task; execution: ExecutionRecord }>>;
  close(taskId: string, by: string): Task;
  status(): RuntimeStatus;
}

export interface RuntimeStatus {
  killSwitch: ReturnType<KillSwitch['state']>;
  goals: number;
  tasks: Record<string, number>;
  ready: string[];
  running: string[];
  awaitingApproval: string[];
  blocked: Array<{ id: string; reason: string }>;
  executions: number;
  approvals: { live: number; consumed: number; revoked: number };
  audit: ReturnType<AuditLog['verifyChain']>;
  usage: ReturnType<AggregateLimiter['usage']>;
}

export function loadPolicy(repositoryRoot: string): PolicySet {
  return JSON.parse(readFileSync(resolve(repositoryRoot, 'operator/policy/policy.json'), 'utf8')) as PolicySet;
}

function workerStatus(outcome: WorkerReport['outcome']): Task['status'] {
  switch (outcome) {
    case 'completed': return 'awaiting_verification';
    case 'accepted': return 'verified';
    case 'rejected': return 'rejected';
    case 'needs_approval': return 'awaiting_approval';
    case 'blocked': case 'insufficient_evidence': return 'blocked';
    case 'failed': return 'failed';
  }
}

export function createRuntime(options: RuntimeOptions): Runtime {
  const clock = options.clock ?? systemClock;
  const ids = options.ids ?? randomIds;
  const repositoryRoot = resolve(options.repositoryRoot);
  const stateRoot = resolve(options.stateRoot);
  const environment = options.environment ?? 'development';
  const model = options.model ?? noModel;
  const store = createFileStore(stateRoot);
  const audit = createAuditLog(store, clock);
  const killSwitch = createKillSwitch(store, clock, audit);
  const approvals = createApprovalService(store, clock, ids);
  const policy = createPolicyController(options.policy ?? loadPolicy(repositoryRoot), { killSwitchEngaged: () => killSwitch.engaged(), approvals });
  const limits = createAggregateLimiter(options.aggregate ?? { maxToolCallsTotal: 5000, maxElapsedTotalMs: 8 * 60 * 60 * 1000, costCeilingUsd: 25 }, clock);
  const scheduler = createScheduler(store, clock, ids, audit, {
    limitsFor: (id) => findAgent(id)?.limits,
    modeFor: (id) => { const contract = findAgent(id); return contract && contract.tools.includes('release_adapter') ? 'observe' : contract && contract.tools.includes('write_file') || contract?.tools.includes('run_check') ? 'develop' : 'observe'; },
    routeAllowed: (sender, receiver) => { const a = findAgent(sender); const b = findAgent(receiver); return !!a && !!b && suiteRouteAllowed(a.suite, b.suite); },
  }, { maxConcurrent: options.maxConcurrent ?? 2, environment });

  function contextFor(task: Task, contract: AgentContract, workspaceRoot: string): PolicyContext {
    return { taskId: task.id, agentId: task.agentId, mode: task.mode, environment: task.environment, workspaceRoot, repositoryRoot, allowedWrites: contract.allowedWrites, agentTools: contract.tools };
  }

  async function run(taskId: string): Promise<{ task: Task; execution: ExecutionRecord }> {
    if (killSwitch.engaged()) throw new Error(`Kill switch engaged: ${killSwitch.state().reason ?? 'no reason recorded'}.`);
    const aggregate = limits.check();
    if (!aggregate.ok) throw new Error(`Aggregate limit: ${aggregate.reason}`);
    const claimed = scheduler.claim(taskId);
    if ('error' in claimed) throw new Error(claimed.error);
    let { task, execution } = claimed;
    const contract = findAgent(task.agentId);
    if (!contract) throw new Error(`Unknown agent ${task.agentId}.`);
    const limiter = limits.child(task.limits);
    audit.record('run.started', 'runtime', { executionId: execution.id, agentId: task.agentId, type: task.type, mode: task.mode, environment: task.environment }, task.id);

    let workspaceRoot = '';
    const needsWorkspace = contract.tools.includes('write_file') || contract.tools.includes('run_check') || contract.tools.includes('git_diff');
    try {
      if (needsWorkspace) {
        const shared = typeof task.spec.workspaceOf === 'string' ? store.task(task.spec.workspaceOf)?.workspace : undefined;
        if (shared) workspaceRoot = resolve(stateRoot, shared);
        else { const workspace = createWorkspace(repositoryRoot, stateRoot, task.id, options.baseRef); workspaceRoot = workspace.path; execution.evidence.push({ kind: 'note', label: 'workspace', detail: `worktree ${relative(stateRoot, workspace.path)} on ${workspace.branch} from ${workspace.baseCommit}` }); }
        task = scheduler.transition(task.id, 'running', { workspace: relative(stateRoot, workspaceRoot) });
      }
      const tools = createToolbox(policy, contextFor(task, contract, workspaceRoot), limiter, audit);
      const handler = handlerFor(task.type);
      if (!contract.taskTypes.includes(task.type)) throw new Error(`${contract.id} does not accept task type ${task.type}.`);
      const report = redact(await handler({ task, tools, store, model, limiter, workspaceRoot, repositoryRoot, execution }));
      execution = { ...execution, status: report.outcome === 'failed' ? 'failed' : report.outcome === 'blocked' || report.outcome === 'insufficient_evidence' ? 'blocked' : 'succeeded', endedAt: clock.now().toISOString(), usage: limiter.usage(), evidence: [...execution.evidence, ...tools.evidence], report };
      store.saveExecution(execution);
      const next = workerStatus(report.outcome);
      task = scheduler.transition(task.id, next, next === 'blocked' || next === 'awaiting_approval' ? { blockedReason: report.status } : {});
      if (report.outcome === 'accepted' || report.outcome === 'rejected') {
        for (const reviewed of (task.spec.reviews as string[] | undefined) ?? []) {
          const target = store.task(reviewed);
          if (target && (target.status === 'awaiting_verification' || target.status === 'blocked')) scheduler.transition(reviewed, report.outcome === 'accepted' ? 'verified' : 'rejected', { blockedReason: report.outcome === 'rejected' ? `Rejected by ${task.id}` : undefined });
        }
      }
      const handoffs = scheduler.handoff(task, report.handoffs, options.allowHandoffs ?? false);
      audit.record('run.finished', 'runtime', { executionId: execution.id, outcome: report.outcome, status: next, toolCalls: execution.usage.toolCalls, queuedHandoffs: handoffs.queued.map((item) => item.id) }, task.id);
      return { task, execution };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      execution = { ...execution, status: 'failed', endedAt: clock.now().toISOString(), usage: limiter.usage(), evidence: [...execution.evidence, { kind: 'note', label: 'error', detail: redact(message) }] };
      store.saveExecution(execution);
      task = scheduler.transition(task.id, 'failed', { lastError: redact(message) });
      audit.record('run.failed', 'runtime', { executionId: execution.id, error: message }, task.id);
      return { task, execution };
    }
  }

  return {
    store, scheduler, approvals, audit, killSwitch, policy, limits, agents: ROSTER,
    addGoal(input) {
      const now = clock.now().toISOString();
      const goal: Goal = { id: ids('goal'), title: input.title, requestedBy: input.requestedBy, source: input.source, status: 'open', createdAt: now, updatedAt: now };
      store.saveGoal(goal);
      audit.record('goal.added', input.requestedBy, { title: goal.title, source: goal.source });
      return goal;
    },
    plan(goalId, tasks) {
      const created: Task[] = [];
      const byTitle = new Map<string, string>();
      for (const input of tasks) {
        // Within one plan, tasks may name each other by title; the ids are assigned here.
        const resolveRef = (ref: string) => byTitle.get(ref) ?? ref;
        const dependsOn = (input.dependsOn ?? []).map(resolveRef);
        const spec = { ...(input.spec ?? {}) };
        if (typeof spec.workspaceOf === 'string') spec.workspaceOf = resolveRef(spec.workspaceOf);
        if (Array.isArray(spec.reviews)) spec.reviews = spec.reviews.map((ref) => (typeof ref === 'string' ? resolveRef(ref) : ref));
        const task = scheduler.enqueue({ ...input, spec, goalId, dependsOn });
        byTitle.set(input.title, task.id);
        created.push(task);
      }
      audit.record('plan.recorded', 'A01', { goalId, tasks: created.map((task) => task.id) });
      return created;
    },
    run,
    async runReady(max = 10) {
      const results: Array<{ task: Task; execution: ExecutionRecord }> = [];
      for (let i = 0; i < max; i += 1) {
        if (killSwitch.engaged()) break;
        const next = scheduler.ready()[0];
        if (!next) break;
        results.push(await run(next.id));
      }
      return results;
    },
    close(taskId, by) {
      const task = store.task(taskId);
      if (!task) throw new Error(`Unknown task ${taskId}.`);
      if (task.status !== 'verified') throw new Error(`Task ${taskId} is ${task.status}; only a verified task closes.`);
      const accepted = store.executions().some((record) => record.report?.outcome === 'accepted' && (record.report.taskId === taskId || (store.task(record.taskId)?.spec.reviews as string[] | undefined)?.includes(taskId)));
      if (!accepted) throw new Error(`Task ${taskId} has no accepted verification record.`);
      audit.record('task.closed', by, {}, taskId);
      return task;
    },
    status() {
      const tasks = store.tasks();
      const counts: Record<string, number> = {};
      for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
      const approvalList = store.approvals();
      return {
        killSwitch: killSwitch.state(), goals: store.goals().length, tasks: counts,
        ready: scheduler.ready().map((task) => task.id), running: tasks.filter((task) => task.status === 'running').map((task) => task.id),
        awaitingApproval: tasks.filter((task) => task.status === 'awaiting_approval').map((task) => task.id),
        blocked: tasks.filter((task) => task.status === 'blocked' || task.status === 'interrupted').map((task) => ({ id: task.id, reason: task.blockedReason ?? '' })),
        executions: store.executions().length,
        approvals: { live: approvalList.filter((item) => !item.revoked && item.usesConsumed < item.usesAllowed).length, consumed: approvalList.filter((item) => item.usesConsumed > 0).length, revoked: approvalList.filter((item) => item.revoked).length },
        audit: audit.verifyChain(), usage: limits.usage(),
      };
    },
  };
}

export { suite };
