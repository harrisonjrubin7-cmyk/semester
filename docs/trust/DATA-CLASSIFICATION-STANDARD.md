# Semester data classification standard — controlled draft

- **Status:** `PARTIAL`
- **Owner:** Data/Privacy owner with Security and customer data authority
- **Evidence date:** 2026-10-03
- **Approval state:** technical policy exists; enterprise standard and named-tenant adoption are unapproved

## Standard

Classification is declared from authorized context and data ownership; Semester must not inspect sensitive content merely to guess its class. Unknown data fails closed. The existing tool-governance gate uses T0–T6 and treats unclassified material as T3 for controlled actions.

| Tier | Working description | Default handling ceiling |
| --- | --- | --- |
| T0 | public/approved public material | approved storage/use; verify rights and source |
| T1 | course-authorized material | course-scoped use only |
| T2 | user's own academic work | user-controlled use; do not infer institutional authority |
| T3 | education records or institution-controlled data | approved institutional workflow; no consumer AI/external connector by default |
| T4 | regulated or sensitive data | prohibited unless a separately approved control set exists |
| T5 | restricted research, confidential IP or comparable data | prohibited unless separately approved |
| T6 | highly restricted/safety-critical/secrets | prohibited from general product workflows |
| unclassified | unknown | treat as T3 and refuse widening actions |

The final standard must map customer classifications, personal/sensitive categories, security impact, age/minor status, records authority, contractual restrictions and jurisdiction-specific terms without weakening the more restrictive rule.

## Action matrix

| Action | Required decision |
| --- | --- |
| collect/store | purpose, minimization, authority, system/region, encryption and retention |
| share/export | recipient, authority, scope, format, audit and rights/license restrictions |
| AI/process externally | approved provider/model/terms/region, course/customer permission and evaluation |
| log/monitor | minimize content and identifiers; define access and retention |
| delete/hold | data map, backup tail, shared records, legal hold and evidence |

## Evidence and test map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/evidence |
| --- | --- | --- | --- | --- |
| T0–T6 action gate | [`docs/ai-toolkit/DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md`](../ai-toolkit/DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md) and toolkit tests | no target-tenant classification acceptance | Product/Data | end-to-end enforcement across every workflow |
| unknown fails closed | classification gate tests | no operator review sample | Security/Data | production decision-log sample |
| course policy cannot be widened | course/tool policy logic/tests | no institution/course acceptance | Product/Customer | representative policy/UAT |
| external connectors | flag/policy currently off in described slice | no approved connector | Security/Privacy | target egress and provider verification |

## Claim ceiling and blockers

Permitted: “A tested T0–T6 classification gate constrains selected toolkit actions and treats unknown data conservatively.” Prohibited: universal enforcement, automatic accurate classification, named-institution approval, or legal/regulatory classification sufficiency. Adoption requires field/workflow coverage, customer mapping, provider/region review, age/jurisdiction analysis, named owners, exception handling, monitoring, training and target-environment tests.
