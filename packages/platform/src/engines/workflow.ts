/**
 * The workflow engine: durable instances of the institution package's state
 * machines (ADR 0009), with the guarantees a button handler does not give.
 *
 * `WorkflowDefinition` + `transition()` say which moves are legal. This runs
 * them against storage:
 *
 * - An instance belongs to **one tenant** and cannot be read or advanced from
 *   another; the store is keyed `(tenantId, id)`.
 * - **Optimistic concurrency.** `advance` carries the version the caller read.
 *   Two people approving at once is one success and one `conflict` — never two
 *   transitions out of the same state, which is how a grade passback gets sent
 *   twice.
 * - **History is append-only**, with who, when and why. An *exceptional*
 *   transition (recovery, ambiguity, a hold — the machine names them) must
 *   carry a reason, because someone will ask later.
 * - A move the machine does not allow is `precondition_failed`, with the
 *   machine's own sentence.
 *
 * It does not run side effects. The command that advances an instance emits
 * the event in the same unit of work, and consumers do the rest — a workflow
 * that performed its own side effects would be a second way to skip the outbox.
 */

import type { Clock } from '../kernel/clock.ts';
import { transition } from '../seam/institution.ts';
import type { WorkflowDefinition } from '../seam/institution.ts';
import { PlatformError } from '../gateway/errors.ts';
import type { RequestContext } from '../tenancy/context.ts';

export interface WorkflowHistoryEntry<S extends string> {
  from: S | null;
  to: S;
  at: string;
  actorId: string;
  exceptional: boolean;
  reason?: string;
}

export interface WorkflowInstance<S extends string = string> {
  id: string;
  tenantId: string;
  type: string;
  state: S;
  version: number;
  subject: { type: string; id: string };
  history: WorkflowHistoryEntry<S>[];
}

export interface WorkflowStore {
  get(tenantId: string, id: string): Promise<WorkflowInstance | undefined>;
  /** Insert (expectedVersion 0) or replace (expectedVersion = stored version). Returns false on a version mismatch. */
  put(instance: WorkflowInstance, expectedVersion: number): Promise<boolean>;
}

export class MemoryWorkflowStore implements WorkflowStore {
  private rows = new Map<string, WorkflowInstance>();

  async get(tenantId: string, id: string): Promise<WorkflowInstance | undefined> {
    const r = this.rows.get(JSON.stringify([tenantId, id]));
    return r ? structuredClone(r) : undefined;
  }

  async put(instance: WorkflowInstance, expectedVersion: number): Promise<boolean> {
    const key = JSON.stringify([instance.tenantId, instance.id]);
    const current = this.rows.get(key);
    if ((current?.version ?? 0) !== expectedVersion) return false;
    this.rows.set(key, structuredClone(instance));
    return true;
  }

  snapshot(): Map<string, WorkflowInstance> {
    return structuredClone(this.rows);
  }

  restore(s: unknown): void {
    this.rows = s as Map<string, WorkflowInstance>;
  }
}

export class WorkflowRuntime<S extends string> {
  private readonly def: WorkflowDefinition<S>;
  private readonly store: WorkflowStore;
  private readonly clock: Clock;

  constructor(def: WorkflowDefinition<S>, store: WorkflowStore, clock: Clock) {
    this.def = def;
    this.store = store;
    this.clock = clock;
  }

  async start(ctx: RequestContext, id: string, subject: { type: string; id: string }): Promise<WorkflowInstance<S>> {
    const instance: WorkflowInstance<S> = {
      id,
      tenantId: ctx.tenantId,
      type: this.def.type,
      state: this.def.initial,
      version: 1,
      subject,
      history: [{ from: null, to: this.def.initial, at: this.clock.now().toISOString(), actorId: ctx.actor.personId, exceptional: false }],
    };
    if (!(await this.store.put(instance as WorkflowInstance, 0))) {
      throw new PlatformError('conflict', 'That workflow already exists.');
    }
    return instance;
  }

  async load(ctx: RequestContext, id: string): Promise<WorkflowInstance<S>> {
    const found = await this.store.get(ctx.tenantId, id);
    // Not-found for a wrong tenant is indistinguishable from not-found: no oracle for another tenant's ids.
    if (!found || found.tenantId !== ctx.tenantId || found.type !== this.def.type) throw new PlatformError('not_found', 'We could not find that.');
    return found as WorkflowInstance<S>;
  }

  async advance(ctx: RequestContext, id: string, to: S, opts: { expectedVersion: number; reason?: string }): Promise<WorkflowInstance<S>> {
    const current = await this.load(ctx, id);
    if (current.version !== opts.expectedVersion) {
      throw new PlatformError('conflict', 'This changed while you were looking at it. Reload and try again.');
    }
    const verdict = transition(this.def, current.state, to);
    if (!verdict.ok) throw new PlatformError('precondition_failed', verdict.reason);
    if (verdict.exceptional && !opts.reason?.trim()) {
      throw new PlatformError('validation_failed', 'This move needs a reason, so the record shows why.');
    }
    const next: WorkflowInstance<S> = {
      ...current,
      state: to,
      version: current.version + 1,
      history: [
        ...current.history,
        {
          from: current.state,
          to,
          at: this.clock.now().toISOString(),
          actorId: ctx.actor.personId,
          exceptional: verdict.exceptional,
          ...(opts.reason ? { reason: opts.reason } : {}),
        },
      ],
    };
    if (!(await this.store.put(next as WorkflowInstance, current.version))) {
      throw new PlatformError('conflict', 'This changed while you were looking at it. Reload and try again.');
    }
    return next;
  }
}
