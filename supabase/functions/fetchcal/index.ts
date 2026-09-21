/**
 * One calendar, read on behalf of a signed-in device.
 *
 * The Connect screen lets somebody paste the subscribe link Brightspace,
 * Outlook, Google or iCloud gave them. A browser cannot fetch any of those: a
 * calendar server sends no `Access-Control-Allow-Origin`, so the page is
 * refused before the request leaves. The dev server forwards one request for
 * exactly this (`/feed?url=` in `app/vite.config.ts`) and a deployed build has
 * no dev server, which is why pasting a link worked on a laptop running `npm
 * run dev` and failed on the phone. This is that one route, deployed.
 *
 * Deploy:
 *     supabase functions deploy fetchcal
 *
 * No secret of its own, and nothing to set: it verifies the caller's own JWT
 * and fetches. Until it is deployed the app degrades to what it did before —
 * links from hosts that do allow the browser still work, and the .ics file
 * route works everywhere and needs no network at all.
 *
 * ## It is a calendar reader, not a proxy
 *
 * A URL fetcher on the open internet is an open relay: someone else's traffic
 * laundered through this project's IP, and a way to reach whatever the
 * function's own network can reach and the caller cannot. Four rules keep this
 * one from being that, and all four are refusals rather than mitigations:
 *
 *  1. **A real account.** The JWT is verified against the project. There is no
 *     anonymous path.
 *  2. **https, to a public host.** Loopback, link-local, private ranges and
 *     the cloud metadata addresses are refused by name and by literal, before
 *     any request is made — and again on the address a redirect landed on,
 *     because a redirect into `169.254.169.254` is the whole trick.
 *  3. **A calendar, or nothing.** The body has to start a `VCALENDAR`. A page,
 *     a JSON API, an image — all refused, so this cannot fetch anything worth
 *     laundering even for an account that exists.
 *  4. **A bounded read.** One megabyte and fifteen seconds, whichever comes
 *     first, so a slow or endless URL cannot hold the function open.
 *
 * ## What it does not do
 *
 * It does not log the URL. A Brightspace or Outlook feed address carries a
 * token that is the whole of the authentication for that person's calendar —
 * printing one would put the equivalent of a password into a log kept for a
 * month. It does not store the calendar, and it does not read it: the parsing
 * is `app/src/lib/ics.ts`, on the device, for the same reason the outbound feed
 * is rendered there — one implementation, no second copy in Deno to drift.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';


/** One megabyte. A term's calendar is a few hundred kilobytes at the outside. */
const MAX_BYTES = 1_000_000;

/** Long enough for a slow campus server, short enough not to hold a worker. */
const TIMEOUT_MS = 15_000;

/**
 * Hosts nothing on the public internet is called, refused by name.
 *
 * The same list as `app/src/lib/publichost.ts`, which is where its tests are:
 * this copy is deployed alone to Deno and cannot import from the app.
 *
 * Names rather than resolved addresses: an Edge Function cannot resolve a
 * hostname before fetching it, so this cannot catch a public name pointed at a
 * private address. What it does catch is every form somebody would actually
 * type or redirect to, and rule 3 — a body that has to be a calendar — is what
 * stands behind it.
 */
function privateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  if (h.endsWith('.internal') || h.endsWith('.home.arpa')) return true;
  // IPv6: loopback, and the unique-local and link-local blocks.
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]{2}:/i.test(h) || /^fe80:/i.test(h)) return true;
  // An IPv4 address written inside IPv6, which is the same machine by another
  // spelling: ::ffff:127.0.0.1.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped) return privateHost(mapped[1]);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 — link-local, and where every cloud keeps its metadata.
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

/** Whether an address is one this function will fetch at all. */
function allowed(raw: string): { ok: true; url: URL } | { ok: false; why: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, why: 'That is not a web address.' };
  }
  if (url.protocol !== 'https:') return { ok: false, why: 'Calendar links have to be https.' };
  if (privateHost(url.hostname)) return { ok: false, why: 'That address is not on the public internet.' };
  return { ok: true, url };
}

/**
 * The body, up to the cap, and nothing past it.
 *
 * Read through the stream rather than with `.arrayBuffer()`. This used to
 * buffer the whole response and *then* compare its length to `MAX_BYTES`,
 * which is not a cap at all: an address answering with a gigabyte had the
 * gigabyte held in the function's memory before the check that was supposed to
 * refuse it ever ran, so the limit was a way to spend memory rather than a way
 * to protect it. Cancelling the stream is what actually stops the transfer.
 *
 * Returns null when the body is over the cap, so the caller can say so without
 * having to distinguish that from an empty calendar.
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
  /*
   * Per request, because the answer depends on who asked. `ALLOWED_ORIGIN` is
   * a comma-separated allowlist now and the header echoes back whichever entry
   * the request came from — see `../_shared/cors.ts`, which carries the
   * incident this shape exists because of.
   */
  const cors = corsHeaders(Deno.env.get('ALLOWED_ORIGIN'), req.headers.get('Origin'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405);

  // The address travels in the body rather than the query string, because it
  // carries a token and a query string is the part of a request that ends up
  // in every log between here and there.
  let asked = '';
  try {
    asked = String(((await req.json()) as { url?: unknown }).url ?? '');
  } catch {
    return json({ error: 'Send {"url": "https://…"}.' }, 400);
  }

  const target = allowed(asked);
  if (!target.ok) return json({ error: target.why }, 400);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Sign in to read a calendar link on this device.' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: user, error: authError } = await admin.auth.getUser(token);
  if (authError || !user?.user) {
    return json({ error: 'That session is not valid. Sign in again.' }, 401);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Some campus feeds answer a bare fetch with a login page and the real
      // calendar only when asked for one. Saying what is wanted is honest and
      // costs nothing.
      headers: { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1' },
    });
  } catch {
    // Deliberately not the thrown message: it can contain the URL, and the URL
    // is a password.
    return json({ error: 'That calendar could not be reached.' }, 502);
  }

  // Where a redirect actually landed, checked with the same rule as the
  // address that was asked for.
  const landed = allowed(upstream.url || target.url.toString());
  if (!landed.ok) {
    await upstream.body?.cancel();
    return json({ error: 'That link redirects somewhere this will not follow.' }, 400);
  }

  if (!upstream.ok) {
    await upstream.body?.cancel();
    return json({ error: `The calendar answered ${upstream.status}.` }, 502);
  }

  const text = await readCapped(upstream);
  if (text === null) {
    return json({ error: 'That calendar is larger than this will fetch.' }, 413);
  }
  if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 4096))) {
    return json(
      { error: 'That address answered with something that is not a calendar — usually a sign-in page, which means the link is the one you open in a browser rather than the feed.' },
      422,
    );
  }

  return new Response(text, {
    headers: {
      ...cors,
      'Content-Type': 'text/calendar; charset=utf-8',
      // One student's timetable. Nothing shared should hold on to it, and the
      // device asks again when it wants it again.
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
