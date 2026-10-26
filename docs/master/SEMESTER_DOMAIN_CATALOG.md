# Semester domain catalog

<!-- Rendered from docs/master/tools/domains.py by docs/master/tools/render.py. Edit the data, then run `python3 docs/master/tools/render.py` from the repository root. -->

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Domains** 40 · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** Everything here is a reading of the repository at origin/main 790ebbf on 2026-10-05, from read-only audits. Nothing was run in production, and no row is evidence of an activated tenant, a customer, or an approved claim. "Verified" means held by an automated test in this repository. It does not mean operating, supported, secure, accessible or approved. The repository's own registers hold the same ceiling ([`PRODUCT-STATUS-MAP.md`](../PRODUCT-STATUS-MAP.md), [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md)).

Forty domains, each defined on the thirty-six fields the master brief requires. A field that is the same in every domain is answered once under [Universal fields](#universal-fields); a field that differs is on the domain's card. [How each of the 36 fields is answered](#where-each-of-the-36-fields-is-answered) says which.

## Index

| ID | Domain | Phase | Priority | Owner seat | Maturity | Readiness |
| --- | --- | ---: | --- | --- | --- | --- |
| [D01](#d01-student-os) | Student OS | 2 | P1 | `product` | Native but incomplete | Conditional: invitation-only individual validation |
| [D02](#d02-workspace-and-productivity) | Workspace and productivity | 2 | P1 | `product` | Native but incomplete | Conditional: invitation-only individual validation |
| [D03](#d03-path-and-degree-planning) | Path and degree planning | 2 | P1 | `product` | Native but incomplete + Transitional | Not ready |
| [D04](#d04-course-studio-and-lms) | Course Studio and LMS | 3 | P1 | `product` | Native but incomplete + Integrated | Unsafe to activate |
| [D05](#d05-learning-evidence-assessment-and-gradebook) | Learning evidence, assessment and gradebook | 3 | P1 | `product` | Native but incomplete | Unsafe to activate |
| [D06](#d06-ai-gateway-and-copilot) | AI gateway and copilot | 2 | P0 | `engineering` | Native but incomplete | Not ready |
| [D07](#d07-search-and-knowledge-graph) | Search and knowledge graph | 2 | P2 | `product` | Native but incomplete | Not ready |
| [D08](#d08-faculty-experience) | Faculty experience | 3 | P1 | `product` | Designed/documented + Native but incomplete | Not ready |
| [D09](#d09-advisor-and-student-success) | Advisor and student success | 4 | P1 | `success` | Native but incomplete + Pilot-only | Not ready |
| [D10](#d10-registrar-and-academic-operations) | Registrar and academic operations | 5 | P2 | `product` | Transitional + Native but incomplete | Unsafe to activate |
| [D11](#d11-academic-records-and-grade-ledger) | Academic records and grade ledger | 5 | P2 | `data` | Native but incomplete | Unsafe to activate |
| [D12](#d12-registration-and-enrollment) | Registration and enrollment | 5 | P2 | `product` | Native but incomplete | Unsafe to activate |
| [D13](#d13-student-finance-accounts-and-payment-plans) | Student finance, accounts and payment plans | 6 | P2 | `finance` | Native but incomplete + Transitional | Unsafe to activate |
| [D14](#d14-financial-aid-and-scholarship-handoffs) | Financial aid and scholarship handoffs | 6 | P3 | `product` | Transitional | Not ready |
| [D15](#d15-campus-life-and-services) | Campus life and services | 6 | P2 | `product` | Native but incomplete + Transitional | Not ready |
| [D16](#d16-housing) | Housing | 6 | P3 | `product` | Transitional + Pilot-only | Not ready |
| [D17](#d17-dining) | Dining | 6 | P3 | `product` | Native but incomplete | Not ready |
| [D18](#d18-events) | Events | 6 | P3 | `product` | Native but incomplete | Not ready |
| [D19](#d19-community-and-organizations) | Community and organizations | 6 | P1 | `trust` | Native but incomplete | Unsafe to activate |
| [D20](#d20-accessibility-services) | Accessibility services | 6 | P1 | `accessibility` | Designed/documented | Not ready |
| [D21](#d21-safety-and-emergency-handoffs) | Safety and emergency handoffs | 6 | P0 | `trust` | Native but incomplete | Unsafe to activate |
| [D22](#d22-library-and-research) | Library and research | 3 | P3 | `product` | Native but incomplete | Not ready |
| [D23](#d23-career-employer-and-alumni) | Career, employer and alumni | 7 | P2 | `product` | Native but incomplete + Pilot-only | Not ready |
| [D24](#d24-family-and-guardian-grants) | Family and guardian grants | 4 | P1 | `privacy` | Native but incomplete | Unsafe to activate |
| [D25](#d25-institutional-governance-and-configuration) | Institutional governance and configuration | 8 | P1 | `product` | Native but incomplete | Not ready |
| [D26](#d26-identity-sso-and-scim) | Identity, SSO and SCIM | 1 | P0 | `security` | Native but incomplete | Unsafe to activate |
| [D27](#d27-integrations-lti-oneroster-and-edu-api) | Integrations, LTI, OneRoster and Edu-API | 1 | P0 | `engineering` | Native but incomplete + Integrated | Unsafe to activate |
| [D28](#d28-privacy-retention-and-legal-holds) | Privacy, retention and legal holds | 1 | P0 | `privacy` | Native but incomplete | Not ready |
| [D29](#d29-security-audit-and-incident-response) | Security, audit and incident response | 1 | P0 | `security` | Native but incomplete | Not ready |
| [D30](#d30-trust-compliance-and-hecvat) | Trust, compliance and HECVAT | 8 | P1 | `trust` | Designed/documented + Native but incomplete | Not ready |
| [D31](#d31-operations-command-center) | Operations Command Center | 9 | P1 | `operations` | Native but incomplete | Not ready |
| [D32](#d32-commercial-billing-and-customer-success) | Commercial, billing and customer success | 9 | P1 | `finance` | Pilot-only + Native but incomplete | Not ready |
| [D33](#d33-marketing-sales-and-the-company-site) | Marketing, sales and the company site | 9 | P1 | `founder` | Native but incomplete | Not ready |
| [D34](#d34-developer-platform) | Developer platform | 10 | P2 | `engineering` | Native but incomplete | Not ready |
| [D35](#d35-marketplace-and-partners) | Marketplace and partners | 10 | P3 | `founder` | Not started + Designed/documented | Not ready |
| [D36](#d36-data-analytics-and-outcomes) | Data, analytics and outcomes | 4 | P1 | `data` | Native but incomplete | Not ready |
| [D37](#d37-reliability-slo-and-release-operations) | Reliability, SLO and release operations | 1 | P0 | `operations` | Designed/documented + Native but incomplete | Not ready |
| [D38](#d38-people-hiring-and-company-operations) | People, hiring and company operations | 9 | P1 | `founder` | Designed/documented | Not ready |
| [D39](#d39-finance-runway-and-board-reporting) | Finance, runway and board reporting | 9 | P1 | `finance` | Designed/documented | Not ready |
| [D40](#d40-globalization-localization-and-accessibility-expansion) | Globalization, localization and accessibility expansion | 10 | P2 | `accessibility` | Designed/documented | Not ready |

Phase numbers are the implementation phases in the master brief (0 truth, 1 foundation, 2 Student OS, 3 Learning OS, 4 Student Success, 5 Academic Core, 6 Campus Services, 7 Career, 8 Institutional OS, 9 Company OS, 10 Platform). Owner seats are the twelve launch-council seats in `app/src/lib/launchreadiness.ts`; today one person holds or acts in seven of them and none has signed (see the company operating system).

## Where each of the 36 fields is answered

| # | Field | Where |
| ---: | --- | --- |
| 1 | Vision | card |
| 2 | Primary users | card |
| 3 | User jobs to be done | card |
| 4 | Current source of truth | card |
| 5 | Native Semester source of truth | card |
| 6 | Integration strategy | card |
| 7 | Data model | card |
| 8 | Tenant scope | card |
| 9 | Role/capability model | card |
| 10 | Data classification | card |
| 11 | Consent model | card |
| 12 | AI model/policy | card |
| 13 | Accessibility requirements | U-A11Y |
| 14 | Security requirements | U-SEC (+ card risks) |
| 15 | Audit requirements | U-AUD |
| 16 | Privacy/retention requirements | U-PRIV |
| 17 | Migration plan | card `Migration` (else U-MIG) |
| 18 | Reconciliation plan | card `Migration` |
| 19 | Dual-run plan | card `Migration` |
| 20 | Cutover criteria | card `Migration` + replacement gates |
| 21 | Rollback plan | card `Migration` |
| 22 | Support model | U-SUP (+ card CS) |
| 23 | Incident model | U-INC |
| 24 | SLO/reliability requirements | card SLO class |
| 25 | Commercial model | card |
| 26 | Customer success model | card |
| 27 | Outcome metrics | card |
| 28 | Required documentation | U-DOCS |
| 29 | Release gates | U-GATES + card review flags |
| 30 | Replacement authority gates | card `Replacement authority` + replacement gates doc |
| 31 | Team owner | card |
| 32 | Dependencies | card |
| 33 | Risks | card |
| 34 | Priority | card |
| 35 | Implementation branch | card |
| 36 | Tests | card |

## Universal fields

A domain card lists the fields that differ by domain. Every field it does not
list takes the universal answer below. This is stated once because the
alternative, forty copies of the same sentence, is how a copy goes stale.

| ID | Field | Universal answer (applies unless the card says otherwise) |
| --- | --- | --- |
| U-A11Y | Accessibility requirements | WCAG 2.2 AA is the build target for every screen in the domain, keyboard and screen-reader complete, with reduced-motion and contrast support. `app/src/a11y/` holds automated axe tests. **No qualified human evaluation exists (EXT-008 open), so no domain may claim "accessible" or "WCAG-conformant" (CLM-008 prohibited).** Release gate 3 of the replacement gates requires it. |
| U-SEC | Security requirements | A threat record per feature (`docs/security/THREAT-RECORD-TEMPLATE.md`); tenant isolation test per object class; server-side authorisation on every command; no secret in the browser; supply-chain gate in CI. Open findings that touch every domain: F-01 (tenant isolation off for every school, covers course rooms only), F-02 (tokens and user AI keys in `localStorage`), F-08 (no alerting), F-10 (audit tables not tamper-evident). See [`SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md`](SEMESTER_TRUST_AND_GOVERNANCE_MODEL.md). |
| U-AUD | Audit requirements | A sensitive mutation writes an `audit_event` (pseudonymised actor and object, correlation id, tenant id with no foreign key so that removing a tenant keeps the evidence) and, where the domain has one, its own append-only audit table. Transactional outbox for sensitive mutations is ADR-0007 (proposed). |
| U-PRIV | Privacy and retention | Data class from `docs/trust/DATA-CLASSIFICATION-STANDARD.md` (T0 to T6; unknown is treated as T3); retention per `docs/trust/DATA-RETENTION-AND-DELETION-STANDARD.md`; export and erase through the account path; legal holds honoured by every sweep (`legal_holds`). Per-table classes are rule-derived and not human-reviewed. |
| U-SUP | Support model | Student asks in the app; the request goes to the owning office or to Semester support with minimal context; support access to a customer's data is time-limited, logged and customer-visible (`support_access_grant`, `support_access_event`). Today one person staffs it (docs/support, `OWNER-AND-ACCOUNTABILITY-MATRIX.md`). |
| U-INC | Incident model | `docs/trust/INCIDENT-RESPONSE-PLAN.md` and `docs/sre/06-INCIDENTS-AND-ON-CALL.md`: detect, validate, classify severity, contain, communicate, recover, post-mortem. **No alert reaches a person and no target-environment drill has run**, so no domain may claim 24/7 response (CLM-016 prohibited). |
| U-SLO | SLO and reliability | The domain's class in the SLO table below. All RTO/RPO values are targets and every one reads "unmeasured" in `docs/sre/07-RESILIENCE-BACKUP-DR-AND-CHAOS.md`. |
| U-DOCS | Required documentation | A requirement, a design, a threat record, a data map, a runbook, a support article, a release note and an evidence file under `docs/evidence/`. A page is governed by a card only if it lives under a governed directory (`app/src/lib/docs/card.ts`). |
| U-GATES | Release gates | The twenty gates in [`SEMESTER_DOMAIN_REPLACEMENT_GATES.md`](SEMESTER_DOMAIN_REPLACEMENT_GATES.md), plus the card's own review flags. |
| U-MIG | Migration, reconciliation, dual-run, cutover, rollback | Where a card has no entry, Semester is not replacing an external record in this domain and the fields are not applicable. Where Semester will hold or replace a record, the card states the plan and the generic factory is [`SEMESTER_MIGRATION_FACTORY.md`](SEMESTER_MIGRATION_FACTORY.md). |

### SLO classes

Defined in `docs/sre/07-RESILIENCE-BACKUP-DR-AND-CHAOS.md`. Targets, not measurements.

| Class | RTO target | RPO target | Drill cadence | Measured |
| --- | --- | --- | --- | --- |
| C0 | 60 min | 5 min | every 90 days | unmeasured |
| C1 | 4 h | 15 min | every 180 days | unmeasured |
| C2 | 24 h | 60 min | yearly | unmeasured |
| C3 | 72 h | 24 h | yearly | unmeasured |

## Domain cards

### D01 Student OS

**Phase** 2 · **Priority** P1 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d01-student-os`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Conditional: invitation-only individual validation

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review

| Field | Answer |
| --- | --- |
| Vision | One daily surface that says what is due, what is at risk and what to do next, from the student's own data and any connected sources, labelled by authority. |
| Primary users | Students (all levels), transfer and prospective students. |
| Jobs to be done | Know what needs attention today; act on it; understand where each fact came from. |
| Current source of truth | Student device state with optional account sync; seeded sample semester by default. |
| Native Semester source of truth | Semester for student-owned planning data; official facts stay with the institution and carry a source label. |
| Integration strategy | Read-only connectors for deadlines, calendars and LMS context; official handoff for institutional actions. |
| Data model | Device state (state/slices), tasks/notes/productivity_* tables, source_records and source_freshness_events. |
| Tenant scope | Account-scoped; tenant context only for institution-sourced items. |
| Role/capability model | Own-data access by auth.uid(); no role reads private work by default. |
| Data classification | T2 (own work); T3 when institution-sourced. |
| Consent model | Account-owned; sharing is opt-in per item (advisor and family shares are separate domains). |
| AI model/policy | Explains and ranks; never decides an official matter; cites the item and its source. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included in individual Plus ($7.99/mo, $59/yr; not on sale) and institutional packages (proposed, unapproved). |
| Customer success model | Student onboarding playbook (docs/commercial/STUDENT-ONBOARDING-PLAYBOOK.md); invite-only cohort. |
| Outcome metrics | Weekly active share of a cohort that completes one Today action; deadline-miss rate (self-reported); time to first action. |
| Dependencies | D02, D03, D06, D26, D27 |
| Risks | Seeded data read as real; device-only state lost on a new device; no accessibility evaluation. |
| Tests | app/src/domains/today/*.test.ts; app/src/lib/today-center.test.ts; golden-path smoke |
| Evidence (paths) | `app/src/screens/Today.tsx`; `app/src/lib/today-center.ts`; `app/src/domains/today/`; `docs/TODAY-ACTION-CENTER.md` |

### D02 Workspace and productivity

**Phase** 2 · **Priority** P1 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d02-workspace`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Conditional: invitation-only individual validation

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review

| Field | Answer |
| --- | --- |
| Vision | Calendar, tasks, notes, documents, files and focus tools that are connected to courses, deadlines and the student's obligations. |
| Primary users | Students, faculty (own notes and calendars), staff. |
| Jobs to be done | Capture, plan, write, store and find work; share it with a group; keep it across devices. |
| Current source of truth | Device (localStorage/IndexedDB); a real productivity service exists but is off unless a deployment enables it. |
| Native Semester source of truth | Semester (student-owned content). Mail and files stay device-local until a sync design is accepted. |
| Integration strategy | ICS feeds, Google/Microsoft/Zoom calendars (student-directed), office-format import/export. |
| Data model | tasks, notes, productivity_workspace/task/event, private.productivity_command, calendar_feeds, push_queue. |
| Tenant scope | Account; group workspaces by membership. |
| Role/capability model | Owner; group member; (no staff read of personal content). |
| Data classification | T2; T3 when it holds institution records. |
| Consent model | Account-owned; group sharing is explicit; support access is time-limited and logged. |
| AI model/policy | Drafting and summarising on the student's own content under course AI rules; disclosure tools. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Individual Plus; institutional bundle. |
| Customer success model | Student onboarding; faculty enablement for course notebooks. |
| Outcome metrics | Retention of weekly use; sync-conflict rate; task completion before due. |
| Dependencies | D01, D26, D28 |
| Risks | Files IndexedDB-only; mail draft-only; Tasks API not mounted by default; offline engine flagged off. |
| Tests | app/server/productivity/*.test.ts (incl. postgres.integration); app/src/domains/tasks; packages/offline-sync tests |
| Evidence (paths) | `app/src/screens/Calendar.tsx`; `app/src/screens/Mine.tsx`; `app/src/screens/Write.tsx`; `app/server/productivity/`; `supabase/functions/calendar/`; `supabase/functions/fetchcal/` |

### D03 Path and degree planning

**Phase** 2 · **Priority** P1 · **Owner seat** `product` · **SLO class** C1 · **Branch** `domain/d03-path`

**Classification** Native but incomplete + Transitional · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration, Requires reconciliation

| Field | Answer |
| --- | --- |
| Vision | A student sees a verified path to graduation, tries scenarios, and knows which advice comes from the official audit and which is an estimate. |
| Primary users | Students, advisors, registrar. |
| Jobs to be done | See remaining requirements; plan terms; test a major change; prepare for registration. |
| Current source of truth | Institution degree-audit system (unconnected); student-entered data in Semester. |
| Native Semester source of truth | Semester for planning; the institution keeps the official audit until a catalog/rules engine passes the replacement gates (register: native row not-started). |
| Integration strategy | Read-only degree-audit status; catalog import; transfer articulation rules. |
| Data model | term_plan_courses, graduation_scenarios, articulation_rules, transfer_evaluations, catalog_sections. |
| Tenant scope | Tenant for catalog and rules; account for plans. |
| Role/capability model | record:read; record:propose; articulation:approve |
| Data classification | T2 plans; T3 audit results. |
| Consent model | Advisor visibility by student share. |
| AI model/policy | Explains a requirement from the official rule; never computes eligibility (deterministic engine does). |
| Migration, reconciliation, dual-run, cutover, rollback | Native catalog and rules engine (effective-dated, versioned) run beside the institution audit; reconcile every student's remaining-credit total; cutover per program; roll back by re-pointing the Source label to the institution audit. |
| Replacement authority gates | Institution approves catalog and rule authoring; registrar signs the audit parity report; two-person approval for rule publication. |
| Commercial model | Institutional module. |
| Customer success model | Registrar and advising implementation plan. |
| Outcome metrics | Audit agreement rate (native vs official) by program; plan-to-registration conversion. |
| Dependencies | D10, D11, D12, D25 |
| Risks | Planning engine is client logic over student-entered data; no institution-verified catalog. |
| Tests | app/src/lib/degree*.test.ts; app/src/lib/graduation*.test.ts |
| Evidence (paths) | `app/src/screens/Pathway.tsx`; `app/src/screens/Degree.tsx`; `app/src/lib/degree.ts`; `app/src/lib/graduation.ts`; `docs/DOMAIN-REPLACEMENT-REGISTER.md` |

### D04 Course Studio and LMS

**Phase** 3 · **Priority** P1 · **Owner seat** `product` · **SLO class** C1 · **Branch** `domain/d04-course-studio`

**Classification** Native but incomplete + Integrated · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration, Requires reconciliation, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | Faculty author and run courses natively, or keep their LMS and connect through LTI; either way the student sees one course. |
| Primary users | Faculty, teaching assistants, students, instructional designers. |
| Jobs to be done | Publish syllabus, rules and guidance; deliver resources and assignments; communicate; set course AI rules. |
| Current source of truth | The institution's LMS (Canvas, Brightspace, Blackboard, Moodle); Semester holds guidance and rules only. |
| Native Semester source of truth | Semester for courses an institution moves to Course Studio; no course shell, roster, submission store or question bank exists yet. |
| Integration strategy | LTI 1.3 launch, deep linking, AGS and NRPS (code built; 0 platform registrations); Canvas API proxy; OneRoster rosters (not built). |
| Data model | courses, course_guidance, course_ai_rules, lti_platform/identity/line_item, gradebook_*. |
| Tenant scope | Tenant; course. |
| Role/capability model | course-scoped roles: faculty, teaching_assistant; lti:launch |
| Data classification | T1 course material; T2 student work; T3 grades. |
| Consent model | Course AI policy is faculty-set; student preferences narrow it. |
| AI model/policy | Course-aware, policy-bound assistant; citations to course sources; integrity-aware. |
| Migration, reconciliation, dual-run, cutover, rollback | Per course: import from LMS (QTI 3, common cartridge), dual-run a section, reconcile enrolments and grades, cut over at a term boundary, roll back by relaunching the LMS tool. |
| Replacement authority gates | LMS replacement for a course needs: faculty adoption sign-off, assessment/gradebook parity (D05), accessibility evaluation, records retention parity, rollback to LMS. |
| Commercial model | Institutional module (pricing unapproved). |
| Customer success model | Faculty enablement (docs/FACULTY-ENABLEMENT.md). |
| Outcome metrics | Courses published; faculty weekly active; assignment-submission success; LTI launch success. |
| Dependencies | D05, D26, D27, D11 |
| Risks | LTI unproven against a real LMS; Course Studio flag off; Brightspace registration pending. |
| Tests | supabase/*.check.sql (lti suites); app/src/lib/coursestudio*.test.ts |
| Evidence (paths) | `app/src/components/CourseStudio.tsx`; `app/src/lib/coursestudio.ts`; `supabase/functions/lti/`; `supabase/functions/_shared/lti*.ts`; `docs/LMS-INTEROPERABILITY-MATRIX.md` |

### D05 Learning evidence, assessment and gradebook

**Phase** 3 · **Priority** P1 · **Owner seat** `product` · **SLO class** C0 · **Branch** `domain/d05-gradebook`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires reconciliation, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | Assessment and feedback that produce learning evidence, with an append-only gradebook, moderation, regrade and grade-release controls. |
| Primary users | Faculty, TAs, students, registrar (grade export). |
| Jobs to be done | Grade, moderate, release, appeal; show a student where they stand and what evidence supports it. |
| Current source of truth | The LMS gradebook; the student's own arithmetic (device only). |
| Native Semester source of truth | Semester gradebook of record only after the gates in D11 and a term-boundary parallel run. |
| Integration strategy | LTI AGS grade passback (writeback.lms_grade_passback, off). |
| Data model | gradebook_items/schemes/operations, grade_entries, grade_levels, grade_passbacks, regrade_requests/resolutions, mistake_evidence, concept_evidence. |
| Tenant scope | Tenant; course. |
| Role/capability model | grades:enter, grades:moderate, grades:release, grades:export, grades:receive |
| Data classification | T3 (education record). |
| Consent model | Student may share evidence; grades are institution-controlled. |
| AI model/policy | May suggest feedback drafts to the grader; never assigns a grade; human review queue (docs/operating-model/AI-GRADING-AND-INTEGRITY.md). |
| Migration, reconciliation, dual-run, cutover, rollback | Parallel-run one section per term: native ledger vs LMS gradebook, compare every grade, hold passback off until zero unexplained differences. |
| Replacement authority gates | Institutional authority to hold the gradebook of record; registrar sign-off; immutable version history verified; passback reconciled for a full term. |
| Commercial model | Institutional module. |
| Customer success model | Faculty enablement; registrar liaison. |
| Outcome metrics | Grading turnaround; regrade rate; ledger vs LMS discrepancy count. |
| Dependencies | D04, D11, D26 |
| Risks | Off at every school; no moderation evidence from real faculty; AI grading is prohibited as authority. |
| Tests | app/src/lib/gradebook/*.test.ts; supabase grade check suites |
| Evidence (paths) | `app/src/lib/gradebook/`; `app/src/screens/Gradebook.tsx`; `app/src/lib/assessment/qti.ts`; `supabase/migrations/ (gradebook_*, grade_entries, regrade_*)` |

### D06 AI gateway and copilot

**Phase** 2 · **Priority** P0 · **Owner seat** `engineering` · **SLO class** C1 · **Branch** `domain/d06-ai`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | One governed AI path: tenant policy, course rules, student preference, data class, consent, citations and audit applied before any model is called. |
| Primary users | Every role. |
| Jobs to be done | Ask, plan, study, draft, summarise and escalate to a human. |
| Current source of truth | Student-key (BYOK) and metered shared-key calls through an edge function; institutional gateway routes exist. |
| Native Semester source of truth | Semester (policy, audit, usage); model providers are subprocessors. |
| Integration strategy | Anthropic (shared key, blocked pending activation), OpenAI (institution-approved), student keys. |
| Data model | private.ai_usage_*, private.gateway_audit, gateway_intelligence_*, ai_policy, ai_memories, approved_source. |
| Tenant scope | Account; tenant policy; course rules. |
| Role/capability model | ai:configure, source:approve, audit:read |
| Data classification | Ceiling T2 for consumer AI; T3+ blocked unless a separately approved control set exists. |
| Consent model | Per-category consent; schools can turn context categories off. |
| AI model/policy | Is the AI domain: policy-bound, tenant-aware, permission-aware, source-aware, cost-metered, human-escalating, audited, evaluated. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Metered credits; institution-directed provider terms. |
| Customer success model | AI governance board (docs/operating-model/AI-GOVERNANCE-BOARD.md). |
| Outcome metrics | Policy-refusal correctness on the eval set; cited-answer rate; cost per attaching student; kill-switch time-to-effect. |
| Dependencies | D26, D28, D29 |
| Risks | BYOK path bypasses the kill switch (F-04); shared key blocked; one red-team run on one model; gateway not deployed. |
| Tests | app/src/ai/*.test.ts; app/server/institution/intelligence*.test.ts; live tests (need keys) |
| Evidence (paths) | `supabase/functions/claude/`; `app/server/institution/intelligence.ts`; `packages/institution/src/intelligence.ts`; `app/src/ai/`; `docs/evidence/ai/` |

### D07 Search and knowledge graph

**Phase** 2 · **Priority** P2 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d07-search`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review

| Field | Answer |
| --- | --- |
| Vision | Permission-aware search across personal, course, institutional and approved public sources, with provenance. |
| Primary users | Every role. |
| Jobs to be done | Find a deadline, a policy, a reading, a person, an answer. |
| Current source of truth | Client-side search over the app registry, guide and the student's own data. |
| Native Semester source of truth | Semester index per tenant (no server index exists). |
| Integration strategy | Source connectors feed the index only within approved scope. |
| Data model | evidence_reference, canonical_entity_references (vector/queue boundaries are ADR-0021). |
| Tenant scope | Account, then tenant, then course; scope is required on every query. |
| Role/capability model | Search requires scope; results filtered by the caller's capabilities. |
| Data classification | Inherits the class of each indexed object. |
| Consent model | Index only what the owner or institution authorised. |
| AI model/policy | Retrieval for the copilot uses the same permission filter. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | n/a |
| Outcome metrics | Search success rate; zero-result rate; permission-leak test count (must be 0). |
| Dependencies | D06, D28 |
| Risks | Cross-tenant leakage in any shared index; no server index to test. |
| Tests | app/src/lib/search*.test.ts; planned negative cross-tenant suite |
| Evidence (paths) | `app/src/lib/search.ts`; `app/src/lib/find.ts`; `app/src/lib/context-graph.ts`; `app/src/lib/skills-graph.ts` |

### D08 Faculty experience

**Phase** 3 · **Priority** P1 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d08-faculty`

**Classification** Designed/documented + Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | One place for faculty to teach, assess, communicate, hold office hours and govern AI use, without learning a second system. |
| Primary users | Faculty, TAs, department chairs. |
| Jobs to be done | Publish guidance; manage a roster; grade; message; set course AI policy; see which students need help. |
| Current source of truth | LMS and email. |
| Native Semester source of truth | Course Studio plus gradebook (D04, D05). |
| Integration strategy | LTI; SIS roster; calendar. |
| Data model | As D04/D05. |
| Tenant scope | Course; department. |
| Role/capability model | faculty, teaching_assistant, department_chair |
| Data classification | T1-T3. |
| Consent model | Student data seen only within course purpose. |
| AI model/policy | Course-authoring, rubric and accessible-content assistants; human review. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional. |
| Customer success model | Faculty enablement. |
| Outcome metrics | Faculty weekly active; time to publish a course; faculty satisfaction. |
| Dependencies | D04, D05 |
| Risks | No faculty-only screen set beyond Course Studio; no faculty research done. |
| Tests | app/src/lib/rolelaunch.test.ts |
| Evidence (paths) | `app/src/components/CourseStudio.tsx`; `app/src/components/institutional/RoleWorkspace.tsx`; `app/src/lib/rolelaunch.ts`; `docs/FACULTY-COURSE-STUDIO-DESIGN.md` |

### D09 Advisor and student success

**Phase** 4 · **Priority** P1 · **Owner seat** `success` · **SLO class** C2 · **Branch** `domain/d09-success`

**Classification** Native but incomplete + Pilot-only · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Proactive, consented support: a student-controlled agenda, case workflow, referrals and success plans, measured by outcomes and not surveillance. |
| Primary users | Advisors, success staff, students, tutors, mentors. |
| Jobs to be done | Prepare a meeting; share a plan; refer; follow up; see aggregate service bottlenecks. |
| Current source of truth | Advising/CRM systems; appointment tools. |
| Native Semester source of truth | Semester for student-controlled shares and case workflow once an institution approves. |
| Integration strategy | Appointment scheduling; CRM handoff. |
| Data model | advisor_shares, advisor_share_events, success_plans, institution_actions, support_tickets. |
| Tenant scope | Tenant; office; per-student share. |
| Role/capability model | Per share grant; office capabilities. |
| Data classification | T3. |
| Consent model | Student share per advisor, revocable, time-limited. |
| AI model/policy | Summarises with citations; routes to humans; never a risk score without explanation (docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md). |
| Migration, reconciliation, dual-run, cutover, rollback | Case history import is optional; run beside the existing system for one office; no automatic migration of case notes. |
| Replacement authority gates | Office head approves case workflow; privacy review of notes retention. |
| Commercial model | Institutional. |
| Customer success model | Success playbook. |
| Outcome metrics | Appointment completion; referral closure time; student-reported usefulness. No predictive score is a metric. |
| Dependencies | D26, D28, D24 |
| Risks | Advisor surface is UI plus sandbox; no advisor screen in the router; notes sensitivity. |
| Tests | app/src/lib/advisor*.test.ts; supabase advisor-share suites |
| Evidence (paths) | `app/src/components/AdvisorMeeting.tsx`; `app/src/lib/casework.ts`; `app/server/institution/advising.ts`; `app/src/lib/office-actions-remote.ts` |

### D10 Registrar and academic operations

**Phase** 5 · **Priority** P2 · **Owner seat** `product` · **SLO class** C0 · **Branch** `domain/d10-registrar`

**Classification** Transitional + Native but incomplete · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration, Requires reconciliation, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | Terms, catalog, sections, holds, rules and graduation workflows run natively once an institution authorises it. |
| Primary users | Registrar staff, advisors, students. |
| Jobs to be done | Publish a catalog; manage terms and sections; apply holds and overrides; certify graduation. |
| Current source of truth | SIS (Banner, PeopleSoft, Workday Student, Colleague). |
| Native Semester source of truth | Semester only after the gates in D11/D12; today a clipboard-style handoff. |
| Integration strategy | SIS connectors (none built; ADAPTERS is empty). |
| Data model | registration_terms/sections/windows/holds/overrides, catalog_sections. |
| Tenant scope | Tenant. |
| Role/capability model | registration_window:publish, catalog:sync, record:* |
| Data classification | T3. |
| Consent model | Institution authority; student visibility by policy. |
| AI model/policy | Explains policy; routes exceptions to humans; never the rule engine. |
| Migration, reconciliation, dual-run, cutover, rollback | Connect first (read), then dual-run one term of one program, reconcile, then native publish with two-person approval; rollback re-points authority to the SIS. |
| Replacement authority gates | Institution board or registrar authorises; effective-dated policy versioning; two-person approvals; reconciliation for two terms; rollback rehearsed. |
| Commercial model | Institutional. |
| Customer success model | Registrar implementation. |
| Outcome metrics | Rule parity rate vs SIS; approval turnaround. |
| Dependencies | D11, D12, D26, D27 |
| Risks | No SIS adapter; no registrar interviews; high regulatory exposure. |
| Tests | app/src/lib/registrar.test.ts; enrollment tests |
| Evidence (paths) | `app/src/screens/Registrar.tsx`; `app/src/lib/registrar.ts`; `app/src/lib/enrollment/`; `docs/REGISTRATION-DAY-MODE.md` |

### D11 Academic records and grade ledger

**Phase** 5 · **Priority** P2 · **Owner seat** `data` · **SLO class** C0 · **Branch** `domain/d11-records`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration, Requires reconciliation, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | An append-only, effective-dated academic record with propose/approve/override separation, transcript export and institutional reporting. |
| Primary users | Registrar, records staff, students (own record). |
| Jobs to be done | Post and correct records; export a transcript; show a student their record. |
| Current source of truth | SIS. |
| Native Semester source of truth | Semester only for records an institution migrates and certifies; the code states it is not an official transcript and issues none. |
| Integration strategy | Transcript exchange (standards not yet built). |
| Data model | academic_record_entries/changes/subjects, source_records/snapshots. |
| Tenant scope | Tenant. |
| Role/capability model | record:propose, record:approve, record:override, record:read |
| Data classification | T3. |
| Consent model | Institution authority; FERPA-aligned release. |
| AI model/policy | Explains; never edits. |
| Migration, reconciliation, dual-run, cutover, rollback | Import with lineage, reconcile row counts and checksums, parallel-run a term, cut over by a signed change record, rollback by restoring the SIS as authority. |
| Replacement authority gates | All 15 replaceability requirements tested; institutional authority; legal review; reconciliation; rollback; named steward. |
| Commercial model | Institutional. |
| Customer success model | Registrar. |
| Outcome metrics | Reconciliation exceptions; correction turnaround. |
| Dependencies | D10, D26, D28 |
| Risks | Official-record claims before gates; no transcript standard implemented. |
| Tests | app/src/lib/record/*.test.ts; record check suites |
| Evidence (paths) | `app/src/lib/record/ledger.ts`; `app/src/components/institutional/RecordLedger.tsx`; `supabase/migrations/20260929210000_academic_record_ledger.sql` |

### D12 Registration and enrollment

**Phase** 5 · **Priority** P2 · **Owner seat** `product` · **SLO class** C0 · **Branch** `domain/d12-registration`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration, Requires reconciliation, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | Idempotent, capacity-correct registration with waitlists, time tickets, add/drop and approvals. |
| Primary users | Students, registrar, advisors. |
| Jobs to be done | Plan a schedule; register on the opening minute; add, drop, waitlist. |
| Current source of truth | SIS registration; Semester prepares a plan and hands off. |
| Native Semester source of truth | Semester registration transaction only after the gates; closed at every school today. |
| Integration strategy | SIS write-back (writeback.registration_submit, off). |
| Data model | registration_* tables, seat_watches. |
| Tenant scope | Tenant. |
| Role/capability model | registration_window:publish; registrar desk. |
| Data classification | T3. |
| Consent model | n/a (institutional transaction). |
| AI model/policy | Explains eligibility; never decides. |
| Migration, reconciliation, dual-run, cutover, rollback | Plan-only, then handoff, then shadow-write in sandbox, then one window dual-run with seat reconciliation, then cutover. |
| Replacement authority gates | As D10 plus load evidence and a registrar-run rehearsal. |
| Commercial model | Institutional. |
| Customer success model | Registrar. |
| Outcome metrics | Duplicate-registration count (must be 0); seat discrepancy; load at open. |
| Dependencies | D10, D11, D27 |
| Risks | Over-enrolment; no live seats; load at registration open untested against a real SIS. |
| Tests | app/src/lib/enrollment/*.test.ts; load harness |
| Evidence (paths) | `app/src/lib/enrollment/`; `app/src/lib/registration-day.ts`; `supabase/migrations/20260929300000_registration_transaction.sql` |

### D13 Student finance, accounts and payment plans

**Phase** 6 · **Priority** P2 · **Owner seat** `finance` · **SLO class** C0 · **Branch** `domain/d13-finance`

**Classification** Native but incomplete + Transitional · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration, Requires reconciliation, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | Show balances, plans and deadlines, and hand off payment; run billing natively only where an institution and a payment provider approve. |
| Primary users | Students, payers, student-accounts staff. |
| Jobs to be done | See what is owed and when; set up a plan; get a receipt; ask about a charge. |
| Current source of truth | Bursar/ERP and a payment provider. |
| Native Semester source of truth | Ledger is built; nothing connects to a payment provider and nothing is sent to students. Raw card data is never stored. |
| Integration strategy | Hosted payment provider; ERP feed. |
| Data model | student_account_entries/closes/reconciliations/requests, student_payment_plans(_installments). |
| Tenant scope | Tenant. |
| Role/capability model | finance:read/request/approve/approve_high/close |
| Data classification | T3-T4 (financial). |
| Consent model | Payer and family grants are explicit. |
| AI model/policy | Explains; never states a balance as official without the source label. |
| Migration, reconciliation, dual-run, cutover, rollback | Read-only mirror, reconcile daily to the ledger of record, then hosted payment, then plans; rollback disables new charges and returns to the ERP. |
| Replacement authority gates | Institutional finance authority; auditor review; reconciliation for a full term; payment-provider contract; rollback. |
| Commercial model | Institutional. |
| Customer success model | Bursar implementation. |
| Outcome metrics | Reconciliation breaks; payment success; plan default rate. |
| Dependencies | D26, D28, D29 |
| Risks | PCI scope creep; refund/dispute paths unexercised; financial retention rules. |
| Tests | app/src/lib/finance/*.test.ts; billing check suites |
| Evidence (paths) | `app/src/lib/finance/accounts.ts`; `app/src/components/institutional/StudentAccounts.tsx`; `supabase/migrations/ (student_account_*, student_payment_plans)` |

### D14 Financial aid and scholarship handoffs

**Phase** 6 · **Priority** P3 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d14-aid`

**Classification** Transitional · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | A checklist and official handoff for aid; scholarship discovery; emergency-aid routing. Native aid workflow only with regulatory expertise. |
| Primary users | Students, aid staff. |
| Jobs to be done | Know what is missing; find funding; get urgent help. |
| Current source of truth | Aid office systems. |
| Native Semester source of truth | Not started; the register says not to claim it until regulatory expertise exists. |
| Integration strategy | Official handoff links. |
| Data model | opportunities, help_requests. |
| Tenant scope | Tenant. |
| Role/capability model | financial_aid_officer |
| Data classification | T3-T4. |
| Consent model | Student-controlled. |
| AI model/policy | Never computes eligibility. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Counsel; aid-office authority; regulator-aware controls. |
| Commercial model | Included in handoff tier. |
| Customer success model | n/a |
| Outcome metrics | Checklist completion; handoff click-through. |
| Dependencies | D13 |
| Risks | Regulatory exposure (Title IV). |
| Tests | app/src/lib/basicneeds.test.ts |
| Evidence (paths) | `app/server/institution/money.ts`; `app/src/screens/Opportunities.tsx`; `app/src/lib/basicneeds.ts` |

### D15 Campus life and services

**Phase** 6 · **Priority** P2 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d15-campus`

**Classification** Native but incomplete + Transitional · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | One service layer for campus offices: a request goes to the right owner with context and the student sees status. |
| Primary users | Students, campus offices. |
| Jobs to be done | Find a service; ask for help; book a space; see status. |
| Current source of truth | Many office systems. |
| Native Semester source of truth | Semester request routing; each office remains the record owner. |
| Integration strategy | Office feeds; booking write-back is off and not built. |
| Data model | help_requests, help_destinations, institution_actions, support_tickets. |
| Tenant scope | Tenant; office. |
| Role/capability model | office capabilities |
| Data classification | T2-T3. |
| Consent model | Minimum context only. |
| AI model/policy | Routes; summarises. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional. |
| Customer success model | Implementation per office. |
| Outcome metrics | Response and resolution time; repeat-issue rate; satisfaction. |
| Dependencies | D26 |
| Risks | Data waits on school feeds. |
| Tests | app/src/lib/support*.test.ts |
| Evidence (paths) | `app/src/screens/Support.tsx`; `app/src/screens/Hub.tsx`; `app/src/screens/Maps.tsx`; `app/src/lib/serviceregister.ts` |

### D16 Housing

**Phase** 6 · **Priority** P3 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d16-housing`

**Classification** Transitional + Pilot-only · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Housing status, application support and maintenance handoff; native only with a partner or institutional approval. |
| Primary users | Students, residence life. |
| Jobs to be done | Know status; apply; request maintenance. |
| Current source of truth | Housing system. |
| Native Semester source of truth | Handoff now; native after gates. |
| Integration strategy | Housing vendor feed. |
| Data model | Sandbox adapter only. |
| Tenant scope | Tenant; residence. |
| Role/capability model | residence_life_staff, resident_assistant |
| Data classification | T3. |
| Consent model | Roommate data is mutual consent. |
| AI model/policy | Explains policy. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Institution authority; partner contract. |
| Commercial model | Institutional. |
| Customer success model | Residence life. |
| Outcome metrics | Application completion. |
| Dependencies | D15 |
| Risks | Sandbox only. |
| Tests | app/src/lib/housing.test.ts |
| Evidence (paths) | `app/src/screens/Housing.tsx`; `app/src/lib/housing.ts`; `app/server/institution/housing.ts` |

### D17 Dining

**Phase** 6 · **Priority** P3 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d17-dining`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Hours, meal plan status and ordering through a dining partner. |
| Primary users | Students, dining staff. |
| Jobs to be done | Find food; see swipes; order. |
| Current source of truth | Dining partner. |
| Native Semester source of truth | Semester ledger and service built behind module.dining; ordering needs a live partner connection. |
| Integration strategy | Dining/campus-card partner. |
| Data model | dining_* (about 9 tables), dining_ledger. |
| Tenant scope | Tenant. |
| Role/capability model | dining_staff |
| Data classification | T3. |
| Consent model | Swipe sharing is opt-in. |
| AI model/policy | n/a |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Partner contract; institutional approval. |
| Commercial model | Institutional. |
| Customer success model | Dining operations. |
| Outcome metrics | Order success; ledger reconciliation. |
| Dependencies | D13 |
| Risks | Partner dependency. |
| Tests | app/src/lib/dining/*.test.ts |
| Evidence (paths) | `app/src/lib/dining/`; `app/src/screens/Dining.tsx`; `app/src/screens/Meals.tsx` |

### D18 Events

**Phase** 6 · **Priority** P3 · **Owner seat** `product` · **SLO class** C3 · **Branch** `domain/d18-events`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Verified campus events in the student's calendar. |
| Primary users | Students, organisers. |
| Jobs to be done | Find, add, RSVP. |
| Current source of truth | Campus event systems; seed data. |
| Native Semester source of truth | Semester event listings; no event backend found. |
| Integration strategy | ICS and event feeds. |
| Data model | Seed data. |
| Tenant scope | Tenant. |
| Role/capability model | organization_officer |
| Data classification | T0-T1. |
| Consent model | n/a |
| AI model/policy | Recommend with explanation. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | n/a |
| Outcome metrics | Events added to calendar. |
| Dependencies | D02, D19 |
| Risks | No backend. |
| Tests | none specific |
| Evidence (paths) | `app/src/data/events.ts`; `app/src/screens/Activities.tsx` |

### D19 Community and organizations

**Phase** 6 · **Priority** P1 · **Owner seat** `trust` · **SLO class** C1 · **Branch** `domain/d19-community`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Moderated, pseudonymity-aware communities with reporting, appeals and safety escalation. |
| Primary users | Students, organisation officers, moderators, volunteers, trust and safety. |
| Jobs to be done | Find a group; post; report; moderate; escalate. |
| Current source of truth | Social platforms and org portals. |
| Native Semester source of truth | Semester (foundation built; high-risk parts refuse production). |
| Integration strategy | Escalation webhook to campus safety (two-reviewer, allow-listed). |
| Data model | communities, community_* (about 35 tables), reports, moderation_audit_event. |
| Tenant scope | Tenant; community. |
| Role/capability model | community_manager, moderator, trust_safety_reviewer |
| Data classification | T2; reports are T3. |
| Consent model | Minors off social surfaces until 18; alias policy. |
| AI model/policy | Detectors assist moderators; never auto-punish. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional. |
| Customer success model | Moderator calibration. |
| Outcome metrics | Report response time; appeal reversal rate; harassment recurrence. |
| Dependencies | D21, D26 |
| Risks | Safety-critical; no trained moderators; no 24/7 coverage. |
| Tests | app/src/community/*.test.ts |
| Evidence (paths) | `app/src/community/`; `app/src/screens/Community.tsx`; `docs/COMMUNITY-PRIVACY-MODEL.md`; `docs/CAMPUS-MODERATION-SOP.md` |

### D20 Accessibility services

**Phase** 6 · **Priority** P1 · **Owner seat** `accessibility` · **SLO class** C2 · **Branch** `domain/d20-access-services`

**Classification** Designed/documented · repository ladder `designed` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Accommodation passports a student controls and shares with faculty without disclosing the diagnosis; faster provisioning of accommodations. |
| Primary users | Students, disability services, faculty. |
| Jobs to be done | Request, verify, share and apply accommodations; assessment accommodations in Course Studio. |
| Current source of truth | Disability services case system. |
| Native Semester source of truth | Schema exists; no institutional service found in code. |
| Integration strategy | Disability services system handoff. |
| Data model | accommodation_passports/shares/access_events. |
| Tenant scope | Tenant; student. |
| Role/capability model | disability_services_officer, accommodation:verify |
| Data classification | T4 (disability). |
| Consent model | Student-controlled, minimal-disclosure. |
| AI model/policy | None on diagnosis data. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Institution DS authority; legal review. |
| Commercial model | Institutional. |
| Customer success model | DS office onboarding. |
| Outcome metrics | Time to accommodation in effect. |
| Dependencies | D04, D05 |
| Risks | Sensitive; the product's own accessibility is unevaluated (separate concern, see D29/D30). |
| Tests | supabase accommodation check suites |
| Evidence (paths) | `supabase/migrations/ (accommodation_passports, accommodation_shares)`; `app/src/lib/cara.ts`; `docs/ACCESSIBILITY-POLISH-CHECKLIST.md` |

### D21 Safety and emergency handoffs

**Phase** 6 · **Priority** P0 · **Owner seat** `trust` · **SLO class** C0 · **Branch** `domain/d21-safety`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Safe handoff to the institution's official emergency channels; Semester never replaces emergency response. |
| Primary users | Students, campus safety, counselling liaisons. |
| Jobs to be done | Get to the right human fast; leave an auditable handoff. |
| Current source of truth | Institutional protocols. |
| Native Semester source of truth | Handoff only; Semester is never the emergency system. |
| Integration strategy | Signed allow-listed webhooks; official numbers. |
| Data model | community escalation records. |
| Tenant scope | Tenant. |
| Role/capability model | trust_safety_senior |
| Data classification | T4-T6. |
| Consent model | Safety overrides handled by protocol, not by product defaults. |
| AI model/policy | Detects, never decides; human required. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Never replaces emergency response. |
| Commercial model | Included with community. |
| Customer success model | Named campus contact. |
| Outcome metrics | Handoff delivered; time to human. |
| Dependencies | D19 |
| Risks | Highest harm potential; no 24/7 responder. |
| Tests | community crisis tests |
| Evidence (paths) | `app/src/community/crisis.ts`; `supabase/functions/_shared/escalation.ts`; `docs/CRISIS-RESPONSE-RUNBOOK.md`; `docs/CAMPUS-ESCALATION-POLICY.md` |

### D22 Library and research

**Phase** 3 · **Priority** P3 · **Owner seat** `product` · **SLO class** C3 · **Branch** `domain/d22-library`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Sources, citations and research workspace tied to the course. |
| Primary users | Students, faculty, librarians. |
| Jobs to be done | Find, cite, organise sources. |
| Current source of truth | Library systems. |
| Native Semester source of truth | Semester research workspace. |
| Integration strategy | Library discovery APIs (none built). |
| Data model | approved_source, evidence_reference. |
| Tenant scope | Account; course. |
| Role/capability model | source:approve |
| Data classification | T0-T2. |
| Consent model | n/a |
| AI model/policy | Citation assistance with provenance. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | n/a |
| Outcome metrics | Sources cited with provenance. |
| Dependencies | D06, D07 |
| Risks | Licensing. |
| Tests | app/src/lib/research.test.ts |
| Evidence (paths) | `app/src/lib/research.ts`; `app/src/lib/cite.ts`; `app/src/screens/Sources.tsx`; `app/src/lib/source-locker.ts` |

### D23 Career, employer and alumni

**Phase** 7 · **Priority** P2 · **Owner seat** `product` · **SLO class** C2 · **Branch** `domain/d23-career`

**Classification** Native but incomplete + Pilot-only · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Verified skills, portfolio and credential wallet; employers discover consented evidence; alumni mentor. |
| Primary users | Students, career staff, employers, alumni. |
| Jobs to be done | Build evidence; find opportunities; share credentials; get mentored. |
| Current source of truth | Career services platforms. |
| Native Semester source of truth | Semester skills and portfolio; self-reported claims never appear as institution-verified. |
| Integration strategy | Open Badges / CLR / verifiable credentials (not found in code). |
| Data model | skill_records, skill_claim(_evidence), talent_profiles, alumni_mentor_offers, opportunities. |
| Tenant scope | Account; tenant. |
| Role/capability model | skill:verify, talent:search, career_coach |
| Data classification | T2. |
| Consent model | Student-controlled sharing. |
| AI model/policy | Suggests; flags unverified claims. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional, employer-side (unpriced). |
| Customer success model | Career centre. |
| Outcome metrics | Verified claims issued; employer views with consent. |
| Dependencies | D05, D11 |
| Risks | No employer-side surface exists. |
| Tests | app/src/lib/career*.test.ts |
| Evidence (paths) | `app/src/screens/Career.tsx`; `app/src/lib/career.ts`; `app/src/lib/career-evidence.ts`; `docs/CREDENTIAL-WALLET.md` |

### D24 Family and guardian grants

**Phase** 4 · **Priority** P1 · **Owner seat** `privacy` · **SLO class** C1 · **Branch** `domain/d24-family`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Student-authorised, time-bound sharing with family and guardians; K-12 guardian links under legal basis. |
| Primary users | Students, family, guardians, K-12 staff. |
| Jobs to be done | Grant a view; revoke; see what was seen. |
| Current source of truth | None (new). |
| Native Semester source of truth | Semester (consent ledger). |
| Integration strategy | None. |
| Data model | family_grants, family_invites, family_shared_items, family_access_events, guardian_links(_history/_restrictions). |
| Tenant scope | Account; tenant. |
| Role/capability model | Grant-scoped. |
| Data classification | T3. |
| Consent model | Student grants; revocable; auditable; minors follow guardian law. |
| AI model/policy | No AI on shared family data. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | Student education. |
| Outcome metrics | Grants active; access events per grant; revocation time. |
| Dependencies | D26, D28 |
| Risks | FERPA/COPPA interplay; high-risk activation profile. |
| Tests | supabase family check suites; erasure clears consent snapshots |
| Evidence (paths) | `app/src/screens/Family.tsx`; `app/src/lib/family.ts`; `supabase/ (family*.check.sql)`; `docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md` |

### D25 Institutional governance and configuration

**Phase** 8 · **Priority** P1 · **Owner seat** `product` · **SLO class** C1 · **Branch** `domain/d25-governance`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Tenant hierarchy, policy, configuration, workflow, rollouts, approvals, two-person controls and offboarding. |
| Primary users | Institution admins, registrar, IT, Semester operators. |
| Jobs to be done | Configure safely; approve; roll out; roll back; leave with data. |
| Current source of truth | Per-tool admin consoles. |
| Native Semester source of truth | Semester control plane (staff-side, off by default). |
| Integration strategy | IdP; SIS. |
| Data model | tenant_*, school_config_versions, workflow_versions, approval_request/decision, school_offboarding. |
| Tenant scope | Tenant. |
| Role/capability model | tenant:configure, platform:configure |
| Data classification | T3. |
| Consent model | n/a |
| AI model/policy | Configuration assistant proposes; humans approve. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional. |
| Customer success model | Implementation playbook. |
| Outcome metrics | Config changes with approval evidence; offboarding exports verified. |
| Dependencies | D26, D29 |
| Risks | Platform engines have 0 importers from the app; tenant isolation off for every school (F-01). |
| Tests | app/src/lib/governance/*.test.ts |
| Evidence (paths) | `app/src/lib/governance/`; `app/src/lib/config/`; `app/src/components/institutional/ConfigurationStudio.tsx`; `app/src/components/institutional/WorkflowBuilder.tsx` |

### D26 Identity, SSO and SCIM

**Phase** 1 · **Priority** P0 · **Owner seat** `security` · **SLO class** C0 · **Branch** `domain/d26-identity`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval, Requires migration

| Field | Answer |
| --- | --- |
| Vision | Membership-derived identity per tenant, SSO, lifecycle provisioning and access governance. |
| Primary users | Everyone; IT; Semester operators. |
| Jobs to be done | Sign in once; get the right access; lose it on departure. |
| Current source of truth | Supabase Auth plus school email-domain membership; the institution's IdP once connected. |
| Native Semester source of truth | Semester holds membership and grants; the institution's IdP stays the identity authority. |
| Integration strategy | SAML, OIDC, SCIM 2.0 (SCIM off unless enabled). |
| Data model | institution_membership, institution_identity_provider, scim_*, role_grants, app_roles, app_capabilities, role_capabilities. |
| Tenant scope | Tenant. |
| Role/capability model | integration_admin, tenant:configure |
| Data classification | T3. |
| Consent model | Claim mapping minimised (docs/SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md). |
| AI model/policy | None. |
| Migration, reconciliation, dual-run, cutover, rollback | Pilot SSO for one domain; dual sign-in; provision by SCIM in dry-run; cut over by domain; rollback re-enables email-domain sign-in. |
| Replacement authority gates | IdP replacement is not proposed: Semester integrates with the institution's identity provider. |
| Commercial model | Institutional. |
| Customer success model | IT onboarding (docs/SSO-TENANT-ONBOARDING.md). |
| Outcome metrics | SSO success; provisioning lag; orphaned access count. |
| Dependencies | none (foundation) |
| Risks | Cross-source conflict: the replacement register says SAML only; the code audit found no SAML protocol code outside docs (verify whether Supabase SSO carries it); no real IdP connected. |
| Tests | app/server/institution/*.test.ts; supabase membership check suites |
| Evidence (paths) | `app/server/institution/auth.ts`; `app/server/institution/scim.ts`; `packages/institution/src/identity.ts`; `supabase/migrations/ (bind_institution_sso_membership, tenant_sso_policy, scim_gateway)`; `docs/INSTITUTIONAL-SSO-ARCHITECTURE.md` |

### D27 Integrations, LTI, OneRoster and Edu-API

**Phase** 1 · **Priority** P0 · **Owner seat** `engineering` · **SLO class** C1 · **Branch** `domain/d27-integrations`

**Classification** Native but incomplete + Integrated · repository ladder `building` · **Readiness** Unsafe to activate

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires institutional approval, Requires migration, Requires reconciliation

| Field | Answer |
| --- | --- |
| Vision | A connector framework with scopes, mappings, sync runs, dead letters, reconciliation, drift detection and kill switches. |
| Primary users | Integration admins, implementers, partners. |
| Jobs to be done | Connect a source safely; see its health; stop it; reconcile it. |
| Current source of truth | Institution systems. |
| Native Semester source of truth | Semester integration control plane; adapters wait on a design partner. ADAPTERS is empty; every service answers 503 unless the sandbox is on. |
| Integration strategy | LTI 1.3 built (0 registrations); Canvas proxy; OneRoster/Edu-API/SIS adapters not built. |
| Data model | connections, integration_* (about 18 tables), lti_*, provider_registry, migration_*, private.roster_*. |
| Tenant scope | Tenant. |
| Role/capability model | integration:view/configure/approve/sync/replay/reconcile |
| Data classification | T3. |
| Consent model | Connection approval by the institution. |
| AI model/policy | None. |
| Migration, reconciliation, dual-run, cutover, rollback | See SEMESTER_MIGRATION_FACTORY.md. |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional connector fees (unapproved). |
| Customer success model | Integration operator runbook. |
| Outcome metrics | Sync success; freshness; reconciliation exceptions; time-to-connect. |
| Dependencies | D26 |
| Risks | No real connection exists; no adapter certification. |
| Tests | app/src/lib/integration/*.test.ts; supabase integration suites; sync simulation sandbox |
| Evidence (paths) | `app/src/lib/integration/`; `app/server/integration/`; `supabase/functions/lti/`; `supabase/functions/integration-tick/`; `docs/INTEGRATION-CONTROL-PLANE.md`; `docs/INTEROPERABILITY-ROADMAP.md` |

### D28 Privacy, retention and legal holds

**Phase** 1 · **Priority** P0 · **Owner seat** `privacy` · **SLO class** C1 · **Branch** `domain/d28-privacy`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Classification, consent, retention, export, deletion, holds and data-rights requests enforced in data and demonstrable. |
| Primary users | Students, privacy officers, counsel, institutions. |
| Jobs to be done | Export or erase my data; place a hold; evidence retention. |
| Current source of truth | Per-system. |
| Native Semester source of truth | Semester for its own data; institution records follow institution policy. |
| Integration strategy | Institution DSR workflows. |
| Data model | data_classification_rules, legal_holds, data_subject_request, consent_record, retention runs. |
| Tenant scope | Account; tenant; platform. |
| Role/capability model | data_steward, compliance_owner |
| Data classification | Defines T0-T6. |
| Consent model | Defines the consent model. |
| AI model/policy | Training-use policy forbids training on customer data (docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md). |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | Privacy ops. |
| Outcome metrics | DSR time to close; sweeps run; holds honoured. |
| Dependencies | D26 |
| Risks | Table classes are rule-derived, not human-reviewed; no counsel engaged; FORCE RLS not applied. |
| Tests | supabase retention/legal-hold check suites; app/src/lib/tableclassification.test.ts |
| Evidence (paths) | `supabase/migrations/ (retention_sweeps, legal_holds, financial_retention)`; `app/src/screens/Privacy.tsx`; `docs/DATA-RETENTION-EXPORT-DELETION.md`; `docs/trust/DATA-CLASSIFICATION-STANDARD.md` |

### D29 Security, audit and incident response

**Phase** 1 · **Priority** P0 · **Owner seat** `security` · **SLO class** C0 · **Branch** `domain/d29-security`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review

| Field | Answer |
| --- | --- |
| Vision | Tenant isolation proven by negative tests, tamper-evident audit, alerts that reach a person, and rehearsed incident response. |
| Primary users | Security, operators, customers' security reviewers. |
| Jobs to be done | Prevent, detect, respond, evidence. |
| Current source of truth | CI checks; one operator. |
| Native Semester source of truth | Semester. |
| Integration strategy | DAST (HawkScan, not run), CodeQL (conditional), supply-chain attestations. |
| Data model | audit_event, private.console_audit_*, private.ledger_chain*, break_glass_grant. |
| Tenant scope | Platform; tenant. |
| Role/capability model | audit:read; incident_responder |
| Data classification | n/a |
| Consent model | n/a |
| AI model/policy | AI red-team and kill-switch drills. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | Trust room. |
| Outcome metrics | Open High findings (target 0); alert-to-human time; drill pass rate. |
| Dependencies | all |
| Risks | F-01 tenant isolation off for every school; F-08 no alerting; no pen test; no per-class cross-tenant negative suite (R-001). |
| Tests | supabase/*.check.sql (111); app/src/lib/sre/*.test.ts |
| Evidence (paths) | `docs/security/FINDINGS-REGISTER.md`; `docs/trust/INCIDENT-RESPONSE-PLAN.md`; `supabase/*.check.sql`; `.github/workflows/ci.yml`; `database/TENANT_ISOLATION_MATRIX.md` |

### D30 Trust, compliance and HECVAT

**Phase** 8 · **Priority** P1 · **Owner seat** `trust` · **SLO class** C2 · **Branch** `domain/d30-trust`

**Classification** Designed/documented + Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Evidence-backed trust centre, HECVAT, VPAT/ACR, DPAs, subprocessor governance and claims governance. |
| Primary users | Procurement, security reviewers, counsel, institutions. |
| Jobs to be done | Answer a questionnaire truthfully; share evidence under NDA; keep claims within evidence. |
| Current source of truth | Drafts and readiness matrices. |
| Native Semester source of truth | Semester. |
| Integration strategy | Trust-room private bucket. |
| Data model | trust_artifacts, trust_room_*, compliance_controls, control_evidence, claims_register. |
| Tenant scope | Platform. |
| Role/capability model | compliance_owner, trust_officer |
| Data classification | n/a |
| Consent model | n/a |
| AI model/policy | Draft only; humans approve claims. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | Trust room. |
| Outcome metrics | Questionnaire turnaround; claims in register vs on site (0 gap). |
| Dependencies | D29 |
| Risks | No HECVAT, SOC 2, pen test, ACR, executed DPA; 15 public statements above evidence (docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md). |
| Tests | app/src/lib/trust/*.test.ts; claims tests |
| Evidence (paths) | `docs/trust/`; `docs/compliance/`; `app/src/lib/trust/`; `supabase/functions/trust-room/`; `docs/SUBPROCESSORS.md` |

### D31 Operations Command Center

**Phase** 9 · **Priority** P1 · **Owner seat** `operations` · **SLO class** C1 · **Branch** `domain/d31-ops-console`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review

| Field | Answer |
| --- | --- |
| Vision | One console for tenants, pilots, support, security, billing, releases and compliance, with approvals and break-glass. |
| Primary users | Semester operators. |
| Jobs to be done | Triage; approve; support; release. |
| Current source of truth | Manual plus console. |
| Native Semester source of truth | Semester. |
| Integration strategy | None. |
| Data model | console_action_record, console_duty, approval_request, support_access_*. |
| Tenant scope | Platform. |
| Role/capability model | platform_admin, support_agent, break-glass |
| Data classification | T3 (support access is time-limited). |
| Consent model | Customer data boundaries (ADR-0020). |
| AI model/policy | Support summarisation; humans act. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Internal. |
| Customer success model | n/a |
| Outcome metrics | Open-incident age; approvals turnaround. |
| Dependencies | D26, D29 |
| Risks | One operator; no on-call rota; no second approver. |
| Tests | app/src/lib/console/*.test.ts; app/src/lib/ops/*.test.ts |
| Evidence (paths) | `app/src/screens/Console.tsx`; `app/src/components/console/`; `app/src/lib/console/client.ts`; `docs/OPERATIONS-CONSOLE-MAP.md` |

### D32 Commercial, billing and customer success

**Phase** 9 · **Priority** P1 · **Owner seat** `finance` · **SLO class** C1 · **Branch** `domain/d32-commercial`

**Classification** Pilot-only + Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Enforceable plans and entitlements, invoices, renewals, dunning and customer health. |
| Primary users | Students (individual), institutions, Semester finance and CS. |
| Jobs to be done | Buy, cancel, renew, invoice, expand. |
| Current source of truth | One live $7.99 monthly checkout/cancel test; checkout held off by flag. |
| Native Semester source of truth | Semester with Stripe; institutional billing is documented-unimplemented. |
| Integration strategy | Stripe. |
| Data model | commercial_*, subscriptions, invoices, dunning_*, quotes, customer*. |
| Tenant scope | Account; tenant. |
| Role/capability model | billing_contact, finance_operator |
| Data classification | T3-T4 (financial; no card data). |
| Consent model | n/a |
| AI model/policy | None. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Plus $7.99/$59 (fact); everything else proposed. |
| Customer success model | docs/commercial/CUSTOMER-SUCCESS-PLAYBOOK.md |
| Outcome metrics | Pilot-to-annual conversion (hypothesis 50%); net revenue retention; support cost per student. |
| Dependencies | D26 |
| Risks | Annual, refund, failed renewal, dispute and tax unexercised; conflicting institutional price sets; take rate 12% vs 15%. |
| Tests | app/src/lib/billing/*.test.ts |
| Evidence (paths) | `supabase/functions/billing-checkout/`; `supabase/functions/billing-webhook/`; `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md`; `commercial/READINESS_GAP_MATRIX.md`; `app/src/lib/billing/` |

### D33 Marketing, sales and the company site

**Phase** 9 · **Priority** P1 · **Owner seat** `founder` · **SLO class** C3 · **Branch** `domain/d33-site`

**Classification** Native but incomplete · repository ladder `tested` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review

| Field | Answer |
| --- | --- |
| Vision | A truthful public site and sales motion whose every claim traces to evidence. |
| Primary users | Prospects, buyers, press. |
| Jobs to be done | Learn what is true; start a pilot conversation. |
| Current source of truth | Static site; deployment revision unverified against repo. |
| Native Semester source of truth | Semester. |
| Integration strategy | Resend; lead intake. |
| Data model | site_leads, cta_routes, gtm_*. |
| Tenant scope | Public. |
| Role/capability model | marketing_admin |
| Data classification | T1-T2 (lead data). |
| Consent model | gtm_consent append-only. |
| AI model/policy | Drafts only; claims reviewed. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Internal. |
| Customer success model | n/a |
| Outcome metrics | Qualified conversations; claims audit gap. |
| Dependencies | D30 |
| Risks | 15 over-evidence statements; personal-mailbox and personal-domain dependencies. |
| Tests | app/src/lib/companysiteconversion.test.ts; claims tests |
| Evidence (paths) | `company-site/`; `app/src/site/`; `docs/PUBLIC-SITE.md`; `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` |

### D34 Developer platform

**Phase** 10 · **Priority** P2 · **Owner seat** `engineering` · **SLO class** C2 · **Branch** `domain/d34-developer`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review

| Field | Answer |
| --- | --- |
| Vision | Versioned APIs, OAuth/OIDC, webhooks, SDKs, sandbox tenants and certification. |
| Primary users | Institution developers, partners. |
| Jobs to be done | Integrate, extend, test, get certified. |
| Current source of truth | One OpenAPI contract (productivity v1); four examples. |
| Native Semester source of truth | Semester. |
| Integration strategy | n/a |
| Data model | provider_registry; webhook events. |
| Tenant scope | Tenant; app. |
| Role/capability model | Scopes per app. |
| Data classification | Per scope. |
| Consent model | Tenant install approval. |
| AI model/policy | None. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Platform fees (unapproved). |
| Customer success model | Developer support. |
| Outcome metrics | Time to first call in sandbox; API error rate. |
| Dependencies | D26, D27 |
| Risks | Only productivity API exists; OAuth app model not built. |
| Tests | app/server/productivity/openapi.test.ts |
| Evidence (paths) | `docs/api/productivity.v1.openapi.json`; `packages/platform/src/gateway/`; `examples/`; `docs/API-PLATFORM.md` |

### D35 Marketplace and partners

**Phase** 10 · **Priority** P3 · **Owner seat** `founder` · **SLO class** C3 · **Branch** `domain/d35-marketplace`

**Classification** Not started + Designed/documented · repository ladder `designed` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Reviewed third-party apps with scopes, tenant approval, support and offboarding. |
| Primary users | Partners, institutions, students. |
| Jobs to be done | Discover, install, pay, remove. |
| Current source of truth | None. |
| Native Semester source of truth | Not started; gated by D-1236 (G-OWN, G-DATA, G-TERMS, G-QUEUE). |
| Integration strategy | n/a |
| Data model | none |
| Tenant scope | Tenant. |
| Role/capability model | Per app. |
| Data classification | Per scope. |
| Consent model | Tenant install approval. |
| AI model/policy | Providers are marketplace apps under AI policy. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Take rate undecided (12% vs 15%). |
| Customer success model | Partner success. |
| Outcome metrics | n/a until built |
| Dependencies | D34 |
| Risks | Premature: the first 3 partners should be integrations, not a marketplace. |
| Tests | none |
| Evidence (paths) | `docs/EXTENSION-ECOSYSTEM-GOVERNANCE.md`; `docs/decisions/proposed/ (ADR-0024)`; `docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md` |

### D36 Data, analytics and outcomes

**Phase** 4 · **Priority** P1 · **Owner seat** `data` · **SLO class** C2 · **Branch** `domain/d36-analytics`

**Classification** Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Aggregate-by-default analytics with visible definitions, freshness and minimum cohort size; no opaque risk scores. |
| Primary users | Institution leaders, Semester operators, faculty. |
| Jobs to be done | See adoption, bottlenecks, outcomes honestly. |
| Current source of truth | Staff studio works on pasted data on the device; no institutional data ships. |
| Native Semester source of truth | Semester. |
| Integration strategy | Warehouse export. |
| Data model | outcome_aggregates, account_health_snapshots. |
| Tenant scope | Tenant. |
| Role/capability model | outcomes:read, demand:read |
| Data classification | T2-T3 aggregates; cell size >= 10. |
| Consent model | Purpose-limited. |
| AI model/policy | Explains metrics; no punitive automation. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Institutional. |
| Customer success model | Outcome reviews. |
| Outcome metrics | See SEMESTER_OUTCOME_MEASUREMENT.md |
| Dependencies | D26, D28 |
| Risks | No outcome baseline (EXT-015 blocked). |
| Tests | app/src/lib/institution-ops.test.ts |
| Evidence (paths) | `app/src/lib/institution-ops.ts`; `app/src/insights/`; `supabase/analytics.sql`; `docs/PRODUCT-ANALYTICS-DATA-ETHICS.md` |

### D37 Reliability, SLO and release operations

**Phase** 1 · **Priority** P0 · **Owner seat** `operations` · **SLO class** C0 · **Branch** `domain/d37-reliability`

**Classification** Designed/documented + Native but incomplete · repository ladder `building` · **Readiness** Not ready

**Review flags (open)** Requires security review, Requires rollback

| Field | Answer |
| --- | --- |
| Vision | Measured SLOs, rehearsed restores, canary and rollback, alerts to a person. |
| Primary users | Operators, customers. |
| Jobs to be done | Release safely; recover; know. |
| Current source of truth | CI gates; one operator; logical restore rehearsal only. |
| Native Semester source of truth | Semester. |
| Integration strategy | Supabase, Vercel, GitHub. |
| Data model | platform_release_evidence. |
| Tenant scope | Platform. |
| Role/capability model | incident_responder |
| Data classification | n/a |
| Consent model | n/a |
| AI model/policy | Incident assistance only. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | Included. |
| Customer success model | Status page. |
| Outcome metrics | Restore time (measured); error-budget burn; change-failure rate; main-green rate. |
| Dependencies | all |
| Risks | Production restore never done; RTO/RPO unmeasured; 26 of last 30 main CI runs failed; no ruleset on main. |
| Tests | supabase/restore.sh in CI; app/src/lib/sre/*.test.ts |
| Evidence (paths) | `docs/sre/`; `.github/workflows/`; `RESTORE.md`; `ROLLBACK.md`; `docs/evidence/restore/`; `docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md` |

### D38 People, hiring and company operations

**Phase** 9 · **Priority** P1 · **Owner seat** `founder` · **SLO class** n/a · **Branch** `company/d38-people`

**Classification** Designed/documented · repository ladder `designed` · **Readiness** Not ready

**Review flags (open)** none beyond the universal gates

| Field | Answer |
| --- | --- |
| Vision | A staffed organisation where each seat has a person, a backup and an independent reviewer. |
| Primary users | Founder, hires, advisors. |
| Jobs to be done | Hire against evidence gates; hold reviews independent. |
| Current source of truth | One person holds every seat; every backup unassigned; no advisor engaged. |
| Native Semester source of truth | n/a (company). |
| Integration strategy | n/a |
| Data model | council_seat_holder. |
| Tenant scope | Company. |
| Role/capability model | n/a |
| Data classification | n/a |
| Consent model | n/a |
| AI model/policy | n/a |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | n/a |
| Customer success model | n/a |
| Outcome metrics | Seats held by a second person; backups assigned. |
| Dependencies | D39 |
| Risks | Single-person dependency (R-018); independent review impossible. |
| Tests | app/src/lib/launchreadiness.test.ts |
| Evidence (paths) | `docs/finance/12-GATED-HIRING-SCHEDULE.md`; `OWNER-AND-ACCOUNTABILITY-MATRIX.md`; `docs/company/COMPANY-OPERATING-MODEL.md` |

### D39 Finance, runway and board reporting

**Phase** 9 · **Priority** P1 · **Owner seat** `finance` · **SLO class** n/a · **Branch** `company/d39-finance`

**Classification** Designed/documented · repository ladder `designed` · **Readiness** Not ready

**Review flags (open)** Requires privacy/legal review

| Field | Answer |
| --- | --- |
| Vision | Real cash, spend, collections and a board package. |
| Primary users | Founder, advisors, investors. |
| Jobs to be done | Know runway; decide hires; report. |
| Current source of truth | Hypothesis model; opening cash $0 placeholder; no real runway number. |
| Native Semester source of truth | n/a |
| Integration strategy | Accounting system (none). |
| Data model | n/a |
| Tenant scope | Company. |
| Role/capability model | n/a |
| Data classification | n/a |
| Consent model | n/a |
| AI model/policy | n/a |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | n/a |
| Customer success model | n/a |
| Outcome metrics | Runway months (from real cash). |
| Dependencies | D38 |
| Risks | No tax, accounting, insurance or revenue-recognition review (EXT-004/005). |
| Tests | docs/finance/tools parity checks |
| Evidence (paths) | `docs/finance/README.md`; `docs/finance/13-REAL-NUMBERS-INTAKE.md`; `docs/finance/semester-financial-model.xlsx` |

### D40 Globalization, localization and accessibility expansion

**Phase** 10 · **Priority** P2 · **Owner seat** `accessibility` · **SLO class** C3 · **Branch** `domain/d40-global`

**Classification** Designed/documented · repository ladder `designed` · **Readiness** Not ready

**Review flags (open)** Requires privacy/legal review, Requires accessibility review, Requires institutional approval

| Field | Answer |
| --- | --- |
| Vision | Plain-language, localised, accessible-by-default experiences across languages and jurisdictions. |
| Primary users | Students, institutions outside the US. |
| Jobs to be done | Use Semester in my language with my assistive tech. |
| Current source of truth | English; accessibility features present, no external evaluation. |
| Native Semester source of truth | Semester. |
| Integration strategy | n/a |
| Data model | n/a |
| Tenant scope | All. |
| Role/capability model | n/a |
| Data classification | n/a |
| Consent model | Jurisdiction-specific (GDPR, UK, etc.). |
| AI model/policy | Language-aware evaluation. |
| Migration, reconciliation, dual-run, cutover, rollback | Not applicable: Semester is not replacing an external record here (U-MIG). |
| Replacement authority gates | Not a replacement domain. |
| Commercial model | n/a |
| Customer success model | n/a |
| Outcome metrics | Screens meeting WCAG 2.2 AA by independent evaluation. |
| Dependencies | D30 |
| Risks | No ACR; no localisation framework verified in code. |
| Tests | app/src/a11y/*.test.ts (axe) |
| Evidence (paths) | `docs/LOCALIZATION-PLAIN-LANGUAGE-INTERNATIONALIZATION.md`; `docs/COLOR-AND-DARK-MODE-SPEC.md`; `app/src/a11y/` |
