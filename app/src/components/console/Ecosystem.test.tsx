// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { Ecosystem } from './Ecosystem';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const mount = (filter = '') => act(async () => root.render(<Ecosystem filter={filter} />));
const text = () => host.textContent ?? '';
const choose = async (label: string) => {
  const tab = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((button) => button.textContent === label);
  expect(tab).toBeDefined();
  await act(async () => tab!.click());
};

it('leads with the evidence boundary and complete handoff populations', async () => {
  await mount();
  expect(text()).toContain('specification evidence only');
  expect(text()).toContain('26 workspaces · 281 screen contracts · 122 capabilities');
  expect(text()).toContain('Personal Education OS');
  expect(text()).toContain('Institution Operating OS');
  expect(text()).toContain('Semester Company OS');
});

it('exposes every supplied workspace and route through a keyboard-operable tab', async () => {
  await mount();
  await choose('Workspaces');
  expect(host.querySelectorAll('details')).toHaveLength(26);
  expect(text()).toContain('#/student/today');
  expect(text()).toContain('#/operations/home');
  expect(text()).toContain('#/studio/home');
});

it('exposes every capability without promoting archive status into runtime evidence', async () => {
  await mount();
  await choose('Capabilities');
  expect(host.querySelectorAll('details')).toHaveLength(122);
  expect(text()).toContain('Runtime status');
  expect(text()).toContain('archive status is not promoted');
});

it('uses the shared console filter and names an empty result', async () => {
  await mount('no-such-workspace-or-capability');
  await choose('Workspaces');
  expect(text()).toContain('No workspaces match this console filter.');
  await choose('Capabilities');
  expect(text()).toContain('No capabilities match this console filter.');
});

