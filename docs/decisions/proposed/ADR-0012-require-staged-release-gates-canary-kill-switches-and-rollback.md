# ADR-0012 · A change reaches production through required checks, a staged rollout with a kill switch, and a rollback that has been exercised

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Platform and release owner |
| Deciders / reviewers | Founder; security owner; database owner |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate (ruleset applied and read back; restore drill; alert delivery); Phase 2 (canary, drift) |
| Related | `findings-platform.md` #1-#5, #7, #12; `docs/RELEASE-GATES.md`; `docs/BRANCH-PROTECTION.md`; `.github/rulesets/main.json`; `ROLLBACK.md`; `RESTORE.md`; `MONITORING.md`; `supabase/DEPLOY.md`; `infra/README.md`; `FITNESS_FUNCTIONS.md` #13-#20; ADR-0001, ADR-0006 |
| Supersedes / superseded by | — |

## Context
- Live read on 2026-10-04: `rules/branches/main` `[]`, `rulesets` `[]`, `branches/main` `protected:false`; `docs/BRANCH-PROTECTION.md` "Applied" table empty. `.github/rulesets/main.json` would require `build`, `secrets`, `account-sync`; nothing is required today (`findings-platform.md` header).
- Main is red often: of the latest 100 `ci.yml` push runs, 52 success, 48 failure (build `Test` 40, account-sync Supabase start 15, Load 4, install 6, budgets 1); on 10-04, 47 of 85 failed including 11 consecutive `Test` failures 17:52-18:03Z (`findings-platform.md`). `pages.yml`/`functions.yml` skip on failed CI, so deploy is gated; merges are not.
- Migrations reach production by Supabase Branching on merge (`supabase/DEPLOY.md:511`), no workflow and no rollback; `ROLLBACK.md` records an 18 Sep silent failure (`findings-platform.md` #12).
- `functions.yml` deploys service-role functions with `--no-verify-jwt` (`.github/workflows/functions.yml:239`) with no environment gate; `SUPABASE_ACCESS_TOKEN` is account-wide; exceptions in `infra/policy/exceptions.json` expire 2026-12-31.
- Restore and PITR never exercised on the live project: `RESTORE.md` result tables empty; the only rehearsal is a local throwaway DB with one account (`docs/evidence/restore/2026-09-30-logical-rehearsal.md`); `supabase/restore-drill.sh` written, never evidenced; LAUNCH-RISK FR-005 (P0).
- Production probes have no alert path: `.github/workflows/production-smoke.yml` has no notify step; `status-data` has 75 samples vs about 24 per day expected (`FITNESS_FUNCTIONS.md` #16).
- Staging levers that exist: release cohorts on flags, `tenant_rollout` and plan tables (`docs/RELEASE-GATES.md:91`; `supabase/migrations/20260928050000_tenant_rollout.sql`); kill-switch keys `kill.integration_sync`, `kill.ai_generation`, `kill.data_upload`, `kill.code_execution`, `kill.sharing`, `kill.writeback`, `kill.core_modules` (`20260930010000_module_mode.sql:46-47`). A canary mechanism beyond cohorts was not found.
- Production SPA is served from GitHub Pages so `app/vercel.json` headers do not apply (`infra/README.md` R-2). IaC is unapplied; `drift.yml` and `infra-apply.yml` have 0 hosted runs (`findings-platform.md` header).

## Problem
What must be true before a change reaches users, how is exposure widened in steps, and how does the operator get back?

## Decision drivers
1. A red or unreviewed commit cannot reach production.
2. A new risky capability ships behind a kill switch and a cohort.
3. Rollback and restore are exercised, dated, and witnessed before they are relied on.
4. No claim of readiness from a gate that has not run.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Status quo: CI reports, deploy skips on red | No new process | Merge not gated; migrations bypass the deploy gate | Rejected |
| B. Manual checklist per release (`REGRESSION-CHECKLIST.md`) | Flexible | Last run 2026-09-21; depends on one person | Kept as supplement |
| C. Apply the ruleset, add environment gate for function deploy, cohort-based rollout, exercised restore and rollback | Uses existing artifacts | Operator time; needs second reviewer | Chosen |
| D. Full blue-green/canary infrastructure (Terraform) | Strongest | `infra/` unapplied; one operator | Deferred to Phase 2 |

## Decision
**Recommended, unratified; no agent can accept it.**
1. Apply `.github/rulesets/main.json` and file the readback (`docs/BRANCH-PROTECTION.md`); required contexts `build`, `secrets`, `account-sync`; add `infra.yml` policy job.
2. Stages: pull request checks; merge to main when green; preview-branch migration and smoke; cohort release by `tenant_rollout`/flags; general availability only after a dated evidence record.
3. Every feature with a data or provider side effect has a `feature_kill_switch` key and a drill record no older than 90 days.
4. Each migration carries a rollback note (reverse SQL or forward-fix statement); schema-changing merges are noted in `ROLLBACK.md`.
5. A live restore drill (`supabase/restore-drill.sh`, second project, non-author witness) precedes the Phase 1 gate; repeat at most every 91 days.
6. A failing production probe opens an issue (as `ci.yml` job `notify` does) within 15 minutes.
7. `functions.yml` deploys behind an environment with a reviewer or a recorded written acceptance.

## Consequences
Positive: merges and deploys become refusable. Negative: the one operator becomes a bottleneck for review (`findings-platform.md` #7); a red main blocks work. Harder: emergency fixes (use break-glass-style path with after-the-fact review).

## Impact
- **Data / tenancy:** cohorts are per school.
- **Security:** reduces ungated service-role deploys.
- **Privacy:** restore into a second project holds production data; handling is a counsel/ops question.
- **Accessibility:** a11y checks are among required contexts (ADR-0013).
- **Operations (SLO, alert, runbook, support):** probe cadence and alert; named backup; drills in `docs/evidence/`.
- **Cost / commercial:** second Supabase project for drills; CI minutes.

## Implementation
1. Apply ruleset and read back. 2. Diagnose the `Test` and Supabase-start failures to a threshold. 3. Notify job for `production-smoke.yml`. 4. Run the restore drill. 5. Environment gate. 6. Migration rollback-note check. 7. Scripts per fitness functions.

## Tests and verification
- Ruleset missing `required_status_checks`: `branch-protection-readback` fails (fails today: `[]`).
- Push a commit failing `Test` to a scratch branch: merge refused; deploy workflow refuses a stale release (`functions.yml` "Refuse a stale release").
- Engage `kill.ai_generation` in a preview: shared-key function returns 503; release returns 200 (drill file pattern, `docs/evidence/ai/killswitch-drill-*.json`).
- Probe failure injected: issue opened within 15 minutes.
- Control: a green commit passes every context.

## Fitness functions
- `branch-protection-readback` (`scripts/architecture/branch-protection-readback.sh`): live ruleset lacks required contexts.
- `main-health` (`scripts/architecture/main-health.mjs`): failure share over 7 days above threshold; red main without issue.
- `alert-delivery` (`scripts/architecture/probe-cadence.mjs`): fewer than 20 samples in 24 h; failed probe without issue in 15 min.
- `restore-drill-freshness` (`scripts/architecture/restore-evidence.mjs`): no non-local restore record in 91 days.
- `workflow-security-policy`, `drift-ran`, `release-evidence`, `dast-and-sast-freshness`, `secrets-and-rotation`.

## Rollback / reversal
Disable the ruleset (owner action) or remove a required context. Cheap, but losing required checks reopens ungated merges.

## Open questions
- Whether Pages deploy bytes need an attestation (`infra/README.md` R-3).
- Canary beyond flag cohorts: not found in repo.
- Counsel on production data in a drill project.

## Addenda
(none)
