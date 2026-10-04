<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 03. Cost model

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

Every cost line has a driver, an owner and a way to be verified. Vendor prices are allowances, tagged `VENDOR`; **no vendor price here is quoted from a contract.** The workbook computes each line monthly; the table gives the Base scenario by year.

## 1. Cost lines, drivers and amounts ($ thousands, Base)

| Cost line | Driver | Y1 | Y2 | Y3 | Owner |
| --- | --- | ---: | ---: | ---: | --- |
| Engineering, product and design payroll | Headcount plan (section 3) | 1,091 | 1,932 | 2,193 | CTO |
| Security and privacy (payroll + programs) | Pen test, SOC 2, accessibility audit, GRC, privacy assessments, bug bounty, security engineer | 210 | 353 | 418 | CISO (acting: founder) |
| Infrastructure: database, compute, functions | 0.030 $/MAU/mo | 1 | 5 | 17 | CTO |
| Infrastructure: storage incl. backups and DR | 0.4 GB x $0.021/GB x 2.0 | 0 | 3 | 9 | CTO |
| Infrastructure: bandwidth / egress | 0.5 GB x $0.09/GB, 50% cached | 0 | 4 | 12 | CTO |
| Infrastructure: search and vector index | 0.012 $/MAU/mo | 0 | 2 | 7 | CTO |
| Infrastructure: notifications | 0.020 $/MAU/mo | 0 | 3 | 11 | CTO |
| Infrastructure: observability | 0.010 $/MAU/mo | 0 | 2 | 6 | CTO |
| Infrastructure: fixed platform (prod, staging, DR, tooling) | Flat by year | 48 | 108 | 192 | CTO |
| AI inference (variable) | Requests x cost per request x scenario multipliers | 3 | 32 | 122 | AI governance board / finance |
| AI evaluation, red-team, monitoring (fixed) | Flat by year | 24 | 36 | 60 | AI governance board |
| Integrations: connectors and SSO/SCIM | $300 x 60% + $125 per institution per month | 4 | 20 | 83 | Integration lead |
| Support payroll | Headcount plan | 25 | 136 | 274 | Support lead |
| Support overflow (outsourced tier 1) | tickets x 25% x $5 | 1 | 6 | 21 | Support lead |
| Implementation payroll | Headcount plan, paced to demanded hours | 102 | 437 | 885 | Implementation lead |
| Customer success payroll | Headcount plan | 0 | 71 | 193 | CS lead |
| Trust and safety payroll | Headcount plan (marketplace) | 0 | 0 | 36 | Trust & safety lead |
| Payment processing and app-store fees (student) | 2.9% + $0.30; 25% via app stores at 15% | 0 | 1 | 3 | Finance |
| Marketplace payments, disputes, moderation | GMV and orders | 0 | 0 | 7 | Marketplace owner |
| Sales payroll | Headcount plan, gated | 22 | 326 | 528 | CRO (acting: founder) |
| Sales commissions | 8% of new-logo bookings | 1 | 48 | 233 | CRO / finance |
| Sales tools, events, travel, RFP support | Flat by year | 60 | 130 | 220 | CRO |
| Marketing payroll | Headcount plan | 81 | 251 | 311 | CMO (acting: founder) |
| Paid student acquisition (test budget) | Zero before gate G3 | 0 | 36 | 60 | Growth lead |
| Brand, ambassadors, PR, user research | Flat by year | 58 | 133 | 230 | CMO |
| Legal | Counsel retainer, IP, contract playbook | 95 | 112 | 155 | Founder + counsel |
| Insurance | Cyber + tech E&O, GL, D&O | 41 | 70 | 120 | Finance + broker |
| Accounting, audit, finance systems | Outsourced accounting, review/audit, billing and FP&A tools | 48 | 99 | 151 | Finance |
| G&A payroll (leadership, finance, compliance, ops) | Headcount plan | 234 | 466 | 586 | Founder |
| Software, workspace, training per FTE | $850 per FTE per month | 109 | 266 | 383 | Finance |
| Internal travel and offsites | Flat by year | 10 | 20 | 30 | Finance |
| Recruiting and equipment | $9,000 + $2,800 per hire from month 2 | 165 | 153 | 106 | Finance |
| Contingency | 5% on non-payroll program lines | 22 | 37 | 57 | Finance |
| Bad debt | 1% of invoiced billings | 0 | 6 | 30 | Finance |
| **Total cost (cost of revenue + operating expenses)** |  | **2,456** | **5,305** | **7,747** |  |

The incident-response line is zero in Base and is loaded only in the Incident scenario ([06](06-SCENARIOS-AND-SENSITIVITIES.md)).

## 2. Variable cost per active user per month

| Component | Per MAU per month | Basis |
| --- | ---: | --- |
| Database, compute, functions | $0.0300 | planning allowance (`VENDOR`) |
| Storage with backups and DR | $0.0168 | planning allowance (`VENDOR`) |
| Bandwidth after CDN | $0.0225 | planning allowance (`VENDOR`) |
| Search and vector | $0.0120 | planning allowance (`VENDOR`) |
| Notifications | $0.0200 | planning allowance (`VENDOR`) |
| Observability | $0.0100 | planning allowance (`VENDOR`) |
| **Infrastructure subtotal** | **$0.1113** | |
| AI, free user (10 requests) | $0.1442 | [05](05-UNIT-ECONOMICS-DASHBOARD.md) |
| AI, paying user (45 requests) | $0.6491 | |
| AI, sponsored user (20 requests) | $0.2885 | |

Total variable cost: about $0.26 for a free user, $0.76 for a paying user, $0.40 for a sponsored user, per month. Plus brings in $4.92 to $7.99 a month before fees.

## 3. Headcount plan (the largest cost)

Roles are **capacity placeholders, not offers**: no one is hired, and every start month is a proposal. "Gated" roles are the ones the Enterprise-delayed-with-gated-hiring scenario shifts six months; in the Base plan their start months already sit at their gates, so the rule is *they are released by the gate, not by the calendar*. Salaries are `HYP` pending offers and a PEO or payroll quote; burden is 22% (`PRO`).

| Function | FTE m12 | FTE m24 | FTE m36 | Payroll Y1 $k | Y2 $k | Y3 $k | Gated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| G&A | 2.4 | 4.4 | 4.4 | 234 | 466 | 586 | no |
| Engineering | 6.0 | 9.0 | 10.0 | 796 | 1,462 | 1,723 | no |
| Product, design, accessibility | 3.0 | 3.0 | 3.0 | 295 | 470 | 470 | no |
| Security | 1.0 | 1.0 | 1.0 | 92 | 183 | 183 | no |
| Support (COGS) | 1.0 | 2.0 | 4.0 | 25 | 136 | 274 | no |
| Implementation (COGS) | 2.0 | 5.0 | 8.0 | 102 | 437 | 885 | yes |
| Customer success (COGS) | 0.0 | 1.0 | 2.0 | 0 | 71 | 193 | yes |
| Trust & safety (COGS) | 0.0 | 0.0 | 1.0 | 0 | 0 | 36 | yes |
| Sales & partnerships | 1.0 | 3.0 | 4.0 | 22 | 326 | 528 | yes |
| Marketing | 2.0 | 3.0 | 3.0 | 81 | 251 | 311 | no |
| **Total** | **18.4** | **31.4** | **40.4** | **1,647** | **3,802** | **5,187** |  |

Role detail (start month, base salary): CEO / founder x1 (m1, $90k); Fractional CFO / controller (0.4 FTE) x0.4 (m1, $150k); Compliance and privacy manager x1 (m9, $125k); Finance and RevOps manager x1 (m15, $120k); Executive operations / people x1 (m24, $85k); CTO / co-founder x1 (m1, $110k); Senior engineers (platform, web) x2 (m1, $150k); Data / AI engineer x1 (m5, $160k); Senior engineer x1 (m6, $150k); Mobile engineer (iOS / Android, offline sync) x1 (m9, $145k); Senior engineer x1 (m13, $150k); SRE / DevOps x1 (m14, $150k); QA / SDET x1 (m20, $110k); Senior engineer x1 (m26, $150k); Product designer x1 (m3, $130k); Product manager x1 (m4, $140k); Accessibility specialist x1 (m10, $115k); Security engineer x1 (m7, $150k); Support specialist x1 (m9, $62k); Support lead x1 (m18, $85k); Support specialist x1 (m26, $62k); Support specialist x1 (m33, $62k); Implementation engineer x1 (m5, $100k, gated); Implementation engineer x1 (m11, $100k, gated); Implementation engineer x1 (m15, $100k, gated); Implementation engineer x1 (m19, $100k, gated); Implementation engineer x1 (m22, $100k, gated); Implementation engineer x1 (m25, $100k, gated); Implementation engineer x1 (m28, $100k, gated); Implementation engineer x1 (m31, $100k, gated); Customer success manager x1 (m18, $100k, gated); Customer success manager x1 (m30, $100k, gated); Trust and safety / marketplace moderation x1 (m32, $70k, gated); Account executive x1 (m11, $110k, gated); Sales engineer x1 (m13, $130k, gated); Account executive x1 (m22, $110k, gated); Partnerships / marketplace manager x1 (m28, $110k, gated); Growth and lifecycle marketing manager x1 (m6, $105k); Campus program coordinator x1 (m12, $65k); Content and social x1 (m20, $85k).


**Make versus buy.** Fractional CFO (0.4 FTE), outsourced accounting and tax, a PEO or payroll provider, outsourced tier-1 support overflow, and contract pen-testing and audit are bought, not hired. Implementation is hired because it is the product's repeatability evidence (`GO-NO-GO-DECISION.md` priority 10); a partner-delivered model is an option once the methodology is documented and is a pricing decision (partner margin) as much as a cost one.

## 3a. Alignment with the CTO target-architecture pack

`docs/target-architecture/` (merged as D-1144, a proposal) was written without compensation or budget figures and says so. This model supplies them for its staffing hypothesis (`08-ORGANIZATION-AND-MILESTONES.md`, stages S1 to S4: 5 technical staff by about month 3, 12 by month 9, 27 by month 18, 35 to 45 by month 30). Costed as scenario 8 ("Full-scope staffing", 30 additional roles on top of the Base plan, all with Base revenue), it reaches about 70 FTE at month 36 against 40 and raises the peak funding need from $12.73M to $22.12M. Where the two plans differ the CFO view is: take the CTO pack's *sequence* (second operator and security lead first, bus factor before surface area, vertical slices) and release its *count* by tranche and gate rather than by calendar. The infrastructure lines here assume the current Supabase/Vercel posture; the pack's target (one container-hosted `core` plus `ai-gateway`, `integration-hub` and `sync-gateway` from day one, with the cloud and region posture P-12 undecided) will raise the fixed-platform allowance, so **re-quote the fixed infrastructure line when P-12 is decided**. The pack's 20% debt-and-reliability capacity reservation is a cost the model carries inside the engineering headcount, not as a separate line.

## 4. Vendor prices to verify before the model is relied on

Quotes or current price pages, dated and filed with the finance records: Supabase (database, auth, storage, functions, point-in-time recovery), Vercel (hosting, bandwidth), Stripe (processing, billing, tax, Radar), Anthropic and OpenAI (API; zero-retention terms), identity/SSO vendor (per-connection price), search/vector service, email/SMS/push, error monitoring, CRM, billing/AR tooling, GRC/compliance platform, SOC 2 auditor, penetration-test firm, accessibility auditor (VPAT/ACR), cyber / tech E&O / D&O insurer through a broker, outside counsel, accounting firm. Each becomes a row in the vendor register (`docs/trust/VENDOR-RISK-REGISTER.md`, `VENDOR-SECURITY-REVIEW-PROGRAM.md`) with a renewal date and an owner.

## 5. What is not in the cost model

Capitalized software development; depreciation; income taxes; stock-based compensation; interest and financing fees; foreign payroll and currency; multi-region data residency (a possible tenant requirement that would add infrastructure and legal cost); accessibility remediation beyond the audit line; a dedicated 24x7 on-call program (the plan has support specialists and an on-call stipend inside payroll and contingency, not a follow-the-sun desk; promising `critical_24x7` support in a contract needs this costed first).
