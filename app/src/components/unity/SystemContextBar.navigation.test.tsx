// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
  expect(host.querySelector('.decision-trail summary')?.textContent).toContain('Advising Preparation');
  await press('Start support');
  const choose = host.querySelector<HTMLSelectElement>('[aria-label="Current workflow"]');
  expect(choose).not.toBeNull();
  await act(async () => { choose!.value = 'support-routing'; choose!.dispatchEvent(new Event('change', {bubbles: true})); });
  await press('Plan the appointment');
  expect(host.querySelector('.decision-trail summary')?.textContent).toContain('Support Routing');
});
it('overrides the mobile hide rule and allows the expanded trail to wrap', () => {
  const css = readFileSync('src/styles/unity.css', 'utf8');
  expect(css).toMatch(/\.system-context-workflow\.system-context-trail\s*\{[^}]*display:\s*block/);
  expect(css).toMatch(/\.system-context-workflow\.system-context-trail\s*\{[^}]*white-space:\s*normal/);
});
