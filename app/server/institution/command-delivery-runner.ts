import {
  type OutboxRow,
  type Receipt,
} from '../../../packages/institution/src/index.ts';
import {
  CommandDelivery,
  type CommandDeliveryLease,
  type CommandDeliveryStore,
  type QueuedCommandDelivery,
} from './command-delivery.ts';
import type { ActionJournalStore } from './journal.ts';

export type AuthorityRefusal = 'authority_revoked' | 'confirmation_expired';
export type AuthorityDecision = { allowed: true } | { allowed: false; reason: AuthorityRefusal };

export interface CommandDeliveryAuthority {
  revalidate(input: {
    command: QueuedCommandDelivery;
    mode: 'submit' | 'reconcile';
    now: number;
  }): AuthorityDecision | Promise<AuthorityDecision>;
}

export interface DispatchIntent {
  deliveryId: string;
  tenantId: string;
  idempotencyKey: string;
  fence: number;
  revision: number;
  recordedAt: number;
}

export interface CommandDeliveryRunnerJournal extends Pick<ActionJournalStore, 'audit'> {
  recordDispatchIntent(intent: DispatchIntent): void | Promise<void>;
}

export interface CommandProvider {
  submit(row: OutboxRow, idempotencyKey: string): Promise<Receipt>;
  query(row: OutboxRow, idempotencyKey: string): Promise<Receipt | null>;
}

export type StableCommandReceipt = Pick<Receipt, 'id' | 'status' | 'recordedAt'>;
export type CommandDeliveryRunnerResult =
  | { state: 'idle' | 'lost_lease' | 'paused' | 'uncertain' }
  | { state: 'refused'; reason: AuthorityRefusal | 'provider_refused' }
  | { state: 'delivered'; receipt: StableCommandReceipt };

export interface CommandDeliveryRunnerOptions {
  store: CommandDeliveryStore;
  journal: CommandDeliveryRunnerJournal;
  provider: CommandProvider;
  authority: CommandDeliveryAuthority;
  killSwitchEngaged(command: QueuedCommandDelivery): boolean | Promise<boolean>;
  now(): number;
  leaseMs?: number;
}

const stableReceipt = (receipt: Receipt): Receipt => {
  if (
    typeof receipt.id !== 'string' || receipt.id.trim().length === 0 ||
    (receipt.status !== 'completed' && receipt.status !== 'pending') ||
    typeof receipt.recordedAt !== 'string' || !Number.isFinite(Date.parse(receipt.recordedAt))
  ) {
    throw new Error('The provider returned an invalid receipt.');
  }
  return {
    id: receipt.id,
    status: receipt.status,
    recordedAt: receipt.recordedAt,
    message: 'Institutional provider receipt recorded.',
  };
};

const publicReceipt = ({ id, status, recordedAt }: Receipt): StableCommandReceipt => ({ id, status, recordedAt });

const authorityDecision = (value: unknown): AuthorityDecision => {
  if (typeof value === 'object' && value !== null && (value as { allowed?: unknown }).allowed === true) {
    return { allowed: true };
  }
  const reason = typeof value === 'object' && value !== null
    ? (value as { reason?: unknown }).reason
    : undefined;
  return {
    allowed: false,
    reason: reason === 'confirmation_expired' ? 'confirmation_expired' : 'authority_revoked',
  };
};

export class CommandDeliveryRunner {
  constructor(private readonly options: CommandDeliveryRunnerOptions) {}

  async run(id: string): Promise<CommandDeliveryRunnerResult> {
    let authorityRefusal: AuthorityRefusal | undefined;
    const guard = async (lease: CommandDeliveryLease, mode: 'submit' | 'reconcile'): Promise<AuthorityDecision> => {
      try {
        return authorityDecision(await this.options.authority.revalidate({
          command: lease.record,
          mode,
          now: this.options.now(),
        }));
      } catch {
        return { allowed: false, reason: 'authority_revoked' };
      }
    };

    const delivery = new CommandDelivery(
      this.options.store,
      this.options.journal,
      {
        submit: async (row, key) => stableReceipt(await this.options.provider.submit(row, key)),
        query: async (row, key, lease) => {
          const decision = await guard(lease, 'reconcile');
          if (!decision.allowed) throw new Error('Reconciliation authority is unavailable.');
          const receipt = await this.options.provider.query(row, key);
          return receipt ? stableReceipt(receipt) : null;
        },
      },
      {
        now: () => this.options.now(),
        leaseMs: this.options.leaseMs,
        beforeSubmit: async (lease, key) => {
          if (await this.options.killSwitchEngaged(lease.record)) return { outcome: 'paused' };
          let decision = await guard(lease, 'submit');
          if (!decision.allowed) {
            authorityRefusal = decision.reason;
            return { outcome: 'refused', error: decision.reason };
          }
          try {
            await this.options.journal.recordDispatchIntent({
              deliveryId: lease.id,
              tenantId: lease.record.identity.institutionId,
              idempotencyKey: key,
              fence: lease.fence,
              revision: lease.revision,
              recordedAt: this.options.now(),
            });
          } catch {
            return { outcome: 'uncertain', error: 'provider_outcome_unknown' };
          }
          decision = await guard(lease, 'submit');
          if (!decision.allowed) {
            authorityRefusal = decision.reason;
            return { outcome: 'refused', error: decision.reason };
          }
          if (await this.options.killSwitchEngaged(lease.record)) return { outcome: 'paused' };
          if (!this.options.store.validate || !(await this.options.store.validate(lease, this.options.now()))) {
            return { outcome: 'lost_lease' };
          }
          return { outcome: 'ready' };
        },
      },
    );

    const result = await delivery.run(id);
    if (result.outcome === 'delivered') return { state: 'delivered', receipt: publicReceipt(result.receipt) };
    if (result.outcome === 'refused') return { state: 'refused', reason: authorityRefusal ?? 'provider_refused' };
    return { state: result.outcome };
  }
}
