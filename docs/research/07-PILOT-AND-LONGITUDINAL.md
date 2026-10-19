# 07 · Pilot feedback and longitudinal outcome measurement

This page extends, and does not replace, [`PILOT.md`](../../PILOT.md),
[`ANALYTICS.md`](../../ANALYTICS.md),
[`PILOT-SCORECARD.md`](../market-readiness/PILOT-SCORECARD.md) and
[`EXPERIMENTATION-PROTOCOL.md`](../market-readiness/EXPERIMENTATION-PROTOCOL.md).
Where they fix a definition, they win. What this page adds: the qualitative
layer, the longitudinal design, and the rules that keep a ten-person pilot from
being read as more than it is.

## What a pilot of ten can and cannot do

`ANALYTICS.md` is explicit: *"Ten people is not a sample."* One person's
fortnight abroad moves retention ten points. So the pilot is run to:

1. find what breaks for somebody who is not the author (usability, `observed-use`);
2. produce the **first** retention, activation and willingness-to-pay
   observations, which move rows in `VALIDATED.md` from "no evidence" to
   "C1 signal";
3. generate the vocabulary and hypotheses that larger studies test.

It cannot produce a rate to quote, a causal claim, or institutional demand.
Nothing from the pilot leaves research as a percentage (`MIN_COHORT = 10`).

## Measures: what exists today, what does not

The instrumentation is deliberately thin: three marks (`opened`, `course`,
`studied`) in `public.activity`, and "a fourth number needs a fourth question
written down here first." So measures are split by whether telemetry can supply
them.

| ID | Measure | Source today | Available now? | Notes |
| --- | --- | --- | --- | --- |
| M1 | Weekly active use | `activity` `opened` | **Yes** | Depth-blind; quote the definition with it |
| M2 | Legacy course-plus-study funnel | `activity` marks, 7-day window | **Yes** | Must stay labelled *legacy*; is not the controlled `student_activated` rate |
| M3 | 30-day retention band (28–34 days) | `activity` | **Yes, after day 34** | Cohorts under 34 days excluded |
| M4 | Controlled activation (`student_activated`) | Event in `STUDENT-ONBOARDING-SPEC.md` | **No** — unimplemented | Not reported until implemented, versioned, sample-validated |
| M5 | First-win (`student_first_win`) | Same spec | **No** | Same; until then measured by **moderated observation** (U1–U5 in [`04`](04-TESTING-AND-OBSERVATION.md)) |
| M6 | Perceived usefulness at the moment | In-product prompts (`lib/momentfeedback.ts`, 8 moments, capped, skippable) | **Yes** | `self-report`; aggregate only |
| M7 | Reported friction/bugs | `feedback`, `beta_feedback` | **Yes** | Self-initiated, so biased toward the vocal |
| M8 | Missed or late deadlines, self-reported | Weekly pulse (below) | **Yes, by survey** | Not from records; no grades or LMS data collected |
| M9 | Trust and privacy comfort | Termly survey + exit interview | **Yes** | Index, not a score |
| M10 | Willingness to pay (behavioural) | Pricing interviews; a paid-checkout observation only if the acquisition control permits | **Partially** — live Plus checkout exists but is held; the one purchase is the owner's acceptance run, which is not an observation | Rungs below "money" until approved ([`04`](04-TESTING-AND-OBSERVATION.md)) |
| M11 | Support burden | Support records | **Yes** | Manual, within published hours |
| M12 | Reason for leaving | Exit interview / `beta_exit_requests` | **Yes** | The most valuable single signal in a small pilot |

**No new telemetry is proposed here.** Where a question can be answered by
asking, the plan asks (pulse, interview, diary) rather than adding a fifth
tracking mark. A proposed new measure follows the `ANALYTICS.md` rule: write the
question first, then the check constraint, then the code, in that order and
in its own pull request.

**Hard exclusions.** No grades, GPA, transcripts, LMS gradebook data or
account contents are collected for research. They are T3 education records;
the research needs none of them. Outcomes are self-reported and bounded.
`BUYER-PERSONAS.md` already states *no proven causal retention/GPA outcome;
measure leading indicators first* — the plan adopts that.

## Pilot arc

| Phase | When | Participant experience | Research instruments | Evidence produced |
| --- | --- | --- | --- | --- |
| P0 Pre-register | Before invitation | — | Questions, measures, success and stop criteria, baselines method written into the study record; consent approved | The plan itself (no evidence) |
| P1 Baseline | Day 0 | Consent; onboarding; 30-min baseline interview (how deadlines are tracked now) | Baseline interview; 5-item baseline survey | `self-report` baseline; segment tags |
| P2 Early use | Weeks 1–2 | Normal use | Moment prompts; **1-question weekly pulse**; first-win observed for a subsample | `observed-use` (first-win), `self-report` |
| P3 Midpoint | Week 4–5 | 45-min interview, usage walkthrough from the participant's own device | Interview; diary (optional) | Workarounds, friction, reasons |
| P4 Exit / dropout | Week 8 or on leaving | Exit interview; offboarding per [`PILOT-OFFBOARDING-PLAYBOOK.md`](../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md) | Exit interview; M9; WTP conversation | Outcomes, reasons, willingness |
| P5 Follow-up | +1 term, if consented | 20-min check-in | Short survey; optional interview | Longitudinal panel |

**The weekly pulse is one question** ("Did anything about school slip this
week that you meant to do? yes/no, what?"), skippable, so M8 is gathered
without a tracking mark. Participation is voluntary, and non-response is
recorded as non-response, not as a negative.

**Dropouts are the richest participants.** Every participant who stops using it
is offered the exit interview; refusals are recorded. A pilot report that does
not state how many people left and why is incomplete.

## Longitudinal design

- **Panel.** Participants who consent to re-contact form a panel, followed at
  end of pilot, +1 term, +1 year. Re-contact consent is separate and revocable
  ([`08`](08-ETHICS-CONSENT-DATA-HANDLING.md)).
- **Cohorts, not just snapshots.** Each intake is a cohort with a stated
  entry date, route and segment mix; comparisons are between cohorts under
  stated differences, not pooled.
- **Staggered start for comparison.** Where more than one cohort exists, start
  them at different times (a stepped-wedge shape) so early cohorts can be
  compared with not-yet-started ones on the *same* pulse questions. This is
  the only comparison design this product can afford and it is still
  observational; wording says "differed", not "caused".
- **Attrition is reported first.** Every longitudinal table opens with how many
  were enrolled, active, lost and unreachable.
- **Time horizons.** Weeks (activation, first-win), term (planning behaviour,
  trust), year (continued use across a term boundary), post-graduation
  (alumni stage — the farthest and least evidenced claim in the audit's
  lifelong-journey thesis; start only when a cohort exists).

## Setting the numbers (the open brackets)

`PILOT-SCORECARD.md` leaves baseline and target `[REQUIRED]` for every measure.
This pack does **not** fill them with numbers, because any number written
before the baseline exists would be invented. It supplies the method:

1. **Baselines** come from P1 (first-week values and baseline interview). With
   ten people, a baseline is a description, not a statistic.
2. **Targets** are set by the owner **before P2** and recorded with a
   rationale and a *minimum practical effect*: the smallest change that would
   alter a decision. A target set after seeing data is not recorded as a target.
3. **Success criteria are decision-shaped**: "if at least X of N panel
   participants are still opening after 34 days *and* at least Y can name a
   thing they would miss, proceed to a larger cohort; else investigate the
   reasons before building more." X and Y are the owner's, set at P0.
4. **Null and negative results are archived** with the same care
   (`EXPERIMENTATION-PROTOCOL.md`).

## Guardrails that stop the pilot regardless of adoption

From the experimentation protocol and `PILOT-SCORECARD.md`: a P0/P1 incident, a
data-integrity failure, credible guardrail harm, an inaccessible variant, an
inability to honour withdrawal, or unexpected sensitive collection. Research
stops with it. Participants are told, in plain language, what happened.

## Feedback intake, triage and closing the loop

| Channel | Class | Triage | Turnaround | Closed how |
| --- | --- | --- | --- | --- |
| Moment prompts (`momentfeedback`) | `self-report` | Aggregated weekly; categories already fixed (`worked`, `unclear`, `wrong-place`, `inaccurate`, `not-ready`, `not-usable`, `too-much`) | Weekly | The log of "what changed because of it" the module already keeps |
| `feedback` / `beta_feedback` | `self-report` | Read without the sender's identity via the queue function; bug vs insight split | Weekly | Reply where the person asked for one; changelog |
| Interviews and exit | `self-report` | Atomised within 48 h ([`06`](06-RESEARCH-REPOSITORY.md)) | 48 h | Participant sees what changed ("you said / we did") at the next touch |
| Support tickets | `artifact` | Themed monthly | Monthly | Linked to insight or defect |

A theme needs five independent participants before it is called a theme
(`01`); below that it is a "single report", not a finding. Fix defects through
the ordinary release path; fix *beliefs* through the register.

## What is reported, to whom

| Audience | Gets | Never gets |
| --- | --- | --- |
| Founder / product seat | Insight register with levels; bets with kill dates | Identifiable participants |
| Council / advisers | Decision-relevant findings, with level and n of N | Recordings, verbatim identifiers |
| Pilot institution (if any) | Aggregates at n ≥ 10 under the pilot agreement | Individual-level data, quotes that identify a staff member or student |
| Public | Only claims approved through the claims register at the level `01` requires | Anything not approved |
