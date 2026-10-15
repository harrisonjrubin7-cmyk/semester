import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The access overview: five sources read for one student, live rows only, and a
 * source that fails said to have failed rather than to be empty.
 */

const NOW = Date.parse('2026-10-06T12:00:00Z');
const FUTURE = '2026-10-10T12:00:00Z';
const PAST = '2026-10-01T12:00:00Z';

type Result = { data: unknown[] | null; error: { message: string } | null };
let tables: Record<string, Result>;
let asked: { table: string; column: string; value: string }[];

import { KIND_ORDER, readAccessOverview, sortEntries, familyWhat } from './access-overview';

/** A client stood in at the edge: it records what was asked and answers from `tables`. */
const db = {
  from: (table: string) => ({
    select: () => ({
      eq: (column: string, value: string) => {
        asked.push({ table, column, value });
        return { limit: async () => tables[table] ?? { data: [], error: null } };
      },
    }),
  }),
} as unknown as Parameters<typeof readAccessOverview>[0];
const loadAccessOverview = (id: string, now: number) => readAccessOverview(db, id, now);

const ok = (rows: unknown[]): Result => ({ data: rows, error: null });

beforeEach(() => {
  asked = [];
  tables = {};
});

describe('what counts as live access', () => {
  it('lists a row that is open and unexpired, and nothing else', async () => {
    tables.support_access_grant = ok([
      { id: 'live', expires_at: FUTURE, revoked_at: null },
      { id: 'revoked', expires_at: FUTURE, revoked_at: PAST },
      { id: 'lapsed', expires_at: PAST, revoked_at: null },
      { id: 'noexpiry', expires_at: null, revoked_at: null },
    ]);
    const { entries, failed } = await loadAccessOverview('me', NOW);
    expect(entries.map((e) => e.id)).toEqual(['live']);
    expect(failed).toEqual([]);
  });

  it('does not count a family grant nobody accepted, or one accepted in the future', async () => {
    tables.family_grants = ok([
      { id: 'a', category: 'housing', accepted_at: PAST, expires_at: FUTURE, revoked_at: null },
      { id: 'unaccepted', category: 'aid', accepted_at: null, expires_at: FUTURE, revoked_at: null },
      { id: 'later', category: 'aid', accepted_at: FUTURE, expires_at: FUTURE, revoked_at: null },
    ]);
    const { entries } = await loadAccessOverview('me', NOW);
    expect(entries.map((e) => e.id)).toEqual(['a']);
    expect(entries[0].what).toBe(familyWhat('housing'));
  });

  it('counts a guardian link that reads, not one recorded with no rights or already ended', async () => {
    tables.guardian_links = ok([
      { id: 'view', rights: 'view_only', ended_at: null },
      { id: 'full', rights: 'full', ended_at: null },
      { id: 'none', rights: 'none', ended_at: null },
      { id: 'ended', rights: 'full', ended_at: PAST },
    ]);
    const { entries } = await loadAccessOverview('me', NOW);
    expect(entries.map((e) => e.id).sort()).toEqual(['full', 'view']);
    expect(entries.every((e) => e.endsAt === null)).toBe(true);
  });

  it('reads an advisor share by its title and falls back when there is none', async () => {
    tables.advisor_shares = ok([
      { id: 'a', title: 'Spring plan', expires_at: FUTURE, revoked_at: null },
      { id: 'b', title: '', expires_at: FUTURE, revoked_at: null },
    ]);
    const { entries } = await loadAccessOverview('me', NOW);
    expect(entries.find((e) => e.id === 'a')?.what).toBe('Spring plan');
    expect(entries.find((e) => e.id === 'b')?.what).toBe('A summary you shared');
  });
});

describe('who it asks about', () => {
  it('asks every source for this student only', async () => {
    await loadAccessOverview('student-1', NOW);
    expect(asked).toHaveLength(5);
    expect(asked.every((a) => a.column === 'student_id' && a.value === 'student-1')).toBe(true);
  });
});

describe('a source that cannot be read', () => {
  it('is named as failed and does not hide the others', async () => {
    tables.advisor_shares = { data: null, error: { message: 'boom' } };
    tables.support_shares = ok([{ id: 's', expires_at: FUTURE, revoked_at: null }]);
    const { entries, failed } = await loadAccessOverview('me', NOW);
    expect(failed).toEqual(['advisor']);
    expect(entries.map((e) => e.kind)).toEqual(['athletic-support']);
  });

  it('control: with nothing wrong and nothing open, the answer is empty and nothing failed', async () => {
    const { entries, failed } = await loadAccessOverview('me', NOW);
    expect(entries).toEqual([]);
    expect(failed).toEqual([]);
  });
});

describe('order', () => {
  it('puts the soonest ending first and open-ended links last, stably', () => {
    const sorted = sortEntries([
      { id: 'g', kind: 'guardian', what: '', endsAt: null },
      { id: 'late', kind: 'advisor', what: '', endsAt: '2026-12-01T00:00:00Z' },
      { id: 'soon', kind: 'family', what: '', endsAt: '2026-10-07T00:00:00Z' },
      { id: 'same', kind: 'support-window', what: '', endsAt: '2026-10-07T00:00:00Z' },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['same', 'soon', 'late', 'g']);
    expect(KIND_ORDER).toHaveLength(5);
  });
});
