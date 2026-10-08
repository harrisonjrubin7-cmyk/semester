# ROI / Business-Case Calculator - Input Definitions

| Control | Value |
| --- | --- |
| Status | **[DRAFT] INPUT SPECIFICATION FOR A SCENARIO CALCULATOR - NO ROI, SAVINGS OR OUTCOME FIGURE IS CLAIMED OR EVIDENCED** |
| Owner | Harrison Rubin (interim; backup unassigned). Finance reviewer, institutional-research reviewer: unassigned |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: accounting] [REVIEW: tax] |
| Audience | Internal (the input sheet and the Semester-side economics). A filled customer-side worksheet is the customer's property and is shared only with their written permission (CLM-013, CLM-014) |

> Operating document, not accounting, tax or financial advice. Every output is a scenario estimate, never a guarantee.

Label legend: **[VERIFIED]** repository proves it; **[ASSUMPTION]** planning value; **[DRAFT]** needs review; **[APPROVED]** none; **[INTERNAL]** not sent as-is. Input label column below uses `ACTUAL` (measured in the customer's system), `CUSTOMER-STATED`, `ASSUMPTION` (planning) or `NOT AVAILABLE` (line dropped).

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why new |
| --- | --- | --- | --- |
| [`../../commercial/ROI-MODEL-AND-BUSINESS-CASE.md`](../../commercial/ROI-MODEL-AND-BUSINESS-CASE.md) | The formula `ROI = (measured benefit - total cost) / total cost`, five benefit lines, low/high reading rule, business-case template, proof-of-value design. **Governs the method; read it first.** | A field-level **input dictionary** (definition, unit, source, owner, validation rule, label), the explicit scenario/low-base-high formulae, validation and output-labelling rules, and the Semester-side cost inputs a calculator needs | The existing document is a worksheet in prose; a calculator needs typed, validated inputs |
| [`../../commercial/PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md), [`PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md) | Baselines and frozen metric definitions | Inputs reference scorecard metrics by id (M1-M8 of [`../sales/PILOT_PROPOSAL_TEMPLATE.md`](../sales/PILOT_PROPOSAL_TEMPLATE.md)) | One definition per metric |
| [`../../finance/README.md`](../../finance/README.md), [`03-COST-MODEL.md`](../../finance/03-COST-MODEL.md), [`04-UNIT-ECONOMICS.md`](../../finance/04-UNIT-ECONOMICS.md), [`assumption-register.md`](../../finance/assumption-register.md) | Semester's own company model, cost model and assumptions (xlsx and dashboard) | Pointer for the Semester-side inputs; no duplication of the model. The in-app counterpart is **the Finance model tab of the operations console** (being built by the lead; this document defines the *customer-facing business-case* inputs, not the company model) | Two different models: company economics versus a customer's business case |

## Gate and the scenario rule

**Gate.** Building and discussing a calculator with a prospect is allowed (non-activation, no price). Showing a customer a Semester-authored ROI figure, or any figure from a benchmark, is **prohibited** (CLM-014); price inputs are `[PRICE TO BE CONFIRMED]` (CLM-015); a paid pilot is NO-GO ([`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md)).

**Rule (print on every output):**

> **Scenario estimate, not a guarantee.** These figures are produced from inputs supplied or confirmed by [Institution] and from planning assumptions, and show what would follow if those inputs held. They are not a forecast, a promise of savings or any outcome, and they do not predict retention, graduation, GPA or wellbeing. Low and high cases are shown; if the case is positive only in the high case it is reported as undecided.

Calculator rules: (1) Semester supplies **no benefit number**; every benefit input is the customer's or is blank. (2) An input with no source is **dropped**, not estimated (a blank input line contributes nothing and is listed as "not included"). (3) Every output carries its input labels; any output that depends on an `ASSUMPTION` input is itself labelled `ESTIMATE - SCENARIO`. (4) Always compute low, base and high. (5) Pilot-period results are not extrapolated to retention or graduation, and not scaled to the whole institution unless the cohort is stated to be representative and the user ticks that assumption, which then labels the output `EXTRAPOLATED - ASSUMPTION`.

## Input dictionary **[DRAFT]**

Owner = who must supply or confirm. "Validation" is what the calculator checks before computing.

### A. Population

| ID | Input | Unit | Source | Owner | Validation | Label |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Pilot cohort size `N_c` | students | Frozen roster count (aggregate) | Customer champion | Integer; 10 <= N_c <= 200 (cohort bound in [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md); not enforced by `pilotReadiness`); below 10 the calculator refuses to display group results | ACTUAL / CUSTOMER-STATED |
| A2 | Eligible invited students `N_e` | students | Invitation list count | Customer champion | N_e >= N_c | ACTUAL |
| A3 | Enrolled students, institution or program `N_E` | students | Registrar published figure | Customer finance/registrar | Integer > 0; used only for annual-price scenarios | CUSTOMER-STATED |
| A4 | Measurement window `W` | weeks | Pilot plan | Harrison Rubin + champion | 1 <= W <= pilot term; states whether it equals the pilot term. **Pilot term is [DECISION OPEN]: 26 weeks (code) vs 8-12 weeks (assumption)** | ASSUMPTION until decided |

### B. Baseline workload (before the pilot, frozen before launch)

| ID | Input | Unit | Source | Owner | Validation | Label |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Baseline contacts in agreed category `C_b` | contacts per 100 students in window W | Customer helpdesk/case system (aggregate) | Customer analyst | >= 0; same category and window definition as C_p; suppressed if cohort < 10 | ACTUAL |
| B2 | Minutes per contact `m` | minutes | Timed sample of >= [20] contacts [ASSUMPTION sample size] | Customer champion | 0 < m <= 240; sample size recorded | ACTUAL or CUSTOMER-STATED |
| B3 | Loaded hourly labour rate `r` | currency per hour | Customer HR/finance for the role | Customer finance | > 0; the customer's own figure, never a benchmark; role stated | CUSTOMER-STATED |
| B4 | Baseline staff hours on the workflow `H_b` | hours per window | Staff time sample or timesheet | Customer champion | >= 0; must equal or exceed C_b x m / 60 x N_c/100 or an explanation is recorded | ACTUAL / CUSTOMER-STATED |
| B5 | Advising appointments in window `A` | count | Scheduling system aggregate | Advising lead | >= 0 | ACTUAL |
| B6 | Share of appointments with agreed preparation, baseline `s_b` | share (0-1) | Advisor-confirmed sample | Advising lead | 0 <= s_b <= 1; sampled, self-reported by advisors; non-causal | CUSTOMER-STATED |
| B7 | Baseline days from enrollment to first completed planning action `d_b` | median days | Validated timestamps, where measurable | Customer analyst | >= 0; censored attempts reported separately | ACTUAL |
| B8 | Baseline completion rate of the readiness workflow `p_b` | share | Customer's own tracking | Customer analyst | 0 <= p_b <= 1; "no baseline" is a valid answer and the metric is then dropped as primary | ACTUAL / NOT AVAILABLE |

### C. Pilot-period measures (from the scorecard; only observed values)

| ID | Input | Unit | Source | Owner | Validation | Label |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Activation rate (M1) `a` | share | Validated event / approved roster | Harrison Rubin | N_activated / N_e; both counts displayed; refuse if N_activated < 10 (suppress) | ACTUAL |
| C2 | First-action rate (M2) | share | Validated event + sample QA | Harrison Rubin | Denominator = activated; censored count shown | ACTUAL |
| C3 | Workflow completion rate (M3) `p_p` | share | Checklist aggregate | Harrison Rubin | 0..1; non-authoritative checklist, not official registration | ACTUAL |
| C4 | Weekly active use (M4) | share | Aggregate; raw logins excluded | Harrison Rubin | Same denominator as C1 | ACTUAL |
| C5 | Pilot-period contacts `C_p` | contacts per 100 students in window W | Same system and category as B1 | Customer analyst | >= 0; the window length must equal B1's | ACTUAL |
| C6 | Pilot-period preparation share `s_p` | share | Same method as B6 | Advising lead | 0..1 | CUSTOMER-STATED |
| C7 | Pilot-period days to first action `d_p` | median days | Same as B7 | Customer analyst | >= 0 | ACTUAL |
| C8 | Student confidence pulse (M6) | share agreeing | Approved survey | Customer champion | Report response rate; if responses < 10 suppress | CUSTOMER-STATED |

C-inputs may not be typed in before the pilot has produced them; the calculator in "design" mode lets the user enter **targets** labelled `TARGET - ASSUMPTION` and cannot label the result as a measured outcome.

### D. Value assigned by the customer

| ID | Input | Unit | Source | Owner | Validation | Label |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Value per day of faster onboarding `v` | currency per day | Customer decision | Customer sponsor | Optional; blank means the line is not included | CUSTOMER-STATED |
| D2 | Incumbent tool annual cost retired `T` | currency per year | Customer contract line | Customer finance | Only if retirement is in writing; otherwise 0 | CUSTOMER-STATED |
| D3 | Minutes saved per prepared appointment `t` | minutes | Advisor-confirmed sample | Advising lead | 0 <= t <= 60 | CUSTOMER-STATED |

### E. Costs

| ID | Input | Unit | Source | Owner | Validation | Label |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Pilot fee `F_p` | currency | Authorized paper | Harrison Rubin | **[PRICE TO BE CONFIRMED]** - field stays blank/placeholder until approved (CLM-015); calculator uses 0 and shows "price pending" | NOT AVAILABLE |
| E2 | Implementation fee `F_i` | currency | Authorized paper | Harrison Rubin | **[PRICE TO BE CONFIRMED]** | NOT AVAILABLE |
| E3 | Annual platform fee `F_a` (conversion scenario) | currency per year | Authorized paper | Harrison Rubin | **[PRICE TO BE CONFIRMED]**; in scenario mode may use the internal planning assumptions ($18/enrolled student/yr, $30,000 minimum) labelled `ASSUMPTION - INTERNAL, DO NOT SEND` | ASSUMPTION |
| E4 | Customer internal time `H_c` | hours | Champion, IT, privacy, accessibility, training, communications; logged | Customer champion | >= 0; **must be included** (the existing ROI document: a case that omits the customer's time will not survive the buyer's second question) | CUSTOMER-STATED |
| E5 | Customer internal rate `r_c` | currency per hour | Customer finance | Customer finance | > 0; may equal B3 | CUSTOMER-STATED |
| E6 | Expenses and taxes | currency | Authorized paper | Customer finance | >= 0 | NOT AVAILABLE until paper |

### F. Semester-side economics **[INTERNAL]** (never shown to the customer)

| ID | Input | Unit | Source | Owner | Validation | Label |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | AI requests per student per year | requests | Planning assumption **2,400 pooled governed requests per enrolled student per year (200/month average)** | Harrison Rubin | >= 0 | ASSUMPTION |
| F2 | AI provider cost per 1,000 requests | currency | Provider terms ([`../../trust/PROVIDER-TERMS.md`](../../trust/PROVIDER-TERMS.md)); measure, do not guess | Harrison Rubin | > 0; blank until measured | NOT AVAILABLE |
| F3 | AI overage price | currency per 1,000 requests | Planning assumption **$30** | Harrison Rubin | >= F2 or flagged as negative margin | ASSUMPTION |
| F4 | Implementation effort | hours | Time log | Implementation lead [unassigned] | >= 0; priced vs. $35,000-$150,000 planning range | ASSUMPTION |
| F5 | Premium support | share of platform fee; minimum | **15%, $15,000 minimum** | Harrison Rubin | Minimum applies if share x F_a below it | ASSUMPTION |
| F6 | Support hours per student | hours | Time log | Customer success [unassigned] | >= 0 | NOT AVAILABLE |

The company model (workbook and the Finance model tab of the operations console) owns F-inputs and the unit-economics conclusions; this table only names what the customer-case calculator may *not* reveal.

## Formulae **[DRAFT]**

All benefits are for the measurement window W unless annualised.

```text
Staff-time benefit        BN1 = ((C_b - C_p) / 100) * N_c * (m / 60) * r
Preparation benefit       BN2 = (s_p - s_b) * A * (t / 60) * r
Onboarding-speed benefit  BN3 = (d_b - d_p) * N_act * v          (only if v is set; N_act = activated students)
Tool-retirement benefit   BN4 = T * (W / 52)                      (only if retirement is in writing)
Measured benefit (window) BN = BN1 + BN2 + BN3 + BN4                (lines with missing inputs contribute 0 and are listed as "not included")

Customer internal cost    K_c = H_c * r_c
Total cost (window)       K   = F_p + F_i + K_c + expenses/taxes   (Semester fees stay "price pending" until approved)

ROI                       ROI = (BN - K) / K          [defined only if K > 0]
Net benefit               NB  = BN - K
Payback                   payback_weeks = K / (BN / W)   [only if BN > 0]
Break-even contacts cut   dC* = K / (N_c * (m/60) * r) * 100   (contacts per 100 students required for BN1 = K, others ignored)
Scenario annualisation    BN_annual = BN * (52 / W)       [ONLY if seasonality is stated acceptable; label EXTRAPOLATED - ASSUMPTION]
```

Scenarios: run the formulae three times with the low end, midpoint and high end of every customer-supplied *range* input (m, r, t, v, s_p). The calculator displays all three. Result classification: **positive** (NB > 0 in all three), **undecided** (positive only in the high case or sign changes), **negative** (NB < 0 in base and low). Only "positive" may be described as "positive under these inputs".

Worked formatting example with **placeholder** numbers (illustration only; not data, not a benchmark): `C_b=[__] C_p=[__] N_c=[__] m=[__] r=[__]` gives `BN1=[__]`. Never fill an example with numbers from any real or imagined institution in a customer-visible copy.

## Output template **[DRAFT]**

| Line | Low | Base | High | Included? | Labels of inputs used |
| --- | --- | --- | --- | --- | --- |
| Staff-time benefit | [..] | [..] | [..] | [Y/N] | [ACTUAL, CUSTOMER-STATED] |
| Preparation benefit | | | | | |
| Onboarding-speed benefit | | | | | |
| Tool retirement | | | | | |
| **Measured benefit** | | | | | |
| Semester fees | **[PRICE TO BE CONFIRMED]** | | | | NOT AVAILABLE |
| Customer internal cost | | | | | |
| **ROI / net benefit / payback** | | | | | ESTIMATE - SCENARIO |

Beneath: "Not included (no source)": [list]; "Limitations that affected the result": [list]; the scenario-estimate disclaimer above.

## Evidence state

**Repository evidence. [VERIFIED]** The formula and benefit lines are in the existing ROI document; the scorecard, aggregation floor and pilot rules exist.

**Operational evidence.** No baseline, measurement, benefit, cost-to-serve or ROI has been produced by any customer; no Semester price is approved.

**Missing proof.** Run one pilot to a signed verdict, fill from the customer's data, and have the customer's finance owner challenge it; implement the calculator with these validations and test them (a guard that never failed is not known to be a guard).

## Claim ceiling

Semester may describe this as a business-case calculator that uses the customer's own inputs and returns labelled scenarios.

## Prohibited claims

Do not state or imply ROI, payback, savings, time saved, ticket reduction, retention, graduation, GPA or other outcomes from this document, a benchmark or a demonstration; do not show a price; do not call a scenario a forecast.

## Professional review required

Cost, tax and revenue treatment: [REVIEW: accounting] [REVIEW: tax]. Customer-facing wording of the scenario disclaimer: [REVIEW: counsel].
