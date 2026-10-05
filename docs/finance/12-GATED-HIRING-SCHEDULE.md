# Gated hiring: release schedule and cash effect

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING VIEW OF HYPOTHESES FOR FOUNDER DECISION. NOT AN APPROVED BUDGET, HIRING PLAN, FORECAST OR TARGET** |
| Owner | Harrison Rubin: finance owner; each gate's release authority is named below and is a proposal until the board or founder adopts it |
| Evidence date | 2026-10-04 at repository revision `f318c19` |
| Source | The workbook's `Gate_Schedule` and `Headcount` sheets (scenarios 8 and 9), [`05-BUDGET-GOVERNANCE.md`](05-BUDGET-GOVERNANCE.md) section 6, [`10-GO-NO-GO-GATES.md`](10-GO-NO-GO-GATES.md), [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) |
| Claim ceiling | Semester may use this as an internal view of what each hiring gate would save and what evidence would release it. |
| Prohibited claims | Do not quote any figure here as a budget, headcount commitment, forecast or runway. Do not treat any gate as satisfied: none has been. |

> This document organizes planning assumptions for the founder. It is not accounting, tax, legal, insurance or investment advice. Employment terms, contractor classification and offer timing need counsel and a payroll provider before anyone is hired.

## What this adds

[`05-BUDGET-GOVERNANCE.md`](05-BUDGET-GOVERNANCE.md) section 6 said which evidence releases which hires and that waiting nine months saved a lot. This document turns that into a schedule: ten gates, every flexible role in exactly one of them, the month each opens in the plan, the cost of each, and what slipping it by a month is worth. The same numbers sit in the workbook's `Gate_Schedule` sheet; the sheet is the source and the guard (`tools/verify_scenarios.py`) re-proves its reconciliation.

Thirty-seven of the model's 50 end-of-horizon heads are flexible (gated); 13 are core and never wait.

## The ten gates

Month 1 is November 2026. "Plan month" is the earliest month the roles start in Base and scenario 8. In scenario 9 every flexible start moves nine months later. Costs are 36-month people cost (base pay, 20% employer burden, wage inflation) of the gate's roles, $ thousands.

| Gate | Roles released | FTE | Plan month | Release authority | Evidence required before release | Linked decision item | Run-rate per year | 36-month cost, plan | 36-month cost, nine months later | Saved |
| --- | --- | ---: | ---: | --- | --- | --- | ---: | ---: | ---: | ---: |
| G9 | Head of Marketing and Growth; Head of Finance and RevOps; data/AI platform engineer; SRE/DevOps; security engineer | 5 | 8 | CEO + CFO | Seed closed and a design-partner discovery programme under way | Financing | 1,008 | 2,444 | 1,675 | 769 |
| G1 | Mobile and offline engineers; accessibility and design-systems lead; QA/SDET | 4 | 9 | CEO + CTO | Authorized candidate frozen, hosted release matrix green, web core passes the critical-journey tests | Priorities 1 and 3 | 774 | 1,777 | 1,184 | 593 |
| G2 | Integration engineers; solutions engineer #1 | 3 | 11 | CEO + CRO | A design partner has approved a connector scope in non-activation discovery; connector framework passes sandbox tests | Priority 8 | 576 | 1,266 | 823 | 443 |
| G7 | Lifecycle marketer; community and ambassador manager; partnerships manager; marketplace and employer sales; trust and safety analyst | 5 | 12 | CEO + Legal | Launch gates for those products signed off by counsel and the tax adviser, plus the broad-rollout decision for student growth | A-160 | 618 | 1,143 | 664 | 479 |
| G3 | Privacy and compliance operations lead; security/GRC engineer | 2 | 13 | CEO + CFO | Counsel engaged; independent security assessment and qualified accessibility review scheduled | Priorities 2 to 4 | 372 | 688 | 399 | 288 |
| G5 | Account executives #2 and #3; SDR #1; solutions engineer #2 | 4 | 14 | CRO + CFO | First paid institutional pilot signed (A-162) and pipeline coverage of at least 3x the next two quarters of new-ACV plan | A-162 | 516 | 829 | 426 | 403 |
| G4 | Backend/frontend engineer (wave 2); learning scientist; AI/ML evaluation engineer; data/analytics engineer | 5 | 15 | CEO + CTO + CFO | Seed closed and the invitation-only validation closeout meets its agreed continue criteria (activation, return rate, task success) | A-160 evidence | 990 | 1,636 | 865 | 771 |
| G6 | Customer success managers #2 and #3 | 2 | 19 | COO/CS lead + CFO | At least two institutions live and ARR per CSM above $1.0M, or implementation backlog above 4 projects per implementer | A-162, A-163 | 276 | 339 | 122 | 217 |
| G8 | Engineering manager; wave 3 engineers; full-time controller; people and recruiting operations | 5 | 22 | Board | Series A closed | Financing | 978 | 1,014 | 238 | 777 |
| G10 | Account executive #4; SDR #2 | 2 | 28 | CEO + CRO + Board | Broad-enterprise sale decision taken after repeated customer deployments | A-164 | 216 | 172 | 0 | 172 |
| | **Total flexible** | **37** | | | | | **6,324** | **11,308** | **6,396** | **4,912** |

The core roles cost $6,017k over the horizon, so total people cost is $17,325k with the gates at their plan months and $12,413k with every flexible start nine months later. The sheet's reconciliation row checks that the gates plus the core equal the `Headcount` sheet's total in both scenarios.

Two readings of the table:

1. **G10 costs nothing in scenario 9 because its start (month 28 + 9) falls after the 36-month horizon.** That is a horizon effect, not a saving that persists: the roles still cost $216k a year once released.
2. **The three biggest savings are the seed-stage platform and finance hires (G9), the scale organization (G8) and the product-depth hires (G4)**, together $2.3M of the $4.9M. G8's saving is large because the roles are expensive and release late in the plan; its evidence (a closed Series A) is also the least in the founder's own hands.

## When the cash moves

Quarterly people cost, $ thousands, scenario 8 (flexible roles on their plan months) against scenario 9 (nine months later). Quarter 1 is November 2026 to January 2027.

| Quarter | Scenario 8 | Scenario 9 | Saved | Headcount at quarter end, 8 | Headcount, 9 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 86 | 86 | 0 | 3 | 3 |
| 2 | 286 | 286 | 0 | 9 | 9 |
| 3 | 566 | 446 | 120 | 15 | 10 |
| 4 | 992 | 545 | 447 | 25 | 13 |
| 5 | 1,340 | 573 | 766 | 32 | 13 |
| 6 | 1,555 | 697 | 859 | 36 | 18 |
| 7 | 1,710 | 1,034 | 677 | 40 | 25 |
| 8 | 1,876 | 1,340 | 536 | 44 | 32 |
| 9 | 2,112 | 1,602 | 510 | 48 | 36 |
| 10 | 2,268 | 1,762 | 506 | 50 | 40 |
| 11 | 2,268 | 1,932 | 336 | 50 | 44 |
| 12 | 2,268 | 2,112 | 156 | 50 | 48 |
| **Total** | **17,325** | **12,413** | **4,912** | | |

The saving is front-loaded: **$2.1M of it falls in quarters 4 to 6**, the quarters before the assumed Series A (month 13) and the first full academic year after it. Gating is worth most exactly when the company has the least cash.

## The cash effect is larger than the people-cost saving

Scenario 9 lowers peak funding need by $5.3M against scenario 8 ($22.9M to $17.6M), while the people-cost saving is $4.9M. The extra roughly $0.4M is cost that travels with a head: software ($450 a month), workspace ($300), payroll/HRIS ($20), travel ($350), onboarding ($3,500 once) and recruiting fees (12% of base on flagged roles). Those are inputs A-129 to A-134. They are not in the people-cost figure above, which is why the two numbers differ.

## What one month of delay is worth

A gate that opens one month later saves about its **run-rate divided by 12**, plus the per-head costs above:

| Gate | One month later saves about, $ thousands |
| --- | ---: |
| G9 | 84 |
| G4 | 83 |
| G8 | 82 |
| G1 | 65 |
| G7 | 52 |
| G2 | 48 |
| G5 | 43 |
| G3 | 31 |
| G6 | 23 |
| G10 | 18 |

This is the founder's price list for impatience. Releasing the product-depth hires (G4) a quarter early costs roughly $250k before they have produced anything the evidence would say they should.

## What this model does not capture

* **Scenario 9 is a uniform nine-month delay, not the evidence triggers.** The gates in the table are conditions; the workbook cannot know when they will be met. If the evidence arrives sooner, the saving shrinks, and if later, it grows. Change one gate by editing the roles' base start month on the `Headcount` sheet (column AP; AV names the gate and AW the effective start month after any delay) and read the effect off the active-scenario columns on `Gate_Schedule`.
* **Capacity has a cost the model ignores.** Holding sales and customer-success hires also holds the revenue they would close and support. Scenario 8 and 9 have identical revenue because the gated revenue lines wait for the go/no-go gates, not for headcount; that is generous to scenario 9 because a real shortage of implementers or CSMs would delay and damage pilots. Scenario 7 tested a 10% volume loss as a proxy.
* **Recruiting lead time.** An evidence date is when the search may start, not when the person starts. A role with a three-month search means starting the search a quarter before the gate's month if the gate is to be useful, which shifts part of the saving back.
* **Gates can be released partially.** The sheet releases whole gates. A founder may reasonably release one engineer of G4 and hold the rest; that needs a split gate and is a decision for the owner of each gate.

## Operating the gates

1. **A gate is released by a dated written decision**, signed by the named authority, recorded in the decision log ([`09-BOARD-REPORTING-PACKAGE.md`](09-BOARD-REPORTING-PACKAGE.md)), that quotes the evidence and attaches it. No evidence, no release; no signature, no offer letter.
2. **Finance blocks the requisition until the release is on file.** The approval matrix ([`05-BUDGET-GOVERNANCE.md`](05-BUDGET-GOVERNANCE.md) section 4) already treats the release of a flexible role as a CEO plus CFO decision that needs gate evidence; this schedule names that evidence.
3. **The monthly flash shows gates open, gates satisfied but unreleased, and gates waiting.** A gate satisfied and left unreleased is a decision to be reported, not a default.
4. **Reconcile quarterly.** Re-run the scenario with actual release months in place of the plan months and compare cash to this schedule.
5. **Never release a gate to hit a hiring date.** If a date and the evidence conflict, the evidence wins and the date moves; that is the entire point of gating.

## Decisions for the founder

1. Confirm the ten gates, their evidence and their release authorities as written, or say what changes.
2. Say whether any gate should be split (for example one engineer of G4 released on the seed close, the rest on the validation closeout).
3. Say which gates the board, not the founder, signs. This document proposes the board for G8 and G10 only.
4. Record the first gate decision when it happens: G9 is the earliest (plan month 8) and its evidence, a closed seed, is a financing event, not an operating one.
