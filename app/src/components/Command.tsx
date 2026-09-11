/**
 * The app's own browser: tabs across the top, one box under them, and a search
 * engine behind it that only knows this app.
 *
 * ## Why it looks like a browser
 *
 * The app can already find anything — `lib/find.ts` searches deadlines, study
 * units, courses, notes, tasks, the things you have made and the app's own
 * screens, and does it well. Two problems were left, and both of them are
 * problems a browser solved decades ago and everybody already knows the
 * answer to.
 *
 * The first was where search lived: on a screen, reached by pressing `/`,
 * which *navigated there*. Looking something up meant leaving whatever you
 * were reading, and going back was a second decision. So this is an overlay —
 * it opens over the screen, it closes, and the screen is still there.
 *
 * The second is that the app shows one screen at a time. "I was reading the
 * guide, let me check when it is due, now where was I" is three navigations
 * and a lost place. Tabs are the answer nobody has to be taught: the strip
 * holds the places you have open, picking one goes there, and a new tab is
 * empty. What a tab *shows* is the app itself — this is chrome over the one
 * pane the app has always had, which is why landing on a screen closes the
 * overlay rather than drawing the screen in here a second time.
 *
 * ## Why it works like a search engine
 *
 * Because the box is the way in, and a box that answers only after Enter asks
 * you to know the word. So it does what the box everybody uses does, and the
 * order is deliberate: your recent searches first, then completions drawn
 * from the names of things that can actually be found — nothing offered can
 * come back empty — then, on an empty box, somewhere to start. `lib/suggest.ts`
 * holds the rules; this draws them.
 *
 * A new tab is the search page, with the wordmark, the box and a row of
 * shortcuts to where you have been. Enter turns it into a results page: the
 * box moves to the top, the results come under it, and a row of chips narrows
 * them to one kind. That is the whole model, and every part of it is a thing
 * the person holding the phone has done ten thousand times somewhere else.
 *
 * ## No commands
 *
 * Deliberately not a command palette in the "type a verb, run an action"
 * sense. Actions that change data need to say what they will do before they
 * do it — every one in this app is a screen with a preview and a button — and
 * a list that mixes "go to the calendar" with "delete this course" is a list
 * where one wrong Enter is unrecoverable.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useModal } from '../a11y/modal';
import { useStore } from '../state/store';
import { useAI } from '../ai/store';
import { countHits, findEverything, spelled } from '../lib/find';
import { flatten, hitKey, landingOf, openHit } from '../lib/openhit';
import { DESKTOP, useMedia } from '../lib/media';
import { offered, screenName } from '../lib/nav';
import { secondLine } from '../lib/dim';
import { AskIcon, ClocksIcon, Plus, Search as SearchIcon } from './Icons';
import { TabGlyph } from './TabIcon';
import { readSearches, remember, forget, suggestions, writeSearches } from '../lib/typeahead';
import {
  NEW_TAB,
  add,
  close as shutTab,
  current,
  openBeside,
  read as readStrip,
  select,
  visit,
  write as writeStrip,
  type Strip,
} from '../lib/browser';
import type { Screen } from '../lib/types';

/** How wide the results column gets, matching the app's own pane. */
const COLUMN = 620;

/** And the box on the search page, which is a shape people recognise. */
const BOX = 540;

/** How many shortcuts the search page shows before "Show more". */
const SHORTCUTS = 7;

/**
 * A screen this build still has.
 *
 * `screenName` answers with the id itself for anything it cannot name, and
 * `nav.test.ts` holds that every real screen is named by one of its three
 * registries — so this is the same question asked cheaply. It matters at the
 * one place a stale name can arrive: a strip of tabs saved by an older build.
 */
const known = (screen: string) => screenName(screen as Screen) !== screen;

export function Command({ onClose }: { onClose: () => void }) {
  const { state, dispatch, now, catalog, school } = useStore();
  const ai = useAI();
  const wide = useMedia(DESKTOP);
  // Empty every time. It used to open seeded from a screen's own filter box,
  // and there are no filter boxes any more — this is where searching starts.
  const [text, setText] = useState('');
  /** The query that has been searched. Empty means the new-tab page is up. */
  const [sent, setSent] = useState('');
  /** Which kind of result the chips are narrowed to, or everything. */
  const [only, setOnly] = useState('All');
  const [at, setAt] = useState(0);
  /** Which suggestion the arrow keys are on, or none. */
  const [pick, setPick] = useState(-1);
  /*
   * Whether the suggestion list is up.
   *
   * Down to begin with, and not raised by focus: the box takes focus the
   * moment this opens, so a list that follows focus would cover the shortcuts
   * every single time — which is a new tab that never shows you the row of
   * places you actually go. It comes up on a click in the box, or on the
   * first thing typed, which is when somebody has asked for it.
   */
  const [dropped, setDropped] = useState(false);
  const [more, setMore] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => readSearches());
  const box = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  /**
   * The strip, as it was left — with the tab you are on brought up to date.
   *
   * A tab that has been somewhere follows the app: the page it is showing is
   * whatever screen is behind this overlay, so it says so. A tab that has
   * never been anywhere stays a new tab, which is what makes "open a tab, do
   * not go anywhere, come back to it" behave the way it does in a browser.
   */
  const [strip, setStrip] = useState<Strip>(() => {
    const saved = readStrip(known);
    return current(saved).screen === null
      ? saved
      : visit(saved, state.screen, screenName(state.screen));
  });

  /**
   * A new strip, kept where it will be found tomorrow.
   *
   * Written from the handler rather than from an effect, because half of
   * these handlers close the overlay in their next breath — and an effect
   * scheduled on a component that is unmounting is an effect that does not
   * run. The tab you just opened something in is exactly the one worth
   * keeping.
   */
  const keep = (next: Strip) => {
    setStrip(next);
    writeStrip(next);
  };

  // The field, not the first button — opening a search anywhere but in its
  // box is opening it wrong. `useModal` takes Escape and the tab ring; where
  // focus starts stays this component's decision.
  const modal = useModal<HTMLDivElement>({ onClose, initial: box });

  /*
   * The caret stays in the box across the page it is drawn on.
   *
   * The search page's box and the results page's box are two elements, so
   * pressing Enter unmounts the one being typed in and mounts another — and
   * focus goes to the document, where the arrow keys that move through the
   * results do nothing. Refocusing in `search` cannot work: it runs before
   * the element it wants exists.
   */
  useEffect(() => {
    box.current?.focus();
  }, [sent]);

  const found = useMemo(
    () =>
      findEverything(
        catalog,
        now,
        text,
        state.notes,
        state.tasks,
        school.capabilities,
        state.updates,
        state.reviews,
        state.appointments,
        { documents: state.documents, sheets: state.sheets, decks: state.decks },
        state.role,
      ),
    // `state.updates` is searched and was not listed here, so the results
    // could not see material added after the palette opened. `catalog` does
    // not cover it either — that memo depends on the term, the ordering and
    // the courses, not on what has been added to them — so nothing else was
    // making this recompute. Reachable while the palette is open through a
    // sync landing new material, which is rare and is not the same as
    // impossible.
    [
      catalog,
      now,
      text,
      state.notes,
      state.tasks,
      school.capabilities,
      state.updates,
      state.reviews,
      state.appointments,
      state.documents,
      state.sheets,
      state.decks,
      state.role,
    ],
  );

  /*
   * What was found, narrowed to one kind if a chip is on.
   *
   * The chips are built from the groups that came back rather than from a
   * fixed list, so a chip is never a promise of nothing: "Your notes" is
   * offered when notes matched and is absent when they did not. A chip that
   * stops matching as the query grows falls back to everything rather than
   * emptying the page under somebody's hands.
   */
  const chips = found.map((g) => g.label);
  const narrowed = chips.includes(only) ? found.filter((g) => g.label === only) : found;
  const hits = flatten(narrowed);
  const total = countHits(narrowed);
  /*
   * Whether what is on screen is a guess at the spelling.
   *
   * `findEverything` falls back to a near-miss pass when the strict one finds
   * nothing, so "calender" reaches the Calendar screen. Saying "5 results" for
   * that would be a small lie about a query the person may well know they
   * mistyped — and one that makes the one case where the guess is wrong
   * baffling rather than obvious.
   */
  const guessed = spelled(found);
  // Clamped rather than reset: the selection following the results down as
  // somebody types is what makes Enter safe to press without looking.
  const cursor = Math.min(at, Math.max(0, hits.length - 1));

  /**
   * Where the box's completions come from: the names of things that matched.
   *
   * Which is the property worth having — every completion offered is a query
   * whose results are on the screen already, so the box cannot suggest a
   * search that comes back empty.
   */
  const corpus = useMemo(() => flatten(found).map((h) => h.title), [found]);

  /** Somewhere to start, on a box that has never been typed into. */
  const ideas = useMemo(() => {
    const courses = catalog.courses.slice(0, 3).map((c) => c.name);
    const places = offered(school.capabilities, state.role)
      .slice(0, 3)
      .map((d) => d.label);
    return [...courses, ...places];
  }, [catalog, school.capabilities, state.role]);

  const rows = useMemo(
    () => suggestions(text, recents, corpus, ideas),
    [text, recents, corpus, ideas],
  );
  const showRows = dropped && rows.length > 0;

  /** Remember a search, in this session and in the next one. */
  const record = (query: string) => {
    const kept = remember(recents, query);
    setRecents(kept);
    writeSearches(kept);
  };

  const drop = (query: string) => {
    const kept = forget(recents, query);
    setRecents(kept);
    writeSearches(kept);
  };

  /** Enter, or a suggestion: this is now the search, and the results are up. */
  const search = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setText(q);
    setSent(q);
    setOnly('All');
    setAt(0);
    setPick(-1);
    setDropped(false);
    record(q);
    box.current?.focus();
  };

  /** Go to a screen in the tab that is on, which is the app's own screen. */
  const land = (screen: Screen, title: string, beside = false) => {
    keep(beside ? openBeside(strip, screen, title) : visit(strip, screen, title));
    dispatch({ type: 'go', screen });
    onClose();
  };

  const go = (i: number, beside = false) => {
    const hit = hits[i];
    if (!hit) return;
    if (sent.trim()) record(sent.trim());
    keep(
      beside
        ? openBeside(strip, landingOf(hit), hit.title)
        : visit(strip, landingOf(hit), hit.title),
    );
    openHit(hit, dispatch);
    onClose();
  };

  /** Pick a tab: its page is the app, so going to it is going there. */
  const goTab = (which: number) => {
    const next = select(strip, which);
    keep(next);
    const tab = current(next);
    if (tab.screen) {
      dispatch({ type: 'go', screen: tab.screen });
      onClose();
      return;
    }
    setText('');
    setSent('');
    setAt(0);
    setDropped(true);
    box.current?.focus();
  };

  const newTab = () => {
    keep(add(strip));
    setText('');
    setSent('');
    setAt(0);
    setPick(-1);
    setDropped(true);
    box.current?.focus();
  };

  /**
   * Close a tab, and land where a browser lands: on its right-hand neighbour.
   *
   * Which means closing the tab you are *on* reveals the next one — and since
   * a tab's page is the app, revealing a tab that holds a screen is going to
   * it. A new tab reveals the search page, and the overlay stays.
   */
  const closeTab = (which: number) => {
    const next = shutTab(strip, which);
    keep(next);
    if (which !== strip.at) return;
    const tab = current(next);
    if (tab.screen) {
      dispatch({ type: 'go', screen: tab.screen });
      onClose();
      return;
    }
    setText('');
    setSent('');
    setAt(0);
    box.current?.focus();
  };

  /** The shortcuts on the search page: where you have been, most recent first. */
  const shortcuts = useMemo(() => {
    const all = offered(school.capabilities, state.role);
    const seen = new Set<Screen>();
    const out: { screen: Screen; label: string }[] = [];
    for (const screen of state.recent) {
      const d = all.find((x) => x.screen === screen);
      if (!d || seen.has(screen)) continue;
      seen.add(screen);
      out.push({ screen, label: d.short ?? d.label });
    }
    for (const d of all) {
      if (seen.has(d.screen)) continue;
      seen.add(d.screen);
      out.push({ screen: d.screen, label: d.short ?? d.label });
    }
    return out;
  }, [school.capabilities, state.role, state.recent]);

  const onSearchPage = sent.trim() === '';
  /** The tab the strip is on, which is what the app behind this is showing. */
  const here = current(strip);

  return (
    <div
      role="dialog"
      aria-label="Search everything"
      aria-modal="true"
      style={{
        /*
         * Where "everything" ends, which is not the same box on both layouts.
         *
         * This is mounted inside `.device` because that is where the app's
         * controls are drawn — `.input`, `.tag` and `.bare` are every one of
         * them scoped to it, and mounted beside the pane this overlay reached
         * none: its field was a white browser textbox with a blue focus ring
         * and its course tags were pale rectangles, on the one overlay that is
         * nothing but a field and a list of tagged rows.
         *
         * Which leaves what it covers, and `absolute` answers it correctly on
         * exactly one of the two layouts. On a phone `.device` is the app, so
         * `absolute` fills it — and on a browser window between 402 and 760px
         * the app is a *column* with ground either side, where a search
         * spilling across the ground would be the only thing in the app that
         * does. On a desk `.device-pane` is a 560px strip in a 1280px window,
         * and shrinking to it would leave the rail live behind a dialog that
         * says `aria-modal`, which is a promise this would then be breaking.
         *
         * So: the column below 760px, the window above it. The content draws
         * itself in a column either way, which is why covering the whole
         * window reads as a search and not as a stretched screen.
         *
         * `fixed` is safe here because nothing above this transforms — a
         * transformed ancestor would become the containing block and this
         * would silently go back to covering the pane.
         */
        position: wide ? 'fixed' : 'absolute',
        inset: 0,
        zIndex: 80,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
      ref={modal.ref}
      tabIndex={-1}
      onKeyDown={(e) => {
        /*
         * The suggestion list gets the keys while it is up, and Escape with
         * it. Two Escapes to leave — one to put the list away, one to close —
         * is what every box of this shape does, and the alternative is a
         * search that vanishes when somebody meant to dismiss an offer.
         */
        if (showRows) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            /*
             * A ring of `rows.length + 1` positions, because "back in the box"
             * is one of them: arrowing up off the top row returns what you
             * typed rather than jumping to the bottom of the list, which is
             * what every box of this shape does and is the only way to get a
             * half-typed query back after looking at the offers.
             */
            const ring = rows.length + 1;
            const step = e.key === 'ArrowDown' ? 1 : ring - 1;
            setPick((was) => ((was + 1 + step) % ring) - 1);
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setDropped(false);
            setPick(-1);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            search(pick >= 0 ? rows[pick].text : text);
            return;
          }
        }
        // Escape and Tab first, then this page's own keys. `defaultPrevented`
        // rather than a second copy of the Escape branch, so there is one
        // answer to "what closes a dialog" and it is not written out here.
        modal.onKeyDown(e);
        if (e.defaultPrevented) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (hits.length === 0) return;
          // Wrapping, because a list you can fall off the bottom of makes
          // somebody look at the screen to find out where they are.
          const next = (cursor + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
          setAt(next);
          list.current?.querySelector(`[data-at="${next}"]`)?.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          /*
           * Enter means two different things, and which one depends on what
           * is in front of you rather than on what was typed.
           *
           * On the search page it searches. It used to open the top hit —
           * the palette this replaced showed its list live, so the top hit
           * was on the screen — and with the results one page further on
           * that became a key that navigated somewhere you had not been
           * shown. Typing four letters and landing on a screen is not a
           * search; it is a guess made on your behalf.
           *
           * On the results page it opens what is selected, and holding the
           * key a browser uses opens it in a tab of its own.
           */
          if (onSearchPage || hits.length === 0) search(text);
          else go(cursor, e.metaKey || e.ctrlKey);
        }
      }}
    >
      <Tabs
        strip={strip}
        searching={sent}
        onPick={goTab}
        onClose={closeTab}
        onNew={newTab}
        onDismiss={onClose}
      />

      {/* The box. On the search page it is drawn again, in the middle — this
          one is the results page's, the way a search engine keeps the query
          in a bar at the top once it has answered. */}
      {!onSearchPage && (
        <div style={{ width: '100%', maxWidth: COLUMN, margin: '0 auto', padding: 'var(--sp-5) var(--sp-7) 0' }}>
          <Box
            box={box}
            text={text}
            onText={(v) => {
              setText(v);
              setAt(0);
              setPick(-1);
              setDropped(true);
              if (v.trim() === '') setSent('');
            }}
            onOpen={() => setDropped(true)}
            onAsk={() => {
              ai.show(text);
              onClose();
            }}
            rows={showRows ? rows : []}
            pick={pick}
            onHover={setPick}
            onPickRow={(row) => search(row)}
            onForget={drop}
          />
        </div>
      )}

      <div
        ref={list}
        onMouseDown={() => {
          if (dropped) setDropped(false);
        }}
        style={{
          flex: 1,
          overflowY: 'auto',
          width: '100%',
        }}
      >
        {onSearchPage ? (
          <div
            style={{
              width: '100%',
              maxWidth: BOX,
              margin: '0 auto',
              padding: 'var(--sp-7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--sp-6)',
            }}
          >
            {/* The wordmark, which is the one piece of this that is decoration
                — and it earns its place: a new tab that opens on a blank grey
                field reads as a screen that has failed to load. */}
            <div
              style={{
                marginTop: 'var(--sp-7)',
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(44px * var(--text-scale, 1))',
                letterSpacing: '-0.03em',
                lineHeight: 'var(--leading-tight)',
              }}
            >
              Semester
            </div>
            <div style={{ width: '100%', position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
              <Box
                box={box}
                text={text}
                hero
                onText={(v) => {
                  setText(v);
                  setAt(0);
                  setPick(-1);
                  setDropped(true);
                }}
                onOpen={() => setDropped(true)}
                onAsk={() => {
                  ai.show(text);
                  onClose();
                }}
                rows={showRows ? rows : []}
                pick={pick}
                onHover={setPick}
                onPickRow={(row) => search(row)}
                onForget={drop}
              />
            </div>
            {/*
              What this tab is showing, when it is showing something.

              The strip can say "Calendar" while the page under the box is the
              search page, because the tab's *page* is the app behind this
              overlay — and a strip naming a screen you cannot see is the one
              place this metaphor can read as a bug. So the tab says so, and
              the way back to it is the same button as everywhere else:
              closing the search leaves you on the page you were on.
            */}
            {here.screen ? (
              <button
                type="button"
                className="bare tappable"
                onClick={onClose}
                style={{
                  width: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  padding: 'var(--sp-3) var(--sp-5)',
                  borderRadius: 999,
                  border: '1px solid var(--app-line)',
                  fontSize: 'var(--type-sm)',
                  ...secondLine(),
                }}
              >
                <TabGlyph screen={here.screen} size={15} />
                This tab is on {here.title} — go back to it
              </button>
            ) : (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  color: 'var(--app-faint)',
                  textAlign: 'center',
                  textWrap: 'pretty',
                }}
              >
                Deadlines, courses, study units, your own notes and tasks — and the app’s own
                screens.
              </div>
            )}

            {/* The shortcuts, which are where you have been rather than where
                somebody decided you should go. Same argument as the launcher's
                shelves: a grid earns its keep by holding still, so this is
                ordered by your own history and not reshuffled by a search. */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 'var(--sp-6)',
                marginTop: 'var(--sp-4)',
              }}
            >
              {shortcuts.slice(0, more ? shortcuts.length : SHORTCUTS).map((s) => (
                <button
                  key={s.screen}
                  type="button"
                  className="bare tappable"
                  onClick={() => land(s.screen, screenName(s.screen))}
                  style={{
                    width: 78,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    padding: 'var(--sp-3) var(--sp-1)',
                    borderRadius: 'var(--r-lg)',
                  }}
                >
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 999,
                      background: 'var(--app-hero)',
                      border: '1px solid var(--app-line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TabGlyph screen={s.screen} size={20} />
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--type-xs)',
                      textAlign: 'center',
                      lineHeight: 'var(--leading-tight)',
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label}
                  </span>
                </button>
              ))}
              {shortcuts.length > SHORTCUTS && (
                <button
                  type="button"
                  className="bare tappable"
                  onClick={() => setMore(!more)}
                  style={{
                    width: 78,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    padding: 'var(--sp-3) var(--sp-1)',
                    borderRadius: 'var(--r-lg)',
                  }}
                >
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 999,
                      background: 'var(--app-hero)',
                      border: '1px solid var(--app-line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--type-md)',
                    }}
                  >
                    {more ? '−' : '+'}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--type-xs)',
                      lineHeight: 'var(--leading-tight)',
                      ...secondLine(),
                    }}
                  >
                    {more ? 'Show less' : 'Show more'}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: COLUMN, margin: '0 auto', padding: '0 var(--sp-7) var(--sp-7)' }}>
            {/* The chips: everything, then one kind. A search engine's row of
                verticals, built from what came back rather than from a list
                that can promise a kind with nothing in it. */}
            {chips.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--sp-3)',
                  overflowX: 'auto',
                  padding: 'var(--sp-4) 0 var(--sp-2)',
                }}
              >
                {['All', ...chips].map((chip) => {
                  const on = chip === 'All' ? !chips.includes(only) : chip === only;
                  return (
                    <button
                      key={chip}
                      type="button"
                      className="bare tappable"
                      onClick={() => {
                        setOnly(chip);
                        setAt(0);
                      }}
                      aria-pressed={on}
                      style={{
                        width: 'auto',
                        flex: 'none',
                        padding: 'var(--sp-2) var(--sp-5)',
                        borderRadius: 999,
                        border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                        background: on ? 'var(--app-hero)' : 'transparent',
                        fontSize: 'var(--type-sm)',
                        whiteSpace: 'nowrap',
                        ...(on ? {} : secondLine()),
                      }}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              style={{
                fontSize: 'var(--type-xs)',
                padding: 'var(--sp-3) 0',
                ...secondLine(),
              }}
              aria-live="polite"
            >
              {guessed
                ? `Nothing spelled that way. ${total} ${total === 1 ? 'thing' : 'things'} close to it:`
                : `${total} ${total === 1 ? 'result' : 'results'}`}
            </div>

            {narrowed.map((group) => (
              <div key={group.label}>
                {narrowed.length > 1 && (
                  <div className="kicker" style={{ margin: 'var(--sp-7) 0 var(--sp-2)' }}>
                    {group.label}
                  </div>
                )}
                {group.hits.map((hit) => {
                  const i = hits.indexOf(hit);
                  const on = i === cursor;
                  return (
                    <div
                      key={hitKey(hit)}
                      data-at={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-2)',
                        borderRadius: 'var(--r-sm)',
                        background: on ? 'var(--app-hero)' : 'transparent',
                        boxShadow: on ? 'inset 2px 0 0 var(--app-accent)' : 'none',
                      }}
                    >
                      <button
                        type="button"
                        className="bare tappable"
                        // Not `onMouseEnter`: a list that re-selects under a
                        // stationary pointer as it re-renders moves the Enter
                        // target without anybody touching anything.
                        onFocus={() => setAt(i)}
                        onClick={() => go(i)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          padding: 'var(--sp-4) var(--sp-5)',
                          borderRadius: 'var(--r-sm)',
                        }}
                      >
                        {/* The line a search engine puts above a result: where
                            this is, before what it is. Reading it tells you
                            whether to bother with the title. */}
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--type-xs)',
                            lineHeight: 'var(--leading-normal)',
                            ...secondLine(),
                          }}
                        >
                          {group.label} · {hit.tag}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--type-lg)',
                            lineHeight: 'var(--leading-tight)',
                            color: 'var(--app-accent)',
                          }}
                        >
                          {hit.title}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--type-sm)',
                            lineHeight: 'var(--leading-normal)',
                            ...secondLine(),
                          }}
                        >
                          {hit.sub}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="bare tappable"
                        onClick={() => go(i, true)}
                        aria-label={`Open ${hit.title} in a new tab`}
                        title="Open in a new tab"
                        style={{
                          width: 'auto',
                          flex: 'none',
                          padding: 'var(--sp-4)',
                          borderRadius: 'var(--r-sm)',
                          fontSize: 'var(--type-sm)',
                          ...secondLine(),
                        }}
                      >
                        ⧉
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {total === 0 && (
              <div
                style={{
                  fontSize: 'var(--type-base)',
                  marginTop: 'var(--sp-7)',
                  lineHeight: 'var(--leading-relaxed)',
                  textWrap: 'pretty',
                  ...secondLine(),
                }}
              >
                Nothing matches &ldquo;{text.trim()}&rdquo;. Try a course code, a topic from a
                guide, a professor, or the name of a screen — or ask Claude, which can answer
                from what the app knows rather than only find it.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The strip: what is open, which one is on, and the way to open another.
 *
 * Scrolls sideways rather than shrinking past legibility, and every tab keeps
 * its glyph even when the title is elided — the glyph is what people actually
 * aim at once there are more than four.
 */
function Tabs({
  strip,
  searching,
  onPick,
  onClose,
  onNew,
  onDismiss,
}: {
  strip: Strip;
  /** What the tab you are on is searching for, if it is searching. */
  searching: string;
  onPick: (i: number) => void;
  onClose: (i: number) => void;
  onNew: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        padding: 'var(--sp-2) var(--sp-4)',
        borderBottom: '1px solid var(--app-line)',
        background: 'var(--app-void)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--sp-1)', overflowX: 'auto', flex: 1, minWidth: 0 }}>
        {strip.tabs.map((tab, i) => {
          const on = i === strip.at;
          /*
           * A tab in the middle of a search is named after the search, which
           * is what the tab in a browser does and is the only thing that
           * tells two new tabs apart. Not written into the strip: the query
           * is this session's, and a tab reopened tomorrow is a new tab
           * again rather than one carrying a question nobody asked twice.
           */
          const title = (on && searching.trim() ? searching : tab.title) || NEW_TAB;
          return (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: 'none',
                maxWidth: 190,
                borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
                background: on ? 'var(--app-panel)' : 'transparent',
                border: `1px solid ${on ? 'var(--app-line)' : 'transparent'}`,
                borderBottom: 'none',
              }}
            >
              <button
                type="button"
                className="bare tappable"
                onClick={() => onPick(i)}
                aria-current={on ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  minWidth: 0,
                  width: 'auto',
                  textAlign: 'left',
                  padding: 'var(--sp-3) var(--sp-2) var(--sp-3) var(--sp-4)',
                  fontSize: 'var(--type-sm)',
                  ...(on ? {} : secondLine()),
                }}
              >
                {tab.screen ? (
                  <TabGlyph screen={tab.screen} size={15} />
                ) : (
                  <SearchIcon size={15} />
                )}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </span>
              </button>
              <button
                type="button"
                className="bare tappable"
                onClick={() => onClose(i)}
                aria-label={`Close ${title}`}
                style={{
                  width: 'auto',
                  flex: 'none',
                  padding: 'var(--sp-3) var(--sp-4) var(--sp-3) var(--sp-1)',
                  fontSize: 'var(--type-sm)',
                  ...secondLine(),
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="bare tappable"
          onClick={onNew}
          aria-label="New tab"
          title="New tab"
          style={{
            width: 'auto',
            flex: 'none',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--r-sm)',
            ...secondLine(),
          }}
        >
          <Plus size={15} />
        </button>
      </div>
      <button
        type="button"
        className="bare"
        onClick={onDismiss}
        style={{
          width: 'auto',
          flex: 'none',
          padding: 'var(--sp-4) var(--sp-2)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.12em',
          ...secondLine(),
        }}
      >
        CLOSE
      </button>
    </div>
  );
}

/**
 * The box, and what it offers underneath.
 *
 * One component drawn in two places — big in the middle of the search page,
 * small at the top of a results page — because they are the same control and
 * the suggestion list has to behave identically in both. The list is absolute
 * so it covers what is under it rather than shoving the page down a row at a
 * time as somebody types, which is the thing that makes a suggestion list
 * feel like a trapdoor.
 */
function Box({
  box,
  text,
  hero = false,
  rows,
  pick,
  onText,
  onOpen,
  onAsk,
  onHover,
  onPickRow,
  onForget,
}: {
  box: RefObject<HTMLInputElement | null>;
  text: string;
  hero?: boolean;
  rows: { kind: string; text: string }[];
  pick: number;
  onText: (v: string) => void;
  onOpen: () => void;
  onAsk: () => void;
  onHover: (i: number) => void;
  onPickRow: (row: string) => void;
  onForget: (row: string) => void;
}) {
  const explore = rows.findIndex((r) => r.kind === 'explore');
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          padding: hero ? 'var(--sp-3) var(--sp-6)' : 'var(--sp-2) var(--sp-5)',
          borderRadius: 999,
          border: '1px solid var(--app-line)',
          background: 'var(--app-panel)',
        }}
      >
        <SearchIcon size={hero ? 18 : 16} />
        <input
          ref={box}
          className="input"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onClick={onOpen}
          placeholder="Search Semester"
          aria-label="Search everything"
          style={{
            flex: 1,
            minWidth: 0,
            height: hero ? 42 : 34,
            fontSize: 'var(--type-lg)',
            // The pill is the control; the field inside it is only a place to
            // type. A second border and a second ground here is two boxes.
            border: 'none',
            background: 'transparent',
            boxShadow: 'none',
            padding: 0,
          }}
        />
        {text !== '' && (
          <button
            type="button"
            className="bare tappable"
            onClick={() => {
              onText('');
              box.current?.focus();
            }}
            aria-label="Clear the search"
            style={{
              width: 'auto',
              flex: 'none',
              padding: 'var(--sp-2)',
              fontSize: 'var(--type-sm)',
              ...secondLine(),
            }}
          >
            ✕
          </button>
        )}
        {/* The app's own answer to a question the index cannot answer. The
            results say where a thing is; this says what it means, from the
            same material. */}
        <button
          type="button"
          className="bare tappable"
          onClick={onAsk}
          aria-label="Ask Claude this"
          title="Ask Claude"
          style={{
            width: 'auto',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            padding: 'var(--sp-2) var(--sp-4)',
            borderRadius: 999,
            border: '1px solid var(--app-line)',
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.08em',
            ...secondLine(),
          }}
        >
          <AskIcon size={14} />
          ASK
        </button>
      </div>

      {rows.length > 0 && (
        <div
          role="listbox"
          aria-label="Suggestions"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--sp-2)',
            zIndex: 2,
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--app-line)',
            background: 'var(--app-panel)',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
            padding: 'var(--sp-2) 0',
          }}
        >
          {rows.map((row, i) => (
            <div key={`${row.kind}-${row.text}`}>
              {i === explore && (
                <div
                  className="kicker"
                  style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-2)' }}
                >
                  Keep exploring
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: i === pick ? 'var(--app-hero)' : 'transparent',
                }}
              >
                <button
                  type="button"
                  className="bare tappable"
                  role="option"
                  aria-selected={i === pick}
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onPickRow(row.text)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-5)',
                    textAlign: 'left',
                    padding: 'var(--sp-4) var(--sp-6)',
                    fontSize: 'var(--type-md)',
                  }}
                >
                  {row.kind === 'recent' ? <ClocksIcon size={15} /> : <SearchIcon size={15} />}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.text}
                  </span>
                </button>
                {/* A search you made once should not follow you all term. */}
                {row.kind === 'recent' && (
                  <button
                    type="button"
                    className="bare tappable"
                    onClick={() => onForget(row.text)}
                    aria-label={`Forget the search ${row.text}`}
                    style={{
                      width: 'auto',
                      flex: 'none',
                      padding: 'var(--sp-4) var(--sp-6)',
                      fontSize: 'var(--type-sm)',
                      ...secondLine(),
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
