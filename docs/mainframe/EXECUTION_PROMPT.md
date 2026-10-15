# Execution prompt

Saved from the mainframe reconciliation instruction. Follow it together with `CLAUDE.md` and the specifications in `docs/specifications/`.

Implement Semester’s native mainframe architecture in the existing repository.

“Mainframe” means the integrated operating architecture of Semester, not a traditional mainframe computer.

## Mission

Build one native Education Operating System connecting:

- Public company and marketing site
- Sales and conversion workflows
- Identity, signup, SSO, invitations, and account recovery
- Role-aware onboarding and first-value journeys
- Student, faculty, advisor, registrar, and service workspaces
- Institutional consoles
- Semester Company Operating System
- Semester Operations Command Center
- Native domain engines
- Shared authorization, policy, workflow, approval, and audit services
- Canonical data foundation
- Governed AI
- Developer and partner platform
- Integration and migration boundaries
- Infrastructure, reliability, privacy, security, and accessibility

Use the attached mainframe document and other supplied Semester specifications as requirements to reconcile against actual code.

Do not assume previous chat claims about existing tables, schemas, customers, deployed features, production projects, or readiness are accurate. Verify them from authorized evidence.

## Operating doctrine

Build native product capability. Reuse canonical systems. Integrate responsibly. Transfer record authority only with proof. Operate the platform as one system.

Native ownership of business logic does not require replacing every external infrastructure dependency.

Distinguish:

- Legacy replacement bridges: SIS/LMS domains intended for replacement.
- Continuing institutional relationships: identity providers.
- Infrastructure dependencies: hosting, banks/payment networks, email/push.
- Replaceable providers: AI compute.
- Ecosystem extensions: approved partner applications.

## 1. Execution boundaries

You may inspect local repository files, read supplied specifications, create architecture documentation, implement local code in small reviewable changes, write tests and migrations for review, run safe local checks using synthetic data, and use authorized non-production environments when explicitly configured.

Do not, without specific human approval: deploy to production; apply remote database migrations; modify production identity, RLS, credentials, or tenant configuration; send emails, notifications, or other external communications; create charges, refunds, payouts, purchases, or subscriptions; change official academic records; publish content or claim institutional approval; delete remote resources or production data; or transfer a domain’s system-of-record authority.

Never infer a production target from an old prompt. Verify environment names, project identifiers, deployment targets, and connection configuration first.

Preserve uncommitted user work. Do not use destructive Git commands. Do not overwrite existing agent instructions. Do not print secrets into logs or generated documentation.

## 2. Discover the actual system

Before broad implementation, read repository instructions and inspect the real package, routes, auth, migrations, RLS, integrations, AI boundaries, CI, and consoles. Read the supplied specifications. Distinguish repository evidence, deployed evidence, specification requirements, assumptions, and missing evidence. If remote inspection tools are unavailable, continue the local audit and mark remote state unverified.

## 3. Map the nine mainframe layers

A. Entry, identity, and onboarding. B. Role-aware experience. C. Native domain engines. D. Shared platform core. E. Data foundation. F. AI/intelligence. G. Control planes. H. Integration and migration boundary. I. Infrastructure and trust.

## 4. Architectural rules

Reuse existing canonical implementations. Do not create a second product, a duplicate account or audit model, a separate permission system per console, a sensitive table browser, a mock dashboard presented as a working system, or a public route that exposes private records.

Server-side authorization must evaluate identity, active membership, tenant, capability, scope, relationship, policy, applicable consent, entitlement, and workflow state. Client navigation is not authorization.

Support multi-role users through explicit workspace context. Semester employees must not receive automatic access to customer records. A shared graph is not an unrestricted shared profile.

Keep separate: Semester commercial billing, institution student accounts, payment execution, and statutory accounting. Do not store raw card data.

## 5. Controlled command and event model

For sensitive changes: authenticate, authorize, evaluate policy and workflow state, read authoritative records, preview impact when appropriate, obtain approval or step-up, execute an idempotent command, commit the record change, audit record, and outbox event atomically, update projections, notify permitted recipients, and return a receipt with remediation options.

Do not promise exactly-once delivery. Approvals are tied to the reviewed action and inputs. Audit records are protected from ordinary modification. Distinguish technical rollback, compensating transaction, authorized correction, external reconciliation, and irreversible action.

## 6. Build the first complete journey

Start with registration readiness: marketing student page, signup or institutional SSO, membership and role resolution, onboarding, term and goal selection, registration-readiness checklist, source and freshness labels, advisor or support handoff, first meaningful action, audit or event, institution operational view, and Semester support view.

Use synthetic fixtures and existing canonical models. If Semester is not the authoritative enrollment system, show that boundary. Do not claim enrollment succeeded without authoritative confirmation.

Include loading, empty, forbidden, stale-data, failure and retry, support, mobile, keyboard, and resume-after-interruption states.

## 7. Onboarding and cross-platform continuity

Build on existing onboarding models. Server-authoritative journey assignment, step progress, consent, membership, activation evidence, and approved destination. Local storage only for temporary drafts and replaceable caches.

Do not force an app download for first value. Do not advertise unsupported native applications. Do not pass access tokens, refresh tokens, or session credentials through marketing URLs, QR codes, or app-store links.

## 8. AI boundary

AI uses the same authorized domain commands as human clients. AI may explain, draft, summarize, plan, and retrieve permitted sources. AI must not independently issue official grades, change academic records, enroll or drop students, approve financial actions, or override institutional policy.

## 9. Implementation phases

Phase 0 reconciliation. Phase 1 shared foundation. Phase 2 first vertical slice. Phase 3 deployment operations. Phase 4 native domain expansion. Phase 5 company operations. Phase 6 authority transfer. Phase 7 ecosystem and regional expansion.

Do not generate all future domain tables or placeholder screens in Phase 0.

## 10. Required artifacts

`CURRENT_STATE.md`, `TARGET_ARCHITECTURE.md`, `REQUIREMENT_TRACEABILITY.csv`, `DOMAIN_CATALOG.md`, `SERVICE_AND_DEPENDENCY_MAP.md`, `CANONICAL_DATA_AND_AUTHORITY.md`, `ROLE_CAPABILITY_MATRIX.md`, `CONTROLLED_COMMANDS_AND_EVENTS.md`, `ONBOARDING_AND_LIFECYCLE.md`, `CONTROL_PLANES.md`, `AI_BOUNDARIES.md`, `INTEGRATION_AND_MIGRATION.md`, `INFRASTRUCTURE_AND_TRUST.md`, `READINESS_REGISTER.csv`, `TEST_AND_RELEASE_GATES.md`, `RISK_REGISTER.md`, `EXECUTION_BACKLOG.md`, `SESSION_HANDOFF.md`.

Mermaid: whole system context, runtime boundaries, data authority, registration-readiness sequence, role and tenant context, company and customer lifecycle, failure and recovery.

Readiness axes: design maturity, implementation maturity, deployment readiness, record authority. Unknown state is unverified, not complete.

## 11. Testing and release

Discover actual scripts before running commands. Report commands, exit results, failures, and skipped checks. Use synthetic data. Do not weaken tests. Do not treat a successful build as production readiness.

## 12. How to work

Bounded increments. For each batch: objective, reused canonical code, smallest complete change, checks, traceability, diff, handoff. After the audit, implement one safe local foundation increment. Stop for production mutations, destructive changes, conflicting authority, missing required evidence, or consequential policy decisions.

## 13. Start now

Inspect the working tree and repository instructions. Read the mainframe specification. Discover the actual structure. Write the current-state and traceability records. Implement one safe local foundation increment with tests. Update the readiness register. Return the batch report and the next dependency-ordered task.

Do not claim to have built the entire platform in one session.
