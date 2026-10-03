// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ApprovalInput, IntegrationHealth as IntegrationHealthRow } from '../../lib/console/client';
import { IntegrationHealth } from './IntegrationHealth';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (overrides: Partial<IntegrationHealthRow> = {}): IntegrationHealthRow => ({
  connectionId: 'conn-canvas', tenantId: 'vu', tenantName: 'Vanderbilt University', isDemo: false,
  connectionName: 'Canvas', providerDomain: 'lms', providerName: 'Canvas', configurationState: 'healthy',
  healthState: 'healthy', featureState: 'production', lastSuccessfulSyncAt: '2026-10-03T10:00:00Z',
  freshnessTargetMinutes: 30, minutesSinceSuccess: 10, latestRunStatus: 'success',
  latestRunAt: '2026-10-03T10:00:00Z', reconciliationState: 'complete', recordsReceived: 20,
  recordsRejected: 0, openErrors: 0, criticalErrors: 0, openDeadLetters: 0,
  ownerName: 'Integration owner', backupOwnerName: 'Backup owner',
  customerImpact: 'No current customer impact is indicated by connector telemetry.',
  nextSafeAction: 'Continue monitoring against the declared freshness target.',
  configurationApprovalId: null, configurationApprovalStatus: null, classification: 'restricted',
  canRequest: true,
  provenance: 'server sources', limitation: 'Credentials, cursors and payload references are never returned.',
  ...overrides,
});

let host: HTMLDivElement;
let root: Root;
let status: Mock<(said: string) => void>;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  status = vi.fn<(said: string) => void>();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function draw(
  read: (includeDemo?: boolean) => Promise<IntegrationHealthRow[]>,
  request = vi.fn<(input: ApprovalInput) => Promise<string>>(),
  env: 'Production' | 'Staging' | 'Demo' = 'Production',
) {
  await act(async () => {
    root.render(
      <IntegrationHealth
        env={env} scope="All" filter="" onStatus={status} privileged={(run) => void run()}
        read={read} requestConfigurationApproval={request}
      />,
    );
  });
  await act(async () => {});
}

const button = (name: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(name));
const field = (name: string) => {
  const label = [...host.querySelectorAll('label')].find((item) => item.textContent?.includes(name));
  return label?.querySelector('input, select') as HTMLInputElement | HTMLSelectElement | null;
};

async function change(input: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!input) throw new Error('field not found');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('integration health workspace', () => {
  it('renders all five health states with operational evidence and no secret controls', async () => {
    await draw(async () => [
      row(),
      row({ connectionId: 'degraded', connectionName: 'Degraded SIS', healthState: 'degraded', openErrors: 2 }),
      row({ connectionId: 'stale', connectionName: 'Stale catalog', healthState: 'stale', minutesSinceSuccess: 200 }),
      row({ connectionId: 'failed', connectionName: 'Failed identity', healthState: 'failed', criticalErrors: 1 }),
      row({ connectionId: 'unconfigured', connectionName: 'Unconfigured audit', healthState: 'unconfigured', lastSuccessfulSyncAt: null }),
    ]);
    for (const state of ['Healthy', 'Degraded', 'Stale', 'Failed', 'Unconfigured']) expect(host.textContent).toContain(state);
    expect(host.textContent).toContain('Customer impact');
    expect(host.textContent).toContain('Next safe action');
    expect(host.textContent).toContain('Provenanceserver sources');
    expect(host.textContent).toContain('Credentials, cursors and payload references are never returned.');
    expect(host.textContent).not.toContain('Include demo tenants explicitly');
    expect([...host.querySelectorAll('label')].some((label) => /credential|token|secret/i.test(label.textContent ?? ''))).toBe(false);
  });

  it('fails closed for denial and empty responses', async () => {
    await draw(async () => { throw new Error('integration:view over an exact school is required.'); });
    expect(host.textContent).toContain('Access denied.');
    expect(status).toHaveBeenCalledWith('integration:view over an exact school is required.');

    await draw(async () => []);
    expect(host.textContent).toContain('No integrations are available in this grant scope.');
  });

  it('offers explicit demo inclusion outside production', async () => {
    const read = vi.fn(async () => [] as IntegrationHealthRow[]);
    await draw(read, undefined, 'Staging');
    expect(host.textContent).toContain('Include demo tenants explicitly');
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => { checkbox.click(); });
    expect(read).toHaveBeenLastCalledWith(true);
  });

  it('requests structured two-person approval without a direct configuration write', async () => {
    const request = vi.fn(async () => 'approval-9');
    const read = vi.fn(async () => [row()]);
    await draw(read, request);
    await act(async () => { button('Request configuration approval')?.click(); });
    expect(host.textContent).toContain('Never paste credentials, secrets or tokens.');

    await change(field('Requested change'), 'rotate-credential-reference');
    await change(field('Institution approval reference'), 'APPROVAL-17');
    await change(field('Fallback or rollback reference'), 'RUNBOOK-9');
    await change(field('Credential expiry date'), '2099-01-31');
    await change(field('Change ticket'), 'CHG-44');
    await act(async () => { button('Request two-person approval')?.click(); });

    expect(request).toHaveBeenCalledWith({
      dutyId: 'integration-config', tenantId: 'vu', target: 'conn-canvas',
      detail: { requested_change: 'rotate-credential-reference', connection_name: 'Canvas', provider_domain: 'lms', credential_expiry: '2099-01-31' },
      evidence: 'institution_approval=APPROVAL-17; data_scope=lms; fallback=RUNBOOK-9; credential_expiry=2099-01-31',
      ticket: 'CHG-44',
    });
    expect(status).toHaveBeenCalledWith('Integration configuration approval approval-9 was requested for Canvas; execution remains separate.');
  });

  it('keeps an expired credential date from reaching the approval endpoint', async () => {
    const request = vi.fn(async () => 'approval-10');
    await draw(async () => [row()], request);
    await act(async () => { button('Request configuration approval')?.click(); });
    await change(field('Institution approval reference'), 'APPROVAL-17');
    await change(field('Fallback or rollback reference'), 'RUNBOOK-9');
    await change(field('Credential expiry date'), '2020-01-01');
    await change(field('Change ticket'), 'CHG-44');
    expect(button('Request two-person approval')?.disabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it('does not offer another request while an approval is open', async () => {
    await draw(async () => [row({ configurationApprovalId: 'approval-2', configurationApprovalStatus: 'pending' })]);
    expect(host.textContent).toContain('Keep this connector unchanged while approval approval-2 is pending.');
    expect(button('Request configuration approval')).toBeUndefined();
  });

  it('does not offer configuration requests to a read-only viewer', async () => {
    await draw(async () => [row({ canRequest: false })]);
    expect(host.textContent).toContain('read-only for your current duty assignment');
    expect(button('Request configuration approval')).toBeUndefined();
  });

  it('keeps invalid change-ticket characters from reaching the approval endpoint', async () => {
    const request = vi.fn(async () => 'approval-10');
    await draw(async () => [row()], request);
    await act(async () => { button('Request configuration approval')?.click(); });
    await change(field('Institution approval reference'), 'APPROVAL-17');
    await change(field('Fallback or rollback reference'), 'RUNBOOK-9');
    await change(field('Credential expiry date'), '2027-01-31');
    await change(field('Change ticket'), 'CHG/44');
    expect(button('Request two-person approval')?.disabled).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});
