/**
 * Whether there is a connection — believed in one direction only.
 *
 * `navigator.onLine` says the device has a network interface, not that
 * anything is reachable. `ai/converse.ts` already reasons this way and says
 * why: it uses the flag only to skip a request that is certain to fail, never
 * to decide that a working connection is broken. A false negative costs a
 * round trip; the false positive it avoids is a student on a train watching a
 * spinner turn into "failed to fetch".
 *
 * This module is that judgement, written once, for the two places that now
 * need it — the screen boundary, deciding whether a missing file means the app
 * moved on or that nothing could be fetched, and the map, deciding whether an
 * empty grid is worth explaining.
 */

/**
 * True only when the browser positively says there is no connection.
 *
 * Everything else — no `navigator`, a flag that is missing, a browser that
 * claims to be online — comes back false, so a caller that acts on this only
 * ever acts on the certain case.
 */
export function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Run `then` whenever the connection comes or goes, and stop when told.
 *
 * Returns the unsubscribe, so a caller in a `useEffect` can return it
 * directly. Both events matter: something that explained itself while offline
 * has to stop saying so the moment it can try again.
 */
export function watchConnection(then: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const on = () => then(true);
  const off = () => then(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
}
