// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AccessibilityTools } from './AccessibilityTools';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roots: Root[] = [];
afterEach(async () => { await act(async () => { roots.splice(0).forEach(root => root.unmount()); }); });

describe('global accessibility tools', () => {
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
