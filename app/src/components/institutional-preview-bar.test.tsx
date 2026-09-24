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
  it('discloses synthetic data, institution, persona, and sandbox connection truth', async () => {
    await renderBar();
    expect(host.textContent).toContain('Synthetic preview');
    expect(host.textContent).toContain('Northstar University');
    expect(host.textContent).toContain('Avery Student');
    expect(host.textContent).toContain('Sandbox');
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
