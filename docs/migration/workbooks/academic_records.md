<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Workbook: Academic records

**Done means:** The transcript, standing and degree progress of every student recompute to what the registrar already certifies, and no past grade has changed.

**Institution approver:** `registrar` (see [sign-off](../06-ACCEPTANCE-SIGNOFF-AND-EVIDENCE.md)).

## What to bring

| Entity | Natural key in the source | History | Sensitivity |
| --- | --- | --- | --- |
| term | term code | none | internal |
| program of study (declared, with effective dates) | person + program + effective-from | full | confidential |
| course result (grade, credits, repeat/forgiveness flags) | person + term + course + section | full | restricted |
| transfer and test credit | person + source institution + course + award date | full | restricted |
| academic standing and honours | person + term + standing code | full | restricted |
| degree award | person + program + conferral date | full | restricted |

Fill in per institution during inventory ([02](../02-SOURCE-INVENTORY-AND-EXTRACTION.md)): the source system and table for each entity, the extract method, the owner, and the cutoff date for history.

## Checks

A domain passes only when every evidence class has a check that examined something. Counts are listed first and are never enough.

| Check | Proves | Severity | Primitive | Compares |
| --- | --- | --- | --- | --- |
| `academic_records.count.results` | count | low | `countParity` | Course results by term against the source |
| `academic_records.key.results` | key | critical | `keyParity` | Each (person, term, course, section) result exists once |
| `academic_records.semantic.grades` | semantic | critical | `valueParity` | Grade, grade points, credits attempted/earned and repeat flags after the grade-scale table; "W", "I", "P" are not collapsed |
| `academic_records.relationship.result_to_section` | relationship | high | `referentialIntegrity` | Each result points at the section and term it was earned in, not just any section of that course |
| `academic_records.history.grade_changes` | history | critical | `historyPreserved` | Grade change history keeps original dates, approvers and reasons; nothing says "changed by migration" |
| `academic_records.history.program_timeline` | history | high | `temporalContinuity` | Program changes keep their effective dates with no new overlap or gap |
| `academic_records.permission.record_access` | permission | critical | `permissionParity` | Who may read or change a transcript: student, advisor, registrar staff, faculty of record; no widening |
| `academic_records.outcome.gpa` | outcome | critical | `outcomeParity` | Term and cumulative GPA recomputed in Semester from migrated results equals the registrar's figure for every student |
| `academic_records.outcome.degree_audit` | outcome | critical | `outcomeParity` | Remaining requirements and degree-eligibility recomputed equal the legacy audit for a stratified sample plus every graduating student |

## What the engine runs

`institution-migration validate` executes these against the source, target and crosswalk files. Each is **proven on the real data** by injecting a defect of its own kind and requiring the check to notice; a check that examined nothing holds the domain. Stakes: **high** (no major defect tolerated; minor at 0.5%).

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `academic_records.term.crosswalk` | crosswalk | high | Every term maps to exactly one target term; no two collapse into one; nothing appears from nowhere. |
| `academic_records.term.preserved` | preserved | high | term: name, status mean the same thing after the move. |
| `academic_records.term.dates` | preserved | high | term: starts_on, ends_on mean the same thing after the move (compared as date). |
| `academic_records.term.window` | temporal | high | term.starts_on is not after term.ends_on. |
| `academic_records.student.crosswalk` | crosswalk | critical | Every student_record maps to exactly one target student_record; no two collapse into one; nothing appears from nowhere. |
| `academic_records.student.preserved` | preserved | critical | student_record: standing, class_level mean the same thing after the move. |
| `academic_records.student.gpa` | derived | critical | academic_records.student.gpa: the weighted mean of course_result.grade_points per student_record, recomputed from rows on both sides, agrees within 0.005 and with the stated gpa. |
| `academic_records.student.credits` | derived | critical | academic_records.student.credits: the sum of course_result.credits per student_record, recomputed from rows on both sides, agrees within 0 and with the stated credits_earned. |
| `academic_records.result.crosswalk` | crosswalk | critical | Every course_result maps to exactly one target course_result; no two collapse into one; nothing appears from nowhere. |
| `academic_records.result.preserved` | preserved | critical | course_result: course_code, attempt, credits, grade, grade_points, status, counts_in_gpa, earned mean the same thing after the move. |
| `academic_records.result.student` | reference | critical | Every course_result.student_id points at a real student_record, and none that were fine in the source are orphaned. |
| `academic_records.result.term` | reference | critical | Every course_result.term_id points at a real term, and none that were fine in the source are orphaned. |
| `academic_records.grade_event.crosswalk` | crosswalk | critical | Every grade_event maps to exactly one target grade_event; no two collapse into one; nothing appears from nowhere. |
| `academic_records.grade_event.history` | history | critical | grade_event: every event of each course_result, in order, with the same values; grade is the last one. |
| `academic_records.access.crosswalk` | crosswalk | critical | Every record_access maps to exactly one target record_access; no two collapse into one; nothing appears from nowhere. |
| `academic_records.access.grant` | permission | critical | record_access: nobody gains access they did not have; lost access is reported. |
| `academic_records.program.crosswalk` | crosswalk | high | Every student_program maps to exactly one target student_program; no two collapse into one; nothing appears from nowhere. |
| `academic_records.program.preserved` | preserved | high | student_program: catalog_year, status mean the same thing after the move. |

**Evidence classes the engine covers on its own:** `count`, `key`, `semantic`, `relationship`, `history`, `permission`, `outcome`.
**Nothing is left to supply from outside:** the gate can pass this domain on executable evidence alone.

## What stays behind

| What | Class | What happens instead |
| --- | --- | --- |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |
| health and counseling records | T4 | Not migrated. Remains with the health and counseling service under its own rules. |
| conduct records | T4 | Not migrated. Remains with the conduct office; a hold may be migrated only as a registration hold with no reason attached. |
| free text advisor notes | T3 | Not migrated by default: notes are not a structured record and cannot be validated. The incumbent archive remains the record. |

## Scope approvals

Fields the platform never ingests by default need a named approval from the records owner and the privacy lead before the mapping can be approved; fields in a class the platform floor refuses cannot be approved at all.

| Field | Class | Why | Needs |
| --- | --- | --- | --- |
| `student_record.gpa` | T3 | never ingest | `scope.migration.academic_records.student_record` |
| `course_result.grade` | T3 | never ingest | `scope.migration.academic_records.course_result` |
| `course_result.grade_points` | T3 | never ingest | `scope.migration.academic_records.course_result` |
| `course_result.counts_in_gpa` | T3 | never ingest | `scope.migration.academic_records.course_result` |
| `grade_event.grade` | T3 | never ingest | `scope.migration.academic_records.grade_event` |

Approvals to have on file: `scope.migration.academic_records.course_result`, `scope.migration.academic_records.grade_event`, `scope.migration.academic_records.student_record`.

## What a count will not show

- Grade replacement and forgiveness rules change cumulative GPA while every row still matches.
- Catalog-year rules: a student audits under the catalog they entered, not the current one.
- Grades changed after posting are stored as the latest value; the audit trail is a separate table nobody extracted.
- In-progress terms migrate as final; a midterm grade becomes a transcript line.
- Legal and FERPA reading of who may see a record is for counsel and the registrar, not for the mapping.

## Business outcomes to recompute, not copy

- Term and cumulative GPA
- Academic standing
- Remaining degree requirements
- Degree-conferral eligibility

## Calendar events the parallel run must include

- `grade_posting`
- `term_close`
- `degree_conferral_review`
