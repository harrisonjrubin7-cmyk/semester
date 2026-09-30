# Equity review gate

> Code: `app/src/lib/equity/` · Decision: D-159 · Reviewed 2026-09-30 by the author, as the founder acting. **Not an independent review.**

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
outcomes, because Semester collects no demographic data. No result in this
document is a measured one. `equity/disparity.ts` is the computation an
institution would use over data it chooses to collect with consent: it shows a
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

## Governance decisions still required

- **Who reviews.** The council has no equity seat and the trust and safety seat
  is vacant. Until somebody other than the author holds it, `INDEPENDENT` is
  `false` and this says so. Whether students who are disabled, first in their
  family, international or veterans are asked to read these is the owner's call.
- **Whether to collect anything.** Measuring a gap needs consented demographic
  data, which the privacy model currently avoids. Collecting it is a privacy
  decision before an engineering one, and belongs with counsel.
- **The findings above.** Q-1 and CA-1 are the two a student could be hurt by;
  each is a one-line change and a policy choice.
- **Review cadence.** Reviews are dated 2026-09-30 and due by 2027-03-31; the
  test fails after that date until they are re-read.
