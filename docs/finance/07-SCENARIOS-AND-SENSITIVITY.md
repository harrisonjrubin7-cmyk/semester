# Scenario analysis and sensitivity

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | `Scenario_Control` and `Scenario_Results` sheets of [`semester-financial-model.xlsx`](semester-financial-model.xlsx); one-at-a-time sensitivities run on the Base case |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. The seven scenarios

Six are requested by the brief. The seventh, the gated plan, is the CFO's recommended response to what the first six show. One selector switches them all; every number below comes from recalculating the workbook once per scenario.

| Scenario | What it changes |
| --- | --- |
| 1. Conservative | 40% fewer institutional logos at 15% lower ACV; signings 3 months later and go-live 2 months longer; 35% fewer registrations and 20% lower conversion; more churn, weaker expansion; 25% implementation overruns; one-month slower collections; flexible hires 3 months later; marketplace 6 months later |
| 2. Base | Assumptions as entered |
| 3. Aggressive | 50% more registrations; 40% more logos at 10% higher ACV; lower churn; stronger expansion; 15% extra capacity cost on flexible roles; 20% more AI usage at 10% lower vendor price |
| 4. Enterprise-delayed | Department and Institution signings 6 months later, go-live 3 months longer, weaker expansion, higher churn, 20% implementation overruns, slower collections; student economics unchanged |
| 5. High-AI-cost | Token usage doubles and vendor prices rise 50% (cost per task triples); revenue and price unchanged |
| 6. Incident-cost | Security incident in month 20: forensics $250,000, legal $300,000, notification for 30,000 people at $11, remediation $150,000; 3 months of service credits at 15%; 15% fewer logos, higher churn and weaker expansion (a simplification: these drivers apply across the whole horizon, not only after the incident); insurance recovery after a $100,000 retention at 70% |
| 7. Gated plan | Base revenue with 10% less volume (less capacity), and every flexible role released 9 months later behind the gates in document 05 |

## 2. Results

| Scenario | Revenue Y3 | ARR end Y3 | Gross margin Y3 | EBITDA Y3 | Peak funding need | Lowest cash with assumed rounds | Months below 6-month cash policy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Conservative | 1,925 | 1,527 | -6% | (11,358) | 22,240 | 1,750 | 2 |
| Base | 4,717 | 4,339 | 36% | (9,967) | 21,134 | 1,196 | 3 |
| Aggressive | 7,153 | 6,894 | 46% | (9,494) | 20,504 | 1,158 | 3 |
| Enterprise-delayed | 2,750 | 2,535 | 15% | (10,897) | 21,404 | 1,754 | 1 |
| High-AI-cost | 4,717 | 4,339 | 27% | (10,375) | 21,672 | 1,180 | 3 |
| Incident-cost | 3,727 | 3,248 | 25% | (10,023) | 23,221 | 1,133 | 7 |
| Gated plan (CFO rec.) | 4,216 | 3,878 | 37% | (8,820) | 16,219 | 2,081 | 0 |

Revenue, EBITDA and cash by year, $ thousands:

| Scenario | Rev Y1 | Rev Y2 | Rev Y3 | EBITDA Y1 | EBITDA Y2 | EBITDA Y3 | Cash end Y3 | Heads Y3 | Burn multiple Y3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Conservative | 65 | 510 | 1,925 | (2,738) | (8,253) | (11,358) | 5,260 | 50 | 9.8x |
| Base | 159 | 1,386 | 4,717 | (3,330) | (8,657) | (9,967) | 6,366 | 50 | 3.0x |
| Aggressive | 232 | 2,043 | 7,153 | (3,385) | (8,960) | (9,494) | 6,996 | 50 | 1.7x |
| Enterprise-delayed | 87 | 648 | 2,750 | (2,734) | (8,164) | (10,897) | 6,096 | 50 | 5.4x |
| High-AI-cost | 159 | 1,386 | 4,717 | (3,346) | (8,771) | (10,375) | 5,828 | 50 | 3.2x |
| Incident-cost | 122 | 1,067 | 3,727 | (3,355) | (9,906) | (10,023) | 4,279 | 50 | 4.3x |
| Gated plan (CFO rec.) | 142 | 1,242 | 4,216 | (2,441) | (5,693) | (8,820) | 11,281 | 48 | 3.0x |

## 3. What each scenario teaches

- **Conservative** ($1.9M Year-3 revenue, $1.5M ARR) is the downside the plan must survive. The peak need barely changes ($22.2M against $21.1M) because costs, not revenue, drive burn. What breaks is the ability to raise the next round: Year-3 ARR is only 35% of Base, so the evidence a Series A would be priced on would be far weaker than Base. Revenue shortfalls are answered by slowing spend, which is exactly what the gated plan does.
- **Aggressive** ($7.2M revenue) does not remove the funding need ($20.5M peak) because the extra growth needs extra capacity. Growth buys a better burn multiple (1.7x against 3.0x in Base) and a stronger raise, not independence from capital.
- **Enterprise-delayed** is a likely way for the plan to go wrong: Year-3 revenue falls to $2.7M and ARR to $2.5M, and subscription gross margin to 11% as fixed cost sits under thin revenue. Sales-cycle length is not under Semester's control, so the response is to protect cash: gate hires, convert pilots, and collect early.
- **High-AI-cost** leaves revenue and the peak need almost untouched (peak $21.7M, +$0.5M) but takes Year-3 subscription gross margin from 36% to 22%. It is a pricing and metering emergency, not a cash one: the response is caps, routing, caching and a price or allowance change before the quarter ends.
- **Incident-cost** adds $2.1M to the peak need, depresses revenue to $3.7M, and holds cash below the six-month policy for 7 months. The direct incident bill is $1.0M before insurance; the larger cost is lost and delayed deals and higher churn. Insurance limits, an incident-response retainer and a tested plan are cheaper than any of those.
- **Gated plan** needs $16.2M, never breaches the cash policy, and gives up $0.5M of Year-3 revenue to get there. It is the recommended operating posture until pilot conversion and sales-cycle data exist.

## 4. Sensitivity of the Base case, one driver at a time

Each row replaces one Base driver with the Conservative (low) or Aggressive (high) value and recalculates. Effects on Year-3 ARR and on the 36-month peak funding need.

| Driver | Tested at | Value | Δ Year-3 ARR | Δ Peak funding need | Δ Year-3 subscription GM (percentage points) |
| --- | --- | --- | ---: | ---: | ---: |
| Institutional new-logo volume multiplier | Conservative value | 0.6 (Base 1) | -$1.29M | $1.19M | -16.5 |
| Institutional new-logo volume multiplier | Aggressive value | 1.4 (Base 1) | $1.29M | -$1.19M | +9.1 |
| Delay for flexible hires | Conservative value | 3 (Base 0) | $0.00M | -$1.76M | +1.3 |
| Flexible-role headcount cost multiplier (capacity added) | Aggressive value | 1.15 (Base 1) | $0.00M | $1.70M | -2.0 |
| Enterprise signing delay (Dept/Institution) | Conservative value | 3 (Base 0) | -$0.88M | $0.79M | -6.5 |
| Extra months signing → go-live | Conservative value | 2 (Base 0) | -$0.75M | $0.73M | -6.3 |
| Institutional price realization (ACV) multiplier | Conservative value | 0.85 (Base 1) | -$0.46M | $0.40M | -6.5 |
| Marketplace/employer/alumni/AI add-on adoption multiplier | Aggressive value | 1.4 (Base 1) | $0.39M | -$0.42M | +5.4 |
| Marketplace/employer/alumni/AI add-on adoption multiplier | Conservative value | 0.6 (Base 1) | -$0.39M | $0.42M | -6.6 |
| Collections delay | Conservative value | 1 (Base 0) | $0.00M | $0.67M | +0.0 |
| Institutional price realization (ACV) multiplier | Aggressive value | 1.1 (Base 1) | $0.31M | -$0.26M | +3.7 |
| Implementation hours multiplier (overrun) | Conservative value | 1.25 (Base 1) | $0.00M | $0.43M | +0.0 |
| Student registrations multiplier | Aggressive value | 1.5 (Base 1) | $0.14M | -$0.02M | -1.7 |
| Institutional logo churn multiplier (higher = worse) | Conservative value | 1.5 (Base 1) | -$0.10M | $0.06M | -0.8 |
| Free→paid conversion multiplier | Aggressive value | 1.2 (Base 1) | $0.06M | -$0.06M | +0.6 |
| Free→paid conversion multiplier | Conservative value | 0.8 (Base 1) | -$0.06M | $0.06M | -0.6 |
| Student registrations multiplier | Conservative value | 0.65 (Base 1) | -$0.10M | $0.02M | +1.3 |
| Expansion multiplier | Conservative value | 0.7 (Base 1) | -$0.06M | $0.04M | -0.4 |
| Implementation hours multiplier (overrun) | Aggressive value | 0.95 (Base 1) | $0.00M | -$0.09M | +0.0 |
| Institutional logo churn multiplier (higher = worse) | Aggressive value | 0.75 (Base 1) | $0.05M | -$0.03M | +0.4 |
| Expansion multiplier | Aggressive value | 1.25 (Base 1) | $0.05M | -$0.03M | +0.3 |
| AI token usage multiplier | Aggressive value | 1.2 (Base 1) | $0.00M | $0.05M | -1.4 |
| Student churn multiplier (higher = worse) | Conservative value | 1.25 (Base 1) | -$0.02M | $0.02M | -0.2 |
| AI vendor price multiplier | Aggressive value | 0.9 (Base 1) | $0.00M | -$0.03M | +0.7 |
| Student churn multiplier (higher = worse) | Aggressive value | 0.85 (Base 1) | $0.01M | -$0.01M | +0.1 |
| Marketplace launch delay | Conservative value | 6 (Base 0) | $0.00M | $0.01M | +0.0 |

Read it as a ranking of attention. Institutional logo volume, the enterprise sales cycle, go-live speed, price realization, adoption of the newer products and hiring pace move the answer most; student churn, expansion and AI price move it least. Student conversion barely moves cash in the model; whether it matters to the story investors hear is a judgment, not a result.

## 5. Early-warning indicators and pre-agreed responses

| Scenario | Leading indicator | Pre-agreed response | Owner |
| --- | --- | --- | --- |
| Conservative / enterprise-delayed | Pipeline coverage below 3x; sales cycle above plan by a quarter; pilots not converting; ARR at raise date below plan | Close flexible-role gates; extend runway; accelerate pilot conversion; collect annual-in-advance; defer marketplace and employer launches | CEO + CFO |
| High-AI-cost | AI cost per active user above 125% of plan two months running; usage above allowance | Lower the allowance; tighten routing to the small model; raise caching; reprice credit packs; add tenant caps | CTO + CFO |
| Incident-cost | Security event at SEV-0 or SEV-1; insurer notice | Incident plan with counsel directing; spend authority per matrix; customer communications; pause non-essential releases | Incident commander |
| Aggressive | Implementation backlog above 4 projects per implementer; ARR per CSM above $1M | Release the next flexible roles through the gate; add partner capacity; protect implementation margin with change orders | CEO + COO + CFO |
| Any | Runway below 12 months at normalized burn | Start financing preparation; board informed | CEO + CFO |

## 6. What the scenarios do not cover

A failed pilot programme (no conversions), loss of a key vendor or model provider, a change in app-store terms, a regulatory change that closes a market, key-person loss, a down-round or no round, and a product that works but is not adopted. These are on the risk register; a simple stress is to set pilot conversion, logos and conversion to zero and read the cash line.

## Cannot be completed from source code

Scenario probabilities, insurance recoveries, financing availability and customer behavior are not knowable from the repository.
