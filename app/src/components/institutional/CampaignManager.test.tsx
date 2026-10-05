// @vitest-environment jsdom
/**
 * The campaign manager, driven through an injected client. The client is the
 * only fake; the screen, its copy, its gating and the attribution builder are
 * the shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TARGETABLE_FIELDS } from '../../lib/gtm/campaign';
import type { CampaignApi, CampaignRow } from '../../lib/gtm/manager';
import { hasStandardAttribution } from '../../lib/gtm/utm';
import { CampaignManager } from './CampaignManager';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ME = 'user-me';
const APPROVER = 'user-approver';

const base: CampaignRow = {
  id: 'c1', tenant_id: 'vu', public_id: 'cmp_x', name: 'Admitted — deposit', objective: 'deposit', cycle: 'fall2027',
  audience: 'admitted', funnel_stage: 7, audience_criteria: [{ field: 'lifecycle_stage', op: 'eq', value: '7' }],
  channels: ['email'], start_date: '2027-03-01', end_date: '2027-05-01', review_date: null, primary_cta: '',
  owner_id: ME, approver_id: APPROVER, privacy_basis: '', consent_requirements: [], frequency_max: null,
  frequency_window_days: null, quiet_start: 21, quiet_end: 8, landing_page: null, success_metric: '', baseline: null,
  escalation_path: '', claims_substantiated: false, opt_out_tested: false, conversion_instrumentation_tested: false,
  status: 'draft', updated_at: '2026-09-27T12:00:00Z',
};

function fake(rows: CampaignRow[], over: Partial<CampaignApi> = {}) {
  const api = {
    list: vi.fn(async () => rows),
    create: vi.fn(async () => 'c2'),
    save: vi.fn(async () => undefined),
    move: vi.fn(async () => undefined),
    failures: vi.fn(async () => ['flag', 'privacy_basis', 'review:accessibility,brand,privacy']),
    audienceCount: vi.fn(async () => 1840),
    reviews: vi.fn(async () => []),
    review: vi.fn(async () => undefined),
    report: vi.fn(async () => [{ metric: 'sent', value: 1200 }, { metric: 'stage_8', value: null }]),
    ...over,
  };
  return api as unknown as CampaignApi & Record<keyof CampaignApi, ReturnType<typeof vi.fn>>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function mount(api: CampaignApi, viewerId: string | null = ME) {
  await act(async () => {
    root.render(<CampaignManager tenantId="vu" viewerId={viewerId} api={api} />);
  });
}
const buttons = () => [...host.querySelectorAll('button')];
const button = (re: RegExp) => buttons().find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined) {
  expect(el, 'control not found').toBeTruthy();
  await act(async () => el!.click());
}
function type(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const field = (label: RegExp) =>
  [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input, select') as HTMLInputElement;

describe('the campaign list', () => {
  it('says so when the account can see no campaigns', async () => {
    await mount(fake([]));
    expect(host.textContent).toContain('No campaigns yet');
  });

  it('lists the school’s campaigns with stage and status', async () => {
    await mount(fake([base]));
    expect(host.textContent).toContain('Admitted — deposit');
    expect(host.textContent).toContain('7. Admitted student');
    expect(host.textContent).toContain('Draft');
  });

  it('creates a draft with link-safe names', async () => {
    const api = fake([]);
    await mount(api);
    await click(button(/New campaign/i));
    await act(async () => {
      type(field(/^Name/), 'Fall deposit push');
      type(field(/^Objective/), 'Deposit Reminder');
      type(field(/^Cycle/), 'Fall 2027');
      type(field(/^Audience name/), 'Admitted');
      type(field(/^Starts/), '2027-03-01');
      type(field(/^Ends/), '2027-05-01');
    });
    await act(async () => {
      host.querySelector('form')!.requestSubmit();
    });
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'vu', objective: 'deposit-reminder', cycle: 'fall-2027', audience: 'admitted', funnelStage: 3, channels: ['email'],
    }));
  });
});

describe('a campaign', () => {
  async function open(api: CampaignApi, viewerId: string | null = ME) {
    await mount(api, viewerId);
    await click(button(/Admitted — deposit/));
  }

  it('shows what still stands between it and activation, in sentences', async () => {
    await open(fake([base]));
    const list = host.querySelector('[aria-label="Still to do before activation"]')!;
    expect(list.textContent).toMatch(/campaign module is not on/);
    expect(list.textContent).toMatch(/privacy basis/);
    expect(list.textContent).toMatch(/accessibility, brand, privacy review/);
  });

  it('offers only allow-listed fields for the audience', async () => {
    await open(fake([base]));
    const options = [...(field(/^Field/) as unknown as HTMLSelectElement).options].map((o) => o.value);
    expect(options.sort()).toEqual(Object.keys(TARGETABLE_FIELDS).sort());
    expect(options).not.toContain('gpa');
    expect(options).not.toContain('financial_aid_status');
    expect(host.textContent).toContain('1840 contacts match today.');
  });

  it('builds a standard attribution link from the campaign’s own names', async () => {
    const api = fake([base]);
    await open(api);
    await act(async () => type(field(/^Page address/), 'https://vu.example/admitted'));
    const code = host.querySelector('code')!.textContent!;
    expect(hasStandardAttribution(code)).toBe(true);
    expect(code).toContain('utm_campaign=vu_fall2027_admitted_deposit');
    await click(button(/Use as the landing page/));
    await click(button(/Save draft/));
    expect(api.save).toHaveBeenCalledWith('c1', expect.objectContaining({ landing_page: code }));
  });

  it('refuses a link builder address that carries other data', async () => {
    await open(fake([base]));
    await act(async () => type(field(/^Page address/), 'https://vu.example/x?email=a@b.edu'));
    expect(host.textContent).toMatch(/no other parameters/);
    expect(button(/Use as the landing page/)).toBeUndefined();
  });

  it('keeps Activate shut while anything is left on the checklist, and opens it when nothing is', async () => {
    await open(fake([{ ...base, status: 'approved' }]));
    expect(button(/^Activate$/i)!.disabled).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(host);
    const ready = fake([{ ...base, status: 'approved' }], { failures: vi.fn(async () => []) });
    await open(ready);
    expect(host.textContent).toContain('This campaign can be activated');
    const activate = button(/^Activate$/i)!;
    expect(activate.disabled).toBe(false);
    await click(activate);
    expect(ready.move).toHaveBeenCalledWith('c1', 'active');
  });

  it('shows Approve only to the named approver', async () => {
    await open(fake([{ ...base, status: 'in_review' }]), ME);
    expect(button(/^Approve$/i)).toBeUndefined();
    await act(async () => root.unmount());
    root = createRoot(host);
    await open(fake([{ ...base, status: 'in_review' }]), APPROVER);
    expect(button(/^Approve$/i)).toBeTruthy();
  });

  it('locks everything but the status once it leaves draft', async () => {
    await open(fake([{ ...base, status: 'in_review' }]));
    expect(field(/^Name/).disabled).toBe(true);
    expect(button(/Save draft/)).toBeUndefined();
    expect(host.textContent).toMatch(/every review has to be done again/);
  });

  it('records a review only while the campaign is in review', async () => {
    const api = fake([{ ...base, status: 'in_review' }]);
    await open(api);
    await act(async () => {
      type(field(/^Reviewprivacy/) as unknown as HTMLSelectElement, 'accessibility');
    });
    await act(async () => {
      (host.querySelector('form[aria-label="Record a review"]') as HTMLFormElement).requestSubmit();
    });
    expect(api.review).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), 'accessibility', 'approved', '');
  });

  it('shows a refused move as the database’s sentence', async () => {
    const api = fake([base], { move: vi.fn(async () => { throw new Error('Your account cannot move this campaign.'); }) });
    await open(api);
    await click(button(/Send for review/i));
    expect(host.textContent).toContain('Your account cannot move this campaign.');
  });

  it('shows results with small counts suppressed, once it is live', async () => {
    await open(fake([{ ...base, status: 'active' }]));
    const table = host.querySelector('table')!;
    expect(table.textContent).toContain('1200');
    expect(table.textContent).toContain('fewer than 10');
  });
});
