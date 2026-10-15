# Go / no-go gates in the model

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING VIEW OF HYPOTHESES FOR FOUNDER DECISION. NOT AN APPROVED BUDGET, FORECAST OR TARGET** |
| Owner | Harrison Rubin: finance owner; the gate months are his decisions, not the model's |
| Evidence date | 2026-10-04 at repository revision `b4e8512` |
| Source | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) (3 Oct 2026); the workbook's Assumptions section 13 and scenarios 8 and 9 |
| Claim ceiling | Semester may use this as an internal view of how the go/no-go decision changes the cash plan. |
| Prohibited claims | Do not quote any figure here as a forecast, ARR, revenue, runway or cash balance of the company, or describe any gated motion as authorized. |

## Why this exists

The controlling go/no-go decision holds three revenue motions at NO-GO today: **broad or paid individual acquisition**, **paid institutional pilots**, and **broad enterprise sale**. Only invitation-only unpaid validation and non-activation design-partner work are authorized. The Base scenario books revenue from month 1: Plus conversions from the first registration, and four paid pilots signed in Year 1 with their fees billed. Base is explicitly "what the audit's full-scope thesis costs"; it is not a plan that respects the decision as written. Scenarios 8 and 9 are that plan.

No existing scenario changed. Scenarios 1 to 7 are identical to the snapshot already in the workbook, and `tools/verify_scenarios.py` re-proves it.

## The gates

Month 1 is November 2026. A gate month is the first month the motion may happen in the model. All five are `PROPOSED` inputs the founder sets (Assumptions A-160 to A-164); they are not predictions of when the evidence will exist.

| Input | Gate | Month | Calendar | What it holds back | Evidence the repository requires first |
| --- | --- | ---: | --- | --- | --- |
| A-160 | Broad / paid individual acquisition | 15 | Jan 2028 | Plus sales to new subscribers and acquisition spend scale-up | Invitation-only validation closeout plus a separate broad-rollout decision |
| A-161 | Invitation-only share before that gate | 25% | | Registrations and acquisition spend run at a quarter of plan | Conditional GO covers invitation-only, unpaid validation only |
| A-162 | First paid institutional pilot signed | 12 | Oct 2027 | Pilot fees; pilot-to-annual conversion (go-live is two months later) | A design-partner pilot with an approved activation record and a measured 26-week closeout |
| A-163 | Direct Department annual sales | 24 | Oct 2028 | Direct Department contracts | First pilot-to-annual conversions evidenced |
| A-164 | Direct Institution-segment sales | 28 | Feb 2029 | Direct Institution contracts | Repeated deployments and independent assurance |

Scenario_Control adds two drivers: **S-19** switches the gates on (1) or off (0), and **S-20** slips every gate by a number of months. Scenarios 1 to 7 have S-19 = 0.

## What changed in the workbook

* **Scenario_Control:** scenarios 8 (Base economics with the gates) and 9 (the same, plus every flexible role released nine months late, as in scenario 7) take columns K and L; the ACTIVE column moved to M and every reference followed. The selector accepts 1 to 9.
* **Revenue:** five rows are gated in every month: paid student-acquisition spend (11), new paid subscribers (15), pilot signings (41), Department signings (47), Institution signings (53). Each carries its gate in its label.
* **Checks:** two new checks read the monthly rows and fail if any gated activity precedes its gate. They were shown to fail when a gate was removed from the pilot-signings row (3.8 pilots signed early).
* **Scenario_Results:** rows 12 and 13 hold scenarios 8 and 9; the comparison, change-from-base block and descriptions follow.

## Results ($ thousands)

| Scenario | Revenue Y1 | Revenue Y2 | Revenue Y3 | ARR end Y3 | Gross margin Y3 | EBITDA Y1 | EBITDA Y2 | EBITDA Y3 | Peak funding need | Months below 6-month cash policy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2. Base (no gates) | 159 | 1,386 | 4,717 | 4,339 | 36% | (3,330) | (8,657) | (9,967) | 21,134 | 3 |
| 8. Go/no-go gates, hiring unchanged | 0 | 419 | 3,207 | 2,954 | 20% | (3,364) | (9,024) | (10,950) | 22,902 | 3 |
| 9. Go/no-go gates + flexible hires released nine months late | 0 | 419 | 3,207 | 2,954 | 25% | (2,470) | (5,997) | (9,536) | 17,568 | 0 |
| 7. Gated plan (CFO rec., hiring only) | 142 | 1,242 | 4,216 | 3,878 | 37% | (2,441) | (5,693) | (8,820) | 16,219 | 0 |

## Reading it

1. **The gates cost revenue, and the cost does not wait.** With the motions held where the decision holds them, Year 1 revenue is zero (Base: $159k), Year 3 revenue falls from 4,717 to 3,207 (-32%) and ARR at the end of Year 3 from 4,339 to 2,954. Hiring does not change, so the peak funding need rises from $21.1M to $22.9M, and the assumed rounds leave $1.1M at the low point instead of $1.2M.
2. **Tying the flexible hires to the gates recovers most of it.** Scenario 9 releases the sales, implementation and success roles nine months later. Peak need falls to $17.6M ($5.3M less than scenario 8), the lowest cash with the assumed rounds rises to $2.0M, and no month falls below the six-month cash policy. This is the existing "gated plan" recommendation, now applied to a revenue line that actually waits for the gates.
3. **Scenario 9 and scenario 7 differ for a reason.** Scenario 7 reaches $16.2M by also assuming 10% less volume and a hiring delay but keeps Base's early revenue; scenario 9 keeps full volume but loses the early revenue. They are different questions: 7 asks what less capacity costs, 9 asks what waiting for the gates costs.
4. **The conclusion in README item 1 gets stronger, not weaker.** The capital need is real and the pace of hiring decides it; the gates add that the *timing of revenue* is not in the founder's control either, so the first tranche has to be sized to reach the paid-pilot decision with no pilot revenue.

## Limits of this view

* **Unpaid design-partner pilots are not modeled.** The decision allows one activated design-partner pilot before the paid-pilot gate. Its implementation hours and hosting are real cost with no fee; the model has none, so pre-gate cost is understated by roughly the cost of one pilot's implementation.
* **No catch-up.** Annual volumes keep their planned monthly rate once a gate opens; signings missed before it are lost, not deferred. This is the conservative reading.
* **The Institution-segment gate (A-164) is conservative for campus-size customers.** The model's Institution segment mixes campus and system customers; the repository's enterprise gate applies to the largest. A split gate would raise scenario 8's revenue slightly.
* **Gate months are inputs.** A gate that opens earlier moves the answer by about as much as one that opens later; the model should be re-run with the dated evidence once the founder records it.
* **Same economics otherwise.** Prices, conversion, churn, hiring plan and assumed financing are Base's.

## Using and checking it

Set `Scenario_Control!D3` to 8 or 9. To re-run everything: `python3 docs/finance/tools/verify_scenarios.py` recalculates the workbook in LibreOffice once per scenario and fails if any pasted row has drifted, any integrity or gate check fails, or any gated activity precedes its gate. `tools/fill_snapshot.py` rewrites the pasted rows after an assumption change. `tools/port_gates.py` is the record of the one-time edit that added the gates. See `tools/README.md`.

## Decisions for the founder

1. Set the five gate months (A-160 to A-164) from the evidence you expect to have, and record each as a dated decision when it changes.
2. Say whether scenario 9 replaces scenario 7 as the recommended plan (it is the one that respects the go/no-go decision and still sizes capital).
3. Say whether to model one unpaid design-partner pilot explicitly before the paid-pilot gate.
