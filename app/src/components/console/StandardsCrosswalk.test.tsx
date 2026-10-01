// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { StandardsCrosswalk } from './StandardsCrosswalk';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('filters mappings by a control ID and shows remaining activation evidence', async () => {
  await act(async () => root.render(<StandardsCrosswalk />));
  expect(host.querySelectorAll('details')).toHaveLength(8);
  const input = host.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'PT-4');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.querySelectorAll('details')).toHaveLength(1);
  expect(host.textContent).toContain('grant/revoke UAT');
  expect(host.textContent).toContain('operating evidence required');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'no-such-control');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(host.textContent).toContain('No mappings match');
});
