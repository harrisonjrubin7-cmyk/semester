import { fromHash, toHash } from './route';
import type { Screen } from './types';

/**
 * Where to put somebody back after a sign-in that left the page.
 *
 * Google, Microsoft, Apple and an institution's SSO all sign in by leaving:
 * the tab goes to the provider and comes back to `appUrl()`, the bare
 * address. It has to be the bare address — `lib/cloud.ts` explains that a
 * redirect URL must match the project's allowlist exactly, and a near miss
 * silently falls back to the Site URL — so the place cannot ride along in the
 * URL. And the app booted at the bare address lands on its first screen. So a
 * student who was reading a guide, tapped Ask, was told to sign in and did,
 * came back to the new-tab page with the guide gone.
 *
 * The place is written down on the device just before leaving, and taken on
 * the way back. Three rules keep it from doing harm:
 *
 *   - **It is used once.** `takeReturn` removes it whether or not it is used,
 *     so it cannot move somebody a second time on some later sign-in.
 *   - **It goes stale.** Fifteen minutes is longer than any provider's screen
 *     takes, and short enough that a trip abandoned yesterday does not move
 *     today's sign-in anywhere.
 *   - **It is a place, not the sign-in screen.** Returning somebody to Account
 *     after they have signed in is returning them to the form they just
 *     finished. So Account, onboarding and the connect screen are not places;
 *     from one of them the return point is the screen before it.
 */

export const RETURN_KEY = 'semester.returnTo';

/** How long a written-down return point stays good. */
export const RETURN_MS = 15 * 60_000;

/** Screens that are where you sign in, not where you were. */
const NOT_A_PLACE: Screen[] = ['account', 'onboarding', 'connect'];

/**
 * The address to come back to, from where the student is and where they came
 * from. Null when there is nowhere better than the app's own first screen.
 */
export function returnPoint(hash: string, history: Screen[]): string | null {
  const here = fromHash(hash);
  if (here && !NOT_A_PLACE.includes(here.screen)) return toHash(here);
  for (let i = history.length - 1; i >= 0; i--) {
    const screen = history[i];
    if (!NOT_A_PLACE.includes(screen)) return toHash({ screen, id: '' });
  }
  return null;
}

/** Write it down, just before the page leaves. Nothing to write is a no-op. */
export function rememberReturn(point: string | null, now = Date.now()): void {
  if (!point) return;
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ hash: point, at: now }));
  } catch {
    // Without storage the student lands on the first screen, as before.
  }
}

/**
 * Take it, once. The address to go to, or null.
 *
 * Validated again on the way out, with the same parser the router uses: what
 * is stored is only ever an address this app wrote, but a stored value that
 * no longer parses — a screen retired since — is dropped rather than sent
 * somewhere undefined.
 */
export function takeReturn(now = Date.now()): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RETURN_KEY);
    localStorage.removeItem(RETURN_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { hash?: unknown; at?: unknown };
    if (typeof saved.hash !== 'string' || typeof saved.at !== 'number') return null;
    if (now - saved.at > RETURN_MS || now < saved.at) return null;
    const route = fromHash(saved.hash);
    if (!route || NOT_A_PLACE.includes(route.screen)) return null;
    return toHash(route);
  } catch {
    return null;
  }
}
