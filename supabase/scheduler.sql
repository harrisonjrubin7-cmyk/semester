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

-- ── Support reply email outbox ───────────────────────────────────────────
--
-- A reply commits its generic email-notice intent to
-- `support_notification_outbox` in the same transaction. The browser asks
-- for an immediate delivery, while this one-minute worker recovers a
-- browser crash, lost connection or provider refusal. Resend's idempotency
-- key is the message id, so overlapping immediate and scheduled attempts do
-- not produce two notices. The existing first-party sender secret is reused;
-- support-reply-notify accepts it only through CRON_SECRET.
select cron.schedule(
  'support-reply-notify',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/support-reply-notify',
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

-- Parked until the function deployment and all sender/secret configuration
-- are verified. Production activation is a separate, visible release step.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'support-reply-notify'),
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
  $job$select private.run_sweep('ai_runtime_metadata')$job$
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
-- community_retention_runs. See RETENTION.md and 20260928032000_community.sql.
select cron.schedule(
  'community-retention',
  '29 4 * * *',
  $job$select private.run_sweep('community_retention')$job$
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
-- Every fifteen minutes, pg_net calls the `integration-tick` Edge Function,
-- which pulls each approved connection that is due
-- (`app/server/integration/tick.ts`) and runs any replay an operator has
-- requested. `TICK_MINUTES` there must agree with this cadence. Offset seven
-- minutes from `push` so the two are never in flight together.
--
-- The bearer token is `integration_cron_secret`, generated below like
-- `push_cron_secret`. Unlike `push` it is not also set on the function: the
-- function asks the database whether a token matches
-- (`public.integration_tick_authorized`), so Vault is its only home and
-- rotating it is one update to one row.
--
-- Nothing runs until an adapter is registered in
-- `app/server/integration/registry.ts`, which is empty; each tick then answers
-- with every connection skipped as unregistered.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'integration_cron_secret') then
    perform vault.create_secret(
      translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'),
      'integration_cron_secret',
      'Bearer token the integration-sync pg_cron job sends to the integration-tick Edge Function, which checks it against this row.',
      null
    );
  end if;
end $$;

select cron.schedule(
  'integration-sync',
  '7,22,37,52 * * * *',
  $job$
    select net.http_post(
      url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/integration-tick',
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

-- **Active** since 28 September 2026. It was parked until the function was
-- deployed and the token check existed; the runbook's test request
-- (INTEGRATION-OPERATOR-RUNBOOK.md §4) then answered 200 with every count zero
-- and the job was unparked. Stated here so re-running this file keeps it on
-- rather than parking it again. In an incident, stop syncs with the kill
-- switches (runbook §6) rather than by parking the job.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'integration-sync'),
  active := true
);

-- ── Housekeeping the code was already waiting for ─────────────────────────
--
-- Three functions were written to be called on a schedule and never were.
-- Each says so in its own migration: `sweep_lti_nonce()` is "called from the
-- same place the rest of this project's housekeeping is called from", and
-- that place is this file, which did not call it; `sweep_lti_link_ticket()` is
-- its twin; `expire_capture_assets()` is "run by the deployment retention
-- worker", and there is no such worker. `app/src/lib/scheduler.test.ts` now
-- fails when a sweep function exists in the migrations and no job here calls
-- it, which is how these three were found.
--
-- **Active**, like `tombstones`: none needs a secret or an endpoint, and each
-- removes only what its own function already refuses to use.
--
-- The two LTI sweeps delete launch state and link tickets an hour past
-- expiry — minutes-old rows that name nobody. Hourly, at minutes no other job
-- uses.
select cron.schedule(
  'lti-nonce',
  '41 * * * *',
  $job$select public.sweep_lti_nonce()$job$
);

select cron.schedule(
  'lti-link-ticket',
  '47 * * * *',
  $job$select public.sweep_lti_link_ticket()$job$
);

-- Marks capture originals `removed` (and their segments and derived artifacts
-- `withdrawn`) once their retention date passes or their consent is withdrawn
-- or expires. Row-level security already hides such a capture from its owner;
-- this makes the state say so for every other reader too. It does **not**
-- delete the storage object a `storage_key` names — the function's own comment
-- says that needs a worker with storage access, and none exists yet.
-- RETENTION.md says so beside the row.
select cron.schedule(
  'capture-expiry',
  '19 * * * *',
  $job$select private.expire_capture_assets()$job$
);

-- ── Retention decided in 20260929030000_retention_sweeps.sql ──────────────
--
-- RETENTION.md has the reasons; these run them, daily, in the quiet hour
-- after the other retention jobs and a few minutes apart.
--
--   invite-retention    invitations never taken up, 90 days after sending
--   abandoned-signups   accounts never confirmed and never signed in, 30 days
--                       after creation. Accounts that were ever used are kept.
--   audit-retention     role-grant, moderation and provisioning audit events
--                       after 3 years. Never support_access_event (FERPA).
select cron.schedule(
  'invite-retention',
  '13 5 * * *',
  $job$select private.sweep_stale_invites()$job$
);

select cron.schedule(
  'abandoned-signups',
  '23 5 * * *',
  $job$select private.sweep_abandoned_signups()$job$
);

select cron.schedule(
  'audit-retention',
  '33 5 * * *',
  $job$select private.sweep_audit_retention()$job$
);

-- ── The console audit chain: seal yesterday, verify everything ────────────
--
-- `private.console_audit_event` (20260929100000_console_control_plane.sql)
-- is the operations console's append-only, hash-chained archive. Two things
-- have to happen to it every night and neither is a sweep: nothing is ever
-- removed from that table, and `audit-retention` above does not name it.
--
--   seal    `private.console_audit_seal()` writes yesterday's manifest —
--           first and last seq, the count, the head hash — HMAC-signed with
--           a key no API role can read. A day is sealed once; sealing it
--           again with different rows raises, which is the finding.
--   verify  `private.console_audit_verify()` recomputes every hash and every
--           link in the chain and re-checks every manifest's signature, and
--           records the result where `public.console_audit_status()` shows it.
--
-- Both run as the owner of the functions. 03:23 UTC is a few minutes before
-- `integration-retention` and clear of every other job's minute. **Active**:
-- nothing needs a secret or an endpoint, and an empty chain verifies in an
-- instant.
select cron.schedule(
  'console-audit-integrity',
  '23 3 * * *',
  $job$select private.console_audit_seal(); select private.console_audit_verify();$job$
);

-- ── The academic-record and student-account ledger chains ─────────────────
--
-- The same two nightly things for the two ledgers that hold the most
-- (20260930150000_ledger_chain_seals.sql): `private.ledger_chain_nightly()`
-- seals yesterday's links into an HMAC-signed manifest per ledger and school,
-- then walks every chain with the link check and the seal check and records
-- the run in `private.ledger_chain_verification`. Nothing is ever removed, so
-- `audit-retention` does not name these tables and must not. 03:27 UTC, four
-- minutes after the console's. **Active**: no secret and no endpoint, and with
-- no chains it verifies nothing and says so.
select cron.schedule(
  'ledger-chain-integrity',
  '27 3 * * *',
  $job$select private.ledger_chain_nightly()$job$
);

-- ── Commercial: the dunning worker ────────────────────────────────────────
--
-- `public.run_dunning()` (20260929080000_commercial_automation.sql) works every
-- open dunning case: a reminder after three quiet days, one final notice with
-- the exact restriction date three days before grace ends, and at grace end
-- the case is restricted and the subscription's paid entitlements removed. It
-- never touches a student's data, export or deletion.
--
-- **Active**, like `tombstones`: it needs no secret and no endpoint, and until
-- a payment fails there is no open case, so it writes nothing. Hourly, at
-- minute 23, off every other job's minute.
select cron.schedule(
  'commercial-dunning',
  '23 * * * *',
  $job$select public.run_dunning()$job$
);

-- ── Commercial: financial retention ───────────────────────────────────────
--
-- `public.purge_financial_records()` (20260929130000_financial_retention.sql)
-- removes an individual subscriber's finished payment records seven years
-- after the end of the year they were made (D-132). Nothing is eligible before
-- 1 January 2034, so for years it removes nothing; it runs anyway, so the
-- promise is kept by a job that has been running rather than one written the
-- week it first matters. **Active**: no secret, no endpoint. Monthly, on the
-- 2nd at 04:37, off every other job's minute.
select cron.schedule(
  'commercial-financial-retention',
  '37 4 2 * *',
  $job$select * from public.purge_financial_records()$job$
);

-- ── Commercial: account health ────────────────────────────────────────────
--
-- `public.compute_account_health()` writes one snapshot per institutional
-- billing account per day, from account-level signals only, each with a
-- reason and a next action. Anything not healthy is written `pending_review`:
-- a person reads it before it drives any outreach. Nightly at 05:41 UTC.
select cron.schedule(
  'account-health',
  '41 5 * * *',
  $job$select public.compute_account_health()$job$
);
