# Semester subprocessor governance program — controlled draft

- **Status:** `INCOMPLETE / NO PROVIDER APPROVED BY THIS DOCUMENT`
- **Owner:** Privacy/Vendor Risk owner with Security, Legal, Procurement, and customer authority
- **Evidence date:** 2026-10-03

## Program rule

Inventory does not equal approval. Before a provider processes customer or student data, record its exact legal entity, service/purpose, data/subjects, configuration, region/transfers, access, retention/deletion, training/secondary use, security evidence, incident/change terms, subprocessors, DPA/contract, customer notice/objection, owner, approval, expiry, and exit path.

Distinguish Semester subprocessors, institution-directed providers, student-directed services, public sources, and ordinary dependencies. Apply the correct contractual and notice model without implying Semester controls a student- or institution-owned contract.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| technical party inventory | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) and source/test register | target enabled-provider reconciliation absent | Privacy/Engineering | target configuration/network diff |
| vendor risk tier/review | [`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md) | no completed assessments recorded | Security/Procurement | evidence review for every High/Medium vendor |
| contract/DPA/terms | provider-term records | executed terms and flow-down acceptance incomplete | Legal/Privacy | contract evidence and clause mapping |
| regions/transfers | architecture/config candidates | account/project regions and mechanisms unverified | Privacy/Security | target region and transfer verification |
| change/exit | draft schedules | notice, objection, replacement and deletion exercises absent | Vendor/Operations | provider-change and exit tabletop |

## Claim ceiling and activation blockers

Permitted: “Semester maintains tested technical party and draft vendor-risk inventories.” Prohibited: approved subprocessors, verified attestations, signed DPAs, residency, zero retention, no training, complete deletion, or customer acceptance. Blocks: completed risk reviews, executed terms, target configuration/regions, data map, customer/legal approval, notice/objection, incident and exit paths, named owners, evidence expiry, and signed activation decision.
