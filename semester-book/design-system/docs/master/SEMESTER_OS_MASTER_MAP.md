# Semester OS master map

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

Semester is one governed operating system for education.

**Doctrine:** Build core capabilities natively. Integrate responsibly during transition. Replace by domain only with evidence. Operate every domain as one coherent system.

## Control chain

Identity → Institution / tenant → Membership → Role → Capability → Scope → Policy → Data classification → Consent → Source authority → Workflow → Audit → Evidence → Outcome

## 21 layers

### 1. Public company and growth layer

- Screen groups: A · Public company, sales & marketing site
- Workflows: none
- Built in: ui_kits/company-site/
- Modules (9): Homepage, Product overview, Solutions by audience, Pilot pages, Pricing, Trust Center, Mission, Contact, Request pilot form

### 2. Identity, tenant, policy and trust foundation

- Screen groups: K · Institutional administration; M · Trust, privacy, security
- Workflows: Institutional implementation
- Built in: ui_kits/console/
- Modules (11): Identity providers, SSO configuration, SCIM provisioning, Memberships, Roles, Capabilities, Role grants, Policy hierarchy, Data classification, Consent policy, Audit explorer

### 3. Student OS

- Screen groups: B · Student OS
- Workflows: Student
- Built in: ui_kits/student/
- Modules (30): Today, Action Center, Calendar, Schedule, Tasks, Goals, Path, Degree progress, Program requirements, Term planning, Registration readiness, Course comparison, Workload planning, Cost planning, Courses, Notes, Files, Workspace, Search, AI Copilot, Community, Campus, Support, Career, Student account, Profile, Privacy settings, AI settings, Notifications, Data export/delete controls

### 4. Productivity and collaboration workspace

- Screen groups: B · Student OS
- Workflows: Student
- Built in: ui_kits/student/
- Modules (15): Tasks, Calendar, Notes, Documents, Files, Projects, Group workspaces, Research workspace, Writing workspace, Focus mode, Study sessions, Templates, Search, Notifications, Automations

### 5. Academic path and degree planning

- Screen groups: B · Student OS; E · Registrar & academic operations
- Workflows: Student, Registrar
- Built in: ui_kits/student/
- Modules (16): Program, Major/minor, Degree requirements, Course history, Current term, Future terms, Degree audit, Graduation scenarios, Transfer credits, Articulation rules, Prerequisites, Holds, Registration eligibility, Workload plan, Cost plan, Official record handoff

### 6. Course Studio and learning OS

- Screen groups: C · Faculty & Course Studio
- Workflows: Faculty
- Built in: ui_kits/staff/
- Modules (25): Course home, Syllabus, Learning objectives, Schedule, Announcements, Assignments, Assessments, Rubrics, Resources, Readings, Annotations, Study packs, Flashcards, Practice, Discussions, Groups, Office hours, Feedback, Gradebook, Regrades, Course AI rules, Academic integrity, Accessibility support, Learning evidence, Course analytics

### 7. Governed AI and intelligence platform

- Screen groups: none catalogued
- Workflows: AI
- Built in: ui_kits/architecture/
- Modules (26): Student Copilot, Course Tutor, Research Assistant, Writing Assistant, Study Planner, Registration Guide, Academic Path Explainer, Advisor Assistant, Faculty Assistant, Staff Workflow Assistant, Institutional Knowledge Assistant, Model Registry, Provider Registry, Policy Engine, Course AI Rules, Data Classification, Consent Controls, Source Retrieval, Citation/Provenance, Tool Permissions, Usage Quotas, Spend Meter, Evaluation Harness, Safety/Red-Team Tests, Human Escalation, AI Audit Log

### 8. Advising, student success and support

- Screen groups: D · Advisor & student success
- Workflows: Advisor / student success, Support
- Built in: ui_kits/staff/
- Modules (16): Caseload, Student path, Action completion, Check-ins, Appointments, Success plans, Advising notes, Referrals, Outreach, Support requests, Student-consented shares, Intervention tracking, Cohort view, Program outcomes, Escalation, Aggregate insight

### 9. Registrar, SIS and academic operations

- Screen groups: E · Registrar & academic operations
- Workflows: Registrar
- Built in: ui_kits/staff/
- Modules (30): Academic calendar, Terms, Catalog, Courses, Sections, Faculty assignments, Meeting times, Rooms, Capacity, Waitlists, Prerequisites, Registration windows, Time tickets, Holds, Overrides, Enrollment, Add/drop, Withdrawal, Academic record ledger, Grade ledger, Grade changes, Regrades, Degree audit, Transfer evaluation, Articulation rules, Graduation checks, Credential conferral, Transcript/export, Reconciliation, Migration center

### 10. Student accounts, billing and financial workflows

- Screen groups: F · Student accounts, aid & commerce
- Workflows: Student finance
- Built in: ui_kits/staff/
- Modules (16): Student account, Charges, Credits, Balance, Holds, Payment plan, Installments, Payment handoff, Refund status, Scholarships, Financial-aid handoff, Cost planner, Budget planner, Emergency support, Reconciliation, Audit ledger

### 11. Campus life and service super-app

- Screen groups: G · Campus life
- Workflows: Campus services
- Built in: ui_kits/student/
- Modules (16): Dining, Housing, Events, Organizations, Study spaces, Transit, Parking, Recreation, Library, Bookstore, Campus jobs, Volunteer opportunities, Local services, Safety resources, Wellness handoffs, Accessibility services

### 12. Community, organizations and peer connection

- Screen groups: H · Community & moderation
- Workflows: Community & moderation
- Built in: ui_kits/community/
- Modules (16): Community directory, Community feed, Posts, Comments, Reactions, Groups, Study sessions, Peer mentoring, Organization spaces, Alias/pseudonym controls, Reporting, Moderation, Appeals, Safety escalation, Community retention, Audit

### 13. Career, alumni, employer and lifelong learning

- Screen groups: J · Career, employer, alumni
- Workflows: Career & employer
- Built in: ui_kits/external/
- Modules (19): Skills graph, Evidence portfolio, Verified skills, Credential wallet, Resume, Cover letters, Interview prep, Opportunities, Internships, Employer profiles, Applications, Mentors, Alumni network, Career appointments, Career events, Continuing education, Microcredentials, Credential renewal, Career outcomes

### 14. Family and guardian consent platform

- Screen groups: I · Family & guardian
- Workflows: Family consent
- Built in: ui_kits/external/
- Modules (11): Consent invitation, Relationship confirmation, Scoped grants, Chosen information categories, Time-limited access, Shared items, Billing/support handoff, Communication preferences, Access history, Revocation, Audit

### 15. Institutional administration and control plane

- Screen groups: K · Institutional administration
- Workflows: Institutional implementation
- Built in: ui_kits/console/
- Modules (35): Tenant overview, Campus hierarchy, SSO, SCIM, Membership, Roles, Capabilities, Access reviews, Plans and entitlements, Feature policies, Cohorts, Kill switches, Module modes, Rollouts, Configuration Studio, Workflow Builder, Policy hierarchy, Governance stewards, Governance decisions, Integrations, Data classification, Consent policy, Retention, Legal holds, Data requests, AI provider policy, Approved sources, Compliance, Trust artifacts, Accessibility program, Incident notices, Risks, Audit explorer, Offboarding, Portability/export

### 16. Integration, migration and interoperability fabric

- Screen groups: L · Integrations
- Workflows: Controlled integration, Domain migration
- Built in: ui_kits/console/
- Modules (26): Provider directory, Connections, Security/privacy review, Scope approval, Mapping Studio, Mapping versions, Transform rules, Sync schedule, Sync runs, Sync errors, Dead-letter queue, Replay requests, Reconciliation, Schema drift, Duplicate resolution, Source ownership, Freshness monitoring, Webhooks, LTI, OneRoster, Edu-API, SIS/ERP adapters, LMS adapters, Google/Microsoft/Apple adapters, AI-provider adapters, Integration retirement

### 17. Security, privacy, accessibility, compliance and trust

- Screen groups: M · Trust, privacy, security
- Workflows: Incident
- Built in: ui_kits/compliance/
- Modules (32): Trust Center, Security overview, Privacy overview, Accessibility statement, Responsible AI, Data practices, Subprocessors, Reliability/status, HECVAT readiness, DPA process, Security questionnaires, Trust room, Vulnerability reporting, Asset inventory, Access review, Secret inventory, Vulnerabilities, Threat models, Security alerts, Incidents, Controls, Evidence, Vendor risk, Pen-test evidence, Break-glass review, Backup/restore, Disaster recovery, Data inventory, Retention, Legal holds, Privacy requests, Erasure/export

### 18. Operations command center

- Screen groups: N · Operations Command Center (/ops)
- Workflows: Incident, Support
- Built in: ui_kits/ops/
- Modules (41): Executive Overview, Operations Inbox, My Work, Approvals, Tenants, Tenant 360, Customers, Customer 360, GTM Accounts, Pilots, Implementation, Success Plans, QBRs, Renewals, Customer Health, Revenue, Billing, Support, Product Operations, Releases, Feature flags, Beta, Integrations, Trust, Compliance, Privacy, Security, Access Reviews, Break Glass, Incidents, SLOs, Error Budgets, Audit Explorer, Risks, Vendors, Finance, Forecasts, Reports, Board/Investor, Capacity, Preferences

### 19. Revenue, GTM, customer success and company operations

- Screen groups: N · Operations Command Center (/ops)
- Workflows: Institutional implementation, Analytics & outcomes
- Built in: ui_kits/business/
- Modules (30): Corporate governance, Legal operations, Finance, Budget/runway, Pricing, Sales, Marketing, GTM, CRM, Pilots, Customer success, Implementation, Support, Billing, Collections, Partnerships, Marketplace, Vendor management, Product operations, Engineering, Reliability, Security, Privacy, Compliance, AI governance, People/hiring, Board/investor reporting, Risk management, Release operations, Operating cadence

### 20. Developer platform, marketplace and partner ecosystem

- Screen groups: none catalogued
- Workflows: Developer platform
- Built in: ui_kits/external/
- Modules (19): API documentation, OAuth/OIDC, API keys, Service accounts, Webhooks, Event subscriptions, SDKs, Sandbox tenants, Test data, Integration certification, Marketplace, Partner directory, App review, Data scopes, Versioning, Metering, Billing, Support, Incident notices

### 21. Analytics, outcomes, reliability and continuous improvement

- Screen groups: N · Operations Command Center (/ops)
- Workflows: Analytics & outcomes
- Built in: ui_kits/ops/
- Modules (10): Company KPI dashboard, Pilot metrics, Pilot outcomes, Program outcomes, Course analytics, Integration analytics, SLOs, Error budgets, Operating review reports, Release evidence

## Journeys

- **Core student journey:** Signs in → Today → Action Center → Path → Plan → Courses → Copilot → Support → Campus → Career → Lifelong relationship
- **Student daily loop:** What changed? → What matters? → What can I do? → What is official? → Who can help? → What progress did I make?
- **Learning flow:** Faculty publishes structure → Student gets course context → Studies and completes work → Tasks, calendar, notes, AI connected → Faculty feedback → Grade released → Evidence and path update
- **Registration workflow:** Student selects section → Term, hold, prerequisite, capacity, credit, policy checks → Enroll / waitlist / deny / route → Immutable audit entry → Authoritative result
- **Operations action model:** Request → Attach evidence → Required approval → Impact preview → Execution → Audit event → Read-model refresh → Operator review
- **Family consent:** Student chooses scope → Family accepts → Only permitted info visible → Access audited → Expires or revoked
- **Learner lifecycle:** Prospect → Applicant → Student → Learner → Planner → Course participant → Community member → Support recipient → Credential holder → Job candidate → Employee → Alumnus → Lifelong learner → Mentor / partner / employer
- **Institution lifecycle:** Configures → Provisions → Governs → Supports → Measures → Improves → Trusts → Expands → Migrates → Operates
