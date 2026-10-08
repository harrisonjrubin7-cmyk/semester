# Three-year company strategy

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

| Control | Value |
| --- | --- |
| Status | **DRAFT PROPOSAL — becomes the company strategy only when FD-2026-001 is approved** |
| Owner | `founder` seat |
| Evidence date | 2026-10-04, against `origin/main` at `7287ddc` |
| Horizon | 2026-10-01 to 2029-09-30, in three years that follow the academic and fiscal calendar, not the quarter |
| Next review | 2027-01-15 (first quarterly refresh; see [`SCORECARD.md`](SCORECARD.md) §6) |
| Reads with | [`README.md`](README.md) (the one-page version and the assumptions), [`BOARD-MEMO.md`](BOARD-MEMO.md), [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md), [`MOAT-PLAN.md`](MOAT-PLAN.md) |

**Labels.** Every claim below carries one: **FACT** (cites a path that exists), **DECISION** (already made and written down), **HYPOTHESIS** (believed, untested, with the test named), **ASSUMPTION `A-nn`** (a number or condition the plan leans on; listed in [`README.md`](README.md) §4), or **COUNSEL** (a matter for qualified human counsel; nothing here is a legal conclusion).

## 1. Where the company actually stands

Strategy that starts from the ambition instead of the position is a wish. These are the facts the plan is built on.

| Area | Position | Source |
| --- | --- | --- |
| Product breadth | **FACT.** 152 entries under `app/src/screens`, 1,219 test files, 171 SQL migrations at `7287ddc`. Breadth is real; the repository itself says breadth is not the same as operability | `app/`, `supabase/migrations/`, [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) |
| Customers | **FACT.** None named. No sponsor, champion, cohort, data scope, contract or launch authorization is evidenced | `LAUNCH-RISK-REGISTER.md` FR-002 |
| Revenue | **FACT.** None. ARR is a defined measure with no agreement behind it; billing is kept out of the app | [`COMPANY-FIRST-YEAR-MEASURES.md`](../COMPANY-FIRST-YEAR-MEASURES.md), D-009 |
| Motions allowed today | **FACT.** Design-partner discovery, synthetic demos and evidence exchange: **GREEN**. Invitation-only unpaid individual validation: **YELLOW**, conditional. Paid institutional pilot: **RED**. Broad enterprise sale: **RED** | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) |
| Company facts | **FACT.** Legal entity, jurisdiction, ownership/IP chain, signing authority and age posture are unconfirmed (FR-001, P0). Every legal document is a draft | `LAUNCH-RISK-REGISTER.md` |
| IP | **FACT.** A request for a written Vanderbilt ownership determination was sent in September 2026; the reply is the open item. **COUNSEL** | [`IP.md`](../../IP.md) §1 |
| People | **FACT.** 7 of 12 launch-council seats are held; the founder holds or acts in six of those seven, outside counsel holds `privacy`. Vacant: `security`, `trust`, `data`, `finance`, `champion` | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md), [`LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md) |
| Standing strategy decision | **DECISION.** Go deep at one university before wide across LMSs; no "works at any university" positioning until the Stage 4 gate. Brightspace is first because Vanderbilt uses it | [`DECISIONS.md`](../../DECISIONS.md) §1 |
| Market evidence | **FACT.** No approved TAM/SAM/SOM, no dated competitor matrix, no win/loss history, no validated willingness-to-pay | [`MARKET-SEGMENTATION.md`](../commercial/MARKET-SEGMENTATION.md), [`COMPETITIVE-POSITIONING.md`](../commercial/COMPETITIVE-POSITIONING.md), [`PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md) |
| Strategy document | **FACT.** The operating-system register lists "Company strategy" as `missing`. This package closes that gap | [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md) |

**The honest summary.** Semester has a product blueprint of unusual breadth and almost none of the evidence an institution needs to say yes: no customer, no independent security or accessibility review, no operated recovery, no staffed support, no confirmed entity. The strategy therefore does not have a growth problem to solve first. It has a **trust-and-proof problem**, and the three years are sequenced around closing it.

## 2. The thesis

> **Semester wins by being the governed layer between a student and the institution's fragmented systems: native where the institution has nothing, connected where it already has something, and accompanied by the evidence that lets an institution say yes.**

That is the founding thesis ("natively when necessary, connected when available, governed everywhere, and supported operationally") turned into a buying reason. The whole-platform ambition is preserved in the product architecture and requirements. What the strategy disciplines is **the order in which each part is claimed, sold and activated**, because that order is what separates a company institutions trust from a demo they admire.

### Five bets, each with the evidence that would falsify it

| # | Bet | Label | Falsified if | Test, owner, date |
| --- | --- | --- | --- | --- |
| B1 | **The student-controlled planning layer is the wedge.** Students adopt a tool that unifies deadlines, courses, study and campus context because it removes their own friction; institutions then pay for governance, rollout and cohort-level readiness, not for the student's attention | HYPOTHESIS | The invitation-only cohort's 28-to-34-day return rate stays under the proposed floor ([`SCORECARD.md`](SCORECARD.md) S4) after two product iterations, or fewer than half of arrivals complete the activation actions within 7 days | Invitation-only validation (gate G1); `product` seat; read at 2027-06-30 |
| B2 | **Governance is a buying reason, not a cost of doing business.** Institutions anxious about unmanaged student AI and fragmented data will prefer a vendor that arrives with consent, audit, tenant isolation and an AI control plane they can inspect | HYPOTHESIS | Three consecutive qualified procurement conversations end without governance evidence changing the buyer's view or timeline (recorded in the discovery log) | Discovery + win/loss log; `founder` seat; read at 2027-09-30 |
| B3 | **Depth defeats breadth.** One signed, operated, reference-quality deployment at one university is worth more than four half-integrations | DECISION (`DECISIONS.md` §1) | The reopening conditions in that decision fire: Vanderbilt says no or nothing for two consecutive terms; a second university invites Semester in; or self-serve demand outside Vanderbilt asks for the campus half | Tripwire review at 2027-05-31 and each term end |
| B4 | **Native-first with connectors is the architecture that survives vendor change.** An institution that switches its LMS or SIS keeps its Semester experience; a student at an institution with no integration still has a working product | DECISION (architecture; ADR-0003, `README.md`) | Native fallbacks are unused in production while connectors carry the load, or native duplicates of a system of record create reconciliation incidents | Integration freshness and reconciliation readings from the first connected cohort; `data` seat; read at 2028-03-31 |
| B5 | **Evidence compounds into a moat.** Trust artifacts (independent reviews, operated drills, a claims register that has never been caught overstating) take a competitor years of operating history to match, and they shorten every later procurement | HYPOTHESIS | Security-review cycle time does not fall between the first and third institutional review, or a procurement team asks for the same evidence again as though none existed | Security-review cycle time (first-year measure); `security` seat; read at 2028-09-30 |

## 3. Strategy on a page

| Question | Answer |
| --- | --- |
| **Where we play** | Four-year private and regional institutions first, one bounded cohort (50 to 200 students) at a time, around a registration, orientation, transfer, first-term or advising milestone. Vanderbilt first (DECISION). Public institutions, community colleges, systems and K-12 are deferred, not removed |
| **Who pays** | The institution, for governance, rollout and cohort-level readiness. Students are not charged in Years 1 and 2 (checkout is disabled by the release profile; FD-2026-005) |
| **How we win** | Neutral across the incumbents' systems; governed by default; accessible by default; implemented by method rather than custom code; and honest about what is and is not live |
| **What we will not do in three years** | Sell or imply replacement of a system of record before the replacement ladder allows it ([`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §4). Score individual students for risk. Monetise student data or attention. Build a second institution's adapters before the reopening conditions fire. Take university-administered money before the written IP determination. Describe any capability as live, secure, accessible or compliant without the evidence artifact |
| **What we will always do** | Preserve every intended capability as a requirement. Show loading, pending, offline, denied, failed, degraded and reconciled states. Keep native fallbacks for every connected capability. Treat a gate as a gate |

## 4. Segments and sequencing

Sequenced by evidence needed and risk carried, not by size. Market size is unknown (A-18); the sizing protocol is [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §7.

| Seq | Segment | Buyer | Motion | Entry gate | Window | Claim ceiling | Moves on when |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 0 | **Vanderbilt students, self-serve** (Canvas token sync, syllabus import, study, personal screens) | The student | Invitation-only, unpaid validation | G1 | 2027-Q1 onward | "An academic planning and productivity experience" (CLM-001); no outcome claims | 100 invited students, return rate read, no unresolved trust incident |
| 1 | **One Vanderbilt unit**: a first-year, transfer, honors/learning-community or advising program of 50 to 200 students | Program director and student-success sponsor, with IT/privacy/accessibility sign-off | 26-week design-partner pilot (D-134), manual or read-only data | G2 | Fall 2027 term start | "Pilot, with a named scope and named limitations" | Closeout report accepted; baseline beaten on the sponsor-agreed measures; no open P0/P1 |
| 2 | **Adjacent units at the same institution** (a second program, then a college advising office) | Dean or department head | Annual agreement for the first unit; second and third cohorts | G3 for any paid term | Spring 2028 onward | Same, plus permissioned reference | Two units live; implementation time falling; one signed annual agreement |
| 3 | **Peer institutions** (regional privates and similar, by invitation or warm introduction) | CIO/provost-delegate with student-success sponsor | Scoped discovery, then design-partner pilot | The D-§1 reopening conditions, then G2 for that institution | Scoping 2028-Q3; activation not before G3 | Same ladder, restarted per institution | Second institution live with the playbook, not custom code |
| 4 | **Institution-wide engagement layer** at a proven institution | CIO and provost | Annual platform agreement | The broad-institutional decision (FD, 2029-06-30) | Not before 2029 | Only what the repeatability evidence supports | Three scoped deployments, independent assurance current, capacity accepted |
| Deferred | Public institutions and systems; community colleges and transfer pipelines; K-12; international; family/guardian as a paid line; alumni and lifelong as an institution-sponsored module; employer and marketplace lines | Various | None | Each needs its own decision | Revisit at the 2029 annual reset | None | A recorded decision per line. **Deferred means not sold or claimed, never removed from requirements** |

**Why the order is right.** Segment 0 costs nothing from an institution, needs no permission for the student-side features (the Canvas token path reads a student's own courses), and produces the retention evidence that B1 depends on. Segment 1 is the smallest unit an institution can say yes to and the smallest in which every risk (privacy, accessibility, support, offboarding) is real. Everything later reuses what segment 1 proves.

**Why not individual students as the revenue engine.** Consumer acquisition in education carries high cost, seasonal churn and the heaviest safeguarding exposure, and the repository has already held paid individual acquisition at NO-GO. The student is the adopter and the reason the institution says yes; the institution is the payer. This is a **HYPOTHESIS** to be tested, and FD-2026-005 is where it is decided.

## 5. The three years

Each year has a name, three objectives, dated milestones with owners, a claim ceiling and a stop rule. A milestone with no evidence artifact is not a milestone.

### Year 1: earn the right to be trusted (2026-10-01 to 2027-09-30)

**Objective:** convert Semester from an impressive repository into something an institution can safely say yes to, and sign one design partner.

| # | Milestone | Owner seat | Deadline | Evidence that closes it |
| --- | --- | --- | --- | --- |
| 1.1 | Adopt this strategy (FD-2026-001) and the replacement-claim ceiling (FD-2026-011) | `founder` | 2026-10-18 | Decision records; operating-system register entry moves from `missing` |
| 1.2 | **G0, clean to engage:** Vanderbilt IP determination in writing; entity formed or its status confirmed by counsel; standing rule "no university-administered money before the determination" recorded; founder fact sheet; counsel engaged on the legal queue | `founder`, `privacy` | 2026-12-15 | Determination letter; counsel engagement record; FR-001 evidence per its remediation column |
| 1.3 | Required advisors engaged for the vacant seats (security, finance) and for registrar, higher-ed administration, procurement, accessibility and AI safety ([`ADVISORS.md`](ADVISORS.md)) | `founder` | 2026-12-31 | Signed engagement or advisory letters; seat acceptance in writing |
| 1.4 | First authorized candidate frozen: immutable SHA, hosted CI green, PostgreSQL 17 and account-sync checks | `engineering` | 2026-12-15 | Run links and retained logs (FR-009) |
| 1.5 | Restore drill, rollback rehearsal and incident exercise on the target, with an independent witness; named backups for every company-side seat | `operations` | 2027-03-31 | Dated drill records (FR-005, FR-006) |
| 1.6 | **G1, clean to validate:** exact-SHA gates, counsel-approved terms and public-policy posture, qualified accessibility review commissioned, validation support staffed, stop criteria agreed | `founder` | 2027-03-31 | The `invitation-only-individual-validation` profile passing for one named cohort |
| 1.7 | Qualified discovery: 25 conversations, 8 scored on the qualification scorecard, 2 charters drafted | `founder` | 2027-03-31 | Discovery log and scorecards ([`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §6) |
| 1.8 | Independent security assessment with clean rescan; target-tenant isolation test; qualified accessibility report and approved ACR/statement | `security`, `accessibility` | 2027-05-31 | Reports with no open launch-blocking finding (FR-003, FR-004, FR-007) |
| 1.9 | Capital: pre-seed or equivalent closed, conditional on G0 and G1 evidence (FD-2026-008) | `founder`, `finance` | 2027-05-31 | Closing documents reviewed by counsel |
| 1.10 | One design-partner charter signed: scope, cohort, data map, roles, limitations, baseline, decision date | `founder`, `champion` | 2027-06-30 | Executed charter (FR-002) |
| 1.11 | Representative UAT and baseline scorecard signed; support rota live | `product`, `success` | 2027-07-15 | Signed UAT, baseline, rota (FR-011, FR-012) |
| 1.12 | **G2, clean to activate a cohort:** the launch council's computed verdict is GO or GO WITH CONDITIONS for the named cohort | `founder` | 2027-07-31 | `decide()` output with cited evidence |
| 1.13 | First cohort live at the fall 2027 term start | `success` | 2027-09-15 | Go-live record |

**Claim ceiling in Year 1:** C1 (controlled demonstration and discovery) throughout; C2 (invitation-only validation) after G1; the cohort pilot is described as "a pilot with named scope and named limitations".
**Stop rule:** if G0 is not closed by 2027-01-31, no other Year 1 milestone proceeds and the founder reviews the strategy with counsel and advisors (FD-2026-001 reopening condition).

### Year 2: prove it repeats (2027-10-01 to 2028-09-30)

**Objective:** a measured closeout of the first cohort, a first annual agreement, and a playbook that works for a second and third cohort without custom code.

| # | Milestone | Owner seat | Deadline | Evidence |
| --- | --- | --- | --- | --- |
| 2.1 | Midpoint report on the first cohort (about week 13) | `success` | 2027-12-15 | Report against the baseline, with denominators |
| 2.2 | Annual proposal prepared from the midpoint | `founder` | 2028-01-15 | Proposal on the approved price book (FD-2026-007) |
| 2.3 | First cohort closeout (26 weeks) and a signed verdict: continue, change or stop | `founder`, `champion` | 2028-03-31 | Closeout report and decision record |
| 2.4 | **G3, clean to charge:** paid-pilot gates met for one named target, including price book, tax/accounting/payment controls and insurance | `founder`, `finance` | 2028-03-31 | `paid-institutional-manual-pilot` profile passing |
| 2.5 | Tripwire review of the Vanderbilt-first decision and, if triggered, a decision on a second institution | `founder` | 2028-03-31 | Decision record |
| 2.6 | Second and third cohorts live (at least two distinct units) | `success` | 2028-09-15 | Go-live records |
| 2.7 | First annual agreement effective at the institution's fiscal-year start (A-04) | `founder` | 2028-07-01 | Executed agreement |
| 2.8 | Independent assurance on the path (SOC 2 Type I or the equivalent chosen in FD-2026-012); annual penetration retest; ACR current | `security` | 2028-06-30 | Reports |
| 2.9 | Seed round closed, conditional on a closeout that beat its baseline (FD-2026-008) | `founder`, `finance` | 2028-06-30 | Closing documents |
| 2.10 | Implementation playbook v2: cohort 3 goes live in 45 days or fewer from charter | `success` | 2028-09-15 | Implementation-time reading |

**Claim ceiling in Year 2:** C3 (paid pilot) for the one named target after G3; a permissioned reference only with the customer's claim-specific written permission.
**Stop rule:** if the first cohort's closeout does not beat its sponsor-agreed baseline on a majority of its measures and the cause is product value rather than execution, pause expansion, run a root-cause review with the advisors, and bring a revised wedge to the board before spending seed capital.

### Year 3: make it a business (2028-10-01 to 2029-09-30)

**Objective:** several annual agreements across more than one institution, first renewals, and the repeatability evidence that decides whether the broad-institutional motion opens.

| # | Milestone | Owner seat | Deadline | Evidence |
| --- | --- | --- | --- | --- |
| 3.1 | At least 6 institutions-or-departments under annual agreement (floor 4, stretch 12; PROPOSED) across at least 2 institutions | `founder` | 2029-09-30 | Executed agreements |
| 3.2 | First renewals: at least 85% of agreements reaching term renew by count, reported with counts because n is small | `success` | 2029-09-30 | Renewal records |
| 3.3 | Second institution live through the playbook, with connector and native fallback both exercised | `data`, `success` | 2029-03-31 | Go-live and reconciliation records |
| 3.4 | Independent assurance current (SOC 2 Type II or equivalent per FD-2026-012) | `security` | 2029-06-30 | Report |
| 3.5 | Repeatability pack: three scoped deployments with measured implementation, support, capacity, isolation and recovery evidence | `operations` | 2029-06-30 | Evidence pack against GO-NO-GO priority 10 |
| 3.6 | **Broad-institutional decision:** open the motion or defer it again, on the pack | `founder` | 2029-06-30 | Decision record naming the profile (`broad-enterprise-sale`) |
| 3.7 | First native workflow at replacement rung R3 in coexistence for a named domain, if and only if the ladder's evidence exists | `product` | 2029-09-30 | Parallel-run evidence ([`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §4) |
| 3.8 | Annual strategy reset for 2029 to 2032 | `founder` | 2029-09-30 | New strategy memo |

**Claim ceiling in Year 3:** C3 broadly; C4 (broad enterprise sale) only if milestone 3.6 opens it. Replacement language remains capped by the ladder: R4 (native system of record for a named domain) is not planned inside the horizon and can be proposed at the 2029 reset.
**Stop rule:** fewer than 4 agreements, or net revenue retention below 90% on the first renewals, triggers a strategic review: narrow to the segment that retained, or reposition, before further hiring.

## 6. Expansion logic

Expansion happens on two axes, and each step has a trigger that is a reading, not a date.

**Account expansion (land, adopt, expand):** student-side adoption → one unit → adjacent units → institution-level engagement layer → peer institutions. A step is taken when the current step shows the proposed readings ([`SCORECARD.md`](SCORECARD.md)): activation and return in range, implementation time falling, no open P0/P1, and the sponsor's written willingness to continue.

**Product expansion:** the order follows `DECISIONS.md` §1, which already ordered the institutional domains: **courses, then forms, then feeds, then registration, then money.** Each domain needs a counterparty, an agreement, an adapter and a review. Domains outside the wedge (marketplace, sponsorship, campaign tooling, family as a paid line, alumni) stay behind their feature flags and their own decisions; their requirements remain in the register. Nothing is removed.

**Operating modes.** Every capability is offered in the mode the institution's situation allows, and the mode is visible to the user:

| Mode | When | Semester's role |
| --- | --- | --- |
| Native | No external system exists, or the institution wants Semester as primary | Canonical record and workflow owner for that domain |
| Connected | An authoritative system stays in place | Explicit source precedence, sync, reconciliation and user-visible provenance |
| Coexistence | The institution adopts department by department or module by module | Native in activated domains; interoperates in the rest |
| Replacement | The institution cuts over a legacy system | Only after the ladder in [`MARKET-ENTRY-PLAN.md`](MARKET-ENTRY-PLAN.md) §4 |

## 7. Defensibility in one paragraph

The defensible position is **trust that has been operated and reviewed**, a **neutral student-side layer** that no single incumbent can credibly be, **implementation method** that makes the second deployment cheaper than the first, and **governed context** (consented, tenant-bound, source-attributed) that general AI assistants cannot get without the same governance work. Data volume is deliberately not on the list: education records are institution-owned and consent-bound, so a data-hoarding moat is both legally narrow and a trust liability. The plan, with a kill criterion for each part, is [`MOAT-PLAN.md`](MOAT-PLAN.md).

## 8. Tradeoffs, stated

| Choice | Alternative not taken | What it costs | What would change it |
| --- | --- | --- | --- |
| Depth at one institution | Four LMS adapters across four prospects | If Vanderbilt fails, the institutional track restarts elsewhere (accepted in `DECISIONS.md` §1) | The three reopening conditions in that decision |
| Institution pays; student adopts | Student subscription as the revenue engine | Slower revenue; dependence on long institutional cycles (A-03) | Self-serve cohort economics proven (FD-2026-005) |
| Gate before growth | Sign a paying pilot now on the strength of the build | Roughly 11 months from today to a live cohort (G2 at 2027-07-31) | Evidence closing faster than planned; the gates can move forward, never be waived |
| External validation spend early | Spend on hiring engineers first | $0.25M to $0.55M in Year 1 before revenue (A-06, A-07) | A design partner who accepts a documented lower assurance level for a bounded, non-activation scope |
| Replacement ceiling, enforced | "Replace your LMS and SIS" positioning | Slower enterprise narrative; some buyers will want the bold claim | Parallel-run evidence plus counsel approval for a named domain |
| Stay enrolled through G2 (recommended, FD-2026-014) | Full-time founder now | Founder hours are the scarcest input; milestones are paced to that | Founder capacity test at G1 shows the Year 1 plan cannot be held |
| Native fallbacks for everything | Integrate only | Duplicated effort; reconciliation risk | The fallback goes unused in production for two terms and a connector is contractually guaranteed |

## 9. What this strategy does not know

- **Market size.** No TAM/SAM/SOM exists (A-18). Segment ranking is a hypothesis until discovery runs.
- **Willingness to pay.** No price book, no validated willingness-to-pay (A-08). Dollar figures in this package are illustrative placeholders.
- **Competitor facts.** No dated competitor matrix exists (A-17). Comparisons here are by category, never by named claim.
- **Whether Vanderbilt will say yes.** This is the single largest dependency (SR-032) and the plan does not assume the answer.
- **Founder capacity.** The plan treats founder time as the binding constraint without a measured figure (A-14).
- **Legal posture.** Entity, IP, student-record regimes, accessibility obligations, minors, contract terms and insurance all need qualified counsel. This document makes none of those conclusions.
