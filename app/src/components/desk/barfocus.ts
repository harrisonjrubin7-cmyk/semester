/**
 * One callback, shared: put the cursor in the top bar's search field.
 *
 * The sibling of `suggesting.ts`, pointing the other way. That one carries a
 * fact down from the bar to the search home ("my list is over your centre");
 * this carries a request up from the search home to the bar ("take the
 * cursor"). Same gap between them — the shell renders one, the router renders
 * the other, and there is no prop between siblings — and the same answer, for
 * the same reasons that file gives: a context rather than a field on the
 * store, because it is neither persisted nor meaningful outside the workspace
 * shell, and a keystroke's worth of state in the reducer would re-render fifty
 * screens' worth of subscribers.
 *
 * ## What it is for
 *
 * The search home used to draw its own search box, which opened the command
 * palette. So the workspace's front door had two search fields one above the
 * other — the bar's, answering with apps as you type, and the centre's,
 * opening a palette that answers with records — in two vocabularies, with two
 * ⌘K hints between them, and nothing saying which was which.
 *
 * The browser idiom this screen is borrowed from settles it, and this is how:
 * a new-tab page's big centre box does not run a second search, it *focuses
 * the omnibox*. One field, two places to reach it. The centre box is now a
 * way of putting the cursor in the bar, which is why what it needs from the
 * shell is a focus call and not a search.
 *
 * ## `null` when there is no bar, which is also how you ask whether there is one
 *
 * Only `Workspace` mounts the provider, and `App` only renders `Workspace`
 * when `chromeFor` says `desk` — so "is this context set" and "is there a bar
 * on screen" are the same question, and a caller can read the answer off the
 * value instead of working it out again. That matters for `Keys`: `/` focuses
 * the bar where there is one and opens the palette where there is not, and a
 * second copy of that rule — `state.nav === 'workspace'`, say — would be a
 * second opinion to keep in step. `lib/chrome.ts` exists to stop exactly that,
 * and `FULLSCREEN` is why the shortcut would have been wrong: a drill draws no
 * chrome at all, so a navigation check would have said "workspace, focus the
 * bar" on a screen with no bar in it.
 *
 * A default of `null` rather than a no-op function for the same reason. A
 * no-op is indistinguishable from a bar that declined to take focus, and the
 * one caller that needs to tell them apart is the one that has somewhere else
 * to go.
 */

import { createContext, useContext } from 'react';

const FocusBar = createContext<(() => void) | null>(null);

export const FocusBarProvider = FocusBar.Provider;

/**
 * Puts the cursor in the workspace bar's search field.
 *
 * `null` where no bar is drawn — outside the workspace, and on the screens
 * `FULLSCREEN` gives the whole display to.
 */
export function useFocusBar(): (() => void) | null {
  return useContext(FocusBar);
}
