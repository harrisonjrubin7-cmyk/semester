# 01 · Operating cadence

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NOT YET OPERATED** |
| Owner seat | `operations`; the `founder` seat chairs the weekly and monthly forums |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`OPERATING-RHYTHM`](../../operating-model/OPERATING-RHYTHM.md), [`PROOF-CALENDAR`](../../PROOF-CALENDAR.md), [`COMPANY-OPERATING-MODEL`](../../company/COMPANY-OPERATING-MODEL.md), [`LAUNCH-READINESS-COUNCIL`](../../LAUNCH-READINESS-COUNCIL.md) |
| Claim ceiling | Semester may say it has a defined review cadence. It may not say the cadence has operated until dated records exist. |

## Rules

1. **A forum without a written output is cancelled.** The existing rhythm says this; here it is a rule with a record location.
2. **Every red item leaves the room with an owner, a date and one of four verbs:** *decide*, *assign*, *escalate* or *drop*. "Discuss further" is not a verb.
3. **Every metric discussed has a source.** A number without a dashboard row ([09](09-dashboards-and-indicators.md)) is an anecdote and is marked as one.
4. **Decisions are recorded where they can be found.** A repository decision is `docs/decisions/D-<pull request number>.md` ([README](../../decisions/README.md)). A decision about a named customer, person or contract goes in the private operations system, with only its existence noted publicly.
5. **The cadence follows the academic calendar**, not the other way round ([the overlay below](#the-academic-calendar-overlay)).
6. **A skipped forum is a finding.** Two consecutive skips of the weekly operating review raise a cadence-debt item at the next monthly review.

## The cadence at a glance

| Forum | Rhythm | Time-box | Chair seat | Required output | Record |
| --- | --- | --- | --- | --- | --- |
| Health sweep | Daily | 15 min | `operations` | Status line: queue, alerts, status page, anything unowned | One line in the private ops log |
| Weekly operating review (WOR) | Weekly | 60 min | `founder` | Top-five list, risk movements, decisions needed, claims withheld | [TPL-01](templates.md#tpl-01-weekly-operating-review-notes) |
| Tenant delivery review | Weekly, per tenant in implementation or hypercare | 30 min | `success` | Phase status, blockers, next gate date | Tenant record in private ops system |
| Support and quality review | Weekly | 30 min | `operations` | Top three recurring causes with owners; QA sample result | Support report (aggregate only) |
| Release and change review | Weekly, plus per release | 30 min | `engineering` | GO, GO WITH CONDITIONS or NO-GO per candidate; change calendar for next two weeks | [TPL-14](templates.md#tpl-14-change-request) |
| Monthly business review (MBR) | Monthly | 90 min | `founder` | MBR pack with resource and risk decisions | [TPL-02](templates.md#tpl-02-monthly-business-review-pack) |
| Customer health review | Monthly | 60 min | `success` | Per-tenant colour with reason, renewal and expansion flags | Health record in private ops system |
| Risk and claims review | Monthly | 60 min | `founder` | Register changes; acceptances nearing expiry; claim approvals due | Risk register, claims register |
| Access and vendor review | Monthly | 45 min | `operations` | Privileged-access recertification list; vendors whose reviews fall due | Access log; [TPL-15](templates.md#tpl-15-vendor-review-record) |
| Quarterly review (QBR) | Quarterly | Half day | `founder` | Next-quarter objectives, stage promotion decision, hiring triggers fired | [TPL-03](templates.md#tpl-03-quarterly-review-and-objectives) |
| Quarterly control review | Quarterly | Half day | `operations` | Restore exercise, tabletop, access recertification, horizon scan, subprocessor re-read | Evidence filed under `docs/evidence/` |
| Annual planning | Annual | Two days | `founder` | Annual plan, budget envelope, org plan | [`ANNUAL-OPERATING-PLAN`](../../company/ANNUAL-OPERATING-PLAN.md) updated |
| Annual independent reviews | Annual | — | `security`, `accessibility`, `privacy` | Independent accessibility audit, security and privacy review, HECVAT refresh | Reports kept privately; summary only in repo |

The quarterly control-review items that produce a file are the quarterly half of the [proof calendar](../../PROOF-CALENDAR.md), which names the seat and path for each. This page does not duplicate that list.

## The weekly shape

| | Monday | Tuesday | Wednesday | Thursday | Friday |
| --- | --- | --- | --- | --- | --- |
| Morning | Health sweep; **WOR** | Health sweep; tenant delivery reviews | Health sweep; support and quality review | Health sweep; **release and change review** | Health sweep; handoff notes |
| Afternoon | Customer calls | Implementation work | Customer calls | Release work | Weekly close: update dashboards, file notes, set Monday's list |

Two principles hold the week together. **No customer-affecting change ships on Friday** unless it is an emergency change ([06](06-vendor-quality-change.md#change-management)). **Monday begins with last Friday's handoff note**, so any person who covers for another starts from written state.

## Weekly operating review

Sixty minutes, in this order. The chair keeps time and refuses items that have no input.

| Min | Block | Input | Output |
| --- | --- | --- | --- |
| 0–5 | Safety and trust first | Open SEV1/SEV2, open security, privacy, safety or accessibility cases | Confirmed owners; anything unowned is assigned in the room |
| 5–15 | Scorecard | Executive scorecard ([09](09-dashboards-and-indicators.md#d1-executive-scorecard)); metrics that moved a colour | One sentence of cause per moved metric, or "no data" |
| 15–25 | Customers | Tenant list: phase, health colour, next gate | Gate dates confirmed; escalations named |
| 25–35 | Release and change | Candidate list, change calendar, freeze windows | Dated GO / NO-GO intentions; conflicts with the academic overlay resolved |
| 35–45 | Risks and claims | Register changes; acceptances expiring in 14 days; claims requested this week | Renew, fix or lapse each acceptance; approve or withhold each claim |
| 45–55 | Decisions | Items needing a decision, each pre-written as a one-paragraph record | Decisions made and logged, or deferred with a date and reason |
| 55–60 | Close | — | Top five for the week, each with one owner and one date |

## Monthly business review

The MBR pack has seven sections and no slides: [TPL-02](templates.md#tpl-02-monthly-business-review-pack).

| Section | What it must show |
| --- | --- |
| Customers and pipeline | Tenants by phase and health; pipeline by stage with the next dated step |
| Delivery | Gate adherence, rework rate, time-to-live ([09](09-dashboards-and-indicators.md#d3-implementation-and-adoption)) |
| Reliability and support | SLO attainment where measured, incident count and recurrence, contact rate, QA score |
| Trust | Privacy, safety and data-rights queue ages; accessibility defects by severity; AI incidents; vendor reviews due |
| Money | Budget against actual, runway in months, collections, cost per active user including AI |
| People and capacity | Open triggers from [11](11-founder-to-team-transition.md#hiring-triggers); founder hours on operations |
| Decisions | Each decision needed, with a recommendation and its criteria |

Thresholds that force an item onto the agenda regardless of order: any red metric for two consecutive weeks; any risk acceptance within 14 days of expiry; any vendor review overdue; any process with fewer than two people able to run it ([11](11-founder-to-team-transition.md#the-founder-removal-test)).

## Quarterly review and control review

### QBR agenda (half day)

1. **Result against objectives.** Each key result, its metric source, its colour, and what would have to be true to change it.
2. **Customer outcomes.** Pilot scorecards against baselines; conversions, extensions and stops, each with the decision record.
3. **Stage check.** Evidence against the [stage promotion criteria](11-founder-to-team-transition.md#stage-promotion-criteria). The answer is *promote*, *hold* or *demote*. Demotion is allowed and honest.
4. **Portfolio.** Build, partner, integrate, defer, decline or sunset decisions, per [`PORTFOLIO-GOVERNANCE`](../../operating-model/PORTFOLIO-GOVERNANCE.md).
5. **Pricing and package.** Changes to the deal policy, signed by the `finance` seat once held.
6. **Capacity and hiring.** Fire or defer each trigger.
7. **Next quarter.** At most five objectives, each with at most three key results taken from [09](09-dashboards-and-indicators.md).

### Quarterly control review (half day)

| Control | Method | Pass condition |
| --- | --- | --- |
| Restore exercise | Restore a production-shaped backup into a separate project; time it | Restore completes; elapsed time and data-loss window recorded; compared to the provisional targets in [05](05-incident-and-continuity.md#business-impact-and-provisional-recovery-targets) |
| Tabletop | Run one scenario from [05](05-incident-and-continuity.md#exercise-schedule) with everyone who would respond | Roles filled by the people who would fill them; gaps logged as actions |
| Access recertification | Every privileged grant re-justified or revoked, from the role-grant audit | Zero grants without a current reason |
| Vendor and subprocessor re-read | [`SUBPROCESSORS`](../../SUBPROCESSORS.md) read against what actually runs | Zero unlisted destinations |
| Claims audit | Sample ten public statements against the [claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | Zero unregistered claims |
| Horizon scan | Written summary per [`TRUST-BRAND-AND-LEGAL`](../../operating-model/TRUST-BRAND-AND-LEGAL.md#horizon-scanning), with counsel | Items needing counsel routed to the queue |
| Cadence audit | Count held against planned forums; spot-check three sets of notes | Every planned forum held or its skip recorded |

## Annual planning

### Calendar

Dates are planning anchors. The Fall term and its freezes come from each tenant's calendar, not this table.

| Month | Planning work |
| --- | --- |
| January | Annual retrospective from December data; set annual plan; budget envelope; independent-review bookings |
| February | Annual plan approved; Q1 objectives in force; hiring plan against triggers |
| March | Independent accessibility audit fieldwork; security and privacy review |
| April | HECVAT refresh; renewal motion for tenants whose terms end in summer |
| May | Q2 review; summer implementation window plan locked |
| June | Summer implementation window opens ([overlay](#the-academic-calendar-overlay)) |
| July | Mid-year review; trigger check; vendor annual reviews |
| August | Fall readiness: freeze dates published to every tenant; support peak plan |
| September | Peak-week operations; no planned change in freeze |
| October | Stabilize; pilot midpoint reviews; renewal motion for January terms |
| November | Annual-plan draft; registration-week freeze |
| December | Finals freeze; annual retrospective data pull |

### Annual plan contents

[`ANNUAL-OPERATING-PLAN`](../../company/ANNUAL-OPERATING-PLAN.md) holds the template. This set adds four requirements: a **stage plan** (which stage the company expects to reach and the evidence that would show it), a **capacity plan** from the [staffing arithmetic](04-support-operating-model.md#staffing-model), a **control calendar** from the proof calendar, and a **founder-time budget** ([11](11-founder-to-team-transition.md#the-founders-time-budget)).

## The academic calendar overlay

Education software fails at predictable moments. The cadence treats them as fixed points.

| Period | Operating posture | Freeze rule | Priority work |
| --- | --- | --- | --- |
| Summer (June–August) | **Implementation window** | None beyond normal change control | New tenant onboarding, migrations, integrations, training, restore exercises |
| Term start (two weeks either side) | **Peak support** | No go-lives, no migrations, no schema changes on critical journeys | Hypercare for new cohorts; extra health sweeps; staffed peak plan |
| Add/drop and registration windows | **Peak load** | Same as term start for registration and billing journeys | Registration journey SLO watch; capacity headroom |
| Grade release | **Integrity watch** | No changes touching grades or official records | Reconciliation checks; incident readiness |
| Billing due dates | **Money watch** | No changes touching the student-account ledger or hosted payment flow | Ledger reconciliation; support macros ready |
| Finals (two weeks) | **Stability** | Feature freeze; fixes only; no tenant onboarding | Submission and deadline journeys; AI tutor capacity |
| Winter break | **Second implementation window** | Normal | Short onboardings, spring cohort prep |
| Commencement and graduation | **Lifecycle** | No changes to alumni or record-release paths | Alumni consent flows; export and offboarding checks |

Each tenant's calendar is entered into the shared change calendar ([06](06-vendor-quality-change.md#the-change-calendar)). A change that lands in a tenant's freeze window requires an emergency-class approval for that tenant, even if other tenants are unaffected.

## Stage 0 compression

At Stage 0 one person holds the seats. The cadence compresses; it does not lapse.

| Forum | Stage 0 form | Founder time per week |
| --- | --- | --- |
| Health sweep | Five minutes, same checks, one line logged | 0.5 h |
| WOR | 45 minutes, written Monday; the founder is chair and scribe; once a trusted advisor exists, they read the notes and ask the questions an absent team would | 1 h |
| Tenant delivery | One 30-minute block covering all tenants | 0.5 h |
| Support and quality | Weekly read of every case; QA by the founder against the rubric ([04](04-support-operating-model.md#quality-assurance)) | 1 h |
| Release and change | Folded into the Thursday release review | 0.5 h |
| Monthly forums | One half-day, four hours, running the MBR, customer health and risk and claims reviews in order | 1 h averaged |
| Quarterly | Two half-days per quarter | 1 h averaged |
| Records | Filing and handoff notes | 1.5 h |
| **Total** | | **about 7 h, budget 10 h** |

Compression has two safeguards. **The advisor read:** at least monthly, someone other than the founder reads the notes and answers in writing ([TPL-01](templates.md#tpl-01-weekly-operating-review-notes) has a field for it). **The independence rule from the [owner matrix](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) still applies:** the founder cannot act as their own qualified assessor, counsel or customer approver.

## What changes at each stage

| Stage | Cadence change |
| --- | --- |
| 0 → 1 | WOR gains a second voice (the trained backup). Health sweep alternates between two people. The tenant delivery review becomes a real meeting with the customer champion present monthly. |
| 1 → 2 | Functional leads own their own reviews; the WOR becomes a leadership review of exceptions; a separate customer-success review appears. |
| 2 → 3 | Reviews run by function and tenant tier; a monthly operations review is added for incident and problem trends; the quarterly review gains board or advisor input. |

## Related

[TPL-01 to TPL-04](templates.md) · [Dashboards](09-dashboards-and-indicators.md) · [RACI](03-raci-and-decision-rights.md) · [Founder transition](11-founder-to-team-transition.md)
