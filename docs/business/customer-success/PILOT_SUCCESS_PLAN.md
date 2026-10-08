# Pilot Success Plan (template and metric dictionary)

| Control | Value |
| --- | --- |
| Status | **DRAFT TEMPLATE - TARGETS ARE PLANNING ASSUMPTIONS, NOT APPROVED, NOT USED WITH ANY CUSTOMER** |
| Owner | Harrison Rubin (interim; backup unassigned). Customer sponsor, analyst and privacy reviewer: unassigned |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [DECISION OPEN] [REVIEW: privacy] [REVIEW: counsel] |
| Audience | Internal. The per-customer plan (section 2) becomes customer-facing only after its numbers are agreed and its wording is approved. |

> This is an operating document, not legal, privacy, tax or accounting advice. Nothing here is a result, a guarantee or an approved claim.

**Label legend.** [VERIFIED] proven by a repository path. [ASSUMPTION] planning number. [DRAFT] needs review. [INTERNAL] not for customers as-is. [APPROVED] count in this file: zero.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document |
| --- | --- | --- | --- |
| [`../../commercial/PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md) | Decision contract, 8 required-definition measures (activation, first win, weekly planning, readiness progress, time to first value, reliability, support burden, trust), cadence, privacy threshold (proposal at least 10) | The user's eight-metric set as a dictionary with numerator, denominator, source, baseline method, [ASSUMPTION] target; baseline capture; conversion criteria; pilot-complete rule; data-quality rules; claims-permission rule | The controlled doc deliberately leaves every baseline and target `[REQUIRED]`; this doc proposes labelled starting assumptions without editing it |
| [`../../commercial/PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md) | Blank scorecard rows and decision controls | Mapping of the user's metrics onto those rows (section 4) | Avoid a third scorecard |
| [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md), [`../../PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md) | Lifecycle; four outcomes (convert, expand, pause, stop); decision meeting | Quantified decision criteria and the pilot-complete rule | They state outcomes, not thresholds |
| [`../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md) | Closeout checklist and conversion safeguards | Pointer | Do not duplicate |
| `app/src/lib/gtm/pilot.ts` (`pilotReadiness`, `pilotVerdict`) | 3-5 metrics each with baseline; sponsor-signed decision; blocks convert/expand with open high-severity issue | Plan structure follows it | Code is the authority |

## Gate (what is allowed now versus held)

| Allowed NOW [VERIFIED: `../../../GO-NO-GO-DECISION.md`] | HELD until the gate flips |
| --- | --- |
| Discuss this template with a design-partner prospect in non-activation scoping; agree metric *definitions* and the baseline *method*; rehearse reporting on synthetic data | Capturing a real baseline from live data; any real target; launching a pilot (paid pilot NO-GO/RED; design-partner activation needs signed GO); any result or outcome statement; case study or reference (CLM-013, CLM-014) |

## 1. Constraints from code and policy

- 3-5 metrics per pilot, **each with a baseline**, or `pilotReadiness` returns `metric_count` / `metric_baseline`. The eight metrics below are a **menu**; a pilot selects 3-5 as its decision metrics and reports the rest as diagnostic. [VERIFIED: `app/src/lib/gtm/pilot.ts`]
- No success metric about individual students ("at-risk", "early alert", "per student", "GPA", "wellbeing"); cohort aggregates only, cohort 10-200. [VERIFIED: `../../PAID-PILOT-FRAMEWORK.md`]
- Pilot length: 26 weeks in code, 8-12 weeks in the user's planning assumption. Cadence below is in relative terms; see [`ONBOARDING_WORKFLOW.md`](ONBOARDING_WORKFLOW.md) section 1.2 [DECISION OPEN].
- Time savings, ROI, retention, GPA, graduation, wellbeing: CLM-014 PROHIBITED today. Targets for such measures are internal hypotheses only. [VERIFIED: `../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`]

## 2. Success plan template (one per pilot) [DRAFT]

| Field | Entry |
| --- | --- |
| Customer / pilot ID | `[Institution]` / `[PILOT-ID]` |
| Executive sponsor, champion, backups | `[Name, role]` |
| Workflow and eligible cohort (10-200) | `[Workflow]`, `[N eligible]` |
| Objectives (max 3, in the champion's words) | `[Objective 1]` ... |
| Decision metrics (3-5 from section 3) | `[list]` |
| Baseline method, date frozen, owner | `[method]`, `[date]`, `[owner]` |
| Privacy threshold (cohort suppression) | At least 10 [ASSUMPTION, REVIEW: privacy] |
| Guardrail stop thresholds | `[e.g. any P0/P1 open; accessibility barrier on a core task]` |
| Midpoint, final review and conversion dates | `[PLACEHOLDER]` (conversion date within end minus 14 days to end plus 30 days) |
| Offboarding rule | Always available; see offboarding playbook |
| Signed by | Sponsor and Semester, `[date]` |

## 3. Metric dictionary [DRAFT]

Targets are **[ASSUMPTION]** opening positions for negotiation with a design partner. None is a commitment, forecast or claim. Source column: "event" means a product event validated against a sample (not raw logins); "survey" means an approved instrument; baselines come from section 5.

| # | Metric | Definition | Numerator | Denominator | Source | Baseline | Target [ASSUMPTION] | Suppress if cohort < 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Activation | Eligible participant completes approved minimum setup within the window after invitation | Consented participants completing setup within 14 days of invitation | Eligible invited population (approved roster) | Roster plus validated setup event | Record as "0 (new tool, no prior activation)" with the invitation date, so the readiness check has a baseline string | 60% within 14 days | Yes |
| 2 | First meaningful action | Participant reaches Today, understands one relevant prioritized action and its source, and completes, schedules, snoozes or defers it (complete/schedule/snooze/defer stay distinguishable) | Activated participants with the event within 7 days of activation | Activated participants | Validated event plus sample QA | None; define pre-launch | 70% within 7 days | Yes |
| 3 | Workflow completion | Participant completes the pilot's named workflow (e.g. a checklist or registration-planning task) | Participants completing the workflow by the workflow deadline | Participants eligible for that workflow | Event or approved checklist aggregate; not official-system confirmation | Prior-term completion rate for a comparable cohort `[source]` | Baseline plus 10 percentage points, or customer-set | Yes |
| 4 | Weekly active use | Participant performs at least one value-producing action (planning action, not a sign-in) in the week | Activated participants with a value action that week | Activated participants | Validated event; raw logins excluded | None | 40% of activated, averaged over weeks after launch week | Yes |
| 5 | Staff time and support-friction reduction | Reduction in staff minutes per case or in avoidable contacts on the pilot workflow | (Baseline minutes minus pilot minutes) per case | Baseline minutes per case | Staff time log, labelled **estimate** unless timed; plus ticket counts | Two-week staff time log before launch | 15% reduction, labelled estimate unless timed [internal hypothesis only; CLM-014] | n/a (staff aggregate; suppress if fewer than 10 cases) |
| 6 | Student confidence / satisfaction | Self-reported clarity about next steps and confidence in the process | Respondents answering 4 or 5 on a 5-point item | All respondents (report response rate) | Approved survey, midpoint and final | Same item asked pre-launch | 60% at 4 or 5, response rate at least 30% | Yes |
| 7 | Support issue reduction | Support contacts about the pilot workflow per 100 eligible students | Contacts tagged to the workflow in the window | Eligible students (per 100) | Customer support system plus Semester support log; unavailable if no staffed system | Prior-term contacts per 100 | 15% reduction, or customer-set | Yes |
| 8 | Conversion readiness | All conversion conditions in section 7 met at final review | Conditions met | Conditions required (fixed list) | Decision log and checklist | n/a | 100% of required conditions | n/a |

Reliability and support burden remain guardrails (see the controlled plan); they are not success metrics and no uptime or SLA is evidenced.

Vanity metrics (page views, downloads, sign-ups, impressions, raw logins) are diagnostic only and never proof of value. [DRAFT]

## 4. Mapping to the existing scorecard

| This plan | Row in [`../../commercial/PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md) |
| --- | --- |
| 1 | eligible cohort activation |
| 2 | first-win decision |
| 3 | approved readiness progress (when the workflow is a readiness checklist) |
| 4 | meaningful weekly planning |
| 5, 7 | support burden |
| 6 | student/staff trust and usefulness |
| 8 | decision controls block |

## 5. Baseline capture [DRAFT] [REVIEW: privacy]

1. Choose the baseline source with the customer before launch (prior-term data, a two-week pre-pilot log, or a pre-survey). Record who supplies it, the query or form, the date range and the population.
2. Freeze the definition, query and baseline value in the plan **before launch**. Do not backfill a favourable definition after results are visible.
3. Label each baseline **ACTUAL** (measured from records) or **ESTIMATE** (recalled or sampled). A metric without a baseline is not launch-ready (`metric_baseline`).
4. Where no honest baseline exists, drop the metric from the decision set or report it as exploratory.
5. Baselines contain no individual-level sensitive data; aggregates only.

## 6. Cadence [DRAFT]

| Review | When (relative) | Content | Decision |
| --- | --- | --- | --- |
| Weekly report | Every week after launch | Metrics 1-4 and 7, denominators, data-quality note, support and incident summary, top risks (`overdue()` decision-log entries), actions | Owner actions only |
| Midpoint executive review | Halfway (about week 13 of 26; about week 5-6 of 8-12) | Observed trajectory vs baseline with caveats; risks; limits | Continue, correct, pause or stop (sponsor signs) |
| Final value review | Last two weeks | All selected metrics, qualitative findings, support and accessibility summary, cost to serve, limitations, Semester recommendation (may be stop) | Convert, expand, pause or stop |

## 7. Decision criteria for annual conversion [DRAFT] [REVIEW: counsel]

Outcomes use `PilotDecision`: convert, expand, pause, stop. [VERIFIED: `app/src/lib/gtm/pilot.ts`, `../../PILOT-TO-ANNUAL-CONVERSION.md`] Conversion needs **all** of:

| # | Condition | Evidence |
| --- | --- | --- |
| 1 | Agreed decision metrics met or the sponsor accepts the shortfall in writing | Final report |
| 2 | No open high-severity security, privacy or policy issue (`unresolvedHighSeverity` is 0) | Issue log |
| 3 | No unresolved accessibility barrier on a core task | Accessibility record |
| 4 | Customer accepts the value in its own words | Sponsor note |
| 5 | Delivery and support capacity credible (staffed support evidenced) | Support record |
| 6 | Price, scope and paper approved (deal desk `review()` no refusals) | Order draft; **HELD** while price and paid pilot are NO-GO |
| 7 | Scope is adjacent to the pilot scope | Proposal |
| 8 | Clean-exit alternative offered | Offboarding plan |

Expand adds: champion and sponsor want more; each new cohort gets its own readiness check and launch-council go. Pause needs a named fixable cause and a dated plan. Stop: written summary, export offered, no renewal pitch. A signed decision is required for any of them (`pilotVerdict`).

## 8. Pilot-complete rule [DRAFT; the signed-decision element is [VERIFIED: `pilotVerdict` in `app/src/lib/gtm/pilot.ts`]]

A pilot is **not complete** until **all five** are recorded:

1. **Activation** measured and reported (metric 1) with denominator.
2. **Workflow completion** measured and reported (metric 3) with denominator.
3. **Outcome measurement** against the frozen baseline for every decision metric, labelled ACTUAL or ESTIMATE.
4. **Executive review** held and minuted (midpoint and final).
5. **Conversion decision** signed by the sponsor (`decision`, `signedBy`, `signedAt` all present; `pilotVerdict(...).final` is true).

Anything less is "in progress" or "ended without decision", never "successful".

## 9. Data-quality rules [DRAFT]

| Rule | Detail |
| --- | --- |
| Actual versus estimate | Every figure in a report carries ACTUAL, ESTIMATE or UNAVAILABLE. Estimates never feed a conversion criterion without sponsor agreement. |
| Missing data | Show UNAVAILABLE, never zero or neutral. Report the share of missing records. |
| Suppression | Cells under 10 suppressed; complementary suppression where a total would reveal them. |
| Exclusions | Exclude test, staff and support accounts and invalid attempts only; log every exclusion. Incomplete attempts are censored and counted. |
| Versioning | Event and query versions recorded; a definition change restarts the series. |
| Source of truth | Metrics come from validated events; raw logins excluded; no self-reported figure presented as measured. |
| Sample QA | Validate each event against a sample before launch and again at midpoint. |
| Independence | Semester prepares the report; the customer champion reviews denominators before the executive review. |

## 10. Non-guarantee language (use in any customer-facing extract) [DRAFT] [REVIEW: counsel]

> "Targets in this plan are shared planning goals, not guarantees or commitments. Results depend on the cohort, the workflow, the data available and how the pilot is run. Figures marked ESTIMATE are not measurements. This plan does not predict retention, grades, graduation or any institutional outcome."

## 11. Claims-permission rule [VERIFIED rule: CLM-013, CLM-014]

Metrics, results, quotes, the customer's name or logo may appear outside the customer relationship only with (a) an approved baseline, a complete measured result and a causal design where causality is implied (CLM-014), and (b) an executed claim-specific permission from the rights-holder with Legal, Privacy and Communications approval (CLM-013). Today both are absent: **no claim is permitted**. Workflow: [`RENEWAL_AND_EXPANSION_PLAYBOOK.md`](RENEWAL_AND_EXPANSION_PLAYBOOK.md) section 6; consent draft: [`../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md`](../../legal-drafts/TESTIMONIAL-AND-CASE-STUDY-CONSENT-DRAFT.md).

## Evidence state

**Repository evidence.** [VERIFIED] readiness and verdict code, controlled plan and scorecard exist.
**Operational evidence.** None: no cohort, baseline, accepted event set or result exists.
**Missing proof.** Customer-approved definitions; baseline capture; event validation; reporting rehearsal; privacy review of the threshold.

## Claim ceiling

Semester may describe a proposed measurement and decision framework and may report only approved, observed results with population, window, source and caveats.

## Prohibited claims

No claim of pilot success, adoption, time saved, support reduction, satisfaction, retention, GPA or graduation improvement, ROI or causal impact from targets, synthetic data, raw logins or incomplete denominators.

## Professional review required

[REVIEW: privacy] thresholds and survey; [REVIEW: counsel] non-guarantee and claims wording; [REVIEW: accessibility] survey and report formats.
