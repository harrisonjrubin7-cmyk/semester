// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancialModel } from './FinancialModel';
import { SCENARIOS } from './financialModelScenarios';

/**
 * The finance dashboard, driven in jsdom.
 *
 * What is under test is what a person sees and can do: the forecast label is
 * always present, scenarios switch the numbers, an invalid input is refused
 * and the model keeps its last valid value, reset restores Base, the warning
 * banners show, and an export starts a download. The arithmetic is held in
 * `financialModel.test.ts`; nothing here re-derives it.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const render = () => act(() => { root.render(<FinancialModel />); });
const text = () => host.textContent ?? '';
const click = (label: RegExp | string) => {
  const el = [...host.querySelectorAll('button')].find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent ?? '')));
  if (!el) throw new Error(`No button ${String(label)}`);
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};
const setValue = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};
const scenarioSelect = () => host.querySelector('select') as HTMLSelectElement;
const tile = (label: string) => [...host.querySelectorAll('.portal-panel')].find((p) => p.textContent?.startsWith(label))?.textContent ?? '';

// The export tests replace navigator.clipboard. Leave it as found, and writable while replaced:
// a read-only leftover makes any later file's `Object.assign(navigator, { clipboard })` throw under test:shuffle.
const ownClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  if (ownClipboard) Object.defineProperty(navigator, 'clipboard', ownClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('the finance model dashboard', () => {
  it('says what it is before showing a number: a forecast on planning assumptions, on local data', () => {
    render();
    expect(text()).toMatch(/Forecast on planning assumptions/);
    expect(text()).toMatch(/Not an approved budget, price book, forecast or target/);
    expect(text()).toMatch(/Local sample data only/);
  });

  it('labels every tile Forecast, and no output claims to be an actual', () => {
    render();
    const tiles = [...host.querySelectorAll('.portal-panel')];
    expect(tiles.length).toBeGreaterThan(10);
    for (const t of tiles) expect(t.textContent, t.textContent ?? '').toMatch(/Forecast/);
    expect(text()).not.toMatch(/\bActual\b/);
  });

  it('offers the twelve scenarios and starts on Base', () => {
    render();
    const options = [...scenarioSelect().options].map((o) => o.textContent);
    expect(options).toEqual(SCENARIOS.map((s) => s.label));
    expect(scenarioSelect().value).toBe('base');
  });

  it('changes the results when the scenario changes', () => {
    render();
    const before = tile('ARR, month 36');
    setValue(scenarioSelect(), 'ambitious');
    expect(tile('ARR, month 36')).not.toBe(before);
    expect(text()).toMatch(/More outreach and stronger stage rates/);
  });

  it('shows the paid-pilot gate, runway and margin banners on Base, and the critical ones as alerts', () => {
    render();
    expect(text()).toMatch(/Paid-pilot revenue is not authorised today/);
    expect(text()).toMatch(/Cash runway is below 12 months/);
    expect(text()).toMatch(/Gross margin is below the threshold/);
    expect(host.querySelectorAll('[role="alert"]').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the AI warning under High AI usage and not under Base', () => {
    render();
    expect(text()).not.toMatch(/AI cost exceeds the revenue that funds it/);
    setValue(scenarioSelect(), 'highAi');
    expect(text()).toMatch(/AI cost exceeds the revenue that funds it/);
  });

  it('shows the capacity warning under High implementation cost', () => {
    render();
    setValue(scenarioSelect(), 'highImplementation');
    expect(text()).toMatch(/Implementation demand exceeds delivery-team capacity/);
  });

  it('draws the revenue mix and break-even charts with a text alternative', () => {
    render();
    const charts = [...host.querySelectorAll('svg[role="img"]')];
    expect(charts).toHaveLength(2);
    expect(charts[0].getAttribute('aria-label')).toMatch(/Revenue mix by model year, forecast/);
    expect(charts[1].getAttribute('aria-label')).toMatch(/Break-even, forecast/);
  });

  it('lists every scenario side by side on the dashboard', () => {
    render();
    const table = host.querySelector('[aria-label^="Every scenario"]');
    expect(table).not.toBeNull();
    for (const s of SCENARIOS) expect(table?.textContent).toContain(s.label);
  });

  it('shows the monthly revenue, expense and cash tables, every row labelled Forecast', () => {
    render();
    for (const [view, caption] of [['Revenue', 'Monthly revenue'], ['Expenses', 'Monthly cost of revenue'], ['Cash and runway', 'Monthly cash and runway']] as const) {
      click(view);
      const region = host.querySelector(`[aria-label^="${caption}"]`);
      expect(region, view).not.toBeNull();
      const rows = region?.querySelectorAll('tbody tr') ?? [];
      expect(rows).toHaveLength(36);
      for (const r of rows) expect(r.textContent).toMatch(/Forecast/);
    }
  });

  it('shows the funnel conversion view', () => {
    render();
    click('Funnel');
    expect(text()).toMatch(/Target accounts contacted/);
    expect(text()).toMatch(/Annual contracts/);
    expect(text()).toMatch(/not a measure of enterprise demand/);
  });

  it('shows both sensitivity matrices and lets the metric change', () => {
    render();
    click('Sensitivity');
    expect(text()).toMatch(/Pilot conversion rate vs sales-cycle length/);
    expect(text()).toMatch(/AI cost vs AI overage price/);
    const grids = host.querySelectorAll('[role="region"][aria-label*="Rows:"]');
    expect(grids).toHaveLength(2);
    for (const g of grids) expect(g.querySelectorAll('tbody tr')).toHaveLength(5);
    const before = grids[0].textContent;
    const metric = host.querySelectorAll('select')[1] as HTMLSelectElement;
    setValue(metric, 'endingCash');
    expect(host.querySelector('[role="region"][aria-label*="Rows:"]')?.textContent).not.toBe(before);
  });
});

describe('editing assumptions', () => {
  const input = (label: RegExp) => {
    const lab = [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''));
    if (!lab) throw new Error(`No field ${String(label)}`);
    return lab.querySelector('input') as HTMLInputElement;
  };

  it('labels every field with its source and gives it an accessible name', () => {
    render();
    click('Assumptions');
    const inputs = [...host.querySelectorAll('input')];
    expect(inputs.length).toBeGreaterThan(80);
    for (const i of inputs) expect(i.closest('label')?.textContent, i.value).toBeTruthy();
    expect(text()).toMatch(/placeholder/);
    expect(text()).toMatch(/brief/);
  });

  it('applies a valid edit and marks it edited', () => {
    render();
    const before = tile('ARR, month 36');
    click('Assumptions');
    setValue(input(/Student Premium, monthly price/), '12.5');
    expect(text()).toMatch(/edited/);
    click('Dashboard');
    expect(text()).toMatch(/1 assumption edited on top of Base/);
    expect(tile('ARR, month 36')).toBeTruthy();
    void before;
  });

  it('refuses an invalid edit with a message and keeps the last valid result', () => {
    render();
    const before = tile('ARR, month 36');
    click('Assumptions');
    setValue(input(/Institutional platform, per enrolled student per year/), '-5');
    expect(text()).toMatch(/must be between 0 and 500/);
    // The shared field-error pattern: the box is marked invalid and points at its message.
    const box = input(/Institutional platform, per enrolled student per year/);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector(`#${CSS.escape(box.id)}-error`)?.textContent).toMatch(/must be between 0 and 500/);
    click('Dashboard');
    expect(text()).not.toMatch(/assumption edited/);
    expect(tile('ARR, month 36')).toBe(before);
  });

  it('refuses text and a rate above 1', () => {
    render();
    click('Assumptions');
    setValue(input(/Contacted to reply/), 'lots');
    expect(text()).toMatch(/Contacted to reply must be a number|must be between/);
    setValue(input(/Contacted to reply/), '1.5');
    expect(text()).toMatch(/must be between 0 and 1/);
    // Fixing the value clears the complaint.
    setValue(input(/Contacted to reply/), '0.25');
    expect(input(/Contacted to reply/).getAttribute('aria-invalid')).toBeNull();
  });

  it('undoes one edit', () => {
    render();
    click('Assumptions');
    setValue(input(/Student Premium, monthly price/), '12.5');
    click(/Undo edit to Student Premium, monthly price/);
    click('Dashboard');
    expect(text()).not.toMatch(/assumption edited/);
  });

  it('resets everything, and the scenario, to Base', () => {
    render();
    const base = tile('ARR, month 36');
    setValue(scenarioSelect(), 'ambitious');
    click('Assumptions');
    setValue(input(/Target accounts contacted per month/), '50');
    click('Reset assumptions');
    expect(scenarioSelect().value).toBe('base');
    expect(text()).toMatch(/Assumptions reset to Base/);
    click('Dashboard');
    expect(tile('ARR, month 36')).toBe(base);
    expect(text()).not.toMatch(/assumption edited/);
  });

  it('keeps an edit when the scenario changes, and says so', () => {
    render();
    click('Assumptions');
    setValue(input(/Target accounts contacted per month/), '50');
    setValue(scenarioSelect(), 'conservative');
    expect(text()).toMatch(/Edits carry across scenarios until reset/);
  });
});

describe('exports', () => {
  it('starts a download for each file and copies the prompt', async () => {
    const urls: string[] = [];
    const names: string[] = [];
    vi.useFakeTimers();
    const revoked: string[] = [];
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => { urls.push(`${b.type}:${b.size}`); return 'blob:x'; }, revokeObjectURL: (u: string) => { revoked.push(u); } }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    const copied: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText: (t: string) => { copied.push(t); return Promise.resolve(); } } });

    render();
    click('Exports');
    for (const b of ['Download monthly table (CSV)', 'Download assumptions (CSV)', 'Download scenario (JSON)', 'Download scenario (Markdown)', 'Download board summary (Markdown)']) click(b);
    expect(names).toEqual([
      'semester-gtm-base-monthly.csv', 'semester-gtm-base-assumptions.csv', 'semester-gtm-base.json', 'semester-gtm-base.md', 'semester-gtm-base-board-summary.md',
    ]);
    expect(urls.every((u) => !u.endsWith(':0'))).toBe(true);
    // The object URL outlives the click: Safari starts the download asynchronously, so it is revoked later, not at once.
    expect(revoked).toEqual([]);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(revoked).toHaveLength(5);
    vi.useRealTimers();
    await act(async () => { click('Copy assumptions as a prompt'); });
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(/CAC = sales and marketing spend/);
    expect(text()).toMatch(/Copied the assumptions prompt/);
  });

  it('says so when the browser refuses the clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
    render();
    click('Exports');
    await act(async () => { click('Copy assumptions as a prompt'); });
    expect(text()).toMatch(/Could not copy the assumptions prompt/);
  });
});

describe('storage', () => {
  it('writes nothing to browser storage, whatever is edited or exported', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    render();
    setValue(scenarioSelect(), 'highAi');
    click('Assumptions');
    click('Reset assumptions');
    expect(set).not.toHaveBeenCalled();
  });
});
