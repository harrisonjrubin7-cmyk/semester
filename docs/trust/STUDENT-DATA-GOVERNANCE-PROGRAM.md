# Semester student-data governance program — controlled draft

- **Status:** `PARTIAL / NOT OPERATIONALLY ACCEPTED`
- **Executive owner:** Harrison Rubin; backup `UNASSIGNED`
- **Privacy/Data/Security owners:** Harrison Rubin primary; backups `UNASSIGNED`
- **Evidence date:** 2026-10-03

## Program objective

Govern student and education-related data from proposed collection through approved use, access, sharing, AI processing, correction, export, retention, deletion, legal hold and offboarding while preserving institutional authority and student control. This program does not determine FERPA, COPPA, state-law, GDPR or other legal applicability and is not evidence of compliance.

## Governing principles

- collect the minimum data for a defined approved purpose;
- distinguish user-entered, institution-provided, official, imported, inferred, AI-generated, stale and sample information;
- default to student control and institutional authority without turning Semester into an official system of record;
- separate tenant/account/resource access and log privileged access;
- prohibit advertising, sale, unrelated profiling and individual risk scoring with student data;
- require approved provider, data, model, course/institution and human-oversight boundaries for AI;
- provide accessible notice, choice, correction, export, deletion/request and non-AI/human routes as applicable;
- fail closed on unknown class, authority, source or configuration.

## Control program

| Domain | Required control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- | --- |
| inventory/classification | current data/flow/classification records | S01 trust sources | no target/customer reconciliation | `PARTIAL` | Data/Privacy | field-level acceptance |
| authority/notice/consent | scoped roles, notice and consent/preference records | consent/policy sources and tests | customer/legal approval absent | `PARTIAL` | Privacy/Product | age/jurisdiction/customer exercise |
| access/isolation | least privilege, tenant/account/resource policy and audit | RLS/capability/tenancy tests | named-tenant acceptance absent | `VERIFIED — REPOSITORY` | Security/Engineering | target negative tests |
| minimization/purpose | approved fields and destinations only | selected context/gateway policies | representative payload review absent | `PARTIAL` | Data/Product | end-to-end minimization tests |
| AI/high-impact limits | approved use/provider plus human and non-AI route | AI governance/policy/kill switch sources | full evaluation and tenant activation absent | `CONDITIONAL` | AI/Privacy/Security | scored release suite and drill |
| rights/lifecycle | export, correction, deletion, retention, hold and offboarding | code, database checks and runbooks | complete target exercise absent | `PARTIAL` | Privacy/Operations | representative cases and restore replay |
| providers/transfers | approved service, terms, region and change process | provider/subprocessor inventory | executed terms/regions incomplete | `PARTIAL` | Privacy/Security/Legal | vendor activation evidence |
| incident/support | minimized access, escalation and notice | support/audit/incident sources | staffing/tabletop absent or incomplete | `PARTIAL` | Security/Operations | target tabletop and routing test |
| governance/evidence | owners, review, exception, metrics and customer reporting | registers/templates | named seats and cadence unaccepted | `DESIGNED` | Executive/Privacy | operating records |

## Decision rights and gates

The institution retains official academic, registration, advising, aid, discipline, disability/accommodation, health and other institutional decisions. Semester cannot widen use through contract, configuration or AI beyond approved purpose and authority. High-risk data or decision use requires qualified legal/privacy/security/accessibility review and explicit institution authority; unsupported uses remain disabled.

## Claim ceiling and activation blockers

Permitted: “Semester has repository controls and a draft program governing scoped student-data use.” Prohibited: blanket FERPA/COPPA/state-law/GDPR compliance, complete operational governance, school-official status, universal deletion, approved AI use, or named-institution operation. Activation requires named owners/backups, legal role/age/jurisdiction analysis, customer data map and authority, provider terms/regions, accessibility and security acceptance, representative rights/offboarding exercise, incident tabletop, training, monitoring, metrics, exception handling and signed GO.
