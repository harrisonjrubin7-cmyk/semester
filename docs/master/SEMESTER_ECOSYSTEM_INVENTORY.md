# Semester ecosystem inventory

**As of** 11 October 2026 · **Row-level status** [`SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md`](SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md) (rendered, re-checked against the tree on every render) · **Plan** [`SEMESTER_ECOSYSTEM_BUILD_PLAN.md`](SEMESTER_ECOSYSTEM_BUILD_PLAN.md)

> **Claim ceiling.** This page lists what Semester is, from evidence in the repository and in the design project (copied, unchanged, into [`design-inputs/`](design-inputs/)). It invents no scope. Where the two disagree the repository wins, per [`SEMESTER_SOURCE_OF_TRUTH.md`](SEMESTER_SOURCE_OF_TRUTH.md). Counts below were measured on 11 October 2026; the matrix is the place a count is kept current.

The matrix holds one row per item, with the fifteen columns the build brief asks for: identifier, system, workspace, module, user role, screen or workflow, required behavior, data dependencies, permissions, integration dependencies, acceptance criteria, implementation status, verification evidence, deployment status and blockers. This page is the map that says what the rows are rows *of*.

## 1. Product operating systems

Semester describes itself as **one governed operating system for education** ([`design-inputs/SEMESTER_OS_MASTER_MAP.md`](design-inputs/SEMESTER_OS_MASTER_MAP.md)). It has 21 layers. In this inventory, "every OS" means these 21 layers. It does not mean device operating systems; those are in §2.

Every layer runs through one control chain: identity → tenant → membership → role → capability → scope → policy → data classification → consent → source authority → workflow → audit → evidence → outcome.

| # | Layer | Purpose (catalog wording, shortened) | Screen group | Workflows | Modules |
| ---: | --- | --- | --- | --- | ---: |
| 1 | Public company and growth | Public site, pilot pages, trust centre, contact | A | — | 9 |
| 2 | Identity, tenant, policy and trust foundation | SSO, SCIM, memberships, roles, capabilities, policy, consent, audit | K, M | Institution implementation | 11 |
| 3 | Student OS | Today, actions, calendar, path, registration readiness, courses | B | Student journey | 30 |
| 4 | Productivity and collaboration workspace | Notes, documents, projects, group workspaces, focus | B | Student journey | 15 |
| 5 | Academic path and degree planning | Program, requirements, degree audit, transfer credit, holds | B, E | Student journey, Registrar | 16 |
| 6 | Course Studio and learning OS | Syllabus, assignments, assessments, rubrics, gradebook | C | Faculty course lifecycle | 25 |
| 7 | Governed AI and intelligence | Copilot, tutor, advisor and staff assistants behind one gateway | none catalogued | Governed AI request | 26 |
| 8 | Advising, student success and support | Caseload, check-ins, success plans, referrals, escalation | D | Advising, Support request | 16 |
| 9 | Registrar, SIS and academic operations | Calendar, catalog, sections, enrollment, holds, records | E | Registrar & academic operations | 30 |
| 10 | Student accounts, billing and finance | Charges, holds, payment plans, aid handoff, reconciliation | F | Student finance & payment | 16 |
| 11 | Campus life and services | Dining, housing, events, transit, library, safety | G | Campus services | 16 |
| 12 | Community and peer connection | Feed, groups, mentoring, reporting, moderation, appeals | H | Community & moderation | 16 |
| 13 | Career, alumni, employer, lifelong learning | Skills, evidence, credentials, opportunities, mentors | J | Career, employer & alumni | 19 |
| 14 | Family and guardian consent | Student-scoped, time-limited, audited family access | I | Family & guardian consent | 11 |
| 15 | Institutional administration and control plane | Tenant, policies, cohorts, kill switches, configuration | K | Institution implementation | 35 |
| 16 | Integration, migration and interoperability | Connections, mapping, sync, dead letters, reconciliation | L | Controlled integration, Domain migration | 26 |
| 17 | Security, privacy, accessibility, compliance, trust | Trust centre, privacy requests, incidents, accessibility | M | Incident response | 32 |
| 18 | Operations command center | Inbox, approvals, tenants, support, break-glass, audit | N | Incident response, Support request | 41 |
| 19 | Revenue, GTM, customer success, company ops | Sales, pilots, renewals, billing, finance | N | Institution implementation, Analytics | 30 |
| 20 | Developer platform and marketplace | API, OAuth, webhooks, sandbox, app review | none catalogued | Developer platform & marketplace | 19 |
| 21 | Analytics, outcomes and reliability | KPIs, pilot outcomes, SLOs, release evidence | N | Analytics, outcomes & reliability | 10 |

Total: **449 modules**. The matrix's "Modules" section has one row for each module. A module whose name matches a catalogued screen takes that screen's status. The other **278** are `proposed`: the catalog names them, and no screen of that name exists to judge them by. That number measures how much of the module list is still prose. It does not measure missing code. Several of these modules are built under other names; the 56 screen files no catalog row cites are listed in `REPO_AUDIT.md`.

## 2. Applications and delivery environments

| Application | Where | Delivery | Status |
| --- | --- | --- | --- |
| Semester app: student, staff and console in one SPA | `app/` (Vite, React, hash router; 95 router keys in `screens.tsx`; 7 navigation areas in `lib/navareas.ts`) | Web and installable PWA | Built. Vercel project `semester`, previews on every branch |
| Institution gateway | `app/server/`, `app/api/` (57 handler files), `packages/institution` | Vercel service `api` (`vercel.json`) | Built. Typechecked by `check:university` |
| Supabase back end | `supabase/migrations/` (231 files), `supabase/functions/` (17 edge functions) | Supabase project `lzrqvlug…` (primary, per the source-of-truth page) | Schema built, RLS on every public table. Which migrations are applied remotely is **not verified** in this session |
| Public company site | `company-site/` | Vercel project `semester-company-site` | Built |
| Course Engine | `course-engine/apps/{web,api,worker}` | Vercel projects `web`, `api` | Built as a separate workspace. How it relates to the app's course import is not yet recorded as a decision |
| Shared packages | `packages/{contract,institution,offline-sync,platform,platform-control}` | Libraries | Built |
| Video, pipeline, workflow-lab | `video/`, `pipeline/`, `workflow-lab/` | Tooling, with their own manifests | Not product surfaces |

**Device operating systems.** The repository delivers the product to the browser and as a PWA. **No native iOS, Android, macOS or Windows client is confirmed**: the design project has native-platform documents (`docs/native-platform/`, handoff streams 14–17), and the mainframe backlog lists native apps as "not in this backlog yet". This inventory treats native clients as **proposed, not confirmed** (question Q2). The supported environments are therefore current evergreen browsers on desktop and mobile, at widths from 320px (`lib/media.ts`).

## 3. Workspace types and who owns them

| Workspace | Owner | Isolation as built |
| --- | --- | --- |
| Personal (self-serve student) | The account (`auth.uid()`) | Row ownership in RLS; device-local state for unsigned use |
| Institution tenant | The institution (`school_id`, `institution_membership`) | `private.school_of()`, `has_capability(cap, scope_kind, scope_id)`. Three membership sources, not yet unified (RG-02). `enforce_membership` is off by default (RG-07) |
| Course | The institution, delegated to faculty through a course scope (`school/CODE`) | Course scope has no tenant column of its own (`docs/roles/ROLE_CAPABILITY_MATRIX.md`) |
| Organization or club | The student organization, inside the tenant | Per-feature tables |
| Family view | The student. Family access is a scoped grant the student can revoke | `family_grants`, consent records |
| Semester company console (`/ops`) | Semester the company | `console_duty`, `approval_request`, `break_glass_grant`; no student rows (`console-no-student-rows.check.sql`) |

## 4. Roles

**Product roles, from evidence.** `app_roles` holds **69** database roles. They are grouped in [`../ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md) as student and learner, academic and support, campus offices, institutional administration, Semester platform operations, external and partner, and student organizations. The brief's own role names map onto them in [`../roles/ROLE_CATALOG.md`](../roles/ROLE_CATALOG.md). The design catalog's 49 roles are in [`design-inputs/SEMESTER_ROLE_CATALOG.md`](design-inputs/SEMESTER_ROLE_CATALOG.md), and 13 of them have no workflow.

**Allowed and prohibited actions.** Each role row in the matrix carries the register's "must be able to" and "must never" columns, and the capabilities the role actually holds. Anything not granted is denied by default by `private.has_capability`. Seven roles hold no capability at all (RG-21).

**Ladder.** 23 of the 69 roles are usable, meaning they have role-specific screens and workflows. The other 46 can be provisioned but have no screen of their own yet. **No role is launch-approved.**

These are the roles of people who use Semester. The seventeen responsibilities in the build brief (product lead through documentation owner) describe how the build is done. They are not product roles, and none of them appears in the matrix as one.

## 5. Screens, routes and navigation

- **Catalogued:** 589 screens in 14 groups (A–N) in [`SEMESTER_SCREEN_CATALOG.md`](SEMESTER_SCREEN_CATALOG.md). The design project has since added 84 workflow-gap screens, for 673; those 84 have not been audited against the repo.
- **Built:** 95 router keys; 63 navigation destinations in `lib/nav.ts`; 119 screen files. 56 of those screen files are student-side surfaces that no catalog row cites.
- **Status:** one row per catalogued screen, in the matrix.

## 6. Functions, forms and business rules

These are carried on the workflow steps. Each of the 319 steps names its kind (form, review, decide, sync, notify, milestone), its capability, its data classification, its consent rule, its source of authority and its audit event ([`SEMESTER_WORKFLOW_CATALOG.md`](SEMESTER_WORKFLOW_CATALOG.md)). Rules enforced in the database are listed in [`SEMESTER_RPC_EXPOSURE_CLASSIFICATION.md`](SEMESTER_RPC_EXPOSURE_CLASSIFICATION.md) and in the `*.check.sql` authorization tests.

## 7. End-to-end and cross-module workflows

There are 17 workflows with 319 steps, each a row in the matrix. There are also 8 journeys that run across layers: core student journey, student daily loop, learning flow, registration, operations action model, family consent, learner lifecycle and institution lifecycle (OS map, "Journeys"). The cross-module links are traced step by step in [`design-inputs/SEMESTER_TRACEABILITY_MATRIX.md`](design-inputs/SEMESTER_TRACEABILITY_MATRIX.md).

## 8. Canonical entities and relationships

There are about 230 public tables, all with RLS. Their domains are listed in [`SEMESTER_MASTER_CURRENT_STATE.md`](SEMESTER_MASTER_CURRENT_STATE.md) §4. Which system is the authority for each entity is set in [`SEMESTER_DATA_AUTHORITY_MATRIX.md`](SEMESTER_DATA_AUTHORITY_MATRIX.md) and [`../mainframe/CANONICAL_DATA_AND_AUTHORITY.md`](../mainframe/CANONICAL_DATA_AND_AUTHORITY.md).

Most operational tables hold 0 rows: the schema is ahead of the data.

## 9. APIs, events, jobs and integrations

- **Edge functions (17):** `billing-cancel`, `billing-checkout`, `billing-portal`, `billing-webhook`, `calendar`, `canvas`, `claude`, `delete-account`, `fetchcal`, `integration-tick`, `lead-intake`, `lti`, `ops-projector`, `productivity-sourcecheck`, `push`, `support-reply-notify`, `trust-room`.
- **Gateway:** `app/server/{institution,integration,productivity,course-sources}`, exposed through `app/api/`.
- **Events:**
  - `private.domain_outbox_events` (with idempotency and a dead-letter column) and `private.domain_event_receipts`.
  - `ops-projector` exists. The 5 October current-state page reported no projection worker; that line is now stale. Whether `ops-projector` meets the requirement has not been re-audited (see the plan, F-3).
  - Every workflow step names an audit event.
- **Integrations:**
  - Contracted in [`design-inputs/SEMESTER_INTEGRATION_CATALOG.md`](design-inputs/SEMESTER_INTEGRATION_CATALOG.md) and `docs/INTEGRATION-PERMISSION-MATRIX.md`.
  - Live connectors in code: LTI, Canvas, calendar feeds (.ics), Microsoft and Google sign-in and productivity, Stripe billing, Anthropic and OpenAI through the AI gateway.

## 10. Shared platform capabilities

Identity and SSO, tenancy, the capability check, consent, the audit chain, feature policy and kill switches, the outbox, search (`lib/search.ts`), notifications (`push`, `support-reply-notify`), files, the AI gateway, the design system (`lib/look.ts` → `styles/tokens.css`), and offline sync (`packages/offline-sync`).

## 11. Operational and administrative requirements

- **Release gates.** The 22-point completion definition ([`design-inputs/SEMESTER_RELEASE_GATE_CATALOG.md`](design-inputs/SEMESTER_RELEASE_GATE_CATALOG.md)) and [`../mainframe/TEST_AND_RELEASE_GATES.md`](../mainframe/TEST_AND_RELEASE_GATES.md).
- **Operations.** Duties, approvals and break-glass ([`../operations/OPERATIONS_ROADMAP.md`](../operations/OPERATIONS_ROADMAP.md)).
- **Founder-only steps.** DPA and FERPA addendum, insurance, HECVAT, attorney review, and naming institution contacts. No agent can do these.

## 12. Missing authoritative scope: focused questions

Only questions whose answers change scope, architecture, cost or data ownership are listed. Each has the default the build follows until it is answered.

| # | Question | Default until answered |
| --- | --- | --- |
| Q1 | Is the 21-layer OS map the confirmed scope, or a vision of which only the pilot cut (Registration Readiness, layers 2, 3, 5, 8, 9) is confirmed for now? | Build in pilot-cut order. Keep every other layer in the matrix as `specified` or `proposed`, never dropped |
| Q2 | Are native mobile or desktop clients confirmed? | Not confirmed. Web and PWA only, per the mainframe backlog |
| Q3 | Are billing (layer 10's charges and payments) and Semester's own subscription billing (`billing-*` functions) in scope for the pilot? | Payment actions stay handoffs to the official system. No charge is made from Semester |
| Q4 | Is Course Engine part of the product or a separate experiment? | Separate. Not counted in the matrix |
| Q5 | The open operations decisions OD-1 to OD-9 ([`../operations/OPERATIONS_ROADMAP.md`](../operations/OPERATIONS_ROADMAP.md)) | Each blocks what that table says it blocks. Nothing that depends on one is built past it |
| Q6 | The design project's 84 added screens: should they be audited and brought into the repo catalog? | Yes, as a later documentation slice. Until then they are not counted |

## 13. Blockers that only a person can clear

- **Credentials and access.** The remote Supabase project, Vercel production promotion, and an institution's SSO metadata. This session has no production access and will not ask for it without a specific approval.
- **Approvals.** Any remote migration, production deploy, charge, or external message.
- **People.** A second approver for two-person duties (OD-5), and named institution contacts.
