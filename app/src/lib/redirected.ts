/**
 * Is this load the far end of a sign-in redirect?
 *
 * A leaf, deliberately, and it holds nothing but the question and the key the
 * answer is written under.
 *
 * `completeAuth()` in `lib/connect.ts` already asks this and returns `null`
 * when the answer is no — which is every load but the one immediately after
 * somebody signs in to Microsoft, Google, Zoom or Apple. The trouble was
 * where the question was being asked from: inside the module. So the whole of
 * `connect.ts` — the four provider specs, the PKCE work, the token exchange,
 * 1,616 lines with its imports — was fetched and evaluated on every cold
 * start, before anything rendered, in order to read two query parameters and
 * decide there was nothing to do.
 *
 * Asking out here lets `main.tsx` reach for `connect.ts` through `import()`
 * only on the load that is actually redeeming a code. See
 * `ENGINEERING-AUDIT.md` §1.
 *
 * The two conditions must stay exactly the ones `completeAuth` tests. A guard
 * that is stricter would drop a real sign-in on the floor; one that is looser
 * would load the module for nothing, which is the thing this exists to stop.
 * `connect.ts` imports `PENDING_KEY` from here rather than declaring its own,
 * so the two cannot drift apart.
 */

/** Where the in-flight request's provider, verifier and state are kept. */
export const PENDING_KEY = 'semester.oauth.pending';

/**
 * True only when a redirect is waiting to be redeemed.
 *
 * Both halves matter. A `code` with no pending request is somebody else's
 * query string — a share link, a deep link, a stray parameter — and there is
 * nothing to exchange it for. A pending request with no `code` and no `error`
 * is a sign-in that was started and never came back, which a later redirect
 * will resolve.
 *
 * Storage can throw rather than answer, and it can throw on the property
 * itself rather than on the read: Safari in a locked-down configuration
 * refuses `sessionStorage` outright. Both are inside the `try`, and both mean
 * the same thing — this is not a redirect — so the app opens normally instead
 * of failing before its first render.
 */
export function redirected(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    if (!params.get('code') && !params.get('error')) return false;
    return sessionStorage.getItem(PENDING_KEY) !== null;
  } catch {
    return false;
  }
}
