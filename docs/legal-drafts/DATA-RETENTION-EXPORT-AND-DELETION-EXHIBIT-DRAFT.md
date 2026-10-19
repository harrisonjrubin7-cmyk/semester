> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester data retention, export, and deletion exhibit — draft

- **Version/effective date:** `0.1 / [TO BE APPROVED]`
- **Customer/service/data scope:** `[PARTIES, ORDER, AND APPROVED DATA MAP]`
- **Owner/approval:** Privacy/Data Governance Lead; qualified counsel and authorized signatories

## Plain-language summary

This exhibit would define what is retained, where, why, for how long, and what happens at export, deletion, termination, legal hold, and offboarding. It must match the actual contracted configuration. It does not promise complete tenant export/deletion, a universal deadline, or deletion from every backup/provider unless verified and approved.

## Required schedule

| Data or system | Purpose/authority | Active retention | Backup/archive tail | Export format/method | Deletion trigger/method | Exception/hold | Evidence/owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `[CATEGORY/SYSTEM]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` | `[TBD]` |

The schedule must cover device-only data, synchronized account data, institution-provided data, AI metadata/content, support and security records, audit logs, billing records, subprocessors, exports, backups, deleted-user remnants, shared content, and legal holds. Institution instructions cannot require unlawful destruction or override another person's rights.

## Product-behavior mapping

| Obligation | Current evidence | State / limitation |
| --- | --- | --- |
| individual server export and deletion | code and automated tests | repository-evidenced; production operation still requires acceptance |
| device-held material | local persistence design | not included in one complete server export |
| rights-request records | database structure | no staffed response surface or accepted deadline |
| tenant/source offboarding | designs and preview evidence | whole-tenant and production purge proof incomplete |
| audit/financial retention | configured schedules | legal wording, deployment and exception review required |

The evidence source is [Data retention, export and deletion](../DATA-RETENTION-EXPORT-DELETION.md); its limitations and the controlling retention schedule must be reconciled with the exact release and customer scope.

## Signature and activation blockers

Confirm data-subject ages, minor/school/guardian authority and applicable jurisdictions before adopting retention, export, deletion or notice terms.

Counsel-approved schedule and exceptions; complete data map; named rights/offboarding owners and backups; production-equivalent export, restore, delete, provider-propagation and failure tests; customer-approved formats/timing; legal-hold process; and consistency with the DPA, notice, billing and security terms.
