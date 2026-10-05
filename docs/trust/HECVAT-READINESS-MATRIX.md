# Semester HECVAT readiness matrix — controlled draft

- **Status:** `PARTIAL / NOT A COMPLETED HECVAT`
- **Owner:** Security owner with Privacy, Accessibility, Operations, Legal, AI, Engineering, and customer approvers
- **Evidence date:** 2026-10-03

HECVAT is a higher-education assessment instrument, not a certification. The detailed [repository register](../market-readiness/HECVAT_READINESS.md) and [draft response](../market-readiness/HECVAT_DRAFT_RESPONSE.md) are inputs. Each buyer workbook must be answered against its exact version, institution, scope, environment, and evidence date.

## Domain readiness

| Domain | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| governance/risk | security program, asset/threat/risk/change controls | named owners, operating reviews and full evidence inventory absent | `PARTIAL` | Executive/Security | adopted program and sampled operation |
| identity/access/tenancy | SSO/SCIM, MFA, capability, RLS and audit controls | live IdP, access review and named-tenant test absent | `PARTIAL` | IAM/Security | target provider and two-account acceptance |
| application/SDLC/vulnerability | CI, secret/dependency, security-test and vulnerability sources | current target DAST and independent penetration test absent | `PARTIAL` | Engineering/Security | candidate results, assessment and retest |
| data/privacy/encryption/vendors | inventories, lifecycle, crypto, subprocessor and vendor controls | counsel/customer/provider evidence incomplete | `PARTIAL` | Privacy/Security | roles/bases, contracts, regions and target settings |
| logging/incident/continuity | smoke, audit, incident, rollback and logical restore controls | staffed alerting, tabletop, live-backup restore and RTO/RPO absent | `PARTIAL` | Operations/Security | integrated exercises and accepted measures |
| accessibility/AI/integrations/support | extensive policies/tests/plans | qualified reviews, approved providers, real connections and staffed support incomplete | `PARTIAL` | Domain owners | external review, target UAT and acceptance |

## Response record

`[HECVAT VERSION/QUESTION ID]`, exact question, scoped answer/status, code/config evidence, operational/customer evidence, owner, last verified, target configuration, gap/remediation/date, exception, confidential attachment, reviewer/approver and response-release date.

## Claim ceiling and activation blockers

Permitted: “Semester has an evidence-linked HECVAT readiness register and controlled response process.” Prohibited: HECVAT certified/compliant, HECVAT complete, all controls ready, independent assurance, or buyer acceptance. Blocks: exact workbook/version and scope; reconciled answers; current target evidence; named reviewers; target DAST/UAT; external penetration/accessibility/legal review; incident/restore exercises; customer configuration; exceptions; and authorized submission.
