Semester should become the contextual layer over the systems a university already runs — calendar, email, registration, degree planning, advising, clubs, campus services, financial information, records. This document continues the master specification at item **184** and **preserves every previous requirement**; nothing here replaces or retires anything in the documents beside it.

It follows [`WORKSPACE_REQUIREMENTS.md`](WORKSPACE_REQUIREMENTS.md) (items 129–183) and shares that document's argument in a higher-stakes form. There, connecting a file to its assignment was a competitive advantage. Here, the same connective layer touches a student's registration, their transcript and their graduation date — so the distinction between *what Semester knows* and *what the university has confirmed* stops being a design nicety and becomes the thing the whole layer rests on.

Two documents already cover ground this one touches, and both remain in force:

- [`INSTITUTIONAL_REQUIREMENTS.md`](INSTITUTIONAL_REQUIREMENTS.md) — thirty sections on what an institution needs from Semester, including the student-information system, transcripts, the directory, the campus map and graduation. That is the *institution's* requirements; this document is the *student's* interface to them.
- [`UNIVERSITY_CONNECTIONS.md`](UNIVERSITY_CONNECTIONS.md) — the handoff describing what is actually built: a typed adapter contract, a gateway that enforces capability checks and explicit confirmation, an encrypted journal, and a sandbox institution that is deliberately not in the approved registry. **Read it before building any item below**, because it is the file that already answers "how does an integration get to be real".

---

# 184. Semester University OS

Expand Semester into a unified interface for university systems.

The long-term experience should reduce the need for students to move constantly between:

```
Student Portal
LMS
Registration System
Degree Audit
University Email
Calendar
Club Platforms
Dining
Housing
Library
Career Portal
Advising
Financial Aid
Billing
Campus Transportation
University Directory
Health/Wellness Portal
IT Services
Campus Events
Athletics
```

Semester should become the contextual layer connecting these systems.

**CRITICAL: do NOT pretend Semester has institutional access when it does not.**

Every university integration must clearly distinguish:

1. Native Semester data
2. User-entered data
3. Public university data
4. Connected institutional data
5. External links

These five are not a labelling convention, they are five different warranties. A date the student typed and a date the registrar confirmed look identical on a screen and are worth entirely different amounts when somebody plans a term around one. The distinction belongs in the data model — see item 133's `source` field — and not in a caption a screen may forget to draw.

# 185. University integration layer

Create a standardized integration architecture:

```
UniversityIntegrationProvider

├── StudentInformationSystem
├── LearningManagementSystem
├── RegistrationSystem
├── DegreeAuditSystem
├── UniversityCalendar
├── UniversityDirectory
├── UniversityEmail
├── CampusEvents
├── Library
├── Dining
├── Housing
├── Transportation
├── CareerServices
├── FinancialServices
└── Advising
```

**Do not tightly couple Semester to one university vendor.**

# 186. University system connectors

Prepare adapters for common higher-education systems where legitimate APIs or integrations exist:

```
Canvas
Brightspace
Blackboard
Moodle

Banner
PeopleSoft
Workday Student

DegreeWorks

Handshake

Google Workspace
Microsoft 365

Zoom
Teams
Google Meet
```

**Do not scrape authenticated university portals in ways that violate access controls or terms.** Prefer official APIs, OAuth, institutional partnerships, user-authorized imports, or clearly labeled external links.

# 187. Semester Calendar — major expansion

Calendar should become one of the central systems of Semester, combining:

```
CLASSES
ASSIGNMENTS
EXAMS
STUDY SESSIONS
OFFICE HOURS
CLUB MEETINGS
EVENTS
CAREER EVENTS
PERSONAL EVENTS
WORK
MEETINGS
DEADLINES
REGISTRATION
UNIVERSITY DATES
```

# 188. Calendar views

```
TODAY

DAY

WEEK

MONTH

SEMESTER

AGENDA
```

Mobile should have optimized agenda and day views **rather than simply shrinking desktop calendar grids**.

# 189. Calendar event types

Standardize event types:

```
CLASS
ASSIGNMENT
EXAM
QUIZ
STUDY
MEETING
OFFICE_HOURS
ORGANIZATION
SOCIAL
CAREER
ATHLETIC
UNIVERSITY
PERSONAL
WORK
DEADLINE
REGISTRATION
OTHER
```

Allow filtering.

# 190. Smart calendar

Calendar should understand relationships:

```
ECON 301 Midterm
Friday 10 AM
        ↓
Study plan
        ↓
Monday review
Tuesday practice
Wednesday study group
Thursday practice exam
```

These items should be connected rather than independent calendar entries. Moving the midterm should be able to ask about the four sessions that exist because of it.

# 191. Calendar conflict detection

Detect scheduling conflicts:

> Finance Club meeting overlaps with your ECON 301 study group from 7:00–7:30 PM.

Provide options: keep both, reschedule the flexible event, remove one, find another study group.

**Never automatically change important calendar events without permission.**

# 192. Calendar availability

Allow students to see their available time:

```
TUESDAY

8–10       Busy
10–12      Free
12–1       Lunch
1–4        Busy
4–6        Free
6–7        Gym
7–10       Free
```

This can power study planning, group meetings, club scheduling, tutoring and office-hour planning.

# 193. Find a time

The user selects participants; Semester compares authorized availability:

```
BEST TIMES

Tuesday
7:00–8:00 PM
4/4 available

Wednesday
4:30–5:30 PM
4/4 available

Thursday
8:00–9:00 PM
3/4 available
```

**Respect calendar privacy.** Other users see *availability* — not private event titles — unless explicitly shared. A free/busy grid that leaks "Counseling appointment" in a tooltip has broken the one promise this feature makes.

# 194. Google Calendar integration

Support optional synchronization: import events, create events, update Semester-created events, display availability, add a Semester event to Google Calendar.

**Avoid duplicate synchronization loops.** Track:

```
provider
external_event_id
sync_status
last_synced
```

An event that round-trips and comes back as a second event is the failure mode, and `external_event_id` is what prevents it.

# 195. Outlook Calendar integration

Provide equivalent architecture for Microsoft Outlook calendars. **Semester must not become dependent on Google-only workflows.**

# 196. University academic calendar

Maintain campus-specific institutional dates: first day of classes, add/drop deadline, withdrawal deadline, fall break, Thanksgiving, reading days, finals, registration opening, graduation, housing deadlines.

Show relevant dates automatically. **Use authoritative university sources when possible**, and say which source a date came from.

# 197. Registration deadline system

Registration dates deserve special treatment:

```
COURSE REGISTRATION

Registration opens
November 4 • 8:00 AM

Your registration window:
November 5 • 10:30 AM

5 days remaining
```

Allow reminders.

**Never claim a personalized registration window unless obtained from legitimate user or institutional data.** A guessed window is worse than no window: a student who misses their real one because the app showed a plausible wrong one has lost a term's schedule.

# 198. Semester Mail

Create a unified academic and campus email layer.

Semester Mail should **NOT** initially attempt to become a standalone email provider. Connect authorized accounts instead — Gmail / Google Workspace, Outlook / Microsoft 365 — and provide context around existing email.

# 199. Email inbox

```
SEMESTER MAIL

IMPORTANT

COURSES

PROFESSORS

ORGANIZATIONS

CAREER

UNIVERSITY

OTHER
```

**Classification should assist rather than hide messages.** Users must still be able to reach all mail; a misfiled message that cannot be found is worse than an unsorted inbox.

# 200. Course-aware email

Automatically associate emails where reliably possible:

```
From: Professor Smith

ECON 301

Midterm Room Change

Related:
ECON 301
Midterm
Friday 10 AM
```

**Allow user corrections.**

# 201. Email → calendar

Detect candidate event information. From *"Office hours moved to Wednesday at 3 PM"*:

> Add updated office hours to calendar?

**Require confirmation when ambiguity exists.**

# 202. Email → task

From *"Problem Set 4 is due Friday"*:

```
Create Assignment?

Problem Set 4
ECON 301
Friday 11:59 PM
```

User reviews before creation.

# 203. Email → event

From *"Finance Club networking dinner Thursday 7 PM"*: offer **Add Event**, or associate it with an existing Semester event.

# 204. AI email summary

Allow users to summarize authorized emails:

- *Summarize my academic emails today.*
- *What important university emails did I receive this week?*
- *Did any professors change deadlines?*

**Never claim a deadline changed unless the email clearly supports it. Show source messages.** The third question is the dangerous one: a summary that reports a deadline move which the email only hinted at will be acted on.

# 205. Email compose

Allow composing through the connected provider. Contextual actions: **Email Professor** from a professor profile, **Email TA** from a course, **Email Organization** from an organization.

Use actual provider send APIs when connected. **Do not simulate sending.**

# 206. Email draft assistance

Semester AI can help draft a professor email, advisor email, club email, career email or group-project email. **User must review before sending.**

# 207. University directory

Build a campus-wide directory:

```
STUDENTS
FACULTY
STAFF
DEPARTMENTS
OFFICES
ORGANIZATIONS
BUILDINGS
SERVICES
```

**Only display information users are authorized to access, or information that is legitimately public.**

# 208. University office directory

Create profiles for important campus offices — Registrar, Financial Aid, Academic Advising, Student Accounts, Housing, Career Center, Student Health, Counseling, Disability Services, International Student Services, IT, Library, Campus Safety.

Each page can include a description, location, hours, contact, website, appointment link, relevant forms and common tasks.

# 209. "I need to…" university navigator

Create a task-oriented university interface. Instead of expecting students to know which office handles what:

```
I NEED TO...

Change my major

Drop a course

Request transcript

Find academic advisor

Pay tuition

Waive health insurance

Get enrollment verification

Declare minor

Study abroad

Find tutoring

Replace student ID

Register for classes

Appeal a grade

Apply for housing
```

Semester routes students to the correct process. **This could become an extremely valuable feature** — it is the one item in this document that needs no institutional access at all and solves a problem every student has in their first month.

# 210. University form directory

Create a searchable form and process catalog: major declaration, minor declaration, add/drop, withdrawal, transcript, enrollment verification, leave of absence, study abroad, transfer credit, graduation application.

Track:

```
University
Office
Form name
Purpose
Official URL
Deadline
Requirements
```

**Use official university links.**

# 211. Course registration system

Build a full course-planning and registration-preparation experience. **Even when Semester cannot register a student, it can dramatically improve the process.**

```
SEARCH COURSES
      ↓
COMPARE SECTIONS
      ↓
CHECK REQUIREMENTS
      ↓
BUILD SCHEDULE
      ↓
CHECK CONFLICTS
      ↓
CHECK DEGREE PROGRESS
      ↓
SAVE REGISTRATION PLAN
      ↓
REGISTER THROUGH CONNECTED SYSTEM
```

# 212. Course search

Search by course code, course name, professor, department, subject, requirement, day, time, credits, level, campus, and availability where legitimate data exists.

# 213. Course detail page

```
ECON 3010
Intermediate Macroeconomics

Credits: 3
Department: Economics

Description

Prerequisites

Corequisites

Sections

Professors

Meeting Times

Locations

Degree Requirements

Related Courses
```

Where available: enrollment status, seat availability, waitlist.

**Clearly timestamp rapidly changing registration data.** A seat count is true for minutes.

# 214. Section comparison

| Section | Professor | Time | Seats | Location |
|---|---|---|---|---|
| 01 | Smith | MWF 10 | 4 | Wilson |
| 02 | Jones | TR 1:10 | 12 | Calhoun |
| 03 | Lee | MWF 2 | Waitlist | Wilson |

**Do not display seat counts as current unless the data source is current.**

# 215. Visual schedule builder

Allow students to add candidate classes to a weekly schedule:

```
MONDAY

9:00 ECON
10:00 FREE
11:00 PSCI
12:00 FREE
1:00 STAT
```

Support drag, remove and replace. Show conflicts immediately.

# 216. Multiple registration plans

```
PLAN A

PLAN B

PLAN C
```

Plan A uses the preferred professor; Plan B handles a closed section; Plan C avoids Friday classes. **Allow rapid switching during registration** — the whole value is that it is usable in the ninety seconds when a section closes.

# 217. Course conflict detection

Detect time conflicts, exam conflicts where known, duplicate courses, prerequisite problems, credit overload, course restrictions and potential degree-requirement conflicts.

**Distinguish a confirmed conflict from a possible issue.** Two classes at the same hour is arithmetic; a prerequisite the app inferred from a text field is not.

# 218. Prerequisite engine

Represent prerequisite logic structurally:

```
ECON 301 requires:

ECON 101
AND
(MATH 120 OR MATH 130)
```

**Do not store prerequisite rules only as plain text if structured data is available.** A string cannot be evaluated against a transcript, and the parenthesis above is the whole difficulty.

# 219. Course eligibility

Based on authorized academic history:

```
ELIGIBLE

LIKELY ELIGIBLE

MISSING PREREQUISITE

REQUIRES PERMISSION

UNKNOWN
```

**Do not guarantee institutional registration eligibility unless confirmed by the university system.** `UNKNOWN` is a real answer and must stay available; a five-state scale that never returns it has collapsed into a guess.

# 220. Waitlist support

Where registration integration exists, show waitlist status, position where provided, deadline and alternative sections. If direct waitlist action is unavailable, **route to the official registration system**.

# 221. Course registration action

If official APIs or institutional partnerships eventually permit registration, Semester may support:

```
REGISTER
DROP
SWAP
WAITLIST
```

**These are consequential academic actions. Require explicit confirmation.**

```
Confirm registration

ECON 3010-02
Tuesday / Thursday
1:10–2:25 PM

[ Cancel ]
[ Confirm Registration ]
```

**Return the actual institutional result. Never simulate registration success.** A screen that says "Registered" when nothing reached the registrar is the single worst thing this application could do to a student, and it is the failure the gateway in `UNIVERSITY_CONNECTIONS.md` was built to make impossible.

# 222. Degree tracker

```
ECONOMICS MAJOR

Progress
██████████████░░░░ 72%

Completed      24 credits
In Progress     6 credits
Remaining       9 credits
```

Degree progress must be based on verified degree requirements and authorized academic records, or on user-entered data clearly marked as such.

# 223. Degree requirement tree

```
ECONOMICS MAJOR

CORE
✓ ECON 101
✓ ECON 102
✓ Statistics
○ Intermediate Micro
○ Intermediate Macro

ELECTIVES
✓ 2 / 4 complete

CAPSTONE
○ Required

TOTAL
27 / 36 credits
```

# 224. General education tracker

Track university-wide requirements separately:

```
GENERAL EDUCATION

✓ Writing
✓ Quantitative Reasoning
✓ Humanities
○ Natural Science
○ Diversity Requirement
```

Use institution-specific rules.

# 225. Major + minor + second major

The degree planner must support combinations:

```
Economics Major
Political Science Major
Business Minor
General Education
```

A course may satisfy multiple displayed categories while respecting institutional double-counting rules. **Do not assume every institution permits double-counting.**

# 226. Degree audit rule engine

A rule engine capable of expressing: required course, choose N from a list, minimum credits, minimum level, minimum grade, residency requirement, GPA requirement, double-count restriction, department requirement, elective requirement.

**Do not hardcode degree logic inside UI components.**

# 227. "What if?" degree planner

- *What if I switch from Economics to HOD?*
- *What if I add a Political Science minor?*

```
CURRENT PLAN
Expected remaining requirements: 11

WITH POLITICAL SCIENCE MINOR
Expected remaining requirements: 16
```

**Clearly label these as planning estimates. Official advisors and institutional audits remain authoritative.**

# 228. Four-year plan

```
FALL 2026
ECON 301
PSCI 240
STAT 210
FILM 1100

SPRING 2027
ECON 302
...

FALL 2027
...

SPRING 2028
...
```

Allow drag-and-drop between semesters.

# 229. Degree plan validation

As students move courses, detect prerequisite ordering, credit load, missing requirements, course-availability uncertainty and potential graduation delay:

> ECON 401 requires ECON 301, so this sequence may not work.

"May not work" is the right strength for a rule read out of a catalog, and it should not be strengthened without institutional confirmation.

# 230. Graduation progress

```
DEGREE PROGRESS

Credits
72 / 120

Major
68%

General Education
82%

Minor
45%

Expected graduation
Spring 2029
```

**Expected graduation must be labeled as an estimate unless institutionally confirmed.**

# 231. Academic record

Allow authorized academic history: courses taken, credits, grades, terms, transfer credits, AP/IB credits where provided, in-progress courses.

**Clearly indicate source:**

```
Official institutional record
Imported
Student entered
```

# 232. Transfer credit

```
TRANSFER CREDIT

ECON 101
Tulane University
3 credits
Accepted as ECON 101

MATH 121
Pending evaluation
```

**Never claim transfer equivalency unless official data confirms it.** "Pending evaluation" is a state the screen must be able to hold for months without resolving it into a guess.

# 233. AP / IB credit

```
IB Economics HL
Score: 6

Institutional credit:
ECON 101
3 credits
```

**Only show official equivalency when supported by authoritative institutional rules.**

# 234. GPA tracker

Calculate GPA from available academic data, keeping three things apart:

```
OFFICIAL / IMPORTED GPA

SEMESTER CALCULATED GPA

WHAT-IF GPA
```

**Do not present a calculated estimate as an official university GPA.** They differ by rounding, by repeated-course policy and by what the institution counts — and the number gets typed into applications.

# 235. GPA scenarios

> What if I earn A-, B+, A, A?

Calculate the mathematical outcome. **Do not predict the grades.**

# 236. Advising hub

Create **Semester Advising**, holding: advisor, appointment information, degree progress, academic plan, questions, advising notes, registration plan, important deadlines.

# 237. Advising appointments

Allow students to view their advisor, see office and contact details, request or book through the official system where integrated, add the appointment to their calendar, and prepare questions.

# 238. Advising prep

> **This item arrived truncated.** The source text for the master specification
> ends mid-example at `ADVISOR ME`, so the requirement is recorded here as a
> heading and nothing else rather than being completed by guesswork. What a
> student should have in front of them before an advising meeting is exactly
> the kind of thing that must not be invented: the wrong checklist sends
> somebody into a fifteen-minute appointment having prepared for the wrong
> conversation.
>
> Item 237 above already covers *preparing questions*. The rest of 238 is
> outstanding and should be supplied before it is built.

---

# What already exists, measured

Read against the app on `main`. The same discipline as the table in `WORKSPACE_REQUIREMENTS.md`: every path resolved against the tree rather than remembered, because a plausible path that does not exist gets believed.

| Item | Already in the app | Where |
|---|---|---|
| 184–186 Integration layer, connectors | A typed adapter contract over 37 service areas, a gateway enforcing capability checks, current-version checks and explicit confirmation, an encrypted journal, and a sandbox deliberately outside the approved registry | `packages/institution/src/index.ts`, `app/server/institution/`, `screens/University.tsx`, and [`UNIVERSITY_CONNECTIONS.md`](UNIVERSITY_CONNECTIONS.md) |
| 187–191 Calendar | The calendar and its sources, day/week/month grids, and clash detection across deadlines, commitments and athletics | `screens/Calendar.tsx`, `lib/calsource.ts`, `lib/monthgrid.ts`, `lib/clash.ts` |
| 192–193 Availability, find a time | Work windows, free hours per day, and meeting/pairing arrangement | `lib/windows.ts`, `lib/rest.ts`, `lib/meet.ts` |
| 194 Calendar import | An iCalendar reader and feed subscription | `lib/ics.ts`, `lib/feed.ts`, `lib/subscribe.ts` |
| 196–197 University dates, registration | The registrar's own dates, with countdowns — the dates the university sets rather than a syllabus | `lib/registrar.ts`, `screens/Registrar.tsx` |
| 198–206 Mail | The mailbox, rules, drafting for nine purposes, and reading a date change out of an announcement | `screens/Mail.tsx`, `lib/mailbox.ts`, `lib/mailrules.ts`, `lib/mail.ts`, `lib/announce.ts` |
| 207–208 Directory | A campus directory and the links a school publishes | `lib/campusdirectory.ts`, `lib/schoollinks.ts`, `screens/Links.tsx`, `screens/Directory.tsx` |
| 211–217 Registration | A course-catalog import (JSON or CSV) carrying sections, seats, credits, prerequisites and meeting times, with time-conflict detection | `lib/registration.ts` |
| 218 Prerequisites | **Structured server-side** as a flat must-have-passed list, and checked before enrolment; **text-only client-side** in the imported catalog | `needs` on `Section` in `app/server/institution/sandbox.ts`, `passed` in `app/server/institution/registration.ts`; `prerequisites` in `lib/registration.ts` |
| 219–221 Eligibility, waitlist, registration actions | A sandbox registration adapter with account holds, prerequisite checks, live seat counts, waitlist position, a closed add/drop date, and enrolment as a reviewed and confirmed action through the gateway | `app/server/institution/registration.ts` |
| 236–237 Advising | A sandbox advising adapter with bookable slots, a cancellation window and booking records | `app/server/institution/advising.ts` |
| 222–226 Degree tracker | Requirements, progress, rollups, double-counting made visible, spare courses, and the hours split between done and in-progress | `lib/degree.ts`, `screens/Degree.tsx` |
| 227, 235 What-if | Grade scenarios and a GPA planner over the transcript the app holds | `lib/whatif.ts`, `lib/gpasheet.ts` |
| 228 Multi-term plan | The stages of a degree that are longer than a term | `lib/pathway.ts`, `screens/Pathway.tsx` |
| 231, 233–234 Record, GPA | Courses taken with term, hours, grade and in-progress; a GPA over a scale the student enters, because plus and minus values differ by institution | `Taken` and `gpa` in `lib/degree.ts` |

What is **not** built, and is the substance of this document:

- **The five-warranty distinction (184) as a data model.** `UNIVERSITY_CONNECTIONS.md` draws the line for *connected* records, and it is the strongest thing in the repository. What is missing is the same line through everything else: a term date, a GPA and a prerequisite each need to say which of the five they are, and today most of them are simply values.
- **The prerequisite engine's second half (218).** Structure exists, and it is a flat AND-list: `needs: string[]` on a section, every code of which must have been passed. That evaluates `ECON 101 AND MATH 120`. It cannot express the parenthesis in `(MATH 120 OR MATH 130)`, nor a minimum grade, a corequisite or a "permission of instructor" — and the client-side catalog import carries prerequisites as free text with no structure at all, so nothing in the student-facing app can evaluate them.
- **The degree audit rule engine (226).** `lib/degree.ts` expresses "N courses or N hours from this list of codes" and no more. Minimum grade, minimum level, residency, GPA thresholds and double-count restrictions are not representable.
- **Section comparison, the visual schedule builder and multiple plans (214–216).** The catalog import exists; nothing builds a schedule out of it.
- **Email → calendar, task and event (201–203)** as offers. `lib/announce.ts` reads a date change out of a pasted announcement, which is the hardest part of it, but it is not wired to a connected inbox.
- **The "I need to…" navigator (209) and the form directory (210).** Neither exists, and **209 needs no institutional access at all** — see the sequencing note.
- **Registration against a real institution (219–221).** The loop itself is *built* — hold checks, prerequisite checks, seats, waitlist position, review, confirmation, receipt — against the sandbox, which is deliberately outside the approved adapter registry. What does not exist is an approved adapter for any real university, and `UNIVERSITY_CONNECTIONS.md` is explicit that the registry being empty is the design rather than an omission. So 221's prohibition is already honoured by construction: there is nothing to simulate success *with*.

## Sequencing note

Two items are worth doing before the rest, for opposite reasons.

**Item 209 first, because it is free.** The "I need to…" navigator needs no API, no credential and no partnership — it is a catalog of processes and the official links to them, and it solves a problem every first-year student has. Item 210 is the same work and ships with it. Nothing else in this document has that ratio.

**Item 218 next, because four items depend on it.** Course eligibility (219), conflict detection (217), plan validation (229) and the audit engine (226) are all evaluations against prerequisite logic. The sandbox proves the shape works and proves its limit in the same file: a flat AND-list cannot say `(MATH 120 OR MATH 130)`, and the client-side catalog has no structure at all. Widening that representation — alternation, minimum grade, corequisite, permission — is the unlock for all four.

And one that is not a sequencing decision at all: **the five-warranty distinction in 184 belongs in the data model before the first new university surface ships**, for the same reason items 133 and 136 came first in `WORKSPACE_REQUIREMENTS.md`. A label added afterwards is a label somebody's screen forgets to draw, and the thing it failed to say was which of these numbers the registrar had actually confirmed.
