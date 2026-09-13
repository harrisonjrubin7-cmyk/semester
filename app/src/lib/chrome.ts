/**
 * Which navigation the app draws, decided in one place.
 *
 * ## The bug this exists to make impossible
 *
 * The rule used to be four conditions written at four different points of
 * `App.tsx`, each testing one thing and none of them testing the others: the
 * tab bar asked `nav === 'tabs'`, the rail asked only whether the screen was
 * wide, the springboard was a branch inside the home screen, and the two rows
 * of pills were drawn by the *layout* — `shell === 'soft'` — which no
 * navigation knew to look at.
 *
 * Four independent yeses, so several could be yes at once, and two of them
 * routinely were. Choosing the soft layout put its pills above the content
 * and left the tab bar sitting under it, or the rail beside it: one app
 * wearing two navigations, each unaware of the other, each with its own idea
 * of where you were. It read as two systems running in one window, because
 * that is exactly what it was.
 *
 * A rule spread across four files cannot be checked. This is the rule, whole,
 * as a function of the three things it actually depends on — and
 * `chrome.test.ts` runs every combination of them and asserts that no two
 * navigations are ever drawn together.
 *
 * ## What counts as a navigation
 *
 * Chrome: something persistent, drawn beside every screen, whose job is to
 * take you to another one. The bar, the rail and the shelves are the three,
 * and no two of them may be on screen together.
 *
 * The springboard and the feed are deliberately *not* in that list, and the
 * distinction is the point rather than a loophole. They are what the home
 * screen is, not something drawn beside it — you leave the springboard by
 * tapping through it, the way you leave any screen. `homeShape` below is
 * where that choice is made, and a home screen and one piece of chrome are
 * one navigation, not two.
 *
 * Also not counted: the header (it belongs to the screen you are on), search
 * and the command palette (they open on top and close again), and the
 * assistant.
 */

import type { NavMode, Screen } from './types';

/**
 * The screens that keep the whole display.
 *
 * A drill is one card at a time and a tab bar under it invites a mis-tap; a
 * lesson and a deck are playback. Everything else keeps its navigation.
 *
 * Lives here rather than in `App.tsx` because it is half of the rule below,
 * and half a rule kept somewhere else is how the other half drifts.
 */
export const FULLSCREEN: Screen[] = ['drill', 'quiz', 'guess', 'lesson', 'slides', 'onboarding'];

export interface Chrome {
  /** The bar across the bottom. Phones and portrait tablets. */
  tabs: boolean;
  /** The same tabs unrolled down the side, where there is room for them. */
  rail: boolean;
  /** Two rows of pills: the shelf you are on, and the screens on it. */
  shelves: boolean;
  /**
   * The workspace: a tab strip, one search bar under it, and the launcher.
   *
   * One navigation, drawn at every width, in the way `tabs` and `rail` are
   * one navigation drawn two ways. What changes with the width is the
   * sidebar — see `sidebar` below — not what this is.
   */
  desk: boolean;
  /**
   * The workspace's column of shortcuts, where there is room for it.
   *
   * Not counted as a navigation of its own for exactly that reason: it is the
   * wide expression of `desk`, and counting both would make the invariant
   * below fail on every laptop.
   */
  sidebar: boolean;
  /**
   * The floating "import a syllabus" button.
   *
   * Not a navigation — one action, on one screen — but it is drawn by the
   * same decision and belongs beside it rather than in a fourth condition
   * somewhere else.
   */
  fab: boolean;
}

/**
 * The one decision. Everything that draws chrome reads its answer from here.
 *
 * @param nav   Which navigation the student chose. The only input that picks.
 * @param screen Where they are, for the screens that keep the whole display.
 * @param wide  Whether there is room for the rail — a laptop or a tablet held
 *              upright. The same navigation expresses itself differently at
 *              the two widths; it does not become a different navigation.
 */
export function chromeFor(nav: NavMode, screen: Screen, wide: boolean): Chrome {
  // A drill, a lesson, a deck: one object filling the display, and a bar under
  // it is a mis-tap waiting to happen. The rail goes too — the same argument
  // holds at any width, and it used to stay, so a lesson on a laptop was the
  // one screen that never got the display it asked for.
  const full = FULLSCREEN.includes(screen);
  if (full) return { tabs: false, rail: false, shelves: false, desk: false, sidebar: false, fab: false };

  /*
   * The workspace answers first, and answers for every width.
   *
   * It is the only navigation whose chrome is at the *top* of the window, so
   * it has nothing to trade against the tab bar or the rail — a phone gets
   * the tab strip and the search bar, a laptop gets those and the sidebar,
   * and neither gets a second navigation underneath.
   */
  const desk = nav === 'workspace';

  return {
    tabs: nav === 'tabs' && !wide,
    // The rail is how the bar, the feed and the springboard all express
    // themselves where there is room: a laptop can keep the navigation
    // visible, and hiding it behind a phone's rules would make the wide
    // layout worse than the narrow one. The shelves are excluded because they
    // are already a navigation that shows both the shelf and its screens —
    // drawing the rail beside them is the doubling this file exists to stop.
    rail: wide && nav !== 'shelves' && !desk,
    shelves: nav === 'shelves',
    desk,
    sidebar: desk && wide,
    fab: nav === 'feed' && screen === 'home' && !wide,
  };
}

/**
 * What the home screen is, per navigation.
 *
 * The springboard's grid of icons and the feed's single scroll are home
 * screens rather than chrome, so they are chosen here and not above. Written
 * as a lookup because it was a ternary in `App.tsx` and another in
 * `Today.tsx`, two files apart, each having to be found and extended when a
 * navigation was added — and both falling through to the same default, so a
 * new mode looked finished while quietly rendering somebody else's screen.
 */
export function homeShape(nav: NavMode): 'springboard' | 'feed' | 'today' {
  if (nav === 'springboard') return 'springboard';
  if (nav === 'feed') return 'feed';
  return 'today';
}

/**
 * The screen the app opens on, when nothing in the address says otherwise.
 *
 * A different question from `homeShape`, and keeping them apart is the whole
 * of this function. `home` is Today in the workspace exactly as it is under
 * the tab bar — the Today row in the sidebar has to open Today, and it goes
 * to `home` like every other route to it in the app. What the workspace
 * changes is where you *land*: on the search home, the way a browser opens on
 * a new tab rather than on the last page you read.
 *
 * Written as a rule here rather than as a condition in `state/store.tsx`, for
 * the reason the file is about: a navigation's shape decided in one place.
 */
export function firstScreen(nav: NavMode): Screen {
  return nav === 'workspace' ? 'search' : 'home';
}

/**
 * How many navigations are on screen. One, or none — never two.
 *
 * The number this returns is the whole invariant, which is why it is a
 * function rather than a comment. `fab` is not counted: it opens the importer
 * and goes nowhere else.
 */
export function navigationsDrawn(c: Chrome): number {
  return [c.tabs, c.rail, c.shelves, c.desk].filter(Boolean).length;
}
