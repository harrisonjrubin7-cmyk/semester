# Institutional Data-Mapping Template

| Control | Value |
| --- | --- |
| Status | **CONTROLLED BLANK TEMPLATE — NO CUSTOMER DATA MAP APPROVED** |
| Owner | Harrison Rubin — company-side data/privacy owner; customer data owner, system owner and qualified reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../trust/PERSONAL-DATA-PROCESSING-REGISTER.md`](../trust/PERSONAL-DATA-PROCESSING-REGISTER.md), [`../SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md`](../SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md), and [`SIS-LMS-INTEGRATION-BOUNDARIES.md`](SIS-LMS-INTEGRATION-BOUNDARIES.md) |

## Use rule

Complete this template for the exact tenant, environment, source, version and purpose before importing or connecting institutional data. One row represents one source field transformed into one destination field. Blank or `TBD` entries are blockers, not implied approval. Attach schema samples only through an approved restricted channel and use synthetic values in this document.

## Map header

| Field | Required entry |
| --- | --- |
| map ID / version / status | `[ID]` / `[VERSION]` / `draft, reviewed, approved, retired` |
| institution / tenant / environment | `[CUSTOMER]` / `[TENANT]` / `sandbox or production` |
| workflow and purpose | `[BOUNDED USE CASE]` |
| source system / owner / version | `[SYSTEM]` / `[ACCOUNTABLE OWNER]` / `[VERSION]` |
| destination / owner | `[SEMESTER DOMAIN/TABLE]` / `[OWNER]` |
| direction / transport / cadence | `read or write` / `[METHOD]` / `[CADENCE]` |
| data subjects / ages / cohort | `[POPULATION]` |
| authority | `[CONTRACT/POLICY/CONSENT/CUSTOMER DECISION]` — qualified review required |
| approved environments/providers/regions | `[VALUES]` |
| retention / deletion / hold / export | `[RULES AND EVIDENCE]` |
| security/privacy review | `[REVIEWER, DECISION, DATE, EXPIRY]` |
| customer acceptance | `[APPROVER, DECISION, DATE]` |

## Field-level mapping

| Row ID | Source object.field | Destination object.field | Required? | Purpose | Subject / classification | Transform / enum / default | Identifier / join rule | Authority / consent | Display / decision use | Retention / deletion / hold | Validation / reconciliation | Status / evidence / owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAP-001 | `[SOURCE.FIELD]` | `[DESTINATION.FIELD]` | `[Y/N]` | `[PURPOSE]` | `[SUBJECT / T0–T4]` | `[EXACT RULE]` | `[OPAQUE KEY; NEVER EMAIL BY DEFAULT]` | `[AUTHORITY]` | `[WHERE/WHY OR NEVER DISPLAY]` | `[RULE]` | `[TEST/COUNTS/EXCEPTION]` | `draft / [EVIDENCE] / [OWNER]` |

## Explicit exclusions

| Category | Default | Exception evidence required |
| --- | --- | --- |
| grades, GPA, transcript, submissions and attendance | exclude from identity/general integration maps | separately approved academic-record workflow and minimum fields |
| health, disability, counseling and accommodations | exclude | specialized authority, restricted access and qualified review |
| conduct, discipline, immigration/citizenship and government identifiers | exclude | documented necessity, legal/customer authority and heightened controls |
| financial aid, account amounts and payment data | exclude; use action/deep link where possible | finance-specific scope and security/legal approval |
| free text, messages, files and precise location | exclude | narrow purpose, classification, minimization and review |
| demographic/protected traits and inferred traits | exclude from targeting/scoring | explicit lawful purpose, fairness/impact review and customer approval |
| secrets, tokens, credentials and signing material | never map as data | secret-manager reference only |

## Validation and change control

Before acceptance: verify source authority/version; test types, required fields, enums, timestamps, identifiers, tenant/scope, duplicates and prohibited fields; reconcile source/accepted/quarantined/rejected counts; inspect sanitized exceptions; validate freshness and degraded behavior; exercise correction/deletion/hold/export; confirm least-privilege access and audit; simulate mapping changes; obtain independent approval; record rollback and expiry. A changed source schema or purpose creates a new version and reapproval.

## Evidence state

**Repository evidence.** Field minimization, classification, mapping/version, validation, lineage, freshness and reconciliation controls exist at differing levels in the repository.

**Operational evidence.** This template contains no customer schema, authorized field map, legal conclusion, target reconciliation, production data or customer approval.

**Missing test/proof.** Populate and approve a target map with synthetic samples; run field/prohibited-data/tenant/reconciliation/lifecycle tests; reconcile it to actual target configuration; obtain system-owner, privacy/security and customer acceptance.

## Claim ceiling

Semester may say it provides a controlled data-mapping template and repository control references. Completion of the template does not itself authorize processing or prove the deployed route matches it.

## Prohibited claims

Do not claim an approved data inventory, complete processing register, lawful basis, data minimization, live integration, FERPA/GDPR/COPPA compliance, customer acceptance or production processing from this blank template.
