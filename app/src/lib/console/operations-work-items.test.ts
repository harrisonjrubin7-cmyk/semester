import { describe, expect, it } from 'vitest';
import {
  readOperationsWorkItemDetailEnvelope,
  readOperationsWorkItemListEnvelope,
} from './client';

const item = (patch: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: 'vu',
  kind: 'registration_readiness.referral',
  subject: { type: 'registration_readiness', id: 'evaluation-1' },
  source_ref: 'registration-readiness-task:task-1',
  purpose: 'Resolve the authoritative mismatch.',
  priority: 'high',
  state: 'claimed',
  version: 2,
  created_at: '2026-10-10T01:00:00Z',
  updated_at: '2026-10-10T02:00:00Z',
  assigned_to_me: true,
  allowed_actions: ['resolve'],
  history: [{ action: 'opened', version: 1, occurred_at: '2026-10-10T01:00:00Z', by_me: false }],
  ...patch,
});

const envelope = (data: unknown, patch: Record<string, unknown> = {}) => ({
  data,
  freshness: { status: 'current', generated_at: '2026-10-10T02:01:00Z' },
  authority: 'authoritative',
  warnings: [],
  request_id: '22222222-2222-4222-8222-222222222222',
  ...patch,
});

describe('operations work-item client contract', () => {
  it('maps authoritative list and detail envelopes without inventing fields', () => {
    const list = readOperationsWorkItemListEnvelope(envelope([item({ history: undefined })]));
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      tenantId: 'vu',
      state: 'claimed',
      assignedToMe: true,
      allowedActions: ['resolve'],
    });
    expect(list.data[0]?.history).toEqual([]);

    const detail = readOperationsWorkItemDetailEnvelope(envelope(item({
      state: 'resolved',
      version: 3,
      resolution: { code: 'reconciled', summary: 'Matched.', receipt_ref: 'receipt-3' },
      allowed_actions: ['reopen'],
    })));
    expect(detail.data.resolution).toEqual({ code: 'reconciled', summary: 'Matched.', receiptRef: 'receipt-3' });
  });

  it('fails closed for non-authoritative, stale, or malformed responses', () => {
    expect(() => readOperationsWorkItemListEnvelope(envelope([], { authority: 'projection' }))).toThrow(/authoritative/i);
    expect(() => readOperationsWorkItemListEnvelope(envelope([], {
      freshness: { status: 'stale', generated_at: '2026-10-10T02:01:00Z' },
    }))).toThrow(/authoritative/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({ id: '' })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemListEnvelope(envelope(item()))).toThrow(/invalid list/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({ kind: '' })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({ subject: { type: '', id: '' } })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({ assigned_to_me: undefined })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({ allowed_actions: ['delete'] })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({
      state: 'open', assigned_to_me: true, allowed_actions: ['claim'],
    })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({
      state: 'open', assigned_to_me: false, allowed_actions: ['reopen'],
    })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({
      state: 'claimed', assigned_to_me: false, allowed_actions: ['resolve'],
    })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({ history: undefined })))).toThrow(/incomplete/i);
    expect(() => readOperationsWorkItemDetailEnvelope(envelope(item({
      state: 'resolved', version: 3, allowed_actions: ['reopen'], resolution: undefined,
    })))).toThrow(/incomplete/i);
  });
});

