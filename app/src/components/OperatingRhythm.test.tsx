// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RhythmWorkspace } from './OperatingRhythmWorkspace';
import { EMPTY_RHYTHM, newPlan, readRhythm, savePlan } from '../lib/operating-rhythm';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});
const draw = (scope = 'test') =>
  act(async () => root.render(<RhythmWorkspace key={scope} scope={scope} today="2026-10-01" />));
const button = (s: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === s)!;
const click = (s: string) => act(async () => button(s).click());
const select = (label: string, value: string) =>
  act(async () => {
    const el = [...host.querySelectorAll('label')]
      .find((l) => l.textContent?.startsWith(label))!
      .querySelector('select')!;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
describe('operating rhythm integration', () => {
  it('records a focused session without writing to external services', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    await draw();
    await click('Start 10 minutes');
    expect(host.querySelector('dialog')?.open).toBe(true);
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans[0].status).toBe('Started');
    await click('I am stuck');
    expect(host.querySelector('dialog')?.open).toBe(false);
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans[0].status).toBe('Blocked');
  });
  it('keeps malformed storage and refuses edits', async () => {
    localStorage.setItem('test:daily', 'bad');
    await draw();
    await select('Progress state', 'Completed');
    expect(localStorage.getItem('test:daily')).toBe('bad');
    expect(host.textContent).toContain('Export recovery copy');
  });
  it('shows a fresh workspace when switching accounts and restores saved state on return', async () => {
    const p = newPlan('2026-10-01');
    p.values.outcome = 'Private A goal';
    localStorage.setItem('a:daily', JSON.stringify(savePlan(EMPTY_RHYTHM, p)));
    await draw('a');
    expect(host.querySelector('textarea')?.value).toBe('Private A goal');
    await draw('b');
    expect(host.querySelector('textarea')?.value).toBe('');
    await draw('a');
    expect(host.querySelector('textarea')?.value).toBe('Private A goal');
  });
  it('saves explicit progress across remounts and keeps weekly records separate', async () => {
    await draw();
    await select('Progress state', 'Waiting');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans[0].status).toBe('Waiting');
    await select('Rhythm', 'weekly');
    expect(host.querySelector('textarea')?.value).toBe('');
    await select('Rhythm', 'daily');
    expect(host.textContent).toContain('Check the follow-up');
  });
  it('deletes only after explicit confirmation', async () => {
    const p = newPlan('2026-10-01');
    localStorage.setItem('test:daily', JSON.stringify(savePlan(EMPTY_RHYTHM, p)));
    await draw();
    await click('Delete this plan');
    expect(host.querySelector('.action-preview')?.textContent).toContain('Daily plan for 2026-10-01');
    expect(host.querySelector('.action-preview')?.textContent).toContain('Other daily plans and your daily rhythm preferences stay saved');
    expect(host.querySelector('.action-preview')?.textContent).toContain('This can’t be undone. Restore only from a private backup you exported before deletion.');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans).toHaveLength(1);
    await click('Cancel');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans).toHaveLength(1);
    await click('Delete this plan');
    await click('Delete plan');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans).toHaveLength(0);
  });
  it('previews the whole rhythm payload before deleting plans and preferences', async () => {
    const first = newPlan('2026-10-01');
    const second = newPlan('2026-10-02');
    const saved = savePlan(savePlan(EMPTY_RHYTHM, first), second);
    localStorage.setItem('test:daily', JSON.stringify({ ...saved, preferences: { ...saved.preferences, reflection: true } }));
    await draw();
    await click('Delete this rhythm’s plans and preferences');
    expect(host.querySelector('.action-preview')?.textContent).toContain('2 daily plans and the daily working preferences');
    expect(host.querySelector('.action-preview')?.textContent).toContain('Weekly rhythm data, downloaded exports, and official course or calendar records do not change');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans).toHaveLength(2);
    await click('Delete rhythm');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!))).toEqual(EMPTY_RHYTHM);
  });
  it('does not silently replace an existing carry-forward plan', async () => {
    const p = newPlan('2026-10-01');
    p.values.carry = 'new';
    const next = newPlan('2026-10-08');
    next.values.outcome = 'existing';
    localStorage.setItem('test:daily', JSON.stringify(savePlan(savePlan(EMPTY_RHYTHM, p), next)));
    await draw();
    await click('Carry selected outcome into next week');
    expect(readRhythm(JSON.parse(localStorage.getItem('test:daily')!)).plans[1].values.outcome).toBe('existing');
  });
  it('uses labelled controls and has no serious accessibility violations', async () => {
    await draw();
    await select('View', 'Plan');
    const axe = (await import('axe-core')).default;
    const r = await axe.run(host, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
  });
});
