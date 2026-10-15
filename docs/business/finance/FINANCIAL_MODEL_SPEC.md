# Financial model specification: the in-app GTM model

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL. NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET.** |
| Owner | Harrison Rubin (interim; accountant, tax adviser and counsel unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` (model code added on branch `claude/relaxed-turing-af08lj`) |
| Labels used | `[VERIFIED]` `[ASSUMPTION]` `[DRAFT]` `[INTERNAL]` `[REVIEW: accounting]` `[REVIEW: tax]` `[REVIEW: counsel]` |
| Audience | Internal |

> This is an operating document for the founder. It is not accounting, tax, legal, insurance or investment advice. Nothing here is a forecast the company stands behind.

Label legend: `[VERIFIED]` is backed by a path in this repository; `[ASSUMPTION]` is a planning number; `[DRAFT]` needs review; `[INTERNAL]` is not for customers. Labels apply per section and per table row.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this adds | Why a new artifact |
| --- | --- | --- | --- |
| [`docs/finance/semester-financial-model.xlsx`](../../finance/semester-financial-model.xlsx) and [`01-MODEL-AND-CAPITAL-PLAN.md`](../../finance/01-MODEL-AND-CAPITAL-PLAN.md) | Three-year, seven-revenue-stream, nine-scenario workbook with a full-scope hiring thesis | A funnel-driven institutional engine (outreach to signed pilot to annual contract), the brief's twelve scenarios, and the brief's exact CAC, payback, LTV, MRR and break-even formulas | The workbook is a spreadsheet. The brief asks for a tool inside the app, with typed inputs, validation, exports and tests, reusing the app's architecture |
| [`docs/finance/dashboard.html`](../../finance/dashboard.html) and [`tools/engine.js`](../../finance/tools/engine.js) | The workbook's formulas run live in a standalone page | The same kind of tool, inside the operations console behind `console:operate`, in TypeScript with unit tests | A standalone HTML page sits outside the app's authorization, type checking, test gates and design system |
| [`docs/finance/10-GO-NO-GO-GATES.md`](../../finance/10-GO-NO-GO-GATES.md) | Holds revenue behind the go/no-go gates | An explicit `firstPaidPilotMonth` input and a critical banner whenever institutional revenue is modelled | The in-app model needs the same discipline in its own inputs |
| [`docs/finance/assumption-register.md`](../../finance/assumption-register.md), [`03-COST-MODEL.md`](../../finance/03-COST-MODEL.md) | Cost and student-subscription defaults | The model reuses three of its figures (platform cost per active user, AI cost per action, student churn) and names them as sources | Reuse, not duplication |
| [`PRICING_AND_PACKAGING.md`](PRICING_AND_PACKAGING.md) | The brief's pricing assumptions and where they conflict | This spec says how the model uses them | Pricing and mechanics are separate concerns |

The model does **not** replace the workbook. They answer different questions: the workbook asks what the full-scope thesis costs; this model asks what a lean, pilot-led start looks like and how sensitive it is to conversion, cycle length and AI cost. Where they disagree, neither is authoritative; the founder resolves it.

## Where it lives `[VERIFIED]`

| Piece | Path |
| --- | --- |
| Route | Operations console, **Finance model** tab: `app/src/screens/Console.tsx` (lazy-loaded) |
| UI | `app/src/finance/FinancialModel.tsx` |
| Engine | `app/src/finance/financialModelEngine.ts` (pure, deterministic, no clock, no storage) |
| Inputs, bounds, sources, validation | `app/src/finance/financialModelFields.ts` |
| Scenarios and sensitivity grids | `app/src/finance/financialModelScenarios.ts` |
| Exports | `app/src/finance/financialModelExports.ts` |
| Formatting | `app/src/finance/financialModelFormat.ts` |
| Types | `app/src/finance/financialModelTypes.ts` |
| Tests | `app/src/finance/financialModel.test.ts`, `app/src/finance/FinancialModel.test.tsx` |

**Authorization.** The Console shows nothing without a `console:operate` grant at platform scope, read from `role_grants` by the database. The model component decides what to show someone already through that gate; it is not itself an authorization check. It reads no database, bank or ledger and writes nothing to browser storage (a test asserts this). Sample data only, per the brief's "local sample data first".

## Model shape `[DRAFT]`

Monthly, 36 months, first month 2026-11. Model years run November to October so each holds one academic start.

1. **Funnel.** Accounts contacted per month pass through six stage rates to a proposal, then a close rate. A signed pilot lands `salesCycleMonths` after first contact and never before `firstPaidPilotMonth`. Deals ready earlier wait for that month rather than being booked, because a paid institutional pilot is NO-GO today (`GO-NO-GO-DECISION.md`).
2. **Cohorts.** A signed pilot becomes an annual customer after `pilotMonths + conversionLagMonths`, with probability activation x success x pilot-to-annual conversion. A share (`directAnnualShare`) skips the pilot. Each annual cohort shrinks by retention at each anniversary and its enrolled scope grows by expansion.
3. **Revenue is recognised over the service period; cash follows the invoice by the payment terms.** Pilot fee and implementation fee are billed at signing and recognised straight-line. Platform and premium support are billed annually up front and recognised monthly. AI overage is billed monthly. Student Premium is collected monthly.
4. **Costs.** Cost of revenue: cloud and AI per active user, support per institution, implementation third-party cost and contractor overflow, payment fees, delivery payroll. Operating expense: payroll by function and year, contractors, marketing, legal, insurance, accounting, software, travel, admin. One-time **required obligations** (security assessment, accessibility review, counsel, entity and insurance) are cash items tied to GO-NO-GO blockers 2 to 5.
5. **Cash.** Opening cash, plus funding, plus collections, less cash out. Runway, break-even and funding need follow.

Expected values are fractional by design (0.3 of a pilot is an expectation, not a customer). The screen rounds to three significant figures; exports carry whole dollars.

## Inputs `[ASSUMPTION]`

About 100 numeric inputs in twelve groups. Each has a unit, bounds, a source tag and a note; the registry is `FIELDS` in `financialModelFields.ts` and is exported as `assumptions.csv`.

| Source tag | Meaning | Example |
| --- | --- | --- |
| `brief` | The founder's planning assumption | Platform $18 per enrolled student, $30,000 minimum |
| `repo` | A figure the repository already carries; needs confirmation | Cloud $0.21 per active user per month, from `docs/finance/03-COST-MODEL.md` |
| `placeholder` | No figure exists; replace with an actual | Opening cash, pilot fee, insurance, accounting, the four obligations |
| `assumption` | A modelling choice with no external evidence | Every funnel rate, retention, expansion |

Validation refuses non-numbers, NaN, infinity, out-of-range values, fractional month counts, and a pilot cohort outside 10 to 200. It warns, without refusing, on an implementation fee outside $35,000 to $150,000 and on a pilot length other than 6 months. The UI keeps the last valid result when an edit is refused.

## Scenarios `[ASSUMPTION]`

Twelve patches on Base: Conservative, Base, Ambitious, Downside / delayed sales, Long procurement cycle, Pilot-heavy, Annual-contract-heavy, High AI usage, Low student adoption, High implementation cost, Low conversion, High conversion. Each patch is a question to ask, not a prediction. Founder edits layer on top of any scenario and persist across scenario changes until **Reset assumptions**.

## Formulas `[VERIFIED]` (held by `financialModel.test.ts`, each worked by hand in the test)

| Metric | Formula |
| --- | --- |
| CAC | Sales and marketing spend / new annual customers acquired, over 36 months. Sales and marketing = marketing + travel and events + sales payroll + `founderSalesShare` x founder payroll |
| CAC payback months | CAC / monthly gross profit per customer. Reported as not applicable, with a reason, when no customer is acquired or monthly gross profit is not positive |
| LTV | Annual recurring revenue x gross margin / annual logo churn. Undefined (not infinite) at zero churn |
| MRR | Annual recurring revenue / 12 + recurring monthly student revenue. ARR = MRR x 12 |
| Break-even | First month where cumulative core gross profit covers cumulative operating expense and required cash obligations. Also reported: whether it is sustained to month 36, and the first month with a non-negative monthly operating result |
| Gross retention | Institution annual logo retention |
| Net revenue retention | Retention x (1 + expansion) as a formula, plus a figure measured from the model's own cohorts. They differ when the premium-support minimum binds, because that fee does not grow with scope |
| Runway | Months until ending cash first goes negative; plus a forward figure at the trailing three-month burn |
| Funding needed | The deepest the cash balance goes below zero |
| Revenue per employee | Year core revenue / year headcount |

**Gross margin in LTV is customer-level**: recurring revenue less the variable cost to serve one institution (cloud, AI, support), not company gross margin, which at this scale carries fixed delivery payroll. Both are shown. `[REVIEW: accounting]` whether this is the right definition for any figure shown outside the company.

**Marketplace and partner revenue** (12% commission, off by default) is a separate line. It is excluded from core revenue, gross profit, break-even and every unit-economics figure, and a warning fires if the plan only breaks even with it.

## Warnings `[VERIFIED]`

| Warning | Fires when | Quiet when |
| --- | --- | --- |
| Paid-pilot gate (critical) | Any pilot or direct annual deal is modelled | No outreach, so nothing is modelled |
| Capacity | Implementation demand hours exceed delivery heads x billable hours in any month | Capacity covers demand every month |
| Margin | Core gross margin in a model year is below the threshold (default 65%) | Every year at or above it |
| Runway (critical) | Cash is exhausted inside the threshold (default 12 months), or runway at the month-36 burn is below it | Cash lasts, or the threshold is met. The comparison is strict: runway equal to the threshold does not warn |
| AI | Cumulative AI cost exceeds AI overage revenue plus `aiIncludedRevenueShare` of platform, pilot and Premium revenue | AI is covered |
| Marketplace dependence | Marketplace is on; severity rises when the plan only breaks even with it | Marketplace off |
| Annual minimum binds / pilot length differs from 26 weeks | Informational | |

Every threshold is an input. Each warning has a test that raises it and one that leaves it quiet.

## Exports `[VERIFIED]`

Monthly CSV and assumptions CSV (formula-injection guarded), JSON (schema `semester.gtm-financial-model.v1`, with basis and disclaimer inside the file), Markdown, a copy-as-prompt, and a board-ready Markdown summary with all twelve scenarios, decisions asked, placeholders to replace and review flags. Every export says **Forecast**.

## Actual versus forecast `[VERIFIED]`

Every row, year, tile and export carries a basis of `forecast`. No actuals feed exists, so no output may be labelled `actual`; a test asserts it. When a real ledger feeds the model, the basis type already distinguishes the two.

## Base results `[ASSUMPTION]` (Forecast, regenerate from the tool)

At these defaults (lean founder-led team, 20 accounts contacted a month, paid pilots from month 7, 6-month pilots, opening cash a $100,000 placeholder), as computed by the in-app model at revision `5eba494`:

| Model year | Core revenue | Gross profit | Gross margin | Operating expense | Operating result | ARR at year end |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Year 1 | $103k | $5.63k | 5% | $215k | -$209k | $159 |
| Year 2 | $275k | $154k | 56% | $340k | -$186k | $54.9k |
| Year 3 | $332k | $93k | 28% | $460k | -$367k | $110k |

Base never breaks even inside 36 months, cash runs out in month 4 on the placeholder balance, and the funding needed to stay at zero is about $724k. **That is the finding, not a defect:** at about three pilots a year the plan does not carry even a lean team. Only Ambitious reaches break-even (month 35). Every figure rests on unvalidated rates; the first design-partner engagement exists to replace them. See [`UNIT_ECONOMICS.md`](UNIT_ECONOMICS.md) for the scenario table.

## What is not modelled `[DRAFT]`

- Annual Student Premium prepayment timing (blended into a monthly price).
- Pilot fee refunds, termination, credits, discounts, deal-desk floors.
- Sales tax, income tax, payroll tax detail, R&D credits, interest. `[REVIEW: tax]`
- Revenue recognition beyond straight-line; variable consideration. `[REVIEW: accounting]`
- Capital structure, dilution, a financing round beyond a single funding input.
- Seasonality of the academic calendar beyond the cycle and gate months.
- Churn within a pilot, and renewal pricing different from list.

## Conflicts this model exposes (decisions open) `[INTERNAL]`

| Conflict | Sources | How the model handles it |
| --- | --- | --- |
| Pilot length | `PILOT_WEEKS = 26` in `app/src/lib/gtm/pilot.ts` (D-134) versus 8 to 12 weeks in the brief | Input `pilotMonths`, default 6; a note appears if changed. Founder decision |
| Individual price | D-134 $7.99 / $59; D-1154 $15 per month; brief $8.99 / $69 | Brief's figures as inputs, labelled; none approved (CLM-015) |
| AI cost per request | `docs/finance/03-COST-MODEL.md` $0.0146 per action; the commercial architecture document prices a blended call higher (about $0.033 per call, found in review) | Default $0.0146 with source `repo`; the AI sensitivity grid spans $0.005 to $0.10 |
| AI pool versus cost | 2,400 requests per student per year at roughly $0.015 to $0.033 is $35 to $79 per student per year, against an $18 platform price | The model's default usage is 60 requests per active student per month; the High AI scenario and the grid expose the gap. A "request" needs a definition before any price is quoted |
| Marketplace commission | Finance workbook 15%; brief 12% | Brief's 12%, off by default |
| Premium support minimum | 15% of a 5,000-student platform fee is $13,500, so the $15,000 minimum applies | Modelled as max(minimum, 15%); the measured-NRR note follows from it |
| Paid pilot | NO-GO/RED | `firstPaidPilotMonth` input and a critical banner |

## Evidence state

**Repository evidence.** The model, its field registry and 97 tests exist in the repository. `[VERIFIED]` for the arithmetic.
**Operational evidence.** None. No actual cash, price, cost, conversion, retention or AI-usage figure is evidenced.
**Missing proof.** Replace every `placeholder` and `assumption` input with measured figures from the first design-partner engagement; reconcile opening cash to a bank statement; obtain vendor quotes.

## Claim ceiling

Semester may use this as an internal planning tool and as the agenda for conversations with an accountant, counsel, a broker and investors, with every output labelled a forecast on planning assumptions.

## Prohibited claims

Do not quote or publish any number from it as a price, forecast, target, ARR, revenue, margin, runway, CAC or LTV of the company. Do not present a scenario as a prediction. Do not show it to a customer.

## Professional review required

- `[REVIEW: accounting]` revenue recognition, deferred revenue, collections timing, the gross-margin definition.
- `[REVIEW: tax]` sales tax on SaaS and services, payroll and entity tax.
- `[REVIEW: counsel]` any price, pilot paper or customer-facing figure.
- `[REVIEW: insurance]` coverage and premium assumptions.
