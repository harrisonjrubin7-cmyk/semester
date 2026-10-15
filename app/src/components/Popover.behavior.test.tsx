// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Popover, type Corner } from './Popover';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
const frames: HTMLElement[] = [];
let contentHeight = 180;
const observers: { callback: ResizeObserverCallback; target: Element | null; disconnected: boolean }[] = [];

beforeEach(() => {
  contentHeight = 180;
  observers.splice(0);
  vi.stubGlobal('innerWidth', 320);
  vi.stubGlobal('innerHeight', 480);
  vi.stubGlobal('ResizeObserver', class {
    readonly record;
    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, target: null as Element | null, disconnected: false };
      observers.push(this.record);
    }
    observe(target: Element) { this.record.target = target; }
    unobserve() { this.record.target = null; }
    disconnect() { this.record.disconnected = true; }
  });
  // jsdom does not lay out elements. Supply the browser's measured result at
  // the DOM seam, including the authored viewport limits, rather than mocking
  // the component's placement or exposing its private calculation.
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('role') !== 'dialog') return 0;
    const requested = Number.parseFloat(this.style.width);
    return this.style.maxWidth === 'calc(100vw - 16px)'
      ? Math.min(requested, window.innerWidth - 16)
      : requested;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('role') !== 'dialog') return 0;
    return this.style.maxHeight === 'calc(100dvh - 16px)'
      ? Math.min(contentHeight, window.innerHeight - 16)
      : contentHeight;
  });
});

afterEach(async () => {
  await act(async () => { roots.splice(0).forEach(root => root.unmount()); });
  frames.splice(0).forEach(frame => frame.remove());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Counter() {
  const [count, setCount] = useState(0);
  return <button type="button" onClick={() => setCount(count + 1)}>Saved preference {count}</button>;
}

function Example({ corner, width = 544, initiallyOpen = true, onClose }: {
  corner: Corner;
  width?: number;
  initiallyOpen?: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return <>
    <button type="button" ref={setAnchor} onClick={() => setOpen(!open)}>Reading tools</button>
    <Popover label="Reading preferences" corner={corner} width={width} open={open} anchor={anchor} onClose={() => { onClose(); setOpen(false); }}>
      <Counter />
    </Popover>
    <button type="button">Outside action</button>
  </>;
}

async function setup(options: Parameters<typeof Example>[0]) {
  const frame = document.createElement('div');
  frame.className = 'device';
  const host = document.createElement('div');
  host.style.overflow = 'hidden';
  frame.append(host);
  document.body.append(frame);
  frames.push(frame);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(<Example {...options} />));
  return {
    frame,
    host,
    panel: frame.querySelector<HTMLElement>('[role="dialog"]')!,
    opener: host.querySelector<HTMLButtonElement>('button')!,
    outside: [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Outside action')!,
  };
}

function bounds(panel: HTMLElement) {
  const left = Number.parseFloat(panel.style.left);
  const top = Number.parseFloat(panel.style.top);
  return { left, top, right: left + panel.offsetWidth, bottom: top + panel.offsetHeight };
}

async function resizeContent(height: number) {
  contentHeight = height;
  await act(async () => {
    for (const observer of observers.filter(observer => !observer.disconnected && observer.target)) {
      observer.callback([], {} as ResizeObserver);
    }
  });
}

describe('shared popover behavior', () => {
  it('keeps a wide panel reachable inside a narrow window and outside its clipped opener', async () => {
    const { panel, frame, host } = await setup({ corner: { x: 260, y: 70 }, onClose: vi.fn() });
    expect(panel.parentElement).toBe(frame);
    expect(host.contains(panel)).toBe(false);
    expect(bounds(panel)).toEqual({ left: 8, top: 70, right: 312, bottom: 250 });
  });

  it('opens above a low anchor, and contains content taller than the window', async () => {
    const { panel } = await setup({ corner: { x: 10, y: 440 }, onClose: vi.fn() });
    expect(bounds(panel)).toEqual({ left: 8, top: 256, right: 312, bottom: 436 });
    await resizeContent(900);
    expect(bounds(panel)).toEqual({ left: 8, top: 8, right: 312, bottom: 472 });
    expect(panel.style.overflowY).toBe('auto');
  });

  it('repositions when the window shrinks while the panel is open', async () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    const { panel } = await setup({ corner: { x: 690, y: 610 }, width: 232, onClose: vi.fn() });
    expect(bounds(panel)).toEqual({ left: 690, top: 610, right: 922, bottom: 790 });
    vi.stubGlobal('innerWidth', 320);
    vi.stubGlobal('innerHeight', 480);
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(bounds(panel)).toEqual({ left: 80, top: 292, right: 312, bottom: 472 });
  });

  it('moves growing content above its anchor before the lower controls leave the window', async () => {
    contentHeight = 120;
    const { panel } = await setup({ corner: { x: 20, y: 340 }, width: 232, onClose: vi.fn() });
    expect(bounds(panel).top).toBe(340);
    await resizeContent(220);
    expect(bounds(panel)).toEqual({ left: 20, top: 116, right: 252, bottom: 336 });
  });

  it('dismisses on Escape and outside pointerdown, but keeps inside and opener actions usable', async () => {
    const onClose = vi.fn();
    const { panel, opener, outside } = await setup({ corner: { x: 20, y: 70 }, initiallyOpen: false, onClose });
    opener.focus();
    await act(async () => opener.click());
    const preference = panel.querySelector<HTMLButtonElement>('button')!;
    expect(document.activeElement).toBe(preference);
    await act(async () => preference.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    await act(async () => opener.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => preference.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
    await act(async () => opener.click());
    await act(async () => outside.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('preserves preferences when closed and only measures, focuses and dismisses while open', async () => {
    const onClose = vi.fn();
    const { panel, opener, outside } = await setup({ corner: { x: 20, y: 70 }, initiallyOpen: false, onClose });
    expect(panel.hidden).toBe(true);
    expect(observers).toHaveLength(0);
    outside.focus();
    await act(async () => outside.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outside);
    opener.focus();
    await act(async () => opener.click());
    const preference = panel.querySelector<HTMLButtonElement>('button')!;
    await act(async () => preference.click());
    expect(preference.textContent).toBe('Saved preference 1');
    await act(async () => preference.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(observers.every(observer => observer.disconnected)).toBe(true);
    const closedBounds = bounds(panel);
    vi.stubGlobal('innerWidth', 250);
    await act(async () => window.dispatchEvent(new Event('resize')));
    await act(async () => outside.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    await act(async () => preference.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(Number.parseFloat(panel.style.left)).toBe(closedBounds.left);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
    await act(async () => opener.click());
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('button')).toBe(preference);
    expect(preference.textContent).toBe('Saved preference 1');
    expect(document.activeElement).toBe(preference);
    expect(bounds(panel).right).toBe(242);
  });
});
