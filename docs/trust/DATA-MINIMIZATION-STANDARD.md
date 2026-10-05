# Semester data minimization standard — controlled draft

- **Status:** `PARTIAL`
- **Owner:** Privacy/Data owner with Product, Security, and customer data authority
- **Evidence date:** 2026-10-03

## Standard

Collect, receive, generate, disclose, log, and retain only the fields necessary for a defined, approved purpose and duration. Prefer device-local, user-entered, aggregate, thresholded, redacted, pseudonymous, or official-handoff designs over centralized sensitive records. Unknown purpose, authority, classification, destination, or retention fails closed.

## Decision record

| Question | Required answer |
| --- | --- |
| purpose and user/customer benefit | `[TBD]` |
| subjects, fields, source and authority | `[TBD]` |
| classification, age and sensitivity | `[TBD]` |
| collection alternative and rejected fields | `[TBD]` |
| systems, recipients, providers and regions | `[TBD]` |
| access, logging, retention, export/deletion/hold | `[TBD]` |
| owner, approval, evidence and expiry | `[TBD]` |

Never ingest or disclose detailed grades, payment credentials, health/counseling, disability diagnoses, conduct, immigration, financial-aid, or other high-risk data merely because a source can provide it. High-risk use requires specific institutional/legal authority and a separately approved control set.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| source/context allowlists | integration catalog, AI context and gateway policies/tests | no representative target payload review | Product/Data | end-to-end field inventory and negative tests |
| sensitive-field exclusions | never-ingest/display and classification sources | no named-customer mapping approval | Privacy/Security | target mapping and egress verification |
| aggregate/thresholded reporting | analytics governance/tests | no customer-accepted production reports | Data/Customer | privacy-threshold exercise |
| logging minimization | audit/support designs | production samples and operator review absent | Security/Operations | dated log-content review |

## Claim ceiling and activation blockers

Permitted: “Semester implements selected allowlists, exclusions, and purpose-scoped controls.” Prohibited: universal minimization, no sensitive data, anonymous analytics, or legal sufficiency. Activation blocks on a customer field map, representative payload/network/log review, owners, age/jurisdiction and purpose authority, provider terms, deletion/retention handling, monitoring, exceptions, and accepted residual risk.
