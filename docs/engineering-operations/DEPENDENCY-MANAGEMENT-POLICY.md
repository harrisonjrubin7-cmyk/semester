# Dependency Management Policy

| Control | Value |
| --- | --- |
| Status | **CONTROLLED POLICY — LOCK/PROVENANCE/LICENSE GUARDS PRESENT; RESPONSE EVIDENCE PARTIAL** |
| Owner | Harrison Rubin — engineering and security approver; backup reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |
| Canonical inventory | [`../SUPPLY-CHAIN.md`](../SUPPLY-CHAIN.md), lockfiles and `app/src/lib/supplychain.ts` |

## Admission and maintenance

1. Prefer platform/current dependencies already in the product. A new package requires an owner, purpose, alternatives, runtime/build scope, data/network access, bundle impact, maintenance health, license and security/provenance review.
2. Pin resolved npm content through the committed lockfile and install with `npm ci`. Approved registry, integrity, license and GitHub Action publisher/SHA controls must remain green.
3. Treat build-time tools and Actions as supply-chain code even when they do not ship. Grant workflow permissions explicitly and minimally; no floating Action tags.
4. Dependabot monitors `app/` and GitHub Actions weekly. Minor/patch changes may be grouped; major changes receive isolated review. The documented omission of `video/` and `pipeline/` is an accepted scope gap, not evidence those trees are risk-free.
5. Run applicable typecheck, tests, build, bundle budgets, license/provenance checks and advisory review on the exact change. Generate the production CycloneDX SBOM for deploys and retain it with the release evidence.
6. For an advisory or compromise, establish affected version/reachability/data scope; patch, disable, isolate or roll back by severity; rotate exposed credentials; preserve decisions and customer/legal communication evidence when required.
7. Remove unused packages and stale exceptions. An exception states risk, compensating control, owner, affected surfaces and expiry; expired exceptions block release.

Internal remediation targets remain those in `docs/SUPPLY-CHAIN.md`: critical 2 days, high 14, medium 60 and low 180. They are internal risk targets, not contractual response promises. A passing `npm audit` is a time-bounded advisory lookup, not proof that a dependency is secure.

## Evidence state

**Code/config evidence.** Exact lockfile installation, advisory reporting, Dependabot, registry/integrity/license tests, pinned approved Actions, secret scanning and deploy SBOM generation are represented in the repository.

**Operational evidence.** Current evidence does not establish signed build provenance, complete monitoring of every non-shipping tree, supplier-compromise exercises, per-release impact assessment or consistently retained customer-impact records.

**Missing test/proof.** Preserve the exact-candidate audit/test/SBOM outputs; review open update/advisory queues; exercise a compromised-package response and credential rotation; add release provenance/impact records; resolve or time-bound open license decisions and assign a backup reviewer.

## Claim ceiling

Semester may say its shipped app uses locked dependencies with repository-enforced provenance/license controls, advisory automation and deploy SBOM generation.

## Prohibited claims

Do not claim a vulnerability-free supply chain, continuous monitoring of every tool, signed/reproducible builds, complete SBOM retention, contractual patch times or third-party security assurance without corresponding current evidence.
