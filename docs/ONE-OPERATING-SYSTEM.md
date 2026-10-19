# One operating system

<!-- Rendered from app/src/lib/oneos.ts by oneos.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

What the two briefs of 29 September 2026 say makes Semester different —
everything from the start, one central school operating system, every
capability feeling like one system rather than a collection of screens —
held to what the tree already has for each: the positioning, the five
principles, the shared objects, the Action Center, search, the intelligence
layer, the shell, the context bar, the detail panel, five journeys, the event
layer, the design system, the vocabulary, the role homes, the command
palette, the graph, the timeline, the workspace, the institution console and
the final test; then what else to add to the app, the site and the console,
the company behind them, and the ten that matter most. The earlier
[one-system grammar](ONE-SYSTEM-PLATFORM-GRAMMAR.md) holds the object
envelope, the trust pattern, the action model and the release gates; this
page does not repeat them.

**The briefs’ claim is that Semester has everything from the start and is fully built. The tree does not say that, and this page does not say it for the tree.** Most of what the briefs name exists as a part — a component, a module, a table — and the join is what is missing. Of 157 rows, 98 are held by a test, 47 are being built, 9 are designed and 3 are not started. The two public pages print the positioning as the briefs wrote it and, under it, this register’s word for every area, so the site cannot say “fully built” where the tree says “building”.

| Supplied document | What it holds |
| --- | --- |
| [The core of what makes Semester different (… what else can be done to make it feel like one system)](expansion/One-Operating-System-Core-and-One-System-Principles.pdf) | The positioning; one identity, one object model, one Action Center, one search, one intelligence layer; the shell, the context bar, the detail panel, five journeys, the event layer, the design system, the vocabulary; the role homes, the command palette, the graph, the timeline, the passport, the workspace, the institution console; the headline and messages; the final test. |
| [Anything else to add or improve upon on app, company site and/or console](expansion/Anything-Else-for-App-Company-Site-and-Console.pdf) | Eight app additions, seven company-site pages, seven console features, the company infrastructure (commercial, support, security, credibility), the ten highest-impact additions and the final standard. |

A status is a claim about the best piece of a row: `tested` cites a test that
runs on every change, `building` code, `designed` a document, `not-started` at
most a document naming the gap. The supplied PDFs are never evidence.

## The positioning

**One Operating System for University Life.**

Semester is the unified operating system for higher education. One connected platform for every part of university life: academics, learning, planning, campus services, career development, student support, communication, and institutional operations. Semester replaces the disconnected university experience with one intelligent, connected system.

*Supporting paragraph.* Semester is not another point solution. It is designed as one connected university platform — academic planning, native learning tools, course workspaces, AI, advising, campus services, career development, communications, payments and institutional operations in one secure ecosystem — where every experience is connected through one identity, one action layer, one data model and one shared understanding of the student journey.

*Student-facing.* College is complicated. Your experience should not be. Semester brings your classes, plans, deadlines, study tools, support, campus life and future goals into one place — so you always know where you are, what matters, and what to do next.

*Institution-facing.* Replace fragmented student experiences with one connected university system. Semester gives institutions a unified platform for student experience, learning, planning, support, campus engagement and operations — without losing governance, privacy, accessibility or control.

Most edtech products solve one isolated problem:

- An LMS delivers courses.
- An SIS manages records and registration.
- A calendar manages time.
- An advising system manages appointments and notes.
- A tutoring tool supports learning.
- A career platform manages jobs and resumes.
- A housing or dining system manages transactions.
- A student-success platform sends alerts.
- An AI study tool generates explanations and quizzes.

Semester is designed as the system that connects those moments. Whether it does, area by area, is the rest of this page.

## The five destinations

Held to `FIVE_LABELS` in `lib/tabbar.ts`, behind `journeyNavigation` (D-003), off in a normal build. Everything else opens within these as a contextual mode, not as a twenty-first tab.

| Destination | Screen | Holds |
| --- | --- | --- |
| Today | `home` | The briefing, the Action Center behind its flag, Notices under it. |
| My Path | `degree` | The degree, registration, term deadlines, the pathway and applications file under it. |
| Search | `search` | The overlay, Ask Semester, help and the directory. |
| Plan | `calendar` | The calendar, the runway, money, meals, housing, the map and activities. |
| Me | `me` | The directory of everything else, and the controls. |

## The five one-system principles

| ID | Principle | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| identity | One identity: one account carries profile, program, classes, files, calendar, skills, privacy choices, permissions and sharing across the whole ecosystem | tested | `packages/institution/src/identity.ts`: the claims and their minimization<br>`packages/institution/src/identity.test.ts`: held<br>`app/src/lib/role.ts`: ten roles on one account, each with what it needs before it is ready<br>`app/src/lib/role.test.ts`: the roles | Students, yes; institutional roles arrive by SAML or LTI, with no OIDC and no account linking, so a launch from a learning system is its own identity until a ticket links it. |
| objects | One universal object model: every module uses the same core objects | building | `app/src/components/unity/ObjectCard.tsx`: the Universal Object Card: nine kinds, one rhythm<br>`app/src/lib/integration/catalog.ts`: thirty-three canonical entities, for integration<br>`docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md`: the envelope no table carries whole | The briefs’ eleven objects are held below, one by one; no single entity type carries them, and a goal has no object at all. |
| action-center | One Action Center: every module proposes; the student sees one prioritized, explainable list | tested | `app/src/components/ActionCenter.tsx`: one most important, up to three next, the rest behind View all<br>`app/src/lib/actions.ts`: eight states, a transition table, a scored ranking with its parts visible<br>`app/src/components/ActionCenter.test.tsx`: the list, the source, the explanation, done, snooze, correction, help<br>`app/src/lib/office-actions.ts`: a campus office proposes into the same list | Production default with an explicit rollback flag. Deadlines, the path, registration and office actions propose; finances, career, housing and support do not. |
| search | One global search over the student’s whole university world, answering with context and an action | tested | `app/src/lib/find.ts`: findEverything: one ranker over deadlines, courses, units, notes, actions, appointments, documents and screens<br>`app/src/lib/find.test.ts`: the ranking<br>`app/src/components/Command.tsx`: the overlay: “Ask Semester, search, or add something…”<br>`app/src/ai/Panel.tsx`: Ask Semester: an answer with proposed actions the student presses | Device data only: people, offices, services, campus resources and messages are not indexed. A result is a place to open; the answer-with-action is the assistant’s, one press further. |
| intelligence | One intelligence layer built into every workflow, not a separate AI app | tested | `app/src/lib/context.ts`: what leaves the device when a question is asked, and nothing else<br>`app/src/lib/context.test.ts`: no key, no token, no note body, nobody else’s name; the date and the course list<br>`app/src/ai/quality.ts`: source strength from material actually read, the policy state, the limits, under every reply<br>`app/src/ai/quality.test.ts`: the line<br>`app/src/lib/courserules.ts`: a course’s own rules, shown before the assistant answers | One panel that knows the screen it was opened from. The course workspace, the Studio and the registrar hand it their objects; the degree plan, the schedule, advising, money and Campus Hub do not. |
| **total** | | not-started 0, designed 0, building 1, tested 4 | | |

## The shared objects

Every part of Semester should use the same core objects. Each at the module that carries it, or none. A student adds BIO 201 to their term plan. Semester understands that BIO 201 has a meeting schedule, assignments, study materials, an instructor, tutoring options, degree-requirement impact, lab deadlines, career-relevant skills and an advisor conversation context.

| Object | Used across | Carried by | Note |
| --- | --- | --- | --- |
| Person | Student, faculty, advisor, tutor, parent/supporter, staff, employer, alumni | `app/src/lib/role.ts` | Ten roles on one account; a supporter is the Family plan; tutor and employer are not roles. |
| Course | Planning, schedule, LMS, study tools, assignments, grades, skills, career evidence | `app/src/lib/types.ts` | One Course type, from the syllabus in; the hub, the calendar, the Studio and career evidence read it. |
| Term | Registration, deadlines, finances, plan, calendar, housing, study load | `app/src/components/TermSwitch.tsx` | A term is a string on the state and a switcher; not an object with dates of its own. |
| Action | Things to do, holds, assignments, applications, support follow-ups, registration steps | `app/src/lib/actions.ts` | Derived, never stored; only the student’s choice about one is kept. |
| Goal | Degree progress, academic goals, career targets, financial goals, study goals | — | No goal object. The path snapshot and the career directions are the nearest things. |
| Plan | Degree plan, term plan, weekly plan, study plan, career plan, financial plan | `app/src/lib/registration.ts` | A term plan with backups; the graduation scenarios are a second plan shape; the week is a third. |
| Event | Class, deadline, appointment, campus event, interview, exam, study session | `app/src/lib/kinds.ts` | The event kinds the calendar draws. |
| Resource | Tutor, advisor, office, service, document, policy, scholarship, campus opportunity | `app/src/lib/help-routes.ts` | Routes to people and offices; a document is a source, not a resource; no scholarship. |
| Skill / evidence | Coursework, projects, credentials, portfolio artifacts, verified experiences | `app/src/lib/skills-graph.ts` | Suggested, student-confirmed or institution-verified, each with its evidence. |
| Conversation / meeting | Advising agenda, office hours, tutoring, support case, career meeting | `app/src/lib/threads.ts` | Assistant conversations; a meeting is a calendar event and a share, not an object. |
| Source | Institution-verified, imported, student-entered, estimated, or needs review | `app/src/lib/source.ts` | The five labels, enforced by the database. |

## One Action Center

The heartbeat: every module may create an action; the student sees one prioritized, explainable list.

| ID | Shows | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ac-most | One Most Important action | tested | `app/src/components/ActionCenter.test.tsx`: one most important, three next, and the rest behind View all | None. |
| ac-next | Three to five Next Actions | tested | `app/src/lib/actions.ts`: the ranking<br>`app/src/components/ActionCenter.test.tsx`: three next | Three, not five. |
| ac-timeline | A unified timeline of deadlines, appointments, applications, study work, financial dates and campus opportunities | building | `app/src/components/TodayDecisionSurface.tsx`: a seven-day timeline of deadlines and appointments | Deadlines and appointments; not applications, financial dates or campus opportunities. |
| ac-why | Why each action matters | tested | `app/src/components/ExplanationSheet.tsx`: “Why this?” with the working<br>`app/src/components/ActionCenter.test.tsx`: opens the whole explanation with its working in a sheet | None. |
| ac-source | Where the information came from, and whether it is official, imported, student-entered, estimated or needs review | tested | `app/src/lib/source.ts`: the five labels<br>`app/src/lib/source.test.ts`: held to the check constraint<br>`app/src/components/ActionCenter.test.tsx`: shows the source | None. |
| ac-consequence | What happens if the student acts or delays | building | `app/src/lib/actions.ts`: priority from the deadline and the kind; the parts of the score are shown | No sentence says what delay costs; the score says how urgent. |
| ac-safe | A safe next action: open, plan, schedule, ask for help, prepare, share, save, or an official handoff | tested | `app/src/components/ActionCenter.tsx`: start, snooze, dismiss, correct, ask for help<br>`app/src/components/ActionCenter.test.tsx`: with offline mode on, does not open an official site offline | Open, snooze, help and the handoff; not plan, schedule, prepare, share or save. |
| ac-envelope | Every action carries source, deadline, reason, privacy state, priority, lifecycle and its safe primary action | tested | `app/src/lib/actions.test.ts`: every action with a why and a source; the lifecycle table | No privacy state on an action. |
| **total** | | not-started 0, designed 0, building 2, tested 6 | | |

## One global search

A student should be able to type:

- “What do I need to do before registration?”
- “Find tutoring for chemistry.”
- “Can I take this course next semester?”
- “Where is my professor’s office hour?”
- “Show scholarships due this month.”
- “What assignments do I have this week?”
- “What should I study for my exam?”
- “Find internships connected to data analytics.”
- “What does this hold mean?”
- “Who do I contact about my financial-aid checklist?”

The result is an answer with its source, its context and an action, not a link. What it unifies, at what the tree has:

| ID | Unifies | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| search-courses | Courses and requirements | tested | `app/src/lib/find.test.ts`: courses found by code and name | Requirements are not indexed. |
| search-plans | Student plans and calendars | tested | `app/src/lib/find.test.ts`: deadlines and appointments | The registration plan and the scenarios are not indexed. |
| search-documents | Documents and study materials | tested | `app/src/lib/find.ts`: notes, documents, sheets, decks and study units<br>`app/src/lib/find.test.ts`: found by keyword | None. |
| search-campus | Campus departments, offices, policies, services and events | building | `app/src/lib/help-routes.ts`: the routes to offices<br>`app/src/screens/Directory.tsx`: the directory | A screen of their own, not in the ranker. |
| search-people | Advisors, faculty, tutors and mentors | building | `app/src/screens/People.tsx`: people and letters | Not indexed. |
| search-opportunities | Opportunities, scholarships, internships, jobs and programs | building | `app/src/lib/skills-graph.ts`: searchOpportunities, on the career screen | A second search; no scholarships. |
| search-personal | Personal content: notes, saved plans, drafts and actions | tested | `app/src/lib/find.test.ts`: notes and actions | None. |
| **total** | | not-started 0, designed 0, building 3, tested 4 | | |

## One intelligence layer

Not a separate AI app: the assistant understands the current context, course, term, plan, sources, accessibility preferences, goals and permissions, and it explains, generates and prepares rather than operating invisibly or making official decisions.

| ID | In context | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ai-course | In a course, explains material using approved course sources | tested | `app/src/lib/context.test.ts`: carries the date and the course list, and no coursework at all<br>`app/src/ai/quality.test.ts`: source strength from what was read | None. |
| ai-degree | In a degree plan, explains why a requirement is still open | building | `app/src/lib/explain.ts`: the four questions, answered per screen, the degree among them | A screen explanation, not a requirement’s. |
| ai-schedule | In a schedule, identifies conflicts and helps create alternate plans | tested | `app/src/lib/registration.test.ts`: a plan with backups, checked for time conflicts<br>`app/src/lib/registration-day.test.ts`: ranked backups, clash-free | Deterministic, which is the right kind; the assistant is not asked. |
| ai-advising | In an advising flow, drafts a student-reviewed meeting agenda | building | `app/src/site/tools/Tools.tsx`: the advisor meeting planner, a public tool<br>`app/src/lib/advisor-shares.ts`: a plan shared to an advisor, with an expiry | The student writes the agenda; nothing drafts it, and the tool is on the site. |
| ai-career | In career tools, maps student-confirmed coursework and experiences to skills without inventing claims | tested | `app/src/lib/skills-graph.test.ts`: suggested, then confirmed<br>`app/src/lib/career-evidence.test.ts`: contain no word or number the student did not supply | None. |
| ai-campus | In Campus Hub, explains which office or resource can help and why | tested | `app/src/lib/nowrongdoor.ts`: describe the problem; be sent to the right door<br>`app/src/lib/nowrongdoor.test.ts`: crisis wording routes to counseling first; nothing typed is stored | None. |
| ai-money | In a financial workflow, turns a deadline or a status into a checklist and an official handoff | building | `app/src/screens/Costs.tsx`: the bill and spending<br>`docs/FINANCIAL-READINESS-WORKSPACE.md`: the workspace as designed | No checklist from a deadline; the aid office’s action arrives through the office feed instead. |
| ai-studio | In Study Studio, generates source-linked practice from the student’s materials under the course policy | tested | `app/src/components/StudyStudio.tsx`: the Studio<br>`app/src/ai/quality.test.ts`: the policy state and the sources under every reply<br>`app/src/lib/courserules.test.ts`: the course’s rules | None. |
| **total** | | not-started 0, designed 0, building 3, tested 5 | | |

## The shell

Every authenticated screen on the same foundation.

| ID | Element | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| shell-rail | Persistent left navigation on desktop | tested | `app/src/App.tsx`: the Rail<br>`app/src/mediumrail.test.tsx`: collapses on a medium width, never disappears | None. |
| shell-tabs | A compact bottom or tab navigation on mobile | tested | `app/src/lib/tabbar.ts`: the canonical five, with a rollback to the legacy student tabs<br>`app/src/lib/tabbar.test.ts`: the bar<br>`app/src/lib/fivedestinations.test.ts`: draws Today, My Path, Search, Plan, Me | The legacy tab collection remains only as the explicit rollback path. |
| shell-search | Global Search / Ask Semester from every screen | tested | `app/src/lib/keys.test.ts`: `/` and ⌘K open the overlay<br>`app/src/components/Command.tsx`: the overlay over the screen, which stays | ⌘K has two owners: the overlay and the assistant. |
| shell-actions | A persistent notification and Action Center entry | building | `app/src/screens/Hub.tsx`: Notices, under Today<br>`app/src/components/TodayActionCenter.tsx`: the Action Center on Today, behind its flag | Neither is in the chrome; both are on Today. |
| shell-context | Current term and current student context | tested | `app/src/components/unity/SystemContextBar.tsx`: one persistent strip with term, canonical place, workflow, Continue and health<br>`app/src/components/unity/SystemContextBar.test.tsx`: holds the term switch, canonical route, Continue, workflow and health<br>`app/src/components/TermSwitch.tsx`: the detailed term control<br>`app/src/components/SchoolPicker.tsx`: the school | Intentionally quiet on full-canvas search, directory, assistant, mail, call and onboarding surfaces. |
| shell-me | Profile, privacy, support and accessibility controls in one familiar location | tested | `app/src/lib/mecontrols.ts`: fourteen rows under Me<br>`app/src/lib/mecontrols.test.ts`: the rows, each with a screen | None. |
| shell-panel | A consistent right-side context panel on desktop | building | `app/src/components/unity/UnityLayer.tsx`: the Source & details drawer, mounted once<br>`app/src/components/desk/Sidebar.tsx`: the workspace sidebar | A drawer opened per item, not a panel that stays. |
| shell-visual | One visual hierarchy, spacing, typography, components, icons, motion and language | tested | `app/src/styles/tokens.css`: the tokens<br>`app/src/styles/tokens.test.ts`: held<br>`app/src/lib/onecontrol.test.ts`: one control pattern<br>`app/scripts/styles.mjs`: the style audit on every lint | None as a system; the vocabulary rows below say where the words drift. |
| **total** | | not-started 0, designed 0, building 2, tested 6 | | |

## The context bar

The current context, shown the same way at the top of relevant screens: `Fall 2026  /  Biology B.S.  /  BIO 201  /  Week 6`. A student changes it without losing their place, and the system updates what depends on it.

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| context-bar | The current context shown the same way at the top of relevant screens | tested | `app/src/components/unity/SystemContextBar.tsx`: term → canonical destination → specialist surface, in the shared shell<br>`app/src/components/unity/SystemContextBar.test.tsx`: holds the shared context elements<br>`app/src/components/unity/ContextBar.tsx`: context → object → source, freshness, save → one primary action; on six workspaces<br>`app/src/components/CourseHub.tsx`: `CODE · Term` as the context | The global strip does not yet carry program or week. |
| context-carries | Changing the context updates schedule, deadlines, materials, requirement impact, tutoring, career connections and actions without losing the place | building | `app/src/components/CoursePicker.tsx`: a course picker<br>`app/src/lib/parent.ts`: one level up, and why there is no breadcrumb | The switchers are separate components; the course is re-chosen per screen. |
| **total** | | not-started 0, designed 0, building 1, tested 1 | | |

Where BIO 201 follows the student, in the briefs’ example, and the screen that carries each:

| Where | Shows | Screen |
| --- | --- | --- |
| Plan | BIO 201 in the weekly schedule | `calendar` |
| Study | BIO 201 materials and quizzes | `study` |
| My Path | the requirement BIO 201 fulfils | `degree` |
| Career | the concepts and skills the course may support | `career` |
| Today | its upcoming exam and a study action | `home` |

## The detail panel

When a student opens any important item — course, action, deadline, person, scholarship, event, requirement, assignment or service — the same pattern opens.

| ID | Element | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| detail-what | What it is | tested | `app/src/components/unity/ObjectCard.tsx`: eyebrow, heading, why, metadata<br>`app/src/components/unity/unity.test.tsx`: the one rhythm | None. |
| detail-why | Why it matters to this student | tested | `app/src/components/ExplanationSheet.tsx`: “Why this?”<br>`app/src/components/ActionCenter.test.tsx`: the explanation with its working | Actions and cards; not every item. |
| detail-source | Source and last-updated information | tested | `app/src/components/SourceBadge.tsx`: source and freshness, on twenty-six screens<br>`app/src/components/SourceBadge.test.tsx`: the badge<br>`app/src/lib/unity.ts`: SourceDetail: origin, source name, freshness, used in, limitations | None. |
| detail-deadlines | Relevant deadlines and impact | building | `app/src/components/CourseDetailV2.tsx`: planImpact and clashLine, on the catalog view | The catalog view only, behind `course_detail_v2`. |
| detail-related | Related courses, plans, people, resources and documents | building | `app/src/components/CourseDetailV2.tsx`: relatedFuture and careerDirections | Related courses and directions; not people, resources or documents. |
| detail-primary | One primary next action | tested | `app/src/components/unity/ObjectCard.tsx`: one primary, one quiet secondary<br>`app/src/components/unity/unity.test.tsx`: holds its primary while the action is already running | None. |
| detail-secondary | Secondary actions: save, add to plan, schedule, ask for help, share, view official source | building | `app/src/components/unity/OpenIn.tsx`: open in another place<br>`app/src/components/unity/ObjectCard.tsx`: one secondary | Each exists somewhere (the table below); no card offers the set. |
| detail-privacy | Privacy and sharing context where applicable | tested | `app/src/components/unity/Visibility.tsx`: only me, course, collaborators, portfolio<br>`app/src/components/SharingList.test.tsx`: who sees what, until when | None. |
| **total** | | not-started 0, designed 0, building 3, tested 5 | | |

The secondary actions, each at the one place it exists today:

| Action | Carried by | Note |
| --- | --- | --- |
| Save | `app/src/components/CourseDetailV2.tsx` | The shortlist, on the catalog view. |
| Add to plan | `app/src/components/CourseDetailV2.tsx` | The cart, after a preview. |
| Schedule | `app/src/screens/Calendar.tsx` | The calendar; nothing schedules from a card. |
| Ask for help | `app/src/components/ActionCenter.tsx` | On an action; the note goes with the request. |
| Share | `app/src/components/SharingList.tsx` | A plan to an advisor or a supporter, with an expiry. |
| View official source | `app/src/components/ConfirmDialog.tsx` | The external tone: “You are leaving Semester”, and never offline. |

## Connected journeys

Every journey begins somewhere and ends in the Action Center, the plan, the calendar, the workspace or a verified official handoff. Each journey’s steps as the briefs wrote them, and the whole at what the tree has.

**Registration.** Requirement still open → Eligible courses → Compare sections → See schedule impact → Choose primary course and backups → Detect conflict → Build advising questions → Prepare registration checklist → Open official registration handoff → Confirm plan and update Today

**Academic support.** Student sees a difficult assignment → Opens course context → Reviews source-linked explanation → Creates study plan → Adds practice questions → Books or prepares for tutoring → Adds follow-up to Action Center → Reflects on what still needs help

**Career.** Student completes a course project → Saves project artifact → Maps student-confirmed skills → Adds evidence to portfolio → Updates resume draft → Finds related internship opportunities → Prepares application materials → Tracks interview and follow-up actions

**Campus support.** Student sees an important deadline or issue → Understands what it means → Finds the correct office → Sees required documents and checklist → Prepares questions → Schedules or opens official handoff → Tracks follow-up in Action Center

**Financial and life planning.** Student considers a course-load change → Sees schedule and degree impact → Views estimated timeline and cost context → Finds scholarship or aid deadlines → Prepares questions for the right office → Uses official portal for transactions → Keeps the follow-up action in Semester

| ID | Journey | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| journey-registration | Registration | tested | `app/src/lib/registration.test.ts`: a plan with backups, checked for conflicts<br>`app/src/lib/registration-day.test.ts`: the checklist and the ranked backups<br>`app/src/components/RegistrationDay.tsx`: the countdown, the copy of the section list, the official handoff | Advising questions are not a step, and nothing asks what happened after the handoff. |
| journey-support | Academic support | building | `app/src/components/CourseHub.tsx`: the readiness tab and the Studio, from the course<br>`app/src/lib/help-routes.ts`: tutoring as a route | No follow-up is written to the Action Center, and no reflection step. |
| journey-career | Career | tested | `app/src/lib/career-evidence.test.ts`: artifacts tied to something the student did; a résumé from confirmed skills only<br>`app/src/lib/career.ts`: what is open, what you have done, who you have spoken to | A finished project does not lead to an application; the two halves are joined by the student. |
| journey-campus | Campus support | tested | `app/src/lib/nowrongdoor.test.ts`: the right door, with a summary to take<br>`app/src/lib/office-actions.test.ts`: an office’s action, with its source and link<br>`app/src/components/OfficeActionFeed.test.tsx`: ranked in the Action Center | No documents checklist; the follow-up is the office action itself, not a step after it. |
| journey-money | Financial and life planning | building | `app/src/lib/graduation.ts`: term-by-term projection and the cost of delay<br>`app/src/screens/Costs.tsx`: the bill<br>`docs/FINANCIAL-READINESS-WORKSPACE.md`: the rest, as designed | No scholarship or aid deadlines, and the handoff leaves no follow-up. |
| **total** | | not-started 0, designed 0, building 2, tested 3 | | |

## The event layer

Event-driven synchronization, audit history, source precedence and conflict-resolution rules: a change is reflected everywhere it matters, while preserving student ownership and clear source labelling. Each event and what it should update, at what the tree has.

| Event | Updates |
| --- | --- |
| Student adds a course | Degree plan, Term plan, Schedule, Study workspace, Course context, Deadlines, Career skills |
| A deadline is added or confirmed | Today, Action Center, Calendar, Study plan, Notifications, Workload forecast |
| Student creates an advisor agenda | Calendar, Action Center, Meeting workspace, Shared plan, Follow-up actions |
| Course material is uploaded | Study Studio, Course workspace, Search, Citation system, AI context |
| Student completes a project | Portfolio, Skills record, Career workspace, Resume prompts, Reflection |
| Student changes a goal | Today recommendations, Path scenarios, Plan priorities, Career suggestions |
| A campus office publishes a deadline | Search, Relevant students’ Action Centers, Calendar, Resource directory |
| Student shares a plan | Advisor view, Audit history, Expiration controls, Shared meeting context |
| Student disconnects an account | Imported data controls, Source state, Privacy settings, Sync status |

| ID | Event | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| event-course | Student adds a course | tested | `app/src/state/slices/library.ts`: addCourse: one reducer; the calendar, the hub and the Studio derive from it<br>`app/src/lib/handoff.test.ts`: a course arrives whole: deadlines, guide, figures | The degree plan and the term plan do not read it; career skills only behind `career_evidence`. |
| event-deadline | A deadline is added or confirmed | tested | `app/src/lib/today-actions.test.ts`: a deadline becomes an action<br>`app/src/lib/notify.test.ts`: warns two days out<br>`app/src/lib/life-balance.test.ts`: the week’s hours | None. |
| event-agenda | Student creates an advisor agenda | building | `app/src/lib/advisor-shares.ts`: a plan shared with an advisor | No agenda object; nothing lands on the calendar or in the Action Center. |
| event-material | Course material is uploaded | tested | `app/src/lib/bundle.ts`: a folder of readings, dropped in at once<br>`app/src/lib/find.test.ts`: found by keyword<br>`app/src/ai/quality.test.ts`: source strength from material actually read | None. |
| event-project | Student completes a project | tested | `app/src/lib/career-evidence.test.ts`: an artifact tied to an entry, tagged with confirmed skills, in the résumé | No reflection. |
| event-goal | Student changes a goal | not-started | `docs/ONE-SYSTEM-PLATFORM-GRAMMAR.md`: no goal object | There is no goal to change. |
| event-office | A campus office publishes a deadline | tested | `app/src/components/OfficeActionFeed.test.tsx`: ranks an office action in the Action Center; the first three on Today; only the students it reaches | Not in search, the calendar or the directory. |
| event-share | Student shares a plan | tested | `app/src/lib/advisor-shares.test.ts`: the share, its expiry, its revoke<br>`app/src/components/SharingList.test.tsx`: who sees what, until when | No meeting context. |
| event-disconnect | Student disconnects an account | building | `app/src/screens/Connect.tsx`: connect and unlink<br>`app/src/lib/syncstatus.ts`: what each sync state is called | Imported rows keep their label; nothing marks them as from a source no longer connected. |
| **total** | | not-started 1, designed 0, building 2, tested 6 | | |

## One design system, every surface

Dark, refined, premium, connected, architectural and intentional — inside the application, not only on the marketing assets. One documented system used by:

| ID | Surface | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| design-site | Public marketing website | tested | `app/src/site/site.css`: the app’s @font-face rules prepended at build<br>`app/src/site/site.test.tsx`: the site’s colours equal the app’s :root tokens | None. |
| design-app | Student app | tested | `app/src/styles/tokens.test.ts`: the tokens<br>`app/src/lib/look.test.ts`: the palette, thirteen grounds, both faded strengths | None. |
| design-staff | Faculty and advisor tools | building | `app/src/components/institutional/RoleWorkspace.tsx`: twelve role workspaces, in the preview | Preview only. |
| design-console | Institution admin console | tested | `app/src/screens/Console.tsx`: the operations console, in the app’s own components<br>`app/src/screens/console.test.tsx`: the console | The operators’ console; the institution’s views are University tabs. |
| design-support | Support center | building | `app/src/components/HelpInbox.tsx`: the staff help inbox<br>`app/src/site/pages.tsx`: /help/: a short FAQ | No help center beyond the FAQ. |
| design-email | Email templates | building | `app/src/site/more.tsx`: the campus launch kit: email, announcement, signage and social templates as text<br>`docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`: the incident templates | Text to adapt; no rendered template, and nothing sends. |
| design-notifications | In-app notifications | tested | `app/src/lib/notify.ts`: tiers, caps, the why line<br>`app/src/lib/notify.test.ts`: held | None. |
| design-mobile | Mobile application | tested | `app/src/a11y/axe.test.tsx`: every route at phone width<br>`docs/ADAPTIVE-DEVICE-EXPERIENCE.md`: the rule: the same things on a phone, a tablet or a computer | A progressive web app; no store app. |
| design-status | Status page and trust center | tested | `app/public/status.html`: the status page<br>`app/src/lib/statuspage.test.ts`: probes the project the app is built against | Trust material is on ten pages; there is no one center. |
| **total** | | not-started 0, designed 0, building 3, tested 6 | | |

## Consistent language

Decided once and reused everywhere. Each word at the module that carries it; each avoided word that the retired-word rule (`content/terms.ts`) already refuses, named.

| Use this | Avoid this | Retired by the rule | Carried by | Note |
| --- | --- | --- | --- | --- |
| Next Step | task, to-do, alert, item, ticket | `task`, `to-do` | `app/src/lib/actions.ts` | The app’s word is “action”, and the rule retires both avoided words in its favour. “Next Step” is the site’s phrase. |
| My Path | degree audit, roadmap, progression view, planner | `roadmap` | `app/src/lib/tabbar.ts` | The five’s word for the degree screen, behind the flag; the screen itself is “The degree”. |
| Plan | schedule builder, course cart, term map | — | `app/src/lib/tabbar.ts` | The five’s word for the calendar; the registration screen still says cart. |
| Action Center | notifications, inbox, alerts, task list | `task` | `app/src/components/ActionCenter.tsx` | Notices, Alerts and Email keep their names as separate surfaces. |
| Ask Semester | chatbot, assistant, AI tutor, copilot | — | `app/src/ai/Panel.tsx` | The panel’s title; the code and the settings row still say assistant. |
| Source | verification, origin, provenance, reference | — | `app/src/lib/source.ts` | One word on every fact; the module that models scope and status is called provenance. |
| Needs Review | error, questionable, unverified, bad data | `unverified` | `app/src/lib/source.ts` | A source label; the status list has no word for it. |
| Official Handoff | external link, portal link, redirect | — | `app/src/components/ConfirmDialog.tsx` | The external tone exists; the pattern has no name in the app. |
| Workspace | files, documents, drafts, notes, projects | — | `app/src/lib/drivehome.ts` | The drive’s home; files, documents and notes remain the words on its screens. |

## Semester Home, by role

One Today, adaptive by role: different views, one shell, one design system, one permissions model.

| ID | Role | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| home-student | Students see path, actions, deadlines, schedule, study priorities, opportunities and support | tested | `app/src/lib/today-decision.ts`: the decision surface, for students<br>`app/src/lib/today-center.test.ts`: the three sentences, the words it may not use | Opportunities and support are widgets to pin, not there by default. |
| home-advisor | Advisors see only student-consented plans, agendas, meetings and follow-up | building | `app/src/components/institutional/RoleWorkspace.tsx`: the advisor workspace, in the preview<br>`app/src/lib/advisor-shares.ts`: the consented plans | Preview data; no advisor home in production. |
| home-faculty | Faculty see the course workspace, approved materials, course policy and teaching actions | building | `app/src/lib/courserules.ts`: Course Studio: what an instructor publishes beside the course<br>`app/src/components/institutional/RoleWorkspace.tsx`: the faculty workspace, in the preview | Course Studio is on for no institution; the workspace is a preview. |
| home-offices | Support offices see only the actions and content they may publish or manage | tested | `app/src/components/OfficeActionDesk.tsx`: the desk, for an office’s own actions<br>`app/src/components/OfficeActionFeed.test.tsx`: is not there for an account that may not publish; never offers approving your own | Behind `office_action_feed`. |
| home-leaders | Institution leaders see aggregate, privacy-protected operational insights | building | `app/src/components/institutional/OperationsStudio.tsx`: aggregates from pasted data<br>`app/src/lib/institution-ops.ts`: n ≥ 10, forbidden measures refused | Hidden for everyone; reads pasted data. |
| home-admins | Administrators see tenant settings, integrations, roles, content governance, audit health and support operations | tested | `app/src/screens/console.test.tsx`: the operators’ console<br>`app/src/components/institutional/ControlPlane.tsx`: the institution’s control plane, on University | Two consoles: operators at #/console, the institution on University tabs. |
| **total** | | not-started 0, designed 0, building 3, tested 3 | | |

## The command palette

The overlay is a search, deliberately not a palette that runs verbs: an action that changes data says what it will do before it does it, on a screen with a preview, and a list that mixes “go to the calendar” with “delete this course” is a list where one wrong Enter is unrecoverable. So every command above is a destination the overlay finds by name, and the three quick actions it does carry change nothing that cannot be seen and undone.

| Command | Destination | Note |
| --- | --- | --- |
| Ask Semester | `ask` | Also from the overlay’s button. |
| Search courses | `search` | The overlay. |
| Open My Path | `degree` |  |
| Add a course | `import` | From a syllabus. |
| Build a schedule | `yes` | Registration: a plan with backups. |
| Prepare for advising | — | The advisor planner is a site tool; in the app a plan is shared. |
| Find tutoring | `support` | A help route. |
| Create a study plan | `study` |  |
| Upload course material | `update` | Add a reading. |
| Find scholarships | — | No scholarship screen. |
| Open career workspace | `career` |  |
| View privacy controls | `privacy` |  |
| Contact support | `help` | The problem in your own words, then the right door. |

## The graph, the timeline and the workspace

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| graph | Semester Graph: Student → Goal → Requirement → Course → Assignment → Skill → Artifact → Opportunity, and Student → Need → Resource → Appointment → Follow-up → Outcome | building | `app/src/lib/skills-graph.ts`: course, project, work → skill → evidence → opportunity fit<br>`app/src/components/SkillsGraph.tsx`: drawn, behind `careerSkillsGraph` | Skills only. No goal, no requirement, no need, no appointment, no outcome. |
| timeline | Semester Timeline: registration windows, milestones, deadlines, exams, study blocks, advising, aid and scholarship dates, housing, campus events, applications, interviews, study abroad, personal goals | building | `app/src/components/TodayDecisionSurface.tsx`: seven days<br>`app/src/screens/Runway.tsx`: the exam runway<br>`app/src/screens/Calendar.tsx`: the calendar | Three views of the academic calendar; nothing joins registration windows, money, career or campus events on one line. |
| workspace | Semester Workspace: documents, notes, slides, tables, projects and agendas in one place with shared tags — course, term, goal, assignment, project, career path, advisor meeting, opportunity | building | `app/src/lib/drivehome.ts`: the drive’s home: the folders with something happening, the files with a reason<br>`app/src/screens/Work.tsx`: work on it | Folders are the tags; a project does not link to a requirement, a skill, a résumé bullet or an application. |
| **total** | | not-started 0, designed 0, building 3, tested 0 | | |

## The institution console

Not a pile of settings pages: the governance layer for the whole ecosystem, governing the same platform students use.

| ID | Governs | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ic-tenant | Tenant configuration and branding | building | `app/src/components/institutional/ControlPlane.tsx`: ten status tiles<br>`app/src/lib/control-plane.ts`: the viewed tenant | Preview; no branding. |
| ic-structure | Campus structure: schools, colleges, departments, programs, offices, locations | tested | `app/src/lib/governance/hierarchy.ts`: system → campus → school → program → course<br>`app/src/lib/governance/hierarchy.test.ts`: policy inheritance down the tree | A policy tree, not a directory: no offices, locations or cohorts as nodes. |
| ic-roles | Roles, permissions, approval workflows and delegated administration | tested | `supabase/console-approvals.check.sql`: self-approval refused; two approvers where the duty says<br>`app/src/lib/ops/consoleduties.test.ts`: the duties matrix | Platform operators; an institution’s admins have no delegation view. |
| ic-integrations | Integration connections, sync health, data mappings and source freshness | tested | `app/src/components/institutional/IntegrationDashboard.test.tsx`: every domain with status and health; counts exported, never ids | School staff, behind `integrationDashboard`. |
| ic-content | Content governance for catalog data, policies, resources, events and opportunities | tested | `app/src/lib/launch/content.ts`: thirteen content kinds: source, owner, review interval, visibility, expiry, correction route<br>`app/src/lib/launch/content.test.ts`: held | A register; no workflow. |
| ic-flags | Feature flags by campus, school, program, role, cohort and pilot | tested | `app/src/lib/flags.ts`: the registry<br>`app/src/lib/flags.test.ts`: every flag named<br>`app/src/lib/governance/rollout.ts`: per tenant | Per tenant and per build; no cohort, program or console view. |
| ic-ai | AI policies by institution, school, course and assignment | tested | `supabase/migrations/20260923210000_intelligence_policy.sql`: ai_policy per tenant: modes, providers, sources, retention<br>`app/src/lib/governance/policysim.test.ts`: a change simulated before it is made<br>`app/src/lib/courserules.test.ts`: the course’s rules | Tenant and course; no school or assignment layer, and no console view. |
| ic-a11y | Accessibility and content-quality workflows | designed | `docs/WCAG-UI-AUDIT-SCORECARD.md`: the scorecard<br>`docs/operating-model/ACCESSIBILITY-GOVERNANCE.md`: the governance | No workflow and no issue record. |
| ic-support | Support operations and secure consent-based access | tested | `supabase/support-access.check.sql`: a read needs a live grant, and the grant expires<br>`app/src/components/HelpInbox.test.tsx`: the staff inbox | None. |
| ic-audit | Audit logs, security events, privacy requests, retention workflows and incident response | tested | `supabase/console-control-plane.check.sql`: the hash-chained audit; a read is itself audited<br>`app/src/lib/retention.test.ts`: every table has a retention line<br>`app/src/components/DataRightsRequests.test.tsx`: student rights-request intake and status history<br>`docs/DATA-RIGHTS-REQUEST-RUNBOOK.md`: the handling and escalation procedure<br>`app/src/lib/ops/warroom.test.ts`: the war room | The privacy-request staff handling surface is not built, and neither that process nor an incident has been drilled. |
| ic-analytics | Aggregate institution analytics with privacy thresholds | tested | `app/src/lib/institution-ops.ts`: n ≥ 10; forbidden measures<br>`app/src/lib/institution-ops.test.ts`: held | On pasted data; the tab is hidden for everyone. |
| ic-pilot | Pilot setup, implementation playbooks, training resources and deployment status | building | `app/src/lib/governance/rollout.ts`: directory → pilot → production<br>`docs/operating-model/PILOT-TO-PRODUCTION.md`: what lets a school move | No console view of where a school stands. |
| **total** | | not-started 0, designed 1, building 2, tested 9 | | |

## The final test

Semester feels like one system when a student can begin anywhere — an assignment, a deadline, a course, a campus resource, an advising appointment, a financial reminder, a career opportunity — and immediately see:

| ID | Question | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| test-what | 1. What it is | tested | `app/src/components/unity/unity.test.tsx`: the one rhythm: eyebrow, heading, why, metadata, one primary | None. |
| test-why | 2. Why it matters to them | tested | `app/src/components/ActionCenter.test.tsx`: the explanation with its working | Actions; not every item. |
| test-connects | 3. What it connects to | building | `app/src/components/CourseDetailV2.tsx`: related courses and career directions | Courses only. |
| test-next | 4. What they should do next | tested | `app/src/components/ActionCenter.test.tsx`: one most important | None. |
| test-who | 5. Who can help | tested | `app/src/lib/help-routes.test.ts`: the routes<br>`app/src/lib/nowrongdoor.test.ts`: the right door | None. |
| test-changes | 6. What changes elsewhere when they act | not-started | `docs/ACTION-EXPLAINABILITY-AND-STUDENT-CONTROL.md`: the model; nothing says what an action changes | No action says what it changes elsewhere. |
| test-source | 7. Where the information came from | tested | `app/src/lib/source.test.ts`: the five labels and the line a fact prints | None. |
| test-control | 8. What they can control, share or revoke | tested | `app/src/components/SharingList.test.tsx`: who sees what, until when, and how to take it back<br>`app/src/lib/mecontrols.test.ts`: the rows under Me | None. |
| **total** | | not-started 1, designed 0, building 1, tested 6 | | |

## Add to the app

| ID | Addition | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| home | Semester OS home: Today as the desktop — path, the one action, today’s classes and blocks, milestones, “continue where you left off”, recent documents, a weekly check-in, Ask Semester | tested | `app/src/screens/Today.tsx`: Today<br>`app/src/components/TodayDecisionSurface.tsx`: the next decision, the path snapshot, seven days<br>`app/src/components/unity/CommandCenter.tsx`: three to five widgets the student pins<br>`app/src/lib/today-center.test.ts`: the calm wording | No “continue where you left off”, no recent documents, no weekly check-in; students only; the Action Center behind its flag. |
| notifications | Unified notification intelligence: what happened, why now, what to do, how urgent, its source, snooze, grouping, quiet hours, digest, device preferences, never-miss rules, “why am I seeing this?” | tested | `app/src/lib/notify.ts`: tiers with caps, quiet hours, the seen set, the why line<br>`app/src/lib/notify.test.ts`: held<br>`app/src/lib/comms.ts`: admit: a source on every message; priority; digest groups<br>`app/src/lib/comms.test.ts`: a required notice through quiet hours; a digest by day and week | Snooze is on actions, not notifications; no delivery history; no per-device preference; no never-miss rule; the digest is grouped, not sent. |
| inbox | Universal inbox: official notices, advisor and professor messages, drafts, agendas, support requests, replies tied to the course, plan or action, with needs-reply and needs-action filters | building | `app/src/screens/Hub.tsx`: Notices: one list, labelled by channel<br>`app/src/lib/mailbox.ts`: the mailbox: folders, rows, the message<br>`app/src/lib/comms.ts`: official, course and Semester channels | Three surfaces; no needs-reply or needs-action; a message does not point at its object. |
| cross-device | Cross-device continuity: web for depth, phone for Today and checklists, tablet for study, widgets, lock-screen updates, offline mode, voice | tested | `app/src/lib/offline-mode.test.ts`: syncs on reconnect only with an account and something waiting<br>`app/src/lib/syncstatus.test.ts`: one table for every sync state<br>`app/src/lib/voiceloop.test.ts`: ask and hear the answer<br>`app/src/lib/device.test.ts`: the lock screen, the icon badge, the wake lock<br>`docs/CROSS-DEVICE-CONTINUITY.md`: what carries, how, and where it falls short | No home-screen widget; the tablet is the phone layout widened; offline mode behind its flag. |
| passport | Semester Passport: a portable, student-controlled record of path, courses, skills, artifacts, career, involvement, credentials, reflections, with sharing per item | building | `app/src/lib/career-evidence.ts`: skills, artifacts, bullets and résumé versions the student controls<br>`app/src/lib/sharing.ts`: every share ends, and can be taken back<br>`app/src/lib/export.ts`: everything, in files<br>`docs/CREDENTIAL-WALLET.md`: the wallet, Tier 2, Phase 3 | Not one record; sharing is by relationship, not per item; no credential is issued. |
| course-workspace | Connected course workspace: overview, syllabus, assignments, notes, study tools, timeline, requirement impact, support, skills and career, advisor notes, AI policy, official links | tested | `app/src/components/CourseHub.tsx`: overview, assignments, study, readiness, readings, sources, syllabus; the context bar<br>`app/src/lib/courserules.test.ts`: the course’s AI policy<br>`app/src/components/CourseDetailV2.test.tsx`: every section and where each came from, on the catalog view | Requirement impact, support and career connections are on the catalog view, not the enrolled hub; no advisor notes. |
| life-load | Life-load and capacity planner: classes, exams, work, commute, athletics, caregiving, sleep and study windows, with neutral guidance and no scoring of the student | tested | `app/src/lib/life-balance.ts`: class, work, commute, study, personal, athletics and open hours; the crunch forecast<br>`app/src/lib/life-balance.test.ts`: each minute once; the rest floor<br>`app/src/components/CrunchWeekCard.tsx`: three or more deadlines in six days, as an action<br>`app/src/components/Capacity.tsx`: whether the week is possible | Behind two flags; no sleep window; the guidance is one line, not a plan. |
| handoffs | Official handoffs: “you are about to continue in the university’s system”, what Semester prepared, copy identifiers, export, open, return with “what happened?”, mark complete, blocked or needs help | building | `app/src/components/ConfirmDialog.tsx`: the external tone, never offline<br>`app/src/components/RegistrationDay.tsx`: copy the section list and the course references<br>`app/src/lib/returnto.ts`: return after sign-in | No shared pattern with a name; no return prompt; no complete, blocked or needs-help outcome. |
| **total** | | not-started 0, designed 0, building 3, tested 5 | | |

## Add to the company site

Each page at its route in `site/render.tsx`, or none.

| ID | Route |
| --- | --- |
| architecture | `/platform/one-operating-system/` |
| why-not | `/platform/why-not-another-tool/` |
| role-pages | `/students/` |
| demos | `/demo/` |
| trust-center | — |
| implementation-center | `/start/` |
| outcomes | `/proof/` |

| ID | Page | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| architecture | “One Operating System. Every Student Moment.”: the student at the centre, nine areas around them, each with the problem, the workflow, who benefits, what connects, what stays official, and how it connects back | tested | `app/src/site/oneos.tsx`: the page, printed from this register<br>`app/src/lib/oneos.test.ts`: every area at the weakest status of the rows it rests on | Script-free: an area opens as a disclosure, not a map. |
| why-not | “Why not another tool?”: the traditional approach beside the Semester approach | tested | `app/src/site/oneos.tsx`: the eight rows, each with this register’s word<br>`app/src/lib/oneos.test.ts`: every row rests on rows that exist | None. |
| role-pages | Role-specific pages: students, prospective students, advising, student success, faculty, registrar, career services, campus life, IT and procurement, leadership, employers and alumni, parents | building | `app/src/site/pages.tsx`: /students/ and /institutions/; the home page routes six answers to real pages | Two pages; ten of the twelve roles route to one of them. |
| demos | Interactive guided demos — plan a term, resolve a conflict, prepare an agenda, a syllabus into a study plan — labelled as sample data | building | `app/src/site/more.tsx`: /demo/: the sample institution, and a next step per audience<br>`app/src/components/InstitutionalPreviewBar.tsx`: “Demo environment · No real student data”<br>`app/src/site/tools/Tools.tsx`: five tools that run in the page | A persona switcher and five tools, not scripted scenarios. |
| trust-center | A Trust Center: security, privacy and FERPA, data minimization, AI governance, accessibility and VPAT, architecture, integrations, subprocessors, retention, incident response, status, support policy, DPA contact, changelog | building | `app/src/site/benchmark.tsx`: Data & AI Transparency, the integrations registry<br>`app/src/site/pages.tsx`: security, privacy, accessibility, legal, product quality | Ten pages, no hub; no SLA; the subprocessors are a table on one page. |
| implementation-center | An Implementation Center: pilot scope, stakeholders, integrations, SSO and roles, training, onboarding, support, success metrics, pilot to campus-wide | building | `app/src/site/more.tsx`: /start/: the nine steps of a pilot; /launch/: what a launch site holds | No stakeholders, no success metrics, no path from pilot to campus-wide. |
| outcomes | A proof and outcomes page, with limitations and method, and no retention or graduation claim until the evidence exists | tested | `app/src/lib/ops/claims.test.ts`: is what the proof page promises<br>`app/src/site/pages.tsx`: /proof/: the rules, written before there is proof | The policy only; no outcome yet, which is what the brief asks. |
| **total** | | not-started 0, designed 0, building 4, tested 3 | | |

## Add to the institution console

| ID | Feature | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| campus-graph | Campus configuration graph: university → college → department → program → course → office → role → location → event source → policy → cohort, each with owner, source, last reviewed, verification, permissions, cohorts, connections, quality checks | building | `app/src/lib/governance/hierarchy.ts`: the policy tree<br>`app/src/lib/integration/catalog.ts`: the entities<br>`supabase/migrations/20260928302000_office_action_feed.sql`: twelve offices, each with its publishing roles | No graph with an owner, a source, a review date and a verification per node. |
| action-publisher | Institution Action Publisher: offices publish standardized actions into the right students’ Action Centers, with target, owner, source, dates, priority, required action, support contact, accessibility review, approval history, aggregate completion | tested | `app/src/lib/office-actions.test.ts`: a complete row, with its office, link, source and dates<br>`app/src/components/OfficeActionFeed.test.tsx`: publishes only after a preview; never approving your own; no count below ten<br>`supabase/officeactions.check.sql`: draft → review → published; a second person approves<br>`docs/OFFICE-ACTION-FEED.md`: the design | Behind `office_action_feed`; no support contact, accessibility review, explicit expiry or multi-step approval history. |
| integration-center | Integration command center: SIS, LMS, SSO and SCIM, Google and Microsoft, calendar and meetings, and every source with status, last sync, categories, fields, scopes, modules, owner, fallback, known issues, disconnect | tested | `app/src/components/institutional/IntegrationDashboard.test.tsx`: every domain; counts exported, never ids<br>`app/src/lib/integration/dashboard.ts`: connections with status, last sync, classification ceiling, freshness target, scopes with expiry, field mappings | No Google or Microsoft entry; no fallback, known-issues or disconnect. |
| content-governance | Content governance studio: draft, review, approve, publish, archive and scheduled review for resources, offices, policies, events, opportunities, scholarships, programs, FAQs and AI source packs | tested | `app/src/lib/launch/content.test.ts`: thirteen kinds, each with an owner, an interval and an expiry | A register; no workflow, no version history, no freshness alert. |
| role-consent | Role and consent center: roles and scope, consented sharing, advisor and tutor access, supporter sharing with expiry, data classification, MFA, audit, export and deletion, retention, legal holds | tested | `supabase/support-access.check.sql`: a support read needs a live grant<br>`app/src/lib/sharing.test.ts`: the consent rules every share follows<br>`app/src/lib/mecontrols.test.ts`: the student’s side, under Me | The student’s side and the server; no admin center joins them, and legal holds exist on integration tables only. |
| ai-policy | AI policy and quality console: institution, school, course and assignment rules; allowed and prohibited assistance; providers; data categories; source grounding; citation; human confirmation; retention; integrity flows; disclosure; feedback | tested | `supabase/migrations/20260923210000_intelligence_policy.sql`: ai_policy, approved_source, tenant_policy_audit_event<br>`app/src/lib/governance/policysim.test.ts`: a module switch-off simulated before it is made<br>`app/src/lib/courserules.test.ts`: the course layer | Tenant and course only; no console screen; integrity flows and disclosure text are documents. |
| health-dashboard | Student-experience health dashboard: aggregate only — readiness by cohort, searches with no result, top resources, stale content, failed handoffs, snooze patterns, support categories, accessibility errors, integration failures | building | `app/src/lib/institution-ops.ts`: aggregates at n ≥ 10; no per-student measure<br>`app/src/lib/ops/leadership.ts`: the seven knowledge signals, marked not surfaced | Rules and a list; none of the signals is measured. |
| **total** | | not-started 0, designed 0, building 2, tested 5 | | |

## The company behind it

### Commercial readiness

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| co-pilot-package | A clear institutional pilot package and statement of work | tested | `docs/trust/PILOT-AGREEMENT-OUTLINE.md`: the outline<br>`app/src/lib/launchkit.test.ts`: the package and the statement of work, held field by field | Nothing may be signed; the entity is an attestation. |
| co-agreement | A standard subscription agreement | designed | `docs/legal/TERMS-OF-SERVICE-DRAFT.md`: the draft, its not-in-force banner intact | Not reviewed by counsel; no party to sign it. |
| co-dpa | A Data Processing Addendum | designed | `docs/trust/DPA-CHECKLIST.md`: what the agreement must settle | No agreement language. |
| co-questionnaire | Security and privacy questionnaire responses | designed | `docs/market-readiness/HECVAT_READINESS.md`: each question, against the tree | The workbook is not filled in or reviewed. |
| co-pricing | A pricing model by size, scope, integrations, implementation, support and AI usage | tested | `app/src/lib/plans.test.ts`: every price planned; nothing takes money<br>`app/src/lib/governance/deal-desk.test.ts`: the deal desk’s minimums | No price decided. |
| co-plans | Individual Free, Plus, Pro and institution-sponsored plans | tested | `app/src/lib/plans.test.ts`: export, deletion and saved plans on every plan, including Free | Plus and Pro are not on sale. |
| co-billing | Hosted billing, invoices, cancellation, refunds, export and account deletion | tested | `app/src/lib/billing/checkout.test.ts`: checkout<br>`app/src/lib/billing/webhook.test.ts`: an event applied once<br>`supabase/deletion.check.sql`: deletion removes the rows from every table | Billing is off until keyed; nothing charged; no reconciliation. |
| co-partners | A partner program for universities, departments, service providers and content partners | designed | `docs/PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md`: the partnerships, as designed | No partner. |
| co-success | Customer-success playbooks and quarterly business-review templates | designed | `docs/INSTITUTIONAL-GTM-PLAYBOOK.md`: target account to renewal | No customer. |
| **total** | | not-started 0, designed 5, building 0, tested 4 | | |

### Support readiness

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| co-help | A public help center | building | `app/src/site/pages.tsx`: /help/: the questions students ask first<br>`app/src/lib/guidebook.ts`: the in-app guidebook | A short FAQ. |
| co-feedback | In-product support and feedback | tested | `app/src/lib/tickethandoff.test.ts`: the seven things a ticket carries, and what is never attached<br>`app/src/lib/supporttickets.test.ts`: the tickets | None. |
| co-escalation | Ticketing and support escalation | tested | `app/src/components/HelpInbox.test.tsx`: the staff inbox<br>`supabase/functions/_shared/escalation.ts`: a signed escalation webhook | No on-call rota behind it. |
| co-sla | Service-level commitments | tested | `app/src/lib/sla.test.ts`: the formula against the document’s worked example<br>`docs/trust/SLA.md`: not started as a commitment; the framework drafted | No uptime number is offered. |
| co-incident-comms | Incident communication templates | tested | `app/src/lib/governance/incident-comms.test.ts`: communications by audience<br>`docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`: the phases | Never used. |
| co-runbooks | Internal runbooks for login, sync, billing, data access, security and accessibility | tested | `docs/RUNBOOKS.md`: the runbooks<br>`app/src/lib/runbooklinks.test.ts`: every link goes to a file that exists | Billing and accessibility runbooks are thin. |
| co-onboarding | Customer onboarding checklists | building | `app/src/site/more.tsx`: /start/ and the campus launch kit | Text; no checklist a customer works through. |
| co-training | Training for students, advisors, faculty and administrators | designed | `docs/FACULTY-ENABLEMENT.md`: faculty enablement | No training exists for anyone. |
| co-tours | In-app guided tours and contextual help | tested | `app/src/lib/explain.ts`: the four questions, answered per screen<br>`app/src/components/unity/ScreenGuide.tsx`: in the same place on every screen<br>`app/src/lib/welcome.test.ts`: the first-run welcome | Contextual help, yes; no guided tour. |
| **total** | | not-started 0, designed 1, building 2, tested 6 | | |

### Security readiness

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| co-sdlc | A secure software-development lifecycle | tested | `.github/workflows/ci.yml`: every gate, on every change<br>`app/src/lib/ops/boundaries.test.ts`: no secret in anything a browser loads | No threat model per change. |
| co-secrets | Private repositories and secrets management | tested | `SECRETS.md`: where each secret lives<br>`app/src/lib/ops/boundaries.test.ts`: held | The repository is public by decision. |
| co-deps | Dependency scanning and vulnerability management | building | `.github/dependabot.yml`: weekly updates<br>`.github/workflows/ci.yml`: gitleaks over every change | No SCA gate; no SLA on a finding. |
| co-observability | Logging, alerting, monitoring, backups and restore tests | tested | `app/src/lib/rehearsal.test.ts`: the restore rehearsal runs in CI<br>`MONITORING.md`: what is watched<br>`RESTORE.md`: the procedure | Production has never been restored; no alerting on call. |
| co-pentest | A penetration-testing plan | tested | `docs/trust/PENETRATION-TEST-PLAN.md`: scope, firm selection, findings register<br>`app/src/lib/trust/vendorrisk.test.ts`: says plainly that no external test has been performed; names every Edge Function in scope | No firm engaged. |
| co-mfa | Admin MFA | tested | `supabase/console-control-plane.check.sql`: a fresh second factor on every sensitive action<br>`app/src/components/MfaStep.tsx`: the step | Operators only; no student MFA. |
| co-isolation | Tenant isolation testing | tested | `supabase/access.check.sql`: what a second account can and cannot read<br>`app/src/isolation.test.ts`: the client side | None. |
| co-ir | An incident-response plan and tabletop exercises | tested | `docs/CRISIS-RESPONSE-RUNBOOK.md`: the runbook<br>`app/src/lib/ops/warroom.test.ts`: the war room | No tabletop has been run. |
| co-dr | A disaster-recovery plan | designed | `RESTORE.md`: the restore<br>`RETENTION.md`: the backups’ lifecycle | Recovery time unmeasured. |
| co-vendors | A vendor and subprocessor review process | tested | `app/src/lib/trust/vendorrisk.test.ts`: one row per subprocessor; no review claimed while none is filed<br>`docs/trust/VENDOR-RISK-REGISTER.md`: the register | No vendor assessed. |
| co-disclosure | A security-contact channel and a responsible-disclosure policy | designed | `SECURITY.md`: reporting a problem from outside | One address, read by a person. |
| **total** | | not-started 0, designed 2, building 1, tested 8 | | |

### Company credibility

| ID | What | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| co-domain | A real company domain and professional email addresses | not-started | `ops/claims/README.md`: company-addresses: planned, with the company that owns the domain | One address for everything. |
| co-identity | A clear company identity, leadership page and contact routes | building | `app/src/site/pages.tsx`: /about/ and /contact/: each topic routed to a seat | No leadership page; four of twelve seats held, all by the founder. |
| co-careers | A careers page and candidate process | building | `app/src/site/pages.tsx`: /careers/ | No process. |
| co-ambassadors | An advisor and university-partner program, and a student ambassador program | building | `app/src/site/benchmark.tsx`: /research/: the design-partner council and the student advisory network, each marked not yet running | Neither is running. |
| co-consent | A case-study process and a testimonial consent process | tested | `app/src/lib/ops/claims.test.ts`: is what the proof page promises<br>`app/src/lib/ops/claims.ts`: the proof rules: no invented metric, no unapproved logo, consent before a quote | No case study to run it on. |
| co-roadmap | Product-plan principles that never promise an unbuilt feature as current | tested | `docs/PRODUCT-ROADMAP.md`: the plan<br>`app/src/lib/ops/claims.test.ts`: a word above what the register supports is refused | None. |
| co-changelog | A public changelog and product-status updates | tested | `CHANGELOG.md`: what a tester will see<br>`app/src/lib/whatsnew.test.ts`: the in-app What changed<br>`app/src/lib/statuspage.test.ts`: the status page | No uptime history. |
| co-social | Consistent social content: real workflows, student stories, product philosophy | building | `app/src/site/more.tsx`: the launch kit’s social templates | Templates; no channel. |
| **total** | | not-started 1, designed 0, building 4, tested 3 | | |

## The nine areas the architecture page draws

`/platform/one-operating-system/` puts the student at the centre and these nine areas around them. Each area’s word is the weakest of the rows it rests on.

| Area | Rests on | Word |
| --- | --- | --- |
| Academic Path | journey-registration, ai-degree, test-connects | Being built |
| Courses and Learning | course-workspace, ai-course, ai-studio, event-material | Held by a test |
| Schedule and Planning | life-load, ai-schedule, event-deadline, timeline | Being built |
| Advising and Support | journey-support, ai-advising, ai-campus, event-agenda | Being built |
| Campus Life | action-publisher, event-office, journey-campus | Held by a test |
| Career and Portfolio | journey-career, ai-career, event-project, passport, graph | Being built |
| Money and Important Dates | journey-money, ai-money | Being built |
| Community and Opportunities | search-opportunities, graph | Being built |
| Institution Operations | ic-roles, ic-integrations, ic-audit, campus-graph, health-dashboard | Being built |

## Why not another tool

`/platform/why-not-another-tool/` prints the briefs’ comparison with the same word beside each row.

| Traditional approach | Semester approach | Rests on | Word |
| --- | --- | --- | --- |
| Separate portals for separate jobs | One connected platform | shell-tabs, shell-rail, identity, objects | Being built |
| Students must know where to look | Semester surfaces the next relevant action | action-center, ac-most | Held by a test |
| Data stays inside departmental silos | Shared context with role-based permissions | ic-roles, ic-support, role-consent | Held by a test |
| Multiple logins and interfaces | One identity and one familiar experience | identity, shell-visual | Held by a test |
| Alerts arrive independently | One prioritized Action Center | notifications, action-center, inbox | Being built |
| AI works without context | Source-aware intelligence with permissions and controls | intelligence, ai-course, ic-ai | Held by a test |
| Support depends on navigating an org chart | Relevant resources and safe handoffs appear in context | ai-campus, test-who, handoffs | Being built |
| Students manually connect coursework to careers | Student-controlled course-to-skill-to-career pathways | ai-career, journey-career | Held by a test |

## The ten highest-impact additions

1. **home** — Semester OS home: Today as the desktop — path, the one action, today’s classes and blocks, milestones, “continue where you left off”, recent documents, a weekly check-in, Ask Semester (tested)
2. **action-center** — One Action Center: every module proposes; the student sees one prioritized, explainable list (tested)
3. **search** — One global search over the student’s whole university world, answering with context and an action (tested)
4. **course-workspace** — Connected course workspace: overview, syllabus, assignments, notes, study tools, timeline, requirement impact, support, skills and career, advisor notes, AI policy, official links (tested)
5. **passport** — Semester Passport: a portable, student-controlled record of path, courses, skills, artifacts, career, involvement, credentials, reflections, with sharing per item (building)
6. **action-publisher** — Institution Action Publisher: offices publish standardized actions into the right students’ Action Centers, with target, owner, source, dates, priority, required action, support contact, accessibility review, approval history, aggregate completion (tested)
7. **integration-center** — Integration command center: SIS, LMS, SSO and SCIM, Google and Microsoft, calendar and meetings, and every source with status, last sync, categories, fields, scopes, modules, owner, fallback, known issues, disconnect (tested)
8. **content-governance** — Content governance studio: draft, review, approve, publish, archive and scheduled review for resources, offices, policies, events, opportunities, scholarships, programs, FAQs and AI source packs (tested)
9. **ai-policy** — AI policy and quality console: institution, school, course and assignment rules; allowed and prohibited assistance; providers; data categories; source grounding; citation; human confirmation; retention; integrity flows; disclosure; feedback (tested)
10. **architecture** — “One Operating System. Every Student Moment.”: the student at the centre, nine areas around them, each with the problem, the workflow, who benefits, what connects, what stays official, and how it connects back (tested)

## The final standard

Does it connect to the student’s identity, goals, courses, term, plan, calendar, Action Center, Search, Workspace, intelligence layer, permissions and source data — or is it merely another isolated screen? If it connects, it strengthens the operating system. If it is isolated, it is redesigned, merged into an existing workflow, or removed.
