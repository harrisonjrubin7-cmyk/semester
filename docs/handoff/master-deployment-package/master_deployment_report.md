# Semester master deployment report

Generated 2026-10-11. Historical snapshot plus proposed rollout contract. No fresh deployment audit, repository mutation or application test performed.

## Six-status scorecard
|Domain|Implemented|Tested|Deployed|Authorized|Enabled|
|---|---|---|---|---|---|
|Identity and onboarding|Partial|Account-sync required check|Hosted PWA (signed-in sync)|No|No|
|Planning and degree|Partial|Not evidenced|Hosted PWA (seed data)|No|No|
|Registration|Server code, not release-ready|Server tests|No tenant|No|No|
|Courses and teaching|Partial|Not evidenced|Hosted PWA (personal courses)|No|No|
|Assignments and work|Partial (per-row tasks only)|Calendar keyboard/open-calendar tests|Hosted PWA (device-first)|No|No|
|Study and tutoring|Client-only/mock + partial|Not evidenced|Hosted PWA|No|No|
|Grades and progress|Server code, not release-ready|Server tests|No tenant|No|No|
|Advising and support|Partial|Not evidenced|No staffed route|No|No|
|Career and portfolio|Client-only/mock|Not evidenced|Hosted PWA (local)|No|No|
|Campus and community|Partial|Community.test.tsx|Hosted PWA|No|No|
|Housing, dining, services|Partial|Not evidenced|Hosted PWA|No|No|
|Money and finance|Partial|Billing live-acceptance evidence|Checkout held|No|No|
|Institution OS|Server code, not release-ready|Server tests|No tenant; gateway configuration dependency|No|No|
|Company OS|Documents|Not evidenced|Not evidenced|No|No|
|Developer and partner|None found|Not evidenced|Not evidenced|No|No|
|Governed AI|Partial (ungoverned)|Not gated|Hosted shared-key function|No|No|

Designed: Prototype for all domains. Institution-authorized N/A requires accepted rationale for personal/company-internal scope. Flag count: source enumeration 28 vs screenshot 21, not live state.

## Twenty shared checks
### G-DES-01 — Designed
Execute: Review every required journey and role against accepted scope.
Expected: All required states/actions covered; omissions held.
Evidence: Journey/state matrix.

### G-DES-02 — Designed
Execute: Review keyboard/focus/error/responsive/consequence designs.
Expected: Accessible semantics and consequences accepted.
Evidence: Design review.

### G-IMP-01 — Implemented
Execute: Trace mutations UI→authorization→durable store.
Expected: Runtime connected; required mock substitute absent; audit/receipt wired.
Evidence: Route/service trace.

### G-IMP-02 — Implemented
Execute: Forge tenant/owner/identity/scope on every entry point.
Expected: Denied without protected metadata or mutation.
Evidence: Authorization negative report.

### G-IMP-03 — Implemented
Execute: Restart/refresh and read committed entities across devices.
Expected: Canonical state/version/provenance preserved.
Evidence: Persistence report.

### G-TST-01 — Tested
Execute: Run all applicable cases against candidate and fixtures.
Expected: All blocking cases pass; skipped/unbound not pass.
Evidence: Run IDs/logs.

### G-TST-02 — Tested
Execute: Qualified AT/keyboard/reflow review of complete journeys.
Expected: Applicable criteria accepted after retest.
Evidence: Accessibility report.

### G-TST-03 — Tested
Execute: Independent security assessment and blocker rescan.
Expected: No open launch-blocking finding.
Evidence: Assessor report.

### G-DEP-01 — Deployed
Execute: Read actual build/commit/config/schema.
Expected: Approved target and candidate match.
Evidence: Deployment manifest.

### G-DEP-02 — Deployed
Execute: Exercise authorized/denied actual-target journeys.
Expected: Persistence/denials/callbacks/queues correct.
Evidence: Target smoke report.

### G-DEP-03 — Deployed
Execute: Test old/new app/functions with expanded database.
Expected: N-1 rollback compatible.
Evidence: Compatibility report.

### G-AUT-01 — Institution-authorized
Execute: Validate target/cohort/data/operation approval and reviewers.
Expected: All authority current and scope-matched.
Evidence: Approval references.

### G-AUT-02 — Institution-authorized
Execute: Withdraw/expire approval; attempt activation.
Expected: Fail closed; no scope fallback.
Evidence: Gate negative report.

### G-AUT-03 — Institution-authorized
Execute: Run customer UAT and inspect acceptance.
Expected: Authorized approver accepts exact scope/limitations.
Evidence: Customer UAT.

### G-PRD-01 — Production-enabled
Execute: Attempt use outside tenant/cohort/operation.
Expected: Denied in server/direct API/worker.
Evidence: Eligibility report.

### G-PRD-02 — Production-enabled
Execute: Kill active risk feature; attempt dispatch.
Expected: Blocked within accepted measured bound.
Evidence: Kill drill.

### G-PRD-03 — Production-enabled
Execute: Restore isolated DB plus matched objects/config.
Expected: Checksums/policies/provenance/read pass; RTO/RPO measured.
Evidence: Recovery record.

### G-PRD-04 — Production-enabled
Execute: Page unavailable primary and backup.
Expected: Acknowledgement/escalation meets accepted policy.
Evidence: Operated drill.

### G-PRD-05 — Production-enabled
Execute: Export/delete/revoke/offboard including holds.
Expected: Complete policy-correct result; caches/queues handled.
Evidence: Privacy drill.

### G-PRD-06 — Production-enabled
Execute: Observe approved operating window/outcome denominators.
Expected: SLO/error-budget/outcome/stop criteria accepted.
Evidence: Pilot closeout.

## Domain approval requirements
### D01 Identity and onboarding
Proposed roles: Identity, Security, Privacy; named owners UNASSIGNED.
Supplements: Account lifecycle; SSO/SCIM mapping; consent/retention.
Scenarios: Cross-device persistence;Forged identity denial;SSO deactivation;Export/erasure/legal hold;Interrupted sync retry;Scoped share revocation.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D02 Planning and degree
Proposed roles: Academic engineering, Registrar; named owners UNASSIGNED.
Supplements: Versioned catalogs; requirements fixtures; transfer/exception rules.
Scenarios: Nested prerequisites;Catalog-year change;Transfer/substitution;Schedule conflicts;Record access revocation;Official audit reconciliation.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D03 Registration
Proposed roles: Registration engineering, Registrar; named owners UNASSIGNED.
Supplements: SIS contract; transaction state machine; override authority.
Scenarios: Last-seat race;Idempotent replay;Timeout after commit;Eligibility change;Swap failure;Kill queued commands.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D04 Courses and teaching
Proposed roles: Learning engineering, Faculty; named owners UNASSIGNED.
Supplements: Publishing model; syllabus fixtures; enrollment access; course AI policy.
Scenarios: Draft visibility;Roster removal;Conflicting syllabus extraction;TA capabilities;Import conversion;Archive/export.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D05 Assignments and work
Proposed roles: Productivity engineering, Faculty; named owners UNASSIGNED.
Supplements: Submission state machine; timezone rules; files/docs; offline and nested-tab contracts.
Scenarios: Canonical deadline;Interrupted submission;Offline conflicts;Stable nested-tab links;Selective sharing;Tree keyboard navigation.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D06 Study and tutoring
Proposed roles: Learning engineering, Tutoring operations; named owners UNASSIGNED.
Supplements: Approved-source evals; tutor/booking policy; staffed escalation.
Scenarios: Grounded answers;Retrieved prompt injection;Course AI restriction;Booking race;Timezone reschedule;Tutor escalation.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D07 Grades and progress
Proposed roles: Gradebook engineering, Faculty, Registrar; named owners UNASSIGNED.
Supplements: Grading fixtures; release matrix; passback/correction procedure.
Scenarios: Weighted grade fixtures;Unauthorized release;Passback replay/order;Approved corrections;Private/official labels;N-1 compatibility.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D08 Advising and support
Proposed roles: Advising, Support, Privacy; named owners UNASSIGNED.
Supplements: Caseload/consent matrix; referral taxonomy; sensitive exclusions; rota.
Scenarios: Caseload denial;Share expiry;Case reassignment;Backup escalation;Sensitive record exclusion;Referral closeout/export.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D09 Career and portfolio
Proposed roles: Career engineering, Career services; named owners UNASSIGNED.
Supplements: Portfolio schema; postings; credential authority; employer controls.
Scenarios: Selective publication;Employer revoke;Posting review;Export fidelity;Credential tampering;Mentor deauthorization.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D10 Campus and community
Proposed roles: Community engineering, Trust and Safety; named owners UNASSIGNED.
Supplements: Moderation/appeals; safety escalation; campus source owners.
Scenarios: Nonmember denial;Block consistency;Report escalation;Appeals;Event changes;Safe pseudonymity rollback.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D11 Housing, dining, services
Proposed roles: Campus services, Providers; named owners UNASSIGNED.
Supplements: Provider mappings; allocation/fulfillment; entitlements/refunds.
Scenarios: Allocation race;Duplicate orders;Provider uncertain outcome;Kill with refund path;Residence privacy;Database/file restore.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D12 Money and finance
Proposed roles: Finance engineering, Finance, Counsel; named owners UNASSIGNED.
Supplements: Money flow; accepted price book; tax/accounting; processor/ledger controls.
Scenarios: Webhook replay/order;Renewal failure;Refund/dispute;Financial owner forgery;Provider/ERP reconcile;Checkout approval denial.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D13 Institution OS
Proposed roles: Institution engineering, Customer IT; named owners UNASSIGNED.
Supplements: Tenant/data map; migration/cutover; UAT; responsibility matrix.
Scenarios: Provision/deprovision;Two-person approval;Workflow retry;Dual run;Core held mode;Offboarding.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D14 Company OS
Proposed roles: Founder, Finance, Counsel, Operations; named owners UNASSIGNED.
Supplements: Entity/signing; actuals; agreements; insurance decision; staffed ownership.
Scenarios: Quote change reapproval;Invoice reconciliation;Student-record denial;Monthly close;Backup paging;Claim approval.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D15 Developer and partner
Proposed roles: Platform engineering, Partner operations; named owners UNASSIGNED.
Supplements: API/scopes; SDK sample; webhook contract; partner/security review.
Scenarios: Token/scope denial;Webhook forgery/replay;Sandbox separation;Key revoke;Version compatibility;Scope expansion approval.
All applicable shared gates required; scope/approver/expiry/target unresolved.

### D16 Governed AI
Proposed roles: AI engineering, Security, Privacy; named owners UNASSIGNED.
Supplements: AI inventory; provider/model/tool policy; eval/red-team; incident ladder.
Scenarios: All-callsite gateway;Restricted-data denial;Injection/action denial;Budget race;Global/tenant kill;Invalid citations.
All applicable shared gates required; scope/approver/expiry/target unresolved.

## Shared blockers
Candidate/target uncertainty; incomplete all-entry authorization/isolation; local/blob/duplicate authority; unwired adapters/async reconciliation; AI bypass/broker/evals; qualified accessibility acceptance; unstaffed support/paging; unproved recovery/privacy; customer/commercial authority; stale inventories and claim conflicts.

## Artifacts
- A01 Product model: Scope; parity; critical journeys. Sign-off: Product/domain authority.
- A02 User screens: Roles/states; responsive; accessibility; consequences. Sign-off: Design/accessibility.
- A03 Data model: Canonical schema; authority; provenance; classification; retention. Sign-off: Data/Privacy.
- A04 Workflows: Commands/events; retries; approvals; compensation. Sign-off: Engineering/domain authority.
- A05 Policy controls: Hierarchy; enforcement; holds; kills. Sign-off: Security/Privacy.
- A06 Roles/capabilities: Least privilege; consent; expiry; revocation. Sign-off: Security/customer IT.
- A07 Audit: Integrity; event contract; access; retention. Sign-off: Security/domain auditor.
- A08 Support: Queue; staff/backup; escalation; articles; drills. Sign-off: Support.
- A09 Monitoring/SLO: Metrics; traces; sanitized logs; alerts; accepted targets. Sign-off: Reliability.
- A10 Documentation: User/admin/developer/operator guides; limitations. Sign-off: Product/Operations.
- A11 Test plan: Fixtures; runner bindings; negative/concurrency/recovery cases. Sign-off: QA/reviewers.
- A12 Release gate: SHA/deployment/config/schema/cohort/operation/evidence. Sign-off: Release authority.
- A13 Migration/rollback: Expand-contract; dual run; cutover; compensation; restore. Sign-off: Engineering/customer IT.
- A14 Commercial: Pricing/signing/payment/tax/insurance/terms. Sign-off: Finance/counsel.
- A15 Customer success: Training; baseline; outcomes; closeout; reference permission. Sign-off: Success/customer sponsor.
- A16 Operating owner: Named accountable/implementation/acceptance/backup. Sign-off: Founder/Operations.

# Structured deployment and domain approval runbook
Status: proposed; nothing deployed or approved. Evidence snapshot is historical. Named signers and live targets unresolved.

## Ownership
Each domain needs named accountable owner, implementer, acceptance authority and backup. Role suggestions in domain_audit.csv are not appointments. Professional/customer acceptance cannot be substituted by generated templates. Private approvals stay in controlled evidence storage.

## Gate sequence
1. Scope: reconcile all 16 domains to granular capabilities; preserve broader institutional ambitions.
2. Baseline: pin exact candidate and actual hosting/API/functions/workers/DB/storage targets.
3. Evidence: bind every check to fixture version, runner, run ID, logs, reviewer, expiry and scope.
4. Implement: canonical durable data, least privilege, source authority, audit, retries and compensation.
5. Verify: functional/negative/concurrency/offline/AT/security/recovery/domain cases.
6. Deploy dark: additive migration rehearsal; N-1 compatibility; flags off; target smoke.
7. Accept: applicable professional/commercial/customer paper and UAT; accepted N/A rationale if valid.
8. Activate: exact tenant/cohort/operation, staffed support, alerts, measured kill/restore.
9. Observe: required pilot/dual-run window, complete outcome denominators and authority acceptance.

## Candidate manifest
SHA; deployment; build/config digest; schema fingerprint; migration checksums; functions/workers; object backup version; policy and flag versions; target/tenant/cohort/operations; approvers; validity; known-good predecessor; compatibility evidence. Never include secret values.

## Stop conditions
Stop affected operations for leaks, unauthorized official/financial writes, identity disclosure, corruption, missing approval/coverage, failed reconciliation or breached accepted thresholds. Blank numerical thresholds block activation; no fabricated SLA/RTO/RPO.

## Rollback
Declare scope -> server kill -> verify direct API/worker denial -> pause/checkpoint producers/consumers -> quarantine uncertain in-flight outcomes -> scoped policy off/cache invalidation -> independently restore compatible page/API/functions/workers -> reconcile external source outcomes -> approved forward schema repair or isolated recovery -> restore matching file bytes and access state -> reconcile post-backup writes/revocations -> retest -> fresh acceptance -> bounded reactivation.
Keep refunds/cancellations available only through separately authorized remediation. Never replay irreversible commands blindly. Do not delete queues/receipts or wipe drafts. App rollback is not database/external-record/object restore.

## Host caveats
Retrieved ROLLBACK.md describes GitHub Pages and separate functions; canonical host must be verified before using Vercel controls. Inspect Supabase Branching and migration ledger because automation outside repo workflows may apply schema. Build-time flags require rebuild/redeploy; server runtime policies must remain effective on prior client versions. Supabase DB backups do not include Storage object bytes. Restore can reintroduce old grants; current revocations must be reconciled.

## Closure evidence
Exact accepted artifact IDs; all required executed test IDs; actual-target manifest; current approvals; named primary/backup and acknowledgement drill; kill/restore/rollback/privacy/offboarding records; completed dual-run/outcome gates. Decision stays HOLD while evidence missing/stale/withdrawn/mismatched.

## Verification-script mapping
Existing account-sync, rollback, RLS/grants/definer checks and domain tests must be recovered from actual repository scripts and bound to candidate runs; names in historical evidence do not prove execution. evidence_gate.py is a local reference checker, not authentication or source-signature verification. All CSV application checks NOT RUN; runners UNBOUND. No exact shell command is invented for unknown app interfaces.

## Source basis
User Completion register screenshot; prior GitHub reads of GO-NO-GO-DECISION.md, PRODUCT_LIVE_STATUS.md, COMPLETE_CAPABILITY_REGISTER.md, flags.ts and ROLLBACK.md. Project docs/native-platform/NATIVE_AUTHORITY_GATES.md defines sixteen artifact categories and authority gates. These sources do not establish current runtime or signed approval.
