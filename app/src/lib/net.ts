/**
 * A fetch that gives up.
 *
 * `fetch` has no timeout. A request to a host that accepts the connection and
 * then says nothing stays open until the tab is closed — the promise never
 * settles, so the `catch` that would have shown an error never runs and the
 * spinner it was spinning for never stops. That is not a theoretical shape: it
 * is what a phone does when it has joined the campus wifi but not yet got past
 * the captive portal, which is most of the first minute in most buildings.
 *
 * Every call in this app that reaches a server the app does not control goes
 * through here, so the worst case is a sentence rather than a spinner.
 *
 * Two timeouts rather than one, because the two jobs are not the same size:
 *
 *   · `TALK_MS` for a question with a small answer — a token exchange, a page
 *     of calendar events, a list of messages. Fifteen seconds is already long
 *     for one of those; past it, something is wrong rather than slow.
 *   · `MOVE_MS` for a body that is actually large — a file going up to Drive
 *     or OneDrive, a term's calendar coming down. A minute, because a real
 *     upload on a bad connection is slow rather than broken.
 *
 * The caller's own signal still wins where there is one: closing the screen
 * aborts the request as it always did, and the timeout is simply a second
 * reason the same abort can happen. See `whicheverFirst` for why that is not
 * a bare `AbortSignal.any`.
 */

/** A request with a small answer: a token, a page of events, a list of mail. */
export const TALK_MS = 15_000;

/** A request carrying a real body: an upload, or a whole term's calendar. */
export const MOVE_MS = 60_000;

/**
 * `fetch`, with a deadline.
 *
 * Takes the same arguments as `fetch` and returns the same promise, except
 * that it rejects once `ms` has passed. A `signal` already on the init is kept
 * — whichever fires first aborts the request.
 */
export function fetchWithin(
  input: string | URL | Request,
  init: RequestInit = {},
  ms: number = TALK_MS,
): Promise<Response> {
  const deadline = AbortSignal.timeout(ms);
  return fetch(input, {
    ...init,
    signal: init.signal ? whicheverFirst(init.signal, deadline) : deadline,
  });
}

/**
 * The first of two signals to abort, without `AbortSignal.any` where there
 * isn't one.
 *
 * `AbortSignal.any` is the obvious way to write this and it is newer than
 * this app can assume: Safari shipped it in 17.4, in March 2024. That is not
 * an abstract concern here — the front page of the README tells people to
 * open this on a phone and add it to the home screen, and a phone on iOS 16
 * or on 17.0 through 17.3 would have got `AbortSignal.any is not a function`
 * where it used to get a map. Only the two place-search calls pass a signal
 * of their own, so it would have been the search on the Maps screen, throwing
 * before it asked.
 *
 * Nothing else here is that new: `AbortSignal.timeout` is Safari 16, and
 * `AbortController` older than anything this runs on.
 *
 * The reason is carried across deliberately. It is what tells a deadline from
 * somebody pressing Stop — `timedOut` below, and `troubleOf` in
 * `lib/trouble.ts` — and a controller aborted with no reason reports both as
 * the same thing.
 */
function whicheverFirst(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
  if (a.aborted) return a;
  if (b.aborted) return b;
  const relay = new AbortController();
  const pass = (from: AbortSignal) => () => relay.abort(from.reason);
  a.addEventListener('abort', pass(a), { once: true });
  b.addEventListener('abort', pass(b), { once: true });
  return relay.signal;
}

/**
 * Whether a thrown value is this app's own deadline rather than a refusal.
 *
 * `AbortSignal.timeout` rejects with a `TimeoutError` `DOMException`; a caller
 * aborting rejects with `AbortError`. The two deserve different sentences —
 * one is worth retrying, the other is what the person just asked for — and
 * neither is the "failed to fetch" that means the browser refused the call.
 *
 * Written against `name` rather than `instanceof DOMException` because the
 * `AbortSignal.any` above re-throws the reason it was given, and a test
 * environment's `DOMException` is not always the page's.
 */
export function timedOut(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'TimeoutError';
}

/**
 * The sentence for a request that ran out of time.
 *
 * `who` is the thing that did not answer, named the way the person would name
 * it — "Google", "The calendar" — so the message reads as a fact about the
 * world rather than about this code.
 */
export function tookTooLong(who: string): string {
  return `${who} did not answer in time. Check your connection and try again.`;
}
