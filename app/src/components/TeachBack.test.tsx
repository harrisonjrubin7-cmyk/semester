// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { StudySource } from '../lib/studystudio';

const mock = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock('../lib/claude', () => ({ ask: mock.ask }));
const { TeachBack } = await import('./TeachBack');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.ask.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const SOURCES: StudySource[] = [
  { id: 's1', title: 'Chapter 1.pdf', locator: 'Page 3', text: 'The opportunity cost of a choice is the value of the next best alternative given up.' },
];

const render = (ready: boolean) => act(() => root.render(<TeachBack courseId="econ" sources={SOURCES} ready={ready} />));
const type = (label: string, value: string) => {
  const el = [...host.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))!.querySelector('input, textarea') as HTMLInputElement;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const send = () => [...host.querySelectorAll('button')].find((b) => /Send my explanation/.test(b.textContent ?? '')) as HTMLButtonElement;

it('sends nothing until the Studio’s consent and policy gates are met', () => {
  render(false);
  type('Topic', 'Opportunity cost');
  type('Your explanation', 'It is what you give up.');
  expect(send().disabled).toBe(true);
  expect(host.textContent).toContain('tick the consent above first');
  expect(mock.ask).not.toHaveBeenCalled();
});

it('shows only checked points, with their sources, and no grade', async () => {
  render(true);
  type('Topic', 'Opportunity cost');
  type('Your explanation', 'It is what you give up.');
  mock.ask.mockResolvedValue(
    JSON.stringify({
      unsupported: false,
      covered: [{ point: 'It is a trade-off', sourceId: 's1', quote: 'the value of the next best alternative given up' }],
      missing: [{ point: 'Invented', sourceId: 's1', quote: 'Something the chapter never says at all.' }],
      conflicts: [],
    }),
  );
  await act(async () => send().click());
  expect(mock.ask.mock.calls[0][0].courseId).toBe('econ');
  expect(host.textContent).toContain('What you covered');
  expect(host.textContent).toContain('Chapter 1.pdf · Page 3');
  expect(host.textContent).not.toContain('Invented');
  expect(host.textContent).toContain('1 point was left out');
  expect(host.textContent).not.toMatch(/\d+\s*(%|\/\s*10)|score/i);
});
