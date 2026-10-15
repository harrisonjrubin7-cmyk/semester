# Semester commercial readiness

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner** | Harrison Rubin |
| **Result** | **No-go for a paid institutional pilot** (`GO-NO-GO-DECISION.md`, 2026-10-03). Nothing here changes that. |
| **Marker** | `H` = needs a human, a counterparty or money. The repository cannot close it. |

## Bottom line

There is no customer, no counsel, no approved price book and no signed paper.
The repository has the database schema, drafts and playbooks to run a sale; it
has not run one. The claims register (`app/src/lib/ops/claims.ts`) reportedly
holds 0 of 40 claims as "available". Do not claim GA, enterprise readiness, a
customer, or paid-pilot readiness. The company site itself says "Semester has no
customer results yet" (`company-site/index.html:445`).

## Pilot completion gates

| Gate | Evidence required | Today |
| --- | --- | --- |
| Commercial | Executed agreement or order form | none (`contracts/` empty) |
| Security | Approved scope, DPA and security path, data map | drafts |
| Implementation | Tenant configured, owners assigned, training planned | none |
| Launch | Users invited, support live, rollout approved | none |
| Adoption | Activation baseline established | not instrumented |
| Outcome | Success metrics agreed and measured | none |
| Executive | Midpoint and final sponsor review completed | none |
| Conversion | Annual decision made or next action recorded | none |

## Company readiness artifacts (Phase 5)

| Artifact | State | Path | Gap |
| --- | --- | --- | --- |
| Legal entity | `H` | `docs/LAUNCH-DECISIONS.md` #4; `HECVAT_DRAFT_RESPONSE.md` COMP-01 | "LLC by attestation, 28 Sep". Legal name, state, formation date and certificate are not recorded. EXT-001 open. |
| IP status | partial `H` | `IP.md`; `docs/legal-drafts/IP-ASSET-INVENTORY-TEMPLATE.md` | Vanderbilt ownership determination unsent; inventory is a template of `[TBD]` fields |
| Contract library | drafts | `docs/legal-drafts/` (72 files), `docs/legal/` (17) | 79 and 68 `[DECIDE]` markers; 0 rows closed in `LEGAL_REVIEW_QUEUE.md`; no counsel |
| Pricing and packaging | hypotheses, conflicting | `docs/commercial/PRICING-AND-PACKAGING.md` ("NO CURRENT PRICE BOOK OR SELLING AUTHORITY"); `docs/finance/`; `app/src/lib/plans.ts` | Only Plus ($7.99/mo, $59/yr) is stated as fact. Three inconsistent institutional number sets; site shows "From $15K / yr" (`index.html:660`) which appears in no doc, code or model; pilot fee is $27,000 in one document, $10–30k in `launchkit.ts`, none on the site; marketplace take rate 12 % vs 15 %, neither approved (D-1236) |
| Financial model | hypotheses | `docs/finance/semester-financial-model.xlsx`, `assumption-register.md` | "NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST"; opening cash $0 is a placeholder; financing rounds illustrative |
| Cash and runway dashboard | partial `H` | `docs/finance/dashboard.html`, `docs/company/BUDGET-AND-CASH-RUNWAY-TEMPLATE.md` | runs on model inputs; real bank and cash data not in the repository |
| CRM and account list | schema only | `gtm_*` (~25 tables), `site_leads`, `CRM-DATA-MODEL.md` ("OPERATED CRM UNPROVEN") | no UI; no accounts |
| Sales process | docs | `docs/commercial/SALES-PLAYBOOK.md`, `SALES-PIPELINE-DEFINITIONS.md`, `DISCOVERY-CALL-SCRIPT.md` | non-activation playbook; paid path blocked |
| Pilot proposal | template | `PILOT-PROPOSAL-TEMPLATE.md` | `[REQUIRED]` fields |
| Mutual Action Plan | not found as a named artifact | closest: `STAGE-COLLATERAL-AND-HANDOFF.md`, `IMPLEMENTATION-PLAN-TEMPLATE.md` | write one |
| Security / procurement room | partial | `trust_room_*`, `functions/trust-room`, `TrustRoom.tsx` | the site describes an NDA and document room; the 2026-10-04 gap matrix found no secure room behind it beyond `trust_room_requests` |
| HECVAT roadmap | draft | `docs/trust/HECVAT-READINESS-MATRIX.md`, `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` | "DRAFT, not sent", "NOT A COMPLETED HECVAT" |
| Trust Center | partial | `docs/TRUST-CENTER.md` (an in-app flag), `company-site/site.js`, `docs/trust/*` (65 files) | site states "SOC 2 report not held"; no pen test, no ACR |
| Customer onboarding | docs | `CUSTOMER-ONBOARDING-PLAYBOOK.md`, `docs/pilot/*`, `docs/launch/*` | "NO CUSTOMER ONBOARDING COMPLETED" |
| Implementation project plan | template + tables | `IMPLEMENTATION-PLAN-TEMPLATE.md`, `implementation_projects`, `docs/institutional-implementation/*` | no instance |
| Customer health | code, no accounts | `compute_account_health()`, `account_health_snapshots` | no UI caller; zero customers |
| Support model | docs + code | see [support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md) | red |
| Renewal and expansion | DB + docs | `renewal_opportunities`, `RENEWAL-AND-EXPANSION-PLAYBOOK.md` | "NO RENEWAL, EXPANSION OR ANNUAL CONVERSION EVIDENCED" |
| Marketing site | exists, drift | `company-site/` | 24/7 and 6–8 week claims not backed; deploy state `H` |
| Lead intake | code | `functions/lead-intake`, `submit_site_lead`, `site_leads` | notification needs `RESEND_API_KEY` and `LEAD_NOTIFY_EMAIL`; set/deployed unknown `H`; no UI to read `site_leads` |
| Content engine | partial | `content_register`, `claims_register`, `CONTENT-AND-COMMUNITY-PLAN.md` | cadence is hypothesis |
| Analytics | constrained | `ANALYTICS.md` | three marks; see [pilot](SEMESTER_PILOT_DELIVERY_FACTORY.md) |
| Board and investor reporting | docs, no board | `docs/finance/09-BOARD-REPORTING-PACKAGE.md`, `docs/strategy/BOARD-MEMO.md` | no governing body exists |
| Hiring and capacity plan | draft | `docs/finance/12-GATED-HIRING-SCHEDULE.md` | hypotheses; none evidenced |
| Vendor register | partial | `docs/SUBPROCESSORS.md`, `lib/trust/subprocessors.ts` | EXT-017 provider DPAs open |
| Risk register | several | `LAUNCH-RISK-REGISTER.md`, `docs/company/RISK-REGISTER.md`, `docs/program/RISK_REGISTER.md`, `docs/strategy/RISK-REGISTER.md` | overlapping; [burn-down](SEMESTER_RISK_BURN_DOWN.md) names one |
| Operating cadence | proposed | `docs/company/leadership-system/09-calendar.md` ("PROPOSED — NOT ADOPTED") | [adopted here](SEMESTER_COMPANY_OPERATING_CADENCE.md) once the founder confirms |

## Lead → reference factory

Lead → discovery → scoped pilot → security and procurement → contract →
implementation → admin training → user launch → adoption → weekly review →
midpoint review → outcome report → annual conversion → expansion → reference.

Stages 1–4 have playbooks and tables; stages 5–15 have the
[pilot factory](SEMESTER_PILOT_DELIVERY_FACTORY.md).

## What the founder must decide

These are decisions, not findings. Each becomes `docs/decisions/D-<pull request
number>.md` once its pull request is open.

1. Pilot wedge, cohort size, term, length and the two or three success metrics.
2. One price book: pilot fee, annual price bands, and whether the site prints
   any price. Reconcile the three number sets.
3. Which public claims to withdraw today (24/7, 6–8 weeks, price band, any
   Trust Center wording that overstates).
4. Whether the first pilot is paid, or an unpaid design partnership on a
   synthetic or manual-data basis until the go/no-go conditions are met.
5. Counsel: whom, for what scope, and the queue owner.
6. Who the second seat is for support and incident response.

## What the repository can do without those decisions

- Reconcile the public site to what the register supports.
- Build the operator spine and pilot screens on a synthetic tenant.
- Prepare the 100-account target list structure in the CRM tables.
- Fill the discovery evidence log as conversations happen
  (`docs/pilot/DISCOVERY-EVIDENCE-LOG.md`; scorecard blank by design).

## What it cannot do

Sign anything, form the entity, engage counsel, speak to a buyer, open a bank
account, receive money, staff a rota or witness a drill. These appear as `H`
in the [90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md).

## Commercial gates

| Gate | Passes when |
| --- | --- |
| C-1 Claims | Every public claim cites an available row in the claims register |
| C-2 Paper | Counsel-reviewed pilot agreement, DPA and order form filed |
| C-3 Price | Approved price book; site and model agree |
| C-4 Entity | Entity, signing authority, tax, insurance, bank facts recorded |
| C-5 Pipeline | 100-account list operated; 15–25 conversations logged |
| C-6 Pilot | Executed pilot with a named champion |
| C-7 Conversion | Outcome report and annual decision filed |
