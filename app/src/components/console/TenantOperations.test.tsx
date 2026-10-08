// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { TenantOperationFact } from '../../lib/console/client';
import { TenantOperations, freshnessOf } from './TenantOperations';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-10-03T12:00:00Z');

const fact = (overrides: Partial<TenantOperationFact> = {}): TenantOperationFact => ({
  tenantId: 'vu',
  tenantName: 'Vanderbilt University',
  isDemo: false,
  factKey: 'rollout',
  category: 'rollout',
  label: 'Rollout state',
  value: 'pilot_read_only',
  classification: 'internal',
  provenance: 'public.tenant_rollout',
  owner: 'implementation',
  observedAt: '2026-10-03T10:00:00Z',
  staleAfterDays: 14,
  limitation: 'A lifecycle state is not approval evidence.',
  visibilityReason: 'Live tenant:implement grant at exact school scope.',
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

async function draw(read: (includeDemo?: boolean) => Promise<TenantOperationFact[]>, filter = '') {
  await act(async () => {
    root.render(
      <TenantOperations
        env="Production"
        scope="All"
        filter={filter}
        onStatus={status}
        privileged={(run) => void run()}
        now={NOW}
        read={read}
      />,
    );
  });
  await act(async () => {});
}

describe('tenant operations workspace', () => {
  it('shows a loading state before the tenant-derived read resolves', async () => {
    let release: (rows: TenantOperationFact[]) => void = () => undefined;
    const read = vi.fn(() => new Promise<TenantOperationFact[]>((resolve) => { release = resolve; }));

    await act(async () => {
      root.render(
        <TenantOperations
          env="Production" scope="All" filter="" onStatus={status}
          privileged={(run) => void run()} now={NOW} read={read}
        />,
      );
    });
    expect(host.textContent).toContain('Loading tenant operations');

    await act(async () => release([fact()]));
    expect(host.textContent).toContain('Vanderbilt University');
  });

  it('renders every access and evidence field, including stale state', async () => {
    await draw(async () => [fact({ observedAt: '2026-09-01T10:00:00Z' })]);
    expect(host.textContent).toContain('Rollout state');
    expect(host.textContent).toContain('pilot_read_only');
    expect(host.textContent).toContain('Classificationinternal');
    expect(host.textContent).toContain('Provenancepublic.tenant_rollout');
    expect(host.textContent).toContain('Ownerimplementation');
    expect(host.textContent).toContain('Freshnessstale');
    expect(host.textContent).toContain('Why visibleLive tenant:implement grant at exact school scope.');
    expect(host.textContent).toContain('LimitationA lifecycle state is not approval evidence.');
    expect(host.querySelector('article')?.style.gridTemplateColumns).toBe('');
    const refresh = host.querySelector('button');
    expect(refresh?.style.color).toBe('var(--app-fg)');
    expect(refresh?.style.borderColor).toBe('var(--app-line)');
  });

  it('fails missing or invalid observation times closed', () => {
    expect(freshnessOf(fact({ observedAt: null }), NOW)).toBe('missing');
    expect(freshnessOf(fact({ observedAt: 'not-a-date' }), NOW)).toBe('missing');
    expect(freshnessOf(fact({ observedAt: '2026-10-04T00:00:00Z' }), NOW)).toBe('missing');
  });

  it('shows an honest empty state without illustrative tenants', async () => {
    await draw(async () => []);
    expect(host.textContent).toContain('No tenant operations are available in this grant scope.');
    expect(host.textContent).toContain('No example or cross-tenant records are shown.');
  });

  it('shows a denied state and preserves the server refusal for status', async () => {
    const refusal = 'console:operate at platform scope is required.';
    await draw(async () => { throw new Error(refusal); });
    expect(host.textContent).toContain('Access denied.');
    expect(host.textContent).not.toContain('Vanderbilt University');
    expect(status).toHaveBeenCalledWith(refusal);
  });

  it('shows a generic fail-closed error state for non-authorization failures', async () => {
    await draw(async () => { throw new Error('Network unavailable.'); });
    expect(host.textContent).toContain('Tenant operations could not be loaded. No records are shown.');
    expect(status).toHaveBeenCalledWith('Network unavailable.');
  });

  it('applies the shared tenant scope and text filter before rendering', async () => {
    await draw(async () => [fact(), fact({
      tenantId: 'other', tenantName: 'Other University', factKey: 'integration',
      label: 'Integration connections', value: '1 healthy',
    })], 'integration');
    expect(host.textContent).toContain('Other University');
    expect(host.textContent).not.toContain('Vanderbilt University');
  });
});
