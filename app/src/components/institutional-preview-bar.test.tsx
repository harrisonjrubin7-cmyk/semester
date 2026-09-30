// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eraseDevice } from '../lib/erase';
import { InstitutionalPreviewBar } from './InstitutionalPreviewBar';

vi.mock('../lib/erase', () => ({ eraseDevice: vi.fn(async () => ({ keys: 0 })) }));
import { InstitutionalPreviewProvider } from './institutional/PreviewContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  sessionStorage.clear();
});

async function renderBar() {
  // Warm the lazy data chunk so this test measures the rendered controls,
  // not Vite's first transform of the fixture module.
  await import('../data/institutional-preview');
  await act(async () => {
    root.render(
      <InstitutionalPreviewProvider>
        <InstitutionalPreviewBar />
      </InstitutionalPreviewProvider>,
    );
  });
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

describe('institutional preview bar', () => {
  it('says it is a demo in the closed state, and nothing technical', async () => {
    await renderBar();
    const summary = host.querySelector('summary')?.textContent ?? '';
    expect(summary).toContain('Demo environment');
    expect(summary).toContain('Sample university');
    expect(summary).toContain('Fictional data');
    // Visible without opening anything, and never behind the disclosure.
    expect(host.querySelector('details')?.textContent ?? '').not.toContain('Nothing you do here is sent to Semester.');
    expect(host.textContent).toContain('Nothing you do here is sent to Semester.');
    // The adapter vocabulary the old panel led with.
    expect(summary).not.toMatch(/synthetic|sandbox/i);
    expect(host.textContent).not.toMatch(/sandbox|transaction network/i);
  });

  it('keeps the institution, persona and source truth one click away', async () => {
    await renderBar();
    const details = host.querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain('Northstar University');
    expect(details?.textContent).toContain('Avery Student');
    expect(details?.textContent).toContain('Payments: not connected');
    expect(details?.textContent).toContain('Reset the sample');
  });

  it('says which roles are and are not in the sample, without inventing a view for the ones that are not', async () => {
    await renderBar();
    const text = host.querySelector('details')?.textContent ?? '';
    expect(text).toContain('There are 12 roles to try.');
    expect(text).toContain('Registrar, gift-officer and K-12 parent views are planned and are not in this sample.');
    const roles = [...host.querySelectorAll<HTMLSelectElement>('select')[1].options].map((o) => o.value);
    expect(roles.some((v) => /registrar|gift|k12/i.test(v))).toBe(false);
  });

  it('cannot be hidden, and is there again on a fresh mount', async () => {
    await renderBar();
    expect([...host.querySelectorAll('button')].some((b) => /^hide$/i.test(b.textContent ?? ''))).toBe(false);
    expect(host.textContent).toContain('Demo environment');

    act(() => root.unmount());
    root = createRoot(host);
    await renderBar();
    expect(host.textContent).toContain('Demo environment');
  });

  it('resets the sample by erasing the device and reloading, and says so while it does', async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { value: { ...original, reload }, configurable: true, writable: true });
    try {
      await renderBar();
      const reset = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Reset the sample');
      expect(reset).toBeDefined();
      await act(async () => reset?.click());
      // Nothing is erased on the first click: the demo shares its origin with the real app.
      expect(eraseDevice).not.toHaveBeenCalled();
      expect(host.textContent).toContain('if you also use the real app here');
      const keep = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Keep what is here');
      await act(async () => keep?.click());
      expect(eraseDevice).not.toHaveBeenCalled();
      expect(host.textContent).not.toContain('if you also use the real app here');
      await act(async () => [...host.querySelectorAll('button')].find((b) => b.textContent === 'Reset the sample')?.click());
      const confirm = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Yes, erase and start the sample again');
      await act(async () => confirm?.click());
      expect(eraseDevice).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { value: original, configurable: true, writable: true });
    }
  });

  it('still reloads if part of the erase is refused', async () => {
    vi.mocked(eraseDevice).mockRejectedValueOnce(new Error('storage refused'));
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { value: { ...original, reload }, configurable: true, writable: true });
    try {
      await renderBar();
      const reset = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Reset the sample');
      await act(async () => reset?.click());
      const confirm = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Yes, erase and start the sample again');
      await act(async () => confirm?.click());
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { value: original, configurable: true, writable: true });
    }
  });

  it('switches fixture context in memory', async () => {
    await renderBar();
    const selects = host.querySelectorAll<HTMLSelectElement>('select');
    await act(async () => {
      selects[0].value = 'cedar-coast';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.textContent).toContain('Cedar Coast College');

    await act(async () => {
      selects[1].value = 'cedar-coast-advisor';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(host.textContent).toContain('Devon Advisor');
  });

  it('contains no production identity or grant persistence path', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/InstitutionalPreviewBar.tsx'), 'utf8');
    expect(source).not.toContain('profiles.school_id');
    expect(source).not.toContain('claim_school');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toContain('persist');
  });
});
