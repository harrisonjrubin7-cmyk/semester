// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CompanyAccount, ProcurementDetail, ProcurementGrant, ProcurementRequest, WithdrawalOutcome,
} from '../../lib/company/procurement';
import type { ProcurementAccessApi } from './ProcurementAccess';
import { ProcurementAccess } from './ProcurementAccess';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACCOUNT: CompanyAccount = {
  id: 'account-1', publicId: 'acct_north', name: 'North College', segment: 'regional', tenantId: 'north',
  status: 'engaged', ownerId: null, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-10T09:00:00Z',
};
const REQUEST: ProcurementRequest = {
  id: 'request-1', accountId: 'account-1', stakeholderId: 'stakeholder-1', requesterName: '<Procurement Reviewer>',
  requesterEmail: 'reviewer@example.edu', requesterRole: 'procurement', reason: '<script>security review</script>',
  ndaSignedOn: '2026-10-02', status: 'granted', requestedAt: '2026-10-03T10:00:00Z', updatedAt: '2026-10-04T10:00:00Z',
};
const GRANT: ProcurementGrant = {
  id: 'grant-1', requestId: 'request-1', packetCommit: 'a'.repeat(40), grantedBy: 'account-team-2',
  grantedAt: '2026-10-04T10:00:00Z', expiresAt: '2026-10-20T10:00:00Z', revokedAt: null, revokedBy: null, revokeReason: null,
};
const DETAIL: ProcurementDetail = {
  request: REQUEST,
  grants: [{
    ...GRANT,
    items: [{
      versionId: 'version-1', artifactKey: 'hecvat', title: 'HECVAT readiness register', tier: 'nda',
      version: '1.0', sourceCommit: null, publishedOn: '2026-09-01', reviewOn: '2027-09-01',
    }],
    accesses: [{ id: 'access-1', versionId: null, accessedAt: '2026-10-05T10:00:00Z' }],
  }],
};

let host: HTMLDivElement;
let root: Root;
let api: ProcurementAccessApi;

beforeEach(() => {
  api = {
    loadAccounts: vi.fn(async () => [ACCOUNT]),
    loadRequests: vi.fn(async () => [REQUEST]),
    loadDetail: vi.fn(async () => DETAIL),
    verifySubject: vi.fn(async (subject) => subject),
    withdraw: vi.fn(async (): Promise<WithdrawalOutcome> => ({
      kind: 'confirmed', concurrent: false,
      grant: { ...GRANT, revokedAt: '2026-10-11T22:00:00Z', revokedBy: 'account-team-1', revokeReason: 'Evidence superseded' },
    })),
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function settle(rounds = 8) {
  for (let index = 0; index < rounds; index += 1) await act(async () => Promise.resolve());
}

async function mount(subject = 'account-team-1', online = true) {
  await act(async () => root.render(<ProcurementAccess subject={subject} online={online} api={api} />));
  await settle();
}

function button(name: RegExp): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((item) => name.test(item.textContent ?? ''));
  if (!found) throw new Error(`No button matching ${name}`);
  return found as HTMLButtonElement;
}

function typeInto(field: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Company procurement access', () => {
  it('shows the selected account, immutable grant, pinned version, source unknown, and honest access history', async () => {
    await mount();
    expect(host.textContent).toContain('North College');
    expect(host.textContent).toContain('<Procurement Reviewer>');
    expect(host.textContent).toContain('<script>security review</script>');
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toContain('HECVAT readiness register');
    expect(host.textContent).toContain('Version 1.0');
    expect(host.textContent).toContain('Source commit unknown');
    expect(host.textContent).toContain('Review due Sep 1, 2027');
    expect(host.textContent).toContain('Room authorization succeeded');
    expect(host.textContent).toContain('does not prove a download, reading, or acceptance');
    expect(host.textContent).toContain('Checked now');
  });

  it('keeps read failures distinct from an authorized empty queue and offers retry', async () => {
    vi.mocked(api.loadAccounts).mockRejectedValueOnce(new Error('Could not load company accounts.'));
    await mount();
    expect(host.textContent).toContain('Company requests could not be loaded');
    expect(host.textContent).not.toContain('No procurement requests');
    expect(button(/Try again/)).toBeTruthy();

    vi.mocked(api.loadAccounts).mockResolvedValueOnce([]);
    await act(async () => button(/Try again/).click());
    await settle();
    expect(host.textContent).toContain('No company accounts are visible');
  });

  it('previews the exact withdrawal, cancellation changes nothing, and double confirmation sends one action', async () => {
    await mount();
    await act(async () => button(/Withdraw access/).click());
    const reason = host.querySelector('textarea') as HTMLTextAreaElement;
    expect(reason).not.toBeNull();
    await act(async () => typeInto(reason, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('North College');
    expect(dialog.textContent).toContain('<Procurement Reviewer>');
    expect(dialog.textContent).toContain('grant-1');
    expect(dialog.textContent).toContain('HECVAT readiness register · version 1.0');
    expect(dialog.textContent).toContain('Evidence superseded');
    await act(async () => button(/^Cancel$/).click());
    expect(api.withdraw).not.toHaveBeenCalled();

    await act(async () => button(/Review withdrawal/).click());
    const confirm = button(/^Withdraw access$/);
    await act(async () => { confirm.click(); confirm.click(); });
    await settle();
    expect(api.verifySubject).toHaveBeenCalledWith('account-team-1');
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Access withdrawn');
    expect(host.textContent).toContain('Evidence superseded');
    expect(host.textContent).toContain('account-team-1');
  });

  it('does not offer or queue a withdrawal while offline', async () => {
    await mount('account-team-1', false);
    expect(host.textContent).toContain('You are offline');
    expect(host.textContent).toContain('nothing is queued');
    expect(button(/Withdraw access/).disabled).toBe(true);
    expect(api.withdraw).not.toHaveBeenCalled();
  });

  it('shows an unknown outcome and requires a fresh grant read before another attempt', async () => {
    vi.mocked(api.withdraw).mockResolvedValueOnce({ kind: 'unknown', visibilityLost: false, live: true });
    await mount();
    await act(async () => button(/Withdraw access/).click());
    const reason = host.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => typeInto(reason, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle();
    expect(host.textContent).toContain('Withdrawal outcome unknown');
    expect(host.textContent).toContain('Refresh this exact grant before trying again');
    expect(button(/Review withdrawal/).disabled).toBe(true);
    await act(async () => button(/Refresh grant/).click());
    await settle();
    expect(api.loadDetail).toHaveBeenCalledTimes(2);
    expect(button(/Withdraw access/).disabled).toBe(false);
  });

  it('discards an old subject response and cancels its open preview on account change', async () => {
    let release!: (accounts: CompanyAccount[]) => void;
    vi.mocked(api.loadAccounts).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await act(async () => root.render(<ProcurementAccess subject="account-team-1" online api={api} />));
    await act(async () => root.render(<ProcurementAccess subject="account-team-2" online api={api} />));
    release([{ ...ACCOUNT, name: 'Old account data' }]);
    await settle();
    expect(host.textContent).not.toContain('Old account data');
    expect(api.loadAccounts).toHaveBeenCalledTimes(2);
  });
});
