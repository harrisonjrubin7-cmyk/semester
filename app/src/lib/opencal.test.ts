import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';
import { goCal, openCal } from './opencal';

/**
 * Opening the calendar on a day goes through `openCal`.
 *
 * Three dispatches in order — `setCalDay`, `setCalView`, `go` — because
 * setting the day while you are on another screen changes nothing you can see.
 * `components/Clashes.tsx` worked that out, wrote the helper and wrote the
 * paragraph, and left both module-private. `screens/Calendar.tsx` and
 * `screens/me/You.tsx` then re-derived the three lines, and
 * `screens/Today.tsx` dispatched only the last of them.
 *
 * ## Why the guard is the deliverable, not the export
 *
 * Exporting the helper fixes the three sites that exist. It does nothing about
 * the fourth, because the reason the first three diverged was never that the
 * helper was hard to write — it is four lines — but that nobody knew to look
 * for it. A census is how a rule stops depending on the next author having
 * read the right file.
 *
 * That is this row's whole finding in one sentence: the work had been done and
 * was unreachable. A private helper reads as solved while the fault it
 * describes is still in the app.
 *
 * ## What this deliberately does not guard
 *
 * A bare `go` to the calendar. The tab bar, the `k` shortcut and the directory
 * all mean *open the calendar* and promise no particular day, so arriving
 * wherever the session last was is correct for them. Guarding those would make
 * the census fail on code that is right, which is how a census gets deleted.
 */

/** Files that write the three dispatches out instead of asking for them. */
function byHand(): string[] {
  return sources(join(process.cwd(), 'src'), { ext: ['.ts', '.tsx'] })
    .filter((f) => !f.path.includes('.test.'))
    .filter((f) => !f.path.endsWith(join('lib', 'opencal.ts')))
    .filter((f) => {
      const text = withoutComments(f.text);
      return /type:\s*'setCalDay'/.test(text) && /screen:\s*'calendar'/.test(text);
    })
    .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
}

describe('opening the calendar on a day', () => {
  it('goes through openCal everywhere', () => {
    expect(
      byHand(),
      'these set the day and navigate by hand; use `goCal`/`openCal` so the view travels too',
    ).toEqual([]);
  });

  /*
   * The order matters, not just the presence. Navigating first and setting the
   * day afterwards renders the calendar once on the old day, which is a
   * visible jump and is what re-deriving the sequence tends to produce.
   */
  it('sets the day and the view before it moves', () => {
    expect(openCal('2026-09-22')).toEqual([
      { type: 'setCalDay', date: '2026-09-22' },
      { type: 'setCalView', view: 'day' },
      { type: 'go', screen: 'calendar' },
    ]);
  });

  it('defaults to the day, and takes a wider grain when asked', () => {
    expect(openCal('2026-09-22')[1]).toEqual({ type: 'setCalView', view: 'day' });
    expect(openCal('2026-09-22', 'month')[1]).toEqual({ type: 'setCalView', view: 'month' });
  });

  it('dispatches the three in that order', () => {
    const seen: unknown[] = [];
    goCal((a) => seen.push(a), '2026-10-01', 'week');
    expect(seen).toEqual([
      { type: 'setCalDay', date: '2026-10-01' },
      { type: 'setCalView', view: 'week' },
      { type: 'go', screen: 'calendar' },
    ]);
  });
});
