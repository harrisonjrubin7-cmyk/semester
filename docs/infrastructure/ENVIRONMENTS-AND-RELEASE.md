# Environments and release

Builds on [`docs/target-architecture/05`](../target-architecture/05-ENVIRONMENTS-AND-ROLLOUT.md)
(the ladder and rings) and [`STAGING.md`](../../STAGING.md). This page is only
what the infrastructure code adds or changes.

| Environment | Isolation | Created by | Data |
| --- | --- | --- | --- |
| preview | Supabase branch per PR touching `supabase/` (exists; eight live) | Supabase Branching | none (`with_data: false`) |
| staging | **separate Supabase project** + own Vercel edge settings, own state key, own credential | `envs/staging` (Coded; not applied) | synthetic only |
| production | the live project, adopted by `import` | `envs/production` | real |

Parity rule: staging and production call the same modules; a difference must be
a variable in a `.tfvars`. `STAGING.md` records that a preview branch "matches
production" is *unproven*; a staging root is how that becomes provable — apply,
then diff the two plans.

## Promotion

1. PR: `infra.yml` (fmt, validate, policy, record).
2. Merge to `main`.
3. `infra-apply.yml` on `staging` → converge check → smoke.
4. Same record, `production` → reviewer approves the *saved plan* → apply →
   converge check.

Application releases keep their existing gates (CI → `pages.yml`,
`functions.yml`). Infrastructure never rides along with an app deploy.

## Canary and rollback

| Layer | Mechanism | Status |
| --- | --- | --- |
| Capability | `feature_kill_switch` (drilled monthly, `drill:killswitch`) | Existing |
| Gateway code | Vercel instant rollback / rolling release (`vercel_project_rolling_release` is available in the provider; stages are a decision, not defaulted here) | Proposed |
| Web (Pages) | redeploy previous commit; 76–180 s measured (`ROLLBACK.md`) | Existing |
| Infrastructure | revert the commit, `infra-apply.yml` under a new record; the converge check proves it took | Coded |
| Schema | forward-only (`ROLLBACK.md`) | Existing |

Terraform state is not a rollback mechanism for data: `prevent_destroy` guards
the project and firewall, and policy refuses a plan that destroys a protective
control without a named, approved destroy.
