// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CourseUpdate, Guide } from '../lib/types';

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

const asked = vi.fn<() => Promise<string>>(async () =>
  JSON.stringify({
    name: '2 · Supply, revised',
    cards: [{ q: 'What shifts supply?', a: 'Costs, technology.' }],
    notes: ['Tightened the wording.'],
  }),
);

vi.mock('../lib/claude', () => ({
  ask: () => asked(),
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
    root.render(<Rework courseId="econ" guide={guide()} updates={updates} />);
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
});
