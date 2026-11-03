# Architecture specification

Status: **draft specification**, 13 October 2026. Companion: [`ARCHITECTURE-TRACEABILITY-REGISTER.md`](ARCHITECTURE-TRACEABILITY-REGISTER.md), which is generated from `app/src/lib/architectureregister.ts` and guarded by its test.

This document turns the brief's ten sections into implementation contracts: what each part contains, how it behaves, what can fail, and what evidence allows it to be activated. It states contracts. It does not claim that any contract is built, tested, deployed or in production. The register records what the repository evidences today.

Every item here carries seven independent status axes (section 1). A statement in this document is a requirement unless it names evidence.

---

## 1. Evidence baseline and status model

Three corrections to the brief govern this specification.

1. **The nine layers (A–I) are an integrated operating architecture, not a computer.** They reuse canonical systems. Identity, membership, consent, audit and permission each have one model, and no feature gets its own.
2. **The repository already has a capability-based permission model.** `private.has_capability` is defined in `supabase/migrations/20260922012000_capabilities.sql`. New work uses it. No parallel predicate such as `core.my_role()` or `ctl.can()` is introduced.
3. **The outline's counts are documentation-surface counts, not inventories.** The brief lists 8 workspaces, 21 migrations, 14 views and 12 forms. `origin/main` contains 239 migration files, and the generated capability registry holds 122 entries. Counts stay labelled as unreconciled until they are checked against the actual inventories. "21 migrations" never means the whole database.

The brief also cites a historical reconciliation audit and a reference migration set. Both are treated as reference specifications. Neither is applied wholesale, and neither is evidence of today's state.

### Status axes

Each section, capability and layer carries these axes independently:

| Axis | Meaning |
|---|---|
| Designed | A written contract exists. A prototype interaction is evidence of designed behaviour only. |
| Implemented | Code or schema exists on `main`. |
| Tested | An automated test or check exercises the behaviour. |
| Deployed | The build is running in a named environment. |
| Institution-authorized | The institution has approved the capability for its use. |
| Production-enabled | The capability is switched on for production users. |
| Record-authoritative | Semester is the system of record for the data, under an approved cutover. |

Every claim on any axis records a version, an environment, a verifier, a date and an evidence reference. An axis with no evidence is "not assessed", not "no".

---

## 2. AI gateway

**Contract.** Six enforced boundaries sit between a question and an answer. Student records are excluded from model-provider requests. Every retrieval, tool action and response follows Semester's permissions and policy.

Keep "student records never leave" as a policy requirement, not a security guarantee. Student records may legitimately reside in institution-authorized Semester infrastructure. They must not be sent to model providers under the AI policy.

### The six boundaries

| # | Boundary | Enforcement | Failure behaviour |
|---|---|---|---|
| 1 | Identity and context | Verify principal, active membership, explicit workspace, institution, course and environment. | Refuse without retrieving protected context. |
| 2 | Request classification | Classify the question, attachments, conversation context and requested operation. | Block prohibited data, or route to non-AI support. |
| 3 | Policy and purpose | Evaluate institution, course, user, consent, academic-integrity, entitlement and budget rules. | Explain the applicable restriction. |
| 4 | Authorized retrieval and egress | Retrieve only permitted sources. Build a minimised, approved provider payload. | Block before provider invocation. |
| 5 | Tool and action authority | Validate proposed tools, arguments, resource permissions, freshness and exact approvals. | Return a proposal or refusal. Do not execute. |
| 6 | Response and release | Validate output structure, permitted disclosure, sources, uncertainty and safe rendering. | Withhold unsafe output, or label inability to answer. |

The existing 17-step AI workflow stays as the detailed implementation beneath these six boundaries. It is not a competing workflow.

### Required controls

- No direct browser-to-provider calls.
- No student-record payloads in prompts, embeddings, provider logs, tracing or evaluation exports.
- No "redact the identifiers and send the rest" shortcut for protected records.
- No fallback to an unapproved provider after a provider failure.
- Permission-aware retrieval and response caches.
- Reauthorization after changes to membership, course access, consent or grants.
- Server-side tool allowlists and argument validation.
- Bounded tool calls, duration, cost and retries.
- Untrusted sources cannot redefine instructions or permissions.
- High-impact actions remain human-authorized domain commands.

Prompt instructions are not an authorization boundary. Tool permissions are enforced outside the model. Consequential approvals bind to the exact operation, target, arguments and caller authority.

### Telemetry

Log metadata only: request reference, principal or context reference, policy version, task category, provider and model configuration, allowed source references, outcome and reason code, token and cost measurements, tool proposal and approval references, and latency. Raw prompts and responses stay out of ordinary telemetry.

### Activation tests

Required before activation:

- Student ID, grade and record disclosure attempts.
- Protected content in attachments and retrieved sources.
- Cross-tenant source retrieval.
- Prompt injection embedded in course materials.
- Cached answers after access revocation.
- Course AI restrictions changing mid-session.
- Unauthorized tools and modified approved arguments.
- Provider outage, budget exhaustion and malformed responses.

---

## 3. Environments

**Contract.** Local, preview, staging and production are separate trust zones. Reviewed code and schema changes move forward. Credentials, sessions, protected records and operational authority do not cross zones implicitly.

"Data never crosses" is too broad. Approved schema changes, synthetic fixtures and controlled recovery operations move between zones on purpose. The enforceable rule is: no unauthorized transfer of data or credentials.

Supabase branches are data-less by default and have separate instances and credentials. Their documentation also offers an explicit "include data" option, so the default is not sufficient. Semester policy and configuration checks must govern that option.

| Environment | Data | Infrastructure | Allowed operations |
|---|---|---|---|
| Local | Synthetic fixtures | Local services and developer configuration | Development and repeatable tests |
| Preview | Synthetic, branch-specific | Isolated deployment and approved backend branch | PR acceptance and integration checks |
| Staging | Synthetic, or separately approved test data | Stable nonproduction systems | Release rehearsal and recovery exercises |
| Production | Authorized institutional and user records | Production projects and identities | Approved operational workflows |

### Isolation inventory

For each environment, record: Vercel project and deployment identifiers; Supabase project or branch reference; database, Auth, Storage and function configuration; allowed origins and redirect destinations; credential and signing-key references; queues, worker identities, event sinks and webhook destinations; AI provider configuration and budgets; email, notification and payment behaviour; search indexes and cache namespaces; retention, expiry and the owner of cleanup.

### Required gates

- Fail deployment if a preview points at a production backend.
- Fail deployment if production secrets appear in preview configuration.
- Disable real payments and external notifications in ordinary test environments.
- Keep production backups and exports from becoming developer fixtures.
- Verify preview cleanup across database, storage, queues, indexes and credentials.
- Promote an exact tested artifact. Do not rebuild an unspecified revision.
- Keep production promotion separate from successful preview creation.

---

## 4. Stack layers and consequential commands

**Contract.** Front end, middleware, API or domain service, and database each own one responsibility. No layer substitutes presentation logic for authorization.

| Layer | Owns | Must not |
|---|---|---|
| Front end | Accessible interaction, draft state, context display, source labels, action previews | Treat a hidden button as security |
| Middleware | Session handling, safe routing, origin checks, request context | Make the final object-level permission decision alone |
| API or domain service | Validation, resource authorization, policy, workflow, approvals, idempotency | Trust client roles, tenant claims or derived status |
| Database | Constraints, scoped access, transactional integrity, canonical records | Depend on callers remembering to filter |
| Workers | Bounded asynchronous execution and reconciliation | Retain authority after revocation |
| Projections and search | Authorized derived views and freshness metadata | Become the source of truth for a consequential write |

### Standard consequential command flow

1. Authenticate.
2. Resolve the explicit role and institution context.
3. Validate inputs.
4. Authorize the action and the resource.
5. Evaluate policy and workflow state.
6. Read the authoritative record versions.
7. Preview the impact.
8. Obtain the required approval or step-up. Approval is revalidated when inputs, record versions, approver eligibility or material impact change.
9. Execute idempotently.
10. Atomically commit the records, audit metadata and outbox event.
11. Update projections.
12. Return a receipt.
13. Reconcile external effects.

An audit-first record is evidence that an action was authorized. A transactional audit row records that it happened. Neither is a success record written before the underlying operation succeeds.

### Receipt states

A receipt separates: accepted; authoritatively committed; awaiting external confirmation; projection updating; completed; failed; needs reconciliation. "Accepted" is never displayed as "enrolled", "paid", "released" or "deleted" without the authoritative confirmation for that word.

---

## 5. Read-model pipeline and freshness

**Contract.** Write, then transactional outbox, then projection, then authorized refetch. Freshness shapes presentation. Authoritative validation controls consequential actions.

CQRS separates commands from queries over purpose-built views. It does not require a microservice per feature, or a database per projection.

### Pipeline

1. Validate and authorize the command.
2. Read the current authoritative record version.
3. Commit the record change, audit metadata and outbox event together.
4. A worker publishes or processes the event.
5. A projection consumer deduplicates and applies it.
6. The projection advances its checkpoint.
7. The UI receives an invalidation hint.
8. The UI refetches through an authorized query.
9. The server compares the required versions before enabling or executing a consequential action.

Duplicate delivery remains possible even with a transactional outbox. Consumers are idempotent.

### Freshness metadata

Expose: source observed time; authoritative version or sequence; projection checkpoint; projection applied time; query evaluated time; upstream synchronisation state; pending command reference; freshness classification and its reason. A projection created moments ago can still derive from an upstream source hours old.

### UI states

| State | Interface behaviour |
|---|---|
| Current | Normal operation. Writes are validated authoritatively. |
| Updating | Show the accepted-command receipt and the pending projection state. |
| Stale | Show a warning and a refresh path. Restrict projection-dependent decisions. |
| Unknown | Do not claim freshness. Offer an authoritative check or support. |
| Degraded | Preserve permitted drafts. Explain unavailable dependencies. |
| Unavailable | Do not turn absence into "no holds", "no balance" or "eligible". |

### Domain freshness rules

- **Registration:** recheck eligibility, holds, availability and workflow state against the authority.
- **Grades:** distinguish entered, moderated, released and received.
- **Payments:** distinguish requested, authorized, executed, settled and reconciled.
- **Advising:** show when a recommendation relies on stale inputs.
- **Search:** permit appropriately labelled results, and recheck access.
- **Campus discovery:** a more tolerant policy than for official-record changes.

Freshness budgets are defined per capability. There is no platform-wide lag threshold. Security revocation does not wait for a projection refresh.

---

## 6. Education OS: boundaries and migration

**Contract.** One native Education OS, with explicit boundaries for legacy replacement, continuing institutional relationships, infrastructure, replaceable providers and approved extensions.

An identity provider, a hosting platform, a payment network, an AI provider and a legacy SIS are different kinds of dependency. They are not all "systems Semester replaces". [`UNIVERSITY-OS-ARCHITECTURE.md`](UNIVERSITY-OS-ARCHITECTURE.md) states what Semester does and does not replace today.

### Domain architecture card

Every domain records: users and jobs; current source of truth; proposed native authority; canonical implementation; integration boundary; commands and events; private versus official records; permission and consent model; AI restrictions; freshness policy; migration and reconciliation; support and recovery; owner, risks, evidence and activation gates.

### Migration phases

1. Discover source systems and authority.
2. Map identifiers and semantics.
3. Validate synthetic and approved sample imports.
4. Run read-only shadow projections.
5. Reconcile discrepancies.
6. Dual-run selected workflows.
7. Obtain domain-specific cutover approval.
8. Transfer bounded authority.
9. Monitor and reconcile after cutover.
10. Retire the legacy dependency only when export, archive, recovery and contractual obligations are met.

Four kinds of reversal are kept distinct: technical rollback, compensating transaction, authorized correction and external reconciliation. Some academic and financial effects cannot be undone by restoring an earlier database snapshot.

---

## 7. Capability registry

**Contract.** A traceable registry across the documented workspaces. For each capability it records routes, actors, permissions, canonical records, commands, events, projections, status derivation and activation evidence. The registry generates documentation and verification expectations. It does not create another permission system.

### Capability record

| Field | Required definition |
|---|---|
| Identity | Stable capability identifier and domain |
| Workspace | Explicit context and supported actors |
| Entry points | Routes, components, API or RPC operations |
| Authorization | Existing capability keys and scope semantics |
| Relationships | Ownership, enrolment, assignment, delegation |
| Inputs | Validated schemas and classifications |
| Records | Canonical source and authority |
| Commands | State transitions and approval requirements |
| Events | Emitted types and schema versions |
| Read models | Projection dependencies and freshness |
| Status | Formula, inputs, version and uncertainty |
| Recovery | Retry, correction, compensation, support |
| Evidence | Tests, deployment, institutional approval |
| Ownership | Product, technical, risk and operational owners |

The generated registry (`app/src/data/ecosystem/capabilities.json`) carries routes, actors, permissions, records, commands, events, screens, design and status. The first record's keys do not include projection dependencies, freshness, recovery or ownership. Those fields are a gap to close, not a claim that they exist.

### Derived status rule

A status such as "registration ready" is reproducible from: status definition version; required conditions; input record versions; source authority; freshness requirements; unresolved conflicts; evaluation time; reason codes.

Missing data is not satisfied data. "No hold returned" does not mean "no hold exists".

### Registry acceptance tests

- Every sensitive route maps to server-side enforcement.
- Every write maps to a controlled command.
- Every derived status has a documented evaluator.
- Every event has a producer owner and a consumer owner.
- Every privileged capability has negative tests.
- Every production-enabled capability has release evidence.

---

## 8. Data model and server

**Contract.** A reconciled atlas of tables, columns, keys, constraints, policies, functions, workers and end-to-end flows, organised by migration set and canonical domain. The 21-migration section in the outline is labelled with its exact range and source. It is not presented as the production database.

### Table documentation

For each table or persisted entity: canonical purpose and domain owner; columns, types, nullability and defaults; primary, foreign, unique and check constraints; institution, user, course and relationship scope; data classification; authority and provenance; RLS enablement and policy definitions; function-mediated write paths; indexes and query patterns; retention, deletion and legal-hold behaviour; events, projections and downstream dependencies; migration provenance and verification evidence.

### Function and worker documentation

For each API, RPC, server action, scheduled job or worker: trigger and principal; inputs and validation; permission predicate; authoritative reads; state transition; transaction boundary; audit behaviour; event production; external effects; timeout and retry policy; idempotency and concurrency; revocation handling; failure and recovery; tests and owner.

Privileged functions are reviewed for a fixed `search_path`, narrow execution grants, caller checks and scoped access. A privileged function must not become a generic bypass of RLS.

### Flow atlas

Complete traces are required for: registration readiness; official-record change request; grade release; advising handoff; student-account action; integration synchronisation; support access grant; AI question; export and deletion; partner installation.

Each trace links: interface, command, authorization, records, transaction, event, projection, receipt, recovery.

---

## 9. Connected ecosystem views

**Contract.** Fourteen views explain what Semester owns, where authority lives, how journeys cross boundaries, and how delivery, failure, trust and continuity are governed. The fourteen-view taxonomy is **proposed**. It has not been reconciled to the existing tab labels.

| # | View | Purpose |
|---|---|---|
| 1 | Operating map | Whole-system domains, layers, owners and boundaries |
| 2 | Native systems | Native engines, source authority and dependencies |
| 3 | Connected journeys | End-to-end workflows across workspaces |
| 4 | Registration | Readiness, authoritative checks, transactions, receipts |
| 5 | Institution and company | Customer operations versus Semester operations |
| 6 | Events | Producers, consumers, subscriptions, schema evolution |
| 7 | Connect safely | Installation, grants, credentials, review, revocation |
| 8 | Boundaries | Private and official, tenant, provider and environment separation |
| 9 | Completion | Evidence-based readiness and unresolved gates |
| 10 | Backbone and passports | Canonical identity and context; governed portability |
| 11 | Delivery and failure | Retries, dead letters, reconciliation, recovery |
| 12 | Trust and continuity | Consent, provenance, accessibility, lifecycle |
| 13 | Migration and portability | Dual run, cutover, export, offboarding |
| 14 | Reliability and readiness | Service health, dependencies, recovery evidence |

"Reliability and readiness" is the expansion of the outline's truncated label "reli".

### Passports

A passport is a governed, versioned reference bundle. It is not a universal, unrestricted profile. Specify: purpose and audience; issuer and authority; included evidence and provenance; data minimisation; consent and permitted recipients; expiry and revocation; portability format; correction process; visibility and access checks.

Keep admissions, employment, academic, financial, family-sharing and learner-private contexts distinct.

---

## 10. Forms, capabilities and interfaces

**Contract.** Each form workflow is bound to validated contracts, canonical permissions, controlled commands, events, receipts and recovery.

A form is not "working" because its prototype changes local state. The inspected Institution OS prototype applies registrar approval through local component state. That demonstrates the interaction. It does not mutate an academic record.

### Form specification

Every form records: 1 purpose and authorized actors; 2 entry conditions and explicit context; 3 field definitions and classification; 4 client and server validation; 5 canonical command contract; 6 required permission and relationships; 7 preview and approval behaviour; 8 record-version and concurrency checks; 9 idempotency behaviour; 10 audit and event contract; 11 accepted, pending, completed and failed states; 12 recovery, accessibility and evidence.

### Proposed twelve workflows

These are a proposed coverage set until the actual forms are inventoried:

1. Membership invitation
2. Delegation or support-access request
3. Course configuration
4. Assignment publication
5. Grade release
6. Registration readiness request
7. Academic-record correction request
8. Advising or support handoff
9. Student-account request
10. Integration configuration
11. AI policy change
12. Partner installation

### Command envelope

Every command carries: command identifier; idempotency key; expected record version; validated input; server-resolved principal and context; approval reference where required.

---

## 11. Mainframe layers A–I

The layer names below are the canonical architecture index, taken from the mainframe specification.

| Layer | Responsibilities | Principal evidence required |
|---|---|---|
| A. Entry, identity, onboarding | Sign-up, SSO, invitations, recovery, sessions, membership resolution, consent, first value | Identity tests and a complete onboarding journey |
| B. Role-aware experience | Student, faculty, advisor, registrar, institution, partner and company contexts | Role and tenant isolation tests; accessible workspace tests |
| C. Native domain engines | Planning, learning, assessment, records, advising, accounts, campus, career, company operations | Complete domain workflows |
| D. Shared platform core | Authorization, approvals, commands, workflow, audit, events, projections, search, scheduling | Reusable contracts and enforcement tests |
| E. Data foundation | Canonical IDs, relationships, education graph, records, provenance, retention | Schema, RLS, constraints, authority atlas |
| F. AI | Gateway, policy, retrieval, tools, providers, evaluation, spend, incidents | Egress and authorization red-team evidence |
| G. Control planes | Institution administration, operations, partner governance, release and incident control | Separation-of-duties and approval evidence |
| H. Integration and migration | Mapping, sync, replay, reconciliation, dual run, cutover, export, retirement | Domain-specific authority-transfer evidence |
| I. Infrastructure and trust | Compute, hosting, database, secrets, environments, CI, monitoring, backups, recovery, privacy, accessibility | Deployment and operational verification |

Each layer page exposes: responsibilities; existing canonical implementation; linked prototypes; architecture decisions; commands and interfaces; data and authority boundaries; dependencies; tests and operational evidence; build prompts; owner and blockers; readiness on each independent axis.

Build work inspects and extends the existing systems. It does not copy reference migrations.

---

## 12. Cross-cutting acceptance criteria

These apply to every section above:

1. No duplicate identity, membership, permission, consent or audit foundation.
2. Explicit role and institution context. No silent privilege union.
3. No company-role access to student records by default.
4. Enforcement is server-side and resource-level.
5. Source authority and freshness are visible wherever they matter.
6. Protected AI egress is blocked before provider invocation.
7. An approval binds to exact inputs and record versions.
8. Record, audit and outbox writes are atomic where applicable.
9. Duplicate and out-of-order events are handled.
10. Revocation is enforced in caches, jobs, exports and replay.
11. Loading, empty, denied, stale, failed, offline and recovery states are accessible.
12. Technical rollback, correction, compensation and reconciliation are kept distinct.
13. Claims are backed by evidence from the named environment.
14. No transfer of domain authority happens without institutional approval.

---

## 13. Execution sequence

Build in dependency order:

1. Reconcile the actual inventories and counts.
2. Map the canonical identity, capability and authority models.
3. Define command, event and projection contracts.
4. Expand the six AI boundaries and the four environment contracts.
5. Trace one complete registration-readiness journey through layers A–I.
6. Test revocation, stale state, duplicate delivery and recovery.
7. Extend the same contracts across the remaining workspaces and domains.
8. Activate integrations and authority changes only through evidence-backed gates.

The next artifact is the traceability register described in the companion document. It is one table of rows, each citing its evidence, not a set of disconnected feature outlines.

---

## 14. Open decisions and blockers

- **Source folder.** The brief's references point to a "Main Semester design system (2) copy" folder. It is not in this repository. Its contents are unverified here.
- **Inventories.** The 8 workspaces, 21 migrations, 14 views and 12 forms need reconciling against the repository before any count is used as a scope claim.
- **Owners.** No owner is assigned to any section. The "owner" field in every register row is unfilled until a person is named.
- **Supabase branch data.** The policy for the "include data" option on branches needs a decision.
- **Passports.** The contexts in scope for the first passport release need a decision.
- **Deployment.** No deployment, release or production change was made or is authorised by this document. Any deployment needs the exact target, the artifact, the migrations, the verification results, the known limitations and the rollback path presented first, and needs explicit approval.
