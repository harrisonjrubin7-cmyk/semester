# Deploying the backend

Two Edge Functions, the SQL they read, and a scheduler. Neither function needs
the app redeployed — the browser calls them by URL — but neither does anything
useful until its secrets are set, and both fail *closed* rather than open when
they are missing.

## What is live

    claude   ACTIVE, v1, verify_jwt off
    push     ACTIVE, v1, verify_jwt off

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
