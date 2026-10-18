# Semester leadership system

> **PROPOSED — NOT ADOPTED.** Nothing here binds Semester until the founder records adoption (see [Adoption](#adoption)). Legal, tax, securities, employment and insurance points are flagged `[COUNSEL]` and are not legal advice. No target, salary, price, headcount or date is decided here; where a number would be invented, the page says `[DECIDE]`.

The governance, hiring and operating-cadence system Semester needs in order to scale without making the company depend on one person's memory or willpower. It sits on top of what the repository already enforces and does not replace it.

## Map

| # | Deliverable | File |
| --- | --- | --- |
| 1 | Board composition, committees, reporting cadence, board packet | [01-board.md](01-board.md) |
| 2 | Decision rights, delegation matrix, escalation rules | [02-decision-rights.md](02-decision-rights.md) |
| 3 | OKR system, annual planning, quarterly business review, operating metrics | [03-okrs-planning-metrics.md](03-okrs-planning-metrics.md) |
| 4 | Organization design by stage | [04-organization-and-hiring.md](04-organization-and-hiring.md#part-a--organization-design-by-stage) |
| 5 | Hiring plan, competency rubric, interview loops, leveling, compensation, onboarding | [04-organization-and-hiring.md](04-organization-and-hiring.md#part-b--hiring) |
| 6 | Culture principles | [05-culture.md](05-culture.md) |
| 7 | Governance of product, AI, security, privacy, accessibility, pricing, risk, public claims | [06-domain-governance.md](06-domain-governance.md) |
| 8 | Executive communications, meeting cadence, decision log, initiative tracking | [07-communications-and-tracking.md](07-communications-and-tracking.md) |
| 9 | Business continuity and key-person risk | [08-continuity.md](08-continuity.md) |
| 10 | Twelve-month executive operating calendar | [09-calendar.md](09-calendar.md) |
| — | Templates (board cover memo, decision ask, initiative one-pager, interview scorecard) | [templates.md](templates.md) |

## Baseline: what is true today

`[FACT]` — first read from `origin/main` at `7287ddc` and **re-checked at `3aa6138`** (2026-10-04, after 139 further commits). One figure changed (claims, below); the rest held. Everything below is a repository statement, not a company record.

| Fact | Source |
| --- | --- |
| One person is the named primary for all 15 company-side seats; every backup is unassigned; no 24/7 rota | [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) |
| All 7 customer-side pilot seats are unidentified | same |
| Launch council: no seat has signed | [`LAUNCH-READINESS-COUNCIL.md`](../../LAUNCH-READINESS-COUNCIL.md) |
| Individual students: conditional go (invitation-only, unpaid). Design-partner engagement: go for non-activation only. Paid pilot: no-go. Broad enterprise sale: no-go | [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) |
| 0 of 19 scheduled proof artifacts are filed under `docs/evidence/` | [`PROOF-CALENDAR.md`](../../PROOF-CALENDAR.md) |
| 23 first-year measures: 3 measured, 4 instrumented, 16 defined; **no target set** | [`COMPANY-FIRST-YEAR-MEASURES.md`](../../COMPANY-FIRST-YEAR-MEASURES.md) |
| Public claims: 18 classified (CLM-018 was added after the first read); no unrestricted campaign approved; qualified counsel unassigned | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| Six growth and lifecycle reviewer roles (privacy, accessibility, claims, analyst, moderator, backup experiment owner) were added on 2026-10-04, all held by the same person with no backup; the matrix itself says that cannot satisfy an owner-is-not-approver rule | [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md#growth-and-lifecycle-reviewer-roles) |
| Decision log closed at D-160; new decisions are `docs/decisions/D-<pull request number>.md` | [`docs/decisions/README.md`](../../decisions/README.md) |
| Two-person rules already hold in the database for approvals, break-glass, module mode, migration cutover, school exit, legal-hold release | [`DECISION-RIGHTS.md`](../../DECISION-RIGHTS.md) |

`[UNKNOWN]` — not in the repository, and this system cannot assume them: legal entity and who the directors/managers are, ownership and IP chain (including any university claim on student-created work), runway, whether anyone besides the founder is paid, advisor roster, counsel.

**The structural problem this system exists to solve:** a company-side seat held by one person with no backup is both a continuity risk and an independence risk. The same person builds, reviews and accepts. Every section below is organised around retiring that, in the order that retires the most risk per hour spent.

## Related work already on main, and how this system fits

Three other proposals landed while this was being written. None is adopted either. Rather than add a competing authority table, this system **defers** where they already decide something and says where it differs.

| Other proposal | What it decides | How this system fits |
| --- | --- | --- |
| [CTO architecture pack](../../target-architecture/08-ORGANIZATION-AND-MILESTONES.md) (#1144) | Engineering team topology, technical hiring order, architecture review | Authoritative for engineering. Agrees hire #1 is a platform/SRE second operator. See [04](04-organization-and-hiring.md#relationship-to-the-cto-architecture-pack) |
| [Finance operating model](../../finance/README.md) | Spending approval matrix in dollars, runway triggers, hiring gates, finance board pack | **Authoritative for money.** The delegation table in [02](02-decision-rights.md#delegation-matrix) now points to its matrix instead of competing with it; board cadence is aligned in [01](01-board.md#relationship-to-the-finance-reporting-package) |
| [Data governance operating model](../../architecture/data-architecture/12-governance-operating-model.md) | Data stewardship seats and machine-checked governance KPIs | Same constraint, same answer (name an external second signature when a seat is single-held). Referenced from [06](06-domain-governance.md#privacy-and-data) |

**Where this system and the finance model still differ, and are left for the founder:** the finance model assumes budget-owner roles such as CFO, CRO and COO and a faster headcount path than the evidence triggers here would release; its "Board" approvals have no body to give them until a board exists. [F13](#founder-decisions-required) and [F14](#founder-decisions-required) ask the founder to settle both.

## Design rules

1. **Stage-gated.** A control is a one-paragraph stub until its trigger fires. Nothing is built "for when we are big".
2. **The four-question test.** Every forum, register or document must answer: *What decision does it make? What evidence does it consume? Who is accountable? When does it expire or get deleted?* Fail any one and delete it.
3. **Independence.** Nobody produces and accepts the same evidence when a second qualified reviewer is reasonably available. While there is one employee, the second reviewer is external (counsel, assessor, advisor) or a gate in code.
4. **Pre-commitment over willpower.** A solo founder cannot be their own check at 2 a.m. or in finals week. Stops are encoded as gates, calendar events and outside holders, decided in advance.
5. **Speed has a clock.** Every decision class has a deadline (see [02](02-decision-rights.md#decision-classes)). An undecided decision ages visibly and escalates.
6. **Evidence before claim.** Inherited from [`COMPANY-OPERATING-MODEL.md`](../COMPANY-OPERATING-MODEL.md): green requires an artifact; unknown is a legitimate state and is never reported as green.

**Governance budget** `[HYPOTHESIS]`: pre-seed recurring governance should cost the founder no more than about 4 hours a week, including every meeting in [07](07-communications-and-tracking.md#meeting-system). If the real number exceeds this for a month, the next QBR deletes something. Raise the budget deliberately at Seed, not by drift.

## Tags

| Tag | Meaning |
| --- | --- |
| `[FACT]` | Verified in the repository at the commit above |
| `[PROPOSE]` | A design recommendation this system makes |
| `[HYPOTHESIS]` | A number or assumption not yet validated; treat as a starting guess |
| `[DECIDE]` | The founder's decision; no default invented where a number would be |
| `[COUNSEL]` | Needs qualified legal, tax, accounting, insurance or employment review |

## Ten choices, with a recommendation each

| # | Choice | Options | Recommend | Because | Revisit when |
| --- | --- | --- | --- | --- | --- |
| 1 | Governing body now | (a) founder alone; (b) founder + written-agreement advisors; (c) early formal board | **(b)** | Advisors add independence at near-zero legal weight; a board before financing adds process without authority `[COUNSEL]` | First financing term sheet |
| 2 | Independent check while solo | advisor only / counsel only / gates in code / a mix | **Mix:** code gates for release and activation, counsel for legal-sensitive claims, an operator-advisor with a written "pause review" right | No single holder covers all seven domains | First hire who is not the founder |
| 3 | What triggers a stage change | funding / headcount / evidence | **Evidence** | Funding can arrive before the company can absorb it | Each quarter |
| 4 | First spend | engineer / designer / seller / ops | **Counsel, CPA and broker first (engagements, not hires); then a platform engineer as hire #1** | The gap list is legal authority, finance controls, then production bus-factor | Seed |
| 5 | Executive titles | hire C-suite / hire functional leads | **Functional leads; titles assigned at Series A** | Titles hired early cost equity and are hard to walk back | Series A |
| 6 | OKRs now | full OKRs / scorecard only / light OKRs | **Light OKRs: 3 objectives, 2–4 key results each, company and function level only** | Gives focus without ceremony; no individual OKRs below ~15 people | 15 people |
| 7 | Trust governance | separate AI, privacy, security, accessibility boards / one forum | **One Trust Review; domain owners keep decisions** | Five boards for one person is theatre | Series A |
| 8 | Decision records | one store / two | **Two:** `docs/decisions/D-<PR>.md` for product and engineering; controlled-system `FD-` records for legal, finance, people | Public repo must not hold privileged or personnel material `[DECIDE]` | When a controlled system exists |
| 9 | Compensation | negotiate case by case / bands by level | **Bands by level** | Equity and defensibility; fewer disputes | Seed |
| 10 | Org shape | functional / domain squads | **Functional until Seed; domain squads on demand from Series A, only for domains in a committed motion** | The audit's 12 bounded domains cannot all be staffed; unstaffed ≠ cut — they stay owned by Core | Each new committed motion |

## Founder decisions required

Each is a decision only the founder can make. Open the pull request first, then record each as `docs/decisions/D-<PR>.md` per the decision rule.

| ID | Decision | Default if undecided | By |
| --- | --- | --- | --- |
| F1 | Adopt, amend or reject this system | Not adopted | Month 1 |
| F2 | Confirm entity, governing body and who holds director/manager authority `[COUNSEL]` | Unknown; blocks board work | Month 1 |
| F3 | Name up to five advisors and open outreach (roles in [01](01-board.md#advisory-council)) | None | Month 2 |
| F4 | Nominate the interim operator for continuity ([08](08-continuity.md)) | None; continuity unmitigated | Month 1 |
| F5 | Adopt, change or replace the finance model's dollar spending matrix, or restate its tiers as a percentage of trailing monthly burn | Founder approves everything; the finance matrix's tiers are the reference | Month 2 |
| F6 | Set targets for the first-year measures (the founder owns these; nothing here sets them) | No target | Month 3 |
| F7 | Weekly capacity in hours and academic-calendar blackout weeks | Assume reduced capacity in exam windows | Month 1 |
| F8 | Stage-trigger thresholds ([04](04-organization-and-hiring.md#stage-triggers)) | Evidence triggers qualitative only | Month 3 |
| F9 | Where `FD-` records live (controlled system, not this repository) | Founder's private store | Month 2 |
| F10 | Compensation philosophy: cash/equity menu, location tiers `[COUNSEL]` | No offers made | Before first offer |
| F11 | Whether student advisory members are paid `[COUNSEL]` | Paid stipend, not volunteers | Month 3 |
| F12 | Hiring budget and the runway rule that gates it. The finance model already proposes runway triggers (12, 9, 6 and 3 months); adopt, change or replace them | No hiring until runway is stated | Month 2 |
| F13 | Which twelve months is the plan year. The finance model starts its year in November; the [calendar](09-calendar.md) locks its first plan at the end of Month 3 | Plan year starts at Month 4 | Month 2 |
| F14 | Until a board exists, who gives the "Board" approvals the finance model requires (financing, major commitments, equity grants): the founder with advisors consulted and counsel, or nobody until a board forms `[COUNSEL]` | Founder, with the consults in [01](01-board.md#reserved-matters) recorded | Month 1 |

## Professional-review queue `[COUNSEL]`

| Item | Why |
| --- | --- |
| Entity form, governing documents, who may sign | Everything in [01](01-board.md) and [02](02-decision-rights.md) depends on it |
| University policy on student-created work, use of university resources, and use of the university's name | An ownership claim by a university would invalidate any financing or institutional contract |
| Founder, employee, contractor and advisor IP assignment and confidentiality | Chain of title |
| Advisor agreements, including the "pause review" right and any equity | Authority limits; securities treatment |
| Employee vs contractor classification; paid vs unpaid student work; campus ambassadors | Employment law varies by location |
| Equity plan, valuation before option grants, vesting, founder vesting | Securities and tax |
| Director and officer duties; indemnification; D&O and key-person insurance (broker) | Personal liability |
| Durable authority/incapacity documents and successor designation | [08](08-continuity.md) |
| Notification duties for incidents; minors; student-record rules as applicable to a tenant | Incident clocks in [02](02-decision-rights.md#escalation-rules) |
| Public-claim wording in legal-sensitive categories | Already required by the claims register |

## Adoption

1. Founder opens a pull request for this folder (draft is fine), reads, and edits freely. Nothing here is precious.
2. On merge, record adoption as `docs/decisions/D-<that pull request number>.md`. Until then every page is a proposal.
3. Run [Month 1 of the calendar](09-calendar.md#month-1). That is the whole adoption plan.

**If only one page is read:** do these ten things in the first 30 days and nothing else in this folder is urgent.

1. Retain counsel, a CPA/bookkeeper and an insurance broker (engagements, not hires).
2. Fix the entity and authority facts (F2).
3. Name an interim operator and write down limited, time-bound authority (F4).
4. Put every critical account behind a second holder and an emergency recovery kit ([08](08-continuity.md#bus-factor-sprint)).
5. Open the advisor conversations (F3).
6. Create the one-page scorecard ([03](03-okrs-planning-metrics.md#operating-metrics)) with `UNKNOWN` where unknown.
7. Set three objectives for the first quarter ([03](03-okrs-planning-metrics.md#okr-system)).
8. Start the four Month 1 proof artifacts from [`PROOF-CALENDAR.md`](../../PROOF-CALENDAR.md).
9. Send the first monthly advisor note ([templates](templates.md#monthly-advisor-note)).
10. Put the first 72-hour "unplug drill" on the calendar ([08](08-continuity.md#unplug-drill)).

## Assumptions register

| Assumption | Type | Where it matters | How to validate |
| --- | --- | --- | --- |
| The founder is a full-time student with seasonal capacity swings | `[HYPOTHESIS]` | Calendar, continuity, hiring pace | Founder states hours per week by month (F7) |
| The company is or will be a corporation with a board-capable structure | `[HYPOTHESIS]` | Board plan | Counsel (F2) |
| Outside financing is a possible but not assumed path | `[HYPOTHESIS]` | Stage triggers | Founder |
| Headcount ranges per stage are directionally right for a product this broad | `[HYPOTHESIS]` | Org design | Reconcile at each stage review |
| First institutional buyers expect named owners, backups and evidence | `[FACT]` in repo claims register and owner matrix; buyer expectation itself `[HYPOTHESIS]` | Hiring order | Design-partner conversations |

## Cannot be completed from source code

Entity and authority facts, ownership and IP chain, runway and budget, advisor and counsel identities, personnel facts, compensation data, insurance, and every external approval require controlled company records and named-person confirmation. This folder can say what must be true and who must decide; it cannot establish that it is true.
