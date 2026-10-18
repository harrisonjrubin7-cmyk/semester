# Student data map

> **Type:** reference · **Audience:** institution-admins, security-reviewers · **Owner:** `privacy` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page maps what Semester holds about students and staff, where it sits, who can read it and how long it is kept, so that you can fill your own data map; stop reading if you need a legal conclusion about any of it, which belongs to counsel.

**Status:** `LIVE` for the retention schedule as written in the repository; the truth table adds that production cron state is unverified. This is a reading of the repository, not of a running database. Counsel review of the privacy position is pending on the registers.

<!-- status: Retention = LIVE -->
<!-- capabilities: outcomes:read, audit:read, tenant:configure -->
<!-- inventory: 302 tables in `public` | Row-level security on | 302 -->
<!-- retained: access_log | 90 days -->
<!-- retained: activity | 400 days -->
<!-- retained: gateway_audit | 180 days -->
<!-- retained: provisioning_audit_event | 3 years -->
<!-- retained: role_grant_audit_event | 3 years -->
<!-- retained: audit_event | 3 years -->
<!-- retained: support_access_event | for as long as the student's records are -->
<!-- retained: institution_membership | kept until the school is removed -->
<!-- retained: scim_credential | kept until a tenant administrator removes it -->
<!-- retained: data_subject_request | with the account -->
<!-- retained: tenant_feature_policy | kept until a tenant administrator changes it -->
<!-- paths: RETENTION.md, docs/DATA-INVENTORY-AND-LINEAGE.md, docs/DATA-RETENTION-EXPORT-DELETION.md, docs/DATA-PORTABILITY-AND-OFFBOARDING.md, docs/SUBPROCESSORS.md, docs/operating-model/DATA-STEWARDSHIP.md -->

## How Semester is shaped

Student data is owned by the account, not by a tenant or a role. The role and permission matrix states that no role reads a student's private work by default. Of the 302 tables in `public`, 302 have row-level security on, and none has it off; a CI check fails if that list is ever not empty ([`DATA-INVENTORY-AND-LINEAGE.md`](../../DATA-INVENTORY-AND-LINEAGE.md)). That is a statement about the schema, not about any deployment.

The in-app promise is that student work is never aged out: a retention schedule here may age out records about the work, and not the work. See [`RETENTION.md`](../../../RETENTION.md), which a test holds to the migrations in both directions.

## What goes in

| Source | What arrives | Where it lands |
| --- | --- | --- |
| The student | Courses, deadlines, notes, tasks, study material, syllabus uploads | The device first; the account when signed in |
| The student's files | Attachments and workspace files | The device only. Files never sync |
| Sign-in by SSO | A stable subject, an email, and optionally name, affiliation, groups, campus, department | Institution tables; nothing outside the allowlist |
| SCIM | `userName`, `externalId`, group membership, active flag | `institution_membership`, `scim_external_identity` |
| LTI launch | Opaque subject, issuer, deployment, course context and title, whether the person teaches | `lti_identity`, `lti_line_item` when a graded link is placed |
| School data pack | Calendars, buildings, dining tiers: no people | The student's device |
| Connected sources | Nothing today; no production adapter exists | Not applicable |

## What is held, for how long, and who can read it

| Data | Table | Kept | Who can read it |
| --- | --- | --- | --- |
| The student's courses, notes, tasks, sync state | `notes`, `tasks`, `state` and related | Until the student deletes it. Deleted rows leave a tombstone for 90 days | The account. No institutional role |
| Record of who read the student's rows | `access_log` | 90 days | The account it is about |
| Activity log (three pilot figures, one row per account, day and mark) | `activity` | 400 days | The account it is about |
| Gateway call metadata | `gateway_audit` | 180 days; never source text, prompts or model prose | Server-side only; not readable by browser roles |
| Institutional membership and roles | `institution_membership` | Kept until the school is removed or the approved institutional retention process removes it. Deprovisioning clears roles at once | The person, and a holder of `audit:read` at your school |
| SCIM credential | `scim_credential` | Kept until a tenant administrator removes it. Salted verification material, never the token | Nobody through the API |
| Provisioning audit | `provisioning_audit_event` | 3 years | A holder of `audit:read` at your school |
| Role-grant audit | `role_grant_audit_event` | 3 years | A holder of `audit:read` at your school |
| Common audit envelope | `audit_event` | 3 years | A holder of `audit:read` at your school |
| Support-read evidence | `support_access_event` | For as long as the student's records are; not on the 3-year clock | The student |
| Rights requests | `data_subject_request` | With the account; the fact an erasure completed is kept without an identity | The student; Semester operators |
| Tenant policy | `tenant_feature_policy` | Kept until a tenant administrator changes it or the school is removed | Members of the school; changed by a holder of `tenant:configure` |

Support access is a student's grant. It is limited to one aggregate scope, expires within seven days at most, and every read rechecks the role.

## What your institution sees

Institutional screens give aggregates with a floor of ten (`MIN_COHORT`): cells under ten are suppressed and there is no per-student grain. Forbidden measures are refused in code, among them individual student risk scores and covert reading-time tracking. The `Operations` tab needs `outcomes:read`. Course demand shows counts of ten or more.

Records such as grades, balances and accommodations reach institutional screens only through an approved adapter. None is approved today.

## What goes out

| Path | What leaves | Notes |
| --- | --- | --- |
| Student export | Every row naming the account, as one file, via `export_my_data` | Free in every billing state. Device-only files are outside it; a single archive including them does not exist. Three kinds of row are withheld as another person's record and the file names them |
| Student deletion | `erase_account` removes what the account owns in one transaction | Messages in threads others still read leave gaps. Financial records are kept seven years. Fails closed for staff who wrote to four immutable history tables |
| Rights requests | Worked by Semester operators | See [audit and data requests](AUDIT-AND-DATA-REQUESTS.md) |
| Health summary | Counts and states of connections | University, `Integrations` |
| School offboarding | Recorded and verified; no generator | See the [exit plan](EXIT-PLAN.md) |
| Subprocessors | Listed with their destination type: subprocessor, institution-directed or student-directed | [`SUBPROCESSORS.md`](../../SUBPROCESSORS.md) |

## Gaps to carry into your data map

- Device-only data is outside the server's export and erasure.
- The common audit envelope has two producers; other audit tables remain separate.
- Retention is stated from the repository. Production cron state is unverified.
- Your institution's own copies in your own systems follow your retention rules; Semester's erasure does not reach them.
