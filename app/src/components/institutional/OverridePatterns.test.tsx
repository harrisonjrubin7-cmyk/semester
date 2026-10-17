// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverridePattern } from '../../lib/governance/override-review';
import { OverridePatterns } from './OverridePatterns';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pattern = (overrides: Partial<OverridePattern> = {}): OverridePattern => ({
  domain: 'academic_record',
  ruleRef: 'grade',
  overrides: 4,
  people: 2,
  firstAt: Date.parse('2026-09-01T12:00:00Z'),
  lastAt: Date.parse('2026-10-14T09:30:00Z'),
  last90Days: 4,
  recurring: true,
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = async (element: React.ReactNode) => {
  await act(async () => { root.render(element); });
};

describe('OverridePatterns', () => {
  it('does not query or render without the verified review capability', async () => {
    const load = vi.fn(async () => [pattern()]);
    await render(<OverridePatterns tenantId="northstar" canReview={false} load={load} />);
    expect(load).not.toHaveBeenCalled();
    expect(host.textContent).toBe('');
  });

  it('shows aggregate details without creating markup from untrusted rule text', async () => {
    const pending = deferred<OverridePattern[]>();
    await render(<OverridePatterns tenantId="tenant-secret" canReview load={() => pending.promise} />);
    expect(host.textContent).toContain('Loading override patterns');

    await act(async () => pending.resolve([
      pattern({ ruleRef: 'grade<script>alert(1)</script>', people: 0, firstAt: null, lastAt: null }),
      pattern({ domain: 'permission', ruleRef: 'break_glass.access', overrides: 2, people: 1, last90Days: 2, recurring: false }),
    ]));

    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toContain('Grade<script>alert(1)</script>');
    expect(host.textContent).toContain('Person count unavailable');
    expect(host.textContent).toContain('Date unavailable');
    expect(host.textContent).toContain('Break glass access');
    expect(host.textContent).toContain('Showing 2 of 2 patterns');
    expect(host.textContent).not.toContain('tenant-secret');
    expect(host.querySelectorAll('details')).toHaveLength(2);
    const summary = host.querySelector('summary') as HTMLElement;
    summary.focus();
    expect(document.activeElement).toBe(summary);
  });

  it('keeps the native disclosure summary and contains a maximum-length rule label', async () => {
    const ruleRef = 'x'.repeat(80);
    await render(<OverridePatterns tenantId="northstar" canReview load={async () => [pattern({ ruleRef })]} />);

    const summary = host.querySelector('summary');
    expect(summary?.querySelector('.override-review-summary-body')).toBeTruthy();
    expect(summary?.querySelector('.override-review-rule')?.textContent).toBe(ruleRef[0].toUpperCase() + ruleRef.slice(1));
  });

  it('filters by domain and recurrence with native keyboard controls', async () => {
    await render(<OverridePatterns tenantId="northstar" canReview load={async () => [
      pattern({ ruleRef: 'grade' }),
      pattern({ domain: 'permission', ruleRef: 'break_glass.access', overrides: 2, people: 1, last90Days: 2, recurring: false }),
      pattern({ domain: 'integration', ruleRef: 'sis.feed_hold', overrides: 3, people: 2, last90Days: 3, recurring: true }),
    ]} />);
    const select = host.querySelector('select[aria-label="Domain"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    await act(async () => {
      select.value = 'permission';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.textContent).toContain('Showing 1 of 3 patterns');
    expect(host.textContent).toContain('Break glass access');
    expect(host.textContent).not.toContain('Sis feed hold');

    await act(async () => {
      select.value = 'all';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const recurring = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Recurring')!;
    expect(recurring.type).toBe('button');
    recurring.focus();
    expect(document.activeElement).toBe(recurring);
    await act(async () => recurring.click());
    expect(recurring.getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('Showing 2 of 3 patterns');
    expect(host.textContent).not.toContain('Break glass access');
  });

  it('offers a retry after a generic load failure', async () => {
    const load = vi.fn<(_: string) => Promise<OverridePattern[]>>()
      .mockRejectedValueOnce(new Error('provider detail'))
      .mockResolvedValueOnce([pattern()]);
    await render(<OverridePatterns tenantId="northstar" canReview load={load} />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Override patterns are unavailable');
    expect(host.textContent).not.toContain('provider detail');
    const retry = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Try again')!;
    await act(async () => retry.click());
    expect(host.textContent).toContain('Grade');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('uses an honest empty state that does not claim nothing happened', async () => {
    await render(<OverridePatterns tenantId="northstar" canReview load={async () => []} />);
    expect(host.textContent).toContain('No readable patterns are available');
    expect(host.textContent).toContain('This does not show overrides from domains that do not write to the shared log');
    expect(host.textContent).not.toContain('No overrides occurred');
  });

  it('ignores responses from an old tenant or a capability that was removed', async () => {
    const northstar = deferred<OverridePattern[]>();
    const lakeside = deferred<OverridePattern[]>();
    const loads = new Map([
      ['northstar', northstar.promise],
      ['lakeside', lakeside.promise],
    ]);
    const load = (tenant: string) => loads.get(tenant)!;

    await render(<OverridePatterns tenantId="northstar" canReview load={load} />);
    await render(<OverridePatterns tenantId="lakeside" canReview load={load} />);
    await act(async () => lakeside.resolve([pattern({ ruleRef: 'lakeside_rule' })]));
    expect(host.textContent).toContain('Lakeside rule');
    await act(async () => northstar.resolve([pattern({ ruleRef: 'northstar_rule' })]));
    expect(host.textContent).toContain('Lakeside rule');
    expect(host.textContent).not.toContain('Northstar rule');

    const afterRemoval = deferred<OverridePattern[]>();
    await render(<OverridePatterns tenantId="lakeside" canReview load={() => afterRemoval.promise} />);
    await render(<OverridePatterns tenantId="lakeside" canReview={false} load={() => afterRemoval.promise} />);
    await act(async () => afterRemoval.resolve([pattern({ ruleRef: 'late_rule' })]));
    expect(host.textContent).toBe('');
  });
});
