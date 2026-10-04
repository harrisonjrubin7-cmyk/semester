<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 02. Revenue streams, pricing and packaging architecture

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NO CURRENT PRICE BOOK OR SELLING AUTHORITY** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |
| Boundary | Proposes numbers for approval. Does not publish, quote or charge anything. Conflicts with the approved price book, once one exists, resolve to the approved price book. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

Everything marked **PROPOSED** below is an input to the deal desk and to the approvers in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md). `docs/commercial/PRICING-AND-PACKAGING.md` is explicit: *do not publish, quote or charge an unapproved number; do not claim affordability, savings, ROI, market validation, margin, discount availability or annual conversion economics without evidence and authority.* The only prices that are live are Plus at $7.99 a month / $59 a year (D-134).

## 1. The seven revenue streams in the model

| Stream | Who pays | Pricing basis | Y1 $k | Y2 $k | Y3 $k | Share of Y3 | Gate / earliest | Main risk |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Student subscription (Plus) | The student | Per student per month or year | 0 | 7 | 34 | 1% | G3 (broad/paid individual) | Does not fund its own acquisition at Base conversion; free tier is a cost |
| Institutional platform | Provost, CIO, student success, registrar, dean | Annual platform fee by tier (department / campus / system) plus pilot fee | 1 | 218 | 973 | 42% | G2 paid pilots, G4 direct, G5 enterprise | Gates, procurement time, renewal at first term |
| Implementation services | The institution | Fixed-scope fee plus change orders; integration pack | 0 | 278 | 1,125 | 49% | With each billable institution | Hours per account; margin depends on utilization |
| AI usage (capacity add-on) | The institution (managed capacity); student only as an included allowance | Annual capacity pack by tier; allowance inside plans | 0 | 4 | 53 | 2% | Month 20 | Unit-cost drift; open-ended student metering is excluded |
| Marketplace | Student pays provider; Semester takes a commission | Take rate on GMV (net presentation) | 0 | 0 | 17 | 1% | Month 31 | Consumer protection, provider governance, tax, refunds, disputes must mature first |
| Career / employer | Employer or career services | Employer account per year | 0 | 0 | 93 | 4% | Month 25 | Employment and anti-discrimination law; student choice and consent |
| Alumni | Alumni or advancement office | Module fee by tier | 0 | 0 | 6 | 0% | Month 30 | Needs live annual customers; sells institutional value, not learner data |

Reading: about 49% of Year 3 revenue is implementation services, which is non-recurring and is **excluded from ARR**; quality of revenue improves only as the platform's share grows. In Year 3 about 91% of revenue is institutional platform, pilot and implementation. The company is an institutional business with a student product, which is also what the audit's launch strategy says ("student-led value layer" first, institutional system of engagement second). The family/guardian companion has **no standalone price** in this model; its entitlements would sit inside Plus and institutional packages. Whether to price it separately is a decision for the founder after the invitation-only cohort.

## 2. Packages and proposed prices

The catalog (`supabase/migrations/20260929070000_commercial_core.sql`) already names the packages. The model maps its three institutional tiers onto them.

| Catalog plan | Model tier | Status of price | Proposed (not approved) |
| --- | --- | --- | --- |
| `free` | Free | Live ($0) | Always includes export, deletion, saved plans, accessibility and safety features |
| `plus` | Plus | **Live: $7.99 / month, $59 / year** (new checkout held) | No change proposed; student promo discount modeled at 10% average, needs counsel review before it is advertised |
| `pro` | not modeled | No price | Decision needed: collapse into Plus or define a distinct entitlement set |
| `registration_pilot` | Paid pilot, 26 weeks | Quote-only; NO-GO to accept payment today | Department $15,000, Campus $30,000, System $60,000, plus implementation fee; 50% credit toward year one on conversion |
| `department_launch` | Department | Quote-only | List $30,000 a year |
| `semester_access`, `native_lms` | Campus | Quote-only | List $85,000 a year |
| `university_os` | System | Quote-only; enterprise NO-GO | List $220,000 a year |
| `implementation` | Services | Quote-only | Department $15,000, Campus $40,000, System $100,000; integration pack $15,000 |
| (new) AI capacity add-on | Add-on | none | Department $6,000, Campus $18,000, System $45,000 a year |
| (new) Alumni module | Add-on | none | Campus $12,000, System $25,000 a year |
| (new) Employer account | Add-on | none | $4,000 a year |
| (new) Marketplace | Commission | none | 15% of GMV |

**Corridor checks the proposed numbers must keep passing** (the table is computed from the model's inputs; the numbered items are rules):

| Tier | Net ACV per active student per year | Variable cost per active student per year | Plus annual list | Check |
| --- | ---: | ---: | ---: | --- |
| Department | $44.00 | $11.42 | $59 | below the consumer ceiling |
| Campus | $29.92 | $6.79 | $59 | below the consumer ceiling |
| System | $21.51 | $5.73 | $59 | below the consumer ceiling |

1. **Consumer ceiling.** An institution should not pay more per active student than a student would pay for Plus, or the buyer's first question has a free answer. Department is closest (44 against 59).
2. **Cost floor.** Net price per active student stays above at least four times its variable cost (the model has about $6 to $11 a year).
3. **Deal-desk floor.** Department list stays at or above the $25k minimum, Campus above $75k, System above $200k, pilot at or above $15k, implementation fee at or above $10k (all `DEAL_POLICY` defaults).
4. **Bands, not seats.** The audit prices on active-user or enrolled-student bands; the deal desk today has tier minimums only. A band table (active students to price) is an open item for the deal desk, and Department-versus-Campus boundaries should be tested against real rosters.
5. **Total cost of ownership.** The business case calculator (D-1042) takes Semester's price from the school's own quote and counts a system as removed only when its contract has ended and the replacement exists. No published price may be used to make that calculator look better.

## 3. Entitlement architecture

*A subscription grants entitlements and never authorization* (`COMMERCIAL-CORE.md`): no policy on student data reads a commercial table. Entitlements are rows in `plan_entitlements`; the keys that exist today are `plan.multiple`, `calendar.sync`, `export.formats`, `reminders.expanded`, `tenant.sso`, `tenant.cohorts` and `support.tier`.

| Capability | Free | Plus | Department | Campus | System | Notes |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Export all data, delete account, keep saved plans | yes | yes | yes | yes | yes | Never paywalled, never suspended for non-payment |
| Accessibility features and safety/crisis resources | yes | yes | yes | yes | yes | Never gated |
| Core planning, Today, courses, study tools | yes | yes | yes | yes | yes | Free tier is a safe useful core |
| Multiple term plans, calendar sync, extra export formats, expanded reminders | no | yes | via institution | via institution | via institution | Existing keys |
| AI assistant allowance | capped | higher | institution-set | institution-set | institution-set | Proposed key `ai.allowance`; cap is a product decision |
| Institution AI capacity pool | no | no | add-on | add-on | add-on | Proposed key `ai.capacity_pool` |
| SSO / SCIM | no | no | optional | yes | yes | `tenant.sso` |
| Cohorts | no | no | 1 | many | many | `tenant.cohorts` |
| Connectors (SIS / LMS) | no | no | pack | pack | included scope | Priced separately; proposed key `tenant.integrations` |
| Support tier | community | standard | standard | extended | critical 24x7 | `support.tier`; 24x7 is a contract promise and must match staffed coverage |
| Alumni, employer, marketplace modules | no | no | add-on | add-on | add-on | Proposed keys, each behind its own gate |

Rules finance needs engineering to keep true: (a) every entitlement a plan grants has a named cost driver in the model, (b) a plan downgrade or lapse removes entitlements, never data, (c) a tenant's plan changes only through a signed order form (the existing trigger), (d) usage entitlements (AI) have a counted unit that matches the invoice, and (e) a support tier is sold only if staffed coverage exists (`GO-NO-GO-DECISION.md` priority 6).

## 4. Discounts, approvals and what can never be discounted

Source: `app/src/lib/governance/deal-desk.ts`, `DEAL_POLICY`. These are **proposed defaults**; finance sets the real figures with its sign-off in the commit.

| Rule | Proposed default | Approver |
| --- | --- | --- |
| Discount up to 10% | allowed | Sales lead |
| Discount over 10% up to 20% | allowed | Sales lead + finance |
| Discount over 20% up to 30% | allowed | Sales lead + finance + CEO |
| Discount over 30% up to 40% | allowed | Sales lead + finance + CEO + board |
| Discount over 40% | refused | none |
| Multi-year | 3% per year beyond the first, capped at 9% | within ladder |
| Pilot credit | at most 50% of first-year value; defined eligible software fees only | finance |
| Pilot length | exactly 26 weeks (D-134), then convert or end | deal desk |
| Implementation fee | floor $10k; waivable only as capped pilot credit | finance |
| AI / compute overage | must be written into every order | deal desk |
| Scholarship, low-income, nonprofit or system pricing | an approved programme; finance approves; counts against the ladder | finance |
| Custom work | product approval and a scorecard first | product |
| "Free forever" enterprise commitments | refused | none |

The model's realized discount is 12% (inside the finance tier). Every discount buys something: a longer term, prepayment, reference rights (with counsel-approved wording), reduced scope or a faster decision. **Never discount away** security, privacy, accessibility, support or clean-exit (offboarding) work. Student promotional pricing needs its own approval and a claims check (`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`).

## 5. Billing and collections

**Consumer (live in code, off in operation).** Stripe Checkout with recorded consent, signed webhook, idempotent event application, cancel at period end, hourly dunning (reminder after three quiet days, final notice naming the restriction date, 14-day grace, then paid entitlements removed; data, export and deletion untouched). Missing tax address is a separate state and does not open dunning. See `COMMERCIAL-CORE.md`. What is *not* in place and gates any real charge: merchant account and bank, tax registration and rates, refund and chargeback operation, payment-fee reconciliation, the app-store question (25% of student billings are assumed to flow through app stores at 15%, **a platform-policy and counsel question**).

**Institutional (process only).** `ORDERING-AND-BILLING-OPERATIONS.md` is the controlling process: qualify, quote from the approved price book, review and contract, create the order after signature, invoice through the approved system with unique numbering, collect and reconcile, entitle and activate (a signed order is not a launch GO), close. Proposed commercial terms for counsel and the CPA to confirm (none is decided):

| Term | Proposal for review |
| --- | --- |
| Billing frequency | Annual in advance for platform; pilot fee at start; implementation fee 50% at signature and 50% at go-live (the model bills 100% at start, which is the simpler and more conservative cash view) |
| Payment terms | Net 30; the model collects after two months on invoiced items, which is deliberately slower |
| Purchase orders and vendor forms | Required before activation for any customer that needs them; W-9 and vendor registration at signature |
| Late payment | Reminder at due date, then days 15, 30 and 45 with named escalation; interest or fees only if counsel approves the clause |
| Suspension for non-payment | Never of export, deletion or other non-waivable data-rights handling; any other restriction needs customer notice per contract |
| Refunds and credits | Only under the written policy; service credits are contra-revenue and need approval |
| Taxes | Quoted exclusive of tax; exemption certificates collected; sales-tax treatment of software and services by state is a tax adviser question |
| Renewals | No auto-renewal assumed in the model; renewal terms are counsel's call; notice dates tracked (renewal opportunity opens 120 days before term end) |

## 6. Revenue recognition: questions for the accountant

`docs/commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md` is the fact-gathering template. These are the questions this model raises. **None is answered here, and the model's treatment is a planning proxy only.**

1. Which accounting framework and entity structure apply, and when does revenue first become recognizable at all (the model books none before a signed, enforceable order)?
2. Is the 26-week pilot software fee recognized over the pilot term, and is a no-fee design-partner term or a pilot credit a modification, a discount or a material right?
3. Are the platform subscription, implementation, integration pack and support distinct performance obligations, and how is the transaction price allocated? Is implementation a customer deliverable or only set-up that enables the service?
4. When a pilot converts to an annual contract with a credit, is that a contract modification or a new contract?
5. Treatment of usage-based AI capacity, overage, and service credits as variable consideration.
6. Marketplace: principal or agent, gross or net, and timing of recognition against payouts and refunds.
7. Commissions and incremental costs of obtaining a contract: capitalize or expense, and over what period.
8. Deferred revenue and contract-asset presentation for annual prepaid and milestone-billed items.
9. Consumer subscriptions sold through app stores: gross or net of the store's commission.
10. Refund and chargeback reserves; bad-debt (expected credit loss) method for institutional receivables.
11. Cut-off and period controls for the monthly close, and what evidence the auditor will want for usage-based revenue.
12. Software development costs: capitalization versus expense (the model expenses everything).
13. Sales tax / VAT collected as a liability, not revenue; nexus triggers by state and country (tax adviser).
14. Whether stock or deferred-compensation arrangements for founders or advisers affect payroll cost (not modeled).

## 7. Price-book change control

A price enters customer view only through this path: proposal here, deal-desk review, authorized approval recorded as `docs/decisions/D-<pull request number>.md`, catalog migration, `plans.test.ts` and `commercial-automation.check.sql` green (they already hold Plus to $7.99 and $59), then the public claims register. A price found in code, a test, a mock page or a planning document is not an approved price. Price reviews are quarterly, or on any vendor cost move over 20%.
