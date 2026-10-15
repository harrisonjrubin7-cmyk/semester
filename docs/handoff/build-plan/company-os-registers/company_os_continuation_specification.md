# Semester connected Company OS continuation specification

## Direct architecture
Extend the existing Semester Console and its controlled-action/security foundations. Business is the planning/execution view; Operations is the owned action/exception view; investor/board reporting is a scoped read-only disclosure projection; Master Control is a registry/navigation/evidence hub, not another super-admin API. One account, Action Center, search, graph, source-aware workspace and policy gateway.

## Evidence baseline
Read-only GitHub inspection at commit fb51d663006edcfb4d476d97be710922159e6d26: app/src/screens/Console.tsx; app/src/lib/console/workspaces.ts; app/src/screens/Me.tsx; search excerpts for app/src/lib/console/capability.ts, app/src/lib/nav.ts, docs/ops and docs/operations; directory listing of docs/legal. No tests, deployment, grants, financial feeds or institutional authorization were executed/verified. Code inspection is not production proof.
- Me.tsx already renders Semester Operations when holdsConsole(useMyCapabilities()) succeeds; it dispatches screen console. Do not implement a duplicate entry.
- Console.tsx gates on cloud configuration, account, grant-discovery states and holdsConsole. Missing service/account and missing grant show explanatory notice; discovery error has retry.
- workspaces.ts currently declares 18 workspaces. visibleConsoleWorkspaces uses exact capability/scope predicates and the supportTickets flag; privacy permits corresponding platform capability. Navigation controls discoverability, not server authorization.
- Saved tab and views are account-backed operator preferences; isConsoleWorkspaceId constrains restored tabs to available workspaces. Read/MFA state and server decisions remain authoritative.
- Actual finance tab mounts FinancialModel; do not infer an actual bank or ledger feed from that component name.
- Current inspected project company catalog has 15 functions; native operations catalog has nine domain consoles; repo has 18 console workspaces; proposed continuation uses 10 architectural layers. These are different inventories, not competing counts.
- V1 investor prototype includes hardcoded pilot/traction/entity examples. None establish signed pilot, paid customer, corporate form, revenue, insurance or current status. Current governed portal in user catalog is the target; its actual source was not located by this bounded inspection.
- Reported user-catalog inventories (111 routes, 227 tables, 21 streams, 20 SEM capabilities, G01–G25, 17 platform workspaces, 78 controls, 36 AI cases, 68 document drafts, 51 roles) remain source claims awaiting manifest/code reconciliation. They are not audited counts in this pack.

## Full catalog continuation
93 named entries from the supplied catalog have a continuation disposition; repeated usage-note labels are consolidated. The registry includes business, components, trust, delivery, documents, engineering, all brand/color/layout/type foundations and governance. Each is reconciled into an existing contract rather than a parallel application.

## Ten proposed layers
This is a proposed reconciliation taxonomy, not a claim that the original ten-layer data source was recovered.

### L01 — Strategy and execution
Existing candidate workspaces: command|launch|evidence. Features: Business overview|Gap register|Launch tracker|90-day roadmap|Decision register|Portfolio priorities.
Workflow: Strategy → owned work → evidence → review. Owner: Strategy/operations seat. Phase: P1. Gap: Missing code/evidence bindings and named owners.

### L02 — Identity and operating authority
Existing candidate workspaces: approvals|breakglass|audit. Features: Operations entry|Role grants|Approval matrix|Access review|Delegations|Device/session oversight.
Workflow: Grant → discover → authorize → step-up → act → audit. Owner: Identity/security seat. Phase: P1. Gap: Entry exists; domain capabilities and authorization tests require verification.

### L03 — Product engineering and delivery
Existing candidate workspaces: releases|release-incidents|launch|evidence. Features: Requirements|Backlog|Release flags|Cohort rollout|CI evidence|Recovery drills.
Workflow: Signal → PRD → review → build → test → release → measure. Owner: Release/platform seat. Phase: P1-P2. Gap: No runtime tests/deployment observed; broad catalog still needs binding.

### L04 — Trust privacy accessibility and resilience
Existing candidate workspaces: controls|privacy|audit|release-incidents. Features: Control register|Audit workbench|AI evaluations|Privacy requests|Accessibility review|Incident command|Continuity risks.
Workflow: Risk → control → evidence → test → remediate → verify. Owner: Trust/security seat. Phase: P1-P2. Gap: Prototype/control states cannot substitute for executed evidence.

### L05 — Revenue marketing and commercial growth
Existing candidate workspaces: customers|figures. Features: CRM pipeline|Buyer maps|Quotes|Procurement|Marketing calendar|Social publishing|Claims review|Fundraising pipeline.
Workflow: Target → qualify → evidence-based demo → contract → handoff. Owner: RevOps/marketing seat. Phase: P2. Gap: Authoritative CRM/publication feeds not verified.

### L06 — Implementation success and service
Existing candidate workspaces: tenant-operations|support|integration-health|command. Features: Pilot projects|Mutual action plan|Training|Adoption|Support|Renewals|Customer health|Outcome reporting.
Workflow: Signed scope → readiness → activation → outcomes → renewal. Owner: Implementation/CS seat. Phase: P2. Gap: Institution authorization and actual pilot status unverified.

### L07 — Finance accounting and capital
Existing candidate workspaces: finance|figures|approvals. Features: Billing accounts|Invoices|Collections|Reconciliation|Cash/runway|Cloud/AI cost|Budget|Spend approval.
Workflow: Approved commitment → invoice/payment → reconcile → close → publish. Owner: Finance seat plus qualified accountant. Phase: P2. Gap: Finance view existence does not prove bank/ledger connection.

### L08 — Legal vendors and ecosystem
Existing candidate workspaces: ecosystem|approvals|controls. Features: Contracts|Document reviews|Obligations|Vendor risk|Subprocessors|Partner apps|Certification|Exit/portability.
Workflow: Intake → review → agreement → scoped access → monitor → renew/exit. Owner: Legal/vendor/partner seats. Phase: P2-P3. Gap: Qualified reviews, binding registry and provider exit evidence pending.

### L09 — People hiring and organizational capacity
Existing candidate workspaces: command|approvals|audit. Features: Workforce plan|Hiring scorecards|Recruiting|Offers/IP|Onboarding|Training|Access offboarding.
Workflow: Approved need → structured evaluation → offer → provision → review → offboard. Owner: People seat. Phase: P2-P3. Gap: People domain views proposed; hiring/access integrations unverified.

### L10 — Data research and governed disclosure
Existing candidate workspaces: figures|evidence. Features: Metric dictionary|Research plans|Aggregate outcomes|Investor overview|Monthly packages|Board decisions|Data room|Correction history.
Workflow: Define → collect permitted facts → reconcile → review → publish → correct. Owner: Data/reporting seat. Phase: P2-P3. Gap: Current governed portal implementation not located in inspected sources.

## Business workspace
Provide exception-first executive overview; gap analysis by design/code/test/source/authority/recovery; launch tracker; dependency roadmap; pilots; risks; hiring; funding; approved decks and document reviews. Each work item has a real owner, source/version, due time, dependency, next permitted action and closure proof. Do not count a plan as implementation.

## Fifteen company functions
Proposed seats and owners require assignment. Existing draft spend/discount/notice/hiring rules are planning policies, not universal contractual or legal obligations.

### Corporate governance and legal
Owner: Founder + qualified counsel. Workflow: Contract → review → signature → obligations → amendment/exit.
KPIs: Obligation coverage; signature cycle; missed notices. Controls: Signing authority; counsel review; IP assignment. Gap: Document/obligation register binding.

### Finance accounting and capital
Owner: Founder + qualified accountant/bookkeeper. Workflow: Reconcile → close → cash forecast → review → disclosure.
KPIs: Reconciled cash; net burn; forecast variance; margin incl AI/cloud. Controls: Payment/refund approval; immutable ledger; no sample-as-actual. Gap: Verified close and source-fed model.

### Product and engineering
Owner: Founder → engineering seat. Workflow: Research → PRD → review → code → test → controlled release.
KPIs: Change failure rate; recovery duration; release proof coverage. Controls: RLS/auth review; policy tests; cohort stop/rollback. Gap: Capability/code/evidence reconciliation.

### Security privacy accessibility compliance
Owner: Founder + trust/security seat. Workflow: Inventory → risk → control → test → evidence → review.
KPIs: Current tested controls; overdue access reviews; open critical findings. Controls: Least privilege; tenant isolation; source-bound claims. Gap: Executed tests; vendor reviews; accessibility evidence.

### GTM and revenue operations
Owner: Founder → RevOps seat. Workflow: Target → qualify → demo → procurement → contract → handoff.
KPIs: Qualified pipeline; stage conversion; sales cycle; renewal. Controls: Price policy; claims review; approved contractual scope. Gap: CRM authority; win/loss and forecast definitions.

### Marketing brand communications
Owner: Founder → marketing seat. Workflow: Plan → draft → substantiate → approve → publish → measure.
KPIs: Qualified requests; approved content; acquisition quality. Controls: Customer-name permission; endorsement disclosures; lifecycle claims. Gap: Content calendar and distribution bindings.

### Customer success implementation
Owner: Founder → implementation seat. Workflow: Kickoff → data readiness → training → activate → outcomes → renew.
KPIs: Time to authorized launch; activation; agreed measures; renewal. Controls: Tenant-specific gate; scope amendment; named office owners. Gap: Health definition and closed-loop customer proof.

### Support and service
Owner: Founder → service seat. Workflow: Safe intake → owner → response → escalation → resolution → confirm.
KPIs: Response/resolution distributions; reopen rate; overdue cases. Controls: No unrestricted student records in tickets; time-limited access. Gap: Owned SLA queues; KB; real closure tests.

### Partnerships marketplace developer relations
Owner: Founder → partner seat. Workflow: Qualify → agreement → scopes → review → install → monitor → exit.
KPIs: Reviewed integrations; partner-sourced pipeline; scope incidents. Controls: Institution-scoped install; revoke tokens; no approval inheritance. Gap: Partner agreements and certified execution evidence.

### People hiring culture
Owner: Founder → people seat. Workflow: Need → budget → scorecard → interview → offer → provision → exit.
KPIs: Hiring cycle; evidence-based scores; onboarding/revocation proof. Controls: IP/confidentiality; restricted candidate data; least privilege. Gap: Compensation bands; approved hiring triggers; owned offboarding.

### Data research outcomes
Owner: Founder → data/research seat. Workflow: Hypothesis → permitted baseline → measure → analyze → review → claim.
KPIs: Measures with baseline; approved claims; metric freshness. Controls: Purpose/permissions; suppression; institution/research approval as applicable. Gap: Metric dictionary; study scope and actual evidence.

### Procurement vendors supply chain
Owner: Founder → procurement seat. Workflow: Purpose → classify → review → contract → provision → monitor → exit.
KPIs: Reviewed vendors; upcoming notices; verified exits. Controls: Risk-tier review; signing authority; scoped secrets; provider portability. Gap: Current vendor records; approved notice obligations.

### Risk resilience continuity
Owner: Founder → reliability/risk seat. Workflow: Identify → owner → mitigate → test recovery → reassess.
KPIs: Critical risks without proof; restore exercise result; incident follow-up. Controls: Stop triggers; operational authority; no false cleanup closure. Gap: Key-person plan; measured restore and rollback.

### Board investor stakeholders
Owner: Founder → preparer + separate publisher. Workflow: Close → reconcile → audience review → publish → correct → follow-up.
KPIs: On-time verified packages; correction timeliness; revoked access proof. Controls: Read-only audience scope; immutable history; no student rows. Gap: Current governed portal and data-room bindings.

### Operations command center
Owner: Founder → operations seat. Workflow: Inbox → evidence → approval → execute → receipt → reconcile → review.
KPIs: Unowned items; overdue work; approved action closure. Controls: Entry capability is not universal authority; separation of duties. Gap: Canonical work-item feeds; My Work/SLA source binding.

## Operations entry and console regression requirements
Retain existing Me entry and direct-route gate. Add no new navigation root without the repository decision process. Test no account, no service, discovery loading/error, absent/expired/revoked grants, exact-scope consistency, fresh MFA for consequential actions, current selected-tab removal after revocation, saved views referencing no-longer-available workspaces, empty authorized scope, server-denied reads/actions, sample/live separation and absence of student-private fields in business projections. Review holdsConsole platform-scope semantics versus workspace exact scopeId matching; this is a regression requirement, not a claimed exploit.

## Operations Inbox and My Work
Types: approvals, escalations, incidents, renewals, privacy/data requests, security alerts and lead follow-up. One canonical item per source event/version with dedup and linked command. My Work is an authorized ownership projection, not a separate task system. SLA derives from server due_at plus policy version; pause reason and stop/start times are audited. No invented countdown from page load. Counts, filters, search and exports require the same scoped policy as rows.
Queue loop: intake -> authorize/classify -> accept ownership -> inspect source/evidence -> prepare exact command -> required independent approval -> commit/reconcile -> receipt -> confirm resolution -> close/reopen.
Low-risk acknowledge/assign/note remain role-scoped and audited. Consequential actions use current authority, payload/version-bound approval and real receipts. Accepted/queued is not committed. Unknown outcomes remain pending reconciliation. Failed notifications do not undo official actions.

## Document lifecycle
requested -> classified -> draft -> in_review -> changes_requested -> approved_for_signature_or_publication -> signed_or_published -> effective -> superseded -> expired -> terminated -> archived
Changes requested returns to a new draft revision. Approved does not mean signed. Signed does not imply effective before effective date. Corrected publication supersedes with a new version; originals remain auditable. Contracts carry obligations and applicable notice periods. Legal holds preserve records but do not expand audience permissions.

## Six company swimlanes
Each step has owner lane, document, gate and fallback. Legal links in the CSV resolve supporting review/policy files actually listed in the repo. They are not substitutes for signed agreements. MSA/DPA/SOW/partner/offer/research agreements were not resolved in the inspected docs/legal directory; check other registries before claiming whole-repo absence.

### deal
1. Sales: Qualify purpose and stakeholders. Produce Discovery brief. Gate: Named sponsor; no student data in sales records.
2. Sales + institution: Agree problem baseline and measures. Produce Pilot success-measures sheet. Gate: Measure definition/source and institutional owner.
3. Security/legal: Review security and privacy scope. Produce Questionnaire + MSA/DPA/security addendum. Gate: Evidence-backed answers and applicable counsel/institution approval.
4. Implementation: Define delivery/acceptance. Produce SOW + mutual action plan. Gate: Owners, dependencies, acceptance, rollback/exit.
5. Authorized signatories: Execute commercial scope. Produce Order form/pilot agreement. Gate: Signing authority; actual signed versions.
6. Implementation/institution: Validate and authorize cohort. Produce Launch evidence package. Gate: Negative access/recovery/accessibility proof; scoped activation.
7. CS/data: Measure and review outcomes. Produce Results report. Gate: Unmeasured labelled; baseline/comparison limits.
8. Sales/finance: Annual decision and reconciliation. Produce Order form + invoice. Gate: Commercial terms not inherited from prototype examples.
Recovery: do not proceed downstream without the gate; retain versions and reason; reconcile unknown external results; assign the receiving owner.

### renewal
1. CS: Create renewal work item. Produce Contract obligations snapshot. Gate: Actual notice period/due date; planning lead time not contract override.
2. CS/data: Review value and service. Produce Outcome/QBR report. Gate: Agreed measures and current evidence.
3. Institution: Choose renew expand or exit. Produce Decision record. Gate: Authorized customer decision.
4. Legal/RevOps: Review changed scope and pricing. Produce Amendment/order form. Gate: Applicable notices and signatory approvals.
5. Finance: Issue and reconcile renewal. Produce Invoice/receipt. Gate: Approved terms; no forecast-as-cash.
6. Implementation: Apply approved entitlement. Produce Activation command. Gate: No automatic student-data authority expansion.
7. Privacy/implementation: Execute exit when selected. Produce Export/retention/deletion plan. Gate: Verified export; legal holds; approved retention obligations.
8. CS: Close renewal or exit. Produce Closure receipt. Gate: Customer outcome and outstanding obligations reconciled.
Recovery: do not proceed downstream without the gate; retain versions and reason; reconcile unknown external results; assign the receiving owner.

### hiring
1. Hiring manager/finance: Approve need and funding. Produce Requisition/scorecard. Gate: Documented capacity gap; funding scenario; appropriate approval.
2. People: Source with consented process. Produce Candidate pipeline. Gate: Restricted access; retention policy.
3. Interview panel: Structured assessment. Produce Independent interview scores. Gate: Consistent criteria; conflicts managed.
4. People/counsel: References and offer review. Produce Offer + IP/confidentiality. Gate: Approved compensation and qualified legal review.
5. Candidate/signatory: Accept terms. Produce Signed offer/IP agreement. Gate: Signed required terms before sensitive access.
6. Security: Provision scoped access. Produce Grant command/training record. Gate: Least privilege; MFA; role-specific training.
7. Manager: Review onboarding outcomes. Produce 30/60/90-day review. Gate: Evidence of role outcomes, not surveillance.
8. People/security: Exit or role change. Produce Offboarding receipt. Gate: Employment grants revoked; owned equipment and records reconciled.
Recovery: do not proceed downstream without the gate; retain versions and reason; reconcile unknown external results; assign the receiving owner.

### vendor
1. Requester: Describe purpose/data. Produce Vendor intake. Gate: Minimized needed data; budget and alternatives.
2. Security/privacy: Risk-tier review. Produce Vendor assessment. Gate: Evidence and institutional obligations; no blanket certification assumption.
3. Legal: Review terms. Produce Vendor agreement/DPA. Gate: Applicable breach/notice/retention duties approved.
4. Finance/signatory: Approve commitment. Produce Purchase approval. Gate: Signing/spend authority and cost source.
5. Security/platform: Provision integration. Produce Scoped connector passport. Gate: Secret management; least privilege; kill switch.
6. Vendor owner: Monitor and review. Produce Review/incident log. Gate: Current evidence; breach escalation.
7. Owner/legal: Renew or change subprocessor. Produce Renewal/notice record. Gate: Contract-specific notification and approval.
8. Platform/privacy: Exit and verify. Produce Portability/revocation/deletion receipt. Gate: Token revoke; export; holds and retention honored.
Recovery: do not proceed downstream without the gate; retain versions and reason; reconcile unknown external results; assign the receiving owner.

### partner
1. Partnerships: Qualify mutual value. Produce Partner brief. Gate: Approved claims; no promised data access.
2. Legal: Agree terms. Produce Partner/publisher agreement. Gate: Qualified review and authorized signature.
3. Partner/devrel: Register minimal scopes. Produce App/scope manifest. Gate: Feature-linked capabilities; no credentials in client.
4. Security: Evaluate app. Produce Certification evidence. Gate: Tenant isolation and revoked-access tests.
5. Institution: Authorize install. Produce Institution install approval. Gate: Per-tenant, revocable, exact scope.
6. Platform: Activate bounded integration. Produce Controlled activation receipt. Gate: Current grants/policy; safe idempotency.
7. Partner owner: Measure and monitor. Produce Partner outcome/security report. Gate: No cross-tenant discovery; evidence-backed attribution.
8. Security/legal: Suspend retire or renew. Produce Revocation/renewal record. Gate: Scope breach stops access; uninstall revokes tokens.
Recovery: do not proceed downstream without the gate; retain versions and reason; reconcile unknown external results; assign the receiving owner.

### research
1. Research lead: Define question and method. Produce Study/measurement plan. Gate: Institution determines applicable review/IRB and legal basis.
2. Institution/privacy: Approve purpose and access basis. Produce Research data-use agreement. Gate: No release before required approvals; not every analytics activity automatically research.
3. Data steward: Minimize and prepare cohort. Produce Data-release manifest. Gate: Approved fields; suppression policy; differencing/reidentification review.
4. Researcher: Perform analysis. Produce Versioned analysis/results. Gate: Methods/limitations; no predetermined success.
5. Independent reviewer: Review method and privacy. Produce Review record. Gate: Privacy review cannot suppress inconvenient findings.
6. Institution/publisher: Approve permitted disclosure. Produce Publication/claims approval. Gate: Name/logo/quote permission and source-backed claims.
7. Data steward: Close retention obligations. Produce Retention/destruction certificate. Gate: Legal holds; agreement deadlines; verified outcome.
8. Product/data: Apply learning. Produce Decision/experiment record. Gate: Trace finding to change; distinguish exploratory vs established claim.
Recovery: do not proceed downstream without the gate; retain versions and reason; reconcile unknown external results; assign the receiving owner.

## Investor and board reporting
Supersede v1 as a design reference only. Six-question overview: What changed? What verified outcomes/traction exist? What did we deliver and what remains blocked? What do reconciled cash/forecast scenarios imply? What material risks and decisions require attention? What specific help or approvals do we need?
Audience: board/investor/diligence/observer receive independently approved objects/sections. Preparer drafts and reconciles; publisher releases the approved exact snapshot. Publisher authority does not substitute for source, accounting or legal approval. Diligence grants are purpose/time-bound. Read-only does not mean confidentiality-free. Downloads have separate grants; revoke future access, never claim to recall downloaded copies.
Reporting package: period + version + immutable content hash + source close + metric-definition versions + approved documents + audience manifest + reviewer + publication event. Monthly cadence follows approved operating policy, not assumed board existence.
Publication loop: freeze source cutoff -> reconcile -> classify -> draft -> review -> independent publication approval -> materialize audience-specific package -> verify access -> publish -> record receipt. A correction creates new package/version/reason/supersedes link; originals remain intact; recipients receive a scoped correction notice. Do not silently patch a number in a published page.
Schema local checks: one valid draft plus four invalid fixtures rejected. This is not immutable-storage, access-control or runtime proof. Actual forecast, institutional names and individual customer details require their own disclosure basis.

## Metrics and financial definitions
Weekly next-action completion: unique eligible students with a confirmed permitted action during period / eligible cohort, using approved event definition; report coverage and missing data. Activation is a verified domain event, not page open. Readiness is not enrollment. Paid institution requires defined executed contract/payment criteria; pilot signing is not automatically cash. ARR excludes one-time pilot revenue unless reviewed accounting/commercial definitions justify recurring classification. Runway forecast uses reconciled cash, commitments and scenario-based cash flows, not one unaudited burn divisor. Unknown/unmeasured remain explicit.

## Cadence and 90-day plan
Proposed continuation: October 14, 2026 through January 11, 2027 inclusive. This does not overwrite existing commitments. The 16-week plan continues through week 16; day 90 ends during week 13. No date waives a gate.
Daily: owned Ops Inbox and incident/support exceptions. Weekly: top company outcomes, pipeline, pilots, evidence blockers, SLOs, cash and risk. Monthly: reconciled close, metric/claims review, corrections and audience-approved update. Quarterly: grants/vendors/continuity/hiring/roadmap review. Cadence limits require approved operating policy.

Week 1 (2026-10-14–2026-10-20): Inventory and authority. Work: Pin source/code/doc IDs; reconcile prototypes vs repo; assign actual seats. Exit: Reviewed baseline and unresolved evidence register.
Week 2 (2026-10-21–2026-10-27): Console and work-item contracts. Work: Keep existing entry; add per-class work contracts; deny/refresh/saved-tab cases. Exit: Server policy and cross-tenant negative tests.
Week 3 (2026-10-28–2026-11-03): Controlled actions and documents. Work: Versioned approvals; accepted vs committed receipts; document reviews. Exit: Replay/conflict/unknown-outcome and review workflow tests.
Week 4 (2026-11-04–2026-11-10): Telemetry provenance and components. Work: Real due times; metric definitions; theme/accessibility state matrix. Exit: Source lineage; accessible queues; no sample-as-actual.
Week 5 (2026-11-11–2026-11-17): Commercial intake. Work: CRM opportunity and inquiry ownership; price/claims gates. Exit: Qualified-stage criteria; document/source-backed proposal.
Week 6 (2026-11-18–2026-11-24): Legal vendor finance close. Work: Review agreement bindings/vendors; reconciled invoices and close pipeline. Exit: Counsel/accountant decisions; bank/ledger source reconciliation.
Week 7 (2026-11-25–2026-12-01): Pilot implementation. Work: Scope cohorts; source passports; support/training; baseline measures. Exit: Institution approvals; sandbox reconciled; support owner.
Week 8 (2026-12-02–2026-12-08): Recovery and controlled cohort. Work: Registration/grades/payment uncertainty; rehearsed restores and stop controls. Exit: Fault injection plus tenant-specific activation decision.
Week 9 (2026-12-09–2026-12-15): Outcomes and renewal. Work: Measure agreed cohort; suppress unsafe aggregates; renewal obligations. Exit: Method/denominator review and verified due-date work.
Week 10 (2026-12-16–2026-12-22): People and partners. Work: Trigger-based hiring; signed IP; sandbox app scopes; offboarding. Exit: Funded requisition and restricted access/revocation evidence.
Week 11 (2026-12-23–2026-12-29): Investor reporting. Work: Audience grants; close-fed immutable package; correction/revocation. Exit: Publisher separation; no student rows; package tests.
Week 12 (2026-12-30–2027-01-05): Evidence consolidation. Work: Refresh expired controls; end-to-end deal/pilot/renewal/report tests. Exit: Traceability complete for candidate cohort; blockers explicit.
Week 13 (2027-01-06–2027-01-12): 90-day decision. Work: Review outcomes, costs, risks, capacity; authorize next scope or defer. Exit: Approved next-quarter plan; days 85-90 complete; remaining week is follow-up.
Week 14 (2027-01-13–2027-01-19): Expanded coverage. Work: Fill remaining console/domain bindings; do not duplicate frameworks. Exit: Domain acceptance and source contracts.
Week 15 (2027-01-20–2027-01-26): Scale and portability. Work: Load, disaster recovery, partner retirement, source migration exercises. Exit: Measured resilience/portability proof; targets explicitly approved.
Week 16 (2027-01-27–2027-02-02): Institutional expansion gate. Work: Repeat onboarding and authorized domain replacement on new scope. Exit: Separate institution approvals and domain cutover proof.

## Pilot activation
The attached twenty-point checklist is proposed, uses PROP-PILOT IDs and does not replace existing G01–G25 or ship-program gate IDs. Apply per approved workspace/cohort; exact workspace scope must come from platform registry. Review evidence freshness on approved expiry and material changes. Two-person activation requires distinct people, not two roles held by founder. Without a second qualified approver, the affected activation remains blocked.

## Hiring and fundraising
Hiring is triggered by verified bottleneck + approved funded capacity plan. First professional needs: qualified counsel/accounting/security/accessibility review as required; engineering/implementation roles follow tested workload and budget. No offer/equity/compensation commitment without approval; restrictive legal and employment terms need counsel.
Funding readiness is source-backed product proof, reconciled financial scenarios, rights/IP/entity verification, risk disclosure and a controlled room. Fundraising tracker stores contact source, stage, consent/confidentiality, approved material version, next action/owner and commitment evidence. Intro/demo/diligence/interest is not committed capital. Amount/valuation/use-of-funds remain unset until approved. Outreach requires confirmation before send.
Decks included as 36 slide specifications across execution, investor and institution-pilot audiences; not approved for distribution.

## Delivery and maturity reconciliation
Keep one capability/evidence register with distinct views for ship program, pilot control, completion, SEM-01..20, phases, platform scale and traceability. Do not overwrite original stable IDs. Report designed/implemented/tested/deployed/institution-authorized/production-enabled independently.
Proposed 12-point operating proof (not a recovered exact source list):
1. Named owner and support/escalation
2. Identity, role and scoped authority
3. Source-of-truth/record boundary
4. Complete workflow including exceptions
5. Persistence and transaction guarantees
6. API/event/schema/reference contracts
7. Approvals and immutable outcome evidence
8. Privacy/isolation/security evidence
9. Accessible responsive seven-state experience
10. Metrics/monitoring and source freshness
11. Reconciliation/recovery/rollback/portability
12. Documentation/training and scoped activation
Proposed promotion workflow (not exact source nine-state inventory): catalogued -> specified -> implemented -> tested -> deployed -> activation_review -> cohort_enabled -> operating_verified -> retired. Promotion does not replace independent maturity facts.
Deployment runbook: pin reviewed revision -> backwards-compatible data changes -> sandbox/integration checks -> preview/cohort deployment -> verify telemetry -> separate scoped activation -> observe/stop -> expand only after evidence. Rollback code/config does not erase committed academic or financial records; use reconciliation and authorized correction.
Stop triggers: isolation/unauthorized write; stale or split authority; unconfirmed official result; privacy/provider policy bypass; critical inaccessible workflow; failed restore/cleanup; missing signed scope; publication without approved sources.
Traceability chain: decision -> capability -> contract -> code -> test -> evidence -> release -> operation -> correction/retirement, traversable in both directions.

## Components and foundations
Thirty-three component contracts plus trust patterns and all supplied brand/color/layout/type entries are registered. Use source tokens and source-authority behavior; do not invent palettes/fonts/paths. Proposed seven region states: loading, empty, ready, stale, unavailable, error, forbidden; offline, pending save, lifecycle and freshness dimensions remain separate. Reconcile this proposal with existing state types before implementation.
Metrics show kind/definition/source/time and actual-vs-forecast. Tables have captions/row headers/sort states and accessible equivalents. Forms preserve input/errors and explain disabled state. Modal sheets contain focus and restore it; tabs maintain panel and keyboard contract. Undo is only for actually reversible actions; typed confirmation is for appropriate irreversible scope, not every click. Proposed >=6-second undo pauses on hover and focus. SLA timers are from due times. Permissions distinguish denied/blocked/managed and only revoke owned resources.
Density .86/.74 and selected grounds/text scaling cannot silently shrink hit targets or remove contrast/focus. Semester may use 44px target policy; WCAG 2.2 AA 2.5.8 is 24px with stated exceptions, not universally 44px. APG dialog focus containment and tab/panel patterns inform acceptance. SourceLine requires a real source; lib/where.ts ranking cannot be claimed implemented unless inspected. Stale-source priority rule remains a specified behavior to reconcile with actual implementation.
AI answer anatomy: label/scope/sources/uncertainty/cost/policy/proposed action; consequential tools require exact approval. Student private sharing is default-private, recipient/category/expiry-bound, audited and revocable across read/search/export. Source classes, authority, freshness and personal ownership stay separate.

## Engineering and tooling
Claude toolkit, semester-core, semester-platform, Router/Benchmark Lab, developer portal and Slack are part of the same permission and execution contracts. Handoff migrations 010–240 are claimed catalog scope, not verified applied DB state. Reconcile with actual repo objects before any SQL import; no blanket new schema. Developer installs require reviewed scopes and tenant approval. Benchmarks report method, versions, task corpus, uncertainty and cost. Slack approvals recheck server identity/self-approval/version/already-decided at execution; no sensitive message-body forwarding. Generated tooling cannot autoapprove production or grants.

## Demo storyboards
Video scripts are supplied, not rendered videos. Use synthetic data and caption/transcript/reduced-motion requirements. No Vanderbilt affiliation, customer logo or signed-pilot implication without actual permission and verified agreement. A mapped campus pin is approximate—not an emergency/navigation guarantee.

30s 0–5: Scattered systems. Abstract windows/tabs, synthetic labels only. Voice: Your semester should not be scattered across systems.
30s 5–12: Today. One sourced priority with deadline and next action. Voice: Semester brings what matters into Today.
30s 12–20: Ask Semester. Scope + approved sources + uncertainty; no protected provider payload. Voice: Ask a question. See where the answer comes from.
30s 20–26: Consent. One recipient/category/expiry decision; visible revoke. Voice: Choose what to share—and keep control.
30s 26–30: Close. Receipt and clear next step; brand lockup. Voice: One connected semester. Your next action, made clear.
90s 0–15: Onboarding gates institutional work. SSO/verified membership/required steps; safe resume. Control: No link or client intent grants institutional authority
90s 15–35: Registration readiness and hold resolution. Blocked checklist → owning office → authoritative hold update → refreshed readiness. Control: Readiness is not enrollment; no official hold cleared by local task
90s 35–55: Faculty grade release reaches student. Faculty review → scoped authorized release → receipt → permitted student view. Control: Draft grade never silently becomes released grade
90s 55–75: Final grade becomes official only after approved posting. Revalidate authority → commit/passback → reconcile → official receipt. Control: Label official only from authoritative evidence; unknown remains pending
90s 75–90: Cross-role closure and recovery. Action Center and permitted reports update; source/audit view; branded close. Control: Synthetic data; Vanderbilt relationship/branding not implied; replace with approved assets only

## Work blockers and next implementation slice
Blockers: exact original 10-layer/current-portal/ship-data reconciliation; manifest counts; real business feeds and executed financial/pilot evidence; named independent approvers; legal agreement review; authorization/test/recovery evidence; source-compatible implementation.
First complete vertical slice: existing grant-aware entry -> authorized owned work item -> source/impact review -> independent approval -> idempotent command -> durable committed receipt -> projection/reconciliation -> closure -> audience-safe reporting. This requires backend tests, not a navigation demo.
Next integration order: existing security/gate regression -> canonical work/document/metric/activation bindings -> source-fed pilot/commercial/finance loops -> reviewed disclosure/hiring/partner scope -> audited expansion. No connected-system write, PR, deployment, investor outreach or grant change was performed.