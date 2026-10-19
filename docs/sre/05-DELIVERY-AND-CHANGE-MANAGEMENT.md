# 05 · Delivery, canary, rollback, configuration, secrets and change management

> Part of the [SRE pack](README.md). Status: **proposed** except where marked *exists*. Code: `app/src/lib/sre/changes.ts`. Controlling documents: [ROLLBACK.md](../../ROLLBACK.md), [SECRETS.md](../../SECRETS.md), [supabase/DEPLOY.md](../../supabase/DEPLOY.md), [CI-CD-STANDARDS.md](../engineering-operations/CI-CD-STANDARDS.md), [DEPLOYMENT-AND-RELEASE-RUNBOOK.md](../engineering-operations/DEPLOYMENT-AND-RELEASE-RUNBOOK.md), [FEATURE-FLAG-AND-KILL-SWITCH-STANDARD.md](../engineering-operations/FEATURE-FLAG-AND-KILL-SWITCH-STANDARD.md). Target pipeline: [CTO pack 06](../target-architecture/06-DELIVERY-AND-OPERATIONS.md).

## 1. How delivery works today

| Step | State |
| --- | --- |
| Merge gate (`ci.yml`) | *exists.* Audit, types, lint, gateway typecheck, tests in three timezones and shuffled order, build, budgets, three browser smokes, policy suites, load and concurrency, production-shape deploy rehearsal, backup-and-restore rehearsal, account lifecycle, gitleaks. Required checks: `account-sync`, `build`, `secrets`; one approving review, code-owner review, up-to-date branch |
| Web deploy (`pages.yml`) | *exists.* Runs only on a green CI on `main`; refuses a stale release; builds a separate demo; emits an SBOM |
| Function deploy (`functions.yml`) | *exists.* Same gate; deploys only changed directories, and all importers when `_shared` changes |
| Schema deploy | *exists as practice.* Supabase Branching applies migrations on merge; **no workflow file**, and on 18 September it failed unseen for three days. Guarded by `ledger.snapshot` and `migrationorder.test.ts`, which check a file against a dated reading — not the deploy itself |
| Infrastructure apply, drift detection, signed builds | *exists on `main`* (`infra.yml`, `infra-apply.yml`, `drift.yml`, `supply-chain.yml`); coded, not yet verified running in production; see [docs/infrastructure/](../infrastructure/README.md) |
| Canary | **none.** A release goes to everyone at once |
| Rollback | manual per layer, measured only for the web bundle (76 to 180 seconds) |
| Monitor after deploy | the hourly probe |

## 2. The rollback ladder

Ordered by speed. Use the first rung that works; never reach for a lower one first.

| Rung | Mechanism | Time | State |
| --- | --- | --- | --- |
| 1. Capability | engage a `feature_kill_switch` row (`kill.ai_generation`, `kill.integration_sync`, `kill.data_upload`, `kill.code_execution`, `kill.sharing`, `kill.writeback`, `kill.core_modules`) | under a minute | *exists*; AI switch drilled 29 September ([evidence](../evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json)) |
| 2. Stop writes | `VITE_READ_ONLY=true` for clients, `SEMESTER_READ_ONLY=on` for the gateway; the app keeps edits on the device | one redeploy | *exists* |
| 3. Web | re-run *Deploy to Pages* on the previous commit | 76–180 s measured | *exists* |
| 4. Function | re-run *Deploy Edge Functions* naming the function and an earlier commit | minutes | *exists* |
| 5. Configuration | restore the previous value; configuration is versioned and second-person published | minutes | *exists for configuration studio* |
| 6. Schema | **forward only.** Fix by a new migration; contract steps only after a full release with no reader of the old shape | n/a | *exists as a rule* |
| 7. Data | point-in-time recovery into a **new** instance, diff, selective restore; never overwrite production | hours | **unverified** ([07](07-RESILIENCE-BACKUP-DR-AND-CHAOS.md)) |

Every high-risk change records a rollback plan that was rehearsed on staging for that change.

## 3. Canary and rings, designed on the burn rules

A canary is only as good as its judge. The judge is `decide()` from `burn-alerts.ts` run against the canary cohort instead of the whole population, so there is one definition of "bad" for monitoring and for promotion.

| Ring | Who | Promote when | Abort when |
| --- | --- | --- | --- |
| 0 | the owner and a staging tenant | CI and staging smoke green | any failing test |
| 1 | an invited cohort (the activation control plane already gates by tenant) | **no** burn rule firing and `complete: true` for the minimum soak, with at least `MIN_EVENTS` eligible events per journey touched | any page rule firing; any P0 signal |
| 2 | design-partner tenants | the same, over a longer soak | same, plus any connector freshness breach |
| 3 | everyone | the same | same |

Two honest limits. With ten to thirty users, a canary cohort rarely clears the event floor, so ring 1 for a small product is a *soak with a synthetic user*, not a statistical test: the verdict is `insufficient_data` and promotion needs a human's decision, recorded. And there is nothing to route traffic by on a static host with a single backend, so for now a "canary" is a flag-gated rollout (the repository already has 28 flags) rather than a traffic split. Both become real with the CTO pack's rings and `core` container.

Automatic abort writes the kill switch for the flagged capability; it never "fixes forward" on its own, and automation may not weaken authentication, override consent, or retry an ambiguous official write (`AUTOMATION_MUST_NOT` in `lib/incident-recovery.ts`).

## 4. Configuration

1. **Configuration is code or versioned data.** Tiered settings go through the configuration studio (`CONFIGURATION-TIERS.md`): second-person publish, an audit event, and a previous version to return to. A setting nobody can roll back is not configuration, it is an incident waiting.
2. **Environment drift is a defect.** The public `VITE_*` values come from repository variables; a function's secrets come from the secret store. A test or job compares what the catalog says each component needs with what is set (names only, never values) — to be built with the secret-inventory test that exists (`security.test.ts`, `secrets.test.ts`).
3. **Deploy flags are inputs to the gate.** `VITE_READ_ONLY`, `SEMESTER_READ_ONLY`, `BILLING_LIVE_ENABLED` and `SEMESTER_SCIM` change behaviour without a code change; they are high-risk changes and carry the same record.

## 5. Secrets

The inventory and rotation log are [SECRETS.md](../../SECRETS.md) and stay the register. What this pack adds:

- **Every secret has an owner role, a rotation interval and a revocation runbook** — the last is [RB-13](runbooks/RB-13-secret-exposed.md).
- **`SUPABASE_ACCESS_TOKEN` is the highest-value deploy credential** (it can deploy functions); rotate quarterly until workload identity replaces it.
- **Rotation is a high-risk change**: second person approves, announce window, rollback plan (the old value is revoked, so the rollback is a *second rotation*, which is why the order of steps matters).
- **A secret in no store** is a finding, not a convenience (SECRETS.md lists two today).
- **Public build variables can never carry a secret-shaped value**; CI already scans.

## 6. Change management

**Two governed paths, one vocabulary.** Changes to Terraform-managed infrastructure (Supabase project settings, Vercel, the repository's own protections) follow [docs/infrastructure/CHANGE-CONTROL.md](../infrastructure/CHANGE-CONTROL.md): a `CC-<pr>.md` change record, then `infra-apply.yml`, with a daily drift check (`pipeline:drift`, [RB-16](runbooks/RB-16-infrastructure-drift.md)) and its own *standard*, *emergency* and *break-glass* paths. The classes below cover everything else: application code, functions, schema, configuration, secrets and data. They use the same words on purpose, and `emergency` means the same thing in both: a fix for something down or exposed now, followed by a record. Nothing here replaces the infrastructure path; `gate()` is not wired to it.

Four classes (`CHANGE_CLASSES`), each saying what must be attached, how many approvals, and whether a freeze blocks it:

| Class | Examples | Requires | Approvals | Freeze blocks |
| --- | --- | --- | ---: | --- |
| Standard | copy, style, a flagged-off feature, a green patch bump | green CI | 1 | no |
| Normal | a behaviour change to a live journey, a new function or job | green CI, rollback plan, named owner, catalog row and runbook for anything new | 1 | yes |
| High risk | schema migration, secret rotation, auth/policy/billing/retention change, a tier-3 setting | all of normal, rehearsed rollback, fresh backup reference, expand/contract shape, second person, announced window | 2 | yes |
| Emergency | a fix for an open P0 or P1 | open incident id, commander approves, review scheduled | 1 | no |

`gate(change, windows)` returns `allowed` and the reasons. It is a pure function with tests:

- a high-risk change with one approval is refused; with two and every attachment it passes;
- a normal change inside a freeze is refused with the window named, and passes the day after;
- an emergency change inside a freeze passes **only with an incident id**;
- **with no freeze calendar a high-risk change is refused as `no_calendar`**, because "no freeze is defined" is not "no freeze applies".

The freeze calendar is an **owner decision not yet made** (DEGRADED-MODE-MAP.md). `CRITICAL_PERIODS` lists what earns a freeze, in the owner's order; the calendar itself is input, generated from the academic calendar once someone approves it.

A **change record** is one line in `CHANGELOG.md` plus, for high-risk changes, a release note naming: what changed, who approved, evidence links, flags changed, migrations applied, and the rollback plan that was rehearsed.

## 7. Schema changes

Expand → migrate → contract (CTO pack 06 §4): add nullable and concurrent; ship code that writes both shapes; backfill in idempotent, resumable batches; shadow-read before switching; contract in a later release, after the rollback window, with a fresh backup. The 171 baseline migrations are never rewritten. A migration that locks for more than a second in staging rehearsal is rejected. **A schema change is never part of an emergency**: forward-fix with the smallest safe migration, and do it only with the database healthy.

## 8. Order of work

1. Add the **schema deploy** to what is watched: alert `deploy:schema-failed` is `manual` today; make the dashboard's branch record something a machine reads, or add a scheduled check that compares `ledger.snapshot` with the live ledger.
2. Create the freeze calendar from the academic calendar and wire `gate()` into the pull-request template as a required checklist, then into a CI step.
3. Time a rollback of each rung once, in staging, and write the measured times into the table above.
4. Ring 1 as a flag-gated rollout with a synthetic user; promotion recorded by a human until the event floor can be met.
