# Deploying the backend

Two Edge Functions and the SQL they read. Neither function needs the app
redeployed — the browser calls them by URL — but neither does anything useful
until its secrets are set, and both fail *closed* rather than open when they
are missing.

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

## What is left, in order

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

    npx web-push generate-vapid-keys        # once; keep both halves
    supabase secrets set VAPID_PUBLIC_KEY=…
    supabase secrets set VAPID_PRIVATE_KEY=…
    supabase secrets set VAPID_SUBJECT=mailto:you@example.com
    supabase secrets set CRON_SECRET=…      # any long random string

The **public** half also has to reach the browser, or the app cannot subscribe
a device at all: set `VITE_VAPID_PUBLIC_KEY` as a repository variable and
rebuild. The Pages workflow already reads it, and says so in the build log when
it is absent. The private half never leaves Supabase.

### 3. The schedule

`pg_cron` and `pg_net` are available on the project but **not installed**, so
nothing is calling `push` yet. Do this after `CRON_SECRET` exists — a job
created before it would hit a 503 every fifteen minutes.

    create extension if not exists pg_cron;
    create extension if not exists pg_net;

    select cron.schedule('push', '*/15 * * * *', $$
      select net.http_post(
        url := 'https://<project>.functions.supabase.co/push',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.cron_secret'))
      );
    $$);

Fifteen minutes matches the resolution the app queues at; finer gains nothing.

## Checking it worked

The app is the honest test, because it is the only caller.

- **claude** — sign in, open the assistant, ask something. Under Ask Claude the
  route line should read *the shared key*. A 501 means step 1 is not done; a
  429 means that account has spent its month.
- **push** — turn reminders on under Me → Alerts, which writes a row to
  `push_devices`. A row appearing in `push_queue` and disappearing within
  fifteen minutes means the whole chain works.
