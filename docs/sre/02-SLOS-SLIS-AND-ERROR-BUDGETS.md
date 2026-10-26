# 02 · SLOs, SLIs and error budgets

> Part of the [SRE pack](README.md). Status: **proposed targets; achieved values unmeasured.** Code: `app/src/lib/governance/error-budgets.ts` (the objectives and budget maths, unchanged) and `app/src/lib/sre/burn-alerts.ts` (the alerting policy, new). Existing prose: [SLO-SLI-DRAFT.md](../engineering-operations/SLO-SLI-DRAFT.md), [ERROR-BUDGET-DRAFT.md](../engineering-operations/ERROR-BUDGET-DRAFT.md), [SLOS-AND-ERROR-BUDGETS.md](../operating-model/SLOS-AND-ERROR-BUDGETS.md).

Nothing in this document is a claim that Semester meets any objective. There is no measured availability history, no accepted event stream and no denominator. A window with no eligible events is **no data**, never healthy. These are internal targets and must not be quoted to a customer as achieved figures.

## 1. What already exists, and what was missing

The repository has eight journey objectives, integer-safe budget arithmetic, five budget states with a release rule each, and a burn rate. It stops at a number. A number does not wake anyone or open a ticket, and a single threshold on a single window is either late or noisy. The missing piece is the rule that turns burn into a *decision*, and the honesty about small numbers.

## 2. The journeys

Unchanged from `error-budgets.ts`; reproduced so this page stands alone.

| Journey | Objective | Good event |
| --- | ---: | --- |
| Sign in | 99.95% | The student reaches their own workspace |
| Today load | 99.9% | Today renders its meaningful content |
| Plan save | 99.95% | The plan is durably stored and retrievable by the same authorized person |
| Advisor agenda save | 99.95% | The agenda is durably stored and retrievable |
| Search | 99.9% | Valid results within the latency target |
| Ask Semester | 99.5% | A policy-compliant answer or a safe fallback |
| Assignment draft save | 99.99% | The draft is durably stored in a committed window |
| Export or delete intake | 99.99% | The request is accepted and tracked |

A durable write is bad when it errors, times out, is lost, lands on the wrong record, duplicates, or cannot be confirmed. The one permitted exclusion is a student's deliberate cancel; a fault Semester caused stays bad even when a third party was involved.

## 3. Supporting SLIs for the things students do not see

Journey SLOs say whether the student was served. The components behind them need indicators of their own, because a queue can be failing for an hour before any journey notices. **All of these are proposals; none is measured.**

| Component class | Indicator | Proposed objective |
| --- | --- | --- |
| Queues | Share of rows sent within 30 minutes of becoming due | 99% |
| Scheduled jobs | Share of expected runs that completed within twice their period | 99.5%; **100% for integrity and retention jobs** |
| Billing webhook | Share of paid events applied within 15 minutes | 99.9% |
| Connector freshness | Share of connections fresher than their contracted freshness (`governance/data-contracts.ts`) | per contract |
| Emergency relay | Share of recipients reached within 60 seconds of dispatch | 95% — **no such path exists yet** ([RB-11](runbooks/RB-11-emergency-notification.md)) |
| Recovery | Elapsed time from declaration to verified service; data-loss interval, separately | the class RTO and RPO in [07](07-RESILIENCE-BACKUP-DR-AND-CHAOS.md) |
| Frontend | The ten targets already in `FRONTEND_TARGETS` (LCP, INP, CLS, error-free sessions…) | as written; only focus-visible and drag-alternative have a structural guard |

## 4. Burn-rate alerting

Four rules, two that wake somebody and two that do not. A rule fires only when a **long** window shows the budget really is going **and** a **short** window shows it still is.

| Rule | Route | Burn | Long window | Short window | Share of the monthly budget gone at fire |
| --- | --- | ---: | --- | --- | ---: |
| fast | page | 14.4× | 1 h | 5 m | 2% |
| steady | page | 6× | 6 h | 30 m | 5% |
| slow | ticket | 3× | 1 d | 2 h | 10% |
| leak | ticket | 1× | 3 d | 6 h | 10% |

The last column is `budgetSpentAtFire()`, and a test pins it to 2, 5, 10 and 10. Burn is a multiple of the sustainable rate: 1 spends exactly the thirty-day budget in thirty days; 14.4 spends 2% of it in an hour.

**Why both windows.** The long window stops a blip from paging. The short one stops an alert from staying red for an hour after the fault is fixed. Both are tested: a long burn with a recovered short window does not page, and a short spike inside a clean hour does not page.

**Why a floor.** Semester's first audience is ten to thirty people. Against 99.95%, one failed save in two hundred is a burn of ten — and one person having a bad minute. So a window with fewer than 20 eligible events cannot fire, and reads `insufficient_data`, not "fine". `decide()` returns `complete: false` whenever any rule lacked data, so a journey that is quiet because nobody used it is distinguishable from one that was measured and is healthy.

**What watches low-traffic journeys instead:** the synthetic probe — a robot that behaves like a student, hourly today, every five minutes once it is cheap enough. A journey too small for arithmetic is watched by behaviour.

**Proof.** `burn-alerts.test.ts` has 19 tests: total outage pages; a 1% failure rate pages; 0.4% pages on the *steady* rule, not the fast one; 0.2% tickets without paging; 0.07% opens only the slow-leak ticket; a healthy journey is silent; three failures out of four attempts does not page. Two deliberate breakages — replacing "both windows" with "either", and removing the floor — each turned exactly the tests that guard them red, and were reverted.

## 5. The error-budget policy

States and release rules are `POLICY` in `error-budgets.ts` and are unchanged:

| State | Remaining | Release posture |
| --- | --- | --- |
| Healthy | > 50% | Normal releases |
| Watch | 25–50% | Limit risky changes to the affected journey |
| At risk | 10–25% | Freeze nonessential changes to the affected flow |
| Exhausted | < 10% | Freeze noncritical releases affecting the service |
| Breached | Objective missed | Incident process, postmortem, customer communication if material |

Additions in this pack:

1. **The policy binds the gate.** [`changes.ts`](05-DELIVERY-AND-CHANGE-MANAGEMENT.md) treats an exhausted budget on a journey as a freeze for *normal* and *high-risk* changes touching it; *emergency* changes for an open incident are exempt.
2. **Security, privacy, safety, accessibility and data-integrity failures override the numeric budget.** A full budget never makes a P0 acceptable.
3. **No data blocks a claim, not a release.** An unmeasured journey cannot be called healthy, so it cannot be used to justify "reliability is fine"; it also is not a reason to freeze everything.
4. **Spend it on purpose.** A healthy budget is permission to move faster. The monthly review asks what it was spent on, and an unspent budget is a prompt to loosen, not to celebrate.

## 6. Composite objectives, and why vendors cap yours

A journey that needs several components in series cannot be more available than the product of them. If sign-in needs the app host and the auth service, `A(sign_in) ≤ A(host) × A(auth)`. For example, two dependencies at 99.9% each cap the journey at about 99.8%, whatever Semester's own code does. That is why a 99.95% sign-in objective is a statement about the vendors as much as about the code: until each vendor's *measured* behaviour is known, the objective is aspirational. The catalog's `journeys` field lists the components behind each outcome so this product can be computed once there are numbers; **no vendor figure is written down here**, because none has been verified and a copied number is how a plan certifies something untrue.

## 7. What it takes to make an SLO real

From the SLO draft, restated as the exit criteria for each journey's row in `MEASURED_JOURNEYS`:

1. Approve the event definitions (eligible, good, bad, exclusions, late events) and their privacy review: no prompt text, note text, grades or tokens.
2. Instrument numerator and denominator at the point the *student* would feel it; validate both against a known synthetic load.
3. Collect a representative window and reconcile gaps and late events.
4. Exercise the alert: delivery-test it to a named human ([06](06-INCIDENTS-AND-ON-CALL.md)).
5. Only then add the id to `MEASURED_JOURNEYS`. A test pins that list to empty today, so promoting a journey is a deliberate, reviewable edit.

Start with **sign-in** and **plan save**: highest consequence, simplest events, and both can be seeded from the existing hourly probe's history.

## 8. Review cadence

| When | What | Who |
| --- | --- | --- |
| Weekly | Budget state per measured journey; the ten-minute check in `MONITORING.md` until it is automated | owner of the role |
| Monthly | Spend of the budget, burn-rule firings, false-page rate, objective still right? | owner plus the second person once there is one |
| Per incident | Postmortem links journey, minutes and budget share | commander |
| Per quarter | Re-derive objectives from field data, not from the table above | owner and product |
