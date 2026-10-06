# Integration operator runbook

For the people who run Semester's integrations for a school: onboarding a system, keeping it healthy, stopping it
in an incident, and answering a student or a lawyer. Every step names the function or table it uses; every change
here is audited by the database (`tenant_policy_audit_event`) unless it says otherwise.

Roles, from `docs/INTEGRATION-PERMISSION-MATRIX.md`:

| Who | Holds | Does |
| --- | --- | --- |
| Integration admin (school) | `integration:view`, `:configure`, `:sync`, `:replay` | configures, pauses, requests replays |
| University admin (school) | `integration:view`, `:approve`, `killswitch:engage`, `tenant:configure` | approves connections and scopes, sets flags, engages the school's switches |
| Incident responder (global) | `killswitch:engage` over the platform | engages global switches |
| Operator with the service role | — | binds LTI registrations, runs the worker and the sweep, sets legal holds |

The service role bypasses row-level security. Nothing in a browser has it; only the worker, scheduled jobs and an
operator's shell do.

## 1. Onboard a connection

1. **Integration admin** adds the connection (born `disconnected`), naming the provider, the domain and a credential
   *reference* — `vault:…`, `env:…` or `secret-manager:…`. The secret itself goes in the secret manager, never in
   Semester.
2. **Integration admin** proposes each scope with its purpose. Minimum data: the database refuses grades, rosters,
   submissions, accommodations, health, counseling, conduct and aid by name.
3. **University admin** (not the owner) approves: `integration_approve_connection(public_id, 'read')` then
   `integration_approve_scope(scope_id)` per scope. The connection moves to `configuring`.
4. **University admin** sets the connector flag and any scope flags to `production` in `tenant_feature_policy`.
5. Students whose personal records the connection reads must consent (`consent_record`, capability
   `integration:<public id>`); until they do, their records are refused with `consent_block`.
6. **Operator** runs a first sync (§4). A successful run moves the connection to `healthy`.

## 2. Bind an LMS (LTI) registration

See `ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md`, D-1, for the SQL. The rule that matters: if the school relies on
grade passback, set `integration.lms_lti` and `writeback.lms_grade_passback` to `production` and approve
`scope.lms.score_publish` **before** binding, or passback stops at the moment of binding.

## 3. Watch

`select * from public.integration_health();` (service role) lists every non-disconnected connection with minutes since
its last success, whether it is **stale** (live, approved, and more than twice its freshness target since a success),
its open errors and open dead letters. Alert on:

- `stale = true` for more than one check;
- `status = 'error'`;
- `open_dead_letters > 0` for more than a day.

The school dashboard (University → Integrations) shows the same per school, and its **Export health summary** gives
counts and states only. Platform operators use **Operations console → Integration health**. That workspace derives
its schools from the operator's live, exact-school `integration:view` grants and returns only configuration state,
freshness, run/reconciliation counts, owners, cautious customer impact and a next safe action. Credentials, tokens,
cursors, payload references, external record references and provider messages do not cross that RPC boundary. Production
never includes demo tenants; staging and demo require explicit inclusion and an exact-school `tenant:implement` grant.

### Request a configuration change from the console

The Integration health workspace never edits a connector. **Request configuration approval** creates an
`integration-config` approval against the connection's public id and exact tenant. Choose the bounded change kind and
enter only opaque references for the institution's written approval, rollback/fallback plan and change ticket, plus the
credential-expiry date. Never paste a credential, token or secret. This is a two-person request; approval and execution
remain separate.

Before execution, confirm the requested provider domain and data scope, the provider-side fallback, and the credential
reference's expiry. After execution, run one bounded sync and verify the declared freshness, reconciliation state and
exception counts in Integration health. If verification fails, stop writes, restore the prior credential reference or
connector state according to the cited rollback plan, keep the incident/ticket open, and do not replay while an open
dead letter or unresolved cause remains. The health row and approval status are evidence of current state, not proof of
institutional sign-off or successful deployment.

## 4. Run a sync

`runSync(serviceClient, { connectionPublicId, adapter, trigger, fetchBatch, attempt })` in
`app/server/integration/worker.ts`. It refuses unless the adapter validates and matches the connection's domain, the
connection is approved and not paused or disconnected, the adapter's connector flag is `production` for the school, and
no global, school or connection kill switch is engaged. It
reads only scopes approved and unexpired now, resolves people only through **active** SCIM memberships, records every
batch as an event (a redelivered key is ingested once; a batch that failed for a retryable reason, such as a save that did not land, releases its key so the retry is
ingested), writes references with their display values, and moves the
connection to `healthy`, `degraded` or `error` by the outcome.

A provider failure is retried with back-off; after the fifth attempt (or at once for a permanent error) it becomes a
dead letter.

### On a schedule

`supabase/scheduler.sql` holds two integration jobs:

| Job | When | Does | State |
| --- | --- | --- | --- |
| `integration-retention` | daily 03:29 UTC | `integration_retention_sweep()` (§8) | active |
| `integration-sync` | :07, :22, :37, :52 | POSTs to the `integration-tick` Edge Function | active since 28 Sept |

The tick (`app/server/integration/tick.ts`) first runs replays an operator requested (§5). It then runs `runSync` for each
connection that meets all of these:

- approved and not paused or disconnected;
- pulled rather than pushed (`sync_mode` of `incremental_api` or `batch`);
- has an adapter registered in `app/server/integration/registry.ts`;
- not attempted within half its freshness target, or within fifteen minutes when it is in `error`. The target is the
  connection's own `freshness_target` when it has one, which is also what the dashboard and `integration_health()`
  measure. Otherwise it is the adapter's.

A connection holding an open dead letter is **not** retried on schedule; it waits for a replay. If the tick cannot read
whether a connection is held, it pulls nothing on schedule that tick. Failures are counted whatever the status, so a
connection still `configuring` also dead-letters on its fifth. Replays are capped per connection, not per request, so
one connection's many requests cannot crowd out another's. Every other rule is
still `runSync`'s. The registry is empty, so until an adapter is added a tick runs nothing and reports every
connection as unregistered.

**Unparking `integration-sync`** (done 28 September 2026; kept in case it is ever parked again). The function and the token check both deploy on merge, and the token lives only in
Vault, so there is nothing to set by hand. Before unparking, confirm the function answers the job's own request —
this sends exactly what the job sends:

```sql
select net.http_post(
  url := 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/integration-tick',
  headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
    'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'integration_cron_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 60000);
-- then, a few seconds later:
select status_code, content from net._http_response order by created desc limit 1;
```

A 200 with a JSON body of counts means it is ready: `select cron.alter_job((select jobid from cron.job where jobname =
'integration-sync'), active := true);`. A 401 means the token check refused the Vault token; a 503 means the function
cannot reach its token check (`public.integration_tick_authorized`, from `20260928101000_integration_tick_auth.sql`).

Watch it in `cron.job_run_details` and `net._http_response`. Re-running `scheduler.sql` parks the job again, as it does
`push`. To rotate the token, update the `integration_cron_secret` row in Vault; the next tick uses the new value on
both ends.

After a full pull, reconcile: `reconcile(serviceClient, { connectionPublicId, adapter, canonicalEntity, providerIds,
runId })` marks what the source deleted (values cleared, row kept 30 days as evidence) and warns about what the
source has that Semester does not.

## 5. Pause, resume, replay

- **Pause** (integration admin): `integration_set_paused(public_id, true, reason)`. The worker refuses a paused
  connection; the LTI gate refuses passback on one.
- **Resume**: `integration_set_paused(public_id, false, reason)` → `configuring`, never straight to `healthy`.
- **Replay** a dead letter (integration admin): `integration_request_replay(id, reason)`. This *requests*; the worker
  picks up rows with `replay_requested_at` set and runs them with `trigger: 'replay'`. Refused under
  `kill.integration_sync`.
  - The next scheduled tick runs it as a fresh pull from the connection's cursor. A failed pull's payload was never
    stored, only its hash.
  - A run that does not fail resolves every open letter on that connection.
  - A run that fails again withdraws the request. The letter stays open until it is requested again.

## 6. Incident: stop everything

1. **Engage** the narrowest switch that covers it (`feature_kill_switch`, reason required):
   one connection `kill.connection.<public id>` → one school's `kill.integration_sync` → global (incident responder).
   `kill.writeback` stops grade passback and every future write-back; `kill.ai_generation`, `kill.data_upload`,
   `kill.code_execution`, `kill.sharing` stop their features.
2. **Confirm**: `integration_health()`; the dashboard shows a banner; a worker run returns `kill switch engaged`.
3. **Release** when fixed. Connections come back through `configuring`.

## 7. A student asks

- **"What do you have about me?"** — Privacy → *What your school shares with Semester* lists it by kind, with source,
  purpose and freshness.
- **"Delete it."** — the same panel deletes their references per kind, immediately.
- **"Stop reading my records."** — Revoke on the same panel. The next sync refuses their personal records with
  `consent_block`. Deleting and revoking are separate on purpose, and the panel says so.
- **Account deletion** — references and consent go with the account (`OWNED_TABLES`, and by cascade).

## 8. Retention and legal hold

`select * from public.integration_retention_sweep();` (service role; the `integration-retention` job runs it daily at 03:29 UTC) removes, per school:
sync runs and errors older than 180 days, events processed more than 30 days ago, dead letters resolved more than 90
days ago, snapshots past their expiry, and references the source deleted more than 30 days ago. It writes one
`integration_retention_runs` row per school, which the school's integration staff can read.

**Idempotency window.** An event key is remembered for 30 days after it is processed. A provider that redelivers an
older event will have it ingested again; the timestamp-regression check stops an older version overwriting a newer one.

**Legal hold** (service role, on written instruction):

```sql
update public.integration_connections
   set legal_hold = true, legal_hold_reason = '<matter reference>'
 where public_id = '<public id>';
```

While held, the sweep removes nothing belonging to that connection and records how many connections it held. A hold
needs its reason. Release by setting `legal_hold = false` once counsel confirms.

## 9. Disconnect

1. Pause (§5), then revoke the credential in the secret manager and at the provider.
2. Set the connector flag to `off`.
3. The worker refuses a `disconnected` connection; existing references stay, labelled with their last freshness, until
   the student deletes them or the connection is removed. Removing the connection cascades its scopes, mappings,
   runs, errors, events and dead letters; references keep their provenance with `connection_id` cleared.
