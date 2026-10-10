import { describe, expect, it } from 'vitest';
import { PlatformError } from '../gateway/errors.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';
import { MemoryOperationsWorkItemStore, OperationsWorkItemRuntime, type OpenWorkItemInput, type OperationsWorkItemStore } from './operations.ts';

const h = harness([]);
const at = (minute: number) => new Date(`2026-10-10T02:${String(minute).padStart(2, '0')}:00Z`);
const ctx = (tenant = TENANT_A, actor = 'operator-a') => h.context(tenant, actor);
const input = (id = 'work-1'): OpenWorkItemInput => ({
  id,
  kind: 'registration_readiness.referral',
  subject: { type: 'registration_readiness', id: 'evaluation-1' },
  sourceRef: 'event:registration-readiness-17',
  purpose: 'Resolve an authoritative-data mismatch before registration.',
  priority: 'high',
});
const setup = () => {
  let now = at(10);
  const runtime = new OperationsWorkItemRuntime(
    new MemoryOperationsWorkItemStore(),
    { now: () => now },
    (request) => request.actor.personId.startsWith('operator-'),
  );
  return { runtime, setTime: (next: Date) => { now = next; } };
};

describe('operations work items', () => {
  it('opens a tenant-scoped item with required provenance and an immutable origin entry', async () => {
    const { runtime } = setup();
    const item = await runtime.open(ctx(), input());
    expect(item).toMatchObject({ tenantId: TENANT_A, state: 'open', version: 1 });
    expect(item.history).toEqual([{ action: 'opened', actorId: 'operator-a', at: at(10).toISOString() }]);
    expect(Object.isFrozen(item)).toBe(true);
    expect(Object.isFrozen(item.history)).toBe(true);
  });

  it('uses store compare-and-swap so exactly one concurrent claimant wins', async () => {
    const { runtime, setTime } = setup();
    await runtime.open(ctx(), input('work-race'));
    setTime(at(11));
    const attempts = await Promise.allSettled([
      runtime.claim(ctx(TENANT_A, 'operator-a'), 'work-race', 1),
      runtime.claim(ctx(TENANT_A, 'operator-b'), 'work-race', 1),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect((attempts.find((attempt) => attempt.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'conflict' });
  });

  it('hides foreign-tenant items and denies an unauthorized same-tenant actor', async () => {
    const { runtime } = setup();
    await runtime.open(ctx(), input());
    await expect(runtime.load(ctx(TENANT_B, 'operator-b'), 'work-1')).rejects.toMatchObject({ code: 'not_found' });
    await expect(runtime.load(ctx(TENANT_A, 'student-a'), 'work-1')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(runtime.claim(ctx(TENANT_A, 'student-a'), 'work-1', 1)).rejects.toMatchObject({ code: 'forbidden' });
    expect((await runtime.load(ctx(), 'work-1')).state).toBe('open');
  });

  it('only the assignee resolves with a durable receipt; reopen preserves that receipt in immutable history', async () => {
    const { runtime, setTime } = setup();
    await runtime.open(ctx(), input());
    setTime(at(11));
    await runtime.claim(ctx(), 'work-1', 1);
    setTime(at(12));
    await expect(runtime.resolve(ctx(TENANT_A, 'operator-b'), 'work-1', 2, { code: 'reconciled', summary: 'Matched.', receiptRef: 'receipt-1' }))
      .rejects.toMatchObject({ code: 'forbidden' });
    await expect(runtime.resolve(ctx(), 'work-1', 2, { code: 'reconciled', summary: 'Matched.', receiptRef: ' ' }))
      .rejects.toMatchObject({ code: 'validation_failed' });
    const resolved = await runtime.resolve(ctx(), 'work-1', 2, { code: 'reconciled', summary: 'Matched the SIS record.', receiptRef: 'receipt-1' });
    setTime(at(13));
    await expect(runtime.reopen(ctx(), 'work-1', 3, ' ')).rejects.toMatchObject({ code: 'validation_failed' });
    const reopened = await runtime.reopen(ctx(), 'work-1', 3, 'The authoritative record changed.');
    expect(reopened).toMatchObject({ state: 'open', version: 4 });
    expect(reopened).not.toHaveProperty('assignedTo');
    expect(reopened).not.toHaveProperty('resolution');
    expect(reopened.history.map((entry) => entry.action)).toEqual(['opened', 'claimed', 'resolved', 'reopened']);
    expect(reopened.history[2]?.resolution).toEqual({ code: 'reconciled', summary: 'Matched the SIS record.', receiptRef: 'receipt-1' });
    expect(Object.isFrozen(reopened.history[2]?.resolution)).toBe(true);
    expect(resolved.resolution?.receiptRef).toBe('receipt-1');
  });

  it('refuses malformed provenance and backdated transitions as platform validation errors', async () => {
    const { runtime, setTime } = setup();
    await expect(runtime.open(ctx(), { ...input(), subject: undefined } as unknown as OpenWorkItemInput))
      .rejects.toBeInstanceOf(PlatformError);
    await runtime.open(ctx(), input());
    setTime(at(9));
    await expect(runtime.claim(ctx(), 'work-1', 1)).rejects.toMatchObject({ code: 'validation_failed' });
  });

  it('constructs an allowlisted open record and rejects poisoned adapter output before authorization', async () => {
    const { runtime } = setup();
    const made = await runtime.open(ctx(), { ...input(), assignedTo: 'forged', resolution: { code: 'forged' }, extra: 'forged' } as unknown as OpenWorkItemInput);
    expect(made).not.toHaveProperty('assignedTo');
    expect(made).not.toHaveProperty('resolution');
    expect(made).not.toHaveProperty('extra');

    let authorized = false;
    const poisoned = {
      get: async () => ({ ...made, tenantId: TENANT_B }),
      put: async () => true,
    } as OperationsWorkItemStore;
    const foreign = new OperationsWorkItemRuntime(poisoned, { now: () => at(11) }, () => { authorized = true; return true; });
    await expect(foreign.load(ctx(), made.id)).rejects.toMatchObject({ code: 'not_found' });
    expect(authorized).toBe(false);

    const malformed = {
      get: async () => ({ ...made, history: undefined }),
      put: async () => true,
    } as unknown as OperationsWorkItemStore;
    const corrupt = new OperationsWorkItemRuntime(malformed, { now: () => at(11) }, () => true);
    await expect(corrupt.load(ctx(), made.id)).rejects.toMatchObject({ code: 'internal' });
  });
});
