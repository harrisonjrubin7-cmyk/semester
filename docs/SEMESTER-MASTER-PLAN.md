<!-- Rendered from app/src/lib/governance/master-plan.ts by master-plan.test.ts. Edit the data, then run `npm run registers` from app/. -->

# Semester Master Plan: From Registration Readiness Pilot to University Operating System

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

**As of 2026-09-30.** This is an execution control document, not a launch claim. Product maturity, tenant activation, deployment, pilot completion, and institutional approval are separate states.

## Vision

- Now: a private, source-aware academic operating system that helps a student decide what to do next.
- Next: a governed registration-readiness workflow that a university can pilot without surrendering authority.
- Later: a modular university operating platform whose shared controls let institutions adopt bounded workflows safely.

## One definition of done

- [ ] Clear user problem and accountable owner.
- [ ] User journey, edge cases, and out-of-scope boundaries.
- [ ] Data classification, authority, provenance, retention, and correction route.
- [ ] Tenant, role, purpose, consent, and object-level authorization.
- [ ] Source freshness and safe fallback.
- [ ] Accessibility acceptance criteria and manual test evidence.
- [ ] Security and threat review, secrets handling, audit events, and abuse cases.
- [ ] Unit, integration, authorization, failure, and regression tests.
- [ ] Monitoring, SLO, support owner, documentation, and runbook.
- [ ] Feature entitlement, institution approval, rollout controls, and kill switch.
- [ ] Migration, rollback, export, deletion, and retirement behavior.
- [ ] Claims reviewed against the Product Status Map.
- [ ] Evidence stored in the evidence vault.
- [ ] Measurable success metric and review date.

## Milestone roadmap

| Milestone | Scope | Current state | Proof of completion | Next gate |
| --- | --- | --- | --- | --- |
| M0: Company foundation | Incorporation, IP, banking, domain, policy library, source control, and key-person continuity. | evidence required | The company can sign a pilot and operate accounts safely. | Store executed company and continuity evidence; repository documents alone do not close this gate. |
| M1: Safe core app | Authentication, tenant model, persistence, RLS, Action Center, source labels, accessibility baseline, and monitoring. | partial | A student safely uses persistent private data in a real two-account test. | Close production auth, tenant-isolation, persistence, accessibility, support, and monitoring evidence. |
| M2: Registration Readiness | Path, term plan, conflict detection, backups, advisor agenda, and official handoff. | partial | 10-20 students complete the workflow in observed usability testing. | Finish the bounded workflow, then record observed usability evidence without enabling registration writes. |
| M3: Controlled pilot | A 25-75 student cohort, support, feedback, metrics, and an outcome report. | evidence required | The pilot produces its predefined evidence-backed result. | Secure design partners, owners, consent, support coverage, measures, and a signed pilot boundary. |
| M4: Institution confidence | SSO, minimal read-only data, tenant configuration, procurement pack, DPA, and incident/restore evidence. | blocked | One institution approves and launches a scoped deployment. | Institution and provider approvals plus hosted restore, incident, security, and procurement evidence. |
| M5: Repeatable adoption | Templates, implementation center, support playbooks, pricing, and first paid conversion. | not started | A second deployment requires little custom work. | Complete one controlled institutional launch before standardizing a second. |
| M6: Learning and advising expansion | Course context, cited study support, advisor workflows, and controlled Hermes. | blocked | Students and staff use connected workflows safely. | Prove the core pilot and approve connected data, AI provider, advisor permissions, and evaluation. |
| M7: Platform expansion | Career, campus resources, opportunities, and student-controlled evidence. | not started | Additional modules reuse the same control plane. | Admit modules only after shared identity, policy, evidence, and lifecycle controls are proven. |
| M8: Deep integrations | LTI, OneRoster, approved SIS gateway, reconciliation, and parallel run. | blocked | Integration health and data quality are proven across terms. | Funded partner scope, approved credentials, reconciliation, failure handling, and term-length evidence. |
| M9: Bounded system-of-record modules | One specific institutional workflow becomes authoritative. | blocked | Parallel run, reconciliation, approvals, rollback, and audit evidence pass. | Name one bounded authoritative workflow and obtain institution, security, legal, and operational approval. |
| M10: University operating platform | Multi-campus operation, modular replacements, and mature assurance and operations. | not started | Multiple institutions operate modules predictably at scale. | Earn this status through repeated operating evidence; architecture and code alone cannot close it. |

## Capability register

60 catalog capabilities: **60 verified**, **0 partial**, **0 blocked**, **0 absent**, **0 conflict**. “Verified” is the source registry's product status; it is not production or tenant activation evidence.

| ID | Capability | Owner | Status | Risk | Activation | Dependencies | Evidence class | Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-001 | Today | Academic experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-002 | Reports | Academic experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-003 | Calendar | Academic platform | verified | standard | tenant-gate-required | CAP-020; CAP-021 | source-registry-verified | 2026-10-30 |
| CAP-004 | Exam Runway | Learning experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-005 | The Week Ahead | Academic experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-006 | When You Are Behind | Academic experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-007 | Tonight | Academic experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-008 | Timers and Alarms | Productivity experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-009 | Progress | Academic experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-010 | Account | Identity platform | verified | standard | tenant-gate-required | CAP-011; CAP-015 | source-registry-verified | 2026-10-30 |
| CAP-011 | Profile | Identity platform | verified | standard | tenant-gate-required | CAP-010 | source-registry-verified | 2026-10-30 |
| CAP-012 | Links | Campus experience | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-013 | Connect Accounts | Integration platform | verified | controlled | not-approved | external:provider credentials and institution approval; CAP-010 | source-registry-verified | 2026-10-30 |
| CAP-014 | Your Data and How It Is Running | Data platform | verified | standard | tenant-gate-required | CAP-015; CAP-016 | source-registry-verified | 2026-10-30 |
| CAP-015 | Privacy and Your Rights | Trust and privacy | verified | standard | tenant-gate-required | CAP-010; CAP-014 | source-registry-verified | 2026-10-30 |
| CAP-016 | Take It With You | Data platform | verified | standard | tenant-gate-required | CAP-014; CAP-015 | source-registry-verified | 2026-10-30 |
| CAP-017 | Settings | Core application | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-018 | Alerts | Communication platform | verified | controlled | not-approved | external:notification delivery credentials and channel verification; CAP-003; CAP-017 | source-registry-verified | 2026-10-30 |
| CAP-019 | How This Works | Product education | verified | standard | tenant-gate-required | CAP-013; CAP-014 | source-registry-verified | 2026-10-30 |
| CAP-020 | Courses | Academic platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-021 | Assignments | Academic platform | verified | standard | tenant-gate-required | CAP-020; CAP-003 | source-registry-verified | 2026-10-30 |
| CAP-022 | Add a Course | Academic ingestion | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-023 | Edit the Course | Academic ingestion | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-024 | A Change to a Date | Academic ingestion | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-025 | Study | Learning platform | verified | standard | tenant-gate-required | CAP-020; CAP-028 | source-registry-verified | 2026-10-30 |
| CAP-026 | Where Courses Meet | Learning platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-027 | Semester Tutor | Semester Intelligence | verified | controlled | not-approved | external:approved AI provider configuration and evaluation; CAP-025; CAP-038 | source-registry-verified | 2026-10-30 |
| CAP-028 | Add a Reading | Academic ingestion | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-029 | Problem Practice | Learning platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-030 | Practice Exams | Learning platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-031 | Create | Workspace platform | verified | standard | tenant-gate-required | CAP-034; CAP-035; CAP-036; CAP-040 | source-registry-verified | 2026-10-30 |
| CAP-032 | Analyse Data | Workspace platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-033 | Graphs and Diagrams | Workspace platform | verified | standard | tenant-gate-required | CAP-032; CAP-037 | source-registry-verified | 2026-10-30 |
| CAP-034 | Presentations | Workspace platform | verified | standard | tenant-gate-required | CAP-031; CAP-040 | source-registry-verified | 2026-10-30 |
| CAP-035 | Documents | Workspace platform | verified | standard | tenant-gate-required | CAP-031; CAP-037; CAP-040 | source-registry-verified | 2026-10-30 |
| CAP-036 | Spreadsheets | Workspace platform | verified | standard | tenant-gate-required | CAP-031; CAP-040 | source-registry-verified | 2026-10-30 |
| CAP-037 | Maths | Workspace platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-038 | Sources | Academic integrity | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-039 | Draft It | Workspace platform | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-040 | Files and Notes | Workspace platform | verified | standard | tenant-gate-required | CAP-016; CAP-031 | source-registry-verified | 2026-10-30 |
| CAP-041 | Family | Institutional services | verified | high-risk | not-approved | external:institution-authorized payer relationship and consent; CAP-015 | source-registry-verified | 2026-10-30 |
| CAP-042 | Athletics | Campus experience | verified | standard | tenant-gate-required | CAP-003; CAP-020 | source-registry-verified | 2026-10-30 |
| CAP-043 | Campus Services | Institutional services | verified | controlled | not-approved | external:institution agreement and approved service adapters; CAP-013 | source-registry-verified | 2026-10-30 |
| CAP-044 | Degree Planning | Academic records | verified | controlled | not-approved | external:approved catalog and degree-audit data; CAP-020 | source-registry-verified | 2026-10-30 |
| CAP-045 | Term Deadlines | Academic records | verified | controlled | not-approved | external:authoritative registrar calendar feed; CAP-003 | source-registry-verified | 2026-10-30 |
| CAP-046 | Money | Institutional finance | verified | high-risk | not-approved | external:approved bursar and financial-aid adapters; CAP-043 | source-registry-verified | 2026-10-30 |
| CAP-047 | Meal Plan | Campus services | verified | high-risk | not-approved | external:approved dining or campus-card adapter; CAP-043 | source-registry-verified | 2026-10-30 |
| CAP-048 | Housing | Campus services | verified | high-risk | not-approved | external:approved housing data and transaction adapter; CAP-043 | source-registry-verified | 2026-10-30 |
| CAP-049 | Maps | Campus experience | verified | standard | tenant-gate-required | CAP-003; CAP-020 | source-registry-verified | 2026-10-30 |
| CAP-050 | Registration | Academic records | verified | high-risk | not-approved | external:approved SIS registration adapter and write authorization; CAP-043; CAP-044 | source-registry-verified | 2026-10-30 |
| CAP-051 | Clubs and Activities | Campus graph | verified | controlled | not-approved | external:approved organization and event source; CAP-003 | source-registry-verified | 2026-10-30 |
| CAP-052 | People and Letters | Career platform | verified | standard | tenant-gate-required | CAP-040; CAP-054 | source-registry-verified | 2026-10-30 |
| CAP-053 | Pathway | Lifecycle platform | verified | standard | tenant-gate-required | CAP-040; CAP-054 | source-registry-verified | 2026-10-30 |
| CAP-054 | Career | Career platform | verified | standard | tenant-gate-required | CAP-040 | source-registry-verified | 2026-10-30 |
| CAP-055 | Applications | Career platform | verified | standard | tenant-gate-required | CAP-003; CAP-040; CAP-054 | source-registry-verified | 2026-10-30 |
| CAP-056 | Check the Writing | Academic integrity | verified | standard | tenant-gate-required | — | source-registry-verified | 2026-10-30 |
| CAP-057 | Video Call | Communication platform | verified | controlled | not-approved | external:approved signaling and meeting provider configuration | source-registry-verified | 2026-10-30 |
| CAP-058 | Group Work | Collaboration platform | verified | controlled | not-approved | external:authenticated collaboration and synchronization service; CAP-020 | source-registry-verified | 2026-10-30 |
| CAP-059 | Email | Communication platform | verified | controlled | not-approved | external:approved Google or Microsoft mail connection; CAP-013 | source-registry-verified | 2026-10-30 |
| CAP-060 | Chat | Communication platform | verified | controlled | not-approved | external:authenticated messaging backend and institution membership source; CAP-020 | source-registry-verified | 2026-10-30 |

## 30-day M1/M2 execution program

### Week 1: Establish product truth and close critical M1 gaps.

- Audit repository and deployment
- Publish the Product Status Map from executable sources
- Close critical auth, persistence, tenant/RLS, secrets, and claims gaps
- Stand up the evidence vault and capability register

**Exit evidence:** Current branch, deployment target, backend, open gaps, owners, and evidence paths are reviewable in one place.

### Week 2: Finish the bounded M2 workflow.

- Finish Today, Path, term planning, conflicts, backups, advisor agenda, source labels, feedback, and support path
- Test keyboard, mobile, screen-reader basics, slow network, errors, stale sources, export/deletion, and cross-tenant access

**Exit evidence:** The M1/M2 acceptance matrix passes locally and manual accessibility/security observations are stored.

### Week 3: Validate with 10-20 student design partners.

- Observe the complete workflow
- Fix the three highest-impact failures
- Create the Registration Readiness Pilot page and packet

**Exit evidence:** Consent-aware research notes, issue ranking, fixes, and honest limitations are stored.

### Week 4: Run a concierge pilot and recruit an institutional champion.

- Measure onboarding, Path Snapshot, plan saved, conflict resolved, backups, agenda creation, clarity, and advisor feedback
- Publish a short outcome report with limitations

**Exit evidence:** A signed-off outcome report contains denominators, limitations, incidents, accessibility findings, and next decision.

## Not now

- Full SIS replacement
- Full native LMS replacement
- Official registration writes
- Gradebook passback
- Financial aid
- Institutional tuition or payment processing
- Payroll, HR, procurement, or general ledger
- Housing contracts or meal-plan transactions
- Health, counseling, conduct, diagnosis, or emergency workflows
- Parent or guardian access
- Student risk scoring or surveillance
- Marketplace payouts or funds custody
- Broad social feed
- Autonomous AI writes
- Deep enterprise integrations before core pilot proof

These are sequenced, not rejected. Their primitives and activation contracts may be designed, but operational implementation waits for evidence, a design partner, specialist ownership, and funded scope.

## Admission rule

> Does this make one student decision clearer, one institutional workflow safer, or one shared platform primitive stronger?

If the answer is none of the three, do not build it yet.

## Evidence and operating links

- [Product Status Map](PRODUCT-STATUS-MAP.md)
- [L9 Capability Readiness](L9-CAPABILITY-READINESS.md)
- [Master Launch Readiness Register](MASTER-LAUNCH-READINESS-REGISTER.md)
- [Evidence Register](EVIDENCE-REGISTER.md)
- [Trust Evidence Register](trust/EVIDENCE-REGISTER.md)
- [Milestones 1 and 2 evidence](MILESTONE-1-2-EVIDENCE.md)
- [M1/M2 automated verification — 30 September 2026](evidence/m1-m2/2026-09-30-automated-verification.md)
- [Roadmap audit](ROADMAP-AUDIT.md)
- [Product implementation status](IMPLEMENTATION_STATUS.md)
- [Interactive dashboard](../ops/master-plan/index.html)
