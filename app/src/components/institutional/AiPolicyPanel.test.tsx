// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  save: vi.fn(async () => undefined),
  rows: ['assistant', 'tutoring', 'writing', 'advising'].map((feature) => ({
    feature, enabled: false, permittedRoles: [], allowedModes: [], reason: '',
  })),
}));

vi.mock('../../lib/ai-capability-policy', async (original) => ({
  ...(await original<typeof import('../../lib/ai-capability-policy')>()),
  loadAiCapabilityPolicies: async () => mock.rows,
  saveAiCapabilityPolicy: mock.save,
}));

const { AiPolicyPanel } = await import('./AiPolicyPanel');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  mock.save.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it('shows four independent safe-off controls and preserves core workflows', async () => {
  await act(async () => root.render(<AiPolicyPanel school="northstar" />));
  expect(host.querySelectorAll('fieldset')).toHaveLength(4);
  expect(host.textContent).toContain('Every AI capability starts off');
  expect(host.textContent).toContain('do not disable Today, Courses, Calendar');
  expect([...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].every((input) => !input.checked)).toBe(true);
});

it('saves only the edited capability with its selected role, mode and reason', async () => {
  await act(async () => root.render(<AiPolicyPanel school="northstar" />));
  const tutoring = [...host.querySelectorAll('fieldset')].find((field) => field.textContent?.includes('Tutoring'))!;
  const boxes = tutoring.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  await act(async () => {
    boxes[0].click(); // enabled
    boxes[1].click(); // student
    boxes[6].click(); // explain
  });
  const reason = tutoring.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Grade 9 pilot');
    reason.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => [...tutoring.querySelectorAll('button')][0].click());
  expect(mock.save).toHaveBeenCalledWith('northstar', expect.objectContaining({
    feature: 'tutoring', enabled: true, permittedRoles: ['student'], allowedModes: ['explain'], reason: 'Grade 9 pilot',
  }));
});
