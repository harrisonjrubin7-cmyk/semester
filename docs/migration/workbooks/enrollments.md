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

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **high** (no major defect tolerated; minor at 0.5%).

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `enrollments.enrollment.crosswalk` | crosswalk | critical | Every enrollment maps to exactly one target enrollment; no two collapse into one; nothing appears from nowhere. |
| `enrollments.enrollment.preserved` | preserved | critical | enrollment: status, grade_mode, credits mean the same thing after the move. |
| `enrollments.enrollment.dates` | preserved | high | enrollment: added_on, dropped_on mean the same thing after the move (compared as date). |
| `enrollments.enrollment.window` | temporal | high | enrollment.added_on is not after enrollment.dropped_on. |
| `enrollments.enrollment.student` | reference | critical | Every enrollment.student_id points at a real student_record, and none that were fine in the source are orphaned. |
| `enrollments.enrollment.section` | reference | critical | Every enrollment.section_id points at a real section, and none that were fine in the source are orphaned. |
| `enrollments.section.seats` | bounded | critical | enrollment per section_id stays within section.capacity and equals the source count. |
| `enrollments.student.load` | derived | critical | enrollments.student.load: the sum of enrollment.credits per student_record, recomputed from rows on both sides, agrees within 0. |
| `enrollments.event.crosswalk` | crosswalk | critical | Every enrollment_event maps to exactly one target enrollment_event; no two collapse into one; nothing appears from nowhere. |
| `enrollments.event.history` | history | critical | enrollment_event: every event of each enrollment, in order, with the same values. |
| `enrollments.access.crosswalk` | crosswalk | critical | Every schedule_access maps to exactly one target schedule_access; no two collapse into one; nothing appears from nowhere. |
| `enrollments.access.grant` | permission | critical | schedule_access: nobody gains access they did not have; lost access is reported. |
| `enrollments.waitlist.crosswalk` | crosswalk | critical | Every waitlist_entry maps to exactly one target waitlist_entry; no two collapse into one; nothing appears from nowhere. |
| `enrollments.waitlist.order` | order | critical | waitlist_entry keeps its sibling order within each section_id. |
| `enrollments.waitlist.preserved` | preserved | high | waitlist_entry: added_on mean the same thing after the move (compared as date). |
| `enrollments.hold.crosswalk` | crosswalk | critical | Every registration_hold maps to exactly one target registration_hold; no two collapse into one; nothing appears from nowhere. |
| `enrollments.hold.preserved` | preserved | critical | registration_hold: hold_code, active mean the same thing after the move. |
| `enrollments.hold.dates` | preserved | high | registration_hold: placed_on, released_on mean the same thing after the move (compared as date). |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`, `outcome`.
**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| hold reasons | T4 | Not migrated. The platform never stores why a hold exists (conduct, medical or financial reasons); only the code and its dates move, and the owning office keeps the reason. |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |

## Scope approvals

Fields the platform never ingests by default need a named approval from the records owner and the privacy lead before the mapping can be approved; fields in a class the platform floor refuses cannot be approved at all.

| Field | Class | Why | Needs |
| --- | --- | --- | --- |
| `enrollment.grade_mode` | T3 | never ingest | `scope.migration.enrollments.enrollment` |

Approvals to have on file: `scope.migration.enrollments.enrollment`.

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
