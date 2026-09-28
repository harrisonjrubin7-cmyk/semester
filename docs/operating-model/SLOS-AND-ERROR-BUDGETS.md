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
