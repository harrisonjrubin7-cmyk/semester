import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./cloud', () => ({
  cloud: async () => ({ rpc: mock.rpc }),
}));

import { createSupportAccess, loadSupportAccess } from './support-access';

beforeEach(() => {
  vi.clearAllMocks();
  mock.rpc.mockImplementation(async (name: string) => {
    if (name === 'available_case_supporters') return {
      data: [{ supporter_id: 'staff-1', label: 'Advisor Rivera' }], error: null,
    };
    if (name === 'support_access_windows') return {
      data: [{
        grant_id: 'grant-1', side: 'student', counterpart_label: 'Advisor Rivera',
        reason: 'Diagnose the case.', expires_at: '2099-01-02T00:00:00Z',
        revoked_at: null, created_at: '2099-01-01T00:00:00Z',
        ticket_id: 'ticket-1', scopes: ['learning-progress'], consent_state: 'active',
      }],
      error: null,
    };
    if (name === 'my_support_tickets') return {
      data: [
        { id: 'ticket-1', subject: 'Open case', status: 'open' },
        { id: 'ticket-2', subject: 'Resolved case', status: 'resolved' },
      ],
      error: null,
    };
    return { data: null, error: null };
  });
});

describe('case-bound support access client', () => {
  it('loads only active case choices and preserves scope and consent metadata', async () => {
    const result = await loadSupportAccess();
    expect(result.tickets).toEqual([{ ticketId: 'ticket-1', subject: 'Open case' }]);
    expect(result.windows[0]).toMatchObject({
      ticketId: 'ticket-1', scopes: ['learning-progress'], consentState: 'active',
    });
  });

  it('always sends the selected ticket when creating the student consent window', async () => {
    mock.rpc.mockResolvedValueOnce({ data: 'grant-2', error: null });
    await expect(createSupportAccess('staff-1', 'Diagnose this case.', 2, 'ticket-1')).resolves.toBe('grant-2');
    expect(mock.rpc).toHaveBeenCalledWith('create_support_access', {
      want_supporter: 'staff-1',
      want_reason: 'Diagnose this case.',
      want_days: 2,
      want_ticket: 'ticket-1',
    });
  });

  it('preserves windows when the support-ticket list is temporarily unavailable', async () => {
    mock.rpc.mockImplementation(async (name: string) => {
      if (name === 'available_case_supporters') return { data: [], error: null };
      if (name === 'support_access_windows') return {
        data: [{ grant_id: 'grant-1', side: 'student', counterpart_label: 'Advisor Rivera', reason: 'Existing access', expires_at: '2099-01-02T00:00:00Z', revoked_at: null, created_at: '2099-01-01T00:00:00Z', ticket_id: 'ticket-1', scopes: ['learning-progress'], consent_state: 'active' }], error: null,
      };
      return { data: null, error: { message: 'Ticket service unavailable.' } };
    });
    const result = await loadSupportAccess();
    expect(result.windows).toHaveLength(1);
    expect(result.tickets).toEqual([]);
    expect(result.ticketLoadError).toBe('Ticket service unavailable.');
  });

});
