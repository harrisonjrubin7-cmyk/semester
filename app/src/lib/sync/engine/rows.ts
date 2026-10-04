import type { SupabaseClient } from '@supabase/supabase-js';

/** A row of `public.tasks`: the whole task as `data`, stamped by the database. */
export interface TaskRow {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * The five questions the engine's transport asks of the tasks table, and nothing more.
 *
 * A port rather than the Supabase client so the transport's rules — what counts as a duplicate, what a stale
 * stamp means, how a delete is written — are tested against a fake that behaves like the table, and so the one
 * file that talks to the database (`supabaseTaskRows`) is small enough to read in one go.
 */
export interface TaskRows {
  get(id: string): Promise<TaskRow | null>;
  /** `'taken'` when the id is already a row (live or deleted). */
  insert(id: string, data: Record<string, unknown>): Promise<TaskRow | 'taken'>;
  /**
   * Compare-and-swap: write only where `updated_at` is still `stamp`. `null` means it was not — someone else
   * wrote first — and nothing was changed. `deletedAt` set means a soft delete.
   */
  updateIf(id: string, stamp: string, data: Record<string, unknown>, deletedAt?: string): Promise<TaskRow | null>;
  /** The row a command wrote, found by the command id it left in `data._cmd`. */
  byCommand(commandId: string): Promise<TaskRow | null>;
  /** `stamp` null: every live row. Otherwise rows at or after it, deleted ones included, oldest first. */
  since(stamp: string | null, limit: number): Promise<TaskRow[]>;
}

const COLS = 'id, data, updated_at, deleted_at';
/** Postgres unique_violation. */
const TAKEN = '23505';

const asRow = (r: unknown): TaskRow => r as TaskRow;

/**
 * `public.tasks` over PostgREST, under the signed-in person's own row-level security (`"own rows"`).
 *
 * Nothing here needs a migration: the table, its `touch_updated_at` trigger, its `deleted_at` tombstone and its
 * `(user_id, updated_at)` index were created by `20260901000700_records.sql` for exactly this and have been
 * waiting for a client. It writes with the same optimistic locking `cloud.ts` already uses for `state` and
 * `courses`.
 */
export function supabaseTaskRows(db: SupabaseClient, userId: string): TaskRows {
  const mine = () => db.from('tasks');
  return {
    async get(id) {
      const { data, error } = await mine().select(COLS).eq('user_id', userId).eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? asRow(data) : null;
    },
    async insert(id, data) {
      const { data: row, error } = await mine().insert({ user_id: userId, id, data }).select(COLS).maybeSingle();
      if (error) {
        if (error.code === TAKEN) return 'taken';
        throw error;
      }
      return asRow(row);
    },
    async updateIf(id, stamp, data, deletedAt) {
      const { data: rows, error } = await mine()
        .update(deletedAt === undefined ? { data } : { data, deleted_at: deletedAt })
        .eq('user_id', userId)
        .eq('id', id)
        .eq('updated_at', stamp)
        .select(COLS);
      if (error) throw error;
      const first = (rows ?? [])[0];
      return first ? asRow(first) : null;
    },
    async byCommand(commandId) {
      const { data, error } = await mine().select(COLS).eq('user_id', userId).eq('data->>_cmd', commandId).limit(1);
      if (error) throw error;
      const first = (data ?? [])[0];
      return first ? asRow(first) : null;
    },
    async since(stamp, limit) {
      let q = mine().select(COLS).eq('user_id', userId);
      q = stamp === null ? q.is('deleted_at', null) : q.gte('updated_at', stamp);
      const { data, error } = await q.order('updated_at', { ascending: true }).limit(limit);
      if (error) throw error;
      return (data ?? []).map(asRow);
    },
  };
}
