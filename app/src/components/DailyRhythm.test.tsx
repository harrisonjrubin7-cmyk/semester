// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RHYTHM_KEY, newDay, readRhythm } from '../lib/daily-rhythm';
import { DailyRhythm } from './DailyRhythm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); });
const now = new Date(2026, 9, 1, 12);
const render = (accountId: string | null) => act(async () => root.render(<DailyRhythm accountId={accountId} now={now} />));
const click = async (name: string) => {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent === name);
  expect(button, name).toBeTruthy();
  await act(async () => button!.click());
};
const type = async (label: string, value: string) => {
  const field = [...host.querySelectorAll('label')].find(l => l.textContent === label)?.querySelector('textarea');
  expect(field).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, value);
    field!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
describe('daily planning on Today', () => {
  it('saves an outcome and next action across remounts, pauses and resumes', async () => {
    await render('alice');
    await type('Today’s meaningful outcome', 'Prepare my outline');
    await type('First small action', 'Write one heading');
    expect(readRhythm(JSON.parse(localStorage.getItem(`${RHYTHM_KEY}:alice`)!)).days[0].first).toBe('Write one heading');
    await click('Pause daily plan');
    expect(host.querySelector('fieldset')!.disabled).toBe(true);
    await click('Resume daily plan');
    expect(host.querySelector('fieldset')!.disabled).toBe(false);
    await render('bob');
    expect([...host.querySelectorAll('textarea')].some(t => t.value.includes('Prepare my outline'))).toBe(false);
    await render('alice');
    expect([...host.querySelectorAll('textarea')].some(t => t.value === 'Prepare my outline')).toBe(true);
  });
  it('requires confirmation for deletion and leaves another account untouched', async () => {
    for (const who of ['alice', 'bob']) localStorage.setItem(`${RHYTHM_KEY}:${who}`, JSON.stringify({ version: 1, days: [{ ...newDay('2026-10-01'), outcome: who }] }));
    await render('alice');
    await click('Delete this daily plan');
    const preview = host.querySelector('.action-preview')?.textContent ?? '';
    expect(preview).toContain('Daily plan for 2026-10-01');
    expect(preview).toContain('private outcome, Daily Three, fallback, support, check-in, reflection, and support-audit fields');
    expect(preview).toContain('Other daily plans for this account stay saved');
    expect(preview).toContain('Downloaded exports, workspace backups, and official course or calendar records do not change');
    expect(preview).toContain('This can’t be undone. Restore only from an exported plan or device workspace backup created before deletion.');
    expect(readRhythm(JSON.parse(localStorage.getItem(`${RHYTHM_KEY}:alice`)!)).days).toHaveLength(1);
    await click('Cancel');
    expect(readRhythm(JSON.parse(localStorage.getItem(`${RHYTHM_KEY}:alice`)!)).days).toHaveLength(1);
    await click('Delete this daily plan');
    await click('Delete plan');
    expect(readRhythm(JSON.parse(localStorage.getItem(`${RHYTHM_KEY}:alice`)!)).days).toHaveLength(0);
    expect(readRhythm(JSON.parse(localStorage.getItem(`${RHYTHM_KEY}:bob`)!)).days).toHaveLength(1);
  });
  it('preserves corrupt storage and offers recovery', async () => {
    localStorage.setItem(`${RHYTHM_KEY}:alice`, 'broken');
    await render('alice');
    expect(host.textContent).toContain('Export recovery copy');
    expect(host.querySelector('fieldset')!.disabled).toBe(true);
    expect(localStorage.getItem(`${RHYTHM_KEY}:alice`)).toBe('broken');
  });
});
