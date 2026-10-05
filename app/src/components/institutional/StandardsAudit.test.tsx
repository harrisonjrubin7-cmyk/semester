// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StandardsAudit } from './StandardsAudit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<StandardsAudit />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === name)!;

describe('the standards audit experience', () => {
  it('renders evidence-derived release blockers and keeps them when the view is filtered', () => {
    const before = host.querySelector('[role="status"]')!.textContent;
    expect(before).toContain('Release blocked');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(32);
    const search = host.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'does-not-exist-unique');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(host.textContent).toContain('No requirements match');
    expect(host.querySelector('[role="status"]')!.textContent).toBe(before);
  });

  it('lets procurement reviewers inspect privacy mappings and all questionnaire items', () => {
    act(() => button('Education data map').click());
    expect(host.querySelectorAll('tbody tr')).toHaveLength(16);
    expect(host.textContent).toContain('No raw financial detail');
    act(() => button('Procurement questions').click());
    expect(host.querySelectorAll('ol li')).toHaveLength(65);
    expect(host.textContent).toContain('Answers require review');
    expect(host.querySelector('nav')).toBeNull();
    expect(host.querySelector('main')).toBeNull();
  });

  it('shows operational blockers and evidence details without granting write authority', () => {
    const mode = host.querySelector('select') as HTMLSelectElement;
    act(() => { mode.value = 'Operate'; mode.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector('[role="status"]')!.textContent).toContain('Release blocked');
    expect(host.textContent).toContain('Official-record writes: not authorized');
    expect(host.querySelectorAll('details').length).toBeGreaterThan(30);
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(5);
  });
});
