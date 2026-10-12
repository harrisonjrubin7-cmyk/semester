import {
  isRefusal,
  type OutboxRow,
  type Receipt,
  type UniversityArea,
  type UniversityIdentity,
} from '../../../packages/institution/src/index.ts';
import type { ActionJournalStore } from './journal.ts';

/** A command already held by the canonical institutional outbox. */
export interface QueuedCommandDelivery {
  id: string;
  outbox: OutboxRow;
  identity: UniversityIdentity;
  area: UniversityArea;
}

export type CommandDeliveryState = 'queued' | 'delivering' | 'uncertain' | 'reconciling' | 'delivered' | 'refused';

export interface CommandDeliveryRecord extends QueuedCommandDelivery {
  state: CommandDeliveryState;
  revision: number;
  fence: number;
  leaseUntil: number | null;
  receipt?: Receipt;
  lastError?: string;
}

export interface CommandDeliveryLease {
  id: string;
  fence: number;
  revision: number;
  record: CommandDeliveryRecord;
}

export type DeliverySettlement =
  | { state: 'queued'; error: string }
  | { state: 'delivered'; receipt: Receipt }
  | { state: 'refused'; error: string }
  | { state: 'uncertain'; error: string };

export interface CommandDeliveryStore {
  claim(id: string, now: number, leaseMs: number): CommandDeliveryLease | null | Promise<CommandDeliveryLease | null>;
  validate?(lease: CommandDeliveryLease, now: number): boolean | Promise<boolean>;
  settle(lease: CommandDeliveryLease, next: DeliverySettlement, now: number): boolean | Promise<boolean>;
}

/** `query` is read-only and is the only operation allowed after uncertainty. */
export interface CommandDeliveryAdapter {
  submit(row: OutboxRow, idempotencyKey: string, lease: CommandDeliveryLease): Promise<Receipt>;
  query(row: OutboxRow, idempotencyKey: string, lease: CommandDeliveryLease): Promise<Receipt | null>;
}

export type CommandDeliveryResult =
  | { outcome: 'idle' }
  | { outcome: 'lost_lease' }
  | { outcome: 'paused' }
  | { outcome: 'uncertain' }
  | { outcome: 'refused'; error: string }
  | { outcome: 'delivered'; receipt: Receipt };

const terminal = (state: CommandDeliveryState): boolean => state === 'delivered' || state === 'refused';
const copy = (record: CommandDeliveryRecord): CommandDeliveryRecord => ({ ...record });

export type CommandDeliveryPreflight =
  | { outcome: 'ready' }
  | { outcome: 'paused' }
  | { outcome: 'lost_lease' }
  | { outcome: 'refused'; error: string }
  | { outcome: 'uncertain'; error: string };

export interface CommandDeliveryOptions {
  now: () => number;
  leaseMs?: number;
  beforeSubmit?(lease: CommandDeliveryLease, idempotencyKey: string): CommandDeliveryPreflight | Promise<CommandDeliveryPreflight>;
}

function commandKey(command: QueuedCommandDelivery): string {
  if (command.outbox.event.tenantId !== command.identity.institutionId) {
    throw new Error('A command delivery event tenant must match its institutional identity.');
  }
  const key = command.outbox.event.idempotencyKey;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('A command delivery requires a nonblank outbox event idempotency key.');
  }
  return key;
}

/** In-memory reference for the pure model and synthetic adapters. */
export class MemoryCommandDeliveryStore implements CommandDeliveryStore {
  private readonly rows = new Map<string, CommandDeliveryRecord>();

  constructor(commands: QueuedCommandDelivery[] = []) {
    for (const command of commands) {
      commandKey(command);
      if (this.rows.has(command.id)) throw new Error(`duplicate command delivery ${command.id}`);
      this.rows.set(command.id, { ...command, state: 'queued', revision: 0, fence: 0, leaseUntil: null });
    }
  }

  read(id: string): CommandDeliveryRecord | undefined {
    const row = this.rows.get(id);
    return row ? copy(row) : undefined;
  }

  claim(id: string, now: number, leaseMs: number): CommandDeliveryLease | null {
    const row = this.rows.get(id);
    if (!row || terminal(row.state)) return null;
    if (row.leaseUntil !== null && row.leaseUntil > now) return null;

    // An expired submit may already have reached the provider. Takeover must
    // query by the original key, never submit again.
    if (row.state === 'delivering' || row.state === 'reconciling') {
      row.state = 'uncertain';
      row.revision += 1;
    }
    row.state = row.state === 'queued' ? 'delivering' : 'reconciling';
    row.fence += 1;
    row.revision += 1;
    row.leaseUntil = now + leaseMs;
    return { id, fence: row.fence, revision: row.revision, record: copy(row) };
  }

  validate(lease: CommandDeliveryLease, now: number): boolean {
    const row = this.rows.get(lease.id);
    return Boolean(
      row &&
      row.fence === lease.fence &&
      row.revision === lease.revision &&
      row.leaseUntil !== null &&
      row.leaseUntil > now &&
      (row.state === 'delivering' || row.state === 'reconciling'),
    );
  }

  settle(lease: CommandDeliveryLease, next: DeliverySettlement, now: number): boolean {
    const row = this.rows.get(lease.id);
    if (!row || row.fence !== lease.fence || row.revision !== lease.revision || row.leaseUntil === null || row.leaseUntil <= now || (row.state !== 'delivering' && row.state !== 'reconciling')) return false;
    row.state = next.state;
    row.revision += 1;
    row.leaseUntil = null;
    delete row.receipt;
    delete row.lastError;
    if (next.state === 'delivered') row.receipt = next.receipt;
    else row.lastError = next.error;
    return true;
  }
}

const errorText = (error: unknown): string => {
  if (!isRefusal(error)) return 'provider_outcome_unknown';
  return error.message === 'authority_revoked' || error.message === 'confirmation_expired'
    ? error.message
    : 'provider_refused';
};

export class CommandDelivery {
  private readonly leaseMs: number;
  private readonly store: CommandDeliveryStore;
  private readonly journal: Pick<ActionJournalStore, 'audit'>;
  private readonly adapter: CommandDeliveryAdapter;
  private readonly options: CommandDeliveryOptions;

  constructor(
    store: CommandDeliveryStore,
    journal: Pick<ActionJournalStore, 'audit'>,
    adapter: CommandDeliveryAdapter,
    options: CommandDeliveryOptions,
  ) {
    this.store = store;
    this.journal = journal;
    this.adapter = adapter;
    this.options = options;
    this.leaseMs = options.leaseMs ?? 30_000;
    if (!Number.isFinite(this.leaseMs) || this.leaseMs <= 0) throw new Error('leaseMs must be a positive finite number.');
  }

  async run(id: string): Promise<CommandDeliveryResult> {
    const lease = await this.store.claim(id, this.options.now(), this.leaseMs);
    if (!lease) return { outcome: 'idle' };
    const { record } = lease;
    const key = commandKey(record);
    await this.journal.audit(record.identity, record.area, record.state === 'delivering' ? 'command.delivery.claimed' : 'command.delivery.reconciling', record.id, record.outbox.event.correlationId);
    return record.state === 'reconciling' ? this.reconcile(lease, key) : this.submit(lease, key);
  }

  private async submit(lease: CommandDeliveryLease, key: string): Promise<CommandDeliveryResult> {
    let preflight: CommandDeliveryPreflight;
    try {
      preflight = await this.options.beforeSubmit?.(lease, key) ?? { outcome: 'ready' };
    } catch {
      preflight = { outcome: 'uncertain', error: 'provider_outcome_unknown' };
    }
    if (preflight.outcome === 'lost_lease') return { outcome: 'lost_lease' };
    if (preflight.outcome === 'paused') {
      return this.finish(lease, { state: 'queued', error: 'delivery_paused' }, 'command.delivery.paused');
    }
    if (preflight.outcome === 'refused') {
      return this.finish(lease, { state: 'refused', error: preflight.error }, 'command.delivery.refused');
    }
    if (preflight.outcome === 'uncertain') return this.unknown(lease, preflight.error);
    try {
      const receipt = await this.adapter.submit(lease.record.outbox, key, lease);
      return this.finish(lease, { state: 'delivered', receipt }, 'command.delivery.delivered');
    } catch (error) {
      const message = errorText(error);
      if (isRefusal(error)) return this.finish(lease, { state: 'refused', error: message }, 'command.delivery.refused');
      return this.unknown(lease, message);
    }
  }

  private async reconcile(lease: CommandDeliveryLease, key: string): Promise<CommandDeliveryResult> {
    try {
      const receipt = await this.adapter.query(lease.record.outbox, key, lease);
      if (receipt) return this.finish(lease, { state: 'delivered', receipt }, 'command.delivery.delivered');
      return this.unknown(lease, 'provider_outcome_unknown');
    } catch (error) {
      return this.unknown(lease, errorText(error));
    }
  }

  private async unknown(lease: CommandDeliveryLease, error: string): Promise<CommandDeliveryResult> {
    const result = await this.finish(lease, { state: 'uncertain', error }, 'command.delivery.uncertain');
    return result.outcome === 'lost_lease' ? result : { outcome: 'uncertain' };
  }

  private async finish(lease: CommandDeliveryLease, settlement: DeliverySettlement, event: string): Promise<CommandDeliveryResult> {
    if (!(await this.store.settle(lease, settlement, this.options.now()))) return { outcome: 'lost_lease' };
    await this.journal.audit(lease.record.identity, lease.record.area, event, lease.record.id, lease.record.outbox.event.correlationId);
    if (settlement.state === 'delivered') return { outcome: 'delivered', receipt: settlement.receipt };
    if (settlement.state === 'refused') return { outcome: 'refused', error: settlement.error };
    if (settlement.state === 'queued') return { outcome: 'paused' };
    return { outcome: 'uncertain' };
  }
}

