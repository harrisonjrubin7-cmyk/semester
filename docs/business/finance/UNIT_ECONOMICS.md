# Unit economics

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING ANALYSIS. NOT A FORECAST, TARGET OR CLAIM.** |
| Owner | Harrison Rubin (interim; accountant unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | `[VERIFIED]` `[ASSUMPTION]` `[DRAFT]` `[INTERNAL]` `[REVIEW: accounting]` |
| Audience | Internal |

> Operating document, not accounting, tax or investment advice. Every figure below is a **Forecast** from the in-app model on planning assumptions; none is evidenced.

## Relationship to existing artifacts

| Existing artifact | What it covers | What this adds |
| --- | --- | --- |
| [`docs/finance/04-UNIT-ECONOMICS.md`](../../finance/04-UNIT-ECONOMICS.md) | Metric definitions and guardrails for the full-scope workbook | The brief's five formulas applied to the lean, pilot-led model, plus a readable sensitivity analysis |
| [`docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md) | Pricing, entitlement and AI-unit architecture | Nothing is restated; conflicts with it are listed below |
| [`FINANCIAL_MODEL_SPEC.md`](FINANCIAL_MODEL_SPEC.md) | The model and its formulas | This document reads the results |

## Formulas `[VERIFIED]`

CAC = sales and marketing spend / new customers acquired. CAC payback months = CAC / monthly gross profit per customer. LTV = annual recurring revenue x gross margin / annual logo churn. MRR = annual recurring revenue / 12 + recurring monthly student revenue. Break-even = first month where cumulative gross profit covers cumulative operating expenses and required cash obligations. Held by `app/src/finance/financialModel.test.ts`.

## One institution at Base prices `[ASSUMPTION]`

2,500 enrolled students in scope, 70% invited, 50% of those activate (875 active), 60 AI requests per active student per month.

| Line | Per year | Working |
| --- | ---: | --- |
| Platform fee | $45,000 | max($30,000, $18 x 2,500) |
| Premium support, expected | $4,500 | 30% buy it x max($15,000, 15% x $45,000) |
| ARR per customer | $49,500 | platform + expected support |
| AI overage | $0 | 875 x 60 = 52,500 requests a month, under the 2,400-a-student-year pool |
| Variable cost to serve | $17,400 | 875 x ($0.21 cloud + 60 x $0.0146 AI) + $500 support, x 12 |
| Unit gross margin | 64.8% | monthly gross profit $2,675 on $4,125 |

## Results at Base `[ASSUMPTION]` (Forecast)

| Metric | Value | Reading |
| --- | ---: | --- |
| CAC, per annual customer | $157k | About two annual customers are won in 36 months, so a thin denominator carries a founder's selling cost |
| CAC per pilot signed | $45k | |
| CAC payback | about 59 months | CAC / $2,675 a month |
| LTV | $214k | $49,500 x 64.8% / 15% churn |
| LTV : CAC | 1.4x | Under the 3x rule of thumb, which is a heuristic and not a target |
| Gross retention | 85% | An input; no renewal has ever happened |
| Net revenue retention | 93.5% by formula, 92.7% measured | The $15,000 support minimum does not grow with scope, so measured trails formula |
| End-to-end pilot yield | 37.8% | 90% activate x 70% succeed x 60% convert |

## Scenario table `[ASSUMPTION]` (Forecast; regenerate from the **Finance model** tab)

| Scenario | Month-36 ARR | Year-3 revenue | Year-3 gross margin | Lowest cash | Funding needed | Break-even | Warnings besides the pilot gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Conservative | $21.9k | $83.5k | -142% | -$1.21M | $1.21M | none in 36 mo | margin, runway, no-conversions |
| Base | $110k | $332k | 28% | -$724k | $724k | none in 36 mo | margin, runway |
| Ambitious | $372k | $948k | 60% | -$172k | $172k | month 35 | capacity, margin, runway |
| Downside / delayed sales | $60k | $199k | -10% | -$1.03M | $1.03M | none in 36 mo | capacity, margin, runway |
| Long procurement cycle | $82.4k | $305k | 25% | -$908k | $908k | none in 36 mo | margin, runway |
| Pilot-heavy | $154k | $613k | 56% | -$261k | $261k | none in 36 mo | capacity, margin, runway |
| Annual-contract-heavy | $206k | $386k | 32% | -$696k | $696k | none in 36 mo | margin, runway |
| High AI usage | $110k | $400k | -3% | -$885k | $885k | none in 36 mo | margin, runway, ai |
| Low student adoption | $107k | $331k | 31% | -$709k | $709k | none in 36 mo | margin, runway |
| High implementation cost | $110k | $332k | 28% | -$895k | $895k | none in 36 mo | capacity, margin, runway |
| Low conversion | $24.5k | $174k | -21% | -$1.01M | $1.01M | none in 36 mo | margin, runway |
| High conversion | $196k | $397k | 34% | -$643k | $643k | none in 36 mo | margin, runway |

The opening balance is a $100,000 placeholder, so every scenario's runway is short; **funding needed** is the figure that separates them.

## What the numbers say `[DRAFT]`

1. **Volume, not price, is the constraint.** At 20 accounts contacted a month and a 1.3% contact-to-signed yield, Base signs about 0.26 pilots a month. No scenario except Ambitious (35 accounts a month with stronger stage rates and an earlier gate) covers a team. The brief's "narrow, measurable pilot" thesis needs enough qualified conversations, and the model prices that need.
2. **CAC is dominated by founder time and thin volume.** Counting half of one founder's cost as selling, with about two annual wins in three years, produces a CAC larger than one customer's first-year revenue. Counting zero founder time would be flattering, not correct.
3. **LTV is almost entirely a function of churn the company has never measured.** At 85% retention LTV is $214k; at 95% it is $643k. See the table below. Use ranges until retention data exists.
4. **Delivery capacity is tight.** One delivery head supplies 120 hours a month; one implementation needs 400 hours over two months (200 a month). One head therefore covers about 0.6 concurrent implementations, or roughly 0.3 new ones a month. Base signs 0.26. Any scenario that signs faster, or batches deals behind the pilot gate, trips the capacity warning and buys the overflow from contractors at $90 an hour.
5. **AI pool versus cost needs a definition and a decision.** The pool is 2,400 requests per student per year. At the repository cost model's $0.0146 per action that is $35 per student per year against an $18 platform price if every request were used; at the higher blended per-call figure noted in [`FINANCIAL_MODEL_SPEC.md`](FINANCIAL_MODEL_SPEC.md) it is more. The model's usage default (60 requests a month per active student, 875 of 2,500 students active) keeps cost low. The High AI scenario shows the margin turn negative and the AI warning fire. Overage at $30 per 1,000 requests ($0.03 each) is only about two times the $0.0146 cost, and below the higher figure. `[REVIEW: accounting]` before any AI price is quoted.
6. **The paid-pilot gate is worth more than any rate.** Moving the gate from month 7 to 12 and slowing the cycle (Downside) cuts month-36 ARR from $110k to $60k and deepens funding need by about $300k.

## LTV sensitivity `[ASSUMPTION]`

LTV = $49,500 ARR x gross margin / annual logo churn. Computed by hand; the model uses its measured 64.8% unit margin.

| Annual logo churn | Margin 50% | Margin 65% | Margin 80% |
| --- | ---: | ---: | ---: |
| 5% | $495,000 | $643,500 | $792,000 |
| 10% | $247,500 | $321,750 | $396,000 |
| 15% | $165,000 | $214,500 | $264,000 |
| 20% | $123,750 | $160,875 | $198,000 |
| 30% | $82,500 | $107,250 | $132,000 |

At the Base CAC of about $157k, LTV : CAC clears 3x only in the bottom-left of this grid (churn 5%, margin above about 65%, or churn 10% at 80%). That is a statement about arithmetic, not a target.

## Hiring capacity `[ASSUMPTION]`

Delivery heads by year are inputs (Base: 1, 1, 2). Each head adds 120 billable hours a month. Hire the next delivery head when projected implementation demand exceeds about 80% of capacity for two consecutive months (a management rule of thumb to confirm). Hiring is gated on evidence per [`docs/finance/12-GATED-HIRING-SCHEDULE.md`](../../finance/12-GATED-HIRING-SCHEDULE.md), not on this model.

## Evidence state

**Repository evidence.** Formulas and arithmetic are tested (`app/src/finance/financialModel.test.ts`). `[VERIFIED]`
**Operational evidence.** None. No conversion, retention, cost, usage or price is measured.
**Missing proof.** First design-partner results for conversion drivers, implementation hours, support load and AI usage per active student.

## Claim ceiling

An internal planning analysis. Ranges only; no point estimate is a company claim.

## Prohibited claims

Do not state a CAC, LTV, payback, margin, retention, ARR or runway as the company's, to any outside party, on the strength of this document.

## Professional review required

- `[REVIEW: accounting]` definitions of gross margin, CAC allocation of founder time, AI cost classification.
- `[REVIEW: tax]` none specific; treatment of founder compensation.
- `[REVIEW: counsel]` any quoted price, overage rate or pilot fee.
