-- The reminder scheduler: extensions, the shared secret, and the job.
--
-- Applied to the live project already. Kept here so the state is reproducible
-- rather than existing only as something somebody once typed into a SQL
-- editor — a scheduled job nobody can rebuild is the part of a deploy that
-- quietly stops working and takes a week to notice.
--
-- Idempotent: re-running it will not make a second job or a second secret.
--
-- The one thing it cannot do is set `CRON_SECRET` on the `push` function.
-- That is an Edge Function environment variable and has to be set from the
-- dashboard or the CLI. See DEPLOY.md.

-- ── Extensions ────────────────────────────────────────────────────────────
--
-- pg_cron runs the job; pg_net makes the outbound call. Supabase pins pg_cron
-- into pg_catalog whatever schema is asked for, which is expected.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ── The shared secret ─────────────────────────────────────────────────────
--
-- In Vault rather than a database setting: `alter database ... set` needs a
-- privilege the pooled roles do not have, and Vault is the better home anyway
-- — encrypted at rest, and behind a view `anon` and `authenticated` cannot
-- reach.
--
-- Generated here rather than passed in, so the value never travels through a
-- shell history, a log or a chat window on its way into the database. It is
-- read back out exactly once, by whoever sets CRON_SECRET on the function.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_cron_secret') then
    perform vault.create_secret(
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'push_cron_secret',
      'Shared secret the pg_cron job sends to the push Edge Function as a bearer token. Must equal the function''s CRON_SECRET.',
      null
    );
  end if;
end $$;

-- ── The job ───────────────────────────────────────────────────────────────
--
-- Every fifteen minutes, which is the resolution the app queues reminders at.
-- Finer gains nothing: a reminder is not a stopwatch.
--
-- The token is read from Vault at run time rather than baked into the body,
-- so rotating it is one update to one row and this schedule is not touched.
--
-- `cron.schedule` replaces a job of the same name, so this is safe to re-run.
select cron.schedule(
  'push',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $job$
);

-- Parked until the function knows the secret.
--
-- `push` returns 503 to everything while CRON_SECRET is unset, so an active
-- job would fail every fifteen minutes and fill cron.job_run_details with an
-- error meaning nothing except "the deploy is half finished".
--
-- Note `cron.alter_job` rather than `update cron.job set active = ...`: the
-- table is not writable directly, even as postgres.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'push'),
  active := false
);
