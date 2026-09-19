/**
 * One Canvas API path, read on behalf of a signed-in device.
 *
 * `fetchcal` is this function's sibling and the reasoning is the same: a
 * browser cannot call Canvas, because Canvas sends no `Access-Control-Allow-Origin`
 * on any API response. Where a calendar host might allow it — a minority do —
 * Canvas never does, on any instance, so `app/src/lib/canvas.ts` does not even
 * try the direct route. The dev server forwards this while developing
 * (`/canvas` in `app/vite.config.ts`) and a deployed build has no dev server.
 * This is that route, deployed.
 *
 * Deploy:
 *     supabase functions deploy canvas
 *
 * No secret of its own: the caller's JWT is verified, and the Canvas token is
 * the student's, held on their device and sent per request. Until this is
 * deployed the app says so and points at the calendar link, which needs no
 * server at all and which most of Canvas's dates are also on.
 *
 * ## It is an assignment reader, not a proxy — and the token raises the stakes
 *
 * `fetchcal` guards a feed URL, which reads one calendar. **This guards an
 * access token, which is the whole account and can write.** A student issues it
 * themselves in about forty seconds and that is the point of the feature, but
 * it means a bug here is not a leaked timetable, it is a leaked account. Five
 * rules, and every one is a refusal rather than a mitigation:
 *
 *  1. **A real account.** The JWT is verified against the project. There is no
 *     anonymous path.
 *  2. **https, to a public host.** Loopback, link-local, the private ranges and
 *     the cloud metadata addresses are refused by name and by literal, before
 *     any request is made.
 *  3. **`GET`, under `/api/v1/`, and nothing else.** This is the rule that
 *     carries the most weight. The token can create, submit and delete; this
 *     function issues no method but GET and reaches no path outside the API,
 *     so the worst a mistake upstream of it can do is read something the
 *     student can already read.
 *  4. **JSON, or nothing.** A Canvas instance behind a campus SSO answers an
 *     unauthenticated request with an HTML login page and a cheerful 200.
 *     Returning that as though it were data is how somebody ends up with an
 *     empty course list and no idea why.
 *  5. **A bounded read.** One megabyte and fifteen seconds, whichever comes
 *     first.
 *
 * ## What it does not do
 *
 * It does not log the token, the host or the path, and the token never travels
 * in a query string — which is why a POST body is used to issue a GET. It does
 * not store the answer, and it does not parse it: the mapping to the app's own
 * shapes is `app/src/lib/canvas.ts`, on the device, for the same reason the
 * calendar parsing is — one implementation, no second copy in Deno to drift.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** One megabyte. A term of assignments across a full load is far under it. */
const MAX_BYTES = 1_000_000;

/** Long enough for a slow campus instance, short enough not to hold a worker. */
const TIMEOUT_MS = 15_000;

/**
 * Hosts nothing on the public internet is called, refused by name.
 *
 * The same list as `app/src/lib/publichost.ts` and as `fetchcal`, which is
 * where its tests are: this copy is deployed alone to Deno and cannot import
 * from the app.
 */
function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return privateHost(mapped[1]);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/**
 * Whether a path is one this function will ask for.
 *
 * Rule 3, written as a shape rather than a normalisation. A `..` segment, a
 * scheme, a host — every way of leaving `/api/v1/` is refused outright rather
 * than cleaned up, because a cleaner is a thing with bugs in it and a refusal
 * is not.
 */
function readablePath(path: string): boolean {
  if (path.includes('..') || path.includes('\\')) return false;
  return /^\/api\/v1\/[A-Za-z0-9/_.~-]*(\?[A-Za-z0-9/_.~\-=&%[\]]*)?$/.test(path);
}

/**
 * The body, up to the cap, and nothing past it.
 *
 * Streamed rather than buffered, for the reason `fetchcal` spells out: a cap
 * checked after the whole body is in memory is a way to spend memory, not a
 * way to protect it.
 */
async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let out = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return out + decoder.decode();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405);

  // Host, path and token all travel in the body. The token especially: a query
  // string is the part of a request that ends up in every log between here and
  // there, and this one opens the student's account.
  let host = '';
  let path = '';
  let canvasToken = '';
  try {
    const body = (await req.json()) as { host?: unknown; path?: unknown; token?: unknown };
    host = String(body.host ?? '');
    path = String(body.path ?? '');
    canvasToken = String(body.token ?? '');
  } catch {
    return json({ error: 'Send {"host": "…", "path": "/api/v1/…", "token": "…"}.' }, 400);
  }

  if (!host || !canvasToken) return json({ error: 'A Canvas host and access token are needed.' }, 400);
  if (privateHost(host)) return json({ error: 'That address is not on the public internet.' }, 400);
  if (!readablePath(path)) return json({ error: 'Only the Canvas API is readable through this.' }, 400);

  const session = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!session) return json({ error: 'Sign in to read Canvas on this device.' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: user, error: authError } = await admin.auth.getUser(session);
  if (authError || !user?.user) {
    return json({ error: 'That session is not valid. Sign in again.' }, 401);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`https://${host}${path}`, {
      method: 'GET',
      // Not followed. A redirect off a Canvas API path is either an SSO bounce
      // or something stranger, and following it would carry the Authorization
      // header to wherever it pointed — which is the one thing this must never
      // do with a token this strong.
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${canvasToken}`, Accept: 'application/json' },
    });
  } catch {
    // Deliberately not the thrown message: it can carry the host and path, and
    // the request carried a token.
    return json({ error: 'Canvas could not be reached.' }, 502);
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel();
    return json(
      { error: 'Canvas redirected that request, which usually means the address is a campus sign-in rather than the API.' },
      502,
    );
  }

  if (upstream.status === 401 || upstream.status === 403) {
    await upstream.body?.cancel();
    return json({ error: 'Canvas refused that token. Make a new one under Account → Settings.' }, 401);
  }

  const text = await readCapped(upstream);
  if (text === null) return json({ error: 'Canvas answered with more than this will read.' }, 413);

  if (!upstream.ok) return json({ error: `Canvas answered ${upstream.status}.` }, 502);

  // Rule 4. An HTML sign-in page with a 200 on it is the failure this catches.
  try {
    JSON.parse(text);
  } catch {
    return json(
      { error: 'That address answered with something that is not the Canvas API — usually a sign-in page, which means the host is right and the token is not being accepted.' },
      422,
    );
  }

  return new Response(text, {
    headers: {
      ...cors,
      'Content-Type': 'application/json; charset=utf-8',
      // One student's coursework. Nothing shared should hold on to it.
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
