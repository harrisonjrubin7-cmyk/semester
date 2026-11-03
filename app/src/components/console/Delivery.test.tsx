// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { DeliveryAccountRow } from '../../lib/console/client';
import { Delivery, HEALTH_LABEL, needsAttention } from './Delivery';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-10-26T12:00:00Z');

const account = (overrides: Partial<DeliveryAccountRow> = {}): DeliveryAccountRow => ({
  billingAccountId: 'b-1', accountName: 'North University', tenantIds: ['north'], tenantNames: ['North'], isDemo: false,
  projects: [{
    id: 'pr-1', tenantId: 'north', stage: 'integrate', status: 'on_track', kickoffAt: null, goLiveAt: null, hasOwner: true,
    milestonesTotal: 3, milestonesDone: 1, milestonesOverdue: 0,
    nextMilestone: { name: 'SIS feed live', ownerRole: 'integration', dueAt: '2026-11-02' },
  }],
  hasSuccessPlan: true, successPlanHasOwner: true, nextQbrAt: '2026-12-10', lastQbrOn: '2026-10-16', qbrCount: 2,
  renewals: [{ contractId: 'c-1', contractKind: 'order_form', renewalDate: '2027-01-24', stage: 'exec_90', outcome: 'pending', decisionOn: null, hasOwner: false }],
  healthStatus: 'healthy', healthReason: 'Feed on schedule.', healthNextAction: 'Prepare the QBR', healthHasOwner: true,
  healthTakenAt: '2026-10-25T09:00:00Z', provenance: 'public.implementation_projects', limitation: 'Recorded dates, not observed use.',
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
  read: (includeDemo?: boolean) => Promise<DeliveryAccountRow[]>,
  { env = 'Production', scope = 'All' }: { env?: 'Production' | 'Staging' | 'Demo'; scope?: string } = {},
) {
  await act(async () => {
    root.render(
      <Delivery env={env} scope={scope} filter="" onStatus={status} privileged={(run) => void run()} read={read} now={NOW} />,
    );
  });
  await act(async () => {});
}

const select = () => host.querySelector('select') as HTMLSelectElement;

describe('delivery portfolio', () => {
  it('shows implementation, renewals and health in words', async () => {
    await draw(async () => [account()]);
    expect(host.textContent).toContain('1 accounts · 0 needing attention · 0 with no health snapshot');
    expect(host.textContent).toContain('Integrate, on track · 1 of 3 milestones done · next: SIS feed live (integration), due 2026-11-02 (in 7 days)');
    expect(host.textContent).toContain('order_form renews 2027-01-24 (in 90 days) · 90-day executive review · outcome pending · owner not assigned');
    expect(host.textContent).toContain('Healthy');
    expect(host.textContent).toContain('2026-10-16 (10 days ago); 2 held');
  });

  it('keeps a missing plan and missing health as missing, never as healthy or zero', async () => {
    await draw(async () => [account({
      hasSuccessPlan: false, successPlanHasOwner: false, nextQbrAt: null, lastQbrOn: null, qbrCount: 0,
      healthStatus: null, healthReason: null, healthNextAction: null, healthHasOwner: false, healthTakenAt: null,
      projects: [], renewals: [],
    })]);
    expect(host.textContent).toContain('Health not recorded');
    expect(host.textContent).not.toContain('Healthy');
    expect(host.textContent).toContain('No implementation project recorded.');
    expect(host.textContent).toContain('No renewal recorded.');
    expect(host.textContent).toContain('Not recorded');
    expect(host.textContent).toContain('none taken');
    expect(host.textContent).toContain('1 with no health snapshot');
  });

  it('filters to accounts needing attention and says why the list is empty', async () => {
    await draw(async () => [account()]);
    await act(async () => {
      select().value = 'attention';
      select().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelectorAll('article')).toHaveLength(0);
    expect(host.textContent).toContain('No accounts match "Needing attention".');
  });

  it('shows no records and implies no count when the read fails', async () => {
    await draw(async () => { throw new Error('network down'); });
    expect(host.textContent).toContain('The delivery portfolio is unavailable. No records are shown, and no count is implied.');
    expect(host.querySelectorAll('article')).toHaveLength(0);
    expect(status).toHaveBeenCalledWith('network down');
  });

  it('names the missing duties when the server refuses', async () => {
    await draw(async () => { throw new Error('success:manage at platform scope is required.'); });
    expect(host.textContent).toContain('Access denied. The delivery portfolio requires the platform console shell and success:manage at platform scope.');
  });

  it('reads production without demo schools and offers no demo toggle there', async () => {
    const read = vi.fn(async () => [] as DeliveryAccountRow[]);
    await draw(read);
    expect(read).toHaveBeenCalledWith(false);
    expect(host.textContent).not.toContain('Include demo schools');
    expect(host.textContent).toContain('No institution accounts are recorded in this scope.');
  });

  it('offers the demo toggle outside production and passes it to the read', async () => {
    const read = vi.fn(async () => [] as DeliveryAccountRow[]);
    await draw(read, { env: 'Staging' });
    const box = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => { box.click(); });
    await act(async () => {});
    expect(read).toHaveBeenLastCalledWith(true);
  });

  it('keeps an account with no school out of a single-school scope', async () => {
    await draw(async () => [account({ tenantIds: [], tenantNames: [] }), account({ billingAccountId: 'b-2', tenantIds: ['south'] })], { scope: 'north' });
    expect(host.querySelectorAll('article')).toHaveLength(0);
  });
});

describe('needs attention', () => {
  it('flags a worrying snapshot, a blocked project or a late milestone', () => {
    expect(needsAttention(account())).toBe(false);
    expect(needsAttention(account({ healthStatus: 'implementation_blocked' }))).toBe(true);
    expect(needsAttention(account({ projects: [{ ...account().projects[0], status: 'blocked' }] }))).toBe(true);
    expect(needsAttention(account({ projects: [{ ...account().projects[0], milestonesOverdue: 1 }] }))).toBe(true);
    expect(needsAttention(account({ healthStatus: null }))).toBe(false);
  });

  it('labels every health status the database allows', () => {
    for (const s of ['healthy', 'needs_attention', 'at_risk_commercial', 'implementation_blocked', 'compliance_action', 'renewal_planning', 'expansion'] as const) {
      expect(HEALTH_LABEL[s]).toBeTruthy();
    }
  });
});
