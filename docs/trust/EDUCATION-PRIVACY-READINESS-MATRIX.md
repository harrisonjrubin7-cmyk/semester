# Semester education privacy readiness matrix — controlled draft

- **Status:** `PARTIAL / LEGAL AND CUSTOMER DETERMINATIONS OPEN`
- **Owner:** Privacy owner with Legal, Security, Product, Data, AI, Support, and institution privacy/records authorities
- **Evidence date:** 2026-10-03

Education-data obligations depend on jurisdiction, ages, institution role, data source, purpose, contract, policy, consent/authority, and deployment. Repository controls do not establish FERPA, COPPA, GDPR, state-law, or other legal compliance. Qualified counsel and each institution must determine applicability and roles.

## Readiness map

| Area | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| data/role/purpose inventory | data inventory, flow, processing and student-governance sources | legal roles, bases, ages, jurisdictions and institution-specific records incomplete | `PARTIAL` | Privacy/Legal | counsel/customer determinations and complete field map |
| minimization/access/tenant separation | minimization, access/IAM, capability/RLS and support-consent controls | named-tenant access review and negative UAT absent | `PARTIAL` | Privacy/Security | target roles, two-account tests and review evidence |
| notice/consent/rights | notice drafts, preference, export, deletion and request controls | publication/approval, identity verification, staffing and deadlines incomplete | `PARTIAL` | Privacy/Support/Legal | valid notice/authority, full lifecycle exercise |
| retention/deletion/holds/backups | retention/deletion standards, sweeps, restore controls | approved schedules, provider backup tail and hold operation incomplete | `PARTIAL` | Privacy/Data/Legal | jurisdiction/customer schedule and target proof |
| vendors/transfers/security | subprocessor/vendor, encryption, testing and incident controls | contracts, regions/transfers, provider reviews and external assurance incomplete | `PARTIAL` | Vendor/Privacy/Security | DPA/terms, region/transfer and assessment evidence |
| AI/analytics/community/minors | AI policies, minimization, cohort floors, age and community safeguards | approved use, provider terms, impact review and age/jurisdiction operation incomplete | `PARTIAL` | Privacy/AI/Product | use-case DPIA/assessment, target evaluation and customer approval |

The earlier [privacy-readiness source](../market-readiness/PRIVACY_READINESS.md) is historical input; the current trust controls supersede its missing-document observations where exact artifacts now exist, while its legal claim ceiling remains.

## Institution-specific record

`[DATA/PROCESS]`, subjects/ages, education-record or other category decision, institution/vendor role, source/authority/legal basis, purpose, fields/minimization, access/tenant, notice/consent, recipients/providers/transfers/regions, security, AI/automated use, retention/backup/hold/deletion, rights/corrections/export, incident/notice, contract/policy, owner, assessment, evidence, exception and approval.

## Claim ceiling and activation blockers

Permitted: “Semester has technical and governance controls supporting education-privacy review and institution-specific configuration.” Prohibited: FERPA/COPPA/GDPR/state-law compliant, school-official status, legally valid consent, complete education-record handling, or institution approval. Blocks: entity/role/jurisdiction/age decisions; counsel-approved notices/contracts; data map and authority; institution policy/configuration; vendor/transfer review; rights and deletion/hold exercises; incident terms; AI/privacy assessment; target UAT; and signed approval.
