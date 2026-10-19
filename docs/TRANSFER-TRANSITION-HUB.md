# Transfer Transition Hub

<!-- Rendered from app/src/lib/transferhub.ts by transferhub.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Transfer success research points to cross-campus collaboration, streamlined
procedures, dependable communication, peer support and a central one-stop
model. Semester’s origin story is the fragmentation transfer students face, so
this is its natural wedge. The hub supports a student from the moment they
consider transferring through their first successful term and onward to
completion planning — and makes **no official transfer-credit or degree-
completion decision**. It organizes evidence, identifies questions, surfaces
authoritative information and prepares the student for the official evaluation.

**Product promise.** “I can see what I need to do, what is official, what is still uncertain, who owns each answer, and what my next best action is.”

| Supplied document | What it holds |
| --- | --- |
| [Show me the transfer transition hub details](expansion/Transfer-Hub-Career-Safe-AI-and-Basic-Needs.pdf) | The promise, the home structure, the workflows and boundaries, the credit-preparation workspace, the labels, the timeline and the council. |

## The home

1. My transition timeline
2. Credits and academic planning
3. Requirements and official-review checklist
4. Orientation and campus setup
5. Financial-aid and billing handoffs
6. Advisor meeting preparation
7. Community and transfer-peer connection
8. Course readiness and study support
9. Career and portfolio continuity
10. Transfer-specific help center
11. My documents, shares and data controls

## Core workflows

Each workflow, its flow, its critical boundary, and where the tree stands.
Statuses were read at `origin/main` `92952f0` on 28 September 2026, under the
expansion register’s rule: `designed` cites a document, `building` code,
`tested` a test. Today the transfer pieces are checklist steps spread across the
launchpad, the pathways and the advisor agenda; the `transfer_evaluations` and
`articulation_rules` tables exist and no screen uses them.

| not-started | designed | building | tested |
| ---: | ---: | ---: | ---: |
| 0 | 0 | 2 | 6 |

| ID | Workflow | Student flow | Critical boundary | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| TH-01 | Transfer readiness | Select a prospective institution or program → see official transfer resources, dates, prerequisites and questions to ask | No admissions prediction or unofficial credit guarantee | building | `app/src/lib/learner-pathways.ts` — the transfer pathway: which courses count, what the official evaluation says, and who to ask<br>`app/src/lib/learner-pathways.test.ts` — where a decision is somebody else’s, the pathway says so | One pathway for the student’s own school; no prospective-institution view and no official resources per program. |
| TH-02 | Credit-preparation workspace | Upload or list prior courses and documents → map against published pathways → flag uncertainty → prepare the official evaluation packet | Clearly label student-entered and estimated matches | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — transfer_evaluations: a student writes only estimated or submitted; the decision arrives through the service role; articulation_rules draft, proposed, approved<br>`supabase/expansion.check.sql` — the articulation and evaluation policies, in SQL | The tables exist; no screen lists prior courses, maps them against a published pathway or assembles a packet. |
| TH-03 | Academic plan | Compare possible term plans, required courses, workload and dependencies | Not an official degree audit or registration action | tested | `app/src/lib/degree.test.ts` — student-entered requirement rows and whether a course fits them; nothing built in<br>`app/src/lib/scenario-compare.test.ts` — plans compared side by side | No comparison of the old school’s requirements against the new one’s. |
| TH-04 | Advisor agenda | Compile unresolved credit questions, course options, supporting documents and the desired outcome | The student controls what is shared and for how long | tested | `app/src/lib/advisor-meeting.test.ts` — the agenda carries only what the student ticked; never a field for notes, history or grades<br>`app/src/lib/advisor-shares.test.ts` — every share expires within 120 days; a revoke cannot be undone<br>`supabase/advisor.check.sql` — held in SQL | A general advising agenda; no transfer-credit question type and no document attachment beyond one scenario and saved courses. |
| TH-05 | Campus setup | Complete orientation, SSO, transit, library, accessibility, clubs, support offices and key dates | Links route to official systems | tested | `app/src/lib/launchpad.ts` — the transfer type adds a credit-evaluation step and transfer orientation; every official step names its office<br>`app/src/lib/journey.guards.test.ts` — a student type only ever adds steps; every step an office decides names the office | Two transfer-only steps; SSO, library and accessibility setup are the general list. |
| TH-06 | Community connection | Join transfer circles, opt into a peer mentor program, find transfer-friendly clubs and events | No default public transfer status | tested | `app/src/lib/mentors.test.ts` — mentors matched on listed topics and ticked interests, nothing else<br>`app/src/lib/launchpad.ts` — “Transferring in” as a mentor topic<br>`supabase/mentor-rosters.check.sql` — requests need consent from both sides | No transfer circle or transfer-friendly club filter; being a transfer student is a mentor topic, not a community. |
| TH-07 | First-term support | Course readiness, action planning, tutoring, writing and library referrals, and week-one check-ins | No hidden “transfer risk” score | tested | `app/src/lib/study-readiness.test.ts` — readiness is the student’s own status and confidence; never a prediction<br>`app/src/lib/help-routes.test.ts` — tutoring, writing center and library requests sent only on confirm<br>`app/src/lib/institution-ops.test.ts` — any per-student risk metric is refused | No week-one check-in and nothing transfer-specific in the first term. |
| TH-08 | Continuity archive | Preserve selected projects, skills evidence, portfolio links and past plan documents | The student decides what carries forward | tested | `app/src/lib/termtransition.test.ts` — end-of-term checklist: keep, export, plan the next term<br>`app/src/lib/career-evidence.test.ts` — portfolio items only from what the student confirmed | No archive of a previous school’s work or plans; the export is per device, not a carried-forward record. |

## Transfer credit preparation

An evidence and questions workspace, not an automated credit-decision engine.
The migration already refuses a student any status but `estimated` or `submitted` on a transfer evaluation; the institution’s decision arrives through the service role, and the test reads that constraint.

| Student-provided | Institution-provided | Semester output |
| --- | --- | --- |
| Unofficial transcript | Published transfer pathways | Organized comparison table |
| Course titles and descriptions | Course equivalencies | Source anchors |
| Syllabi | Major requirements | “Likely comparable”, “insufficient information” or “needs official review” |
| Catalog links | Catalog year | Missing-document checklist |
| Prior assignments or work samples where relevant | Official deadlines and policy links | Advisor or evaluator agenda |
| Articulation agreement links | Official evaluator or registrar route | Versioned plan scenarios |
| Student notes and questions |  |  |

### Labels

Use explicit labels. Each names the source label in `lib/source.ts` — the five
the database enforces — that already carries it, or says none does.

| Label | Carried by | Note |
| --- | --- | --- |
| Institution verified | `institution_verified` | The same word the database enforces. |
| Published policy | **none** | A policy is not a fact about the student; the closest is an official notice with its source. |
| Student provided | `student_entered` | Same meaning, older wording. |
| Semester estimate | `estimated` | Worked out by Semester; never official. |
| Needs official review | `needs_review` | Also the only status a transfer evaluation has before submission. |
| Expired or possibly stale | **none** | Freshness is a date beside the label (official notices), not a label of its own. |

## Transfer onboarding timeline

| Window | What happens |
| --- | --- |
| 90+ days before term | Confirm admission and official requirements, request evaluation, compare pathways, plan finances, prepare accessibility and housing or service handoffs. |
| 30–60 days | Review evaluation status, draft a term plan, connect SSO and campus systems, complete orientation steps, identify the advisor and support offices. |
| First 14 days | Confirm enrolled courses, attend transfer orientation and peer connection, review the syllabus and academic policies, establish study and support routines. |
| Weeks 3–8 | Check unresolved credit questions, prepare the advising agenda, use tutoring and the library, join one relevant academic or community connection. |
| Term end | Archive selected work, update portfolio evidence, review the plan, prepare next-term questions, update the transfer transition reflection. |

## Who owns it

A formal transfer hub is owned by a cross-functional council: admissions and records, articulation or transfer-credit evaluators, advising, financial aid, student affairs, it, accessibility and disability services, library, career services, transfer-student representatives. Cross-campus collaboration and streamlined, coordinated procedures are what transfer-support guidance emphasizes.

## The MVP

1. Verified timeline
2. Official-resource directory
3. Questions and document checklist
4. Advisor agenda
5. First-term dashboard
6. Transfer peer and community discovery

Who may see what a transfer student holds is [`MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md);
the hub’s place among the twenty-six services is
[`SERVICE-EXPANSION-REGISTER.md`](SERVICE-EXPANSION-REGISTER.md#s02); the
`transfer_student` role is `modeled` in [`ROLE-LAUNCH-REGISTER.md`](ROLE-LAUNCH-REGISTER.md).
