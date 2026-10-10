import { describe, expect, it } from 'vitest';
import { financeApi, type FinanceCommandReceipt } from './api';

const receipt: FinanceCommandReceipt = {
  id: 'receipt-1', commandKey: 'finance-request-0001', action: 'request.create', status: 'accepted',
  resourceId: 'request-1', state: 'proposed', version: 1, recordedAt: '2026-10-10T12:00:00Z',
};

function fakeRpc(answer: { data: unknown; error: { message: string; code?: string } | null }) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    db: { rpc: async (name: string, args: Record<string, unknown>) => (calls.push({ name, args }), answer) } as never,
    calls,
  };
}

describe('finance command receipts', () => {
  it('submits request payload, action and caller-supplied command key to the atomic RPC', async () => {
    const { db, calls } = fakeRpc({ data: receipt, error: null });
    const api = financeApi(db);
    await expect(api.request('vu', {
      student_ref: 'S100', kind: 'charge', category: 'tuition', amount_cents: 2500,
      description: '  Lab fee  ', reference_entry_id: null, provider_ref: '', effective_on: '2026-10-10',
    }, 'finance-request-0001')).resolves.toEqual(receipt);
    expect(calls).toEqual([{ name: 'finance_command', args: {
      want_tenant: 'vu', want_student: 'S100', want_action: 'request.create', want_key: 'finance-request-0001',
      want_expected_version: null,
      want_payload: { kind: 'charge', category: 'tuition', amount_cents: 2500, description: 'Lab fee', reference_entry_id: null, provider_ref: '', effective_on: '2026-10-10' },
    } }]);
  });

  it('binds decisions to tenant, student, request version and a fresh command key', async () => {
    const { db, calls } = fakeRpc({ data: { ...receipt, action: 'request.approve', state: 'approved', version: 2 }, error: null });
    const api = financeApi(db);
    await api.decide('vu', 'S100', 'request-1', 1, 'approved', '  checked  ', 'test-command-11111111');
    expect(calls[0]).toEqual({ name: 'finance_command', args: {
      want_tenant: 'vu', want_student: 'S100', want_action: 'request.approve', want_key: 'test-command-11111111',
      want_expected_version: 1, want_payload: { request_id: 'request-1', note: 'checked' },
    } });
  });

  it('recovers a stable receipt without creating a fresh command', async () => {
    const { db, calls } = fakeRpc({ data: receipt, error: null });
    await expect(financeApi(db).receipt('vu', 'S100', 'request.create', 'finance-request-0001')).resolves.toEqual(receipt);
    expect(calls[0]).toEqual({ name: 'finance_command_receipt', args: {
      want_tenant: 'vu', want_student: 'S100', want_action: 'request.create', want_key: 'finance-request-0001',
    } });
  });

  it('classifies version/key conflicts and an unanswered transport separately', async () => {
    const conflict = fakeRpc({ data: null, error: { code: 'SC409', message: 'finance command version conflict' } });
    await expect(financeApi(conflict.db).withdraw('vu', 'S100', 'request-1', 1, 'finance-withdraw-0001'))
      .rejects.toMatchObject({ kind: 'conflict' });
    const unknown = fakeRpc({ data: null, error: { message: 'Failed to fetch' } });
    await expect(financeApi(unknown.db).receipt('vu', 'S100', 'request.create', 'finance-request-0001'))
      .rejects.toMatchObject({ kind: 'unknown' });
  });
});
