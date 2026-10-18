# Customer Health Score (pilot operating score and reconciliation)

| Control | Value |
| --- | --- |
| Status | **DRAFT PROPOSAL - NOT APPROVED; DOES NOT REPLACE THE CONTROLLED HEALTH-SCORE DOCUMENTS; NO CUSTOMER HAS EVER BEEN SCORED** |
| Owner | Harrison Rubin (interim; backup unassigned). Customer sponsor, analyst, privacy reviewer unassigned |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [DECISION OPEN] [REVIEW: privacy] |
| Audience | Internal only. A health color is never shown to a customer or used in outreach until validated and approved. |

> This is an operating document, not legal, privacy or accounting advice. Health is an account-level, human-reviewed aid; it is not a fact about students and never scores an individual.

**Label legend.** [VERIFIED] proven by a repository path. [ASSUMPTION] planning number or threshold. [DRAFT] needs review. [INTERNAL] not for customers. [DECISION OPEN] founder decision needed, to be recorded as `D-<pull request number>`. [APPROVED] count: zero.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document |
| --- | --- | --- | --- |
| [`../../commercial/CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md) | Controlled model: narrative first; seven weighted dimensions (25/20/15/15/10/10/5); overrides; the warning that the nightly `compute_account_health()` snapshot is not this model and must be treated as unavailable | Reconciliation against the user's eight-signal weights; scoring method; missing-data rule; actions; anti-gaming; worked example | The controlled doc leaves thresholds and scoring unspecified; it is not edited here |
| [`../../market-readiness/CUSTOMER-HEALTH-SCORE.md`](../../market-readiness/CUSTOMER-HEALTH-SCORE.md) | Same seven weights in a 15-line source note | Reconciled in section 2 | Source of the controlled doc |
| [`../../commercial/CHURN-AND-RISK-PLAYBOOK.md`](../../commercial/CHURN-AND-RISK-PLAYBOOK.md) | Risk domains, response, exit | Per-signal at-risk triggers feed it | Linked |
| [`../../institutional-implementation/SUCCESS-SYSTEM.md`](../../institutional-implementation/SUCCESS-SYSTEM.md) | Weekly health review cadence | Cadence reused | Linked |

## Gate (what is allowed now versus held)

| Allowed NOW | HELD |
| --- | --- |
| Rehearse scoring on synthetic data; review this model with a design-partner prospect as a discussion framework | Scoring any real account; showing a color to anyone; automated outreach; any statement that a customer is "healthy" or "at risk"; any churn or renewal prediction. No customer or pilot exists. [VERIFIED: `../../../GO-NO-GO-DECISION.md`] |

## 1. Principles carried from the controlled documents [VERIFIED: `../../commercial/CUSTOMER-HEALTH-SCORE.md`]

- Decision narrative first (scope, outcome evidence, missing data, recent changes, customer view, risks, next action); composite second with components shown.
- P0/P1 security, privacy, accessibility, safety, legal/rights, tenant-isolation or integrity issues **override** any score, trigger incident response and pause the affected scope.
- Missing evidence shows as unavailable, never neutral or healthy.
- Never score individuals, infer hidden intent from email or activity, or enrich with sensitive data.
- The existing nightly `compute_account_health()` snapshot is **unavailable/unreviewed** and must not supply a color or score or drive outreach until it fails closed and is human-reviewed. Not changed here (no `app/` edits in this task).

## 2. Reconciliation: existing weights versus the user's weights [DECISION OPEN]

| Signal or dimension | Existing controlled model | User's proposed weight | Notes on mapping |
| --- | --- | ---: | --- |
| Admin engagement | (partly implementation/readiness, 20%; sponsor/champion 10%) | 15% | New explicit signal: owner attendance and action completion |
| User activation | (inside adoption/first win, 15%) | 20% | Split out of adoption |
| First meaningful action | (inside adoption/first win, 15%) | 15% | Same family; existing doc defines "first win" |
| Core workflow completion | (partly agreed outcome trajectory, 25%) | 20% | Behavioural completion, not outcome |
| Weekly active use | (inside adoption/first win) | 10% | Existing doc excludes raw logins; same here |
| Support sentiment | support burden and resolution, 10% | 5% | Reframed as resolution experience, not mood |
| Executive engagement | sponsor/champion engagement, 10% | 5% | Halved |
| Outcome trend | agreed outcome trajectory, 25% | 10% | Largest reduction (25% to 10%) |
| Reliability and recovery | 15% | none | Dropped in the user's set |
| Implementation/readiness completion | 20% | none (admin engagement partly) | Dropped as a weight |
| Trust/customer gates | 5% | none | Dropped as a weight (but remain overrides) |
| **Total** | 100% | 100% | |

**Which is canonical today.** Neither is approved. The controlled model is the only one in the repository and binds as the constraint set; the user's weights are a planning input.

**Recommendation (for founder decision) [DECISION OPEN]:** use the user's eight signals as the **pilot operating score** (a pilot's observable evidence is behavioural and funnel-shaped, which the eight signals mirror), but keep three things from the controlled model: (1) its override rules; (2) reliability/recovery and trust/customer gates as **pass/fail gates**, not weighted signals; (3) the rule that outcome trend must be reported beside the composite. Keep the existing seven-dimension model as the post-conversion steady-state view until one of the two is validated against real outcomes.

Reasoning: (a) 65% of the user's weight (activation 20, first action 15, completion 20, weekly use 10) sits on usage behaviour and only 10% on outcome, which risks rewarding activity over value; the controlled doc puts outcome first at 25% and excludes raw logins. Gating plus a visible outcome line mitigates this. (b) Dropping reliability and trust as weights is safe only if they act as overrides, which is how the controlled doc already treats serious issues. (c) Outcome trend is unavailable until a baseline and several weeks of data exist, so early-pilot scores rest on behaviour; the renormalisation rule below makes that explicit instead of hiding it. (d) Neither weight set is validated; do not choose by false precision. Alternative the founder may prefer: adopt the controlled seven dimensions unchanged and add the user's signals as sub-measures. Do not overwrite the controlled document until decided.

## 3. The eight signals [DRAFT]

Weights are the user's. Thresholds are [ASSUMPTION] and are frozen per pilot before launch (see anti-gaming).

| # | Signal | Weight | Data source | Signal score (0-100) | At-risk trigger (user's) | Operational test [ASSUMPTION] |
| --- | --- | ---: | --- | --- | --- | --- |
| 1 | Admin engagement | 15% | Meeting attendance and action completion from the decision log and plan | 100 x (owner meetings attended + owner actions on time) / (scheduled + due) | No owner attendance or delayed actions | Missed 2 consecutive reviews, or more than 30% of owner actions overdue |
| 2 | User activation | 20% | Success-plan metric 1 ([`PILOT_SUCCESS_PLAN.md`](PILOT_SUCCESS_PLAN.md)) | min(100, 100 x actual rate / agreed activation threshold) | Below agreed activation threshold | Below the agreed threshold at the agreed checkpoint |
| 3 | First meaningful action | 15% | Metric 2 | min(100, 100 x actual / target) | Sign-in without value-producing activity | Activated participants with no value-producing event exceed 40% |
| 4 | Core workflow completion | 20% | Metric 3 | min(100, 100 x actual / target) | Low or declining completion | Below target for 2 consecutive weeks, or falling 2 weeks running |
| 5 | Weekly active use | 10% | Metric 4 | min(100, 100 x actual / target) | Rapid post-launch decline | Drop of more than 30% from the launch-week peak within 3 weeks |
| 6 | Support sentiment | 5% | Support system: share of closed cases confirmed resolved by the requester, and approved pulse survey; never inferred tone | 100 x resolved-confirmed / closed | Repeated unresolved friction | Same issue reopened or reported 3 times, or oldest unresolved case beyond the agreed age |
| 7 | Executive engagement | 5% | Sponsor attendance at midpoint and final reviews, decisions taken on time | 100 if every scheduled executive touchpoint attended and decision on time; 50 if one missed; 0 if two missed | Sponsor disengages | Sponsor misses a review, or no decision by the date |
| 8 | Outcome trend | 10% | Decision metrics vs frozen baseline over successive reports | 100 improving beyond target slope; 70 on track; 40 flat; 0 worsening | Success metrics stagnate or worsen | Flat or worse for 3 consecutive reports |

Signal 6 is deliberately not sentiment analysis of messages. Sentiment is read from structured resolution confirmations and an approved survey only.

## 4. Scoring method [DRAFT] [ASSUMPTION]

1. Each applicable signal gets a 0-100 score by the rule in the table, from ACTUAL data only.
2. Composite = sum of (signal score x weight) for scored signals.
3. **Applicable by phase.** Outcome trend is "not applicable" until the first interim report and baseline exist; user activation until launch. N/A-by-phase signals are removed and the remaining weights are renormalised (composite = weighted sum / applicable weight). The schedule is written into the plan before launch.
4. **Missing data.** If an applicable signal has no valid data it is `unscored` (never zero, never neutral). If unscored applicable weight exceeds 20%, the composite itself is `unscored` and no band is shown. Always display coverage (scored weight / applicable weight).
5. Bands [ASSUMPTION; thresholds unvalidated]: **Green 75-100**, **Yellow 50-74**, **Red 0-49**.
6. Any override (P0/P1 or the controlled doc's other triggers) sets Red-override regardless of the number, with the reason shown.
7. Any single at-risk trigger from section 3 forces at least a **named action** and a human review even when the band is green.
8. Every score shows formula version, as-of time, sources, coverage, reviewer and override reason.

## 5. Actions per band [DRAFT]

| State | Meaning | Required action | Owner |
| --- | --- | --- | --- |
| Green | Evidence supports on-track | Continue cadence; note what is working; consider expansion discussion only after the controlled conversion criteria | CS |
| Yellow | One or more triggers or a middling composite | Within the same week: name the weakest signal, validate the data with the champion, one corrective action with owner and date; add to the weekly risk list | CS and champion |
| Red | Low composite or override | Same-week sponsor conversation; risk plan; consider scope reduction, pause or stop; incident path if override; no "save campaign" and no pressure | Founder and sponsor |
| Unscored | Missing evidence | Fix the data source first; ask the customer; never read as healthy | CS |

Respectful outreach only: through approved channels, to named customer contacts, never to individual students on the basis of the score.

## 6. Review cadence [DRAFT]

Weekly internal health review (30 minutes, changed evidence only); monthly customer working session; midpoint executive review; final review; and a QBR once a customer exists ([`../templates/QBR_TEMPLATE.md`](../templates/QBR_TEMPLATE.md)). Calibration: after each pilot, compare the score with the sponsor's final decision and record false alarms and misses; do not claim predictive power from fewer than a meaningful number of pilots (none exist).

## 7. Anti-gaming rules [DRAFT]

1. Thresholds, weights and the N/A schedule are frozen before launch; changes need a dated, recorded reason and restart the series.
2. Raw logins, page views and notification opens never score; only validated value-producing events.
3. Nudges, reminders and training sessions do not count as engagement by themselves; only the customer's resulting actions do.
4. No one is rewarded or penalised (including CS) for the color; the score is not a quota.
5. Never ask students to act to improve the score; never exclude low-engagement participants after the fact (exclusions logged and rule-based).
6. Cells under 10 suppressed; the score is never broken down to individuals.
7. A second reviewer (the customer champion, where one exists) validates denominators before a color is reported; overrides are logged with their reason.
8. Report ACTUAL versus ESTIMATE; estimates never lift a band.

## 8. Worked example - ILLUSTRATIVE ONLY (fictional numbers, fictional "Example Institution")

These numbers are invented to show arithmetic. They are not data, benchmarks or results.

**Case A: all eight signals scored.**

| Signal | Score | Weight | Contribution |
| --- | ---: | ---: | ---: |
| Admin engagement | 80 | 15% | 12.0 |
| User activation | 70 | 20% | 14.0 |
| First meaningful action | 60 | 15% | 9.0 |
| Core workflow completion | 50 | 20% | 10.0 |
| Weekly active use | 40 | 10% | 4.0 |
| Support sentiment | 90 | 5% | 4.5 |
| Executive engagement | 100 | 5% | 5.0 |
| Outcome trend | 55 | 10% | 5.5 |
| **Composite** | | 100% | **64.0 = Yellow** |

Triggers: weekly active use at 40 fails the "rapid decline" test only if the drop exceeds 30% from peak (not shown); workflow completion below target for two weeks would force a named action. Action: weakest weighted gap is core workflow completion (20% weight at score 50); validate the denominator with the champion, name one corrective action.

**Case B: early pilot, outcome trend not applicable by phase.** Same scores for the seven signals; applicable weight = 90%; sum of contributions = 58.5; composite = 58.5 / 0.90 = **65.0 = Yellow**, coverage 100% of applicable weight, outcome trend shown as "N/A by phase".

**Case C: missing data.** Suppose support sentiment (5%) and weekly active use (10%) have no valid data: unscored weight 15% of applicable (at or below 20%), composite computed on the remaining 85% with coverage 85% displayed. If a third signal worth 10% were also missing, unscored weight is 25% (above 20%) and the composite is `unscored`, no band.

## 9. Evidence state

**Repository evidence.** [VERIFIED] controlled health model, churn playbook and success system exist as documents.
**Operational evidence.** None: no customer, signal feed, calibration or intervention history.
**Missing proof.** Source validation; fail-closed nightly function; shadow reviews with customer context; privacy review of purpose and fields; threshold validation.

## Claim ceiling

Semester may describe this as a proposed internal discussion framework and may record a human-reviewed narrative when approved evidence exists.

## Prohibited claims

Do not claim a customer is healthy or at risk, predict churn or renewal, automate outreach or decisions, score an individual, or cite benchmark accuracy.

## Professional review required

[REVIEW: privacy] purpose, fields, retention, survey and any customer-visible display.
