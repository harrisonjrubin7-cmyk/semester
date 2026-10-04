# Semester — go-to-market readiness (Phase 0)

**Date:** 2026-10-04 · **Status:** BASELINE ASSESSMENT — approves no price, claim, campaign or sale · **Controlling:** [`GO-NO-GO-DECISION.md`](../GO-NO-GO-DECISION.md), [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) · **Company state:** [`docs/program/COMPANY_LIVE_STATUS.md`](../docs/program/COMPANY_LIVE_STATUS.md)

> Legal, tax and pricing-authority questions in this page are for qualified counsel, a CPA/tax adviser and the owner. Nothing here is a legal conclusion.

## 1. What may be done today (the controlled boundary)

| Motion | Decision (`GO-NO-GO-DECISION.md`, 2026-10-03) | Go-to-market consequence |
| --- | --- | --- |
| Individual acquisition | **CONDITIONAL GO / YELLOW** — invitation-only, **unpaid** validation, only after conditions | Prepare a small invited cohort. **No paid promotion, no paid plan, no outcome claims** |
| Design-partner institutional pilot | **GO / GREEN — non-activation only** | Discovery, **synthetic** demos, evidence exchange, conditional scoping. No live data, no tenant, no customer/logo claim |
| Paid institutional pilot | **NO-GO / RED** | Prepare only. Do not accept payment or promise launch |
| Broad enterprise sale | **NO-GO / RED** | Long-range qualification only |

Phase 0 changes none of these. It adds that Phase 0's own evidence is consistent with them (see the [scorecard](../operations/GO_NO_GO_SCORECARD.md)).

## 2. Price authority — open, and it comes first

There is **no approved price book** (`docs/commercial/PRICING-AND-PACKAGING.md`: "NO CURRENT PRICE BOOK OR SELLING AUTHORITY"). The program's baseline figures are a *proposal*, not a price: they are not in code or finance docs, and they conflict with them. Full table: [`COMPANY_LIVE_STATUS.md` §3](../docs/program/COMPANY_LIVE_STATUS.md).

| Item | Program baseline (proposal) | Repository today | Needs |
| --- | --- | --- | --- |
| Individual | $8.99/mo or $69/yr | Plus $7.99 / $59 "planned" (`app/src/lib/plans.ts:58`, `20260929131000_plus_price.sql`); **D-1154: $15/mo** | One decision; catalog + DB seed + site + tests changed together |
| Institution | $18/enrolled/yr, $30k min; $12–16 large | Finance: $35k + $10/active (dept), $90k + $11/active (inst.); site bands $15K/$35K/$75K; `deal-desk.ts` minimums $15k/$25k/$75k/$200k | Unit (enrolled vs active) and number |
| Pilot | $30–45k | Finance $27k; `PRICING-AND-PACKAGING` "[APPROVED FEE OR NO-FEE TERM REQUIRED]" | Fee decision (and paid pilot is NO-GO) |
| AI overage | $30 / 1,000 units | Finance: hard caps, no overage billing | Metered overage or cap |
| Marketplace | 12% | Finance 15% | Role decision first (no transaction code found) |
| Implementation | $35k–150k | Finance $15k/$40k/$120k | |
| Premium support | 15%, $15k min | not-started (`launchkit.ts:418`) | |
| Storage | 25 GB pooled, $18/TB/mo | pooled, warn at 80%; $0.02/GB-mo is a cost | |

**Rule:** no number from this table may be quoted, published, coded or invoiced until the owner records which source wins (`D-<PR#>`) and counsel/finance have reviewed (Q-07, tax row).

## 3. Sales readiness

| Asset | State | Evidence | Next |
| --- | --- | --- | --- |
| ICP, segmentation, personas | Draft | `docs/commercial/IDEAL-CUSTOMER-PROFILE.md`, buyer-persona docs | Validate with real conversations |
| Discovery script, playbook | Draft | `DISCOVERY-CALL-SCRIPT`, `SALES-PLAYBOOK` | Use within the GREEN boundary |
| Sales deck | **Absent** | only course decks (`app/public/decks`) | Build from approved claims only |
| Demo environment | Partial | `app/server/institution/sandbox.ts` (30-day keys) | Synthetic-data script; does not imply a tenant |
| ROI calculator | Draft widgets | `company-site/index.html:~1268` "never guarantees" | Approved assumptions; no outcome promises |
| RFP / security questionnaire / HECVAT | Draft | `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md`, `docs/trust/SECURITY-QUESTIONNAIRE.md`; HECVAT workbook not filled in | Fill only with evidence; counsel-review any representation |
| CRM / pipeline | Schema | `gtm_*` tables (D-1154), `app/src/lib/gtm/*` | No pipeline data exists |
| Deal desk | Proposed defaults | `app/src/lib/governance/deal-desk.ts` | Authority matrix entry |

## 4. Marketing readiness

| Asset | State | Evidence | Issue |
| --- | --- | --- | --- |
| Website | Live single page, claims-controlled | `company-site/index.html` (3,099 lines), `vercel.json` CSP/HSTS | Contradictions PC-1…PC-7 ([claims register](../docs/legal/PUBLIC_CLAIMS_APPROVAL_REGISTER.md)) |
| Pricing page | Published, **out of register** | `index.html:618-670` | Institution bands uncovered; savings figure |
| Trust center | Present | `index.html:~562, 2647-2668`; `docs/TRUST-CENTER.md` | Wording to counsel (PL-05) |
| Positioning | Descriptor "Semester — the student action platform" | program §1 | Matches register's conservative stance |
| Lifecycle / referral / ambassador / case studies | Draft | `docs/gtm/*`, `docs/GROWTH-PLAN` | Case studies need a customer; none exists |
| Domain / mailboxes | Personal host and Gmail | PL-08 | Company domain before outbound |

## 5. Readiness verdict by sub-motion

| Sub-motion | Verdict | Principal blockers |
| --- | --- | --- |
| Free, invitation-only student validation | **Prepare** | G-I7 support, G-I10 policies, G-I8 accessibility, G-M5 restore, A-02 AI path |
| Paid student plan | **Hold** | price authority, terms/refund, entitlement enforcement, checkout hold |
| Design-partner discovery (synthetic) | **Go (within boundary)** | none inside the boundary; keep claims conditional |
| Paid institutional pilot | **Hold** | entity, counsel, price book, named customer, target-tenant isolation test, one adapter, independent assessment |
| Broad sale | **Hold** | repeatability, scale, assurance |

## 6. Allowed next commercial work (no build)

1. Owner decision on price authority and a single source (`D-<PR#>`).
2. Claims-owner adopts PC-1…PC-7 as corrected/withdrawn.
3. Draft a claims-clean, synthetic-data discovery deck (for the GREEN boundary).
4. Real-numbers intake for the finance model (`docs/finance/13-REAL-NUMBERS-INTAKE.md`).
5. Engage counsel (Q-00) — the dependency for almost everything else.
