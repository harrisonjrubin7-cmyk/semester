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
| T0–T6 classification | `app/src/lib/integration/classification.ts` + `data_classification_rules` (the platform floor), beside the AI Toolkit's student-facing gate `app/src/lib/toolkit/classification.ts` (#781) | Two layers, one rule: the toolkit may be stricter, never looser. `classification.test.ts` walks every tier × action and fails if the toolkit allows what the floor forbids. Aligning found the floor stricter than the command for Community (T1/T2), now corrected |
| `retention_jobs` | `integration_retention_sweep()` + `integration_retention_runs` (Phase 7), with `legal_hold` on connections | A function a scheduler calls and a log of what each run removed, rather than a queue of per-row jobs |
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
| 4 — LTI foundation | Launch, OIDC/JWT validation, deep linking and AGS **already existed**. Added: `20260927180000_lti_integration_binding.sql` binds an `lti_platform` to a school and a connection, gates passback in the database, records each launch's course context; `_shared/ltigate.ts`; `lti-integration.check.sql` (32 checks) | **Done** |
| 5 — SIS / degree audit read | `mock-sis.ts` (term, program, catalog entry, section, registration window, enrollment, hold *summary*) and a mock degree audit (requirement status), with contract tests; `20260927190000_canonical_display.sql` stores each fact's mapped values and lets a student delete their own; a **From your school** section on Today behind `module.source_freshness_cards`; **What your school shares** on Privacy, always on, with delete and consent revocation | **Done** |
| 6 — CRM / ERP / campus | `mock-campus.ts`: advising (appointment, referral — T3, consent), career, events and organizations, library, tutoring, academic calendar, alerts, transit (T0), and a bursar action layer (T3, office + due date + link only), each with contract tests; Today's *From your school* gains alerts (first, with an "not an emergency channel" caveat), the next advising appointment, referrals, bursar action items, one career deadline and one event; `notes` joins the never-stored names | **Done** — every connector flag, bursar included, stays high-risk and off |
| 7 — Hardening | Sync worker (`app/server/integration/worker.ts`) binding the pipeline to the tables with tenant scope enforced in code, SCIM subject resolution and reconciliation; `20260927200000_integration_hardening.sql`: retention sweep, legal hold, sweep log, `integration_health()`; `integration-rls-matrix.check.sql` (13 tables × 4 accounts); dashboard reflow/keyboard/naming pass at 320/768/1280; `INTEGRATION-OPERATOR-RUNBOOK.md`; threat-model review | **Done** — nothing scheduled or deployed |

## Decisions that need a person

**D-1. Existing grade passback — resolved in Phase 4.** `supabase/functions/lti` posts practice-quiz scores to a
Brightspace gradebook column when an instructor placed the link as graded, and has since 22 September. A
backfill (the earlier recommendation) turned out to be impossible: `lti_platform` named no school, so there was
no tenant to backfill a policy row for. What shipped instead keeps the behaviour and puts the gate where the
school becomes known:

- **Unbound registration** (every one today): passback as before, except a **global** `kill.writeback` or
  `kill.integration_sync` now stops it too.
- **Bound registration**: `integration.lms_lti` and `writeback.lms_grade_passback` in `production`, an
  approved write-direction connection that is healthy or degraded, `scope.lms.score_publish` approved and unexpired, and no
  kill switch for the school or the connection. The instructor's graded placement is still required on top —
  that is the course-and-assignment approval the command asks for.

The gate is `public.lti_passback_decision`, called by `/score` before anything is signed. While the Edge Function
is deployed ahead of the migration, a *missing* function is read as the unbound answer so passback does not go
dark for a deploy window; any other error refuses.

### Binding a registration (operator, SQL)

There is no screen for this yet; it is a deliberate, reviewed change per school.

```sql
-- 1. the connection (born disconnected), as someone with integration:configure
insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name,
  authentication_type, sync_mode, feature_flag_key)
values ('<school>', 'lms', 'Brightspace', 'Brightspace LTI', 'lti_1_3', 'lti_launch', 'integration.lms_lti');
-- 2. approve it (a different person, integration:approve)
select public.integration_approve_connection('<conn public id>', 'approved_write');
-- 3. if the school uses passback: the scope, approved, and both flags in production
insert into public.integration_scopes (tenant_id, connection_id, scope_key, scope_type, purpose)
values ('<school>', '<conn id>', 'scope.lms.score_publish', 'write', 'Practice-quiz scores to the instructor''s column');
select public.integration_approve_scope('<scope id>');
insert into public.tenant_feature_policy (tenant_id, capability, state) values
  ('<school>', 'integration.lms_lti', 'production'), ('<school>', 'writeback.lms_grade_passback', 'production');
-- 4. bind (service role / migration; lti_platform has no API grants)
update public.lti_platform set tenant_id = '<school>', connection_id = '<conn id>'
 where issuer = '<issuer>' and client_id = '<client>';
```

Do step 3 **before** step 4 for a school that relies on passback, or its scores stop at the moment of binding.
The next student launch records the course context and moves the connection to `healthy`.

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
