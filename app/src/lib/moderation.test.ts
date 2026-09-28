import { describe, expect, it } from 'vitest';
import { ACTIVE_LIMIT, CLOSED_LIMIT, MOVES, QUEUE_COLUMNS, STATUSES, counts, loadQueue, ordered, readRow, type QueuedReport } from './moderation';

/**
 * The report queue's rules, as the screen relies on them. The database side —
 * who may read, who may move, that nobody may rewrite — is in
 * `supabase/reports.check.sql`.
 */

const r = (id: string, status: QueuedReport['status'], createdAt: string): QueuedReport => ({
  id, status, createdAt, reason: 'x', copy: 'y', messageGone: false,
});

describe('the report queue', () => {
  it('never selects who reported or who a report is about', () => {
    const cols = QUEUE_COLUMNS.split(',').map((c) => c.trim());
    expect(cols).not.toContain('reporter');
    expect(cols).not.toContain('about');
    expect(cols).toEqual(expect.arrayContaining(['id', 'status', 'reason', 'copy']));
  });

  it('only ever moves a report to one of the four statuses the database allows, and never to where it is', () => {
    for (const from of STATUSES) {
      for (const m of MOVES[from]) {
        expect(STATUSES).toContain(m.to);
        expect(m.to).not.toBe(from);
      }
    }
  });

  it('can reopen anything closed, so a wrong dismissal is fixable', () => {
    expect(MOVES.dismissed.map((m) => m.to)).toContain('open');
    expect(MOVES.resolved.map((m) => m.to)).toContain('open');
  });

  it('puts open first, then under review, then closed — newest first within each', () => {
    const out = ordered([
      r('a', 'resolved', '2026-09-27'),
      r('b', 'open', '2026-09-20'),
      r('c', 'under_review', '2026-09-26'),
      r('d', 'open', '2026-09-25'),
    ]);
    expect(out.map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(counts(out)).toEqual({ open: 2, under_review: 1, resolved: 1, dismissed: 0 });
  });

  it('drops a row with a status it does not know, and notes a deleted message', () => {
    expect(readRow({ id: 'x', status: 'looked-at-briefly' })).toBeNull();
    expect(readRow({ id: 'x', status: 'open', reason: 'r', copy: 'c', created_at: 't', message_id: null })).toMatchObject({ messageGone: true });
    expect(readRow({ id: 'x', status: 'open', message_id: 'm' })!.messageGone).toBe(false);
  });
});

/**
 * A stand-in for the reports table: applies `in`, `order` and `limit` the way
 * PostgREST does, over rows the test chooses.
 */
function fakeReports(rows: { id: string; status: string; created_at: string }[]) {
  const table = () => {
    let out = rows.map((r) => ({ ...r, reason: 'r', copy: 'c', message_id: 'm' }));
    let counted = false;
    const q = {
      select: (_: string, o?: { count?: string }) => { counted = o?.count === 'exact'; return q; },
      in: (_: string, values: string[]) => { out = out.filter((r) => values.includes(r.status)); return q; },
      order: (_: string, o: { ascending: boolean }) => {
        out = [...out].sort((a, b) => (o.ascending ? 1 : -1) * a.created_at.localeCompare(b.created_at));
        return q;
      },
      // PostgREST's own ceiling: never more than 1,000 rows in one response,
      // whatever limit was asked for. A count, when asked, covers every match.
      limit: (n: number) => Promise.resolve({ data: out.slice(0, Math.min(n, 1000)), count: counted ? out.length : null, error: null }),
    };
    return q;
  };
  return { from: table } as never;
}

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString();

describe('loading the queue', () => {
  it('keeps older open reports when many newer ones are closed', async () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `open-${i}`, status: i % 2 ? 'under_review' : 'open', created_at: day(i) })),
      ...Array.from({ length: 250 }, (_, i) => ({ id: `closed-${i}`, status: i % 2 ? 'dismissed' : 'resolved', created_at: day(20 + i) })),
    ];
    const q = await loadQueue(fakeReports(rows));
    expect(q.reports.filter((r) => r.status === 'open' || r.status === 'under_review').map((r) => r.id).sort())
      .toEqual(['open-0', 'open-1', 'open-2', 'open-3', 'open-4']);
    expect(q.reports.filter((r) => r.status === 'resolved' || r.status === 'dismissed')).toHaveLength(CLOSED_LIMIT);
    expect(q.closedCapped).toBe(true);
    expect(q.moreWaiting).toBe(false);
  });

  it('says so when more are waiting than one load holds, and keeps the oldest', async () => {
    const rows = Array.from({ length: ACTIVE_LIMIT + 3 }, (_, i) => ({ id: `w-${i}`, status: 'open', created_at: `2026-01-01T00:00:${String(i).padStart(6, '0')}` }));
    const q = await loadQueue(fakeReports(rows));
    expect(q.moreWaiting).toBe(true);
    expect(q.reports).toHaveLength(ACTIVE_LIMIT);
    expect(q.reports.map((r) => r.id)).toContain('w-0');
    expect(q.reports.map((r) => r.id)).not.toContain(`w-${ACTIVE_LIMIT + 2}`);
  });

  it('a small queue is all there, with nothing said about limits', async () => {
    const q = await loadQueue(fakeReports([{ id: 'a', status: 'open', created_at: day(1) }, { id: 'b', status: 'resolved', created_at: day(2) }]));
    expect(q.reports.map((r) => r.id)).toEqual(['a', 'b']);
    expect(q).toMatchObject({ moreWaiting: false, closedCapped: false });
  });
});
