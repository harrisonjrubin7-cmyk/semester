# Existing versus missing: inventory and reconciliation

| Control | Value |
| --- | --- |
| Status | **DRAFT INVENTORY. NOT AN APPROVAL OF ANY ARTIFACT LISTED.** |
| Owner | Harrison Rubin (interim; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` (after `git fetch origin main`; nothing matching this work had landed) |
| Labels used | `[VERIFIED]` `[DRAFT]` `[INTERNAL]` |
| Audience | Internal |

> Operating document. It is not legal, tax, accounting, insurance, privacy, security or accessibility advice.

Label legend: `[VERIFIED]` means a path in this repository proves the statement; `[DRAFT]` needs review; `[INTERNAL]` is not for customers. There is no `[APPROVED]` item in `docs/business/`: no named approver is recorded for any customer-facing wording.

## Method

1. `git fetch origin main` and a search of the last 60 commits for the defects themselves (finance, pricing, pilot, GTM, HECVAT, trust). The finance dashboard (`429700d`), gated hiring and pilot-evidence plan (`82e7bdd`), commercial revenue-operations architecture (`4f63f34`) and the GTM plan gaps (`04c3468`) had already landed. Nothing duplicated the in-app model, the email sequences or the PDFs.
2. Read of `docs/commercial/` (about 45 documents), `docs/finance/`, `docs/trust/` (about 60), `docs/legal-drafts/`, `docs/market-readiness/`, `docs/gtm/`, `docs/institutional-readiness/`, `docs/company/`, `docs/pilot/`, the go/no-go and claims registers, and `app/src/lib/gtm/*`.
3. Each requested artifact below was matched to what exists. Where an existing document already covers the ground, the new file says so in its own "Relationship to existing artifacts" table and adds only the delta.

**Status vocabulary:** current, incomplete, stale, duplicate, missing, needs review.

## Authority order `[VERIFIED]`

When sources disagree the higher line governs (from [`docs/commercial/README.md`](../commercial/README.md), extended here):

1. Code and tests: `app/src/lib/gtm/stages.ts`, `pilot.ts`, `rfp.ts`, `app/src/lib/governance/deal-desk.ts`, `app/src/lib/ops/claims.ts`.
2. [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) and [`EVIDENCE-REGISTER.md`](../../EVIDENCE-REGISTER.md).
3. [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md).
4. `docs/commercial/`, then `docs/finance/`, then `docs/market-readiness/`.
5. The founder's brief and the uploaded planning PDFs. They are planning input, not evidence.

## What the go/no-go allows `[VERIFIED]`

Individual acquisition: conditional, invitation-only, unpaid. Design-partner institutional pilot: GO for **non-activation** work only (discovery, synthetic demos, evidence exchange, conditional scoping). **Paid institutional pilot: NO-GO/RED.** Broad enterprise sale: NO-GO/RED. Every sales artifact in `docs/business/` carries a Gate section saying what is allowed now and what is held.

## 1. Go-to-market

| Requested | Existing | Status | New in `docs/business/` | Why new |
| --- | --- | --- | --- | --- |
| Master GTM playbook (A to J) | [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](../INSTITUTIONAL-GTM-PLAYBOOK.md), [`docs/gtm/EXECUTION-PLAN.md`](../gtm/EXECUTION-PLAN.md), [`docs/gtm/GROWTH-OPERATING-PLAN.md`](../gtm/GROWTH-OPERATING-PLAN.md), [`docs/gtm/BRAND-AND-MARKETING-STRATEGY.md`](../gtm/BRAND-AND-MARKETING-STRATEGY.md), `docs/commercial/*` | incomplete: parts exist, no single index with the brief's ten sections | [`gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md`](gtm/SEMESTER_MASTER_GTM_PLAYBOOK.md) | One entry point that links the canonical documents and adds the delta; it does not restate them |
| Customer-safe playbook | none | missing | [`gtm/SEMESTER_MASTER_GTM_PLAYBOOK_CUSTOMER_SAFE.md`](gtm/SEMESTER_MASTER_GTM_PLAYBOOK_CUSTOMER_SAFE.md) | Internal and external versions must be separate; the safe one carries only evidenced or conditional wording |
| 30/60/90 plan | [`30-60-90-DAY-EXECUTION-PLAN.md`](../../30-60-90-DAY-EXECUTION-PLAN.md), [`docs/90-DAY-LAUNCH-PROGRAM.md`](../90-DAY-LAUNCH-PROGRAM.md), [`docs/market-readiness/90-DAY-MARKET-READINESS-PLAN.md`](../market-readiness/90-DAY-MARKET-READINESS-PLAN.md) | stale on one point: two of them schedule a pilot signature that the paid-pilot NO-GO forbids | [`gtm/SEMESTER_90_DAY_GTM_PLAN.md`](gtm/SEMESTER_90_DAY_GTM_PLAN.md) | Reconciles them and names what is authoritative for what |
| KPI tree | `app/src/lib/gtm/kpi.ts`, [`docs/commercial/ANALYTICS-AND-METRICS-DICTIONARY.md`](../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md), [`docs/market-readiness/METRIC-DICTIONARY.md`](../market-readiness/METRIC-DICTIONARY.md) | incomplete: definitions exist, no tree | [`gtm/SEMESTER_GTM_KPI_TREE.md`](gtm/SEMESTER_GTM_KPI_TREE.md) | Adds the tree, cadence and actual-versus-forecast rule |

## 2. Finance

| Requested | Existing | Status | New | Why new |
| --- | --- | --- | --- | --- |
| Interactive financial model | [`docs/finance/semester-financial-model.xlsx`](../finance/semester-financial-model.xlsx), [`docs/finance/dashboard.html`](../finance/dashboard.html) (standalone, generated from the workbook) | incomplete: not in the app, no funnel or pilot driver, no CSV/Markdown export, no unit tests in `app/` | `app/src/finance/` (Console **Finance model** tab), [`finance/FINANCIAL_MODEL_SPEC.md`](finance/FINANCIAL_MODEL_SPEC.md) | The brief asks for a tool inside the app architecture with validation, exports and tests. It complements, and does not replace, the workbook |
| Pricing and packaging | [`docs/commercial/PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md), [`PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md), [`docs/finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`](../finance/02-PRICING-PACKAGING-ENTITLEMENTS.md) | needs review: four student prices conflict (below) | [`finance/PRICING_AND_PACKAGING.md`](finance/PRICING_AND_PACKAGING.md) | Holds the brief's assumptions as labelled model inputs with a conflict table; not a price book |
| Unit economics | [`docs/finance/04-UNIT-ECONOMICS.md`](../finance/04-UNIT-ECONOMICS.md), `docs/commercial/unit-economics-model.py` | incomplete for the pilot-led model | [`finance/UNIT_ECONOMICS.md`](finance/UNIT_ECONOMICS.md) | The brief's five formulas on the lean model, with sensitivity |
| Scenarios, board pack, hiring gates, pilot evidence plan | [`docs/finance/07-SCENARIOS-AND-SENSITIVITY.md`](../finance/07-SCENARIOS-AND-SENSITIVITY.md), [`09-BOARD-REPORTING-PACKAGE.md`](../finance/09-BOARD-REPORTING-PACKAGE.md), [`11-PILOT-EVIDENCE-PLAN.md`](../finance/11-PILOT-EVIDENCE-PLAN.md), [`12-GATED-HIRING-SCHEDULE.md`](../finance/12-GATED-HIRING-SCHEDULE.md) | current | none; linked | Not duplicated |

## 3. Sales

| Requested | Existing | Status | New | Why new |
| --- | --- | --- | --- | --- |
| Email sequences (15) | [`docs/market-readiness/EMAIL-LIFECYCLE.md`](../market-readiness/EMAIL-LIFECYCLE.md) (lifecycle emails, not account-based outreach) | missing | [`sales/PILOT_SALES_EMAIL_SEQUENCES.md`](sales/PILOT_SALES_EMAIL_SEQUENCES.md) | No outreach, post-demo, pilot or renewal sequence existed |
| Discovery script | [`docs/commercial/DISCOVERY-CALL-SCRIPT.md`](../commercial/DISCOVERY-CALL-SCRIPT.md), [`docs/market-readiness/DISCOVERY-CALL-PLAYBOOK.md`](../market-readiness/DISCOVERY-CALL-PLAYBOOK.md) | current | [`sales/DISCOVERY_CALL_SCRIPT.md`](sales/DISCOVERY_CALL_SCRIPT.md) | Adds the brief's rubric, demo and design-session agenda; links the originals |
| Pilot proposal | [`docs/commercial/PILOT-PROPOSAL-TEMPLATE.md`](../commercial/PILOT-PROPOSAL-TEMPLATE.md), [`docs/legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md`](../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md) | current | [`sales/PILOT_PROPOSAL_TEMPLATE.md`](sales/PILOT_PROPOSAL_TEMPLATE.md) | Adds the metric table and the open pilot-length decision field |
| Mutual Action Plan | none as a template | missing | [`sales/MUTUAL_ACTION_PLAN_TEMPLATE.md`](sales/MUTUAL_ACTION_PLAN_TEMPLATE.md) | |
| Objection library | [`docs/market-readiness/OBJECTION-HANDLING.md`](../market-readiness/OBJECTION-HANDLING.md) | stale: offers a SOC 2 remediation plan and a read-only integration that the claims register does not support | [`sales/OBJECTION_HANDLING_LIBRARY.md`](sales/OBJECTION_HANDLING_LIBRARY.md) | Within the claim ceiling, with a table of where older sources overreach |
| CRM pipeline | [`docs/commercial/SALES-PIPELINE-DEFINITIONS.md`](../commercial/SALES-PIPELINE-DEFINITIONS.md), [`CRM-DATA-MODEL.md`](../commercial/CRM-DATA-MODEL.md), `stages.ts` | incomplete: seven funnel stages have no code stage | [`sales/CRM_PIPELINE_DEFINITION.md`](sales/CRM_PIPELINE_DEFINITION.md) | Crosswalk with the gaps, 100-account template, forecast rules |
| Pilot agreement outline | [`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](../trust/PILOT-AGREEMENT-OUTLINE.md), [`docs/legal-drafts/PILOT-AGREEMENT-DRAFT.md`](../legal-drafts/PILOT-AGREEMENT-DRAFT.md) | needs review: the trust outline's sample scope (up to 500 students, SSO and LTI included) conflicts with the 10 to 200 bound and the claims register | [`templates/PILOT_AGREEMENT_BUSINESS_OUTLINE.md`](templates/PILOT_AGREEMENT_BUSINESS_OUTLINE.md) | Business outline for counsel, not binding text |

## 4. Customer success and templates

| Requested | Existing | Status | New |
| --- | --- | --- | --- |
| Onboarding, success plan, health score, renewal | `docs/commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md`, `PILOT-SUCCESS-PLAN.md`, `CUSTOMER-HEALTH-SCORE.md`, `RENEWAL-AND-EXPANSION-PLAYBOOK.md`, `docs/market-readiness/*` | current, but two health-score weightings disagree with the brief's | [`customer-success/`](customer-success/ONBOARDING_WORKFLOW.md) (four files; the health score is a reconciliation and flags the canonical choice as open) |
| Weekly revenue review, weekly pilot report, midpoint review, final value report, QBR, ROI inputs | [`docs/institutional-readiness/PILOT-WEEKLY-BUSINESS-REVIEW.md`](../institutional-readiness/PILOT-WEEKLY-BUSINESS-REVIEW.md), `PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`, [`docs/market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md`](../market-readiness/EXECUTIVE-WEEKLY-BUSINESS-REVIEW.md), [`docs/commercial/ROI-MODEL-AND-BUSINESS-CASE.md`](../commercial/ROI-MODEL-AND-BUSINESS-CASE.md) | incomplete: no fill-in templates | [`templates/`](templates/WEEKLY_REVENUE_REVIEW.md) (eight files) |
| Risk register template | [`docs/company/RISK-REGISTER.md`](../company/RISK-REGISTER.md), [`docs/strategy/RISK-REGISTER.md`](../strategy/RISK-REGISTER.md), [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) | duplicate-prone: three registers, different scope | [`templates/RISK_REGISTER.md`](templates/RISK_REGISTER.md): a GTM and commercial register with 28 risks; states its delta |

## 5. Security, privacy and compliance

The repository already holds a large, controlled trust layer. The ten files in [`compliance/`](compliance/CLOUD_SECURITY_PLAN.md) are consolidated, implementation-oriented **views** over it, with the per-control columns the brief asks for. They do not restate controls and they cite evidence paths.

| Requested | Canonical existing | Status | New |
| --- | --- | --- | --- |
| Cloud security plan | [`docs/trust/INFORMATION-SECURITY-PROGRAM.md`](../trust/INFORMATION-SECURITY-PROGRAM.md), [`SECURITY-OVERVIEW.md`](../trust/SECURITY-OVERVIEW.md), `SECURITY.md` | current | [`compliance/CLOUD_SECURITY_PLAN.md`](compliance/CLOUD_SECURITY_PLAN.md), [`DATA_SECURITY_CHECKLIST.md`](compliance/DATA_SECURITY_CHECKLIST.md) |
| Compliance evidence register | [`docs/trust/EVIDENCE-REGISTER.md`](../trust/EVIDENCE-REGISTER.md), [`EVIDENCE-REGISTER.md`](../../EVIDENCE-REGISTER.md) | incomplete: lacks the brief's columns (reviewer, last and next review, procurement impact) | [`compliance/COMPLIANCE_EVIDENCE_REGISTER.md`](compliance/COMPLIANCE_EVIDENCE_REGISTER.md) (99 rows, reconciled) |
| Trust Center inventory | [`docs/TRUST-CENTER.md`](../TRUST-CENTER.md), `app/src/screens/TrustRoom.tsx` | needs review: `TrustCenter.tsx` is a student data-controls screen, not the procurement channel | [`compliance/TRUST_CENTER_INVENTORY.md`](compliance/TRUST_CENTER_INVENTORY.md) |
| HECVAT roadmap, questionnaire library | [`docs/trust/HECVAT-READINESS-MATRIX.md`](../trust/HECVAT-READINESS-MATRIX.md), [`SECURITY-QUESTIONNAIRE.md`](../trust/SECURITY-QUESTIONNAIRE.md), [`docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) | stale rows: see findings | [`HECVAT_ROADMAP.md`](compliance/HECVAT_ROADMAP.md), [`SECURITY_QUESTIONNAIRE_LIBRARY.md`](compliance/SECURITY_QUESTIONNAIRE_LIBRARY.md) |
| Data inventory, retention and deletion | [`docs/trust/DATA-INVENTORY.md`](../trust/DATA-INVENTORY.md), [`DATA-RETENTION-AND-DELETION-STANDARD.md`](../trust/DATA-RETENTION-AND-DELETION-STANDARD.md), [`docs/DATA-RETENTION-EXPORT-DELETION.md`](../DATA-RETENTION-EXPORT-DELETION.md) | current | [`DATA_INVENTORY_TEMPLATE.md`](compliance/DATA_INVENTORY_TEMPLATE.md), [`DATA_RETENTION_DELETION_PLAN.md`](compliance/DATA_RETENTION_DELETION_PLAN.md) |
| Incident response | [`docs/trust/INCIDENT-RESPONSE-PLAN.md`](../trust/INCIDENT-RESPONSE-PLAN.md), [`SECURITY-INCIDENT-RUNBOOK.md`](../trust/SECURITY-INCIDENT-RUNBOOK.md) | current | [`INCIDENT_RESPONSE_PLAN.md`](compliance/INCIDENT_RESPONSE_PLAN.md) |
| Vendor risk register | [`docs/trust/VENDOR-RISK-REGISTER.md`](../trust/VENDOR-RISK-REGISTER.md), `app/src/lib/trust/subprocessors.ts` | current | [`VENDOR_RISK_REGISTER.md`](compliance/VENDOR_RISK_REGISTER.md) (the 19 parties in code) |

## 6. Reports and PDFs

| Requested | Existing | Status | New |
| --- | --- | --- | --- |
| Combined PDF report; executive summary; board/investor; pilot and procurement pack | The founder's uploaded `semester_gtm_playbook.pdf` (planning input); `docs/expansion/*.pdf` (earlier, unrelated reports) | missing | `output/*.pdf` built by `app/scripts/generate-gtm-pdf.mjs` from [`reports/`](reports/EXECUTIVE_SUMMARY.md) |

## Conflicts found, and what was done `[VERIFIED]`

| # | Conflict | Sources | Handling |
| --- | --- | --- | --- |
| 1 | Pilot length | `PILOT_WEEKS = 26` (`pilot.ts`, D-134); the brief says 8 to 12 weeks | Open founder decision. The model has an input; templates carry a decision field |
| 2 | Student price | D-134 $7.99 / $59; D-1154 $15 per month; Pro $14.99 / $99 in the architecture proposal; brief $8.99 / $69 | None approved (CLM-015). The brief's numbers are labelled model inputs |
| 3 | Institutional price | The brief's $18 per enrolled student with $30,000 minimum sits between the deal-desk department ($25,000) and campus ($75,000) minimums; unit unstated in D-1154 | Input only |
| 4 | AI pool versus cost | 2,400 requests per student per year costs more than the $18 platform fee at the architecture document's blended per-call figure; the overage price is below that cost; "request" is not the architecture's unit | Flagged; model exposes it with a High AI scenario and a grid |
| 5 | Marketplace commission | Finance workbook 15%; brief 12% | Brief's 12%, off by default, separate line |
| 6 | Paid pilot | NO-GO/RED versus the brief's pilot-to-annual motion; two older 90-day plans schedule a signature | Every artifact has a Gate section; the model has a gate month and a critical banner |
| 7 | Premium support minimum | 15% of a 5,000-student fee is $13,500, so the $15,000 minimum applies | Modelled as the greater of the two |
| 8 | Stage model | `stages.ts` has no stage for Contacted, Success achieved, Annual conversion or Dormant; `live` maps to account status `customer`, which would read a design-partner pilot as a customer | Crosswalk lists the gaps; no stage identifier was invented |

## Findings in existing artifacts that this work did not change `[INTERNAL]`

These were found while building the new documents. Existing documents were not edited; each is a decision for its owner.

| Finding | Where | Why it matters |
| --- | --- | --- |
| Public pages say affected accounts are told within 72 hours of a breach | `app/src/site/pages.tsx`; the HECVAT draft | `SECURITY.md` calls this a target pending counsel and `LEGAL-REVIEW-QUEUE.md` L1 queues it. It reads as a commitment `[REVIEW: counsel]` |
| HECVAT draft "Yes" answers exceed the evidence (MFA AAAI-04, transit encryption DATA-03, breach notification INCD-02); AIML-04 says no AI incident runbook exists though one does | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` and register row AI-3 | Do not send the draft |
| Older sources say more than the claims register: local-first "Available now"; sensitive data "never" reaches a consumer model; "Nothing is used to train anything"; "self-assessed" accessibility evidence | RFP library, privacy page, messaging house | Each is a candidate for the claim-withdrawal process (`docs/CLAIM-WITHDRAWAL-RUNBOOK.md`) |
| `PROVIDER-TERMS.md` says Semester has no legal entity; the HECVAT draft records a single-member LLC | `docs/trust/PROVIDER-TERMS.md` | Entity facts must reconcile before any paper `[REVIEW: counsel]` |
| Trust register says a CodeQL scan does not run; a workflow exists and runs conditionally | `.github/workflows/codeql.yml` | Evidence register is stale |
| Trust register reads security-lead and trust-owner seats as vacant; the owner matrix names the founder for every seat | `docs/trust/`, `OWNER-AND-ACCOUNTABILITY-MATRIX.md` | One person holds every seat; a single point of failure |

## Evidence state

**Repository evidence.** Paths above exist at `5eba494`; the compliance, sales and GTM writers each ran a link check.
**Operational evidence.** None for production, dashboards, headers, CI history or any customer.
**Missing proof.** Founder decisions on conflicts 1 to 8; approved named reviewers.

## Claim ceiling

An internal inventory. It makes no statement about customers, security posture or compliance.

## Prohibited claims

Do not cite this inventory as evidence that any control, contract, price or program is approved or operating.

## Professional review required

`[REVIEW: counsel]` entity facts, the 72-hour wording, pricing and pilot paper. `[REVIEW: security]` the HECVAT draft rows. `[REVIEW: accounting]` the finance conflicts.
