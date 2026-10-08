<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Campus services

**Done means:** Housing, dining, events, athletics, advising and support requests continue without a student having to re-apply, re-book or re-explain.

**Institution approver:** `data_owner` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| housing application and assignment | person + term + assignment | full | restricted |
| meal plan and dining balance | person + plan + term | summary | confidential |
| event, RSVP and organisation membership | event id / organisation + person | summary | internal |
| appointment and advising note | appointment id / person + advisor + date | full | restricted |
| support or service request | ticket id | full | confidential |
| accommodation record | person + accommodation + effective dates | full | restricted |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `campus_services.count.records` | count | low | `countParity` | Records by service |
| `campus_services.key.records` | key | high | `keyParity` | No booking, assignment or request lost or duplicated |
| `campus_services.semantic.times_and_places` | semantic | high | `valueParity` | Dates and times in campus zone, room/bed identifiers, plan codes, status |
| `campus_services.relationship.targets` | relationship | high | `referentialIntegrity` | Assignments reference real rooms and people; appointments reference real advisors |
| `campus_services.history.service_trail` | history | high | `historyPreserved` | Advising notes and request threads keep authorship and dates |
| `campus_services.history.assignments` | history | medium | `temporalContinuity` | Housing and plan effective dates keep their shape |
| `campus_services.permission.sensitive_notes` | permission | critical | `permissionParity` | Advising, counselling-adjacent, disability and conduct records visible only to the roles that could see them; no widening to general staff |
| `campus_services.outcome.occupancy_and_balance` | outcome | high | `aggregateParity` | Occupancy per building, dining balances and event headcount equal the source |

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **standard**.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `campus_services.room.crosswalk` | crosswalk | high | Every room maps to exactly one target room; no two collapse into one; nothing appears from nowhere. |
| `campus_services.room.preserved` | preserved | high | room: building, number mean the same thing after the move. |
| `campus_services.room.capacity` | preserved | high | room: capacity mean the same thing after the move (compared as number). |
| `campus_services.housing.crosswalk` | crosswalk | high | Every housing_assignment maps to exactly one target housing_assignment; no two collapse into one; nothing appears from nowhere. |
| `campus_services.housing.preserved` | preserved | high | housing_assignment: status mean the same thing after the move. |
| `campus_services.housing.room` | reference | high | Every housing_assignment.room_id points at a real room, and none that were fine in the source are orphaned. |
| `campus_services.housing.occupancy` | bounded | high | housing_assignment per room_id stays within room.capacity and equals the source count. |
| `campus_services.housing_event.crosswalk` | crosswalk | high | Every housing_event maps to exactly one target housing_event; no two collapse into one; nothing appears from nowhere. |
| `campus_services.housing_event.history` | history | high | housing_event: every event of each housing_assignment, in order, with the same values. |
| `campus_services.dining.crosswalk` | crosswalk | high | Every dining_plan maps to exactly one target dining_plan; no two collapse into one; nothing appears from nowhere. |
| `campus_services.dining.preserved` | preserved | high | dining_plan: plan_code, status mean the same thing after the move. |
| `campus_services.org.crosswalk` | crosswalk | medium | Every org_membership maps to exactly one target org_membership; no two collapse into one; nothing appears from nowhere. |
| `campus_services.org.preserved` | preserved | medium | org_membership: org_id, role, status mean the same thing after the move. |
| `campus_services.org.access` | permission | high | org_membership: nobody gains access they did not have; lost access is reported. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`, `outcome`.
**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |
| health and counseling records | T4 | Not migrated. Remains with the health and counseling service under its own rules. |
| conduct records | T4 | Not migrated. Remains with the conduct office; a hold may be migrated only as a registration hold with no reason attached. |
| housing accommodations | T4 | Not migrated. Disability-related housing needs remain with the accessibility office; a room is carried without the reason it was assigned. |
| roommate conflict and incident notes | T4 | Not migrated. Incident and conflict notes stay with residence life under its own rules. |

## Scope approvals

No field here is refused or needs a named approval.

## What a count will not show

- Accommodation records are among the most sensitive; widening them is critical even if the count is exact.
- Dining balances are stored value: a rounding or sign error is a financial one.
- Conduct and counselling records have their own legal regimes; whether they migrate at all is a decision for counsel and the data owner.

## Business outcomes to recompute, not copy

- Occupancy per building
- Dining balance per student
- Upcoming appointments per student
- Open requests per owner

## Calendar events the parallel run must include

- `move_in`
- `event_peak`
- `housing_selection`
