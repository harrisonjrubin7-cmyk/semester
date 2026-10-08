# Cost model

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | `Costs`, `Headcount` and `Assumptions` sheets of [`semester-financial-model.xlsx`](semester-financial-model.xlsx) |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Every requested cost line, where it lives, what drives it

Base scenario, $ thousands.

| Cost line | Year 1 | Year 2 | Year 3 | Driver | Behavior | Home in the model |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Engineering (R&D people) | 1,512 | 4,222 | 5,515 | Hiring plan; flexible roles gated | Step (hires) | Operating: R&D |
| AI inference and AI platform | 32 | 99 | 276 | Active users × tasks × cost per task + fixed tooling | Variable + fixed | Cost of revenue |
| Infrastructure (hosting, compute) | 52 | 136 | 288 | Fixed platform (environments, DR) + per active user | Fixed + variable | Cost of revenue |
| Storage and backup | 1 | 7 | 39 | GB per user × price × backup multiple | Variable | Cost of revenue |
| Bandwidth and CDN | 2 | 16 | 54 | GB per user × price | Variable | Cost of revenue |
| Search and vector store | 11 | 27 | 66 | Fixed + per active user | Fixed + variable | Cost of revenue |
| Notifications | 2 | 10 | 36 | Per active user | Variable | Cost of revenue |
| Integrations | 45 | 103 | 211 | Live institutions × run cost + certification + licensed feeds | Step | Cost of revenue |
| Payment, app-store and billing fees | 3 | 19 | 51 | % and fixed fees on billings | Variable | Cost of revenue |
| Marketplace processing, disputes, moderation | - | 3 | 40 | GMV and orders | Variable | Cost of revenue |
| Support (variable) | 14 | 52 | 140 | Contacts × cost per contact + tooling | Variable + fixed | Cost of revenue |
| Implementation delivery | 63 | 469 | 1,172 | Hours × cost per delivered hour | Variable (contract and partner capacity) | Cost of revenue |
| Customer success, support and trust people | 52 | 405 | 650 | Hiring plan | Step | Cost of revenue |
| Sales (people, commissions, tools, channel fees) | 167 | 938 | 1,608 | AEs, SEs, SDRs; 10% commission; tools; 1% channel fee | Step + variable | Operating: S&M |
| Marketing (people, student acquisition, programs, brand) | 220 | 966 | 1,389 | Growth, lifecycle, partnerships; ambassador and paid spend; events | Discretionary | Operating: S&M |
| Security, compliance and accessibility audits | 85 | 230 | 320 | Tools, pen tests, SOC 2, VPAT; security engineers are in R&D | Step | Operating: G&A |
| Legal and financing costs | 255 | 620 | 590 | Retainer plus 3% of each raise | Fixed + event | Operating: G&A |
| Insurance | 30 | 75 | 140 | Premiums scale with revenue and risk | Step | Operating: G&A |
| G&A people | 150 | 502 | 802 | Hiring plan | Step | Operating: G&A |
| Accounting, tax and audit | 40 | 90 | 220 | Provider fees; first audit in year 3 | Step | Operating: G&A |
| Tools, workspace, T&E, onboarding, recruiting, board | 688 | 915 | 871 | Per head and per hire | Variable with headcount | Operating: G&A |
| Bad debt and contingency reserve | 65 | 138 | 205 | 1% of institutional billings; 5% of non-people spend | Policy | Operating: G&A |

Total cost of revenue: 276 / 1,346 / 3,023. Total operating expenses: 3,212 / 8,697 / 11,660. The classification between cost of revenue and operating expense follows common SaaS practice and is **[REQUIRES QUALIFIED REVIEW]** (Q-11, Q-12).

## 2. Headcount

| Function | Heads Y1 | Heads Y2 | Heads Y3 | Cost Y1 ($k) | Cost Y2 | Cost Y3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| R&D | 16 | 23 | 26 | 1,512 | 4,222 | 5,515 |
| Sales and marketing | 5 | 12 | 14 | 216 | 1,352 | 1,948 |
| G&A | 2 | 5 | 5 | 150 | 502 | 802 |
| Customer success and support (cost of revenue) | 2 | 4 | 5 | 52 | 405 | 650 |
| **Total** | 25 | 44 | 50 | 1,930 | 6,481 | 8,915 |

The plan has 13 core and 37 flexible full-time equivalents by month 36 (flexible roles are released behind the gates in document 05). Pay is fully loaded with 20% employer burden and 3% annual inflation from year 2. Founder pay ($90,000 and $130,000) is a board decision and a placeholder. Implementation delivery is **not** in this headcount: it is a variable cost at delivered hours, staffed by contractors and partners, with an implied peak of about 14 full-time equivalents in year 3.

## 3. Cost per unit

| Unit | Cost | Built from |
| --- | ---: | --- |
| AI task (list prices, routing, caching, overhead) | $0.0146 | 6,000 input and 800 output tokens; 75% small / 20% mid / 5% frontier; 40% input saving from caching; 20% overhead |
| Platform cost per active user per month (compute, storage, bandwidth, search, notifications) | $0.212 | Year-3 storage per user; excludes AI and support |
| Free active user per month | $0.42 | Platform + 8 AI tasks + support at 2 contacts per 100 users |
| Paid subscriber per month (before payment fees) | $0.89 | Platform + 40 AI tasks + support |
| Premium AI add-on subscriber per month | $2.49 | Platform + 150 AI tasks + support |
| Institutional active student per month | $0.45 | Platform + 12 AI tasks (included allowance) + support at 1.5 per 100 |
| Support contact | $4.50 | Tier-1 provider plus escalation |
| Live institution per month (connector run cost) | $350 | Connectors, monitoring, vendor API fees |
| Delivered implementation hour | $89 | $62 loaded per available hour ÷ 70% utilization |

### AI cost, worked example

| Tier | Routing share | Input $/M tokens | Output $/M tokens | Input cost per task | Output cost per task | Cost per task |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Small | 75% | $1.00 | $5.00 | $0.0036 | $0.0040 | $0.0076 |
| Mid | 20% | $3.00 | $15.00 | $0.0108 | $0.0120 | $0.0228 |
| Frontier | 5% | $5.00 | $25.00 | $0.0180 | $0.0200 | $0.0380 |

Blended: $0.0122 per task, $0.0146 with 20% guardrail, retrieval and evaluation overhead. **Every vendor price is an illustrative list price [VENDOR]: replace with the contracted rate and refresh quarterly.** Tripling cost per task (doubled usage, +50% price) is the high-AI-cost scenario.

## 4. Cost-control levers, ranked by Base-case effect

Effect on the 36-month peak funding need, $ thousands (negative = saves cash):

| Change | Effect on peak need ($k) | Lever |
| --- | ---: | --- |
| Delay flexible hires 3 months | (1,755) | Gate hires on milestones (document 05) |
| Collections one month slower (cost if it happens) | 666 | Net-45 default; collect on day 0; ACH |
| Implementation hours +25% (cost if it happens) | 426 | Fixed scope, change orders, productized playbook |
| AI usage +20% (cost if it happens) | 54 | Allowance and cap; routing; caching |
| Add 15% flexible capacity (cost if it happens) | 1,696 | Release only at the gate |
| AI vendor price −10% (benefit) | (27) | Competitive vendor routing |

Recruiting fees are a large avoidable cost in year 1 (12% of base pay on flagged roles); referral and founder-led hiring cut them. Insurance, security and legal costs are floors set by what institutional buyers require, not discretionary.

## 5. Items to verify before the numbers are used

- Every **VENDOR** input in the register (model prices, storage, egress, card fees, app-store commission, billing platform): replace with contracted or published current rates.
- Broker quotes for insurance; counsel and accountant fee quotes; payroll or PEO burden.
- A security and compliance plan with dates: pen test, SOC 2 readiness and audit, VPAT.
- First-cohort measurements of AI tasks per user, support contact rate, storage and egress per user. The model's usage inputs are guesses until measured.

## Cannot be completed from source code

Vendor contracts, quotes, salaries, payroll burden, support volumes and measured usage require procurement, HR and operating data.
