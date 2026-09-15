import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { sources, withoutComments } from '../styles/rules';
import { goMine, openMine } from './openmine';

/**
 * Opening Mine goes through `openMine`, so the tab cannot be forgotten.
 *
 * A task and an appointment have no screen of their own, so opening one is
 * two dispatches in order: `setMineTab`, then `go` to `mine`. Nothing in the
 * type system ties the two together, and the pair was written out by hand at
 * thirteen sites across `Calendar`, `Today`, `Mine` and `openHit`.
 *
 * At a fourteenth it was written with the first half missing. The aside on
 * Today's *Yours today* section dispatched `go → mine` alone; its label is
 * `${left} left`, a count of undone **tasks**, so pressing it landed you on
 * whichever tab Mine last showed. Driven in a browser: leave Mine on Events,
 * return to Today, press the button reading "1 left", arrive on Events.
 *
 * ## Why this is written on the source
 *
 * Because the fault is an omission, and an omission has nothing to assert on.
 * Rendering Today and clicking the button proves the one site that exists
 * today is right; it says nothing about the fifteenth, written next month by
 * somebody who has not read `openmine.ts`. The cheap, exact check is that the
 * pair is not spelled out anywhere again — which is the same argument
 * `components/onetablist.test.ts` and `styles/stacking.test.ts` make.
 *
 * It is also why this guard is worth more than the bug it was written for.
 * `mineTab` is ephemeral, so it resets to `tasks` on load and the first visit
 * of a session is always correct. A fault that only appears after a minute of
 * use is one nobody files, so it would have sat there indefinitely.
 */

/**
 * Files that *dispatch* their way to Mine without the helper.
 *
 * The shape matters, not the mention. `lib/nav.ts` and `lib/keys.ts` both
 * write `screen: 'mine'` and neither is a navigation: one is the destination
 * registry and the other the keyboard table, where `m` means "open Mine" in
 * general. Landing on the last tab is right for a shortcut that promises
 * nothing more specific — the fault this guards is a control that names one
 * list and opens another, which is a `go` with the tab left off.
 */
const GO_TO_MINE = /type:\s*'go'\s*,\s*screen:\s*'mine'|screen:\s*'mine'\s*,\s*type:\s*'go'/;

function byHand(): string[] {
  return sources(join(process.cwd(), 'src'), { ext: ['.ts', '.tsx'] })
    .filter((f) => !f.path.includes('.test.'))
    .filter((f) => !f.path.endsWith(join('lib', 'openmine.ts')))
    .filter((f) => GO_TO_MINE.test(withoutComments(f.text)))
    .map((f) => f.path.slice(f.path.indexOf('/src/') + 5));
}

describe('opening Mine', () => {
  it('goes through openMine everywhere', () => {
    expect(
      byHand(),
      'these route to Mine by hand; use `goMine`/`openMine` so the tab travels with the jump',
    ).toEqual([]);
  });

  /*
   * The order is the point, not just the presence. Going first and setting the
   * tab afterwards renders Mine once on the old tab, which is a visible flash
   * on a slow phone and is exactly what somebody re-deriving the pair would
   * get wrong.
   */
  it('sets the tab before it moves', () => {
    expect(openMine('appointments')).toEqual([
      { type: 'setMineTab', tab: 'appointments' },
      { type: 'go', screen: 'mine' },
    ]);
  });

  it('dispatches the pair in that order', () => {
    const seen: unknown[] = [];
    goMine((a) => seen.push(a), 'notes');
    expect(seen).toEqual([
      { type: 'setMineTab', tab: 'notes' },
      { type: 'go', screen: 'mine' },
    ]);
  });
});
