import { expect, it, vi, beforeEach } from 'vitest';
import { EMPTY_PRODUCTIVITY } from './productivity';
const { rpc, maybeSingle, eq, remove, removeSelect, select, from } = vi.hoisted(() => {
  const rpc = vi.fn(),
    maybeSingle = vi.fn(),
    eq = vi.fn(),
    remove = vi.fn(),
    removeSelect = vi.fn(),
    select = vi.fn(),
    from = vi.fn();
  return { rpc, maybeSingle, eq, remove, removeSelect, select, from };
});
vi.mock('./cloud', () => ({ cloud: async () => ({ rpc, from }) }));
import {
  loadWorkspace,
  saveWorkspace,
  deleteWorkspace,
  readCloudWorkspace,
} from './productivity-cloud';
beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ select, delete: remove });
  select.mockReturnValue({ eq });
  remove.mockReturnValue({ eq });
  eq.mockReturnValue({ maybeSingle, select: removeSelect });
});
it('loads only the requested account and validates nested cloud content', async () => {
  maybeSingle.mockResolvedValue({
    data: {
      revision: 2,
      data: EMPTY_PRODUCTIVITY,
      tenant_id: null,
      share_aggregate: false,
      updated_at: '2026-10-01',
    },
    error: null,
  });
  expect((await loadWorkspace('student-a'))?.revision).toBe(2);
  expect(eq).toHaveBeenCalledWith('user_id', 'student-a');
  expect(() =>
    readCloudWorkspace({
      revision: 2,
      data: { version: 1 },
      tenantId: null,
      shareAggregate: false,
      updatedAt: 'now',
    }),
  ).toThrow();
});
it('sends the reviewed revision and refuses stale writes', async () => {
  rpc.mockResolvedValue({ error: { code: '40001', message: 'conflict' } });
  await expect(
    saveWorkspace(EMPTY_PRODUCTIVITY, 2, null, false),
  ).rejects.toThrow('Another device');
  expect(rpc).toHaveBeenCalledWith('save_productivity_workspace', {
    p_expected: 2,
    p_data: EMPTY_PRODUCTIVITY,
    p_tenant: null,
    p_aggregate: false,
  });
});
it('scopes deletion and surfaces failure without modifying local content', async () => {
  removeSelect.mockResolvedValue({ data: null, error: { message: 'Denied' } });
  await expect(deleteWorkspace('student-a')).rejects.toThrow('Denied');
  expect(eq).toHaveBeenCalledWith('user_id', 'student-a');
});
it('requires the account row as a deletion receipt', async () => {
  removeSelect.mockResolvedValueOnce({ data: [], error: null });
  await expect(deleteWorkspace('student-a')).rejects.toThrow('could not be deleted');

  removeSelect.mockResolvedValueOnce({ data: [{ user_id: 'student-a' }], error: null });
  await expect(deleteWorkspace('student-a')).resolves.toBeUndefined();
  expect(removeSelect).toHaveBeenCalledWith('user_id');
});
