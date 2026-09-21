# Deploying the backend

Edge Functions, the SQL they read, and a scheduler. No function needs the app
redeployed — the browser calls them by URL — but none does anything useful
until its secrets are set, and each fails *closed* rather than open when they
are missing.

## What is live

Read off the project at 16:05 UTC on 21 September 2026, not remembered:

    claude     ACTIVE, v19, verify_jwt off
    push       ACTIVE, v16, verify_jwt off
    calendar   ACTIVE, v12, verify_jwt off
    fetchcal   ACTIVE, v13, verify_jwt off
    canvas     ACTIVE,  v4, verify_jwt off
    lti        ACTIVE,  v1, verify_jwt off

**This file said two, at v1, and three of the other four were filed below under
"Not deployed yet".** `fetchcal` had been live since 9 September when that was
written — twelve days — and `calendar` since the 8th and was named nowhere at
all. `lti` went up at 15:48 on the 21st, about two hours after its own section
said it had not.

The cause is not forgetfulness, and that is why the rows above carry a
timestamp. `functions.yml` deploys on every push to main that touches a
function's directory, so **a function directory on main is a deployed
function**: "not deployed yet" is true only until the pull request merges, and
then it is false with nobody having edited anything. A hand-written record
cannot win that race. `app/src/lib/deployfunctions.test.ts` is what holds this
section to the directories instead — it cannot see the project, so it checks
the one thing it can: that every function here is accounted for, and that none
of them is described as unshipped.

The version numbers are the part that will go stale first and the part that
matters least; the deployed-or-not column is the one that misled.

## Deploying a function without a laptop

`.github/workflows/functions.yml` runs the same command from Actions:
**Actions → Deploy Edge Functions → Run workflow**, with the function's name
(`fetchcal` by default). It also runs itself when a push to main changes a
function's own directory, and it deploys only the directories that changed.

It needs one secret, once: `SUPABASE_ACCESS_TOKEN`, from
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens),
added under Settings → Secrets and variables → Actions. That is an *account*
credential — it can deploy — so it lives in a secret and nowhere else. It is
neither the publishable key (which is public by design and committed) nor the
service key (which must never be anywhere). Without it the workflow warns and
deploys nothing rather than failing main.

The project is read from the `SUPABASE_PROJECT_REF` variable if set, and
otherwise off `VITE_SUPABASE_URL` — so a fork deploys to its own project.

## Live: `fetchcal`

    supabase functions deploy fetchcal

`supabase/functions/fetchcal/index.ts`. It reads **one pasted calendar link**
on behalf of a signed-in device — the Connect screen's *Subscribe* button.

Why it has to exist at all: a calendar server sends no CORS headers, so the
browser is refused before the request leaves. The dev server forwards that one
request itself (`/feed?url=` in `app/vite.config.ts`), which is why pasting a
Brightspace or Outlook link works on a laptop running `npm run dev`. On the
built app it works too, through this function. For twelve days this paragraph
ended "and, until this is deployed, fails on the built app", which told anybody
reading it that a working feature was broken.

It takes no secret and needs no SQL. It verifies the caller's own JWT, refuses
anything that is not https to a public host, refuses a redirect that lands
somewhere private, caps the read at a megabyte and fifteen seconds, and returns
the body only if it is a `VCALENDAR` — so it is a calendar reader rather than a
URL proxy that happens to fetch calendars. It never logs the address, because a
feed URL carries a token that is the whole of the authentication for that
person's calendar.

`verify_jwt` should be **off** for the same reason as the other two: the
function checks the token itself, and the platform check would reject the CORS
preflight, which carries no `Authorization` header.

Were it ever down or rolled back, the app degrades rather than breaks — links
from hosts that do allow the browser still work, the screen says what failed,
and adding a downloaded `.ics` needs no network at all. That is worth keeping
written down; it is a fallback, not the current state.

## Live: `canvas`

    supabase functions deploy canvas

`supabase/functions/canvas/index.ts`. It reads **one Canvas API path** on behalf
of a signed-in device — the Connect screen's *Read my Canvas* button, which is
the route that answers whether a piece of work has actually been handed in. A
calendar feed never says.

`fetchcal`'s sibling, and the same reason for existing with one difference that
raises the stakes throughout. Canvas sends no CORS headers on any API response,
on every instance — not a majority, all of them — so `app/src/lib/canvas.ts`
does not try the browser at all. The dev server forwards it while developing
(`/canvas` in `app/vite.config.ts`); this is the deployed route.

**What is different from `fetchcal`: the secret it carries.** A feed URL reads
one calendar. A Canvas access token *is the account* — it can read the
student's messages and grades, and it can write. So on top of the JWT check,
the public-host rule, the bounded read and the no-logging that `fetchcal`
already has, this one adds the two refusals that matter for a credential that
strong:

- **`GET`, under `/api/v1/`, and nothing else.** No method but GET reaches
  upstream and no path outside the API is fetched, so the worst a mistake can
  do is read something the student can already read.
- **Redirects are not followed.** Following one would carry the
  `Authorization` header to wherever it pointed. A 3xx off a Canvas API path is
  refused with a message saying what it usually means, which is a campus
  sign-in page rather than the API.

It also requires the answer to parse as JSON, because an instance behind campus
SSO answers an unauthenticated request with an HTML login page and a cheerful
200 — returning that as data is how somebody ends up with an empty course list
and no idea why.

It takes no secret of its own and needs no SQL. `verify_jwt` should be **off**,
for the same reason as the others: the function checks the token itself, and
the platform check would reject the CORS preflight.

Were it down, the app says so and points at the calendar link, which needs no
server at all and carries most of the same dates — just not whether you did
them. Again: a fallback, not where things stand.

`verify_jwt` is off on both, and on both it is the platform check that is off,
not authentication:

- **claude** verifies the caller's token itself, with
  `admin.auth.getUser(token)`, and refuses with 401 otherwise. It has to handle
  the CORS preflight, and a browser's `OPTIONS` carries no `Authorization`
  header — with the platform check on, the preflight is rejected before the
  function runs and every call from the app fails with a CORS error that says
  nothing about the cause.
- **push** is called by the scheduler rather than by a browser, and
  authenticates with a shared secret of its own. Without `CRON_SECRET` set it
  returns 503 to everything, so a half-finished deploy is silent rather than
  open.

## Live: `lti`

    supabase functions deploy lti --no-verify-jwt

`supabase/functions/lti/index.ts`. It is the Brightspace end of the finding in
`GRADESCOPE-TURNITIN.md`: Semester cannot submit *into* Gradescope or Turnitin,
and Brightspace can launch Semester. The first needs a partner program; the
second needs a 1EdTech standard and a school administrator.

Two endpoints, and a school's administrator needs the first one's address:

    …/functions/v1/lti/login     the OIDC login initiation URL
    …/functions/v1/lti/launch    the redirect URL, and the target link URI

`--no-verify-jwt` on this one is not the same argument as on the other four.
They verify the caller's Supabase token themselves; **this one has no Supabase
caller.** Brightspace redirects a student's browser to it, and that browser has
no session with this project. A launch is authenticated by the platform's own
signed `id_token`, checked against the keys the platform publishes and then
claim by claim against the registration below — `supabase/functions/_shared/lti.ts`
is that check and `app/src/lib/lti.test.ts` walks every refusal in it.

### The tool's own key

    supabase secrets set LTI_PRIVATE_KEY='{"kty":"RSA","n":"…","e":"AQAB","d":"…", …}'

An RS256 JWK, private half included. It lives as a function secret for the
same reason `VAPID_PRIVATE_KEY` does — a signing key used only by an Edge
Function, with its public half published on purpose — and not in the Vault,
which holds only the one secret Postgres itself has to read.

Its public half is served at:

    …/functions/v1/lti/jwks

**That address is the third thing a school's administrator needs**, alongside
the two below, and they need it while they are registering the tool rather
than afterwards: Brightspace asks for a JWKS URL during the install. With no
key set the endpoint answers 503 and says so, and **launches keep working** —
a launch is the platform proving itself to us and needs nothing of ours.

**Deep linking signs with it**, and is the only thing that does. Grade
passback still does not exist; the key is no longer idle.

### Deep linking, on the launch endpoint

There is no third URL for this. Deep linking is a different *message* arriving
at `…/lti/launch`, which is why the administrator's list above did not grow.

What it is for: an instructor inside Brightspace's "add an activity" flow
picks Semester, Brightspace opens the launch endpoint with an
`LtiDeepLinkingRequest`, and what comes back is not a page but a JWT this tool
signs, posted to an address the platform nominated. The instructor never
really leaves Brightspace, and the course ends up holding a link that launches
Semester properly — with a token, verified — rather than a bare address.

Three things refuse it, and each says which:

    not-a-teacher        the launch carried no instructor role
    no-key               LTI_PRIVATE_KEY is not set, so nothing can be signed
    insecure-return-url  the platform's return address was not https

The first is the one worth stating plainly: a deep-linking response is an
instruction to put something in a course, so a platform that asks a *student*
for one is confused or being driven, and the answer is no either way.

The second is why this section sits under the key rather than beside the
endpoints. A launch works with no key at all. This does not, and the person
who has to fix it is the same person standing in the dialog — so it answers
503 and names the setting rather than 500 and a log they cannot read.

### Registering a school

Nothing in the app writes `public.lti_platform`, deliberately: an account that
could would be an account that could register an issuer it controls and launch
as anybody. It is one insert, in the SQL Editor, with the four values the
administrator reads off the Brightspace side of the registration.

```sql
insert into public.lti_platform
  (issuer, client_id, deployment_id, auth_login_url, jwks_url, name)
values
  ('https://brightspace.vanderbilt.edu',
   '<client id Brightspace issued>',
   '<deployment id Brightspace issued>',
   'https://brightspace.vanderbilt.edu/d2l/lti/authenticate',
   'https://brightspace.vanderbilt.edu/d2l/.well-known/jwks',
   'Vanderbilt University');
```

`token_url` is a fourth column and is **null until somebody fills it in**. It
is where the platform hands out access tokens for calling back into it, which
a launch never does — so it can be left out now and added when grade passback
exists. Brightspace's is not on the school's own host:

```sql
update public.lti_platform
   set token_url = 'https://auth.brightspace.com/core/connect/token'
 where issuer = 'https://brightspace.vanderbilt.edu';
```

There is deliberately no default. The value is where this tool posts a
*signed assertion*, and a guess sends it to somebody else's server.

**One row per deployment, not per school.** A university with separate
Brightspace orgs for its schools is the ordinary case, and the deployment id is
the only thing in a launch that tells them apart. Registering one and expecting
it to serve both is how a launch from the medical school lands in the law
school's data — the tool refuses it, but it refuses it as `wrong-deployment`,
which is a confusing thing to debug if you did not know the row was missing.

Both URLs are `https` by a check constraint rather than by convention: they are
the two addresses this function redirects a student to and fetches keys from.

### One setting it needs

    SEMESTER_APP_URL = https://harrisonjrubin7-cmyk.github.io/semester/

Set it under Edge Functions → Secrets. There is deliberately **no default**:
this is the address a student's browser is sent to carrying a one-use session
token, so a wrong guess is not a broken link, it is a token handed to whatever
is at the address we assumed. Without it the function refuses the launch and
says which setting is missing.

### What a launch does

A first launch **makes an account**, keyed on the issuer and the platform's
subject for that person, and signs them in. A professor switches the tool on
and two hundred students click it that week; every one asked to go and sign up
first is one who does not come back.

Attaching an account a student **already had** is never automatic. Nothing in
this function reads the token's email claim to find an existing account — an
email claim is a string a registered platform sends us, and matching on it
hands an account to whoever can get one registration row wrong. Instead the
launch issues a ticket, and `adopt_lti_identity` spends it only alongside a
session the student proved. Two proofs, held by no single party.

`_shared/ltiaccount.ts` makes that structural: a provisioned account's address
is synthesised on `lti.invalid`, a domain that cannot receive mail, so there is
no account for an email match to find even if somebody later writes one.

**The invite gate is not bypassed.** While it is on, the function puts the
synthesised address on `public.invites` before creating the account — which is
the honest reading of what happened, since a school's administrator installing
this tool is an invitation issued by exactly the person the gate exists to let
issue them. It leaves a row saying so.

Grade passback is still not built. Deep linking now is, and signs with the key
described above — which is why there is still no key material in either
migration: the key was always going to live as a function secret, and the
thing that needed it arrived without changing that.

## Tables

`usage` (claude) and `push_devices` + `push_queue` (push) exist, with row-level
security on and own-row policies. The push tables were applied as the
`push_devices_and_queue` migration; the SQL is `push.sql` in this directory and
is idempotent, so re-running it is safe.

## The scheduler

`pg_cron` 1.6.4 and `pg_net` 0.20.4 are installed (migration
`push_scheduler_extensions`). A job named `push` exists on `*/15 * * * *`,
owned by `postgres` — the resolution the app queues reminders at; finer gains
nothing, because a reminder is not a stopwatch.

**The job is `active = false`.** It is parked rather than absent on purpose:
everything about it is proven except the one thing that is not set yet.
Leaving it running would fail every fifteen minutes and fill
`cron.job_run_details` with an error meaning nothing except "the deploy is half
finished".

The bearer token is read out of Vault at run time rather than baked into the
job body, so rotating it is one update to one row and the schedule is not
touched. The secret was generated inside the database — it has never been
through a chat window, a log, or a tool call.

This was checked by making the call by hand, exactly as the job would:

    503 "not configured"

which is `push`'s own first branch. pg_net reaches the function, the URL is
right, the Vault read works. Only `CRON_SECRET` is missing.

### The tombstone sweep — in the file, not yet on the project

`scheduler.sql` now also schedules a second job, `tombstones`, weekly at
`17 4 * * 0`, calling `public.sweep_tombstones('90 days')`. It clears
soft-deleted rows from `notes`, `tasks`, `appointments`, `sittings` and
`courses` ninety days after the deletion. [`RETENTION.md`](../RETENTION.md)
carries the decision and what it costs — a device offline longer than ninety
days, still holding the row, syncs it back.

**It is in the file and has not been applied.** Nothing in this repository can
apply it; a schedule only exists once somebody runs the statement. Re-running
the whole of `scheduler.sql` is safe — every statement in it is idempotent and
`cron.schedule` replaces a job of the same name — or run just this one:

    select cron.schedule(
      'tombstones',
      '17 4 * * 0',
      $job$select public.sweep_tombstones('90 days')$job$
    );

Unlike `push` it wants **no** `cron.alter_job`, because it is parked on
nothing: the function it calls already exists and needs no secret. Confirm it
landed active, and that both jobs are there:

    select jobname, schedule, active from cron.job order by jobname;

Expect `push` inactive on `*/15 * * * *` and `tombstones` active on
`17 4 * * 0`. Afterwards, the first run is very likely to delete nothing and
that is correct rather than a failure — the oldest migration here is dated
September 2026, so on a project this young no tombstone is ninety days old
yet. What it returns is the row count:

    select jobname, status, return_message, start_time
    from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'tombstones')
    order by start_time desc limit 5;

## Security advisor

Nine of the ten findings are closed (migration
`harden_security_definer_helpers`). One is left and it is a dashboard toggle —
see below.

### What the revokes were not doing

`classmates.sql` ended each helper with `revoke all on function ... from
public`, which reads like it locks anon out. It never did. Supabase ships
default privileges granting EXECUTE on new functions in `public` to `anon`,
`authenticated` and `service_role`, so the grant to anon is *explicit* — and
revoking from the PUBLIC pseudo-role does not touch an explicit grant. The
revoke was aimed at the wrong grantee, so `/rest/v1/rpc/classmate`,
`/rpc/in_class` and `/rpc/verified_student` were callable by anyone holding
the publishable key for as long as they had existed.

`classmate` is the one that mattered: give it a user id and it answered
whether that person shares a class with you.

### What changed

- **`classmate`, `in_class`, `verified_student`** moved to a `private` schema.
  PostgREST publishes `public` and `graphql_public`, so the endpoints stopped
  existing. The seven RLS policies built on them followed automatically —
  a policy stores a function's OID, not its name, so not one was rewritten.
  Both roles keep EXECUTE on purpose: every one of those policies is `TO
  public`, so the expression is evaluated for anon too, and taking the
  privilege away would turn "you see nothing" into "the query errors".
- **`touch_updated_at`** had no `search_path` at all, so it resolved names
  against whatever the caller had set. Now `''`; its body calls only `now()`.
- **`touch_updated_at` and `rls_auto_enable`** lost their EXECUTE grants.
  Neither needs one: Postgres checks that privilege when a trigger is created,
  not each time it fires. This entry used to add that `rls_auto_enable` "is
  Supabase's own event-trigger function and is not defined anywhere in this
  repo, so only the live grant changed". The second half was true and the first
  half is why: Supabase's documentation offers the function and its `ensure_rls`
  trigger as a recipe to run yourself, under *Auto-enable RLS for new tables*,
  and somebody ran it here. `20260901000100_schema.sql` creates it now, so a
  rebuild gets the trigger and the revoke above has something to close.
- **`groups.sql`** got the same treatment ahead of time. It is not applied to
  the live project, and it had no grants at all — so its three helpers would
  have inherited the same default EXECUTE and appeared as three more
  endpoints. `group_room` is the one worth noticing: it answers "which class
  is group X in" for any id, an enumeration away from a map of who studies
  what.

Checked after, not assumed: every policy still evaluates for both `anon` and
`authenticated` without erroring, and both trigger functions still fire — an
event trigger enabling RLS on a fresh table, and a row trigger moving
`updated_at`.

### Performance

Every WARN is closed too (migrations `rls_initplan_and_policy_overlap` and
`wrap_auth_uid_in_helpers`), leaving eight INFO notices.

- **`auth.uid()` re-evaluated per row**, in fourteen policies. Written bare,
  the planner treats it as a per-row expression and re-runs it for every row
  scanned; wrapped in `(select ...)` it becomes an InitPlan, evaluated once
  before the scan. `explain` on `enrollments` now shows
  `Filter: (((InitPlan 1).col1 = user_id) OR private.classmate(user_id))`.
- **Two permissive policies on the same SELECT**, on `enrollments` and on
  `profiles`. Each carried a `for all` policy beside a `for select` one, and
  permissive policies are ORed — so reading evaluated
  `(uid = user_id) OR (uid = user_id OR classmate(user_id))`, whose left side
  is contained in its right. The `for all` contributed nothing to reading and
  cost a second pass over every row, including a second call into `classmate`.
  Split into the three commands they were actually for.

Checked against the real account rather than an empty table: it still sees its
four enrolments, its profile and its state row; a different signed-in user and
an anonymous one see none of them.

The five unindexed foreign keys are now covered (migration
`index_foreign_keys`): `blocks(blocked)`, `messages(user_id)`, and the three
on `reports`. Each is the foreign key column alone — the read paths were
already covered by `blocks_pkey` on (user_id, blocked) and `messages_by_room`
on (term, code, created_at desc), and neither of those leads with a foreign
key column, so a composite would have duplicated one of them.

What an unindexed foreign key costs is not the insert. It lands on the
*parent*: deleting a row in `auth.users` has to prove nothing still references
it, and without an index that proof is a sequential scan of the child table.
Deleting one account would have scanned every message ever posted — and it is
the operation nobody notices is slow, because it only becomes slow once there
is data, and then it is a timeout in a delete-my-account path rather than a
page somebody complained about.

Checked with `enable_seqscan = off`, which asks the narrow question that
matters on an empty table: is there an index path for the lookup a foreign key
check performs? All five answered with a Bitmap Index Scan on the new index.

**The count did not go down.** It was eight INFO notices before and it is
eight now: the five unindexed-key notices became five unused-index ones,
because an index nothing has queried yet reads to the linter as an index
nothing needs. That is the trade, and it is worth making in this direction —
an unindexed foreign key is a latent timeout, while an unused index on an
empty table is the linter correctly observing that the feature has not shipped
to anybody yet. Revisit after the classmates feature has real traffic; if any
of these are still unused with messages in the table, they are genuinely dead
and can go.

The remaining three:

- **Two unused indexes on the push tables** (`push_devices_user`,
  `push_queue_due`), for the same reason: the scheduler is parked.
- **Auth connection strategy** is a fixed 10 rather than a percentage, and it
  is the lowest-value item on this list. The database allows 60 connections on
  this tier, so Auth's 10 is already about a sixth of them — a sane share. The
  finding is about what happens *later*: resize the instance to a tier with
  more connections and Auth stays pinned at 10 instead of scaling with it. It
  is a no-op until that day.

  It is an Auth setting rather than SQL, so it cannot be changed from a
  migration or from the MCP tools — same wall as leaked password protection.
  The advisor's own remediation link is
  <https://supabase.com/docs/guides/deployment/going-into-prod>; the dashboard
  path is not recorded here because supabase.com is not reachable from the
  environment these notes were written in, and a guessed menu path is worse
  than none.

### The one that is left

**Leaked password protection** is off. It is an Auth setting rather than
anything in SQL, so it cannot be changed from a migration or from the MCP
tools — it needs the dashboard, under Authentication → Sign In / Providers.

It is worth turning on rather than dismissing: this app signs people in with
`signInWithPassword` and registers them with `signUp`, so students are
choosing passwords here, and a password reused from a breached site is the
realistic way in. The check is against HaveIBeenPwned at sign-up and
password-change time.

## What is left, in order

Three things, and none of them can be done from a coding session: two need
secrets that must not pass through one, and the third needs a GitHub Actions
API path that agent proxies block.

### 1. The shared Claude key

    supabase secrets set ANTHROPIC_API_KEY=sk-ant-…

Set it in the dashboard or with the CLI — **never** in this repo, in a build
variable, or in a chat window. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are injected by the platform and need no action.

Until it is set the function returns 501 and the app says so plainly: *"This
deployment has no shared key. Add your own under Ask Claude → Settings."* A
student with their own key is unaffected either way — the app prefers a key set
on the device and only falls back to this one.

Optional: `MONTHLY_CALL_LIMIT` (default 60 calls per account per month) and
`ALLOWED_ORIGIN` (default `*`).

**`ALLOWED_ORIGIN` is a comma-separated list, and setting it to one origin is
how this was broken for weeks.** It is read by `claude`, `fetchcal` and
`canvas` alike, so a wrong value takes out the shared key, the calendar-link
reader and the Canvas sync together. On 21 September 2026 it was found set to a
**localhost** address on the live project: all three were unreachable from the
deployed site while the functions were ACTIVE, the deployed code matched this
repository byte for byte, and every check was green.

It hides because a CORS refusal cannot be seen from either end. The browser
rejects the response before the page sees it, so the app can only say *"could
not reach"* — the same sentence it prints for a dead host — and the function's
own side shows a request that arrived and was answered. Nothing logs it.

So list every origin that must work, the deployed site **and** any dev server:

    supabase secrets set ALLOWED_ORIGIN=https://<user>.github.io,http://localhost:5173

The header echoes back whichever entry the request came from, so both work at
once rather than one silently breaking the other. No trailing slashes — though
`supabase/functions/_shared/cors.ts` trims them, because the address bar adds
one and that is the mistake this is most likely to meet. After changing it,
press **Check the shared key works** on Settings → The assistant from the
deployed site; that is the one place the answer is real.

### 2. Reminder keys

The VAPID pair has to be generated where you can keep the private half:

    npx web-push generate-vapid-keys        # once; keep both halves

Then, on Supabase:

    supabase secrets set VAPID_PUBLIC_KEY=…
    supabase secrets set VAPID_PRIVATE_KEY=…
    supabase secrets set VAPID_SUBJECT=mailto:you@example.com

And `CRON_SECRET`, which already exists — read it out of Vault in the SQL
editor and paste it in:

    select decrypted_secret from vault.decrypted_secrets
    where name = 'push_cron_secret';

    supabase secrets set CRON_SECRET=<that value>

It must match exactly. The job sends it as a bearer token and `push` compares
the whole string; a trailing newline from a careless copy is a 401 every
fifteen minutes.

The **public** half of the VAPID pair also has to reach the browser, or the app
cannot subscribe a device at all: set `VITE_VAPID_PUBLIC_KEY` as a repository
variable and rebuild. The Pages workflow already reads it and says so in the
build log either way. The private half never leaves Supabase.

### 3. Turn the job on

Only after `CRON_SECRET` is set, or it will 503 every fifteen minutes:

    select cron.alter_job(
      (select jobid from cron.job where jobname = 'push'),
      active := true
    );

`update cron.job set active = true` does not work — the table is not writable
directly, even as `postgres`. `cron.alter_job` is the supported path.

## Checking it worked

The app is the honest test, because it is the only caller.

- **claude** — sign in, open the assistant, ask something. Under Ask Claude the
  route line should read *the shared key*. A 501 means step 1 is not done; a
  429 means that account has spent its month.
- **push** — turn reminders on under Me → Alerts, which writes a row to
  `push_devices`. A row appearing in `push_queue` and disappearing within
  fifteen minutes means the whole chain works.

To watch the scheduler directly:

    select status, return_message, start_time
    from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'push')
    order by start_time desc limit 10;

    select id, status_code, left(content, 200), created
    from net._http_response order by id desc limit 10;

A `status_code` of 200 is the whole chain working. 503 means a secret is
missing on the function; 401 means `CRON_SECRET` does not match what is in
Vault.

## Rotating the cron secret

One row, and the schedule is untouched:

    select vault.update_secret(
      (select id from vault.secrets where name = 'push_cron_secret'),
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'push_cron_secret',
      null,
      null
    );

Then read it back with the query in step 2 and set `CRON_SECRET` to the new
value. Between those two the job gets 401s, so do them together.
