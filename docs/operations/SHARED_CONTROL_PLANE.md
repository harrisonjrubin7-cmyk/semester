# Shared Platform Control Plane

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision. Open decisions are listed in [`OPERATIONS_ROADMAP.md`](OPERATIONS_ROADMAP.md#open-decisions).

> **Claim ceiling.** "Built" below means code and a test exist in the repository. It does not mean operated: `private.console_audit_event` held 0 rows in production at the last read ([`docs/ops/OPERATIONS_CONSOLE_CURRENT_STATE.md`](../ops/OPERATIONS_CONSOLE_CURRENT_STATE.md)), the domain outbox has no relay, and nearly every operational table is empty. Nothing here is evidence of a customer, a pilot or a control that has run.

The control plane is the one layer both operating systems stand on. The [Institution OS](INSTITUTION_OPERATING_SYSTEM.md) and the [Company OS](SEMESTER_COMPANY_OPERATING_SYSTEM.md) add screens and workflows; they add **no** identity, authorization, audit or tenant logic of their own. A console that needs one of those reads it from here.

## 1. Existing-state audit (what the control plane already is)

| Concern | Real today | Evidence | Missing |
| --- | --- | --- | --- |
| Tenant | `public.schools` is the tenant root (`is_demo`); `tenant_id text` on about 190 columns, `school_id` on about 9, `institution_id` on about 2; 170 public tables carry a tenant-ish column | `database/TENANT_ISOLATION_MATRIX.md`, `database/schema/table-classification.json` | One column name; a campus/school/department/program/term/operating-unit hierarchy table (none found) |
| Membership and identity | `institution_membership`, `school_membership_requests`, `organization_members`, `scim_*`, `institution_identity_provider`, `tenant_sso_policy` (+history) | migrations; `docs/SCIM-LIFECYCLE-MANAGEMENT.md`, `docs/INSTITUTIONAL-SSO-ARCHITECTURE.md` | HTTP SCIM endpoint not found (gateway code exists); no named-tenant provisioning proof |
| Roles and capabilities | `app_roles`, `app_capabilities`, `role_capabilities`, `role_grants` (scope kind + id, expiry, revoke), `role_grant_audit_event`; `private.has_capability(cap, scope_kind, scope_id)` exact-scope match; break-glass honoured at school scope | `docs/ROLE-PERMISSION-MATRIX.md`, `supabase/capabilities.check.sql` | Two role vocabularies (69 DB roles vs the gateway's 10 `UNIVERSITY_ROLES`, ADR-0002 open); `my_capabilities()` ignores break-glass |
| Policy and workflow | `tenant_feature_policy`, `school_config_versions` (two-person publish), `workflow_versions`, `ai_policy`; pure engines in `packages/platform/src/policy`, `engines/workflow` | `docs/CONFIGURATION-STUDIO.md`, `docs/WORKFLOW-BUILDER.md` | Platform engines run on in-memory stores except where `app/server/institution` adopts them |
| Flags, cohorts, kill switches | `tenant_module_mode` (+history, request), `feature_kill_switch`, `beta_cohorts`, `feature_cohort_members`, `tenant_rollout` (+evidence, history); 28 activation flags, all L2 | `docs/ACTIVATION-CONTROL-PLANE.md`, `docs/FEATURE-FLAG-REGISTRY.md` | Console Releases tab is read-only; kill-switch writes bypass approval (F-1) |
| Consent, retention, holds | `consent_record`, `legal_holds`, `data_subject_request`, retention sweeps, `human_overrides`; erasure scrubs audit copies | `supabase/legal-holds.check.sql`, `docs/DATA-RETENTION-EXPORT-DELETION.md` | Live end-to-end proof; counsel-approved policy |
| Integration/migration | `integration_*` connections, mappings (+versions), sync runs/errors, reconciliation, dead letter; `source_records`/`source_snapshots`/`source_freshness_events`; Migration Center component | `docs/INTEGRATION-CONTROL-PLANE.md`, `docs/master/SEMESTER_MIGRATION_FACTORY.md` | Live adapters, credentials, UAT; domain-event replay path |
| AI governance | `ai_policy`, provider registry, content-free AI audit tables, budget and kill-switch patterns | `docs/ai-governance/`, `supabase/ai-audit-content-free.check.sql` | Approved evaluations; production cost and incident data |
| Audit/evidence/risk | `public.audit_event` (immutable trigger); `private.console_audit_event` (hash chain, HMAC daily seals, verify); `private.ledger_chain*`; `support_access_event`; many per-domain audit tables | `docs/OPERATIONS-CONSOLE-MAP.md` | **0 production rows in the console chain**; no cross-domain audit explorer; five risk registers |
| Reliability/incident/rollback | Incident playbooks and war room as TS registers; `governance_incident_notices` | `app/src/lib/ops/incidentplaybooks.ts`, `docs/sre/` | **`platform_incident` and an evidence-derived read now exist (`20261005126000`, `console_release_incidents`); still no SLO, access-review or tenant-health tables, no operator incident write path, and no alert reaches a person** |
| Portability/offboarding | `school_offboarding` (+undo), export RPCs, `docs/SCHOOL-OFFBOARDING.md` | `supabase/school-offboarding.check.sql` | `is_app_admin()` still gates offboarding (F-5); live exercise |

## 2. Canonical data and authority map

The authority classes (S, X, S+X, C) and the per-domain table are generated and live in [`docs/master/SEMESTER_DATA_AUTHORITY_MATRIX.md`](../master/SEMESTER_DATA_AUTHORITY_MATRIX.md); the delta is in [`SEMESTER_DOMAIN_AUTHORITY_MATRIX.md`](../master/SEMESTER_DOMAIN_AUTHORITY_MATRIX.md); which file wins is [`SEMESTER_SOURCE_OF_TRUTH.md`](../master/SEMESTER_SOURCE_OF_TRUTH.md). This page does not restate them. It names only the **operations-layer** entities, because those are what the consoles read and write.

### 2.1 The envelope every operations entity carries

From the brief's sixteen attributes, mapped to what exists, so no console invents a column:

| Attribute | Carried by | State |
| --- | --- | --- |
| Canonical ID, tenant ID | uuid / `tenant_id text` → `schools(id)` | Built; name varies (see §1) |
| Owner | `owner` on registers; `council_seat_holder` for seats | Partial |
| Authority, source system | `source_records.source_of_truth`, `source_type`; `canonical_entity_references` | Built for integration data; **absent on operations entities** |
| Freshness | `source_freshness` enum, `source_freshness_events`; projection freshness classes in [`PROJECTION_AND_CACHE_POLICY.md`](../ops/PROJECTION_AND_CACHE_POLICY.md) | Built for integration; projections proposed |
| Data classification | `classification` T0–T3 (below T4) in `source_records`; [`DATA_CLASSIFICATION_REGISTER.md`](../../database/DATA_CLASSIFICATION_REGISTER.md) | Partial |
| Consent scope | `consent_record`, `support_access_grant` (backed by `support:read` consent) | Built for support; not generalised |
| Required capability, policy reference | in-body `private.has_capability`; `tenant_feature_policy` | Built per RPC; no per-entity policy reference column |
| Version, audit history | `*_history` tables, `console_audit_event` chain | Partial |
| Retention, export, deletion | `retention_*` sweeps, `export_my_data`, offboarding | Per domain |
| Migration source, verification status | `source_snapshots.snapshot_hash`, reconciliation tables | Integration only |

**Rule for new tables:** an operations entity must either carry the envelope columns it needs or name the existing table that carries them. Where it carries none, the console shows the field as `unknown`, never as a default. This is the same rule `docs/OPERATIONS-CONSOLE-MAP.md` applies to figures.

### 2.2 Operations entities and where they live

| Entity | Home | State |
| --- | --- | --- |
| Work item, approval | `approval_request`, `approval_decision`, `console_action_record`, `console_duty` | Approval built; **generic work item missing** |
| Policy | `tenant_feature_policy`, `school_config_versions`, `ai_policy` | Built, separate stores |
| Audit event | `audit_event`, `console_audit_event` | Built, two chains |
| Risk | `docs/*RISK-REGISTER.md` (five), `lib/ops/riskreview.ts` | **Docs only, not rows** |
| Incident | `platform_incident`, `governance_incident_notices` + TS playbooks | Table and read built; **no operator write path** |
| Release | `platform_release_evidence`, `tenant_rollout` | Built |
| Integration, migration | `integration_*`, `source_*` | Built (observation) |
| Customer, contract, commitment | `customer`, `customer_contract`, `customer_commitment` | Built, service-key writes, 0 customers |
| Billing account, entitlement | `commercial_*`, `subscriptions`, `entitlement_definitions`, `plan_entitlements`, `tenant_plan` (+history) | Built; institutional billing documented-unimplemented |
| Account health, success plan | `account_health_snapshots`, `success_plans` | Built tables; no scoring operated |
| Projection, watermark | — | **Missing** (P1-01) |

## 3. Tenant hierarchy

Brief: institution → campus → school → department → program → term → operating unit. Today only `schools` exists as a tenant root, with membership scope held as `scope_kind`/`scope_id` in `role_grants`. Plan:

1. **Do not rename `tenant_id`.** The convergence cost is high and the matrix says 190 columns depend on it. Record the mapping `tenant = schools.id` in the envelope doc and let new tables use `tenant_id text references schools(id)`.
2. Add one `private.org_unit(tenant_id, id, parent_id, kind, …)` table for campus/school/department/program/operating unit, with `term` staying an academic-record concept. Grants then use `scope_kind = 'org_unit'`. This is a **proposal needing a decision** (OD-3), because an exact-scope `has_capability` does not inherit down a tree; the inheritance rule must be written before any table is added.
3. Tenant slug in a URL is presentation only. The server derives tenant from membership, as `app/server/institution/membership.ts` already does ("reloads tenant and roles from server records").

## 4. Domain dossiers (the eleven control-plane domains)

Each dossier covers the brief's nineteen dimensions in eight lines. Capability names marked ⊕ are proposed and unverified against `app_capabilities`; every other name is from the permission matrix. Operating owner is a **seat**; today every seat is the founder or `UNASSIGNED` ([`SEMESTER_COMPANY_OPERATING_SYSTEM.md`](../master/SEMESTER_COMPANY_OPERATING_SYSTEM.md#where-the-company-actually-stands)), so an owner here is accountability, not staffing.

### 4.1 Tenant hierarchy
- **Model/Data:** `schools`, proposed `private.org_unit`; envelope in §2.1. **Screens:** Tenants list and Tenant 360 ([COMPANY](COMPANY_CONSOLE_CATALOG.md#operations-command-center)); institution Overview.
- **Roles/Isolation:** `tenant:configure` at the school; `console:operate` + `account:manage` for Semester staff. Isolation: exact-scope grant, RLS on `tenant_id`; cross-tenant negative check per [`OPERATIONS_RELEASE_GATES.md`](OPERATIONS_RELEASE_GATES.md#gate-t-tenant-isolation).
- **Workflows/Approvals:** create tenant, change lifecycle state (pre-contract → pilot → annual → offboarding), suspend. Suspension is duty `tenant-suspension` (executor exists). **Policy/Consent:** lifecycle transitions need an entitlement; no consent (no personal data moved).
- **Audit/SAF:** `tenant.created`, `tenant.lifecycle_changed`, `tenant.suspended`. Authority: `schools` is X-free (Semester-owned).
- **Review/SLO/Support:** security review of `org_unit` inheritance; read SLO class "operational" in §5. Support: Support queue.
- **Rollback/Tests/Gate:** suspension reversible by a second approved request; tests T-01, tenant isolation; gate T, S.
- **Owner/Commercial:** operations seat. Commercial: a tenant row is the unit of billing and of every pilot.

### 4.2 Identity, SSO, SCIM
- **Model/Data:** `institution_identity_provider`, `tenant_sso_policy`, `scim_*`, `organization_members`. **Screens:** institution IT/Identity console; company Implementation tab.
- **Roles/Isolation:** school-scope ⊕`identity:manage`; Semester implementation holds `tenant:implement`. SCIM credentials are server-only (`scim_credential`).
- **Workflows/Approvals:** SSO onboarding ([`docs/SSO-TENANT-ONBOARDING.md`](../SSO-TENANT-ONBOARDING.md)), SCIM provision/deprovision, claim-mapping change. SSO policy changes are `tenant-policy` duty (today a direct write — F-1).
- **Policy/Consent:** claim minimisation ([`SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md`](../SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md)). **Audit:** `tenant_sso_policy_history`, `provisioning_audit_event`.
- **SAF:** IdP is authoritative for identity attributes; Semester is authoritative for membership. **Review:** security (session, replay), accessibility of the login path.
- **SLO/Support:** sign-in success and p95; escalation to implementation then security. **Rollback:** previous policy version restorable; break-glass local account is the documented fallback (needs a decision, OD-6).
- **Tests/Gate:** `tenant-sso-policy.check.sql`, SSO runbook rehearsal; gate T, S, E. **Owner:** security seat. **Commercial:** SSO is a gating item in enterprise sales; HTTP SCIM absent is a stated gap.

### 4.3 Roles, capabilities, delegation
- **Model/Data:** `app_roles`, `app_capabilities`, `role_capabilities`, `role_grants`, `role_grant_audit_event`, `app_admins` (legacy). **Screens:** Access (institution IT), Access reviews (company; Phase 4).
- **Roles/Isolation:** `role-grant` duty executes today. Delegation: a school admin may grant only capabilities they hold at the same scope (rule to be asserted by a check; not found).
- **Workflows/Approvals:** grant, revoke, expire, review. Two-person for platform-scope grants. **Policy:** no single broad "admin" — retire `app_admins`/`is_app_admin()` (F-5).
- **Audit:** `role_grant_audit_event`. **SAF:** `role_grants` is the sole authority; the TS registers derive from migrations (`rolelaunch.ts`).
- **Review:** quarterly attestation needs ⊕`access:review` (not created). **SLO/Support:** grant propagation within one request (no cache).
- **Rollback:** revoke; expiry is default. **Tests/Gate:** `rolegrants`, `capabilities`, `my-capabilities` checks; the `my_capabilities()` break-glass defect is fixed (#1341). Gate T, S.
- **Owner:** security seat. **Commercial:** role clarity is a procurement question on every RFP.

### 4.4 Policy and workflow engine
- **Model/Data:** `school_config_versions`, `workflow_versions`, `tenant_feature_policy`; `packages/platform/src/policy`. **Screens:** Configuration Studio, Workflow Builder, Policy Simulator (all exist as institutional components).
- **Roles:** `tenant:configure`. **Approvals:** publish needs two people (built, Configuration Studio).
- **Policy/Consent:** policy hierarchy Semester → institution → org unit; narrower may only restrict a Semester floor. **Audit:** version rows; publish event.
- **SAF:** each policy row names its steward and effective date. **Review:** privacy review for any policy that moves personal data.
- **SLO/Support:** publish → effective within one minute. **Rollback:** publish a prior version; config versions are append-only.
- **Tests/Gate:** `control-plane.test.ts`, `PolicySimulator`; gate T, P. **Owner:** product seat. **Commercial:** configuration depth drives implementation hours; track it.

### 4.5 Feature flags, cohorts, kill switches
- **Model/Data:** `tenant_module_mode`, `feature_kill_switch`, `beta_cohorts`, `tenant_rollout`. **Screens:** Releases and flags (read-only today), Rollouts.
- **Roles:** `killswitch:engage`, `console:operate`. **Approvals:** `release` duty. **Today:** direct insert into `feature_kill_switch` (F-1) — must close before the console says "cannot bypass approval".
- **Policy:** controlled/high-risk flags default off; 23 of 28 are high-risk. **Audit:** `tenant_module_mode_history`, `tenant_rollout_history`.
- **SAF:** flag state is a row; build-time `VITE_*` flags are reported separately and labelled build-time. **Review:** accessibility + privacy per flag class.
- **SLO:** kill switch effective < 60 s (proposed). **Rollback:** the kill switch *is* the rollback; test that engaging it works with the client offline-first path.
- **Tests/Gate:** T-02; gate R. **Owner:** engineering seat. **Commercial:** modules are the price book; entitlement ≠ flag, keep both ([`ENTITLEMENT-RESOLUTION.md`](../ENTITLEMENT-RESOLUTION.md), "shadow, enforces nothing").

### 4.6 Consent, retention, legal holds
- **Model/Data:** `consent_record`, `legal_holds`, `data_subject_request`, retention runs. **Screens:** Privacy and Data Rights (company), Governance/Trust (institution).
- **Roles:** `data_request:handle`, `hold:read`, `compliance:manage`. **Approvals:** hold release and `data-deletion` duty. **Policy:** retention schedule per data class; a hold blocks every sweep (`hold-*-sweeps` checks exist).
- **Consent:** purpose-bound, revocable; support access requires an active `support:read` consent. **Audit:** DSR lifecycle events; erasure scrubs audit copies (`20261004190000`).
- **SAF:** DSR state is authoritative in Semester; the SIS remains authoritative for the academic record. **Review:** counsel — **not engaged** (77 `[DECIDE]` placeholders).
- **SLO:** DSR acknowledge ≤ 5 days (proposed; counsel to confirm). **Rollback:** a hold is released, not deleted; deletion is irreversible → needs two-person and a waiting period.
- **Tests/Gate:** `legal-holds`, `retention-sweeps`, `answer-data-subject-requests`; gate P. **Owner:** privacy seat. **Commercial:** the single most-asked RFP section.

### 4.7 Integration and migration factory
- **Model/Data:** `integration_*`, `source_*`, `canonical_entity_references`. **Screens:** Integration and Migration Center (company), Integrations (institution), Migration Center component.
- **Roles:** `integration:view`, `tenant:implement`. **Approvals:** `integration-config`; **observation → authoritative sync is a high-impact switch** (PDF list) needing approval, impact preview (row counts, mapping version, reconciliation delta) and a dual-run gate.
- **Policy:** a connector augments, never replaces ([`INTEGRATION-CONTROL-PLANE.md`](../INTEGRATION-CONTROL-PLANE.md)). **Consent:** student-directed sources need `consent_record`; institutional sources need a data-sharing agreement reference.
- **Audit:** sync runs/errors, mapping versions. **SAF:** the native model of this document set.
- **Review:** threat model exists ([`INTEGRATION-THREAT-MODEL.md`](../INTEGRATION-THREAT-MODEL.md)). **SLO:** freshness classes per source; `unknown` blocks "live" claims.
- **Rollback:** switch back to observation; mapping versions are immutable; dual-run retains the SIS as authority. **Tests/Gate:** `integration-rls-matrix`, [`SYNC-SIMULATION-SANDBOX`](../SYNC-SIMULATION-SANDBOX.md); gate I.
- **Owner:** engineering seat with implementation. **Commercial:** time-to-first-sync is the pilot's critical path.

### 4.8 AI governance
- **Model/Data:** `ai_policy`, provider registry, content-free AI audit. **Screens:** AI evaluation, policy and incident console (P1).
- **Roles:** ⊕`ai:govern`. **Approvals:** `ai-provider` duty (direct write today — F-1). Activating AI for a course or institution is high-impact.
- **Policy:** approved-source registry; no student content in audit rows (`ai-audit-content-free` check). **Consent:** AI use on student material is opt-in per surface.
- **Audit:** content-free AI interaction records. **SAF:** every AI answer carries its sources and a freshness label.
- **Review:** evaluation harness ([`AI-RECOMMENDATION-EVALUATION-HARNESS.md`](../AI-RECOMMENDATION-EVALUATION-HARNESS.md)); no approved evaluation exists.
- **SLO:** cost per tenant vs budget; kill switch < 60 s. **Rollback:** provider switch-back; per-tenant AI off.
- **Tests/Gate:** gate AI. **Owner:** engineering seat with data seat (vacant). **Commercial:** AI cost is a margin line; track per tenant.

### 4.9 Audit, evidence, risk
See [`OPERATIONS_AUDIT_AND_EVIDENCE.md`](OPERATIONS_AUDIT_AND_EVIDENCE.md), which is the dossier for this domain.

### 4.10 Reliability, incident, rollback
- **Model/Data:** missing tables (incident, SLO, error budget, access review). Logic exists in `lib/governance/error-budgets.ts` and `incident-comms.ts`. **Screens:** Incident Command, Reliability/SLO Center (Phase 4).
- **Roles:** ⊕`incident:command`, `incident:communicate`. **Approvals:** declaring/resolving SEV1–2 needs a second person where one exists; with one person, recorded as self-review, not independent evidence.
- **Policy:** SEV1–4 ↔ P0–P3 mapping in [`coo/05`](coo/05-incident-and-continuity.md). **Consent:** incident notices to people follow notification consent.
- **Audit:** `incident.declared/escalated/resolved`. **SAF:** health states `healthy/degraded/unhealthy/unknown/disabled` with checked time; stale = unknown.
- **Review:** postmortem within five working days (proposed). **SLO:** the four freshness classes in `PROJECTION_AND_CACHE_POLICY.md`.
- **Rollback:** release rollback runbook ([`ROLLBACK.md`](../../ROLLBACK.md)); restore exercise has not been run.
- **Tests/Gate:** gate R; war-room drill. **Owner:** operations seat. **Commercial:** SLA credits need this to be real before any SLA is offered.

### 4.11 Portability and offboarding
- **Model/Data:** `school_offboarding` (+undo), export RPCs. **Screens:** Offboarding in Governance/Trust and Implementation.
- **Roles:** school admin + ⊕`tenant:offboard`; currently legacy `is_app_admin()` (F-5). **Approvals:** `data-deletion` duty; undo window.
- **Policy:** export before delete; legal holds block purge. **Consent:** student export is the student's own ([`DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md)).
- **Audit:** offboarding events. **SAF:** exported packages carry a manifest hash. **Review:** counsel.
- **SLO:** export completes ≤ 24 h (proposed). **Rollback:** undo until purge is authorised; purge is irreversible.
- **Tests/Gate:** `school-offboarding`, `offboarding-grants`; gate P. **Owner:** privacy seat. **Commercial:** exit terms are a contract negotiation point; offering them lowers buyer risk.

## 5. Database, RLS and RPC plan

Everything below is additive and **proposed**; nothing is applied to production without the owner's confirmation per step. It adopts the open decisions B-01 (`private`, `projection_` prefix) and B-02 (extend `domain_outbox_events`) from [`OPERATIONS_CONSOLE_BACKLOG.md`](../ops/OPERATIONS_CONSOLE_BACKLOG.md) rather than reopening them.

| # | Object | Purpose | RLS / grant |
| --- | --- | --- | --- |
| 1 | `private.projection_watermark`, `projection_invalidation`, `projection_rebuild_run`, `read_model_registry` | Freshness and rebuild | RLS on; no client grant; service role only |
| 2 | additive columns on `private.domain_outbox_events`; `private.emit_domain_event()` with payload deny-list + hash | One writer for events, same transaction as the write | service role |
| 3 | `claim/complete/fail/replay_domain_events` | SKIP LOCKED claim, bounded backoff, dead letter; replay needs capability + audit | definer, `search_path=''`, in-body check |
| 4 | `private.work_item` (+ `work_item_event`) | The one inbox/My Work entity: kind, source ref, tenant, assignee, state, due, severity | RLS: assignee, or `console:operate` + domain capability |
| 5 | `private.tenant_health_projection`, `private.inbox_projection` | Read models | no client grant; read via `ops_*` |
| 6 | `public.ops_*` read RPCs, standard envelope `{data, freshness, authority, warnings, request_id}` | The only way a console reads | definer, in-body `console:operate` **and** the domain capability; forbidden vs empty distinguished; redaction deny-list |
| 7 | `public.platform_incident` **exists** (`20261005126000`); still needed: an operator write path (declare, update, resolve) behind ⊕`incident:command`, and `incident_update` | Incident command | capability + threat model |
| 8 | `private.access_review`, `access_review_item`; ⊕`access:review` | Attestation | same |
| 9 | `private.org_unit` | Hierarchy | RLS on `tenant_id` |
| 10 | `console_act` executors for the eight duties that have none (`tenant-policy`, `integration-config`, `release`, `data-deletion`, `ai-provider`, `evidence-release`, `refund`, `support-access`) **and** revoking the direct-write paths | Closes F-1 | per duty |

Order matters: **row 10's revocation precedes any console copy that says "cannot bypass approval"** (T-02 stays red until then). Every new function is registered in `app/src/lib/definerregister.ts` (the test requires it) and allow-listed in `supabase/grants.check.sql`.

## 6. Support and escalation of the control plane itself

Support access is the existing student-consented `support_access_grant` for student data and the `break-glass` duty for emergencies; operator support content is the existing Support tab. Escalation order: support → implementation → engineering → security/privacy → founder, SEV mapping in `coo/05`. With one person, the escalation chain terminates in the founder; that is a recorded risk, not a design.
