// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const barcode = vi.hoisted(() => ({
  canScan: vi.fn(() => true),
  scanFrame: vi.fn(() => new Promise<string>(() => undefined)),
}));

vi.mock('../lib/barcode', () => barcode);

import { ScanIsbn } from './ScanIsbn';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let getUserMedia: ReturnType<typeof vi.fn>;
let stop: ReturnType<typeof vi.fn>;

const button = (label: string) => [...host.querySelectorAll('button')].find((item) => item.textContent === label);

beforeEach(() => {
  stop = vi.fn();
  getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const render = () => act(() => root.render(<ScanIsbn onFound={() => undefined} />));

describe('the ISBN camera permission flow', () => {
  it('explains the camera boundary before asking the browser', () => {
    render();
    act(() => button('Scan the barcode on the book')?.click());

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Read the ISBN printed on the back of this book.');
    expect(host.textContent).toContain('Only while this scanner is open.');
    expect(host.textContent).toContain('Type the ISBN or book title in the field above.');
    expect(host.textContent).toContain('Images stay on this device and are not uploaded.');
    expect(host.querySelector('[data-semester-design="archive-2026-10-08"]')).not.toBeNull();
  });

  it('keeps the typed fallback available without opening the camera', () => {
    render();
    act(() => button('Scan the barcode on the book')?.click());
    act(() => button('Not now')?.click());

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Not now. You can turn this on later');
    act(() => button('Type the ISBN')?.click());
    expect(host.textContent).not.toContain('Use your camera?');
  });

  it('opens the rear camera only after confirmation and releases it when stopped', async () => {
    render();
    act(() => button('Scan the barcode on the book')?.click());
    await act(async () => {
      button('Open camera')?.click();
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } });
    expect(host.querySelector('video')?.getAttribute('aria-label')).toBe('Camera preview for the barcode');
    act(() => button('Stop scanning')?.click());
    expect(stop).toHaveBeenCalledOnce();
  });

  it('reports a refused camera without claiming that typing is blocked', async () => {
    getUserMedia.mockRejectedValue(new DOMException('refused', 'NotAllowedError'));
    render();
    act(() => button('Scan the barcode on the book')?.click());
    await act(async () => {
      button('Open camera')?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Camera access was not allowed');
    expect(host.textContent).toContain('Type the ISBN');
    expect(host.querySelector('video')).toBeNull();
  });
});
