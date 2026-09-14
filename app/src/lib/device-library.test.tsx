// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDeviceLibrary } from './device-library';

/**
 * The six ways a device library is asked to lose somebody's work.
 *
 * Each of these is a real sequence rather than a unit: corrupt bytes arriving
 * *after* the hook mounted, a second tab saving between this tab's render and
 * its next edit, a quota refusal, an account switch. They are written against
 * a mounted component and a real `localStorage` because every one of them is a
 * question about ordering, and a hook called directly has no ordering.
 *
 * The assertion that matters in half of them is on `localStorage` rather than
 * on the hook: what the screen shows after a refused write is a nicety, and
 * what is still on disk is the student's term.
 */

const EMPTY: string[] = [];

const read = (v: unknown) => {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new Error('Invalid list');
  return v as string[];
};

let root: Root;
let host: HTMLDivElement;

/*
 * The hook's latest return, published from an effect rather than assigned
 * during render. Every `act` flushes effects before it resolves, so `lib` is
 * the value of the render the test just caused — and the render itself stays
 * free of the side effect that writing to an outer binding would be.
 */
const box: { lib: ReturnType<typeof useDeviceLibrary<string[]>> | null } = { lib: null };
const lib = () => box.lib as ReturnType<typeof useDeviceLibrary<string[]>>;

function Harness({ scope = 'a' }: { scope?: string }) {
  const value = useDeviceLibrary(scope, read, EMPTY);
  useEffect(() => {
    box.lib = value;
  });
  return (
    <p>
      {value.value.join(',')}|{value.error}|{String(value.blocked)}
    </p>
  );
}

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('device workspace saving', () => {
  it('does not overwrite corrupt data on opening or editing', async () => {
    localStorage.setItem('a', 'broken');
    await act(async () => root.render(<Harness />));
    expect(lib().blocked).toBe(true);
    await act(async () => expect(lib().update(['new'])).toBe(false));
    expect(localStorage.getItem('a')).toBe('broken');
  });

  it('uses another tab’s latest save before applying an update', async () => {
    localStorage.setItem('a', '["first"]');
    await act(async () => root.render(<Harness />));
    localStorage.setItem('a', '["first","other tab"]');
    await act(async () => lib().update((old) => [...old, 'here']));
    expect(lib().value).toEqual(['first', 'other tab', 'here']);
  });

  it('does not overwrite corruption introduced after opening', async () => {
    await act(async () => root.render(<Harness />));
    localStorage.setItem('a', 'broken');
    await act(async () => expect(lib().update(['new'])).toBe(false));
    expect(localStorage.getItem('a')).toBe('broken');
  });

  it('responds to removal, clearing and successful recovery in another tab', async () => {
    localStorage.setItem('a', 'broken');
    await act(async () => root.render(<Harness />));
    localStorage.setItem('a', '["restored"]');
    await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: 'a' })));
    expect(lib().blocked).toBe(false);
    expect(lib().value).toEqual(['restored']);

    localStorage.clear();
    await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expect(lib().value).toEqual([]);
  });

  it('separates keys when switching accounts or terms', async () => {
    localStorage.setItem('a', '["private a"]');
    localStorage.setItem('b', '["private b"]');
    await act(async () => root.render(<Harness />));
    await act(async () => root.render(<Harness scope="b" />));
    expect(lib().value).toEqual(['private b']);
    await act(async () => lib().update((old) => [...old, 'edit']));
    expect(localStorage.getItem('a')).toBe('["private a"]');
  });

  it('keeps saved state unchanged when storage refuses a write and permits retry', async () => {
    localStorage.setItem('a', '["saved"]');
    await act(async () => root.render(<Harness />));
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await act(async () => expect(lib().update(['unsaved'])).toBe(false));
    expect(lib().value).toEqual(['saved']);
    expect(lib().error).toContain('quota');

    spy.mockRestore();
    await act(async () => expect(lib().update(['retry'])).toBe(true));
    expect(lib().value).toEqual(['retry']);
  });
});
