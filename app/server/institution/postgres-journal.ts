import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Receipt, UniversityIdentity } from '../../../packages/institution/src/index.ts';
import type { ActionJournalStore, SavedReview } from './journal.ts';
import type { IntelligenceAuditRecord } from './intelligence.ts';
import {
  assertJournalKey,
  journalOperation,
  openJournalRow,
  sealJournalRow,
} from './journal-crypto.ts';

export interface PostgresActionJournalOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  encryptionKey: Buffer;
}

type RpcResult<T> = { data: T; error: unknown };

function failed(error: unknown, operation: string): never {
  throw new Error(`The institutional action journal could not ${operation}.`, { cause: error });
}

/**
 * Multi-instance action durability over the production Postgres project.
 *
 * Only encrypted review bodies cross this repository boundary. Tenant, actor,
 * state, expiry and a one-way operation hash remain queryable so Postgres can
 * enforce identity scope and atomic duplicate prevention without seeing the
 * action's form fields.
 */
export class PostgresActionJournal implements ActionJournalStore {
  private client: SupabaseClient;
  private key: Buffer;

  constructor(options: PostgresActionJournalOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for the action journal.');
    }
    assertJournalKey(options.encryptionKey);
    this.key = options.encryptionKey;
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  private async rpc<T>(name: string, args: Record<string, unknown>, operation: string): Promise<T> {
    const result = await this.client.rpc(name, args) as RpcResult<T>;
    if (result.error) failed(result.error, operation);
    return result.data;
  }

  async healthy(): Promise<boolean> {
    try {
      return await this.rpc<boolean>('gateway_journal_health', {}, 'check readiness') === true;
    } catch {
      return false;
    }
  }

  async retentionHealthy(): Promise<boolean> {
    try {
      return await this.rpc<boolean>('gateway_retention_health', {}, 'check retention readiness') === true;
    } catch {
      return false;
    }
  }

  async save(row: SavedReview): Promise<void> {
    const saved = await this.rpc<boolean>('gateway_save_review', {
      want_review: row.review.id,
      want_tenant: row.identity.institutionId,
      want_actor: row.identity.userId,
      want_expires: row.review.expiresAt,
      want_operation: journalOperation(row),
      want_body: sealJournalRow(this.key, row),
    }, 'save a review');
    if (!saved) failed(null, 'save a review');
  }

  async get(id: string, identity: UniversityIdentity): Promise<SavedReview | null> {
    const rows = await this.rpc<Array<{ state: SavedReview['state']; body: string }>>('gateway_get_review', {
      want_review: id,
      want_tenant: identity.institutionId,
      want_actor: identity.userId,
    }, 'load a review');
    const row = rows?.[0];
    return row ? { ...openJournalRow<SavedReview>(this.key, row.body), state: row.state } : null;
  }

  async claim(id: string, identity: UniversityIdentity, now: number): Promise<boolean> {
    return await this.rpc<boolean>('gateway_claim_review', {
      want_review: id,
      want_tenant: identity.institutionId,
      want_actor: identity.userId,
      want_now: new Date(now).toISOString(),
    }, 'claim a review') === true;
  }

  async finish(
    row: SavedReview,
    state: 'completed' | 'pending' | 'refused' | 'uncertain',
    receipt?: Receipt,
  ): Promise<void> {
    const finished = { ...row, state, receipt } satisfies SavedReview;
    const saved = await this.rpc<boolean>('gateway_finish_review', {
      want_review: row.review.id,
      want_tenant: row.identity.institutionId,
      want_actor: row.identity.userId,
      want_state: state,
      want_body: sealJournalRow(this.key, finished),
    }, 'finish a review');
    if (!saved) failed(null, 'finish a review');
  }

  async audit(
    identity: UniversityIdentity,
    area: string,
    event: string,
    reviewId: string | null = null,
  ): Promise<void> {
    const saved = await this.rpc<boolean>('gateway_write_audit', {
      want_tenant: identity.institutionId,
      want_actor: identity.userId,
      want_area: area,
      want_event: event,
      want_review: reviewId,
    }, 'write an audit event');
    if (!saved) failed(null, 'write an audit event');
  }

  async purge(): Promise<void> {
    await this.rpc<number>('gateway_purge_journal', {}, 'apply retention');
  }

  async auditIntelligence(identity: UniversityIdentity, record: IntelligenceAuditRecord): Promise<void> {
    const saved = await this.rpc<boolean>('gateway_write_intelligence_audit', {
      want_tenant: identity.institutionId,
      want_actor: identity.userId,
      want_category: record.category,
      want_provider: record.provider,
      want_model: record.model,
      want_input_tokens: record.inputTokens,
      want_output_tokens: record.outputTokens,
      want_cost_cents: record.costCents,
      want_policy_decision: record.policyDecision,
      want_action: record.actionId ?? null,
      want_confirmation: record.confirmation ?? null,
    }, 'write an intelligence audit event');
    if (!saved) failed(null, 'write an intelligence audit event');
  }
}
