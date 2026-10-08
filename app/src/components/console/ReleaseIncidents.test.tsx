// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ApprovalInput, ReleaseIncident } from '../../lib/console/client';
import { ReleaseIncidents } from './ReleaseIncidents';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (overrides: Partial<ReleaseIncident> = {}): ReleaseIncident => ({
  itemId: 'release:platform', itemKind: 'release', tenantId: null, tenantName: null, isDemo: false,
  state: 'blocked', title: 'Production release', severity: 'critical', owner: 'engineering',
  affectedWorkflows: ['application', 'database'], customerImpact: 'No deployment is established.',
  communicationStatus: 'not_applicable', lastNoticeAt: null, nextUpdateAt: null,
  rollbackStatus: 'documented', releaseCommit: 'a'.repeat(40), deploymentSource: null, deploymentId: null,
  observedAt: null, expiresAt: null, approvalId: null, approvalStatus: null, canRequest: true,
  evidence: 'production_deployment=blocked', nextSafeAction: 'Resolve every blocked prerequisite.',
  classification: 'restricted', provenance: 'server evidence', limitation: 'No production claim.',
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

afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function draw(
  read: (includeDemo?: boolean) => Promise<ReleaseIncident[]>,
  request = vi.fn<(input: ApprovalInput) => Promise<string>>(),
  env: 'Production' | 'Staging' | 'Demo' = 'Production',
) {
  await act(async () => {
    root.render(<ReleaseIncidents env={env} scope="All" filter="" onStatus={status} privileged={(run) => void run()} read={read} requestReleaseApproval={request} />);
  });
  await act(async () => {});
}

const button = (name: string) => [...host.querySelectorAll('button')].find((item) => item.textContent?.includes(name));
const field = (name: string) => [...host.querySelectorAll('label')].find((item) => item.textContent?.startsWith(name))?.querySelector('input') as HTMLInputElement | null;
async function change(input: HTMLInputElement | null, value: string) {
  if (!input) throw new Error('field not found');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('release and incident workspace', () => {
  it('renders the six required lifecycle states and verified evidence without claiming GO', async () => {
    await draw(async () => [
      row(), row({ itemId: 'candidate', state: 'release_candidate' }),
      row({ itemId: 'deployed', state: 'deployed_unverified', releaseCommit: 'a'.repeat(40) }),
      row({ itemId: 'verified', state: 'verified', releaseCommit: 'b'.repeat(40) }),
      row({ itemId: 'incident-1', itemKind: 'incident', state: 'incident', title: 'Sign-in incident', tenantId: 'vu', tenantName: 'Vanderbilt University' }),
      row({ itemId: 'incident-2', itemKind: 'incident', state: 'rollback', title: 'Rollback in progress' }),
      row({ itemId: 'incident-3', itemKind: 'incident', state: 'recovered', title: 'Recovered incident' }),
    ]);
    for (const state of ['Blocked', 'Release candidate', 'Deployed — needs confirmation', 'Verified evidence', 'Incident', 'Rollback', 'Recovered']) expect(host.textContent).toContain(state);
    expect(host.textContent).toContain('No row is a GO decision by itself');
    expect(host.textContent).toContain('Affected workflows');
    expect(host.textContent).toContain('No production claim.');
    expect(host.textContent).not.toContain('Include demo incidents explicitly');
    expect(button('Deploy')).toBeUndefined();
    expect(button('Execute rollback')).toBeUndefined();
  });

  it('fails closed for denial and empty responses', async () => {
    await draw(async () => { throw new Error('incident:communicate at platform scope is required.'); });
    expect(host.textContent).toContain('Access denied.');
    expect(status).toHaveBeenCalledWith('incident:communicate at platform scope is required.');
    await draw(async () => []);
    expect(host.textContent).toContain('No release or incident records are available');
  });

  it('offers explicit demo inclusion only outside production', async () => {
    const read = vi.fn(async () => [] as ReleaseIncident[]);
    await draw(read, undefined, 'Staging');
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(host.textContent).toContain('Include demo incidents explicitly');
    await act(async () => checkbox.click());
    expect(read).toHaveBeenLastCalledWith(true);
  });

  it('requests a structured release approval and never executes it', async () => {
    const request = vi.fn(async () => 'approval-17');
    await draw(async () => [row({ state: 'release_candidate' })], request);
    await act(async () => button('Request release approval')?.click());
    await change(field('CI result reference'), 'CI-44');
    await change(field('Golden path reference'), 'SMOKE-22');
    await change(field('Rollback rehearsal reference'), 'DRILL-9');
    await change(field('Change ticket'), 'CHG-100');
    await act(async () => button('Request release approval')?.click());
    expect(request).toHaveBeenCalledWith({
      dutyId: 'release', tenantId: null, target: 'platform',
      detail: { action: 'release', release_commit: 'a'.repeat(40) },
      evidence: 'ci=CI-44; golden_path=SMOKE-22; rollback=DRILL-9', ticket: 'CHG-100',
    });
    expect(status).toHaveBeenCalledWith('Release approval approval-17 was requested; execution and verification remain separate.');
  });

  it('requests rollback approval for the incident tenant and preserves the incident reference', async () => {
    const request = vi.fn(async () => 'approval-18');
    const commit = 'c'.repeat(40);
    await draw(async () => [row({ itemId: 'incident-9', itemKind: 'incident', state: 'incident', tenantId: 'vu', releaseCommit: commit })], request);
    await act(async () => button('Request rollback approval')?.click());
    await change(field('Change evidence reference'), 'INC-9');
    await change(field('Verification plan reference'), 'VERIFY-9');
    await change(field('Rollback procedure reference'), 'ROLLBACK-9');
    await change(field('Change ticket'), 'CHG-9');
    await act(async () => button('Request rollback approval')?.click());
    expect(request).toHaveBeenCalledWith({
      dutyId: 'release', tenantId: 'vu', target: 'incident-9',
      detail: { action: 'rollback', incident_ref: 'incident-9', release_commit: commit },
      evidence: 'change_evidence=INC-9; verification_plan=VERIFY-9; rollback_procedure=ROLLBACK-9', ticket: 'CHG-9',
    });
  });

  it('does not duplicate an open approval', async () => {
    await draw(async () => [row({ approvalId: 'approval-2', approvalStatus: 'pending' })]);
    expect(host.textContent).toContain('Keep the release unchanged while approval approval-2 is pending.');
    expect(button('Request release approval')).toBeUndefined();
  });

  it('does not duplicate an executed release approval', async () => {
    await draw(async () => [row({ state: 'release_candidate', approvalId: 'approval-2', approvalStatus: 'executed' })]);
    expect(button('Request release approval')).toBeUndefined();
  });

  it('does not request a release approval until an exact candidate commit is established', async () => {
    await draw(async () => [row({ state: 'release_candidate', releaseCommit: null })]);
    expect(button('Request release approval')).toBeUndefined();
    expect(host.textContent).toContain('not established');
  });

  it('does not offer release writes to an incident-only operator', async () => {
    await draw(async () => [row({ canRequest: false })]);
    expect(button('Request release approval')).toBeUndefined();
  });

  it('does not offer release approval while prerequisite gates are blocked', async () => {
    await draw(async () => [row({ state: 'blocked', canRequest: true })]);
    expect(button('Request release approval')).toBeUndefined();
  });
});
