import { describe, expect, it } from 'vitest';
import { MOVES, QUEUE_COLUMNS, STATUSES, counts, ordered, readRow, type QueuedReport } from './moderation';

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
