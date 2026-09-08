/**
 * Which screen a `?screen=` link is allowed to open.
 *
 * The rule started as "roots only", and the reason was strandedness: a link
 * straight into a drill drops you three levels down with the tab bar hidden
 * and nothing above you, so the only way out is the browser's Back — which on
 * a cold load from a shortcut or a message has nowhere to go. Roots are the
 * screens that cannot do that.
 *
 * Settings was then let through, and the argument made for it was not "it is
 * important" but "it cannot strand anybody": a leaf with its own heading, the
 * app's navigation still on screen around it, and no state you can only reach
 * by having walked there. That argument is the rule. This module writes it
 * down once instead of accruing another `if` per screen.
 *
 * What actually keeps a cold deep link safe is two things, and both are worth
 * checking before adding to `LINKABLE_LEAVES`:
 *
 *   - The screen is not in `FULLSCREEN` (App.tsx), so the tab bar on a phone
 *     and the rail on a laptop are still drawn and every other screen is one
 *     tap away.
 *   - Back does not need to exist. `canGoBack` is the app's own history, which
 *     is empty on a cold load, so no Back chevron is rendered at all — rather
 *     than a chevron that calls `history.back()` into an empty stack and does
 *     nothing, which is the trap this guard is really avoiding.
 *
 * Ask Claude and Account both clear that bar, which is why they are here.
 * Import does not clear it on its own terms and keeps its own condition below.
 */

import type { Screen } from './types';
import { ROOTS } from '../state/shape';
import { isSettingsPage } from './settings';

/**
 * The leaves a link may open, beyond the roots and the settings pages.
 *
 * `settings` is the index; its children are covered by `isSettingsPage`.
 */
export const LINKABLE_LEAVES: Screen[] = ['settings', 'ask', 'account'];

/**
 * The screen a link asked for, or null to fall back to the default.
 *
 * `shared` is the share flag: a syllabus handed to the app by another app
 * lands on the importer, which is not otherwise addressable. `?screen=import`
 * typed by hand is still refused, because arriving at an empty importer you
 * did not ask for is worse than arriving at Today.
 */
export function linkedScreen(asked: string | null | undefined, shared: boolean): Screen | null {
  if (!asked) return null;
  const screen = asked as Screen;
  if (ROOTS.includes(screen)) return screen;
  if (screen === 'import') return shared ? screen : null;
  if (LINKABLE_LEAVES.includes(screen)) return screen;
  if (isSettingsPage(screen)) return screen;
  return null;
}
