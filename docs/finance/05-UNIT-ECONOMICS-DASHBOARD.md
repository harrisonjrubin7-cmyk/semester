<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 05. Unit-economics dashboard

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

The dashboard below is the Base scenario. Every metric exists as a live row in the workbook (`Dashboard` sheet, scenario selector in B3) with the same definition. "Guardrail" columns are **proposed** thresholds for the board to adopt or change; none is a decision. `docs/COMPANY-FIRST-YEAR-MEASURES.md` lists each of these measures as *defined* with no reading; this page gives them a model reading and a formula, not an observed one.

## The dashboard

| Metric | Definition | Year 1 | Year 2 | Year 3 | Proposed guardrail |
| --- | --- | ---: | ---: | ---: | --- |
| CAC, student (fully loaded) | paid test budget + half of marketing + free-tier serving cost, over new paying subscribers | n/a | $932 | $622 | LTV/CAC >= 3 |
| LTV, student | ARPU x margin on paying subscribers / monthly churn | n/a | $136 | $125 |  |
| LTV / CAC, student |  | n/a | 0.15x | 0.20x | >= 3.0x |
| Student CAC payback | CAC / (ARPU x margin on paying subscribers), months | n/a | 264 mo | 142 mo | <= 12 mo |
| Student ARPU (monthly) | revenue / 12 / average subscribers | n/a | $4.74 | $5.72 |  |
| Margin on paying subscribers | their own variable cost only (infra, AI, support, payment/app-store fees) | n/a | 74.5% | 76.7% | >= 70% |
| Monthly churn, paying students | lost / opening subscribers, incl. non-renewals | n/a | 2.6% | 3.5% | <= 4% |
| Free-user serving cost | variable cost of all free active users, per year | $3,481 | $36,766 | $78,481 |  |
| Free-user cost / student revenue |  | n/a | 5.0x | 2.3x | <= 0.5x |
| Paying share of consumer users | paying / (paying + free active), year end | n/a | 1.5% | 2.6% |  |
| CAC, institution (per new annual contract) | sales + commissions + half of non-student marketing, over new annual contracts | $255,501 | $228,151 | $58,890 |  |
| CAC, institution (per new institution started) | same cost over paid pilots + direct starts | n/a | $69,586 | $34,761 |  |
| Gross margin, total | (revenue - cost of revenue) / revenue | n/m | -71.0% | 15.9% | >= 65% at scale |
| Gross margin, institutional | platform, pilots, add-ons less variable cost, integrations and customer success | n/m | 52.1% | 66.4% | >= 70% at scale |
| Variable margin, all consumer users | includes free-user cost | n/m | -497.6% | -215.5% | > 0% |
| Contribution margin | gross profit less paid acquisition and commissions | n/m | -87.6% | 3.1% |  |
| Implementation margin, actual | (services revenue - implementation team cost) / services revenue | n/m | -57.3% | 21.4% | >= 25% |
| Implementation margin at standard cost | fees vs hours x loaded rate: the pricing check | n/m | 31.7% | 21.7% | >= 30% |
| Implementation utilization | hours demanded / hours the team can deliver | 40.5% | 47.3% | 108.2% | 80-110% |
| Net revenue retention (core, by construction) | logo renewal x (1 + expansion) | 96.8% | 96.8% | 96.8% | >= 100% |
| Gross logo retention |  | 88.0% | 88.0% | 88.0% | >= 90% |
| AI cost per active user per month |  | $1.51 | $0.43 | $0.31 |  |
| AI cost / revenue |  | n/m | 13.5% | 7.9% | <= 12% |
| Net burn | -(operating cash flow) | $2,455,739 | $4,780,289 | $5,491,160 |  |
| Burn multiple | net burn / net new ARR | n/m | 32.4x | 4.0x | <= 3.0x |
| ARR at year end | recurring revenue x 12 | $15,840 | $163,394 | $1,527,680 |  |
| ARR per FTE |  | $861 | $5,204 | $37,814 |  |
| Cumulative cash need |  | $2,455,739 | $7,236,028 | $12,727,188 |  |

Runway is not in the table because it needs the real cash balance. In the workbook: `Compare` row "Month cash runs out on the illustrative opening capital"; in operation, runway is cash divided by the trailing three-month average net burn and is a monthly line in the board package ([10](10-BOARD-REPORTING-PACKAGE.md)).

## Reading the student numbers: Plus does not fund its own acquisition

Under the Base assumptions the student subscription is a margin-positive product per paying subscriber (margin on paying subscribers 76.7%, LTV about $125) and a loss-making funnel. Two causes, both visible in the table:

1. **The free tier is a cost, not a funnel stage.** At Year 3 the model serves about 27,288 free active students at roughly $0.26 per user per month ($0.14 of it AI), which is 2.3x the revenue paying students bring in.
2. **Conversion is low and churn is normal for students.** A free user converts at 0.25% a month and leaves at 12%, so only 2.0% of active free users ever pay. A marginal paid signup at $3.00 (activation 60%) therefore costs about $245 per paying subscriber **before** any free-tier or payroll allocation, against an LTV of about $125.

What would have to be true: with all other inputs held, Year 3 LTV/CAC reaches 1.0x only if monthly conversion is about 1.31% (5.2x the assumption) and reaches 3.0x only at about 4.49% (18x), which would mean about 33% of active consumer users paying. Neither is a reasonable thing to plan on. The conclusion the model supports, as a hypothesis to test with the invitation-only cohort, is:

* Treat Plus as a retention and ARPU product delivered through institutions and organic use. Keep the paid acquisition line a **test budget** (it is $1,000 to $5,000 a month in the model and zero before G3), released in tranches only when a measured marginal cost per paying subscriber is under a third of measured LTV.
* Cap free-tier AI by policy, not by surprise: a free-tier cap of 4 requests a month instead of 10 cuts free-user serving cost by roughly 34%. This is a product decision with an accessibility and fairness side; it belongs to the AI governance board, not to finance alone.
* Re-run this section on the first real cohort. The three numbers to measure first are free-to-paid conversion, free-user AI requests per month, and paying-subscriber churn.

## Reading the institutional numbers

Per fully rolled-out account, at list less the 12% realized discount (variable cost uses the same unit costs as the model):

| Tier | List ACV | Net ACV | Active students | Net ACV per active student | Variable cost / yr | Variable margin | Implementation fee | Std hours | Impl. margin at std cost | Account LTV (margin / (1 - renewal)) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Department | $30,000 | $26,400 | 600 | $44.00 | $6,853 | 74% | $15,000 | 115 | 35% | $162,888 |
| Campus | $85,000 | $74,800 | 2,500 | $29.92 | $16,966 | 77% | $40,000 | 330 | 30% | $481,952 |
| System | $220,000 | $193,600 | 9,000 | $21.51 | $51,561 | 73% | $100,000 | 800 | 32% | $1,183,661 |

Reading across: variable margin per account is healthy (73% to 77%) once an account is live. The economics are won or lost on three things the table does not show: whether the implementation team is staffed to the demand (the utilization row above), how many months pass between an account's first cost and its first dollar (design-partner and pilot months carry cost and little revenue), and whether the account renews. The **price corridor** check from [02](02-REVENUE-STREAMS-AND-PRICING.md) applies: net price per active student must not exceed the consumer annual list ($59) and should sit well above variable cost; Department is closest to the ceiling.

## AI unit economics

Cost per request, built up from the Anthropic list prices in the API reference (Haiku 4.5 $1/$5, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 per million tokens, cache read about 10% of input):

| Step | Value |
| --- | ---: |
| Blended input price at the routing mix 70% / 28% / 2% | $1.34 per M tokens |
| Blended output price | $6.70 per M tokens |
| Input tokens per request / output tokens | 6,000 / 700 |
| Effective input factor after prompt caching (50% cacheable, 70% hit rate) | 0.685 |
| Input cost | $0.00551 |
| Output cost (x1.5 for reasoning tokens) | $0.00704 |
| Embeddings / retrieval / moderation overhead | +15% |
| **Cost per request** | **$0.0144** |
| Per free user per month (10 requests) | $0.14 |
| Per paying user per month (45 requests) | $0.65 |
| Per sponsored user per month (20 requests) | $0.29 |

AI is 7.9% of Year 3 revenue in Base and 22.5% in the High-AI-cost scenario (unit cost x2.5, usage x1.5, no repricing). The existing controls (`private.reserve_ai_budget` per-tenant monthly budget, `kill.ai_generation`, the T3 classification gate) cap the exposure; the missing pieces are the ones `docs/operating-model/COMMERCIAL-GOVERNANCE.md` already lists as designed-only: user fair-use limits, cost alerts and per-outcome cost. Finance needs `private.ai_usage_month` tokens joined to price by model and tenant, monthly, before any AI price is set.

**Pricing rule proposed:** AI is sold as an *allowance included in a plan* with a transparent cap, and as an institution-managed capacity add-on; never as an open-ended consumer meter (the audit's "no surprise student bills" rule, and the AI-allowance row of the launch-completeness pricing principles).
