# Semester threat model — controlled trust index

- **Status:** `PARTIAL / REQUIRES REVALIDATION`
- **Owner:** Harrison Rubin, Security/Engineering/Privacy/AI/Product primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Primary technical source:** [`docs/SECURITY-THREAT-MODEL.md`](../SECURITY-THREAT-MODEL.md), originally assessed at an earlier revision

## Scope and method

Protect student/personal/education data, identity and authorization, tenant/resource isolation, official/institutional boundaries, service availability, financial/entitlement state, AI/provider boundaries, audit evidence, code/release integrity and company/customer secrets. Review by asset, actor, entry point, trust boundary, data flow, STRIDE-style threat, abuse/safety case, likelihood/impact, controls, evidence, residual risk and treatment.

The source model contains detailed boundaries and threats but is not a penetration test and cannot be assumed current for every later schema, feature, provider, integration or deployment change.

## Current priority threats

| Threat area | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| account/session/privileged compromise | auth, session, MFA and access tests | full console/target MFA and recovery evidence absent | `PARTIAL` | Security/Identity | target adversarial lifecycle |
| cross-account/tenant/resource access | RLS/capability/isolation suites | named-tenant target acceptance absent | `VERIFIED — REPOSITORY/PARTIAL SCOPE` | Security/Data | complete target negative matrix |
| untrusted input, XSS/SSRF/injection | parsers, guards and selected negative tests | authenticated target DAST absent | `PARTIAL` | Engineering/Security | DAST/manual and bypass testing |
| AI prompt/tool/data abuse | policy, injection and kill-switch sources | full live-model evaluation and approved-provider operation absent | `PARTIAL` | AI/Security/Privacy | scored red-team/evaluation |
| provider/integration/webhook compromise | signature/scope/replay/adapter controls | real provider/tenant acceptance absent | `CONDITIONAL` | Integrations/Security | target provider exercise |
| release/supply-chain compromise | locked dependencies, action allowlist, scans, SBOM | signed provenance and compromise drill absent | `PARTIAL` | Engineering/Security | attestation and supplier drill |
| loss/corruption/outage | restore/rollback/continuity sources | production backup restore and staffed response incomplete | `PARTIAL` | Operations | target restore/incident exercise |
| insider/support misuse | scoped support/break-glass/audit tests | periodic access/audit review absent | `PARTIAL` | Security/Privacy | operated review and misuse drill |

## Required threat record

`[THREAT ID]`, assets/data/users, actors/capabilities, boundaries/entry points, scenario/preconditions, existing controls, source/operational/independent evidence, likelihood/impact, residual risk, owner, treatment, verification, monitoring, incident/kill switch, customer dependency and review trigger.

## Claim ceiling and blockers

Permitted: “Semester maintains a detailed repository-informed threat model and security control tests.” Prohibited: complete/current attack-surface coverage, adversarially validated controls, secure platform, mitigated top risks, or penetration-tested status. Blocks: current architecture/asset/data-flow reconciliation, target configuration, all new boundaries/providers/features, abuse cases, named owners, DAST/independent testing, AI red team, recovery/incident drills, risk treatment and customer acceptance.
