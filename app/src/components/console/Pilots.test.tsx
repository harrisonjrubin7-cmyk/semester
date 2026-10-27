// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { PilotPortfolioRow } from '../../lib/console/client';
import { Pilots, pilotNextStep, PILOT_PROBLEM_LABEL } from './Pilots';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-10-26T12:00:00Z');

const row = (overrides: Partial<PilotPortfolioRow> = {}): PilotPortfolioRow => ({
  pilotId: 'p-1', accountId: 'a-1', accountPublicId: 'acct_north', accountName: 'North University',
  accountStatus: 'pilot', segment: 'research', tenantId: 'north', tenantName: 'North University', isDemo: false,
  workflow: 'Advising holds', status: 'active', startDate: '2026-09-01', endDate: '2027-03-02',
  midpointReviewDate: '2026-12-01', conversionDate: '2027-03-02', hasSponsor: true, hasChampion: true,
  annualPriceAgreed: true, productionDataApproved: false, metricCount: 3, readinessProblems: [],
  outcomeDecision: null, outcomeSignedAt: null, unresolvedHighSeverity: null, updatedAt: '2026-10-20T10:00:00Z',
  provenance: 'public.gtm_pilots', limitation: 'Pipeline records as sales entered them.',
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
  read: (includeDemo?: boolean) => Promise<PilotPortfolioRow[]>,
  { env = 'Production', scope = 'All' }: { env?: 'Production' | 'Staging' | 'Demo'; scope?: string } = {},
) {
  await act(async () => {
    root.render(
      <Pilots env={env} scope={scope} filter="" onStatus={status} privileged={(run) => void run()} read={read} now={NOW} />,
    );
  });
  await act(async () => {});
}

const select = () => host.querySelector('select') as HTMLSelectElement;

describe('pilot portfolio', () => {
  it('lists pilots with readiness in words and counts by status', async () => {
    await draw(async () => [
      row(),
      row({ pilotId: 'p-2', accountName: 'Prospect State', tenantId: null, tenantName: null, status: 'proposed', readinessProblems: ['no_price', 'metric_count'] }),
    ]);
    expect(host.textContent).toContain('1 active · 1 proposed · 0 decided');
    expect(host.textContent).toContain('Annual price not agreed');
    expect(host.textContent).toContain('Needs three to five success metrics');
    expect(host.textContent).toContain('Not yet a Semester school');
    expect(host.textContent).toContain('Readiness: ✓ the recorded plan passes every check.');
  });

  it('filters by status and says why the list is empty', async () => {
    await draw(async () => [row()]);
    await act(async () => {
      select().value = 'decided';
      select().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelectorAll('article')).toHaveLength(0);
    expect(host.textContent).toContain('No decided pilots match.');
  });

  it('shows no records and implies no count when the read fails', async () => {
    await draw(async () => { throw new Error('network down'); });
    expect(host.textContent).toContain('The pilot portfolio is unavailable. No records are shown, and no count is implied.');
    expect(host.querySelectorAll('article')).toHaveLength(0);
    expect(status).toHaveBeenCalledWith('network down');
  });

  it('names the missing duties when the server refuses', async () => {
    await draw(async () => { throw new Error('account:manage at platform scope is required.'); });
    expect(host.textContent).toContain('Access denied. The pilot portfolio requires the platform console shell and account:manage at platform scope.');
  });

  it('reads production without demo schools and offers no demo toggle there', async () => {
    const read = vi.fn(async () => [] as PilotPortfolioRow[]);
    await draw(read);
    expect(read).toHaveBeenCalledWith(false);
    expect(host.textContent).not.toContain('Include demo schools');
    expect(host.textContent).toContain('No pilots are recorded in this scope.');
  });

  it('keeps a pilot with no school out of a single-school scope', async () => {
    await draw(async () => [row({ tenantId: null, tenantName: null })], { scope: 'north' });
    expect(host.querySelectorAll('article')).toHaveLength(0);
  });

  it('labels an unrecognised readiness code instead of hiding it', async () => {
    await draw(async () => [row({ status: 'proposed', readinessProblems: ['brand_new_rule'] })]);
    expect(host.textContent).toContain('Unrecognised readiness code: brand_new_rule');
  });
});

describe('pilot next step', () => {
  it('points a proposed pilot at its gaps or at the move to active', () => {
    expect(pilotNextStep(row({ status: 'proposed', readinessProblems: ['no_price'] }), NOW)).toMatch(/Close 1 readiness gap /);
    expect(pilotNextStep(row({ status: 'proposed' }), NOW)).toMatch(/passes readiness/);
  });

  it('raises a due midpoint, a near conversion and an overdue decision', () => {
    expect(pilotNextStep(row({ midpointReviewDate: '2026-11-02' }), NOW)).toMatch(/Midpoint review is due in 7 day/);
    expect(pilotNextStep(row({ midpointReviewDate: '2026-09-30', conversionDate: '2026-11-15' }), NOW)).toMatch(/conversion decision is due in 20 day/);
    expect(pilotNextStep(row({ conversionDate: '2026-10-20' }), NOW)).toMatch(/passed 6 day/);
    expect(pilotNextStep(row(), NOW)).toMatch(/No review is due/);
  });

  it('never calls a decided pilot signed without an outcome', () => {
    expect(pilotNextStep(row({ status: 'decided', outcomeDecision: 'convert' }), NOW)).toMatch(/Outcome signed: convert/);
    expect(pilotNextStep(row({ status: 'decided' }), NOW)).toMatch(/no signed outcome was returned/);
  });

  it('labels every readiness code the database emits', () => {
    for (const code of ['duration', 'no_cohort', 'no_baseline', 'no_sponsor', 'no_champion', 'data_plan', 'metric_count',
      'metric_baseline', 'no_conversion_date', 'conversion_outside_window', 'no_price', 'no_midpoint', 'not_found']) {
      expect(PILOT_PROBLEM_LABEL[code]).toBeTruthy();
    }
  });
});
