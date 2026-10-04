# Change control

> **No manual production-only infrastructure drift without recorded change
> control.** This page is how that sentence is made true rather than hoped for.

## The three paths, and only these

| Path | When | What it leaves |
| --- | --- | --- |
| **Standard** | every planned change | pull request → `CC-<pr>.md` approved → `infra-apply.yml` (plan → policy → reviewer → apply → converge check) |
| **Emergency** | production is down or exposed *now* and the pipeline cannot be used | the manual change, then within one business day a pull request making the Terraform match, with `Kind: emergency` and why the pipeline was not used |
| **Break-glass access** | a human needs a console | time-boxed, logged below, and covered by the emergency path if anything is changed |

Anything else is drift.

## Enforcement, layer by layer

| Layer | Control | Status |
| --- | --- | --- |
| Source | `.github/rulesets/main.json` (review, code owner, last-push approval, required checks) — read by Terraform, so file and GitHub cannot disagree | Enforced / Coded |
| Pull request | `infra.yml`: format, init against committed provider hashes, validate, policy tests, workflows vs policy, change record present | Enforced |
| Record | `app/src/lib/ops/infrastructure.test.ts`: header, sections, approver, no placeholder, every policy exception points at a real record and has an expiry | Enforced |
| Plan | policy on the resolved plan: no destroy of a protective control without `Approved-destroys`; no create of an adopted resource in production; TLS; allow-lists; WAF on; environments gated | Coded |
| Apply | one workflow, `main` only, `infrastructure-production` environment with required reviewer, saved-plan hash verified, then a second plan that must be empty | Coded |
| Detection | `drift.yml` daily; opens/updates an `infra-drift` issue; fails the run | Coded |
| Humans | no standing write credential on any console is the goal; tokens live only in GitHub environments | Proposed (R-4) |

## Drift

A plan with changes against `main` means the live system differs from the
repository. Two ways out, both leave a record:

1. **Revert** — `infra-apply.yml` for that root under a `standard` record.
2. **Adopt** — a pull request changing the Terraform to match, `Kind: emergency`.

Not allowed: closing the issue, loosening the policy to make the plan pass, or
adding an exception without a record and an expiry.

## Policy exceptions

`infra/policy/exceptions.json`. Each has the workflow, the finding it covers,
the record that accepted it, a reason, and an expiry. An expired exception is
itself a violation, so "accepted for now" cannot become "forgotten". Today:
`functions.yml` (R-5) and `pages.yml` (R-6), both to 2026-12-31.

## Break-glass log

| Date | Who | System | Why | Change record |
| --- | --- | --- | --- | --- |
| — | — | — | none recorded | — |
