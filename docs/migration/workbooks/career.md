<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Career

**Done means:** A student or alumnus keeps their applications, employer relationships, experience records and verified achievements, and employers see only what was shared with them.

**Institution approver:** `data_owner` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| career profile and experience | person + record id | summary | confidential |
| application and offer | person + posting + application id | full | confidential |
| employer and posting | employer id / posting id | summary | internal |
| career appointment and note | appointment id | full | confidential |
| verified credential or achievement | person + credential + issuer + issued-at | full | confidential |
| alumni record | person + graduation + program | full | confidential |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `career.count.records` | count | low | `countParity` | Applications, postings and credentials by type |
| `career.key.applications` | key | high | `keyParity` | Each application once; employers matched across spelling and merger |
| `career.semantic.status_and_dates` | semantic | medium | `valueParity` | Application stage, offer status, dates, outcome codes |
| `career.relationship.targets` | relationship | high | `referentialIntegrity` | Applications reference live postings, postings reference employers |
| `career.history.pipeline` | history | medium | `historyPreserved` | Stage history of each application keeps original dates |
| `career.history.credential_validity` | history | high | `temporalContinuity` | Credential issue/expiry ranges keep their shape |
| `career.permission.sharing` | permission | critical | `permissionParity` | What each employer or recruiter can see equals what the student shared; nothing shared by default |
| `career.outcome.verified_achievements` | outcome | high | `outcomeParity` | Each credential still verifies against its issuer after migration; placement figures recompute to the published ones |

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **standard**.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `career.opportunity.crosswalk` | crosswalk | medium | Every opportunity maps to exactly one target opportunity; no two collapse into one; nothing appears from nowhere. |
| `career.opportunity.preserved` | preserved | medium | opportunity: employer, title, status mean the same thing after the move. |
| `career.opportunity.deadline` | preserved | high | opportunity: deadline_on mean the same thing after the move (compared as date). |
| `career.application.crosswalk` | crosswalk | high | Every application maps to exactly one target application; no two collapse into one; nothing appears from nowhere. |
| `career.application.unique` | unique | high | No two application rows repeat (student_id, opportunity_id). |
| `career.application.opportunity` | reference | high | Every application.opportunity_id points at a real opportunity, and none that were fine in the source are orphaned. |
| `career.application.preserved` | preserved | high | application: status mean the same thing after the move. |
| `career.application.submitted` | preserved | high | application: submitted_on mean the same thing after the move (compared as date). |
| `career.event.crosswalk` | crosswalk | high | Every application_event maps to exactly one target application_event; no two collapse into one; nothing appears from nowhere. |
| `career.event.history` | history | high | application_event: every event of each application, in order, with the same values. |
| `career.share.crosswalk` | crosswalk | critical | Every profile_share maps to exactly one target profile_share; no two collapse into one; nothing appears from nowhere. |
| `career.share.access` | permission | critical | profile_share: nobody gains access they did not have; lost access is reported. |
| `career.achievement.crosswalk` | crosswalk | high | Every verified_achievement maps to exactly one target verified_achievement; no two collapse into one; nothing appears from nowhere. |
| `career.achievement.preserved` | preserved | high | verified_achievement: kind, issuer, evidence_checksum, status mean the same thing after the move. |
| `career.achievement.issued` | preserved | high | verified_achievement: issued_on mean the same thing after the move (compared as date). |
| `career.alumni.crosswalk` | crosswalk | critical | Every alumni_profile maps to exactly one target alumni_profile; no two collapse into one; nothing appears from nowhere. |
| `career.alumni.privacy` | preserved | critical | alumni_profile: visibility, mentor_opt_in mean the same thing after the move. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`.
**Still needs results from outside the two extracts:** `outcome`, supplied as `external-checks.json` (see the workbook checks above for what to run). The gate refuses the domain until they arrive.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| confidential recommendation letters | T4 | Not migrated. Access and waiver rules differ by letter and need counsel review; they stay with the author or office. |
| employer private feedback | T3 | Not migrated. |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |

## Scope approvals

No field here is refused or needs a named approval.

## What a count will not show

- Student-shared and institution-held are one table; migrating it as one gives employers the institution's notes.
- Placement statistics are published externally; recomputation differences are reputational and sometimes reportable.
- Alumni consent to be contacted is a separate record from the academic one.

## Business outcomes to recompute, not copy

- Applications per student by stage
- Verified-credential set
- Employer-visible set per student
- Published placement figures

## Calendar events the parallel run must include

- `career_fair`
- `recruiting_cycle_close`
