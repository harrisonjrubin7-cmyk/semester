import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from './shape';
import { reducer } from './reducer';

/**
 * The calendar has one position, and it is `calDay`.
 *
 * It had three. `calDay` was an ISO date the day and week views read, and the
 * assistant read for `focus.selectedDay`; `selDate` was a second date only the
 * month view read; `calMonth`/`calYear` was the month on screen, movable only
 * by a delta. Nothing kept them in step, so tapping the 24th in the month grid
 * and switching to the day view put you back on today, and the assistant was
 * told about a day you were not looking at.
 *
 * `selDate` was not even an ISO date: both writers built
 * `${calYear}-${calMonth}-${d}` with a zero-indexed, unpadded month, so the
 * 24th of September was `2026-8-24`. Its one reader took `split('-')[2]`, so
 * the wrong month was never read — which is why it survived.
 *
 * ## Why a source census and not only behaviour
 *
 * The behaviour is pinned below and is the better test of the two. But the
 * fault this is really guarding against is a *fourth* field: somebody adding
 * `calWeekStart`, or bringing `selDate` back, because the month view wants
 * something the day view does not. That is not a behaviour a test can reach —
 * it is a shape, and shapes are what the source censuses in this repo watch.
 */

const NAMES = ['selDate', 'calMonth', 'calYear', 'selectDate'] as const;

function mentions(): string[] {
  return sources(join(process.cwd(), 'src'), { ext: ['.ts', '.tsx'] })
    .filter((f) => !f.path.includes('.test.'))
    .filter((f) => {
      const text = withoutComments(f.text);
      return NAMES.some((n) => new RegExp(`\\b${n}\\b`).test(text));
    })
    .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
}

const at = (calDay: string | null): State =>
  ({ ...DEFAULT_PERSISTED, ...initialEphemeral(), calDay }) as State;

describe('the calendar position', () => {
  it('is not held in a second field', () => {
    expect(
      mentions(),
      'these carry a calendar position beside `calDay`; the month is the month of `calDay`',
    ).toEqual([]);
  });

  /*
   * Stepping a month keeps the day, which is what makes the selection survive
   * the arrows — the behaviour the old pair got right only because the view
   * re-derived the clamp itself.
   */
  it('steps a month and keeps the day', () => {
    expect(reducer(at('2026-09-24'), { type: 'stepMonth', delta: 1 }).calDay).toBe('2026-10-24');
    expect(reducer(at('2026-09-24'), { type: 'stepMonth', delta: -1 }).calDay).toBe('2026-08-24');
  });

  /*
   * The 31st of January plus a month is not the 3rd of March. `setMonth`
   * overflows, and a calendar that skips February when you press the arrow is
   * worse than one that lands on the 28th.
   */
  it('clamps into a shorter month rather than overflowing', () => {
    expect(reducer(at('2026-01-31'), { type: 'stepMonth', delta: 1 }).calDay).toBe('2026-02-28');
    expect(reducer(at('2026-05-31'), { type: 'stepMonth', delta: 1 }).calDay).toBe('2026-06-30');
  });

  it('steps a day without touching the month machinery', () => {
    expect(reducer(at('2026-09-30'), { type: 'stepDay', delta: 1 }).calDay).toBe('2026-10-01');
  });
});
