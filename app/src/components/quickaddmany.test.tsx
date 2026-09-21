// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { QuickAdd } from './QuickAdd';

/**
 * Three things said at once, and the one deadline they used to become.
 *
 * The capture box takes a line and reads a course, a kind and a date out of
 * it, and it is the best thing in the app for something you were just told.
 * It takes one thing. Walking out of a lecture you have three, and the box
 * asks you to type, confirm, clear, type, confirm, clear — so the third one
 * does not get added.
 *
 * Handing the whole run to `capture` is not a smaller version of the right
 * answer; it is a wrong one that looks right. "econ ps4 friday psci reading
 * tuesday" has a course, a kind and a date in it, so `enough` is satisfied
 * and the button lights up — and what commits is one deadline carrying the
 * other two things in its title, on a date that belongs to only one of them.
 * A plausible wrong deadline is the failure `lib/capture.ts` was written to
 * avoid, and this was the one way left to produce one.
 *
 * ## Mounted, and with the single-line case as its control
 *
 * The splitting has its own tests over its own corpus. What cannot be tested
 * there is the part that matters to a student: that the rows are on screen,
 * that each writes its own task, and that pressing one writes *one*. A
 * component that filed every row on the first press would satisfy any test
 * that only counted tasks at the end.
 *
 * The one-line case is the control throughout. Everything below has to stay
 * true of a box somebody types a single thing into, which is what it is used
 * for nearly every time.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  // jsdom has no `matchMedia`, and the box asks for one to know whether it is
  // covering a pane or a window. Narrow, because the phone layout is the one
  // this is actually used in.
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  await loadSeed();
});

beforeEach(async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6 }));
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
  await act(async () => {
    root.render(
      <StoreProvider>
        <QuickAdd onClose={() => {}} />
      </StoreProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

async function typeIn(value: string): Promise<void> {
  const box = host.querySelector('input') as HTMLInputElement;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    set.call(box, value);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const buttons = (label: string): HTMLButtonElement[] =>
  [...host.querySelectorAll('button')].filter((b) => (b.textContent ?? '').trim() === label);

/** The tasks the app has actually written, straight out of storage. */
const tasks = (): { title: string; date: string | null; courseId: string | null }[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as { tasks?: typeof tasks extends never ? never : never[] }).tasks ?? [];
};

describe('one thing, which is what this box is for', () => {
  it('shows the single reading, not a list of one', async () => {
    await typeIn('econ ps4 friday 5pm');
    expect(text()).toContain('What it read');
    expect(text()).not.toContain('What it heard');
  });

  it('still adds it, and writes exactly one task', async () => {
    await typeIn('econ ps4 friday 5pm');
    await act(async () => buttons('Add it')[0].click());
    expect(tasks()).toHaveLength(1);
  });
});

describe('several things at once', () => {
  const RUN = 'econ ps4 friday also psci reading tuesday oh and pick up my library book';

  it('draws a row each rather than one reading of the whole run', async () => {
    await typeIn(RUN);
    expect(text()).toContain('What it heard');
    expect(text()).toContain('3 things');
    expect(buttons('Add')).toHaveLength(3);
  });

  it('gives each row its own course', async () => {
    await typeIn(RUN);
    expect(text()).toContain('ECON');
    expect(text()).toContain('PSCI');
  });

  it('writes one task when one row is added, not all of them', async () => {
    // The assertion a test that only counted at the end would miss.
    await typeIn(RUN);
    await act(async () => buttons('Add')[0].click());
    expect(tasks()).toHaveLength(1);
    expect(buttons('Added')).toHaveLength(1);
  });

  it('does not offer to add the same row twice', async () => {
    await typeIn(RUN);
    await act(async () => buttons('Add')[0].click());
    const added = [...host.querySelectorAll('button')].filter(
      (b) => (b.textContent ?? '').trim() === 'Added',
    );
    expect(added[0].disabled).toBe(true);
  });

  it('adds the rest without adding the one already in', async () => {
    await typeIn(RUN);
    await act(async () => buttons('Add')[0].click());
    await act(async () => buttons('Add the rest')[0].click());
    expect(tasks()).toHaveLength(3);
  });

  it('keeps each thing’s own date on its own thing', async () => {
    // The whole failure, as an assertion about what was written: undivided,
    // one of these dates would be on an item carrying all three titles.
    await typeIn('econ ps4 friday psci reading tuesday');
    await act(async () => buttons('Add the rest')[0].click());
    const written = tasks();
    expect(written).toHaveLength(2);
    expect(new Set(written.map((t) => t.date)).size).toBe(2);
    for (const t of written) expect(t.title).not.toContain('psci reading');
  });

  it('says how a wrong cut is undone, because the splitter can be wrong', async () => {
    await typeIn(RUN);
    expect(text()).toContain('Edit the line above');
  });

  it('re-reads the run when the line is edited', async () => {
    await typeIn(RUN);
    expect(buttons('Add')).toHaveLength(3);
    await typeIn('econ ps4 friday');
    expect(text()).toContain('What it read');
    expect(buttons('Add')).toHaveLength(0);
  });
});
