import { describe, expect, it, vi } from 'vitest';

/**
 * The client side of supporter reading (D-037 slice 3). The database is
 * stubbed; what it enforces is proved by supabase/familyshare.check.sql.
 */

const mock = vi.hoisted(() => {
  const is = vi.fn(() => Promise.resolve({ error: null }));
  const overlaps = vi.fn(() => ({ is }));
  const removed = vi.fn(() => Promise.resolve({ error: null }));
  const from = vi.fn((table: string) => (table === 'family_grants' ? { update: vi.fn(() => ({ overlaps })) } : { delete: () => ({ in: removed }) }));
  return { rpc: vi.fn(), from, overlaps, is, removed };
});
vi.mock('./cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }) }));
const { endedShares, groupShares, localMinute, makeShare, readSeen, readsOf, sharePayload, stopSharing } = await import('./familyshare');
const { newFamilyItem } = await import('./family');

describe('what leaves the device', () => {
  it('is the fields a supporter sees, and never which person the plan was for', () => {
    const item = { ...newFamilyItem('mom'), id: 'bill', title: 'Bill', category: 'finances' as const };
    const [out] = sharePayload([item]);
    expect(Object.keys(out).sort()).toEqual(['amount', 'body', 'category', 'done', 'due', 'id', 'kind', 'title']);
  });

  it('carries only the items the code names, with the name trimmed', async () => {
    mock.rpc.mockResolvedValue({ data: 'K7M2Q9ZP', error: null });
    const items = ['a', 'b', 'c'].map((id) => ({ ...newFamilyItem('mom'), id, title: id }));
    await expect(makeShare({ categories: ['communication'], resources: ['a', 'c'], days: 30 }, items, '  Sam ')).resolves.toBe('K7M2Q9ZP');
    const [, args] = mock.rpc.mock.calls[0];
    expect(args.want_items.map((i: { id: string }) => i.id)).toEqual(['a', 'c']);
    expect(args.want_shown_as).toBe('Sam');
  });

  it('says what the database refused', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'semester: an item does not match what the code shares' } });
    await expect(makeShare({ categories: ['finances'], resources: ['a'], days: 30 }, [], 'Sam')).rejects.toThrow('does not match');
  });
});

describe('what the supporter reads', () => {
  const r = (over: Record<string, unknown>) => ({ student_id: 's1', shown_as: 'Sam', category: 'finances', item_id: 'x', kind: 'information', title: 'T', body: '', due: '', done: false, amount: '0', ends_at: '2026-12-01T00:00:00+00:00', ...over });

  it('groups by student, and ends on the latest grant', () => {
    const out = groupShares([
      r({ item_id: 'a' }),
      r({ item_id: 'b', ends_at: '2026-12-15T00:00:00+00:00' }),
      r({ student_id: 's2', shown_as: 'Ana', item_id: 'c', amount: '12.5' }),
    ]);
    expect(out.map((s) => [s.shownAs, s.ends, s.items.length])).toEqual([
      ['Sam', '2026-12-15', 2],
      ['Ana', '2026-12-01', 1],
    ]);
    expect(out[1].items[0].amount).toBe(12.5);
  });

  it('skips a row that is not one', () => {
    expect(groupShares([null, 'x', { student_id: 1 }, r({ item_id: 'a' })])).toHaveLength(1);
  });

  it('remembers who shared before, so an end can be said', () => {
    expect(readSeen({ s1: 'Sam', s2: 7, ['x'.repeat(65)]: 'Too long a key' })).toEqual({ s1: 'Sam' });
    expect(readSeen('nope')).toEqual({});
    expect(endedShares({ s1: 'Sam', s2: 'Ana' }, groupShares([r({})]))).toEqual([{ studentId: 's2', shownAs: 'Ana' }]);
  });
});

describe("the student's side", () => {
  it('finds the reads of one person’s items', () => {
    const log = [
      { readerId: 'p', itemIds: ['a'], readAt: '1' },
      { readerId: 'q', itemIds: ['z'], readAt: '2' },
      { readerId: 'p', itemIds: [], readAt: '3' },
    ];
    expect(readsOf(log, ['a', 'b']).map((e) => e.readAt)).toEqual(['1']);
  });

  it('dates a read on the student’s own clock', () => {
    expect(localMinute(new Date(2026, 0, 5, 7, 3).toISOString())).toBe('2026-01-05 07:03');
    expect(localMinute('not a time')).toBe('not a time');
  });

  it('stops by revoking every live grant naming the items, then removing the copies', async () => {
    await stopSharing(['a', 'b']);
    expect(mock.overlaps).toHaveBeenCalledWith('resource_ids', ['a', 'b']);
    expect(mock.is).toHaveBeenCalledWith('revoked_at', null);
    expect(mock.removed).toHaveBeenCalledWith('item_id', ['a', 'b']);
  });

  it('does nothing at all for nothing', async () => {
    mock.from.mockClear();
    await stopSharing([]);
    expect(mock.from).not.toHaveBeenCalled();
  });
});
