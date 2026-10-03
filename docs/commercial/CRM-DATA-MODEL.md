# CRM Data Model

| Control | Value |
| --- | --- |
| Status | **CONTROLLED MINIMUM MODEL — REPOSITORY TABLES PRESENT; OPERATED CRM UNPROVEN** |
| Owner | Harrison Rubin — company-side CRM and data owner; backup operator, privacy reviewer and customer-success owner unassigned |
| Evidence date | 2026-10-03 at repository revision `a86b3376` |
| Repository basis | `site_leads`, `gtm_accounts`, `gtm_stakeholders`, `gtm_decision_log`, `gtm_pilots`, commercial contracts/projects/renewals and account-health snapshots |

## Entities and required fields

| Entity | Minimum fields | Exclusions / boundary |
| --- | --- | --- |
| account | stable ID, legal/display name, type/segment, approved domain, region/time zone, owner, source, lifecycle, created/updated/review date | no invented customer status; no sensitive student data |
| stakeholder | account, name, work contact, role/buying function, authority/evidence, consent/contact basis, preference/suppression, owner, last/next interaction | do not infer sensitive traits, private email or personal profile enrichment |
| lead/inquiry | route/source, organization/role, minimal message, created time, owner/status, response/expiry, consent/suppression | never store credentials, student records, support cases or unnecessary free text |
| opportunity | account, bounded problem/cohort/workflow, stage and timestamps, source, sponsor/champion, authority, amount/currency/evidence state, target decision, next action, risks/disqualifiers | amount/probability/date remain assumptions until approved |
| activity/decision | actor, timestamp, type, factual summary, outcome, next action, evidence link | no recording/transcript or sensitive content by default |
| evidence request | domain/control, requestor, artifact/version, access, owner, due/expiry, status/response/exception | do not paste secrets or confidential artifacts into free text |
| proposal/order/contract | immutable version/link, parties, scope, price status, approvals, effective/end/renewal dates, signature state | signed order is not launch or revenue recognition |
| implementation/pilot | tenant/cohort/workflow, owners/backups, stage/gates, metrics/guardrails, target environment, decisions and offboarding | no individual participant outcomes in CRM |
| renewal/account health | contract dates, approved aggregate reasons/signals, human review, next action and decision | no automated adverse action or hidden individual scoring |

## Relationships and controls

Account → stakeholders, inquiries and opportunities; opportunity → evidence requests, activities, proposal/order; signed order → implementation project only through the controlled commercial trigger; implementation/pilot → approved aggregate scorecard; contract → renewal opportunity; account → reviewed health snapshots. Use stable IDs and immutable references for signed/evidence artifacts. Deduplicate deterministically and preserve merges/audit rather than silently deleting history.

Restrict finance records to billing contacts/finance roles; delivery records to authorized implementation/success roles; trust artifacts to granted versions; marketing communications to approved basis/preferences. Apply least privilege, retention, access review, export/correction/deletion/hold rules and suppression. CRM must not become a shadow student-record, support, HR, health, advising or institutional source system.

## Evidence state

**Repository evidence.** Database tables and tests represent site lead routing, institutional GTM records, commercial agreements, implementation, renewal and reviewed account-health concepts.

**Operational evidence.** No complete operated CRM, authoritative data dictionary, migration/deduplication result, access review, retention approval, integration readback or representative pipeline-quality report is evidenced.

**Missing test/proof.** Approve fields/purposes/retention/access; map repository tables to this model; validate RLS/capabilities and exports; configure dedupe/suppression/audit; migrate authorized records; run role and data-quality UAT; assign backup ownership.

## Claim ceiling

Semester may say repository-controlled CRM/GTM entities exist and use this model for privacy-minimized operations design.

## Prohibited claims

Do not claim a production CRM, complete customer database, consented marketing list, accurate pipeline, automated customer-success operation or customer approval from schema/tables alone.
