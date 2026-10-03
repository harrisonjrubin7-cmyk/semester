# Semester records retention schedule — draft

> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

| Control | Draft value |
| --- | --- |
| Version | 0.1 |
| Effective date | `[TO BE APPROVED]` |
| Owner | Privacy/Data Governance Lead with Legal coordinator |
| Review frequency | At least annually; on new data/system/jurisdiction/contract; after material incident or legal requirement |
| Approval authority | Founder/authorized governing body with qualified privacy, employment, tax, corporate and litigation counsel as applicable |
| Dependencies | Data/asset/vendor inventories, processing register, legal-hold procedure, contracts, backup architecture, deletion/export workflows |

## Purpose

Define how long company, product, customer, student, workforce, security, financial, legal and governance records should be kept and how they are disposed of. Durations are not set until qualified review reconciles legal, contractual, operational, user-control and minimization requirements.

## Rules

- Keep no record merely because storage is available; retain for a documented purpose and approved duration.
- A legal hold, investigation, contract, tax or security need may suspend scheduled destruction for a scoped record set.
- Backups, logs, derived data, exports and vendor copies are included; do not promise immediate deletion where architecture cannot deliver it.
- Access is least-privilege; disposal is verifiable and appropriate to medium/sensitivity.
- Conflicting requirements escalate to privacy/legal owners and are documented.

## Schedule template

| Record class | Examples/system | Purpose/legal/contract basis | Trigger | Active retention | Backup/archive tail | Disposal/evidence | Owner/status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Corporate/governance | formation, ownership, consents, decision logs | `[COUNSEL]` | creation/supersession | `[TBD]` | `[TBD]` | controlled archive/destruction | UNKNOWN |
| Finance/tax | ledger, bank, invoices, payroll, filings | `[CPA/TAX/COUNSEL]` | close/filing/transaction | `[TBD]` | `[TBD]` | destruction record | UNKNOWN |
| Contracts/vendors | agreements, diligence, renewals, offboarding | contract/defense/operations | termination/expiry | `[TBD]` | `[TBD]` | deletion/return evidence | UNKNOWN |
| Workforce/applicants | personnel, contractor, access/training | `[EMPLOYMENT COUNSEL]` | separation/decision | `[TBD]` | `[TBD]` | secure destruction | UNKNOWN |
| Individual accounts/content | identity, synced academic content, preferences | service/user control | deletion/inactivity | `[TBD]` | `[TBD]` | product/vendor evidence | UNKNOWN |
| Institution/customer data | tenant/cohort/config/content | contract/school direction | offboarding/contract end | `[TBD]` | `[TBD]` | customer-approved export/deletion | UNKNOWN |
| Security/audit/logs | auth, admin, access, incident, monitoring | security/accountability | event/incident closure | `[TBD]` | `[TBD]` | privacy-safe deletion | UNKNOWN |
| Support/communications | tickets, consents, notices, complaints | service/defense/rights | closure/consent withdrawal | `[TBD]` | `[TBD]` | suppression/destruction | UNKNOWN |
| AI/model records | prompts/outputs, evaluations, changes, incidents | feature/safety/governance | interaction/model retirement | `[TBD]` | `[TBD]` | provider/local deletion | UNKNOWN |
| Analytics/research | events, aggregates, interviews, consent | measurement/research | collection/project end | `[TBD]` | `[TBD]` | deletion/anonymization evidence | UNKNOWN |

## Implementation and verification

For each row document systems/vendors, data owner, access, deletion mechanism, backups, legal-hold behavior, user/customer notice, exception, test cadence and evidence. Test representative deletion/export/offboarding end to end before publication or contract commitments.

## Cannot be completed from source code

Applicable laws, contracts, jurisdictions, tax/workforce needs, litigation holds, approved business purposes, provider backup behavior, and final durations require professional and owner decisions. All durations remain `[TBD]` until approved.
