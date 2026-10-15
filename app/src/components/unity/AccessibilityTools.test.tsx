// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityTools } from './AccessibilityTools';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
afterEach(async () => { await act(async () => { roots.splice(0).forEach(root => root.unmount()); }); vi.unstubAllGlobals(); });

async function openTools(host: HTMLElement) {
  await act(async () => {
    host.querySelector<HTMLButtonElement>('.system-tool-trigger')!.click();
    await import('./AccessibilityPanel');
  });
}

describe('global accessibility tools', () => {
  it('opens outside the clipped page and closes with Escape, returning focus', async () => {
    const frame = document.createElement('div');
    frame.className = 'device';
    const host = document.createElement('div');
    host.style.overflow = 'hidden';
    frame.append(host);
    document.body.append(frame);
    const root = createRoot(host);
    roots.push(root);
    try {
      await act(async () => root.render(<AccessibilityTools look={{}} onChange={() => {}} onSettings={() => {}} />));
      host.querySelector<HTMLButtonElement>('.system-tool-trigger')!.focus();
      await openTools(host);
      const panel = frame.querySelector<HTMLElement>('[role="dialog"]')!;
      const trigger = host.querySelector<HTMLButtonElement>('.system-tool-trigger')!;
      expect(host.contains(panel)).toBe(false);
      expect(panel.parentElement).toBe(frame);
      expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      await act(async () => panel.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
      expect(panel.hidden).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    } finally {
      await act(async () => root.unmount());
      frame.remove();
    }
  });
  it('loads controls only on opening and retains narration while closed', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', {cancel, speak: vi.fn()});
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text; } });
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({toString: () => 'Text'} as Selection);
    const host = document.createElement('div');
    const root = createRoot(host);
    roots.push(root);
    try {
      await act(async () => root.render(<AccessibilityTools look={{}} onChange={() => {}} onSettings={() => {}} />));
      const trigger = host.querySelector<HTMLButtonElement>('.system-tool-trigger')!;
      expect(trigger.textContent).toBe('Accessibility');
      // The panel is not in the document yet. A control that names it anyway is
      // the broken `aria-controls` the accessibility smoke reports on every journey.
      expect(trigger.hasAttribute('aria-controls')).toBe(false);
      expect(host.querySelector('[role="dialog"]')).toBeNull();
      await openTools(host);
      const controls = host.querySelector<HTMLElement>('[role="dialog"][aria-label="Accessibility tools"]');
      expect(trigger.getAttribute('aria-controls')).toBe(controls?.id);
      await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Read aloud')!.click());
      const before = cancel.mock.calls.length;
      await act(async () => host.querySelector<HTMLButtonElement>('.system-tool-trigger')!.click());
      expect(cancel.mock.calls.length).toBe(before);
      // Closing keeps the mounted panel, so the relationship has to stay pointed at it.
      expect(controls?.hidden).toBe(true);
      expect(trigger.getAttribute('aria-controls')).toBe(controls?.id);
      await openTools(host);
      expect(host.querySelector('[role="dialog"][aria-label="Accessibility tools"]')).toBe(controls);
      expect(host.querySelector('[role="status"]')?.textContent).toBe('Reading aloud.');
    } finally { selection.mockRestore(); }
  });

  it('stops the old object narration and handles a browser speech refusal', async () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', {cancel, speak});
    vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text; } });
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({toString: () => 'Selected course text'} as Selection);
    const host = document.createElement('div');
    const root = createRoot(host);
    roots.push(root);
    const render = (context: string) => root.render(<AccessibilityTools context={context} look={{}} onChange={() => {}} onSettings={() => {}} />);
    try {
      await act(async () => render('item:a'));
    await openTools(host);
      await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Read aloud')!.click());
      expect(speak).toHaveBeenCalledOnce();
      expect(speak.mock.calls[0][0].text).toBe('Selected course text');
      const before = cancel.mock.calls.length;
      await act(async () => render('item:b'));
      expect(cancel.mock.calls.length).toBe(before + 1);
      expect(host.querySelector('[role="status"]')).toBeNull();
      speak.mockImplementation(() => { throw new Error('No voice'); });
      await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Read aloud')!.click());
      expect(host.querySelector('[role="status"]')?.textContent).toContain('No audio played');
    } finally { selection.mockRestore(); }
  });
  it('preserves other reading modes when increasing contrast and reports unavailable audio', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    roots.push(root);
    const patches: unknown[] = [];
    await act(async () => root.render(<AccessibilityTools look={{access: 'plain,chunk'}} onChange={value => patches.push(value)} onSettings={() => {}} />));
    await openTools(host);
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Increase contrast')!.click());
    expect(patches).toEqual([{access: 'plain,chunk,contrast'}]);
    await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Read aloud')!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Read aloud is unavailable in this browser.');
  });
  it('reports Still as reduced motion and lets the reader return to device motion', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    roots.push(root);
    const patches: unknown[] = [];
    await act(async () => root.render(<AccessibilityTools look={{calm: 'still'}} onChange={value => patches.push(value)} onSettings={() => {}} />));
    await openTools(host);
    const motion = [...host.querySelectorAll('button')].find(button => button.textContent === 'Reduced motion')!;
    expect(motion.getAttribute('aria-pressed')).toBe('true');
    await act(async () => motion.click());
    expect(patches).toEqual([{calm: 'device'}]);
  });
  it('changes just the selected preference and exposes focus and full settings', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);
    const patches: unknown[] = [];
    let opened = false;
    await act(async () => root.render(<AccessibilityTools look={{textSize: 'normal', access: 'chunk'}} onChange={look => patches.push(look)} onSettings={() => { opened = true; }} />));
    await openTools(host);
    expect(host.querySelector('.system-tool-trigger')?.textContent).toBe('Accessibility');
    const text = host.querySelector<HTMLSelectElement>('[aria-label="Text size"]')!;
    await act(async () => { text.value = 'large'; text.dispatchEvent(new Event('change', {bubbles: true})); });
    expect(patches[0]).toEqual({textSize: 'large'});
    const plain = [...host.querySelectorAll('button')].find(b => b.textContent === 'Plain language')!;
    await act(async () => plain.click());
    expect(patches[1]).toEqual({access: 'plain,chunk'});
    const focus = [...host.querySelectorAll('button')].find(b => b.textContent === 'Focus View')!;
    await act(async () => focus.click());
    expect(patches[2]).toEqual({workspaceMode: 'focused'});
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'All accessibility settings')!.click());
    expect(opened).toBe(true);
    await act(async () => root.unmount());
    host.remove();
  });
});
