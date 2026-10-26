# Data Inventory Template and Starter

| Control | Value |
| --- | --- |
| Status | **DRAFT - TEMPLATE PLUS PRE-POPULATED STARTER - NOT A COMPLETE OR PRODUCTION-RECONCILED INVENTORY** |
| Owner | Harrison Rubin (interim privacy and data owner; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: privacy] [REVIEW: counsel] [REVIEW: security] |
| Audience | Internal. The per-customer version of this table is a customer-specific field map shared under agreement |

> Operating document, not legal or privacy advice. Legal and contractual basis cells are placeholders for privacy counsel; nothing here states a lawful basis.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/trust/DATA-INVENTORY.md](../../trust/DATA-INVENTORY.md) | The controlled index: where inventories live, who reconciles them, the required per-data-set record, claim ceiling (`PARTIAL`) | A fillable template with the user's thirteen columns and a starter set of rows that **links** to the schedule instead of copying it | The trust doc is an index with a fixed shape; it holds no per-category table |
| [docs/DATA-INVENTORY-AND-LINEAGE.md](../../DATA-INVENTORY-AND-LINEAGE.md) | Generated schema inventory from migrations (tables, RLS) | Not duplicated; referenced as the structural source | Generated file |
| [RETENTION.md](../../../RETENTION.md) | Per-table retention schedule, tripwire-tested against the schema | Starter rows cite its sections; **if the two disagree, RETENTION.md wins** (same rule as `docs/DATA-RETENTION-EXPORT-DELETION.md`) | The schedule is by table; the inventory is by data category with purpose and recipients |
| [docs/trust/PERSONAL-DATA-PROCESSING-REGISTER.md](../../trust/PERSONAL-DATA-PROCESSING-REGISTER.md) and [docs/privacy-operations/01-PROCESSING-REGISTER-AND-CONTROLS.md](../../privacy-operations/01-PROCESSING-REGISTER-AND-CONTROLS.md) | Processing register (purposes, bases, controls) and a 24-row operations expansion | Cross-reference; this template does not replace the register and does not assert lawful bases | Counsel-owned |
| [docs/trust/DATA-CLASSIFICATION-STANDARD.md](../../trust/DATA-CLASSIFICATION-STANDARD.md), [docs/trust/DATA-FLOW-MAP.md](../../trust/DATA-FLOW-MAP.md) | Classes and flows | Classification and recipient columns reuse their vocabulary | Canonical |
| [DATA_RETENTION_DELETION_PLAN.md](DATA_RETENTION_DELETION_PLAN.md) | The consolidated retention and deletion view | Each starter row's retention rule is expanded there | Same folder |

## Gate (what may be done now versus held)

| Item | Status |
| --- | --- |
| Use the template internally and with a design-partner prospect to scope a data plan (synthetic examples only) | NOW (non-activation GO) |
| Fill the template with a named customer's real field list or production schema | HELD until a named customer scope exists and the data plan is approved (GO-NO-GO blocker 8) |
| Quote any row as a representation of production data handling | HELD until reconciled to the target environment |

## The rule

**No category without purpose and retention.** A row with an empty Purpose or an empty Retention rule is invalid and is listed as INCOMPLETE; an INCOMPLETE row blocks use of that category in any pilot data plan. A retention cell may say "kept until the account is deleted" (the student promise in `app/src/lib/privacy.ts`) or cite a sweep; it may not say "TBD". Durations not stated as implemented in the repository are [ASSUMPTION] and carry [REVIEW: counsel].

A second rule from the program: do not collect a field because it might be useful. Every field needs a purpose a student could read on the privacy screen.

## 1. Blank template

Copy one row per data category. Fill every column.

| Data category | Fields | Source | System | Purpose | Legal / contractual basis [REVIEW: privacy] | Classification | Retention rule | Deletion method | Recipients / subprocessors | Cross-border | Owner | Student data? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[category]` | `[field names, not values]` | `[student / institution / system / visitor]` | `[table, bucket, device store]` | `[one sentence a student can read]` | `[REVIEW: privacy] placeholder` | `public / internal / student_private / education_record` | `[rule + mechanism or "until account deletion"]` | `[erase_account / sweep / manual / provider]` | `[from subprocessors.ts]` | `[region or "none"]` | `[seat]` | `[yes / no / mixed]` |

Field guidance: Fields are names, never sample values. Source says who supplies the data. Classification uses the four code classes (CONTROL-FACTS.md, as generated at revision 5eba494: `public`, `internal`, `student_private`, `education_record`). Recipients use only parties in `app/src/lib/trust/subprocessors.ts`. Cross-border is `[ASSUMPTION]` unless a region is recorded; the only region recorded in the repository is the Supabase project region read on 2026-09-28 ([docs/trust/VENDOR-RISK-REGISTER.md](../../trust/VENDOR-RISK-REGISTER.md)).

## 2. Pre-populated starter (links, not copies)

Each row is a pointer to the canonical source for its retention rule. "Implemented" means the cited migration or function enforces it in the repository ([VERIFIED] by the path); it does not show the sweep runs against production (RETENTION.md says so itself). Basis cells are `[REVIEW: privacy]` for every row. Region/cross-border: `[ASSUMPTION]` unless stated.

| Data category | Fields | Source | System | Purpose | Legal / contractual basis [REVIEW: privacy] | Classification | Retention rule | Deletion method | Recipients / subprocessors | Cross-border | Owner | Student data? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Account and identity | email, sign-in records, profile, school membership | Student sign-up or SSO (SSO not enabled) | `profiles`, auth | Provide the account and sync | [REVIEW: privacy] | student_private | Until account deletion; never-confirmed sign-ups swept after 30 days [VERIFIED] `RETENTION.md` (`sweep_abandoned_signups`) | `erase_account` via `delete-account` function [VERIFIED] `supabase/deletion.check.sql` | Supabase | Supabase region as read 2026-09-28; others [ASSUMPTION] | Harrison Rubin (interim) | yes |
| Student workspace | notes, tasks, courses, appointments, exam sittings, sync state, preferences | Student | `notes`, `tasks`, `courses`, `appointments`, `sittings`, `state` | Student's own planning and study | [REVIEW: privacy] | student_private | Until the student deletes; soft-deleted rows swept after 90 days (weekly `tombstones` job) [VERIFIED] `RETENTION.md`; no clock on the work itself (promise in `app/src/lib/privacy.ts`) | Self-service delete; `erase_account` | Supabase | as above | Harrison Rubin (interim) | yes |
| Student planning extras | term plan, cost plans, AI memories, check-ins, contact channels | Student | tables in `RETENTION.md` ("Everything else") | Planning and reminders | [REVIEW: privacy] | student_private | Until account deletion [VERIFIED] `RETENTION.md` | `erase_account` | Supabase | as above | Harrison Rubin (interim) | yes |
| Messages, groups, community content | messages, reactions, group membership, posts | Student | `messages`, `groups`, community tables | Peer communication | [REVIEW: privacy] | student_private | Until deleted; a group started by a member stays for other members; moderation audit 3 years [VERIFIED] `RETENTION.md` | Account deletion (leaves gaps by design, `app/src/lib/privacy.ts`) | Supabase | as above | Harrison Rubin (interim) | yes |
| Sharing and consent records | advisor, supporter and family shares; consent snapshots; access reads | Student | share tables; `access_log` | Student-controlled disclosure with a trace | [REVIEW: privacy] [REVIEW: counsel] | education_record / student_private | Shares until expiry or revocation; reads in `access_log` 90 days [VERIFIED] `supabase/migrations/20260921143653_access_log.sql` | Revoke; `erase_account`; `supabase/erasure-clears-consent-snapshots.check.sql` | Supabase | as above | Harrison Rubin (interim) | yes |
| Support requests | question text, ticked app details, delivery intents | Student | `support_tickets`, `support_ticket_messages` | Answer the student's question | [REVIEW: privacy] | student_private | With the ticket; account deletion removes them [VERIFIED] `RETENTION.md`; **closed-ticket retention not set** (TR-37) - INCOMPLETE for institutional use | `forget_my_support_tickets()` | Supabase; Resend (generic email hint only) | as above | Harrison Rubin (interim) | yes |
| Account activity metadata | screens opened, last-used days | System | `usage`, `activity` | Pilot figures and product health | [REVIEW: privacy] | internal | `activity` 400 days [VERIFIED] `supabase/migrations/20260921151000_activity.sql`; `usage` until account deletion | On-write trim; `erase_account` | Supabase | as above | Harrison Rubin (interim) | mixed |
| Audit events | verb, object kind, outcome, SHA-256 pseudonyms; role grants; moderation; provisioning | System | `audit_event`, `role_grant_audit_event`, `moderation_audit_event`, `provisioning_audit_event` | Accountability and investigation | [REVIEW: privacy] | internal | 3 years then removed by `audit-retention` job [VERIFIED] `RETENTION.md` | Narrow purge path allowed by immutability triggers | Supabase | as above | Harrison Rubin (interim) | mixed (pseudonymous) |
| Gateway journal and audit | action bodies (encrypted), audit metadata, correlation ids | System | `gateway_review`, `gateway_audit`, `gateway_intelligence_audit` | Two-phase institutional actions with receipts | [REVIEW: privacy] | student_private | Audit 180 days; unconfirmed reviews 1 day after expiry; completed 90 days [VERIFIED] `RETENTION.md` (`private.gateway_purge_journal()`); **gateway not deployed** (TR-19) | Hourly sweep | Vercel (when deployed) | Vercel region [ASSUMPTION] "to confirm" | Harrison Rubin (interim) | yes (when live) |
| AI request metadata | policy decisions, spend, counts; never prompts or prose | System | `gateway_intelligence_audit`, `gateway_intelligence_action` | Governed AI use and budget | [REVIEW: privacy] | internal | Audit 180 days; unconfirmed actions 1 day after expiry; claimed 90 days [VERIFIED] `RETENTION.md` | Hourly sweep | Supabase | as above | Harrison Rubin (interim) | mixed |
| AI request content | the text a student sends (e.g. syllabus) | Student | Edge function `claude` to the provider; not stored as prompts by the gateway | Generate AI output at the student's request | [REVIEW: privacy] [REVIEW: counsel] | student_private | Provider-side retention per provider terms [ASSUMPTION] (published terms recorded in `docs/trust/PROVIDER-TERMS.md`; **not in force**: no account under a Semester entity) - INCOMPLETE until the DPA exists | Provider; student-held key path is student-directed | Anthropic (Semester key) or student's own key | Provider region "to confirm" [ASSUMPTION] | Harrison Rubin (interim) | yes |
| Integration configuration | connection metadata, scopes, mappings; credential pointer only | Institution admin | `integration_connections`, `integration_scopes` | Operate an approved connection | [REVIEW: privacy] | internal | Until an administrator removes it or the school is removed; sync runs/errors 180 days, events 30 days [VERIFIED] `RETENTION.md` | Integration retention sweep (skipped on legal hold) | Institution LMS (when enabled) | Institution's | Harrison Rubin (interim) | mixed; no live connection exists |
| LTI launch proofs | nonce, link ticket | System | `lti_nonce`, `lti_link_ticket` | Validate a launch | [REVIEW: privacy] | internal | An hour past expiry [VERIFIED] `RETENTION.md` (`pg_cron` hourly) | Sweep | Supabase | as above | Harrison Rubin (interim) | no |
| Billing and contracts | Stripe customer/subscription references, invoices, quotes, contracts | Paying customer | `billing_*`, `subscriptions`, `invoices` | Charge and account for a paid plan | [REVIEW: counsel] [REVIEW: tax] | internal | Financial records kept for seven years after the end of the year made, then removed [VERIFIED] `supabase/financial-retention.check.sql`; card data never reaches Semester | `purge_financial_records()` | Stripe | Global [ASSUMPTION] | Harrison Rubin (interim) | no (subscriber identity only) |
| Company-site leads | name, work email, organization, role, message, source page | Site visitor | `site_leads`, `site_lead_hits` | Respond to an enquiry | [REVIEW: privacy] | internal | `site_lead_hits` 1 day [VERIFIED] `RETENTION.md`; **`site_leads` has no time-based purge yet** - INCOMPLETE; period must be set before forms go live | Manual until a sweep exists | Resend; Supabase | as above | Harrison Rubin (interim) | no |
| Trust-room reviewer records | reviewer name, work email, role, NDA reference, link hash, open log | Institution reviewer | `trust_room_requests`, `trust_room_grants`, `trust_room_access_log` | Controlled evidence sharing | [REVIEW: privacy] [REVIEW: counsel] | internal | With their account; unlinked from the school on school removal [VERIFIED] `RETENTION.md`; grant expiry 30 days max | Revoke grant | Supabase | as above | Harrison Rubin (interim) | no |
| Rights requests | request kind, status, due date | Student | `data_subject_request`, `data_requests` | Honour export/erasure/correction/restriction | [REVIEW: counsel] | internal | Request with the account; completion record kept without identity [VERIFIED] `RETENTION.md` | Account deletion | Supabase | as above | Harrison Rubin (interim) | yes (while open) |
| Device-local data | working copy (`semester.*.vN` keys), attachments in IndexedDB | Student | Browser storage | Offline-first use | [REVIEW: privacy] | student_private | Until the student erases the device; never synced (attachments) [VERIFIED] `docs/ARCHITECTURE.md` | "Erase this device" in the app | None | n/a | Student (control) | yes |
| Backups | whole-database copies | Provider | Supabase backups | Recovery from loss | [REVIEW: privacy] | all | Provider window; plan-tier documentation states 7 days; **not read from the dashboard on a date** [ASSUMPTION] `RETENTION.md` | Expiry only; holds do not reach backups | Supabase | as above | Harrison Rubin (interim) | yes |
| Provider and platform logs | request logs, function logs | Provider | Supabase, Vercel, GitHub | Debug and incident evidence | [REVIEW: privacy] | internal | About a month at providers [ASSUMPTION] (`docs/integrated-trust/INCIDENT-RESPONSE.md`); no evidence store (TR-43) | Provider expiry | Supabase, Vercel, GitHub | as above | Harrison Rubin (interim) | mixed |
| Institutional records (future) | grades, roster, enrollment via adapters | Institution | None live | Planned only | [REVIEW: counsel] | education_record | **None - no production flow exists** [VERIFIED] `docs/DATA-RETENTION-EXPORT-DELETION.md`; any real flow needs a per-customer rule | n/a | n/a | n/a | Harrison Rubin (interim) | yes (when live) |

Rows that carry INCOMPLETE flags (support closed-ticket retention, AI request content at the provider, site leads purge) are the three places where the rule "no category without purpose and retention" is not yet satisfied in the repository. They are tracked in [DATA_RETENTION_DELETION_PLAN.md](DATA_RETENTION_DELETION_PLAN.md).

## 3. How to complete a customer-specific inventory

1. Start from this starter; delete categories the customer will not use; add each customer-specific field category (the customer data map is `[CUSTOMER-SPECIFIC MAP REQUIRED]` per [DATA-FLOW-MAP.md](../../trust/DATA-FLOW-MAP.md)).
2. For each category confirm purpose with the customer privacy office; confirm basis and role (controller/processor) with counsel [REVIEW: counsel].
3. Reconcile to the target schema with the generated lineage and file a dated diff under `docs/evidence/`.
4. Confirm every recipient exists in `app/src/lib/trust/subprocessors.ts`; add the party first if not (the test forces it).
5. Never include sample values. Never include a real student's data in the inventory.

## Evidence state

Retention rules are quoted from `RETENTION.md` at `5eba494`; RETENTION.md itself warns the repository is not the database, and several migrations were recorded as unapplied on earlier dates (see its section on `MIGRATION-HISTORY.md`). No row is reconciled to production.

## Claim ceiling

Permitted: "Semester maintains repository-derived schema and retention inventories with automated coverage checks." Not permitted: complete production inventory, universal classification, complete deletion, verified data residency, legal compliance.

## Prohibited claims

FERPA/COPPA/GDPR compliance, verified residency, complete deletion, lawful-basis statements, any statement that student data is "never" retained when backups and logs exist.

## Professional review required

Privacy counsel [REVIEW: counsel] for every basis and role cell; privacy lead [REVIEW: privacy] for categories and purposes; tax adviser [REVIEW: tax] for billing record retention; security reviewer [REVIEW: security] for classification. None named in the repository.
