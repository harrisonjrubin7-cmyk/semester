# Privacy and data handling

**Status:** product controls and draft policy set exist; legal and operational approval incomplete

## Current design

Semester is designed around student control: visible source provenance, explicit confirmation before consequential actions, user-facing export and deletion, tenant-scoped institutional access, opt-in/consent surfaces, retention schedules and no hidden student-risk scoring. Data classes, subprocessors, retention behavior and institutional boundaries are described across the repository.

## Data categories and purposes

| Data | Purpose | Typical location / boundary |
| --- | --- | --- |
| Account and identity attributes | authenticate, recover and secure an account | identity/database provider when an account is used |
| Courses, deadlines, plans, notes and study content | deliver the student's workspace | device first; optional account sync/cloud copy |
| Uploaded/source documents and extracted facts | build source-backed course and study material | device and configured storage/provider paths; provenance retained |
| Preferences, accessibility and notification choices | personalize presentation and delivery | device and optional account settings |
| Institution membership, roles and tenant configuration | authorize institution-scoped capabilities | tenant-scoped database/configuration services |
| Support, feedback, safety and incident records | answer requests and protect users | controlled support/operational records |
| Audit/security records | accountability and incident response | restricted operational or tenant logs |
| Billing records | purchase, entitlement, refund and accounting | payment provider plus minimum entitlement/reference data when enabled |

Actual collection depends on enabled capability and tenant configuration. Institution and user responsibilities include providing authorized data, approving sources and roles, configuring identity and retention, limiting imports to necessary content, responding to rights/support requests and not treating Semester guidance as the official system of record unless a separately approved integration says so.

## Evidence boundary

- The in-product privacy disclosure and related tests are implementation evidence.
- Draft privacy, retention, cookie/storage, AI-use and acceptable-use documents are not in force and are not legal approval.
- Deletion and export tests demonstrate code paths; they do not prove every provider backup, legal hold, institutional export or contract-end workflow.
- FERPA, GDPR, COPPA and similar outcomes depend on role, contract, configuration, jurisdiction and actual operation. Semester must not self-certify them from source code.

## GA blockers

- qualified legal/privacy review is not recorded;
- legal entity, governing law, liability and age decisions remain open in drafts;
- no executed institutional DPA or approved school-official terms are evidenced;
- vendor assessments and DPAs are incomplete;
- production backup retention/PITR and deletion propagation are not verified;
- institution-wide return/destroy, legal-hold and offboarding exercises are incomplete;
- named data owners and an approved pilot/production data scope are missing.

## Required evidence

Publish only after counsel approves the exact policy versions. For each institution, record controller/processor roles, purpose, data categories, sources, legal basis/authority, retention, subprocessors, security schedule, data-subject/student rights, breach terms, return/deletion, authorized contacts and signed DPA/order terms.
