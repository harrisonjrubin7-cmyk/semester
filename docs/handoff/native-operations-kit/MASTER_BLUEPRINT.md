# Semester native finance, operations and company OS execution blueprint

Generated October 13, 2026. Integrated specification and tested local reference package, not production completion.

## Deliverable map
- Native finance platform → specs/native_finance.md
- Native operations OS → specs/operations_workflows_inbox.md
- Native platform explorer → specs/platform_explorer_master_control.md
- Workflow runner → specs/operations_workflows_inbox.md
- Agent operations → specs/agent_operations.md
- Business workspace → specs/company_workspace_workflows.md
- Company OS map → matrices/company_layers_10.csv
- Company console → matrices/company_functions_15.csv
- Company workflows → specs/company_workspace_workflows.md
- Operations entry and console gate → specs/operations_workflows_inbox.md
- 30-second product demo → media/demo_storyboard_30s.md
- Investor and board portal → specs/investor_portal.md
- Investor portal v1 supersession → specs/investor_portal.md
- Master Control → specs/platform_explorer_master_control.md
- Operations Inbox → specs/operations_workflows_inbox.md
- Operations consoles → matrices/consoles_33.csv

## Proposed fourteen-check contract
1. Authenticated principal: Server-derived identity; no request-selected role.
2. Scope membership: Current personal/business/institution scope membership.
3. Environment and release: Approved candidate, target, configuration and data mode.
4. Kill and hold: Current server kill/read-only/incident holds respected.
5. Entitlement and module authority: Contract entitlement and off/shadow/assist/authoritative mode accepted.
6. Capability and delegation: Scoped capability; delegation current and revocable.
7. Role/cohort restrictions: All narrower audience and cohort policies respected.
8. Data classification and purpose: Allowed class, declared purpose and route.
9. Consent/retention/hold: Applicable sharing grant, retention and legal hold rules.
10. Source and integration scope: Authority/freshness; approved connection/scopes; no fake source success.
11. Domain policy and eligibility: Course/account/finance/record policy rechecked.
12. Independent approval and MFA: Required distinct approvers, current MFA and exact action digest.
13. Idempotency/version/preconditions: Exact command key, current object version and unchanged preview.
14. Audit/receipt/dispatch readiness: Durable fail-closed audit/outbox/receipt; operations coverage.

## Activation program
- Days 1–15 / P0: Inventory reconciliation; 25/692 catalog diff; console discovery; capability and command contracts. Owners: Engineering/Product. Gate: Pinned inventory and named owners; no duplicate shell.
- Days 16–30 / P0: Controlled-action vertical slice; inbox/approval/audit/receipt; finance adapter sandbox. Owners: Backend/Security/Finance. Gate: Forged-scope/self-approval/retry/audit-failure negative tests.
- Days 31–45 / P0: Ledger/invoices/refunds/entitlements; outbox worker; reconciliation; ops observability. Owners: Finance/Platform/SRE. Gate: Balanced journals; webhook replay/order; actual alerts; held checkout remains respected.
- Days 46–60 / P1: Company workflows; grants-aware entry; 33 console read-model wiring. Owners: Frontend/Operations. Gate: Direct deep-link denial; scope-filtered views; accessible journeys.
- Days 61–75 / P1: Reporting portal; 12 observe agents; deterministic workflow runner. Owners: Reporting/AI/Security. Gate: Immutable snapshots; audience denial; bounded handoffs; no action autonomy.
- Days 76–90 / P1/P2 preparation: Independent reviews; candidate deployment; customer UAT; drills; controlled launch decision. Owners: Reviewers/Customer/Operations. Gate: Current target-bound authority; staffed restore/rollback; no schedule guarantee.

## Specifications

# Native finance — implementation contract
Status: proposed extension; source docs/finance/NATIVE_FINANCIAL_PLATFORM.md lists existing canonical tables and handoff 090, not proof of production deployment.

## Boundaries
Semester owns catalog, price versions, quote/order forms, billing accounts, invoices, subscription/entitlement policy, usage, payment orchestration, native UX, operational ledger, refund controls, dunning, console and reconciliation. A regulated rail handles collection/settlement/payment credentials; statutory accounting remains in accepted accounting books. Product billing, university student accounts and marketplace money flows are separate legal entities/books/authority domains. No raw PAN/CVC in Semester browser stores, servers, logs or AI. Processor-owned capture may live inside Semester UX after PCI/acquirer review; native checkout does not imply homemade card capture or regulatory exemption.

## Reuse data
Extend commercial_products, commercial_plans, commercial_prices, entitlement_definitions, plan_entitlements, billing_accounts, quotes, contracts, subscriptions, invoices, payment_events, credits_refunds, dunning_cases, cancellation_requests, student_account_entries, student_payment_plans, student_account_reconciliations and student_account_closes. Reconcile handoff fin.ledger_accounts/journals/lines, payment_rails/attempts/transitions/provider_events, settlements and refund requests/approvals before adding anything.

## State models
Checkout: draft -> priced -> terms_accepted -> payment_method_tokenized -> submitted -> awaiting_confirmation -> completed/failed/expired. Re-price invalidates acceptance; server calculates amounts; no browser success proves payment.
Payment attempt: created -> requires_method/requires_confirmation/requires_action -> processing -> authorized -> capture_pending -> captured; failed/cancelled/expired/unknown explicit branches. Settlement is a separate per-amount allocation state: pending -> partial -> settled -> reconciled/exception. Refund and dispute are separate aggregates; do not encode a refunded settled payment as if capture never occurred.
Refund: requested -> policy_checked -> awaiting_approval -> approved -> submitted -> processing -> partial/succeeded/failed/unknown. Requester cannot approve where independent review applies. Lock refundable amount against concurrent refunds; fees/chargebacks require accepted accounting policy.
Invoice: draft -> approved -> issued -> open -> partially_paid -> paid; void/writeoff/overdue/disputed separately represented with history. Subscription states and payment-plan states versioned; unpaid access/grace behavior explicitly approved.

## Ledger invariants
Integer minor units and explicit currency/exponent; per-book/currency balance; no cross-currency pseudo-balance; append-only posted journals; correction by linked reversing/replacement entries; pre-post validation plus DB transactional constraints; source event/object uniqueness; materialized balances rebuildable; effective/recorded timestamps distinct. Operational ledger is not asserted GAAP/IFRS-complete without accountant acceptance.

## Webhooks and adapters
Verify exact raw bytes and signature/tolerance; durably dedupe event ID per provider/account; same resource/business transition may require additional semantic dedupe. Enqueue durable handling then acknowledge. Do not order by receipt or coarse created timestamp. Fetch/reconcile authoritative objects for uncertain/out-of-order events. Adapter interface: createAttempt, confirm/getAttempt, capture, cancel, create/getRefund, listSettlements, normalizeVerifiedEvent. Commands carry idempotency, scope, source refs and correlation; retries never imply payment failed.

## Acceptance
Balanced and concurrent journal/refund tests; duplicate/out-of-order webhook; charge timeout after provider success; partial captures/refunds; settlement fees/disputes; entitlement rollback; multi-currency denial; merchant/book isolation; accountant/payment counsel/PCI review; current commercial/customer authority; operated reconcile/restore/incident/support before activation.


# Operations OS, workflow runner and Inbox
Existing #/console and RPC/client/policy model must be extended. Design /app/ops/* routes are information-architecture targets, not verified new router roots. route.ts is custom hash router; known view allowlists do not prove console authorization. Existing docs describe Console.tsx, console/client.ts, lib/ops/console.ts and request_approval/decide_approval/console_act. Revalidate current code before patching. SQL authorization is final; menu visibility never grants data access.

## Controlled actions
Request -> authoritative policy/records -> impact preview -> required approvals -> exact command digest -> dispatch recheck -> fail-closed durable audit -> atomic domain mutation/outbox -> reconciled receipt -> history/notifications -> compensation if authorized. Current console paths are reusable; proposed 14-check chain reconciles different existing checks, not a claim the source runner already implements exactly fourteen.

## Inbox
Canonical work_item has security scope, business/tenant, source event, kind, severity, owner queue/person, required capability, deadline/calendar/timezone, correlation, version, evidence refs and action refs. Store no duplicated student payload. My Work/team/unassigned/overdue/held views. Claim assignment uses optimistic version/lease; no duplicate execution. SLA timers use server time and business calendar. Closing requires resolution/receipt; escalation and notification minimize context.

## Workflow runner
Each step pins workflow version, actor lane, allowed route/screen IDs, data authority, required capabilities/checks, input/output schema, approval rules, dependencies, idempotency, failure class, rollback/compensation and evidence. Prefer explicit actor mappings over regex source heuristics. Simulator cannot mark official completion without durable runtime evidence. View -> draft -> request -> decide -> execute -> reconcile are different transitions.

## Console admission
Fetch current capabilities and scoped workspace discovery. Show Operations only when an eligible workspace is returned. Signed-out/loading/denied/expired/revoked states explicit. #/console deep links repeat checks. Resolve discrepancy between my_capabilities role-grant view and database break-glass-derived capability decisions with a scoped decision endpoint; no broad data fallback. Fresh MFA, independent approvers, break-glass expiry/review and audit-failure denial tested.

## Read models
Return canonical IDs, source, authority, freshness, model version, generated_at/watermark, correlation and accepted completeness. Outbox publisher needs retries/DLQ/checkpoints/monitoring. Bootstrap/rebuild projections in scope; source DB grant boundaries remain authoritative.


# Agent operations — proposed twelve-role manifest
Names in agents.csv are proposed roles, not recovered existing agent IDs. Observe is default and does not authorize external writes. Agents read only individually authorized minimum inputs and draft evidence/recommendations. No grade, registration, payout, account discipline, clinical decision or arbitrary tool call.

Task states queued -> admitted -> observing -> draft_ready -> handoff_pending -> reviewed -> completed; policy_denied/stale/cancelled/failed/escalated explicit. Handoff recipient re-authorizes and validates schema. Parent permission never widens recipient access. Depth <=3 measured from root depth0; max3 successful handoffs TOTAL per task, not per agent. Dedupe on task + source + destination + purpose + input digest; denial cannot consume successful-handoff budget. Concurrent enforcement transactional in production. Cycle rejected.

Failure classes authorization/consent/scope, malformed input, duplicate/cycle/depth/budget, stale source/evidence, external transient, provider outage, timeout uncertain outcome, policy/academic integrity, missing human authority. Only explicitly transient failures get bounded retries under accepted deadline/cost budget; non-idempotent uncertain actions reconcile before retry. Retry does not reset handoff budget. Cancellation propagates; prompt input cannot modify manifest/routes.


# Company workspace and lifecycle
Use shared business graph: account/stakeholder/opportunity, quote/contract/obligation, project/milestone, work/evidence, risk/control, person/vendor/partner, finance journal, monthly package. One canonical record shown in Business Workspace, Company Console, Inbox and Portal.

Document state: draft -> internal_review -> domain_review -> approved -> signature_pending -> executed -> effective -> superseded/expired/terminated -> archived. Hash/version change invalidates approvals; signing authority checked; obligation tasks derive from effective terms; superseded never silently destroyed. Legal-library refs use approved template versions. No actual executed paper created by this kit.

Six swimlanes:
Deal: RevOps qualifies -> Product scopes -> Engineering feasibility -> Finance quote -> Counsel paper -> authorized signers -> Implementation accepts -> Customer activation decision. Required outputs opportunity/quote/order/DPA/security exhibits/UAT, exact scope/authority gates.
Renewal: Success evidence -> RevOps options -> Finance economics -> Counsel changes -> customer approval -> invoice -> updated entitlement; no renewal based on stale outcome claims.
Hiring: manager role/budget -> People process -> independent assessment -> counsel/employment/comp review -> authorized offer -> onboarding/least privilege; candidate data minimized.
Vendor: owner purpose -> Security/Privacy data review -> Finance budget -> Counsel terms -> approval -> provisioning -> risk/renewal/offboarding.
Partner: Platform sandbox -> security/scopes -> commercial/legal -> institution opt-in -> compatibility certification -> monitored publication -> revoke/retire.
Research: purpose/protocol -> classification/consent/institutional review where applicable -> approved access -> de-identified measurement -> findings review -> claim permission; student data never an investor export.

Cadence: daily triage/incident; weekly execution/risk/release/customer review; monthly reconciled close/KPIs/access/vendor obligations/update; quarterly strategy/workforce/roadmap/board as applicable. KPIs versioned with definition, numerator/denominator, period, source, reviewer and limitations. Funding cash is not booked from pipeline; fundraising status not commitment. Hiring/budget targets illustrative until accepted.


# Investor and board portal — current canonical specification
V1 retained as historical/read-only redirect; no second financial metric store. Invitation-only audience grants: board, investor, diligence, observer, preparer, publisher. Reader audiences see approved immutable packages only; preparer edits drafts, not published snapshots; publisher requires separate accepted review and cannot bypass finance/disclosure acceptance. Board rights derive from actual governance/agreements, not label. Company roles never receive student records.

Six-question overview: What changed? What is demonstrably delivered? What traction is authorized and measured? What is cash/runway with assumptions? What are material risks/decisions? What help is requested?
Monthly package pins accounting close, metric-definition versions, source watermarks, cash forecast scenario, pipeline stage snapshot, risk/control status, documents, claim permission and audience policy. Publish creates immutable package/hash/audit. Correction creates new version with reason, approver, supersedes pointer; original retained and clearly marked. Withdraw exposure when needed while retaining audit.

Reconciled actual versus forecast separate. Cash runway calculated from scenario monthly cash paths; unknown cash/expenses => unknown, not zero or infinity. Pipeline never presented as contracted ARR. Minimum-cell suppression and re-identification review before aggregates; labels and identifiers can themselves leak. Data room per-item access/download/expiry/classification and access history; invite revocation stops future retrieval, cannot erase already downloaded copies.

Acceptance: wrong audience/deep link denied; preparer cannot self-publish; correction preserves original; metric/finance variance explained; revocation, suppression, restore/export and disclosure tests. No live company performance invented.


# Platform explorer and Master Control
Older native-platform README: 24 domains/659 screens. Newer native-data.js excerpt adds H1 Native Financial Platform with 33 modules, consistent with 25/692. This kit does NOT invent unretrieved screen rows or assert deployed routes. Recompute from full canonical source and pin source hash; classify module specification vs actual route/component before claiming coverage.

Registry contract: domain/screen/capability/workflow/role/source/branch/owner/evidence IDs; scope/authority/classification; existing component/route refs only after verification; design-route separate; states/accessibility/tests/dependencies/phase/status. Stable IDs and duplicate alias map. Generate counts and docs from same registry; CI rejects dangling step routes, capabilities, undocumented high-impact actions and unaccepted authority.

Master Control links product, existing console/API, business workspace, company site and design system through manifests and evidence; no iframe bypass or shared admin wildcard. Environment/scope indicators persistent. Search permission-filtered, no restricted titles. A change shows dependent workflow, route, permission, schema, policy, test and disclosure impact.

Native authority retained: parity, data authority, accessibility, security, privacy, isolation, audit, migration, reconciliation, dual run, institution approval, support, rollback, portability, commercial readiness, outcomes. Broader modules remain in scope; implementation sequence is not scope removal. Native HR/payroll/procurement/aid/academic systems need explicit contracts and professional/institution acceptance where applicable.
