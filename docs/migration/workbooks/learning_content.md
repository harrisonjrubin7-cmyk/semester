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

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **standard**.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `learning_content.site.crosswalk` | crosswalk | high | Every course_site maps to exactly one target course_site; no two collapse into one; nothing appears from nowhere. |
| `learning_content.site.preserved` | preserved | high | course_site: title, published mean the same thing after the move. |
| `learning_content.module.crosswalk` | crosswalk | high | Every module maps to exactly one target module; no two collapse into one; nothing appears from nowhere. |
| `learning_content.module.site` | reference | high | Every module.site_id points at a real course_site, and none that were fine in the source are orphaned. |
| `learning_content.module.preserved` | preserved | high | module: title, published mean the same thing after the move. |
| `learning_content.module.order` | order | high | module keeps its sibling order within each site_id. |
| `learning_content.item.crosswalk` | crosswalk | high | Every content_item maps to exactly one target content_item; no two collapse into one; nothing appears from nowhere. |
| `learning_content.item.module` | reference | high | Every content_item.module_id points at a real module, and none that were fine in the source are orphaned. |
| `learning_content.item.preserved` | preserved | high | content_item: kind, title, checksum, published mean the same thing after the move. |
| `learning_content.item.order` | order | high | content_item keeps its sibling order within each module_id. |
| `learning_content.revision.crosswalk` | crosswalk | high | Every content_revision maps to exactly one target content_revision; no two collapse into one; nothing appears from nowhere. |
| `learning_content.revision.history` | history | high | content_revision: every event of each content_item, in order, with the same values. |
| `learning_content.role.crosswalk` | crosswalk | high | Every site_role maps to exactly one target site_role; no two collapse into one; nothing appears from nowhere. |
| `learning_content.role.access` | permission | high | site_role: nobody gains access they did not have; lost access is reported. |
| `learning_content.site.points` | derived | high | learning_content.site.points: the sum of assignment.points per course_site, recomputed from rows on both sides, agrees within 0 and with the stated points_total. |
| `learning_content.assignment.crosswalk` | crosswalk | high | Every assignment maps to exactly one target assignment; no two collapse into one; nothing appears from nowhere. |
| `learning_content.assignment.preserved` | preserved | high | assignment: title, points, published mean the same thing after the move. |
| `learning_content.assignment.dates` | preserved | high | assignment: opens_at, due_at mean the same thing after the move (compared as date). |
| `learning_content.assignment.window` | temporal | medium | assignment.opens_at is not after assignment.due_at. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`, `outcome`.
**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| student submissions | T3 | Not part of default scope. The platform never ingests submissions by default. Moving them is a separate, named scope approval by the registrar and the Semester privacy lead, validated with history checks; until then the incumbent archive remains the record. |
| gradebook entries | T3 | Same as submissions: named approval required, never implicit in a content migration. |
| instructor notes | T3 | Not migrated. |

## Scope approvals

No field here is refused or needs a named approval.

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
