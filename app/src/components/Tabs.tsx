/**
 * The tab strip, in the two places it is drawn — and the piece that keeps it
 * honest.
 *
 * A strip that only exists inside the search overlay is a list of places you
 * have been, which the app already had. What makes tabs worth having is the
 * thing a browser does: they are *on the window*, all the time, so going back
 * to the deadline you were reading is one click from wherever you are, with
 * nothing opened and nothing dismissed on the way.
 *
 * So this is mounted above the header on a window wide enough to hold it, and
 * again inside the overlay where a phone can reach it. One component, because
 * two strips would disagree about which tab is on the first time one of them
 * was changed — and one store behind it, `lib/browser.hook.ts`, for the same
 * reason.
 *
 * ## It appears when it is useful, and not before
 *
 * With one tab open there is nothing to switch to, and a row of chrome that
 * never does anything is a row of chrome people learn to ignore. So the bar
 * above the header draws itself from the second tab onwards. Inside the
 * overlay it is always there, because that is where tabs are opened.
 *
 * ## Picking a tab replays what opened it
 *
 * Not `go(screen)`: "Course" is not a place, and a tab that lands you on the
 * last course you happened to open is a tab that lies. Each tab carries the
 * actions that opened it — see `place` in `lib/browser.ts` — so ECON 1020
 * comes back as ECON 1020, and the guide unit comes back in the mode it was
 * being read in.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../state/store';
import { strip as stripNow } from '../lib/browser.hook';
import { closeTab, here, openTab, pickTab, record, useStrip } from '../lib/browser.hook';
import { NEW_TAB, placeFor, sameplace } from '../lib/browser';
import { screenName } from '../lib/nav';
import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import { secondLine } from '../lib/dim';
import { Plus, Search as SearchIcon } from './Icons';
import { TabGlyph } from './TabIcon';
import type { AppTab } from '../lib/browser';

/**
 * The strip follows the app, wherever the app is driven from.
 *
 * Mounted once, next to the search overlay, so a tab records the place you
 * navigated to whether you got there from the strip, the tab bar, a link in
 * an answer or the browser's own Back button. Without it the strip would only
 * be right about the places search sent you to, which is the minority of them.
 *
 * Nothing is recorded on the first render. A tab opened and left empty is a
 * new tab, and a new tab that adopted whatever was already on screen the
 * moment the app reloaded would be a tab nobody opened.
 */
/**
 * What the guide-family screens are called on a tab.
 *
 * `screenName` answers "this study guide" and "this quiz", which is right for
 * the sentence it was written for — "Ask about ___" — and wrong on a tab,
 * where the label is a name rather than a phrase. A tab says ECON 1020 · Quiz.
 */
const UNDER_A_COURSE: Partial<Record<string, string>> = {
  guide: 'Study guide',
  quiz: 'Quiz',
  drill: 'Drill',
  lesson: 'Lesson',
  slides: 'Slides',
  edit: 'Edit',
};

/**
 * What to call a tab that the app navigated to by itself.
 *
 * A tab reading "this course" is the strip admitting it does not know which
 * one, and the app does know: the screen is about an id, and the id names
 * something with a title. Search-opened tabs already carry the name of what
 * was opened; this is the other half, for everything reached by tapping.
 */
function nameFor(state: State, catalog: Catalog): string {
  const { screen } = state;
  const code = catalog.byId[state.courseId]?.code;
  const under = UNDER_A_COURSE[screen];
  if (under) {
    const guideCode = catalog.byId[state.guideId]?.code;
    // The editor is about the course you are editing; the other four are
    // about the guide you are reading, which is its own id.
    const prefix = screen === 'edit' ? code : guideCode;
    return prefix ? `${prefix} · ${under}` : under;
  }
  switch (screen) {
    case 'course':
      return code ?? screenName(screen);
    case 'item':
      return catalog.items.find((i) => i.id === state.itemId)?.title ?? 'Deadline';
    case 'note':
      return state.notes.find((n) => n.id === state.noteId)?.title || 'Note';
    case 'write':
      return state.documents.find((d) => d.id === state.documentId)?.title || 'Document';
    case 'sheet':
      return state.sheets.find((x) => x.id === state.sheetId)?.title || 'Sheet';
    case 'deck':
      return state.decks.find((d) => d.id === state.deckId)?.title || 'Deck';
    default:
      return screenName(screen);
  }
}

export function TabsFollow() {
  const { state, catalog } = useStore();
  // Destructured, so the memo below depends on the ten ids that make a place
  // rather than on the whole store: `state` changes on every keystroke
  // anywhere in the app, and this would then re-run on every keystroke too.
  const {
    screen,
    courseId,
    itemId,
    eventId,
    guideId,
    noteId,
    documentId,
    sheetId,
    deckId,
    mode,
  } = state;
  const at = useMemo(
    () =>
      placeFor(screen, {
        courseId,
        itemId,
        eventId,
        guideId,
        noteId,
        documentId,
        sheetId,
        deckId,
        mode,
      }),
    [screen, courseId, itemId, eventId, guideId, noteId, documentId, sheetId, deckId, mode],
  );
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const key = JSON.stringify(at);
    const firstLook = seen.current === null;
    if (seen.current === key) return;
    seen.current = key;
    const tab = here();
    /*
     * On the first look the strip adopts the app only if the tab it is on is
     * showing a page — and a lone new tab counts as one, because a strip of
     * one blank tab is not a tab somebody opened and left empty, it is the
     * app before anybody opened a second one. With several tabs open, a blank
     * one was deliberate and stays the search page.
     */
    if (firstLook && !tab.screen && stripNow().tabs.length > 1) return;
    /*
     * And the name the tab keeps: whoever opened it named it after the thing
     * — "ECON 1020", not "this course" — so re-recording the same place must
     * not rename it. Only a move gets a new name.
     */
    const named = sameplace(tab.place, at) && tab.title ? tab.title : nameFor(state, catalog);
    record(screen, named, at);
  }, [at, screen, state, catalog]);

  return null;
}

export function TabStrip({
  /** Drawn inside the search overlay, which has its own ground and a Close. */
  inOverlay = false,
  /** What the tab you are on is searching for, if it is searching. */
  searching = '',
  /** Called after a tab has been opened — the overlay closes itself. */
  onOpened,
  /** Called when the tab you land on is a new tab, which is the search page. */
  onBlank,
  /** The overlay's own dismiss, drawn at the end of the row. */
  onDismiss,
}: {
  inOverlay?: boolean;
  searching?: string;
  onOpened?: () => void;
  onBlank?: () => void;
  onDismiss?: () => void;
}) {
  const { dispatch } = useStore();
  const strip = useStrip();

  /** Put the app where a tab says, or hand a new tab to the search page. */
  const land = (tab: AppTab) => {
    if (tab.screen && tab.place.length > 0) {
      for (const action of tab.place) dispatch(action);
      onOpened?.();
      return;
    }
    onBlank?.();
  };

  if (!inOverlay && strip.tabs.length < 2) return null;

  return (
    <div
      // A row of places, not a set of ARIA tabs: there are no tab panels here,
      // and telling a screen reader otherwise would promise a relationship
      // between this and something on the page that does not exist. The tab
      // that is on says so with `aria-current`, which is what a list of links
      // to places uses.
      aria-label="Open tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
        padding: 'var(--sp-2) var(--sp-4)',
        borderBottom: '1px solid var(--app-line)',
        background: inOverlay ? 'var(--app-void)' : 'transparent',
        flex: 'none',
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
                onClick={() => land(pickTab(i))}
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
                {tab.screen ? <TabGlyph screen={tab.screen} size={15} /> : <SearchIcon size={15} />}
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
                onClick={() => {
                  const landed = closeTab(i);
                  // Closing the tab you are on reveals its neighbour, and a
                  // tab's page is the app — so revealing one is going to it.
                  if (i === strip.at) land(landed);
                }}
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
          onClick={() => {
            openTab();
            // A new tab's page is the search page, so opening one opens it.
            onBlank?.();
          }}
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
      {onDismiss && (
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
      )}
    </div>
  );
}
