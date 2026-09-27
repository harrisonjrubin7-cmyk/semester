# Paid Pilot Framework

How a university pilot is chartered, run and decided. Launch-readiness
Phase 3. The rules are code in
[`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts), tested in
`pilot.test.ts`. This document gives the reasons for them.

Where this sits among the documents already on main:

| Document | Answers |
| --- | --- |
| [`market-readiness/PILOT_PLAYBOOK.md`](market-readiness/PILOT_PLAYBOOK.md) | What must be true of Semester before any pilot |
| [`operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) and `governance/deal-desk.ts` | Price, pilot credit, pilot length, and who approves a deal |
| **This document** | What each pilot must agree, and when it may move from one stage to the next |
| [`PILOT-TO-ANNUAL-CONVERSION.md`](PILOT-TO-ANNUAL-CONVERSION.md) | How a pilot becomes, or does not become, an annual agreement |

## The charter

A charter is signed before configuration starts. `charterProblems()` lists
everything wrong with one, and the pilot can't be configured until that list
is empty.

| Field | Rule | Why |
| --- | --- | --- |
| Institution, cohort | Cohort of 10–200 | Under 10 can't be reported on without identifying people (the n ≥ 10 threshold already on main). Over 200 can't be supported by hand. |
| Champion | A named role **at the institution** | A pilot without one dies quietly. A Semester employee is a sales contact, not a champion. |
| Duration | 1 month up to the deal desk's maximum (6 today) | Read from `DEAL_POLICY`, so the two can never disagree. |
| Modules | At least one | So the scope is stated. |
| Data scope | Only approved classes: account and affiliation, published catalog, what students enter, campus directory, cohort-level usage, consented support tickets | Anything else must be argued onto the list. Grades, GPA, rosters, enrollments, financial aid, health, disability, counseling, conduct, immigration, private messages, submissions, accommodations and location are refused by name. |
| Sources | Every source has an owner at the institution and a freshness commitment | A student sees where each fact came from. Someone has to answer for it. |
| Success metrics | Each has a source and a target; the baseline is measured before launch | A pilot without agreed criteria gets judged on vibes. |
| Metric level | Cohort aggregates only; "at-risk", "early alert", "per student", "GPA", "wellbeing" are refused | No pilot builds a student risk profile, even to prove itself. |
| Responsibilities | Written for both sides | |
| Support | Hours and a contact the cohort can reach | |
| Decisions | "Stop" must be one of them | If stopping isn't a real option, the criteria were decoration. |
| Conversion | The path to an annual agreement | See the conversion document. |

## The lifecycle

`discovery → configure → train → launch → hypercare → learn → decide`, one
stage at a time. `advanceProblems()` names what's missing.

| Entering | Requires |
| --- | --- |
| configure | A signed charter with no problems |
| train | The tenant configured |
| launch | Training done, support routing live, the baseline measured, and the launch council's **go** for this cohort (Phase 0's `decide()`, harrisonjrubin7-cmyk/semester#806) |
| learn | At least two weeks of hypercare |
| decide | Outcomes measured against the baseline |

The launch gate is where this ties back to Phase 0. A signed contract does not
launch a cohort. The council does.

## Where pilot records live

The charter, contacts, notes and outcomes for a real institution do **not**
live in this repository or in Semester's student database. This repository is
public, and the student database is the one thing pilot data must never
touch. Pilot records belong in the company's CRM or document store. There
they are checked against these rules before signature:
[`INSTITUTIONAL-GTM-PLAYBOOK.md`](INSTITUTIONAL-GTM-PLAYBOOK.md) explains how.

## Pricing

Nothing here sets a price. Pilot fee, credit and length come from the deal
desk, and every pilot deal goes through `review()` in
`app/src/lib/governance/deal-desk.ts`.
