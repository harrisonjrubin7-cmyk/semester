# Semester consolidated native execution blueprint

All materials from the preceding delivery consolidated in this archive. Rebuilt from conversation/source context because the original artifact was unavailable; specifications are not completed production software.

## Contents by component
- Native finance platform: specs/native_finance.md
- Native operations OS: specs/operations_workflows_inbox.md
- Native platform explorer: specs/platform_explorer_master_control.md
- Workflow runner: specs/operations_workflows_inbox.md
- Agent operations: specs/agent_operations.md
- Business workspace: specs/company_workspace_workflows.md
- Company OS map: matrices/company_layers_10.csv
- Company console: matrices/company_functions_15.csv
- Company workflows: specs/company_workspace_workflows.md
- Operations entry and gate: specs/operations_workflows_inbox.md
- Product demo: media/demo_storyboard_30s.md
- Investor and board portal: specs/investor_portal.md
- Investor v1 supersession: specs/investor_portal.md
- Master Control: specs/platform_explorer_master_control.md
- Operations Inbox: specs/operations_workflows_inbox.md
- Operations consoles: matrices/consoles_33.csv

## Proposed authorization chain
1. Authenticated principal — Server-derived identity.
2. Scope membership — Current personal/business/institution membership.
3. Environment/release — Approved candidate/config/data mode.
4. Kills/holds — Current server emergency controls.
5. Entitlement/module authority — Contract and approved operating mode.
6. Capability/delegation — Scoped current grant.
7. Role/cohort restrictions — Narrowing policies respected.
8. Classification/purpose — Allowed class/purpose/destination.
9. Consent/retention/legal hold — Applicable sharing/retention constraints.
10. Source/integration authority — Freshness and approved scopes.
11. Domain policy/eligibility — Current academic/finance/domain checks.
12. Independent approval/MFA — Distinct approvers and exact digest.
13. Idempotency/version/preconditions — Current object and unchanged preview.
14. Audit/receipt/dispatch readiness — Fail-closed durable audit and operations.

## Execution milestones
- Days 1–15: Inventory/routes/grants/authority/named owners. Roles: Engineering/Product. Acceptance: Pinned inventory; no duplicate shell.
- Days 16–30: Controlled-action slice; inbox/approval/audit/receipt; finance sandbox. Roles: Backend/Security/Finance. Acceptance: Forged-scope/self-approval/retry/audit-failure tests.
- Days 31–45: Ledger/refunds/entitlements/outbox/reconciliation/alerts. Roles: Finance/Platform/SRE. Acceptance: Balanced posting; replay/order; operated controls.
- Days 46–60: Company workflows and console read models. Roles: Frontend/Operations. Acceptance: Scoped deep links; accessible journeys.
- Days 61–75: Portal/observe agents/workflow runner. Roles: Reporting/AI/Security. Acceptance: Immutable audiences; bounded handoffs.
- Days 76–90: Independent review/UAT/target/drills/decision. Roles: Reviewers/Customer/Operations. Acceptance: Current authority and staffed recovery; no schedule guarantee.

## Complete specifications

# Native finance implementation specification
Semester owns catalog, versioned prices, quotes/order forms, billing accounts, invoices, subscriptions, entitlements, usage, plans/installments, native checkout orchestration, operational ledger, refunds/credits/write-offs, dunning, finance console, forecasting and reconciliation. Regulated adapters handle contracted credential/payment/settlement services. Statutory accounting remains accepted accounting books; no regulatory exemption is implied. Product billing, institution student accounts and marketplace money flows have separate books/legal/authority boundaries. No PAN/CVC in Semester stores, logs or AI.

Reuse and extend commercial_products, commercial_plans, commercial_prices, entitlement_definitions, plan_entitlements, billing_accounts, quotes, contracts, subscriptions, invoices, payment_events, credits_refunds, dunning_cases, cancellation_requests, student_account_entries, student_payment_plans, student_account_reconciliations, student_account_closes. Reconcile handoff 090 fin ledger_accounts/journals/lines, payment_rails/attempts/transitions/provider_events, settlements, refund requests/approvals. Their source presence is not deployment proof.

Checkout: draft -> priced -> terms_accepted -> submitted -> awaiting_confirmation -> completed/failed/expired. Server prices; changed quote invalidates acceptance; browser success is not payment authority.
Payment attempt: created -> method/confirmation/action_required -> processing -> authorized -> capture_pending -> captured; explicit failed/cancelled/expired/unknown branches.
Settlement: pending -> partial -> settled -> reconciled/exception. Refund/dispute are separate aggregates, not erasure of capture.
Refund: requested -> policy_checked -> approval -> submitted -> processing -> partial/succeeded/failed/unknown. Lock remaining refundable amount; requester cannot self-approve where independent review applies.
Invoice: draft -> approved -> issued -> open -> partially_paid -> paid, with void/writeoff/overdue/disputed histories. Version subscription/grace/plan terms separately.

Ledger: integer minor units, explicit currency/exponent; balance per book/currency; append-only posted journals; corrections by linked reversal/replacement; transactional database constraints; source-event and semantic transition uniqueness; effective vs recorded timestamps; rebuildable balances. Local validator is not accounting certification.

Adapter: createAttempt, confirm/getAttempt, capture, cancel, create/getRefund, listSettlements, normalizeVerifiedEvent. Verify raw signed webhooks; durable event and semantic dedupe; retries/order not trusted; fetch/reconcile authoritative resource for uncertainty. Idempotency and correlation scope every command. Timeout never proves failure. No browser-only entitlement grant.

Acceptance: balanced/concurrent posting; concurrent refunds; event duplicates/order; provider success timeout; partial captures/refunds; fees/disputes; multi-currency/book isolation; entitlement rollback; accounting/counsel/PCI acceptance; staffed reconcile/support/restore. Native UI may contain provider-controlled capture only after actual eligibility/implementation review.


# Operations OS, workflow runner and Inbox
Extend existing #/console, Console.tsx, console client and grant/approval/audit paths; do not create a second permission system. Design /app/ops/* routes are not deployed endpoints. Custom route.ts hash routing requires verified mapping. Historical console assessment identifies scoped grants, request_approval, decide_approval, console_act, fresh MFA, independent approvers and fail-closed audit. Reverify actual code and runtime before activation.

Controlled action: request -> validate current authority -> retrieve source state -> exact impact preview -> approval -> canonical action digest -> dispatch recheck -> fail-closed durable audit -> atomic mutation/outbox -> reconciliation -> receipt/history/notifications -> authorized compensation. Changes to target/amount/recipient/scope/payload/preconditions invalidate approval. Proposed fourteen checks in matrix are reconciliation contract, not recovered exact runtime chain.

Workflow steps pin ID/version, actor lane, allowed route/screen, input/output schemas, capability/policy, source authority, approval/MFA, dependencies, idempotency/version, failure/retry, compensation and evidence. Replace regex prototype actor heuristics with explicit versioned mappings. Clickable simulation does not create official completion.

Inbox canonical work_item: scope, source event, kind/severity, queue/person, required capability, deadline/calendar/timezone, correlation/version, evidence and action refs. No copied student payload. My Work/team/unassigned/overdue/held/completed; atomic claim/reassignment; accepted server-time SLA; backup escalation; minimal notifications; receipt-linked resolution.

Entry: sign-in -> server workspace discovery -> show Operations if eligible -> existing console -> screen/API recheck -> scoped views. Loading/denied/expired/revoked/break-glass explicit. Reconcile my_capabilities role-grant view with database break-glass decision using scoped server evaluation; menu visibility never grants access. Test direct deep links, wrong scope, self-approval, MFA, duplicate action and audit failure.

Read models carry canonical/source/authority/freshness/version/watermark/correlation/completeness. Outbox publisher, retries/DLQ, checkpoints, bootstrap and monitoring are runtime requirements. P0 shared controls/inbox/support/release/finance foundations; P1 complete domain operations; P2 authoritative migration/advanced regulated capabilities. Sequence does not remove scope.


# Twelve proposed observe-agent roles
Names in matrix are proposed, not recovered deployed agents. Observe agents read only individually authorized minimum inputs and draft classifications/evidence/recommendations. No grades/enrollment/payments/discipline/clinical decisions/publishing/grants or arbitrary tool execution.

Task: queued -> admitted -> observing -> draft_ready -> handoff_pending -> reviewed -> completed; denied/stale/cancelled/failed/escalated branches. Root depth zero; maximum depth three; maximum three successful handoffs TOTAL per task. Recipient reauthorizes and validates schema; parent cannot widen access. Allowlisted routes; dedupe task/source/destination/purpose/input digest; reject cycles; denial does not consume successful budget. Production counters/state require durable atomic transactions and leases.

Failure classes: authorization/consent/scope; malformed input; duplicate/cycle/depth/budget; stale evidence/source; transient provider; outage; timeout uncertain outcome; integrity/policy; missing human authority. Only accepted transient errors receive bounded deadline/cost retries. Uncertain irreversible outcomes reconcile before retry. Retry cannot reset handoff limits. Cancellation propagates. Prompts cannot rewrite manifests or routes.


# Business workspace and Company OS
One graph: account/stakeholder/opportunity -> quote/contract/obligation -> implementation/milestone -> evidence/risk/work -> support/success/renewal -> finance/reporting. Business Workspace, Console, Inbox and Portal show canonical records; no competing pipeline spreadsheets. Ten layers and fifteen functions are in matrices with role proposals, not appointments or actual KPI values.

Document: draft -> internal_review -> domain_review -> approved -> signature_pending -> executed -> effective -> superseded/expired/terminated -> archived. Hash/version changes invalidate acceptance; signing authority checked; effective terms generate obligations; history retained. Legal library supplies approved versioned templates; kit creates no executed paper.

Deal lanes: RevOps qualifies -> Product scopes -> Engineering feasibility -> Finance quote -> Counsel paper -> signers -> Implementation accepts -> customer activation. Artifacts: opportunity/quote/order/DPA/exhibits/UAT and authority.
Renewal: Success evidence -> RevOps -> Finance -> Counsel -> customer -> invoice -> entitlements. No stale outcome claim.
Hiring: manager role/budget -> People -> independent assessment -> legal/comp review -> signer -> least-privilege onboarding; candidate data minimized.
Vendor: purpose -> Security/Privacy -> Finance -> Counsel -> provisioning -> ongoing risk/renewal/offboarding.
Partner: sandbox -> scopes/security -> commercial/legal -> institution opt-in -> compatibility -> monitored publication -> revoke/retire.
Research: purpose/protocol -> applicable classification/consent/institution review -> access -> de-identified measures -> findings/claim review. No investor export of student records.

Cadence: daily triage/incidents; weekly execution/risk/release/customer; monthly accepted accounting close/KPIs/access/vendors/stakeholder reporting; quarterly strategy/workforce/roadmap/board where applicable. Metrics version definition/numerator/denominator/period/source/reviewer/limitations. Forecast and actual separate. Pipeline not contracted cash/ARR. Hiring/fundraising/economics require accepted authority.


# Current investor and board portal
Invitation-only governed read-only reader workspace. V1 historical redirect/archive; no second metric store. Board/investor/diligence/observer audiences receive exact approved packages under actual agreements, not role labels. Preparer edits drafts only; publisher requires accepted finance/disclosure review. Company roles never student-record access.

Six questions: What changed? What is demonstrably delivered? What authorized/measured traction exists? What is cash/runway with assumptions? What material risks/decisions matter? What help is requested?

Monthly immutable package pins accounting close, metric versions, source watermarks, scenario assumptions, pipeline snapshot, risks, evidence/doc versions, claims and audience. Publish hashes/audits snapshot. Correction creates new version/reason/reviewer/supersedes pointer; retain marked original. Withdraw exposure without destroying audit.

Unknown cash/expenses => unknown runway, not zero/infinity. Actual/forecast separate; pipeline not contracted ARR. Minimum-cell suppression and re-identification review; metadata can leak. Data room item access/download/expiry/classification/history. Revocation stops future retrieval, cannot erase downloaded copies.

Acceptance: wrong audience/deep link denied; no preparer self-publish; corrections preserve original; reconciled finance/definitions; revocation/suppression/restore/export/disclosure tests. No live financial figures invented.


# Native platform explorer and Master Control
Older README 24 domains/659 screens; newer native-data excerpt adds H1 Native Financial Platform with 33 modules, consistent with 25/692. Full 692 rows were NOT recovered in previous answer or this package; no invented screens or deployed routes. Recompute full canonical registry and pin hash.

Every screen: stable domain/screen/capability/workflow ID; canonical object; design vs verified runtime route/component; roles/capabilities; source/authority/freshness/classification; state/accessibility contract; controlled commands; tests/dependencies/phase/owner/branch; six independent maturity facts. Generate counts/docs/explorer/workflow from same registry; reject dangling routes/capabilities/unaccepted high-impact actions. Duplicate aliases preserve links.

Master Control links product, existing console/backend, business OS, company site and design system through manifest/evidence; no wildcard admin/iframe bypass. Persistent environment/scope; permission-filtered search; impact view of policy/data/test/disclosure dependencies.

Authority gates: parity, source authority, accessibility, security/privacy/isolation/audit, migration/reconciliation/dual run, institution approval, support/rollback/export, commercial readiness/outcomes. Broader HR/payroll/procurement/aid/academic work needs explicit sub-capability contracts, not scope erasure.

Business-model source prices are planning only, not accepted economics, selling authority or achieved results. Branch plan proposed, not created. Term-long/two-term gates cannot be replaced by same-day code tests.


# 30-second demo storyboard (not rendered video)
00–05 Scattered synthetic systems: university work should not live in disconnected places.
05–12 Today: one action with source/update time and related course/task.
12–19 Ask Semester: approved source snippets/citations and limits; study guidance.
19–26 Consent: exact recipients/content/expiry/consequences; student chooses.
26–30 Existing Semester mark: Designed for one connected education experience.
Captions and equivalent transcript; prototype/sample labels; truthful availability; no customer/student/logo without permission. Rendering and claims approval remain separate.


## Status and acceptance
Nineteen local reference tests passed; no browser, provider, DB or deployment testing. All branches/owners/authority still proposed or unresolved. First activation proof: eligible operator -> owned item -> evidence -> consequence preview -> independent approval -> permitted command -> durable receipt -> reconciled state -> audited authorized reporting.
