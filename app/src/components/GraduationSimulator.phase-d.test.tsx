// @vitest-environment jsdom
import { WIDE } from '../lib/media';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { GRADUATION_KEY, type GraduationData } from '../lib/graduation';

const saved: unknown[] = [];
const removed: string[] = [];
vi.mock('../lib/graduation-cloud', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/graduation-cloud')>();
  return {
    ...real,
    saveDraft: vi.fn(async (_user: string, row: unknown, id?: string) => {
      saved.push(row);
      return id ?? '0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b';
    }),
    deleteDraft: vi.fn(async (id: string) => {
      removed.push(id);
    }),
  };
});

const { GraduationSimulator } = await import('./GraduationSimulator');

/**
 * Phase D on #762's simulator: the comparison card, the new presets, the cost
 * planner, saving a draft to the account behind a confirmation, and sharing
 * with an advisor behind one — and, as the control, the simulator with both
 * flags off, which must be #762's.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let wide = false;

const PLAN: GraduationData = {
  plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 20_000, summerCost: 5_000, next: { season: 'Spring', year: 2027 } },
  scenarios: [],
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(GRADUATION_KEY, JSON.stringify(PLAN));
  window.matchMedia = ((q: string) => ({
    matches: wide && q === WIDE,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  saved.length = 0;
  removed.length = 0;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  wide = false;
});

const mount = (flags: { simulator: boolean; costs: boolean; accountId?: string | null }) =>
  act(() => root.render(<GraduationSimulator done={60} accountId={flags.accountId ?? null} simulator={flags.simulator} costs={flags.costs} />));
const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const choose = (preset: string) => {
  const select = [...host.querySelectorAll('select')].find((s) => s.closest('label')?.textContent?.includes('Add a scenario'))!;
  act(() => {
    select.value = preset;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};
const stored = (): GraduationData => JSON.parse(localStorage.getItem(GRADUATION_KEY)!);

describe('with both flags off', () => {
  it('is #762’s simulator', () => {
    mount({ simulator: false, costs: false });
    const options = [...host.querySelectorAll('option')].map((o) => o.value);
    expect(options).not.toContain('abroad');
    expect(options).not.toContain('twelve');
    choose('minor');
    expect(host.querySelector('.scenario-compare')).toBeNull();
    expect(host.querySelector('.cost-planner')).toBeNull();
    expect(button(/Share with your advisor/)).toBeUndefined();
  });

  it('follows the flags, which no build variable sets here', () => {
    act(() => root.render(<GraduationSimulator done={60} />));
    choose('minor');
    expect(host.querySelector('.scenario-compare')).toBeNull();
  });
});

describe('with graduation_simulator on', () => {
  it('offers 12 instead of 15, study abroad and one extra term', () => {
    mount({ simulator: true, costs: false });
    const options = [...host.querySelectorAll('option')].map((o) => o.value);
    expect(options).toEqual(expect.arrayContaining(['twelve', 'abroad', 'extra', 'drop', 'minor', 'switch', 'summer', 'part', 'heavy']));
  });

  it('compares side by side in a real table on a wide screen', () => {
    wide = true;
    mount({ simulator: true, costs: false });
    choose('minor');
    const table = host.querySelector('.scenario-compare table')!;
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Estimate', 'Current plan', 'Add a minor', 'Change']);
    const finish = [...table.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('th')?.textContent === 'Estimated finish')!;
    expect([...finish.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['Fall 2028', 'Fall 2029', '+2 terms']);
    expect(text()).toContain('Planning guidance only');
    expect(text()).toMatch(/Sequence: Semester cannot see/);
  });

  it('shows what changes first, and one plan at a time, on a phone', () => {
    mount({ simulator: true, costs: false });
    choose('twelve');
    expect(host.querySelector('.scenario-compare table')).toBeNull();
    expect(host.querySelector('.scenario-changes')?.textContent).toContain('Term load (credits): 15 a term → 12 a term');
    const list = () => host.querySelector('.scenario-list')!;
    expect(list().getAttribute('aria-label')).toBe('12 credits a term');
    act(() => button(/^Current plan$/)!.click());
    expect(list().getAttribute('aria-label')).toBe('Current plan');
  });

  it('lets a study-abroad term be edited, and says transfer credit is the school’s to decide', () => {
    mount({ simulator: true, costs: false });
    choose('abroad');
    const field = [...host.querySelectorAll('input')].find((i) => i.closest('label')?.textContent?.includes('Credits you expect to transfer'))!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '9');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(stored().scenarios[0].abroad).toEqual({ terms: 1, credits: 9, costPerTerm: null });
    expect(text()).toContain('Transfer credit from study abroad is decided by your school');
  });

  it('saves a draft to the account only after showing exactly what will be stored', async () => {
    mount({ simulator: true, costs: false, accountId: 'user-1' });
    choose('minor');
    act(() => button(/^Save draft to your account$/)!.click());
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Estimated finish: Fall 2029');
    expect(dialog.textContent).toContain('Labelled: Estimated');
    expect(saved).toHaveLength(0);
    expect(document.activeElement?.textContent).toBe('Cancel');
    await act(async () => button(/^Save to account$/)!.click());
    expect(saved).toHaveLength(1);
    expect(stored().scenarios[0].cloudIds).toEqual({ 'user-1': '0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b' });
    expect(text()).toContain('Saved to your account as an estimate.');
    act(() => button(/^Remove from account$/)!.click());
    const confirmRemove = [...host.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Remove from account') as HTMLButtonElement;
    await act(async () => confirmRemove.click());
    expect(removed).toEqual(['0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b']);
    expect(stored().scenarios[0].cloudIds).toBeUndefined();
  });

  it('never tells another account on this device that the draft is in theirs', async () => {
    mount({ simulator: true, costs: false, accountId: 'user-1' });
    choose('minor');
    act(() => button(/^Save draft to your account$/)!.click());
    await act(async () => button(/^Save to account$/)!.click());
    expect(stored().scenarios[0].cloudIds).toEqual({ 'user-1': '0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b' });
    mount({ simulator: true, costs: false, accountId: 'user-2' });
    expect(text()).not.toContain('Saved to your account as an estimate.');
    expect(button(/^Remove from account$/)).toBeUndefined();
    act(() => button(/^Save draft to your account$/)!.click());
    await act(async () => button(/^Save to account$/)!.click());
    // A new row in the second account, not an update of the first account's.
    const calls = vi.mocked((await import('../lib/graduation-cloud')).saveDraft).mock.calls;
    expect(calls.at(-1)?.[0]).toBe('user-2');
    expect(calls.at(-1)?.[2]).toBeUndefined();
  });

  it('keeps each account’s draft when two save the same scenario on one device', async () => {
    const cloudMod = await import('../lib/graduation-cloud');
    const original = vi.mocked(cloudMod.saveDraft).getMockImplementation()!;
    onTestFinished(() => void vi.mocked(cloudMod.saveDraft).mockImplementation(original));
    vi.mocked(cloudMod.saveDraft).mockImplementation(async (user: string, row: unknown, id?: string) => {
      saved.push(row);
      return id ?? (user === 'user-1' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222');
    });
    mount({ simulator: true, costs: false, accountId: 'user-1' });
    choose('minor');
    act(() => button(/^Save draft to your account$/)!.click());
    await act(async () => button(/^Save to account$/)!.click());
    mount({ simulator: true, costs: false, accountId: 'user-2' });
    act(() => button(/^Save draft to your account$/)!.click());
    await act(async () => button(/^Save to account$/)!.click());
    expect(stored().scenarios[0].cloudIds).toEqual({
      'user-1': '11111111-1111-4111-8111-111111111111',
      'user-2': '22222222-2222-4222-8222-222222222222',
    });
    // Back to the first account: its draft is still its own, and updating it
    // updates that row rather than making a second one.
    mount({ simulator: true, costs: false, accountId: 'user-1' });
    act(() => button(/^Update in your account$/)!.click());
    await act(async () => button(/^Save to account$/)!.click());
    expect(vi.mocked(cloudMod.saveDraft).mock.calls.at(-1)?.slice(0, 1)).toEqual(['user-1']);
    expect(vi.mocked(cloudMod.saveDraft).mock.calls.at(-1)?.[2]).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('does not offer the account when nobody is signed in', () => {
    mount({ simulator: true, costs: false });
    choose('minor');
    expect(button(/Save draft to your account/)).toBeUndefined();
    expect(text()).toContain('Sign in to save drafts to your account too.');
  });

  it('shares with an advisor by previewing, then copying — never sending', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mount({ simulator: true, costs: false });
    choose('minor');
    act(() => button(/^Share with your advisor$/)!.click());
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Semester does not send this to anyone');
    expect(dialog.textContent).toContain('Add a minor compared with your current plan');
    expect(writeText).not.toHaveBeenCalled();
    await act(async () => button(/^Copy to share$/)!.click());
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(text()).toContain('Semester did not send it anywhere');
  });
});

describe('with cost_planner on', () => {
  it('builds the cost per term from labelled lines, and the projection follows', () => {
    mount({ simulator: false, costs: true });
    expect(text()).toContain('costs before any aid');
    act(() => button(/^Add$/)!.click());
    // The figures typed before itemising come along as lines of their own,
    // rather than being replaced by the new line's zero.
    expect(stored().plan.costPerTerm).toBe(20_000);
    expect(stored().plan.summerCost).toBe(5_000);
    const tuition = [...host.querySelectorAll('.cost-line')].at(-1)!;
    const amount = [...tuition.querySelectorAll('input')].find((i) => i.closest('label')?.textContent?.includes('Amount'))!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(amount, '18000');
      amount.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(stored().plan.costPerTerm).toBe(38_000);
    expect(stored().plan.costLines?.[0]).toMatchObject({ label: 'Earlier estimate', amount: 20_000, per: 'term' });
    expect(stored().plan.costLines?.at(-1)).toMatchObject({ label: 'Tuition', amount: 18_000, source: 'student_entered' });
    // The plain cost fields step aside once the lines decide the total.
    expect([...host.querySelectorAll('label')].some((l) => l.textContent?.startsWith('Cost per fall or spring'))).toBe(false);
  });

  it('labels a copied figure Imported and asks where and when it came from', () => {
    mount({ simulator: false, costs: true });
    act(() => button(/^Add$/)!.click());
    const source = [...host.querySelectorAll<HTMLSelectElement>('.cost-line select')].find((s) => s.closest('label')?.textContent?.includes('Where it came from'))!;
    act(() => {
      source.value = 'imported';
      source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.querySelector('.cost-line [data-source="imported"]')).not.toBeNull();
    expect(text()).toContain('Copied from');
    expect(text()).toContain('Copied on');
    expect(host.querySelector('[data-source="institution_verified"]')).toBeNull();
  });
});
