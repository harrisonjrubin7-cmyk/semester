/**
 * Which origins the functions answer, and why one value was never enough.
 *
 * `ALLOWED_ORIGIN` is a function secret read by `claude`, `fetchcal` and
 * `canvas`. It held a single origin, spread into every response, and on 21
 * September 2026 it was found set to a **localhost** address on the live
 * project. Everything looked healthy from every angle that can be checked
 * server-side: the deployed code was byte-identical to this repository, all
 * three functions were ACTIVE, CI and the deploys were green. And all three
 * were unreachable from the deployed site, and had been for as long as the
 * secret had been set.
 *
 * ## Why it hid for so long
 *
 * A CORS refusal is invisible to the page. The browser rejects the response
 * before JavaScript sees it, so `fetch` rejects with a bare "Load failed" and
 * the app can only ever report *"could not reach"* — the same sentence it
 * would print for a dead host, a DNS failure or a flat tyre. There is nothing
 * a client can log that distinguishes them, and nothing the function can log
 * either, because from its side the request arrived and was answered.
 *
 * It also hid because the fallback masks it. Anyone with their own Anthropic
 * key goes straight to `api.anthropic.com` and never touches `claude` — so the
 * shared key, which is the route every pilot tester will be on and the one
 * this project's whole no-key-needed promise rests on, is precisely the route
 * nobody with a key ever exercises.
 *
 * ## Why an allowlist rather than a single value
 *
 * CORS permits exactly one origin in the header, and this project has two that
 * matter: the Pages site, and `localhost` while somebody is working on it.
 * `supabase/DEPLOY.md` said "worth setting to the Pages origin", which is good
 * advice that quietly breaks local development — so whoever is developing sets
 * it to localhost, which quietly breaks production. Either way round, one of
 * the two is broken and neither failure says anything.
 *
 * So the secret is now a **comma-separated list**, and the header echoes back
 * whichever entry the request actually came from. Both work, and it stays a
 * deliberate list rather than `*`.
 *
 * ## Deno-free on purpose
 *
 * Nothing here reads `Deno.env`; the caller passes the raw secret in. That is
 * what lets `app/src/lib/functioncors.test.ts` import this module directly and
 * check the decision table under vitest — there is no Deno test runner in this
 * repository, and a rule this quiet deserves a test more than most.
 */

/** The wildcard, spelled once. */
const ANY = '*';

/**
 * Tidy one entry.
 *
 * A trailing slash is the mistake this is most likely to meet: an origin never
 * has one, but `https://example.github.io/` is what a person copies out of the
 * address bar. Refusing it silently would reproduce the exact failure this
 * file exists to stop, so it is trimmed rather than honoured.
 */
const tidy = (s: string): string => s.trim().replace(/\/+$/, '');

/** The configured list, or `['*']` when nothing is set. */
export function allowedOrigins(raw: string | undefined | null): string[] {
  const list = (raw ?? '').split(',').map(tidy).filter(Boolean);
  return list.length ? list : [ANY];
}

/**
 * The value for `Access-Control-Allow-Origin`, given what is configured and
 * where the request came from.
 *
 * Three cases, and the third is the one worth being deliberate about:
 *
 *  - **No list, or `*` in it.** Answer `*`. Same as before this file existed.
 *  - **The request's origin is on the list.** Echo it back. Echoing rather
 *    than answering `*` is what keeps the list meaningful.
 *  - **The origin is not on the list, or there is no `Origin` header.** Answer
 *    the first configured origin. That is a refusal — the browser compares it
 *    to its own origin and rejects — and it is deliberately *not* `*`, which
 *    would turn a misconfigured allowlist into an open one. A request with no
 *    `Origin` at all is not a browser and is not the thing this protects.
 */
export function allowOrigin(raw: string | undefined | null, origin: string | null | undefined): string {
  const allowed = allowedOrigins(raw);
  if (allowed.includes(ANY)) return ANY;
  const asked = tidy(origin ?? '');
  return asked && allowed.includes(asked) ? asked : allowed[0];
}

/**
 * The whole CORS block, for a request.
 *
 * `Vary: Origin` is not decoration. The moment the header depends on the
 * request, a cache that ignores `Origin` can serve one origin's answer to
 * another and produce a failure that appears and disappears depending on who
 * asked first — which is a worse version of the bug this file is about.
 *
 * `Access-Control-Allow-Headers` lists every header the app actually sends. A
 * browser refuses the whole request when a preflight omits one, and
 * `anthropic-version` is on every call to `claude`, so leaving it out fails
 * before the function ever runs.
 */
export function corsHeaders(
  raw: string | undefined | null,
  origin: string | null | undefined,
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowOrigin(raw, origin),
    Vary: 'Origin',
    'Access-Control-Allow-Headers':
      'authorization, content-type, anthropic-version, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
