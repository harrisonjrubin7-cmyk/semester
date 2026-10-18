# Semester security and trust risk treatment plan — controlled draft

- **Status:** `INCOMPLETE / NO ADOPTED RISK APPETITE`
- **Owner:** Harrison Rubin, Executive Risk/Security/Privacy/Accessibility/AI/Operations/Product primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Approval:** authorized governing/customer authority according to risk ownership

## Treatment rule

Risk ratings and acceptance require accountable human judgment and current evidence. Missing evidence cannot lower residual risk. Treat by avoiding the activity, mitigating through verified controls, transferring only through confirmed contract/insurance, or accepting through an authorized, time-bounded record with monitoring and expiry. P0/P1, unlawful, unauthorized or safety-critical risk cannot be silently accepted.

## Priority treatment plan

| Risk | Current evidence/state | Treatment and exit evidence | Owner/backup | Due/review | Decision/blocker |
| --- | --- | --- | --- | --- | --- |
| unstaffed security/privacy/support/recovery | roles and runbooks designed; backups absent | name/train owners, route alerts, exercises and coverage record | Harrison Rubin / backup `UNASSIGNED` | weekly; before any supported launch | avoid paid activation |
| cross-tenant/authorization scope gaps | strong repository suites; target/named-tenant proof absent | complete negative matrix, target acceptance and independent test | Harrison Rubin / customer security `UNASSIGNED` | before institutional activation | open P0/P1 blocks activation |
| incomplete vulnerability/adversarial assurance | scans/tests; target DAST and pen test open | DAST, finding closure, independent report/re-test | Harrison Rubin / independent assessor `UNASSIGNED` | before paid pilot | no security assurance claim |
| recovery/backup/key-person failure | logical rehearsal/runbooks; production restore and backup owner absent | provider settings, timed isolated restore, backup operator and corrective actions | Harrison Rubin / backup operator `UNASSIGNED` | before supported production or RTO/RPO claim | no RTO/RPO or broad launch |
| privacy/data/provider/AI authority gaps | inventories/policies partial; contracts/customer/terms open | approved map, roles, providers, age/jurisdiction, lifecycle and evaluations | Harrison Rubin / qualified/customer authorities `UNASSIGNED` | before affected processing activation | keep affected processing disabled |
| accessibility barrier | automated evidence; qualified manual/ACR absent | manual assessment, remediation/retest and support route | Harrison Rubin / qualified assessor `UNASSIGNED` | before broad individual or paid pilot | no conformance/enterprise claim |
| unsupported commercial/legal claim | claim controls/drafts; approvals external | qualified review, evidence, monitoring and withdrawal | Harrison Rubin / counsel `UNASSIGNED` | before publication, signature or payment | no publication/signature/payment |

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Missing test/proof |
| --- | --- | --- | --- | --- |
| company risk register | [`docs/company/RISK-REGISTER.md`](../company/RISK-REGISTER.md) | ratings/appetite/acceptances not adopted | `DRAFT` | governing review and signed decisions |
| launch risk register | [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) | external/customer gates open | **ACTIVE / OPEN** | dated closure evidence |
| security/privacy control evidence | trust registers, tests and source documents | target/independent/operated evidence incomplete | `PARTIAL` | control exercises and reviews |
| exceptions/acceptance | exception and deviation templates | no complete operating sample | `DESIGNED` | authorized record with expiry and monitoring |

## Required risk record

`[RISK ID]`, cause/event/consequence, assets/users/data/customers, category, inherent likelihood/impact, controls/evidence, residual likelihood/impact, treatment/actions, dependencies, owner/back-up, target/expiry, monitoring/indicators, exception/acceptance authority, customer ownership, verification and closure evidence.

## Claim ceiling and activation blockers

Permitted: “Semester maintains draft risk registers and evidence-linked treatment requirements.” Prohibited: risks controlled/accepted, defined enterprise risk appetite, complete risk inventory, insured transfer, or readiness based on unscored templates. Blocks: adopted scales/appetite/authority, named owners/backups, completed ratings, funded actions/dates, target and independent evidence, customer-owned decisions, exception/expiry review, metrics, residual acceptance and no open P0/P1.
