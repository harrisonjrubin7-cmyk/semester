# Module inventory (build requirements, 25 Oct 2026)

Source: founder upload "list every app semester needs to build" (Perplexity summary of Book 2 Product pp. 415–1211 and Part 06 Workflow catalog). **Scope proposal, design-level.** Nothing here is a claim that a module is implemented, tested, deployed or institution-authorized.

## Rules
- One connected system: modules are domain modules shown through role workspaces, not separate deployments, and not every module in every navigation.
- Shared core (account, Action Center, search, workspace, education graph, design system, governed AI) is built once and permission-scoped per role.
- Plans/estimates stay visibly distinct from official records. Advising never exposes private student work automatically.
- Student finances ≠ Semester subscription billing. Student marketplace ≠ developer app marketplace.
- Family/employer/mentor access reuses the same account and consent model: scoped, time-limited, revocable, access-logged. No parallel student databases.
- Company workspaces are isolated from institution administration and student data.
- Verified claims name the verifier. Employer access is consent-based.

## Build record (one per module) — tracked in `docs/execution/module-build-records.csv`
Owner and primary users · workflows, screens, entities, dependencies · source of authority (student-owned / instructor-published / institution-official / external / Semester-derived) · operating mode (native private / read-only integration / approved write-through / authorized domain replacement) · separate evidence for designed, implemented, tested, deployed, institution-authorized, production-enabled · activation gates (permissions, tenant isolation, accessibility, reconciliation, monitoring, support, rollback).

## Domains and modules (135)
1. **Core workspace:** Home/Today; Action Center; Calendar & Schedule; Tasks & Goals; Notifications; Communications; Notes & Documents; Files & Resources; Projects & Group Workspaces; Focus & Study Sessions; Universal Search; Profile & Preferences.
2. **Planning & registration:** Academic Path; Degree Progress & Audit; Program & Major Explorer; Term Planner; Course & Section Explorer; Schedule Builder; Course Comparison; Workload & Cost Planner; Registration Readiness; Registration & Enrollment; Waitlists & Seat Watch; Transfer & Articulation; Graduation Scenarios.
3. **Learning & Course Studio:** Courses; Course Studio; Syllabus & Course Policies; Learning Content & Resources; Assignments & Submissions; Assessments & Rubrics; Gradebook & Feedback; Discussions & Course Q&A; Course Groups & TA Management; Study Packs & Practice; Research Workspace; Writing Workspace; Learning Progress; Academic Integrity.
4. **Advising & support:** Advising Workspace; Student Success & Cases; Appointments & Office Hours; Advising Notes & Shared Plans; Tutoring & Peer Learning; Mentoring; Support & Service Desk; Resource Directory & Referrals; Accessibility & Accommodation Support; Wellness & Basic-Needs Support (handoffs, not clinical records).
5. **Registrar & academic ops:** Registrar Workspace; Academic Catalog & Curriculum; Terms, Sections & Scheduling; Enrollment Operations; Holds & Eligibility; Academic Records; Official Grade Ledger; Transfer Evaluation; Graduation & Credential Conferral; Transcripts & Record Exports; Department & Program Administration.
6. **Student finances:** Student Account; Payments & Payment Plans (provider-backed); Financial Aid & Scholarships; Budget & Affordability; Financial Support Requests; Student Accounts Operations; Refunds & Reconciliation.
7. **Campus life:** Campus Services Directory; Events; Organizations & Clubs; Community & Peer Connections; Student Marketplace; Moderation & Appeals; Housing & Roommate Resources; Maintenance Requests; Dining & Meal Programs; Spaces & Resource Booking; Transit, Parking & Navigation; Recreation & Activities; Library & Bookstore Access; Campus Jobs & Volunteering; Safety & Emergency Handoffs.
8. **Career & alumni:** Skills Profile & Verification; Portfolio; Credential Wallet; Resume & Cover Letter Studio; Opportunities & Applications; Career Services Workspace; Employer Portal; Networking & Career Events; Alumni Portal; Continuing Education.
9. **Family & external:** Family & Guardian Portal; Consent & Sharing Center; External Collaborator Access; Family Resource Center.
10. **Institution admin:** Institution Admin Console; Identity & Access Administration; Configuration & Workflow Studio; Policy & Governance; Module & Rollout Management; Institutional Analytics & Outcomes; Executive Workspace; Audit & Evidence Workspace.
11. **AI, integration, developer:** Ask Semester; AI Policy & Model Gateway; AI Evaluation & Oversight; Education Graph & Source Authority; Integration Hub; Data Quality & Reconciliation; Migration & Cutover Studio; Developer Portal; App Marketplace.
12. **Trust & reliability:** Trust Center; Privacy Operations; Retention & Legal Holds; Security Operations; Compliance & Risk; Accessibility Program; Audit & Approval Controls; Reliability & Incident Command; Backup, Restore & Continuity; Status & Service Communications.
13. **Company operations:** Public Website & Content; CRM & Revenue Operations; Quotes, Contracts & Procurement; Subscription Billing; Implementation & Onboarding; Customer Success; Support Operations; Product & Release Operations; Finance Operations; Legal & Vendor Operations; People & Capacity; Executive & Board Workspace.

Relationship to `09-app-portfolio.md`: the 32 workspaces are the role-facing surfaces; these 135 modules are what those workspaces present.
