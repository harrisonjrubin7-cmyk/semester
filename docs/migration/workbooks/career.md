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
