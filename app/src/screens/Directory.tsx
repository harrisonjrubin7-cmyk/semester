/**
 * Every app this student has, as a list or a grid.
 *
 * The launcher answers "where is the thing that looks like this"; the top bar
 * answers "where is the thing called this". This answers the third question,
 * which neither of those can: *what is there*. It shows the whole registry
 * with its sentences intact, which is what somebody reads once, in their first
 * week, and then never needs again.
 *
 * ## It is not the only surface that does, and that is unresolved
 *
 * `screens/Me.tsx`'s "Everything" tab draws the same registry through the same
 * `offered` gate, and nothing hides it in this navigation — so a student in
 * the workspace can reach two full directories, one from the sidebar and one
 * from Progress. This file used to claim to be the only one, which was written
 * before the two met.
 *
 * Neither is a copy of the other's *markup* — this one has the category rail,
 * the two views and the stars; Me's has the shelves, Lately and Not tried —
 * but they answer one question, which is the thing `SIMPLIFY-AUDIT.md` exists
 * to remove. It is recorded there as the pass's one open row rather than
 * merged, because which of the two survives depends on which navigation the
 * person is actually using, and §6 of that file is four reversals of exactly
 * this kind of question being answered from the code instead of by them.
 *
 * ## What is this screen's, and what is not
 *
 * The membership is `lib/nav.ts`'s, gated by the school and the role through
 * `allApps`; the names and sentences are `saysFor`'s, so a school that calls
 * its registrar YES gets YES here too; the shortcuts are `lib/desk.ts`'s, the
 * same list the search home and the sidebar read. The filtering, the two
 * views and the stars are this file's.
 *
 * ## The star writes the same list the launcher's pencil writes
 *
 * One preference, reachable from three places. A second list of favourites
 * kept here would be the exact fault the registry exists to prevent, one
 * layer up.
 */

import { createElement, useState } from 'react';
import { useStore } from '../state/store';
import { currentLook } from '../state/shape';
import { directoryOf } from '../lib/look';
import { allApps, isFavourite, narrowApps, readFavourites, toggleFavourite } from '../lib/desk';
import type { Destination } from '../lib/nav';
import { ALWAYS_TO_HAND, GROUPS, lately, saysFor } from '../lib/nav';
import { showing } from '../lib/reveal';
import { focusLine, focused, inFocusMode, setAside } from '../lib/focus';
import { secondLine } from '../lib/dim';
import { glyphFor } from '../components/icons.pick';
import { AppsIcon, NotesIcon, Search as SearchIcon, StarIcon } from '../components/Icons';
import { NotYetOpened } from '../components/NotYetOpened';
import type { Screen } from '../lib/types';

/**
 * Already reachable without this list, so repeating them here is noise.
 *
 * Carried across from `screens/Me.tsx` with the Lately list, where the
 * comment beside it said "already a tab on the phone". It is the same three
 * for the same reason, and `lately` also gates on the school and the role, so
 * a screen visited before somebody changed university or switched to teaching
 * cannot come back here after this list has stopped offering it.
 */

export function Directory() {
  const { state, dispatch, facts, school } = useStore();
  const caps = school.capabilities;
  const look = currentLook(state);
  /*
   * List or grid, and it borrows the setting the rest of the app already has.
   *
   * `directory` is the look key that decides whether the index of everything
   * is a column of rows or a field of tiles, and it is chosen on Layout and
   * navigation. The toggle in the corner writes that key rather than a state
   * of its own, so choosing the grid here is the same choice made there — one
   * preference, three doors, which is the rule this workspace is built on.
   *
   * Read through `directoryOf`, not off the key, and that is a fix rather
   * than a flourish. The key has three states and only two are choices: empty
   * means nobody has chosen, and there the layout answers — soft draws tiles.
   * This screen compared the raw key to `'tiles'`, so an unchosen soft-layout
   * account got the list here while **Layout and navigation** showed Tiles
   * selected, because that screen has always resolved it. One setting, two
   * readings, disagreeing about what it said.
   *
   * It could disagree because there were two renderers. Progress → Everything
   * was the other, and it resolved correctly; now that its tab has merged in
   * here this is the only screen the key drives, so this is the reading.
   */
  const grid = directoryOf(look.directory, state.shell) === 'tiles';
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');

  /*
   * The third gate, which this screen was the one place left to apply.
   *
   * `allApps` is the school and the role. `showing` is `lib/reveal.ts` — the
   * screens that are real but not useful yet, which a brand-new account is
   * not shown a wall of. Settings offers a switch for it and a sentence
   * counting what it is holding back, and until this line existed both were
   * describing something no code did: measured on a fresh account with no
   * courses, the switch said *46 screens appear once there is something for
   * them to work on* while this list drew all 58, and flipping the switch
   * changed nothing.
   *
   * It is a restoration rather than a new rule. `Progress → Everything` used
   * to draw the registry through `nav.ts`'s `listed()`, which is these three
   * gates together; `4eb1044` merged that tab into this screen because two
   * surfaces should not draw one registry, and the gate was what differed
   * between them. The merge's own message lists what it carried across —
   * Lately and Not-opened-yet — and the gate is the one thing it did not
   * notice going. `listed()` has had no caller since.
   *
   * Browsing only. A query lifts it, because `reveal.ts` is explicit that
   * hiding something from a directory is a claim about what is useful yet
   * and hiding it from *search* would be a claim about what somebody is
   * allowed to want. The top bar was never gated and still is not.
   */
  const every = allApps(caps, state.role);
  /*
   * And the fourth, which is the person's rather than the app's.
   *
   * `lib/focus.ts` sets aside the shelves that are not this term's work for
   * as long as the switch in Settings is on. Applied after `showing` and
   * lifted by a query for the same reason that one is: a directory is what
   * you want in front of you, and search is what you are allowed to want.
   */
  const browsing = focused(
    every.filter((d) => showing(d.screen, facts, state.visited, state.showAll)),
    state.focus,
  );
  const apps = query.trim() ? every : browsing;
  const aside = setAside(every, state.focus);
  /*
   * The chips are read off what this list actually holds, not off the
   * registry, for the reason `desk.ts`'s `categories` gives about the school
   * gate: a shelf whose every screen is held back is a chip that empties the
   * list when pressed. With no courses that is most of them.
   *
   * And a chip that is no longer offered is not honoured — clearing a query
   * can take the shelf you were standing on away with it, and a filter on a
   * shelf with nothing on it is an empty screen with no way back to the list.
   */
  const chips: string[] = GROUPS.filter((g) => apps.some((d) => d.group === g));
  const shown = narrowApps(apps, chips.includes(category) ? category : '', query, caps);
  const favourites = readFavourites(look.favourites, caps, state.role);
  const recent = lately(state.recent, state.tabs, caps, ALWAYS_TO_HAND, 4, state.role);

  const star = (screen: Screen) =>
    dispatch({
      type: 'setLook',
      look: { favourites: toggleFavourite(look.favourites, screen, caps, state.role) },
    });

  /** One app as a card. Favourites and Lately are the same object. */
  const card = (d: Destination) => {
    const said = saysFor(d, caps);
    return (
      <button
        key={d.screen}
        type="button"
        className="bare deskdir-favcard"
        onClick={() => dispatch({ type: 'go', screen: d.screen })}
        title={said.blurb}
      >
        <span className="deskdir-favtile">{createElement(glyphFor(d.screen), { size: 21 })}</span>
        <span className="deskdir-favsays">
          <span className="deskdir-favname">{said.label}</span>
          {/*
            What the screen does, not what shelf it is on.

            This line was `d.group`, so a row of favourites read "Study",
            "Study", "Courses" — three cards whose second lines were the least
            distinguishing thing about them, under names that are already
            grouped by the chips below. The sentence was there the whole time:
            `saysFor` returns it and this card was passing it to `title`,
            which is a tooltip, which is nothing at all on a phone.
          */}
          <span className="deskdir-favgroup" style={secondLine()}>
            {said.blurb}
          </span>
        </span>
        <span aria-hidden="true" className="deskdir-favgo">
          ↗
        </span>
      </button>
    );
  };

  const starButton = (screen: Screen, label: string) => {
    const on = isFavourite(look.favourites, screen, caps, state.role);
    return (
      <button
        type="button"
        className={on ? 'bare deskdir-star is-on' : 'bare deskdir-star'}
        onClick={() => star(screen)}
        aria-pressed={on}
        aria-label={on ? `Unpin ${label}` : `Pin ${label}`}
      >
        <StarIcon size={19} />
      </button>
    );
  };

  return (
    <div className="deskdir">
      <div className="deskdir-top">
        <h2 className="deskdir-welcome chrome-text">Welcome to Semester</h2>
        <div className="deskdir-count" style={secondLine()}>
          {apps.length} apps, one semester
        </div>
      </div>
      {/*
        Said, while it is on. A mode that hides things and does not say so is
        a bug report waiting to be written — "where did Classmates go" — and
        the answer belongs on the screen it went from, with the way back.
      */}
      {inFocusMode(state.focus) && !query && (
        <div className="deskdir-focus" style={secondLine()}>
          {focusLine(aside)}{' '}
          <button type="button" className="bare deskdir-focusoff" onClick={() => dispatch({ type: 'go', screen: 'setNav' })}>
            Turn focus off
          </button>
        </div>
      )}

      {/*
        Three lists above the index, and only when you are not filtering.

        Favourites are what you chose, Lately is where you have just been, and
        Not opened yet is what you never have — three answers to "where was
        that" which the index below cannot give, because a list of sixty in
        registry order has no answer to any of them. They came from Progress →
        Everything when that tab merged into this screen; the alternative was
        losing them, since nothing else in the app drew either.

        Hidden the moment a filter or a category is on. Somebody typing into
        the box has stopped asking "where was that" and started asking "where
        is the thing called this", and three lists that ignore the filter
        sitting above a list that obeys it reads as a bug.
      */}
      {!query && !category && (
        <>
          {favourites.length > 0 && (
            <>
              <div className="deskdir-label">Your favourites</div>
              <div className="deskdir-fav">{favourites.map(card)}</div>
            </>
          )}

          {recent.length > 0 && (
            <>
              <div className="deskdir-label">Lately</div>
              <div className="deskdir-fav">{recent.map(card)}</div>
            </>
          )}

          {/* The same set the list above draws, so the two panels on this
              screen cannot disagree about what the app contains. */}
          <NotYetOpened pool={browsing} />
        </>
      )}

      <div className="deskdir-bar">
        <div className="deskdir-label">All applications</div>
        <div className="deskdir-views" role="group" aria-label="How to show the apps">
          <button
            type="button"
            className={grid ? 'bare deskdir-view' : 'bare deskdir-view is-on'}
            onClick={() => dispatch({ type: 'setLook', look: { directory: 'list' } })}
            aria-pressed={!grid}
            aria-label="Show as a list"
          >
            <NotesIcon size={17} />
          </button>
          <button
            type="button"
            className={grid ? 'bare deskdir-view is-on' : 'bare deskdir-view'}
            onClick={() => dispatch({ type: 'setLook', look: { directory: 'tiles' } })}
            aria-pressed={grid}
            aria-label="Show as a grid"
          >
            <AppsIcon size={17} />
          </button>
        </div>
      </div>

      <div className="deskdir-find">
        <SearchIcon size={17} />
        <input
          className="bare deskdir-findbox"
          type="search"
          value={query}
          placeholder="Filter these apps"
          aria-label="Filter these apps"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="deskdir-chips" role="group" aria-label="Categories">
        <button
          type="button"
          className={category === '' ? 'bare deskdir-chip is-on' : 'bare deskdir-chip'}
          onClick={() => setCategory('')}
          aria-pressed={category === ''}
        >
          All apps
        </button>
        {chips.map((group) => (
          <button
            key={group}
            type="button"
            className={category === group ? 'bare deskdir-chip is-on' : 'bare deskdir-chip'}
            onClick={() => setCategory(group)}
            aria-pressed={category === group}
          >
            {group}
          </button>
        ))}
      </div>

      {/*
        How many of them you are looking at, while you are narrowing.

        A filter with no count is a filter you have to scroll to the bottom of
        to judge, and the bottom of this list is sixty rows away. Spoken as a
        status region rather than drawn only, because the list below it
        changes under a screen reader with nothing said about it.

        Hidden when nothing is narrowed: "58 of 58 apps" over the whole
        directory is a number that answers a question nobody asked.
      */}
      {(query || category) && (
        <div className="deskdir-status" role="status">
          <span style={secondLine()}>
            {shown.length} of {apps.length} apps
            {category && ` in ${category}`}
          </span>
          <button
            type="button"
            className="bare tappable tap-y standing-clear"
            onClick={() => {
              setQuery('');
              setCategory('');
            }}
          >
            Show them all
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        /*
          The dead end, with the way out drawn on it.

          "Nothing here matches that" was the whole screen: true, and it left
          somebody holding a filter they would have to notice, find and empty
          themselves — two controls up, one of which is a chip they may not
          remember pressing. The button above is on screen in this state, and
          this says so rather than assuming it was seen.
        */
        <p className="deskdir-none" style={secondLine()}>
          Nothing here matches that. <strong>Show them all</strong> brings back
          all {apps.length}.
        </p>
      ) : grid ? (
        <div className="deskdir-grid">
          {shown.map((d) => {
            const said = saysFor(d, caps);
            return (
              <div key={d.screen} className="deskdir-card">
                <div className="deskdir-cardtop">
                  <button
                    type="button"
                    className="bare deskdir-cardtile"
                    onClick={() => dispatch({ type: 'go', screen: d.screen })}
                    aria-label={said.label}
                  >
                    {createElement(glyphFor(d.screen), { size: 21 })}
                  </button>
                  {starButton(d.screen, said.label)}
                </div>
                <button
                  type="button"
                  className="bare deskdir-cardsays"
                  onClick={() => dispatch({ type: 'go', screen: d.screen })}
                >
                  <span className="deskdir-cardname">{said.label}</span>
                  <span className="deskdir-cardblurb" style={secondLine()}>
                    {said.blurb}
                  </span>
                  <span className="deskdir-cardgroup" style={secondLine()}>
                    {d.group}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="deskdir-list">
          <div className="deskdir-head" style={secondLine()}>
            <span>Name</span>
            <span className="deskdir-col-blurb">What you can do</span>
            <span className="deskdir-col-group">Category</span>
            <span className="deskdir-col-star">Favourite</span>
          </div>
          {shown.map((d) => {
            const said = saysFor(d, caps);
            return (
              <div key={d.screen} className="deskdir-row">
                <button
                  type="button"
                  className="bare deskdir-rowopen"
                  onClick={() => dispatch({ type: 'go', screen: d.screen })}
                >
                  <span className="deskdir-rowtile">
                    {createElement(glyphFor(d.screen), { size: 18 })}
                  </span>
                  <span className="deskdir-rowname">{said.label}</span>
                  <span className="deskdir-col-blurb deskdir-rowblurb" style={secondLine()}>
                    {said.blurb}
                  </span>
                  <span className="deskdir-col-group deskdir-rowgroup" style={secondLine()}>
                    {d.group}
                  </span>
                </button>
                <span className="deskdir-col-star">{starButton(d.screen, said.label)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
