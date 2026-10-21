# Semester sixteen-domain completion kit

Generated 2026-10-11. Planning and reference implementation package, not completed Semester production software.

## Audit table

|Domain|Implemented|Tested|Deployed|Authorized|Enabled|Packages in screenshot|
|---|---|---|---|---|---|---|
|Identity and onboarding|Partial|Account-sync required check|Hosted PWA (signed-in sync)|No|No|3|
|Planning and degree|Partial|Not evidenced|Hosted PWA (seed data)|No|No|5|
|Registration|Server code, not release-ready|Server tests (per register §3)|No tenant|No|No|6|
|Courses and teaching|Partial|Not evidenced|Hosted PWA (personal courses)|No|No|5|
|Assignments and work|Partial (per-row only for tasks)|Calendar keyboard + open-cal tests|Hosted PWA (device-first)|No|No|5|
|Study and tutoring|Client-only/mock + partial|Not evidenced|Hosted PWA|No|No|9|
|Grades and progress|Server code, not release-ready|Server tests|No tenant|No|No|5|
|Advising and support|Partial|Not evidenced|No staffed route|No|No|6|
|Career and portfolio|Client-only/mock|Not evidenced|Hosted PWA (local)|No|No|7|
|Campus and community|Partial|Community.test.tsx|Hosted PWA|No|No|7|
|Housing, dining, services|Partial|Not evidenced|Hosted PWA|No|No|7|
|Money and finance|Partial|Billing live-acceptance evidence|Checkout held|No|No|8|
|Institution OS|Server code, not release-ready|Server tests|No tenant (VITE_UNIVERSITY_GATEWAY_URL)|No|No|6|
|Company OS|Documents|—|—|No|No|8|
|Developer and partner|None found|—|—|No|No|10|
|Governed AI|Partial (ungoverned)|Not gated|Hosted (shared-key function)|No|No|9|

Designed is Prototype for all sixteen. Package counts are screenshot counts; task identities remain to be recovered.

## Green criteria
Designed: complete accepted journeys/states/roles/accessibility. Implemented: canonical durable runtime and policy enforcement. Tested: applicable executed candidate-bound tests accepted. Deployed: actual target/config/schema match. Institution-authorized: exact scoped customer/professional authority or explicit accepted N/A. Production-enabled: eligible activation with staffed support, alerts, recovery and reconciliation. Never infer one column from another.

## Shared blockers
- B01 Unverified candidate and hosted target: Pin exact release; map hosting/service/DB targets; collect fingerprints. Owner: Engineering / Release.
- B02 Incomplete server authorization and tenant negatives: Enforce PDP at every entry; DB grants/definers/runtime-role review; negative suites. Owner: Security / Backend.
- B03 Local/blob/duplicate record paths: Canonical per-entity storage; migration; governed offline recovery; retire duplicates. Owner: Data / Product.
- B04 Adapters and async execution not proven live: Approved adapters; outbox publisher; DLQ; health/reconcile; source authority. Owner: Integrations.
- B05 AI bypass and absent runtime broker/evaluation gates: Single policy gateway; broker; budget; classification; all-callsite tests. Owner: AI / Security.
- B06 Qualified accessibility acceptance absent in baseline: Manual AT and complete-journey review; remediation/retest; accurate ACR. Owner: Accessibility.
- B07 Staffing, support and paging not evidenced: Named primary and backup; actual alert delivery and drills. Owner: Operations.
- B08 Recovery/rollback/privacy operation not proved for candidate: Rehearse N-1 compatibility; database+objects restore; rights/offboarding. Owner: Reliability / Privacy.
- B09 Institution/commercial authority and claim conflicts: Resolve executed papers and authority; scope UAT; no unsupported claims. Owner: Founder / Counsel / Customer.
- B10 Registers stale or inconsistent: Reconcile 21 screenshot flags with 28 source entries; broader inventories; timestamp evidence. Owner: Product / Engineering.

## Artifacts
- A01: Product model — Capability boundaries; included/excluded subdomains; critical journeys; parity inventory. Approver: Product and domain authority.
- A02: User screens — All roles/states; responsive screens; consequence copy; accessibility specification. Approver: Design and accessibility.
- A03: Data model — Canonical schema; authority; classification; provenance; version; retention; portability. Approver: Data and Privacy.
- A04: Workflows — Commands/events; state machines; retries; human approvals; compensation. Approver: Engineering and domain authority.
- A05: Policy controls — Policy hierarchy; gateway enforcement; holds; kill-switch rules. Approver: Security and Privacy.
- A06: Roles/capabilities — Least-privilege matrix; consent; scope; expiry; revocation. Approver: Security and customer IT.
- A07: Audit — Event contract; actor/source/target; retention; integrity; permitted readers. Approver: Security and domain auditor.
- A08: Support process — Queues; staffed primary/backup; hours; escalation; articles; drills. Approver: Support.
- A09: Monitoring/SLO — Metrics; traces; sanitized logs; alerts; accepted SLOs; stop thresholds. Approver: Reliability.
- A10: Documentation — User/admin/developer/operator guides; limitations; source-aware labels. Approver: Product and Operations.
- A11: Test plan — Fixtures; runnable bindings; negative/concurrency/recovery/AT cases; retained runs. Approver: QA and reviewers.
- A12: Release gate — Exact SHA/deployment/config/migration/cohort/operation; evidence validity; approvals. Approver: Release authority.
- A13: Migration/rollback plan — Expand/contract; dual run; counts/checksums; cutover; compensation; restore. Approver: Engineering and customer IT.
- A14: Commercial model — Applicable price/authority/payment/tax/insurance/terms; accepted N/A where valid. Approver: Finance and counsel.
- A15: Customer-success model — Onboarding; training; adoption; baseline; outcomes; closeout; reference permission. Approver: Success and customer sponsor.
- A16: Operating owner — Named accountable/implementation/acceptance owners and backup; escalation rota. Approver: Founder and Operations.

## Deployment and rollback

No step below was executed. Resolve target IDs, named operators, approved thresholds and exact commands before activation. Existing repository ROLLBACK.md describes GitHub Pages and separately deployed Edge Functions; do not assume Vercel is the canonical host. Preserve the existing governance evaluator rather than replacing it with this kit.

## Release identity
Record commit SHA, build digest, hosting provider/project/deployment, DB project/region, schema fingerprint, migration set/checksums, functions and workers/version, build-time environment fingerprint (no values), runtime policy/config version, flag version, tenant/cohort/allowed operations, approvers, evidence expiry, predecessor manifest and rollback compatibility.

## Pre-deploy
1. Authorize candidate and target; confirm backups and object copies are restorable.
2. Review every pending migration and automatic deployment path, including Supabase Branching. A source merge can have external side effects even when repo workflows contain no migration command.
3. Expand schema additively; rehearse against production-like authorized data.
4. Test old app/functions/workers with expanded schema and new app against compatible schema. Freeze incompatible contract changes.
5. Keep new flags off. Deploy dark; execute read-only and authorized-write smoke tests in approved target.
6. Verify direct API/worker denial, telemetry, alert receiver, primary and backup.
7. Approve tenant/cohort activation only after evidence matches manifest.

## Rollout
Synthetic/staging -> named operators -> approved small cohort -> approved broader cohort. Advancement uses accepted observations and thresholds, not illustrative percentages. No unapproved official writes. Freeze/hold on missing evidence.

## Stop triggers
Any tenant leak, unauthorized official/financial action, identity disclosure or data corruption: stop impacted operations and incident response immediately. Also stop for failed reconciliation, missing alerts/coverage, revoked approval, excessive accepted error budget, schema drift or AI bypass. Operational numerical thresholds must be approved and populated; blank thresholds block activation.

## Rollback order
1. Declare incident and scope; retain exact release/policy versions and safe audit.
2. Engage server-enforced tenant/operation kill first; global only where incident requires it. Verify direct API and queued dispatch denial. Do not disable the authorized refund/cancellation repair path indiscriminately.
3. Pause affected producers/consumers; checkpoint pending/in-flight transaction IDs. Quarantine uncertain outcomes. Do not delete outbox/DLQ evidence.
4. Disable affected tenant flag/rollout and invalidate policy caches. An old app must still honor current kill state.
5. If needed, engage both client VITE_READ_ONLY build-time hold and server SEMESTER_READ_ONLY runtime hold, then verify coverage including functions/workers/storage. Source says these have not been production-drilled; reverify.
6. Restore known-good compatible page/app, functions and workers independently. A page rollback does not restore database, functions, external source records or object bytes.
7. Reconcile source outcomes before any replay. Preserve committed official writes; correction or compensation requires fresh domain authority.
8. Prefer forward schema repair. Database recovery is a separate incident procedure: isolate restoration, restore matched objects, verify checksums/access/revocation state, reconcile post-backup changes, and obtain authority before production cutover. Do not lose new legitimate writes by blindly restoring a snapshot.
9. Verify content/session/service-worker cache behavior and client-version compatibility; do not wipe personal drafts.
10. Run regression/smoke/negative/privacy tests; confirm support communications and reconciliation.
11. Re-enable only through new scope-bound acceptance. Record measured detection, kill propagation, restore, RTO/RPO and remaining uncertainty.

## Host branches
GitHub Pages: existing pages.yml workflow on approved prior ref; verify actual page and service worker. Edge Functions: existing functions.yml on approved prior ref, independently.
Vercel, if proven target: select known-good deployment and verified rollback operation; environment changes apply to new deployments, not previous builds. Revalidate function/DB/config dependencies separately.
Supabase: inspect actual migration ledger/branch settings; schema is not reverted by app rollback. Storage metadata backups do not contain stored file bytes.

## Required drill assertions
Unknown flag denied; missing target denied; stale/withdrawn/cross-target receipt denied; global and tenant kills take precedence; role/cohort/scope restrictions persist; direct and queued operations stop; in-flight outcomes reconcile; refunds remain authorized; no identity disclosure; old app remains compatible; object restore matches checksums; restored old permissions do not reinstate revoked access.


## Scope and authority retention
All required capabilities map into the sixteen aggregate domains; this aggregation must not shrink institutional scope. Admissions, assessment, family/guardian, research, HR/payroll, procurement, GL, aid, conduct and regional work need explicit sub-capability packages where part of the intended system. Implementation completion does not create system-of-record authority. The existing design authority gates include term-long or multi-term dual run and outcome proof; do not compress these into a same-day approval.

## Code integration
Use reference/evidence_gate.py only as an offline consistency helper. Extend existing Semester activation/release/flag evaluators rather than creating a second source of authority. Python checks prove only the helper decisions. Runtime authorization must load evidence from a trusted authenticated store, enforce current policy, validate approval provenance, and handle concurrent revocation. SQL is unexecuted reference metadata, not a drop-in migration.

## Execution order
1. Recover complete named capability/work-package inventory and current targets.
2. Assign named owner/backup/acceptance person; define scope and actual requirements.
3. Close shared policy/data/AI/operations blockers.
4. Build missing domain journeys with canonical state and source authority.
5. Bind each NOT RUN test to real fixtures/UI/API/database assertions.
6. Run candidate-bound verification and independent reviews.
7. Deploy dark; validate actual target; preserve rollback compatibility.
8. Obtain scope-matched agreements/UAT and commercial authority.
9. Activate bounded eligible cohort with monitoring/support; perform required dual-run evidence windows.
10. Accept authority/production gates and truthful public claims only when evidence is current.

## Evidence boundary

Screenshot: user attachment Completion register, 16 domains and 21 default-off flag snapshot; six maturity facts remain separate. Screenshot package counts are not a recovered list of named packages.
Prior-turn GitHub reads: GO-NO-GO-DECISION.md (file SHA 905b60398daf68aec5da14b599db8fc058db0b12); PRODUCT_LIVE_STATUS.md (098c34718cb67d981e1e6d4786287764d3028581); COMPLETE_CAPABILITY_REGISTER.md (1e650b1d725fa5011c376b35492d14f89e2fed04). Assessment dates 2026-10-03/04, not fresh runtime proof.
Current-turn GitHub reads: app/src/lib/flags.ts (d0fd98d5200501ee169433f572399b5c8444ce3b): 28 enumerated entries; all defaults off; evaluator response truncated so tail not reverified. ROLLBACK.md (e2a2ca3499c4abb75aa07e0ed669cb80f9aa332b): Pages/functions separate; DB rollback not automated; mixed historical statements; live settings must be inspected.
Project design files: docs/native-platform/NATIVE_AUTHORITY_GATES.md and NATIVE_DOMAIN_CATALOG.md under The Main Semester design system (2) copy. These are design-stage artifacts, not deployment or approval evidence. Long-term authority gates include full terms/two-term evidence in some domains. Illustrative prices and targets are not commercially accepted commitments.
No current Vercel/Supabase runtime audit performed. No real app tests or migrations run. No professional/customer approvals created. This kit has no credentials or customer/student records.
Public verification: https://vercel.com/docs/instant-rollback ; https://vercel.com/docs/environment-variables ; https://supabase.com/docs/guides/platform/backups ; https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/
