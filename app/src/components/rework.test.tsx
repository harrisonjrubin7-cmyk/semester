// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CourseUpdate, Guide } from '../lib/types';
import type { LiveGuide } from '../lib/live';

/**
 * Choosing what a rebuild covers.
 *
 * The arithmetic and the bounding are in `lib/rework.ts` and are tested there
 * — `readOneUnit` returns the guide it was given with exactly one unit
 * replaced, whatever the model sends back. What this covers is the half that
 * only exists on screen: that the chooser offers every unit by name, and that
 * changing it throws away a preview made for a different scope.
 *
 * That second one is the reason this file exists. A preview left on screen
 * while the chooser says something else is how somebody accepts a rebuild of
 * the wrong thing, and no test in `lib/` can see it.
 *
 * The model is replaced. Nothing here calls one, and `configured` is stubbed
 * true so the panel draws at all — it hides itself when there is no way to
 * reach a model, which is right in the app and unhelpful here.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REPLY = JSON.stringify({
  name: '2 · Supply, revised',
  cards: [{ q: 'What shifts supply?', a: 'Costs, technology.' }],
  notes: ['Tightened the wording.'],
});

const asked = vi.fn<() => Promise<string>>(async () => REPLY);

/**
 * A request that is still in flight, and the signal that ends it.
 *
 * `ask` is replaced with one that never settles on its own, so a test can hold
 * a request open, change the scope under it, and then let it finish — which is
 * the sequence the abort exists for and the only way to see it.
 */
let hold: { resolve: (s: string) => void; aborted: () => boolean } | null = null;

const holdOne = () => {
  asked.mockImplementationOnce(
    (opts?: { signal?: AbortSignal }) =>
      new Promise<string>((resolve, reject) => {
        const signal = opts?.signal;
        hold = { resolve, aborted: () => Boolean(signal?.aborted) };
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }) as Promise<string>,
  );
};

vi.mock('../lib/claude', () => ({
  ask: (opts: unknown) => (asked as unknown as (o: unknown) => Promise<string>)(opts),
  configured: () => true,
}));

const dispatched: { type: string }[] = [];

vi.mock('../state/store', () => ({
  useStore: () => ({
    state: { courses: [{ course: { id: 'econ' }, guide: guide() }] },
    dispatch: (a: { type: string }) => dispatched.push(a),
  }),
}));

const guide = (): Guide => ({
  code: 'ECON 1020',
  name: 'Macro',
  blurb: 'The first half of macro.',
  source: 'syllabus.pdf',
  mastery: 40,
  audio: false,
  units: [
    { name: '1 · What economics is', mastery: 40, cards: [{ q: 'What is scarcity?', a: 'Wants exceed means.' }] },
    { name: '2 · Supply', mastery: 20, cards: [{ q: 'What shifts supply?', a: 'Costs, technology.' }] },
  ],
  terms: [{ t: 'Scarcity', d: 'Wants exceed means.' }],
});

/**
 * The guide as the screen gets it — the live merge, not the stored one.
 *
 * `addedUnits` is empty here, so displayed and stored indices agree; the case
 * where they do not is covered in `rework.test.ts` against `storedUnit`
 * directly, which is where the arithmetic lives.
 */
const live = (over: Partial<LiveGuide> = {}): LiveGuide => ({
  ...guide(),
  added: {},
  baseCards: guide().units.map((u) => u.cards.length),
  addedUnits: [],
  addedLong: { frames: 0, selfTest: 0, cases: 0, examples: 0 },
  examples: [],
  ...over,
});

const updates: CourseUpdate[] = [
  {
    id: 'u1',
    courseId: 'econ',
    unit: null,
    title: 'Reading 7',
    source: 'Posted Oct 8',
    body: 'Inflation expectations anchor when a central bank is credible.',
    cards: [],
    terms: [],
    fileIds: [],
    created: 0,
  } as CourseUpdate,
];

const { Rework } = await import('./Rework');

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  dispatched.length = 0;
  asked.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
  act(() => {
    root.render(<Rework courseId="econ" guide={live()} updates={updates} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const scope = () => host.querySelector('select[aria-label="What to rebuild"]') as HTMLSelectElement;
const preview = () => [...host.querySelectorAll('button')].find((b) => /see what it would look like/i.test(b.textContent ?? ''));
const cost = () => [...host.querySelectorAll('div')].find((d) => /came through/i.test(d.textContent ?? ''));

function pick(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('the scope chooser', () => {
  it('offers the whole guide and every unit by name', () => {
    expect([...scope().options].map((o) => o.text)).toEqual([
      'The whole guide',
      'Just 1 · What economics is',
      'Just 2 · Supply',
    ]);
  });

  it('starts on the whole guide, which is what it did before scoping existed', () => {
    expect(scope().value).toBe('-1');
  });

  it('builds a preview for the unit that was chosen', async () => {
    pick(scope(), '1');
    await act(async () => {
      preview()?.click();
    });
    expect(asked).toHaveBeenCalledTimes(1);
    expect(cost()).toBeTruthy();
  });

  /*
   * The one this file exists for. A preview belongs to the scope it was made
   * for, and one left on screen under a chooser that now says something else
   * is how somebody accepts a rebuild of the wrong thing.
   */
  it('throws the preview away when the scope changes under it', async () => {
    pick(scope(), '1');
    await act(async () => {
      preview()?.click();
    });
    expect(cost()).toBeTruthy();

    pick(scope(), '-1');
    expect(cost()).toBeUndefined();
  });

  it('does not ask a model until it is told to', () => {
    pick(scope(), '0');
    pick(scope(), '1');
    expect(asked).not.toHaveBeenCalled();
  });

  /*
   * The sharp one. Clearing the preview alone left the running request to
   * finish and call `setPlan` with the *old* scope's result, which then
   * rendered under a chooser naming a different unit — and `Use this guide`
   * would have replaced unit A while the screen said unit B. The result is
   * bounded to the scope it was built for, so the wrong one is a real
   * replacement of the wrong unit rather than a mislabelled right one.
   */
  it('abandons a request whose scope changed under it', async () => {
    holdOne();
    pick(scope(), '1');
    act(() => {
      preview()?.click();
    });
    expect(hold).toBeTruthy();

    pick(scope(), '0');
    expect(hold?.aborted()).toBe(true);

    // Even if the old request settles anyway, nothing is shown for it.
    await act(async () => {
      hold?.resolve(REPLY);
    });
    expect(cost()).toBeUndefined();
    expect(dispatched).toEqual([]);
  });
});
