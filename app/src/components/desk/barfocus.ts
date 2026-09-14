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
 * A no-op by default, so the same screen drawn outside the workspace — there
 * is no bar there to focus — does nothing rather than throwing.
 */

import { createContext, useContext } from 'react';

const FocusBar = createContext<() => void>(() => {});

export const FocusBarProvider = FocusBar.Provider;

/** Puts the cursor in the workspace bar's search field, where there is one. */
export function useFocusBar(): () => void {
  return useContext(FocusBar);
}
