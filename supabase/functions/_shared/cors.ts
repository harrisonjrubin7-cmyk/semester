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
 * So the secret is a **comma-separated list**, and the header echoes back
 * whichever entry the request actually came from.
 *
 * ## Fail closed
 *
 * Until 29 September 2026 an unset secret, or a `*` in it, answered `*`: any
 * page on the web could call these functions from a browser. And an origin
 * *not* on the list was answered with the first listed origin — a refusal only
 * because the browser happened to do the refusing. Both are gone:
 *
 *  - **The production origin is built in** (`PRODUCTION_ORIGINS`). An unset or
 *    mistyped secret can no longer take the deployed site out — the 21
 *    September failure cannot recur that way — and it can no longer open the
 *    functions to everyone either. The secret only *adds* origins.
 *  - **`*` is ignored, and so is anything that is not an exact `https://`
 *    origin.** A wildcard is not an allowlist.
 *  - **Loopback is allowed only when `CORS_ALLOW_DEV` says so** (`1`, `true` or
 *    `yes`), for a local `supabase functions serve`. A `http://localhost` entry
 *    in the secret on the live project does nothing without it.
 *  - **An origin that is not allowed gets no `Access-Control-Allow-Origin` at
 *    all** — not `*`, and not somebody else's origin. The browser refuses; a
 *    server-to-server caller (the cron, with its bearer secret) never needed
 *    the header.
 *
 * ## Deno-free on purpose
 *
 * Nothing here reads `Deno.env`; the caller passes the raw secret in. That is
 * what lets `app/src/lib/functioncors.test.ts` import this module directly and
 * check the decision table under vitest — there is no Deno test runner in this
 * repository, and a rule this quiet deserves a test more than most.
 */

/**
 * The origins always allowed: where the app is actually deployed.
 *
 * GitHub Pages serves it at `https://harrisonjrubin7-cmyk.github.io/semester/`
 * (`.github/workflows/pages.yml`; `SEMESTER_APP_URL` in `supabase/DEPLOY.md`),
 * and an origin carries no path. Another deployment adds its own origin
 * through `ALLOWED_ORIGIN` rather than by editing this list.
 */
export const PRODUCTION_ORIGINS: readonly string[] = ['https://harrisonjrubin7-cmyk.github.io'];

/**
 * Tidy one entry.
 *
 * A trailing slash is the mistake this is most likely to meet: an origin never
 * has one, but `https://example.github.io/` is what a person copies out of the
 * address bar. Refusing it silently would reproduce the exact failure this
 * file exists to stop, so it is trimmed rather than honoured. Hosts are
 * case-insensitive, so the comparison is too.
 */
const tidy = (s: string): string => s.trim().replace(/\/+$/, '').toLowerCase();

/** An exact https origin: scheme, host, optional port, and nothing else. */
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;

/** A dev server on this machine. Honoured only when `CORS_ALLOW_DEV` is on. */
const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

/** Whether the `CORS_ALLOW_DEV` value the caller read means yes. */
export function devAllowed(flag: string | undefined | null): boolean {
  return /^(1|true|yes)$/i.test((flag ?? '').trim());
}

/**
 * Every origin that will be echoed: the built-in production origins, plus each
 * configured entry that is an exact https origin. `*`, paths and plain http
 * are dropped — they are how an allowlist quietly becomes an open door.
 */
export function allowedOrigins(raw: string | undefined | null): string[] {
  const configured = (raw ?? '').split(',').map(tidy).filter((o) => HTTPS_ORIGIN.test(o));
  return [...new Set([...PRODUCTION_ORIGINS, ...configured])];
}

/**
 * The value for `Access-Control-Allow-Origin`, or `null` for none.
 *
 *  - **The request's origin is on the list.** Echo it back.
 *  - **It is a loopback dev server and `dev` is on.** Echo it back.
 *  - **Anything else** — not listed, no `Origin` header, the literal `null`
 *    origin a sandboxed frame sends — gets `null`, and the header is left off.
 */
export function allowOrigin(
  raw: string | undefined | null,
  origin: string | null | undefined,
  dev?: string | null,
): string | null {
  const asked = tidy(origin ?? '');
  if (!asked) return null;
  if (allowedOrigins(raw).includes(asked)) return asked;
  if (devAllowed(dev) && LOOPBACK.test(asked)) return asked;
  return null;
}

/**
 * The whole CORS block, for a request.
 *
 * `Vary: Origin` is not decoration, and it is sent on a refusal too: the
 * header depends on the request, so a cache that ignores `Origin` could serve
 * one origin's answer to another and produce a failure that appears and
 * disappears depending on who asked first.
 *
 * `Access-Control-Allow-Headers` lists every header the app actually sends. A
 * browser refuses the whole request when a preflight omits one, and
 * `anthropic-version` is on every call to `claude`, so leaving it out fails
 * before the function ever runs.
 */
export function corsHeaders(
  raw: string | undefined | null,
  origin: string | null | undefined,
  dev?: string | null,
): Record<string, string> {
  const allow = allowOrigin(raw, origin, dev);
  return {
    ...(allow ? { 'Access-Control-Allow-Origin': allow } : {}),
    Vary: 'Origin',
    'Access-Control-Allow-Headers':
      'authorization, content-type, anthropic-version, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * The strict reading, for the functions that must fail closed.
 *
 * `allowOrigin` above answers `*` when nothing is configured, because the
 * functions it serves predate the allowlist and an unset secret must not break
 * them. The commercial functions (`billing-checkout`, `lead-intake`) start
 * life with the list, so they take the opposite default: an origin is allowed
 * only when it is named explicitly. Nothing configured, `*` in the list, a
 * request from anywhere else, or no `Origin` header at all — each answers
 * `null`, and the caller sends no `Access-Control-Allow-Origin` header, so a
 * browser refuses the response.
 */
export function strictOrigin(raw: string | undefined | null, origin: string | null | undefined): string | null {
  const list = (raw ?? '').split(',').map(tidy).filter((s) => s && s !== '*');
  const asked = tidy(origin ?? '');
  return asked && list.includes(asked) ? asked : null;
}

/** CORS headers for an origin `strictOrigin` allowed; none for one it did not. */
export function strictCorsHeaders(
  raw: string | undefined | null,
  origin: string | null | undefined,
): Record<string, string> {
  const allowed = strictOrigin(raw, origin);
  if (!allowed) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': allowed,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
