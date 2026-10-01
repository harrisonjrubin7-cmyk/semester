// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityTools } from './AccessibilityTools';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
afterEach(async () => { await act(async () => { roots.splice(0).forEach(root => root.unmount()); }); vi.unstubAllGlobals(); });

describe('global accessibility tools', () => {
  it('stops the old object narration and handles a browser speech refusal', async () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', {cancel, speak});
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({toString: () => 'Selected course text'} as Selection);
    const host = document.createElement('div');
    const root = createRoot(host);
    roots.push(root);
    const render = (context: string) => root.render(<AccessibilityTools context={context} look={{}} onChange={() => {}} onSettings={() => {}} />);
    try {
      await act(async () => render('item:a'));
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
    expect(host.querySelector('summary')?.textContent).toBe('Accessibility');
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
