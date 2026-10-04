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
