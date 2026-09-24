/**
 * The one bar, under the tabs, on every screen.
 *
 * A search field that is *always there* is the whole of what this adds. The
 * app already had search — a very good search, `components/Command.tsx` — and
 * it was behind a magnifier in a row of four icons, which is the difference
 * between a thing people use fifty times a day and a thing people use when
 * they remember it exists.
 *
 * ## Two searches, and it is deliberate
 *
 * This box answers with *apps*: the screens the app has, matched on their
 * names, their sentences, their categories and their keywords, so "powerpoint"
 * reaches Deck and "gmail" reaches Mail. Below those it offers the record
 * search — courses, deadlines, readings, notes — as one row that opens the
 * palette on what has been typed, so nothing is lost and the two are never
 * mixed into one undifferentiated list.
 *
 * The palette is still the record search, and in this navigation it is
 * reached from here: the row at the bottom of these suggestions opens it on
 * whatever has been typed. What is new is that the first thing you type in
 * now answers the question people actually have most often, which is "where
 * is the thing that does X", and the records are one key further on rather
 * than in front of them.
 *
 * This list used to begin "⌘K", name `/`, and end "and the field on the
 * search home". None of the three is right now:
 *
 * - **⌘K** never opened the palette. `lib/keys.ts` ignores modifiers on
 *   principle, so the app's only ⌘K listener is `ai/Assistant.tsx`'s, and it
 *   opens the assistant.
 * - **`/`** opens the palette on the five navigations that have no bar. Here
 *   it puts the cursor in *this field*, because the search is already on
 *   screen and covering it with an overlay would be two searches in one frame.
 * - **The search home's field** is no longer a search at all: it focuses this
 *   one.
 *
 * The last two are the same change seen from the keyboard and from the
 * pointer. See `components/desk/barfocus.ts`.
 *
 * ## Keyboard
 *
 * Down and Up move through the suggestions, Enter opens the one under the
 * cursor, Escape closes the list and leaves the text, a second Escape clears
 * it. The list is a `listbox` with `aria-activedescendant`, so the row a
 * screen reader announces is the row the arrow keys are on rather than
 * wherever focus happens to be — focus stays in the field throughout, which
 * is what makes typing and arrowing in the same breath possible.
 */

import { createElement, useEffect, useId, useState } from 'react';
import { useStore } from '../../state/store';
import { findApps } from '../../lib/desk';
import { saysFor } from '../../lib/nav';
import { secondLine } from '../../lib/dim';
import { glyphFor } from '../icons.pick';
import { recordSearch } from '../../lib/browser.hook';
import { Mark } from '../Brand';
import { Avatar } from '../Avatar';
import { BookmarkStar } from '../Bookmarks';
import {
  AppsIcon,
  AskIcon,
  Bell,
  Search as SearchIcon,
  SettingsIcon,
} from '../Icons';

/** How many app suggestions the list will show before the record row. */
const SHOWN = 6;

export function TopBar({
  /** Told when the list opens or closes, so the shell can hide the centre. */
  onSuggesting,
  /**
   * The shell's handle on this field, so the search home's centre box can put
   * the cursor here rather than opening a second search.
   *
   * Passed in rather than kept here and published upwards: the shell has to
   * hand the same handle to `FocusBarProvider`, and a ref this component
   * created and then registered would be two objects to keep in step for no
   * gain. See `components/desk/barfocus.ts`.
   */
  boxRef,
}: {
  onSuggesting: (open: boolean) => void;
  boxRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { state, dispatch, school } = useStore();
  const caps = school.capabilities;
  const [text, setText] = useState('');
  const [at, setAt] = useState(0);
  const box = boxRef;
  const listId = useId();

  const apps = text.trim() ? findApps(text, caps, state.role, SHOWN) : [];
  /*
   * The record search is offered as one row rather than as results.
   *
   * Running `findEverything` here as well would mean two lists of results in
   * two places doing the same work, and the palette is the better of the two
   * at showing them — it has the chips, the near-miss pass, the tabs and the
   * spelling guess. So this says how to get there and hands the query over
   * intact.
   */
  const rows = apps.length + (text.trim() ? 1 : 0);
  const open = rows > 0;

  // The shell is told, rather than reading back into this component: the
  // search home's centre has to leave the tab order in the same frame the
  // list appears in. See `components/desk/suggesting.ts`.
  useEffect(() => {
    onSuggesting(open);
  }, [open, onSuggesting]);

  // Closing the list on the way out, so a bar unmounted mid-search does not
  // leave the search home's centre hidden with nothing over it.
  useEffect(() => () => onSuggesting(false), [onSuggesting]);

  const cursor = Math.min(at, Math.max(0, rows - 1));

  const openApp = (i: number) => {
    if (i < apps.length) {
      dispatch({ type: 'go', screen: apps[i].screen });
    } else {
      /*
       * The record row. The palette opens on what was typed, and the way to
       * tell it is to write the query onto the tab — `Command` reads
       * `here().query` on open, because a tab remembers what it was
       * searching for. Setting it here rather than adding a second channel
       * means the strip and the palette stay the one source they already are.
       */
      recordSearch(text);
      dispatch({ type: 'finder', open: true });
    }
    setText('');
    setAt(0);
    box.current?.blur();
  };

  return (
    <div className="desktop-bar">
      <button
        type="button"
        className="bare desktop-brand"
        onClick={() => dispatch({ type: 'go', screen: 'search' })}
        aria-label="Semester — the search home"
      >
        <span className="desktop-mark" aria-hidden="true">
          <Mark size={17} />
        </span>
        <span className="desktop-word brandword chrome-text">Semester</span>
      </button>

      <div className="desktop-search">
        <div className="desktop-field">
          <SearchIcon size={18} />
          <input
            ref={box}
            className="bare desktop-input"
            type="search"
            value={text}
            placeholder="Search apps and features"
            aria-label="Search apps and features"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={open ? `${listId}-${cursor}` : undefined}
            // A combobox rather than a searchbox: the list below is the
            // control's own, and a screen reader has to be told it exists or
            // the arrow keys move through nothing it can describe.
            role="combobox"
            aria-autocomplete="list"
            onChange={(e) => {
              setText(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setAt((n) => Math.min(n + 1, rows - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setAt((n) => Math.max(n - 1, 0));
              } else if (e.key === 'Enter' && rows > 0) {
                e.preventDefault();
                openApp(cursor);
              } else if (e.key === 'Escape') {
                // The list first, the text second. Emptying the box on the
                // first press throws away what somebody typed when all they
                // wanted was the list out of the way.
                if (open) setText('');
                else box.current?.blur();
              }
            }}
          />
          {text && (
            <button
              type="button"
              className="bare desktop-clear"
              onClick={() => {
                setText('');
                box.current?.focus();
              }}
              aria-label="Clear the search"
            >
              ✕
            </button>
          )}
          {/* The star, where a browser puts it: in the field, about the page
              the tab you are on is showing. See `components/Bookmarks.tsx`. */}
          <BookmarkStar />
          {/*
            There was a `⌘ K` chip here, and it was not true.

            `lib/keys.ts` ignores anything carrying a modifier on principle —
            the rule that keeps this app out of the browser's shortcuts — so
            no single-letter binding can be ⌘-anything. The one ⌘K listener in
            the app is `ai/Assistant.tsx`'s, and it opens the assistant. So
            this chip sat inside a *search field* advertising a key that opens
            a chat, and the search home drew an identical one a row below it.

            Removed rather than corrected, and then the key it should have
            named arrived: `/` focuses this field in this navigation. It is
            still not written here. A chip inside a field is a hint for
            somebody who is already looking at the field — which is the one
            person who does not need a way to reach it — and the `?` sheet is
            where every other binding in the app is listed.

            The star above it arrived from `main` in the same place, which
            is where a browser keeps one — so the field ends in the control
            that acts on what you are looking at rather than in a claim
            about a key.
          */}
          {/*
            Named here as well as in the span, because below 760px the span is
            not drawn: `.desktop-ai span { display: none }` in app.css leaves
            the glyph alone in the bar. The name then came only from text that
            had been display-none'd, which is no name at all — a screen reader
            on a phone announced "button" and stopped, on the one control in
            this bar that opens the assistant.

            The same answer the tab bar gives when its labels are off: the
            glyph carries the picture and `aria-label` carries the name, so
            the button reads identically at every width. The span stays for
            the sighted reader where there is room for it, and being labelled
            twice with the same words is not a conflict — `aria-label` wins,
            and it wins with the text that was already there.
          */}
          <button
            type="button"
            className="bare desktop-ai"
            aria-label="Semester Intelligence"
            onClick={() => dispatch({ type: 'go', screen: 'ask' })}
          >
            <AskIcon size={15} />
            <span>Semester Intelligence</span>
          </button>
        </div>

        {open && (
          <div className="desktop-drop" id={listId} role="listbox" aria-label="Suggestions">
            <div className="desktop-drop-head" style={secondLine()}>
              {apps.length === 0
                ? 'No app matches that'
                : apps.length === 1
                  ? '1 matching app'
                  : `${apps.length} matching apps`}
            </div>
            {apps.map((d, i) => {
              const said = saysFor(d, caps);
              return (
                <button
                  key={d.screen}
                  type="button"
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === cursor}
                  className={i === cursor ? 'bare desktop-hit is-on' : 'bare desktop-hit'}
                  // `onMouseDown` rather than `onClick`: the field loses focus
                  // first on a click, the list unmounts with it, and the click
                  // lands on whatever the page put there instead.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openApp(i);
                  }}
                  onMouseEnter={() => setAt(i)}
                >
                  <span className="desktop-hit-tile">
                    {createElement(glyphFor(d.screen), { size: 19 })}
                  </span>
                  <span className="desktop-hit-says">
                    <span className="desktop-hit-name">{said.label}</span>
                    <span className="desktop-hit-blurb" style={secondLine()}>
                      {said.blurb}
                    </span>
                  </span>
                  <span className="desktop-hit-group" style={secondLine()}>
                    {d.group}
                  </span>
                </button>
              );
            })}
            {text.trim() && (
              <button
                type="button"
                id={`${listId}-${apps.length}`}
                role="option"
                aria-selected={cursor === apps.length}
                className={
                  cursor === apps.length ? 'bare desktop-more is-on' : 'bare desktop-more'
                }
                onMouseDown={(e) => {
                  e.preventDefault();
                  openApp(apps.length);
                }}
                onMouseEnter={() => setAt(apps.length)}
              >
                <span>Browse all results</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="desktop-tools">
        <button
          type="button"
          className="btn btn-ghost btn-icon tap"
          onClick={() => dispatch({ type: 'go', screen: 'notifs' })}
          aria-label="Alerts"
          style={{ position: 'relative' }}
        >
          <Bell size={19} />
          {!state.cleared && <span className="desktop-dot" />}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon tap"
          onClick={() => dispatch({ type: 'go', screen: 'settings' })}
          aria-label="Settings"
        >
          <SettingsIcon size={19} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon tap"
          onClick={() => dispatch({ type: 'apps', open: !state.apps })}
          aria-label="All apps"
          aria-haspopup="dialog"
          aria-expanded={state.apps}
        >
          <AppsIcon size={19} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon tap"
          onClick={() => dispatch({ type: 'go', screen: 'profile' })}
          aria-label={state.myName.trim() ? `Profile — ${state.myName.trim()}` : 'Profile'}
        >
          <Avatar name={state.myName} size={22} />
        </button>
      </div>
    </div>
  );
}
