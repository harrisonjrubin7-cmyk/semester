# Semester secure development lifecycle — controlled draft

- **Status:** `PARTIAL / REPOSITORY-CONTROLLED`
- **Owner:** Engineering owner with Security and Product
- **Evidence date:** 2026-10-03
- **Scope:** design, code, dependency, test, review, release, response and retirement

## Lifecycle

1. Define intended users, authority, data, trust boundaries, abuse/safety cases, accessibility, AI/provider use, dependencies and failure modes.
2. Classify risk and require threat/privacy/accessibility review for material identity, tenant, data, integration, AI, payment, official-write or privileged changes.
3. Implement least privilege, secure defaults, input/output handling, tenant/resource authorization, minimization, audit, feature flags/kill switches and safe failure.
4. Use locked dependencies, approved licenses/sources/actions, secret scanning and reproducible installation.
5. Run types, lint, unit/integration/database-policy/authorization, negative/adversarial, accessibility, build, dependency and security checks proportional to the change.
6. Review code and evidence; resolve or formally accept findings through authorized risk/deviation controls.
7. Release a pinned artifact with rollback, monitoring, incident/support ownership and evidence; verify the target environment.
8. Monitor vulnerabilities, incidents, provider/dependency drift and customer impact; patch, mitigate, disable, roll back or retire safely.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| CI quality/security gates | workflows, policy suites, supply-chain tests and scanners | branch/rule enforcement and release approvals need current proof | `PARTIAL` | Engineering/Security | target governance export and release sample |
| threat/privacy design | architecture, risks and selected threat documents | consistent per-change records absent | **DESIGNED / PARTIAL** | Product/Security/Privacy | required template and sampled reviews |
| code review/change control | Git workflow and templates | reviewer/segregation operation not fully evidenced | `PARTIAL` | Engineering | protected-branch/current review evidence |
| test/adversarial coverage | extensive unit, policy and browser suites | target DAST and independent test absent | `PARTIAL` | Engineering/Security | DAST, pen test and negative coverage map |
| release/rollback/monitoring | workflows and runbooks | target rollback/alert/support evidence incomplete | `PARTIAL` | Operations/Engineering | representative signed release and drills |

## Required change record

`[CHANGE/PR]`, owner/reviewer, risk tier, data/authority boundaries, threat/privacy/accessibility/AI review, tests/scans, findings/exceptions, dependencies/licenses, artifact/commit/SBOM, release/rollback/monitoring, target verification, customer impact, approval and evidence expiry.

## Claim ceiling and activation blockers

Permitted: “Semester runs extensive repository-controlled quality, authorization, supply-chain and security checks.” Prohibited: mature/complete SDLC, every change independently reviewed, zero vulnerabilities, secure software, signed provenance, current DAST or independently penetration-tested. Blocks: named owners/backups, adopted risk gates, branch/review evidence, threat-model coverage, immutable release approvals/attestation, target DAST, finding remediation records, independent assessment, release/rollback/monitoring exercises and metrics.
