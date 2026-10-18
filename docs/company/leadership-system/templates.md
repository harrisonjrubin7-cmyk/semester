# Templates

> **PROPOSED — NOT ADOPTED.** Short on purpose. The longer existing templates are linked; use them when the short one is not enough. Never put privileged, personnel, security-sensitive, customer-confidential or personal information in a public repository: link to the controlled system instead.

## Monthly advisor note

Due business day 10, aligned to the finance close. One to two pages. Details: [`BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md`](../BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md).

```
Period:            [month]            Prepared by: [name]
Status:            [one sentence]

1. Bad news and changed assumptions (first)
   - [what, why it matters, what we are doing]

2. Three wins (each with its evidence link)
3. Three misses (each with what we learned)

4. Scorecard (link)
   Exceptions only: [metric — status — owner action]. Every figure: source, definition,
   period, and observed / estimated / proposed / unavailable.

5. Cash and runway
   [confirmed figures, or "not available" with the reason]

6. Trust ledger changes
   [new or closed P0/P1; exceptions expiring; claims withdrawn; incidents; data-rights clocks]

7. People, capacity, key-person
   [seats without a backup: n of 15; founder capacity next month; hiring status]

8. Asks (max three)
   [ask — what decision or help — by when]
```

## Board cover memo and decision ask

One page. First page of the quarterly packet ([01](01-board.md#board-packet)).

```
Quarter:          [period]             Meeting: [date]          Packet sent: [T-5]

Where we are in one paragraph: [stage; the one thing that matters most]

Bad news and changed assumptions
   - ...

Decisions requested
   | # | Decision | Options | Recommendation | Authority needed | Needed by |
   |   |          |         |                |                  |           |

Market motions (GO / GO WITH CONDITIONS / PAUSE / NO-GO)
   | Motion | Decision proposed | Conditions | Expiry | Owner |
   |        |                   |            |        |       |

What we stopped this quarter: [item and reason]
What we are asking the board not to spend time on: [item]
```

## Decision record (company, short form)

Use [`FOUNDER-DECISION-LOG-TEMPLATE.md`](../FOUNDER-DECISION-LOG-TEMPLATE.md) for the full form. A product/engineering decision uses `docs/decisions/D-<pull request number>.md` ([`docs/decisions/README.md`](../../decisions/README.md)).

```
Title:               [short]
Class:               [A / B / C]          Status: [proposed / approved / approved with conditions /
                                                  rejected / superseded / expired]
Decided on:          [date]               Decider: [name]        Consulted: [names]
Question and why now:
Options considered:  [A], [B], [defer]  — with the reason the others were not chosen
Decision:            [exact scope, exclusions, conditions]
Evidence (status):   [fact / hypothesis / assumption / counsel-reviewed — with links]
Dissent:             [name — reason — what evidence would change my mind]  (required for Class A)
Reversal trigger:    [what we would observe]
Review date:         [date]
Affected claims:     [claim ids, or none]
Not decided here:    [what this explicitly does not decide]
```

## Initiative one-pager

Half a page. The register fields are in [07](07-communications-and-tracking.md#register-fields).

```
Initiative:        [name]              ID: [short]
Owner / backup:    [name] / [name]
Outcome:           [what changes for whom — one sentence]
Linked to:         [key result or risk id]
Stage:             [Shape / Commit / Build / Prove / Scale-or-Kill]
Why now / why not later:
Capacity:          [hours or people per week]; WIP check: [n of 3 company-level]
Dependencies:      [third party / counsel / customer — date answer needed]
Evidence of done:  [artifact or measurement, and where it will be filed]
Kill criteria:     [written now, before starting]
Next decision:     [what and when]
```

## Requisition (hiring)

One page. Hiring governance in [04](04-organization-and-hiring.md#hiring-governance).

```
Seat / role:           [name]             Level: [L#]      Function: [ ]
Risk this retires:     [named risk, with the register id]
Trigger evidenced:     [evidence that the trigger fired]
Type:                  [employee / contractor / fractional]  — why not an engagement first?
90-day outcome:        [outcomes, not tasks]
Budget reference:      [line in the plan]   Runway rule check: [pass / fail]
Loop:                  [from 04, with the work sample]
Hiring-bar owner:      [name]
Expiry:                [90 days from approval]
```

## Interview scorecard

Submitted **before** the debrief discussion. One per interviewer.

```
Candidate:   [id]     Role / level: [ ]     Interviewer: [name]     Session: [topic]
Competencies assessed in this session (only these):
   | Competency | Score 1-4 | Observed evidence (what they said or did) | Concern? |
   |            |           |                                           |          |

Integrity gate (trust interview only):  [no concern / concern — describe]

Hire / no hire / lean:  [ ]    Strongest evidence for:    Strongest evidence against:
What would change my mind:
```

Scoring and decision rules: [04](04-organization-and-hiring.md#scorecard-and-decision-rules). Rubric: [04](04-organization-and-hiring.md#competency-rubric).

## 30/60/90 plan

```
Name / role / manager / buddy:
Day 30 outcome:   [understand; shipped; met users; knows escalation path]
Day 60 outcome:   [owns a defined piece end to end; first written proposal]
Day 90 outcome:   [the outcome named on the requisition]
Check-in dates and written signals:
Trust training completed (date):   Access granted (role, date, who approved):
```

## Pre-mortem

Use before locking the annual plan and any Class A decision.

```
Assume it is 12 months from now and this failed badly.
List the ten most likely reasons. For each:
   | Reason | Likelihood | Early signal | Tripwire (what we do and when) | Owner |
```
