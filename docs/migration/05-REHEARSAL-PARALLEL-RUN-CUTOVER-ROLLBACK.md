# 05 Rehearsal, parallel run, cutover and rollback

Code: `rehearsal.ts`. Stages: *(rehearsal: not a Center stage)*, **parallel_run**,
**cutover**.

Three questions fail differently, so they are kept apart: *can we do it in the
window*, *can we undo it and until when*, and *does Semester behave like the old
system on the days that matter*.

## 1. Rehearsal

A rehearsal is a complete run of extract → transform → load → full semantic
gate → rollback, at production scale, on a copy of production-shaped data, on
the production-shaped path, timed.

`rehearsalReadiness(rehearsals, { windowMinutes, ... }, now)` is ready only if:

| Condition | Default | Why |
| --- | --- | --- |
| At least N rehearsals, the last N all passing the gate | N = 2 consecutive | One pass can be luck; the second finds what the first fixed and broke |
| The last N at **full scale** | — | A tenth of the data is a different performance and a different set of edge cases |
| At least one **full-scale rehearsal performed and verified a rollback** | — | A rollback that has only been described has not been tested |
| Slowest of the last N uses ≤ a share of the agreed window | 70% | Headroom for the day being worse than the rehearsal |
| The earliest of the last N is not older than | 14 days | Practice on last month's data is practice for a different event |

Not ready reasons are named (`too_few_rehearsals`, `not_consecutive_pass`,
`not_full_scale`, `rollback_never_exercised`, `too_slow_for_window`, `too_old`).
All defaults are for the first institution to argue with.

Each rehearsal produces: timings per step, gate result, exception diff since
the last rehearsal (new, fixed, regressed), rollback result, and a ledger entry
(`rehearsal`). The `rehearsal_passed` gate additionally needs
`semester_security` for access, secrets and logging in the rehearsal path.

**Dress rehearsal:** the last rehearsal runs with the people who will be on the
cutover bridge, following the cutover runbook (§3) literally, so the runbook
is tested as well as the data.

## 2. Parallel run

The old system stays official. Semester ingests the same changes and the same
outcomes are computed in both, and compared every day.

`parallelRunStatus(days, { minDays, requiredEvents })`:

- A day **counts** if it compared something, had no unexplained critical
  difference, and its unexplained-high rate is within threshold (0.1%).
- The **streak** is the trailing run of counted days. An unexplained critical
  difference resets it.
- The run is ready only if the streak is at least `minDays` **and** every
  required calendar event occurred on a counted day inside the streak.

Weeks of quiet days prove less than one real billing run. Required events per
domain are on each workbook page (`parallelEvents`): for example `grade_posting`
and `term_close` (academic records), `billing_run`, `aid_disbursement`,
`refund_run` (finance), `add_drop_deadline` and `census_date` (enrollments),
`consent_revocation_batch` (family), `retention_run` (documents). If the
calendar will not produce an event inside the window, **simulate it** from a
frozen copy and say so in the evidence; do not drop it.

What to compare, daily, per domain: the outcome checks of the workbook, run on
that day's data, plus `permission` for any role or consent change that day.
"Explained" is a status in the exception queue with an owner and a reason; an
unexplained difference is an open exception.

`observations.ts` does the comparing that turns raw outcomes into those days
(`compareDay`): numbers are exact unless the institution sets a tolerance, an
unexplained difference defaults to critical so the reader has to argue it
*down*, and a difference counts as explained only by a recorded decision with a
named approver and a reason that says something. `earliestExit` answers the
calendar question first: the streak must contain the first occurrence of every
required event, so it says *no date* when the calendar has none rather than a
date that quietly skips the event.

The Center's own parallel-run stage requires `parallel_runs_required` passing
periods; these daily results roll up into those periods (`period_label`) via
`bridge.ts`.

Users do not work in two systems. Parallel run means Semester is *shadowing*;
who does the work is the institution's decision and is stated in the plan, not
discovered.

## 3. Cutover

### 3.1 Go/no-go

A single meeting, with the evidence open. `cutover_go` is open only if:

- every domain's `validation_passed` and `parallel_run_exit` gates are open;
- `rehearsal_passed` is open and ready by §1;
- evidence ledger verifies (`verifyChain`);
- no open critical exception; every waiver unexpired through the hypercare period;
- sign-offs are current against the evidence head (new evidence makes them stale);
- the rollback plan, its triggers and its point of no return are written and signed;
- the communications plan and support staffing are in place;
- counsel has answered every flagged question.

The executive sponsor, `semester_security`, the independent reviewer and each
domain approver sign (`requiredRoles('cutover_go', domain)`).

### 3.2 Runbook shape

Written per institution; the skeleton:

1. T-7 d: change freeze on mapping; final full extract scheduled; comms out.
2. T-24 h: confirm delta extraction; rollback team on standby; support briefed.
3. T-0: freeze legacy writes (or queue them). Final delta extract.
4. Load delta; run the **full gate** (not a subset). Domain approvers review.
5. Go/no-go checkpoint against the rollback triggers (§4). **This is the last
   cheap rollback.**
6. Repoint: SSO, integrations, DNS or links, notifications. Open Semester to
   users. Semester begins accepting writes: **point of no return begins here**
   (§4).
7. Smoke journeys per role; hypercare begins.

Each step has an owner, an expected duration (from rehearsal), and a recorded
start and end in the ledger (`cutover_event`).

### 3.3 Hypercare

Elevated staffing and a shortened exception SLA for a stated period (default
two weeks). The Center's **monitoring** stage records each check. Daily:
the outcome and permission checks on the live target; login and enrollment
mismatch rates; support tickets tagged migration.

### 3.4 The plan, checked

`cutoverPlanProblems(plan)` names what makes a plan unsafe before anyone
rehearses it: no window or no measured rollback time; rollback longer than the
window; a rollback window under 72 hours; no immutable pre-cutover snapshot; any
default rollback trigger missing or *loosened* (triggers may be tightened, never
loosened below `DEFAULT_ROLLBACK_TRIGGERS`); nobody owning the decision; an
invalid change freeze; the legacy system not kept available for the whole window;
communications not approved; support not staffed. Whether Semester's writes can
be carried back is not a plan problem. That is `rollbackMode`, and
`roll_forward_only` is a legitimate plan so long as everyone who signs knows it is
the plan.

## 4. Rollback

### 4.1 The point of no return

The honest question is: *has Semester accepted a write that the legacy system
does not have?* `rollbackMode(state)`:

| Mode | Condition | Rollback means |
| --- | --- | --- |
| `full` | No Semester write accepted | Repoint to the legacy system and reopen it; nothing is lost |
| `with_replay` | Writes accepted, and a **verified** replay carries them back to the legacy system | Replay new writes into legacy, then repoint. The replay must have been exercised in a rehearsal |
| `roll_forward_only` | Writes accepted, no verified replay | Rolling back loses students' new data. **Fix forward**; the plan says so before cutover, not during |

Moving from `full` to anything else is a deliberate, logged act (the moment
Semester opens for writes), not a drift.

### 4.2 Triggers and the decision

`rollbackDecision(triggers, observed, state)`:

| Trigger (default) | Breached when |
| --- | --- |
| `open_critical_exceptions` | > 0 |
| `permission_widened` | > 0 |
| `ledger_variance_minor_units` | > 0 |
| `login_failure_rate` | > 2% |
| `enrollment_mismatch_rate` | > 0.1% |

- Breach before the point of no return → `rollback`.
- Breach in `with_replay` → `rollback` (via replay).
- Breach in `roll_forward_only` → `roll_forward`: fix forward, with an incident.
- A trigger with **no observation** → `investigate`. Silence is never health;
  a dashboard that is down at hour two is exactly when the decision is least
  safe to make from silence.

Institutions may add triggers or tighten limits in their plan; they do not
loosen the defaults. Each decision is recorded (`rollback_event`) with the
observations that drove it.

### 4.3 What rollback also covers

- **Identity:** SSO assertions and SCIM provisioning repointed; sessions revoked.
- **Notifications:** anything sent from Semester during the window is known and
  listed, so users can be told.
- **Files and documents:** nothing in the legacy system was altered by
  extraction (read-only), so nothing to restore there.
- **Semester side:** `ROLLBACK.md` is the controlling runbook for the product;
  its rule applies: the schema cannot be rolled back, so the migration's
  Semester-side changes are additive and readable by the previous build.

### 4.4 After a rollback

Not a failure to hide. Evidence is preserved, the cause is added to the queue
as an exception, and a new rehearsal cycle is required (consecutive count
resets); a rollback decision stales every sign-off by construction, because it
adds evidence.
