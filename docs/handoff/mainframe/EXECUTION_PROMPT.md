# Semester mainframe — execution prompt

Save in the repo as `docs/mainframe/EXECUTION_PROMPT.md`. Source spec: `docs/specifications/semester-mainframe.pdf` (copy from `design/handoff/specifications/`). "Mainframe" means Semester's integrated operating architecture, not a mainframe computer.

```text
Implement Semester's native mainframe architecture in the existing repository.

MISSION
Build one native Education Operating System connecting: public company and marketing site; sales and conversion workflows; identity, signup, SSO, invitations, account recovery; role-aware onboarding and first-value journeys; student, faculty, advisor, registrar and service workspaces; institutional consoles; Semester Company Operating System; Semester Operations Command Center; native domain engines; shared authorization, policy, workflow, approval and audit services; canonical data foundation; governed AI; developer and partner platform; integration and migration boundaries; infrastructure, reliability, privacy, security and accessibility.

Use the attached mainframe document and other supplied Semester specifications as requirements to reconcile against actual code. Do not assume previous chat claims about existing tables, schemas, customers, deployed features, production projects or readiness are accurate. Verify them from authorized evidence.

OPERATING DOCTRINE
Build native product capability. Reuse canonical systems. Integrate responsibly. Transfer record authority only with proof. Operate the platform as one system.
Native ownership of business logic does not require replacing every external infrastructure dependency. Distinguish:
- Legacy replacement bridges: SIS/LMS domains intended for replacement.
- Continuing institutional relationships: identity providers.
- Infrastructure dependencies: hosting, banks/payment networks, email/push.
- Replaceable providers: AI compute.
- Ecosystem extensions: approved partner applications.

1. EXECUTION BOUNDARIES
You may: inspect local files; read specifications; create architecture docs; implement local code in small reviewable changes; write tests and migrations for review; run safe local checks with synthetic data; use authorized non-production environments when explicitly configured.
Do not, without specific human approval: deploy to production; apply remote migrations; modify production identity, RLS, credentials or tenant configuration; send emails/notifications/external communications; create charges, refunds, payouts, purchases or subscriptions; change official academic records; publish content or claim institutional approval; delete remote resources or production data; transfer a domain's system-of-record authority.
Never infer a production target from an old prompt. Verify environment names, project identifiers, deployment targets and connection configuration first. Preserve uncommitted user work. No destructive Git commands. Do not overwrite existing agent instructions. Do not print secrets.

2. DISCOVER THE ACTUAL SYSTEM
A. Read AGENTS.md, CLAUDE.md, Cursor rules, CONTRIBUTING, architecture and security docs.
B. Inspect: repo/workspace structure; package manager and lockfiles; runtime versions; actual scripts; routes and layouts; tokens and shared components; auth and onboarding; APIs, RPCs, workers, jobs; migrations and RLS; storage policies; integration adapters; AI retrieval/tool boundaries; CI/CD and deployment; tests and observability; company and institution consoles.
C. Read all supplied specifications. If a PDF can't be read, say exactly why and ask for extracted text. Don't pretend.
D. Distinguish repository evidence, deployed evidence, specification requirements, assumptions, missing evidence. If remote tools are unavailable, mark remote state unverified.

3. MAP THE NINE MAINFRAME LAYERS
A. Entry, identity, onboarding — signup, login, verification, SSO, invitations, recovery, account linking, sessions, memberships, workspace context, consent, entitlements, role onboarding, first-value tracking, safe return routing.
B. Role-aware experience — students/applicants, faculty/TAs, advisors/success, registrar/academic affairs, student accounts/aid, campus services/moderation, career/employers/alumni/family, institution admins/IT-security, partners/developers, Semester employees/board viewers.
C. Native domain engines — planning and registration readiness, learning/Course Studio, assessment/grades, registrar/SIS and records, advising/support, student accounts, productivity, campus, community, career/credentials, family sharing, commerce, customer success, company operations.
D. Shared platform core — identity/membership, authorization/policy, consent/approvals, workflow state machines, validated commands, audit, domain events/outbox, projections, notifications, scheduling, search, files, configuration/feature management, entitlements/metering, lifecycle.
E. Data foundation — canonical records and IDs, institution-scoped relationships, education graph, academic and financial records, files/indexes, analytics projections, source/authority/freshness/classification/retention.
F. AI — gateway and provider registry, institution/course/user policy, permission-aware retrieval, tool authorization, provenance/uncertainty, evaluation, cost limits, incidents, human-controlled high-impact actions.
G. Control planes — Institution Control Plane, Semester Operations Command Center, developer/partner governance, release and incident controls, evidence/risk/configuration.
H. Integration and migration boundary — mapping, validation, sync, replay, freshness, reconciliation, dual run, discrepancy resolution, cutover approval, rollback/remediation, export, archive, legacy retirement.
I. Infrastructure and trust — hosting, compute, database, storage, workers, secrets, environment separation, CI/CD, monitoring, backups, recovery, incident response, tenant isolation, privacy, accessibility, retention.

4. ARCHITECTURAL RULES
Reuse existing canonical implementations before creating replacements. Do not create: a disconnected second product; duplicate account/membership/role/consent/audit models; a separate permission system per console; sensitive generic CRUD/table browsers; mock-only dashboards presented as working; public routes exposing private records; a microservice per feature without justification.
Respect legitimate package/deployment/domain boundaries; multiple clients and deployables are fine without duplicating identity, policy, contracts or authority. Write ADRs for consequential choices.
Server-side authorization evaluates identity + active membership + tenant + capability + scope + relationship + policy + consent + entitlement + workflow state. Client navigation is not authorization. Multi-role users switch explicit workspace context; never silently merge privileges across institutions or roles. Semester employees get no automatic access to customer records. A shared graph is not an unrestricted shared profile.
Keep separate: Semester commercial billing; institution student accounts; payment execution/settlement; statutory accounting/reporting. Never store raw card data.

5. CONTROLLED COMMAND AND EVENT MODEL
Request → authenticate → authorize tenant/resource/action → evaluate policy and workflow state → read authoritative records → impact preview when appropriate → required approval or step-up → idempotent command → commit record change, audit and outbox atomically → update projections → notify permitted recipients → receipt and remediation options.
Handle concurrency, duplicate requests, duplicate/out-of-order events, retries and dead letters, partial external failures, stale projections, cancellation, reconciliation. Don't promise exactly-once delivery; use idempotent consumers and explicit consistency behavior.
Approvals bind to the reviewed action and inputs; revalidate if inputs, record version, approver eligibility or material impact change. Audit records are protected from ordinary modification, with retention, redaction, restricted access and correction mechanisms.
Distinguish technical rollback, compensating transaction, authorized correction, external reconciliation, and irreversible action requiring explicit approval.

6. BUILD THE FIRST COMPLETE JOURNEY (registration readiness)
Marketing student page → signup or institutional SSO → membership/role resolution → onboarding → term/goal selection → registration-readiness checklist → source and freshness labels → advisor/support hand-off → first meaningful action → audit/event → institution operational view → Semester support/implementation view.
Synthetic fixtures and existing canonical models only. If Semester is not the authoritative enrollment system, show that boundary, implement the approved hand-off or transition adapter, and never claim enrollment succeeded without authoritative confirmation.
Include loading, empty, forbidden, stale-data, failure/retry, support, mobile, keyboard and resume-after-interruption states.

7. ONBOARDING AND CROSS-PLATFORM CONTINUITY
Build on existing onboarding models. Server-authoritative: journey assignments and versions, step progress, consent records, membership and role context, activation evidence, approved intended destination. Local storage only for temporary drafts and replaceable caches.
Implement minimal account creation, progressive profiling, role first-value milestones, resume and recovery, optional setup, account-linking safeguards, safe anonymous previews if justified, web/PWA/native route continuity.
Don't force an app download for first value. Don't advertise unsupported native apps. Never pass access/refresh tokens or session credentials through marketing URLs, QR codes or store links.
If native auth/handoff is implemented: use the identity provider's supported secure flow; validate redirect destinations; treat routing references as context, not authority; require authenticated authorization before sensitive navigation; define expiry, replay protection and recovery; don't promise post-install context restoration unless implemented and tested.

8. AI BOUNDARY
AI uses the same authorized domain commands as human clients and cannot bypass membership, tenant scope, resource permissions, policy, approvals, audit or record authority. AI may explain, draft, summarize, plan and retrieve permitted sources. AI must not independently issue official grades, change records, enroll/drop, approve financial actions or override policy. Permission-check retrieval, tool execution, cached responses and outputs. Record evaluation evidence without logging unnecessary protected content.

9. PHASES
0 Reconciliation — current state, traceability, gaps, build order.
1 Shared foundation — identity, memberships, capabilities, policy, audit, app shell, tenant context, source-status conventions.
2 First vertical slice — the registration-readiness journey.
3 Deployment operations — institution configuration, implementation, support, approvals, feature controls, incident procedures, recovery evidence.
4 Native domain expansion — Course Studio, success, student accounts, campus, community, career, family in dependency order.
5 Company operations — growth, sales, contracts, billing, implementation, CS, product, engineering, trust, people, board.
6 Authority transfer — migration, reconciliation, dual run, approved cutover, export, remediation.
7 Ecosystem and regional expansion.
Don't generate all future tables or placeholder screens in Phase 0. Capture the architecture, then build bounded working increments.

10. REQUIRED ARTIFACTS (docs/mainframe/)
CURRENT_STATE.md · TARGET_ARCHITECTURE.md · REQUIREMENT_TRACEABILITY.csv · DOMAIN_CATALOG.md · SERVICE_AND_DEPENDENCY_MAP.md · CANONICAL_DATA_AND_AUTHORITY.md · ROLE_CAPABILITY_MATRIX.md · CONTROLLED_COMMANDS_AND_EVENTS.md · ONBOARDING_AND_LIFECYCLE.md · CONTROL_PLANES.md · AI_BOUNDARIES.md · INTEGRATION_AND_MIGRATION.md · INFRASTRUCTURE_AND_TRUST.md · READINESS_REGISTER.csv · TEST_AND_RELEASE_GATES.md · RISK_REGISTER.md · EXECUTION_BACKLOG.md · SESSION_HANDOFF.md
Mermaid diagrams: whole-system context; runtime/container boundaries; data authority and domain relationships; registration-readiness sequence; role and tenant context resolution; company/customer lifecycle; failure and recovery paths.
Per component: owner, canonical implementation, roles, tenant scope, authority, dependencies, policies, audit, tests, observability, support, recovery, readiness, blocker.
Readiness on separate axes: design maturity · implementation maturity · deployment readiness · record authority. Unknown = unverified, not complete.

11. TESTING AND RELEASE
Discover scripts and package manager first. Run applicable: typecheck, lint, unit, integration, e2e acceptance, API/RPC authorization, RLS and cross-tenant negatives, multi-role isolation, storage/export/search authorization, approval and stale-input, idempotency and concurrency, event retry/duplicates, accessibility/keyboard, responsive states, recovery and offboarding, AI retrieval/tool permissions, analytics privacy, migration and restore validation. Never invent passing results; report commands, exit codes, failures, skips. Synthetic data only. Never weaken tests. "Build succeeds" ≠ production ready.

12. HOW TO WORK
Per batch: objective and acceptance criteria → reused canonical code → smallest complete change → checks → update traceability/readiness/risk → diff summary and blockers → session handoff. Don't branch per tiny edit or chain unmerged branches without a plan. Don't stop after the audit if safe local implementation is possible. Stop and ask for approval at production mutations, destructive changes, conflicting authority, missing required evidence or consequential policy decisions.

13. START NOW
Inspect working tree and repo instructions → read the mainframe spec → discover app/backend/package structure → create CURRENT_STATE and REQUIREMENT_TRACEABILITY → identify the highest-priority foundation gap → implement one safe local reviewable foundation increment with tests → run discovered checks → update READINESS_REGISTER → return evidence and the next dependency-ordered task. Do not claim to have built the entire platform in one session.

FINAL RESPONSE AFTER EACH BATCH
1 Objective and acceptance criteria · 2 Evidence inspected · 3 Existing systems reused · 4 Files and schemas changed · 5 Security, tenant, policy and audit behavior · 6 User-visible journey completed · 7 Commands and test results · 8 Readiness by axis · 9 Unverified assumptions and blockers · 10 Approval requirements · 11 Recovery/remediation implications · 12 Exact next task
```
