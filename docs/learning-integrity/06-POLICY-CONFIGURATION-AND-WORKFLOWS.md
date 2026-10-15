# 06 · Policy configuration, and faculty and tutor workflows

Deliverables covered: **faculty/tutor workflows** and **policy configuration
requirements**.

## 1. Who may set what

Policy is layered, and a lower layer may only move *within* the bounds of the
layer above. Today the code has the precedence (assignment → course → school/
program → university → Semester fallback) and the student's own record of the
course stance; **the assignment, school and university layers "have types and
precedence but no source of data yet"** (`docs/ai-toolkit/RUBRIC-AND-AI-USE-POLICY.md`).
That source is this document's main requirement.

| Layer | Who sets it | May set | May **not** set |
| --- | --- | --- | --- |
| Semester fallback | Semester (fixed) | `unavailable` for anything unset | Anything permissive |
| University / institution | Academic governance body, via the institution admin | Floors and ceilings: which use classes may ever be allowed; whether assistive class is always allowed (must be true); whether transcripts may ever be shared (default no); proctoring availability; integrity process roles and timings; retention | A rule that removes an accommodation; a rule that makes the tutor an enforcement agent |
| School / program | Dean or program chair | Narrower defaults for their courses | Wider than the institution |
| Course | Course instructor of record | Stance per use class within bounds; disclosure rules; allowed sources; tutor context; flexibility rules; late and reassessment policy | Wider than the school; anything about a named student |
| Assignment | Course staff with the assignment role | Overrides within the course's bounds, with the process evidence the assignment requires | Retroactive changes after work has begun (see §3) |
| Student | The student | Their *own* private choices (access modes, which sources to share, what to disclose) | Any layer above |

| ID | Requirement | Today |
| --- | --- | --- |
| LI-POL-01 | Policy layers are stored per tenant with an owner, an effective date, a version and a status (*draft / published / superseded*), and resolved by one function used by UI and gateway. | Partial: resolver `lib/toolkit/policy.ts`; no server store for assignment/school/university layers |
| LI-POL-02 | A lower layer cannot be more permissive than a higher layer, and an unset layer inherits (never defaults to permissive). | Partial: unset = unavailable is held in `app/src/lib/toolkit/policy.ts`; bounds-checking between layers is absent |
| LI-POL-03 | Every change is an audit event: who, what, from, to, when, reason. | Absent |
| LI-POL-04 | The use classes are `assistive`, `mechanical`, `explanatory`, `feedback`, `generative` ([03 §6](03-AI-TUTORING-AND-BOUNDARIES.md)); `assistive` cannot be set to prohibited at any layer. | Absent; existing uses to be mapped onto classes |
| LI-POL-05 | A course that has recorded no policy shows "Policy unavailable — ask your instructor" and the tutor treats graded-linked work as unavailable. | Held: `app/src/lib/toolkit/policy.ts`, `app/src/lib/toolkit/policy.test.ts` |
| LI-POL-06 | A configured value that the student reads as text is generated from the stored policy (the syllabus statement, the assignment card), so the words and the enforcement are one source. | Absent |
| LI-POL-07 | Policy labels carry provenance: *set by the institution / the instructor (verified) / the student's own record, not verified*. | Held: `fromCourse()` label in `app/src/lib/toolkit/policy.ts` |

## 2. The policy object (shape, not implementation)

Illustrative; field names are provisional. A stored policy is one record per
layer per scope.

```jsonc
{
  "scope": { "layer": "assignment", "tenant": "…", "course": "…", "assignment": "…" },
  "version": 3,
  "status": "published",
  "effective_from": "2026-10-05T00:00:00Z",
  "owner": { "role": "instructor_of_record", "person": "…" },
  "uses": {
    "assistive":   "allowed",              // fixed; cannot be changed
    "mechanical":  "allowed",
    "explanatory": "allowed",
    "feedback":    "limited",              // allowed with disclosure
    "generative":  "prohibited"
  },
  "tutor": { "max_rung": 6, "modes": ["explain", "hint", "practice", "review"], "sources": "course_and_student" },
  "disclosure": { "required_for": ["feedback"], "form": "ai_use_declaration" },
  "process_evidence": { "requested": ["version_history", "source_list"], "announced_at": "2026-10-05T00:00:00Z", "reason_shown_to_students": "…" },
  "assessment_design": { "options_chosen": ["staged_submission", "oral_follow_up_sample"] },
  "integrity": { "match_report": false, "referral_roles": ["integrity_office"], "informal_first": true },
  "flexibility": { "no_questions_extensions": 2, "late_policy": { "per_day": 5, "cap": 25 } },
  "students_told": "Plain-language text generated from the fields above"
}
```

## 3. Versioning and fairness over time

| ID | Rule | Today |
| --- | --- | --- |
| LI-POL-08 | A published policy is immutable; a change creates a new version with an effective date. | Absent |
| LI-POL-09 | Work governed by a policy version stays governed by it: a submission, an attempt, a tutoring session and a declaration each record the policy version in force when they began. | Absent |
| LI-POL-10 | A change that **tightens** policy takes effect only for work not yet started, and students with work in progress are notified before it applies. A change that **loosens** policy applies immediately. | Absent |
| LI-POL-11 | A student can view the history of policy versions for a course. | Absent |
| LI-POL-12 | When the instructor, course or institution layer disagree, the resolver says which layer decided and why, in words a student can read. | Held: precedence and labelled layers in `app/src/lib/toolkit/policy.ts` |

## 4. Presets (to keep faculty burden low)

Most instructors will not author a policy field by field. Five presets cover
the common cases, each editable; each states in plain language what the
student may and may not do and what the tutor will and won't do.

| Preset | Generative | Feedback on own work | Explanation / hints | Disclosure | Process evidence |
| --- | --- | --- | --- | --- | --- |
| **Unaided** | prohibited | prohibited | prohibited for the task; allowed for concepts | — | optional |
| **Assistive only** | prohibited | prohibited | allowed (concepts) | — | optional |
| **Scaffolded** *(proposed default for coursework)* | prohibited | allowed | allowed up to rung 6 | optional | requested where announced |
| **Open with disclosure** | limited | allowed | allowed | required | requested |
| **AI required** | required for stated uses | allowed | allowed | required | requested |

`assistive` is allowed in all five. The institution may remove presets from
its menu but cannot add a preset that prohibits `assistive`.

## 5. Faculty workflows

| # | Workflow | Steps | System support | Today |
| --- | --- | --- | --- | --- |
| F1 | **Set up a course's policy** | pick preset → adjust → preview student view → publish | Preset library; student-view preview; generated syllabus text; version stored | Absent |
| F2 | **Design an assignment with AI in mind** | choose design options (§2.2 of [02](02-ASSESSMENT-MASTERY-AND-FEEDBACK.md)) → attach policy → announce process evidence → publish | Builder step that prompts the four options and records the choice | Absent |
| F3 | **Build or review an assessment** | draw from the item bank → review AI-drafted items (accuracy, bias, accessibility) → approve → assemble from blueprint | Item bank rules | Partial: `itembank.ts`, not wired |
| F4 | **Publish a rubric** | create with levels and descriptors, map to outcomes, publish with the assignment | Rubric engine | Partial: `rubricengine.ts`, not wired |
| F5 | **Grade and give feedback** | open submission → select rubric levels → write feedback → (optional) AI feedback draft from my selections → edit → release | Rubric levels; draft labelled and unreleased; release event | Absent as UI |
| F6 | **Apply accommodations** | none required: effects apply automatically ([05](05-ACCOMMODATIONS.md)) | Effects engine | Absent |
| F7 | **Respond to a concern about integrity** | informal conversation → if unresolved, open a referral → system notifies the student and shows what it rests on → route to the configured decision-maker | Referral workflow ([04 §6](04-ACADEMIC-INTEGRITY-CONTROLS.md)) | Absent |
| F8 | **Review course analytics** | view aggregates above the floor: outcome performance, item quality, feedback turnaround, help-route usage | Course dashboard | Absent (register L14: "none of the useful measures exists") |
| F9 | **Handle a grade appeal** | receive request → review → respond with reasons → record | Appeal queue with non-original-grader rule | Partial: sandbox appeal |
| F10 | **Change a policy mid-term** | draft new version → see who is affected → set effective date → students notified | Policy versioning (§3) | Absent |

### 5.1 Service targets

Targets are institution-configurable defaults that the platform displays to
students; the platform does not enforce them against faculty and does not
rank faculty by them.

| Item | Suggested default | Shown to |
| --- | --- | --- |
| Feedback on staged submissions | Stated per assignment (e.g. 7 days) | Student, instructor |
| Appeal acknowledgement | 3 working days | Student |
| Appeal decision | Institution-set | Student |
| Integrity referral acknowledgement | 3 working days | Student |
| Accommodation request acknowledgement | Institution-set | Student |

## 6. Tutor and academic-support workflows

"Tutor" here means a **human** tutor, writing-centre consultant, peer tutor or
academic coach. The AI tutor's handoff routes to them
([03 §9](03-AI-TUTORING-AND-BOUNDARIES.md)).

| # | Workflow | Steps | Boundaries | Today |
| --- | --- | --- | --- | --- |
| T1 | **Book a session** | student chooses a tutor/centre → picks time → optionally shares context | Context sharing is student-chosen, per session, revocable; nothing shared by default | Partial: Get help on the University screen; booking depth not verified |
| T2 | **Student-initiated handoff from the AI tutor** | when the ladder ends, the AI offers to prepare a *summary the student reviews and edits* → student chooses to send it | The summary is the student's, editable, and not sent automatically | Absent |
| T3 | **Session notes** | tutor writes notes; student can read them | Notes are about support, not performance evaluation; not visible to instructors unless the student shares | Absent |
| T4 | **Referral from tutor to another service** | tutor suggests disability services, counselling, advising | A suggestion the student acts on; no automatic referral; no inference of disability | Absent |
| T5 | **Peer-tutor training and limits** | onboarding on integrity, scope and boundaries | Peer tutors do not give answers to assessed work; same policy card | Absent |
| T6 | **Concern about a student's wellbeing** | follow the institutional care protocol | Human decision, student informed where safe to do so; see [`CARE-AND-ESCALATION-BOUNDARIES.md`](../learning-university-systems/CARE-AND-ESCALATION-BOUNDARIES.md) | Partial: spec exists |
| T7 | **Tutor sees an assignment brief** | student shares the brief and policy card | The tutor sees the same policy card the student sees | Absent |

| ID | Requirement | Today |
| --- | --- | --- |
| LI-WRK-01 | A human tutor sees only what the student has chosen to share for a stated purpose, and the student can see what was shared and revoke it. | Absent |
| LI-WRK-02 | Tutor session records are not read by analytics, integrity or alert systems; aggregate counts of sessions only, above the floor. | Absent |
| LI-WRK-03 | The AI handoff summary requires the student's review and send action. | Absent |
| LI-WRK-04 | Every faculty and tutor workflow has an accessible path (keyboard, screen reader) verified in the AT protocol. | Partial: `docs/accessibility/AT-PASS-PROTOCOL.md` |

## 7. Administrator configuration (institution console)

| ID | Requirement | Today |
| --- | --- | --- |
| LI-ADM-01 | The institution console exposes: policy floors/ceilings, preset menu, integrity process roles and timings, retention schedule, integration enablement (match tools, proctoring), analytics floor (never below ten), and transcript-sharing rule (default none). | Absent (console spec: `docs/learning-university-systems/INSTITUTIONAL-ADMIN-CONSOLE-SPEC.md` — a specification) |
| LI-ADM-02 | High-impact configuration changes (enabling proctoring, enabling match tools, changing retention, enabling transcript sharing) require dual control and are logged. | Absent |
| LI-ADM-03 | An institution cannot configure a prohibited item: AI-only grades, automated misconduct findings, per-student risk scores, emotion/face analysis, hidden collection. These are not options in the console. | Held as boundaries: `lib/ops/boundaries.test.ts`, `lib/institution-ops.ts` |
| LI-ADM-04 | The configuration is exportable and a read-only student-facing view of the institution's policy exists. | Absent |
| LI-ADM-05 | Training for faculty, tutors and integrity-office staff exists before a feature is enabled for them (see [`FACULTY-AND-STAFF-ENABLEMENT-PLAN.md`](../learning-university-systems/FACULTY-AND-STAFF-ENABLEMENT-PLAN.md)). | Partial: a plan exists |
