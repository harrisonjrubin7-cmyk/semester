# Cross-platform Features Register

<!-- Rendered from app/src/lib/crossplatformregister.ts by crossplatformregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Decision: D-156 in [`DECISION-LOG.md`](DECISION-LOG.md) (proposed, needs owner).

The fifteen features in a document of 30 September 2026 — “Anything else or any feature, function and/or capability, screen or service that can be further hardened, deepened and strengthened” — and where the repository stands on each. Fifteen cross-platform features and the ten it says to prioritise. The document is not cited as evidence.

A status describes the *best* piece of a feature; the capability marks say how
much is there. A capability the student cannot yet set or see on a screen is
marked absent even where the model for it exists.
Across the register, 38 of 96 capabilities have something in the tree.

| ID | Feature | Priority | Status | Present |
| --- | --- | ---: | --- | ---: |
| [X01](#x01) | My Commitments | 1 | tested | 9 / 14 |
| [X02](#x02) | Academic decision journal | — | not-started | 0 / 6 |
| [X03](#x03) | What Changed | 2 | tested | 4 / 10 |
| [X04](#x04) | Inbox-zero for the university inbox | — | not-started | 0 / 5 |
| [X05](#x05) | Academic template library | — | tested | 3 / 8 |
| [X06](#x06) | Resource guarantee | 4 | tested | 6 / 8 |
| [X07](#x07) | Course workload contract | 5 | not-started | 0 / 6 |
| [X08](#x08) | Workload fairness engine | 5 | not-started | 0 / 5 |
| [X09](#x09) | Semester retrospectives | 9 | tested | 2 / 5 |
| [X10](#x10) | Prepare me | 3 | tested | 4 / 6 |
| [X11](#x11) | Expert-service handoff packs | 6 | tested | 5 / 7 |
| [X12](#x12) | Cross-course skills transfer | — | tested | 2 / 4 |
| [X13](#x13) | Personal academic archive | 10 | tested | 2 / 6 |
| [X14](#x14) | Focus modes | 7 | tested | 1 / 3 |
| [X15](#x15) | Learning continuity across terms | 8 | not-started | 0 / 3 |
| **total** | | | not-started 5, designed 0, building 0, tested 10 | **38 / 96** |

## The register

### X01

**My Commitments.** *Home:* Plan → My Commitments; a card on Today.

*Status.* tested, 9 of 14 capabilities present.

- [x] Classes and meetings on one day
- [x] Deadlines, exams and projects
- [x] Work shifts, athletics, rehearsals and club or research obligations
- [x] Advising and personal appointments
- [x] Registration, aid, housing and graduation steps
- [ ] Caregiving and family blocks as their own kind
- [x] Required versus optional, used to suggest what can give
- [ ] Fixed versus flexible, set by the student on a screen
- [x] Estimated duration
- [ ] Energy level, set by the student on a screen
- [ ] Location and commute, set by the student on a screen
- [ ] Privacy: private or busy-only, set by the student on a screen
- [x] Conflict state derived from stated times
- [x] Recovery options that are moves the data supports

| Evidence | Shows |
| --- | --- |
| `app/src/lib/dayplan.ts` | One plan item shape; overlap, tight-commute and floating states; free windows; recovery; a busy-only shared view |
| `app/src/lib/dayplan.test.ts` | Overlap, commute, windows, recovery and privacy held by tests |
| `app/src/components/DayPlanNote.tsx` | A card on Today, silent unless the day overlaps and in the sample semester |
| `app/src/lib/activities.ts` | The recurring commitments the plan reads |

*Gap.* Flexible, energy, commute and privacy have a model and no way for the student to set them; nothing carries deadlines into the plan; caregiving is not a kind. It shows today only, and only on overlap.

*Overlaps.* lib/clash.ts and lib/activities.ts already detect heavy weeks and class clashes; lib/ops/commitments.ts is the unrelated company register. Open PR #1014 (life events) may define a shared item model.

### X02

**Academic decision journal.** *Home:* My Path → Decision Journal.

*Status.* not-started, 0 of 6 capabilities present.

- [ ] A decision with its goal and the options considered
- [ ] Verified facts kept apart from assumptions and unknowns
- [ ] Advice received, with its source
- [ ] The chosen option and the reason
- [ ] A later outcome or reflection
- [ ] Private to the student, never surfaced to staff

*Gap.* Nothing holds a student-authored academic decision. lib/journal.ts is an activity trail, not decisions; advisor-meeting.ts follow-ups are the nearest thing.

*Overlaps.* lib/advisor-meeting.ts (follow-ups) could link to an entry.

### X03

**What Changed.** *Home:* Today → What Changed; Course Home → Course Changes.

*Status.* tested, 4 of 10 capabilities present.

- [x] New, moved, retimed, reweighted and removed course deadlines
- [x] Previous value, new value, source, effective date, impact and action on every change
- [x] The acknowledged reading is kept and synced
- [x] Silent on a first reading and in the sample semester
- [ ] Registration-window changes
- [ ] Catalog policy and requirement-mapping changes
- [ ] Course meeting-time changes
- [ ] Faculty announcements and updated resources
- [ ] AI-policy and credential-status changes
- [ ] My Path → Plan Changes

| Evidence | Shows |
| --- | --- |
| `app/src/lib/whatchanged.ts` | The comparison and the acknowledged-reading helpers |
| `app/src/lib/whatchanged.test.ts` | Each kind of change, ordering, first-reading silence and malformed saved data |
| `app/src/components/WhatChanged.test.tsx` | The card on screen, the seeding effect and "Got it" |
| `app/src/state/slices/seen.test.ts` | Seeding versus acknowledging in the reducer |
| `app/src/components/WhatChanged.tsx` | The card on Today and on a course page |

*Gap.* Deadlines only. The other change sources in the document have no baseline to compare against yet.

*Overlaps.* screens/Changes.tsx ingests outside emails and calendars; this reports what differs between two readings of a course.

### X04

**Inbox-zero for the university inbox.** *Home:* Today → University Inbox.

*Status.* not-started, 0 of 5 capabilities present.

- [ ] Suggest an action, deadline or reminder from a message, never creating one unreviewed
- [ ] Link a message to a course
- [ ] Mute a source
- [ ] Report a message as incorrect
- [ ] Archive and save

*Gap.* Mail is read-only and has folders, archive and rules (lib/mailbox.ts, lib/mailrules.ts); nothing turns a message into a suggestion.

*Overlaps.* Open PRs #725 (automation centre) and #1018 (Workflow Builder): keep this suggest-only.

### X05

**Academic template library.** *Home:* Workspace → Templates.

*Status.* tested, 3 of 8 capabilities present.

- [x] Writing skeletons
- [x] Assignment workflow stages
- [x] Advisor agenda
- [ ] Study plan, exam preparation, lab notebook and project plan
- [ ] Literature review, research matrix and group contract
- [ ] Scholarship, internship and graduate-school trackers
- [ ] Editable, versioned copies
- [ ] Export as one library

| Evidence | Shows |
| --- | --- |
| `app/src/lib/doctemplates.test.ts` | Writing skeletons |
| `app/src/lib/toolkit/templates.test.ts` | Assignment workflow stages |

*Gap.* Two template sets exist and neither is a library: no catalogue, no versioned student copies, no export.

*Overlaps.* Open PR #1010 (course agreement) may add a group contract.

### X06

**Resource guarantee.** *Home:* Search → Resource Guarantee; Support Navigator → Alternative Help.

*Status.* tested, 6 of 8 capabilities present.

- [x] Owner, last-reviewed date, contact route, accessibility information and official link on every listing
- [x] A report-an-issue count
- [x] Stale listings are flagged and still shown
- [x] Availability stated by the owner, lapsing when a closure ends
- [x] An owner-chosen fallback, then the next approved listing, when a route is closed
- [x] A dead end is named for the office that owns the category
- [ ] A screen that shows it to a student
- [ ] Every public office, policy and event entry held to the guarantee

| Evidence | Shows |
| --- | --- |
| `app/src/community/services.ts` | The listing rules, availability, fallback and the guarantee |
| `app/src/community/services.test.ts` | Closed and waitlisted listings, fallback order, lapsed closures and fallback faults |

*Gap.* Nothing in the app reads the directory yet, so a student cannot see the guarantee. Offices, policies and events are not held to it.

*Overlaps.* lib/support.ts and lib/help-routes.ts are static maps of who to talk to.

### X07

**Course workload contract.** *Home:* Course Detail → Workload & Expectations.

*Status.* not-started, 0 of 6 capabilities present.

- [ ] Credit, meeting time and modality with their sources
- [ ] An estimated weekly work range from published expectations
- [ ] Assessment types, major deadlines and required materials
- [ ] Attendance, technology, accessibility and AI policy
- [ ] Prerequisites and corequisites
- [ ] No difficulty score

*Gap.* screens/settings/Workload.tsx is the student’s own capacity, not a course contract. The course record has no field for it.

*Overlaps.* Open PR #1010 (course agreement, start-here check) probably covers part of it; fold into it once it lands.

### X08

**Workload fairness engine.** *Home:* Institution → Curriculum & Workload; Faculty → Course Calendar.

*Status.* not-started, 0 of 5 capabilities present.

- [ ] Clustered major assessments in one week across a cohort
- [ ] Missing due dates
- [ ] Release too close to the deadline
- [ ] Conflicts with campus closures
- [ ] Aggregate only, with small cells suppressed

*Gap.* lib/clash.ts and lib/ahead.ts are per-student. Nothing looks across a cohort, and it must never read an individual.

*Overlaps.* None found.

### X09

**Semester retrospectives.** *Home:* Me → Semester Reflection; Faculty → Course Reflection; Institution → Term Review.

*Status.* tested, 2 of 5 capabilities present.

- [x] A private recap of the student’s own chosen outcomes
- [x] A term-transition checklist
- [ ] Student reflection prompts and kept answers
- [ ] Faculty course reflection
- [ ] Institution term review

| Evidence | Shows |
| --- | --- |
| `app/src/lib/wrapped.test.ts` | The private recap |
| `app/src/lib/termtransition.test.ts` | The term-end checklist |

*Gap.* No place to write what worked or what to change; faculty and institution versions do not exist.

*Overlaps.* Open PR #1014 (moment feedback) may overlap.

### X10

**Prepare me.** *Home:* A button on an event or deadline.

*Status.* tested, 4 of 6 capabilities present.

- [x] Gather the student’s own notes, marked confusions, attempts and questions for eleven kinds of event
- [x] Report what is missing instead of filling it in
- [x] Quote the course AI policy with its source, and show none when none is stated
- [x] Offer values to a matching handoff pack, each still needing a tick
- [ ] A button on an event or deadline
- [ ] Pull from the student’s notes and study guide automatically

| Evidence | Shows |
| --- | --- |
| `app/src/lib/prepare.ts` | The gatherer and the handoff mapping |
| `app/src/lib/prepare.test.ts` | Missing slots, policy quoting, private confusion marks and pack hand-off |

*Gap.* A function with no screen: nothing calls it yet, and nothing fills its context from the student’s notes.

*Overlaps.* lib/advisor-meeting.ts holds the advising version.

### X11

**Expert-service handoff packs.** *Home:* Support Navigator → Handoff Pack.

*Status.* tested, 5 of 7 capabilities present.

- [x] A fixed list of fields for each of nine destinations
- [x] Only ticked fields that have something in them
- [x] A field a destination may not receive cannot be added
- [x] The review says what stays private
- [x] A frozen snapshot with the time it was made
- [ ] A screen to build and review a pack
- [ ] Sending, with the student’s confirmation

| Evidence | Shows |
| --- | --- |
| `app/src/lib/expertpack.ts` | The per-destination allowlists and the pack |
| `app/src/lib/expertpack.test.ts` | Allowlist, snapshot, preview and what is left out |
| `app/src/lib/advisor-meeting.ts` | The share-payload pattern this generalises |

*Gap.* A function with no screen and no way to send. It must not become a second sharing system beside advisor-meeting.ts.

*Overlaps.* lib/handoff.ts (classmate pack), lib/aihandoff.ts and lib/tickethandoff.ts are different destinations.

### X12

**Cross-course skills transfer.** *Home:* Me → Skills Across Courses; Career → Evidence Builder.

*Status.* tested, 2 of 4 capabilities present.

- [x] Skill claims that are student-confirmed or institution-verified
- [x] Only confirmed skills travel
- [ ] A view of where a skill was used across courses
- [ ] A suggested next place to apply it, confirmed by the student

| Evidence | Shows |
| --- | --- |
| `app/src/lib/skills-graph.test.ts` | Claims and their verification |
| `app/src/lib/career-evidence.test.ts` | Suggested, confirmed and rejected skills |

*Gap.* No course-to-course view, and no suggestion the student can confirm.

*Overlaps.* Open PRs #988 (transfer credit) and #1010 (learning map) are adjacent.

### X13

**Personal academic archive.** *Home:* Me → Academic Archive.

*Status.* tested, 2 of 6 capabilities present.

- [x] A whole-account export that can be read back
- [x] A term-transition checklist of what to keep
- [ ] A curated per-term archive the student selects
- [ ] A manifest of what an archive holds
- [ ] Only materials the student is permitted to retain
- [ ] Learner-record and credential export together

| Evidence | Shows |
| --- | --- |
| `app/src/lib/export.test.ts` | The account export |
| `app/src/lib/termtransition.test.ts` | What to keep at the end of a term |

*Gap.* There is an export of everything, and no archive the student chooses.

*Overlaps.* docs/DATA-PORTABILITY-AND-OFFBOARDING.md covers leaving; this is keeping.

### X14

**Focus modes.** *Home:* A mode switch across the app.

*Status.* tested, 1 of 3 capabilities present.

- [x] A focused layout and break reminders
- [ ] Named modes: today, study, registration, assignment, advising, career, finals, recovery
- [ ] A mode changes emphasis, not navigation or data

| Evidence | Shows |
| --- | --- |
| `app/src/lib/breaks.test.ts` | Break reminders in the focused layout, the nearest existing piece |

*Gap.* Not started here: open PR #725 already carries Focus Mode and would duplicate.

*Overlaps.* Open PR #725 (AI routing, Focus Mode, automation centre).

### X15

**Learning continuity across terms.** *Home:* Course Home → refresh plan.

*Status.* not-started, 0 of 3 capabilities present.

- [ ] Prior-course concepts linked to the next course’s prerequisites
- [ ] A refresh plan from earlier notes and worked examples
- [ ] Targeted review of what was weak

*Gap.* Terms are isolated: notes and study progress do not carry forward.

*Overlaps.* Open PR #1010 (learning map) and #988 (transfer credit).
