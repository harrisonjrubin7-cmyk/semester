# 10 · Tenant launch risk and readiness system

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — PLANNING INPUT ONLY; THE COUNCIL'S COMPUTED VERDICT REMAINS THE ONLY WAY TO REACH GO** |
| Owner seat | `success` runs it per tenant; `founder` holds the decision seat; `operations` keeps the evidence |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`LAUNCH-READINESS-COUNCIL`](../../LAUNCH-READINESS-COUNCIL.md) and `app/src/lib/launchreadiness.ts` (`decide()`), [`RELEASE-GATES`](../../RELEASE-GATES.md), [`PILOT-TO-PRODUCTION`](../../operating-model/PILOT-TO-PRODUCTION.md), [`LAUNCH-RISK-REGISTER`](../../../LAUNCH-RISK-REGISTER.md), [`GO-NO-GO-CHECKLIST`](../../GO-NO-GO-CHECKLIST.md), [`LAUNCH-WAR-ROOM`](../../LAUNCH-WAR-ROOM.md), [`RELEASE-CERTIFICATION`](../../operating-model/RELEASE-CERTIFICATION.md), [`OPERATIONAL-READINESS-PACK`](../../OPERATIONAL-READINESS-PACK.md) |
| Claim ceiling | Semester may say it assesses each tenant's readiness against written gates. It may not say any tenant is ready, launched or supported, or that a score is an approval or an assurance. |

## What this system is and is not

The council's `decide()` function computes the verdict from gates, seats and signatures. It has no override. An open P0 or P1 blocker is NO-GO and cannot be waived. A risk acceptance can waive a P2 or P3 blocker only, must come from the founder seat, must carry an expiry and a statement of what users are told, and makes the verdict GO WITH CONDITIONS, never GO.

**This system does not replace that.** It is the *working method* that produces the evidence the council reads, and the *per-tenant* view of risk that the council does not hold. It adds: launch tiers, a scorecard to plan against, a standard hard-gate list per tier, a tenant risk register, a countdown, post-launch monitoring and stop-the-line rules. A score never turns a NO-GO into a GO.

## Evidence labels

At Stage 0 one person produces most evidence. Every gate and score therefore names *who produced the evidence*, so internal evidence is never mistaken for independent assurance.

| Label | Meaning | Examples |
| --- | --- | --- |
| **[I] Internal** | Produced by Semester staff | Repository tests, internal UAT, runbook run |
| **[E] External qualified** | Produced by an independent qualified party | Penetration test, accessibility evaluation by a qualified evaluator, counsel's written review, accounting advice |
| **[C] Customer-accepted** | Signed or accepted by the customer's named authority | UAT sign-off, security review acceptance, go-live approval |

A gate that requires [E] or [C] stays open however much [I] evidence exists. The founder cannot be their own assessor, counsel or customer approver ([owner matrix](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)).

## Launch tiers

A tenant launches in tiers, each earning the next. The tier names map to the stored rollout states; the state machine is authoritative.

| Tier | What it means | Rollout state | Typical stage of Semester | Minimum score |
| --- | --- | --- | --- | --- |
| **L0** | Individual invitation-only validation; no tenant | — | 0 | n/a; its own gates in [`GO-NO-GO-DECISION`](../../../GO-NO-GO-DECISION.md) |
| **L1** | Non-activation design-partner scoping and sandbox | `requested` → `sandbox_uat` | 0 | 40 |
| **L2** | Pilot, read-only: a production cohort reads approved sources | `pilot_read_only` | 1 | 70 |
| **L3** | Pilot, write-enabled: separately approved scoped writes | `pilot_write_enabled` | 1–2 | 80 |
| **L4** | Production, limited cohort or campus | `production_limited` | 2 | 85 |
| **L5** | Production, tenant-wide | `production_active` | 2–3 | 90 |
| **L6** | Expansion to a new department, campus or module | `expansion` | 2–3 | 90, repeated for the new scope |

A tier is entered only when every hard gate for it is met, the score reaches the minimum, no dimension is below its floor, and the council has a signed decision. Stepping *down* a tier needs no evidence: reducing authority is always allowed.

## The readiness scorecard

Ten dimensions, weights summing to 100. Each is scored 0 to 4 on the evidence it actually has.

| Score | Evidence standard |
| --- | --- |
| **0** | Nothing |
| **1** | Designed: written, with an owner |
| **2** | Built and tested in the repository or sandbox [I] |
| **3** | Operated in the target environment and accepted by the customer's named owner [I] + [C] |
| **4** | Independently verified or exercised, and accepted [E] + [C] |

```
Readiness score = Σ over dimensions of weight × (score ÷ 4)
```

| # | Dimension | Weight | What a **3** requires | What a **4** adds | Floor at L2 / L3+ |
| --- | --- | --- | --- | --- | --- |
| 1 | **Critical journeys and fit** | 15 | The tenant's chartered journeys run end to end on production-like data in UAT; success measures defined | A second cohort or rehearsal run with no defects | 2 / 3 |
| 2 | **Security and tenant isolation** | 15 | Isolation tests pass for this tenant including queues, search, cache, storage, support tools and AI retrieval; least-privilege access issued; secrets handled | Independent penetration test or review of the scope | 3 / 3 |
| 3 | **Privacy and data governance** | 10 | Data map approved by the customer's data owner; minimum data; retention, export and deletion drilled for this tenant | Counsel's written review of notices and terms for the tenant's profile | 3 / 3 |
| 4 | **Accessibility** | 10 | In-scope critical journeys tested manually with assistive technology; defects triaged; alternate routes documented | Qualified independent evaluation | 2 / 3 |
| 5 | **Integration and data quality** | 10 | Sources mapped with precedence; reconciliation passing; degraded mode proved by disabling each connector | Seven consecutive clean days in production-like use; customer IT sign-off | 2 / 3 |
| 6 | **Reliability, recovery and capacity** | 10 | Rollback and restore rehearsed for this tenant's scope; monitoring with alert delivery to a named person tested; peak load modelled | A timed restore of a real provider backup; load test at the cohort's peak | 2 / 3 |
| 7 | **AI safety and governance** | 5 | Evaluation suites passed for each enabled route; kill switch tested; tenant AI policy set | Red-team scenarios run and filed | 2 / 3 |
| 8 | **Support, incident and people** | 10 | Named, trained primary and backup on both sides; support routing live and tested; incident contacts tested; tabletop run | Pager test passed; customer desk resolving first-line cases | 3 / 3 |
| 9 | **Training, adoption and change** | 5 | Role-based training complete; communications approved; baseline frozen | Sponsor and champion actively running the plan | 2 / 3 |
| 10 | **Governance, commercial and legal** | 10 | Charter signed; stop is a possible decision; price and scope inside the deal desk; claims all registered | Counsel's written approval of the contract and data terms | 3 / 3 |

If a dimension is out of scope (for example no AI), record that and renormalize the remaining weights to 100; a silent zero is a finding.

### Worked example (fictional tenant, illustrative only)

Scores 3, 3, 3, 2, 3, 2, 3, 2, 3, 3 across the ten dimensions:

`15×3/4 + 15×3/4 + 10×3/4 + 10×2/4 + 10×3/4 + 10×2/4 + 5×3/4 + 10×2/4 + 5×3/4 + 10×3/4`
`= 11.25 + 11.25 + 7.5 + 5 + 7.5 + 5 + 3.75 + 5 + 3.75 + 7.5 = 67.5`

67.5 is below the L2 minimum of 70. The tenant stays at L1. The lowest-value work is the three dimensions at 2 that are also near their floors: accessibility, reliability and support. The score points at the work; it does not grant the tier.

## Hard gates

A hard gate is met or not met. **Any unmet gate for the target tier is NO-GO**, whatever the score. The labels say who may produce the evidence. A ✓ means the gate applies at that tier and above.

| ID | Gate | Evidence by | L1 | L2 | L3 | L4 | L5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HG-01 | Customer sponsor and champion named, each with written acceptance | [C] | ✓ | ✓ | ✓ | ✓ | ✓ |
| HG-02 | Signed charter and RACI; *stop* is a possible decision in writing | [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-03 | Approved data scope with no forbidden class; data-processing route executed as counsel advises | [C] [E] | | ✓ | ✓ | ✓ | ✓ |
| HG-04 | Tenant isolation proved for this tenant since it entered its current state | [I] | | ✓ | ✓ | ✓ | ✓ |
| HG-05 | Single sign-on verified; role mapping accepted by customer IT | [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-06 | No open P0 or P1 defect, case or blocker | [I] | ✓ | ✓ | ✓ | ✓ | ✓ |
| HG-07 | Accessibility evidence for in-scope critical journeys, with assistive technology | [I] now; [E] before L4 | | ✓ | ✓ | ✓ | ✓ |
| HG-08 | Support routing live and tested; named primary and backup on both sides | [I] [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-09 | Rollback and restore rehearsed for this tenant's scope; for writes, rollback of the write path rehearsed | [I] | | ✓ | ✓ | ✓ | ✓ |
| HG-10 | Monitoring and alert delivery to a named person tested | [I] | | ✓ | ✓ | ✓ | ✓ |
| HG-11 | Official-source fallback and degraded mode proved by disabling each connector | [I] | | ✓ | ✓ | ✓ | ✓ |
| HG-12 | Reconciliation passing for seven consecutive days; source precedence signed | [C] | | | ✓ | ✓ | ✓ |
| HG-13 | Incident-communication contacts named by the tenant and tested | [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-14 | Required roles trained | [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-15 | Baseline measured and frozen; no success measure about an individual student | [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-16 | Every statement to be made about this tenant is in the claims register; no named-customer claim without written permission | [I] [C] | ✓ | ✓ | ✓ | ✓ | ✓ |
| HG-17 | Qualified counsel reviewed the contract and the privacy notices for the tenant's jurisdiction and age profile | [E] | | ✓ | ✓ | ✓ | ✓ |
| HG-18 | If AI is in scope: evaluation suites passed and kill switch tested | [I] | | ✓ | ✓ | ✓ | ✓ |
| HG-19 | For any tier processing education records: independent security review, or the customer's written acceptance after being told it is absent | [E] or [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-20 | Exit path agreed: export format, retention, deletion evidence | [C] | | ✓ | ✓ | ✓ | ✓ |
| HG-21 | A trained second operator exists for restore, rollback and incident command | [I] | | | ✓ | ✓ | ✓ |
| HG-22 | Staffed coverage matches the hours the customer has been told | [I] [C] | | ✓ | ✓ | ✓ | ✓ |

HG-08 already requires a named backup for support and communication at L2, so a company with no backup cannot reach L2: that is the owner matrix's existing rule, applied per tenant. HG-21 adds a trained *technical* second operator before any write path or production tier. Whether to attempt a pilot at all while the company is still at Stage 0 is a founder decision made against the [stage promotion criteria](11-founder-to-team-transition.md#stage-promotion-criteria), not a gate on this page.

## The tenant risk register

Every tenant has one register, opened at discovery ([TPL-20](templates.md#tpl-20-tenant-risk-register-entry)) and read at the weekly delivery review. It sits beside the company risk register ([`RISK-GOVERNANCE`](../../operating-model/RISK-GOVERNANCE.md)); it does not replace it.

### Scoring

| Field | Scale |
| --- | --- |
| **Probability** | 1 rare · 2 unlikely · 3 possible · 4 likely · 5 expected |
| **Impact** | 1 negligible · 2 minor · 3 moderate · 4 major · 5 severe (harm to people, exposure, integrity, loss of the relationship) |
| **Exposure** | Probability × Impact |
| **Velocity** | Days from trigger to impact: slow (over 30), medium (7–30), fast (under 7) |
| **Class** | P0, P1, P2, P3 by the council's rule, below |

| Class | Test | Waivable? |
| --- | --- | --- |
| **P0** | Active or likely exposure, cross-tenant access, destructive integrity loss, or imminent safety or rights harm | Never |
| **P1** | Core workflow unavailable, major accessibility barrier, or serious integrity or reliability risk | Never |
| **P2** | Pilot-quality risk with a workaround | By the founder seat, with a reason, a user disclosure and an expiry |
| **P3** | Improvement backlog | By the founder seat |

Exposure of 15 or more is reviewed weekly with the founder; 20 or more is a standing agenda item until mitigated. Exposure never reclassifies a P0 or P1 downward.

### The standard starting register

Every tenant begins with these and adds its own.

| ID | Risk | Typical trigger | First mitigation |
| --- | --- | --- | --- |
| TR-01 | Sponsor or champion leaves or disengages | Role change; missed meetings | Name a deputy at kickoff; sponsor meeting cadence; escalate on two misses |
| TR-02 | Single-person dependence at Semester | Founder is the only operator | Disclose in the charter; second operator before any write path; runbooks exercised |
| TR-03 | SSO claim or role mapping error | Wrong role at first login | Dry run with test accounts; staged cohort; mapping version control |
| TR-04 | Roster or source data quality | Duplicates; missing terms; stale feed | Reconciliation report; exception queue; source precedence signed |
| TR-05 | Launch collides with a freeze window | Term start; registration; finals | Calendar overlay; move the date, not the gate |
| TR-06 | Scope creep or an unsupported expectation | A request for replacement or an unavailable module | Charter; change order; the no-fit list |
| TR-07 | Procurement or legal delay | Review queue backlog | Parallel review; start at discovery; counsel items in the queue |
| TR-08 | Accessibility barrier on a critical journey | UAT with assistive technology | Alternate route; remediation plan; hold if no alternate |
| TR-09 | AI output outside policy | Wrong or unsafe answer; data-scope breach | Tier gating; evaluation; kill switch; tenant policy |
| TR-10 | Peak capacity | Registration or deadline spike | Load model; headroom; freeze; peak plan |
| TR-11 | Integration vendor change | API or credential change at the school's vendor | Change notice route; contract tests; degraded mode |
| TR-12 | Customer support desk untrained | Cases land on Semester | Train; macros; self-sufficiency measure |
| TR-13 | Baseline not frozen or measure wrong | Outcome cannot be shown | Freeze at gate; measure review with the sponsor |
| TR-14 | Adoption lag | Low activation after week 4 | Adoption actions; champion plan; no expansion until fixed |
| TR-15 | Minors or age-profile surprise | Under-18 users appear | Age-aware policy; counsel; guardian rules |
| TR-16 | Write-path error | A wrong or duplicate official write | Read-only first; idempotency; reconciliation; rollback rehearsed |
| TR-17 | A claim or reference leaks | A public statement beyond permission | Claims register; permission in writing; communications approval |
| TR-18 | Renewal and budget | The pilot ends with no funded path | Renewal clock from kickoff; EBR at T-120 |
| TR-19 | Support coverage gap | Out-of-hours failure with no responder | Hours statement; tested SEV1 path; disclosed limits |
| TR-20 | Vendor outage in the stack | Database, hosting or model provider incident | Degraded modes; continuity plan; status route |

## The countdown: T-90 to T+90

**T0** is the day the cohort first has access. The council decision falls at T-3 and nothing is sent to the cohort until a signed GO. Standard scope; integration-heavy scope moves the dates and never the gates. The method's phases are in [02](02-implementation-methodology.md).

| When | Milestone | Owner seat | Evidence |
| --- | --- | --- | --- |
| **T-90** | Qualified; sponsor and champion named; term and freeze calendar known; counsel queue entry made | `founder` | Qualification record; calendar |
| **T-60** | Kickoff; charter signed; tenant register opened; baselines agreed | `success` | Charter [C] |
| **T-45** | Design approved; data-flow map; security and privacy package out | `success`, `security` | Package; customer receipt |
| **T-30** | Sandbox configured; SSO and sources integrated; mapping versions set | `engineering` | Configuration export; verification |
| **T-21** | UAT begins by role; isolation, accessibility and rights tests run | `operations` | Test results |
| **T-14** | UAT exit; defects triaged; training delivered; rollback, restore and incident rehearsals done; tabletop with the customer's contacts | `success`, `operations` | Rehearsal records [I] [C] |
| **T-10** | Readiness score computed; claims checked; staffing roster confirmed | `success` | Scorecard |
| **T-7** | Council pre-read circulated; freeze check; communications drafted | `success` | Pre-read; drafts |
| **T-3** | Council decision; customer launch approval | `founder`; customer | Decision record [C] |
| **T-1** | Launch-eve smoke; roles on shift; contacts confirmed; stop controls checked | `operations` | Checklist |
| **T0** | Cohort access; three health sweeps; war-room open for the first day ([`LAUNCH-WAR-ROOM`](../../LAUNCH-WAR-ROOM.md)) | `operations` | Hypercare log |
| **T+1** | 24-hour review | `operations` | Review note |
| **T+7** | Week-one review; reconciliation seven-day check | `success` | Review note |
| **T+14** | Hypercare exit test ([02](02-implementation-methodology.md#phase-8--hypercare)) | `operations` | Exit record |
| **T+30** | 30-day review: lessons, risk re-score | `success` | Review; updated register |
| **T+60** | Mid-pilot scorecard against baseline | `success` | Scorecard |
| **T+90** | 90-day review; decision on next tier or hold | `founder` | Decision record |

## Launch-day operating plan

| Item | Rule |
| --- | --- |
| Roles on shift | Incident commander, technical lead, customer lead, support lead; at Stage 0 the Founder holds them and the compensating controls of [05](05-incident-and-continuity.md#roles) apply |
| Check-ins | Start, +2 hours, +4 hours, end of day; each has a written status |
| Communication | Pre-approved launch notice, status page armed, support macros loaded |
| Freeze | No other change on the tenant; no deploy touching its journeys |
| Stop controls | Per-tenant flag, read-only switch and pause, each tested the day before |
| Close | End-of-day review and a handoff note for the next morning |

## Post-launch monitoring and stop-the-line

### Monitoring windows

| Window | Watch | Owner |
| --- | --- | --- |
| **First 24 hours** | Sign-in success, activation, error and denial rates, reconciliation, support queue, status | `operations` |
| **First 7 days** | The above plus connector health, freshness, accessibility reports, early adoption, sponsor and champion feedback | `operations`, `success` |
| **30 days** | Habitual use, resolution attainment, self-sufficiency, QA, incident count, readiness re-score | `success` |
| **90 days** | Outcome against baseline, renewal risk, risk register state, lessons | `success`, `founder` |

### Stop-the-line triggers

Any of these moves the tenant down the rollback ladder without waiting for a meeting.

| Trigger | Action |
| --- | --- |
| Any SEV1 | Contain; step to read-only or pause; council informed at once |
| Any isolation or authorization failure | Suspend the affected path; SEV1 with `EXPOSURE` |
| Two SEV2 incidents in seven days | Hold any expansion; root-cause review before the next step |
| Reconciliation mismatch beyond the contract tolerance, or any unexplained write | Pause writes; read-only; reconcile against the authoritative source |
| Accessibility blocker on a critical journey with no alternate route | Provide the alternate route or hold the cohort step |
| P1 case older than two days, or support backlog beyond tier | Pause new onboarding on this tenant |
| Error-budget burn above 2× on a tenant journey | Freeze changes; fix reliability first |
| Sponsor withdraws, or the tenant's own authority changes | Pause; reset the charter |
| Activation under half the charter target at week 4 | Adoption intervention; no expansion |
| A claim or reference made beyond permission | Withdraw; review communications |

### The rollback ladder

1. Disable the tenant's feature flag for the affected capability.
2. Step to **read-only**.
3. **Pause** the tenant (limited read, export and remediation remain).
4. **Suspend** (support, export and remediation only).
5. **Offboard** ([`SCHOOL-OFFBOARDING`](../../SCHOOL-OFFBOARDING.md)).

Stepping down needs no evidence. Stepping back up requires the evidence recorded *since the tenant entered its current state*; the database refuses anything else.

## The go or no-go record

[TPL-07](templates.md#tpl-07-go-live-readiness-review-and-decision-record) holds the form. A decision record contains: tenant and tier; the fresh `decide()` result (a verdict from last week is not valid); every hard gate with its evidence link and label; the scorecard and any dimension below its floor; every open risk by class; each acceptance in force with owner, reason, user disclosure and expiry; the support roster for the first 14 days; the communications approved; the rollback and stop controls; each seat's signature *for this decision* (a signature is valid only for the decision it was given for); and the customer's approval.

Outcomes: **GO**, **GO WITH CONDITIONS** (each condition's disclosure goes to the cohort before launch; each expiry is on the weekly agenda; an expired unfixed condition is NO-GO on its own), or **NO-GO** with a dated remediation plan. A NO-GO is a normal result of an honest process.

## Rehearsals and tabletop before launch

Before L2 and each later tier: three scenarios from the [tabletop list](05-incident-and-continuity.md#tabletop-scenarios), at least one run *with the customer's incident and support contacts*; a rollback of this tenant's configuration; a restore of its data scope into an isolated project; a data-rights request end to end; and a communications drill. Each is recorded with time taken and gaps, filed as evidence.

## Ongoing review

| When | What |
| --- | --- |
| Weekly during implementation and hypercare | Register and scorecard at the tenant delivery review |
| Monthly after launch | Register, health score and renewal risk at the customer health review |
| On any trigger | Re-score at once: a new integration, a new cohort, an incident, a key-person change, a policy change, a freeze window arriving, an AI route change |
| At the T+30 and T+90 reviews | Lessons logged; this page and the templates updated by pull request |

The tenant [health score](../../commercial/CUSTOMER-HEALTH-SCORE.md) answers *is this customer well served and likely to continue*; the readiness score answers *is this tenant safe to move to the next tier*. They are read together and are not the same number.

## Measures

| Measure | Target (SL0) |
| --- | --- |
| Tenants launched with every hard gate for the tier met | 100% |
| Launches proceeding without a signed council decision | 0 |
| Acceptances in force past expiry | 0 |
| T+30 reviews held on time | 100% |
| Stop-the-line triggers acted on inside one business day | 100% |

## Related

[02 Implementation method](02-implementation-methodology.md) · [Templates TPL-07, TPL-20](templates.md) · [Handoff H-05](handoffs.md#h-05-implementation-to-the-launch-council) · [09 D3](09-dashboards-and-indicators.md#d3-implementation-and-adoption)
