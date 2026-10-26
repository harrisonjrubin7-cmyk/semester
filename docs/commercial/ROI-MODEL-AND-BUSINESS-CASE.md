# ROI Model, Business Case and Proof of Value

| Control | Value |
| --- | --- |
| Status | **CONTROLLED WORKSHEET — NO ROI, SAVINGS OR OUTCOME FIGURE IS CLAIMED OR EVIDENCED** |
| Owner | Harrison Rubin — company-side commercial owner; finance, institutional research and counsel reviewers unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Sources | the ROI formula and six-level outcome ladder in [`../operating-model/COMMERCIAL-GOVERNANCE.md`](../operating-model/COMMERCIAL-GOVERNANCE.md), [`PILOT-SCORECARD.md`](PILOT-SCORECARD.md), [`PILOT-SUCCESS-PLAN.md`](PILOT-SUCCESS-PLAN.md), [`../PAID-PILOT-FRAMEWORK.md`](../PAID-PILOT-FRAMEWORK.md) |

This is a worksheet the customer fills with the customer's own measurements. Semester supplies no benefit number: outcome, retention, time-saving and ROI claims are prohibited (CLM-014), and a worksheet with Semester's numbers in it would be exactly that claim. The result of a filled worksheet belongs to that customer's case and is shared only with their written permission.

## The formula

```text
ROI = (measured benefit − total cost) / total cost
```

`measured benefit` is a measured change in the piloted cohort against the frozen baseline, expressed in the customer's units and valued with the customer's own rates. `total cost` is Semester's quoted fees **plus** the customer's internal time (champion, IT, privacy and accessibility reviewers, training, student communications), because a case that leaves out the customer's time will not survive the economic buyer's second question.

## Inputs

Every input names where it comes from. An input that cannot be sourced stays blank and the line is dropped, never estimated.

| Benefit line | How it is computed | Source of truth | Boundary |
| --- | --- | --- | --- |
| Staff time on repetitive questions | (baseline minus pilot-period inquiries in the agreed helpdesk category, per 100 students) × minutes per inquiry × the customer's loaded hourly rate × cohort ÷ 100 | the customer's helpdesk or case system; minutes per inquiry from a sampled timing, not a guess | aggregate counts only; suppress below ten |
| Appointment preparation | share of advising appointments where the student arrived with the agreed preparation, before and during the pilot × appointments × minutes saved per prepared appointment × the customer's rate | advisor confirmation on a sampled set | self-reported by advisors; non-causal |
| Faster onboarding | median days from enrollment to first completed planning action, before and during the pilot, valued only if the customer assigns a value to a day | validated timestamps from the scorecard | censored attempts reported separately |
| Support and service uptake | more students reaching an intended service, from handoff and booking status | the service's own records | the dashboard measures whether the right action became easier to reach, never student risk |
| Avoided cost of the current tool | the incumbent contract line the customer states it will retire | the customer's contract | only if retirement is in writing |

Each line is a measured change, so the model is blank until a pilot has produced one. Add a line only with a named source and an owner, and never from a published benchmark.

## Reading the result

1. Compute benefit using the **low end** of the customer's own range for every uncertain input, then the high end, and show both. A case that is positive only at the high end is reported as undecided.
2. Count only change measured in the piloted cohort against the baseline frozen before launch. If a comparison cohort exists, say so; if it does not, say the change is not causal.
3. State every limitation that affected the result, plainly.
4. Do not extrapolate a 26-week result into retention, graduation or GPA. Those are strategic outcomes that need institution-led analysis with careful attribution (the sixth level of the outcome ladder) and are outside a pilot's claim.

## Business case template

The champion takes this to the economic buyer. Semester fills in the facts it can substantiate and leaves every number the customer's.

| Section | What goes in it |
| --- | --- |
| 1. Problem | in the champion's words, with the milestone and its date |
| 2. Cohort and scope | who, how many (target 50–200; hard bounds 10–200), which workflow, which data (minimum necessary, read-only first), which integrations (none assumed) |
| 3. Options | do nothing; the incumbent tool or process; Semester's scope; any other option the committee names |
| 4. Measures | three to five from the scorecard, each with baseline, target, owner, source, cadence, frozen before launch |
| 5. Cost | quoted fees (a price lives in the quote or order, not in this template), customer time, funding source and fiscal-period fit (`BUDGET-AND-PURCHASING-PATH.md`) |
| 6. Benefit worksheet | the lines above, left blank until measured, with the low and high case |
| 7. Risks | privacy, security, accessibility, AI and integration, each with the review that owns it and its status as the RFP library states it |
| 8. Governance | sponsor, champion, weekly working group, midpoint review, signed decision, conversion date |
| 9. Exit | stop is a real decision; export and offboarding steps (`PILOT-OFFBOARDING-PLAYBOOK.md`) |
| 10. What this does not promise | no system-of-record replacement, no certification, no outcome guarantee, no uptime or support commitment beyond what the order states |

## Proof-of-value design

The proof of value is the 26-week pilot, run exactly as `PAID-PILOT-FRAMEWORK.md` and `pilotReadiness` define it: discovery, configure, train, launch (only on the launch council's go), hypercare, learn (after at least two weeks of hypercare), decide (on a signed verdict). The conversion date falls from two weeks before to thirty days after the end date, and a midpoint review is dated before launch.

| Design rule | Why |
| --- | --- |
| Baseline, query and event definitions are frozen and versioned before launch; none is changed after results are visible | the scorecard's own rule, and the only defense against a favorable redefinition |
| Three to five measures, each with a baseline | `pilotReadiness` refuses fewer or more, or one without a baseline |
| Thresholds for convert, expand, pause and stop are written and signed by the sponsor before launch | a decision made after the data is a negotiation, not a result |
| Guardrails (privacy threshold of ten, accessibility reports, support volume per 100 students, reliability) have stop thresholds | a pilot that cannot stop is a free trial with extra steps |
| Cohort aggregates only, suppressed below ten | no student risk profile, even to prove value |
| Sandbox data until production data is approved (`pilotDataMode`) | the data plan is part of the proof |
| The result is reported with missingness, censoring and limitations | an honest "unclear" outranks a stretched "yes" |

Which outcome levels a pilot can credibly show: product behavior and workflow outcomes within the pilot; service and operational outcomes where a baseline exists in the customer's own system; academic or strategic outcomes are not claimed from a pilot.

## Evidence state

**Repository evidence.** The formula, the outcome ladder, the pilot scorecard shell, the pilot-readiness and verdict rules and the aggregation floor exist.

**Operational evidence.** No baseline, measurement, benefit, cost-to-serve or ROI has been produced by any customer.

**Missing test/proof.** Run one pilot through a signed verdict with a frozen scorecard, fill the worksheet from the customer's data and have the customer's finance owner challenge it.

## Claim ceiling

Semester may describe this as a measurement worksheet and proof-of-value design, with every benefit line blank until a customer measures it.

## Prohibited claims

Do not state or imply an ROI, payback, savings, time saved, ticket reduction, retention, persistence, graduation, GPA or other outcome figure from this document, a benchmark or a demonstration.
