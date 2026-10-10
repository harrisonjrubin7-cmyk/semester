import { describe, expect, it } from 'vitest';
import { PlatformError } from '../gateway/errors.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';
import { claimWorkItem, openWorkItem, reopenWorkItem, resolveWorkItem } from './operations.ts';

const h = harness([]);
const at = (minute: number) => new Date(`2026-10-10T02:${String(minute).padStart(2, '0')}:00Z`);
const ctx = (tenant = TENANT_A, actor = 'operator-a') => h.context(tenant, actor);
const opened = () => openWorkItem(ctx(), {
  id: 'work-1',
  kind: 'registration_readiness.referral',
  subject: { type: 'registration_readiness', id: 'evaluation-1' },
  sourceRef: 'event:registration-readiness-17',
  purpose: 'Resolve an authoritative-data mismatch before registration.',
  priority: 'high',
}, at(10));

describe('operations work items', () => {
  it('opens a tenant-scoped item with an append-only origin entry', () => {
    const item = opened();
    expect(item).toMatchObject({ tenantId: TENANT_A, state: 'open', version: 1 });
    expect(item.history).toEqual([{ action: 'opened', actorId: 'operator-a', at: at(10).toISOString() }]);
  });

  it('one operator claims an item at the version they read', () => {
    const claimed = claimWorkItem(ctx(), opened(), 1, at(11));
    expect(claimed).toMatchObject({ state: 'claimed', assignedTo: 'operator-a', version: 2 });
    expect(() => claimWorkItem(ctx(TENANT_A, 'operator-b'), claimed, 1, at(12))).toThrowError(expect.objectContaining({ code: 'conflict' }));
  });

  it('hides foreign-tenant items and only the assignee may resolve', () => {
    const claimed = claimWorkItem(ctx(), opened(), 1, at(11));
    expect(() => claimWorkItem(ctx(TENANT_B, 'operator-b'), claimed, 2, at(12))).toThrowError(expect.objectContaining({ code: 'not_found' }));
    expect(() => resolveWorkItem(ctx(TENANT_A, 'operator-b'), claimed, 2, { code: 'reconciled', summary: 'Matched the SIS record.', receiptRef: 'receipt-1' }, at(12)))
      .toThrowError(expect.objectContaining({ code: 'forbidden' }));
  });

  it('requires a durable resolution receipt, then can reopen with a reason without erasing history', () => {
    const claimed = claimWorkItem(ctx(), opened(), 1, at(11));
    expect(() => resolveWorkItem(ctx(), claimed, 2, { code: 'reconciled', summary: 'Matched.', receiptRef: ' ' }, at(12)))
      .toThrowError(expect.objectContaining({ code: 'validation_failed' }));
    const resolved = resolveWorkItem(ctx(), claimed, 2, { code: 'reconciled', summary: 'Matched the SIS record.', receiptRef: 'receipt-1' }, at(12));
    expect(resolved).toMatchObject({ state: 'resolved', version: 3, resolution: { receiptRef: 'receipt-1' } });
    expect(() => reopenWorkItem(ctx(), resolved, 3, ' ', at(13))).toThrowError(expect.objectContaining({ code: 'validation_failed' }));
    const reopened = reopenWorkItem(ctx(), resolved, 3, 'The authoritative record changed.', at(13));
    expect(reopened).toMatchObject({ state: 'open', version: 4 });
    expect(reopened).not.toHaveProperty('assignedTo');
    expect(reopened).not.toHaveProperty('resolution');
    expect(reopened.history.map((entry) => entry.action)).toEqual(['opened', 'claimed', 'resolved', 'reopened']);
  });

  it('refuses incomplete provenance instead of opening an untraceable item', () => {
    expect(() => openWorkItem(ctx(), {
      id: 'work-2', kind: 'support.referral', subject: { type: 'student', id: 'student-1' }, sourceRef: '', purpose: 'Help', priority: 'normal',
    }, at(10))).toThrow(PlatformError);
  });
});
