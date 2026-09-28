// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * The banner is there for the whole of a read-only build, and absent
 * otherwise. Two imports of the component under two answers from
 * `lib/readonly`, because the flag is read at module load, like every other
 * build switch in the app.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.doUnmock('../lib/readonly');
  vi.resetModules();
});

async function render(readOnly: boolean) {
  vi.resetModules();
  vi.doMock('../lib/readonly', async (importOriginal) => {
    const real = await importOriginal<typeof import('../lib/readonly')>();
    return { ...real, READ_ONLY: readOnly };
  });
  const { ReadOnlyBanner } = await import('./ReadOnlyBanner');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(<ReadOnlyBanner />));
  return host;
}

describe('ReadOnlyBanner', () => {
  it('says the one sentence, as a status region, in a read-only build', async () => {
    const host = await render(true);
    const banner = host.querySelector('[role="status"]');
    expect(banner?.textContent).toBe('Read-only mode: your changes stay on this device until it ends.');
  });

  it('renders nothing at all otherwise — the control', async () => {
    const host = await render(false);
    expect(host.innerHTML).toBe('');
  });
});
