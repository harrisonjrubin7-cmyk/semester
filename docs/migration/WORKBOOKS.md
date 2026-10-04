# Migration workbooks

> Generated from `app/src/lib/migration-assurance/domains.ts` by `renderAll()`. Do not edit by hand: `MIGRATION_DOCS=write npx vitest run src/lib/migration-assurance/workbook.test.ts` regenerates it, and the test fails when this file and the declarations disagree. The method these workbooks serve is in [METHODOLOGY.md](METHODOLOGY.md).

| Domain | Stakes | Owner | Entities | Checks | Scope approvals |
| --- | --- | --- | --- | --- | --- |
| [Identity](#identity) | high | Registrar and central IT (identity management) | 3 | 11 | 0 |
| [Academic records](#academic-records) | high | Registrar | 5 | 16 | 3 |
| [Courses and catalog](#courses-and-catalog) | standard | Registrar (catalog and scheduling) | 3 | 13 | 0 |
| [Learning content](#learning-content) | standard | Provost's office / teaching and learning center, with each department | 4 | 14 | 0 |
| [Enrollments and registration](#enrollments-and-registration) | high | Registrar (registration and records) | 3 | 14 | 1 |
| [Finance](#finance) | high | Bursar / student accounts | 3 | 11 | 2 |
| [Family and guardians](#family-and-guardians) | high | Registrar (FERPA officer) with the dean of students | 3 | 9 | 0 |
| [Campus services](#campus-services) | standard | Dean of students / auxiliary services | 4 | 11 | 0 |
| [Career and lifelong](#career-and-lifelong) | standard | Career center and alumni relations | 4 | 13 | 0 |
| [Documents](#documents) | high | Registrar and records management | 3 | 12 | 0 |

## Identity

- **Domain id:** `identity`
- **Stakes:** high (a wrong record is a harm to a person; no tolerance for major or critical defects)
- **Answers "is this right":** Registrar and central IT (identity management)
- **Loads after:** nothing (first)
- **Typical sources:** Identity provider or directory (LDAP, Azure AD, Okta); SIS person table; Provisioning system (SCIM source)

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `person` | A person with a relationship to the institution | person_id | 8 | T3 |
| `external_identity` | A sign-in identity bound to a person | idp + subject | 3 | T3 |
| `role_grant` | A role a person holds, and where | grant_id | 5 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `person.person_id` | T3 | in scope |
| `person.legal_name` | T3 | in scope |
| `person.preferred_name` | T3 | in scope |
| `person.email` | T3 | in scope |
| `person.date_of_birth` | T3 | in scope |
| `person.status` | T3 | in scope |
| `person.affiliation` | T3 | in scope |
| `person.directory_suppressed` — FERPA directory-information opt-out | T3 | in scope |
| `external_identity.idp` | T3 | in scope |
| `external_identity.subject` | T3 | in scope |
| `external_identity.person_id` | T3 | in scope |
| `role_grant.grant_id` | T3 | in scope |
| `role_grant.person_id` | T3 | in scope |
| `role_grant.role_scope` | T3 | in scope |
| `role_grant.granted_on` | T3 | in scope |
| `role_grant.expires_on` | T3 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| government identifiers | T4 | Never migrated (national ID, SSN, passport). Semester keys on person_id and the institutional email. |
| authentication secrets | T6 | Never exported or imported (password hashes, MFA seeds). People sign in again through the institution identity provider. |
| immigration status | T4 | Not migrated. Remains with the international office. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- Normalize email to lower case and trim whitespace; record the count changed.
- Identify duplicate people (same name and date of birth, different identifiers) and list them for the registrar. Nothing is merged without an approved merge decision.
- Flag people with no active affiliation but an active role grant.
- Flag identities that bind one sign-in subject to two people.

### 5. Transformation rules

- Assign a stable Semester person key; write the source-to-target crosswalk.
- Map affiliation and status vocabularies through an approved lookup table; an unmapped value stops the run.
- Provision through the tenant SCIM path; unknown groups grant nothing.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `identity.person.crosswalk` | crosswalk | critical | Every person maps to exactly one target person; no two collapse into one; nothing appears from nowhere. |
| `identity.person.preserved` | preserved | critical | person: legal_name, preferred_name, email, date_of_birth, status, affiliation mean the same thing after the move. |
| `identity.person.suppression` | preserved | critical | person: directory_suppressed mean the same thing after the move. |
| `identity.person.email_unique` | unique | critical | No two person rows repeat (email). |
| `identity.external_identity.crosswalk` | crosswalk | major | Every external_identity maps to exactly one target external_identity; no two collapse into one; nothing appears from nowhere. |
| `identity.external_identity.unique` | unique | critical | No two external_identity rows repeat (idp, subject). |
| `identity.external_identity.reference` | reference | critical | Every external_identity.person_id points at a real person, and none that were fine in the source are orphaned. |
| `identity.external_identity.binding` | preserved | critical | external_identity:  mean the same thing after the move. |
| `identity.role_grant.crosswalk` | crosswalk | major | Every role_grant maps to exactly one target role_grant; no two collapse into one; nothing appears from nowhere. |
| `identity.role_grant.access` | permission | critical | role_grant: nobody gains access they did not have; lost access is reported. |
| `identity.role_grant.expiry` | preserved | major | role_grant: expires_on mean the same thing after the move (compared as date). |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0%**.
- Minor: **0.5%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **3** clean cycles in a row, at least one of which exercised the real event. Tolerance: exact.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `identity.lifecycle` — Join, leave and role change | `identity_change` | `can_sign_in`, `roles`, `directory_visibility` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days; above minor, the Semester side also countersigns.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] No two people were combined unless the registrar approved that merge by name.
- [ ] Every person who could sign in before can sign in now, bound to the same person; nobody can sign in as someone else.
- [ ] Nobody holds a role they did not hold in the source system; any role lost is listed and accepted.
- [ ] Every directory-information opt-out carried across exactly.

Signed — Registrar and central IT (identity management) (data owner): ____________________  Date: ________

## Academic records

- **Domain id:** `academic_records`
- **Stakes:** high (a wrong record is a harm to a person; no tolerance for major or critical defects)
- **Answers "is this right":** Registrar
- **Loads after:** `identity`
- **Typical sources:** Student information system (Banner, Colleague, PeopleSoft, Workday Student); Transcript archive; Degree-audit system

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `term` | An academic term | term_id | 5 | T0 |
| `student_record` | A student academic record | student_id | 6 | T3 |
| `course_result` | One attempt at one course by one student | result_id | 11 | T3 |
| `grade_event` | A recorded change to a grade, in sequence | event_id | 6 | T3 |
| `student_program` | A declared program of study | student_id + program_code | 5 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `term.term_id` | T0 | in scope |
| `term.name` | T0 | in scope |
| `term.starts_on` | T0 | in scope |
| `term.ends_on` | T0 | in scope |
| `term.status` | T0 | in scope |
| `student_record.student_id` | T3 | in scope |
| `student_record.person_id` | T3 | in scope |
| `student_record.gpa` — a stated figure; recomputed from results on both sides | T3 | needs `scope.migration.academic_records.student_record` (never ingested by default) |
| `student_record.credits_earned` | T3 | in scope |
| `student_record.standing` | T3 | in scope |
| `student_record.class_level` | T3 | in scope |
| `course_result.result_id` | T3 | in scope |
| `course_result.student_id` | T3 | in scope |
| `course_result.term_id` | T0 | in scope |
| `course_result.course_code` | T0 | in scope |
| `course_result.attempt` | T3 | in scope |
| `course_result.credits` | T3 | in scope |
| `course_result.grade` | T3 | needs `scope.migration.academic_records.course_result` (never ingested by default) |
| `course_result.grade_points` | T3 | needs `scope.migration.academic_records.course_result` (never ingested by default) |
| `course_result.status` | T3 | in scope |
| `course_result.counts_in_gpa` | T3 | needs `scope.migration.academic_records.course_result` (never ingested by default) |
| `course_result.earned` | T3 | in scope |
| `grade_event.event_id` | T3 | in scope |
| `grade_event.result_id` | T3 | in scope |
| `grade_event.seq` | T3 | in scope |
| `grade_event.grade` | T3 | needs `scope.migration.academic_records.grade_event` (never ingested by default) |
| `grade_event.changed_on` | T3 | in scope |
| `grade_event.change_code` | T3 | in scope |
| `student_program.student_id` | T3 | in scope |
| `student_program.program_code` | T0 | in scope |
| `student_program.catalog_year` | T0 | in scope |
| `student_program.status` | T3 | in scope |
| `student_program.declared_on` | T3 | in scope |

Approvals this domain needs on file: `scope.migration.academic_records.course_result`, `scope.migration.academic_records.grade_event`, `scope.migration.academic_records.student_record`.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |
| health and counseling records | T4 | Not migrated. Remains with the health and counseling service under its own rules. |
| conduct records | T4 | Not migrated. Remains with the conduct office; a hold may be migrated only as a registration hold with no reason attached. |
| free text advisor notes | T3 | Not migrated by default: notes are not a structured record and cannot be validated. The incumbent archive remains the record. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- Record the source system's own stated GPA and credits next to the recomputed figures; list every student where they already disagree. These are inherited findings, never silently corrected.
- Resolve letter grades to the institution's grade table; an unmapped grade stops the run.
- Flag results whose term falls outside the student's enrollment dates.
- Preserve withdrawn, incomplete and repeated attempts as attempts; do not collapse retakes.

### 5. Transformation rules

- Carry grade, grade points, credits and the counts-in-GPA and earned flags exactly; derive nothing.
- Load every grade-change event with its sequence; the current grade must equal the last event.
- Assign target keys; write the crosswalk for students, results, events and programs.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `academic_records.term.crosswalk` | crosswalk | major | Every term maps to exactly one target term; no two collapse into one; nothing appears from nowhere. |
| `academic_records.term.preserved` | preserved | major | term: name, status mean the same thing after the move. |
| `academic_records.term.dates` | preserved | major | term: starts_on, ends_on mean the same thing after the move (compared as date). |
| `academic_records.term.window` | temporal | major | term.starts_on is not after term.ends_on. |
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
| `academic_records.program.crosswalk` | crosswalk | major | Every student_program maps to exactly one target student_program; no two collapse into one; nothing appears from nowhere. |
| `academic_records.program.preserved` | preserved | major | student_program: catalog_year, status mean the same thing after the move. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0%**.
- Minor: **0.5%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **3** clean cycles in a row, at least one of which exercised the real event. Tolerance: exact.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `academic_records.grade_posting` — Grade submission and posting | `grade_submission` | `posted_grade`, `term_gpa`, `cumulative_gpa`, `standing` |
| `academic_records.transcript` — Transcript request | `transcript_request` | `lines`, `cumulative_gpa`, `credits_earned` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days; above minor, the Semester side also countersigns.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every student's GPA and earned credits, recomputed from their results, match the source to the tolerance, and no student's result belongs to a different student.
- [ ] Every grade change is present, in order, with the same values; the current grade is the last change.
- [ ] A sample of transcripts, drawn by the registrar and not by Semester, matches the incumbent transcript line for line.
- [ ] Grades and GPA moved only under a recorded scope approval; nothing else from the record moved.

Signed — Registrar (data owner): ____________________  Date: ________

## Courses and catalog

- **Domain id:** `courses`
- **Stakes:** standard (defects are tolerated within the thresholds below and go to the exception queue)
- **Answers "is this right":** Registrar (catalog and scheduling)
- **Loads after:** `academic_records`, `identity`
- **Typical sources:** SIS catalog and schedule of classes; Curriculum management system

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `course` | A catalog course | course_code | 5 | T0 |
| `section` | A scheduled section of a course in a term | section_id | 7 | T1 |
| `section_meeting` | A recurring meeting of a section | meeting_id | 6 | T0 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `course.course_code` | T0 | in scope |
| `course.title` | T0 | in scope |
| `course.credits` | T0 | in scope |
| `course.department` | T0 | in scope |
| `course.status` | T0 | in scope |
| `section.section_id` | T0 | in scope |
| `section.term_id` | T0 | in scope |
| `section.course_code` | T0 | in scope |
| `section.section_no` | T0 | in scope |
| `section.capacity` | T0 | in scope |
| `section.instructor_person_id` | T1 | in scope |
| `section.modality` | T0 | in scope |
| `section_meeting.meeting_id` | T0 | in scope |
| `section_meeting.section_id` | T0 | in scope |
| `section_meeting.day` | T0 | in scope |
| `section_meeting.starts_at` | T0 | in scope |
| `section_meeting.ends_at` | T0 | in scope |
| `section_meeting.room` | T0 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

Nothing in this domain is excluded by policy.

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- Normalize subject and number casing; list courses whose code differs only by case or spacing.
- List sections with no meeting pattern (arranged, online) so absence is a recorded fact, not a gap.
- Flag cross-listed sections; decide one primary per cross-list before load.

### 5. Transformation rules

- Meeting days to the canonical 0–6 form and times to local 24-hour wall time; keep the source string in the lineage record.
- Credits to a number; keep the source text.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `courses.course.crosswalk` | crosswalk | major | Every course maps to exactly one target course; no two collapse into one; nothing appears from nowhere. |
| `courses.course.unique` | unique | major | No two course rows repeat (course_code). |
| `courses.course.preserved` | preserved | major | course: title, department, status mean the same thing after the move. |
| `courses.course.credits` | preserved | major | course: credits mean the same thing after the move (compared as number). |
| `courses.section.crosswalk` | crosswalk | major | Every section maps to exactly one target section; no two collapse into one; nothing appears from nowhere. |
| `courses.section.unique` | unique | major | No two section rows repeat (term_id, course_code, section_no). |
| `courses.section.course` | reference | major | Every section.course_code points at a real course, and none that were fine in the source are orphaned. |
| `courses.section.preserved` | preserved | major | section: section_no, modality mean the same thing after the move. |
| `courses.section.capacity` | preserved | major | section: capacity mean the same thing after the move (compared as number). |
| `courses.meeting.crosswalk` | crosswalk | major | Every section_meeting maps to exactly one target section_meeting; no two collapse into one; nothing appears from nowhere. |
| `courses.meeting.section` | reference | major | Every section_meeting.section_id points at a real section, and none that were fine in the source are orphaned. |
| `courses.meeting.preserved` | preserved | major | section_meeting: day, starts_at, ends_at, room mean the same thing after the move. |
| `courses.meeting.times` | temporal | minor | section_meeting.starts_at is not after section_meeting.ends_at. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0.1%**.
- Minor: **1%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **2** clean cycles in a row, at least one of which exercised the real event. Tolerance: 0.005 on numbers, exact otherwise.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `courses.schedule` — Schedule of classes publication | `schedule_publication` | `sections_published`, `meeting_patterns`, `capacity` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every section a student could register for in the source is present with the same course, term, capacity, meeting pattern and instructor.
- [ ] No course or section appears that the registrar did not publish.
- [ ] Every meeting pattern renders the same day and wall-clock time in the calendar as in the schedule of classes.

Signed — Registrar (catalog and scheduling) (data owner): ____________________  Date: ________

## Learning content

- **Domain id:** `learning_content`
- **Stakes:** standard (defects are tolerated within the thresholds below and go to the exception queue)
- **Answers "is this right":** Provost's office / teaching and learning center, with each department
- **Loads after:** `courses`
- **Typical sources:** LMS course exports (Common Cartridge, Canvas, Brightspace, Blackboard, Moodle); Course repositories; Media platform

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `course_site` | A course site in the learning platform | site_id | 4 | T1 |
| `module` | A unit of the course outline | module_id | 5 | T1 |
| `content_item` | A page, file, link or media item in a module | item_id | 7 | T1 |
| `assignment` | An assignment and its dates | assignment_id | 7 | T1 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `course_site.site_id` | T1 | in scope |
| `course_site.section_id` | T0 | in scope |
| `course_site.title` | T1 | in scope |
| `course_site.published` | T1 | in scope |
| `module.module_id` | T1 | in scope |
| `module.site_id` | T1 | in scope |
| `module.position` | T1 | in scope |
| `module.title` | T1 | in scope |
| `module.published` | T1 | in scope |
| `content_item.item_id` | T1 | in scope |
| `content_item.module_id` | T1 | in scope |
| `content_item.position` | T1 | in scope |
| `content_item.kind` | T1 | in scope |
| `content_item.title` | T1 | in scope |
| `content_item.checksum` — hash of the file bytes, taken at extraction | T1 | in scope |
| `content_item.published` | T1 | in scope |
| `assignment.assignment_id` | T1 | in scope |
| `assignment.site_id` | T1 | in scope |
| `assignment.title` | T1 | in scope |
| `assignment.opens_at` | T1 | in scope |
| `assignment.due_at` | T1 | in scope |
| `assignment.points` | T1 | in scope |
| `assignment.published` | T1 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| student submissions | T3 | Not part of default scope. The platform never ingests submissions by default. Moving them is a separate, named scope approval by the registrar and the Semester privacy lead, validated with history checks; until then the incumbent archive remains the record. |
| gradebook entries | T3 | Same as submissions: named approval required, never implicit in a content migration. |
| instructor notes | T3 | Not migrated. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- Hash every file at extraction, from the source bytes, and record the hash beside the item.
- List broken internal links, missing files and unpublished items so each is a decision.
- Detect content with third-party licensing or embedded external tools that cannot move; list them for the instructor.
- Resolve time zones: due dates carry the source zone explicitly.

### 5. Transformation rules

- Rebuild the outline from parent and position; keep sibling order.
- Convert file types only where the target cannot render the source type, and record each conversion with before and after hashes.
- Rewrite internal links through the crosswalk; an unresolvable link is an exception, never dropped.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `learning_content.site.crosswalk` | crosswalk | major | Every course_site maps to exactly one target course_site; no two collapse into one; nothing appears from nowhere. |
| `learning_content.site.preserved` | preserved | major | course_site: title, published mean the same thing after the move. |
| `learning_content.module.crosswalk` | crosswalk | major | Every module maps to exactly one target module; no two collapse into one; nothing appears from nowhere. |
| `learning_content.module.site` | reference | major | Every module.site_id points at a real course_site, and none that were fine in the source are orphaned. |
| `learning_content.module.preserved` | preserved | major | module: title, published mean the same thing after the move. |
| `learning_content.module.order` | order | major | module keeps its sibling order within each site_id. |
| `learning_content.item.crosswalk` | crosswalk | major | Every content_item maps to exactly one target content_item; no two collapse into one; nothing appears from nowhere. |
| `learning_content.item.module` | reference | major | Every content_item.module_id points at a real module, and none that were fine in the source are orphaned. |
| `learning_content.item.preserved` | preserved | major | content_item: kind, title, checksum, published mean the same thing after the move. |
| `learning_content.item.order` | order | major | content_item keeps its sibling order within each module_id. |
| `learning_content.assignment.crosswalk` | crosswalk | major | Every assignment maps to exactly one target assignment; no two collapse into one; nothing appears from nowhere. |
| `learning_content.assignment.preserved` | preserved | major | assignment: title, points, published mean the same thing after the move. |
| `learning_content.assignment.dates` | preserved | major | assignment: opens_at, due_at mean the same thing after the move (compared as date). |
| `learning_content.assignment.window` | temporal | minor | assignment.opens_at is not after assignment.due_at. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0.1%**.
- Minor: **1%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **2** clean cycles in a row, at least one of which exercised the real event. Tolerance: 0.005 on numbers, exact otherwise.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `learning_content.open` — Course sites open for the term | `term_start` | `outline`, `files_by_hash`, `due_dates` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every course site opens with the same outline, in the same order, with the same files by hash.
- [ ] Every assignment has the same title, points and dates, with time zones preserved.
- [ ] Items that cannot move are listed to the instructor before cutover, not discovered by students after.

Signed — Provost's office / teaching and learning center, with each department (data owner): ____________________  Date: ________

## Enrollments and registration

- **Domain id:** `enrollments`
- **Stakes:** high (a wrong record is a harm to a person; no tolerance for major or critical defects)
- **Answers "is this right":** Registrar (registration and records)
- **Loads after:** `academic_records`, `courses`, `identity`
- **Typical sources:** SIS registration tables; Waitlist system; Hold management

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `enrollment` | A student's enrollment in a section | enrollment_id | 9 | T3 |
| `waitlist_entry` | A place on a section waitlist | waitlist_id | 5 | T3 |
| `registration_hold` | A hold that blocks registration | hold_id | 6 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `enrollment.enrollment_id` | T3 | in scope |
| `enrollment.student_id` | T3 | in scope |
| `enrollment.section_id` | T0 | in scope |
| `enrollment.term_id` | T0 | in scope |
| `enrollment.status` | T3 | in scope |
| `enrollment.grade_mode` | T3 | needs `scope.migration.enrollments.enrollment` (never ingested by default) |
| `enrollment.credits` | T3 | in scope |
| `enrollment.added_on` | T3 | in scope |
| `enrollment.dropped_on` | T3 | in scope |
| `waitlist_entry.waitlist_id` | T3 | in scope |
| `waitlist_entry.section_id` | T0 | in scope |
| `waitlist_entry.student_id` | T3 | in scope |
| `waitlist_entry.position` | T3 | in scope |
| `waitlist_entry.added_on` | T3 | in scope |
| `registration_hold.hold_id` | T3 | in scope |
| `registration_hold.student_id` | T3 | in scope |
| `registration_hold.hold_code` | T3 | in scope |
| `registration_hold.placed_on` | T3 | in scope |
| `registration_hold.released_on` | T3 | in scope |
| `registration_hold.active` | T3 | in scope |

Approvals this domain needs on file: `scope.migration.enrollments.enrollment`.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| hold reasons | T4 | Not migrated. The platform never stores why a hold exists (conduct, medical or financial reasons); only the code and its dates move, and the owning office keeps the reason. |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- List enrollments in sections no longer in the catalog and enrollments for students with no record.
- List sections already over capacity in the source; they are inherited, not introduced.
- Freeze registration in the source for the rehearsal extract window, or take the extract from a consistent snapshot; record which.

### 5. Transformation rules

- Carry status and grade mode as recorded; map vocabularies through an approved lookup; an unmapped status stops the run.
- Waitlist position carried as an ordered sequence, not recomputed.
- Holds carry code and dates only.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `enrollments.enrollment.crosswalk` | crosswalk | critical | Every enrollment maps to exactly one target enrollment; no two collapse into one; nothing appears from nowhere. |
| `enrollments.enrollment.preserved` | preserved | critical | enrollment: status, grade_mode, credits mean the same thing after the move. |
| `enrollments.enrollment.dates` | preserved | major | enrollment: added_on, dropped_on mean the same thing after the move (compared as date). |
| `enrollments.enrollment.window` | temporal | major | enrollment.added_on is not after enrollment.dropped_on. |
| `enrollments.enrollment.student` | reference | critical | Every enrollment.student_id points at a real student_record, and none that were fine in the source are orphaned. |
| `enrollments.enrollment.section` | reference | critical | Every enrollment.section_id points at a real section, and none that were fine in the source are orphaned. |
| `enrollments.section.seats` | bounded | critical | enrollment per section_id stays within section.capacity and equals the source count. |
| `enrollments.student.load` | derived | critical | enrollments.student.load: the sum of enrollment.credits per student_record, recomputed from rows on both sides, agrees within 0. |
| `enrollments.waitlist.crosswalk` | crosswalk | critical | Every waitlist_entry maps to exactly one target waitlist_entry; no two collapse into one; nothing appears from nowhere. |
| `enrollments.waitlist.order` | order | critical | waitlist_entry keeps its sibling order within each section_id. |
| `enrollments.waitlist.preserved` | preserved | major | waitlist_entry: added_on mean the same thing after the move (compared as date). |
| `enrollments.hold.crosswalk` | crosswalk | critical | Every registration_hold maps to exactly one target registration_hold; no two collapse into one; nothing appears from nowhere. |
| `enrollments.hold.preserved` | preserved | critical | registration_hold: hold_code, active mean the same thing after the move. |
| `enrollments.hold.dates` | preserved | major | registration_hold: placed_on, released_on mean the same thing after the move (compared as date). |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0%**.
- Minor: **0.5%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **3** clean cycles in a row, at least one of which exercised the real event. Tolerance: exact.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `enrollments.registration` — Registration period | `registration_window` | `schedule`, `credit_load`, `seats_remaining`, `waitlist_position`, `holds_applied` |
| `enrollments.add_drop` — Add and drop | `add_drop_period` | `schedule`, `credit_load`, `tuition_effect` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days; above minor, the Semester side also countersigns.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every student sees exactly the schedule the incumbent shows; credit load per student per term is identical.
- [ ] No section holds more seats than its capacity unless it already did; waitlists keep their order.
- [ ] Every active hold still blocks the same students; no hold appears that did not exist.
- [ ] A registration day rehearsal on migrated data produces the same outcomes as the incumbent for the same inputs.

Signed — Registrar (registration and records) (data owner): ____________________  Date: ________

## Finance

- **Domain id:** `finance`
- **Stakes:** high (a wrong record is a harm to a person; no tolerance for major or critical defects)
- **Answers "is this right":** Bursar / student accounts
- **Loads after:** `academic_records`
- **Typical sources:** Student accounts receivable (ERP); Payment plan system; Payment processor reports

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `account` | A student account | account_id | 5 | T3 |
| `ledger_entry` | One signed charge, payment, adjustment or reversal | entry_id | 7 | T3 |
| `payment_plan` | An installment arrangement | plan_id | 5 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `account.account_id` | T3 | in scope |
| `account.student_id` | T3 | in scope |
| `account.currency` | T3 | in scope |
| `account.status` | T3 | in scope |
| `account.stated_balance_cents` — whole minor units; never a float | T3 | needs `scope.migration.finance.account` (never displayed by default) |
| `ledger_entry.entry_id` | T3 | in scope |
| `ledger_entry.account_id` | T3 | in scope |
| `ledger_entry.term_id` | T0 | in scope |
| `ledger_entry.charge_code` | T3 | in scope |
| `ledger_entry.amount_cents` | T3 | needs `scope.migration.finance.ledger_entry` (never displayed by default) |
| `ledger_entry.posted_on` | T3 | in scope |
| `ledger_entry.reversal_of` | T3 | in scope |
| `payment_plan.plan_id` | T3 | in scope |
| `payment_plan.account_id` | T3 | in scope |
| `payment_plan.status` | T3 | in scope |
| `payment_plan.installment_count` | T3 | in scope |
| `payment_plan.next_due_on` | T3 | in scope |

Approvals this domain needs on file: `scope.migration.finance.account`, `scope.migration.finance.ledger_entry`.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| financial aid awards | T3 | Not migrated. Aid is never ingested; Semester shows an action item and a link to the financial aid office. |
| payment card data | T6 | Never copied. Cards stay tokenised at the processor; nothing about them is in a migration file. |
| bank account numbers | T6 | Never copied. Bank details stay with the bank and the processor; nothing about them is in a migration file. |
| collections and legal notes | T4 | Not migrated; remain with student accounts and counsel. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- Convert every amount to whole minor units in the extract; reject any value with a fractional minor unit.
- Recompute every account balance from its ledger on the source side and list each account whose stated balance already disagrees.
- List unapplied payments, orphan reversals and entries dated outside any term.
- Freeze posting in the source for the cutover extract; capture the posting cut-off time.

### 5. Transformation rules

- Load the ledger append-only with original posting dates; never re-derive an amount.
- Carry reversal links through the crosswalk.
- Balance is recomputed in the target from entries and compared to the source; it is never loaded as a number alone.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `finance.account.crosswalk` | crosswalk | critical | Every account maps to exactly one target account; no two collapse into one; nothing appears from nowhere. |
| `finance.account.preserved` | preserved | critical | account: currency, status mean the same thing after the move. |
| `finance.account.balance` | derived | critical | finance.account.balance: the sum of ledger_entry.amount_cents per account, recomputed from rows on both sides, agrees within 0 and with the stated stated_balance_cents. |
| `finance.ledger.crosswalk` | crosswalk | critical | Every ledger_entry maps to exactly one target ledger_entry; no two collapse into one; nothing appears from nowhere. |
| `finance.ledger.amount` | preserved | critical | ledger_entry: amount_cents mean the same thing after the move (compared as number). |
| `finance.ledger.preserved` | preserved | critical | ledger_entry: charge_code, posted_on mean the same thing after the move. |
| `finance.ledger.account` | reference | critical | Every ledger_entry.account_id points at a real account, and none that were fine in the source are orphaned. |
| `finance.ledger.reversal` | reference | critical | Every ledger_entry.reversal_of points at a real ledger_entry, and none that were fine in the source are orphaned. |
| `finance.plan.crosswalk` | crosswalk | major | Every payment_plan maps to exactly one target payment_plan; no two collapse into one; nothing appears from nowhere. |
| `finance.plan.preserved` | preserved | major | payment_plan: status, installment_count mean the same thing after the move. |
| `finance.plan.due` | preserved | major | payment_plan: next_due_on mean the same thing after the move (compared as date). |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0%**.
- Minor: **0.5%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **3** clean cycles in a row, at least one of which exercised the real event. Tolerance: exact.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `finance.billing` — Billing cycle | `billing_cycle` | `statement_total_cents`, `due_date`, `late_fee_cents`, `plan_installment_cents` |
| `finance.payments` — Payment posting | `payment_posting` | `balance_cents`, `receipt` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days; above minor, the Semester side also countersigns.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] For every account, the balance recomputed from the migrated ledger equals the source to the cent; the total across all accounts equals the general ledger control total.
- [ ] No amount is a float anywhere in the pipeline.
- [ ] A full billing cycle in parallel produces identical statements, due dates and late-fee outcomes.
- [ ] Nothing about aid awards, cards or bank accounts is in any file.

Signed — Bursar / student accounts (data owner): ____________________  Date: ________

## Family and guardians

- **Domain id:** `family`
- **Stakes:** high (a wrong record is a harm to a person; no tolerance for major or critical defects)
- **Answers "is this right":** Registrar (FERPA officer) with the dean of students
- **Loads after:** `academic_records`, `identity`
- **Typical sources:** SIS proxy-access and release records; FERPA consent forms; Parent portal

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `guardian_relationship` | A recorded relationship between a student and a guardian | relationship_id | 5 | T3 |
| `consent_record` | A consent a student gave, or withdrew | consent_id | 8 | T3 |
| `proxy_access` | Access a guardian currently holds to a student's information | proxy_id | 4 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `guardian_relationship.relationship_id` | T3 | in scope |
| `guardian_relationship.student_id` | T3 | in scope |
| `guardian_relationship.guardian_person_id` | T3 | in scope |
| `guardian_relationship.relationship` | T3 | in scope |
| `guardian_relationship.status` | T3 | in scope |
| `consent_record.consent_id` | T3 | in scope |
| `consent_record.student_id` | T3 | in scope |
| `consent_record.guardian_person_id` | T3 | in scope |
| `consent_record.scope` | T3 | in scope |
| `consent_record.granted_on` | T3 | in scope |
| `consent_record.revoked_on` | T3 | in scope |
| `consent_record.basis` | T3 | in scope |
| `consent_record.active` | T3 | in scope |
| `proxy_access.proxy_id` | T3 | in scope |
| `proxy_access.student_id` | T3 | in scope |
| `proxy_access.guardian_person_id` | T3 | in scope |
| `proxy_access.scope` | T3 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| court orders and custody documents | T4 | Not migrated as data. Held by the registrar as documents under counsel's direction; any restriction they impose is entered as an explicit block by a person. |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |
| health and counseling records | T4 | Not migrated. Remains with the health and counseling service under its own rules. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- List every proxy grant with no matching active consent in the source; these are inherited findings and are never migrated as access until the registrar rules.
- List consents past any expiry the institution's policy sets, and students whose age or status changes who may consent.
- List guardians linked to students who no longer have an active record.

### 5. Transformation rules

- Carry consent dates, scope and active flag exactly; a revoked consent must load revoked.
- Access is derived from consent, never the other way round: no access row is created without a consent row.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `family.relationship.crosswalk` | crosswalk | critical | Every guardian_relationship maps to exactly one target guardian_relationship; no two collapse into one; nothing appears from nowhere. |
| `family.relationship.preserved` | preserved | critical | guardian_relationship: relationship, status mean the same thing after the move. |
| `family.consent.crosswalk` | crosswalk | critical | Every consent_record maps to exactly one target consent_record; no two collapse into one; nothing appears from nowhere. |
| `family.consent.preserved` | preserved | critical | consent_record: scope, basis, active mean the same thing after the move. |
| `family.consent.dates` | preserved | critical | consent_record: granted_on, revoked_on mean the same thing after the move (compared as date). |
| `family.consent.window` | temporal | major | consent_record.granted_on is not after consent_record.revoked_on. |
| `family.consent.student` | reference | critical | Every consent_record.student_id points at a real student_record, and none that were fine in the source are orphaned. |
| `family.proxy.crosswalk` | crosswalk | critical | Every proxy_access maps to exactly one target proxy_access; no two collapse into one; nothing appears from nowhere. |
| `family.proxy.access` | permission | critical | proxy_access: nobody gains access they did not have; every grant has an active consent_record record; lost access is reported. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0%**.
- Minor: **0.5%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **3** clean cycles in a row, at least one of which exercised the real event. Tolerance: exact.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `family.access` — Guardian access review | `access_review` | `visible_scopes`, `consent_active` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days; above minor, the Semester side also countersigns.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] No guardian can see any student's information that they could not see before, and none can see it without an active consent record.
- [ ] Every revocation carried across as a revocation, with its date.
- [ ] Where the institution's policy changes who may consent, the change is a signed decision with counsel review, not a migration side effect.

Signed — Registrar (FERPA officer) with the dean of students (data owner): ____________________  Date: ________

## Campus services

- **Domain id:** `campus_services`
- **Stakes:** standard (defects are tolerated within the thresholds below and go to the exception queue)
- **Answers "is this right":** Dean of students / auxiliary services
- **Loads after:** `academic_records`
- **Typical sources:** Housing management system; Dining and card office; Student organization platform

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `room` | A housing room | room_id | 4 | T1 |
| `housing_assignment` | A student assigned to a room for a term | assignment_id | 6 | T3 |
| `dining_plan` | A meal plan for a student and term | plan_id | 5 | T3 |
| `org_membership` | A student's role in an organization | membership_id | 5 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `room.room_id` | T1 | in scope |
| `room.building` | T1 | in scope |
| `room.number` | T1 | in scope |
| `room.capacity` | T1 | in scope |
| `housing_assignment.assignment_id` | T3 | in scope |
| `housing_assignment.student_id` | T3 | in scope |
| `housing_assignment.room_id` | T1 | in scope |
| `housing_assignment.term_id` | T0 | in scope |
| `housing_assignment.status` | T3 | in scope |
| `housing_assignment.check_in_on` | T3 | in scope |
| `dining_plan.plan_id` | T3 | in scope |
| `dining_plan.student_id` | T3 | in scope |
| `dining_plan.plan_code` | T1 | in scope |
| `dining_plan.term_id` | T0 | in scope |
| `dining_plan.status` | T3 | in scope |
| `org_membership.membership_id` | T1 | in scope |
| `org_membership.student_id` | T3 | in scope |
| `org_membership.org_id` | T1 | in scope |
| `org_membership.role` | T1 | in scope |
| `org_membership.status` | T1 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |
| health and counseling records | T4 | Not migrated. Remains with the health and counseling service under its own rules. |
| conduct records | T4 | Not migrated. Remains with the conduct office; a hold may be migrated only as a registration hold with no reason attached. |
| housing accommodations | T4 | Not migrated. Disability-related housing needs remain with the accessibility office; a room is carried without the reason it was assigned. |
| roommate conflict and incident notes | T4 | Not migrated. Incident and conflict notes stay with residence life under its own rules. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- List students assigned to rooms that no longer exist and rooms over capacity in the source.
- List meal plans with no matching term or student.
- Separate organizations that are active from archived; archived ones are carried as archived.

### 5. Transformation rules

- Rooms and assignments carry building, number and status; reasons for assignment are not carried.
- Memberships carry role and status only.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `campus_services.room.crosswalk` | crosswalk | major | Every room maps to exactly one target room; no two collapse into one; nothing appears from nowhere. |
| `campus_services.room.preserved` | preserved | major | room: building, number mean the same thing after the move. |
| `campus_services.room.capacity` | preserved | major | room: capacity mean the same thing after the move (compared as number). |
| `campus_services.housing.crosswalk` | crosswalk | major | Every housing_assignment maps to exactly one target housing_assignment; no two collapse into one; nothing appears from nowhere. |
| `campus_services.housing.preserved` | preserved | major | housing_assignment: status mean the same thing after the move. |
| `campus_services.housing.room` | reference | major | Every housing_assignment.room_id points at a real room, and none that were fine in the source are orphaned. |
| `campus_services.housing.occupancy` | bounded | major | housing_assignment per room_id stays within room.capacity and equals the source count. |
| `campus_services.dining.crosswalk` | crosswalk | major | Every dining_plan maps to exactly one target dining_plan; no two collapse into one; nothing appears from nowhere. |
| `campus_services.dining.preserved` | preserved | major | dining_plan: plan_code, status mean the same thing after the move. |
| `campus_services.org.crosswalk` | crosswalk | minor | Every org_membership maps to exactly one target org_membership; no two collapse into one; nothing appears from nowhere. |
| `campus_services.org.preserved` | preserved | minor | org_membership: org_id, role, status mean the same thing after the move. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0.1%**.
- Minor: **1%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **2** clean cycles in a row, at least one of which exercised the real event. Tolerance: 0.005 on numbers, exact otherwise.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `campus_services.housing` — Housing move-in | `move_in` | `room`, `occupancy`, `meal_plan` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every resident sees their own room and nobody else's; no room exceeds its capacity unless it already did.
- [ ] Every meal plan matches the card office for the term.
- [ ] No accommodation, health, counseling or conduct information is present in any form.

Signed — Dean of students / auxiliary services (data owner): ____________________  Date: ________

## Career and lifelong

- **Domain id:** `career`
- **Stakes:** standard (defects are tolerated within the thresholds below and go to the exception queue)
- **Answers "is this right":** Career center and alumni relations
- **Loads after:** `academic_records`, `identity`
- **Typical sources:** Career platform (Handshake, Symplicity); Alumni CRM; Credential and co-curricular records

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `opportunity` | A job, internship or research opportunity | opportunity_id | 5 | T1 |
| `application` | A student's application to an opportunity | application_id | 5 | T3 |
| `verified_achievement` | A verified achievement or credential | achievement_id | 7 | T3 |
| `alumni_profile` | A graduate's profile and its visibility | profile_id | 5 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `opportunity.opportunity_id` | T1 | in scope |
| `opportunity.employer` | T1 | in scope |
| `opportunity.title` | T1 | in scope |
| `opportunity.deadline_on` | T1 | in scope |
| `opportunity.status` | T1 | in scope |
| `application.application_id` | T3 | in scope |
| `application.student_id` | T3 | in scope |
| `application.opportunity_id` | T1 | in scope |
| `application.status` | T3 | in scope |
| `application.submitted_on` | T3 | in scope |
| `verified_achievement.achievement_id` | T3 | in scope |
| `verified_achievement.student_id` | T3 | in scope |
| `verified_achievement.kind` | T3 | in scope |
| `verified_achievement.issuer` | T3 | in scope |
| `verified_achievement.issued_on` | T3 | in scope |
| `verified_achievement.evidence_checksum` | T3 | in scope |
| `verified_achievement.status` | T3 | in scope |
| `alumni_profile.profile_id` | T3 | in scope |
| `alumni_profile.person_id` | T3 | in scope |
| `alumni_profile.graduation_term_id` | T0 | in scope |
| `alumni_profile.visibility` — a privacy setting | T3 | in scope |
| `alumni_profile.mentor_opt_in` | T3 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| confidential recommendation letters | T4 | Not migrated. Access and waiver rules differ by letter and need counsel review; they stay with the author or office. |
| employer private feedback | T3 | Not migrated. |
| accommodation records | T4 | Not migrated. The disability or accessibility office keeps the record; Semester stores no accommodation, flag or inference. Changing this is a decision for the institution and counsel, not a migration setting. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- List achievements whose evidence file is missing or whose issuer is unrecognized; a "verified" label is carried only where the evidence hash matches.
- Resolve duplicate applications; list, do not delete.
- List alumni profiles with no recorded visibility choice; they load as private, never as public.

### 5. Transformation rules

- Visibility carried exactly; a missing value loads as the most private setting and is listed.
- Achievements carry their evidence hash; verification status is never upgraded by the migration.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `career.opportunity.crosswalk` | crosswalk | minor | Every opportunity maps to exactly one target opportunity; no two collapse into one; nothing appears from nowhere. |
| `career.opportunity.preserved` | preserved | minor | opportunity: employer, title, status mean the same thing after the move. |
| `career.opportunity.deadline` | preserved | major | opportunity: deadline_on mean the same thing after the move (compared as date). |
| `career.application.crosswalk` | crosswalk | major | Every application maps to exactly one target application; no two collapse into one; nothing appears from nowhere. |
| `career.application.unique` | unique | major | No two application rows repeat (student_id, opportunity_id). |
| `career.application.opportunity` | reference | major | Every application.opportunity_id points at a real opportunity, and none that were fine in the source are orphaned. |
| `career.application.preserved` | preserved | major | application: status mean the same thing after the move. |
| `career.application.submitted` | preserved | major | application: submitted_on mean the same thing after the move (compared as date). |
| `career.achievement.crosswalk` | crosswalk | major | Every verified_achievement maps to exactly one target verified_achievement; no two collapse into one; nothing appears from nowhere. |
| `career.achievement.preserved` | preserved | major | verified_achievement: kind, issuer, evidence_checksum, status mean the same thing after the move. |
| `career.achievement.issued` | preserved | major | verified_achievement: issued_on mean the same thing after the move (compared as date). |
| `career.alumni.crosswalk` | crosswalk | critical | Every alumni_profile maps to exactly one target alumni_profile; no two collapse into one; nothing appears from nowhere. |
| `career.alumni.privacy` | preserved | critical | alumni_profile: visibility, mentor_opt_in mean the same thing after the move. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0.1%**.
- Minor: **1%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **2** clean cycles in a row, at least one of which exercised the real event. Tolerance: 0.005 on numbers, exact otherwise.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `career.applications` — Application deadline | `application_deadline` | `application_status`, `alumni_visibility` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every application and its status is where the student left it.
- [ ] Every verified achievement is verified by the same issuer on the same evidence, or is not shown as verified.
- [ ] No alumnus becomes more visible than they chose to be.

Signed — Career center and alumni relations (data owner): ____________________  Date: ________

## Documents

- **Domain id:** `documents`
- **Stakes:** high (a wrong record is a harm to a person; no tolerance for major or critical defects)
- **Answers "is this right":** Registrar and records management
- **Loads after:** `identity`
- **Typical sources:** Document imaging system; Transcript archive; Shared drives and portals

### 1. Source inventory

One row per entity. The institution fills the system, table, owner, volume and extraction method columns in `inventory.csv`; the rest is fixed.

| Entity | What it is | Identified by | Fields | Highest class |
| --- | --- | --- | --- | --- |
| `document` | A document and its metadata | document_id | 11 | T3 |
| `document_version` | One version of a document | version_id | 5 | T3 |
| `document_access` | A person's access to a document | access_id | 4 | T3 |

### 2. Field mapping and scope

Every field has a data class (T0–T6). T4 and above are refused by the platform floor. Fields the platform never ingests by default need a named scope approval from the records owner and the Semester privacy lead before the mapping can be approved.

| Field | Class | Scope |
| --- | --- | --- |
| `document.document_id` | T3 | in scope |
| `document.owner_person_id` | T3 | in scope |
| `document.kind` | T3 | in scope |
| `document.title` | T3 | in scope |
| `document.mime_type` | T3 | in scope |
| `document.byte_size` | T3 | in scope |
| `document.checksum` — hash of the bytes, taken from the source file at extraction | T3 | in scope |
| `document.created_on` | T3 | in scope |
| `document.retention_class` | T3 | in scope |
| `document.legal_hold` | T3 | in scope |
| `document.access_level` | T3 | in scope |
| `document_version.version_id` | T3 | in scope |
| `document_version.document_id` | T3 | in scope |
| `document_version.version_no` | T3 | in scope |
| `document_version.checksum` | T3 | in scope |
| `document_version.created_on` | T3 | in scope |
| `document_access.access_id` | T3 | in scope |
| `document_access.document_id` | T3 | in scope |
| `document_access.person_id` | T3 | in scope |
| `document_access.level` | T3 | in scope |

No named scope approval is needed for this domain.

### 3. Not migrated

| What stays behind | Class | What happens instead |
| --- | --- | --- |
| documents of sensitive kinds | T4 | Documents of kind medical form, accommodation letter, conduct notice or counseling note are not migrated, whatever system they sit in. They are listed by kind and count in the source inventory so their absence is a decision. |
| unreadable or corrupt source files | T3 | Never repaired in flight. Listed as exceptions; the institution decides to re-scan, accept the loss in writing, or exclude. |

### 4. Cleansing rules

Run on a copy, never on the source. Each rule records how many rows it changed; a rule that changes more than expected stops the run. Cleansing never fixes an inherited defect silently — those are listed and decided in the exception queue.

- Hash every source file at extraction, from the bytes on disk, with a tool independent of the transform.
- List files that cannot be opened, zero-byte files and files whose recorded size differs from the bytes.
- List documents with no owner, and documents owned by a person who is not in scope.
- List documents under legal hold before anything moves; a held document is migrated only with the hold intact, and never deleted from the source by this program.

### 5. Transformation rules

- Copy bytes unchanged; convert nothing. A format conversion is a separate, approved, evidenced step with before and after hashes.
- Carry retention class and hold exactly; a missing retention class loads as unclassified and is listed.

### 6. Validation

Row-count equality is a precondition and earns nothing. These checks decide correctness; each runs on both sides and through the crosswalk.

| Check | Kind | If it fails | What it asks |
| --- | --- | --- | --- |
| `documents.document.crosswalk` | crosswalk | critical | Every document maps to exactly one target document; no two collapse into one; nothing appears from nowhere. |
| `documents.document.content` | preserved | critical | document: checksum, byte_size, mime_type mean the same thing after the move. |
| `documents.document.owner` | preserved | critical | document:  mean the same thing after the move. |
| `documents.document.hold` | preserved | critical | document: legal_hold, retention_class mean the same thing after the move. |
| `documents.document.metadata` | preserved | major | document: kind, title, access_level mean the same thing after the move. |
| `documents.document.created` | preserved | major | document: created_on mean the same thing after the move (compared as date). |
| `documents.document.person` | reference | critical | Every document.owner_person_id points at a real person, and none that were fine in the source are orphaned. |
| `documents.version.crosswalk` | crosswalk | major | Every document_version maps to exactly one target document_version; no two collapse into one; nothing appears from nowhere. |
| `documents.version.preserved` | preserved | major | document_version: checksum, version_no mean the same thing after the move. |
| `documents.version.order` | order | major | document_version keeps its sibling order within each document_id. |
| `documents.access.crosswalk` | crosswalk | critical | Every document_access maps to exactly one target document_access; no two collapse into one; nothing appears from nowhere. |
| `documents.access.grant` | permission | critical | document_access: nobody gains access they did not have; lost access is reported. |

### 7. Thresholds

- Critical defects introduced by the migration: **0**, always. Not a setting.
- Major, as a fraction of the rows a check examined: **0%**.
- Minor: **0.5%**.
- Row counts reconcile exactly: source − excluded − approved merges = target.
- Every check examined at least one row, or the institution attested in writing that its population is empty.
- Every check was proven, on this data, to detect an injected defect of its own kind.
- A school may set stricter thresholds. It cannot set looser ones.

### 8. Parallel run

Ends on **3** clean cycles in a row, at least one of which exercised the real event. Tolerance: exact.

| Workflow | Must include | Outcomes compared |
| --- | --- | --- |
| `documents.request` — Document retrieval | `document_request` | `bytes_hash`, `who_can_open`, `hold` |

### 9. Exceptions

Decision due within 24 hours (critical), 72 hours (major), 10 days (minor). Defects the migration introduced are fixed in the mapping and cannot be waived. Inherited defects may be fixed at source, excluded, or waived by a named approver for at most 90 days; above minor, the Semester side also countersigns.

### 10. Acceptance criteria

The institution signs these. Each is backed by a check, a parallel-run workflow, or both.

- [ ] Every migrated document is byte-identical to its source by hash, belongs to the same person, and carries the same hold and retention class.
- [ ] Nobody can open a document they could not open before; nobody who could has lost the ability without a signed exception.
- [ ] A sample drawn by the records manager opens and reads correctly in the target.

Signed — Registrar and records management (data owner): ____________________  Date: ________

