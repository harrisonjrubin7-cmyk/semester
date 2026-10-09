// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { TenantOperationFact, TenantProjectionEnvelope } from '../../lib/console/client';
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

const projection = (overrides: Partial<TenantProjectionEnvelope> = {}): TenantProjectionEnvelope => ({
  data: {
    tenantId: 'vu',
    entitlements: [{ capability: 'course:view', state: 'production', deleted: false, revision: 2, sourceOccurredAt: '2026-10-03T10:00:00Z', projectedAt: '2026-10-03T10:01:00Z' }],
    rollout: { state: 'pilot_read_only', resumeState: null, revision: 3, sourceOccurredAt: '2026-10-03T10:00:00Z', projectedAt: '2026-10-03T10:01:00Z' },
  },
  meta: {
    generatedAt: '2026-10-03T10:02:00Z', sourceUpdatedAt: '2026-10-03T10:00:00Z', computedAt: '2026-10-03T10:02:00Z',
    freshness: 'stale', authority: 'projection', modelVersion: 1, correlationId: 'tenant-projection:vu:1',
    coverage: {
      entitlements: { freshness: 'stale', modelVersion: 1, freshnessSloSeconds: 300, workerStatus: 'idle', hasMore: false, nextCursor: null },
      rollout: { freshness: 'fresh', modelVersion: 1, freshnessSloSeconds: 300, workerStatus: 'idle', present: true },
    },
  },
  permissions: { canView: true, canExport: false, allowedActions: [] },
  warnings: ['Verify against the authoritative tenant policy.'],
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
  read: (includeDemo?: boolean) => Promise<TenantOperationFact[]>,
  filter = '',
  readProjection: (tenantId: string, afterCapability?: string | null, limit?: number) => Promise<TenantProjectionEnvelope> = async () => projection(),
) {
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
        readProjection={readProjection}
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

  it('loads an exact tenant projection only after disclosure and labels degraded read-only evidence', async () => {
    const readProjection = vi.fn(async () => projection());
    await draw(async () => [fact()], '', readProjection);

    expect(readProjection).not.toHaveBeenCalled();
    const trigger = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === 'View projected state')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    await act(async () => trigger.click());

    expect(readProjection).toHaveBeenCalledWith('vu', null, 50);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('Projected state · read only');
    expect(host.textContent).toContain('Projection freshness is stale');
    expect(host.textContent).toContain('Verify against the authoritative tenant policy.');
    expect(host.textContent).toContain('Rollout projection');
    expect(host.textContent).toContain('pilot_read_only');
    expect(host.textContent).toContain('course:view');
    expect(host.textContent).toContain('Projection · read only · no export');
    const entitlementGrid = [...host.querySelectorAll('div')].find((element) => element.style.gridTemplateColumns.includes('minmax(min(100%, 18rem)'));
    expect(entitlementGrid).toBeTruthy();
  });

  it('shows permission and empty-unknown states without cached or illustrative projection rows', async () => {
    const refused = vi.fn(async () => { throw new Error('tenant:configure over the requested tenant is required.'); });
    await draw(async () => [fact()], '', refused);
    await act(async () => [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === 'View projected state')!.click());

    expect(host.textContent).toContain('Projected state is unavailable');
    expect(host.textContent).toContain('No projected records are shown.');
    expect(host.textContent).not.toContain('course:view');
    expect(status).toHaveBeenCalledWith('tenant:configure over the requested tenant is required.');

    await act(async () => root.unmount());
    host.remove();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await draw(async () => [fact()], '', async () => projection({
      data: { tenantId: 'vu', entitlements: [], rollout: null },
      meta: {
        ...projection().meta,
        freshness: 'unknown',
        coverage: {
          entitlements: { ...projection().meta.coverage.entitlements, freshness: 'unknown', workerStatus: 'unknown' },
          rollout: { ...projection().meta.coverage.rollout, freshness: 'unknown', workerStatus: 'unknown', present: false },
        },
      },
    }));
    await act(async () => [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === 'View projected state')!.click());

    expect(host.textContent).toContain('No projected state');
    expect(host.textContent).toContain('This is unknown, not fresh or active.');
    expect(host.textContent).not.toContain('course:view');
  });

  it('paginates entitlements with the server cursor and keeps prior rows', async () => {
    const readProjection = vi.fn(async (_tenant: string, cursor?: string | null) => cursor
      ? projection({
          data: { ...projection().data, entitlements: [{ capability: 'study:view', state: 'off', deleted: false, revision: 1, sourceOccurredAt: null, projectedAt: null }] },
          meta: { ...projection().meta, coverage: { ...projection().meta.coverage, entitlements: { ...projection().meta.coverage.entitlements, hasMore: false, nextCursor: null } } },
        })
      : projection({
          meta: { ...projection().meta, coverage: { ...projection().meta.coverage, entitlements: { ...projection().meta.coverage.entitlements, hasMore: true, nextCursor: 'course:view' } } },
        }));
    await draw(async () => [fact()], '', readProjection);
    await act(async () => [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === 'View projected state')!.click());
    await act(async () => [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === 'Load more entitlements')!.click());

    expect(readProjection).toHaveBeenLastCalledWith('vu', 'course:view', 50);
    expect(host.textContent).toContain('course:view');
    expect(host.textContent).toContain('study:view');
    expect(host.textContent).toContain('2 loaded');
  });
});
