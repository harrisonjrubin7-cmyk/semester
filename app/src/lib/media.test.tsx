// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMedia } from './media';

let root: Root;
let host: HTMLDivElement;
let descriptor: PropertyDescriptor | undefined;
function Probe({ query = '(min-width: 840px)' }: { query?: string }) {
  return <output>{String(useMedia(query))}</output>;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  descriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  if (descriptor) Object.defineProperty(window, 'matchMedia', descriptor);
  else Reflect.deleteProperty(window, 'matchMedia');
  vi.unstubAllGlobals();
});
describe('media query availability', () => {
  it('keeps the compact layout usable when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    act(() => root.render(<Probe />));
    expect(host.textContent).toBe('false');
  });
  it('still follows query changes and falls back if the API disappears', () => {
    let matches = true;
    let change: (() => void) | undefined;
    const mql = {
      get matches() { return matches; },
      addEventListener: (_event: string, listener: () => void) => { change = listener; },
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => mql });
    act(() => root.render(<Probe />));
    expect(host.textContent).toBe('true');
    act(() => { matches = false; change?.(); });
    expect(host.textContent).toBe('false');
    act(() => { matches = true; change?.(); });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
    act(() => root.render(<Probe query="(min-width: 1200px)" />));
    expect(host.textContent).toBe('false');
  });
});
