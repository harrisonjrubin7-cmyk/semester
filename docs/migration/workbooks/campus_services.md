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
