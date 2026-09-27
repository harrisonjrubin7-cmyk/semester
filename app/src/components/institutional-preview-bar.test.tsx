// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InstitutionalPreviewBar } from './InstitutionalPreviewBar';
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
    expect(summary).toContain('No real student data');
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
  });

  it('hides for this page load, and a fresh mount brings it back', async () => {
    await renderBar();
    const hide = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Hide');
    await act(async () => hide?.click());
    expect(host.textContent).toBe('');

    act(() => root.unmount());
    root = createRoot(host);
    await renderBar();
    expect(host.textContent).toContain('Demo environment');
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
