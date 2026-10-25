# Implementation blueprint, component inventory, build order and agent prompts

> Source: "Semester Implementation Blueprint and Prompts" (founder upload, 22 Oct 2026). Master implementation prompt and Prompts 1–8; Safety section governs deployment.
> Text extracted from the PDF with its layout kept; read it as the governing brief, not as proof that anything exists.

```text
elbrate proviade comand arectritre prompts and
nessarcy information to fully build out every
compenet of semester as one system and building one
semester company product Software as a service
comapany
Harrison, build Semester as one system with three connected operating surfaces: the education
product people use, the institutional console that governs it, and the company operating
system that sells, supports, secures, and runs it.
Below is an implementation blueprint, component inventory, build sequence, and copy-ready
coding-agent prompts. The goal is not another collection of dashboards—it is one SaaS business
with shared identity, permissions, data contracts, workflows, design language, billing, and
operational evidence.
Your uploaded materials already establish much of this direction: the complete student
journey, institutional workspaces, a 15-function Company OS, native commercial operations,
approved external systems, and a governed design system. They also identify unresolved
requirements and conflicting draft policies that need reconciliation before implementation. [1]
[2]

Scope note: I reviewed relevant passages from Book 1 and Book 3, not every page. Book 2 is
present but failed processing, so its detailed product requirements are not incorporated here.
This is a proposed implementation plan—not a live repository audit, a claim that these
capabilities already exist, or a production deployment.

1. The architecture: one company, one platform, multiple workspaces

The system map
Use this as the target architecture, adapting it to the existing repository rather than rebuilding
working software unnecessarily.

      SEMESTER COMPANY
      │
      ├── Public experience
      │   ├── Marketing website
      │   ├── Product and solution pages
      │   ├── Pricing and pilot requests
      │   ├── Documentation and help center
      │   ├── Trust center
  │   └── Public service-status page
  │
  ├── Education product
  │   ├── Student workspace
  │   ├── Faculty and teaching workspace
  │   ├── Advisor and support workspace
  │   ├── Applicant / admitted-student experience
  │   ├── Family / delegated-support workspace
  │   ├── Career / employer workspace
  │   └── Community and marketplace
  │
  ├── Institution console
  │   ├── Institution and department configuration
  │   ├── Identity, memberships, and delegated roles
  │   ├── Academic and service workflows
  │   ├── Integrations and reconciliation
  │   ├── Policies, approvals, and consent
  │   ├── Institutional reporting
  │   └── Institution billing and subscription visibility
  │
  ├── Semester Company OS
  │   ├── Executive command center
  │   ├── Sales / CRM / revenue operations
  │   ├── Customer implementation and success
  │   ├── Support and service operations
  │   ├── Commercial finance and collections
  │   ├── Marketing and content operations
  │   ├── Product and engineering operations
  │   ├── Security / privacy / accessibility / compliance
  │   ├── Vendors and procurement
  │   ├── People and access lifecycle
  │   ├── Legal and corporate governance
  │   ├── Partnerships and developer relations
  │   ├── Research and outcomes
  │   ├── Risk and continuity
  │   └── Board / investor reporting
  │
  └── Shared platform
      ├── Identity and tenant context
      ├── Authorization and policy enforcement
      ├── Domain APIs and command handlers
      ├── Workflow engine and approvals
      ├── Relational education data model
      ├── Integration adapters and source provenance
      ├── Event delivery and background workers
      ├── Search and permission-aware retrieval
      ├── Governed AI gateway
      ├── Notifications and preferences
      ├── Billing, entitlements, and usage metering
      ├── Files, audit trails, and retention
      ├── Analytics and observability
      └── Design system


These surfaces reflect the product and Company OS scope in your documents. The particular
boundaries above are my recommended implementation structure. [1]
What “one system” should mean
I recommend enforcing these architectural rules:
 1. One identity can have multiple memberships and responsibilities.
 2. Every request operates in an explicit workspace and data scope.
 3. Every business entity has a canonical owner and authoritative source.
 4. Shared capabilities are reused rather than copied into each module.
 5. Cross-domain activity goes through documented commands, APIs, or events.
 6. Product usage, commercial entitlements, and operational health connect through stable
    identifiers.
 7. Company employees do not receive unrestricted student-record access merely because
    they work for Semester.
 8. The interface distinguishes official, connected, personal, AI-assisted, and estimated
    information.
Your source vocabulary and institutional-authority boundaries are already central to the
uploaded operating material. [1]

2. Recommended technical structure

Begin with a modular application, not dozens of services
My recommendation is a modular monolith with separate background workers: one governed
backend organized into domain modules, with deployment separation only where runtime or
security requirements justify it.
Do not interpret “one system” as “every table, interface, and permission belongs in the same
unrestricted application.”
A proposed repository structure:

  semester/
  ├── apps/
  │   ├── web/                     # Education product and institution workspace
  │   ├── company/                 # Restricted Semester Company OS
  │   ├── site/                    # Public company website
  │   └── worker/                  # Durable background jobs and integrations
  │
  ├── packages/
  │   ├── identity/
  │   ├── authorization/
  │   ├── contracts/            # API, event, validation, and shared types
  │   ├── domain/
  │   │   ├── academic/
  │   │   ├── planning/
  │   │   ├── learning/
  │   │   ├── student-services/
  │   │   ├── community/
  │   │   ├── career/
  │   │   ├── commerce/
  │   │   └── company/
  │   ├── workflows/
  │   ├── integrations/
  │   ├── ai-gateway/
  │   ├── notifications/
  │   ├── billing/
  │   ├── analytics/
  │   ├── observability/
  │   ├── tokens/
  │   ├── icons/
  │   └── ui/
  │
  ├── supabase/
  │   ├── migrations/
  │   ├── tests/
  │   └── seed/
  │
  ├── docs/
  │   ├── architecture/
  │   ├── product/
  │   ├── company/
  │   ├── security/
  │   ├── design/
  │   ├── runbooks/
  │   └── execution/
  │
  └── .claude/
      └── skills/


Preserve the current framework, package manager, folder layout, and working modules unless
inspection demonstrates a reason to change them. Your design book explicitly favors
component reuse, compact durable agent instructions, focused skills, and validation through
existing package scripts. [2]

Infrastructure responsibilities
Treat this as a proposed responsibility map, not a verified inventory of your current
deployment:

                    Layer                                           Proposed responsibility
         Web hosting                    Public site, authenticated application, restricted operations application

         PostgreSQL / Supabase          Transactional data, tenant policies, migrations, storage integration

         Worker runtime                 Integration sync, notifications, exports, reconciliation, long-running workflows

         Durable job store              Retry state, scheduled work, deduplication, dead-letter handling

         Identity integration           Authentication, institutional SSO, session and membership management

         Observability                  Errors, traces, logs, uptime checks, operational alerts

         External financial providers   Payment execution, banking, statutory accounting, payroll
                       Layer                                             Proposed responsibility

         AI providers                       Approved requests through the governed gateway only

Your operating book specifically places banking, payment processing, payroll, and the
statutory ledger outside the product database while exposing their relevant status inside
Semester. [1]

3. Component inventory: what must be built
For every row below, create a domain specification covering entities, permissions, screens,
APIs, workflows, events, dependencies, tests, and acceptance evidence.

A. Shared platform foundation
                Component                                             Required implementation

       Identity                        Sign-up, sign-in, recovery, MFA where required, SSO, session controls

       Workspace membership            Institutions, departments, personal workspaces, invitations, verified responsibilities

       Authorization                   Role assignments, resource scopes, consent, delegation, deny-by-default enforcement

       Tenant isolation                Database policies, scoped storage, scoped jobs, scoped search, negative security tests

       Configuration                   Institution settings, modules, feature flags, themes, supported integrations

       Workflow engine                 Definitions, versions, instances, tasks, approvals, deadlines, escalations

       Notifications                   In-app and email delivery, preferences, deduplication, delivery status

       Search                          Permission-aware indexing, source labels, removal and access-revocation handling

       Files                           Upload validation, storage policies, access controls, retention, export

       Audit                           Actor, action, target, time, outcome, correlation identifier, sensitive-field minimization

       Billing                         Plans, subscriptions, invoices, usage, entitlements, credits, collections

       Integrations                    Adapter contracts, credentials, mapping, retries, reconciliation, monitoring

       AI gateway                      Approved sources, policy checks, redaction, routing, cost limits, evaluation

       Reliability                     Health checks, alerts, backup verification, restore procedures, incident controls

       Design system                   Tokens, components, patterns, accessibility, stories, visual tests

These shared capabilities consolidate requirements already dispersed throughout the company
and design materials. [2] [1]

B. Education product
Recommended domain coverage:

                     Domain                                        Components and workflows
               Today / Action Center     Prioritized actions, blockers, deadlines, explanations, source links
                    Domain                                  Components and workflows

           My Path                Goals, academic milestones, degree progress, next-step planning

           Calendar and tasks     Personal and connected events, reminders, recurring tasks, schedule conflicts

           Courses                Course list, sections, faculty, syllabus, assignments, approved LMS connections

           Study                  Study plans, practice, notes, source-linked learning support

           Write / productivity   Documents, collaboration, sharing, version history, export

           Registration           Readiness checks, holds, prerequisites, approvals, official handoffs

           Grades and records     Authorized views, provenance, freshness, official-record distinctions

           Advising               Appointment scheduling, shared plans, scoped notes, follow-up actions

           Support                Service directory, case intake, routing, appointments, escalation

           Campus                 Organizations, events, facilities, campus-service discovery

           Housing and dining     Information, requests, status, official-service handoffs

           Student finance        Authorized account information, aid tasks, bills, approved payment handoffs

           Career                 Profiles, evidence, opportunities, appointments, applications

           Family / supporters    Explicit delegation, expiry, revocation, scoped visibility

           Community              Memberships, posts, moderation, reporting, safety controls

           Marketplace            Listings, orders, disputes, seller controls, payment-provider integration

           AI assistant           Approved-source answers, citations, policy restrictions, action previews

Your operating book names this broad product surface; it also distinguishes the larger vision
from a bounded registration-readiness pilot. Do not equate including a module in the
architecture with declaring it operational. [1]

C. Institutional workspaces
Build institution-specific capabilities for:
    Faculty and teaching assistants.
    Advisors and student-support staff.
    Registrar and academic operations.
    Student accounts and financial-aid teams.
    Housing, dining, and student affairs.
    Career services.
    IT, identity, security, and accessibility administrators.
    Department and institution leadership.
Each workspace should expose responsibilities, not an unrestricted copy of the entire platform.
For example, an advisor’s caseload assignment should not automatically grant access to every
financial, health-related, disciplinary, or private student item. Make the access decision explicit
in the policy matrix.

D. Semester Company OS
The company side is not optional administrative polish. Your materials already define 15
operating functions and connect customer promises to financial ownership, delivery, support,
controls, and evidence. [1]
Implement:

                     Function                            Native records and workflows
             Executive             Scorecards, decisions, risks, approvals, ownership, operating reviews

             Revenue               Accounts, contacts, opportunities, qualification, quotes, renewals

             Implementation        Projects, RACI, milestones, readiness, training, acceptance

             Customer success      Adoption, health, outcomes, reviews, renewal and expansion plans

             Support               Tickets, severity, routing, response clocks, knowledge articles

             Commercial finance    Contracts, subscriptions, invoices, payment references, collections

             Marketing             Content, campaigns, claims review, customer-reference permissions

             Product engineering   Requirements, releases, flags, quality, feedback, dependencies

             Trust                 Controls, evidence, questionnaires, privacy requests, accessibility findings

             Legal                 Agreement register, obligations, approvals, renewal and notice dates

             Procurement           Vendors, contracts, spend, reviews, renewal risks

             People                Hiring, onboarding, training, access reviews, offboarding

             Partnerships          Partner lifecycle, agreements, integration certification

             Research              Metric definitions, studies, outcome evidence, reporting

             Governance            Corporate records, stakeholder reports, continuity, capital planning


4. Data architecture: a governed education graph
Use “education graph” to describe connected domain entities—not a requirement to introduce a
graph database.

Core entity groups

  Identity:
    users, identities, sessions
    organizations, departments, workspaces
    memberships, role_assignments, delegations

  Authorization:
    policies, resource_grants, consents
    access_reviews, privileged_access_requests

  Academic:
    academic_terms, programs, courses, sections
    enrollments, requirements, milestones
    holds, readiness_checks, official_record_references

  Personal productivity:
    goals, plans, tasks, calendar_events
    documents, notes, document_versions, shares

  Services:
    service_catalog, cases, appointments
    case_assignments, case_messages, escalations

  Community and career:
    groups, group_memberships, posts, reports
    career_profiles, opportunities, applications

  Commercial:
    customer_accounts, contracts, subscriptions
    plans, prices, entitlements, usage_records
    invoices, invoice_lines, payment_references, credits

  Company:
    opportunities, implementation_projects
    support_tickets, controls, evidence
    vendors, risks, decisions, work_items

  Platform:
    integration_connections, external_object_mappings
    sync_runs, reconciliation_findings
    workflow_definitions, workflow_instances, approvals
    outbox_events, delivery_attempts, audit_events


Required ownership and provenance
For each entity type, specify:

  entity: readiness_check
  owning_domain: academic
  workspace_scope: institution
  authoritative_source: semester-derived
  source_dependencies:
    - official_hold_record
    - institutional_registration_policy
  data_classification: restricted
  allowed_purposes:
    - registration_readiness
  retention_policy: institution_contract_defined
  ai_egress_policy: prohibited
Do not add these exact fields blindly to every table. Use the specification to decide what belongs
on the record, in an associated metadata table, or in the policy registry.
The authoritative-source rule matters: your materials explicitly keep the SIS authoritative
during the pilot and require source-aware information throughout the experience. [1]

Keep four financial domains distinct
  1. Semester’s SaaS subscriptions and invoices.
  2. An institution’s student accounts and financial-aid information.
  3. Marketplace orders and seller transactions.
  4. Semester’s statutory company accounting.
They may exchange references and reconciled events, but should not be conflated into one
unrestricted ledger. Book 1 explicitly says the product database is not the statutory accounting
ledger. [1]

5. How the components become one working system

Example: registration readiness

  Approved SIS connection
      → validated import
      → external-to-internal identity mapping
      → reconciliation
      → permission-scoped academic read model
      → deterministic readiness evaluation
      → student Action Center
      → explanation with source and freshness
      → official handoff or approved workflow
      → completion evidence
      → permitted aggregate outcome reporting


The AI assistant can explain an approved policy; it should not silently replace the deterministic
rules engine or change official records. That division is already reflected in your source
material. [1]

Example: customer sale to activation

  Qualified opportunity
      → scoped proposal
      → commercial approval
      → signed agreement and obligation register
      → implementation project
      → tenant configuration
      → SSO and integration validation
      → security and accessibility evidence
      → institution acceptance
      → cohort activation
      → adoption and outcome reporting
      → renewal decision


Your Company OS already describes this sales-to-implementation-to-renewal lifecycle.
Implement the handoffs as linked records and workflows rather than independent
spreadsheets or disconnected dashboards. [1]

Proposed event contract

  type DomainEvent<T> = {
     id: string;
     type: string;
     schemaVersion: number;
     occurredAt: string;
     workspaceId: string;
     actorId?: string;
     subjectId: string;
     correlationId: string;
     causationId?: string;
     payload: T;
  };


Recommended delivery requirements:
    Commit the business change and its outbox entry together.
    Make consumers idempotent.
    Define retry and dead-letter behavior.
    Keep unnecessary sensitive data out of event payloads.
    Revalidate permissions when an event causes a new disclosure.
    Test duplicate, delayed, reordered, and failed deliveries.

6. Master implementation prompt
Paste this into your coding agent from the existing Semester repository.

  You are implementing Semester as one governed education SaaS platform
  and one operational SaaS company.

  MISSION
  Extend the existing Semester repository into a connected system comprising:
  1. Public company website.
  2. Education product and role-specific workspaces.
  3. Institution administration console.
  4. Restricted Semester Company OS.
  5. Shared identity, authorization, workflows, integrations, billing,
     design system, observability, and operational evidence.

  PRESERVATION
  Inspect before editing.
Preserve working features, routes, data, migrations, design tokens,
components, accessibility behavior, and existing tests.
Do not rewrite the application merely to match a proposed folder tree.
Do not change the package manager or framework without a documented need.
Do not overwrite uncommitted user work.

SOURCE RULES
Read repository instructions and available Semester source documents.
Create a source register.
Distinguish approved requirements, drafts, historical plans, and proposals.
Do not treat a PDF's description of code as proof that the code exists.
Record unavailable sources and conflicts.
Do not invent requirements from unavailable Book 2.

INITIAL TASK
Perform a read-only audit of:
- repository structure and package scripts
- routes and user journeys
- authentication and authorization
- schema, migrations, RLS, and storage
- APIs and command handlers
- integrations and background jobs
- billing and entitlements
- design tokens, UI components, and accessibility
- company operations
- CI, tests, monitoring, backups, and deployment configuration

OUTPUT
Create:
docs/execution/source-register.md
docs/execution/current-state.md
docs/execution/component-inventory.csv
docs/execution/requirements-traceability.csv
docs/execution/conflicts-and-decisions.md
docs/execution/dependency-plan.md
docs/execution/launch-gates.md

For every component record:
id, domain, purpose, users, owner, source, dependencies,
routes, entities, APIs, events, permissions, integrations,
data classification, implementation status, tests,
acceptance evidence, risks, and next action.

STATUS
Use:
not_started, specified, implemented_unverified,
verified_in_test, pilot_enabled, production_operated.

Never mark a feature complete because a page or mockup exists.

ARCHITECTURE
Prefer existing architecture when sound.
Propose modular domain boundaries and shared platform contracts.
Use explicit workspace context.
Separate personal, institutional, commercial, and company data scopes.
Enforce permissions server-side and at the database where appropriate.
  Keep external authoritative records distinct from Semester-derived data.

  AI
  Preserve the current student-record no-egress policy.
  Do not send student records, sensitive case content, or unrestricted
  database results to model providers.
  Do not use AI as the authority for grades, eligibility, finance, or
  other high-impact institutional decisions.

  EXECUTION
  After the audit, identify the smallest foundational vertical slice.
  Implement in bounded phases with acceptance tests.
  Report actual commands and results.
  Never fabricate passing tests, deployment status, customer approvals,
  compliance status, or production readiness.

  SAFETY
  No production deployment, live financial action, destructive migration,
  customer communication, external account change, or permission escalation
  without explicit approval.
  Prepare reviewable changes and draft PR material only.
  Stop at unresolved security-critical decisions.


This prompt intentionally preserves the stronger AI boundary in your operating book rather
than broadening access merely because a new AI feature is proposed. [1]

7. Architecture and execution prompts
Run these in dependency order. Each prompt inherits the master prompt.

Prompt 1 — Reconcile the source documents

  Reconcile Semester's source material into an implementation specification.

  Identify conflicts in:
  - product scope and public positioning
  - AI data boundaries
  - design-token authority
  - accessibility target
  - incident severity and response commitments
  - breach-notification terms
  - retention and deletion
  - backup and restore cadence
  - accounting boundaries
  - pricing, pilot terms, and launch requirements

  For each conflict:
  cite the source location, describe the consequence, propose a resolution,
  name the required decision owner, and mark unresolved items explicitly.

  Do not choose legal or contractual commitments autonomously.
  Do not reproduce draft customer or certification claims as verified facts.
  Produce a requirements traceability matrix and ADR backlog.


This is important because Book 1 explicitly identifies disagreements across accessibility
standards, response targets, restoration schedules, contractual language, and other operating
commitments. [1]

Prompt 2 — Establish platform security and tenancy

  Implement the verified identity and authorization foundation.

  Deliver:
  - personal and institutional workspace model
  - scoped memberships and verified role assignments
  - invitations, expiry, revocation, and offboarding
  - resource authorization
  - explicit delegation and consent
  - tenant-isolated database and storage policies
  - restricted company-operator access
  - audited privileged-support workflow

  Test:
  cross-tenant access, role self-assignment, stale membership,
  revoked consent, expired delegation, storage access,
  background-job scope, and privileged credential boundaries.

  Never authorize from client-provided role or tenant values alone.
  Document every privileged execution path.


Prompt 3 — Build the design system and shared shell

  Inventory and reuse Semester tokens, icons, components, and patterns.

  Implement or repair:
  - navigation and workspace switching
  - role-specific route visibility
  - source and freshness labels
  - forms, tables, search, filters, overlays, and feedback
  - narrow-screen layouts
  - loading, empty, error, restricted, offline, and retry states

  Add stories and interaction tests for changed components.
  Use semantic tokens.
  Do not introduce decorative dashboard patterns or duplicate primitives.
  Verify keyboard operation, focus, labels, contrast, and reduced motion.
  Report any design-system gap before creating a new primitive.


These requirements follow the reuse-first, token-first, accessibility-centered approach in Book
3. [2]
Prompt 4 — Build the first complete education workflow

  Implement registration readiness as a complete vertical slice.

  Use synthetic fixtures until an approved institutional connector exists.

  Deliver:
  - connector contract and fixture adapter
  - identity mapping and reconciliation
  - authoritative-source references and freshness
  - deterministic readiness rules
  - student Action Center
  - official handoff
  - scoped advisor visibility
  - permitted aggregate outcome reporting
  - audit trail and support diagnostics

  Test:
  incorrect identity mapping, stale source data, missing records,
  conflicting rules, unauthorized advisor access, connector failure,
  duplicate imports, and recovery.

  Do not represent a handoff as completed registration.



Prompt 5 — Expand the education domains
Use this template once per domain listed in Section 3:

  Implement DOMAIN using the existing Semester platform.

  Before coding:
  1. Read its specification and source requirements.
  2. Identify existing functionality to preserve.
  3. Document actors, data ownership, permissions, and source authority.
  4. Identify shared platform capabilities to reuse.
  5. Define one end-to-end acceptance journey.

  Deliver:
  schema and migrations, authorization, API/commands, workflow,
  user interface, source labels, notifications, search integration,
  audit events, operational diagnostics, tests, and documentation.

  Cover invalid input, access denial, stale data, partial failure,
  duplicate requests, concurrency, cancellation, and recovery.

  Do not implement disconnected CRUD screens.
  Do not enable the domain in production automatically.
Prompt 6 — Implement Company OS

 Implement Semester Company OS using the same domain contracts and design
 system, but separate staff permissions and sensitive company data.

 Build the linked lifecycle:
 account → opportunity → proposal → approval → agreement →
 implementation → activation → outcomes → renewal.

 Add:
 commercial billing, collections, support, customer success,
 control evidence, vendor register, legal obligations, people lifecycle,
 marketing claims approval, risks, decisions, and operating reviews.

 Every action must have an owner, permission, state transition,
 audit trail, and acceptance test.

 Use external provider references for banking, payments, payroll,
 e-signature, statutory accounting, code, and deployments.

 Do not fabricate financial numbers or customer health.
 Label synthetic demonstration data.
 Company staff must not gain blanket student-record access.



Prompt 7 — Implement the AI gateway

 Implement a policy-enforced AI gateway.

 Deliver:
 approved use-case registry, allowed source classes, request validation,
 redaction, provider routing, prompt versions, source citations,
 cost budgets, rate limits, evaluation fixtures, and kill switch.

 Treat retrieved content as untrusted input.
 Enforce permissions before retrieval and before returning results.
 Preserve the prohibition on sending student records to providers.

 Require impact preview and approval for consequential tool actions.
 Test prompt injection, data extraction, cross-tenant retrieval,
 unsupported claims, missing sources, and provider outages.

 Do not log raw sensitive prompts or source content by default.


Prompt 8 — Verify launch readiness

 Audit Semester against evidence-backed launch gates.

 Verify:
 authentication, authorization, tenant isolation, data accuracy,
 integration reconciliation, billing integrity, accessibility,
 AI boundaries, monitoring, support readiness, restore capability,
 retention/deletion behavior, and rollback procedures.
  Classify each gate:
  pass, fail, blocked, not_applicable.

  For every pass attach:
  test or artifact, date, environment, version/commit,
  reviewer, and limitations.

  Produce a go/no-go report.
  Do not declare production readiness from screenshots,
  generated documentation, or unexecuted test files.
  Do not deploy.


8. Commands: inspect first, then establish a verification contract
Do not run installation or migration commands extracted blindly from a PDF. Book 3 contains
implementation snippets, but the correct commands must come from the actual repository and
its package scripts. [2]

Safe initial inspection
Run from the repository root:

  git status --short
  git branch --show-current
  git log -5 --oneline
  git ls-files '*package.json' '*lock*' '*workspace*' 'CLAUDE.md' 'AGENTS.md'
  git ls-files 'supabase/*' '.github/workflows/*'


Then ask the agent:

  Read the detected package manifests and lockfiles.
  Identify the correct package manager and supported runtime.
  List existing validation commands.
  Do not install packages, rewrite lockfiles, or run database resets.


Proposed verification interface
Have the agent implement the following scripts only after discovering how they should map to
existing tooling:

  verify:types
  verify:lint
  verify:unit
  verify:integration
  verify:authorization
  verify:tenant-isolation
  verify:migrations
  verify:accessibility
  verify:design-system
  verify:contracts
  verify:security
  verify:build
  verify:all


If the repository uses pnpm and those scripts have been created and reviewed:

  pnpm run verify:all


A script name is not evidence. Its underlying checks must exist, fail correctly, and produce
inspectable results.

9. Build order: preserve the vision, control activation
I recommend this sequence:

    Phase                           Scope                                                Exit evidence

    0         Repository and source audit                         Current-state inventory and conflict register

    1         Identity, tenancy, permissions, design foundation   Negative security tests and shared-shell validation

    2         One complete education workflow                     End-to-end acceptance with source reconciliation

    3         Customer lifecycle and commercial operations        Agreement-to-activation-to-renewal test

    4         Shared workflows, notifications, search, AI         Failure-path, privacy, and permission tests

    5         Additional education domains                        Domain-specific acceptance evidence

    6         Expanded institutional capabilities                 Institution-approved authority and integration boundaries

    7         Marketplace and partner ecosystem                   Transaction, safety, dispute, and access controls

    8         Operational hardening and controlled rollout        Restore drill, support readiness, rollback, go/no-go

The full architecture can exist from the start. Availability should depend on verified readiness,
customer scope, and approved feature activation—not the presence of a navigation item.
Your operating documents already use evidence-backed launch gates and cohort activation
rather than treating launch as a single irreversible event. [1]

10. Information needed before implementation can be finalized
The coding agent should create a decision register for these inputs rather than guessing:

                                Required input                                    Decision it controls
            Repository, branch, and current uncommitted work        What can safely be changed

            Accessible Book 2 content                               Detailed product coverage and traceability

            First customer segment and launch cohort                Initial acceptance journeys

            Institution-authorized data fields                      Integration and storage scope
                               Required input                                       Decision it controls

           Authoritative system for each record type                  Read models, reconciliation, write-back limits

           Approved roles and delegation policies                     Authorization matrix

           Approved AI use cases and providers                        Gateway policy and evaluation

           Supported deployment environments                          Infrastructure and release process

           Contractual support commitments                            Staffing, alerts, escalation

           Retention and deletion obligations                         Data lifecycle

           Approved commercial plans                                  Billing and entitlements

           Security, legal, accounting, and accessibility reviewers   Required human approvals

           Budget and delivery capacity                               Sequencing and operational sustainability

Do not hardcode planning prices or historical pilot claims from the books as present
commercial facts. The documents themselves label prices as assumptions and identify multiple
unresolved readiness items. [1]

11. Definition of a finished Semester component
A component is ready for controlled customer use only when its applicable requirements have
evidence:
    A named user and business outcome.
    An approved specification.
    A canonical data owner and authority boundary.
    A schema and safe migration path.
    Server-side authorization and tenant-isolation tests.
    Working APIs and state transitions.
    A complete interface with meaningful failure and permission states.
    Accessible and responsive behavior.
    Correct integration and reconciliation behavior.
    Auditability and operational diagnostics.
    Retention, deletion, and export handling.
    Cost and usage visibility where relevant.
    Support documentation and an accountable owner.
    Rollback or recovery procedures.
    End-to-end acceptance results.
For Company OS components, add approval thresholds, financial or contractual controls, and
the operating review that uses their outputs. For UI components, add token compliance,
component reuse, stories, and accessibility checks—requirements already emphasized in your
design book. [2] [1]
The immediate execution step is Prompt 1 of the master workflow: inspect the repository,
reconcile the books, and produce the component-level traceability matrix. That gives every
subsequent implementation prompt a verified starting point and prevents Semester’s broad
vision from turning into duplicated features, unsafe access, or unsubstantiated “complete”
claims.
                                                        ⁂

  1. Semester-Book-1-Company-Brand-Operating.pdf
  2. Semester-Book-3-Design-System-Building-4.pdf
  3. https://www.perplexity.ai/search/1679be03-0c3a-4144-8143-2c9de0538111
  4. https://www.perplexity.ai/search/2726514c-0e6d-40f9-a547-3dc49ae6208d
  5. Semester-Book-1-Company-Brand-Operating-2.pdf
  6. Semester Book 2 — Product-3.pdf
  7. projects.semester.product_vision
  8. projects.semester.architecture_scope
  9. projects.semester.operations_console
 10. projects.semester.gtm_strategy
 11. https://www.perplexity.ai/search/edffd24a-5a93-4d2d-a30f-4ac487746c56

```
