// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { GRADUATION_KEY } from '../lib/graduation';
import { GraduationSimulator } from './GraduationSimulator';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    GRADUATION_KEY,
    JSON.stringify({
      plan: { needed: 120, perTerm: 15, summer: 0, costPerTerm: 20000, summerCost: 0, next: { season: 'Spring', year: 2027 } },
      scenarios: [],
    }),
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

it('projects a finish from the transcript hours and calls it an estimate', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  expect(host.textContent).toContain('Fall 2028');
  expect(host.textContent).toContain('Cost of one more semester: about $20,000.');
  expect(host.textContent).toContain('estimate');
});

it('adds a what-if scenario and compares it with the current plan', () => {
  act(() => root.render(<GraduationSimulator done={60} />));
  const pick = [...host.querySelectorAll('select')].find((s) => s.closest('label')?.textContent?.startsWith('Add a scenario'))!;
  act(() => {
    pick.value = 'minor';
    pick.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).toContain('Add a minor');
  expect(host.textContent).toContain('2 terms more than your current plan. About $40,000 more.');
  expect(JSON.parse(localStorage.getItem(GRADUATION_KEY)!).scenarios).toHaveLength(1);
  expect(host.textContent).not.toMatch(/\bbehind\b|at risk|failing/i);
});
