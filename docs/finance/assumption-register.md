# Assumption register

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | Generated from the `Assumptions` and `Scenario_Control` sheets of [`semester-financial-model.xlsx`](semester-financial-model.xlsx) |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

Basis labels: **FACT** a documented repository decision; **PROPOSED** a design decision awaiting approval; **HYPOTHESIS** an estimate to validate; **VENDOR** a vendor list price to verify against the current price sheet; **REVIEW** needs a qualified professional; **POLICY** a proposed control.

| Basis | Inputs |
| --- | ---: |
| HYPOTHESIS | 109 |
| PROPOSED | 23 |
| VENDOR | 14 |
| FACT | 4 |
| POLICY | 2 |
| REVIEW | 1 |

## 1. General

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-001 | Model month 1 (first day) | date | Nov 2026 | PROPOSED | Model years run Nov–Oct so each contains one full academic start (Aug–Sep). Fiscal-year choice is an accountant decision. |
| A-002 | Opening cash at month 1 | $ | $0 | HYPOTHESIS | PLACEHOLDER. No company cash is evidenced in the repository; enter the reconciled bank balance. |
| A-003 | Annual wage inflation (applied from model year 2) | % | 3.0% | HYPOTHESIS |  |
| A-004 | Employer burden on base pay (taxes, benefits) | % | 20.0% | HYPOTHESIS | Payroll taxes, health, 401(k) match, workers comp. PEO/payroll provider quote needed. |

## 2. Student subscription (direct-to-student)

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-005 | Paid student-acquisition budget per year | $/yr | $30,000 / $90,000 / $150,000 | PROPOSED | Management lever. Spend is gated on the CAC guardrail in Unit_Economics. |
| A-006 | Cost per paid-attributed registration | $ | $4.00 / $4.50 / $5.00 | HYPOTHESIS | Ambassador-led channel mix (cheapest first). Rises as the cheapest audiences saturate. |
| A-007 | Organic registrations per paid registration | x | 1.5 / 2 / 2.5 | HYPOTHESIS | Referral, ambassador and word-of-mouth registrations per paid one. Validate in the first campus cohort. |
| A-008 | Registration → activated (completes core job) | % | 50.0% | HYPOTHESIS | Matches the repo's activation definition (own course + answered a card within 7 days). |
| A-009 | Activated → paid (Plus) conversion, in month | % | 6.0% / 6.5% / 7.0% | HYPOTHESIS | Freemium consumer benchmarks vary widely; validate before spend scales. |
| A-010 | Share of new paid on the annual plan | % | 65.0% | HYPOTHESIS |  |
| A-011 | Plus list price, monthly | $/mo | $7.99 | FACT | D-134: Plus is $7.99 a month everywhere. |
| A-012 | Plus list price, annual | $/yr | $59.00 | FACT | D-134: $59 a year everywhere. |
| A-013 | Blended promo / campus-code discount off list | % | 8.0% | HYPOTHESIS | Ambassador codes, back-to-school promos. |
| A-014 | Refunds and chargebacks as % of billings | % | 3.0% | HYPOTHESIS | Variable-consideration treatment is an accountant question. |
| A-015 | Monthly churn, monthly-plan subscribers | %/mo | 8.0% | HYPOTHESIS | Students churn hard in summer and after exams. |
| A-016 | Annual plan renewal at first anniversary | % | 55.0% | HYPOTHESIS | Graduation and transfers cap renewal. |
| A-017 | Annual plan renewal at second anniversary (of those renewed) | % | 70.0% | HYPOTHESIS |  |
| A-018 | Monthly churn of free active users | %/mo | 5.0% | HYPOTHESIS |  |
| A-019 | Share of billings through web checkout (rest via app stores) | % | 65.0% | HYPOTHESIS | App-store rules for subscriptions and education apps need counsel review. |
| A-020 | Card processor fee, percent | % | 2.9% | VENDOR | Verify current processor price sheet and negotiated rate. |
| A-021 | Card processor fee, fixed per transaction | $ | $0.30 | VENDOR |  |
| A-022 | App-store commission on app-store billings | % | 15.0% | VENDOR | Assumes a reduced small-business commission tier; may be 30%. Verify program eligibility. |
| A-023 | Premium AI add-on attach rate (of paid subscribers) | % | 3.0% / 6.0% / 8.0% | HYPOTHESIS | Optional higher-cap AI tier; no surprise bills (hard cap). |
| A-024 | Premium AI add-on price | $/mo | $4.99 | PROPOSED |  |

## 3. Institutional platform, pilots and implementation

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-025 | Pilots signed per year (26-week design-partner pilots) | #/yr | 4 / 10 / 14 | HYPOTHESIS | Pilot length is fact (D-134). Volume is a hypothesis, not a target (no target is set). |
| A-026 | Pilot software fee (whole 26 weeks) | $ | $12,000 | PROPOSED | Repo: no approved price. 50–200 participants per the pilot offer. |
| A-027 | Active students per pilot | # | 125 | FACT | Midpoint of the 50–200 range in the pilot offer. |
| A-028 | Pilot implementation fee | $ | $15,000 | PROPOSED | Billed 50% at signing, 50% at go-live. |
| A-029 | Pilot implementation hours | h | 120 | HYPOTHESIS | 30–60 day implementation per the pilot offer. |
| A-030 | Pilot: months from signing to go-live | mo | 2 | FACT | 30–60 days per the pilot offer. |
| A-031 | Pilot → annual agreement conversion | % | 50.0% | HYPOTHESIS | The repo defines this measure but has no reading. |
| A-032 | Share of converting pilots that become Department (rest Institution) | % | 60.0% | HYPOTHESIS |  |
| A-033 | Department/program new direct logos per year | #/yr | 1 / 8 / 18 | HYPOTHESIS | Calibrated so Y3 new ACV is within what 3–4 enterprise AEs can close. |
| A-034 | Department: annual platform fee | $/yr | $35,000 | PROPOSED |  |
| A-035 | Department: active students at land | # | 1,500 | HYPOTHESIS |  |
| A-036 | Department: price per active student per year | $ | $10.00 | PROPOSED |  |
| A-037 | Department: implementation fee | $ | $40,000 | PROPOSED |  |
| A-038 | Department: implementation hours | h | 300 | HYPOTHESIS |  |
| A-039 | Department: months signing → go-live | mo | 4 | HYPOTHESIS |  |
| A-040 | Department: annual logo churn at each anniversary | % | 12.0% | HYPOTHESIS |  |
| A-041 | Department: expansion at 1st anniversary (of survivors) | % | 12.0% | HYPOTHESIS | Seat growth as the rollout widens. |
| A-042 | Department: expansion at 2nd anniversary | % | 10.0% | HYPOTHESIS |  |
| A-043 | Institution-wide new direct logos per year | #/yr | 0 / 3 / 9 | HYPOTHESIS | Longest cycle; none in year 1. |
| A-044 | Institution: annual platform fee | $/yr | $90,000 | PROPOSED |  |
| A-045 | Institution: active students at land | # | 5,000 | HYPOTHESIS | Phased rollout; expansion grows this. |
| A-046 | Institution: price per active student per year | $ | $11.00 | PROPOSED |  |
| A-047 | Institution: implementation fee | $ | $120,000 | PROPOSED |  |
| A-048 | Institution: implementation hours | h | 850 | HYPOTHESIS | Includes migration, integration, parallel run. |
| A-049 | Institution: months signing → go-live | mo | 6 | HYPOTHESIS |  |
| A-050 | Institution: annual logo churn at each anniversary | % | 8.0% | HYPOTHESIS |  |
| A-051 | Institution: expansion at 1st anniversary | % | 30.0% | HYPOTHESIS | Land small, expand to campus. |
| A-052 | Institution: expansion at 2nd anniversary | % | 20.0% | HYPOTHESIS |  |
| A-053 | Collection profile: paid in month of invoice | % | 5.0% | HYPOTHESIS | Public institutions commonly pay net 45–60. |
| A-054 | Collection profile: month +1 | % | 25.0% | HYPOTHESIS |  |
| A-055 | Collection profile: month +2 | % | 40.0% | HYPOTHESIS |  |
| A-056 | Collection profile: month +3 | % | 25.0% | HYPOTHESIS |  |
| A-057 | Collection profile: month +4 | % | 5.0% | HYPOTHESIS |  |
| A-058 | Bad-debt allowance on institutional billings | % | 1.0% | REVIEW | Credit-loss method is an accountant decision. |
| A-059 | Sales commission on first-year ACV of direct new logos | % | 10.0% | PROPOSED | Capitalization of commissions is an accountant question. |
| A-060 | Cooperative-contract / channel admin fee on institutional billings | % | 1.0% | HYPOTHESIS | Only applies if a cooperative contract vehicle is used. |
| A-061 | Implementation: loaded cost per available hour | $/h | $62 | HYPOTHESIS | About $110k comp × 1.2 burden ÷ 2,080 h. |
| A-062 | Implementation: delivery utilization | % | 70.0% | HYPOTHESIS |  |
| A-063 | Implementation: productive hours per FTE-month | h | 130 | HYPOTHESIS | Used only for the implied-FTE memo row. |

## 4. Career/employer, alumni and AI usage revenue

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-064 | Employer product launch month | month # | 13 | PROPOSED | Gated: student base, verified-employer controls, anti-discrimination review. |
| A-065 | New employer partners per year | #/yr | 0 / 60 / 180 | HYPOTHESIS |  |
| A-066 | Employer partner annual fee | $/yr | $3,600 | PROPOSED |  |
| A-067 | Employer annual churn | % | 30.0% | HYPOTHESIS |  |
| A-068 | Employer expansion, 1st anniversary | % | 10.0% | HYPOTHESIS |  |
| A-069 | Employer expansion, 2nd anniversary | % | 10.0% | HYPOTHESIS |  |
| A-070 | Alumni module launch month | month # | 13 | PROPOSED | Institution-sponsored only; no sale of alumni personal data. |
| A-071 | Alumni module attach (share of Institution customers) | % | 0.0% / 10.0% / 25.0% | HYPOTHESIS |  |
| A-072 | Alumni module annual fee per attaching institution | $/yr | $15,000 | PROPOSED |  |
| A-073 | Institution AI credit packs: attach (share of active inst. students) | % | 10.0% / 25.0% / 40.0% | HYPOTHESIS | Institution-managed credits with a budget guardrail. |
| A-074 | Institution AI credit price per attaching student per year | $/yr | $2.50 | PROPOSED |  |

## 5. AI inference cost (bottom-up)

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-075 | AI tasks per free active user per month | # | 8 | HYPOTHESIS |  |
| A-076 | AI tasks per paid subscriber per month | # | 40 | HYPOTHESIS |  |
| A-077 | AI tasks per premium-add-on subscriber per month | # | 150 | HYPOTHESIS | Hard cap prevents bill shock. |
| A-078 | AI tasks per institutional active student per month (included allowance) | # | 12 | PROPOSED | Included allowance with a hard monthly cap; heavier use is bought as institution AI credit packs. |
| A-079 | Input tokens per task (incl. retrieved context) | tokens | 6,000 | HYPOTHESIS |  |
| A-080 | Output tokens per task | tokens | 800 | HYPOTHESIS |  |
| A-081 | Routing mix: small model | % | 75.0% | PROPOSED | Cost control by routing (AI gateway). |
| A-082 | Routing mix: mid model | % | 20.0% | PROPOSED |  |
| A-083 | Routing mix: frontier model | % | 5.0% | PROPOSED |  |
| A-084 | Small model: input $ per 1M tokens | $/Mtok | $1.00 | VENDOR | Illustrative list price. Refresh from the vendor's current price page each quarter. |
| A-085 | Small model: output $ per 1M tokens | $/Mtok | $5.00 | VENDOR |  |
| A-086 | Mid model: input $ per 1M tokens | $/Mtok | $3.00 | VENDOR |  |
| A-087 | Mid model: output $ per 1M tokens | $/Mtok | $15.00 | VENDOR |  |
| A-088 | Frontier model: input $ per 1M tokens | $/Mtok | $5.00 | VENDOR | PLACEHOLDER; replace with the contracted rate. |
| A-089 | Frontier model: output $ per 1M tokens | $/Mtok | $25.00 | VENDOR | PLACEHOLDER. |
| A-090 | Input-token saving from prompt caching | % | 40.0% | HYPOTHESIS |  |
| A-091 | Guardrail, retrieval, rerank and evaluation overhead on inference | % | 20.0% | HYPOTHESIS |  |
| A-092 | AI platform fixed cost (eval harness, observability, red-team tooling) | $/mo | $2,000 / $3,500 / $6,000 | HYPOTHESIS |  |

## 6. Marketplace

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-093 | Marketplace launch month | month # | 19 | PROPOSED | Gated on consumer protection, provider governance, refund, tax and dispute operations (audit pricing note). |
| A-094 | Share of active users transacting per month | % | 0.0% / 1.0% / 2.5% | HYPOTHESIS |  |
| A-095 | Orders per transacting user per month | # | 0.6 | HYPOTHESIS |  |
| A-096 | Average order value | $ | $45 | HYPOTHESIS |  |
| A-097 | Take rate (net revenue as % of GMV) | % | 15.0% | PROPOSED | Net (agent) presentation assumed; principal-vs-agent is an accountant question. |
| A-098 | Payment processing, percent of GMV | % | 2.9% | VENDOR |  |
| A-099 | Payment processing, fixed per order | $ | $0.30 | VENDOR |  |
| A-100 | Disputes, fraud and refunds borne by Semester, percent of GMV | % | 0.8% | HYPOTHESIS |  |
| A-101 | Moderation and trust-and-safety cost per order | $ | $0.25 | HYPOTHESIS |  |

## 7. Infrastructure, support and other cost of revenue

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-102 | Platform fixed hosting (dev, staging, prod, canary, DR) | $/mo | $4,000 / $9,000 / $16,000 | HYPOTHESIS |  |
| A-103 | Variable compute/database/cache per active user | $/mo | $0.08 | HYPOTHESIS |  |
| A-104 | Stored GB per active user (average) | GB | 0.25 / 0.45 / 0.7 | HYPOTHESIS | Documents, submissions, media, sync snapshots. |
| A-105 | Object storage price | $/GB-mo | $0.02 | VENDOR |  |
| A-106 | Backup/replica/DR multiple on storage | x | 2 | HYPOTHESIS |  |
| A-107 | Egress/CDN GB per active user per month | GB | 0.9 | HYPOTHESIS |  |
| A-108 | Egress/CDN price per GB | $/GB | $0.05 | VENDOR |  |
| A-109 | Search and vector store fixed cost | $/mo | $800 / $1,500 / $3,000 | HYPOTHESIS |  |
| A-110 | Search/vector variable per active user | $/mo | $0.03 | HYPOTHESIS |  |
| A-111 | Notifications (email/push/SMS) per active user | $/mo | $0.03 | HYPOTHESIS |  |
| A-112 | Connector run cost per live institution | $/mo | $350 | HYPOTHESIS | SIS/LMS/SSO/SCIM connectors, monitoring, vendor API fees. |
| A-113 | Integration certification and partner-program fees | $/yr | $20,000 / $35,000 / $40,000 | HYPOTHESIS | LTI/1EdTech and SIS vendor programs. |
| A-114 | Licensed data and content feeds (maps, dining, jobs) | $/mo | $1,500 / $2,500 / $4,000 | HYPOTHESIS |  |
| A-115 | Billing platform and bank fees on institutional billings | % | 0.5% | VENDOR |  |
| A-116 | Support contacts per 100 direct users per month | # | 2 | HYPOTHESIS | Repo defines support contact rate as tickets per 100 active users. |
| A-117 | Semester-handled contacts per 100 institutional students per month | # | 1.5 | HYPOTHESIS | Institution help desk takes first line. |
| A-118 | Blended cost per support contact | $ | $4.50 | HYPOTHESIS | Tier-1 BPO plus escalation. |
| A-119 | Support tooling (help desk, status page, telephony) | $/mo | $800 / $2,000 / $4,000 | HYPOTHESIS |  |

## 8. Operating expenses (non-people)

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-120 | Institutional demand generation and events | $/yr | $60,000 / $180,000 / $320,000 | HYPOTHESIS |  |
| A-121 | Brand, content, PR and community | $/yr | $50,000 / $120,000 / $200,000 | HYPOTHESIS |  |
| A-122 | Sales tools, RFP and procurement-response support | $/yr | $24,000 / $60,000 / $100,000 | HYPOTHESIS |  |
| A-123 | Security and compliance program (tools, pen test, SOC 2 readiness/audit) | $/yr | $60,000 / $180,000 / $260,000 | HYPOTHESIS | Pen test, SOC 2, bug bounty; timing lumpy in practice. |
| A-124 | Third-party accessibility audits and VPAT | $/yr | $25,000 / $50,000 / $60,000 | HYPOTHESIS |  |
| A-125 | Outside counsel (formation, privacy, contracts, marketplace terms) | $/yr | $120,000 / $200,000 / $320,000 | HYPOTHESIS | Counsel quotes needed. |
| A-126 | Insurance premiums (cyber, tech E&O, GL, D&O, crime, WC) | $/yr | $30,000 / $75,000 / $140,000 | HYPOTHESIS | Broker quote needed; institutional buyers ask for certificates. |
| A-127 | Accounting, bookkeeping, tax and (year 3) first audit | $/yr | $40,000 / $90,000 / $220,000 | HYPOTHESIS |  |
| A-128 | Board, advisors and miscellaneous | $/yr | $30,000 / $60,000 / $90,000 | HYPOTHESIS |  |
| A-129 | Software per head | $/mo | $450 | HYPOTHESIS |  |
| A-130 | Workspace per head | $/mo | $300 | HYPOTHESIS |  |
| A-131 | Payroll/HRIS per head | $/mo | $20 | HYPOTHESIS |  |
| A-132 | Travel and entertainment per head | $/mo | $350 | HYPOTHESIS |  |
| A-133 | Onboarding cost per new hire (equipment, setup) | $ | $3,500 | HYPOTHESIS |  |
| A-134 | Recruiting fee, % of base (roles flagged) | % | 12.0% | HYPOTHESIS |  |
| A-135 | Contingency reserve, % of non-people operating spend | % | 5.0% | POLICY | Explicit reserve; spend only with CFO approval. |
| A-136 | Legal and closing cost on equity raises | % | 3.0% | HYPOTHESIS |  |

## 9. Financing (assumptions, not commitments)

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-137 | Round 1 amount (seed) | $ | $4,500,000 | HYPOTHESIS | Illustrative. Counsel and board decide structure. |
| A-138 | Round 1 month | month # | 1 | HYPOTHESIS |  |
| A-139 | Round 2 amount (Series A) | $ | $14,000,000 | HYPOTHESIS |  |
| A-140 | Round 2 month | month # | 13 | HYPOTHESIS |  |
| A-141 | Round 3 amount (Series B / extension) | $ | $9,000,000 | HYPOTHESIS |  |
| A-142 | Round 3 month | month # | 26 | HYPOTHESIS |  |
| A-143 | Minimum cash policy (months of net burn) | months | 6 | POLICY | Below this, the trigger register in the approval matrix fires. |

## 10. Incident scenario parameters (used only when the incident flag is on)

| ID | Assumption | Unit | Value (Y1 / Y2 / Y3 where it varies) | Basis | Note |
| --- | --- | --- | --- | --- | --- |
| A-144 | Incident month | month # | 20 | HYPOTHESIS |  |
| A-145 | Forensics and incident-response retainer | $ | $250,000 | HYPOTHESIS |  |
| A-146 | Legal and regulatory response | $ | $300,000 | HYPOTHESIS | Counsel decides notification duties. |
| A-147 | People affected (notification population) | # | 30,000 | HYPOTHESIS |  |
| A-148 | Notification, call-centre and monitoring cost per person | $ | $11.00 | HYPOTHESIS |  |
| A-149 | Other remediation and customer-support surge | $ | $150,000 | HYPOTHESIS |  |
| A-150 | Service credits, % of monthly Dept/Institution revenue, 3 months | % | 15.0% | HYPOTHESIS | Contract-dependent. |
| A-151 | Insurance retention (deductible) | $ | $100,000 | HYPOTHESIS |  |
| A-152 | Insurance recovery on direct costs above retention | % | 70.0% | HYPOTHESIS | Coverage not assumed to apply; broker and counsel to confirm. |
| A-153 | Months from last incident cost to recovery | months | 6 | HYPOTHESIS |  |

## Scenario drivers

| ID | Driver | Unit | Conservative | Base | Aggressive | Enterprise-delayed | High-AI-cost | Incident-cost | Gated plan (CFO rec.) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | Student registrations multiplier | x | 0.65 | 1 | 1.5 | 1 | 1 | 0.9 | 0.9 |
| S-02 | Free→paid conversion multiplier | x | 0.8 | 1 | 1.2 | 1 | 1 | 0.95 | 0.95 |
| S-03 | Student churn multiplier (higher = worse) | x | 1.25 | 1 | 0.85 | 1 | 1 | 1.1 | 1 |
| S-04 | Institutional new-logo volume multiplier | x | 0.6 | 1 | 1.4 | 1 | 1 | 0.85 | 0.9 |
| S-05 | Institutional price realization (ACV) multiplier | x | 0.85 | 1 | 1.1 | 1 | 1 | 1 | 1 |
| S-06 | Enterprise signing delay (Dept/Institution) | months | 3 | 0 | 0 | 6 | 0 | 0 | 0 |
| S-07 | Extra months signing → go-live | months | 2 | 0 | 0 | 3 | 0 | 1 | 0 |
| S-08 | Institutional logo churn multiplier (higher = worse) | x | 1.5 | 1 | 0.75 | 1.2 | 1 | 1.75 | 1 |
| S-09 | Expansion multiplier | x | 0.7 | 1 | 1.25 | 0.85 | 1 | 0.8 | 1 |
| S-10 | Implementation hours multiplier (overrun) | x | 1.25 | 1 | 0.95 | 1.2 | 1 | 1.15 | 1 |
| S-11 | AI token usage multiplier | x | 1 | 1 | 1.2 | 1 | 2 | 1 | 1 |
| S-12 | AI vendor price multiplier | x | 1 | 1 | 0.9 | 1 | 1.5 | 1 | 1 |
| S-13 | Delay for flexible hires | months | 3 | 0 | 0 | 3 | 0 | 0 | 9 |
| S-14 | Flexible-role headcount cost multiplier (capacity added) | x | 1 | 1 | 1.15 | 1 | 1 | 1 | 1 |
| S-15 | Marketplace launch delay | months | 6 | 0 | 0 | 0 | 0 | 3 | 0 |
| S-16 | Marketplace/employer/alumni/AI add-on adoption multiplier | x | 0.6 | 1 | 1.4 | 0.9 | 1 | 0.9 | 0.9 |
| S-17 | Collections delay | months | 1 | 0 | 0 | 1 | 0 | 1 | 0 |
| S-18 | Security incident occurs (1 = yes) | flag | 0 | 0 | 0 | 0 | 0 | 1 | 0 |

## Hiring plan (plan of record)

| Role | Function | Qty | Start month | Base pay | Gate |
| --- | --- | ---: | ---: | ---: | --- |
| CEO / founder | G&A | 1 | 1 | $90,000 | core |
| CTO / co-founder | R&D | 1 | 1 | $130,000 | core |
| Staff platform engineer (identity, policy, audit) | R&D | 1 | 3 | $195,000 | core |
| Product manager | R&D | 1 | 4 | $155,000 | core |
| Backend and API engineers | R&D | 2 | 5 | $170,000 | core |
| Frontend engineers | R&D | 2 | 6 | $165,000 | core |
| Product designer | R&D | 1 | 6 | $145,000 | core |
| Head of Marketing and Growth | S&M | 1 | 8 | $140,000 | flexible |
| Head of Sales / CRO | S&M | 1 | 8 | $150,000 | core |
| Data / AI platform engineer | R&D | 1 | 8 | $190,000 | flexible |
| Mobile and offline engineers | R&D | 2 | 9 | $180,000 | flexible |
| SRE / DevOps | R&D | 1 | 9 | $180,000 | flexible |
| Account executive #1 | S&M | 1 | 10 | $110,000 | core |
| Security engineer | R&D | 1 | 10 | $190,000 | flexible |
| Support and trust lead | COGS | 1 | 10 | $95,000 | core |
| Head of Finance and RevOps | G&A | 1 | 10 | $140,000 | flexible |
| Solutions engineer #1 | S&M | 1 | 11 | $140,000 | flexible |
| Customer success manager #1 | COGS | 1 | 11 | $115,000 | core |
| Integration engineers | R&D | 2 | 12 | $170,000 | flexible |
| Accessibility and design-systems lead | R&D | 1 | 12 | $150,000 | flexible |
| Lifecycle and content marketer | S&M | 1 | 12 | $100,000 | flexible |
| Privacy and compliance operations lead | G&A | 1 | 13 | $135,000 | flexible |
| QA / SDET | R&D | 1 | 13 | $135,000 | flexible |
| SDR #1 | S&M | 1 | 14 | $70,000 | flexible |
| Partnerships manager (employers, marketplace) | S&M | 1 | 14 | $125,000 | flexible |
| Backend / frontend engineer (wave 2) | R&D | 2 | 15 | $170,000 | flexible |
| Account executive #2 | S&M | 1 | 15 | $110,000 | flexible |
| Learning scientist / academic integrity | R&D | 1 | 16 | $130,000 | flexible |
| Community and ambassador manager | S&M | 1 | 16 | $85,000 | flexible |
| Trust and safety analyst | COGS | 1 | 17 | $90,000 | flexible |
| Security / GRC engineer | R&D | 1 | 18 | $175,000 | flexible |
| Customer success manager #2 | COGS | 1 | 19 | $115,000 | flexible |
| AI / ML evaluation engineer | R&D | 1 | 20 | $190,000 | flexible |
| Marketplace and employer sales | S&M | 1 | 20 | $115,000 | flexible |
| Account executive #3 | S&M | 1 | 21 | $110,000 | flexible |
| People and recruiting operations | G&A | 1 | 22 | $115,000 | flexible |
| Solutions engineer #2 | S&M | 1 | 22 | $140,000 | flexible |
| Data / analytics engineer | R&D | 1 | 24 | $165,000 | flexible |
| Controller (full-time) | G&A | 1 | 24 | $150,000 | flexible |
| Engineering manager | R&D | 1 | 25 | $200,000 | flexible |
| Engineers (wave 3) | R&D | 2 | 27 | $175,000 | flexible |
| Customer success manager #3 | COGS | 1 | 27 | $115,000 | flexible |
| Account executive #4 | S&M | 1 | 28 | $110,000 | flexible |
| SDR #2 | S&M | 1 | 28 | $70,000 | flexible |

Base pay excludes the 20% employer burden and 3% annual wage inflation the model adds. Founder pay is a board decision; the figures are placeholders.
