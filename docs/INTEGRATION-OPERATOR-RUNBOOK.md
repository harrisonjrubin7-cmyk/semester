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

The dashboard (University → Integrations) shows the same per school, and its **Export health summary** gives counts
and states only.

## 4. Run a sync

`runSync(serviceClient, { connectionPublicId, adapter, trigger, fetchBatch, attempt })` in
`app/server/integration/worker.ts`. It refuses unless the adapter validates and matches the connection's domain, the
connection is approved and not paused or disconnected, the adapter's connector flag is `production` for the school, and
no global, school or connection kill switch is engaged. It
reads only scopes approved and unexpired now, resolves people only through **active** SCIM memberships, records every
batch as an event (a redelivered key is ingested once; a batch that failed to save releases its key so the retry is
ingested), writes references with their display values, and moves the
connection to `healthy`, `degraded` or `error` by the outcome.

A provider failure is retried with back-off; after the fifth attempt (or at once for a permanent error) it becomes a
dead letter.

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

`select * from public.integration_retention_sweep();` (service role, daily) removes, per school:
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
