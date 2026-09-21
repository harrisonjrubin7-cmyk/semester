// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { STORAGE_KEY } from '../state/shape';
import { Grades } from './Grades';

/**
 * A grade tried on, and the record it must never touch.
 *
 * The screen has always answered two questions — where you stand, and what
 * everything left has to average for an A — and never the one a student
 * actually types into a calculator at midnight, which is the other way round:
 * *if I get an 88 on the final, what does that make my grade?* Canvas calls
 * it What-If and it is popular enough that whole sites exist only to do it
 * for people whose school has switched it off.
 *
 * The arithmetic has its own file and its own tests. What is checked here is
 * the half that cannot be checked in `lib/whatif.test.ts`, because it is not
 * about arithmetic at all: **that a supposition is not a mark**. A number
 * typed into this block must not reach `state.grades`, because if it did it
 * would sync, feed the projection on Today, count toward the term GPA, and a
 * 95 typed into the final in October to cheer yourself up would still be
 * there in December with the app agreeing.
 *
 * ## Mounted, and with a control, for the reason `keyless.test.tsx` gives
 *
 * "Nothing was written to storage" is exactly what a broken probe reports —
 * one pointed at the wrong key, one that never fired its event, one mounted
 * against a screen that drew no fields at all. Each of those passes the
 * supposing case and fails nothing. So the real grade field is typed into the
 * same way in the same test file, and it *must* write: the two together say
 * the probe works and the separation holds, and neither says it alone.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, grades: { 'econ:0': '80' } }),
  );
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
  await act(async () => {
    root.render(<StoreProvider>{<Grades />}</StoreProvider>);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

/** Type into a React-controlled box the way a person would. */
async function type(box: HTMLInputElement, value: string): Promise<void> {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    set.call(box, value);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const boxesFor = (what: RegExp): HTMLInputElement[] =>
  [...host.querySelectorAll('input')].filter((i) => what.test(i.getAttribute('aria-label') ?? ''));

/** What `state.grades` holds right now, straight out of storage. */
const stored = (): Record<string, string> => {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? ((JSON.parse(raw) as { grades?: Record<string, string> }).grades ?? {}) : {};
};

describe('the block itself', () => {
  it('is on the screen, and says it keeps nothing', () => {
    expect(text()).toContain('Suppose');
    expect(text()).toContain('gone when you leave the screen');
  });

  it('draws a supposing box beside each weighted row', () => {
    expect(boxesFor(/^Suppose a score/).length).toBeGreaterThan(0);
  });

  it('says what is already on record beside the box, so the two are not confused', () => {
    expect(text()).toContain('on record');
  });

  it('says nothing about a grade until something is supposed', () => {
    // An empty verdict standing there would be the screen answering a
    // question nobody asked, in the voice it answers real ones in.
    expect(text()).not.toContain('That would');
  });
});

describe('supposing a score', () => {
  it('says what it would make the grade', async () => {
    const box = boxesFor(/^Suppose a score/)[0];
    await type(box, '90');
    expect(text()).toContain('That would');
    expect(text()).toMatch(/\d+%/);
  });

  it('does not write it into the grades the app keeps', async () => {
    const before = stored();
    const box = boxesFor(/^Suppose a score/)[0];
    await type(box, '95');
    expect(box.value).toBe('95');
    expect(stored()).toEqual(before);
    expect(Object.values(stored())).not.toContain('95');
  });

  it('writes a real score, which is the control for the test above', async () => {
    // Without this, "nothing was written" is also what a probe pointed at the
    // wrong key reports — and it would pass whether or not the block works.
    const box = boxesFor(/^Your score for/)[0];
    await type(box, '77');
    expect(Object.values(stored())).toContain('77');
  });

  it('clears back to nothing supposed', async () => {
    const box = boxesFor(/^Suppose a score/)[0];
    await type(box, '90');
    expect(text()).toContain('That would');
    const clear = [...host.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Clear',
    );
    expect(clear).toBeTruthy();
    await act(async () => clear!.click());
    expect(text()).not.toContain('That would');
  });
});

describe('the two things it refuses to be quiet about', () => {
  it('names a row it is supposing over a mark that already exists', async () => {
    // ECON's first row is scored at 80 in this test's storage, so the first
    // supposing box is laid over a real mark.
    const box = boxesFor(/^Suppose a score/)[0];
    await type(box, '95');
    expect(text()).toContain('Supposing over a mark you already have');
  });

  it('says nothing of the sort for a row with no mark on it', async () => {
    // The control for the line above: a probe that warned on every supposed
    // row would look identical on the test that matters.
    const boxes = boxesFor(/^Suppose a score/);
    const empty = boxes.find((b) => {
      const row = b.closest('div')?.parentElement;
      return (row?.textContent ?? '').includes('Nothing on record');
    });
    expect(empty).toBeTruthy();
    await type(empty!, '90');
    expect(text()).not.toContain('Supposing over a mark you already have');
  });

  it('says so when what was typed could not be read as a score', async () => {
    const box = boxesFor(/^Suppose a score/)[0];
    await type(box, 'pretty well');
    expect(text()).toContain('Nothing was read from what you put against');
  });
});
