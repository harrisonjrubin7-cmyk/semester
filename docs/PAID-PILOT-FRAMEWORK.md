# Paid Pilot Framework

How a university pilot is chartered, run and decided. Launch-readiness
Phase 3.

**The enforced pilot rules live in harrisonjrubin7-cmyk/semester#817**:
`pilotReadiness`, `pilotVerdict`, the buying-committee map and the decision
log in `app/src/lib/gtm/pilot.ts`, enforced again by its `gtm_pilots` tables.
That work came first. This document doesn't restate those rules. It
explains how they fit with the launch-readiness work, and lists what the
launch command asks for that #817 doesn't cover yet.

| Document | Answers |
| --- | --- |
| [`market-readiness/PILOT_PLAYBOOK.md`](market-readiness/PILOT_PLAYBOOK.md) | What must be true of Semester before any pilot |
| [`operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) and `governance/deal-desk.ts` | Price, pilot credit, the longest a pilot may run (6 months), and who approves a deal |
| #817's `docs/gtm/EXECUTION-PLAN.md` §5–§6 | The pilot plan, its readiness, and the signed decision |
| **This document** | The lifecycle, the launch gate, and what the launch command adds |
| [`PILOT-TO-ANNUAL-CONVERSION.md`](PILOT-TO-ANNUAL-CONVERSION.md) | How a pilot becomes, or doesn't become, an annual agreement |

The two length rules agree. Every pilot runs exactly 26 weeks (D-134); the deal desk allows
up to 6 months. Every pilot #817 accepts is within the deal desk's limit.

## What the launch command adds to #817's readiness check

These were proposed to #817 as additions to `pilotReadiness`. Until they
land there, they are checklist items for whoever reviews a pilot plan:

| Check | Why |
| --- | --- |
| The data scope names no forbidden class: grades, GPA, rosters, enrollments, financial aid, health, disability, counseling, conduct, immigration, private messages, submissions, accommodations, location | The command forbids each of these through generic flows. Naming the class that was asked for tells the reviewer what to remove |
| No success metric is about individual students ("at-risk", "early alert", "per student", "GPA", "wellbeing") | Outcomes are cohort aggregates. No pilot builds a student risk profile, even to prove itself |
| The cohort has at least 10 and at most 200 students | Under 10 can't be reported without identifying people (the n ≥ 10 threshold on main); over 200 can't be supported by hand |
| "Stop" is one of the possible decisions | #817's `PilotDecision` includes `stop`. The charter should say so in writing, too |

## The lifecycle

`discovery → configure → train → launch → hypercare → learn → decide`

| Entering | Requires |
| --- | --- |
| configure | A plan with no `pilotReadiness` problems, signed |
| train | The tenant configured, in sandbox data mode until production data is approved (`pilotDataMode`) |
| launch | Training done, support routing live, the baseline measured, and **the launch council's go for this cohort** (Phase 0, #806) |
| learn | At least two weeks of hypercare |
| decide | Outcomes measured against the baseline, and a signed verdict (`pilotVerdict`) |

The launch gate is where pilots connect to launch readiness: a signed pilot
plan doesn't launch a cohort, the council does.

## Where pilot records live

In #817's `gtm_pilots`, `gtm_pilot_metrics` and `gtm_pilot_outcomes`
tables, at platform scope, written only by Semester's sales role. See the GTM
playbook's note on that decision.
