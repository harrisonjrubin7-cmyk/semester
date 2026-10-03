# Semester threat model — controlled draft

- **Status:** `PARTIAL / REPOSITORY MODEL; TARGET VALIDATION OPEN`
- **Owner:** Security owner with Engineering, Privacy, Product, AI, Operations, and customer security authority
- **Evidence date:** 2026-10-03

## Scope and method

This canonical model governs the web client, authentication, APIs/functions, databases/storage, institutional gateway/integrations, payments, AI providers/tools, operator/support access, CI/CD, vendors, devices, backups, and customer boundaries. It uses assets, actors, trust boundaries, data flows, STRIDE/abuse cases, privacy/safety harms, control evidence, residual risk, test cases, owners, and change triggers.

The detailed [platform model](../SECURITY-THREAT-MODEL.md), [integration model](../INTEGRATION-THREAT-MODEL.md), and [AI Toolkit model](../ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md) are repository analyses, not penetration-test or target-operation results.

## Priority threat register

| Threat | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| cross-account/tenant access or privilege escalation | RLS, membership, capability, grant, support and break-glass controls/tests | named-tenant independent acceptance absent | `PARTIAL` | Security/Engineering | two-account/two-tenant target adversarial test |
| session/identity/provider compromise | auth/SSO/SCIM/MFA/refusal controls | target provider, recovery, console MFA and revocation evidence incomplete | `PARTIAL` | IAM/Security | provider lifecycle and account-takeover testing |
| injection, active content, unsafe fetch/import or secret exposure | validation/sanitization, destination, boundary, secret and content tests | current target DAST/manual assessment absent | `PARTIAL` | Security/Engineering | authenticated API/browser adversarial assessment |
| integration replay/forgery/duplicate or wrong official write | signature/nonce, journal, prepare/commit, idempotency and receipt controls | no live institution/provider write acceptance | `PARTIAL` | Integration/Customer | target negative, outage and reconciliation UAT |
| AI injection, leakage, tool escalation, unsafe output or cost abuse | fencing, policy, scope, kill-switch and limit sources | provider/model/tenant evaluation incomplete | `PARTIAL` | AI/Security | approved-model red-team and per-tenant drill |
| monitoring/recovery failure or key-person loss | smoke, status, runbooks, rollback and logical restore | no staffed rota or provider-backup recovery proof | `OPEN/PARTIAL` | Operations/Executive | alert, incident, key-person and restore exercises |
| supply-chain/CI/provider compromise | pinned workflows, audits, secret scans, lockfile/SBOM paths | signed provenance and provider assurance incomplete | `PARTIAL` | Engineering/Security | release attestation, provider review and independent test |

## Change triggers

Review before or after a new trust boundary, sensitive data field, identity/provider, customer/tenant model, official write, upload/active content, external fetch/webhook, AI model/tool/source, payment, cryptography/key store, privileged/support path, logging/analytics, dependency/runtime, deployment/provider/region, backup/recovery method, significant incident, penetration-test finding, or material regulatory/customer requirement.

## Claim ceiling and activation blockers

Permitted: “Semester maintains platform, integration, and AI repository threat models tied to control evidence and open risks.” Prohibited: complete threat coverage, independently validated model, penetration-tested controls, no exploitable path, or institution-specific acceptance. Blocks: current architecture/data-flow/asset reconciliation; target configuration; named owners; open-threat treatment; two-tenant and provider tests; target DAST/manual assessment; AI red-team; recovery/incident drills; independent penetration test; and signed review.
