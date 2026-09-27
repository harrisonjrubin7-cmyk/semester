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


-- ── Clearing out old tombstones ───────────────────────────────────────────
--
-- `public.sweep_tombstones` has existed since `20260901000700_records.sql`
-- and until now nothing called it. Its own header says why it was left that
-- way — *"an automatic job that deletes rows is not something this file
-- should switch on without you having read this paragraph"* — and the
-- paragraph has been read: ninety days is far longer than any device is
-- plausibly offline, and short enough that the tables do not accumulate a
-- term of deletions.
--
-- **The tradeoff this makes, stated rather than buried.** A tombstone is what
-- stops a deletion being resurrected by a device that was offline when it
-- happened. Deleting one after ninety days means a device offline for longer
-- than that, still holding the row, would sync it back as though it were new.
-- That is the cost of not keeping every deletion for the life of the account,
-- and ninety days is where `records.sql` put the line.
--
-- Here rather than in the migration, because a file that runs on every deploy
-- is the wrong place for a decision somebody has to take once. `RETENTION.md`
-- is the record of it, and `app/src/lib/retention.test.ts` holds this file and
-- that document to the same number.
--
-- **Active, unlike `push` above.** That job is parked because it calls an Edge
-- Function that answers 503 until `CRON_SECRET` is set, so an unparked one
-- would fail every fifteen minutes about a half-finished deploy. This calls a
-- function that is already there and needs no secret, so there is nothing to
-- wait for.
--
-- Weekly rather than nightly: the work is proportional to deletions, not to
-- the size of the tables, and a sweep that runs seven times as often deletes
-- the same rows seven days sooner for no benefit anybody can see. 04:17 UTC on
-- Sunday is deliberately off `push`'s `*/15` cadence so the two are not
-- contending, and the odd minute is so that a project restoring from backup
-- does not start every job on the hour.
--
-- Runs as whoever applies this file, which in the SQL editor is `postgres`.
-- `sweep_tombstones` is `security invoker`, so the deletes run with that
-- role's privileges and reach every account — which is what a sweep is. It is
-- revoked from `public`, `anon` and `authenticated`, and this does not change
-- that: the owner's own EXECUTE is what a revoke from PUBLIC leaves alone.
--
-- `cron.schedule` replaces a job of the same name, so this is safe to re-run.
select cron.schedule(
  'tombstones',
  '17 4 * * 0',
  $job$select public.sweep_tombstones('90 days')$job$
);

-- AI provider reservations expire after five minutes inside the budget
-- functions, so a crashed request cannot hold a tenant budget indefinitely.
-- This daily job physically removes expired runtime metadata after each
-- tenant's approved AI retention window; it never touches source content.
select cron.schedule(
  'ai-runtime-metadata',
  '43 4 * * *',
  $job$select private.sweep_ai_runtime_metadata()$job$
);

-- Durable institutional action and AI-confirmation state has conservative
-- retention rules in gateway_purge_journal(). Run hourly, off the hour, and
-- record the successful sweep so `/health/ready` can fail closed if this job
-- is missing or stalled. Uncertain, pending and processing university actions
-- are never age-purged.
select cron.schedule(
  'institution-gateway-retention',
  '11 * * * *',
  $job$select public.gateway_purge_journal()$job$
);

-- Community Trust & Safety evidence. Daily: closed cases past their
-- retain_until (90 days after a no-action close, a year after enforcement or
-- an appeal), the reports and removed posts they were keeping, restrictions
-- ninety days after they ended, and study sessions thirty days after they
-- ended. Open and appealed cases are never swept. Each run writes a row to
-- community_retention_runs. See RETENTION.md and 20260928030000_community.sql.
select cron.schedule(
  'community-retention',
  '29 4 * * *',
  $job$select private.sweep_community_retention()$job$
);


-- ── Escalation delivery ───────────────────────────────────────────────────
--
-- Sends an approved Community escalation to the university that agreed to
-- receive it. The adapter is supabase/functions/_shared/escalation.ts, and it
-- is not deployed: docs/CAMPUS-ESCALATION-POLICY.md has the steps, and they
-- start with a signed agreement. So the job is created parked, the way `push`
-- was, and the secret it will send is its own — not push_cron_secret, so the
-- reminder sender's key can never call the one function that sends cases out.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'escalation_cron_secret') then
    perform vault.create_secret(
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'escalation_cron_secret',
      'Bearer token the escalation-delivery job sends to the escalate Edge Function. Must equal its ESCALATION_CRON_SECRET.',
      null
    );
  end if;
end $$;

select cron.schedule(
  'escalation-delivery',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/escalate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'escalation_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

-- Parked: the function does not exist until somebody deploys it on purpose.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'escalation-delivery'),
  active := false
);

-- ── Community media scan ─────────────────────────────────────────────────
--
-- Scans uploaded Community images and deletes the files of rows that are
-- gone. The scanner is supabase/functions/_shared/mediascan.ts, not deployed:
-- docs/COMMUNITY-MEDIA-SAFETY.md has the steps, and they start with a
-- known-abuse hash provider and legal sign-off. Parked, with a secret of its
-- own for the same reason as escalation-delivery's.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'media_scan_cron_secret') then
    perform vault.create_secret(
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'media_scan_cron_secret',
      'Bearer token the media-scan job sends to the media-scan Edge Function. Must equal its MEDIA_SCAN_CRON_SECRET.',
      null
    );
  end if;
end $$;

select cron.schedule(
  'media-scan',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/media-scan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'media_scan_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

-- Parked: the function does not exist until somebody deploys it on purpose.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'media-scan'),
  active := false
);

-- ── Integrations: the retention sweep ─────────────────────────────────────
--
-- `public.integration_retention_sweep()` (20260927200000_integration_hardening)
-- removes old sync runs and errors (180 days), processed events (30), resolved
-- dead letters (90), expired snapshots, and references the source deleted more
-- than thirty days ago — never anything on a connection under legal hold. The
-- numbers are `RETENTION.md`'s, decided there; this only runs it.
--
-- **Active**, like `tombstones`: it needs no secret and no endpoint. It visits
-- only schools that have a connection, so until one is configured it deletes
-- nothing and writes nothing. Each school it visits gets one
-- `integration_retention_runs` row, which its integration staff can read.
--
-- Daily at 03:29 UTC, off every other job's minute.
select cron.schedule(
  'integration-retention',
  '29 3 * * *',
  $job$select public.integration_retention_sweep()$job$
);

-- ── Integrations: the sync tick ───────────────────────────────────────────
--
-- Every fifteen minutes, pg_net calls the Vercel function
-- `app/api/integration/tick.ts`, which pulls each approved connection that is
-- due (`app/server/integration/tick.ts`) and runs any replay an operator has
-- requested. `TICK_MINUTES` there must agree with this cadence. Offset seven
-- minutes from `push` so the two are never in flight together.
--
-- Two values, both in Vault so that neither is baked into this file:
--
--   * `integration_cron_secret`, generated below like `push_cron_secret`. The
--     function's `INTEGRATION_CRON_SECRET` environment variable must equal it.
--   * `integration_tick_url`, the deployment's full URL for the function —
--     `https://<production host>/api/integration/tick`. Created by the
--     operator when unparking (INTEGRATION-OPERATOR-RUNBOOK.md §4), because
--     the production host is not recorded anywhere in this repository.
--
-- Nothing runs even when unparked until an adapter is registered in
-- `app/server/integration/registry.ts`, which is empty; each tick then answers
-- with every connection skipped as unregistered.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'integration_cron_secret') then
    perform vault.create_secret(
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'integration_cron_secret',
      'Bearer token the integration-sync pg_cron job sends to /api/integration/tick. Must equal the Vercel function''s INTEGRATION_CRON_SECRET.',
      null
    );
  end if;
end $$;

select cron.schedule(
  'integration-sync',
  '7,22,37,52 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'integration_tick_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'integration_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);

-- Parked, for the reason `push` is: until the function has its secret and
-- Vault has its URL, every run would fail about a half-finished deploy.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'integration-sync'),
  active := false
);
