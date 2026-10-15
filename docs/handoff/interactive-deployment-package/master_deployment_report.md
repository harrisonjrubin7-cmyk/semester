# Semester master deployment scorecard

Local planning package generated 2026-10-11; not current runtime assurance. Baseline from screenshot and historical repo assessment. All six maturity facts remain independent. No deployment or approvals executed.

## Audit
|Domain|Implementation|Test evidence|Deployment|
|---|---|---|---|
|Identity and onboarding|Partial|Account-sync required check|Hosted PWA (signed-in sync)|
|Planning and degree|Partial|Not evidenced|Hosted PWA (seed data)|
|Registration|Server code, not release-ready|Server tests|No tenant|
|Courses and teaching|Partial|Not evidenced|Hosted PWA (personal courses)|
|Assignments and work|Partial (per-row tasks only)|Calendar keyboard/open-calendar tests|Hosted PWA (device-first)|
|Study and tutoring|Client-only/mock + partial|Not evidenced|Hosted PWA|
|Grades and progress|Server code, not release-ready|Server tests|No tenant|
|Advising and support|Partial|Not evidenced|No staffed route|
|Career and portfolio|Client-only/mock|Not evidenced|Hosted PWA (local)|
|Campus and community|Partial|Community.test.tsx|Hosted PWA|
|Housing, dining, services|Partial|Not evidenced|Hosted PWA|
|Money and finance|Partial|Billing live-acceptance evidence|Checkout held|
|Institution OS|Server code, not release-ready|Server tests|No tenant; gateway dependency|
|Company OS|Documents|Not evidenced|Not evidenced|
|Developer and partner|None found|Not evidenced|Not evidenced|
|Governed AI|Partial (ungoverned)|Not gated|Hosted shared-key function|

All designed = Prototype; institution-authorized = No; production-enabled = No in baseline. Legitimate N/A requires accepted rationale and is not implemented as a shortcut in the tracker.

## Twenty shared rules
### G-DES-01 Journey and role coverage — Designed
Procedure: Review all required roles, journeys and states against accepted scope.
Expected: All required states/actions covered; omissions held.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-DES-02 Accessible interaction specification — Designed
Procedure: Review keyboard/focus/errors/responsive behavior and consequence copy.
Expected: Semantics and consequences accepted.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-IMP-01 Runtime trace — Implemented
Procedure: Trace mutations from UI through authorization to durable store.
Expected: No required mock substitute; audit and receipts wired.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-IMP-02 Authorization negatives — Implemented
Procedure: Forge identity, tenant, owner and scopes across API/RPC/functions/workers.
Expected: Denied without restricted metadata or mutation.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-IMP-03 Durability — Implemented
Procedure: Restart/refresh/read committed entities across devices.
Expected: Canonical state/version/provenance preserved.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-TST-01 Executed suite — Tested
Procedure: Run all applicable candidate-bound cases with approved fixtures.
Expected: Blocking cases pass; skipped/unbound cases not credited.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-TST-02 Qualified accessibility — Tested
Procedure: Evaluate complete journeys with keyboard, AT and reflow.
Expected: Applicable criteria accepted after remediation/retest.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-TST-03 Independent security — Tested
Procedure: Assess candidate and rescan blockers.
Expected: No open launch-blocking finding.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-DEP-01 Actual target identity — Deployed
Procedure: Inspect actual build, commit, configuration and schema fingerprints.
Expected: Match approved candidate and target.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-DEP-02 Target smoke — Deployed
Procedure: Exercise allowed/denied journeys and callbacks/queues.
Expected: Correct target persistence and denial behavior.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-DEP-03 N-1 compatibility — Deployed
Procedure: Test prior/new apps/functions with expanded database.
Expected: Planned rollback compatible.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-AUT-01 Scope-matched authority — Institution-authorized
Procedure: Inspect target/cohort/data/operations/approvers and approval validity.
Expected: All applicable authority current and scope-matched.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-AUT-02 Withdrawn authority denial — Institution-authorized
Procedure: Expire/withdraw acceptance and attempt activation.
Expected: Fail closed without scope widening.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-AUT-03 Customer UAT — Institution-authorized
Procedure: Execute UAT and inspect customer acceptance.
Expected: Authorized reviewer accepts exact scope and limitations.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-PRD-01 Eligibility boundaries — Production-enabled
Procedure: Attempt operation outside approved tenant/cohort/operation.
Expected: Server/direct API/worker denies.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-PRD-02 Kill propagation — Production-enabled
Procedure: Engage kill and attempt fresh dispatch.
Expected: Blocked within accepted measured bound.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-PRD-03 Restore integrity — Production-enabled
Procedure: Restore isolated DB plus matching objects/config.
Expected: Checksums/policies/read pass; RTO/RPO measured.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-PRD-04 Staffed response — Production-enabled
Procedure: Page unavailable primary and backup.
Expected: Accepted acknowledgement and escalation operate.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-PRD-05 Rights and offboarding — Production-enabled
Procedure: Export/delete/revoke/offboard including holds and caches.
Expected: Complete policy-correct result.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

### G-PRD-06 Operated observation — Production-enabled
Procedure: Observe agreed window and reconcile outcome denominators.
Expected: Accepted service/outcome/stop criteria met.
Status: NOT RUN; runner UNBOUND. Retain target, fixture, run, approver and expiry.

## Domain scenarios
### D01 Identity and onboarding
Proposed roles: Identity / Security / Privacy; named owners unresolved.
- D01-FLOW-01: Cross-device persistence
- D01-FLOW-02: Forged identity denial
- D01-FLOW-03: SSO deactivation
- D01-FLOW-04: Export/erasure/legal hold
- D01-FLOW-05: Interrupted sync retry
- D01-FLOW-06: Scoped-share revocation

### D02 Planning and degree
Proposed roles: Academic engineering / Registrar; named owners unresolved.
- D02-FLOW-01: Nested prerequisites
- D02-FLOW-02: Catalog-year changes
- D02-FLOW-03: Transfer/substitution
- D02-FLOW-04: Schedule conflicts
- D02-FLOW-05: Record-access revocation
- D02-FLOW-06: Official audit reconciliation

### D03 Registration
Proposed roles: Registration engineering / Registrar; named owners unresolved.
- D03-FLOW-01: Last-seat race
- D03-FLOW-02: Idempotent replay
- D03-FLOW-03: Timeout after source commit
- D03-FLOW-04: Eligibility change
- D03-FLOW-05: Swap failure
- D03-FLOW-06: Kill queued commands

### D04 Courses and teaching
Proposed roles: Learning engineering / Faculty; named owners unresolved.
- D04-FLOW-01: Draft/published visibility
- D04-FLOW-02: Roster removal
- D04-FLOW-03: Conflicting syllabus extraction
- D04-FLOW-04: TA capabilities
- D04-FLOW-05: Import conversion
- D04-FLOW-06: Archive/export

### D05 Assignments and work
Proposed roles: Productivity engineering / Faculty; named owners unresolved.
- D05-FLOW-01: Canonical deadline propagation
- D05-FLOW-02: Interrupted submission
- D05-FLOW-03: Offline conflicts
- D05-FLOW-04: Stable nested-tab links
- D05-FLOW-05: Selective sharing
- D05-FLOW-06: Tree keyboard navigation

### D06 Study and tutoring
Proposed roles: Learning engineering / Tutoring operations; named owners unresolved.
- D06-FLOW-01: Source-grounded answers
- D06-FLOW-02: Retrieved prompt injection
- D06-FLOW-03: Course AI restrictions
- D06-FLOW-04: Booking race
- D06-FLOW-05: Timezone reschedule
- D06-FLOW-06: Tutor escalation

### D07 Grades and progress
Proposed roles: Gradebook engineering / Faculty / Registrar; named owners unresolved.
- D07-FLOW-01: Weighted-grade fixtures
- D07-FLOW-02: Unauthorized release
- D07-FLOW-03: Passback replay/order
- D07-FLOW-04: Approved corrections
- D07-FLOW-05: Private/official labels
- D07-FLOW-06: N-1 compatibility

### D08 Advising and support
Proposed roles: Advising / Support / Privacy; named owners unresolved.
- D08-FLOW-01: Caseload denial
- D08-FLOW-02: Share expiry
- D08-FLOW-03: Case reassignment
- D08-FLOW-04: Backup escalation
- D08-FLOW-05: Sensitive-record exclusion
- D08-FLOW-06: Referral closeout/export

### D09 Career and portfolio
Proposed roles: Career engineering / Career services; named owners unresolved.
- D09-FLOW-01: Selective publication
- D09-FLOW-02: Employer-share revocation
- D09-FLOW-03: Posting review
- D09-FLOW-04: Export fidelity
- D09-FLOW-05: Credential tampering
- D09-FLOW-06: Mentor deauthorization

### D10 Campus and community
Proposed roles: Community engineering / Trust and Safety; named owners unresolved.
- D10-FLOW-01: Nonmember denial
- D10-FLOW-02: Block consistency
- D10-FLOW-03: Report escalation
- D10-FLOW-04: Appeals
- D10-FLOW-05: Event changes
- D10-FLOW-06: Privacy-safe pseudonymity rollback

### D11 Housing, dining, services
Proposed roles: Campus services / Providers; named owners unresolved.
- D11-FLOW-01: Allocation race
- D11-FLOW-02: Duplicate orders
- D11-FLOW-03: Provider uncertain outcome
- D11-FLOW-04: Kill with refund path
- D11-FLOW-05: Residence privacy
- D11-FLOW-06: Database/file restore

### D12 Money and finance
Proposed roles: Finance engineering / Finance / Counsel; named owners unresolved.
- D12-FLOW-01: Webhook replay/order
- D12-FLOW-02: Renewal failure
- D12-FLOW-03: Refund/dispute
- D12-FLOW-04: Financial-owner forgery
- D12-FLOW-05: Provider/ERP reconciliation
- D12-FLOW-06: Checkout-approval denial

### D13 Institution OS
Proposed roles: Institution engineering / Customer IT; named owners unresolved.
- D13-FLOW-01: Provision/deprovision
- D13-FLOW-02: Two-person approval
- D13-FLOW-03: Workflow retry
- D13-FLOW-04: Dual run
- D13-FLOW-05: Core held mode
- D13-FLOW-06: Offboarding

### D14 Company OS
Proposed roles: Founder / Finance / Counsel / Operations; named owners unresolved.
- D14-FLOW-01: Quote-change reapproval
- D14-FLOW-02: Invoice reconciliation
- D14-FLOW-03: Student-record denial
- D14-FLOW-04: Monthly close
- D14-FLOW-05: Backup paging
- D14-FLOW-06: Claim approval

### D15 Developer and partner
Proposed roles: Platform engineering / Partner operations; named owners unresolved.
- D15-FLOW-01: Token/scope denial
- D15-FLOW-02: Webhook forgery/replay
- D15-FLOW-03: Sandbox separation
- D15-FLOW-04: Key revocation
- D15-FLOW-05: Version compatibility
- D15-FLOW-06: Scope-expansion approval

### D16 Governed AI
Proposed roles: AI engineering / Security / Privacy; named owners unresolved.
- D16-FLOW-01: All-callsite gateway
- D16-FLOW-02: Restricted-data denial
- D16-FLOW-03: Injection/action denial
- D16-FLOW-04: Budget race
- D16-FLOW-05: Global/tenant kill
- D16-FLOW-06: Invalid citations

## Rollback triggers
- Tenant leak / restricted disclosure: Hold affected operations; preserve safe evidence; incident escalation.
- Unauthorized official or financial write: Hold fresh writes; checkpoint queues; reconcile committed outcomes.
- Data corruption / failed reconciliation: Hold writes; isolate repair/restore; reconcile object bytes and external records.
- Withdrawn / expired authority: Hold affected scope; fresh authority required before resume.
- AI gateway/policy bypass: Hold AI dispatch across entry points; settle budgets and investigate.
- Pseudonymous identity disclosure: Hold affected surface; privacy-safe review, never reveal names as fallback.
- Missing support / alerts / backup: Hold activation or expansion; restore operated coverage.
- Accepted service threshold breached: Hold affected feature; diagnose against populated accepted threshold.

## Deployment runbook
Pin candidate; verify actual hosting/API/functions/workers/database/object targets; bind configuration/schema/policy versions; rehearse additive migrations and N-1 compatibility; deploy dark; execute actual-target smoke/negative tests; accept professional/customer scope; activate named cohort; monitor and complete required dual-run/operated observation.
Rollback: server kill -> direct API/worker denial -> checkpoint queues -> reconcile in-flight transactions -> scoped policy/cache hold -> compatible app/functions/worker rollback -> separate DB/object repair -> reconcile current revocations and post-backup writes -> retest -> fresh authority -> bounded resume.
Actual ROLLBACK.md described Pages and Edge Functions, not proof that Vercel is canonical. App rollback does not undo schema, external records or object bytes. DB backups do not include Storage object bytes. Build-time flags need redeployment. No blind identity revelation or Core-to-stale-Connect fallback. No numerical SLA/RTO/RPO invented.

## Approval artifacts and verification bindings
Every domain: product model; screens; data model; workflows; policy; roles/capabilities; audit; support; monitoring/SLO; docs; test plan; release gate; migration/rollback; commercial model; success model; named operating owner/backup. Signed papers and confidential reports remain in private evidence storage. Bind actual account-sync/RLS/grants/definer/rollback/domain runners rather than inventing commands. Existing code paths/tests require current inspection before integration.

## Shared blockers
Candidate/target uncertainty; incomplete all-entrypoint authorization; local/blob/duplicate authority; unwired adapters/outbox/reconciliation; AI bypass/broker/eval gaps; qualified accessibility acceptance; support/paging staffing; actual recovery/privacy drills; customer/commercial authority; stale inventories/claims. Source flag count 28 vs screenshot 21 must be reconciled; neither count establishes runtime activation.

## Interactive prototype
No network requests or production changes. Evidence is self-reported. All shared and scenario records need pass, reference, reviewer, issued/expiry time and exact target binding. Owners/backup and manifest required. Simulation sets local held state; a complete local review is not real authority. State persists only after Save local state; JSON export/import available. Do not store sensitive data. UTC datetime inputs explicitly interpreted as UTC. Browser accessibility/functionality not tested.

## Source boundary
User screenshot; prior retrieved GitHub GO-NO-GO-DECISION.md, PRODUCT_LIVE_STATUS.md, COMPLETE_CAPABILITY_REGISTER.md, flags.ts and ROLLBACK.md; project native authority gates. Historical assessment dates 2026-10-03/04 do not prove current deployment. Designed term-long/two-term authority gates remain evidence requirements, not completed claims.
