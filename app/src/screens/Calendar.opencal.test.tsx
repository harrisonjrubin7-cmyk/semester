// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { StoreProvider, useStore } from '../state/store';
import { AIProvider } from '../ai/store';
import { loadSeed } from '../data/seed';
import { Calendar } from './Calendar';
import { goCal } from '../lib/opencal';

/**
 * `openCal(date, 'month')` lands on that date's month, and selects that day.
 *
 * This is the half of `lib/opencal.ts` that nothing was holding. Its own
 * docblock used to say the opposite — that `month` "sets a day nothing reads
 * and lands on whatever month the calendar was already showing", failing
 * silently — and it was right when it was written: the month view anchored on
 * a `calMonth`/`calYear` pair that only `stepMonth` could move by a delta, so
 * a date could not be sent to it at all.
 *
 * The pass that merged those fields onto `calDay` made the sentence false and
 * did not come back for it. What was left was a file telling the next author
 * that a working grain was broken, beside a test asserting only the *shape* of
 * the dispatch — `openCal('2026-09-22', 'month')[1]` carries `view: 'month'` —
 * which says nothing about where the calendar ends up and passed throughout.
 *
 * So the behaviour is what this asserts, through the view rather than the
 * action list: the grid names the target month, and the selected cell is the
 * target day. Split the anchor again and both go red.
 *
 * ## Measured against a revert
 *
 * With `MonthView`'s `const anchor = state.calDay ? isoToDate(state.calDay) :
 * now` put back to `now` — what the view did before the merge, minus the
 * deleted fields — two of the three below go red, and the first stays green,
 * which is what makes it the control: the reverted view shows January whatever
 * it is asked for, so an assertion that January is on screen cannot tell the
 * two apart. A guard that has never failed is not known to be one.
 *
 * **That revert is not otherwise unguarded, and saying so was wrong in a first
 * draft of this note.** `Calendar.keyboard.test.tsx` fails on it too, because
 * paging with `PageDown` moves `calDay` and its assertions read the grid. So
 * the anchor *line* has cover. What had none is the claim this file is named
 * for — that a date handed to `openCal` arrives — and the distance between
 * those two is the whole point: the keyboard test pages from today and never
 * calls `openCal`, while `lib/opencal.test.ts`, the file whose name says it
 * covers this, asserts only the action list and passes under the revert
 * throughout.
 *
 * Both were measured, not assumed. A revert that reddens the file you expected
 * is worth less than knowing which other files it reddens.
 *
 * `semester` is deliberately not covered. It anchors on `useNow()` and honours
 * no date, which is still true and still documented; asserting it here would
 * write a limitation down as a promise and turn a future fix red for the wrong
 * reason.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

/** The calendar, and one control that opens a date in a chosen grain. */
function Harness() {
  const { dispatch } = useStore();
  return (
    <div className="device">
      <Calendar />
      <button onClick={() => goCal(dispatch, '2026-09-24', 'month')}>Open September</button>
      <button onClick={() => goCal(dispatch, '2026-09-24')}>Open the day</button>
    </div>
  );
}

function button(name: string) {
  const el = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!el) throw new Error('Missing button ' + name);
  return el;
}
const click = (name: string) => act(() => button(name).click());
const grid = () => host.querySelector('[role="grid"]')?.getAttribute('aria-label') ?? '';
const selected = () =>
  host
    .querySelector<HTMLButtonElement>('[role="gridcell"][aria-selected="true"]')
    ?.getAttribute('aria-label') ?? '';

beforeAll(() => loadSeed());
beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  // January, so the target month is one the calendar is not already showing —
  // otherwise the assertion passes on a calendar that ignored the date.
  vi.setSystemTime(new Date(2026, 0, 31, 12));
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <StoreProvider>
        <AIProvider>
          <Harness />
        </AIProvider>
      </StoreProvider>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

it('starts on the month it is already showing, which is the control', () => {
  // Without this, "September" below could be where the calendar always was.
  expect(grid()).toContain('January 2026');
  expect(selected()).toContain('31 January');
});

it('opens the month the date is in, and selects that day', () => {
  click('Open September');
  expect(grid()).toContain('September 2026');
  expect(selected()).toContain('24 September');
});

it('carries the same date into the day grain, so the grains agree', () => {
  // The fault the merged field was for: the grid showed one day and a change
  // of grain showed another. Opening in `month` and opening in `day` have to
  // name the same date.
  click('Open September');
  expect(selected()).toContain('24 September');
  click('Open the day');
  expect(host.textContent).toContain('24');
  expect(host.querySelector('[role="grid"]')).toBeNull();
});
