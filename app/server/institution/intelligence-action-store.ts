import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import type { GovernedAction } from './intelligence.ts';
import { assertJournalKey, openJournalRow, sealJournalRow } from './journal-crypto.ts';

export interface IntelligenceActionStore {
  save(action: GovernedAction): void | Promise<void>;
  claim(id: string, identity: UniversityIdentity, now: number): GovernedAction | null | Promise<GovernedAction | null>;
}

export class MemoryIntelligenceActionStore implements IntelligenceActionStore {
  private actions = new Map<string, GovernedAction>();

  save(action: GovernedAction): void {
    this.actions.set(`${action.tenantId}:${action.personId}:${action.id}`, action);
  }

  claim(id: string, identity: UniversityIdentity, now: number): GovernedAction | null {
    const key = `${identity.institutionId}:${identity.userId}:${id}`;
    const action = this.actions.get(key);
    if (!action || Date.parse(action.expiresAt) <= now) return null;
    this.actions.delete(key);
    return action;
  }
}

export interface PostgresIntelligenceActionStoreOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  encryptionKey: Buffer;
}

/** Durable, encrypted, single-use storage for AI-proposed actions. */
export class PostgresIntelligenceActionStore implements IntelligenceActionStore {
  private client: SupabaseClient;
  private key: Buffer;

  constructor(options: PostgresIntelligenceActionStoreOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for intelligence actions.');
    }
    assertJournalKey(options.encryptionKey);
    this.key = options.encryptionKey;
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async save(action: GovernedAction): Promise<void> {
    const { data, error } = await this.client.rpc('gateway_save_intelligence_action', {
      want_action: action.id,
      want_tenant: action.tenantId,
      want_actor: action.personId,
      want_expires: action.expiresAt,
      want_body: sealJournalRow(this.key, action),
    }) as { data: boolean; error: unknown };
    if (error || data !== true) throw new Error('The intelligence action could not be saved.');
  }

  async claim(id: string, identity: UniversityIdentity, now: number): Promise<GovernedAction | null> {
    const { data, error } = await this.client.rpc('gateway_claim_intelligence_action', {
      want_action: id,
      want_tenant: identity.institutionId,
      want_actor: identity.userId,
      want_now: new Date(now).toISOString(),
    }) as { data: Array<{ body: string }> | null; error: unknown };
    if (error) throw new Error('The intelligence action could not be claimed.');
    const body = data?.[0]?.body;
    return body ? openJournalRow<GovernedAction>(this.key, body) : null;
  }
}
