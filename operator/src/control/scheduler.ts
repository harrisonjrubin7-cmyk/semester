import { TERMINAL_STATUSES, type AcceptanceCriterion, type ExecutionLimits, type ExecutionRecord, type HandoffProposal, type ScheduleEntry, type Task, type TaskStatus } from '../../types.ts';
import type { Clock } from '../store/clock.ts';
import type { IdFactory } from '../store/ids.ts';
import type { OperatorStore } from '../store/store.ts';
import type { AuditLog } from './audit.ts';

/**
 * C03 — Scheduler and queue.
 *
 * Tasks enter through `enqueue` (deduplicated by key, dependencies checked
 * for existence and cycles), through `handoff` (a worker's proposal, queued
 * only along an allowed suite route, within depth and count limits, and only
 * when the caller enabled handoffs), or through `tick` (a schedule entry
 * creates one bounded task per period). `ready` joins on every dependency
 * being complete (its worker finished, or it was verified), so a QA task
 * cannot run before both engineering tasks it depends on are done; a
 * verification task may additionally run on a dependency it reviews that
 * failed or was blocked, because recording that verdict is its job. `recover` marks stale running work interrupted and
 * never re-queues it: an interrupted task is inspected, then deliberately
 * re-queued or cancelled by a person.
 */
/** Task types that may consume work before it is verified, because verifying it is their job. */
export const CHECKING_TYPES: readonly string[] = ['run.checks', 'verify'];

export const MAX_HANDOFF_DEPTH = 3;
export const MAX_HANDOFFS_PER_RESULT = 3;

export interface EnqueueInput {
  goalId: string;
  type: string;
  title: string;
  agentId: string;
  acceptance: AcceptanceCriterion[];
  spec?: Record<string, unknown>;
  dependsOn?: string[];
  registryKeys?: string[];
  priority?: number;
  dedupeKey?: string;
  parentId?: string;
  depth?: number;
  /** A coordinator may tighten the agent's contract limits for one task; a value above the contract's is ignored. */
  limits?: Partial<ExecutionLimits>;
}

export interface AgentLookup {
  /** The contract, or undefined when the agent id is unknown. */
  limitsFor(agentId: string): ExecutionLimits | undefined;
  modeFor(agentId: string): Task['mode'];
  /** Whether the sender's suite may hand off to the receiver's suite. */
  routeAllowed(senderAgentId: string, receiverAgentId: string): boolean;
}

export interface SchedulerOptions { maxConcurrent: number; environment: Task['environment'] }

export interface Scheduler {
  enqueue(input: EnqueueInput): Task;
  handoff(parent: Task, proposals: HandoffProposal[], enabled: boolean): { queued: Task[]; rejected: Array<{ proposal: HandoffProposal; reason: string }> };
  ready(): Task[];
  claim(taskId: string): { task: Task; execution: ExecutionRecord } | { error: string };
  cancel(taskId: string, by: string, reason: string): Task | undefined;
  requeue(taskId: string, by: string): Task | undefined;
  recover(by: string): { interrupted: string[] };
  schedule(entry: ScheduleEntry): void;
  tick(): Task[];
  transition(taskId: string, status: TaskStatus, patch?: Partial<Task>): Task;
}

function periodKey(period: ScheduleEntry['period'], now: Date): string {
  const day = now.toISOString().slice(0, 10);
  if (period === 'P1D') return day;
  if (period === 'P7D') { const start = new Date(now); start.setUTCDate(now.getUTCDate() - now.getUTCDay()); return `week-of-${start.toISOString().slice(0, 10)}`; }
  return now.toISOString().slice(0, 7);
}

export function createScheduler(store: OperatorStore, clock: Clock, ids: IdFactory, audit: AuditLog, agents: AgentLookup, options: SchedulerOptions): Scheduler {
  function wouldCycle(taskId: string, dependsOn: string[]): boolean {
    const tasks = new Map(store.tasks().map((task) => [task.id, task]));
    const seen = new Set<string>();
    const stack = [...dependsOn];
    while (stack.length) {
      const id = stack.pop()!;
      if (id === taskId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const dep of tasks.get(id)?.dependsOn ?? []) stack.push(dep);
    }
    return false;
  }

  function dependencySatisfied(task: Task, dependency: Task | undefined): boolean {
    if (!dependency) return false;
    if (dependency.status === 'verified') return true;
    // Finished-but-unverified work is complete for the tasks whose job is to check or verify it, and an observe-mode
    // dependency (an inspection, a review: no artifact to verify) is complete when its report is in. Unverified
    // writes do not flow into further writes.
    if (dependency.status === 'awaiting_verification') return CHECKING_TYPES.includes(task.type) || dependency.mode === 'observe';
    const reviews = Array.isArray(task.spec.reviews) ? (task.spec.reviews as unknown[]) : [];
    return reviews.includes(dependency.id) && ['failed', 'blocked', 'rejected'].includes(dependency.status);
  }

  function enqueue(input: EnqueueInput): Task {
    const contractLimits = agents.limitsFor(input.agentId);
    if (!contractLimits) throw new Error(`Unknown agent ${input.agentId}.`);
    const limits = tighten(contractLimits, input.limits);
    if (!input.title.trim() || input.title.length > 200) throw new Error('A task needs a title of at most 200 characters.');
    if (input.acceptance.length === 0) throw new Error(`Task "${input.title}" needs at least one acceptance criterion.`);
    if (!store.goals().some((goal) => goal.id === input.goalId)) throw new Error(`Unknown goal ${input.goalId}.`);
    const dedupeKey = input.dedupeKey ?? `${input.goalId}:${input.agentId}:${input.type}:${input.title}`;
    const existing = store.tasks().find((task) => task.dedupeKey === dedupeKey && !TERMINAL_STATUSES.includes(task.status) && task.status !== 'failed');
    if (existing) { audit.record('task.deduplicated', 'scheduler', { dedupeKey }, existing.id); return existing; }
    const known = new Set(store.tasks().map((task) => task.id));
    for (const dep of input.dependsOn ?? []) if (!known.has(dep)) throw new Error(`Dependency ${dep} does not exist.`);
    const id = ids('task');
    if (wouldCycle(id, input.dependsOn ?? [])) throw new Error('Dependencies form a cycle.');
    const depth = input.depth ?? 0;
    if (depth > MAX_HANDOFF_DEPTH) throw new Error(`Handoff depth ${depth} exceeds ${MAX_HANDOFF_DEPTH}.`);
    const now = clock.now().toISOString();
    const task: Task = {
      id, goalId: input.goalId, type: input.type, title: input.title, agentId: input.agentId, status: 'ready', priority: input.priority ?? 50,
      dependsOn: input.dependsOn ?? [], depth, dedupeKey, acceptance: input.acceptance, spec: input.spec ?? {}, registryKeys: input.registryKeys ?? [],
      mode: agents.modeFor(input.agentId), environment: options.environment, limits, attempts: 0, createdAt: now, updatedAt: now,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    };
    store.saveTask(task);
    audit.record('task.enqueued', 'scheduler', { type: task.type, agentId: task.agentId, dependsOn: task.dependsOn, depth }, task.id);
    return task;
  }

  function transition(taskId: string, status: TaskStatus, patch: Partial<Task> = {}): Task {
    const task = store.task(taskId);
    if (!task) throw new Error(`Unknown task ${taskId}.`);
    const next: Task = { ...task, ...patch, status, updatedAt: clock.now().toISOString() };
    store.saveTask(next);
    audit.record('task.transition', 'scheduler', { from: task.status, to: status, ...(patch.blockedReason ? { reason: patch.blockedReason } : {}) }, taskId);
    return next;
  }

  return {
    enqueue,
    transition,
    handoff(parent, proposals, enabled) {
      const queued: Task[] = [];
      const rejected: Array<{ proposal: HandoffProposal; reason: string }> = [];
      if (!enabled) { for (const proposal of proposals) rejected.push({ proposal, reason: 'handoffs_disabled' }); return { queued, rejected }; }
      if (proposals.length > MAX_HANDOFFS_PER_RESULT) { for (const proposal of proposals) rejected.push({ proposal, reason: 'too_many_handoffs' }); return { queued, rejected }; }
      for (const proposal of proposals) {
        if (!agents.limitsFor(proposal.agentId)) { rejected.push({ proposal, reason: 'unknown_agent' }); continue; }
        if (!agents.routeAllowed(parent.agentId, proposal.agentId)) { rejected.push({ proposal, reason: 'route_not_allowed' }); continue; }
        if (parent.depth + 1 > MAX_HANDOFF_DEPTH) { rejected.push({ proposal, reason: 'depth_exceeded' }); continue; }
        if (!proposal.acceptance.length) { rejected.push({ proposal, reason: 'missing_acceptance' }); continue; }
        if (!proposal.title.trim() || proposal.title.length > 200) { rejected.push({ proposal, reason: 'invalid_title' }); continue; }
        try {
          queued.push(enqueue({ goalId: parent.goalId, type: proposal.type, title: proposal.title, agentId: proposal.agentId, acceptance: proposal.acceptance, spec: proposal.spec, dependsOn: [parent.id], parentId: parent.id, depth: parent.depth + 1, registryKeys: proposal.registryKeys ?? [] }));
        } catch (error) { rejected.push({ proposal, reason: error instanceof Error ? error.message : String(error) }); }
      }
      if (rejected.length) audit.record('handoff.rejected', 'scheduler', { reasons: rejected.map((item) => `${item.proposal.agentId}:${item.reason}`) }, parent.id);
      return { queued, rejected };
    },
    ready() {
      const tasks = store.tasks();
      const byId = new Map(tasks.map((task) => [task.id, task]));
      return tasks
        .filter((task) => task.status === 'ready' && task.dependsOn.every((dep) => dependencySatisfied(task, byId.get(dep))))
        .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));
    },
    claim(taskId) {
      const task = store.task(taskId);
      if (!task) return { error: `Unknown task ${taskId}.` };
      if (task.status !== 'ready') return { error: `Task ${taskId} is ${task.status}, not ready.` };
      const byId = new Map(store.tasks().map((item) => [item.id, item]));
      const unmet = task.dependsOn.filter((dep) => !dependencySatisfied(task, byId.get(dep)));
      if (unmet.length) return { error: `Task ${taskId} waits on ${unmet.join(', ')}.` };
      const running = store.tasks().filter((item) => item.status === 'running');
      if (running.length >= options.maxConcurrent) return { error: `Concurrency limit ${options.maxConcurrent} reached.` };
      if (running.filter((item) => item.agentId === task.agentId).length >= task.limits.maxConcurrent) return { error: `${task.agentId} is at its concurrency limit.` };
      if (task.attempts >= task.limits.maxRetries + 1) return { error: `Task ${taskId} used its ${task.limits.maxRetries + 1} permitted attempts.` };
      const now = clock.now().toISOString();
      const execution: ExecutionRecord = { id: ids('run'), taskId, agentId: task.agentId, status: 'running', startedAt: now, usage: { turns: 0, toolCalls: 0, elapsedMs: 0, retries: 0 }, evidence: [], pendingExternalActions: [] };
      store.saveExecution(execution);
      const claimed = transition(taskId, 'running', { attempts: task.attempts + 1 });
      return { task: claimed, execution };
    },
    cancel(taskId, by, reason) {
      const task = store.task(taskId);
      if (!task || TERMINAL_STATUSES.includes(task.status)) return task;
      for (const execution of store.executions()) if (execution.taskId === taskId && execution.status === 'running') store.saveExecution({ ...execution, status: 'cancelled', endedAt: clock.now().toISOString() });
      const cancelled = transition(taskId, 'cancelled', { blockedReason: `Cancelled by ${by}: ${reason}` });
      audit.record('task.cancelled', by, { reason }, taskId);
      return cancelled;
    },
    requeue(taskId, by) {
      const task = store.task(taskId);
      if (!task || !['interrupted', 'failed', 'blocked', 'awaiting_approval'].includes(task.status)) return task;
      audit.record('task.requeued', by, { from: task.status }, taskId);
      return transition(taskId, 'ready', { blockedReason: undefined });
    },
    recover(by) {
      const interrupted: string[] = [];
      const at = clock.now().toISOString();
      for (const execution of store.executions()) {
        if (execution.status !== 'running') continue;
        store.saveExecution({ ...execution, status: 'interrupted', endedAt: at, evidence: [...execution.evidence, { kind: 'note', label: 'recovery', detail: `Found running at restart; marked interrupted by ${by}. Pending external actions: ${execution.pendingExternalActions.length}` }] });
        const task = store.task(execution.taskId);
        if (task && task.status === 'running') transition(task.id, 'interrupted', { blockedReason: 'Interrupted by a restart; inspect its execution record before re-queueing.' });
        interrupted.push(execution.id);
      }
      audit.record('scheduler.recovered', by, { interrupted });
      return { interrupted };
    },
    schedule(entry) { store.saveSchedule(entry); audit.record('schedule.saved', 'scheduler', { key: entry.key, period: entry.period }); },
    tick() {
      const created: Task[] = [];
      for (const entry of store.schedules()) {
        const dedupeKey = `schedule:${entry.key}:${periodKey(entry.period, clock.now())}`;
        if (store.tasks().some((task) => task.dedupeKey === dedupeKey)) continue;
        created.push(enqueue({ goalId: entry.goalId, type: entry.type, title: `${entry.title} (${periodKey(entry.period, clock.now())})`, agentId: entry.agentId, acceptance: entry.acceptance, spec: entry.spec, registryKeys: entry.registryKeys, dedupeKey }));
      }
      return created;
    },
  };
}

/** The contract's limits, lowered where the planner asked for less. Nothing here can raise one. */
export function tighten(contract: ExecutionLimits, requested?: Partial<ExecutionLimits>): ExecutionLimits {
  if (!requested) return { ...contract };
  const lower = (base: number, asked: number | undefined) => (asked !== undefined && Number.isFinite(asked) && asked >= 0 && asked < base ? asked : base);
  return {
    maxTurns: lower(contract.maxTurns, requested.maxTurns),
    maxToolCalls: lower(contract.maxToolCalls, requested.maxToolCalls),
    maxElapsedMs: lower(contract.maxElapsedMs, requested.maxElapsedMs),
    maxRetries: lower(contract.maxRetries, requested.maxRetries),
    maxConcurrent: lower(contract.maxConcurrent, requested.maxConcurrent),
    costCeilingUsd: contract.costCeilingUsd === undefined ? requested.costCeilingUsd : lower(contract.costCeilingUsd, requested.costCeilingUsd),
  };
}
