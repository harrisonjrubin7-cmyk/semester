// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { offline, watchConnection } from './offline';

/** `navigator.onLine` is read-only, so it is stood on its head for a test. */
function pretend(online: boolean | undefined): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

afterEach(() => {
  pretend(true);
});

describe('whether there is a connection', () => {
  it('is believed when it says no', () => {
    pretend(false);
    expect(offline()).toBe(true);
  });

  it('is not treated as proof of anything when it says yes', () => {
    // The flag says a network interface exists, not that anything is
    // reachable, so "online" only ever means "worth trying".
    pretend(true);
    expect(offline()).toBe(false);
  });

  it('says nothing when the browser says nothing', () => {
    pretend(undefined);
    expect(offline()).toBe(false);
  });
});

describe('watching for it to change', () => {
  it('hears the connection go and come back', () => {
    const heard: boolean[] = [];
    const stop = watchConnection((online) => heard.push(online));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(heard).toEqual([false, true]);
    stop();
  });

  it('stops when told, so a screen that has gone is not still listening', () => {
    const then = vi.fn();
    watchConnection(then)();
    window.dispatchEvent(new Event('offline'));
    expect(then).not.toHaveBeenCalled();
  });
});
