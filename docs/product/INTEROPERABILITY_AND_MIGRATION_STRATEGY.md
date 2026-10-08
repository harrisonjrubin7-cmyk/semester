# Interoperability and migration strategy

Status: Phase 0 baseline and plan, assessed 2026-10-05 at `790ebbf`. Read-only audit; no test was run. Supersedes nothing: it extends `docs/INTEROPERABILITY-ROADMAP.md`, `docs/LMS-INTEROPERABILITY-MATRIX.md`, `docs/LTI-1.3-LAUNCH-RUNBOOK.md`, `docs/INTEGRATION-CONTROL-PLANE.md` and `docs/migration/README.md`, and records where they disagree with the code.

## The fact that governs everything below

**No real provider has ever been exercised.** `app/server/integration/registry.ts` exports `ADAPTERS = []`; so do the generated copy `supabase/functions/_shared/integration/registry.ts` and the gateway's `app/server/institution/adapters.ts`. `supabase/functions/integration-tick` therefore runs nothing. `docs/INTEGRATION-DATA-PIPELINE-AUDIT.md` says no provider endpoint has been exercised; `docs/migration/README.md` says the tooling has "never yet run against a real institution". Everything is sandbox, mock, fake-fetch, synthetic fixture or SQL check suite. The `supabase/*.check.sql` suites run in CI against a throwaway Postgres, which is real SQL and not a real provider.

Standards status in one table (code truth, not roadmap):

| Interop | Status | Evidence |
| --- | --- | --- |
| LTI 1.3 launch, deep linking, membership binding | NV against synthetic platforms | `supabase/functions/lti/index.ts`, `_shared/lti*.ts`, `app/src/lib/lti.test.ts`, `supabase/lti.check.sql` |
| LTI NRPS (roster) | NS, **deliberate** | `ltikey.ts` `SCOPE` excludes `contextmembership` |
| LTI AGS score passback | NI | `ltiags.ts`; `lti_passback_decision`; no idempotency, no read-back |
| OneRoster | DO plus SQL staging | `20260930220000_roster_import_staging.sql`, `supabase/roster-import.check.sql`; `docs/institutional-readiness/ONEROSTER-READINESS.md`: "DESIGNED ONLY, NO ONEROSTER CONNECTOR" |
| Edu-API | NS | appears only in registers and crosswalk text |
| SAML SSO | NI | Supabase Auth validates; Semester enforces membership (`app/server/institution/membership.ts`) |
| OIDC | NS | `provider_type check in ('saml')` |
| SCIM | NI, off | `app/server/institution/scim.ts`, `postgres-scim.ts`; fake repository only |
| SIS and ERP migration | tooling NV on synthetic data | `app/src/lib/migration/*`, `app/scripts/institution-migration.ts` |
| Productivity: Google and Microsoft calendar | INT, fake fetch | `app/src/lib/connect.ts`, `oauthscopes.test.ts` |
| Productivity: Apple | ICS link only; no CalDAV | `connect.ts` header |
| Canvas (student token) | NI, not an integration adapter | `supabase/functions/canvas/index.ts`, `app/src/lib/canvas.ts` |
| QTI 3 | DO | `docs/QTI-3-ASSESSMENT-AND-MIGRATION.md` rendered from `app/src/lib/assessment/qti.ts` |
| AI-provider transition | interface only | `app/server/institution/providers/types.ts` |

## A. LTI

### Built (synthetic-tested)

OIDC login with `login_hint` and `lti_message_hint`; state spent atomically through `spend_lti_nonce` before registration or signature is touched; RS256 only, refusing `none`, HS256-with-public-key, `jku`, `x5u`, `jwk`, `x5c` and `crit` (`ltiverify.ts`); issuer, audience (array `aud` needs matching `azp`), deployment id, expiry and nonce checks; registration taken from the recorded flight, never the token; subjects digested in logs; deep linking (https-only return URLs, `accept_types`, `accept_multiple`, placement decision needing both an LMS instructor role and a faculty or teaching-assistant membership); membership binding through `public.lti_launch_membership` (platform to tenant, identity to user, user to `institution_membership`, never by email or sourcedId; no session minted for pending, suspended or deprovisioned membership).

### Open, in order

| # | Gap | Fix | Test that would hold it |
| --- | --- | --- | --- |
| L1 | Launch audit is `console.log` only (the runbook admits "logged, not persisted") | `lti_launch_audit` table with tenant, platform, deployment, outcome code, no raw claims | Check suite: every refusal code writes one row; row carries no token |
| L2 | Unbound and unlinked launches still pass; `ltientitlement` runs in shadow and refuses nothing | Move entitlement from shadow to enforcing per tenant behind `tenant_feature_policy` | Negative test per refusal reason |
| L3 | AGS: no idempotency, one POST, no retry, no read-back, no failed-write queue | `grade_passbacks` gains an idempotency key and attempt log; retry with backoff; request `SCOPE.result` and read back; dead-letter on failure | Replayed passback creates one score; failed post lands in the queue; read-back mismatch opens a discrepancy |
| L4 | `grade.passback_requested` and `grade.passback_reconciled` event types exist with no producer (`packages/institution/src/events.ts`) | Emit from the passback path via the outbox | Event test per transition |
| L5 | NRPS absent | Decide: roster arrives by OneRoster (preferred, one source of roster truth) or by NRPS; record as a decision | A decision file `docs/decisions/D-<PR>.md` |
| L6 | No real platform has launched | Register Semester as a tool in a design partner's non-production LMS; run the launch suite against it | A filed launch log under `docs/evidence/lti/` |
| L7 | `docs/INTEROPERABILITY-ROADMAP.md` lists LTI as "Planned" and stage 2 as "tested against a test platform" | Correct to "built, tested with synthetic fixtures" | Doc test or review |
| L8 | Consent and course-policy integration: launch context does not yet gate Course AI rules or consent | Resolve launch to a tenant, course and term so `course_ai_rules` and `consent_record` apply to the session | Test: a launched session in course A cannot read course B policy |

Grade passback stays off until all of L1, L3, L4 and the institution's approval exist; a design in `docs/LMS-INTEROPERABILITY-MATRIX.md` (W01 to W07) already lists the same gaps.

## B. OneRoster

**What exists:** SQL staging `private.roster_import_batch`, a normalized `roster_*` set for **orgs, users, classes and enrollments only**, `roster_allowed_keys` (carries `termSourcedId`, `status`), `roster_reconcile`, `roster_rollback` (last promotion only), a manifest SHA idempotency key, a hold when removals exceed `max_removal_pct` (default 10), and a different-approver rule. `source_kind in ('csv','rest')`, a REST source requires a credential reference. **Nothing reads `private.roster_current`** (`app/src/lib/ops/implementation-system.test.ts` asserts it). No CSV parser, no REST client, no conformance profile, no courses, academicSessions, demographics, lineItems, results or categories. Soft-delete status is carried without a tombstone workflow. Claim ceiling: "not implemented"; no page may claim OneRoster support.

**Plan, by phase from the brief:**

| Phase | Scope | Exit evidence |
| --- | --- | --- |
| A: CSV import | Parser for the 1EdTech OneRoster CSV profile (orgs, users, academicSessions, courses, classes, enrollments); schema validation; duplicate and error report; counts reconciled; source authority stays external | Fixture round-trip: a conformance-style CSV set imports, a deliberately broken set is rejected with row-level problems, counts reconcile |
| B: REST read sync | Incremental sync with `dateLastModified` filter; per-record freshness; soft deletes as tombstones; source snapshots; reconciliation dashboard | Sync against a vendor sandbox or conformance server; adapter registered in all three registries; first non-empty `ADAPTERS` |
| C: controlled exchange | Resources, line items, results; approved grade exchange; scope and audit | Maps onto `gradebook_items` and `grade_passbacks` with the L3 guarantees |
| D: native | Semester authoritative for approved records; dual-run; cutover; rollback window | Gates 7 to 14 for the domain |

**Canonical mapping** (the brief's table, with the schema target):

| OneRoster | Semester model | Target |
| --- | --- | --- |
| Org | Institution, campus, school, department | `schools` and proposed `org_unit` ([graph](EDUCATION_GRAPH_ARCHITECTURE.md)) |
| User | Person, profile, membership | `person_alias` then `institution_membership` |
| AcademicSession | Term | `registration_terms` |
| Course | Catalog course | `catalog_sections` / catalog course |
| Class | Section / offering | `registration_sections` |
| Enrollment | Membership and course enrollment | `institution_membership` + course membership |
| Resource | Course material or study pack reference | `approved_source` |
| LineItem | Gradebook item | `gradebook_items` |
| Result | Grade entry and version | `grade_entries` |

Mapping versioning exists as code (`app/src/lib/integration/mapping-versions.ts`: propose, simulate, approve, live, rollback, tested in `integration/quality.test.ts`) and table (`integration_mapping_versions`); **nothing in the runtime imports it**. Wiring it into the importer is the first Phase A task.

## C. Edu-API and enterprise education APIs

Absent. Define before building:

- A **standard adapter** per 1EdTech Edu-API resource, and an **institution-specific adapter** per SIS (Banner, PeopleSoft, Workday Student, Colleague, Jenzabar named in the brief) that normalizes into the same internal model.
- Rules every adapter obeys: source authority per field (the authority matrix); change detection by `dateLastModified` or an ETag; idempotent upsert keyed by `(tenant, source, sourcedId)`; an audit event per run; a reconciliation per run.
- Start with Edu-API read of academic sessions, courses, class sections and persons into the same staging tables OneRoster uses, so one importer serves both. Status when written: PL until a design partner names an SIS.

## D. SIS and ERP migration

**Built as tooling, tested on synthetic fixtures** (about 6,300 lines in `app/src/lib/migration/`, driven by `app/scripts/institution-migration.ts` with `init, validate, queue, exception, sign, plan, verify`):

| Stage | Mechanism | Test |
| --- | --- | --- |
| Staging, data quality, gate | Refuses counts-only evidence, vacuous checks and critical failures; thresholds only tighten | `gate.test.ts`; `engine.test.ts` ("swaps two students' grades: counts equal, semantic checks fail"); `checks.test.ts` |
| Field mapping | Code tables with no defaults, minor units, lineage | `mapping.test.ts` |
| Duplicates | Never merges two students; reversible | `integration/quality.test.ts` via `duplicates.ts` |
| Exceptions | Critical items non-waivable; waivers expire | `exceptions.test.ts` |
| Sign-off | Separation of duties; expires on new evidence | `signoff.test.ts` |
| Evidence | Tamper-evident ledger | `evidence.test.ts` |
| Scope | Nothing T4 or above moves | `scope.test.ts` |
| Dual run, cutover, rollback | Two consecutive full-scale passes, a rollback actually performed, staleness limit; two independent sign-offs for cutover | `rehearsal.test.ts`, `observations.test.ts`, `integration/parallel-run.test.ts` |
| Migration Center | 12 stages with DB-trigger gates; owner cannot edit runs or delete approvals | `center.test.ts`, `MigrationCenter.test.tsx`, `supabase/migration-center.check.sql` |

**What is missing:** an extract and load executor (the tooling verifies and gates but moves no data); a caller for `parallel-run.ts` (imported only by its own test); any run against a real institution's data.

**The plan:**

1. **Inventory and classification**: one template per institution naming every system, owner, field, T-tier and business purpose. Output is the Migration Center's inventory.
2. **Extractors**: read-only, one per source family, writing to staging with lineage. First: OneRoster CSV (Phase A above), then a flat-file SIS extract.
3. **Staging and quality**: counts and semantic checks; duplicate handling reversible; exceptions with expiry.
4. **Reconciliation**: scheduled (the current job is never scheduled), discrepancies queued with age and owner.
5. **Dual run**: Semester shadow-computes the domain while the SIS stays authoritative; agreement measured against the institution's threshold.
6. **Cutover**: a date, a rollback plan, two independent sign-offs, a decision per area.
7. **Rollback**: exercised on rehearsal data before the real cutover, inside the window.
8. **Archive, export, retention, offboarding**: exports in open formats; retention per `RETENTION.md`; offboarding through `school_offboarding` (built, not used: no export file generator, no purge, no screen).

First exit evidence: one rehearsal on a design partner's **non-production** extract, with the gate passing or failing for a stated reason, filed under `docs/evidence/migration/`.

## E. Productivity migration

| Item | Today | Gap | Plan |
| --- | --- | --- | --- |
| Calendar export | ICS feed and export round-trip (`export.ts`, `ics.test.ts`, `supabase/functions/calendar`) | none | keep |
| Google and Microsoft calendar | OAuth pull and add (`connect.ts` `pullCalendar`, `addEvent`); scopes pinned (`oauthscopes.test.ts`); fake fetch | Never tested against the real providers; external writes have no preview-and-confirm audit | Provider acceptance run; write preview |
| Apple | Sign-in only; ICS link | No CalDAV | Keep ICS; document the limit |
| Files | Zip export; Drive and OneDrive upload (`deliver.ts`) | Scopes broad (`drive.readonly`, `Files.ReadWrite`); a picker is the narrow route (INT-012) | Picker-based import |
| Tasks | Google Tasks `addTask`; CSV export | No Microsoft To Do import; no import from any external manager | Import adapters; mapping to tasks |
| Notes | Markdown export | No import from Notion, Obsidian and similar | Markdown folder import |
| Identity and permissions | Account sign-in providers | n/a | Follows identity roadmap |
| Portability | `export_my_data()`, `workspace-backup.ts` | Device-held files not exported | Include device-held files in backup |

QTI 3 is a data register only (`itembank.ts` is a native model with no XML import or export); import and export are PL.

## F. AI-provider transition

Seen from the integration side: `InstitutionModelProvider` (`app/server/institution/providers/types.ts`) has one implementation (OpenAI, Responses API, `store:false`, strict JSON schema); the student-facing shared path is Anthropic through `supabase/functions/claude`; the consumer BYO paths call `api.anthropic.com` and `api.openai.com` directly from the browser. There is **no registry, no switch and no cross-provider failover**; `packages/institution/src/routes.ts` encodes route selection and failover rules and is imported by nothing outside tests. The transition design (registry, routing, fallback, spend and data restrictions, evaluation, incident handling) is in [AI_GOVERNANCE_AND_MODEL_ROUTING.md](AI_GOVERNANCE_AND_MODEL_ROUTING.md).

## G. Identity: SAML, OIDC, SCIM

SAML is "BUILT" only in the sense that Supabase Auth validates the assertion (the SAML runbook says "Semester does not parse SAML"); the follow-on checks are Semester's (exactly one active membership, authorized provider, `bind_institution_sso_membership`, SAML without SCIM refused as `missing-membership`). `docs/vanderbilt/identity-scim-acceptance.md` says "BUILT, NOT YET AUTHORIZED OR DEPLOYED". OIDC: schema constrains `provider_type` to `saml`. Plan: a live acceptance run with one design-partner IdP (assertion tampering included), then `provider_type` widened with an OIDC path, then SCIM health and a deprovision notice. No role is assigned by SSO or SCIM: roles come only from the console role-grant duty.

## Sequence

Dependencies decide the order, not the brief's list order.

1. Identity resolution (`person_alias`) and `org_unit`: every later import resolves people and orgs through them.
2. OneRoster Phase A importer wired to the staging tables and the mapping-version registry; first filed rehearsal on a non-production extract.
3. LTI launch audit and AGS idempotency (L1, L3, L4); first real-platform launch (L6).
4. OneRoster Phase B read sync; first non-empty `ADAPTERS`; scheduled reconciliation.
5. Real-provider acceptance for Google and Microsoft calendar.
6. Edu-API after a design partner names an SIS.
7. Controlled write only after reconciliation, rollback and approval exist for the domain.

Test gate for any item above: a conformance fixture (valid and deliberately broken) in CI; a replay produces no duplicates; a failed run lands in the dead-letter queue and is replayable; a freshness miss turns the source state to `official-stale`; the revert of the fix turns the new test red.
