import { MemoryOutbox, type SemesterEvent } from '../../../packages/institution/src/index.ts';
import type { CalendarEvent, Entity, EntityType, Task } from './contract.ts';
import {
  taskSortKey,
  type AuditRow,
  type EventQuery,
  type OutboxStats,
  type ProductivityRepository,
  type ProductivityTx,
  type Scope,
  type StoredCommand,
  type TaskQuery,
} from './repository.ts';

/**
 * The reference repository: the contract in memory, for tests and for reading.
 *
 * It is not a toy. It serializes transactions per scope, stages every write
 * and discards the lot when the work throws, hands out gapless sequence
 * numbers that a rolled-back transaction does not consume, and keeps scopes
 * apart by construction — the three properties a Postgres implementation must
 * also have, and `repository-contract.test.ts` states them as tests any
 * implementation runs.
 */
export class MemoryProductivityRepository implements ProductivityRepository {
  readonly outbox = new MemoryOutbox();
  readonly auditRows: AuditRow[] = [];
  /** Faults a test can arm to see what a failure leaves behind. */
  readonly faults: { emit: Error | null; commit: Error | null; afterCommit: Error | null; read: Error | null } = {
    emit: null,
    commit: null,
    afterCommit: null,
    read: null,
  };

  private entities = new Map<string, Entity>();
  private commands = new Map<string, StoredCommand>();
  private seqs = new Map<string, number>();
  private queues = new Map<string, Promise<unknown>>();

  private static key(scope: Scope): string {
    return `${scope.tenantId}\u0000${scope.ownerId}`;
  }
  private static entityKey(scope: Scope, type: EntityType, id: string): string {
    return `${MemoryProductivityRepository.key(scope)}\u0000${type}\u0000${id}`;
  }

  async transaction<T>(scope: Scope, work: (tx: ProductivityTx) => T | Promise<T>): Promise<T> {
    const k = MemoryProductivityRepository.key(scope);
    const previous = this.queues.get(k) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => this.run(scope, work));
    this.queues.set(k, run);
    try {
      return await run;
    } finally {
      if (this.queues.get(k) === run) this.queues.delete(k);
    }
  }

  private async run<T>(scope: Scope, work: (tx: ProductivityTx) => T | Promise<T>): Promise<T> {
    const staged = {
      entities: new Map<string, Entity>(),
      commands: new Map<string, StoredCommand>(),
      audit: [] as AuditRow[],
      events: [] as SemesterEvent[],
      seq: this.seqs.get(MemoryProductivityRepository.key(scope)) ?? 0,
    };
    const tx: ProductivityTx = {
      command: (id) => {
        const hit = staged.commands.get(id) ?? this.commands.get(`${MemoryProductivityRepository.key(scope)}\u0000${id}`);
        return hit ? structuredClone(hit) : null;
      },
      recordCommand: (c) => void staged.commands.set(c.commandId, structuredClone(c)),
      entity: (type, id) => {
        const k = MemoryProductivityRepository.entityKey(scope, type, id);
        const hit = staged.entities.get(k) ?? this.entities.get(k);
        return hit ? structuredClone(hit) : null;
      },
      save: (entity) => {
        if (entity.tenantId !== scope.tenantId || entity.ownerId !== scope.ownerId) {
          throw new Error('entity is outside the transaction scope');
        }
        staged.seq += 1;
        const type: EntityType = 'status' in entity ? 'task' : 'calendar_event';
        staged.entities.set(MemoryProductivityRepository.entityKey(scope, type, entity.id), structuredClone({ ...entity, seq: staged.seq }));
        return staged.seq;
      },
      audit: (row) => void staged.audit.push(structuredClone(row)),
      emit: (event) => {
        if (this.faults.emit) throw this.faults.emit;
        staged.events.push(structuredClone(event));
      },
    };

    const result = await work(tx);
    if (this.faults.commit) throw this.faults.commit;

    // Commit: everything or nothing, and no await between the first write and the last.
    for (const [k, v] of staged.entities) this.entities.set(k, v);
    for (const [id, c] of staged.commands) this.commands.set(`${MemoryProductivityRepository.key(scope)}\u0000${id}`, c);
    this.auditRows.push(...staged.audit);
    for (const e of staged.events) this.outbox.append(e);
    this.seqs.set(MemoryProductivityRepository.key(scope), staged.seq);

    if (this.faults.afterCommit) throw this.faults.afterCommit;
    return result;
  }

  private visible(scope: Scope): Entity[] {
    if (this.faults.read) throw this.faults.read;
    const prefix = `${MemoryProductivityRepository.key(scope)}\u0000`;
    return [...this.entities].filter(([k]) => k.startsWith(prefix)).map(([, v]) => structuredClone(v));
  }

  async get(scope: Scope, type: EntityType, id: string): Promise<Entity | null> {
    if (this.faults.read) throw this.faults.read;
    const hit = this.entities.get(MemoryProductivityRepository.entityKey(scope, type, id));
    return hit && hit.deletedAt === null ? structuredClone(hit) : null;
  }

  async listTasks(scope: Scope, q: TaskQuery): Promise<Task[]> {
    const tasks = this.visible(scope).filter((e): e is Task => 'status' in e && e.deletedAt === null);
    return tasks
      .filter((t) => (q.status ? t.status === q.status : true))
      .filter((t) => (q.dueBefore ? t.dueAt !== null && t.dueAt < q.dueBefore : true))
      .filter((t) => (q.dueAfter ? t.dueAt !== null && t.dueAt > q.dueAfter : true))
      .sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)) || a.id.localeCompare(b.id))
      .filter((t) => {
        const c = q.after;
        if (!c || c.k !== 'k') return true;
        const key = taskSortKey(t);
        return key > c.key! || (key === c.key && t.id > c.id!);
      })
      .slice(0, q.limit);
  }

  async listEvents(scope: Scope, q: EventQuery): Promise<CalendarEvent[]> {
    const events = this.visible(scope).filter((e): e is CalendarEvent => 'startsAt' in e && e.deletedAt === null);
    return events
      .filter((e) => e.startsAt < q.to && e.endsAt > q.from)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
      .filter((e) => {
        const c = q.after;
        if (!c || c.k !== 'k') return true;
        return e.startsAt > c.key! || (e.startsAt === c.key && e.id > c.id!);
      })
      .slice(0, q.limit);
  }

  async changes(scope: Scope, afterSeq: number, limit: number): Promise<Entity[]> {
    return this.visible(scope).filter((e) => e.seq > afterSeq).sort((a, b) => a.seq - b.seq).slice(0, limit);
  }

  async ping(): Promise<void> {
    if (this.faults.read) throw this.faults.read;
  }

  async outboxStats(): Promise<OutboxStats> {
    const now = Date.now();
    const pending = this.outbox.rows.filter((r) => r.publishedAt === null && r.deadLetteredAt === null);
    const oldest = pending.reduce((min, r) => Math.min(min, Date.parse(r.event.occurredAt)), Number.POSITIVE_INFINITY);
    return {
      pending: pending.length,
      oldestPendingAgeSeconds: pending.length === 0 ? 0 : Math.max(0, Math.round((now - oldest) / 1000)),
      deadLettered: this.outbox.rows.filter((r) => r.deadLetteredAt !== null).length,
    };
  }
}
