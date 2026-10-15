# 04 · Capacity planning

> Part of the [SRE pack](README.md). Status: **proposed**; production capacity is **unproven**. Code: `app/src/lib/sre/capacity.ts`. Demand tables: [generated/CAPACITY.md](generated/CAPACITY.md). Existing prose: [CAPACITY-AND-SCALING-PLAN.md](../engineering-operations/CAPACITY-AND-SCALING-PLAN.md), [COURSE-DEMAND-FORECASTING.md](../COURSE-DEMAND-FORECASTING.md).

Semester may cite the local database load scenarios and the bundle budgets, with their environment. It may not claim production scale, a supported user count, provider headroom or cost predictability. Nothing in this document changes that.

## 1. The gap this fills

The capacity plan lists what must be proven. It does not say what a registration morning *asks of the system*, which is what a load test has to be sized from. `capacity.ts` derives it with Little's law — requests in flight equals arrival rate times time in system, and likewise for database connections — and nothing fancier, so anyone can re-run it by hand. Tests do: 6,000 accounts at 45% concurrency and 18 requests a minute is 810 requests a second, 648 in flight and 65 connections.

## 2. Three rules

1. **Every input is a labelled assumption.** Nobody has measured how many requests a student makes in a registration minute. Each scenario's `basis` begins "Assumption." (a test enforces it). They are written down so they can be argued with and replaced with field data.
2. **An unverified ceiling is `null`, and `null` is never "fits".** `fit()` returns `unknown_limit`; a test asserts that today every limit is unverified and so a full plan certifies nothing. Provider quotas move and plans differ; a number copied from a pricing page is how a capacity plan certifies a ceiling that does not exist.
3. **Peaks stack.** Grade release lands in finals week; billing lands on registration. `stack()` adds demands, caps concurrent accounts at the population, and refuses to stack different cohorts.

## 3. The six peaks

| Scenario | The story | What makes it hard |
| --- | --- | --- |
| Registration opens | At 7:00 a thousand students race for seats and a seat that is gone must say so truthfully | Synchronised start; write contention on enrolment; the only peak with a known time |
| Deadline night | An assignment closes at 11:59 and half a course saves and submits in twenty minutes | Draft autosave dominates; **losing a draft is the worst failure, so saves are sized, not averaged** |
| Grade release | A registrar flips a switch and a term opens its grades in minutes | Read-heavy, not shareable between students; guardian notifications double the fan-out |
| Billing run and due date | Statements issue; on the due date students pay and the processor retries late and twice | Low rate, high consequence: idempotency under retry is the cost, not volume |
| AI study surge | The night before an exam a fifth of a class asks to be quizzed | Long requests hold a worker for seconds; each call has a variable cost |
| Campus emergency | An alert goes out and most of the campus opens the app within a minute | The one peak where graceful degradation is not enough; the alert path must work when everything else is shed |

At one campus (6,000 accounts) the model's demand ranges from 60 to 810 requests a second, 4 to 65 connections, up to 2,400 AI calls a minute in the exam-eve surge, and 100 notifications a second for an emergency relay. The full tables for four cohort sizes — invitation beta (30), design partner (500), one campus (6,000), a university system (30,000) — are in [generated/CAPACITY.md](generated/CAPACITY.md). They are the *input* to a load test, not its result.

## 4. Four ceilings that must be read, not remembered

| Resource | Where it lives | Status |
| --- | --- | --- |
| Concurrent function invocations | the production plan's edge and gateway limits | **unverified** |
| Database connections | Postgres max connections behind the pooler, on the production compute size | **unverified** |
| AI calls per minute | the provider account's rate limit per model, on the production key | **unverified** |
| Notifications per second | the push and email providers' send rate on the production account | **unverified** |

Filling one in means attaching the dated evidence the capacity plan asks for. The target utilisation is 60%: running at the ceiling is already an outage.

## 5. The AI caps must be in the right order

Three numbers cap AI spend, and MONITORING.md insists they be written down together because the only useful question is whether they are in the right order: **per-account cap × accounts × cost per call must sit under the provider cap**, or the cap that fires first is the wrong one. `aiCapOrder()` answers `ordered`, `inverted` or `unknown`; it is `unknown` today because the provider cap and the measured cost per call are unset. Worked check: 500 accounts × 60 calls × 0.02 per call is 600, so a provider cap of 500 is inverted and one of 1,000 is ordered.

## 6. Staged proof

Follow the ladder in the capacity plan; this adds what each rung must show.

| Stage | Required proof | Registers to update |
| --- | --- | --- |
| Invitation beta (≈30) | Public probe, core journeys, support able to answer; no paid or official-write dependency | none beyond the baseline |
| Design partner (≈500) | Named cohort, expected peak, **deadline-night and registration profiles** run against full-stack staging with headroom; alerts exercised | `LIMITS` filled for connections and invocations |
| Paid pilot | Representative data volume; isolation invariants hold under load; provider quotas and cost; one degraded run (CX-04, CX-06) | `LIMITS` for AI and notifications; cost budgets set |
| Enterprise | Multiple profiles, repeated peaks, a campus-emergency drill at cohort scale (CX-12), recovery timed | class targets measured |

Each test run records: workload and data distribution, concurrency, ramp and duration, environment parity, thresholds, error, latency and saturation, data invariants, recovery, cost, and the safety stop. Test steady, peak, spike, soak and dependency degradation. **Never load-test production without explicit approval and safeguards**; the existing local scenarios (`supabase/load.sh`) already test latency budgets, concurrency and invariants against a disposable database.

## 7. Peak playbook

For each known peak, the owner of the platform role does this, in order:

1. **Two weeks before:** read the demand row for the cohort; confirm every limit it touches is verified or say it is not; confirm a person is reachable and a second is named or the gap is recorded.
2. **One week before:** freeze changes per [05](05-DELIVERY-AND-CHANGE-MANAGEMENT.md) §6; run the golden path and the degraded-adapter run; confirm backup and restore state is recent.
3. **Day of:** open the dashboards in [03](03-OBSERVABILITY.md) §5; keep the kill switches in reach in this order of shedding — `kill.integration_sync`, then `kill.ai_generation`, then non-essential reads — protecting sign-in and saves last.
4. **After:** record the *real* numbers beside the assumptions, edit `capacity.ts`, and add the peak's actual date to the freeze calendar for next term.

Periods that earn a freeze, in the owner's priority order (from DEGRADED-MODE-MAP.md): registration and add/drop; the first week of term; finals and grade release; billing; a partner school's launch week.

## 8. Autoscaling and queues

The platform is managed (a hosted database, a function runtime, a static host); Semester does not run servers whose size it chooses today, so "capacity" means the plan tier and the settings behind it, plus protecting the shared resource — the database — from the things that compete for it. Two protections are cheap and worth writing down:

- **Shed in a fixed order** (§7), with each step reversible and drilled.
- **Backpressure, not drops:** queues hold rows and drain oldest first at a rate the provider tolerates; nothing is dropped to survive a peak.

Revisit when the CTO pack's `core` container exists: it adds a size Semester chooses, and a row in `LIMITS`.
