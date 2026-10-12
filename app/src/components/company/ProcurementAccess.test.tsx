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
  grantedAt: '2026-10-04T10:00:00Z', expiresAt: '2099-10-20T10:00:00Z', revokedAt: null, revokedBy: null, revokeReason: null,
};
const DETAIL: ProcurementDetail = {
  request: REQUEST,
  hasMoreAccesses: false,
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
let authorizationLost: ReturnType<typeof vi.fn<() => void>>;

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
  authorizationLost = vi.fn<() => void>();
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
  await act(async () => root.render(<ProcurementAccess subject={subject} online={online} api={api} onAuthorizationLost={authorizationLost} />));
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
    expect(dialog.textContent).toContain('acct_north');
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

  it('uses the freshly loaded recipient in the irreversible preview', async () => {
    const fresh = { ...REQUEST, requesterName: 'Current reviewer', requesterEmail: 'current@example.edu' };
    vi.mocked(api.loadDetail).mockResolvedValueOnce({ ...DETAIL, request: fresh });
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Current reviewer (current@example.edu)');
    expect(dialog.textContent).not.toContain('reviewer@example.edu');
  });

  it('rechecks the exact capability immediately before withdrawal and dispatches no mutation after revocation', async () => {
    vi.mocked(api.verifySubject).mockRejectedValueOnce(new Error('Company access is no longer granted.'));
    await mount();
    await act(async () => button(/Withdraw access/).click());
    const reason = host.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => typeInto(reason, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle();
    expect(authorizationLost).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('reviewer@example.edu');
    expect(host.textContent).not.toContain('Access history');
    expect(api.withdraw).not.toHaveBeenCalled();
  });

  it('locks account selection while a withdrawal is being verified', async () => {
    const accountB = { ...ACCOUNT, id: 'account-2', name: 'South College' };
    const requestB = { ...REQUEST, id: 'request-2', accountId: accountB.id, requesterName: 'South reviewer' };
    let releaseVerification!: (subject: string) => void;
    vi.mocked(api.loadAccounts).mockResolvedValueOnce([ACCOUNT, accountB]);
    vi.mocked(api.loadRequests).mockImplementation(async (accountId) => accountId === ACCOUNT.id ? [REQUEST] : [requestB]);
    vi.mocked(api.loadDetail).mockImplementation(async (_accountId, requestId) => ({ ...DETAIL, request: requestId === REQUEST.id ? REQUEST : requestB }));
    vi.mocked(api.verifySubject).mockImplementationOnce(() => new Promise((resolve) => { releaseVerification = resolve; }));
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    expect(button(/South College/).disabled).toBe(true);
    await act(async () => button(/South College/).click());
    await act(async () => releaseVerification('account-team-1'));
    await settle();
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('<Procurement Reviewer>');
    expect(host.textContent).toContain('Access withdrawn');
  });

  it('keeps account selection locked until withdrawal readback settles', async () => {
    const accountB = { ...ACCOUNT, id: 'account-2', name: 'South College' };
    const requestB = { ...REQUEST, id: 'request-2', accountId: accountB.id, requesterName: 'South reviewer' };
    let releaseWithdrawal!: (outcome: WithdrawalOutcome) => void;
    vi.mocked(api.loadAccounts).mockResolvedValueOnce([ACCOUNT, accountB]);
    vi.mocked(api.loadRequests).mockImplementation(async (accountId) => accountId === ACCOUNT.id ? [REQUEST] : [requestB]);
    vi.mocked(api.loadDetail).mockImplementation(async (_accountId, requestId) => ({ ...DETAIL, request: requestId === REQUEST.id ? REQUEST : requestB }));
    vi.mocked(api.withdraw).mockImplementationOnce(() => new Promise((resolve) => { releaseWithdrawal = resolve; }));
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle(2);
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    expect(button(/South College/).disabled).toBe(true);
    await act(async () => button(/South College/).click());
    await act(async () => releaseWithdrawal({
      kind: 'confirmed', concurrent: false,
      grant: { ...GRANT, revokedAt: '2026-10-11T22:00:00Z', revokedBy: 'account-team-1', revokeReason: 'Evidence superseded' },
    }));
    await settle();
    expect(host.textContent).toContain('<Procurement Reviewer>');
    expect(host.textContent).toContain('Access withdrawn');
  });

  it('locks request pagination while a withdrawal is being verified', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({ ...REQUEST, id: `request-${index}`, requesterName: `Reviewer ${index}` }));
    const nextRequest = { ...REQUEST, id: 'request-next', requesterName: 'Next-page reviewer' };
    let releaseVerification!: (subject: string) => void;
    vi.mocked(api.loadRequests).mockResolvedValueOnce(firstPage).mockResolvedValueOnce([nextRequest]);
    vi.mocked(api.loadDetail).mockImplementation(async (_accountId, requestId) => ({ ...DETAIL, request: requestId === nextRequest.id ? nextRequest : firstPage[0] }));
    vi.mocked(api.verifySubject).mockImplementationOnce(() => new Promise((resolve) => { releaseVerification = resolve; }));
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    expect(button(/Next requests/).disabled).toBe(true);
    await act(async () => button(/Next requests/).click());
    await act(async () => releaseVerification('account-team-1'));
    await settle();
    expect(api.withdraw).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Reviewer 0');
    expect(host.textContent).toContain('Access withdrawn');
  });

  it('keeps request pagination locked until withdrawal readback settles', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({ ...REQUEST, id: `request-${index}`, requesterName: `Reviewer ${index}` }));
    const nextRequest = { ...REQUEST, id: 'request-next', requesterName: 'Next-page reviewer' };
    let releaseWithdrawal!: (outcome: WithdrawalOutcome) => void;
    vi.mocked(api.loadRequests).mockResolvedValueOnce(firstPage).mockResolvedValueOnce([nextRequest]);
    vi.mocked(api.loadDetail).mockImplementation(async (_accountId, requestId) => ({ ...DETAIL, request: requestId === nextRequest.id ? nextRequest : firstPage[0] }));
    vi.mocked(api.withdraw).mockImplementationOnce(() => new Promise((resolve) => { releaseWithdrawal = resolve; }));
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle(2);
    expect(button(/Next requests/).disabled).toBe(true);
    await act(async () => button(/Next requests/).click());
    await act(async () => releaseWithdrawal({
      kind: 'confirmed', concurrent: false,
      grant: { ...GRANT, revokedAt: '2026-10-11T22:00:00Z', revokedBy: 'account-team-1', revokeReason: 'Evidence superseded' },
    }));
    await settle();
    expect(host.textContent).toContain('Reviewer 0');
    expect(host.textContent).toContain('Access withdrawn');
  });

  it('does not offer or queue a withdrawal while offline', async () => {
    await mount('account-team-1', false);
    expect(host.textContent).toContain('You are offline');
    expect(host.textContent).toContain('nothing is queued');
    expect(button(/Withdraw access/).disabled).toBe(true);
    expect(api.withdraw).not.toHaveBeenCalled();
  });

  it('closes an open confirmation when connectivity is lost', async () => {
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => root.render(<ProcurementAccess subject="account-team-1" online={false} api={api} onAuthorizationLost={authorizationLost} />));
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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

  it('clears cached Company detail and starts a protected recheck when readback loses visibility', async () => {
    let releaseRecheck!: (accounts: CompanyAccount[]) => void;
    vi.mocked(api.loadAccounts)
      .mockResolvedValueOnce([ACCOUNT])
      .mockImplementationOnce(() => new Promise((resolve) => { releaseRecheck = resolve; }));
    vi.mocked(api.withdraw).mockResolvedValueOnce({ kind: 'unknown', visibilityLost: true, live: null });
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle(2);
    expect(api.loadAccounts).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain('reviewer@example.edu');
    expect(host.textContent).not.toContain('Access history');
    await act(async () => releaseRecheck([]));
  });

  it('ignores a click on the already selected account or request', async () => {
    await mount();
    await act(async () => button(/North College/).click());
    await act(async () => button(/<Procurement Reviewer>/).click());
    await settle();
    expect(host.textContent).toContain('reviewer@example.edu');
    expect(host.textContent).not.toContain('Loading request and access grants');
    expect(api.loadRequests).toHaveBeenCalledTimes(1);
    expect(api.loadDetail).toHaveBeenCalledTimes(1);
  });

  it('does not offer withdrawal for an already expired grant', async () => {
    vi.mocked(api.loadDetail).mockResolvedValueOnce({
      ...DETAIL,
      grants: [{ ...DETAIL.grants[0], expiresAt: '2020-01-01T00:00:00Z' }],
    });
    await mount();
    expect(host.textContent).toContain('Grant grant-1');
    expect([...document.querySelectorAll('button')].some((item) => /Withdraw access/.test(item.textContent ?? ''))).toBe(false);
  });

  it('states when access history is capped in the UI', async () => {
    vi.mocked(api.loadDetail).mockResolvedValueOnce({
      ...DETAIL,
      hasMoreAccesses: true,
      grants: [{ ...DETAIL.grants[0], accesses: [] }],
    });
    await mount();
    expect(host.textContent).toContain('No opens for this grant are included in the latest 100 access events shown');
    expect(host.textContent).not.toContain('No authorized room opens are recorded');
    expect(host.textContent).toContain('Showing the latest 100 access events');
    expect(host.textContent).toContain('complete append-only history remains in the audit system');
  });

  it('selects the next live grant after one withdrawal is confirmed', async () => {
    const second = { ...DETAIL.grants[0], id: 'grant-2' };
    vi.mocked(api.loadDetail).mockResolvedValueOnce({ ...DETAIL, grants: [DETAIL.grants[0], second] });
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle();
    await act(async () => button(/Withdraw access/).click());
    expect((host.querySelector('select') as HTMLSelectElement).value).toBe('grant-2');
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Second withdrawal'));
    expect(button(/Review withdrawal/).disabled).toBe(false);
  });

  it('clears sensitive detail when a protected refresh reports authorization loss', async () => {
    vi.mocked(api.withdraw).mockResolvedValueOnce({ kind: 'unknown', visibilityLost: false, live: true });
    await mount();
    await act(async () => button(/Withdraw access/).click());
    await act(async () => typeInto(host.querySelector('textarea') as HTMLTextAreaElement, 'Evidence superseded'));
    await act(async () => button(/Review withdrawal/).click());
    await act(async () => button(/^Withdraw access$/).click());
    await settle();
    vi.mocked(api.loadDetail).mockRejectedValueOnce(new Error('Company access is no longer granted.'));
    await act(async () => button(/Refresh grant/).click());
    await settle();
    expect(authorizationLost).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('reviewer@example.edu');
    expect(host.textContent).not.toContain('Access history');
  });

  it('discards an old subject response and cancels its open preview on account change', async () => {
    let release!: (accounts: CompanyAccount[]) => void;
    vi.mocked(api.loadAccounts).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    await act(async () => root.render(<ProcurementAccess subject="account-team-1" online api={api} onAuthorizationLost={authorizationLost} />));
    await act(async () => root.render(<ProcurementAccess subject="account-team-2" online api={api} onAuthorizationLost={authorizationLost} />));
    release([{ ...ACCOUNT, name: 'Old account data' }]);
    await settle();
    expect(host.textContent).not.toContain('Old account data');
    expect(api.loadAccounts).toHaveBeenCalledTimes(2);
  });

  it('keeps a way back when an exact full account page is followed by an empty page', async () => {
    const full = Array.from({ length: 50 }, (_, index) => ({ ...ACCOUNT, id: `account-${index}`, name: `Account ${index}` }));
    vi.mocked(api.loadAccounts).mockResolvedValueOnce(full).mockResolvedValueOnce([]).mockResolvedValueOnce(full);
    await mount();
    await act(async () => button(/Next accounts/).click());
    await settle();
    expect(host.textContent).toContain('No company accounts are visible');
    expect(button(/Previous accounts/).disabled).toBe(false);
    await act(async () => button(/Previous accounts/).click());
    await settle();
    expect(host.textContent).toContain('Account 0');
  });

  it('keeps a way back when an exact full request page is followed by an empty page', async () => {
    const full = Array.from({ length: 50 }, (_, index) => ({ ...REQUEST, id: `request-${index}`, requesterName: `Reviewer ${index}` }));
    vi.mocked(api.loadRequests).mockResolvedValueOnce(full).mockResolvedValueOnce([]).mockResolvedValueOnce(full);
    await mount();
    await act(async () => button(/Next requests/).click());
    await settle();
    expect(host.textContent).toContain('No procurement requests');
    expect(button(/Previous requests/).disabled).toBe(false);
    await act(async () => button(/Previous requests/).click());
    await settle();
    expect(host.textContent).toContain('Reviewer 0');
  });

  it('does not let a late request page from account A replace account B', async () => {
    const accountB = { ...ACCOUNT, id: 'account-2', name: 'South College' };
    const requestB = { ...REQUEST, id: 'request-2', accountId: accountB.id, requesterName: 'South reviewer' };
    let resolveA!: (rows: ProcurementRequest[]) => void;
    vi.mocked(api.loadAccounts).mockResolvedValueOnce([ACCOUNT, accountB]);
    vi.mocked(api.loadRequests)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }))
      .mockResolvedValueOnce([requestB]);
    vi.mocked(api.loadDetail).mockResolvedValue({ ...DETAIL, request: requestB });
    await mount();
    await act(async () => button(/South College/).click());
    await settle();
    expect(host.textContent).toContain('South reviewer');
    await act(async () => resolveA([REQUEST]));
    await settle();
    expect(host.textContent).toContain('South reviewer');
    expect(host.textContent).not.toContain('<Procurement Reviewer>');
  });
});
