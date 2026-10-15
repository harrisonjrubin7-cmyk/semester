# Launch content and training

Launch-readiness Phase 6. This page covers what a school must have in place before students arrive, and the guides, templates and checklists that go with a launch. It is an index. The rules live in code, and tests keep this page and the code in step:

| Register | Code | Test |
| --- | --- | --- |
| Content readiness | `app/src/lib/launch/content.ts` (`CONTENT_READINESS`) | `content.test.ts` |
| Launch package | `app/src/lib/launch/content.ts` (`LAUNCH_PACKAGE`) | `content.test.ts` |
| First-day checklists | `app/src/lib/launch/checklists.ts` | `checklists.test.ts` |
| 90-day program | `app/src/lib/launch/ninety-day.ts` | `ninety-day.test.ts` |

Nothing here changes what students see in the app. There is no migration, no flag and no new screen.

## 1. Content readiness

Every item has a source, an owner, a review period, a visibility, an expiry and a correction route. Each school's answers go in [`docs/launch/CONTENT-READINESS-REGISTER.md`](launch/CONTENT-READINESS-REGISTER.md).

The owner is a **stewardship role** from `lib/governance/data-contracts.ts`. The school fills in the named person. An office or an inbox is refused, by the same rule `governance_steward_assignments` enforces in SQL.

| Item | Owner role | Review every | Visible to | Expires | Correction | Estimate allowed |
| --- | --- | --- | --- | --- | --- | --- |
| institution_profile | data_owner | 365 days | The school’s accounts | When the school changes a domain or term system | The owning office, at its source | No |
| academic_calendar | data_steward | 90 days | The school’s accounts | At the end of the term it describes | The owning office, at its source; Say something in the app | No |
| programs_degrees | data_steward | 180 days | The school’s accounts | When the catalogue year it was taken from ends | The owning office, at its source; Say something in the app | Yes, labelled |
| course_catalog | data_steward | 120 days | Anyone | When the registrar publishes the next term | The owning office, at its source; Say something in the app | No |
| campus_services | content_owner | 90 days | The school’s accounts | When an office changes hours, location or contact | The owning office, at its source; Say something in the app | No |
| learning_resources | content_owner | 90 days | The school’s accounts | At the end of each term, when hours change | The owning office, at its source; Say something in the app | No |
| career_resources | content_owner | 180 days | The school’s accounts | When the career office changes a service | The owning office, at its source; Say something in the app | No |
| organizations_events | content_owner | 30 days | The school’s accounts | Each event at its end; each organization at its next registration cycle | The owning office, at its source; Say something in the app | No |
| emergency_safety | security_owner | 30 days | Anyone | Never on its own — reviewed monthly because a wrong number is dangerous | The owning office, at its source | No |
| privacy_support_contacts | privacy_owner | 180 days | Anyone | When the named contact changes | The owning office, at its source | No |
| ai_policy | privacy_owner | 180 days | Anyone | When the school revises its policy | The owning office, at its source | No |
| accessibility_statement | content_owner | 365 days | Anyone | When the statement or the accommodation route changes | The owning office, at its source; Say something in the app | No |
| ownership_schedule | data_owner | 90 days | Staff only | When any owner above changes | The owning office, at its source | No |

Only degree and program content may go out as an estimate, and only with a label saying so. Emergency links, policies and contacts never may: a wrong phone number is not a planning aid.

## 2. The launch package

`READY` means the file exists and passes the checks in `content.test.ts`:

- **Accessibility.** One title, no skipped heading levels, descriptive link text, and alt text on every image.
- **Claims.** No compliance or certification claim the evidence does not support.

Anything unwritten says `NOT_STARTED` rather than pointing at a stub.

| Item | Status | Audience | File | Note |
| --- | --- | --- | --- | --- |
| Student quick-start guide | READY | student | `docs/launch/STUDENT-QUICK-START.md` |  |
| 60-second “What is Semester?” | IN_PROGRESS | student, public | `docs/launch/WHAT-IS-SEMESTER.md` | The script is written; a video needs captions and a transcript before it counts |
| Role-specific first-day checklists | READY | student, faculty, advisor, admin | `docs/launch/FIRST-DAY-CHECKLISTS.md` |  |
| Course and faculty quick-start guide | READY | faculty | `docs/launch/FACULTY-QUICK-START.md` |  |
| Advisor quick-start guide | READY | advisor | `docs/launch/ADVISOR-QUICK-START.md` |  |
| Admin onboarding guide | READY | admin | `docs/launch/ADMIN-OPERATIONS-GUIDE.md` | Day-to-day pilot operation; activation remains in the production runbook |
| Accessibility guide | NOT_STARTED | student, staff | — | Needs the accessibility conformance evidence first, so it describes what was tested rather than what was intended |
| Privacy and AI-use guide | IN_PROGRESS | student | `app/src/lib/privacy.ts` | The Privacy screen states each claim and a test holds it; a guide for the school’s own AI policy waits on that policy |
| Source and freshness guide | NOT_STARTED | student, staff | — |  |
| Support center | IN_PROGRESS | student | `app/src/screens/Help.tsx` | How this works is generated from the app; tickets to Semester support are #839, behind a flag |
| Campus announcement templates | READY | admin | `docs/launch/ANNOUNCEMENT-TEMPLATES.md` |  |
| Orientation slide | NOT_STARTED | student | — |  |
| Student ambassador kit | NOT_STARTED | student | — | Waits on the pilot recruiting ambassadors; an ambassador speaks for themselves and is never paid per sign-up |
| FAQ library | READY | student, staff | `docs/launch/FAQ.md` |  |
| Integration status page | NOT_STARTED | staff | — | The Integration Dashboard exists for staff behind its flag; a page for students is not written |
| Known limitations page | READY | student, staff | `docs/launch/KNOWN-LIMITATIONS.md` |  |
| Office-hours and live onboarding calendar | NOT_STARTED | student, staff | — | Needs named people and times from the pilot |

## 3. Training

**First-day checklists, one per role.** [`docs/launch/FIRST-DAY-CHECKLISTS.md`](launch/FIRST-DAY-CHECKLISTS.md) has one list each for students, faculty, advisors and administrators. Every step names the screen it happens on, typed as a `Screen`, so a list pointing at a screen the app no longer has fails the type check.

**Role guides.** Faculty, advisors and administrators each have a ready quick-start or operations guide. The [pilot measures and baseline worksheet](launch/PILOT-MEASURES-BASELINE-WORKSHEET.md) gives the sponsor a fixed place to agree scope, sources, thresholds and the expand/extend/stop decision before measurement begins.

**Live sessions.** These are a task in the 90-day program (`training`), closed by evidence rather than a status: each role has had its checklist and a live session.

**What is not here.** Training records per person are not kept. Semester does not need to know which staff member finished which module, and a completion table is a surveillance table with a friendlier name. If a school needs completion records for its own compliance, they belong in its own learning system.

## 4. Communications

[`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) holds texts a school sends in its own name.

- Every student-facing template says that taking part is optional and has no effect on grades or standing.
- Semester sends no campus announcements.
- Outbound marketing messages, with their consent and frequency rules, are #817's work, not this PR's.

## 5. What this phase does not claim

- No guide is marked ready that has not been written and checked.
- No content item is marked ready for any school.
- No accessibility conformance, and no compliance certification, is claimed anywhere in the launch package.
