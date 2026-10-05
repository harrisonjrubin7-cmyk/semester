# Faculty Course Studio — design

**Status: partially superseded 1 Oct 2026 by D-1067.** F1–F7 (§7) were approved as
recommended. Slices follow §8. Every migration still needs separate approval
before it is applied to production.

The privacy, course-scope, immutable-publishing and student-control decisions
below still hold. The “no duplicate LMS/gradebook” product boundary does not:
Semester Institutional now includes a native LMS and gradebook intended to
replace the incumbent through a pilot, parallel run, migration and authorized
cutover. This document remains the historical design for Course Studio's first
slices; [D-1067](decisions/D-1067.md) records the newer direction.

The brief (`docs/expansion/Semester-Master-Implementation-Brief-v2.md`) puts
Faculty Course Studio in Phase 2, "Educator value", beside faculty-approved
study packs and course AI rules. It gives the role one line: *Faculty —
materials, course guidance, AI policy, Course Studio. Boundary: no duplicate
LMS/gradebook; no private plans by default.* This document is what that line
has to mean in this codebase.

## 1. What it is, and what it is not

A course's instructor, and nobody else, can publish three things for their
course and term:

1. **Course AI rules.** For each of the toolkit's ten named uses (brainstorming,
   practice, explanation, revision, final answers, …), whether it is allowed,
   allowed with disclosure, required, or not allowed. The rules can include the
   instructor's own words and a link to the syllabus.
2. **Course guidance.** A short, plain note: how to study for this course and
   what the instructor wants students to do before asking for help.
3. **Study packs.** A named, ordered list of course references with a guidance
   note, where each reference is marked authoritative, supplemental or "do not
   use". The references are links and citations, not files.

Students in the course see all three, labelled **"Set by your instructor"**,
with the date it was published. The AI tools they already have then follow the
rules.

**This first Course Studio slice is not:**
- the gradebook surface (the native gradebook is implemented separately);
- a file host or complete LMS authoring surface (packs still link out today);
- a roster;
- a view of any student's plan, study activity or AI use.

In the pilot an instructor sees nothing about individual students, and no
aggregates either (F5).

## 2. What exists (surveyed 27 Sep 2026)

| Piece | Where | State |
|---|---|---|
| Rules engine, `assignment → course → school → university`, ten `USES`, `PolicySource.by: 'instructor' \| 'institution' \| 'student-record'` | `app/src/lib/toolkit/policy.ts` | On main. **Only the student-record course layer is ever filled** (`fromCourse`, from `Course.ai`). `by: 'instructor'` exists and nothing produces it. |
| Callers | `Toolkit.tsx:67` builds `[fromCourse(course.ai)]`; the assignment and data panels resolve against it | The student's record is the only course layer. |
| Study Studio | `StudyStudio.tsx`, `lib/studystudio.ts` | Uses the older `stance` field and puts it into the prompt. It does not use `resolve()`. |
| `ai_policy` | `20260923210000_intelligence_policy.sql:49` | **One row per school**, written only by `university_admin`. No course rows. |
| `approved_source` | same file, :71 | The only table scoped to a course, but its `course_id` is free text. Writes need `source:approve` at **school** scope, which only `university_admin` holds. **Faculty cannot approve a source today**, although the table comment says "Faculty or institution approved". Every write is audited. |
| `faculty` role | `role_grants`, scope `course`, id `school/CODE` | Exists. Its capabilities are `skill:verify` and `help_request:respond`. **There is no `course:*` capability on the server.** |
| LTI | `functions/lti`, `_shared/lti.ts` | A launch knows the user `teaches` and has an opaque `context_id`. **A launch writes no role grant, and nothing maps an LMS context to `school/CODE`.** |
| Course identity | client `Course.code` ("BUS 1600"), `enrollments.code` + `term`, `groups.code` (`school/CODE`) + `term`, `role_grants.scope_id` (`school/CODE`, no term), LTI `context_id` | **Five keys, and nothing reconciles them.** |

## 3. The shape

**One new capability.** `course:publish` goes to `faculty`, and it is checked
at **course** scope (`scope_kind = 'course'`, `scope_id = '<school>/<CODE>'`).
Every write goes through a security-definer function that checks it:
`publish_course_rules`, `publish_course_guidance`, `publish_study_pack`, and
`approve_course_source` for pack references. A student or a stranger has no
path to write. Writes are audited in `tenant_policy_audit_event`, like
`approved_source` writes today.

**Versioned, not edited.** Publishing adds a new version, and students read the
latest one. A published version is never changed in place. That way, what a
student was shown on a given date can always be answered. It is the same
reasoning that made the consent copies in D-038 immutable.

**Read by the school's students.** Rules, guidance and packs are readable by
any signed-in member of the course's school, the same boundary
`approved_source` has today. They are course policy, not private data. A
student in another school reads nothing.

**The student side is a new layer, not a new path.** The published rules become
a `PolicySource { layer: 'course', by: 'instructor', uses, blanket, text, link,
effective, lastVerified }`. At the same layer, an instructor's rules beat the
student's own note: one small change to `resolve`. The student's note stays
visible as their own. The Toolkit, the assignment panel, the data panel and
Study Studio all go through `resolve()`. Study Studio moves off `stance` onto
the same engine, so there is one set of rules instead of two.

## 4. The course key (F2)

`<school>/<CODE>` plus a `term`, for example `vanderbilt/ECON 1020` and
`2026FA`.

- **The code** is normalised the way `enrollments.code` already is: upper case,
  one space, `^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$`.
- **The term** is on the rules and packs because a syllabus is per term, and
  last spring's AI policy is not this fall's.
- **The role grant has no term**, because teaching a course is the grant.
  Whether it should expire each term is part of F1.
- **The client** matches a catalog course by normalising `Course.code` into the
  same shape.

## 5. What students see

- **A course's page, the Toolkit and Study Studio** show a "Set by your
  instructor · published 3 Sep 2026" card with the rules in the instructor's
  words, plus the syllabus link if one was given.
- **Allowed and not-allowed uses follow those rules.** Anything the rules do
  not mention falls to the student's own note, then to "Policy unavailable",
  exactly as today.
- **A final answer to an assessment stays not allowed** unless the instructor
  names that use explicitly. A blanket "AI allowed" does not cover it, the same
  floor `fromCourse` keeps.
- **Study packs appear in Study Studio as source sets.** Choosing one selects
  its references, and "do not use" references are shown as such and are never
  offered to generation.

## 6. What faculty see (F6)

A **Course Studio** module. It is not a new top-level destination (the brief
§4 says contextual modules). It opens from a course for someone who holds
`faculty` on that course:

- **Rules:** ten rows, one per use, a state for each, your own words, and a
  syllabus link. Beside them is a **preview of exactly the student card**, and
  publishing asks for confirmation.
- **Guidance:** one note, with a preview.
- **Packs:** name, note, references (title, citation label, LMS link,
  authority), in order, with a preview.
- **History:** every version you published, with dates.

There is nothing about students in it.

## 7. Decisions needed from the owner

- **F1. How does someone become faculty for a course?**
  - Options: (a) the institution grants `faculty` at course scope, through the
    existing service-key path or a future admin screen; (b) automatically,
    from an LMS launch as Instructor.
  - **Recommendation: (a) in the pilot.** Nothing maps an LMS `context_id` to
    `school/CODE` today. Granting a role from an unmapped launch would let
    anyone who teaches any course publish rules for whichever course a mapping
    guessed.
  - Sub-question: should a course grant expire at term end? **Recommendation:
    yes, when an expiry is set.** The column exists; the institution sets it.
- **F2. The course key.** `school/CODE` plus term, as in §4.
  **Recommendation: yes.**
- **F3. Can an instructor explicitly allow "final answers for an assessment"?**
  Some courses require AI use on an assignment.
  - **Recommendation: yes, but only as its own row** that the instructor sets
    by hand, with a confirmation that names it. Never as part of a blanket
    "allowed".
- **F4. Who can read published rules, guidance and packs?**
  - Options: (a) any signed-in member of the school; (b) only students enrolled
    in the course.
  - **Recommendation: (a).** Enrolment is student-entered today (`enrollments`
    has no institutional source in the pilot), so (b) would restrict nothing
    real while looking like it did. Course policy is not private.
- **F5. What does an instructor see about students?**
  - **Recommendation: nothing in the pilot.** No roster, no counts, no "opened
    by". The brief says no private plans by default. An aggregate such as "n
    students used this pack" would need a threshold (n ≥ 10, as `demand:read`
    uses) and its own decision later.
- **F6. Where does Course Studio live?** **Recommendation:** a contextual
  module opened from the course, shown only to `faculty` grant holders, behind
  a new experience flag, off by default.
- **F7. Decision numbering.** The other session writes D-040 onward and has
  reached D-053. **Recommendation:** this session takes **D-100–D-119** for
  Phase 4 onward, so the two sessions never collide again.

## 8. Build plan, once decided

Each slice is small. Every migration needs approval before it is applied to
production.

1. **Server:** the `course:publish` capability; `course_ai_rules`,
   `course_guidance`, `study_packs` (versioned) and course-scoped
   `approved_source` writes, through four checked and audited functions.
   Check suite: a non-faculty user, faculty for another course, faculty at
   another school, and an expired grant can each publish nothing; students at
   the school can read; students elsewhere cannot; versions are immutable.
   **Needs approval.**
2. **Student side:** read the published rules for the student's courses and
   make them the instructor `PolicySource`. Instructor beats student record at
   the course layer. Move Study Studio onto `resolve()`. The card says "Set by
   your instructor".
3. **Faculty side:** the Course Studio module (rules, guidance, previews,
   publish, history), behind its flag.
4. **Study packs:** the pack builder, and packs as source sets in Study
   Studio, with "do not use" references never sent to generation.
   *Built (D-104): a pack is shown as the instructor's reading list, since its
   references carry links, not text; a source whose title matches a "do not
   use" reference is held back and named, whatever the student ticks.*

## 9. Not in this design

- LMS roster sync.
- Mapping an LMS context to a course (it needs the integration control plane's
  course mapping, and an admin to approve each mapping).
- Assignment-level rules. The engine has an `assignment` layer; a later slice
  can publish rules per assignment the same way.
- Anything with grades.
