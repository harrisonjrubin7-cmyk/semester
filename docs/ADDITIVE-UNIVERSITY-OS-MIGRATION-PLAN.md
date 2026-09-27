# Additive University OS — migration plan

Status, 27 September 2026. This is the plan for the "Additive University OS, Integration Gateway, Sync Audit,
and Tenant Feature Flags" command, and the record of what the first change set built. Read with
[`UNIVERSITY-OS-ARCHITECTURE.md`](UNIVERSITY-OS-ARCHITECTURE.md) and
[`UNIVERSITY_CONNECTIONS.md`](UNIVERSITY_CONNECTIONS.md), which remains the record of what is connected.

## The rule

Nothing existing is removed, renamed, reset or loosened. Every new table has RLS on and a check suite; every
new surface is off by default at build time *and* per school; every existing test and SQL suite still passes.
Where the command named a table that already exists under another name, the existing one is extended rather
than copied — two stores for one fact is the failure this repository's audits keep finding.

## What the command asked for, and what it maps onto here

| Command asked for | What this repository does | Why |
| --- | --- | --- |
| `tenant_feature_flags` | Existing `tenant_feature_policy` (+ `public.feature_state`) | Already tenant-scoped, audited, `tenant:configure`-gated. Flag metadata is in `app/src/lib/flags.ts`. |
| `tenant_modules` | Rows in `tenant_feature_policy` keyed `module.*` | Same shape; a second table would split one decision in two. |
| global flags (null tenant) | New `feature_kill_switch` (null tenant = global) | The only global flags the command needs are kill switches. |
| `consent_records` | Existing `consent_record`, capability `integration:<connection public id>` | Versioned, revocable, subject-owned, audited. |
| `tenant_policies` | Existing `ai_policy`, `tenant_feature_policy`, `approved_source` | Deferred until a policy type exists that none of these holds. |
| `audit_events` | Existing `tenant_policy_audit_event`, entity list widened | "Extend existing audit system if present." |
| `integration_*` (7 tables) | **New**, as named | Nothing like them existed. `public.connections` is peer connections, unrelated. |
| `source_records`, `source_snapshots`, `source_freshness_events`, `canonical_entity_references` | **New**, as named | `approved_source` is course learning material, a different thing. |
| `data_classification_rules` | **New**, as named, with the T4+ hard blocks as check constraints | — |
| `retention_jobs` | Deferred to the hardening phase | The gateway journal already has retention (`gateway_purge_journal`); jobs for the new tables need a worker first. |
| capabilities `integration.view` etc. | `integration:view`, `integration:configure`, `integration:approve`, `integration:sync`, `integration:replay`, `killswitch:engage` | Repository convention is `noun:verb`. |
| `/admin/integrations` | An **Integrations** tab on the University screen | There is no `/admin` route; staff surfaces live on University (see `Control`). No new top-level student navigation. |
| Student nav "Today · My Path · Search · Plan · Me" | Unchanged: Home · Courses · Study · Calendar · Me | That list is not this app's navigation; the existing one is preserved exactly. |
| Branch per phase | One branch, one commit per phase | This session is bound to a single development branch. Each commit is reviewable alone. |

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| 0 — Audit | The eight documents in `docs/` named by the command | **Done** in this change set |
| 1 — Control plane | Migration `20260927170000_integration_control_plane.sql`, capabilities, RLS, `flags.ts`, `classification.ts`, check suite | **Done** |
| 2 — Gateway core | `app/src/lib/integration/`: adapter contract, pipeline, idempotency, retry/back-off/DLQ, rate limit, redaction, freshness, mock provider, contract tests | **Done** (library; no worker deployed) |
| 3 — Dashboard | `IntegrationDashboard.tsx`: map + equivalent table, connections, mappings, sync history, conflicts, pause/resume, replay request, export | **Done**, behind `VITE_INTEGRATION_DASHBOARD` and the tenant flags |
| 4 — LTI foundation | Largely **already exists**: `supabase/functions/lti`, `_shared/lti*.ts`, `lti_*` tables and suites | Next: bind LTI launches to `integration_connections` and D-1 below |
| 5 — SIS / degree audit read | Mock adapters for term, program, section, enrollment, requirement, window, hold summary; freshness cards | Not started |
| 6 — CRM / ERP / campus | Mock adapters and student workflows | Not started |
| 7 — Hardening | Worker, reconciliation job, retention jobs, device matrix, operator runbooks | Not started |

## Decisions that need a person

**D-1. Existing grade passback is outside the new gate.** `supabase/functions/lti` posts practice-quiz scores to a
Brightspace gradebook column when an instructor placed the link as graded. That is instructor-gated and has
been since 22 September. The command wants passback off by default behind tenant, instructor, course and
assignment approval. Putting `writeback.lms_grade_passback` in front of it would switch off working behaviour
for any school that has not set the flag. Options: (a) leave it, documented, as the instructor-gated exception;
(b) gate it and backfill a `production` policy row for every tenant with an LTI platform; (c) gate it and let
it go dark. Recommendation: (b), in its own change, with the backfill as a migration.

**D-2. Student-initiated connections.** The Canvas personal-token proxy (`functions/canvas`) and pasted calendar
feeds (`functions/fetchcal`) are the student's own credentials reading the student's own data. They are not
institutional integrations and do not flow through the gateway. They should stay that way, but should appear on
the Me privacy panel with source and freshness (Phase 5).

**D-3. Where the worker runs.** The pipeline is a library. The candidates are the existing serverless gateway
(`app/api/institution`) or a scheduled edge function; either needs the service role and must enforce tenant
scope in code (see the threat model).

## Rollback

The migration is additive and idempotent. To take it out of service without data loss: engage
`kill.integration_sync` globally, set `VITE_INTEGRATION_DASHBOARD` unset (the default) and rebuild. To remove
it entirely, in a new migration: drop the triggers `audit_integration_*`, `audit_feature_kill_switch`,
`audit_data_classification_rules`, `refuse_looser_classification`; the functions `integration_*`,
`kill_switch_engaged`, `private.audit_integration_change`, `private.refuse_looser_classification`,
`private.public_id`; the thirteen new tables (children first); the type `source_freshness` and domain
`data_classification`; delete the eight `role_capabilities` rows, six `app_capabilities` rows and two
`app_roles` rows; and restore the original `tenant_policy_audit_event_entity_type_check` list — after deleting
any audit rows whose `entity_type` is one of the new names, since the narrower check would refuse them. Revert
the three counts in `capabilities.check.sql` and the five names in `grants.check.sql`.
