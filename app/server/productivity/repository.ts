import type { SemesterEvent } from '../../../packages/institution/src/index.ts';
import type { CalendarEvent, CommandResult, CursorPosition, Entity, EntityType, Task } from './contract.ts';

/**
 * Tenant and owner, always together, always from the verified session.
 *
 * The repository has no method that takes less. There is no `listAll`, no
 * lookup by id alone and no query a caller can build without a scope, so "I
 * forgot the tenant filter" is not a mistake the interface lets anybody make.
 * The Postgres implementation binds both values into every statement and its
 * primary keys lead with them; row-level security (the migration) is the
 * second wall behind this one, not a substitute for it.
 */
export interface Scope {
  tenantId: string;
  ownerId: string;
}

/** The outcomes worth replaying. A refusal is not stored: it is re-decided each time, against today's policy. */
export type StoredResult = Exclude<CommandResult, { status: 'duplicate' | 'rejected' | 'failed' | 'not_attempted' }>;

export interface StoredCommand {
  commandId: string;
  /** SHA-256 of the canonical command: the same id with a different body is a bug or an attack, not a retry. */
  requestSha256: string;
  result: StoredResult;
  storedAt: string;
}

/**
 * One row of the evidence trail. It names the verb, the object and the
 * outcome, and the *names* of the fields that changed. It never holds a title,
 * a note or a location: an audit log that copies the content it audits is a
 * second, less protected copy of it.
 */
export interface AuditRow {
  id: string;
  tenantId: string;
  ownerId: string;
  correlationId: string;
  actorId: string;
  actorType: string;
  deviceId?: string;
  /** An event type from the catalog, e.g. `task.updated`; for a refusal, the policy action. */
  action: string;
  objectKind: EntityType;
  objectId: string;
  outcome: 'allowed' | 'denied';
  reasonCode?: string;
  fields?: string[];
  commandId?: string;
  occurredAt: string;
}

/**
 * What the service may do inside one transaction. Everything written through
 * it commits together or not at all: the record, the command ledger row that
 * makes a retry a no-op, the audit row, and the event.
 */
export interface ProductivityTx {
  command(commandId: string): StoredCommand | null;
  recordCommand(command: StoredCommand): void;
  /** Includes tombstones, so a late edit can be told "gone" rather than "never existed". */
  entity(type: EntityType, id: string): Entity | null;
  /** Writes the entity at the next sequence number for this owner, and returns that number. */
  save(entity: Entity): number;
  audit(row: AuditRow): void;
  emit(event: SemesterEvent): void;
}

export interface TaskQuery {
  status?: 'open' | 'done';
  dueBefore?: string;
  dueAfter?: string;
  after: CursorPosition | null;
  limit: number;
}

export interface EventQuery {
  from: string;
  to: string;
  after: CursorPosition | null;
  limit: number;
}

export interface OutboxStats {
  pending: number;
  oldestPendingAgeSeconds: number;
  deadLettered: number;
}

export interface ProductivityRepository {
  /**
   * Runs `work` with every write staged, and commits only if it returns.
   * Transactions for one scope run one at a time, in arrival order: that is
   * what lets "has this command been seen" and "record that it has" be one
   * decision rather than a race.
   */
  transaction<T>(scope: Scope, work: (tx: ProductivityTx) => T | Promise<T>): Promise<T>;

  /** Live (not deleted) entity, or null. */
  get(scope: Scope, type: EntityType, id: string): Promise<Entity | null>;
  /** Up to `limit` live tasks after the cursor; the caller asks for one more than it will show. */
  listTasks(scope: Scope, query: TaskQuery): Promise<Task[]>;
  listEvents(scope: Scope, query: EventQuery): Promise<CalendarEvent[]>;
  /** Everything — tombstones included — changed after `afterSeq`, in sequence order. */
  changes(scope: Scope, afterSeq: number, limit: number): Promise<Entity[]>;

  /** Throws if the store cannot be reached. */
  ping(): Promise<void>;
  outboxStats(): Promise<OutboxStats>;
}

/** The sort key tasks are paged by: due date, with undated tasks last. */
export const taskSortKey = (t: Pick<Task, 'dueAt'>): string => t.dueAt ?? '9999-12-31T23:59:59.999Z';
