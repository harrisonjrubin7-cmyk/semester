// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_PRODUCTIVITY } from '../lib/productivity';

const loadWorkspace = vi.fn();
const deleteWorkspace = vi.fn();

vi.mock('../lib/cloud', () => ({ cloudConfigured: true }));
vi.mock('../lib/productivity-cloud', () => ({
  loadWorkspace,
  deleteWorkspace,
  saveWorkspace: vi.fn(),
  productivityAggregate: vi.fn(),
}));

const { ProductivityCloud } = await import('./ProductivityCloud');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  loadWorkspace.mockResolvedValue({
    revision: 3,
    data: EMPTY_PRODUCTIVITY,
    tenantId: null,
    shareAggregate: false,
    updatedAt: '2026-10-11T12:00:00Z',
  });
  deleteWorkspace.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

const button = (name: string) => [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === name) as HTMLButtonElement;
const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const mountAndLoad = async () => {
  act(() => root.render(<ProductivityCloud who="student-a" value={EMPTY_PRODUCTIVITY} replace={() => true} />));
  await act(async () => button('Load cloud copy for review').click());
};

it('previews account-only cloud deletion before writing and preserves the device boundary', async () => {
  await mountAndLoad();
  act(() => button('Delete my cloud copy').click());

  const dialog = host.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(text()).toContain('Deletes revision 3 of this private workspace from your signed-in account');
  expect(text()).toContain('The workspace on this device stays unchanged');
  expect(text()).toContain('Export the reviewed cloud copy before deleting it if you need its exact contents');
  expect(document.activeElement?.textContent).toBe('Cancel');
  expect(deleteWorkspace).not.toHaveBeenCalled();

  act(() => button('Cancel').click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(deleteWorkspace).not.toHaveBeenCalled();

  act(() => button('Delete my cloud copy').click());
  await act(async () => button('Delete cloud copy').click());
  expect(deleteWorkspace).toHaveBeenCalledWith('student-a');
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(text()).toContain('Cloud copy deleted. Device copy retained.');
});

it('keeps a refused deletion available to retry without claiming success', async () => {
  deleteWorkspace.mockRejectedValueOnce(new Error('service unavailable'));
  await mountAndLoad();
  act(() => button('Delete my cloud copy').click());
  await act(async () => button('Delete cloud copy').click());

  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  expect(text()).toContain('service unavailable');
  expect(text()).not.toContain('Cloud copy deleted. Device copy retained.');

  await act(async () => button('Delete cloud copy').click());
  expect(deleteWorkspace).toHaveBeenCalledTimes(2);
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});
