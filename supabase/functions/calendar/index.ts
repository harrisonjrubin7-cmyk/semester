/**
 * The calendar feed.
 *
 * A calendar app asks for `/calendar/<token>`; this returns the `.ics` the
 * student's own device rendered and uploaded. That is the whole function. It
 * does not know what a deadline is, has never heard of a term, and cannot
 * produce a calendar for an account that has not published one — all of the
 * meaning lives in `app/src/lib/export.ts`, on the device, so there is exactly
 * one emitter and no second copy drifting away from the first.
 *
 * Deploy:
 *     psql "$DATABASE_URL" -f supabase/calendar.sql
 *     supabase functions deploy calendar --no-verify-jwt
 *
 * `--no-verify-jwt` is not a shortcut here, it is the requirement: Apple
 * Calendar and Google Calendar fetch a subscription with no credentials and no
 * way to supply any. There is no header to check. The random token in the path
 * is the whole of the authentication, which is the deal every calendar feed in
 * the world makes, and `supabase/CALENDAR-REVIEW.md` sets out what follows
 * from it. Contrast the Claude function, which is called by a signed-in
 * browser and must verify a JWT, and the push function, which is called by the
 * scheduler and authenticates with a shared secret.
 *
 * What this function will not do:
 *
 *   * It will not accept a token of the wrong shape. A short or non-hex path
 *     is refused before the database is touched, so a scan cannot use response
 *     timing to learn anything and cannot make the database work for free.
 *   * It will not say whether a token existed. A valid-looking token that
 *     matches nothing gets the same 404 and the same body as one that has been
 *     replaced.
 *   * It will not log a token, a URL, or a calendar body. There is no line
 *     below that prints one, and adding one would put the equivalent of a
 *     password into the log Supabase keeps for a month.
 *   * It will not write. Not a read receipt, not a hit counter — a feed polled
 *     by four devices every four hours is a write every twenty minutes for the
 *     life of the account, and it would buy nothing.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** 24 random bytes as hex — the same shape `app/src/lib/subscribe.ts` generates. */
const TOKEN = /^[0-9a-f]{48}$/;

/** What every response carries, whatever happened. */
const HEADERS: Record<string, string> = {
  'Content-Type': 'text/calendar; charset=utf-8',
  // A calendar app should ask again in a few hours, and nothing in between
  // should be cached by anything else. `private` because the body is one
  // student's timetable and must never sit in a shared cache.
  'Cache-Control': 'private, max-age=3600',
  // The link is a bearer credential. If a student ever opens it in a browser
  // and clicks away, the token must not travel to wherever they go next.
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  // No browser page needs to read this cross-origin, and a calendar client
  // does not use CORS at all, so there is no Access-Control-Allow-Origin here
  // on purpose: a script on another site cannot fetch a feed it guesses.
};

/**
 * An empty but valid calendar.
 *
 * Returned with a 404 so a client that follows the status stops, and as a real
 * `VCALENDAR` so one that ignores the status shows an empty calendar rather
 * than an error dialog every four hours forever.
 */
function empty(name = 'Semester'): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Semester//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${name}`,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** A filename for the client that decides to download rather than subscribe. */
function attachment(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `inline; filename="${clean || 'semester'}.ics"`;
}

Deno.serve(async (req: Request) => {
  // A calendar client sends GET, and HEAD to check freshness. Nothing else is
  // meaningful against a feed.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    // A misconfigured deploy refuses rather than serving something wrong.
    return new Response(empty(), { status: 503, headers: HEADERS });
  }

  const token = new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? '';
  if (!TOKEN.test(token)) {
    return new Response(empty(), { status: 404, headers: HEADERS });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('calendar_feeds')
    // Only these three columns, ever. Not `user_id`: nothing downstream needs
    // to know whose calendar this is, and a select that does not fetch it
    // cannot leak it through a mistake later.
    .select('body, name, updated_at')
    .eq('token', token)
    .maybeSingle();

  // A missing row and a database error get the same answer, because telling
  // an unauthenticated caller which one it was is telling them something.
  if (error || !data || typeof data.body !== 'string' || data.body === '') {
    return new Response(empty(), { status: 404, headers: HEADERS });
  }

  const name = typeof data.name === 'string' && data.name ? data.name : 'Semester';
  const headers = {
    ...HEADERS,
    'Content-Disposition': attachment(name),
    ...(data.updated_at ? { 'Last-Modified': new Date(data.updated_at).toUTCString() } : {}),
  };

  // HEAD gets the headers and no body, which is what a client polling for a
  // change actually wants.
  return new Response(req.method === 'HEAD' ? null : data.body, { status: 200, headers });
});
