# SLOs and error budgets

**Code: `app/src/lib/governance/error-budgets.ts`.** [SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md](../SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md)
decided that SLO definitions and error budgets are documentation plus checks rather than tables. This is that
documentation, and the module is the check.

**These are targets, not readings.** Semester has no measured availability history yet (see the "Uptime SLA" row
of [PROCUREMENT_CHECKLIST.md](../market-readiness/PROCUREMENT_CHECKLIST.md)). Nothing in this file may be quoted to a
customer as an achieved figure.

## An objective names a student outcome

"The API is up" can be true while nobody can save a plan. Each journey says what an eligible attempt is, what a
good one is, and which failures are bad.

| Journey | SLO | Good event | Why |
| --- | --- | --- | --- |
| Sign in | 99.95% | The student reaches their own workspace | Students cannot use the product without access |
| Today dashboard load | 99.9% | Today renders its meaningful content | The primary daily journey |
| Plan save | 99.95% | The plan is durably stored and can be retrieved by the same authorized user | Lost planning work breaks trust |
| Advisor agenda save | 99.95% | The agenda is durably stored and retrievable | An important advising workflow |
| Search | 99.9% | Valid results within the latency target | Finding support and course information is core |
| Ask Semester | 99.5% | A policy-compliant answer or a safe fallback | AI must fail safely, not block core work |
| Assignment draft save | 99.99% | The draft is durably stored during a committed window | Losing student work is high impact |
| Data export or delete request intake | 99.99% | The request is accepted and tracked | A privacy workflow must not fail |

A durable write is bad when it:

- Returns an error
- Times out
- Is lost
- Is written to the wrong record
- Creates an unintended duplicate
- Cannot be confirmed or reconciled

The one permitted exclusion: The student intentionally cancelled the operation. A fault Semester caused stays bad
even when a third-party system was involved in the workflow.

## Proposed journeys

The platform brief names journeys this file had no objective for: calendar, course access, grade retrieval,
registration, billing, communications and integrations. These seven are **proposed**. Nobody has adopted them, and
the figures are a rule, not a measurement: money, records and anything that can show another person's data sit at
99.95%; a read the student relies on daily at 99.9%; a journey that depends on a system Semester does not run at
99.5%, where the part Semester owns still counts. An owner adopts or changes each one; until then none may be quoted
to a customer, and a proposed journey's release rule is a recommendation, not a freeze. They are computed and
reviewed exactly like the adopted eight.

The adopted writes count the six bad outcomes above. These journeys are mostly reads and commands, so each names its
own bad events, below. Showing one student another person's data, or an unreleased grade, is also a privacy or
records incident to be handled as one, whatever the budget says.

| Journey | SLO | Good event | Why |
| --- | --- | --- | --- |
| Calendar load | 99.9% | The calendar shows the student’s own events and tasks for the range viewed, each with its source and as-of time | Where a student checks what is due, so a wrong or stale view is a missed deadline |
| Course access | 99.9% | An enrolled student opens their course and its current-term materials, and a student who is not enrolled does not | Coursework is unreachable without it, and admitting the wrong person is worse than an outage |
| Grade retrieval | 99.95% | A released grade is shown for the right student and course with its as-of time, or the student is told the source is unavailable | A wrong or unreleased grade is a record error, and silence is worse than saying the source is down |
| Registration submission | 99.95% | A registration command is accepted or refused with a reason the student can read, exactly once, and the student sees which | An official write on a deadline: a lost or doubled registration cannot be undone by retrying |
| Billing statement and payment | 99.95% | The student sees an accurate balance with its as-of time, and a payment they submit is recorded exactly once | Money: a wrong balance or a doubled charge is a financial error with a deadline attached |
| Communication delivery | 99.9% | A notification or announcement reaches the recipient’s chosen channel within its latency target, or the sender is told it failed | Deadlines and changes reach students only if the message does |
| Connected-source sync | 99.5% | A scheduled sync completes and reconciles, or the student sees it degraded with the time of the last good sync, and native features keep working | Connected systems are not Semester’s to run, so this is looser, but a silent failure is never acceptable |

### Calendar load

- Returns an error
- Times out
- Shows data older than its stated as-of time as though it were current
- Shows an event at the wrong date or time
- Shows another person’s events

### Course access

- Returns an error
- Times out
- Refuses a student who is enrolled
- Admits a student who is not enrolled
- Omits materials that exist for the term

### Grade retrieval

- Returns an error
- Times out
- Shows a grade that has not been released
- Shows the wrong student’s or the wrong course’s grade
- Shows a stale grade as though it were current

### Registration submission

- Returns an error
- Times out
- Is lost
- Is applied to the wrong section
- Is applied twice
- Is left pending with no reconciliation
- Refuses without a reason the student can read

### Billing statement and payment

- Returns an error
- Times out
- Shows a balance that does not match the ledger
- Records a payment twice
- Loses a payment that the processor accepted
- Leaves a payment unconfirmed with no reconciliation

### Communication delivery

- Is lost with no failure shown to the sender
- Reaches the wrong recipient
- Reaches a recipient who opted out of it
- Is delivered twice
- Arrives after its latency target

### Connected-source sync

- Fails with no degraded state shown
- Writes to the wrong record
- Imports a duplicate
- Is left unreconciled past its window
- Stops a native feature from working

A refusal for a stated policy reason (a hold, a full section) is a *good* registration event, not a bad one: the
objective is that the system answers exactly once and says why, not that every request succeeds.

## The budget, worked

100,000 eligible plan saves in thirty days at 99.95% allow **50** bad saves. Forty bad saves leave 20% of the budget,
which is **At risk**. The arithmetic runs in whole parts per ten thousand, so a budget is never rounded away, and an
objective written as a fraction (0.9995) where a percentage belongs is refused rather than read as 0.9995%.

## The budget changes releases

| State | Remaining budget | Release rule | Required action |
| --- | --- | --- | --- |
| Healthy | More than 50% | Normal releases | Review weekly |
| Watch | 25%–50% | Limit risky changes to the affected journey | Add reliability work to the sprint |
| At risk | 10%–25% | Freeze nonessential changes to the affected flow | Mitigation plan and leadership review |
| Exhausted | Less than 10% | Freeze noncritical releases affecting the service | Corrective action before release resumes |
| Breached | Objective missed | Follow the incident and SLA process | Postmortem, customer communication if material, remediation |

A window with no eligible events reads as *no data*, never as Healthy.

## Burn rate

Burn is how fast the budget is being spent, as a multiple of the rate that would spend exactly all of it over the
window. Failing 0.5% of plan saves against a 0.05% allowance is a burn of 10: a thirty-day budget gone in three days.
**A burn of 10 or more is urgent**, and needs an incident review even while the window is still on Watch.

Burn is read from a short recent lookback (the last hour, say) when one is given. Over the whole window it can only
reach 10 once the window is already breached, which is too late to be useful.

## The frontend half

A student feels most failures before any server is slow. Most of these are field metrics that nothing collects yet:
there is deliberately no aggregate of real devices ([LAUNCH-HARDENING-REPORT.md](../LAUNCH-HARDENING-REPORT.md),
Performance). Where a test in the repository guards the property structurally, it is named.

| Metric | Target | What failure looks like | Guarded by |
| --- | --- | --- | --- |
| Largest Contentful Paint, p75 | ≤ 2.5 s | The student waits too long for the main content | Not measured |
| Interaction to Next Paint, p75 | ≤ 200 ms | Buttons and tabs feel unresponsive | Not measured |
| Cumulative Layout Shift, p75 | ≤ 0.10 | Cards jump and the student taps the wrong target | Not measured |
| Route transition | ≤ 500 ms or an immediate skeleton | Navigation feels stalled | Not measured |
| JS error-free sessions | ≥ 99.5% | A route fails after its first render | Not measured |
| Focus visible | 100% of focusable controls | Keyboard users cannot see where they are | `app/src/a11y/focus.test.ts` |
| Drag alternative | 100% of draggable items | A pointer that cannot hold still cannot move anything | `app/src/a11y/dragging.test.ts` |
| Layout-overflow rate on critical routes | 0% | Horizontal scroll or clipped controls on a phone | Not measured |
| Focus-obscured rate | 0% | A sticky header or composer hides the focused control | Not measured |
| Offline draft recovery | 100% of critical drafts | Work disappears after a network interruption | Not measured |
