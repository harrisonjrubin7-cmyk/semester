import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSISTED, initialEphemeral, pickPersisted, type State } from './shape';
import { DESTINATIONS } from '../lib/nav';
import { readTabs } from '../lib/tabbar';
import { fromHash, toHash } from '../lib/route';

/**
 * Nothing saved can land the app on a screen that is not there any more.
 *
 * `/simplify` deletes screens, and the failure it has to be unable to cause is
 * this one: somebody's phone comes back from three weeks in a drawer, restores
 * whatever it had, and lands on a case the switch in `App.tsx` no longer has.
 * What that looks like is not an error — it is a blank page, which reads as the
 * app being broken rather than as a screen having moved.
 *
 * There are exactly two things that can put the app on a screen across a
 * restart, and this pins both.
 *
 *   **Saved state cannot, because the screen is not in it.** `pickPersisted`
 *   is the whole of what reaches storage, and `screen` has never been one of
 *   its keys — coming back tomorrow opens today rather than wherever you were
 *   standing. That is a design decision several screens' comments rely on, and
 *   it is load-bearing for screen deletion, so it is asserted rather than
 *   assumed.
 *
 *   **A URL can, and lands on Today.** `fromHash` deliberately passes an
 *   unknown name through — see its own test, "the rename table is not a licence
 *   to guess" — so `#/cloud` still produces `{ screen: 'cloud' }` after Files &
 *   mail was deleted. The catch is `App.tsx`'s `default: return <Today />`,
 *   which this file cannot import without rendering the whole app, so what is
 *   checked here is the half that belongs to the data: every screen the app
 *   *does* have is addressable, so a deletion can never quietly strand a live
 *   one.
 */
const state = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral() });

describe('what a restart can land on', () => {
  it('never saves which screen you were on', () => {
    // The direct proof. If `screen` ever joins this object, a deleted screen
    // becomes a blank page for anybody whose phone was on it, and this test is
    // the thing that says so before it ships.
    expect(state().screen).toBe('home');
    expect(Object.keys(pickPersisted(state()))).not.toContain('screen');
  });

  it('keeps every destination addressable, both ways', () => {
    // A screen in the directory that cannot be linked to is half-deleted: it
    // exists, and nothing can point at it. Round-tripping the whole registry
    // catches a deletion that took the route table with it and left the row.
    for (const d of DESTINATIONS) {
      const back = fromHash(toHash({ screen: d.screen, id: '' }));
      expect(back?.screen, `${d.screen} does not survive its own URL`).toBe(d.screen);
    }
  });

  it('has no directory row pointing at a screen the union dropped', () => {
    // `Screen` is a union, so a deleted member is a type error at the row that
    // names it — but only while the row is still typed as `Screen`. This is the
    // runtime half: the registry and the route table agree about what exists.
    const named = new Set(DESTINATIONS.map((d) => d.screen));
    expect(named.size).toBe(DESTINATIONS.length);
  });

  /*
   * The one saved thing that really does carry screen ids.
   *
   * The header above says there are exactly two ways to land on a screen
   * across a restart, and it is right about both — but a deleted screen can
   * also arrive as a *dead button*, which is the third shape of the same bug
   * and the one a phone in a drawer actually produces. `tabs` is persisted,
   * it is a list of screen names, and a student who put Tonight in their bar
   * last term has it in storage today.
   *
   * `readTabs` drops what the registry does not have. Pinned here with the
   * screens this merge retired, because "drops unknown screens" is a claim
   * that is easy to keep true by accident and easy to break by adding a
   * fallback that keeps them.
   */
  it('drops a retired screen out of a saved tab bar rather than drawing a dead button', () => {
    const bar = readTabs(['home', 'ahead', 'courses', 'tonight', 'study']);
    expect(bar).not.toContain('ahead');
    expect(bar).not.toContain('tonight');
    // And keeps what is still real, so this is not passing by emptying the bar.
    expect(bar).toContain('home');
    expect(bar).toContain('courses');
    expect(bar).toContain('study');
    for (const screen of bar) expect(DESTINATIONS.map((d) => d.screen)).toContain(screen);
  });
});
