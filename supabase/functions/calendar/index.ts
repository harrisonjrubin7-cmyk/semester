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
 *     psql "$DATABASE_URL" -f supabase/migrations/20260901000800_calendar.sql
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
 *   * It will not write anything a person could be identified by. It does
 *     write one thing, and the earlier version of this comment ruled it out:
 *
 *       > It will not write. Not a read receipt, not a hit counter — a feed
 *       > polled by four devices every four hours is a write every twenty
 *       > minutes for the life of the account, and it would buy nothing.
 *
 *     Half of that still holds. A hit counter buys nothing; nobody needs to
 *     know their calendar was fetched four hundred times. What the same review
 *     says three paragraphs earlier is that anyone holding this link reads the
 *     deadlines "indefinitely, until it is replaced" — and the app has had the
 *     replace button all along with nothing that would ever make a student
 *     press it. A leaked link and a private one look identical from inside the
 *     app. The one place they differ is out here, in what is asking:
 *     **a calendar subscription is fetched by a calendar, and a person is a
 *     browser.**
 *
 *     So one row per account per day per kind of client, through
 *     `public.read_feed`, which does the lookup and the note in one statement.
 *     Never the user agent itself, never an address, never the token: the
 *     family is one of seven words and `access_log`'s check constraint is what
 *     makes that a property of the database rather than a promise made here.
 *     The cost is real and is a write on a read; at a scale where it matters
 *     the bucket widens, in the migration, where it can be argued about.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** 24 random bytes as hex — the same shape `app/src/lib/subscribe.ts` generates. */
const TOKEN = /^[0-9a-f]{48}$/;

/**
 * Which kind of client is asking, out of a fixed list, and never the string.
 *
 * A copy of `app/src/lib/clientfamily.ts`, which is the one with the tests —
 * an Edge Function is deployed alone to Deno by the Supabase CLI and cannot
 * import from the app, the same reason `lib/publichost.ts` duplicates
 * `fetchcal`'s host rule. `clientfamily.test.ts` reads this block and the
 * migration's check constraint and fails when the three stop agreeing.
 *
 * The ordering is the correctness argument and it is not obvious: Safari on a
 * Mac says `Intel Mac OS X 10_15_7` and macOS Calendar says
 * `Mac OS X/10.15.7`, so a rule that asks about the operating system files a
 * person opening a leaked link as the student's own calendar. The agent
 * tokens below name the *program* and appear in no browser's user agent.
 */
const FAMILY: [RegExp, string][] = [
  [/CalendarAgent|dataaccessd|ICSAgent|CoreDAV|accountsd/i, 'apple'],
  [/Google-Calendar|Googlebot|Google Calendar/i, 'google'],
  [/Outlook|Microsoft|MSOffice|Office\//i, 'outlook'],
  [/Gecko|WebKit|Chrome|Safari|Firefox|Edg\//i, 'browser'],
];

function familyOf(userAgent: string | null): string {
  const ua = (userAgent ?? '').trim();
  // Nothing sent is `unknown`; something sent and not recognised is `other`.
  // Collapsing the two would hide the second, and the second is the one worth
  // looking at.
  if (!ua) return 'unknown';
  for (const [pattern, family] of FAMILY) if (pattern.test(ua)) return family;
  return 'other';
}

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
  /*
   * One statement, and still only three columns.
   *
   * `read_feed` looks the row up by token, notes the fetch against whoever
   * owns it, and returns `body`, `name` and `updated_at` — not `user_id`. That
   * is the same promise the `select` it replaced made, kept the same way: the
   * account is known inside the database, where the access log is written, and
   * never travels out here. A select that fetched the owner so this could
   * write the log would have undone exactly what that promise was for.
   */
  const { data: rows, error } = await db.rpc('read_feed', {
    feed_token: token,
    family: familyOf(req.headers.get('user-agent')),
  });
  const data = Array.isArray(rows) ? rows[0] : rows;

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
