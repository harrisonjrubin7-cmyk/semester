<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Learning content

**Done means:** A faculty member opens last term's course and finds their materials, structure, assessments and grades as they left them, with the same students seeing the same things.

**Institution approver:** `faculty` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| course site / shell | LMS course id + term | summary | internal |
| content item (page, file, link, module) | course + item id + version | summary | internal |
| assignment and assessment (including question banks) | course + assessment id | full | confidential |
| submission and feedback | assessment + person + attempt | full | restricted |
| gradebook entry | course + person + gradable item | full | restricted |
| discussion and announcement | course + post id | summary | confidential |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `learning_content.count.items` | count | low | `countParity` | Items by type per course |
| `learning_content.key.items` | key | high | `keyParity` | Every item in scope exists once; files are matched by content digest, not name |
| `learning_content.semantic.assessment_settings` | semantic | high | `valueParity` | Points, weighting, due and availability dates (with zone), attempt limits, time limits, accommodations extensions |
| `learning_content.relationship.structure` | relationship | high | `referentialIntegrity` | Items sit in the right module and course; embedded links and file references resolve; grade columns point at their assessments |
| `learning_content.history.submissions` | history | critical | `historyPreserved` | Submissions keep original timestamps, attempt order and feedback authorship (late/on-time must survive) |
| `learning_content.permission.visibility` | permission | critical | `permissionParity` | Draft vs published, section restrictions, per-student releases, instructor/TA/auditor roles; no unpublished item visible, no grade visible early |
| `learning_content.outcome.course_grade` | outcome | critical | `outcomeParity` | Course total recomputed from migrated gradebook entries and weights equals the source's final grade for every student in sampled courses |
| `learning_content.outcome.render` | outcome | medium | `outcomeParity` | A sampled item renders with the same content hash of its visible text, and media plays (accessibility alternatives retained) |

## What a count will not show

- Weights and dropped-lowest rules live in settings; items match and the final grade is wrong.
- Draft and hidden content migrates as published.
- Question-bank randomisation and attempt rules are dropped, turning a supervised exam into an open one.
- Alt text, captions and transcripts are stored as separate attachments and not carried.
- Copyright and licence status of third-party content is not ours to decide; counsel and the library decide what may be moved.

## Business outcomes to recompute, not copy

- Course grade per student
- Visible-to-student set per assessment
- Submission timeliness

## Calendar events the parallel run must include

- `assignment_due_cycle`
- `grade_release`
- `exam_window`
