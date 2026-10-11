import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The check-in adaptor against a mocked client: what is refused before
 * anything is sent, that a retry resends the same key, and the one message a
 * refused share gets. Who may write and read is
 * `supabase/advisor-checkins.check.sql`.
 */

const calls: { what: string; args: unknown }[] = [];
let reply: { data: unknown; error: { message: string } | null } = { data: null, error: null };

const chain = (table: string) => {
  const q = {
    select: (cols: string) => (calls.push({ what: `select ${table}`, args: cols }), q),
    order: () => Promise.resolve(reply),
    delete: () => (calls.push({ what: `delete ${table}`, args: null }), q),
    eq: (col: string, v: unknown) => (calls.push({ what: `eq ${col}`, args: v }), Promise.resolve(reply)),
  };
  return q;
};

vi.mock('./cloud', () => ({
  cloud: async () => ({
    rpc: async (name: string, args: unknown) => (calls.push({ what: `rpc ${name}`, args }), reply),
    from: chain,
  }),
}));

const c = await import('./advisor-checkins');

beforeEach(() => {
  calls.length = 0;
  reply = { data: null, error: null };
});

describe('reading next steps', () => {
  it('takes one per line, trimmed, blanks dropped, in order', () => {
    expect(c.readSteps('  Email the registrar \n\n Draft a plan B\n   ')).toEqual(['Email the registrar', 'Draft a plan B']);
    expect(c.readSteps('')).toEqual([]);
  });
});

describe('recording a check-in', () => {
  it('sends the trimmed note, the steps and the draft key through the RPC only', async () => {
    reply = { data: 'ci-1', error: null };
    expect(await c.recordCheckIn('share-1', '  Talked through spring ', ['Email the registrar'], 'key-1')).toBe('ci-1');
    expect(calls).toEqual([
      {
        what: 'rpc record_advisor_check_in',
        args: { want_share: 'share-1', check_in_note: 'Talked through spring', check_in_steps: ['Email the registrar'], check_in_key: 'key-1' },
      },
    ]);
  });

  it('resends the same key on a retry, so the server can answer with the first check-in', async () => {
    reply = { data: null, error: { message: 'Failed to fetch' } };
    await expect(c.recordCheckIn('share-1', 'Note', [], 'key-1')).rejects.toThrow('Failed to fetch');
    reply = { data: 'ci-1', error: null };
    await c.recordCheckIn('share-1', 'Note', [], 'key-1');
    expect(calls.map((x) => (x.args as { check_in_key: string }).check_in_key)).toEqual(['key-1', 'key-1']);
  });

  it('refuses before sending: no note, six steps, a step too long, a note too long', async () => {
    await expect(c.recordCheckIn('s', '  ', [], 'k')).rejects.toThrow('Write what you talked about');
    await expect(c.recordCheckIn('s', 'x', ['1', '2', '3', '4', '5', '6'], 'k')).rejects.toThrow('at most 5');
    await expect(c.recordCheckIn('s', 'x', ['s'.repeat(201)], 'k')).rejects.toThrow('under 200');
    await expect(c.recordCheckIn('s', 'x'.repeat(2001), [], 'k')).rejects.toThrow('under 2000');
    expect(calls).toEqual([]);
  });

  it('says the share is closed, whatever the server said about why', async () => {
    reply = { data: null, error: { message: 'not shared with you' } };
    await expect(c.recordCheckIn('s', 'x', [], 'k')).rejects.toThrow('expired or was revoked');
    await expect(c.checkInsOn('s')).rejects.toThrow('expired or was revoked');
  });
});

describe('the student’s side', () => {
  it('reads check-ins from the table and deletes one by id', async () => {
    reply = { data: [{ id: 'ci-1', share_id: 's', note: 'n', next_steps: [], created_at: 'c' }], error: null };
    expect(await c.myCheckIns()).toHaveLength(1);
    await c.deleteCheckIn('ci-1');
    expect(calls).toEqual([
      { what: 'select advisor_check_ins', args: 'id, share_id, note, next_steps, created_at' },
      { what: 'delete advisor_check_ins', args: null },
      { what: 'eq id', args: 'ci-1' },
    ]);
  });
});
