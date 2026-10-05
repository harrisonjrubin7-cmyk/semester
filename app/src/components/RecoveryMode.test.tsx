// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openRecovery, type Plan } from '../lib/plan-recovery';
import { CONFIRM_QUESTION, RecoveryMode, SAVED_AS_A } from './RecoveryMode';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date(2026, 9, 7, 10, 0);
const plan = (): Plan => ({
  items: [
    { id: 'bio', kind: 'class', title: 'BIO 201 section 2', day: '2026-10-09', startMin: 600, endMin: 660, source: 'imported', sourceAt: NOW.getTime() - 86_400_000 },
    { id: 'eng', kind: 'class', title: 'ENG 110', day: '2026-10-08', startMin: 540, endMin: 600, source: 'student_entered', sourceAt: null },
  ],
});
const recovery = () => openRecovery({ type: 'section_cancelled', itemId: 'bio' }, plan(), NOW);

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const render = (el: React.ReactElement) => act(async () => root.render(el));
const text = () => host.textContent ?? '';
const button = (label: string) => {
  const b = [...host.querySelectorAll('button')].find((x) => x.textContent === label);
  if (!b) throw new Error(`no button "${label}" in: ${text()}`);
  return b as HTMLButtonElement;
};
const click = (el: Element) => act(async () => void el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const option = (start: string) =>
  [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => r.parentElement?.textContent?.startsWith(start))!;

describe('RecoveryMode', () => {
  it('shows every step of the recovery before anything is chosen', () => {
    const html = renderToStaticMarkup(<RecoveryMode recovery={recovery()} onConfirm={() => {}} onKeep={() => {}} />);
    expect(html).toContain('Plans change');
    expect(html).toContain('BIO 201 section 2 has been cancelled.');
    expect(html).toContain('What still works');
    expect(html).toContain('ENG 110');
    expect(html).toContain('Keep my plan as it is');
    expect(html).toContain('Registrar or your advisor');
    expect(html).toContain('Confirm with the official source');
    expect(html).toContain(SAVED_AS_A);
    expect(html).not.toContain(CONFIRM_QUESTION);
    const options = (html.match(/type="radio"/g) ?? []).length;
    expect(options).toBeGreaterThanOrEqual(3);
    expect(options).toBeLessThanOrEqual(5);
  });

  it('calls nothing until the confirmation step is answered', async () => {
    const onConfirm = vi.fn();
    const onKeep = vi.fn();
    await render(<RecoveryMode recovery={recovery()} onConfirm={onConfirm} onKeep={onKeep} />);
    await click(option('Take it off my plan'));
    expect(text()).toContain('Removed: BIO 201 section 2');
    expect(text()).not.toContain(CONFIRM_QUESTION);
    await click(button('Review Scenario B'));
    expect(text()).toContain(CONFIRM_QUESTION);
    expect(onConfirm).not.toHaveBeenCalled();
    await click(button('Not yet'));
    expect(text()).not.toContain(CONFIRM_QUESTION);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it('hands over Scenario B only from the confirm click, and leaves the original untouched', async () => {
    const onConfirm = vi.fn();
    const r = recovery();
    await render(<RecoveryMode recovery={r} onConfirm={onConfirm} onKeep={() => {}} />);
    await click(option('Take it off my plan'));
    await click(button('Review Scenario B'));
    await click(button('Yes, save Scenario B'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].items.map((i: { id: string }) => i.id)).toEqual(['eng']);
    expect(r.scenarioA.items).toHaveLength(2);
    expect(text()).toContain('Scenario B is now your plan');
  });

  it('offers no confirmation for an option that changes nothing', async () => {
    const onConfirm = vi.fn();
    await render(<RecoveryMode recovery={recovery()} onConfirm={onConfirm} onKeep={() => {}} />);
    await click(option('Ask your advisor'));
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Review Scenario B')).toBe(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the current plan on request and closes the choices', async () => {
    const onConfirm = vi.fn();
    const onKeep = vi.fn();
    await render(<RecoveryMode recovery={recovery()} onConfirm={onConfirm} onKeep={onKeep} />);
    await click(button('Keep current plan for now'));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(text()).toContain('Your plan stays as it is');
    expect(host.querySelector('fieldset')!.disabled).toBe(true);
  });
});
