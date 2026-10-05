# Semester security questionnaire — controlled response framework

- **Status:** `PARTIAL / CUSTOMER-SPECIFIC RESPONSE NOT APPROVED`
- **Owner:** Security owner with Engineering, Privacy, Accessibility, Operations, Legal, AI, Product, and customer approvers
- **Evidence date:** 2026-10-03

## Response rule

Answer each buyer question with `IMPLEMENTED`, `PARTIAL`, `PLANNED`, `NOT APPLICABLE`, or `UNKNOWN`; exact scoped response; code/config evidence; operational/target evidence; owner; evidence date; customer configuration; gap/treatment; exception; and approver. Never convert a repository design, test, draft, provider statement, or future plan into an unqualified “yes.”

## Readiness map

| Domain | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| governance/assets/risk | security, asset, threat, risk and change controls | named seats, complete inventory and operated reviews absent | `PARTIAL` | Executive/Security | owners, cadence, evidence samples |
| identity/access/tenancy | auth, SSO/SCIM, MFA, capabilities and RLS tests | target provider and two-tenant acceptance absent | `PARTIAL` | Security/IAM | target UAT, access review, console proof |
| encryption/SDLC/vulnerability | encryption, CI, secret/dependency and testing controls | provider assurance, target DAST and independent test absent | `PARTIAL` | Security/Engineering | current candidate and external assessment |
| logging/incident/recovery | smoke, audit, status, runbooks, rollback and logical restore | staffed alerts, tabletop and provider-backup restore absent | `PARTIAL` | Operations/Security | exercises, target evidence, accepted RTO/RPO |
| privacy/data/vendors | lifecycle, rights, subprocessor and vendor programs | legal bases/roles, contracts, regions and provider reviews incomplete | `PARTIAL` | Privacy/Vendor | counsel/customer/provider evidence |
| AI/accessibility/integrations/support | policies, tests, gates, roadmaps and playbooks | qualified external reviews and named-tenant acceptance incomplete | `PARTIAL` | Domain owners | target evaluations, UAT, staffing and sign-off |

The [existing questionnaire source](../market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md), HECVAT matrix, NIST matrix, and education-privacy matrix provide structured inputs; none is a completed customer response or certification.

## Claim ceiling and activation blockers

Permitted: “Semester maintains evidence-linked response materials with explicit implementation and operational status.” Prohibited: questionnaire approved, compliant/certified, all controls implemented, no exceptions, or institution-ready. Blocks: exact customer workbook/scope; named domain approvers; current candidate/environment evidence; provider/configuration proof; target testing/UAT; legal/privacy/accessibility determinations; incident/recovery exercises; exceptions; and signed release of every answer.
