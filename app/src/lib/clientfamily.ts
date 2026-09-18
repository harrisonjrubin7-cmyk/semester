/**
 * What kind of thing is asking for a calendar feed.
 *
 * A published feed is a bearer credential: the token in the URL is the whole
 * of the authentication, because Apple Calendar and Google Calendar arrive
 * with no credentials and cannot be given any. `supabase/CALENDAR-REVIEW.md`
 * makes that case and it is the right one. What follows from it is that a
 * leaked link and a private one are indistinguishable from inside the app, and
 * the app already has the button that fixes a leak — *replace this link* — and
 * nothing that would ever make somebody press it.
 *
 * This is the one observable difference. **A calendar subscription is fetched
 * by a calendar. A person is a browser.** So the access log records a family,
 * out of the fixed list below, and the app can say "something opened your
 * calendar link in a browser on Tuesday" — which is a sentence a student can
 * act on.
 *
 * ## A family, and never the string
 *
 * The user-agent header itself is a fingerprint: version numbers, build
 * identifiers and a device model, which together identify a phone far more
 * precisely than anything else this app stores. Writing it down would make the
 * access log the most invasive table in the schema, in the name of privacy.
 *
 * So the string is classified here and thrown away, and
 * `access_log.client`'s `check` constraint in the database refuses anything
 * outside `FAMILIES` — the guarantee is enforced by Postgres rather than by a
 * habit in a function.
 *
 * ## Deliberately a copy
 *
 * `supabase/functions/calendar/index.ts` carries the same rule, for the reason
 * `lib/publichost.ts` carries a copy of `fetchcal`'s: a function is deployed
 * alone to Deno by the Supabase CLI and cannot reach into this directory. This
 * is the copy with the tests, and `clientfamily.test.ts` reads the other two
 * — the Deno function and the migration — and fails when the three
 * vocabularies stop agreeing.
 */

/**
 * Every value `access_log.client` may hold.
 *
 * `device` is the push sender's, which has no user agent to read: a reminder
 * is delivered to a subscribed device and the family says so rather than
 * leaving a blank that reads as a failed classification.
 */
export const FAMILIES = [
  'apple',
  'google',
  'outlook',
  'browser',
  'other',
  'unknown',
  'device',
] as const;

export type Family = (typeof FAMILIES)[number];

/**
 * The agent tokens calendar clients send, checked before anything else.
 *
 * These are the part of a user agent that names the *program*, and none of
 * them appears in a browser's. That ordering is the whole correctness
 * argument: Safari on a Mac sends `Macintosh; Intel Mac OS X 10_15_7`, and a
 * rule keyed on "Mac OS X" would file a person opening the link as Apple
 * Calendar — turning the one signal this exists for into a false negative
 * every time, silently, on the platform most of these students use.
 */
const AGENTS: [RegExp, Family][] = [
  // macOS Calendar is `Mac OS X/10.15.7 (19H2) CalendarAgent/954.9`; iOS is
  // `iOS/17.0 (21A329) dataaccessd/1.0`. `ICSAgent` and `CoreDAV` are the
  // older spellings and still turn up.
  [/CalendarAgent|dataaccessd|ICSAgent|CoreDAV|accountsd/i, 'apple'],
  // `Mozilla/5.0 (compatible; Google-Calendar-Importer)` — a Mozilla prefix
  // and not a browser, which is why the browser rule cannot come first.
  [/Google-Calendar|Googlebot|Google Calendar/i, 'google'],
  [/Outlook|Microsoft|MSOffice|Office\//i, 'outlook'],
];

/** A browser, which is what a person looks like. */
const BROWSER = /Gecko|WebKit|Chrome|Safari|Firefox|Edg\//i;

/**
 * The family of a user-agent string, or `unknown` when there is none.
 *
 * An absent header is `unknown` rather than `other`: a client that sends no
 * user agent has told you nothing, and a client that sent one this does not
 * recognise has told you something. Filing them together would hide the second
 * inside the first, and the second is the one worth looking at.
 */
export function clientFamily(userAgent: string | null | undefined): Family {
  const ua = (userAgent ?? '').trim();
  if (!ua) return 'unknown';
  for (const [pattern, family] of AGENTS) {
    if (pattern.test(ua)) return family;
  }
  if (BROWSER.test(ua)) return 'browser';
  return 'other';
}
