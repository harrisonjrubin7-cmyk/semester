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

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **standard**.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `courses.course.crosswalk` | crosswalk | high | Every course maps to exactly one target course; no two collapse into one; nothing appears from nowhere. |
| `courses.course.unique` | unique | high | No two course rows repeat (course_code). |
| `courses.course.preserved` | preserved | high | course: title, department, status mean the same thing after the move. |
| `courses.course.credits` | preserved | high | course: credits mean the same thing after the move (compared as number). |
| `courses.section.crosswalk` | crosswalk | high | Every section maps to exactly one target section; no two collapse into one; nothing appears from nowhere. |
| `courses.section.unique` | unique | high | No two section rows repeat (term_id, course_code, section_no). |
| `courses.section.course` | reference | high | Every section.course_code points at a real course, and none that were fine in the source are orphaned. |
| `courses.section.preserved` | preserved | high | section: section_no, modality mean the same thing after the move. |
| `courses.section.capacity` | preserved | high | section: capacity mean the same thing after the move (compared as number). |
| `courses.version.crosswalk` | crosswalk | high | Every catalog_version maps to exactly one target catalog_version; no two collapse into one; nothing appears from nowhere. |
| `courses.version.history` | history | high | catalog_version: every event of each course, in order, with the same values. |
| `courses.editor.crosswalk` | crosswalk | high | Every section_editor maps to exactly one target section_editor; no two collapse into one; nothing appears from nowhere. |
| `courses.editor.grant` | permission | high | section_editor: nobody gains access they did not have; lost access is reported. |
| `courses.meeting.crosswalk` | crosswalk | high | Every section_meeting maps to exactly one target section_meeting; no two collapse into one; nothing appears from nowhere. |
| `courses.meeting.section` | reference | high | Every section_meeting.section_id points at a real section, and none that were fine in the source are orphaned. |
| `courses.meeting.preserved` | preserved | high | section_meeting: day, starts_at, ends_at, room mean the same thing after the move. |
| `courses.meeting.times` | temporal | medium | section_meeting.starts_at is not after section_meeting.ends_at. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`.
**Still needs results from outside the two extracts:** `outcome`, supplied as `external-checks.json` (see the workbook checks above for what to run). The gate refuses the domain until they arrive.

## What stays behind

Nothing in this domain is excluded by policy.

## Scope approvals

No field here is refused or needs a named approval.

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
