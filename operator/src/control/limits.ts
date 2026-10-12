import type { ExecutionLimits, ExecutionUsage } from '../../types.ts';
import type { Clock } from '../store/clock.ts';

/**
 * C04 — Budget and execution limiter.
 *
 * One limiter per run, built by the runtime from the agent contract. The
 * worker receives only `consume`, which spends; nothing a worker can reach
 * raises a limit. An aggregate limiter spans runs for the whole operator.
 */
export type LimitKind = 'turn' | 'tool' | 'retry';
export type LimitCheck = { ok: true } | { ok: false; code: string; reason: string };

export interface RunLimiter {
  consume(kind: LimitKind): LimitCheck;
  addCost(usd: number): LimitCheck;
  usage(): ExecutionUsage;
  limits(): Readonly<ExecutionLimits>;
}

export interface AggregateLimits { maxToolCallsTotal: number; maxElapsedTotalMs: number; costCeilingUsd?: number }

export interface AggregateLimiter {
  child(limits: ExecutionLimits): RunLimiter;
  usage(): ExecutionUsage;
  check(): LimitCheck;
}

export function createRunLimiter(limits: ExecutionLimits, clock: Clock, parent?: AggregateLimiter): RunLimiter {
  const frozen = Object.freeze({ ...limits });
  const started = clock.now().getTime();
  const usage: ExecutionUsage = { turns: 0, toolCalls: 0, elapsedMs: 0, retries: 0 };
  const elapsed = () => clock.now().getTime() - started;

  function over(): LimitCheck {
    usage.elapsedMs = elapsed();
    if (usage.elapsedMs > frozen.maxElapsedMs) return { ok: false, code: 'time_limit', reason: `${usage.elapsedMs}ms exceeds ${frozen.maxElapsedMs}ms.` };
    if (usage.turns > frozen.maxTurns) return { ok: false, code: 'turn_limit', reason: `${usage.turns} turns exceeds ${frozen.maxTurns}.` };
    if (usage.toolCalls > frozen.maxToolCalls) return { ok: false, code: 'tool_limit', reason: `${usage.toolCalls} tool calls exceeds ${frozen.maxToolCalls}.` };
    if (usage.retries > frozen.maxRetries) return { ok: false, code: 'retry_limit', reason: `${usage.retries} retries exceeds ${frozen.maxRetries}.` };
    if (frozen.costCeilingUsd !== undefined && (usage.costUsd ?? 0) > frozen.costCeilingUsd) return { ok: false, code: 'cost_limit', reason: `$${usage.costUsd} exceeds $${frozen.costCeilingUsd}.` };
    return parent ? parent.check() : { ok: true };
  }

  return {
    consume(kind) {
      if (kind === 'turn') usage.turns += 1;
      if (kind === 'tool') usage.toolCalls += 1;
      if (kind === 'retry') usage.retries += 1;
      if (parent) (parent as AggregateLimiter & { note(kind: LimitKind): void }).note(kind);
      return over();
    },
    addCost(usd) { usage.costUsd = (usage.costUsd ?? 0) + usd; if (parent) (parent as AggregateLimiter & { noteCost(usd: number): void }).noteCost(usd); return over(); },
    usage: () => ({ ...usage, elapsedMs: elapsed() }),
    limits: () => frozen,
  };
}

export function createAggregateLimiter(limits: AggregateLimits, clock: Clock): AggregateLimiter {
  const frozen = Object.freeze({ ...limits });
  const started = clock.now().getTime();
  const usage: ExecutionUsage = { turns: 0, toolCalls: 0, elapsedMs: 0, retries: 0 };
  const aggregate = {
    note(kind: LimitKind) { if (kind === 'turn') usage.turns += 1; if (kind === 'tool') usage.toolCalls += 1; if (kind === 'retry') usage.retries += 1; },
    noteCost(usd: number) { usage.costUsd = (usage.costUsd ?? 0) + usd; },
    check(): LimitCheck {
      usage.elapsedMs = clock.now().getTime() - started;
      if (usage.toolCalls > frozen.maxToolCallsTotal) return { ok: false, code: 'aggregate_tool_limit', reason: `${usage.toolCalls} tool calls across runs exceeds ${frozen.maxToolCallsTotal}.` };
      if (usage.elapsedMs > frozen.maxElapsedTotalMs) return { ok: false, code: 'aggregate_time_limit', reason: `${usage.elapsedMs}ms across runs exceeds ${frozen.maxElapsedTotalMs}ms.` };
      if (frozen.costCeilingUsd !== undefined && (usage.costUsd ?? 0) > frozen.costCeilingUsd) return { ok: false, code: 'aggregate_cost_limit', reason: `$${usage.costUsd} across runs exceeds $${frozen.costCeilingUsd}.` };
      return { ok: true };
    },
    usage: () => ({ ...usage, elapsedMs: clock.now().getTime() - started }),
    child(childLimits: ExecutionLimits) { return createRunLimiter(childLimits, clock, aggregate); },
  };
  return aggregate;
}
