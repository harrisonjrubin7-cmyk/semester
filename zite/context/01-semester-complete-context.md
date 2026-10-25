# Semester — Complete Product, Company, and Architecture Context

> Source: "Semester Complete Context and Architecture for Zite" (founder upload, 22 Oct 2026), section 1. This is the governing product brief: identity, the three operating layers, users, student product, institution capabilities, Company OS, design and voice, privacy and AI, and the Zite execution rules.
> Text extracted from the PDF with its layout kept; read it as the governing brief, not as proof that anything exists.

```text
 PROJECT NAME
 Semester

 FOUNDER
 Harrison Rubin

 PROJECT TYPE
 A unified education operating system, multi-tenant SaaS product,
 and the native operating system for the company that builds and runs it.

 CORE MISSION
 Make the entire educational journey understandable, actionable,
 connected, and manageable in one governed environment.

 Semester connects academic learning, personal productivity,
 institutional services, campus life, student support, career development,
 financial workflows, communication, community, and company operations.

 The student should feel:
 "I know where I am, what matters next, and what I can do."

 The institution should feel:
 "This is controlled, accurate, interoperable, auditable, and governable."

 The Semester operator should feel:
 "I can run the product and the company without losing visibility,
 accountability, or control."

 PRODUCT THESIS
 Semester is not merely:
 - a student dashboard
 - an LMS wrapper
 - a university portal
 - an AI chatbot
 - a task manager
 - a CRM
 - a collection of embedded third-party tools
 - an internal operations app
 - a visual prototype

 Semester is one coherent platform with native domain capabilities,
 shared infrastructure, and role-specific workspaces.

 Native means Semester owns the relevant:
 - user experience
 - domain model
 - business logic
 - workflow states
 - policy enforcement
 - APIs and events
 - permission model
 - operational controls
 - audit trail
 - reporting
  - support experience

  Native does not mean pretending Semester is already a bank,
  payment network, identity provider, cloud provider, or model provider.

  External infrastructure may support the platform.
  Existing institutional systems may remain authoritative during
  approved integration, migration, or dual-run periods.

  The long-term architecture must support native replacement where
  appropriate, but institutional replacement requires approval,
  feature readiness, data reconciliation, migration evidence,
  support readiness, and rollback capability.

  Do not reduce the full platform vision to the initial pilot scope.
  Do not represent the full platform vision as already shipped.


Your materials support both the broad education-operating-system vision and a narrower,
evidence-backed initial deployment. Keep those two ideas distinct: architectural breadth is not
the same as present production availability. [4] [3]

1.2 The three operating layers

  SEMESTER HAS THREE OPERATING LAYERS

  LAYER 1 — EDUCATION EXPERIENCE
  The product used by students and the people who help them.

  Includes:
  - student workspace
  - applicant and admitted-student experience
  - faculty workspace
  - teaching-assistant workspace
  - advisor workspace
  - student-service workspaces
  - guardian/delegated-support experience
  - alumni experience
  - career and employer experience
  - community and marketplace

  LAYER 2 — INSTITUTION OS
  The native administration and governance environment for each institution.

  Includes:
  - institutional configuration
  - departments and academic structures
  - memberships and responsibilities
  - academic operations
  - registrar workflows
  - student services
  - finance-related institutional workflows
  - communications
  - integrations
  - policy administration
 - approval queues
 - audit and reporting
 - institutional security and access administration

 LAYER 3 — SEMESTER COMPANY OS
 The native environment for operating Semester as a SaaS company.

 Includes two connected but separately permissioned areas:

 A. Business operations:
 sales, CRM, contracts, finance, marketing, customer success,
 implementation, support, people, vendors, legal, governance,
 partnerships, research, and executive management.

 B. Platform operations:
 tenant management, releases, infrastructure health,
 integration health, incidents, security controls,
 AI gateway health, cost management, feature flags,
 backups, restore evidence, and service reliability.

 ALL THREE LAYERS SHARE PLATFORM CONTRACTS
 - identity
 - workspace context
 - authorization
 - source provenance
 - workflow and approvals
 - notifications
 - files
 - billing and entitlements
 - integrations
 - search
 - AI governance
 - audit
 - analytics
 - design system

 SHARED DOES NOT MEAN UNRESTRICTED
 Company employees do not automatically receive access to student records.
 Institution administrators do not automatically receive access to
 a student's private personal workspace.
 Guardians do not automatically receive access because of their relationship.
 A user with multiple roles must operate in an explicit workspace context.


1.3 Users, responsibilities, and onboarding

 SUPPORTED AUDIENCES

 Education:
 - prospective student
 - applicant
 - admitted student
 - enrolled student
 - graduate student
 - alumni
 - lifelong learner
Institution:
- faculty
- teaching assistant
- advisor
- registrar
- academic administrator
- student affairs
- student support
- housing staff
- dining staff
- financial-aid staff
- student accounts staff
- career services
- communications staff
- research administration
- department administrator
- institution leadership
- IT administrator
- security administrator
- accessibility administrator

External:
- invited guardian or supporter
- employer
- mentor
- approved partner
- certified marketplace developer

Semester company:
- founder/executive
- sales
- implementation
- customer success
- support
- finance
- marketing
- product
- engineering
- platform operations
- security/privacy/compliance
- legal
- people operations
- procurement

MODEL RESPONSIBILITIES, NOT JUST ROLE LABELS
A role assignment must have:
- verified assigner
- workspace
- scope
- permitted capabilities
- effective date
- optional expiry
- revocation history

ONBOARDING
 1. Preserve the person's entry intent.
 2. Authenticate.
 3. Identify or create the correct workspace.
 4. Verify institutional membership when required.
 5. Assign only verified responsibilities.
 6. Explain data sources and privacy.
 7. Request optional connections individually.
 8. Guide the person to a first meaningful action.
 9. Allow nonessential steps to be skipped.
 10. Show setup progress honestly.

 Never let someone obtain an institutional staff role merely
 by selecting it in a dropdown.


1.4 Student product structure

 CANONICAL STUDENT DESTINATIONS

 Today
 My Path
 Search
 Plan
 Me

 DOMAIN GROUPS

 TODAY
 - action center
 - urgent blockers
 - upcoming deadlines
 - next best actions
 - notifications
 - recent work
 - contextual support
 - source freshness

 MY PATH
 - goals
 - academic milestones
 - program and degree requirements
 - progress
 - registration readiness
 - career direction
 - evidence and portfolio

 SEARCH
 - courses
 - documents
 - institutional policies
 - campus services
 - opportunities
 - approved people discovery
 - permitted community content
 - source-linked AI explanations
PLAN
- calendar
- tasks
- deadlines
- schedules
- study plans
- appointments
- registration planning
- financial task planning

ME
- profile
- memberships
- connected accounts
- privacy and sharing
- accessibility and reader settings
- notification preferences
- personal subscription
- data export
- deletion requests
- support

ADDITIONAL PRODUCT DOMAINS

Learning:
courses, Course Studio, assignments, study, notes, flashcards,
practice, research, citations, writing, documents, sheets, decks.

Academic:
degree progress, registration, prerequisites, holds,
waitlists, grades, transcript references, advising.

Campus:
events, organizations, maps, facilities, housing,
dining, transportation, mail, campus service discovery.

Support:
service directory, appointments, cases, follow-up,
support handoffs, accessibility-related service interfaces.

Career:
opportunities, applications, resumes, portfolio,
verified evidence, appointments, mentors, employers.

Community:
groups, memberships, posts, discussions, events,
messages, moderation, reporting, privacy.

Marketplace:
listings, approved applications, subscriptions,
orders, disputes, commissions, partner certification.

Family and supporters:
explicitly scoped sharing, payload preview,
expiry, revocation, access history.
  ASK SEMESTER
  A clearly labelled AI-assisted interface.
  No human persona.
  No implication that the assistant is the registrar,
  an instructor, a financial adviser, or an official decision-maker.


The five canonical destinations and these broader product families are grounded in the design
and operating books. [3] [4]

1.5 Institutional capabilities

  INSTITUTION OS MODULES

  Institution overview:
  operational status, approved measures, pending decisions,
  integration freshness, service conditions.

  Academic administration:
  terms, programs, courses, sections, enrollment,
  requirements, academic policy versions.

  Registrar operations:
  registration requests, holds, readiness rules,
  exceptions, approvals, reconciliation, migration controls.

  Teaching:
  course workspace, teaching team, assignment administration,
  approved grade workflows, course AI policy.

  Advising:
  caseloads, appointments, shared plans, follow-up,
  appropriate scoped notes.

  Student services:
  service catalog, intake, routing, appointments,
  case assignment, service status, escalation.

  Institutional finance:
  student-account references, charges and obligations where authorized,
  aid tasks, reconciliation, finance approvals.

  Communications:
  audiences, templates, approval workflows,
  delivery status, preferences.

  Identity and security:
  SSO configuration, memberships, responsibilities,
  access reviews, privileged access, audit.

  Integrations:
  connections, credentials references, data mapping,
  sync runs, errors, reconciliation findings.

  Policy:
 versioned policies, applicability,
 deterministic rules, explanations, exceptions.

 Analytics:
 permissioned operational reporting and approved aggregates.
 No individual surveillance scoring disguised as student success.

 Institutional billing:
 contract visibility, subscription scope,
 licensed modules, usage, invoices where permitted.

 AUTHORITY RULE
 The authoritative owner for each domain must be explicit.
 Semester may own a native workflow while an external system
 remains authoritative for the final institutional record.


1.6 Company OS requirements

 BUILD SEMESTER AS A COMPANY, NOT ONLY AS AN APP

 EXECUTIVE
 KPIs, decisions, risks, work items, approvals,
 operating reviews, strategic goals, ownership.

 SALES / REVENUE
 accounts, contacts, opportunities, qualification,
 demos, proposals, quotes, approvals, contracts,
 renewal and expansion.

 IMPLEMENTATION
 customer handoff, scope, RACI, milestones,
 data readiness, SSO setup, integrations,
 training, acceptance, launch gates.

 CUSTOMER SUCCESS
 activation, adoption, workflow completion,
 outcome measures, sponsor reviews,
 renewal risk, expansion.

 SUPPORT
 tickets, severity, routing, escalation,
 response clocks, knowledge base, feedback,
 incident linkage.

 FINANCE
 commercial subscriptions, invoices, collections,
 credits, refunds, payment references,
 budget, cash forecasts, cost allocation,
 customer profitability, accounting exports.

 MARKETING
 website, content, campaigns, lifecycle messages,
 claims register, approvals, customer-reference permissions,
 channel performance.
  PRODUCT AND ENGINEERING
  requirements, backlog, releases, flags,
  quality, dependency risks, feedback,
  architecture decisions, evidence.

  TRUST
  controls, evidence, policy register,
  security findings, privacy requests,
  accessibility issues, vendor assessments,
  questionnaire responses.

  LEGAL
  contracts, versions, obligations,
  approval status, renewals, notices.

  PEOPLE
  hiring, onboarding, training,
  access provisioning, reviews, offboarding.

  VENDORS
  reviews, contracts, purpose, owner,
  spend, renewal, risk, exit plan.

  PARTNERSHIPS
  partner lifecycle, integrations,
  agreements, certification, commercial terms.

  RESEARCH AND OUTCOMES
  metric definitions, baselines,
  study protocols, evidence, limitations.

  PLATFORM OPERATIONS
  tenants, deployments, integration health,
  errors, latency, queue lag, incidents,
  backups, restore tests, cost budgets,
  AI gateway controls.

  PUBLIC CLAIMS
  Do not publish a customer name, outcome,
  security claim, certification, or price
  without an approved source and publication permission.


These functions align with the 15-function Company OS in Book 1. Its finance model also
distinguishes native commercial records from external banking, payroll, and statutory
accounting. [3]

1.7 Design and voice

  VISUAL CHARACTER
  Calm, scholarly, precise, warm, source-aware.
  Not childish, noisy, gamified, surveillance-oriented,
  or a generic SaaS dashboard.

  FOUNDATIONS
- Ink chrome: #090a0e
- Parchment content: #f4f1ea
- Parchment panels: #fbf9f4
- Semester blue on light: #416180
- Semester blue on dark: #94bce3

TYPOGRAPHY
- Barlow: body
- Barlow Condensed: headings and controls
- Cinzel: rare editorial display and wordmark
- system monospace: identifiers and technical metadata

Use provided assets when available.
If fonts or assets are unavailable, use a clearly documented fallback.
Do not fabricate the official logo.

COMPONENT PRINCIPLES
Reuse existing Semester components.
Use semantic tokens.
Border first, shadow second.
One primary action per decision region.
No nested decorative card grids.
No emoji, streaks, rankings, confetti, or fake urgency.
No stock photography or AI imagery inside the product.

RESPONSIVE
Student experience is mobile-first.
Institution and company consoles support dense desktop work,
but must remain usable on smaller screens.

ACCESSIBILITY
Target WCAG 2.2 AA.
Treat this as a requirement, not a conformance claim.
Provide semantic landmarks, labels, visible focus,
keyboard interaction, reduced motion, error recovery,
and meaningful state announcements.

EVERY DATA REGION NEEDS
- loading
- empty
- partial or stale
- offline where applicable
- error and recovery
- permission-restricted
- successful state

VOICE
Explain:
1. What is true.
2. What it means.
3. What the person can do.

Examples:
"Your course connection has not updated since Tuesday.
Deadlines may have changed. Reconnect it or check the course page."
  "Your request was sent to the Registrar.
  You are not enrolled until the institution confirms it."

  SOURCE LABELS
  Official
  Connected
  Yours
  AI-assisted
  Estimated
  Needs review
  Sample

  Use a canonical vocabulary and mapping.
  Do not invent a different label set in every module.
  Every important fact should expose its source and freshness.


These specific visual foundations, interaction principles, and voice requirements come from
the Semester books. Where existing repository tokens differ, inspect and reconcile them rather
than overwriting them blindly. [4] [3]

1.8 Privacy, safety, and AI

  DEFAULT PRIVATE
  Personal notes, drafts, plans, and study activity are private
  unless an explicit sharing rule says otherwise.

  CONSENT
  Sharing must specify:
  what, recipient, purpose, duration, and revocation.

  GUARDIANS
  No automatic access to student information.
  Only explicit, scoped, revocable delegation.

  SENSITIVE SERVICES
  Do not build unrestricted sensitive-case storage.
  Protected service categories require separately approved
  data models, access controls, retention, and operational procedures.

  SAFETY
  Emergency and safety-report flows must follow institution-approved routing.
  Do not silently retain report content or send it into analytics.

  AI DEFAULT
  Student records must not be sent to external model providers.
  Use a central policy-enforced AI gateway.
  Allow only explicitly approved use cases and source classes.

  SOURCE CONFLICT
  Some source artifacts suggest future institution-controlled AI access
  by data type, while stronger operating rules prohibit student-record egress.
  Use no student-record egress as the default.
  Do not enable broader access until the founder and institution approve
  a reconciled policy and required technical controls.
  AI CAN
  Explain permitted policies.
  Help with approved learning materials.
  Draft from allowed inputs.
  Cite permitted sources.
  Offer actions for human review.

  AI CANNOT
  Silently change grades.
  Determine official eligibility.
  Submit academic work without an approved explicit workflow.
  Move money.
  Grant access.
  Override institutional policy.
  Treat retrieved text as trusted system instructions.

  SEARCH
  Apply authorization before ranking and retrieval.
  Do not leak titles, counts, snippets, or embeddings from inaccessible data.

  OPERATIONS
  No student-record content in ordinary support tickets,
  general application logs, marketing analytics, or public error reports.
  Use internal references and approved diagnostic metadata.


The AI conflict is real in the provided material: some prototype guidance describes institution-
controlled future access, while core operating and architecture rules prohibit student-record
egress. The restrictive default above is deliberate until that conflict is resolved. [4] [3]

1.9 Zite implementation instructions

  ZITE EXECUTION RULES

  First assess what this environment actually supports.

  Report support for:
  - external-user authentication
  - verified roles and scoped permissions
  - database constraints
  - row-level or equivalent server-side isolation
  - transactions
  - secret storage
  - signed webhook verification
  - background jobs
  - retries and dead letters
  - audit records
  - file permissions
  - migrations and versioning
  - automated testing
  - export and source ownership
  - environment separation
  - regional deployment controls
  - backups and restore evidence
  Do not assume a feature exists because the platform has a database.

  For each requirement classify:
  supported directly
  supported through verified integration
  requires external backend
  unsupported
  not yet verified

  If a requirement cannot be securely enforced in Zite,
  build the interface against a documented backend API.
  Do not replace server-side controls with hidden buttons,
  frontend filters, or client-side role checks.

  DEMO MODE
  Use synthetic data only.
  Label sample records and metrics.
  Do not use real institution names as endorsements.
  Do not display fake compliance badges or fake connection status.

  PERSISTENCE
  Persist business data in the approved backend.
  Use local storage only for non-sensitive preferences
  or explicitly labelled simulator state.

  COMPLETION
  A feature is not finished because a page exists.
  Require data persistence, permissions, business logic,
  failure states, tests, observability, and acceptance evidence.

  APPROVALS
  Do not deploy production, send communications,
  modify live customer data, move money,
  or change external permissions without explicit approval.

  FIRST OUTPUT
  Return:
  1. Your understanding of Semester.
  2. The capability assessment.
  3. Proposed architecture.
  4. Entity and permission inventory.
  5. Implementation phases.
  6. Unresolved decisions.
  7. The first complete vertical slice.



```
