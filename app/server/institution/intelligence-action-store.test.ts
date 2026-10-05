import { describe, expect, it } from 'vitest';
import { MemoryIntelligenceActionStore, PostgresIntelligenceActionStore } from './intelligence-action-store.ts';
import type { GovernedAction } from './intelligence.ts';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';

const identity: UniversityIdentity = { institutionId: 'school-a', userId: 'student-a', roles: ['student'] };
const action: GovernedAction = {
  id: '10000000-0000-4000-8000-000000000010',
  tenantId: identity.institutionId,
  personId: identity.userId,
  label: 'Save plan',
  effect: 'Private plan content',
  target: 'plan:7',
  class: 'internal-write',
  reversible: true,
  evidenceIds: ['evidence-1'],
  preparedAt: '2026-09-24T18:00:00.000Z',
  expiresAt: '2026-09-24T18:05:00.000Z',
};

describe('durable intelligence actions', () => {
  it('claims a local action once and only for its owner', () => {
    const store = new MemoryIntelligenceActionStore();
    store.save(action);
    expect(store.claim(action.id, { ...identity, userId: 'student-b' }, Date.parse('2026-09-24T18:01:00Z'))).toBeNull();
    expect(store.claim(action.id, identity, Date.parse('2026-09-24T18:01:00Z'))).toEqual(action);
    expect(store.claim(action.id, identity, Date.parse('2026-09-24T18:01:01Z'))).toBeNull();
  });

  it('encrypts the action before sending it to shared storage', async () => {
    let saved = '';
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === 'gateway_save_intelligence_action') {
          saved = JSON.stringify(args);
          return { data: true, error: null };
        }
        return { data: [], error: null };
      },
    };
    const store = new PostgresIntelligenceActionStore({ client: client as never, encryptionKey: Buffer.alloc(32, 4) });
    await store.save(action);
    expect(saved).not.toContain('Private plan content');
    expect(saved).toContain(action.id);
  });

  it('round-trips a claimed encrypted action and fails closed on RPC errors', async () => {
    let body = '';
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === 'gateway_save_intelligence_action') {
          body = String(args.want_body);
          return { data: true, error: null };
        }
        return { data: [{ body }], error: null };
      },
    };
    const store = new PostgresIntelligenceActionStore({ client: client as never, encryptionKey: Buffer.alloc(32, 4) });
    await store.save(action);
    expect(await store.claim(action.id, identity, Date.parse('2026-09-24T18:01:00Z'))).toEqual(action);

    const broken = new PostgresIntelligenceActionStore({
      client: { rpc: async () => ({ data: null, error: new Error('offline') }) } as never,
      encryptionKey: Buffer.alloc(32, 4),
    });
    await expect(broken.claim(action.id, identity, Date.now())).rejects.toThrow(/could not be claimed/);
  });
});
