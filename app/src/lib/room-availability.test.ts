import { describe, expect, it } from 'vitest';
import { quietFirst, roomsNow } from './room-availability';
import { ROOM_TYPES, SHOWN_TYPES, loadRoomRecords, type RecordRow } from './integration/school-records';

const NOW = new Date(2026, 8, 28, 14, 30);
const iso = (h: number, m = 0) => new Date(2026, 8, 28, h, m).toISOString();

const row = (type: string, display: Record<string, unknown>, patch: Partial<RecordRow> = {}): RecordRow => ({
  id: `${type}-${JSON.stringify(display).length}-${Math.random()}`, canonical_entity_type: type, canonical_entity_id: 'x',
  subject_user_id: null, source_system: 'mock', source_url: null, source_timestamp: null, source_of_truth: 'Library room booking',
  freshness_status: 'live', updated_at: NOW.toISOString(), display, ...patch,
});

describe('rooms free now', () => {
  const rows = [
    row('study_space', { name: 'Room 214', book_url: 'https://rooms.example.edu/214' }),
    row('study_space', { name: 'Quiet room', quiet: true, book_url: 'http://insecure.example.edu' }),
    row('study_space', { name: 'Room 101' }),
    row('space_availability', { space: 'Room 214', starts_at: iso(14), ends_at: iso(16), status: 'free' }),
    row('space_availability', { space: 'Quiet room', starts_at: iso(17), ends_at: iso(18), status: 'free' }),
    row('space_availability', { space: 'Room 101', starts_at: iso(9), ends_at: iso(20), status: 'busy' }),
  ];

  it('says free now until when, free later from when, and booked until when', () => {
    expect(roomsNow(rows, NOW).map((r) => [r.space, r.status, r.at])).toEqual([
      ['Room 214', 'free_now', 16 * 60],
      ['Quiet room', 'free_later', 17 * 60],
      ['Room 101', 'busy_now', 20 * 60],
    ]);
  });

  it('keeps only https booking links', () => {
    const r = roomsNow(rows, NOW);
    expect(r.find((x) => x.space === 'Room 214')!.bookUrl).toBe('https://rooms.example.edu/214');
    expect(r.find((x) => x.space === 'Quiet room')!.bookUrl).toBeNull();
  });

  it('says a stale slot is stale — an hour-old "free" is not free', () => {
    const old = [rows[0], row('space_availability', { space: 'Room 214', starts_at: iso(14), ends_at: iso(16), status: 'free' },
      { updated_at: new Date(NOW.getTime() - 2 * 3600_000).toISOString() })];
    expect(roomsNow(old, NOW)[0].freshness).toBe('stale');
  });

  it('puts quiet rooms first within the same availability, and hides nothing', () => {
    const r = roomsNow([...rows, row('space_availability', { space: 'Quiet room', starts_at: iso(14), ends_at: iso(15), status: 'free' })], NOW);
    const q = quietFirst(r);
    expect(q).toHaveLength(r.length);
    expect(q[0].space).toBe('Quiet room');
  });
});

describe('what is not known is not claimed', () => {
  it('says nothing is listed, not "booked", for a room with no slots today', () => {
    const r = roomsNow([row('study_space', { name: 'Room 9' })], NOW);
    expect(r[0].status).toBe('unknown');
  });

  it('counts an overnight free slot that began yesterday and is still running', () => {
    const r = roomsNow([
      row('study_space', { name: '24h room' }),
      row('space_availability', { space: '24h room', starts_at: new Date(2026, 8, 27, 22).toISOString(), ends_at: iso(16), status: 'free' }),
    ], NOW);
    expect(r[0].status).toBe('free_now');
  });

  it('a room busy right now is booked — the control', () => {
    const r = roomsNow([row('study_space', { name: 'R' }), row('space_availability', { space: 'R', starts_at: iso(8), ends_at: iso(22), status: 'busy' })], NOW);
    expect(r[0].status).toBe('busy_now');
  });

  it('does not call a room booked on the strength of a busy slot that has ended', () => {
    const r = roomsNow([row('study_space', { name: 'R' }), row('space_availability', { space: 'R', starts_at: iso(9), ends_at: iso(10), status: 'busy' })], NOW);
    expect(r[0].status).toBe('unknown');
  });

  it('takes a busy room’s freshness from its busy slot, not from the room', () => {
    const r = roomsNow([
      row('study_space', { name: 'R' }),
      row('space_availability', { space: 'R', starts_at: iso(8), ends_at: iso(22), status: 'busy' },
        { updated_at: new Date(NOW.getTime() - 2 * 3600_000).toISOString() }),
    ], NOW);
    expect(r[0].freshness).toBe('stale');
  });

  it('keeps room slots out of the capped query Today and Notices share', () => {
    for (const t of ROOM_TYPES) expect(SHOWN_TYPES).not.toContain(t);
  });
});

/** Applies `eq`, `gt`, `lte`, `order` and `limit` over rows the test chooses, as PostgREST does. */
function fakeRooms(rows: RecordRow[]) {
  const pick = (r: RecordRow, col: string) => (col.startsWith('display->>') ? String(r.display[col.slice(10)] ?? '') : String((r as unknown as Record<string, unknown>)[col] ?? ''));
  const from = () => {
    let out = [...rows];
    const q = {
      select: () => q,
      is: () => q,
      eq: (c: string, v: string) => { out = out.filter((r) => pick(r, c) === v); return q; },
      gt: (c: string, v: string) => { out = out.filter((r) => pick(r, c) > v); return q; },
      lte: (c: string, v: string) => { out = out.filter((r) => pick(r, c) <= v); return q; },
      order: (c: string) => { out = [...out].sort((a, b) => pick(a, c).localeCompare(pick(b, c))); return q; },
      limit: async (n: number) => ({ data: out.slice(0, n), error: null }),
    };
    return q;
  };
  return { from } as never;
}

describe('loading rooms', () => {
  it('keeps today’s slots and every room however many finished slots there are', async () => {
    const past = Array.from({ length: 3000 }, (_, i) => row('space_availability', {
      space: 'Room 214', starts_at: new Date(2026, 8, 20, 8, i % 60).toISOString(), ends_at: new Date(2026, 8, 20, 9, i % 60).toISOString(), status: 'busy' }));
    const got = await loadRoomRecords(fakeRooms([
      ...past,
      row('study_space', { name: 'Room 214' }),
      row('space_availability', { space: 'Room 214', starts_at: iso(14), ends_at: iso(16), status: 'free' }),
    ]), NOW);
    expect(roomsNow(got, NOW)[0]).toMatchObject({ space: 'Room 214', status: 'free_now' });
    expect(got.filter((r) => r.canonical_entity_type === 'space_availability')).toHaveLength(1);
  });
});
