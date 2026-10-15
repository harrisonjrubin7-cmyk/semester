# Semester information security program — controlled draft

- **Status:** `PARTIAL / NOT OPERATIONALLY ACCEPTED`
- **Executive owner:** Harrison Rubin
- **Security owner/backup:** Harrison Rubin / `UNASSIGNED`
- **Evidence date:** 2026-10-03

## Program objective

Protect confidentiality, integrity, availability, safety, privacy, and tenant boundaries through risk-based governance, architecture, identity/access, secure development, vulnerability management, logging/monitoring, incident response, continuity/recovery, vendors, data lifecycle, AI/integration controls, training, and evidence. This program is not a certification, penetration-test result, guarantee, or proof of production operation.

## Control program

| Domain | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| governance/risk/assets | policies, registers and control mapping | owners/cadence/risk acceptance incomplete | `DESIGNED` | Executive/Security | operating reviews and asset reconciliation |
| identity/access/tenancy | auth, MFA, capability, RLS and isolation tests | named-tenant acceptance/access reviews absent | `VERIFIED — REPOSITORY` | Security/Engineering | target negative tests and review |
| secure development/supply chain | CI, review, secret/dependency/license controls | release-operation and signed provenance gaps | `PARTIAL` | Engineering/Security | immutable release evidence |
| vulnerability/testing | scans and test suites; HawkScan currently unavailable here | independent pen test and current target DAST absent | `PARTIAL` | Security/Engineering | DAST plus independent scoped assessment |
| logging/monitoring/incident | audit, monitoring and incident designs/tests | staffed alerting/tabletop incomplete | `PARTIAL` | Security/Operations | target alert and incident exercise |
| continuity/recovery | backup/restore/rollback designs and partial exercises | provider/production timed restore incomplete | `PARTIAL` | Operations | target restore and continuity exercise |
| data/privacy/vendors/AI | inventories, policies and gates | contracts, reviews, customer acceptance incomplete | `PARTIAL` | Privacy/Security/AI | target/provider/customer evidence |

The [information-security questionnaire](../market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md) is a response framework, not a completed customer answer or certification.

## Claim ceiling and activation blockers

Permitted: “Semester has extensive repository controls and tests plus a draft security program.” Prohibited: secure/compliant/certified, independently tested, complete vulnerability coverage, monitored 24/7, proven recovery, or production customer operation. Blocks: named accountable owners/backups, adopted policies/cadence, asset/risk inventory, immutable candidate evidence, target DAST/monitoring/access/recovery/incident tests, independent review, vendor evidence, training, exceptions, metrics, and signed GO.
