// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { STATUS_SENTENCE, UNCALM } from '../lib/today-center';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
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
let viewportWidth = 1199;
let installed = false;
const APP_CSS = readFileSync(join(process.cwd(), 'src', 'styles', 'app.css'), 'utf8');

beforeAll(async () => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('display-mode: standalone')
      ? installed
      : viewportWidth >= Number(query.match(/min-width:\s*(\d+)px/)?.[1] ?? Number.POSITIVE_INFINITY),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
  // Today loads these lazily (`TodayDecisionSurface`); loaded once here so a
  // mount only has to wait for React, not for the module.
  await import('./TodayActionCenter');
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
  viewportWidth = 1199;
  installed = false;
  vi.useRealTimers();
});

/** "These are mine": the student says the shipped semester is theirs. */
function Adopt() {
  const { adopt } = useStore();
  useEffect(() => adopt(), [adopt]);
  return null;
}

function ModeProbe() {
  const { state } = useStore();
  useEffect(() => {
    document.documentElement.setAttribute('data-workspace', state.workspaceMode);
    return () => document.documentElement.removeAttribute('data-workspace');
  }, [state.workspaceMode]);
  const displayMode = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
  return (
    <>
      <output data-testid="workspace-mode">{state.workspaceMode}</output>
      <output data-testid="display-mode">{displayMode}</output>
    </>
  );
}

/** Reconcile from another local tab without contacting the account. */
function HydrateLocally() {
  const { dispatch } = useStore();
  useEffect(() => dispatch({ type: 'hydrate', persisted: {} }), [dispatch]);
  return null;
}

const mount = async (actionCenter: boolean, adopted = false, localHydrate = false) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        {adopted ? <Adopt /> : null}
        {localHydrate ? <HydrateLocally /> : null}
        <TodayDecisionSurface actionCenter={actionCenter} />
        <ModeProbe />
      </StoreProvider>,
    );
  });
  // One more turn for the lazy boundary to swap its fallback for the surface.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('puts one dominant decision first and can enter Focus mode from it', async () => {
    await mount(false);
    const surface = host.querySelector('.today-decision-surface')!;
    expect(surface.firstElementChild?.classList.contains('today-dominant-card')).toBe(true);
    await click(button(/^Focus on this$/, surface.firstElementChild!));
    expect(host.querySelector('[data-testid="workspace-mode"]')?.textContent).toBe('focused');
  });
});

describe('with the flag on', () => {
  it('puts the Action Center inside Today, with the path in an approved sentence', async () => {
    await mount(true, true);
    expect(host.querySelector('.today-decision-surface')).toBeNull();
    expect(host.querySelector('.today-action-center .action-center')).not.toBeNull();
    expect(topTitle()).toMatch(/^Prepare /);
    expect(Object.values(STATUS_SENTENCE)).toContain(host.querySelector('#action-path-heading')?.textContent);
    expect(host.querySelector('#action-path-heading')?.closest('section')?.querySelector('[data-source="student_entered"]'))
      .not.toBeNull();
  });

  it('keeps the Action Center dominant and makes supporting panels secondary', async () => {
    await mount(true, true);
    const main = host.querySelector('.action-center-main')!;
    expect(main.firstElementChild?.classList.contains('action-panel-primary')).toBe(true);
    expect(main.querySelectorAll('.action-panel-secondary')).toHaveLength(2);
    await click(button(/^Focus on this$/, main.firstElementChild!));
    expect(host.querySelector('[data-testid="workspace-mode"]')?.textContent).toBe('focused');
  });

  it('shows at most one urgent commitment and four rows, the time first, never the item it leads with', async () => {
    await mount(true, true);
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
    await mount(true, true);
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
    const sourceDetails = dialog.querySelector('.explain-source-details');
    expect(sourceDetails?.textContent).toContain('Authority');
    expect(sourceDetails?.textContent).toContain('Data owner');
    expect(sourceDetails?.textContent).toContain('Correction route');
    expect(sourceDetails?.textContent).toContain('Official fallback');
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('explains in a drawer beside the page on a desktop, with a context pane', async () => {
    viewportWidth = 1200;
    await mount(true);
    expect(host.querySelector('aside.today-context')).not.toBeNull();
    await click(button(/^Why this\?$/, host.querySelector('.action-center article')!));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    const drawer = host.querySelector('aside.explain-drawer')!;
    expect(drawer).not.toBeNull();
    expect(drawer.getAttribute('aria-modal')).toBeNull();
  });

  it('does not present missing account freshness as current', async () => {
    viewportWidth = 1200;
    await mount(true);
    const context = host.querySelector('aside.today-context')!;
    expect(context.querySelector('[data-source="unavailable_stale"]')).not.toBeNull();
    expect(context.textContent).toContain('Your saved plan still works');
    expect(context.textContent).toContain('use the official system for time-sensitive actions');
  });

  it('does not present a local cross-tab hydrate as an account sync', async () => {
    viewportWidth = 1200;
    await mount(true, false, true);
    const context = host.querySelector('aside.today-context')!;
    expect(context.querySelector('[data-source="unavailable_stale"]')).not.toBeNull();
    expect(context.querySelector('[data-source="imported"]')).toBeNull();
    expect(context.textContent).toContain('No account sync recorded on this device.');
  });

  it('keeps the selected single-column presentation at 1199px', async () => {
    viewportWidth = 1199;
    await mount(true, true);
    const center = host.querySelector('.today-action-center')!;
    expect(center.classList).not.toContain('is-wide');
    expect(center.firstElementChild?.classList).toContain('action-center-main');
    expect(center.querySelector('aside.today-context')).toBeNull();
  });

  it.each([
    { display: 'browser', standalone: false, expectedMode: 'browser' },
    { display: 'installed app', standalone: true, expectedMode: 'standalone' },
  ])('keeps the selected full-width focus presentation at 1200px in the $display', async ({ standalone, expectedMode }) => {
    viewportWidth = 1200;
    installed = standalone;
    await mount(true, true);
    const center = host.querySelector('.today-action-center')!;
    expect(host.querySelector('[data-testid="display-mode"]')?.textContent).toBe(expectedMode);
    expect(center.classList).not.toContain('is-wide');
    expect(center.children[0]?.classList).toContain('action-center-main');
    expect(center.children[1]?.classList).toContain('today-context');
    expect(center.querySelector('.action-panel-primary button.btn-primary.btn-block')).not.toBeNull();

    await click(button(/^Focus on this$/, center));
    expect(host.querySelector('[data-testid="workspace-mode"]')?.textContent).toBe('focused');
    expect(document.documentElement.getAttribute('data-workspace')).toBe('focused');
    expect(center.querySelector('.action-panel-primary button.btn-primary.btn-block')).not.toBeNull();
    expect(center.querySelectorAll('.action-panel-secondary')).toHaveLength(2);
    expect(center.querySelector('.quick-actions')?.closest('.hides-in-focus')).not.toBeNull();
    expect(center.querySelector('aside.today-context')).not.toBeNull();
    expect(APP_CSS).toMatch(
      /:root\[data-workspace='focused'\] \.today-action-center \.action-panel-secondary,\s*:root\[data-workspace='focused'\] \.today-action-center \.today-context \{\s*display: none;/,
    );
  });

  it('says nothing Today does not say about a student', async () => {
    await mount(true);
    await click(button(/^Why this\?$/, host.querySelector('.action-center article')!));
    expect(text()).not.toMatch(UNCALM);
  });
});

describe('before the student says the shipped semester is theirs', () => {
  it('does not lead with a sample assignment or list the sample\'s classes', async () => {
    await mount(true);
    expect(topTitle()).toBe('Start your semester');
    expect(topTitle()).not.toMatch(/^Prepare /);
    expect(host.querySelectorAll('.commitment-row')).toHaveLength(0);
    expect(host.querySelector('.commitment-urgent')).toBeNull();
  });

  it('control: once they adopt it, the same dates lead and the classes are listed', async () => {
    await mount(true, true);
    expect(topTitle()).toMatch(/^Prepare /);
    expect(host.querySelectorAll('.commitment-row, .commitment-urgent').length).toBeGreaterThan(0);
  });

  it('says where each commitment came from, in words', async () => {
    await mount(true, true);
    const meta = [...host.querySelectorAll('.commitment-meta')].map((m) => m.textContent ?? '');
    expect(meta.some((m) => /Needs review|Imported|Student entered/.test(m))).toBe(true);
  });

  it('the briefing (flag off) does the same', async () => {
    await mount(false);
    expect(text()).not.toContain('Prepare ');
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount(false, true);
    expect(text()).toContain('Prepare ');
  });
});
