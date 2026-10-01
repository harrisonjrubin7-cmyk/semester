// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { DRAFTS_KEY, KEEP_DAYS } from '../lib/draft';
import { screenName } from '../lib/nav';
import { KEEP_DAYS as COPY_DAYS } from '../lib/snapshots';
import { Recovery } from './Recovery';

/**
 * Recovery, as somebody in a hurry meets it.
 *
 * What is held here is what the screen *says*: it is where a student goes when
 * something went missing, so a wrong sentence costs more than a wrong pixel.
 * It told people there was nothing to restore while `Export` held a restore,
 * and nothing failed, because nothing checked the sentence against the feature.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

// The sample semester, fetched before anything renders — see `deadends.test.tsx`
// for why an un-awaited seed fails the run at teardown.
beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  // The clipboard tests below define their own on navigator. Left behind, it
  // is read-only in the shared worker, and the next file to assign one
  // (RegistrationDayCard.test.tsx) throws.
  delete (navigator as { clipboard?: unknown }).clipboard;
});

function show() {
  act(() => {
    root.render(
      <StoreProvider>
        <Recovery />
      </StoreProvider>,
    );
  });
}

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const buttons = () => [...host.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
const DAY = 86_400_000;

function keep(drafts: Record<string, { text: string; at: number }>) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

describe('the drafts on this device', () => {
  it('says so when there are none, rather than showing an empty box', () => {
    show();
    expect(text()).toContain('Nothing unfinished is being kept on this device.');
  });

  it('lists each one by the screen it belongs to, newest first, with what is left', () => {
    keep({
      'essay:out': { text: 'one two three four five', at: Date.now() - 3 * DAY },
      'solve:work': { text: 'a b', at: Date.now() - 60_000 },
    });
    show();
    const t = text();
    expect(t).toContain(screenName('essay'));
    expect(t).toContain(screenName('solve'));
    expect(t.indexOf('A problem you were working through')).toBeLessThan(t.indexOf('An essay you were drafting'));
    expect(t).toContain('5 words');
    expect(t).toContain(`kept ${KEEP_DAYS - 3} more days`);
    expect(t).toContain('not synced and not in your export');
    expect(buttons().filter((b) => b === 'Open')).toHaveLength(2);
  });

  it('hands the words back here, in full, whatever state their own screen is in', () => {
    keep({ 'solve:work': { text: 'Let x be the price.\nThen demand is 100 minus 2x.', at: Date.now() } });
    show();
    const kept = host.querySelector('pre')!;
    expect(kept.textContent).toBe('Let x be the price.\nThen demand is 100 minus 2x.');
    expect(kept.getAttribute('aria-label')).toContain('A problem you were working through');
  });

  it('copies the whole text, and says so', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true, writable: true });
    keep({ 'essay:out': { text: 'all of it, not a preview', at: Date.now() } });
    show();
    const copy = [...host.querySelectorAll('button')].find((b) => /^Copy this text/.test(b.textContent ?? ''))!;
    await act(async () => {
      copy.click();
    });
    expect(write).toHaveBeenCalledWith('all of it, not a preview');
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Copied.');
  });

  it('says when the clipboard refused, rather than claiming it copied', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true, writable: true });
    keep({ 'essay:out': { text: 'x', at: Date.now() } });
    show();
    const copy = [...host.querySelectorAll('button')].find((b) => /^Copy this text/.test(b.textContent ?? ''))!;
    await act(async () => {
      copy.click();
    });
    expect(host.querySelector('[role="status"]')?.textContent).toMatch(/Could not copy/);
  });

  it('offers no way to delete one from here, since there would be no undo', () => {
    keep({ 'essay:out': { text: 'kept', at: Date.now() } });
    show();
    const section = host.querySelector('section[aria-label="Unfinished writing on this device"]')!;
    const names = [...section.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
    expect(names, 'the list has buttons to check').toEqual(['Open', 'Copy this text']);
    expect(names.some((b) => /delete|discard|remove|clear/i.test(b))).toBe(false);
  });

  it('offers no Open for a study guide, whose field Study does not mount on arrival', () => {
    keep({ 'study-studio:guide:2026F:econ101': { text: 'notes on elasticity', at: Date.now() } });
    show();
    expect(text()).toContain('notes on elasticity');
    expect(buttons()).not.toContain('Open');
    expect(buttons()).toContain('Copy this text');
  });

  it('shows a draft the previous screen only writes as it unmounts', () => {
    // `useDraft` flushes its pending text in an unmount cleanup, which runs in
    // the same commit that mounts Recovery: after Recovery's first render.
    function Leaving() {
      useEffect(
        () => () => keep({ 'essay:out': { text: 'typed a moment before leaving', at: Date.now() } }),
        [],
      );
      return <p>the screen being left</p>;
    }
    act(() => {
      root.render(<Leaving />);
    });
    show();
    expect(text()).toContain('typed a moment before leaving');
    expect(text()).not.toContain('Nothing unfinished');
  });

  it('does not list one that has already expired', () => {
    keep({ 'essay:out': { text: 'old', at: Date.now() - (KEEP_DAYS + 2) * DAY } });
    show();
    expect(text()).toContain('Nothing unfinished');
  });

  it('is not the thing that breaks when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is off');
    });
    expect(() => show()).not.toThrow();
    expect(text()).toContain('Nothing unfinished');
  });
});

describe('what it says about getting something back', () => {
  it('names the copies the app takes by itself, and how far back they go', () => {
    show();
    expect(text()).toContain('copies of your whole workspace');
    expect(text()).toContain(`up to ${COPY_DAYS} days back`);
  });

  it('links the restore and the week that went wrong, once each', () => {
    show();
    expect(buttons().some((b) => /^Export, or go back to an earlier copy/.test(b))).toBe(true);
    expect(buttons().some((b) => /^Sort out a bad week/.test(b))).toBe(true);
  });
});

describe('student-controlled academic recovery', () => {
  it('states the privacy boundary before a student chooses a recovery path', () => {
    show();
    const t = text();
    expect(t).toContain('will not notify faculty, advisors, or staff because you use Recovery Mode');
    expect(t).toContain('Your plan stays private unless you choose what to share');
    expect(t).toContain('I have too many urgent actions');
    expect(t).toContain('I am waiting on someone or a system');
    expect(t).toContain('I only have a few minutes');
  });
});

// The sentence and the feature, held to each other. Read from the source
// because the failure is a claim the code no longer supports, and there is no
// runtime state in which that shows.
describe('the claim that nothing can be restored', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

  it('is not made while the app takes copies it can restore', () => {
    const exportScreen = read('./Export.tsx');
    expect(exportScreen, 'Export must still mount the copies').toMatch(/<Snapshots\b/);
    const recovery = read('./Recovery.tsx');
    expect(recovery).not.toMatch(/There is no earlier version of a plan to restore/);
    expect(recovery, 'Recovery must point at where the copies are').toMatch(/screen: 'export'/);
  });
});

// A layout fault the DOM cannot show. `ActionButton` fills its row unless it is
// told otherwise, and inside a flex row that squeezed each draft's description
// to 0px wide (measured, in a browser: text 0, button 366 of 366) — every test
// passed and the screen drew one letter per line. jsdom has no layout, so the
// guard is on the source: each button in the draft row asks for its own width.
describe('the buttons in a draft row', () => {
  it('do not take the whole row', () => {
    const src = readFileSync(join(__dirname, 'Recovery.tsx'), 'utf8');
    const item = src.slice(src.indexOf('function DraftItem'), src.indexOf('function Section('));
    // Each button's own text, up to its closing tag: a `>` inside an arrow
    // function's `=>` would end a tag-shaped match early.
    const chunks = item.split('<ActionButton').slice(1).map((c) => c.slice(0, c.indexOf('</ActionButton>')));
    expect(chunks.length, 'the row has buttons to check').toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(chunk, 'every ActionButton in a draft row needs width: auto').toContain("width: 'auto'");
    }
  });
});
