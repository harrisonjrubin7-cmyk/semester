// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { CALM_KEY, EMPTY_CALM } from '../lib/calm-controls';
import { SUPPRESS_KEY } from '../lib/guide-bar';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { TodayGuide } from './TodayGuide';

/**
 * The Guide on Today, mounted for real: it names one next step, Snooze is
 * remembered on the device and said back, and a surface the student paused
 * draws nothing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  await loadSeed();
});
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const mount = async () => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <TodayGuide />
      </StoreProvider>,
    );
  });
};

describe('TodayGuide', () => {
  it('is a labelled region with a next step and the student’s own exits', async () => {
    await mount();
    const bar = host.querySelector('[data-guide-bar]');
    expect(bar?.getAttribute('aria-label')).toBe('Semester Guide');
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Snooze', 'Not now']));
  });

  it('remembers a snooze on the device and says so', async () => {
    await mount();
    const snooze = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Snooze')!;
    await act(async () => snooze.click());
    expect(Object.keys(JSON.parse(localStorage.getItem(SUPPRESS_KEY) ?? '{"items":{}}').items)).toHaveLength(1);
    expect(host.querySelector('[role="status"]')?.textContent).not.toBe('');
  });

  it('stays on Today when only scenarios, career and study are paused', async () => {
    localStorage.setItem(CALM_KEY, JSON.stringify({ ...EMPTY_CALM, pauseScenarios: true, pauseCareer: true, hideStudyBlocks: true }));
    await mount();
    // Today's category is never one of those three pauses, so it stays: the
    // pauses are for scenarios, career and study, not for the day itself.
    expect(host.querySelector('[data-guide-bar]')).not.toBeNull();
  });
});
