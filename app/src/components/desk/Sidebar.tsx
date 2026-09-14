/**
 * The workspace's left column, where there is room for one.
 *
 * Four rows and a button, and every one of them is somewhere the app already
 * goes. That is the whole design: a sidebar earns its width by holding the
 * handful of places somebody returns to between everything else, not by being
 * a second copy of the directory — which is what the rail beside it is, and
 * why the two are never drawn together (see `lib/chrome.ts`).
 *
 * ## Two rows went, because the bar above already had them
 *
 * It was six. **Search home** went to the same screen the bar's wordmark goes
 * to, and **Settings** to the same screen the bar's gear goes to — both drawn
 * in the same frame as the row that duplicated them, a few inches apart. The
 * bar's two survive because they are drawn at every width and this column is
 * not: `sidebar: desk && wide` in `lib/chrome.ts`, so on a phone-width
 * workspace there is no column at all and the wordmark and the gear are still
 * the way to both.
 *
 * Settings in particular failed this file's own test. A place you return to
 * *between everything else* is what the middle of this column is for, and
 * Settings is not one — it is somewhere you go on purpose, twice a term, and
 * it is in the launcher, in the bar, in the directory and in search.
 *
 * **New** is the capture box, not a menu. One line, from anywhere, is the
 * fastest thing in this app and the thing people forget exists; at the top of
 * the column in the position every workspace puts its primary action, it is
 * the first thing the eye lands on.
 *
 * The favourites in the middle are the same five as the search home's
 * shortcuts, read through the same function, so moving one moves it in both
 * places. `lib/desk.ts` holds the list.
 */

import { createElement } from 'react';
import { useStore } from '../../state/store';
import { currentLook } from '../../state/shape';
import { readFavourites } from '../../lib/desk';
import { rootOf, saysFor, screenName } from '../../lib/nav';
import type { Screen } from '../../lib/types';
import { secondLine } from '../../lib/dim';
import { glyphFor } from '../icons.pick';
import { AppsIcon, ConnectIcon, Plus } from '../Icons';

export function Sidebar() {
  const { state, dispatch, school, catalog } = useStore();
  const caps = school.capabilities;
  const favourites = readFavourites(currentLook(state).favourites, caps, state.role);
  /**
   * Whether a row is the one you are standing on.
   *
   * Two ways to be: it is the screen itself, or it is the *root* the screen
   * nests under — so a deadline opened three levels inside Courses still
   * lights Courses, which is the rule the tab bar and the rail already use.
   *
   * What it deliberately is not is "our roots match". Add a course roots
   * under Courses, so that comparison lit both rows at once the moment
   * anybody opened the course list — two rows saying "you are here" in a
   * column of six.
   */
  const lit = (screen: Screen) => state.screen === screen || rootOf(state.screen) === screen;

  const row = (
    screen: Screen,
    label: string,
    glyph: ReturnType<typeof glyphFor>,
    /** Where it goes. The screen's own `go`, unless a caller says otherwise. */
    onClick: () => void = () => dispatch({ type: 'go', screen }),
  ) => {
    const on = lit(screen);
    return (
      <button
        key={screen}
        type="button"
        className={on ? 'bare desk-row is-on' : 'bare desk-row'}
        onClick={onClick}
        aria-current={on ? 'page' : undefined}
      >
        {createElement(glyph, { size: 19 })}
        <span>{label}</span>
      </button>
    );
  };

  const courses = catalog.courses.length;
  const where = school.name?.trim();

  return (
    <nav className="desk-side" aria-label="Semester">
      <button
        type="button"
        className="bare desk-new"
        onClick={() => dispatch({ type: 'quickAdd', open: true })}
      >
        <Plus size={22} />
        <span>New</span>
      </button>

      {/*
        "App directory", not "All apps".

        The bar above draws nine dots whose own label is All apps, and it
        opens the launcher — a panel over the page you were reading — rather
        than this screen. Two controls in one frame answering to the same
        name and going to different places is worse than either of them being
        redundant: a screen reader read both out identically, and the only way
        to tell which you had was to press one. The screen is a directory and
        the panel is a launcher, so they are called those things.
      */}
      {row('directory', 'App directory', AppsIcon)}

      {favourites.length > 0 && (
        <>
          <div className="desk-side-label" style={secondLine()}>
            Your favourites
          </div>
          {favourites.map((d) => row(d.screen, saysFor(d, caps).label, glyphFor(d.screen)))}
        </>
      )}

      <div className="desk-side-gap" />

      {row('connect', screenName('connect'), ConnectIcon)}

      <div className="desk-side-foot" style={secondLine()}>
        {where && <div>{where}</div>}
        <div>{courses === 1 ? '1 course' : `${courses} courses`}</div>
      </div>
    </nav>
  );
}
