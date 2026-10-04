<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Courses and catalog

**Done means:** Every catalog entry and scheduled section students can see or register for is the one the registrar published, with the same rules attached.

**Institution approver:** `registrar` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| catalog entry | subject + number (+ catalog year) | full | internal |
| section | term + course + section | summary | internal |
| meeting pattern and room | section + days + start + end + room | summary | internal |
| prerequisite / corequisite / restriction rule | course + rule id | full | internal |
| instructor assignment | section + person + role | summary | internal |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `courses.count.sections` | count | low | `countParity` | Catalog entries and sections by term |
| `courses.key.sections` | key | high | `keyParity` | No section lost or duplicated, including cross-listed and combined sections |
| `courses.semantic.schedule` | semantic | high | `valueParity` | Credit hours, meeting days/times in the campus time zone, delivery mode, capacity and waitlist size |
| `courses.relationship.rules_and_instructors` | relationship | high | `referentialIntegrity` | Prerequisites point at courses that exist in the right catalog year; instructors are real people with that role |
| `courses.history.catalog_years` | history | medium | `historyPreserved` | Past catalog versions retained so old audits still resolve |
| `courses.history.effective_rules` | history | medium | `temporalContinuity` | Rule effective-date ranges keep their shape |
| `courses.permission.edit_rights` | permission | high | `permissionParity` | Who may edit a section, set capacity or override a prerequisite |
| `courses.outcome.seat_availability` | outcome | high | `aggregateParity` | Seats taken and open per section equal the source at the same instant |

## What a count will not show

- Times stored without a zone become shifted by the migration host's zone, off by an hour twice a year.
- Cross-listed sections count their seats twice or lose the second listing.
- A prerequisite expressed as free text is migrated as free text and enforced by nobody.

## Business outcomes to recompute, not copy

- Seats open per section
- Prerequisite-satisfied for sample students
- Schedule as a student sees it

## Calendar events the parallel run must include

- `schedule_publish`
- `capacity_change_batch`
