/**
 * The shelves: two rows of pills and a line saying where you are.
 *
 * One of the app's four navigations, chosen in Appearance like the other
 * three. It arrived as part of the soft *layout*, which meant choosing that
 * layout put these rows on top of the tab bar or the rail that was already
 * drawn — two navigations at once, in one app. The rows were worth keeping;
 * being a layout's side effect was not. So they are a navigation now, and
 * `nav === 'shelves'` is the only thing that draws them, in every layout.
 *
 * Row one is the nine shelves. Row two is the screens on the shelf you are
 * standing on. Under both, the current screen's own sentence from the
 * registry — which is the cheapest discoverability the app can buy, because
 * fifty-five screens already carry a blurb that until now only the directory
 * and the search results ever showed.
 *
 * ## Everything the school has, not everything you have unlocked
 *
 * Row two is filtered by `destinationsFor` — the school gate — and not by
 * `showing`, the progressive-disclosure gate. That is a deliberate departure
 * and worth stating plainly, because `lib/reveal.ts` argues the opposite for
 * the directory.
 *
 * The argument there is that a directory of forty-six names is a wall to
 * somebody who opened the app an hour ago. It is a good argument about a
 * directory. These rows are not a directory: they are the chrome you navigate
 * by, they show one shelf at a time rather than all nine, and a row that
 * changes length as the term goes on is a row whose positions cannot be
 * learned. Reveal still governs Everything, and search still finds
 * everything, so nothing that was discoverable stops being so.
 *
 * ## The landmark
 *
 * The handoff says `<nav>` is at zero and lands here. It is not — the rail
 * and the tab bar are both `<nav aria-label="Sections">` already. So this one
 * takes its own label rather than a third copy of that one, and a screen
 * reader gets two distinguishable landmarks instead of two identical ones.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import { GROUPS, destination, destinationsFor, saysFor, shelfOf } from '../../lib/nav';

export function ShelfNav() {
  const { state, dispatch, school } = useStore();
  const here = shelfOf(state.screen);
  const caps = school.capabilities;
  const onShelf = destinationsFor(here, caps);
  const said = destination(state.screen);
  const rows = useRef<HTMLElement>(null);

  /*
   * Bring the pill you are on into view.
   *
   * Nine shelves do not fit 390px, so the row scrolls — and a row scrolled to
   * the left while you stand on Data shows you nine pills, none of which is
   * the one you are on. Without this the rows say where you can go and not
   * where you are, which is half a navigation.
   *
   * `nearest` rather than `center` so a pill already visible does not jump,
   * and `inline` only so selecting one never scrolls the page.
   */
  useEffect(() => {
    for (const el of rows.current?.querySelectorAll('.is-on') ?? []) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [state.screen]);

  return (
    <nav className="shelf-nav" aria-label="Screens" ref={rows}>
      <div className="shelf-nav-row" role="tablist" aria-label="Areas">
        {GROUPS.map((g) => {
          const on = g === here;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={on}
              className={`bare pill-soft shelf-nav-pill${on ? ' is-on' : ''}`}
              onClick={() => {
                // A shelf is not a screen, so pressing one opens the first
                // screen on it rather than doing nothing. Row two then shows
                // where that landed, which is the whole point of the pair.
                const first = destinationsFor(g, caps)[0];
                if (first) dispatch({ type: 'go', screen: first.screen });
              }}
            >
              {g}
            </button>
          );
        })}
      </div>

      <div className="shelf-nav-row" aria-label={`Screens in ${here}`}>
        {onShelf.map((d) => {
          const on = d.screen === state.screen;
          return (
            <button
              key={d.screen}
              type="button"
              aria-current={on ? 'page' : undefined}
              className={`bare pill-soft shelf-nav-pill${on ? ' is-on' : ''}`}
              onClick={() => dispatch({ type: 'go', screen: d.screen })}
            >
              {saysFor(d, caps).label}
            </button>
          );
        })}
      </div>

      {said ? <p className="shelf-nav-said">{saysFor(said, caps).blurb}</p> : null}
    </nav>
  );
}
