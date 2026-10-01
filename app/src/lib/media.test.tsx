// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useMedia } from './media';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
    writable: true,
  });
});

describe('useMedia', () => {
  it('falls back to the base layout when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    const host = document.createElement('div');
    const root = createRoot(host);

    function Probe() {
      return <span>{useMedia('(min-width: 1200px)') ? 'wide' : 'base'}</span>;
    }

    expect(() => {
      act(() => root.render(<Probe />));
    }).not.toThrow();
    expect(host.textContent).toBe('base');

    act(() => root.unmount());
  });
});
