# 11 · From founder-led execution to repeatable teams and processes

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — EVERY SEAT IS STILL HELD BY ONE PERSON** |
| Owner seat | `founder` (the transition is the founder's own accountable work); `operations` runs the transfer record |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`OWNER-AND-ACCOUNTABILITY-MATRIX`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md), [`LAUNCH-READINESS-COUNCIL`](../../LAUNCH-READINESS-COUNCIL.md), [`DEGRADED-MODE-MAP`](../../DEGRADED-MODE-MAP.md), [`ROLLBACK`](../../../ROLLBACK.md), [`RESTORE`](../../../RESTORE.md), [`OPERATIONAL-MATURITY`](../../operating-model/OPERATIONAL-MATURITY.md) |
| Claim ceiling | Semester may describe a plan to build a team. It may not claim a team, a rota, backup coverage or delegated authority that does not exist. Hiring, compensation, contractor classification and employment obligations are for the owner, finance and qualified counsel. |

## The problem, stated plainly

The owner matrix assigns the Founder as primary for all fifteen company-side seats, with every backup unassigned. The council holds seven of its twelve seats, all by the same person or counsel. The rollback and restore documents both call the single operator the project's standing problem, and the degraded-mode map lists "the one operator" as a single point of failure with no exercised mitigation.

That is the right shape for finding out whether anyone wants the product. It is the wrong shape for anything a customer would depend on. This page is the plan to change the shape without losing what only the founder currently knows, and without hiring ahead of evidence.

**What "repeatable" means here.** A process is repeatable when a person who is not the founder, using only the written page, produces the right result in the right time, and a second such person exists. Anything less is a founder-dependent process, however well the founder does it.

## Principles

1. **Document before you delegate.** A process nobody can read cannot be handed over. Write it down first, then hand it over.
2. **Prove it with fresh hands.** A process is transferred when someone who has never done it succeeds from the page alone.
3. **Two is the minimum.** A process with one able person is a risk, not a capability.
4. **Delegate execution first, authority second, and keep the irreversible.** Class 1 decisions stay with the founder through every stage; their *preparation* does not.
5. **Hire against evidence, not a calendar.** A role opens when a trigger fires, not when a quarter starts.
6. **Independence cannot be delegated to oneself.** Security, accessibility, privacy and counsel evidence come from qualified others; the founder never fills that gap by being busy.
7. **Heroics are a finding.** A recovery that worked only because one person stayed up all night is written up as a failure of the process.
8. **Written first.** Decisions, hand-offs and exceptions go in the record, so a new person reads the company's reasoning and does not reinvent it.

## Founder dependency inventory

Dependency types: **D** decision, **E** execution, **K** knowledge held only in a head, **A** access held only by one person, **R** relationship. Priority combines the cost of failure, how often it happens, and whether only the founder can do it.

```
Transfer priority score = failure impact (1–5) × frequency (1–5) × single-point factor (2 if only the founder can do it, else 1)
```

**Bands:** High is a score of 20 or more, or any failure impact of 5; Medium is 12 to 19; Low is under 12. Every row below has a single-point factor of 2 today.

| # | Responsibility | Seat(s) | Types | Impact | Freq. | Priority | Transfers first to |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Production deploy and rollback | `engineering` | E, K, A | 5 | 3 | 30 · **High** | Second operator |
| F-02 | Restore from backup; verify | `engineering` | E, K, A | 5 | 1 | 10 · **High** (catastrophic, rare) | Second operator |
| F-03 | Privileged access administration | `security` | A | 5 | 2 | 20 · **High** | Escrow, then second admin |
| F-04 | Incident command | `operations` | D, E, K | 5 | 2 | 20 · **High** | Trained commanders |
| F-05 | Support triage and replies | `operations` | E | 3 | 5 | 30 · **High** | Support generalist |
| F-06 | Support-access grant and revocation | `security` | D, A | 4 | 3 | 24 · **High** | Security lead, then a second reviewer |
| F-07 | Tenant configuration | `success` | E, K | 4 | 3 | 24 · **High** | Implementation lead |
| F-08 | Integration and SSO setup | `data`, `engineering` | E, K | 4 | 2 | 16 · Medium | Implementation engineer |
| F-09 | Implementation project management | `success` | E | 4 | 3 | 24 · **High** | Implementation lead |
| F-10 | Data-rights requests | `privacy` | E | 4 | 2 | 16 · Medium | Privacy operations |
| F-11 | Weekly monitoring and health sweep | `operations` | E | 3 | 5 | 30 · **High** | Support or reliability |
| F-12 | Release review and go or no-go for releases | `engineering` | D, K | 4 | 3 | 24 · **High** | Engineering lead; founder keeps launch GO |
| F-13 | Customer sponsor relationships | `success`, `founder` | R | 4 | 3 | 24 · **High** | Customer success manager; sponsor introduced early |
| F-14 | Sales discovery and demos | `founder` | R, K | 3 | 3 | 18 · Medium | Revenue lead, later |
| F-15 | Deal-desk pricing and discounts | `finance` | D | 4 | 2 | 16 · Medium | Finance seat |
| F-16 | Contract and counsel coordination | `privacy`, `founder` | R, D | 4 | 2 | 16 · Medium | Contracts operations |
| F-17 | Security questionnaires and reviews | `security` | K | 3 | 2 | 12 · Medium | Security lead |
| F-18 | Accessibility triage | `accessibility` | D, K | 4 | 2 | 16 · Medium | Accessibility lead |
| F-19 | Finance: invoicing, bookkeeping, runway | `finance` | E | 3 | 3 | 18 · Medium | Fractional finance operations |
| F-20 | Vendor management and renewals | `operations` | E | 3 | 2 | 12 · Medium | Operations |
| F-21 | Claims approvals | `founder` | D | 4 | 2 | 16 · Medium | Trained claim owners by class; founder keeps final |
| F-22 | Roadmap and product decisions | `product` | D | 4 | 3 | 24 · **High** | Product lead; founder keeps portfolio |
| F-23 | Trust and safety report handling | `trust` | E, D | 4 | 2 | 16 · Medium | T&S lead before any open surface |
| F-24 | Documentation, runbooks and knowledge | `operations` | K | 4 | 3 | 24 · **High** | Everyone; owned by operations |
| F-25 | Investor and advisor relationships | `founder` | R | 3 | 2 | 12 · Medium | Stays with the founder |
| F-26 | Hiring and organizational design | `founder` | D | 4 | 2 | 16 · Medium | Stays with the founder; hiring managers run process |

**First wave** (do first, because a failure is catastrophic or the work is constant): F-01, F-02, F-03, F-04, F-05, F-11, then F-06, F-07, F-09, F-12, F-24. The other High rows (F-13, F-22) follow in the second wave. Rare-but-catastrophic items (F-02) rank by consequence, not by frequency.

## The transfer ladder

Each process, one at a time, climbs the same ladder. A transfer is recorded in [TPL-22](templates.md#tpl-22-handoff-record) and a [delegation record](templates.md#tpl-21-delegation-of-authority-record).

| Level | Name | State | Advance when |
| --- | --- | --- | --- |
| **L0** | Founder-only | In one head | A page exists from the [runbook skeleton](templates.md#tpl-23-sop-and-runbook-skeleton), and the founder has recorded a walkthrough with its transcript |
| **L1** | Documented | A page and a recording exist | The delegate has shadowed two full cycles, asked questions, and corrected the page |
| **L2** | Shadowed | The delegate has seen it done | The delegate performs it with the founder observing, for two cycles, and passes the [fresh-hands test](07-knowledge-training-enablement.md#the-fresh-hands-test) |
| **L3** | Reverse-shadowed | The delegate does it; the founder watches | Access is provisioned least-privilege; a second person is trained; the delegate runs it alone |
| **L4** | Owned | The delegate runs it alone; the founder samples at least 10% of runs, for four weeks or three cycles, whichever is longer | Sampled runs have no gate failures; the delegate has trained the next person |
| **L5** | Improved | The delegate has improved the page and taught someone else | n/a: the process is institutional |

Rules: **never skip a level**; the **second person** is part of L3 (a transfer to one person is a new single point of failure); **authority transfers after execution**, through a signed delegation with limits ([03](03-raci-and-decision-rights.md#delegation-of-authority)); **access follows least privilege** and is time-limited until L4; a process that **regresses** (a failed fresh-hands test, a gate failure) drops one level until fixed.

## Stage promotion criteria

Evidence, not headcount. Each criterion is a record someone can open. Demotion is allowed and honest: when a criterion lapses (a rota falls below its minimum, a restore is not repeated within 180 days), the stage reverts and customer-facing commitments are adjusted at the next quarterly review.

### From Stage 0 to Stage 1 (ready to support a design-partner pilot)

| Criterion | Evidence |
| --- | --- |
| A trained second operator exists | Fresh-hands pass for deploy, rollback and restore; named in the transfer record |
| Support channel open and tested | A test message through every listed channel, answered and recorded |
| Hours approved and published, with an honest after-hours statement | Approved support policy and statement |
| Backup for support and communication named on the Semester side | Seat acceptance in writing in the private system |
| Cadence has operated | Eight consecutive weeks of weekly review records and dated monthly review |
| Restore of a real provider backup timed once by the backup operator | Restore log |
| A tabletop with the backup as commander | Exercise record |
| Counsel engaged on the contract and privacy notices | Engagement and queue entries |
| Independent accessibility evaluation commissioned | Engagement |
| Security expertise engaged (fractional or contracted) | Engagement |
| Bus factor of at least two on every first-wave process | Transfer record |
| Break-glass escrow set up and retrieval rehearsed | Rehearsal record |

### From Stage 1 to Stage 2 (ready for repeatable pilots)

| Criterion | Evidence |
| --- | --- |
| At least two live pilots, or a signed third, with gates met on each | Rollout history |
| Support and implementation leads in seat | Seat acceptances |
| An incident rota of at least four with business-hours and a tested SEV1 after-hours path | Rota and monthly pager tests for three months |
| SL1 reached for support acknowledgement and incident declaration | Eight weeks of measured attainment |
| Every tier-1 runbook exercised by someone other than the founder | Runbook headers |
| Independent security review completed and findings tracked | Report and tracker |
| First renewal or conversion run by customer success, not the founder | Decision record |
| Founder hands-on operations share at or below the Stage 1 budget | Time log |

### From Stage 2 to Stage 3 (scaled operations and commitments)

| Criterion | Evidence |
| --- | --- |
| More than ten tenants, or any contractual availability or response commitment under negotiation | CRM; contract tracker |
| A 24×7 rota of at least six trained responders with passing pager tests | Rota and tests |
| SL2 across support and incident handling | Exercise records |
| Counsel-approved SL3 language for a defined scope | Counsel record; claims register |
| A full disaster-recovery exercise with measured recovery time and recovery point | Exercise record |
| Tiered support with a measured quality system | QA and calibration records |
| Marketplace and T&S capacity meeting [08's capacity gate](08-marketplace-partner-trust-fulfillment.md#capacity-gate) where those surfaces are open | Dashboards D7 |

## Hiring triggers

A trigger is a condition that, when met, opens a role or an engagement. Thresholds are starting points to tune with measurement. Costs belong to the annual plan, set by the `finance` seat; each trigger record carries a cost field. **Form** means the arrangement to consider: *fractional* (qualified part-time external), *contract*, *outsourced*, or *employee*. Outsourcing is acceptable for capacity and never for accountability.

| Role | Trigger (any one) | First form | First 90-day objective |
| --- | --- | --- | --- |
| **Operations and support generalist** (the first backup) | The first tenant reaches `security_review`; or the founder's operations hours exceed 25 per week for two consecutive weeks; or any first-wave process has bus factor 1 while a customer depends on it | Employee or committed contract | Second operator for F-01, F-02, F-05; opens and tests the support channel |
| **Fractional security lead** | The first customer security review or HECVAT; or any [E]-labelled security gate | Fractional | Review plan; access recertification; independent review scoped |
| **Independent accessibility evaluator** | Planning for L2; required before L4 | Contract | Evaluation plan and first critical-journey test |
| **Implementation lead** | Two implementations planned at once; or a scope with SSO, LMS and roster is signed | Employee | Owns phases 1–7 for the next tenant; runs the fresh-hands test on the method |
| **Reliability or DevSecOps engineer** | The first write-enabled pilot; or an availability expectation enters a contract; or the pager rota needs a fourth person | Contract, then employee | Monitoring with delivery; rota; restore cadence |
| **Support lead and a specialist** | The staffing arithmetic gives more than 1.0 FTE; or [SL-SUP attainment](04-support-operating-model.md#support) falls below 90% for four weeks | Employee | QA system; macros; peak plan |
| **Customer success manager** | Three live tenants; or a renewal within 180 days while founder success time exceeds 20% | Employee | Health reviews; first EBR; renewal motion |
| **Finance operations** | The first invoice; or more than two deals a quarter through the deal desk | Fractional | Controls; invoicing; close |
| **Privacy operations** | More than ten data-rights requests in a month, or any tenant with minors | Fractional, then employee | Request workflow at SL1 |
| **Trust and safety lead** | Before any community or marketplace surface opens beyond report-and-refer | Employee | Queue, calibration, appeals, transparency report |
| **Partnerships and marketplace manager** | The marketplace phase 1 gate approaches; or a second partner pilot is approved | Employee | Provider and partner lifecycles |
| **Technical writer and enablement** | Stale rate above 10%; or time to a certified new hire above 90 days | Contract | Index, freshness system, training records |

A role that is *not* hired when its trigger fires is a recorded decision: the reason, the risk accepted, and the date it is next reviewed (usually the next QBR).

## Organization by stage

Planning shapes, not budgets. The company is not asked to employ every box; fractional and contract arrangements fill many.

```
Stage 0   Founder
            ├─ outside counsel
            └─ advisor (reads the notes)

Stage 1   Founder ─┬─ Operations and support generalist (second operator, support, backups)
                   ├─ Contract engineer (integrations, shared SEV1 path)
                   └─ Fractional: security lead · accessibility evaluator · counsel

Stage 2   Founder ─┬─ Operations lead ─┬─ Support lead + specialists
                   │                   └─ Reliability engineer(s) ── incident rota (4+)
                   ├─ Implementation lead ── implementation engineer
                   ├─ Customer success manager
                   ├─ Product and engineering leads
                   └─ Fractional or part-time: security · finance · privacy · T&S · writer

Stage 3   Founder / CEO ─┬─ Operations ─┬─ Support (tiers)  ─ Reliability (24×7) ─ Enablement
                         ├─ Customers ──┬─ Implementation   ─ Customer success   ─ Revenue operations
                         ├─ Trust ──────┬─ Security          ─ Privacy            ─ T&S ─ Accessibility
                         ├─ Partnerships and marketplace
                         ├─ Product and engineering
                         └─ Finance and legal coordination
```

### Where council seats go

| Seat | Stage 0 | Stage 1 | Stage 2 | Stage 3 |
| --- | --- | --- | --- | --- |
| `founder` | Founder | Founder | Founder | Founder |
| `product`, `engineering` | Founder, acting | Founder; engineering shared with the contract engineer | Named leads | Named leads |
| `security` | Vacant; Founder acting | Fractional security lead | Security lead | Security leadership |
| `privacy` | Outside counsel | Counsel; privacy operations fractional | Privacy operations | Privacy function |
| `accessibility` | Founder, acting | Independent evaluator advises; internal owner | Accessibility lead | Accessibility lead |
| `success` | Founder, acting | Generalist and Founder | Customer success manager | Customer success function |
| `trust` | Vacant | Vacant; report-and-refer | T&S lead before any open surface | T&S function |
| `data` | Vacant | Contract engineer | Integration owner | Integration team |
| `finance` | Vacant | Fractional finance | Finance operations | Finance function |
| `operations` | Founder, acting | Generalist as backup | Operations lead | Operations function |
| `champion` | The customer, always | The customer | The customer | The customer |

A seat changes holders by written acceptance in the private system and a change to the council data, per the [council's process](../../LAUNCH-READINESS-COUNCIL.md#how-a-seat-is-filled).

## The founder's time budget

Targets, to be measured with a time log ([D9.01](09-dashboards-and-indicators.md#d9-people-capacity-and-transition)). Hands-on operations means support, implementation delivery, incident handling and finance administration, not decisions.

| Stage | Hands-on operations | Customers and sales | Product and decisions | People and company |
| --- | --- | --- | --- | --- |
| 0 | Measured; aim at or below 50% | 20–30% | 20–30% | 5% |
| 1 | At or below 35% | 25% | 30% | 10% |
| 2 | At or below 20% | 25% | 35% | 20% |
| 3 | At or below 10% | 20% | 35% | 35% |

A budget exceeded by 1.5× for four weeks is red on the scorecard.

## The founder-removal test

An exercise that proves a process can run without the founder.

### Process test (monthly from the first transfer)

1. Pick one first-wave process, rotating.
2. The founder is out of the loop: no channel access, no questions, for the duration of one real run or a faithful simulation.
3. The delegate runs it from the page alone.
4. Score: **completed** (yes or no); **inside target** (yes or no); **errors** (count and severity); **questions the page could not answer** (count); **page edits needed** (count); **escalations that should not have been needed** (count).
5. **Pass:** completed, inside target, no error above minor, and every unanswered question becomes a page edit before the next run. A fail drops the process one level on the ladder.

### The dark week (twice a year from Stage 1)

For seven days the founder is unreachable and holds no tokens, calendar or channel. The company runs its cadence, its support queue, and a rehearsed incident. **Pass:** no missed weekly forum; no missed service level in scope; every Class 1 decision that arose was deferred cleanly or taken by the documented succession; no action was taken outside delegated authority; and the review at the end lists what the founder was asked for that the system should have answered.

The test is also the key-person tabletop in [05](05-incident-and-continuity.md#exercise-schedule).

## Key-person risk controls

| Control | What it is | Evidence |
| --- | --- | --- |
| **Break-glass escrow** | Credentials for the source repository, deployment, database, domain registrar, payment and email stored in a sealed vault; retrieval needs two people; rotated after any use | Retrieval rehearsal and rotation record |
| **Multi-admin accounts** | Every critical account has at least two administrators | Account list |
| **Succession matrix** | Who acts as incident commander, who may talk to customers, who may contact counsel, who may approve emergency changes, if the founder is unavailable | Written and tested in the dark week |
| **Authority if the founder is incapacitated** | Corporate-law and governance arrangements, signing authority and a trusted contact | Counsel and advisors; **requires qualified human counsel review** |
| **Recorded walkthroughs** | Video and transcript for every process at L0 | Index with transcripts |
| **Key-person insurance** | Whether it is worthwhile | Advisor and broker question; flagged, not decided here |
| **Customer introductions** | Every sponsor knows at least one other Semester contact | CRM field |
| **No sole holder** | No page, account, key, relationship or decision with exactly one holder | Dashboard D9.02 |

## What stays with the founder

Even at Stage 3 these do not delegate: company strategy and portfolio; financing and board relations; Class 1 decisions, with their *preparation* delegated; contract signature, with counsel; risk acceptance for P2 and P3 only (never P0 or P1); the hiring bar and the culture; the council's founder seat; and the final word on any public claim. Everything else becomes someone's accountable seat, with limits written in a delegation record.

## The first 12 months

Measurable exits, owner seats and the evidence that proves each.

| Window | Work | Exit test | Seat |
| --- | --- | --- | --- |
| **Days 0–30** | Complete the inventory and priority scores; write pages for the first-wave processes; record walkthroughs; set up break-glass escrow; start the time log; run the Stage 0 cadence for four weeks; engage an advisor who reads the notes | Pages exist for every first-wave process; escrow retrieval rehearsed; four weeks of cadence records | `founder`, `operations` |
| **Days 31–60** | Fill the first backup role (hire or committed contract); first-wave processes to L2; first fresh-hands tests for deploy, rollback and restore; open and test the support channel | Two fresh-hands passes; a test case answered through each open channel | `founder`, `operations` |
| **Days 61–90** | First-wave processes to L3; first founder-removal process test; commission the accessibility evaluation; engage the security lead; tabletop with the backup as commander | Eight weeks of cadence records; one process test passed; tabletop recorded | `founder`, `operations` |
| **Days 91–180** | First-wave processes to L4; next five processes to L2 or L3; real restore timed; pager test cadence starts; evaluate Stage 0 to 1 | Stage 1 criteria met or a dated list of what is missing | `founder` |
| **Days 181–270** | Stage 1 operating; first pilot readiness against [10](10-tenant-launch-risk-and-readiness.md); SL1 measured for support and incident; first dark week | One dark week passed; SL1 on two measures | `operations`, `success` |
| **Days 271–365** | Triggers for implementation and support leads reviewed; Stage 2 criteria assessed; annual plan with a stage plan | A promote, hold or demote decision recorded with evidence | `founder` |

## Risks to the transition

| Risk | Sign | Mitigation |
| --- | --- | --- |
| The founder keeps doing the work "because it is faster" | Time log shows operations above budget; delegates idle | The time budget is on the scorecard; the process test; an advisor challenges |
| A transfer to one person creates a new single point | Bus factor still 1 after a transfer | The second person is part of L3 |
| Documentation drifts | The page and the practice differ | Quarterly internal audit; the fresh-hands test |
| Hiring ahead of evidence | Roles with no work; cash burns | Triggers; quarterly review of fired and unfired triggers |
| Hiring behind evidence | Triggers fired and unmet | The scorecard shows unmet fired triggers (D1.12, D9.07) |
| Authority confusion | Delegates act beyond limits, or wait on the founder for everything | Delegation records; the RACI; the dark week |
| Culture drift | Heroics rewarded; incidents not reviewed | Blameless review; heroics logged as findings |

## Related

[01 Operating cadence](01-operating-cadence.md) · [03 Decision rights](03-raci-and-decision-rights.md) · [Handoffs H-17](handoffs.md#h-17-founder-to-delegate-process-transfer) · [Templates TPL-21 to TPL-23](templates.md) · [09 D9](09-dashboards-and-indicators.md#d9-people-capacity-and-transition)
