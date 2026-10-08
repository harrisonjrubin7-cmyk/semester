# Customer success system

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PROPOSED MODEL — NO CUSTOMER, NO SCORE, NO VALIDATION** |
| Owner | Customer success manager seat; backup unassigned |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phase 10](METHODOLOGY.md#phase-10--optimize) and the hand-off from [hypercare](HYPERCARE-AND-HANDOFF.md) |
| Extends | [`../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md`](../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md), [`../commercial/CUSTOMER-HEALTH-SCORE.md`](../commercial/CUSTOMER-HEALTH-SCORE.md), [`../commercial/CHURN-AND-RISK-PLAYBOOK.md`](../commercial/CHURN-AND-RISK-PLAYBOOK.md), [`../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md) — their constraints bind here and are not re-argued |

What this adds to those four short playbooks is the machinery: how a weekly
review is run, what a stakeholder map and success plan contain, how renewal
posture is reasoned about, and exactly what must be true before an expansion is
proposed. What it does not change: **health is an account-level, human-reviewed
operating aid** — never a fact about students, an automated renewal decision, or
permission for intrusive outreach. P0/P1 security, privacy, accessibility,
safety, rights or isolation failures override every score and every commercial
motion. Nothing here scores an individual.

## 1. Cadence

| Rhythm | Content | Who | Output |
| --- | --- | --- | --- |
| Weekly health review (30 min, internal) | the [health dimensions](#3-account-health-review); only changed evidence | CSM, SL, IL | status proposal + one named action per non-green dimension |
| Monthly working session (customer) | success plan progress, adoption, open issues, decisions due | CSM, champion | decision-register rows |
| Quarterly EBR | [`EXECUTIVE-BUSINESS-REVIEW.md`](EXECUTIVE-BUSINESS-REVIEW.md) | CSM, both sponsors | recorded in `qbrs` |
| Renewal cadence | 120 / 90 / 60 / 30 days before term end ([renewal stages](#6-renewal-risk-model)) | CSM, CF, sponsors | stage and outcome |
| Annual stakeholder-map refresh | every role re-confirmed | CSM, champion | map v+1 |

## 2. Adoption metrics

Adoption is **meaningful use by an agreed cohort**, not logins. Every metric
needs the definition card below before it is reported; a metric with a blank card
is not launch-ready (the pilot success plan's rule). Report only aggregates at or
above the customer-approved privacy floor (proposal: n ≥ 10), with the frozen
denominator beside the numerator. Missing data is **unavailable**, not zero and
not healthy.

**Definition card (one per metric)**

| Field | Content |
| --- | --- |
| Name and decision it informs | |
| Eligible population and exclusions (frozen at launch) | |
| Numerator / denominator | |
| Source, event name and query version | |
| Window and cadence | |
| Baseline, target or range, who approved both | |
| Owner and backup | |
| Privacy floor and suppression rule | |
| Interpretation limits (what it does not show) | |

**The adoption ladder** (starting set; definitions live in
[`../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md`](../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md)
and [`../commercial/PILOT-SUCCESS-PLAN.md`](../commercial/PILOT-SUCCESS-PLAN.md))

| Rung | Measure | Reads as | State today |
| --- | --- | --- | --- |
| Reach | invited ÷ eligible | whether the cohort was actually offered it | no cohort exists |
| Activation | consented participants completing approved setup ÷ eligible invited | invitation is not activation | **[baseline, target, owner, source required]** |
| First win | participants reaching Today, understanding one prioritized, sourced, reversible action, knowing the help route, and acting on it (complete, schedule, snooze or defer) | the value moment | proposed definition; event and sample QA unaccepted |
| Time to first value | consented start → first win within a fixed window; incomplete attempts censored and counted | friction | unmeasured |
| Meaningful weekly planning | participants completing an approved planning action in the week | habit; raw logins excluded | proposed aggregate; source unaccepted |
| Breadth | capability families used by the cohort at least once (Today, Calendar, Courses, Study, Advising …) | what they actually rely on | unmeasured |
| Depth / retention of use | share active in each of four consecutive weeks | durability, not satisfaction | unmeasured |
| Role coverage | share of staff and faculty seats in the stakeholder map active in the period | institutional adoption beyond students | unmeasured |
| Operator health | access reviews done on time; configuration changes with a checker; open drafts older than 14 days | whether the school can run it | unmeasured |
| Integration health | freshness and sync success against agreed targets | reliability people feel | unmeasured |
| Help burden | support contacts by theme per 100 active (suppressed below floor) | friction and defects | unmeasured |

Do not infer retention, GPA, graduation, wellbeing or causal impact from usage.

## 3. Account health review

Start with the narrative — scope, outcome and guardrail evidence, missing data,
recent changes, customer perspective, risks, next action — then the dimensions.
The dimensions and **weights are the proposal in the health-score document and
are not re-tuned here**; they are hypotheses requiring customer and privacy
review and outcome validation.

| Dimension | Proposed weight | Evidence that makes it **Green** | **Amber** | **Red** | **Unavailable** |
| --- | ---: | --- | --- | --- | --- |
| Agreed outcome trajectory | 25% | measures on or ahead of the agreed range, denominators intact | behind range, cause understood | behind with no credible path, or guardrail trending badly | no approved measure or no data |
| Implementation / readiness | 20% | stage exit evidence accepted; no overdue dependency | dependency overdue < agreed period | blocked, or a gate failed | no project record |
| Meaningful adoption / first win | 15% | activation and first win in range | below range | far below range with no cohort change | event source unaccepted |
| Reliability / recovery | 15% | accepted SLIs met; incidents recovered per runbook | repeat minor incidents | repeat or unrecovered critical failure | no accepted SLI |
| Support burden / resolution | 10% | staffed route; queue ageing within agreed bounds | ageing growing | unresolved P0/P1, or route unstaffed | no queue data |
| Sponsor / champion engagement | 10% | decisions made on time; map coverage met | one missed decision | sponsor gone with no successor; no decision path | no decision record |
| Trust / customer gates | 5% | reviews current; exceptions unexpired | an exception near expiry | open exception past expiry, review overdue | no register |

**Mechanics (proposed; to be validated in shadow reviews)**

1. Each dimension is recorded as Green, Amber, Red or **Unavailable**, with its
   evidence link and as-of time. Never substitute neutral for Unavailable.
2. A composite is shown **only** when the Available dimensions' weights sum to
   at least 70%; otherwise the review states "insufficient evidence" and the
   next action is *investigate data quality*. Show the components beside any
   composite, plus formula version, source, confidence and reviewer.
3. **Overrides beat arithmetic.** Any P0/P1 security, privacy, accessibility,
   safety, rights or isolation issue sets the status to `compliance_action` and
   pauses the affected scope until authorized safe recovery. These other
   triggers need a human decision the same week: sponsor departure, unsupported
   expansion request, unstaffed support route, unreconciled billing or delivery,
   missed decision date.
4. A human reviewer signs every status. A color without a reviewer is not a status.

**Mapping to stored statuses** (`account_health_snapshots.status`, a closed set;
each needs a `reason` of 10–1000 characters and a `next_action` of 5–400)

| Stored status | Use when |
| --- | --- |
| `healthy` | all Available dimensions Green, coverage rule met, reviewer signed |
| `needs_attention` | any Amber with a named owner and date |
| `implementation_blocked` | project `status` is `blocked`, or a gate failed |
| `compliance_action` | any override trigger above |
| `at_risk_commercial` | a Red in outcomes, sponsor engagement or commercial inputs with renewal within 180 days, or an unapproved renewal term |
| `renewal_planning` | the renewal opportunity is at `review_120` or later |
| `expansion` | an [expansion trigger](#7-expansion-triggers) is met and has been human-reviewed |

**Present limitation — read before using the nightly snapshot.** The nightly
`compute_account_health()` job is *not* an implementation of this model: it reads
only implementation stage, overdue invoices, days to renewal and a recent
review, and it can write `healthy` with `review_state = not_needed` when those
source records are absent. Until it fails closed to *unavailable / pending review*
when sources are missing (an engineering change with its own test, raised through
the [escalation loop](FEEDBACK-AND-ESCALATION.md)), treat its output as
**unavailable and unreviewed**: it must not supply a color or drive outreach,
renewal, expansion or any customer claim. The weekly review above is manual until
then.

## 4. Stakeholder map

One map per account, owned by the CSM, in the project record. Roles are
*seats on the customer side*; names belong to the customer. It records authority
and facts, never sentiment or personality.

| Role | Person (customer-held) | Decides | Influences | Backup contact | Last factual contact | Next scheduled touch | Stated position **in writing** | Departure date / note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Economic buyer (provost / CIO / VP) | | budget, renewal | | | | | | |
| Executive sponsor | | scope, stop, exceptions | | | | | | |
| Champion (day-to-day owner) | | cohort, communications | | | | | | |
| Registrar / SIS owner | | data authority, cutover | | | | | | |
| Identity / IT owner | | SSO, SCIM, network | | | | | | |
| LMS owner | | LTI, passback | | | | | | |
| Security and privacy officer | | reviews, exceptions | | | | | | |
| Accessibility / disability services | | accessibility acceptance | | | | | | |
| Faculty lead | | course adoption | | | | | | |
| Student representative (voluntary) | | none; voice only | | | | | | |
| Help-desk lead | | frontline routing | | | | | | |
| Finance / procurement | | order, invoice, renewal paper | | | | | | |

**Coverage rules.** At least three distinct people across at least three roles
who are not in the same reporting line, including someone who is not the
sponsor. One person holding economic buyer, sponsor and champion is a
**single-thread risk**, recorded as an Amber on sponsor engagement. Every role
has a backup contact within 60 days of go-live.

**Departure protocol.** On notice of any seat's departure: ask the outgoing
person for the successor and a handover; re-confirm authority and scope with the
successor in writing within 30 days; update the map; the CSM and executive
sponsor review whether the decision path survives. Never ask staff or
students to disclose why someone left.

**Never**: rate people as supporter/detractor, infer intent from activity,
enrich with sensitive data, or contact a student for commercial reasons.

## 5. Success plan

One per account; the stored record (`success_plans`) holds `goals` (≤ 4000
characters), `risks` (≤ 4000), `next_qbr_at` and an owner. The fuller plan lives
in the project record and its summary is what is stored.

| Section | Content |
| --- | --- |
| Why they bought | the problem in their words; the decision the sponsor must make at renewal |
| Outcomes | 3–5 measures from the [adoption ladder](#2-adoption-metrics) and the pilot success plan, each with a definition card |
| Guardrails | what must not get worse: privacy, accessibility, reliability, support load, student agency |
| Milestones | the implementation phases and their dates; midpoint and final decision dates; renewal notice date |
| Owners | one named owner per outcome on each side, with backups |
| Cadence | the table in section 1, with dates in the calendar |
| Risks | the [renewal risk drivers](#6-renewal-risk-model) currently Watch or above, each with owner and date |
| Decisions needed from the customer | listed with the date each is due |
| Exit conditions | what would make the sponsor stop, and the offboarding route ([`OFFBOARDING-AND-EXPORT.md`](OFFBOARDING-AND-EXPORT.md)) |

Fit the stored `goals` and `risks` fields by writing plain sentences: outcome,
measure, target and owner for each goal; driver, trigger, owner and date for each
risk. The plan's `next_qbr_at` is always set; a plan with no date is not a plan.

## 6. Renewal risk model

A **rules-based, human-reviewed** model of renewal posture — not a prediction.
With no customers there is no outcome history to fit, so no probability, churn
rate or accuracy is stated or implied. Its job is to make sure the right
question is asked at the right time, with evidence.

### Risk drivers

| ID | Driver | Trigger (evidence, not impression) | Severity if triggered |
| --- | --- | --- | --- |
| R1 | Value not shown | an agreed outcome unmeasurable or behind range at midpoint with no credible path | High |
| R2 | No decision path | economic buyer unnamed, unreachable, or has not met for > 90 days | High |
| R3 | Single-thread | one person in the three key roles; no backup contact | Medium |
| R4 | Implementation incomplete | project not past `launch` by the agreed date, or a gate failed | High |
| R5 | Reliability / support | repeat P1 or unresolved P1 older than the agreed bound; unstaffed route | High |
| R6 | Trust / rights / accessibility | any open P0/P1, or an exception past expiry | **Critical** (override) |
| R7 | Sponsor change | sponsor or champion departed, successor not confirmed in writing | High |
| R8 | Commercial friction | overdue invoice, disputed scope, unapproved renewal terms, budget cycle missed | Medium–High |
| R9 | Scope drift | requested capability outside the order or not built; unmet exclusion | Medium |
| R10 | Capacity | the customer's own team cannot operate (operator seats without backup) | Medium |

### Posture (assigned by a person from the table above)

| Posture | Rule |
| --- | --- |
| **Clear** | no driver triggered |
| **Watch** | one Medium driver triggered |
| **Elevated** | any High driver, or two or more Medium drivers |
| **Critical** | any Critical driver, or two or more High drivers |

Each posture maps to a respectful named action, never a pressure campaign:
*Watch* → add to the success plan and agree an owner; *Elevated* → executive
sponsors meet within 14 days with a written recovery plan; *Critical* → pause the
affected scope per the override, incident process, and prepare an honest
continue / narrow / stop discussion. A customer may decline without repeated
pressure; no dark patterns, no obstruction of cancellation, export or deletion;
payment status never limits data rights.

### Renewal stages (`renewal_opportunities.stage`, outcome `pending` until decided)

The opportunity is created when the contract is signed and dated 120 days before
the term ends. Stages: `review_120`, `exec_90`, `proposal_60`, `signature_30`,
`decided`. Outcomes: `pending`, `renewed`, `expanded`, `downgraded`, `churned`.

| Stage | Required before moving on | Decision | Owner |
| --- | --- | --- | --- |
| `review_120` | health review current; posture set; value evidence compiled with caveats; notice terms and decision authority confirmed; offboarding alternative ready | proceed to a renewal conversation or begin an honest exit plan | CSM |
| `exec_90` | executive-sponsor meeting held; customer's value statement in their words; open High/Critical drivers have recovery plans | agree scope direction (renew as is, expand, narrow, stop) | executive sponsors |
| `proposal_60` | proposal using the approved pricing method; capacity and implementation needs for any new scope; any new security, privacy or accessibility review triggers identified | customer reviews terms | CF, CSM |
| `signature_30` | paper with counsel; billing set; new-scope launch gates scheduled | sign or begin offboarding | sponsors, counsel |
| `decided` | outcome recorded: `renewed`, `expanded`, `downgraded` or `churned`; reason from the approved limited taxonomy | — | CSM |

A narrow extension is **not** a final outcome in the current schema: keep the
opportunity at a non-`decided` stage with outcome `pending`, keep the signed
extension's term, purpose, price, scope and risk in the contract and decision
record, and set `renewal_date` to the new term end minus 120 days (it is the date
the review opens, not the term end). Report extensions separately from final
outcomes and unresolved no-decision records.

### Validation plan for the model itself

1. **Shadow phase.** For every account at every review, record the posture and
   its drivers; do not act on it differently from the human judgment.
2. **Outcome log.** When a renewal is decided, record the outcome and the stated
   reason against the postures that preceded it.
3. **Review.** After the first renewals, list misses (posture said Clear,
   outcome was churn; posture said Critical, outcome was renewal) and revise
   drivers and thresholds through a decision record.
4. **Claim rule.** Report posture counts and case histories as *cases*. No
   accuracy, precision or "predicts churn" claim is made until the evidence
   supports one, and then only with the sample size beside it.

## 7. Expansion triggers

Expansion means more people, more scope or more domains **under a new, authorized
order**, delivered through the same method. It is a consequence of demonstrated
value and capacity, never a quota applied to students or staff.

| ID | Trigger | Evidence required | Then |
| --- | --- | --- | --- |
| X1 | Cohort expansion — the pilot cohort met its outcome range and guardrails at the final review | final review record; sponsor request in writing | re-enter at phase 6 with a larger cohort; plan tier may move (`pilot` → `department` → `campus` → `system`) |
| X2 | Domain expansion — the customer asks for an adjacent domain already supported | design addendum; domain is `EXISTS` in the capability register | re-enter at phase 2 for that domain |
| X3 | Integration expansion — a new system the integration workbook can accept | sandbox available; adapter approved | re-enter at phase 4 |
| X4 | Department or campus rollout — the champion's unit has an advocate in another unit | second unit's sponsor and champion named | treat as a new tenant project under the same contract if the order allows |
| X5 | Operator maturity — the customer runs the tenant without Semester in the room (access reviews on time, changes with a checker, backup seats trained) | operator-health metrics | candidate for higher-autonomy configuration |
| X6 | Faculty/staff demand — role coverage rising unprompted | role-coverage metric | propose staff enablement |

**Gate before any expansion proposal** (all must hold): posture Clear or Watch;
no open P0/P1; support and implementation **capacity** credible (backups exist);
new scope is adjacent and supportable; the capability is `EXISTS`, not roadmap; a
new order or change is authorized in writing; new reviews and acceptance for the
new scope are scheduled. The health status `expansion` is set only after human
review, and the rollout state `expansion` only when the stored stage is
`expand`.

**Anti-triggers** (an expansion conversation is *not* opened): any Critical or
Elevated posture; an unresolved rights or accessibility issue; sponsor or
champion in transition; reliance on a capability that is not built; discount-led
urgency; any student-pressure or engagement-hacking tactic.

## 8. What must be built or changed (raised through the escalation loop)

| Item | Why |
| --- | --- |
| Make `compute_account_health()` fail closed to *unavailable / pending review* when sources are missing, with a test | it can currently write `healthy` when sources are absent |
| Store dimension-level evidence with each snapshot (the `signals` field has an allowlist; extend it, do not widen it silently) | components must sit beside any composite |
| An account-level stakeholder-map record with seat, backup and last-contact date, no sentiment fields | the map is currently a document |
| Surfaces for the admin implementation panel and student integration status ([`IN-PRODUCT-ENABLEMENT.md`](IN-PRODUCT-ENABLEMENT.md) E7, E9) | customers see what the CSM sees |

## Evidence state

**Repository evidence.** `implementation_projects`, `success_plans`, `qbrs`,
`renewal_opportunities` (created on signing, 120/90/60/30 stages),
`account_health_snapshots` and the nightly function exist; the proposed
dimensions and weights are documented.

**Operational evidence.** None: no customer, no health review, no renewal, no
validation of any threshold.

**Missing test/proof.** The fail-closed health function and its test; approval of
metric cards; shadow reviews across one full pilot; the first recorded renewal
outcome against its postures.

## Claim ceiling

Semester may describe this as a proposed, human-reviewed customer-success
operating model.

## Prohibited claims

Do not claim any customer is healthy or at risk; predict churn or renewal;
automate outreach or decisions; score an individual; report adoption,
satisfaction, retention, expansion or benchmark accuracy.
