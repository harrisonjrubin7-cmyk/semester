/**
 * Follow a redirect chain one hop at a time, asking before every request.
 *
 * `fetch(url, { redirect: 'follow' })` checks nothing between hops. A function
 * that validated the address it was *asked* for, then let `fetch` follow, and
 * then validated `response.url`, has validated where the request *ended up*
 * after the request had already been made. A public host that answers 302 with
 * `Location: https://169.254.169.254/…` is sent the second request by the
 * runtime before any check sees it; only the response is withheld. That is a
 * blind request into whatever the function's own network can reach, and for
 * the function's caller the refusal arrives too late to matter.
 *
 * So the chain is walked here. The caller fetches with `redirect: 'manual'`,
 * which hands back the 3xx itself, and this module decides whether the next
 * address may be requested at all.
 *
 * Nothing here imports Deno or the network: the fetcher and the address rule
 * are passed in, so the same code runs under the app's tests and in the Edge
 * Function. That is the only reason it is a separate module.
 *
 * ## What it does not do
 *
 * It judges an address by its text. A public *name* that resolves to a private
 * address passes, as it does in `fetchcal`'s own `privateHost`, which says so.
 * Closing that needs a DNS answer before the request, and this runtime has not
 * been shown to give one.
 */

/** Hops followed before giving up. A calendar feed redirects once or twice. */
export const MAX_REDIRECTS = 5;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export type AddressRule = (raw: string) => { ok: true; url: URL } | { ok: false; why: string };

export type Followed =
  | { ok: true; response: Response; url: URL }
  | { ok: false; kind: 'refused' | 'too-many'; why: string };

/**
 * Request `start`, and every redirect target that `allowed` permits, in order.
 *
 * `doFetch` must not follow redirects itself (`redirect: 'manual'`). The
 * request for a hop is only made after `allowed` has passed that hop's
 * address, including the first. A redirect without a usable `Location` is
 * returned as it is, so the caller reports the status it got.
 */
export async function followSafely(
  start: URL,
  allowed: AddressRule,
  doFetch: (url: URL) => Promise<Response>,
): Promise<Followed> {
  let current = start;
  for (let hop = 0; ; hop++) {
    const first = allowed(current.toString());
    if (!first.ok) return { ok: false, kind: 'refused', why: first.why };

    const response = await doFetch(first.url);
    const location = response.headers.get('location');
    if (!REDIRECT_STATUS.has(response.status) || !location) {
      return { ok: true, response, url: first.url };
    }

    // The body of a redirect is never wanted; stop the transfer.
    await response.body?.cancel();

    if (hop >= MAX_REDIRECTS) return { ok: false, kind: 'too-many', why: 'That link redirects too many times.' };

    try {
      current = new URL(location, first.url);
    } catch {
      return { ok: false, kind: 'refused', why: 'That link redirects to an address this will not follow.' };
    }
  }
}
