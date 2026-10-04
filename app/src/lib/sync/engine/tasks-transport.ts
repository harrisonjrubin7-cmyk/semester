import type { Change, Command, CommandResult, PullResponse, PushResponse, SyncTransport } from '@semester/offline-sync';
import type { TaskRow, TaskRows } from './rows';
import { stampToVersion, versionToStamp } from './stamp';

/** Where a command leaves its id, so a repeated key is recognised and a lost answer can be found. */
export const CMD = '_cmd';

/** The server keeps tombstones 90 days (`sweep_tombstones`); a cursor older than this may have missed one. */
const CURSOR_HORIZON_US = 80 * 86_400_000 * 1000;
const PAGE = 200;
/** A snapshot is one request. A person has hundreds of tasks, not hundreds of thousands. */
const SNAPSHOT_LIMIT = 5000;
/** A compare-and-swap that loses to another device's write is read again and retried this many times. */
const RACES = 4;

const valueOf = (data: Record<string, unknown>): Record<string, unknown> => {
  const { [CMD]: _drop, ...rest } = data;
  return rest;
};
const versionOf = (r: TaskRow) => stampToVersion(r.updated_at);

export interface TasksTransportOptions {
  now: () => number;
}

/**
 * The engine's server, played by the tasks table.
 *
 * There is no gateway yet (`docs/architecture/mobile-offline-reference.md`, delivery step 2), so this is the
 * conversion's interim: a `SyncTransport` that speaks to `public.tasks` directly, under the person's own
 * row-level security, with no migration. What it can and cannot promise is narrower than the real gateway's, and
 * is written here so nobody mistakes one for the other:
 *
 * - **Idempotency without a receipts table.** A command leaves its id in the row it wrote (`data._cmd`). A repeat
 *   finds it and answers `duplicate`. That covers the case that matters — the answer was lost and nothing has
 *   written the row since. If another device has written since, the id is overwritten, the repeat is not
 *   recognised, and the engine's resend finds a moved stamp: it is applied on top of the newer row, not twice,
 *   because a patch that sets the same fields to the same values is the same patch.
 * - **Ordering is arrival order.** The database stamps a write when it lands, and a write is applied over the
 *   row's current state. The later arrival wins a field, which is the strongest clamp there is — no device clock
 *   is consulted at all — and is what `cloud.ts` already does for the whole state row. A task never reaches
 *   `conflicted` through a patch. (A create over an existing id does.)
 * - **No permission epoch, no tenant, no policy version.** Row-level security scopes the rows to the person; the
 *   fields exist on the command for the gateway that will check them.
 * - **No server clock for expiry.** `expiresAt` is checked against this device's own clock.
 */
export function tasksTransport(rows: TaskRows, o: TasksTransportOptions): SyncTransport {
  const applied = (id: string, r: TaskRow, status: 'applied' | 'duplicate'): CommandResult => ({
    id, status, serverVersion: versionOf(r), value: valueOf(r.data),
  });

  async function run(c: Command): Promise<CommandResult> {
    if (c.dataClass !== 'task') return { id: c.id, status: 'rejected', reason: 'policy_denied', detail: 'Only your actions travel this way.' };
    if (c.op === 'submit') return { id: c.id, status: 'rejected', reason: 'server_authoritative' };
    if (c.expiresAt <= o.now()) return { id: c.id, status: 'rejected', reason: 'expired' };

    const seen = await rows.byCommand(c.id);
    if (seen) return applied(c.id, seen, 'duplicate');

    const payload = (c.payload ?? {}) as Record<string, unknown>;
    if (c.op === 'create') {
      const made = await rows.insert(c.entityId, { ...payload, [CMD]: c.id });
      if (made !== 'taken') return applied(c.id, made, 'applied');
      const there = await rows.get(c.entityId);
      return there
        ? { id: c.id, status: 'conflict', serverVersion: versionOf(there), serverValue: valueOf(there.data) }
        : { id: c.id, status: 'retry' };
    }

    for (let attempt = 0; attempt < RACES; attempt++) {
      const row = await rows.get(c.entityId);
      if (c.op === 'delete') {
        // Deleting what is already gone is done.
        if (!row) return { id: c.id, status: 'applied', serverVersion: 0 };
        if (row.deleted_at) return applied(c.id, row, 'applied');
        const gone = await rows.updateIf(c.entityId, row.updated_at, { ...row.data, [CMD]: c.id }, new Date(o.now()).toISOString());
        if (gone) return { id: c.id, status: 'applied', serverVersion: versionOf(gone) };
        continue;
      }
      if (!row || row.deleted_at) return { id: c.id, status: 'rejected', reason: 'validation_failed', detail: 'That action no longer exists.' };
      const wrote = await rows.updateIf(c.entityId, row.updated_at, { ...row.data, ...payload, [CMD]: c.id });
      if (wrote) return applied(c.id, wrote, 'applied');
    }
    // Four races lost in a row: another device is writing this task as fast as we are. Try again shortly.
    return { id: c.id, status: 'retry', retryAfterMs: 2000 };
  }

  return {
    async push(req): Promise<PushResponse> {
      const results: CommandResult[] = [];
      // One device's commands in the order it made them. A thrown database error is not an answer: it goes up to
      // the engine, which keeps the whole batch ambiguous and asks again rather than guessing.
      for (const c of [...req.commands].sort((a, b) => a.seq - b.seq)) results.push(await run(c));
      return { kind: 'results', results };
    },

    async status(req): Promise<PushResponse> {
      const results: CommandResult[] = [];
      for (const id of req.ids) {
        const r = await rows.byCommand(id);
        results.push(r ? applied(id, r, 'duplicate') : { id, status: 'unknown' });
      }
      return { kind: 'results', results };
    },

    async pull(req): Promise<PullResponse> {
      if (!req.cursor) {
        const live = await rows.since(null, SNAPSHOT_LIMIT);
        const changes: Change[] = live.map((r) => ({ dataClass: 'task', id: r.id, version: versionOf(r), value: valueOf(r.data) }));
        const top = changes.reduce((n, c) => Math.max(n, c.version), 0);
        return { kind: 'changes', changes, nextCursor: String(top), hasMore: false, snapshot: true };
      }
      const cursor = Number(req.cursor);
      if (!Number.isFinite(cursor) || o.now() * 1000 - cursor > CURSOR_HORIZON_US) return { kind: 'changes', cursorExpired: true };
      // `>=`, so two writes sharing a microsecond cannot be split across pages; the boundary row comes back once
      // more and the engine ignores a version it already has.
      const page = await rows.since(versionToStamp(cursor), PAGE);
      const changes: Change[] = page.map((r) => (r.deleted_at
        ? { dataClass: 'task', id: r.id, version: versionOf(r), deleted: true }
        : { dataClass: 'task', id: r.id, version: versionOf(r), value: valueOf(r.data) }));
      const top = changes.reduce((n, c) => Math.max(n, c.version), cursor);
      return { kind: 'changes', changes, nextCursor: String(top), hasMore: page.length >= PAGE && top > cursor };
    },
  };
}
