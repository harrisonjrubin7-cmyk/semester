# 07 · Resilience, backup and restore, disaster recovery, dependency and regional failure, chaos

> Part of the [SRE pack](README.md). Status: **proposed; recovery is unmeasured.** Code: `app/src/lib/sre/catalog.ts` (class targets) and `chaos.ts`. Controlling documents: [RESTORE.md](../../RESTORE.md), [DISASTER-RECOVERY-TEST-PLAN.md](../engineering-operations/DISASTER-RECOVERY-TEST-PLAN.md), [DEGRADED-MODE-MAP.md](../DEGRADED-MODE-MAP.md), [INCIDENT-RECOVERY-PLAYBOOK.md](../INCIDENT-RECOVERY-PLAYBOOK.md). Experiments: [generated/EXPERIMENTS.md](generated/EXPERIMENTS.md).

Semester may say it has a tested **logical** database rehearsal and a controlled provider-recovery plan, with exact scope and date. It may not claim production restore, point-in-time recovery, backup completeness, measured RTO or RPO, zero data loss, or full disaster recovery until a provider-backed drill passes.

## 1. Targets by class

Targets, written so a drill has something to be measured against. The existing `RECOVERY_OBJECTIVES` in `lib/incident-recovery.ts` classify by data *sensitivity* and leave every number null; these classify by *operational* criticality, which is a different question, and the measured column is the same `unmeasured`.

| Class | RTO target | RPO target | Drill | Measured |
| --- | --- | --- | --- | --- |
| C0 | 60 min | 5 min | every 90 days | unmeasured |
| C1 | 4 h | 15 min | every 180 days | unmeasured |
| C2 | 24 h | 60 min | yearly | unmeasured |
| C3 | 72 h | 24 h | yearly | unmeasured |

A test pins every measured value to `null` and the provider-backed restore experiment (CX-03) to `planned`; filling a number in is an edit that has to cite a drill.

RTO is measured from *declaration* through *usable, verified service*; the data-loss interval is recorded separately. Recovering fast to a wrong state is not recovery.

## 2. What is backed up, and what is known

| Asset | Backup | Known today |
| --- | --- | --- |
| Postgres | provider backups; point-in-time recovery if the plan has it | **Unverified.** A logical dump and restore was rehearsed on 30 September ([evidence](../evidence/restore/2026-09-30-logical-rehearsal.md)): schema, rows, event trigger and RLS compared. The live project's own backup has **never been restored**; PITR is "not verified" |
| Gateway journal | none | **No backup exists.** Lost journal means lost integration history and replay |
| Audit and ledger chains | in the database; sealed and verified daily by `job:console-audit-integrity` and `job:ledger-chain-integrity` | integrity is checked; recoverability is the database's |
| Object storage (uploads, exports, trust packet) | provider | unverified |
| Code, migrations, configuration | git | the repository is the copy; `ledger.snapshot` and `functions.snapshot` are dated readings of production |
| Secrets | the stores in `SECRETS.md` | two secrets live in no store; a sealed break-glass copy held by two people does not exist because there is one person |
| A student's device | the device is a **replica**: a student's own plan, notes and deadlines live there and work offline | by design, but not verified end to end after a long offline gap |

## 3. Restore, rules

1. Restore **into a new, isolated project**, never over production. A drill never touches the live host.
2. **Legal holds and deletions are re-applied after a restore.** A restore must not resurrect data a person lawfully erased; RESTORE.md has the procedure and experiment CX-14 tests it for account deletion.
3. Reconcile the audit, event and journal records; confirm no live integration or notification escaped the target.
4. Acceptance needs data and authorisation invariants passing, target flows working, monitoring operating, gaps documented, and the owner plus an independent witness signing. Today the witness does not exist.

The provider-backed drill (CX-03) is the single highest-value experiment in this pack: it converts four unknowns (backup state, PITR state, RTO, RPO) into numbers.

## 4. Dependency failure plans

What the catalog says happens when each external dependency fails, in one place. Each row is a hypothesis until its experiment runs.

| Dependency | If it stops | Still works | First action | Experiment |
| --- | --- | --- | --- | --- |
| Supabase platform (auth, database, functions, scheduler) | sign-in, sync, shared features, billing state, LTI | everything on the device | communicate; do not change anything; RB-03 and RB-02 | CX-04, CX-05, CX-06 |
| GitHub Pages | first visits and updates | installed and cached app, offline | RB-01; status entry | CX-10 |
| Stripe | new checkout, refund and dispute changes | everything already paid for | RB-06; reconcile after | CX-07 |
| AI providers | drafting and explaining | every deterministic feature | engage `kill.ai_generation`; RB-05 | CX-01 (executed) |
| Email provider | support email nudges | in-app replies; sign-in mail is the auth platform's | outbox retries, then dead-letters; RB-07 | CX-08 |
| Web Push | lock-screen reminders | in-app deadlines | queue holds rows; RB-07 | CX-08 |
| A school's SIS, LMS or IdP | that school's launches, imports and sync | the app and the student's data | engage `kill.integration_sync`; RB-14 | CX-13 |
| The one operator | nothing fails at once; nothing is fixed | the running app | **none exists** | — |

The last row is the largest. It has no experiment because the only test is a second person doing RB-01 to RB-05 unaided.

## 5. Regional and provider-wide failure

Semester is single-region on single providers. Recorded plainly, with the options and what each would cost, because the choice is the CTO pack's open question P-12 and a counsel and CEO decision (Q2), not this pack's:

| Option | What it buys | What it costs |
| --- | --- | --- |
| Accept single-region; rely on restore into a new region | simplest; RTO measured in hours | a regional outage is a full outage until restore completes; needs a rehearsed cross-region restore |
| Cross-region backup copy | an RPO that survives the region | storage and egress cost; residency and legal review for where copies live |
| Warm standby | an RTO in minutes | doubles the database cost; failover is itself a risky operation that must be drilled |
| Active-active | near-zero RTO | complexity far beyond a product of this size; not proposed |

Recommendation: **cross-region backup copy plus a rehearsed restore** is the first rung; no higher rung is justified until a customer's contract requires it and a drill proves the lower one. Data-residency constraints from any first institution (counsel) decide *where* copies may live before anything is built.

## 6. Chaos and game days

14 experiments; 2 executed (the AI kill switch, the logical restore); 12 planned. Every experiment states a hypothesis that can be wrong, an injection, a safe environment, an abort condition, and the runbook it also tests. Rules, enforced by test:

- An `executed` experiment cites evidence, and the file exists; a `planned` one cites none.
- Nothing runs in production without approval; today every experiment is local or staging.
- Every C0 component is the target of at least one experiment.

Cadence: one experiment a month, chosen from the scorecard's `drilled` gaps, run by one person and watched by another. A game day per term, before registration, that runs the peak playbook ([04](04-CAPACITY-PLANNING.md) §7) against staging with an injected failure and a responder who has not seen it. The first game day that matters is **a second person executing RB-01 to RB-05 unaided**.

Two experiments are the cheapest large wins:

- **CX-11, the provider-degraded run:** every adapter stubbed to fail; every native journey must still pass. It is the CI form of the thesis that nothing core depends on a connector.
- **CX-09, the failing migration:** time how long until a human is told. The 18 September failure is the evidence this is not hypothetical.
