# Program pack

The integrating layer over work that already exists: one dependency graph and
critical path, one RAID register, a status standard that counts only verified
outcomes, and the tenant launch coordination plan. It is written for whoever
runs the program, and it is deliberately thin. Where a register already holds
the answer it links to it; the test fails when this pack names a row that is
not there.

**Status:** proposal, 2026-10-04. It records no decision and closes no risk. Its
adoption is a decision for the owner ([PDR list](03-RAID.md#decisions-awaiting-an-owner)).

## Why it exists

The repository holds many registers and no one view across them. On 2026-10-04
there were 73 open pull requests, 29 merges to `main` since 3 October 00:00 CT, 18 external
evidence items and a launch risk register, and nothing that said which of them
sets the date. The answer, computed from the repository's own estimates, is
that no engineering work does: the paths begin at nodes nobody has sized and run
through outside parties ([02](02-DEPENDENCIES-AND-CRITICAL-PATH.md)).

## Contents

| Page | What it holds |
| --- | --- |
| [01 Master roadmap](01-ROADMAP.md) | two tracks, eight gate-defined stages, ten workstreams across them |
| [02 Dependencies and critical path](02-DEPENDENCIES-AND-CRITICAL-PATH.md) | 27 nodes, four motions, the path, the graph; machine-checked |
| [03 RAID register](03-RAID.md) | launch risks mapped to nodes; delivery risks, assumptions, issues, outside dependencies, decisions awaiting an owner |
| [04 Rituals, status, escalation, decisions](04-RITUALS-STATUS-ESCALATION.md) | what counts as progress, the weekly review, the gate-review checklist, the escalation ladder |
| [05 Acceptance and evidence](05-ACCEPTANCE-AND-EVIDENCE.md) | per-workstream acceptance criteria; what exists and why it does not yet close a gate |
| [06 Tenant launch and follow-up](06-TENANT-LAUNCH-AND-FOLLOW-UP.md) | the 90-day tasks mapped to the nodes; who signs what; stop conditions; follow-up cadence |
| [Status 2026-10-04](STATUS-2026-10-04.md) | the first report |
| [Status 2026-10-04, second](STATUS-2026-10-04-2.md) | an out-of-cycle update after `main` moved; the weekly report is due 2026-10-11 |

## What this pack stands on, and does not replace

| Concern | Controlling document |
| --- | --- |
| Motion decisions | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) |
| Launch risks | [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) |
| External evidence | [`EXTERNAL-EVIDENCE-QUEUE.md`](../finalization/EXTERNAL-EVIDENCE-QUEUE.md) |
| Dated evidence and expiry | [`EVIDENCE-REGISTER.md`](../EVIDENCE-REGISTER.md) |
| Owners | [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) |
| Controlled-launch tasks | [`90-DAY-LAUNCH-PROGRAM.md`](../90-DAY-LAUNCH-PROGRAM.md) |
| The go/no-go computation | [`LAUNCH-READINESS-COUNCIL.md`](../LAUNCH-READINESS-COUNCIL.md) |
| Target architecture and conversion | [`docs/target-architecture/`](../target-architecture/README.md) |

If this pack and one of those disagree, that one wins and the disagreement is a
RAID issue. The more conservative reading governs until an authorized, dated
decision says otherwise, as the go/no-go decision itself rules.

## Held by a test

[`app/src/lib/ops/program.test.ts`](../../app/src/lib/ops/program.test.ts) fails when: a node needs an id that is not a node, or the
graph has a cycle; the external queue gains or loses an item the model lacks; a
stated path figure disagrees with the nodes; a launch risk is missing from or
invented in the RAID register; a 90-day task is missing from the tenant launch
plan; an id or link in the pack does not resolve; or an outcome in a status
report has no evidence, date or acceptor.

## Not in this pack

No dates, budgets, headcounts or prices; none of them exists in the repository
to cite. No legal, tax, security or accessibility conclusion; those stay with
qualified people ([RAID-D01 to RAID-D05](03-RAID.md#dependencies-on-outside-parties)).
