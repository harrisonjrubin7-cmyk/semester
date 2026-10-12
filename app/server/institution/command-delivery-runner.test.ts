import { describe, expect, it } from 'vitest';
import { makeEvent, MemoryOutbox, type Receipt, type UniversityIdentity } from '../../../packages/institution/src/index.ts';
import { MemoryCommandDeliveryStore } from './command-delivery.ts';
import {
  CommandDeliveryRunner,
  type CommandDeliveryAuthority,
  type CommandDeliveryRunnerJournal,
  type CommandProvider,
} from './command-delivery-runner.ts';

const identity: UniversityIdentity = { userId: 'registrar-1', institutionId: 'tenant-1', roles: ['registrar'] };
const providerReceipt = (id: string): Receipt => ({
  id,
  status: 'completed',
  message: 'provider detail that must not escape the runner',
  recordedAt: '2026-10-12T14:00:00.000Z',
});

function queued() {
  const outbox = new MemoryOutbox();
  outbox.append(makeEvent({
    eventId: '22222222-2222-4222-8222-222222222222',
    eventType: 'grade.passback_requested',
    producer: 'command-delivery-runner-test',
    environment: 'demo',
    tenantId: identity.institutionId,
    actor: { id: identity.userId, type: 'user' },
    correlationId: 'runner-correlation-1234',
    idempotencyKey: 'runner-provider-key-1234',
    payload: { recordId: 'grade-2' },
  }));
  return { id: 'runner-delivery-1', outbox: outbox.rows[0], identity, area: 'grades' as const };
}

function rig(options: {
  now?: number;
  authority?: CommandDeliveryAuthority;
  killed?: () => Promise<boolean>;
  provider?: Partial<CommandProvider>;
  journal?: Partial<CommandDeliveryRunnerJournal>;
} = {}) {
  let now = options.now ?? 1_000;
  const sequence: string[] = [];
  const store = new MemoryCommandDeliveryStore([queued()]);
  const journal: CommandDeliveryRunnerJournal = {
    async audit(_identity, _area, event) { sequence.push(event); },
    async recordDispatchIntent(intent) { sequence.push(`intent:${intent.fence}:${intent.revision}`); },
    ...options.journal,
  };
  const authority = options.authority ?? { async revalidate() { return { allowed: true } as const; } };
  const provider: CommandProvider = {
    async submit() { sequence.push('provider:submit'); return providerReceipt('provider-1'); },
    async query() { sequence.push('provider:query'); return providerReceipt('provider-1'); },
    ...options.provider,
  };
  const runner = new CommandDeliveryRunner({
    store,
    journal,
    provider,
    authority,
    killSwitchEngaged: options.killed ?? (async () => false),
    now: () => now,
    leaseMs: 50,
  });
  return { runner, store, sequence, setNow(value: number) { now = value; } };
}

describe('dormant command delivery runner', () => {
  it('persists a fenced dispatch intent before provider I/O and returns a sanitized receipt', async () => {
    const { runner, sequence } = rig();
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({
      state: 'delivered',
      receipt: { id: 'provider-1', status: 'completed', recordedAt: '2026-10-12T14:00:00.000Z' },
    });
    expect(sequence.indexOf('intent:1:1')).toBeLessThan(sequence.indexOf('provider:submit'));
    expect(sequence).not.toContain(expect.stringContaining('provider detail'));
  });

  it('lets only one duplicate worker reach the provider', async () => {
    let submits = 0;
    let release!: (receipt: Receipt) => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { started = resolve; });
    const response = new Promise<Receipt>((resolve) => { release = resolve; });
    const { runner } = rig({ provider: { async submit() { submits += 1; started(); return response; } } });
    const first = runner.run('runner-delivery-1');
    await gate;
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'idle' });
    release(providerReceipt('provider-1'));
    await expect(first).resolves.toMatchObject({ state: 'delivered' });
    expect(submits).toBe(1);
  });

  it('recovers response loss by query only, including after lease expiry', async () => {
    let submits = 0;
    let queries = 0;
    const { runner, store, setNow } = rig({ provider: {
      async submit() { submits += 1; throw new Error('socket closed after write: secret detail'); },
      async query() { queries += 1; return providerReceipt('recovered'); },
    } });
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'uncertain' });
    expect(store.read('runner-delivery-1')?.lastError).toBe('provider_outcome_unknown');
    setNow(1_051);
    await expect(runner.run('runner-delivery-1')).resolves.toMatchObject({ state: 'delivered' });
    expect({ submits, queries }).toEqual({ submits: 1, queries: 1 });
    expect(store.read('runner-delivery-1')?.lastError).toBeUndefined();
  });

  it('queries rather than resubmitting when a stale submit lease is reclaimed', async () => {
    let submits = 0;
    let queries = 0;
    const { runner, store } = rig({
      now: 1_051,
      provider: {
        async submit() { submits += 1; return providerReceipt('wrong'); },
        async query() { queries += 1; return providerReceipt('reclaimed'); },
      },
    });
    expect(store.claim('runner-delivery-1', 1_000, 50)?.record.state).toBe('delivering');
    await expect(runner.run('runner-delivery-1')).resolves.toMatchObject({ state: 'delivered' });
    expect({ submits, queries }).toEqual({ submits: 0, queries: 1 });
  });

  it('never calls the provider when the durable dispatch intent cannot be recorded', async () => {
    let providerCalls = 0;
    const store = new MemoryCommandDeliveryStore([queued()]);
    const runner = new CommandDeliveryRunner({
      store,
      journal: {
        async audit() {},
        async recordDispatchIntent() { throw new Error('journal unavailable'); },
      },
      provider: {
        async submit() { providerCalls += 1; return providerReceipt('wrong'); },
        async query() { providerCalls += 1; return null; },
      },
      authority: { async revalidate() { return { allowed: true }; } },
      killSwitchEngaged: async () => false,
      now: () => 1_000,
    });
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'uncertain' });
    expect(providerCalls).toBe(0);
    expect(store.read('runner-delivery-1')?.lastError).toBe('provider_outcome_unknown');
  });

  it('fences a worker whose dispatch-intent wait outlives its lease', async () => {
    let releaseIntent!: () => void;
    let intentStarted!: () => void;
    const started = new Promise<void>((resolve) => { intentStarted = resolve; });
    const blocked = new Promise<void>((resolve) => { releaseIntent = resolve; });
    let submits = 0;
    let queries = 0;
    const { runner, setNow } = rig({
      journal: { async recordDispatchIntent() { intentStarted(); await blocked; } },
      provider: {
        async submit() { submits += 1; return providerReceipt('stale'); },
        async query() { queries += 1; return providerReceipt('successor'); },
      },
    });
    const stale = runner.run('runner-delivery-1');
    await started;
    setNow(1_051);
    await expect(runner.run('runner-delivery-1')).resolves.toMatchObject({ state: 'delivered' });
    releaseIntent();
    await expect(stale).resolves.toEqual({ state: 'lost_lease' });
    expect({ submits, queries }).toEqual({ submits: 0, queries: 1 });
  });

  it('treats a provider-thrown pause-shaped error as uncertain and only queries next', async () => {
    let submits = 0;
    let queries = 0;
    const { runner } = rig({ provider: {
      async submit() {
        submits += 1;
        const error = new Error('response lost') as Error & { commandDeliveryPaused: boolean };
        error.commandDeliveryPaused = true;
        throw error;
      },
      async query() { queries += 1; return providerReceipt('queried'); },
    } });
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'uncertain' });
    await expect(runner.run('runner-delivery-1')).resolves.toMatchObject({ state: 'delivered' });
    expect({ submits, queries }).toEqual({ submits: 1, queries: 1 });
  });

  it('maps malformed runtime authority output to a stable fail-closed reason', async () => {
    const authority: CommandDeliveryAuthority = {
      async revalidate() {
        return { allowed: false, reason: 'private policy detail' } as never;
      },
    };
    const { runner, sequence } = rig({ authority });
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'refused', reason: 'authority_revoked' });
    expect(sequence.join(' ')).not.toContain('private policy detail');
    expect(sequence).not.toContain('provider:submit');
  });

  it.each([
    [{ allowed: false, reason: 'authority_revoked' } as const, 'authority_revoked'],
    [{ allowed: false, reason: 'confirmation_expired' } as const, 'confirmation_expired'],
  ])('revalidates current authority and refuses %s without provider I/O', async (decision, reason) => {
    const { runner, sequence } = rig({ authority: { async revalidate() { return decision; } } });
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'refused', reason });
    expect(sequence).not.toContain('provider:submit');
    expect(sequence.some((event) => event.startsWith('intent:'))).toBe(false);
  });

  it('pauses new writes under the kill switch but still permits query-only recovery', async () => {
    let killed = true;
    let submits = 0;
    let queries = 0;
    const { runner, setNow } = rig({
      killed: async () => killed,
      provider: {
        async submit() { submits += 1; throw new Error('response lost'); },
        async query() { queries += 1; return providerReceipt('queried'); },
      },
    });
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'paused' });
    killed = false;
    await expect(runner.run('runner-delivery-1')).resolves.toEqual({ state: 'uncertain' });
    killed = true;
    setNow(1_051);
    await expect(runner.run('runner-delivery-1')).resolves.toMatchObject({ state: 'delivered' });
    expect({ submits, queries }).toEqual({ submits: 1, queries: 1 });
  });
});
