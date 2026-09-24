import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedReview } from './journal.ts';
import { PostgresActionJournal } from './postgres-journal.ts';

const key = Buffer.alloc(32, 9);
const row: SavedReview = {
  review: {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'Drop a course',
    details: [{ label: 'Reason', value: 'Private medical context' }],
    expiresAt: '2026-09-24T19:00:00.000Z',
  },
  input: {
    area: 'registration',
    recordId: 'course-1',
    version: '4',
    actionId: 'drop',
    fields: { reason: 'Private medical context' },
  },
  identity: { institutionId: 'vanderbilt', userId: 'student-1', roles: ['student'] },
  state: 'ready',
};

function fakeClient() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let body = '';
  let state: SavedReview['state'] = 'ready';
  let failHealth = false;
  const client = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      if (name === 'gateway_journal_health') {
        return failHealth ? { data: null, error: new Error('offline') } : { data: true, error: null };
      }
      if (name === 'gateway_save_review') {
        body = String(args.want_body);
        return { data: true, error: null };
      }
      if (name === 'gateway_get_review') return { data: body ? [{ state, body }] : [], error: null };
      if (name === 'gateway_claim_review') {
        state = 'processing';
        return { data: true, error: null };
      }
      if (name === 'gateway_finish_review') {
        state = args.want_state as SavedReview['state'];
        body = String(args.want_body);
        return { data: true, error: null };
      }
      if (name === 'gateway_write_audit') return { data: true, error: null };
      if (name === 'gateway_write_intelligence_audit') return { data: true, error: null };
      if (name === 'gateway_purge_journal') return { data: 0, error: null };
      return { data: null, error: new Error(`unexpected ${name}`) };
    },
  } as unknown as SupabaseClient;
  return { client, calls, failHealth: () => { failHealth = true; } };
}

describe('Postgres action journal', () => {
  it('keeps action fields encrypted while round-tripping state through service RPCs', async () => {
    const fake = fakeClient();
    const journal = new PostgresActionJournal({ client: fake.client, encryptionKey: key });
    await journal.save(row);

    const wire = JSON.stringify(fake.calls);
    expect(wire).not.toContain('Private medical context');
    expect(fake.calls[0]).toMatchObject({
      name: 'gateway_save_review',
      args: {
        want_tenant: 'vanderbilt',
        want_actor: 'student-1',
        want_operation: expect.stringMatching(/^[0-9a-f]{64}$/),
      },
    });
    expect(await journal.get(row.review.id, row.identity)).toEqual(row);

    expect(await journal.claim(row.review.id, row.identity, Date.parse('2026-09-24T18:55:00Z'))).toBe(true);
    await journal.finish(row, 'completed', {
      id: 'receipt-1',
      status: 'completed',
      message: 'Recorded',
      recordedAt: '2026-09-24T18:56:00Z',
    });
    expect(await journal.get(row.review.id, row.identity)).toMatchObject({
      state: 'completed',
      receipt: { id: 'receipt-1', status: 'completed' },
    });
  });

  it('fails readiness closed when the shared database cannot be written', async () => {
    const fake = fakeClient();
    const journal = new PostgresActionJournal({ client: fake.client, encryptionKey: key });
    expect(await journal.healthy()).toBe(true);
    fake.failHealth();
    expect(await journal.healthy()).toBe(false);
  });

  it('writes only metadata for governed intelligence audits', async () => {
    const fake = fakeClient();
    const journal = new PostgresActionJournal({ client: fake.client, encryptionKey: key });
    await journal.auditIntelligence(row.identity, {
      category: 'study', provider: 'openai', model: 'gpt-5-mini',
      inputTokens: 100, outputTokens: 20, costCents: 1.25,
      policyDecision: 'sandbox:explain',
    });
    expect(fake.calls.at(-1)).toMatchObject({
      name: 'gateway_write_intelligence_audit',
      args: { want_tenant: 'vanderbilt', want_actor: 'student-1', want_input_tokens: 100 },
    });
    expect(JSON.stringify(fake.calls)).not.toContain('Private medical context');
  });

  it('requires a server client and a 256-bit encryption key', () => {
    expect(() => new PostgresActionJournal({ encryptionKey: key })).toThrow(/service client/i);
    expect(() => new PostgresActionJournal({ client: fakeClient().client, encryptionKey: Buffer.alloc(16) })).toThrow(/32-byte/i);
  });
});
