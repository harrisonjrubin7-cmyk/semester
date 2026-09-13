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
 * The field, its + and its AI Tutor control are all hidden the moment the top
 * bar is suggesting, the launcher is open, Customize is open, the command
 * palette is open or the capture box is. Not dimmed and not lowered: hidden,
 * so they leave the tab order and the accessibility tree along with the
 * screen. A control you cannot see but can still tab into and still click
 * through is the fault this rule exists to prevent — it would sit under the
 * suggestions list and take the click meant for the first result.
 *
 * The rule itself is `centreHidden` in `lib/desk.ts`, so the shell and this
 * screen cannot come to different conclusions about whether something is up.
 *
 * Nothing is lost while it is away: the bar above this screen carries the same
 * search on every screen in this navigation, ⌘K still opens the palette, and
 * whatever is covering the centre is itself a way of finding something. That
 * is what makes hiding it outright the right answer rather than dimming it.
 *
 * ## Where the shortcuts come from
 *
 * `readFavourites`, resolved against the registry and the school gate, so a
 * saved list can arrange the row and can never put a dead tile in it. Adding
 * one opens the launcher, where the whole grid is; the ordering and the
 * membership are the student's.
 */

import { useStore } from '../state/store';
import { currentLook } from '../state/shape';
import { centreHidden, readFavourites } from '../lib/desk';
import { saysFor, shortFor } from '../lib/nav';
import { AppsIcon, AskIcon, EditIcon, Plus } from '../components/Icons';
import { glyphFor } from '../components/icons.pick';
import { createElement } from 'react';
import { useSuggesting } from '../components/desk/suggesting';
import { longLabel } from '../lib/date';

export function SearchHome() {
  const { state, dispatch, school, now, catalog } = useStore();
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
          <button
            type="button"
            className="bare deskhome-box"
            onClick={() => dispatch({ type: 'finder', open: true })}
          >
            <span className="deskhome-box-say">Search your semester</span>
          </button>
          <span className="deskhome-keys" aria-hidden="true">
            ⌘ K
          </span>
          <button
            type="button"
            className="bare deskhome-ai"
            onClick={() => dispatch({ type: 'go', screen: 'ask' })}
          >
            <AskIcon size={15} />
            <span>AI Tutor</span>
          </button>
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
