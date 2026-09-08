# A published calendar feed — what to check before deploying

On branch `ics-feed`. The client library, the SQL and the Edge Function are all
here; **nothing is wired into a screen yet**, and that is deliberate — see
"What is not here" at the end.

## First, a correction to the plan

The improvement list said:

> You parse `VEVENT` on the way in. You don't emit one on the way out.

The app does emit one. `app/src/lib/export.ts` has written a `VCALENDAR` since
the Export screen existed, and the Calendar checkbox downloads it. I started
building a second emitter before finding the first, threw it away, and fixed
the existing one instead — the hour a syllabus states is no longer discarded,
every deadline carries two alarms, line folding counts octets rather than
characters, and the calendar declares `METHOD:PUBLISH`. That is commit
`ca9c861` and it is independent of everything below.

What genuinely did not exist is the part that matters: **a URL a calendar app
subscribes to.** A downloaded file is a photograph. A feed is a window. This is
the window.

## The shape of it

```
  device                          database                    Apple / Google
  ──────                          ────────                    ──────────────
  renders the .ics  ──publish──▶  calendar_feeds              │
  (lib/export.ts)                 { token, body, name }       │
                                        │                     │
                                        └──── Edge Function ◀─┘
                                             GET /calendar/<token>
```

**The app renders; the server only serves.** The obvious alternative is a
function that reads the account's courses and works the deadlines out itself.
That means a second copy of `datedItems`, `decorateItem` and `duetime` in Deno,
drifting from the first the moment either is touched — a bug class where the
calendar quietly disagrees with the app and nobody notices for a month. So the
function has no idea what a deadline is. It looks up one row and returns a
string.

**The cost of that, stated rather than hidden:** the feed is only as fresh as
the last sync from a signed-in device. Somebody who stops opening the app has a
calendar that stops moving. `freshness()` in `app/src/lib/subscribe.ts` is what says
so on the screen, and `FEED_NOTE` says it inside the calendar too, for somebody
who only ever sees this in Apple Calendar.

## The security decision, which is the whole review

**A calendar subscription cannot sign in.** Apple Calendar and Google Calendar
fetch the URL with no credentials and no mechanism to supply any. There is no
header to check, no JWT to verify, no OAuth. The random token in the path is
the entire authentication, and anyone holding the link can read every deadline
in the account, indefinitely, until it is replaced.

That is the deal every calendar feed in the world makes — Brightspace's own
feed, the one this app already consumes, works exactly this way. It is not a
flaw in this design; it is the design. What matters is whether the blast radius
is drawn tightly, and here is what was done about it:

| Concern | What was done |
|---|---|
| Guessing a token | 24 random bytes, 192 bits. Not guessable, and the shape is checked before the database is touched so a scan cannot make the database work for free. |
| What a leaked link exposes | Deadline titles, dates and course codes. **Nothing else** — not the email address, the notes, the grades, the transcript, or the API key. A leaked link leaks a timetable, not an identity. |
| Revoking | Replace the token: one update, and the old URL is dead immediately. `REPLACED_LINE` says what that breaks for devices still subscribed. |
| The token in logs | No line in the function prints a token, a URL, or a body. Supabase keeps logs for a month; a token in one is a password in one. |
| The token in a referrer | `Referrer-Policy: no-referrer`, in case somebody opens the link in a browser. |
| A shared cache holding a student's timetable | `Cache-Control: private`. |
| A script on another site fetching a guessed feed | No `Access-Control-Allow-Origin` header at all. Calendar clients do not use CORS; browsers do. |
| Confirming a token exists | A valid-looking token that matches nothing, a token that was replaced, and a database error all return the same 404 and the same body. |
| A feed outliving its account | `on delete cascade`, checked in `calendar.check.sql`. |

**`--no-verify-jwt` is required here, and is wrong on the other functions.**
Worth being explicit, because it looks alarming next to a function that reads
with the service key. Three functions, three different answers, each matching
who calls it: `claude` is called by a signed-in browser and verifies a JWT;
`push` is called by the scheduler and authenticates with a shared secret;
`calendar` is called by Apple with nothing at all, and the token is the check.

**This is the only place in the project where the service key serves a read to
somebody who is not signed in.** It can only ever return the single row whose
token was presented, and it selects three columns — `body`, `name`,
`updated_at`. Not `user_id`: nothing downstream needs to know whose calendar
this is, and a select that never fetches it cannot leak it through a mistake
later.

## Before you deploy

1. Read `supabase/functions/calendar/index.ts`. It is about a hundred lines and
   most of them are comments; the part that matters is short enough to hold in
   your head, which is the point.
2. Run `supabase/calendar.check.sql` in the SQL Editor — paste the contents,
   not the path. It makes its own users and rolls back. The check that matters
   most is the `anon` one: the publishable key is in the JavaScript every
   visitor downloads, so if `anon` can select from `calendar_feeds`, every
   calendar in the project is public. It should print `ALL CHECKS PASSED`.
3. `psql "$DATABASE_URL" -f supabase/calendar.sql`
4. `supabase functions deploy calendar --no-verify-jwt`
5. Publish a feed by hand for one account and open the URL in a browser. You
   should get an `.ics`. Then change one character of the token and confirm you
   get an empty calendar and a 404, with no hint that the real one exists.

I could not do any of this from where the code was written: this environment
has no outbound access to `supabase.co` and no Postgres, so every SQL file in
this project is reviewed by reading rather than by running. The TypeScript half
is covered by `app/src/lib/subscribe.test.ts` and `app/src/lib/export.test.ts`.

## What is not here

**No screen.** The publish path (`cloud.ts`), the subscribe UI on the Export
screen, and `'calendar_feeds'` in `OWNED_TABLES` all belong in the same change
as the deploy, because none of them can be driven in a browser until the
function answers. Building a subscribe button against an endpoint that returns
nothing would mean shipping copy I had never seen and a link I had never
followed.

Say the word once this is deployed and the client half goes on top: a section
on the Export screen that appears when you are signed in, shows the `webcal:`
link and a QR code for the phone, says how fresh the feed is and what is in it,
carries `SHARE_WARNING` next to the link every time rather than behind a
disclosure, and offers "replace this link" in one tap. All of that copy is
already written and unit-tested in `app/src/lib/subscribe.ts`; what is missing is a
browser to point at it.

**One thing to decide before then:** whether the feed carries ticked-off work.
The download does, because an export should be a complete record. A
subscription probably should not — a calendar showing what you have already
finished is one you stop reading. My inclination is to drop done items from the
feed and keep them in the file, and say so on the screen.
