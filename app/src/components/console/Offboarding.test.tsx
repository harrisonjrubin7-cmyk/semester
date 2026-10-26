// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { OffboardingCase, PurgePreviewEnvelope } from '../../lib/console/client';
import { Offboarding } from './Offboarding';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = (overrides: Partial<OffboardingCase> = {}): OffboardingCase => ({
  caseId: '00000000-0000-4000-8000-000000000101',
  tenantId: 'synthetic-u',
  tenantName: 'Synthetic University',
  status: 'archived',
  retainUntil: '2026-10-01T00:00:00Z',
  liveLegalHolds: 0,
  exportGenerationId: '00000000-0000-4000-8000-000000000102',
  manifestSha256: 'a'.repeat(64),
  packageSha256: 'b'.repeat(64),
  exportVerifiedAt: '2026-09-01T00:00:00Z',
  archivedAt: '2026-09-01T00:00:00Z',
  purgeAuthorizedAt: null,
  latestPreviewAt: null,
  accessBasis: 'platform console:operate + platform:configure; synthetic tenant only',
  ...overrides,
});

const envelope = (overrides: Partial<PurgePreviewEnvelope> = {}): PurgePreviewEnvelope => ({
  ok: true,
  replayed: false,
  receiptId: '00000000-0000-4000-8000-000000000103',
  generatedAt: '2026-10-26T18:00:00Z',
  snapshotSha256: 'c'.repeat(64),
  preview: {
    caseId: '00000000-0000-4000-8000-000000000101',
    tenantId: 'synthetic-u',
    syntheticOnly: true,
    status: 'archived',
    legalHold: { liveCount: 0, status: 'clear' },
    retention: { retainUntil: '2026-10-01T00:00:00Z', status: 'complete' },
    exportManifest: {
      generationId: '00000000-0000-4000-8000-000000000102', manifestSha256: 'a'.repeat(64),
      packageSha256: 'b'.repeat(64), verifiedAt: '2026-09-01T00:00:00Z', integrity: 'verified', currentCountsMatch: true,
    },
    affectedRecords: { tables: { profiles: 2, role_grants: 3 }, tableCount: 2, totalRecords: 5 },
    approval: {
      proposedAt: '2026-08-01T00:00:00Z', approvedAt: '2026-08-02T00:00:00Z',
      exportVerifiedAt: '2026-09-01T00:00:00Z', archivedAt: '2026-09-01T00:00:00Z',
      purgeAuthorizedAt: null, separationRecorded: true,
    },
    conditionsSatisfiedForFutureReview: false,
    blockers: ['purge_authorization_missing'],
    destructiveAction: { available: false, enabled: false, executed: false, reason: 'No purge or delete operation exists in this preview slice.' },
    fallback: 'No records changed. Resolve the listed evidence blockers, then create a new reviewed preview.',
  },
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
  read: () => Promise<OffboardingCase[]> = async () => [entry()],
  preview: (caseId: string, key: string) => Promise<PurgePreviewEnvelope> = async () => envelope(),
) {
  await act(async () => {
    root.render(
      <Offboarding env="Production" scope="All" filter="" onStatus={status}
        privileged={(run) => void run()} read={read} preview={preview} />,
    );
  });
  await act(async () => {});
}

const button = (label: string) => [...host.querySelectorAll('button')].find((node) => node.textContent === label)!;

describe('synthetic offboarding purge preview', () => {
  it('is explicit that it is synthetic and has no destructive or authorization control', async () => {
    await draw();
    expect(host.textContent).toContain('Synthetic demo tenants only');
    expect(host.textContent).toContain('cannot authorize, enable, or execute deletion');
    expect(host.textContent).toContain('Synthetic tenant');
    const labels = [...host.querySelectorAll('button')].map((node) => node.textContent?.toLowerCase());
    expect(labels.some((label) => label?.includes('purge') || label?.includes('delete') || label?.includes('authorize'))).toBe(false);
  });

  it('uses native disclosure and labelled input controls for keyboard and screen-reader flow', async () => {
    await draw();
    const open = button('Open dry run');
    expect(open.getAttribute('aria-expanded')).toBe('false');
    expect(open.getAttribute('aria-controls')).toBeTruthy();
    await act(async () => open.click());
    expect(open.getAttribute('aria-expanded')).toBe('true');
    const input = host.querySelector('input')!;
    expect(input.labels?.[0]?.textContent).toContain('Reviewed idempotency key');
    expect(host.querySelector('[aria-label="Purge dry run for Synthetic University"]')).toBeTruthy();
    expect(button('Create read-only preview').hasAttribute('disabled')).toBe(true);
  });

  it('renders the exact affected-record summary and the disabled destructive state', async () => {
    const preview = vi.fn(async () => envelope());
    await draw(undefined, preview);
    await act(async () => button('Open dry run').click());
    const input = host.querySelector('input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'review-001');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Create read-only preview').click());
    expect(preview).toHaveBeenCalledWith(entry().caseId, 'review-001');
    expect(host.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(host.textContent).toContain('Destructive action unavailable');
    expect(host.textContent).toContain('5 total');
    expect(host.textContent).toContain('2 · profiles');
    expect(host.textContent).toContain('3 · role_grants');
    expect(host.textContent).toContain('purge_authorization_missing');
    expect(host.textContent).toContain('No records changed');
  });

  it('fails closed on authorization loss and shows a keyboard retry', async () => {
    await draw(async () => { throw new Error('Platform console and configuration authority are required.'); });
    expect(host.textContent).toContain('Offboarding preview is unavailable');
    expect(host.textContent).toContain('No case metadata is shown');
    expect(button('Check access again')).toBeTruthy();
  });

  it('keeps non-archived cases read-only and offers no preview action', async () => {
    await draw(async () => [entry({ status: 'export_verified' })]);
    await act(async () => button('Open dry run').click());
    expect(host.textContent).toContain('not archived');
    expect([...host.querySelectorAll('button')].some((node) => node.textContent === 'Create read-only preview')).toBe(false);
  });

  it('shows a visible no-change fallback when preview is refused', async () => {
    await draw(undefined, async () => { throw new Error('Preview paused: the evidence snapshot changed.'); });
    await act(async () => button('Open dry run').click());
    const input = host.querySelector('input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'review-002');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Create read-only preview').click());
    expect(host.textContent).toContain('Preview paused: the evidence snapshot changed. No records changed.');
    expect(button('Try preview again')).toBeTruthy();
    expect(button('Read case again')).toBeTruthy();
  });
});
