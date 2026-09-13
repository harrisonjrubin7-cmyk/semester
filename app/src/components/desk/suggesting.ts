/**
 * One boolean, shared: whether the top bar's suggestions are down.
 *
 * The bar and the search home are siblings — the shell renders one, the
 * router renders the other — so there is no prop between them, and the centre
 * of the search home has to disappear the moment the bar drops its list over
 * it. A second copy of the answer kept on the screen would be stale in
 * exactly the case that matters: the frame the list opens in.
 *
 * A context rather than a field on the store because it is neither persisted
 * nor meaningful to anything outside the workspace shell, and putting it in
 * the reducer would mean every keystroke in the bar dispatched an action that
 * re-rendered fifty screens' worth of subscribers.
 *
 * `false` by default, so a screen rendered outside the workspace — the same
 * screens are drawn in four other navigations — behaves as though nothing is
 * over it, which is true.
 */

import { createContext, useContext } from 'react';

const Suggesting = createContext(false);

export const SuggestingProvider = Suggesting.Provider;

export function useSuggesting(): boolean {
  return useContext(Suggesting);
}
