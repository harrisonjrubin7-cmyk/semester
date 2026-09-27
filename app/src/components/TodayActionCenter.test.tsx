// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STATUS_SENTENCE, UNCALM } from '../lib/today-center';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { TodayDecisionSurface } from './TodayDecisionSurface';

/**
 * Today with `today_action_center` on: BL-1.4's Action Center with Phase B
 * around it — and the same Today with the flag off, as the control, which must
 * still be the #761 briefing and nothing else.
 *
 * The shipped sample courses are the data, on a pinned Sunday, 27 Sep 2026.
 * The Action Center's own behaviour (ranking, Done, Snooze, notes, Undo) is
 * `ActionCenter.test.tsx`'s; this file is about what Phase B adds.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let wide = false;

beforeAll(async () => {
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes('min-width: 1180px'),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 27, 10, 0));
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
  wide = false;
  vi.useRealTimers();
});

const mount = async (actionCenter: boolean) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <TodayDecisionSurface actionCenter={actionCenter} />
      </StoreProvider>,
    );
  });
};

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const click = async (el: HTMLElement) => {
  await act(async () => el.click());
};
const topTitle = () => host.querySelector('#action-top-title')?.textContent ?? '';

describe('with the flag off', () => {
  it('is the #761 briefing, unchanged', async () => {
    await mount(false);
    expect(host.querySelector('.today-decision-surface')).not.toBeNull();
    expect(host.querySelector('.today-action-center')).toBeNull();
    expect(host.querySelector('.action-center')).toBeNull();
    expect(text()).toContain('What is coming up');
    expect(text()).toContain('Why am I seeing this?');
    expect(text()).not.toContain('Your commitments');
  });
});

describe('with the flag on', () => {
  it('puts the Action Center inside Today, with the path in an approved sentence', async () => {
    await mount(true);
    expect(host.querySelector('.today-decision-surface')).toBeNull();
    expect(host.querySelector('.today-action-center .action-center')).not.toBeNull();
    expect(topTitle()).toMatch(/^Prepare /);
    expect(Object.values(STATUS_SENTENCE)).toContain(host.querySelector('#action-path-heading')?.textContent);
    expect(host.querySelector('#action-path-heading')?.closest('section')?.querySelector('[data-source="student_entered"]'))
      .not.toBeNull();
  });

  it('shows at most one urgent commitment and four rows, the time first, never the item it leads with', async () => {
    await mount(true);
    expect(host.querySelectorAll('.commitment-urgent').length).toBeLessThanOrEqual(1);
    const rows = [...host.querySelectorAll('.commitment-row')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(4);
    for (const row of rows) {
      expect(row.querySelector('.commitment-when')?.textContent).toMatch(/^(Today|Tomorrow|In \d+ days)$/);
    }
    const leading = topTitle().replace(/^Prepare /, '');
    expect(rows.map((r) => r.querySelector('strong')?.textContent)).not.toContain(leading);
    expect(host.querySelectorAll('.quick-action')).toHaveLength(5);
  });

  it('says the day is done once the student has closed something and nothing is due today or tomorrow', async () => {
    await mount(true);
    expect(host.querySelector('#action-done-line')).toBeNull();
    await click(button(/^Done$/, host.querySelector('.action-center article')!));
    expect(host.querySelector('#action-done-line')?.textContent).toMatch(/^You are set for today\. Your next deadline is (tomorrow|in \d+ days)\.$/);
    expect(text()).toContain('When you have a moment');
    await click(button(/^Undo$/));
    expect(host.querySelector('#action-done-line')).toBeNull();
  });

  it('explains the top action in a modal sheet on a phone, with how it was ranked', async () => {
    await mount(true);
    await click(button(/^Why this\?$/, host.querySelector('.action-center article')!));
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect([...dialog.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Why now?', 'Why this?', 'Based on', 'What it changes', 'What Semester can’t tell you', 'Other options', 'How it was ranked',
    ]);
    expect(document.activeElement?.textContent).toBe('Why now?');
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('explains in a drawer beside the page on a desktop, with a context pane', async () => {
    wide = true;
    await mount(true);
    expect(host.querySelector('aside.today-context')).not.toBeNull();
    await click(button(/^Why this\?$/, host.querySelector('.action-center article')!));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    const drawer = host.querySelector('aside.explain-drawer')!;
    expect(drawer).not.toBeNull();
    expect(drawer.getAttribute('aria-modal')).toBeNull();
  });

  it('says nothing Today does not say about a student', async () => {
    await mount(true);
    await click(button(/^Why this\?$/, host.querySelector('.action-center article')!));
    expect(text()).not.toMatch(UNCALM);
  });
});
