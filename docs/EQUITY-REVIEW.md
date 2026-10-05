# Equity review gate

> Code: `app/src/lib/equity/` · Decision: D-1019 · Reviewed 2026-09-30 by the author; Harrison Rubin, the owner, is the named reviewer of the findings. **Not an independent review**: he is also the founder and directs the work.

Semester ranks, recommends, matches and routes: what to do first, which study
session, which mentor, which report is read next. Each of those is a decision
made for a person. This is the written review of every one in the tree, and the
gate that stops a new one arriving without one.

## What the gate checks

`equity.test.ts` scans `app/src` for every exported function named `rank`,
`rankItem`, `recommend`, `recommendJourney`, `recommendLearningActivity`,
`triage`, `matchMentors`, `orderQueue`, `suggest`, `ordered` or `order`. Each
must have a review in `equity/reviews.ts` or an exemption with its reason. A
review must answer who is affected, what it reads, who could be left behind,
how a person disagrees, where the reason is shown, and how anyone would know it
was unfair. It fails if a review lists a forbidden input: the community feed's
own `FORBIDDEN_SIGNALS` plus the brief's protected characteristics, inferred
motivation, intelligence, wellness or risk, income proxies and paid placement.

## What it does not do

It gates **registration and what a surface reads**. It does not measure
outcomes: no demographic data reaches this code. No result in this
document is a measured one. The owner says some demographic data is collected
(see below). `equity/disparity.ts` is the computation to use over data
collected with consent: it shows a
group's rate only when the group, those who acted and those who did not all
clear the floor of ten, and computes a gap only when every group is shown. It
says nothing of cause or significance, and nothing feeds it today.

## The surfaces

| Review | Surface |
| --- | --- |
| `lib/actions.ts#rank` | The Action Center |
| `lib/journeys.ts#recommendJourney` | Which journey first |
| `lib/learning-loop.ts#recommendLearningActivity` | Which study activity |
| `lib/study-readiness.ts#recommend` | The next short session |
| `lib/revise.ts#rank` | Units worth an evening |
| `lib/toolkit/recommend.ts#recommend` | Workspaces to offer |
| `lib/suggest.ts#suggest` | Fellowships in season |
| `lib/launchpad.ts#matchMentors` | Mentor matching |
| `lib/behind.ts#triage` | What to do first in a bad week |
| `lib/toolnow.ts#suggest` | Tools this fortnight asks for |
| `lib/triage.ts#orderQueue` | The order of open assignments in the assignment states list |
| `community/feed.ts#rankItem` | The community feed |
| `community/moderation.ts#triage` | Safety triage of reports |
| `lib/moderation.ts#ordered` | The moderators' queue order |
| `lib/call.ts#ordered` | The call gallery order |
| `lib/dining/service.ts#orderQueue` | The dining staff queue |

Five more match the names and rank no person or opportunity (a chart-type guess,
a pivot guess, the student's own files, saved section order, the student's own
applications); each is exempt with its reason in the code.

## Open findings

Nothing here changes a surface's behaviour. Each is an item with an owner.

| Finding | What |
| --- | --- |
| A-1 | Action Center confidence: institution-verified 10, student-entered 7, a small edge that follows the school and not the student. |
| S-1 | Study-readiness breaks ties on self-rated confidence, which differs between students for reasons unrelated to knowing the material. |
| F-1 | The fellowship list is shipped data with no stated selection criteria. |
| M-1 | Mentor ties fall to alphabetical order by name. |
| T-1 | Tool suggestions match English title words only. |
| C-1 | No measure of how often a safety protection is lifted on review. |
| Q-1 | The moderators' queue is newest first within a status, so the oldest open reports are read last. |
| CA-1 | Camera-off participants sink below camera-on ones in the call gallery. |
| O-1 | The assignment order adds a point for institution-verified dates and removes one for dates that need review, a bounded tilt toward better-integrated institutions (the same shape as A-1). |

## Governance decisions

Decided by the owner, Harrison Rubin, on 30 September 2026:

- **Who reviews.** Harrison Rubin reviews the findings. He is also the founder,
  so `INDEPENDENT` stays `false` and this says so. The council has no equity seat
  and the trust and safety seat is vacant. Whether students who are disabled,
  first in their family, international or veterans are also asked to read these
  is still his call.
- **Demographic data.** The owner states that some demographic data is
  collected. **This repository cannot confirm it.** It has no code, schema,
  consent text or privacy-impact row for it, and `institution-ops.ts` defines
  the `equity_gap` figure only over cohorts that consented to demographic
  reporting. So no gap is measured here, and this review reads nothing. Before
  any is: name what is collected and where, record the consent, add its
  privacy-impact row, and feed only aggregates through `disparity.ts`, which
  hides any group under ten. Anything that says Semester collects no
  demographic data, here or in public text, needs his check against what is
  actually collected.

Still open:

- **The findings above.** Q-1 and CA-1 are the two a student could be hurt by;
  each is a one-line change and a policy choice.
- **Review cadence.** Reviews are dated 2026-09-30 and due by 2027-03-31; the
  test fails after that date until they are re-read.
