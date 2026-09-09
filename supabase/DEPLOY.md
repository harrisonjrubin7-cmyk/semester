# Deploying the backend

Edge Functions, the SQL they read, and a scheduler. No function needs the app
redeployed — the browser calls them by URL — but none does anything useful
until its secrets are set, and each fails *closed* rather than open when they
are missing.

## What is live

    claude   ACTIVE, v1, verify_jwt off
    push     ACTIVE, v1, verify_jwt off

## Not deployed yet: `fetchcal`

    supabase functions deploy fetchcal

`supabase/functions/fetchcal/index.ts`. It reads **one pasted calendar link**
on behalf of a signed-in device — the Connect screen's *Subscribe* button.

Why it has to exist at all: a calendar server sends no CORS headers, so the
browser is refused before the request leaves. The dev server forwards that one
request itself (`/feed?url=` in `app/vite.config.ts`), which is why pasting a
Brightspace or Outlook link works on a laptop running `npm run dev` and, until
this is deployed, fails on the built app.

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

Until it is deployed the app degrades rather than breaks — links from hosts
that do allow the browser still work, the screen says what failed, and adding a
downloaded `.ics` needs no network at all.

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
  not each time it fires. `rls_auto_enable` is Supabase's own event-trigger
  function and is not defined anywhere in this repo, so only the live grant
  changed.
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
`ALLOWED_ORIGIN` (default `*` — worth setting to the Pages origin).

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
