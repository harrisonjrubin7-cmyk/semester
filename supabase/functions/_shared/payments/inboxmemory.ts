/**
 * An in-memory `InboxStore` that refuses what the table's trigger refuses, so a test
 * of `inbox.ts` cannot pass on a move the database would reject.
 */
import { canMove, type InboxRow, type InboxStore } from './inbox.ts';

export function memoryInbox(): InboxStore & { rows: Map<string, InboxRow> } {
  const rows = new Map<string, InboxRow>();
  let n = 0;
  return {
    rows,
    async insert(row) {
      for (const r of rows.values()) if (r.provider === row.provider && r.eventId === row.eventId) return 'duplicate';
      rows.set(`row-${++n}`, { ...row, id: `row-${n}` });
      return 'inserted';
    },
    async due(nowIso, limit) {
      return [...rows.values()]
        .filter((r) => r.status === 'received' || ((r.status === 'parked' || r.status === 'failed') && r.nextAttemptAt !== null && r.nextAttemptAt <= nowIso))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).slice(0, limit);
    },
    async get(id) { return rows.get(id) ?? null; },
    async update(id, patch) {
      const old = rows.get(id);
      if (!old) throw new Error('no such row');
      const next = { ...old, ...patch };
      if (!canMove(old.status, next.status)) throw new Error(`cannot move ${old.status} to ${next.status}`);
      if (next.attempts < old.attempts) throw new Error('attempts only go up');
      if ((next.status === 'applied') !== (next.appliedAt !== null)) throw new Error('applied has a time');
      if (next.status === 'parked' && next.nextAttemptAt === null) throw new Error('parked has a retry time');
      rows.set(id, next);
    },
  };
}
