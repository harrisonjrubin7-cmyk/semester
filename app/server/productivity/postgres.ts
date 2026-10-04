import { createClient } from '@supabase/supabase-js';
import type { SemesterEvent } from '../../../packages/institution/src/index.ts';
import type { CalendarEvent, Entity, EntityType, Task } from './contract.ts';
import type {
  AuditRow,
  EventQuery,
  OutboxStats,
  ProductivityRepository,
  ProductivityTx,
  Scope,
  StoredCommand,
  StoredResult,
  TaskQuery,
} from './repository.ts';

/**
 * The Postgres `ProductivityRepository`.
 *
 * It does very little, on purpose. Every read is a function in
 * `20261004150000_productivity_reads.sql` that returns the entity already in the
 * shape the service holds it, and every write is the single atomic
 * `productivity_commit` of `20261004123000_productivity_commands.sql`. So there is no
 * row mapping here to drift from the SQL, and no SQL string here to get wrong; this
 * file is the *protocol* between the two: what a transaction reads, what it stages,
 * and what it does when the database says somebody else got there first.
 *
 * ## A transaction that cannot hold a transaction open
 *
 * PostgREST answers one call at a time; it cannot keep a database transaction open
 * across "read the record, decide, write it". So `transaction()` is optimistic:
 *
 *  1. read what the work asks about (each read is its own call);
 *  2. stage everything the work writes, in memory;
 *  3. hand the whole set to `productivity_commit`, which applies it atomically — and
 *     refuses, with SQLSTATE 40001, if any entity's `seq` is not the one it was read
 *     at, or if the owner's sequence counter is not where the staged `seq`s predicted;
 *  4. on 40001 (somebody got in between) or 23505 (this very command was applied a
 *     moment ago — its ledger row is the arbiter), throw the staged writes away and
 *     run the work again from the reads, which now see what the other writer did.
 *
 * The work is re-run, not retried: it decides again against the new state, so a
 * decision can never be made on one record and applied to another. The work must
 * therefore be free of effects outside the transaction, and the service's is.
 *
 * Within one process, transactions for one scope also run one at a time, in arrival
 * order, so the common case — one person's offline queue arriving in one request —
 * does not fight itself. Across processes the database is the arbiter.
 *
 * ## Sequence numbers are predicted, and held to it
 *
 * The service is handed a sequence number when it saves an entity, before the commit
 * that allocates it. Here that number is the owner's counter as the transaction read
 * it, plus one for each entity saved since. The commit checks it against the
 * counter under its lock. So a number returned from `save` is a number that either
 * was written or whose transaction was thrown away whole — never one that two writers
 * both believed was theirs.
 *
 * ## What it does not do
 *
 * It has no timeouts of its own (set them on the client), no connection pool (the
 * client has one), and it does not look inside an error that is not a conflict: a
 * network failure, a 5xx or a constraint violation is thrown as it came, and the
 * service turns it into a `failed`, retryable result, safe to resend because the
 * command ledger answers a resend of a command that did commit.
 */

/** The one thing this adapter needs of its client, which `SupabaseClient` already is. */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

export interface PostgresRepositoryOptions {
  client?: RpcClient;
  url?: string;
  /** A server-only service-role key. Never a browser's. */
  serviceKey?: string;
  /** Attempts per transaction before giving up on contention. */
  maxAttempts?: number;
  /** Injected so a test does not wait; production waits a few milliseconds, with jitter. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** SQLSTATEs that mean "read again": a stale writer, and a command somebody else just applied. */
const CONFLICT = new Set(['40001', '23505']);

const keyOf = (type: EntityType, id: string) => `${type}\u0000${id}`;
const typeOf = (e: Entity): EntityType => ('status' in e ? 'task' : 'calendar_event');

export class DatabaseError extends Error {
  readonly code: string | undefined;
  constructor(fn: string, error: { code?: string; message?: string }) {
    // The function and the SQLSTATE, never the message: it can quote a value.
    super(`${fn} failed${error.code ? ` (${error.code})` : ''}`);
    this.code = error.code;
  }
}

export class ContentionError extends Error {
  constructor(attempts: number) {
    super(`gave up after ${attempts} conflicting attempts`);
  }
}

export class PostgresProductivityRepository implements ProductivityRepository {
  private readonly client: RpcClient;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(options: PostgresRepositoryOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for the productivity repository.');
    }
    this.client = options.client ?? (createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }) as unknown as RpcClient);
    this.maxAttempts = options.maxAttempts ?? 6;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = options.random ?? Math.random;
  }

  private async call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new DatabaseError(fn, error);
    return data as T;
  }

  // ── Transactions ───────────────────────────────────────────────────────

  async transaction<T>(scope: Scope, work: (tx: ProductivityTx) => T | Promise<T>): Promise<T> {
    const k = `${scope.tenantId}\u0000${scope.ownerId}`;
    const previous = this.queues.get(k) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => this.attempts(scope, work));
    this.queues.set(k, run);
    try {
      return await run;
    } finally {
      if (this.queues.get(k) === run) this.queues.delete(k);
    }
  }

  private async attempts<T>(scope: Scope, work: (tx: ProductivityTx) => T | Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      const staged = new Staged();
      const tx = this.tx(scope, staged);
      const result = await work(tx);
      try {
        await this.commit(scope, staged);
        return result;
      } catch (error) {
        const code = error instanceof DatabaseError ? error.code : undefined;
        if (!code || !CONFLICT.has(code)) throw error;
        if (attempt >= this.maxAttempts) throw new ContentionError(attempt);
        // Somebody else committed first. Wait a moment, longer each time and never in step with them.
        await this.sleep(Math.round(Math.min(200, 5 * 2 ** attempt) * (0.5 + this.random())));
      }
    }
  }

  private tx(scope: Scope, staged: Staged): ProductivityTx {
    const args = { p_tenant: scope.tenantId, p_owner: scope.ownerId };

    const ensureBase = async (): Promise<number> => {
      if (staged.base === undefined) {
        staged.base = (await this.call<{ lastSeq: number }>('productivity_tx_state', { ...args, p_command: null })).lastSeq;
      }
      return staged.base;
    };

    return {
      command: async (commandId) => {
        const state = await this.call<{ lastSeq: number; command: { requestSha256: string; result: StoredResult; storedAt: string } | null }>(
          'productivity_tx_state', { ...args, p_command: commandId });
        // The counter and the ledger row come from one read, so they agree with each other.
        staged.base ??= state.lastSeq;
        return state.command ? { commandId, ...state.command } : null;
      },

      recordCommand: (command: StoredCommand) => {
        staged.command = { commandId: command.commandId, requestSha256: command.requestSha256, result: command.result };
      },

      entity: async (type, id) => {
        const key = keyOf(type, id);
        const mine = staged.entities.get(key);
        if (mine) return structuredClone(mine.entity);
        if (!staged.read.has(key)) {
          const found = await this.call<Entity | null>('productivity_get', { ...args, p_type: type, p_id: id, p_include_deleted: true });
          staged.read.set(key, found ? asEntity(found) : null);
        }
        const read = staged.read.get(key) ?? null;
        return read ? structuredClone(read) : null;
      },

      save: async (entity) => {
        if (entity.tenantId !== scope.tenantId || entity.ownerId !== scope.ownerId) {
          throw new Error('entity is outside the transaction scope');
        }
        const type = typeOf(entity);
        const key = keyOf(type, entity.id);
        if (staged.entities.has(key)) throw new Error('an entity is saved once per transaction');
        const base = await ensureBase();
        const predicted = base + staged.entities.size + 1;
        // What the entity's `seq` was when this transaction read it: that, not what the caller
        // says now, is what the commit must still find in the table. An entity it never read is
        // taken at the `seq` it arrived with (0 for a new one).
        const readSeq = staged.read.has(key) ? (staged.read.get(key)?.seq ?? 0) : entity.seq;
        staged.entities.set(key, { type, entity: { ...structuredClone(entity), seq: predicted }, expectedSeq: readSeq, predicted });
        return predicted;
      },

      audit: (row: AuditRow) => void staged.audit.push(structuredClone(row)),
      emit: (event: SemesterEvent) => void staged.events.push(structuredClone(event)),
    };
  }

  private async commit(scope: Scope, staged: Staged): Promise<void> {
    if (!staged.command && staged.entities.size === 0 && staged.audit.length === 0 && staged.events.length === 0) return;
    await this.call('productivity_commit', {
      p_tenant: scope.tenantId,
      p_owner: scope.ownerId,
      p_command: staged.command ?? null,
      p_entities: [...staged.entities.values()].map((s) => ({ type: s.type, expectedSeq: s.expectedSeq, seq: s.predicted, row: s.entity })),
      p_audit: staged.audit,
      p_events: staged.events,
    });
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async get(scope: Scope, type: EntityType, id: string): Promise<Entity | null> {
    const found = await this.call<Entity | null>('productivity_get', { p_tenant: scope.tenantId, p_owner: scope.ownerId, p_type: type, p_id: id, p_include_deleted: false });
    return found ? asEntity(found) : null;
  }

  async listTasks(scope: Scope, q: TaskQuery): Promise<Task[]> {
    const rows = await this.call<unknown[]>('productivity_list_tasks', {
      p_tenant: scope.tenantId, p_owner: scope.ownerId,
      p_status: q.status ?? null, p_due_before: q.dueBefore ?? null, p_due_after: q.dueAfter ?? null,
      p_after_key: q.after?.k === 'k' ? q.after.key : null, p_after_id: q.after?.k === 'k' ? q.after.id : null,
      p_limit: q.limit,
    });
    return rows.map((r) => asEntity(r) as Task);
  }

  async listEvents(scope: Scope, q: EventQuery): Promise<CalendarEvent[]> {
    const rows = await this.call<unknown[]>('productivity_list_events', {
      p_tenant: scope.tenantId, p_owner: scope.ownerId, p_from: q.from, p_to: q.to,
      p_after_key: q.after?.k === 'k' ? q.after.key : null, p_after_id: q.after?.k === 'k' ? q.after.id : null,
      p_limit: q.limit,
    });
    return rows.map((r) => asEntity(r) as CalendarEvent);
  }

  async changes(scope: Scope, afterSeq: number, limit: number): Promise<Entity[]> {
    const rows = await this.call<unknown[]>('productivity_changes', { p_tenant: scope.tenantId, p_owner: scope.ownerId, p_after: afterSeq, p_limit: limit });
    return rows.map(asEntity);
  }

  async ping(): Promise<void> {
    await this.call('productivity_outbox_stats', {});
  }

  async outboxStats(): Promise<OutboxStats> {
    const s = await this.call<{ pending: number; oldestPendingAgeSeconds: number; deadLettered: number }>('productivity_outbox_stats', {});
    return { pending: Number(s.pending), oldestPendingAgeSeconds: Number(s.oldestPendingAgeSeconds), deadLettered: Number(s.deadLettered) };
  }
}

class Staged {
  /** The owner's counter as first read in this attempt. */
  base: number | undefined;
  readonly read = new Map<string, Entity | null>();
  readonly entities = new Map<string, { type: EntityType; entity: Entity; expectedSeq: number; predicted: number }>();
  command: { commandId: string; requestSha256: string; result: StoredResult } | undefined;
  readonly audit: AuditRow[] = [];
  readonly events: SemesterEvent[] = [];
}

/** A cheap shape check on what the database returned: a wrong function name or a drifted column fails here, loudly. */
function asEntity(value: unknown): Entity {
  const v = value as Partial<Entity> | null;
  if (!v || typeof v !== 'object' || typeof v.id !== 'string' || typeof v.seq !== 'number' || typeof v.version !== 'number' || !v.source || !v.clocks) {
    throw new Error('the database returned something that is not an entity');
  }
  return value as Entity;
}
