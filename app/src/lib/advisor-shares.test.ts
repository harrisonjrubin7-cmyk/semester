import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newMeeting, sharePayload } from './advisor-meeting';

/**
 * Phase G's share adaptor against a mocked client: expiry, the state of a
 * share, what is refused before anything is sent, the one message every
 * failed lookup gets, and the calls revocation and reading make. The policy
 * itself — who may share with whom, who may read — is
 * `supabase/advisor.check.sql`.
 */

const calls: { what: string; args: unknown }[] = [];
let reply: { data: unknown; error: { message: string } | null } = { data: null, error: null };

const chain = (table: string) => {
  const q = {
    select: (cols: string) => (calls.push({ what: `select ${table}`, args: cols }), q),
    order: () => Promise.resolve(reply),
    update: (row: unknown) => (calls.push({ what: `update ${table}`, args: row }), q),
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

const shares = await import('./advisor-shares');
const NOW = Date.parse('2026-09-27T12:00:00Z');
const payload = () => sharePayload({ ...newMeeting(1), agenda: [{ id: 'a', text: 'Spring courses' }] }, { sharedAs: 'Sam', scenario: null, courses: [] });

beforeEach(() => {
  calls.length = 0;
  reply = { data: null, error: null };
});

describe('expiry and state', () => {
  it('reads a share as active, expired or revoked', () => {
    expect(shares.shareState({ expires_at: '2026-10-01T00:00:00Z', revoked_at: null }, NOW)).toBe('active');
    expect(shares.shareState({ expires_at: '2026-09-27T11:59:59Z', revoked_at: null }, NOW)).toBe('expired');
    expect(shares.shareState({ expires_at: '2026-10-01T00:00:00Z', revoked_at: '2026-09-26T00:00:00Z' }, NOW)).toBe('revoked');
  });

  it('always sets an expiry, never past 120 days', () => {
    expect(shares.expiryFrom(30, NOW)).toBe('2026-10-27T12:00:00.000Z');
    expect(() => shares.expiryFrom(121, NOW)).toThrow();
    expect(() => shares.expiryFrom(0, NOW)).toThrow();
    expect(shares.EXPIRY_CHOICES.every((c) => c.days <= shares.MAX_EXPIRY_DAYS)).toBe(true);
  });
});

describe('sharing', () => {
  it('sends the previewed payload, the title and an expiry, through the RPC only', async () => {
    reply = { data: 'share-1', error: null };
    expect(await shares.shareWithAdvisor(' advisor@school.edu ', 'Spring planning', payload(), 30, NOW)).toBe('share-1');
    expect(calls).toEqual([
      {
        what: 'rpc share_with_advisor',
        args: { advisor_email: 'advisor@school.edu', share_title: 'Spring planning', share_payload: payload(), share_expires: '2026-10-27T12:00:00.000Z' },
      },
    ]);
  });

  it('refuses before sending: a bad address, an empty meeting, an oversized one', async () => {
    await expect(shares.shareWithAdvisor('advisor', 'x', payload(), 30, NOW)).rejects.toThrow('school email');
    const empty = sharePayload(newMeeting(1), { sharedAs: 'Sam', scenario: null, courses: [] });
    await expect(shares.shareWithAdvisor('a@b.edu', 'x', empty, 30, NOW)).rejects.toThrow('Add an agenda item');
    const huge = { ...payload(), agenda: [Array.from({ length: 40_000 }, () => 'x').join('')] };
    await expect(shares.shareWithAdvisor('a@b.edu', 'x', huge, 30, NOW)).rejects.toThrow('too long');
    expect(calls).toEqual([]);
  });

  it('says one thing for every failed lookup', async () => {
    reply = { data: null, error: { message: 'no advisor at your school uses that address in Semester' } };
    await expect(shares.shareWithAdvisor('a@b.edu', 'x', payload(), 30, NOW)).rejects.toThrow(shares.NO_ADVISOR);
  });
});

describe('managing and reading', () => {
  it('lists the student’s shares with their read log, newest read first', async () => {
    reply = {
      data: [
        { id: 's1', title: 'A', created_at: 'c', expires_at: 'e', revoked_at: null, advisor_share_events: [{ read_at: '2026-09-20' }, { read_at: '2026-09-25' }] },
        { id: 's2', title: 'B', created_at: 'c', expires_at: 'e', revoked_at: null, advisor_share_events: [] },
      ],
      error: null,
    };
    const got = await shares.myShares();
    expect(got.shares).toEqual([
      { id: 's1', title: 'A', created_at: 'c', expires_at: 'e', revoked_at: null },
      { id: 's2', title: 'B', created_at: 'c', expires_at: 'e', revoked_at: null },
    ]);
    expect(got.events).toEqual([{ share_id: 's1', read_at: '2026-09-25' }, { share_id: 's1', read_at: '2026-09-20' }]);
  });

  it('revokes by setting revoked_at on that share only', async () => {
    await shares.revokeShare('s1', NOW);
    expect(calls).toEqual([
      { what: 'update advisor_shares', args: { revoked_at: '2026-09-27T12:00:00.000Z' } },
      { what: 'eq id', args: 's1' },
    ]);
  });

  it('tells an advisor plainly when a share is gone', async () => {
    reply = { data: null, error: { message: 'not shared with you' } };
    await expect(shares.openShare('s1')).rejects.toThrow('expired or was revoked');
    reply = { data: [], error: null };
    await expect(shares.openShare('s1')).rejects.toThrow('expired or was revoked');
  });

  it('refuses a share whose snapshot is not one the app made, rather than crashing the view', async () => {
    reply = { data: [{ title: 'Odd', payload: {}, expires_at: '2026-10-20T00:00:00Z' }], error: null };
    await expect(shares.openShare('s1')).rejects.toThrow('could not be read');
    const good = { version: 1, sharedAs: 'Riley', title: 'Spring', date: null, agenda: ['Minor'], questions: [], scenario: null, courses: [], followUps: [] };
    reply = { data: [{ title: 'Spring', payload: good, expires_at: '2026-10-20T00:00:00Z' }], error: null };
    await expect(shares.openShare('s1')).resolves.toMatchObject({ payload: good });
  });
});
