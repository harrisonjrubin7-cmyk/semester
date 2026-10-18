# Infrastructure as code

Everything that decides **what production is and who can change it** is code
in this directory, checked by policy in CI, and changed only by a pipeline that
leaves a record. The prose is in [`docs/infrastructure/`](../docs/infrastructure/README.md);
this page is the map and the risk register.

```
infra/
├── terraform/
│   ├── modules/
│   │   ├── github_governance/   default-branch ruleset (read from .github/rulesets/main.json),
│   │   │                        environments + reviewers, Actions allow-list, SHA pinning, token scope
│   │   ├── supabase_project/    database settings: TLS, direct-access allow-list, auth/API settings
│   │   └── vercel_gateway/      WAF (OWASP set, bot rules), edge rate limit, deployment retention
│   └── envs/
│       ├── platform/            repository-level controls (own state, own credential)
│       ├── staging/             a separate Supabase project + the edge in front of it
│       └── production/          adopts the live project by `import`; cannot create or destroy it
├── policy/                      Rego: plan policy, workflow policy, their tests, dated exceptions
└── changes/                     one change record per pull request (CC-<pr>.md)
```

## What is real and what is not yet

Nothing below has been applied. The modules validate with Terraform 1.15.9 and
the policy is tested (including against a plan Terraform actually produced),
but **no credential, state store or second environment exists yet**; the
checklist is [`docs/infrastructure/ACTIVATION.md`](../docs/infrastructure/ACTIVATION.md).
Until it is done, `drift.yml` reports **NOT CHECKED** — never clean.

| Status | Meaning |
| --- | --- |
| **Enforced** | runs on every pull request today (`infra.yml`, the vitest suite) |
| **Coded** | written, validated offline, waiting on activation |
| **Proposed** | described, not yet written |

| Requirement | Where | Status |
| --- | --- | --- |
| IaC, reproducible | `terraform/`, provider hashes in `.terraform.lock.hcl`, `-lockfile=readonly` | Enforced (fmt, init, validate) / Coded (apply) |
| Environment isolation | separate roots, state keys, credentials, GitHub environments | Coded |
| Least privilege | workflow token `read`, `id-token` only on the job that needs it, environment-scoped secrets | Enforced for new workflows; two legacy exceptions (below) |
| Secrets | register stays `SECRETS.md`; none in tfvars; sensitive vars from environment | Enforced (tests) |
| Network controls | DB direct-access allow-list, TLS required; edge WAF + rate limit | Coded |
| Policy-as-code | `policy/` — 44 tests, mutation-checked | Enforced |
| CI/CD security | SHA-pinned actions, approved-actions register, gated apply | Enforced |
| SBOM, provenance, signing | `supply-chain.yml` (Sigstore via GitHub attestations) | Coded; R-3 |
| Drift | `drift.yml` daily | Coded |
| Change control | `CC-<pr>.md` required by `infra.yml` + tests | Enforced |
| Backup / DR | [`DISASTER-RECOVERY.md`](../docs/infrastructure/DISASTER-RECOVERY.md) | **Not proven** — PITR unverified |
| Canary / rings | [`ENVIRONMENTS-AND-RELEASE.md`](../docs/infrastructure/ENVIRONMENTS-AND-RELEASE.md) | Proposed |

## The rule

**No production-only change.** Production is changed by `infra-apply.yml`
under an approved [change record](changes/README.md), and by nothing else. A
change made any other way is drift: `drift.yml` finds it within a day, opens an
issue, and it is closed by reverting or by adopting it through a pull request
with an `emergency` record — never by editing the issue closed.

## Risk register

| ID | Risk | Why it stands | Next step |
| --- | --- | --- | --- |
| R-1 | **No four-eyes on production.** One maintainer, so `prevent_self_review` is `false` | A required reviewer who is also the author is a pause, not a control | Add a second reviewer, flip the variable, remove the exception from `platform/terraform.tfvars` |
| R-2 | **The SPA is on GitHub Pages**: no WAF, no response headers; its CSP is a `<meta>` tag | Pages cannot add them. The firewall module covers the Vercel gateway only | Move the SPA behind an edge that can (Vercel or a CDN), as a decision |
| R-3 | **Attestation covers the CI bundle, not the Pages bytes** | `pages.yml` builds with other variables, so the hashes differ; attesting the wrong file would be false signing | Attest the artifact `pages.yml` uploads, proven against a real deploy |
| R-4 | **`SUPABASE_ACCESS_TOKEN` is account-wide** (`SECRETS.md`) | Supabase offers no project-scoped management token | Separate Supabase organisation for staging; rotate quarterly |
| R-5 | **`functions.yml` deploys the service-role half with no environment gate** | Recorded as a policy exception, expires 2026-12-31 | Decide: add the approval, or accept in writing |
| R-6 | **`pages.yml` grants `id-token: write` workflow-wide** | Needed by the deploy job only; narrowing must be proven on a real deploy | Move to the job; remove the exception |
| R-7 | **Backups unverified** | `RESTORE.md`: PITR "not verified" | Run the drill; record plan tier, retention, restore time |
| R-8 | **Eight Supabase preview branches are live** (read 2026-10-04) | Each is a billed project; none is expired by policy | Cost control in `OPERATIONS.md` |
