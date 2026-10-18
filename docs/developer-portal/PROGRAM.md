# Developer portal: program inventory, coverage, plan and status

Source: the uploaded specification "Build a comprehensive semester developer portal with detailed module specs, API docs, and architecture guides" (24 pages, extracted for this review). Section numbers below (§) refer to it.

Scope: Developer Console (applications, APIs, permissions, certification, operations) and Learning Studio (16-week software engineering curriculum, labs, templates, feedback, assessment), sharing one account and governance foundation.

## 1. Status at a glance

| Layer | Status |
|---|---|
| Specification | Written (proposed). Its own text says every route, entity and snippet is proposed and that no repository, database or deployment was changed. |
| Lifecycle transitions (application, release, installation) | **Verified in the repository** (`app/src/lib/developer-portal/lifecycle.ts`, 15 tests, typecheck and lint pass). Library only: no route, storage, UI or authorization yet. |
| Everything else in §3–§10 | Proposed. Not implemented. |
| Deployment | **Not deployed.** No staging or production target is defined for this portal, and no deployment access was verified. |
| Operational readiness | Not started. |

Status vocabulary follows §11: *Proposed* (in the spec, no code), *Specified* (spec gives detailed behaviour), *Verified* (code plus repository checks), *Blocked* (cannot advance without a named decision or external input), *Deployed* (none).

## 2. Source verification

- The spec cites `docs/platform/DEVELOPER_PLATFORM_AND_MARKETPLACE.md`, `docs/guides/Developer Guide.html` and `docs/legal/Developer and API Terms.html`. **None of these exist in this repository.** The 16-step certification workflow in §6 is therefore the spec's *proposal*, not a verified copy of the original. Blocker B-07.
- The repository already contains adjacent material: `app/src/lib/governance/certification.ts` (Semester's own release certification, a different subject), `docs/handoff/PORTALS-SPEC.md` (portal operating modes), `docs/platform/CONTRACT-STACK.md` (shared contracts), and `docs/developers/` (developer how-tos). None of them implements the developer portal, and the lifecycle module does not duplicate them.
- Checked origin/main before writing (`git log -40 origin/main` for portal, developer, lifecycle, certification and idempotency terms): no developer-portal lifecycle had landed.

## 3. Master inventory and coverage matrix

Columns are condensed. "Required behaviour, data, permissions, integration and acceptance criteria" are in the cited § and are not repeated here. The statuses are the ones the matrix is held to.

### 3.1 Products, delivery environments and devices

| ID | Item | Status | Evidence / blocker |
|---|---|---|---|
| PR-01 | Developer Console (web) | Proposed | §2. Built inside the existing responsive web app would be the natural home (Q-12). |
| PR-02 | Learning Studio (web) | Proposed | §8. Same question as PR-01. |
| PR-03 | Browser, responsive, 320px minimum | Proposed | §3.1 acceptance criteria; repo responsive contracts apply. |
| PR-04 | Native mobile or desktop clients | Not confirmed | The spec names "public native client" only as an OAuth profile (§5.2). Not required by the spec; not built (Q-11). |
| PR-05 | Device OS matrix | Not confirmed | The spec does not define one. |

### 3.2 Workspaces and ownership

| ID | Item | Status | Evidence / blocker |
|---|---|---|---|
| WS-01 | Shared shell: organization, institution, application and environment switchers; environment label | Proposed | §3.1 |
| WS-02 | Action Center: expiring grants, failed deliveries, review findings, compatibility changes | Proposed | §3.1. Task sources are not defined. |
| WS-03 | Permission-aware search (documentation and authorized records) | Proposed | §3.1, §5.4. Index isolation design needed. |
| WS-04 | Capability status labels linked to evidence | Proposed | §3.1 |

### 3.3 Roles and their controls

| ID | Role / control | Status | Evidence / blocker |
|---|---|---|---|
| RL-01 | Organization owner | Proposed | §3.2. Final-owner removal guard and reauthentication for high-risk changes are specified. |
| RL-02 | Application maintainer | Proposed | §3.2 |
| RL-03 | Documentation contributor | Proposed | §3.2 |
| RL-04 | Support operator (diagnostics need separate authorization) | Proposed | §3.2, §3.7 |
| RL-05 | Security reviewer (assigned reviews only) | Proposed | §3.2 |
| RL-06 | Institutional approver (separate from publisher ownership) | Proposed | §3.2, §2 decision 3 |
| RL-07 | Instructor, teaching assistant, learner | Proposed | §3.2, §3.8. Instructors see authorized submissions, not every private draft. |
| RL-08 | Workflow owners named in §6 (partner product lead, partner engineer, privacy reviewer, platform, accessibility reviewer, operations, review panel, institution) | Proposed | §6. A permission for each is not specified. |
| RL-09 | Role × action allow/deny matrix | **Blocked** | Not in the spec. Decision Q-5. |

### 3.4 Developer Console modules

| ID | Module | Status | Evidence / blocker |
|---|---|---|---|
| DC-01 | Application registry (identity, purpose, owners, data categories, permissions, environments, hosting, retention, releases, installations, export and uninstall) | Proposed | §3.3. No schema or storage yet. |
| DC-02 | Application lifecycle: draft → sandbox-enabled → active → suspended → retired | **Verified** (transitions) | `lifecycle.ts`, tests. Reinstatement not specified (Q-1). |
| DC-03 | Release lifecycle: draft → submitted → changes-required → certified → withdrawn | **Verified** (transitions) | Resubmission path is inferred (Q-2). |
| DC-04 | Installation lifecycle: requested → approved → pilot → enabled → revoked → offboarded | **Verified** (transitions) | Requested → revoked is inferred (Q-3). |
| DC-05 | Rule: installation approval only for a certified release | **Verified** | `canApproveInstallation`; publication does not authorize installation (§6). |
| DC-06 | Documentation and API explorer (11 required sections; synthetic by default; examples run in CI) | Proposed | §3.4. Blocked on B-01. |
| DC-07 | Synthetic environments: provisioning, versioned fixtures, reproducible reset, failure injection, configuration diff, revocation | Proposed | §3.5. Isolation of DB, credentials, events, storage, caches and search needed (B-05). |
| DC-08 | Nine fixture scenarios (overlapping identifiers, revoked users and grants, stale data, conflicting deadlines, partial import, duplicate or out-of-order events, unavailable connector, time-zone transitions, private drafts vs submissions) | Proposed | §3.5 |
| DC-09 | Grants: record fields, request, read, revoke, expiry, policy version | Proposed | §3.6, §4.1 |
| DC-10 | Credential console: metadata only, one-time secret display, rotation with bounded overlap, audit | Proposed | §3.6. Overlap bound undecided (Q-7). |
| DC-11 | Events and diagnostics: verification, selection, redacted history, signature rotation, retry, replay, dead-letter, reconciliation | Proposed | §3.7. Diagnostic access policy undecided (Q-9). |
| DC-12 | Certification workflow (16 steps, owners, evidence) | Proposed | §6. Source document missing (B-07). |
| DC-13 | Certification decision: six outcomes, binding to artifact, permissions, hosting, data practices, dependencies, expiry; signed decision | Proposed | §6. Panel and approved policy needed (B-02). |
| DC-14 | Institutional pilot approval and pilot reconciliation | Proposed | §6 steps 15–16. Needs an institution (B-08). |
| DC-15 | Offboarding: export, deletion, downstream acknowledgment tracked separately | Proposed | §5.7. Retention and deletion timelines need attorney review (B-03). |
| DC-16 | Immutable release artifact with digest and dependency inventory | Proposed | §6 step 13. Build system not yet defined. |

### 3.5 Learning Studio modules

| ID | Module | Status | Evidence / blocker |
|---|---|---|---|
| LS-01 | Course overview and outcomes | Specified | §8 |
| LS-02 | Weekly lesson and lab (16 weeks; outline in §5 below) | Specified (outline only) | §8. Lesson content not written (B-09). |
| LS-03 | Lab workspace with versioned starter templates | Proposed | §8, §9. Templates not written. |
| LS-04 | Standard lab specification (12 required elements) | Specified | §8. Applies to each lab. |
| LS-05 | Lab submission: immutable or content-addressed artifact, server-computed attempt number, assessment queued only after durable acceptance | Proposed | §4.3 |
| LS-06 | Isolated assessment runner (no learner code in portal process; network off; limits; hidden tests inaccessible) | Proposed | §10. Runner infrastructure and security review needed. |
| LS-07 | Automated test results and sanitized output | Proposed | §10 |
| LS-08 | Instructor feedback and rubric evaluation | Specified | §9.3, §9.4 |
| LS-09 | Grade publication and appeal | **Blocked** | §3.8: only through institution-authorized workflow. The workflow is not defined (Q-10). |
| LS-10 | Private drafts kept separate from official records and grades | Proposed | §2 decision 5, §3.8 |
| LS-11 | Student-controlled portfolio publication (separate from submission) | Proposed | §3.8, §10 |
| LS-12 | Capstone: synthetic Semester extension (planning task, events, accessible interface, certification evidence) | Specified | §8, §9.4 |

### 3.6 API operations (candidate, not endpoints)

All thirteen are **Proposed** and **Blocked** on the approved OpenAPI contract (B-01).

| ID | Operation | Path | Permission |
|---|---|---|---|
| API-01 | List owned applications | `GET /v1/apps` | apps:read |
| API-02 | Create application | `POST /v1/apps` | apps:write |
| API-03 | Read environment | `GET /v1/apps/{appId}/environments/{environmentId}` | environments:read |
| API-04 | Request grant | `POST /v1/installations/{installationId}/grant-requests` | grants:request |
| API-05 | Read grant | `GET /v1/grants/{grantId}` | grants:read |
| API-06 | Revoke grant | `POST /v1/grants/{grantId}/revocations` | grants:revoke |
| API-07 | List authorized planning tasks | `GET /v1/planning/tasks` | planning.tasks:read |
| API-08 | Register webhook subscription | `POST /v1/webhook-subscriptions` | webhooks:write |
| API-09 | Inspect deliveries | `GET /v1/webhook-subscriptions/{id}/deliveries` | webhooks:read |
| API-10 | Submit certification | `POST /v1/apps/{appId}/certification-submissions` | certification:submit |
| API-11 | List curriculum modules | `GET /v1/courses/{courseId}/modules` | learning.modules:read |
| API-12 | Submit lab attempt | `POST /v1/labs/{labId}/submissions` | learning.submissions:write |
| API-13 | Read assessment | `GET /v1/submissions/{submissionId}/assessment` | learning.assessments:read |

### 3.7 Shared platform capabilities

| ID | Capability | Status | Evidence / blocker |
|---|---|---|---|
| PF-01 | Identity: reuse the Semester identity; server-managed session via backend-for-frontend | Proposed | §5.2. Provider for developer accounts undecided (B-04). |
| PF-02 | Public native clients via Authorization Code with PKCE; confidential clients add client authentication | Proposed | §5.2. Exact redirect matching; no implicit or password grants. |
| PF-03 | Token validation: allowed algorithms, trusted issuer, audience, environment binding, controlled key discovery | Proposed | §5.3 |
| PF-04 | Gateway pipeline (12 steps; coarse policy at gateway, object and field policy in domain service and database) | Proposed | §5.1 |
| PF-05 | Authorization: scope vocabulary, resource policy, grants, purpose; a scope never authorizes an arbitrary object | Proposed | §4.1, §9.1. Authorization function is a teaching model only. |
| PF-06 | Tenant isolation: keys, cursors, row-level policies, storage URLs, search, worker reauthorization | Proposed | §5.4 |
| PF-07 | Error contract and status mapping (400–503) | Proposed | §4.4. Envelope is typed; mapping not implemented. |
| PF-08 | Idempotency: key bound to principal, application, tenant, environment, operation and request digest; atomic reservation | Proposed | §4.5. Retention window undecided (Q-6). |
| PF-09 | Redacted structured logs and telemetry; no secrets or student payloads | Proposed | §5.5 |
| PF-10 | Audit records and transactional outbox; a mutation without audit commit does not proceed | Proposed | §5.1, §5.7 |
| PF-11 | Webhook egress: approved schemes and ports, destination validation at registration and delivery, no private or metadata addresses, DNS-rebinding defence, no redirects, size and time limits | Proposed | §5.6 |
| PF-12 | Revocation: disable access, invalidate caches, stop tokens, block jobs and replays, pause subscriptions, start export or deletion, track acknowledgment | Proposed | §5.7. Propagation targets undefined (Q-8). |
| PF-13 | Fail-closed on authorization dependency failure | Proposed | §5.7 |
| PF-14 | AI boundary: no student records to AI; AI cannot grant permissions, certify partners, publish grades or change registration records | Proposed | §5.8 |
| PF-15 | Event delivery with dedupe, ordering limits, retries and reconciliation | Proposed | Architecture guide list §2 |
| PF-16 | Versioned API and event schemas; additive-change compatibility | Proposed | §4.2 |

### 3.8 SDK

| ID | Item | Status | Evidence / blocker |
|---|---|---|---|
| SDK-01 | Five packages: `@semester/sdk`, `@semester/sdk-server`, `@semester/contracts`, `@semester/testing`, `@semester/react` | Proposed | §7.1. Names are proposed; nothing published. |
| SDK-02 | Strict type configuration (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, useUnknownInCatchVariables, noImplicitOverride) | Proposed | §7.2. Existing app tsconfig already sets several; the rest needs a deliberate change. |
| SDK-03 | Generated transport types from one approved contract | **Blocked** | B-01 |
| SDK-04 | Client behaviour: injected token provider, no automatic persistence, cancellation, timeouts, retries only for documented transient errors, idempotency required for retried writes, bounded retries | Proposed | §7.3 |

### 3.9 Integrations and external dependencies

| ID | Item | Status | Evidence / blocker |
|---|---|---|---|
| IN-01 | Governed adapters for approved institutional connectors | **Blocked** | No connector is named in the spec. Institutional approval gate (§2). |
| IN-02 | Third-party subprocessors declared per application | Proposed | §3.3, §6 |
| IN-03 | Outbound webhook delivery | Proposed | PF-11 |

### 3.10 Operations, administration and compliance

| ID | Item | Status | Evidence / blocker |
|---|---|---|---|
| OP-01 | Architecture guide library (10 guides, each with owner, review date, version, evidence links, unresolved decisions) | Proposed | §2. No guide written. Owners unassigned. |
| OP-02 | Deployment: configuration, secrets, staging, promotion, rollback | Proposed | §2 guide list. No target defined (B-06). |
| OP-03 | Monitoring, backups, restore drills, runbooks | Proposed | §11. |
| OP-04 | Incident recovery: suspension, evidence preservation, reconciliation, restoration | Proposed | §5.7 |
| OP-05 | Threat model, security tests, abuse tests | Proposed | §11, §13 curriculum week. Reviewer needed (B-02). |
| OP-06 | Accessibility review (automated plus manual workflow) | Proposed | §11 |
| OP-07 | API Terms: deletion, incident reporting and deprecation timelines | **Blocked** | §6. Attorney review (B-03). |
| OP-08 | Data-flow and retention inventory per application | Proposed | §3.3, §6 step 5 |
| OP-09 | Documentation ownership, status fields (designed, implemented, tested, deployed, institution-authorized, production-enabled) with version, environment, verifier, date and evidence | Proposed | §11. Used in this file. |

### 3.11 Build stages from §11

| Stage | Deliverable | Status |
|---|---|---|
| 1 | Existing-work inventory and capability register | **This file** is the first pass. Needs platform engineering verification. |
| 2 | Shared shell, app registry, documentation | Not started. |
| 3 | Gateway, grants, sandbox | Not started. Blocked on B-05, B-06. |
| 4 | API contracts, SDK, event delivery | Lifecycle slice only. Blocked on B-01. |
| 5 | Certification and institutional approval | Blocked on B-02. |
| 6 | Curriculum and isolated assessment | Outline only (§5 below). Blocked on B-09. |
| 7 | Synthetic pilot and partner pilot | Blocked on B-08. |
| 8 | Production activation | Blocked. Requires explicit approval (§7). |

The spec's first complete implementation slice (§11) connects application creation, synthetic task access, typed SDK use, event processing, lab submission, isolated assessment, grant revocation and review evidence. **That slice is not built.** The lifecycle transitions are its first input.

## 4. Blockers and decisions

Blockers cannot be cleared by code alone.

| ID | Blocker | Owner to clear it |
|---|---|---|
| B-01 | Approved OpenAPI contract (the spec's own activation gate) | API and developer experience |
| B-02 | Named reviewers: security, privacy, accessibility, certification review panel, institutional approvers | Partnerships and security leads |
| B-03 | Attorney-reviewed values for deletion, incident reporting and deprecation timelines | Legal |
| B-04 | Which Semester identity provider serves developer accounts. The spec says reuse; the repo does not confirm which one applies. | Platform |
| B-05 | Sandbox isolation: separate database, credentials, events, storage, cache and search per environment | Platform and security |
| B-06 | Deployment target and credentials for this portal. None is defined; no staging or production access has been verified. Production needs explicit approval. | Platform release |
| B-07 | Three source documents cited by the spec are absent from this repository. The 16-step workflow cannot be checked against the original. | Spec owner |
| B-08 | An institution to run the synthetic and partner pilot, and its approval | Institutional partnerships |
| B-09 | Instructor approval and authorship of lesson and lab content | Learning engineering |

Decisions the spec leaves open. Where the implementation has inferred an answer, it is marked.

| ID | Decision | Current behaviour |
|---|---|---|
| Q-1 | Can a suspended application be reinstated? | Not allowed. Inferred from the spec's chain. |
| Q-2 | How does a changed release get back into review? | Resubmitted as a new artifact (`changes-required` → `submitted`). Inferred. |
| Q-3 | Can a requested installation be declined? | Yes, to `revoked`. Inferred. |
| Q-4 | Must a certified release exist before an application goes active? | Required (`sandbox-enabled` → `active`). Inferred. |
| Q-5 | Role × action allow/deny matrix | Not defined. |
| Q-6 | Idempotency record retention window | Not defined. The spec requires it before production. |
| Q-7 | Credential rotation overlap bound | Not defined. |
| Q-8 | Revocation propagation and recovery targets | Not defined. The spec forbids marketing untested targets. |
| Q-9 | Who may inspect sensitive delivery payloads, for how long, with what audit | Not defined. |
| Q-10 | Grade publication authority and appeal route | Not defined. |
| Q-11 | Are native clients in scope? | Not confirmed. |
| Q-12 | Where does the portal live: new routes in `app/`, or a separate application? | Not decided. The lifecycle module sits in `app/src/lib/developer-portal/`. |

## 5. Learning Studio: weekly outline (from §8)

| Week | Focus and outcome | Lab | Assessed evidence |
|---|---|---|---|
| 1 | Explain platform boundaries | Run shared-shell sandbox | Setup, system map, reflection |
| 2 | Collaborate through Git | Submit reviewed feature | Review quality and history |
| 3 | Model data safely | Define task contracts | Types and invalid-input tests |
| 4 | Design API contracts | Implement task read API | Schema, errors, pagination |
| 5 | Distinguish authentication from authorization | Add authorized requests | Positive and negative tests |
| 6 | Enforce tenant isolation | Protect two-tenant dataset | Cross-tenant denial evidence |
| 7 | Build durable data operations | Add migration and audit | Constraints and rollback |
| 8 | Deliver accessible UI | Build task workflow | Keyboard and error-state review |
| 9 | Preserve correctness under retries | Add idempotent creation | Duplicate-request behaviour |
| 10 | Process asynchronous events | Build consumer and outbox | Duplicate and ordering tests |
| 11 | Diagnose and recover | Simulate dependency outage | Recovery and reconciliation |
| 12 | Produce a safe SDK | Wrap API in typed client | Runtime and compile-time tests |
| 13 | Evaluate API threats | Test authorization and webhook egress | Abuse tests and mitigations |
| 14 | Prepare a releasable artifact | Build certification submission | Traceable release evidence |
| 15 | Operate a synthetic pilot | Execute acceptance scenario | Outcomes and defects |
| 16 | Defend engineering decisions | Demonstrate capstone | Demo, defence, reflection |

Grading weights (§9.4, proposed): labs 40%, midterm architecture review 15%, capstone 35%, peer review and reflection 10%. Security defects block deployment regardless of academic score. Instructors determine grades; automated checks supply evidence only.

## 6. Verification evidence

Run from `app/` unless noted. Commands were run in this session.

| Check | Command | Result |
|---|---|---|
| New unit tests | `npx vitest run src/lib/developer-portal` | 15 passed (15) |
| Guard sensitivity: evidence check removed | edit `lifecycle.ts`, rerun | 5 failed, 10 passed |
| Guard sensitivity: prototype-key guard removed | edit `lifecycle.ts`, rerun | 1 failed, 14 passed |
| Guard sensitivity: installation approval loosened | edit `lifecycle.ts`, rerun | 1 failed, 14 passed |
| Restore after mutation | file compared with saved copy, rerun | `cmp` identical; 15 passed |
| Type check | `npx tsc -b` | exit 0, no error lines |
| Lint and style audits | `npm run lint` | exit 0; warnings are pre-existing and none are in `developer-portal` |

Not yet run in this session: the full `npm test`, `npm run test:shuffle`, `npm run check:university` and `npm run build`. The results of those are recorded in the pull request, not here.

## 7. Deployment status

**Not deployed.** The lifecycle module is a library with no route, storage, user interface or network surface, so there is nothing to deploy yet. A staging deployment needs B-05 and B-06 resolved first. Production needs approval under §11 and the repository's launch gates. No credentials were used or requested.

## 8. Continuation record

Completed: specification inventoried; coverage matrix; blockers and decisions; lifecycle transitions implemented and verified; application registry (`registry.ts`) behind an injected `ApplicationStore`, with tenant isolation (cross-tenant reads and writes report `NOT_FOUND`), revoked-grant denial (`GRANT_REVOKED`, checked before any read), scope checks, optimistic concurrency (`PRECONDITION_FAILED`), and lifecycle transitions routed through the same table. 13 registry tests; each of the tenant, grant, and scope guards was removed in turn and caught.

Still open for the registry: the store is in-memory only (no database, no migration, no RLS); the API handlers and the gateway are not built; scopes follow the teaching model until Q-5 is decided; create and transition do not yet write an audit record (§5.1 step 10).

Next executable task: an audit record and outbox entry written in the same step as each registry mutation (§5.1, §5.7), with a test that a mutation whose audit write fails does not commit. Then the `/v1/apps` read and create handlers behind the gateway pipeline once the OpenAPI contract (B-01) exists.

Changed files: `app/src/lib/developer-portal/lifecycle.ts`, `app/src/lib/developer-portal/lifecycle.test.ts`, `app/src/lib/developer-portal/registry.ts`, `app/src/lib/developer-portal/registry.test.ts`, `docs/developer-portal/PROGRAM.md`.
