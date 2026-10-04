# 04 · Rituals, status reporting, escalation and decisions

> Part of the [program pack](README.md). It adds one review and one report
> format to a cadence the repository already runs, and defines what may be
> called progress. It does not replace the [operating
> rhythm](../operating-model/OPERATING-RHYTHM.md), the [launch war
> room](../LAUNCH-WAR-ROOM.md), the [proof calendar](../PROOF-CALENDAR.md) or the
> [launch-readiness council](../LAUNCH-READINESS-COUNCIL.md).

## What counts as progress

A line is a **verified outcome** only if all four hold:

1. **Evidence**: a file in the repository, a run URL, or a signed external record, that a
   stranger can open.
2. **Date and scope**: when it was produced, and what it covers and does not
   (SHA, environment, cohort).
3. **Acceptor**: the person or body who accepted it, who is not its producer where the rule says
   they must differ (the [owner matrix](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md): "the evidence producer,
   evidence acceptor, risk owner and launch decision-maker may be different
   people").
4. **A node or risk it moves**, by id, or it is not progress on this program.

Everything else is **activity**: pull requests opened, documents written, tests
added, work "in progress". Activity is reported, in its own section, labelled as
activity, and never in a headline. A merged pull request is a verified outcome
of itself (the commit exists) and is **not** an outcome for any gate unless an
`EXT` node says the artifact closes it; the queue's rule is that these gates
"cannot be closed by adding repository documents, tests, or status labels".

Words that may not appear in an outcome row: *drafted, started, in progress,
nearly, on track, ready for review*. If the row needs one of them, it is
activity.

## Cadence

The founder is the only operator today (RAID-R05), so a "meeting" here is a
written review with an output file; a review that produces none is cancelled
(the operating rhythm's own rule).

| When | Review | Input | Output | Exists already? |
| --- | --- | --- | --- | --- |
| Weekly | **Program review** (30 min, written) | the previous status report, the queue, the RAID register, `git log` and the Actions runs since | a dated `STATUS-YYYY-MM-DD.md` in this directory; RAID rows changed; decision requests raised | new; it takes the operating rhythm's "Top risks and blockers" row |
| Weekly | Product and release review; security and reliability review; customer and pipeline review | per the rhythm | per the rhythm | yes |
| Before each motion decision | **Gate review** | the motion's nodes in 02, the evidence register, the council's computed verdict | the council record; an updated claims register | council yes; the review checklist below is new |
| Monthly | Evidence and claims review | the evidence register's states for the day | renewals scheduled; claims flagged | the register computes the states; the review is the monthly operating-system register review |
| Quarterly | Proof calendar cycle; access, vendor and DR exercises | proof calendar | files under `docs/evidence/` | yes |
| Daily, once a cohort is live | War room | the thirteen war-room lines | the daily line | yes, from the day before launch |

## The weekly program review, in order

1. Recompute the day's evidence states; list everything expiring within 30 days.
2. Read `origin/main`: new merges, the latest finished CI run and its SHA.
3. For each node in 02: unchanged, moved (with the evidence), or newly blocked.
4. Walk the RAID register: any trigger met; any assumption falsified.
5. List decision requests older than one review.
6. Write the status report. Sections in this order: headline, verified outcomes,
   gates, blockers, decisions needed, risks changed, evidence expiring, activity.

## Gate review checklist (before any GO)

Applies to every motion. A single "no" is a NO-GO for that motion, which is the
repository's own conservative rule.

| # | Question | Where answered |
| --- | --- | --- |
| 1 | Is every node in the motion's closure closed by an artifact, not a status? | 02, the evidence register |
| 2 | Is each artifact bound to the SHA, environment and cohort being authorized? | the artifact; [`release-profiles.ts`](../../app/src/lib/governance/release-profiles.ts) fails closed on a mismatch |
| 3 | Is any artifact expired or inside its last 7 days? | evidence register |
| 4 | Did someone other than the producer accept every artifact that requires independence (counsel, assessor, accessibility evaluator, customer)? | owner matrix |
| 5 | Is every public and contractual claim in the motion on the claims register with an evidence row? | [claims register](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| 6 | Is any P0 or P1 launch risk open for this motion? | [launch risk register](../../LAUNCH-RISK-REGISTER.md) |
| 7 | Is a backup named for every seat the motion depends on? | owner matrix |
| 8 | Has the council computed GO, with no waived P0 or P1? | [`launchreadiness.ts`](../../app/src/lib/launchreadiness.ts) `decide()` |

## Status report standard

- One file per review, `STATUS-YYYY-MM-DD.md`, never edited after the next one is
  written, except to correct an error, and then with a dated note.
- The headline is at most three sentences and contains no activity.
- Every outcome row has evidence, date, scope and acceptor (the test refuses a row without them).
- A figure is a measurement, with its command or run in the row; an unmeasured
  figure is written "not measured".
- A section with nothing to say says "none", so silence cannot be mistaken for a
  clean week.
- The **executive page** is the headline plus the motion table and the decisions
  needed; nothing else goes to a board or sponsor.

## Escalation

The repository already holds three escalation rules; the ladder joins them.

| Level | Who | Time-box | Triggered by | Source of the rule |
| --- | --- | --- | --- | --- |
| L0 | the node's owner | working it | any open node | the queue |
| L1 | the founder, with what the item waits on | a task blocked more than one week | a blocked node | 90-day program, "Blocked tasks" |
| L1 | the founder, immediately | same day | secret exposure; cross-tenant access; data loss; a critical accessibility barrier without an equivalent path; monitoring or support unavailable; a false public or contractual claim; customer or data authority uncertain; a failed restore or offboarding; an unreviewed high-impact change | launch risk register, "Immediate escalation conditions" |
| L1 | the owning seat, then security and privacy, then the weekly review | 30, 7 and 0 days to expiry | an evidence record nearing expiry | evidence register |
| L2 | a named adviser or board observer | to be set | the founder is the owner of the blocked item, which is true of every company seat | **none today: PDR-03** |
| External | customer sponsor, counsel, assessor | per contract | a dependency in RAID-D01 to RAID-D07 slips | the paper once signed |

A stop condition in the pilot charter pauses the cohort and uses the school's
"pilot is paused" template, per the 90-day program. Nothing in this pack lets an
escalation reduce a protection: security, privacy, accessibility and data-rights
protections are not tradable for schedule, by the owner matrix.

## Decisions

- A decision is `docs/decisions/D-<pull request number>.md`, written after the
  pull request is opened, per the [decisions README](../decisions/README.md).
  The log is closed at D-160.
- This pack **requests** decisions as `PDR-nn` in the
  [RAID register](03-RAID.md#decisions-awaiting-an-owner); a request is answered
  by a D-file that cites it, never by editing the request.
- The pack's own adoption is recorded the same way, so a later review can tell what the program was
  told to do and by whom.
