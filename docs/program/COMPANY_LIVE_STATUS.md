# Semester — company live status (Phase 0)

**Date:** 2026-10-04 · **Companion:** [`../../commercial/GO_TO_MARKET_READINESS.md`](../../commercial/GO_TO_MARKET_READINESS.md) · **Controlling:** [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)

Legend: **R** = real operating artifact (named owner, date, evidence) · **T** = template/draft/aspirational · **ABSENT** = nothing in the repo. Marks V/A/N as in the baseline.

## 1. Entity and facts of the company

| Item | State | Evidence |
| --- | --- | --- |
| Legal entity, jurisdiction, EIN, signing authority | **ABSENT.** "No legal entity to be the party"; contracts name `[SEMESTER LEGAL ENTITY]` | `LEGAL-REVIEW-QUEUE.md` L0 row; `docs/company/CORPORATE-GOVERNANCE-CHECKLIST.md:21`; `contracts/README.md` (A) |
| Counsel | **ABSENT** (primary and backup unassigned) | `LEGAL-REVIEW-QUEUE.md` header |
| Bank, accountant, insurance | **ABSENT.** Opening cash in the model is a $0 placeholder; founder is "accountant of record" (D-1154) | `docs/finance/13-REAL-NUMBERS-INTAKE.md`; `INSURANCE-READINESS-CHECKLIST.md` (A) |
| Domain / email ownership | **PARTIAL.** Site canonical `https://www.semester.website/`; app hosted at `harrisonjrubin7-cmyk.github.io`; billing/support contact is a personal Gmail address | `company-site/index.html`; claims register (A) |
| Customers / signed pilots / design partner | **ABSENT** | `ops/customer-commitments/README.md` (A) |
| Paying individual users | **PARTIAL:** one $7.99 acceptance purchase; checkout held | evidence file above (A) |
| People | One person (Harrison Rubin) primary on nearly every seat; backups unassigned | `OWNER-AND-ACCOUNTABILITY-MATRIX.md`; `FR-006` (A) |

## 2. Function-by-function

| Function | State | Evidence | What makes it operate |
| --- | --- | --- | --- |
| Pricing / plans / entitlements | **T** + code | `app/src/lib/plans.ts`, `docs/COMMERCIAL-CORE.md`; `docs/commercial/PRICING-AND-PACKAGING.md` "NO CURRENT PRICE BOOK OR SELLING AUTHORITY" | Owner-approved price book, one source |
| AI / storage metering | **R (AI), T (storage)** | `ai_spend_meter` migration; finance A-105 is cost not price | Overage billing decision |
| Quotes / subscriptions / invoices / dunning | **R (schema, individual)**, **T (institution)** | `20260929070000_commercial_core.sql`; `REVENUE-OPERATIONS-ARCHITECTURE.md` gaps | Institutional collections, opportunity table |
| Deal desk | **T** in code | `app/src/lib/governance/deal-desk.ts` `DEAL_POLICY` | Thresholds approved by an authority matrix entry |
| ICP, personas, discovery, playbook | **T** | `docs/commercial/IDEAL-CUSTOMER-PROFILE.md`, `SALES-PLAYBOOK`, `DISCOVERY-CALL-SCRIPT` | Real pipeline data |
| Sales deck | **ABSENT** | only course decks in `app/public/decks` | Build after claims approval |
| Demo environment | **PARTIAL** | `server/institution/sandbox.ts`; 30-day keys | Synthetic-data demo script (non-activation GO) |
| ROI calculator | **T** | `company-site/index.html:~1268` "never guarantees" | Approved assumptions |
| RFP / security questionnaire / HECVAT | **T** | `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`, `docs/trust/SECURITY-QUESTIONNAIRE.md`; HECVAT workbook "not filled in" | Evidence-backed answers |
| Marketing site / pricing page / trust center | **R** (site), claims-controlled | `company-site/index.html`; `ops/claims/README.md` | Fix C3/C4 conflicts |
| Customer success / pilot method / QBR | **T** | `docs/pilot/*`, `docs/commercial/*PLAYBOOK*`; QBR tables empty | A pilot to run it on |
| Help center | **R-partial** | 12 articles `docs/support/articles` | Staffing |
| Ticketing | **R (schema)** | `supabase/migrations/*support_tickets*`, `lib/supporttickets.ts` | Queue ownership, SLA |
| On-call / incident command | **T** | `docs/sre/06-INCIDENTS-AND-ON-CALL.md`, `RB-01..RB-10`; "no rota" | Rota + paging |
| Status page | **PARTIAL** | browser-side probe; empty feed | Hosted service, history |
| SLA | **T** | `docs/trust/SLA.md` NOT_STARTED | Counsel + staffing |
| Finance model / runway | **T** | `docs/finance/semester-financial-model.xlsx`; every input PROPOSED/HYPOTHESIS/VENDOR except Plus price | Real numbers intake |
| Board / OKRs / vendor register / hiring plan | **T** | `docs/strategy/BOARD-MEMO.md`, `docs/company/VENDOR-INVENTORY-TEMPLATE.md`; `docs/SUBPROCESSORS.md` is **R** (test-held to code) | A board; vendor contracts |
| Legal documents | **T** (all drafts) | `docs/legal/*-DRAFT.md`, `docs/legal-drafts/*` | Counsel |
| Public claims approval | **R** | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` CLM-001..018; tests | Approvers assigned |

## 3. Pricing baseline reconciliation (the brief vs the repository)

The program's pricing baseline is **not approved in the repo** and is not encoded. It must not be published, quoted or coded until the owner decides which source wins. `PRICING-AND-PACKAGING.md` states no price is approved.

| Item | Brief | Repository | Mark | Decision needed |
| --- | --- | --- | --- | --- |
| Individual price | $8.99/mo, $69/yr "Student Premium" | Plus **$7.99 / $59** `plans.ts:58` (V), `plus_price.sql`; Pro $14.99/$99 `plans.ts:71`; **D-1154: $15/mo**, yearly unstated | V/A | One price, one plan name; update catalog, DB seed, site, tests together |
| Institution platform | $18/enrolled student/yr, $30k min | Finance: Dept $35k + $10/active student + $40k impl; Inst. $90k + $11/active + $120k. Site: from $15K/$35K/$75K by size. `deal-desk.ts` minimums $15k/$25k/$75k/$200k. `launchkit.ts:487-491` more bands. D-1154: "match Blackboard/Canvas" (no number/unit) | A | Unit (enrolled vs active) and a number |
| Large volume | $12–16/student | Nearest: $10, $11 per active student (PROPOSED) | A | |
| AI overage | $30 / 1,000 units | Finance uses **hard caps**, no overage billing; credit packs $2.50; Plus AI add-on $4.99/mo | A | Metered overage or cap |
| Marketplace commission | 12% | Finance 15%; strategy "10–15%", $50 order illustrated at 12% | A | |
| Implementation | $35k–$150k | Finance $15k/$40k/$120k; `launchkit.ts` $5–20k / $15–75k / $150–500k+ | A | |
| Premium support | 15%, $15k min | `launchkit.ts:418` "annual percentage or tiered fixed fee", not-started | A | |
| Storage | 25 GB/student pooled, $18/TB/mo | Finance: pooled tenant storage, 80% warn; $0.02/GB-mo is vendor cost | A | |
| Paid pilot | $30–45k | Finance $12k + $15k = $27k; `PRICING-AND-PACKAGING` "[APPROVED FEE OR NO-FEE TERM REQUIRED]"; paid pilot is NO-GO | A | |

Public exposure already out of step: `company-site/index.html:623/637` ($7.99/$59 "planned"), `:621` "save 38%" (derived from a price CLM-015 prohibits publishing), `:660` institution bands (no register claim). See [`COMPLETION_PUBLIC_CLAIMS_SCAN.md`](COMPLETION_PUBLIC_CLAIMS_SCAN.md).

## 4. Summary

The company's **documents** are extensive and honest. Its **operating facts** (entity, counsel, cash, staff, customer, price authority) are absent. Phase 9's gate ("sold to, contracted, onboarded, billed, supported without founder-only improvisation") is not near: every one of those steps today routes through one person and through counsel who is not yet engaged.
