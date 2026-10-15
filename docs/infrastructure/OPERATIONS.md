# Operations: monitoring, cost, access, recovery testing

Application monitoring is [`MONITORING.md`](../../MONITORING.md) (one waking
alert, a weekly ten minutes, one owner, no rota). Infrastructure adds one signal
to that review and no new pager.

## Infrastructure signals

| Signal | Source | Cadence |
| --- | --- | --- |
| Drift | `drift.yml` issue + red run | daily |
| Policy exception expiry | `infra.yml` fails when one lapses | every PR |
| Attestation verifies | `supply-chain.yml` | each main change + weekly |
| Edge blocks / rate-limit hits | Vercel firewall logs | weekly review |
| Supabase advisors | `get_advisors` security/performance | weekly review |

## Cost controls

| Control | Detail | Status |
| --- | --- | --- |
| Preview-branch hygiene | eight preview projects are live (4 Oct); each is billed. Review weekly; delete branches of merged/closed PRs | Proposed — first action |
| Staging is one project, not one per PR | `envs/staging` | Coded |
| Deployment retention | previews 1 month, production 1 year (`vercel_project_deployment_retention`) | Coded |
| Edge rate limit | refuses floods before a function bills | Coded |
| Budget alerts on Supabase, Vercel, AI provider | set in each console; record the thresholds here | Proposed |
| Unit cost | AI cost per active student is already tracked app-side | Existing |

## Access review (quarterly; first within 30 days of activation)

Checklist, evidence saved to `docs/infrastructure/reviews/<date>.md`:

1. GitHub: collaborators, deploy keys, installed apps, environment reviewers.
2. Supabase: org members, access tokens (revoke unused), API keys age.
3. Vercel: team members, tokens, integrations.
4. State store: who holds the credential; last rotation.
5. Secrets: every row of `SECRETS.md` has an owner and last-rotated date.
6. Break-glass log (CHANGE-CONTROL) — every entry has a record.
7. Policy exceptions — each still needed, none within 30 days of expiry.

## Recovery testing cadence

Quarterly DR drill; monthly kill-switch drill (existing); every apply is a
converge test.

## Runbooks

| Event | First move |
| --- | --- |
| Drift issue opens | read the plan in the issue; decide revert or adopt (CHANGE-CONTROL) |
| Policy denies an apply | the message names the resource; fix the plan, or write the destroy/exception record — do not edit the policy |
| Secret leaked | the row's "Revoked by" in `SECRETS.md`; then rotate the Actions copy |
| Bad apply | revert commit → `infra-apply.yml` with a new record; converge check proves it |
| State lost/corrupt | restore the previous object version; if gone, `terraform import` per root (the `import` blocks are the list) |
