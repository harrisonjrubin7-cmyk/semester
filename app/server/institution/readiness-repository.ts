import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PlatformError } from '../../../packages/platform/src/index.ts';
import type {
  RegistrationReadinessEvaluationRecord,
  ReadinessWorkflowResult,
} from '../../../packages/institution/src/readiness-workflow.ts';

export interface PostgresRegistrationReadinessRepositoryOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
}

type RpcResult<T> = { data: T; error: unknown };

function failed(operation: string, cause: unknown): never {
  const database = cause as { code?: unknown; message?: unknown } | null;
  if (
    database?.code === 'SC409'
    && typeof database.message === 'string'
    && /idempotency key was reused/i.test(database.message)
  ) {
    throw new PlatformError('idempotency_key_reused', 'That Idempotency-Key was already used for a different request.');
  }
  if (database?.code === 'SC409') {
    throw new PlatformError('conflict', 'Registration readiness changed while this command was running.');
  }
  throw new Error(`Registration readiness could not ${operation}.`, { cause });
}

/**
 * Service-only durability for the registration-readiness aggregate.
 *
 * The save RPC owns the transaction: aggregate compare-and-swap, receipt,
 * reconciliation work, audit evidence and outbox append either all commit or
 * all roll back. The tenant is repeated outside the JSON envelope so SQL can
 * bind every lookup before it inspects the record body.
 */
export class PostgresRegistrationReadinessRepository {
  private client: SupabaseClient;

  constructor(options: PostgresRegistrationReadinessRepositoryOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for registration readiness.');
    }
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  private async rpc<T>(name: string, args: Record<string, unknown>, operation: string): Promise<T> {
    const result = await this.client.rpc(name, args) as RpcResult<T>;
    if (result.error) failed(operation, result.error);
    return result.data;
  }

  async save(result: ReadinessWorkflowResult): Promise<ReadinessWorkflowResult> {
    const command = result.record.commandLedger.find((entry) => entry.receipt.id === result.receipt.id);
    if (!command) throw new Error('Registration readiness result has no matching command ledger entry.');

    return await this.rpc<ReadinessWorkflowResult>('registration_readiness_save', {
      want_tenant: result.record.tenantId,
      want_expected_version: result.receipt.recordVersion - 1,
      want_fingerprint: command.fingerprint,
      want_result: result,
    }, 'save an evaluation');
  }

  async get(tenantId: string, evaluationId: string): Promise<RegistrationReadinessEvaluationRecord | null> {
    return await this.rpc<RegistrationReadinessEvaluationRecord | null>('registration_readiness_get', {
      want_tenant: tenantId,
      want_evaluation: evaluationId,
    }, 'load an evaluation');
  }
}
