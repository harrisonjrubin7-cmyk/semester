# Semester Institutional Rollout Master Specification

**Version date:** 2026-09-23  
**Status:** Controlled rollout source  
**Evidence basis:** §1–§18 approved design

> Truth boundary: repository behavior and reproduced checks are current evidence. Provider activation, institutional approval and production data exchange remain external gates until authoritative readback succeeds.

## Verified baseline

| Measure | Current value |
| --- | ---: |
| Registered destinations | 59 |
| Screen union members | 81 |
| Accounted non-destinations | 22 |
| Unaccounted screens | 0 |
| Database migrations | 46 |
| Duplicate migration versions | 0 |
| Institution gateway files | 26 |

# Semester Institutional Rollout Design

**Status:** Approved conversational design, written specification awaiting owner review  
**Date:** 23 September 2026  
**Product:** Semester  
**Authoritative implementation target:** Existing React, TypeScript and Supabase repository  
**Primary implementation consumer:** Claude Code, working in dependency-ordered execution packets  

## 1. Decision and purpose

Semester will evolve from its existing application into a complete, multi-institution academic operating system. The current React, TypeScript and Supabase product remains the authoritative implementation. The shared Bubble conversation is a requirements source, not a replacement platform. Existing working capabilities, routes, stored data, exports, offline behavior, design language and regression protections must be preserved while the architecture is extended.

The target is not a larger collection of disconnected screens. The target is one coherent student journey that connects academic information, daily planning, studying, progress, campus life, communication, creation tools, institutional services and governed AI.

The central product statement is:

> Semester is the academic operating system that turns scattered course information into a clear, adaptive plan, helping students know what matters now, study with purpose and make measurable progress toward graduation.

The short version is:

> Everything for school. One clear path forward.

The primary product loop is:

> Capture -> Confirm -> Plan -> Study -> Measure -> Adapt

Every product and technical decision must improve this loop or extend it without weakening it.

## 2. Source hierarchy and truth policy

The project has several overlapping sources: the current repository, the deployed site, the shared ChatGPT conversation, the Semester Google Drive folder and the additional Central Statement and capability inventory supplied on 23 September 2026. They do not all describe the same point in time.

When sources disagree, use this authority order:

1. Current executable repository behavior and schema.
2. Current live-site behavior reproduced during the audit.
3. Approved decisions in this specification.
4. The 23 September Central Statement and 60-capability inventory.
5. The shared ChatGPT requirements conversation.
6. Existing Drive plans and briefs, using their modification dates and internal evidence.
7. Older summaries, recordings and memory as discovery context only.

Repository or live behavior is evidence of what exists, not automatic approval of what should remain. Approved design decisions in this document control the target state.

Every significant claim in the institutional package must be labeled as one of:

- **Verified current behavior:** reproduced in the current code, database or live site.
- **Repository documented:** asserted by a current repository document but not reproduced in this workstream.
- **Target requirement:** approved behavior that still needs implementation or verification.
- **Sandbox complete:** the full Semester workflow and provider contract are implemented and tested against a controlled adapter.
- **Externally gated:** the implementation is ready but production activation requires credentials, contracts, vendor configuration or institutional authority.
- **Production verified:** exercised successfully against the intended production provider with authoritative readback.

No generated plan, passing builder process, simulated receipt or configured-looking screen may be presented as external completion.

## 3. Product identity and experience principles

### 3.1 Product promise

Semester replaces academic chaos with clarity. Every time a student opens the product, the experience should answer:

1. What matters now?
2. What should I do next?
3. Am I making progress?

The primary tagline candidate is **Own your semester.** It remains proposed brand copy until the owner approves it as official.

### 3.2 Personality and voice

Semester should be calm, capable, organized and accurate. It should be intelligent without appearing complicated, encouraging without becoming childish, and supportive without guilt or pressure.

Preferred language is direct and actionable:

- "Here is what needs your attention."
- "You have 45 minutes. Start this next."
- "Your plan changed. Let us rebalance it."
- "This deadline came from your syllabus."
- "Three tasks moved forward, not lost."

### 3.3 Experience rules

- Show the next decision before showing the full toolset.
- Preserve depth but reveal it when relevant.
- Never confuse sample data with a student's real work.
- Never hide required account, integration, AI or institutional setup.
- Let students correct every important imported fact.
- Treat missed work as a planning problem, not a personal failure.
- Prefer one connected workflow over duplicate destinations.
- Keep mobile useful for quick decisions and desktop powerful for deeper work.
- Keep essential planning usable without AI.
- Never reward superficial activity instead of meaningful academic progress.

## 4. Navigation and information architecture

Semester will have one global navigation hierarchy expressed differently by viewport.

### 4.1 Five primary destinations

The permanent student destinations are:

1. **Home** - Today, Next Up, workload, recommendations and recent work.
2. **Calendar** - classes, deadlines, exams, study sessions, meetings and events.
3. **Discover** - campus search, courses, people, organizations, events, resources and opportunities.
4. **Ask Semester** - grounded AI, delegated workflows, automations and approval queues.
5. **Inbox** - messages, requests, mentions, important notifications and action approvals.

Mobile uses a five-item bottom navigation. Desktop and tablet use the same hierarchy in a left rail or sidebar. Ask Semester may receive visual emphasis but remains part of the same hierarchy.

### 4.2 Seven functional workspaces

The supplied seven-workspace model is retained as contextual product organization rather than a competing global navigation:

- Home
- Courses
- Study
- Create
- Campus
- Career
- Messages

Courses, Study, Create, Campus, Career and Messages open from Home, Discover, Inbox, search, shortcuts or contextual links. They use local tabs and preserve their current deep routes.

### 4.3 Existing destination preservation

The current destination registry and saved navigation modes must remain compatible. Existing routes cannot be deleted or silently repurposed. The complete capability set remains reachable through:

- Universal search and command palette
- Search aliases and synonyms
- App directory
- User-configurable shortcuts
- Browser-style internal tabs
- Bookmarks and favorites
- Recent and recently closed items
- Contextual local navigation
- Ask Semester tool invocation

The five-destination model will first ship behind a feature flag. Migration preserves existing saved navigation preferences and provides an explicit choice rather than silently overwriting them.

## 5. Canonical platform architecture

### 5.1 Technical direction

The architecture remains:

- React and TypeScript client application
- Supabase authentication, Postgres, storage and edge functions
- Existing institution gateway for protected institutional operations
- Offline-first device persistence for appropriate personal workflows
- Server-side AI gateway for managed generation and tool execution
- Provider adapters for university and productivity integrations

The static SPA hosting model may remain for the client, but responsibilities that require headers, protected secrets, background work, authoritative transactions or operator-visible telemetry must live in the institution gateway, Supabase functions or an explicitly selected server platform.

### 5.2 Tenant boundary

Every institution-scoped record must reference a University tenant directly or through a relationship that is enforced at the database layer. Tenant isolation cannot rely on hidden UI, client filtering or an email-domain check performed only in the browser.

The canonical hierarchy begins:

University -> Campus -> School -> Department -> Academic Program -> Term

User relationships include:

User -> Profile -> Verified Institution Membership -> Role Grants -> Resource Permissions

Every protected search result, AI retrieval, file, message, notification, course, organization, event and administrative operation must apply the same tenant and resource authorization rules.

### 5.3 Canonical academic model

The academic chain is:

University -> Term -> Course -> Course Section -> Enrollment -> Assignment or Exam -> Calendar Event -> Study Session -> Degree Plan

Imported data must retain:

- Provider
- External identifier
- Source type
- Source version or hash
- Last synchronized time
- Last verified time
- Sync status
- Authority level
- Original source reference

The same Assignment must be used by course, calendar, planning and AI features. Duplicate representations such as a separate AI assignment and calendar assignment are prohibited.

### 5.4 Provenance vocabulary

User-facing records use an explicit provenance and health vocabulary:

- Official
- Connected
- Semester-created
- Local
- Sample
- Out of date
- Pending
- Uncertain
- Error
- Needs connection

The vocabulary must be backed by data rather than decorative labels.

## 6. Identity, roles and permissions

Semester must support users holding multiple roles without separate accounts. Roles include:

- Prospective student
- Undergraduate student
- Graduate student
- Transfer student
- Alumni
- Faculty
- Teaching assistant
- Advisor
- Tutor
- Organization member
- Organization officer
- Organization administrator
- Employer
- Business administrator
- University staff
- Department administrator
- University administrator
- Moderator
- Platform administrator

Role grants are tenant-scoped and may also be resource-scoped. University administrators cannot automatically access private student academic work unless a documented institutional purpose and permission permit it.

Required controls include:

- Verified institutional membership
- Institution-managed SSO using OIDC or SAML where available
- Least-privilege role grants
- Resource sharing rules
- Explicit consent records
- Administrative impersonation prohibition by default
- Account and device-session management
- Access revocation
- Complete account deletion
- Audit records for administrative and consequential actions

Cross-tenant isolation tests are a release blocker. A stranger from another tenant must be unable to read or write protected records through database access, search, direct URLs, storage, realtime channels, edge functions or AI retrieval.

## 7. Complete product systems

No capability is removed from the target end state. Delivery phases establish dependency order, not permanent deferral.

### 7.1 Academic OS

The Academic OS includes:

- University, term, course and section management
- Enrollment and academic records
- Syllabus import from PDF, Word, Slides, text and archives
- Manual course creation
- LMS course ingestion
- Assignment, deadline, rubric and grade management
- Original source retention and citations
- Human review before imported facts become trusted
- Calendar integration
- Workload planning
- Study-session scheduling
- Office hours and tutoring
- Study groups
- Grade projection and what-if planning
- Degree audit and what-if degree plans
- AP, IB, transfer and residency rules
- Registration search, sections, eligibility, conflicts and Plan A/B/C
- Authorized Register, Drop, Swap and Waitlist actions
- Advising and faculty experiences

The primary acceptance journey is:

1. Add or import a course.
2. Review extracted facts and sources.
3. Confirm or correct assignments and deadlines.
4. See those records in Home and Calendar.
5. Receive a realistic plan.
6. Launch a meaningful study action.
7. Record learning evidence and completion.
8. Return later and see accurate progress.
9. Recover gracefully when work changes or is missed.

### 7.2 Study and learning evidence

The eleven study modes remain:

1. Cards
2. Read
3. Field Guide
4. Watch
5. Slides
6. Doc
7. Quiz
8. Figures
9. Cases
10. Cram
11. Listen

The guide builder supports eleven editable output formats:

1. Comprehensive study guide
2. Simple summary
3. Outline
4. Bullet-point notes
5. Flashcards
6. Practice quiz
7. Practice exam
8. Key terms and definitions
9. Concept map
10. Formula and problem-solving guide
11. Audio or read-aloud guide

Learning evidence uses five explainable states:

- Unseen
- Introduced
- Practising
- Retained
- Needs review

Evidence remains separate from grades and does not require points, badges, leaderboards or fabricated mastery scores. Students can inspect why a learning state was assigned and reset evidence by course.

Teach-back and the private mistake journal must be complete, including concept selection, a student's explanation, reference comparison, correction or reflection, later review, revision and export to Documents.

### 7.3 Campus Graph and Discover

The Campus Graph links:

- Users and profiles
- Universities and departments
- Courses and sections
- Faculty
- Organizations and memberships
- Events and RSVPs
- Campus resources and official processes
- Jobs and employers
- Housing and marketplace entities
- Saved items, collections, history and relationships

Universal search supports categories, synonyms, autocomplete, typo tolerance, filters, sorting, recent searches, saved searches, pagination and permission-aware results.

Every result exposes truthful actions such as Connect, Message, Follow, Join, Apply, RSVP, Save or open an official handoff. An unavailable institutional operation must never appear completed.

### 7.4 Communication and community

Communication includes:

- Connection requests and relationship management
- Direct and group conversations
- Course, organization and event rooms
- Message requests
- Mentions and reactions
- Inbox and notification feed
- Blocking and reporting
- Moderation cases
- Email drafting and connected sending
- Group-work ownership and deadlines
- Video-call entry and provider integration

Private messages are visible only to conversation members and explicitly authorized moderation workflows. Blocking must be enforced before protected content reaches the client.

### 7.5 Semester Intelligence

Semester Intelligence is a governed operating layer, not a generic chatbot. Its foundation includes:

- AI gateway
- Provider-neutral model routing
- Tenant budgets and rate limits
- Tool registry
- Permission-aware context retrieval
- Source grounding and citations
- Confidence and uncertainty handling
- User-controlled memory and preferences
- Action classification
- Confirmation policies
- Action receipts
- Undo or correction paths
- Evaluation and cost reporting

Action classes are:

| Class | Examples | Required behavior |
| --- | --- | --- |
| Read | Find deadlines, courses, files or events | Permission checked and source grounded |
| Prepare | Draft plans, messages or alternatives | Editable and inspectable |
| Internal write | Create a task, save an item or schedule a study block | Visible receipt and reversal path |
| Consequential | Send, submit, register, drop, purchase or alter an official record | Explicit confirmation and authoritative receipt |

Initial tools answer what the user has today, what is due, what to study next, where a course fact came from, and how to find campus information. They create tasks and study sessions and can prepare the upcoming week.

Delegated workflows decompose goals into transparent steps. The Opportunity Engine ranks proactive suggestions by urgency, confidence, relevance and time saved. Personal Automations remain visible, editable, pausable and auditable.

### 7.6 Productivity workspace

The complete Create and Workspace system includes:

- Semester Drive and folders
- Files and notes
- Documents
- Presentations
- Spreadsheets
- Forms
- Designs
- Video projects
- Whiteboards, graphs and diagrams
- Equations and mathematical tools
- Projects and meetings
- PDF reading, highlighting and study extraction
- Comments, suggestions and version history
- Course and assignment associations
- Autosave, recovery and recoverable Trash
- Real DOCX, PDF, PPTX, XLSX and CSV export
- Google Workspace integration
- Microsoft 365 integration
- Zoom, Meet and Teams integration
- Internal tabs, split view, saved sessions and multi-window behavior

Original file bytes and stable identifiers must be preserved. Failed generation or rendering must not destroy prior work.

### 7.7 Institutional services

All thirty-seven institutional service areas remain in scope:

- Courses
- Assignments and submissions
- Quizzes and exams
- Grades and feedback
- Course registration
- Advising
- Student records and transcripts
- Graduation and credentials
- University email
- Forms and surveys
- University directory
- Help and service status
- Administration
- University bills
- Financial aid
- Dining
- Housing
- Campus mail
- Transportation
- Libraries
- Health services
- Campus safety
- Student ID
- Athletics
- Recreation and intramurals
- Clubs and organizations
- Career and employers
- Alumni and mentorship
- Study abroad
- Authorized family access
- Admissions
- Welcome and orientation
- Graduate and professional education
- Research and ethics
- International student services
- Accessibility services
- Feedback and appeals

Each area follows the transaction lifecycle:

> Discover -> Prepare -> Validate -> Authorize -> Submit -> Receipt -> Track or correct -> Reconcile and audit

### 7.8 Career, housing, marketplace and wider campus life

The platform includes:

- Career planning and experience records
- Jobs, internships, research and fellowships
- Employer verification
- Private application tracking
- Resume, cover-letter and interview workspaces
- Organization finance, ticketing and dues
- Marketplace listings, offers and transactions
- Payments, refunds and disputes through a payment provider
- Housing comparison, contracts, subleases and roommate matching
- Family or authorized-payer access
- Athletics, travel and eligibility workflows
- NIL tracking
- Prospective-student, applicant, transfer, graduate and alumni pathways

## 8. Integration architecture

Integrations use normalized provider contracts rather than vendor logic embedded in screens.

Adapter families include:

- Identity
- LMS
- Student information system
- Degree audit
- Registration
- Email
- Calendar
- Files and productivity
- Meetings
- Payments
- Career
- Housing and campus services

Providers include Brightspace, Canvas, Blackboard, Moodle, Google Workspace, Microsoft 365, Zoom, Meet and Teams. Additional providers must implement the same contracts.

Personal access tokens are not the institutional default. The Canvas token path may remain as a plainly labeled personal-use fallback, but managed institutions use approved OAuth, LTI, SSO or service integrations with minimum scopes.

Every adapter implements:

- Authorization status
- Scope disclosure
- Read and write capability declarations
- External identifiers
- Deduplication
- Source precedence
- Retry and quarantine behavior
- Last-synced and last-verified timestamps
- Degraded and disconnected states
- Idempotent writes
- Authoritative receipts
- Reconciliation

When production authorization is unavailable, Semester must still implement the full contract, sandbox adapter, administration, receipts, failure handling and test suite. The UI says **Awaiting institution authorization** rather than simulating success.

## 9. Security, privacy and governance

### 9.1 Security controls

Required controls include:

- Database-enforced tenant and resource isolation
- Least-privilege role grants
- Storage isolation
- Protected realtime channels
- Server-side verification for privileged functions
- Secret management outside the client
- Content Security Policy and host-level security headers
- Rate limiting and abuse controls
- Administrative audit events
- Security logging and operator alerts
- Dependency and secret scanning
- Backup encryption
- Restore verification
- Incident-response exercises
- Vulnerability intake and response

### 9.2 Privacy controls

Semester must maintain a data inventory and classification vocabulary covering academic records, account data, communications, files, AI inputs and outputs, financial records, health-related service interactions and administrative data.

Users receive:

- Clear collection and use explanations
- Consent before selected content is sent to AI or an external provider
- Access and export
- Correction
- Deletion
- Retention information
- Sharing controls
- Connected-service revocation
- AI memory view, edit, forget, pause and reset

Institutional documentation must address FERPA-facing responsibilities without claiming legal certification that has not been obtained.

### 9.3 AI governance

AI cannot bypass database permissions. AI answers expose sources, conflicts and uncertainty. The system must distinguish known, likely, inferred and unknown information. Sensitive traits cannot be inferred for personalization. A learned writing style cannot authorize communication or misrepresent authorship.

Tenant administrators may configure allowed models, tools, data categories, retention, budgets and confirmation policies within platform safety boundaries.

## 10. Accessibility and responsive behavior

Semester targets WCAG 2.2 AA for critical workflows and produces an initial Accessibility Conformance Report before institutional rollout.

Requirements include:

- Semantic structure
- Keyboard operation
- Visible focus
- Accessible labels and descriptions
- Modal focus management
- Touch targets
- Contrast across flat and gradient surfaces
- Reduced motion
- Zoom and reflow
- Screen-reader status announcements
- Accessible alternatives for drag and drop
- Accessible charts and diagrams
- Phone, tablet, compact desktop and full-workspace layouts
- No required outer horizontal scrolling
- Clear loading, empty, validation, saved, error and degraded states

Automated checks support but do not replace manual assistive-technology testing.

## 11. Data continuity, migration and rollback

Existing Semester data is preserved through versioned, forward-only migrations.

The migration sequence is:

1. Snapshot and export current production data and schema fingerprints.
2. Map every existing record to the canonical model.
3. Preserve unknown fields until explicitly dispositioned.
4. Retain original files, hashes and source references.
5. Quarantine ambiguous or invalid records without discarding them.
6. Reconcile local and cloud copies through an explicit user-visible decision.
7. Apply migrations in staging against production-shaped data.
8. Verify counts, relationships, policies, storage and attachments.
9. Run rollback and full restore drills.
10. Release by tenant and feature flag.

No migration may silently overwrite one copy with another, change stable identifiers without a mapping, or report success before readback.

## 12. Testing and definition of complete

A capability is complete only when it has:

- Canonical data model
- Responsive user experience
- Persistence and synchronization where required
- Tenant and resource permissions
- Search integration
- AI integration where relevant
- Provenance and status states
- Loading, empty, validation, error and degraded states
- Audit history for significant actions
- Unit tests
- Integration tests
- Browser tests for critical journeys
- Accessibility verification
- Migration and rollback coverage
- Operational documentation
- Evidence recorded in the completion ledger

Mandatory program gates include:

- Type checking
- Lint and structural audits
- Deterministic and shuffled test suites
- Time-zone test suite
- Production build
- Database reconstruction from migrations
- Row-level-security suites
- Cross-tenant isolation suite
- Staging-production fingerprint comparison
- Backup and restore drill
- Performance budgets and SLO checks
- Accessibility audit
- Security review
- Representative browser journeys by role and viewport

Mutation or revert checks must prove that important tests fail when the protected behavior is removed.

## 13. Delivery program

Nothing is omitted from the end state. The program is divided because dependencies make an all-at-once implementation unsafe and unverifiable.

### Phase 0: Establish the truth

- Inventory every route, table, integration, document and current claim.
- Reconcile the live site, repository, Drive corpus, shared conversation and 60-capability inventory.
- Produce the capability disposition and requirements traceability matrices.
- Establish current verification baselines.
- Create the institutional report and Claude Code program package.

### Phase 1: Institutional foundation

- Canonical tenancy
- Identity and SSO
- Complete roles and permissions
- Tenant administration
- Audit events and consent
- Retention and deletion
- Staging, backup, restore and monitoring
- Tenant-level AI governance

### Phase 2: Academic OS

- Complete academic model
- Ingestion and verification
- Assignments, exams, grades and calendar
- Study modes and learning evidence
- Degree and registration
- LMS adapters
- Faculty and advising

### Phase 3: Campus Graph and communication

- Profiles and relationships
- Universal search
- Organizations and events
- Messages, Inbox and notifications
- Moderation
- Campus resources and processes

### Phase 4: Semester Intelligence

- Governed AI gateway
- Tool registry
- Grounded retrieval
- Memory and preferences
- Delegated workflows
- Opportunity Engine
- Automations and approval queues
- Quality, cost and time-saved metrics

### Phase 5: Productivity workspace

- Drive, files, documents, presentations, sheets, forms, design, video and projects
- Version history, sharing, comments and Trash
- Google and Microsoft productivity integrations
- Meeting integrations

### Phase 6: Institutional transactions

- SIS and official-record adapters
- Registration transactions
- Billing and financial aid
- Housing and dining
- Campus card, mail, transport, libraries, health, safety and accessibility services
- Athletics, family and administrative workflows

### Phase 7: Career and campus economy

- Career and employer systems
- Applications and interview workflows
- Marketplace
- Payments, refunds and disputes
- Housing marketplace and roommate workflows
- Organization finance
- NIL and alumni pathways

### Phase 8: Institutional rollout

- Two synthetic institutions and complete role matrix
- Controlled student and staff pilot
- Institutional security and accessibility review
- Procurement package
- Operational readiness exercises
- Tenant-cohort rollout
- Production monitoring and reconciliation

## 14. Local preview and launch from Codex

The implementation must be runnable from this workspace so the owner can preview it before any deployment.

The preview workflow will:

- Use a dedicated implementation worktree or branch based on current `origin/main`.
- Preserve the existing repository and production deployment.
- Install dependencies only through the repository's documented setup.
- Run the application on a local development server.
- Seed synthetic institutions and role-specific sample data without using private production records.
- Open the preview in Codex for desktop and mobile inspection.
- Keep the browser tab available while review continues.
- Provide clear commands for restart and shutdown.

Local preview is not production deployment. Launch means the verified preview is open and usable in Codex. Production deployment requires a separately approved release action after all relevant gates pass.

## 15. Google Drive and publication package

A new `Semester - Institutional Rollout` folder will be created inside the existing Semester Drive folder. Existing files remain untouched. Duplicate documents are indexed rather than deleted.

The folder will contain:

1. Semester Institutional Rollout Master Specification
2. Executive and Institutional Brief
3. Current Product and Live Site Audit
4. Capability Disposition Matrix
5. Canonical Data Model and Permissions
6. Product Systems and User Journeys
7. AI Governance and Automation
8. Integration Architecture
9. Security Privacy and Compliance
10. Accessibility Conformance Plan
11. Migration Rollback and Disaster Recovery
12. Testing and Verification Plan
13. Pilot and Institutional Rollout Runbook
14. Procurement and Security Review Package
15. Claude Code Execution Guide
16. Requirements Traceability and Source Index
17. Decisions Risks and External Blockers

The primary PDF mirrors this program design, records current evidence and includes the source index and verification appendix. It must be reopened, rendered page by page and visually inspected before delivery. Google documents must be read back after import.

## 16. Claude Code execution model

Claude Code receives ordered, bounded execution packets rather than one unbounded command.

Every packet includes:

- Objective and user outcome
- Requirements and traceability identifiers
- Dependencies
- Exact repository areas to inspect
- Expected interfaces and data changes
- Security and privacy rules
- Accessibility requirements
- Tests to write first
- Verification commands
- Migration and rollback steps
- Definition of complete
- Evidence to return
- Instruction to fetch and inspect current `main`
- Instruction to stop if equivalent work already landed

Claude Code must stop and report when:

- An approved architectural decision would be contradicted.
- A migration risks existing data without a proven path.
- A live connection requires credentials or authorization.
- Tenant isolation cannot be demonstrated.
- Existing capabilities would be removed.
- External success cannot be verified truthfully.

## 17. Program decomposition and next design boundary

This specification is a program design, not a single implementation plan. The complete platform is too large to execute safely as one plan. After owner approval, implementation plans will be written in dependency order, beginning with **Phase 0 Establish the Truth and Phase 1 Institutional Foundation**. Later plans cannot bypass an unmet dependency, but every phase remains part of the committed end state.

The first implementation plan will produce:

- Current-state evidence baseline
- Reconciled 60-capability matrix
- Requirements traceability registry
- Canonical tenant and role design mapped to the existing schema
- Concrete isolation and migration test plan
- Local preview setup and verified launch procedure
- Drive and PDF publication builders

No product implementation begins until that plan is reviewed and its execution method is selected.

## 18. Acceptance of this design

Approval means:

- The existing React, TypeScript and Supabase product is the build target.
- Nothing in the stated platform scope is permanently omitted.
- Delivery follows dependency-ordered phases.
- The five primary destinations coexist with seven contextual workspaces and the complete tool inventory.
- Institutional truthfulness and external authorization gates are mandatory.
- Existing data and functionality are preserved through verified migrations.
- The product is built and previewed locally before any production deployment.
- The written implementation plans, PDF and Drive package follow this specification.

Approval does not authorize production deployment, external institutional communication, purchasing, credential creation or destructive changes to existing Drive files.

