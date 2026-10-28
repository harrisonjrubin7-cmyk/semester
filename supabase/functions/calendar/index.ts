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

import { createClient } from '@supabase/supabase-js';
import { handleCalendarFeed } from '../_shared/calendarfeed.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const db = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

Deno.serve((req: Request) => handleCalendarFeed(req, db ? {
  readFeed: (token, family) => db.rpc('read_feed', { feed_token: token, family }),
} : null));
