import { describe, expect, it } from 'vitest';
import { makeEvent, MemoryOutbox, type Receipt, type UniversityIdentity } from '../../../packages/institution/src/index.ts';
import {
  CommandDelivery,
  MemoryCommandDeliveryStore,
  type CommandDeliveryAdapter,
  type CommandDeliveryStore,
} from './command-delivery.ts';

const identity: UniversityIdentity = {
  userId: 'student-1',
  institutionId: 'tenant-1',
  roles: ['student'],
};

const receipt = (id: string): Receipt => ({
  id,
  status: 'completed',
  message: 'Recorded by the synthetic provider.',
  recordedAt: '2026-10-12T02:00:00.000Z',
});

function command() {
  const outbox = new MemoryOutbox();
  outbox.append(makeEvent({
    eventId: '11111111-1111-4111-8111-111111111111',
    eventType: 'grade.passback_requested',
    producer: 'command-delivery-test',
    environment: 'demo',
    tenantId: identity.institutionId,
    actor: { id: identity.userId, type: 'user' },
    correlationId: 'correlation-12345678',
    idempotencyKey: 'provider-key-12345678',
    payload: { recordId: 'grade-1' },
  }));
  return {
    id: 'delivery-1',
    outbox: outbox.rows[0],
    identity,
    area: 'grades' as const,
  };
}

function journal() {
  const events: string[] = [];
  return {
    events,
    audit: async (_identity: UniversityIdentity, _area: string, event: string) => { events.push(event); },
  };
}

describe('dormant command delivery', () => {
  it('leases one queued command and records a provider receipt once', async () => {
    const store = new MemoryCommandDeliveryStore([command()]);
    const audit = journal();
    let submits = 0;
    const adapter: CommandDeliveryAdapter = {
      async submit(row, key) {
        submits += 1;
        expect(row.id).toBe(command().outbox.id);
        expect(key).toBe('provider-key-12345678');
        return receipt('provider-1');
      },
      async query() { throw new Error('query is only for an unknown outcome'); },
    };
    const worker = new CommandDelivery(store, audit, adapter, { now: () => 1_000 });

    await expect(worker.run('delivery-1')).resolves.toEqual({ outcome: 'delivered', receipt: receipt('provider-1') });
    await expect(worker.run('delivery-1')).resolves.toEqual({ outcome: 'idle' });
    expect(submits).toBe(1);
    expect(store.read('delivery-1')).toMatchObject({ state: 'delivered', receipt: receipt('provider-1') });
    expect(audit.events).toEqual(['command.delivery.claimed', 'command.delivery.delivered']);
  });

  it('reconciles an unknown provider outcome by query and never submits it again', async () => {
    const store = new MemoryCommandDeliveryStore([command()]);
    const audit = journal();
    let submits = 0;
    let queries = 0;
    const adapter: CommandDeliveryAdapter = {
      async submit() {
        submits += 1;
        throw new Error('connection ended after send');
      },
      async query(_row, key) {
        queries += 1;
        expect(key).toBe('provider-key-12345678');
        return queries === 1 ? null : receipt('provider-after-query');
      },
    };
    const worker = new CommandDelivery(store, audit, adapter, { now: () => 1_000 });

    await expect(worker.run('delivery-1')).resolves.toEqual({ outcome: 'uncertain' });
    await expect(worker.run('delivery-1')).resolves.toEqual({ outcome: 'uncertain' });
    await expect(worker.run('delivery-1')).resolves.toEqual({ outcome: 'delivered', receipt: receipt('provider-after-query') });
    expect(submits).toBe(1);
    expect(queries).toBe(2);
    expect(audit.events).toEqual([
      'command.delivery.claimed',
      'command.delivery.uncertain',
      'command.delivery.reconciling',
      'command.delivery.uncertain',
      'command.delivery.reconciling',
      'command.delivery.delivered',
    ]);
  });

  it('turns an expired submit lease into reconciliation instead of resubmission', async () => {
    const store = new MemoryCommandDeliveryStore([command()]);
    const first = store.claim('delivery-1', 1_000, 50);
    expect(first?.record.state).toBe('delivering');
    const audit = journal();
    let submits = 0;
    let queries = 0;
    const adapter: CommandDeliveryAdapter = {
      async submit() { submits += 1; return receipt('wrong'); },
      async query() { queries += 1; return receipt('found'); },
    };
    const worker = new CommandDelivery(store, audit, adapter, { now: () => 1_051 });

    await expect(worker.run('delivery-1')).resolves.toEqual({ outcome: 'delivered', receipt: receipt('found') });
    expect(submits).toBe(0);
    expect(queries).toBe(1);
  });

  it('fences a late worker so it cannot overwrite the reconciler that took over', async () => {
    const store = new MemoryCommandDeliveryStore([command()]);
    const audit = journal();
    let now = 1_000;
    let releaseSubmit!: (value: Receipt) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const delayed = new Promise<Receipt>((resolve) => { releaseSubmit = resolve; });
    const firstAdapter: CommandDeliveryAdapter = {
      submit: async () => { markStarted(); return delayed; },
      async query() { throw new Error('first worker must not reconcile'); },
    };
    const first = new CommandDelivery(store, audit, firstAdapter, { now: () => now, leaseMs: 50 });
    const firstRun = first.run('delivery-1');

    await started;
    now = 1_051;
    const successor = new CommandDelivery(store, audit, {
      async submit() { throw new Error('an expired submit must not run twice'); },
      async query() { return receipt('successor'); },
    }, { now: () => now, leaseMs: 50 });
    await expect(successor.run('delivery-1')).resolves.toEqual({ outcome: 'delivered', receipt: receipt('successor') });

    releaseSubmit(receipt('stale-worker'));
    await expect(firstRun).resolves.toEqual({ outcome: 'lost_lease' });
    expect(store.read('delivery-1')).toMatchObject({ state: 'delivered', receipt: receipt('successor') });
  });
  function hostileStore(delivery: ReturnType<typeof command>): CommandDeliveryStore {
    return {
      claim: () => ({
        id: delivery.id,
        fence: 1,
        revision: 1,
        record: {
          ...delivery,
          state: 'delivering',
          revision: 1,
          fence: 1,
          leaseUntil: 31_000,
        },
      }),
      settle: () => { throw new Error('an invalid claimed row must not settle'); },
    };
  }

  it('refuses a claimed command whose event belongs to another tenant before audit or delivery', async () => {
    const delivery = command();
    delivery.outbox = {
      ...delivery.outbox,
      event: { ...delivery.outbox.event, tenantId: 'tenant-2' },
    };
    const audit = journal();
    let adapterCalls = 0;
    const adapter: CommandDeliveryAdapter = {
      async submit() { adapterCalls += 1; return receipt('wrong'); },
      async query() { adapterCalls += 1; return receipt('wrong'); },
    };
    const worker = new CommandDelivery(hostileStore(delivery), audit, adapter, { now: () => 1_000 });

    await expect(worker.run(delivery.id)).rejects.toThrow('tenant');
    expect(adapterCalls).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it.each([undefined, '', '   '])(
    'refuses a claimed command with a missing or blank idempotency key (%s) before audit or delivery',
    async (idempotencyKey) => {
      const delivery = command();
      delivery.outbox = {
        ...delivery.outbox,
        event: { ...delivery.outbox.event, idempotencyKey },
      };
      const audit = journal();
      let adapterCalls = 0;
      const adapter: CommandDeliveryAdapter = {
        async submit() { adapterCalls += 1; return receipt('wrong'); },
        async query() { adapterCalls += 1; return receipt('wrong'); },
      };
      const worker = new CommandDelivery(hostileStore(delivery), audit, adapter, { now: () => 1_000 });

      await expect(worker.run(delivery.id)).rejects.toThrow('idempotency key');
      expect(adapterCalls).toBe(0);
      expect(audit.events).toEqual([]);
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'requires a positive finite lease duration (%s)',
    (leaseMs) => {
      const store = new MemoryCommandDeliveryStore([command()]);
      expect(() => new CommandDelivery(store, journal(), {
        async submit() { return receipt('unused'); },
        async query() { return null; },
      }, { now: () => 1_000, leaseMs })).toThrow('leaseMs');
    },
  );

});

