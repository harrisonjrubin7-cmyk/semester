// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { StoreProvider, useStore } from '../../state/store';
import { loadSeed } from '../../data/seed';
import { SystemContextBar } from './SystemContextBar';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeAll(async () => { await loadSeed(); });
beforeEach(() => {
  localStorage.clear(); window.location.hash = '';
  window.matchMedia = (() => ({matches: false, addEventListener() {}, removeEventListener() {}})) as unknown as typeof window.matchMedia;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
function Harness() {
  const {dispatch} = useStore();
  return <><button onClick={() => dispatch({type: 'go', screen: 'meet'})}>Start advising</button><button onClick={() => dispatch({type: 'go', screen: 'support'})}>Start support</button><SystemContextBar /></>;
}
const press = async (text: string) => { await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === text)!.click()); };
it('preserves advising and selected support workflow at shared destinations', async () => {
  await act(async () => root.render(<StoreProvider><Harness /></StoreProvider>));
  await press('Start advising');
  await press('Review the path');
  expect(host.querySelector('.decision-trail .system-tool-trigger')?.getAttribute('aria-label')).toMatch(/^Steps \d+\/\d+ — Advising Preparation decision trail$/);
  await press('Start support');
  const choose = host.querySelector<HTMLSelectElement>('[aria-label="Current workflow"]');
  expect(choose).not.toBeNull();
  await act(async () => { choose!.value = 'support-routing'; choose!.dispatchEvent(new Event('change', {bubbles: true})); });
  await press('Plan the appointment');
  expect(host.querySelector('.decision-trail .system-tool-trigger')?.getAttribute('aria-label')).toMatch(/^Steps \d+\/\d+ — Support Routing decision trail$/);
});
it('keeps the workflow name in its selector and opens a concise, dismissible trail', async () => {
  await act(async () => root.render(<StoreProvider><Harness /></StoreProvider>));
  await press('Start support');
  const disclosure = host.querySelector<HTMLElement>('.decision-trail')!;
  const trigger = disclosure.querySelector<HTMLButtonElement>('.system-tool-trigger')!;
  expect(trigger.textContent).toMatch(/^Steps\d+\/\d+$/);
  const visibleLabel = trigger.textContent!;
  expect(trigger.getAttribute('aria-label')?.replace(/\s/g, '')).toContain(visibleLabel);
  await act(async () => trigger.click());
  const panel = host.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(panel.style.position).toBe('fixed');
  expect(panel.hidden).toBe(false);
  expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  await act(async () => panel.querySelector<HTMLButtonElement>('[aria-label^="Close "]')!.click());
  expect(panel.hidden).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
