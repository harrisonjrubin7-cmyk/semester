# Developer platform: ecosystem inventory, coverage matrix and build plan

Status of this document: **planning contract.** Nothing listed here is implemented,
tested, deployed, institution-authorized or production-enabled unless a row says so
with evidence. Every row starts at `Proposed`.

Source of truth used:

- The uploaded working specification, "expand outline build detail and deepen
  strengthen semester developer portal" (13 pages). Section numbers below refer to
  it as `S1`–`S10`.
- [`docs/passports/developer-ecosystem.md`](../passports/developer-ecosystem.md),
  the repo's existing system passport. It also says "planning contract only."
- Not found in this repository, so not used as evidence: `DEVELOPER_PLATFORM_AND_MARKETPLACE.md`,
  `Developer Guide.html`, and `Developer and API Terms.html`. The specification cites
  them under a `The Main Semester design system (2) copy/` path that does not exist
  here. See blocker B-1.

## 1. Status vocabulary

| Field | Meaning |
|---|---|
| Designed | A written specification or contract exists in the repo. |
| Implemented | Code exists and runs on this branch. |
| Tested | Automated tests cover the behaviour and pass on the stated commit. |
| Deployed | Running in a named environment. |
| Institution-authorized | A named institution approved the installation. |
| Production-enabled | Live for real institutional data. |

Row status is one of: `Proposed`, `Specified`, `In progress`, `Blocked`,
`Implemented`, `Verified`, `Deployed`.

## 2. Systems and surfaces

| ID | System / surface | Source | Status | Blocker |
|---|---|---|---|---|
| SYS-01 | Developer portal (public library) | S3 | Specified | B-1 |
| SYS-02 | Developer workspace (authenticated) | S3 | Proposed | — |
| SYS-03 | Application registry | S4B | Proposed | — |
| SYS-04 | Permission and authorization center | S4C | Proposed | B-4 |
| SYS-05 | API catalog and explorer | S4D | Proposed | B-3 |
| SYS-06 | Sandbox and fixtures | S4E | Proposed | — |
| SYS-07 | Events and webhook console | S4F | Proposed | — |
| SYS-08 | Certification and publishing | S4G | Proposed | B-2 |
| SYS-09 | Operational diagnostics | S4H | Proposed | — |
| SYS-10 | Extension framework (shared surfaces) | S5 | Proposed | B-5 |
| SYS-11 | Capability register (status tracking) | S10 | Proposed | — |
| SYS-12 | Onboarding and institutional activation | S8 | Proposed | B-2, B-4 |
| SYS-13 | Offboarding (revoke, export, delete, reconcile) | S7, S10 | Proposed | B-6 |
| SYS-14 | Organization audit history | S3 | Proposed | — |

Delivery environments: the spec defines sandbox, staging and production as separate
application environments (`S7`). No environment exists for this platform today.
Device targets are web only in the spec; native clients are not required.

## 3. Public library sections (S3)

| ID | Section | Status |
|---|---|---|
| LIB-01 | Overview | Proposed |
| LIB-02 | Get started (synthetic sandbox quickstart) | Proposed |
| LIB-03 | Concepts (tenants, identity, scopes, provenance, official vs private) | Proposed |
| LIB-04 | API reference | Proposed |
| LIB-05 | Events | Proposed |
| LIB-06 | SDKs and tools | Proposed |
| LIB-07 | Domain guides (planning, learning, registration, advising, tutoring, career, campus life, services) | Proposed |
| LIB-08 | Extension framework | Proposed |
| LIB-09 | AI development | Proposed |
| LIB-10 | Certification | Proposed |
| LIB-11 | Operations | Proposed |
| LIB-12 | Releases | Proposed |
| LIB-13 | Support | Proposed |

## 4. Authenticated workspace screens and routes (S3)

These are proposed labels, not existing routes.

| ID | Screen | Parent | Status |
|---|---|---|---|
| SCR-01 | Developer overview (needs-attention list) | — | Proposed |
| SCR-02 | Organization and members | — | Proposed |
| SCR-03 | Applications list | — | Proposed |
| SCR-04 | Application detail: overview and readiness | SCR-03 | Proposed |
| SCR-05 | Application detail: environments | SCR-03 | Proposed |
| SCR-06 | Application detail: credentials and identity | SCR-03 | Proposed |
| SCR-07 | Application detail: permissions and grants | SCR-03 | Proposed |
| SCR-08 | Application detail: API explorer | SCR-03 | Proposed |
| SCR-09 | Application detail: events and webhooks | SCR-03 | Proposed |
| SCR-10 | Application detail: sandbox fixtures | SCR-03 | Proposed |
| SCR-11 | Application detail: test runs and evidence | SCR-03 | Proposed |
| SCR-12 | Application detail: releases | SCR-03 | Proposed |
| SCR-13 | Application detail: institutional installations | SCR-03 | Proposed |
| SCR-14 | Application detail: usage and diagnostics | SCR-03 | Proposed |
| SCR-15 | Application detail: review findings | SCR-03 | Proposed |
| SCR-16 | Application detail: export and offboarding | SCR-03 | Proposed |
| SCR-17 | Certification submissions | — | Proposed |
| SCR-18 | Institutional approval requests | — | Proposed |
| SCR-19 | Incidents and support | — | Proposed |
| SCR-20 | Organization audit history | — | Proposed |

## 5. Roles and authority

Three roles must stay separate (S2): **organization role** (developer membership),
**application ownership role**, and **institutional approval role**. Owning an
application never grants authority to approve its production installation.

| ID | Role | Allowed | Prohibited |
|---|---|---|---|
| ROL-01 | Internal Semester engineer | Build and operate shared services under internal privileges | Partner access to institutional data |
| ROL-02 | Institutional developer | Integrate systems the institution authorized, inside that tenant and purpose | Access outside the authorized tenant or purpose |
| ROL-03 | Partner | Publish reusable extensions; use sandbox | Institutional data access from publication alone |
| ROL-04 | Student builder | Learn and prototype in synthetic sandbox | Any production or real student data |
| ROL-05 | Institutional administrator | Review and authorize installations and scopes for their institution | Grant rights beyond their institutional authority |
| ROL-06 | Security and privacy reviewer | Assess risk; access evidence through dedicated reviewer permissions | Standing access to student-private data |
| ROL-07 | Support team | Diagnose with redacted diagnostics | Unrestricted impersonation |
| ROL-08 | Developer organization owner / member | Manage org membership and applications | Approve own production installation |

## 6. Modules, functions and business rules

Each module lists its required functions (S4). "Rule" rows are enforced invariants.

| ID | Module | Function | Rule | Status |
|---|---|---|---|---|
| FN-01 | Overview | Show expiring grants and credentials, failing webhooks, certification findings, compatibility changes, activation blockers, assigned support | Tasks feed the existing Action Center, not a new task system; each task has owner, severity, due date, application, environment, resolution action | Proposed |
| FN-02 | Registry | Create immutable application identity with publisher, contacts, purpose, data categories, environments, hosting, retention, accessibility evidence, release and installation history | Application state (draft, sandbox-enabled, review-pending, changes-required, certified, suspended, retired) is separate from release and installation state | Proposed |
| FN-03 | Permissions | Show capability, purpose, data, exclusions, authority, duration, revocation, evidence per permission | Authorization checked per request in order: principal, application, environment, tenant or installation, active grant, resource policy, purpose/data restriction, human approval for consequential actions. A caller-supplied tenant id is never sufficient | Proposed |
| FN-04 | API catalog | Document each capability with version, maturity, environments, permissions, schemas, provenance, pagination, errors, idempotency, audit, synthetic examples, verification evidence | Explorer defaults to sandbox; production needs explicit environment, valid authorization, and a visible action summary for writes; no live secrets or student records in examples | Proposed |
| FN-05 | Sandbox | Deterministic reset, versioned fixtures, scenario seeds | Production cloning off unless separately authorized. Required scenarios: 12 (S4E) | Proposed |
| FN-06 | Events and webhooks | Create and verify subscriptions; pick event types; view schema versions; redacted delivery history; rotate signing material; retry; pause or revoke; dead-letter investigation; reconciliation | Duplicates assumed; no global ordering promise; stable event ids and resource versions; replay and retry recheck authorization and cannot duplicate protected effects; minimal payloads; destination validation blocks internal-network targets | Proposed |
| FN-07 | Certification | Inspectable submission records assessing 10 areas (S4G) | Bound to a release, requested permission set, hosting config and data practices; material change triggers review; marketplace publication and institutional installation are separate decisions | Proposed |
| FN-08 | Diagnostics | Request ids and traces; permission-denial explanations; error classes; redacted metadata; usage; freshness; reconciliation status; rate limits; release-linked trends; admin audit | No raw sensitive payloads; diagnostic access has explicit roles, retention, and its own audit trail | Proposed |
| FN-09 | Activation | Developer onboarding (10 steps) and institutional activation (10 steps) | "Accepted terms", "certified app", "approved installation" and "production-enabled" are never collapsed into one badge | Proposed |
| FN-10 | Capability register | Independent fields per capability: designed, implemented, tested, deployed, institution-authorized, production-enabled; each with evidence, verifier, environment, date | Portal claims must match register evidence | Proposed |

Invariants (S7, each needs an explicit test per entity and workflow):

| ID | Invariant |
|---|---|
| INV-01 | Every tenant-bound record carries enforceable tenant context. |
| INV-02 | Global publisher records do not grant tenant access. |
| INV-03 | Authorization decisions are enforced server-side. |
| INV-04 | Secrets never appear in URLs, exports, logs or analytics. |
| INV-05 | Administrative mutations are audited. |
| INV-06 | Scope expansion does not silently expand existing grants. |
| INV-07 | Revocation blocks new access and queued work. |
| INV-08 | Evidence identifies the release and environment tested. |
| INV-09 | Student-private data cannot be promoted into official records by an extension alone. |

## 7. Canonical entities (S7)

| ID | Entity | Tenant-bound | Owner of record |
|---|---|---|---|
| ENT-01 | Developer organization | No (global publisher) | Semester |
| ENT-02 | Organization membership | No | Semester |
| ENT-03 | Application | No (publisher-scoped) | Semester |
| ENT-04 | Application environment | Yes for installations | Semester |
| ENT-05 | Application release | No | Semester |
| ENT-06 | Permission definition | No | Semester |
| ENT-07 | Permission request | Yes | Semester + institution |
| ENT-08 | Installation | Yes | Institution authorizes; Semester records |
| ENT-09 | Authorization grant | Yes | Institution authorizes |
| ENT-10 | Credential reference | Yes | Semester (secret held in protected store) |
| ENT-11 | Webhook subscription | Yes | Semester |
| ENT-12 | Webhook delivery | Yes | Semester |
| ENT-13 | Test run | No | Semester |
| ENT-14 | Evidence artifact | No | Semester |
| ENT-15 | Review decision | No | Semester security/privacy |
| ENT-16 | Audit event | Yes where tenant-scoped | Semester |
| ENT-17 | Offboarding job | Yes | Semester |

Existing repo tables that may already cover parts of this (inspect before duplicating,
per S9 build step 1): `supabase/migrations/*integration_control_plane*`,
`*console_control_plane*`, `*console_approvals_and_break_glass*`,
`*integration_hardening*`, `*integration_governance_writes*`, and
`app/src/lib/ops/decisionlog.test.ts` for the decision-record rules. Not yet reviewed
in this pass; this is a recorded gap, not a reuse decision.

## 8. APIs, events, jobs and integrations

| ID | Item | Status |
|---|---|---|
| API-01 | Versioned public API for the synthetic workflow (create application, provision sandbox, scoped request) | Proposed |
| API-02 | Developer identity via Semester account, OAuth/OIDC for clients | Proposed (B-4) |
| API-03 | Service accounts and API credentials | Proposed |
| EVT-01 | `api_client.created`, `credential.rotated`, `webhook.delivered`, `partner.approved`, `client.suspended` (from passport) | Proposed |
| JOB-01 | Webhook delivery with retry and dead-letter | Proposed |
| JOB-02 | Revocation propagation to queued work and retries | Proposed |
| JOB-03 | Reconciliation after missed delivery | Proposed |
| INT-01 | API gateway, outbox, partner systems (from passport) | Proposed |
| INT-02 | Action Center, search, notifications, education graph, AI gateway (S5) | Proposed (B-5) |

## 9. Shared platform capabilities

Account, Action Center, Search, Workspace navigation, Education graph, Design system,
AI gateway, Notifications (S5). Each extension contract needs isolation, session and
focus rules before any embedded or external extension can install.

AI rule (S6): the spec says "no student records to AI." Until an approved policy
changes that, the portal enforces it. Status: Proposed, blocked by B-6.

## 10. Domain coverage (S6)

Ten domains are kept in the catalogue and activated one by one: Planning, Learning,
Registration, Advising, Tutoring, Career, Campus life, Services, Administration, AI.
Each domain has an integration opportunity and a critical boundary (for example:
registration changes need designated authority; advising notes stay private). Domain
authority is a separate activation gate that needs institutional approval and
reconciliation evidence. Installing an integration never activates authority.

## 11. Acceptance criteria (S10)

| ID | Criterion | Status |
|---|---|---|
| AC-01 | Developer completes the synthetic quickstart using only the published guide | Not started |
| AC-02 | Cross-tenant access fails in APIs, DB policies, event delivery, search and diagnostics | Not started |
| AC-03 | Sandbox credentials cannot reach production | Not started |
| AC-04 | Revoked grants block new requests, queued jobs, retries and replay | Not started |
| AC-05 | Sensitive records and credentials absent from examples and operational logs | Not started |
| AC-06 | Permission expansion needs a new approval decision | Not started |
| AC-07 | Duplicate events do not duplicate protected effects | Not started |
| AC-08 | Failed imports reconcile without silently changing authority | Not started |
| AC-09 | Certification evidence matches the release installed | Not started |
| AC-10 | Uninstall revokes access and tracks downstream deletion separately | Not started |
| AC-11 | Keyboard and assistive-technology workflows pass documented review | Not started |
| AC-12 | Portal claims match verified capability evidence | Not started |

## 12. Workstreams (S9)

| ID | Workstream | Accountable (proposed role) | Status |
|---|---|---|---|
| WS-01 | Existing-work inventory | Platform engineering | In progress (this document, partial) |
| WS-02 | Portal shell and shared surfaces | Product design + frontend | Proposed |
| WS-03 | App registry and membership | Platform engineering | Proposed |
| WS-04 | API contracts | Domain engineering | Proposed |
| WS-05 | Sandbox | Developer experience | Proposed |
| WS-06 | Grants and credentials | Security + platform | Proposed |
| WS-07 | Webhooks | Platform operations | Proposed |
| WS-08 | Certification | Security + partnerships | Proposed |
| WS-09 | Institutional activation | Implementation lead | Blocked (B-4) |
| WS-10 | Publishing and support | Partnerships + operations | Blocked (B-2) |

Owners are proposed roles. No person is assigned by this document.

## 13. Build plan (phased, vertical slices)

Phases are an execution order. Every phase keeps the full v1 design in scope.

| Phase | Slice | Exit evidence | Status |
|---|---|---|---|
| P0 | Inventory, coverage matrix, decision record | This document; decision record per `docs/decisions/README.md` | In progress |
| P1 | Identity, tenant context, application registry, audit event | Migrations with RLS; cross-tenant tests for INV-01 to INV-05 | Proposed |
| P2 | Synthetic sandbox with deterministic fixtures and reset | Reset test; sandbox-to-production isolation test (AC-03) | Proposed |
| P3 | **First vertical workflow** (below) | End-to-end test of the seven steps | Proposed |
| P4 | Grants, credential references, revocation propagation | Revocation tests across API, queue, retry, replay (AC-04) | Proposed |
| P5 | Webhook console: outbox, delivery, replay guard, dead-letter, reconciliation | Duplicate and replay tests (AC-07) | Proposed |
| P6 | Diagnostics and evidence records | Redaction tests (AC-05); release-linked evidence (AC-09) | Proposed |
| P7 | Certification and review decisions | Reproducible decision record | Blocked (B-2) |
| P8 | Institutional activation pilot | Named approver; reconciliation (AC-08) | Blocked (B-4) |
| P9 | Domain expansion through shared contracts | Contract tests per domain | Blocked (B-6) |

**First vertical workflow (S10, P3):** application creation → synthetic sandbox →
narrowly scoped request → event delivery → failure diagnosis → grant revocation →
evidence-backed review.

## 14. Blockers and decisions required

| ID | Blocker | Affects | Owner (proposed) | Needed to unblock |
|---|---|---|---|---|
| B-1 | Three cited source documents are not in this repository (`DEVELOPER_PLATFORM_AND_MARKETPLACE.md`, `Developer Guide.html`, `Developer and API Terms.html`). Live implementation status is therefore unverified. | SYS-01, all "existing work" claims | Platform engineering | Add the documents to the repo or confirm the canonical location. |
| B-2 | Developer and API Terms contain unresolved placeholders (deletion timelines, deprecation notice, incident reporting). | SYS-08, SYS-12, P7 | Legal + partnerships | Approved terms with operational timelines. |
| B-3 | No public API contract is established in reviewed evidence. | SYS-05, API-01 | API owners | Versioned contract and tests. |
| B-4 | Institutional authority model is unspecified: who approves installations, and under which policy. | SYS-04, SYS-12, P8 | Institutional implementation lead | Named approver and documented authority. |
| B-5 | Shared-surface contracts (Action Center, search, AI gateway) are not defined as callable interfaces in this repo. | SYS-10, INT-02 | Platform engineering | Contract definitions per surface. |
| B-6 | AI data policy ("no student records to AI") needs enforcement tests and an approved boundary. | Section 9, P9 | Security + AI governance | Policy tests and approved data boundaries. |
| B-7 | No deployment target, hosting, or credentials for a staging environment have been authorized for this work. | Deployment, P3 onward | User / platform owner | Named staging target and approval. |

Decisions the user has not yet made (these change scope, so they are not assumed):

1. Whether the developer portal lives in the existing `app/` React application or a
   new `packages/` workspace.
2. Whether the first synthetic workflow runs on the existing Supabase project (new
   migrations) or a separate project.
3. Whether to reuse the existing integration and console control-plane tables (P1)
   or add new ones, pending the inspection noted in section 7.

## 15. Verification status

- This document: documentation only. No code changed. No tests were run for it.
- No build, lint, typecheck, or deployment has been run for the developer platform.
- Deployment status: **not deployed.** Production deployment requires approval, and
  B-7 blocks even staging.

## 16. Next executable task

Inspect the Supabase migrations and control-plane tables listed in section 7, then
write the P1 identity and tenant-isolation migration and its tests on this branch.
This is blocked from production only by B-4 and B-7; a local migration and tests can
proceed.
