/**
 * The search home: the wordmark, one field, and the shortcuts under it.
 *
 * What a new tab in the workspace opens on, and what the app itself opens on
 * when the workspace is the navigation. It is deliberately almost empty — a
 * name, a place to type, and five things you actually open — because the
 * alternative was what every other home screen in this app already is, and
 * the point of a new tab is that it does not decide for you what today is
 * about.
 *
 * ## The centre goes away when anything is over it
 *
 * The field and its + are hidden the moment the top bar is suggesting, the
 * launcher is open, Customize is open, the command palette is open or the
 * capture box is. Not dimmed and not lowered: hidden,
 * so they leave the tab order and the accessibility tree along with the
 * screen. A control you cannot see but can still tab into and still click
 * through is the fault this rule exists to prevent — it would sit under the
 * suggestions list and take the click meant for the first result.
 *
 * The rule itself is `centreHidden` in `lib/desk.ts`, so the shell and this
 * screen cannot come to different conclusions about whether something is up.
 *
 * Nothing is lost while it is away: the bar above this screen carries the same
 * search on every screen in this navigation — it *is* the search this centre
 * box reaches, and `/` puts the cursor in it from anywhere in the workspace —
 * and whatever is covering the centre is itself a way of finding something.
 * That is what makes hiding it outright the right answer rather than dimming
 * it.
 *
 * This paragraph used to say "⌘K still opens the palette". It does not, and
 * never did in this build: `lib/keys.ts` ignores anything carrying a modifier
 * on principle, and the one ⌘K listener in the app is `ai/Assistant.tsx`'s,
 * which opens the assistant. There was a `⌘ K` chip in the row below saying
 * otherwise, and an identical one in the bar; both are gone with the second
 * search they were labelling.
 *
 * ## Where the shortcuts come from
 *
 * `readFavourites`, resolved against the registry and the school gate, so a
 * saved list can arrange the row and can never put a dead tile in it. Adding
 * one opens the launcher, where the whole grid is; the ordering and the
 * membership are the student's.
 */

import { useNow, useStore } from '../state/store';
import { currentLook } from '../state/shape';
import { centreHidden, readFavourites } from '../lib/desk';
import { saysFor, shortFor } from '../lib/nav';
import { AppsIcon, EditIcon, Plus } from '../components/Icons';
import { glyphFor } from '../components/icons.pick';
import { createElement } from 'react';
import { useSuggesting } from '../components/desk/suggesting';
import { useFocusBar } from '../components/desk/barfocus';
import { longLabel } from '../lib/date';
import { BookmarkChips } from '../components/Bookmarks';

export function SearchHome() {
  const { state, dispatch, school, catalog } = useStore();
  const now = useNow();
  const caps = school.capabilities;
  const look = currentLook(state);
  const favourites = readFavourites(look.favourites, caps, state.role);
  /*
   * Whether the top bar's own suggestions are down.
   *
   * Read from the shell rather than passed in: this screen is rendered by the
   * router and the bar is rendered by the shell, so there is no prop between
   * them — and a second copy of "is the bar suggesting" kept here is the
   * thing that would be stale exactly when it mattered.
   */
  const suggesting = useSuggesting();
  /*
   * The other direction through the same gap. `suggesting` comes down from
   * the bar; this goes back up to it. See `components/desk/barfocus.ts`.
   */
  const focusBar = useFocusBar();
  const covered = centreHidden({
    suggesting,
    apps: state.apps,
    customize: state.customize,
    finder: state.finder,
    quickAdd: state.quickAdd,
  });

  const courses = catalog.courses.length;

  return (
    <div className="deskhome">
      <div className="deskhome-mark chrome-text">Semester</div>

      {/*
        Hidden rather than dimmed — see the note at the top of this file. The
        row keeps its height so the shortcuts under it do not jump up the
        screen and back down again as somebody types in the bar above.
      */}
      <div className="deskhome-centre" hidden={covered}>
        <div className="deskhome-field">
          <button
            type="button"
            className="bare deskhome-plus"
            onClick={() => dispatch({ type: 'quickAdd', open: true })}
            aria-label="Add something in one line"
          >
            <Plus size={20} />
          </button>
          {/*
            The centre box puts the cursor in the bar. It does not search.

            It used to open the command palette, which made the workspace's
            front door two search fields one above the other: the bar's,
            answering with apps as you type, and this one, opening a palette
            that answers with records. Two vocabularies, two result sets,
            stacked — and nothing on either saying which was which.

            The browser idiom this screen is borrowed from is also the answer
            to it. A new-tab page's big centre box does not run a second
            search; it focuses the omnibox. So does this. One field, two
            places to reach it, and as soon as you type, the bar drops its
            list and `centreHidden` takes this row away — which is the same
            motion, and why the two rules do not fight.

            A button rather than an input for that reason: there is nothing to
            type into here, and a second text box that forwarded its keystrokes
            would be the duplicate again wearing a disguise.
          */}
          <button
            type="button"
            className="bare deskhome-box"
            /*
              The palette is the fallback, and it is reachable — not defensive
              padding.

              This screen is the workspace's own: it is not in the registry and
              no chrome outside that navigation points at it. But `fromHash`
              accepts any screen name in the address, so `#/search` bookmarked
              from the workspace still opens this screen after somebody
              switches to the tab bar — and there is no bar there to focus. The
              box falls back to the search it used to open rather than doing
              nothing, which is the one behaviour worse than either.
            */
            onClick={() => (focusBar ? focusBar() : dispatch({ type: 'finder', open: true }))}
          >
            <span className="deskhome-box-say">Search your semester</span>
          </button>
          {/*
            There was an AI Tutor button here.

            The bar directly above this screen draws one — same words, same
            glyph, same `go ask` — so on the one screen this component renders,
            the workspace put two identical controls one row apart. The bar's
            survives for the reason every survivor in this pass survives: it is
            drawn on every screen in this navigation and this one is drawn on
            exactly one, so keeping the narrower of the two would have been
            keeping the one that is usually not there.

            The assistant is not harder to reach for it. The bar's button is
            inches away, `ask` is in the launcher, the directory and search,
            and the floating button — "Ask about Alerts", named for wherever
            you are standing — opens the panel over this screen like any other.
            See `ai/Assistant.tsx` on why those two are not themselves a
            duplicate: one is a conversation carrying the screen you are on,
            the other is the room where every thread lives.
          */}
        </div>
      </div>

      {look.shortcuts !== 'off' && (
        <div className="deskhome-shortcuts">
          {favourites.map((d) => (
            <button
              key={d.screen}
              type="button"
              className="bare deskhome-shortcut"
              onClick={() => dispatch({ type: 'go', screen: d.screen })}
              title={saysFor(d, caps).blurb}
            >
              <span className="deskhome-shortcut-tile">
                {createElement(glyphFor(d.screen), { size: 24 })}
              </span>
              <span className="deskhome-shortcut-name">{shortFor(d, caps)}</span>
            </button>
          ))}
          <button
            type="button"
            className="bare deskhome-shortcut"
            onClick={() => dispatch({ type: 'apps', open: true })}
          >
            <span className="deskhome-shortcut-tile">
              <Plus size={24} />
            </span>
            <span className="deskhome-shortcut-name">Add shortcut</span>
          </button>
        </div>
      )}

      {/*
        Saved places, under the shortcuts — and only where the bar is not.

        The two rows are not the same thing and belong next to each other: a
        shortcut is an app, and a bookmark is one place inside one of them,
        carrying a name somebody wrote rather than the one the registry did.
        But in the workspace the bookmarks bar is eighteen pixels above this
        screen, and the same six chips twice on one window is the duplication
        this app treats as a bug rather than as generosity. So the bar has
        them there, and this has them in every other navigation — where this
        screen is reachable and no bar exists.
      */}
      {state.nav !== 'workspace' && (
        <div className="deskhome-marks">
          <BookmarkChips said="Bookmarks" />
        </div>
      )}

      <button
        type="button"
        className="bare deskhome-explore"
        onClick={() => dispatch({ type: 'go', screen: 'directory' })}
      >
        <AppsIcon size={15} />
        <span>Explore all apps</span>
        <span aria-hidden="true">→</span>
      </button>

      <div className="deskhome-foot">
        <div className="deskhome-foot-line">
          {/* The sample note, where the banner would be on every other screen
              in this layout — see the note beside `SampleMark` in `App.tsx`.
              Saying which kind of semester this is matters most on the screen
              somebody opens first. */}
          {state.sample ? 'Sample semester' : longLabel(now)}
          {courses > 0 && (
            <>
              {'  ·  '}
              {courses === 1 ? '1 course this semester' : `${courses} courses this semester`}
            </>
          )}
        </div>
        <button
          type="button"
          className="bare deskhome-customize"
          onClick={() => dispatch({ type: 'customize', open: true })}
          aria-haspopup="dialog"
          aria-expanded={state.customize}
        >
          <EditIcon size={15} />
          <span>Customize Semester</span>
        </button>
      </div>
    </div>
  );
}
