// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { compareOptions } from '../lib/decision-compare';
import { DecisionTable } from './DecisionTable';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
afterEach(async () => { await act(async () => { roots.splice(0).forEach(root => root.unmount()); }); });

it('keeps facts and official next steps in card and summary comparisons', async () => {
  const comparison = compareOptions('tutoring', [{id: 'a', label: 'Campus tutoring', cost: {money: 'Free', hoursPerWeek: 2}}, {id: 'b', label: 'Private tutor'}], new Date(2026, 9, 1));
  const host = document.createElement('div');
  const root = createRoot(host);
    roots.push(root);
  await act(async () => root.render(<DecisionTable comparison={comparison} />));
  expect(host.querySelector('table')).not.toBeNull();
  for (const label of ['Card view', 'Summary view']) {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === label);
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
    expect(host.querySelector('table')).toBeNull();
    expect(host.textContent).toContain('Campus tutoring');
    expect(host.textContent).toContain('Private tutor');
    expect(host.textContent).toContain('Not known');
    expect(host.textContent).toContain('Official next step');
    expect(host.textContent).toContain('Money: Free');
  }
  await act(async () => root.unmount());
});
