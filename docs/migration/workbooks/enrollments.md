<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Enrollments

**Done means:** Every student is in exactly the sections the registrar says they are, with the same status, holds and registration eligibility.

**Institution approver:** `registrar` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| enrollment (status, credits, grade mode) | person + term + course + section | full | restricted |
| waitlist position | person + section + position + added-at | full | confidential |
| registration hold and eligibility | person + hold type + effective dates | full | restricted |
| registration window / appointment | term + audience + window | summary | internal |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `enrollments.count.enrollments` | count | low | `countParity` | Enrollments by term and status |
| `enrollments.key.enrollments` | key | critical | `keyParity` | One enrollment per person per section; no student enrolled twice or lost |
| `enrollments.semantic.status` | semantic | high | `valueParity` | Status (enrolled, waitlisted, withdrawn, audit), grade mode, credits and add/drop dates after code table |
| `enrollments.relationship.section_and_person` | relationship | critical | `referentialIntegrity` | Each enrollment references a real person and the right section in the right term |
| `enrollments.history.add_drop` | history | high | `historyPreserved` | Add/drop/withdraw events keep their dates (they decide tuition refunds and "W" vs "drop") |
| `enrollments.history.hold_timeline` | history | high | `temporalContinuity` | Holds keep their start/end so a released hold is not re-imposed and an active one is not lost |
| `enrollments.permission.registration_eligibility` | permission | critical | `permissionParity` | Who may register in which window; overrides and permission numbers |
| `enrollments.outcome.load_and_capacity` | outcome | high | `aggregateParity` | Credit load per student and enrolment per section equal the source; no section over capacity that was not |

## What a count will not show

- A waitlist is ordered; counting its rows ignores that the order is the product.
- Withdrawn rows are filtered out as "inactive" and the transcript loses its Ws.
- Holds migrate without end dates and block registration for students who were cleared.

## Business outcomes to recompute, not copy

- Enrolled credits per student
- Seats per section
- Registration eligibility per student
- Waitlist order

## Calendar events the parallel run must include

- `registration_window_open`
- `add_drop_deadline`
- `census_date`
