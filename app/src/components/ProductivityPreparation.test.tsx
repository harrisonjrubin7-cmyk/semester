// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  EMPTY_PRODUCTIVITY,
  newDecision,
  type Productivity,
} from '../lib/productivity';
const { dispatch, ask } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  ask: vi.fn(),
}));
vi.mock('../state/store', () => ({
  useStore: () => ({
    account: { id: 'student-a' },
    dispatch,
    state: { appointments: [] },
  }),
}));
vi.mock('../lib/assistant', () => ({
  configured: () => true,
  routeLabel: () => 'Test assistant',
}));
vi.mock('../lib/university', () => ({ gatewayConfigured: false }));
vi.mock('../lib/claude', () => ({ ask }));
import { ProductivityPreparation } from './ProductivityPreparation';
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find(
    (b) => b.textContent === text,
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
async function input(label: string, text: string) {
  const parent = [...host.querySelectorAll('label')].find((x) =>
    x.textContent?.startsWith(label),
  );
  const field = parent?.querySelector('input');
  expect(field).toBeInstanceOf(HTMLInputElement);
  if (!(field instanceof HTMLInputElement)) throw new Error(`Missing input labelled ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
it('requires reviewed context and keeps generated output in an editable queue', async () => {
  const d = newDecision('Research');
  d.reflection = 'PRIVATE';
  let value: Productivity = { ...EMPTY_PRODUCTIVITY, decisions: [d] };
  ask.mockResolvedValue('Draft to review');
  await act(async () =>
    root.render(
      <ProductivityPreparation
        value={value}
        decision={d}
        save={(change) => {
          value = change(value);
          return true;
        }}
      />,
    ),
  );
  await input('Request', 'Prepare advisor questions');
  await click('Preview assistant context');
  expect(ask).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('PRIVATE');
  await click('Send reviewed context and prepare');
  expect(ask).toHaveBeenCalledOnce();
  expect(value.drafts).toHaveLength(0);
  await click('Save reviewed draft');
  expect(value.drafts[0].body).toBe('Draft to review');
});
it('invalidates a plan preview when assumptions change before application', async () => {
  const d = newDecision('Study');
  const render = () =>
    root.render(
      <ProductivityPreparation
        value={{ ...EMPTY_PRODUCTIVITY, decisions: [d] }}
        decision={d}
        save={() => true}
      />,
    );
  await act(async () => render());
  await input('First study date', '2026-10-02');
  await click('Preview plan propagation');
  d.assumptions = [
    {
      id: 'a',
      label: 'Work hours',
      value: '20',
      owner: 'student',
      source: '',
      impacts: '',
      review: false,
    },
  ];
  await act(async () => render());
  await click('Add reviewed study blocks to Calendar');
  expect(dispatch).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Decision changed');
});
