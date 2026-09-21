# Semester — Master Product Transformation & Implementation Command

The product specification, as supplied. Everything below this header is the
author's text; the commentary is confined to this section, so that a reader can
tell a requirement from a note about one.

## What is here, and what is not

Two blocks of the specification have been supplied to this repository. They are
reproduced in full below:

| | sections | subject |
| --- | --- | --- |
| Part A | **46–63** | the MVP definition, and the execution instruction |
| Part B | **86–128** | the Academic OS expansion |

**Sections 1–45 and 64–85 have never been supplied.** Each block arrived with a
header addressed to a document that was expected to already exist here:

> \[KEEP ALL EXISTING SECTIONS 1–45 ABOVE EXACTLY AS CURRENTLY WRITTEN.]

> \[CONTINUE FROM THE EXISTING MASTER SPECIFICATION. DO NOT REMOVE OR WEAKEN
> PREVIOUS REQUIREMENTS.]

Nothing in this repository contains those sections. `IMPLEMENTATION-PLAN.md`,
`SPEC-AUDIT.md`, `COMPLETION-PLAN.md` and `ACTION-PLAN.md` are audits of the
product as it stands rather than a numbered specification, and none of them is
the document those headers refer to. So this file is the specification's home
from §46 onward, and it says so rather than renumbering to hide the gap: a
document claiming to be complete at §1 would make the missing eighty-three
sections unfindable, and the two headers above are the only evidence that they
exist at all.

Where §64–85 would have sat — between the MVP definition and the Academic OS —
there is a marker saying so.

## How it has been transcribed

The text is the author's, unedited. Two mechanical changes were made so that it
can be read and linked:

- A numbered section line (`46. MVP DEFINITION`) is set as a markdown heading.
  Only lines whose number continues the expected sequence were treated this way,
  so the numbered steps *inside* §61 and §63 are left as the lists they are.
- **Part B was pasted twice.** The two copies are identical except that the
  second stops mid-§128; the complete copy is kept and the truncated one
  dropped. No requirement differs between them.

## Where the requirements are answered

This file states what is wanted. It deliberately records no opinion about what
exists:

- [`SEMESTER_IMPLEMENTATION_STATUS.md`](SEMESTER_IMPLEMENTATION_STATUS.md) —
  every section above, measured against the repository, with the file that
  settles it.
- [`SEMESTER_IMPLEMENTATION_PLAN.md`](SEMESTER_IMPLEMENTATION_PLAN.md) — what to
  build, in dependency order, and what is blocked on someone other than the
  program.

---

# Part A — MVP definition (§46–63)

## 46. MVP DEFINITION
The first serious Semester release does NOT require every feature in this document.
The first production-quality MVP should contain the minimum set of features required to prove that Semester can become a real campus operating system rather than a collection of prototype screens.
The MVP must focus on:
Identity + Discovery + Relationships + Communication + Campus Activity + Daily Utility
The MVP should be strong enough that real students at one university could create accounts, discover relevant people and campus resources, connect with others, participate in campus activity, and have a reason to return regularly.
MVP CORE PRINCIPLE
The MVP is NOT:

* A static directory
* A design prototype
* A fake social network
* A collection of disconnected dashboards
* A chatbot wrapped around mock data
* A marketplace with fake checkout
* A university information site

The MVP must be a genuinely functional application with persistent data and real user actions.
The target user experience should be:

```text
Create account
      ↓
Verify identity
      ↓
Complete profile
      ↓
Discover campus
      ↓
Find people / courses / organizations / events
      ↓
Connect / follow / join / RSVP
      ↓
Message people
      ↓
Receive notifications
      ↓
Return to Semester
```

This loop is the foundation of the product.
## 47. MVP REQUIRED FEATURES
The following functionality is REQUIRED for the first production-quality MVP.
47.1 AUTHENTICATION
Required:

* Sign up
* Login
* Logout
* Email verification
* Password reset
* Persistent sessions
* Protected routes
* Account settings
* Account deletion architecture

Authentication must be real.
No mock login.
No hardcoded current user.
47.2 UNIVERSITY IDENTITY
Every user must belong to a university context.
Required:

* University selection
* University record
* User ↔ University relationship
* Campus-specific content
* Architecture supporting multiple universities

For initial launch, Semester may primarily contain one fully populated university.
However, the system must not be hardcoded so that adding another university requires rebuilding major features.
47.3 STUDENT ONBOARDING
After registration, new users complete onboarding.
Required fields should include:

* Name
* University
* Student/faculty status
* Graduation year where relevant
* Major
* Interests

Optional:

* Minor
* Career interests
* Bio
* Profile photo
* Organizations
* Courses
* Skills

Allow skipping nonessential questions.
Onboarding data must immediately improve the user's experience.
47.4 STUDENT PROFILES
Users must have real persistent profiles.
Required:

* Name
* Photo
* University
* Major
* Graduation year
* Bio
* Interests
* Courses
* Organizations
* Connections
* Basic privacy controls

Profiles should show shared context where permitted.
Example:

```text
Harrison Rubin

Vanderbilt University
Economics
Class of 2029

Shared with you:
• ECON 301
• Finance Club
• 3 mutual connections
```

Do not expose private information without consent.
47.5 DIRECTORY 2.0
Directory is one of the MVP's central experiences.
Required searchable entity types:

* Students
* Professors/faculty
* Courses
* Organizations
* Events
* Campus resources

Optional during initial MVP:

* Marketplace
* Housing
* Jobs
* Services

Required functionality:

* Search
* Category selection
* Filters
* Sorting where useful
* Pagination or infinite loading
* Entity cards
* Entity detail pages
* Loading states
* Empty states
* Error states

Search must query real stored data.
47.6 UNIVERSAL SEARCH
Provide a global search experience.
At MVP level, conventional structured search is sufficient.
Required:

* Search across multiple entity types
* Search suggestions
* Recent searches
* Grouped search results
* Relevant ranking

Examples:
"Economics"
"Finance Club"
"ECON 301"
"Career fair"
"John Smith"
Do NOT delay MVP waiting for advanced AI semantic search.
47.7 ACTIONABLE ENTITY PAGES
Entity pages cannot be static.
Required actions:
Students

* View profile
* Connect
* Remove connection
* Message
* Block
* Report

Organizations

* Follow
* Unfollow
* Request membership / apply where supported
* View events
* Message organization where supported

Events

* RSVP
* Cancel RSVP
* Save
* Share

Courses

* View information
* View participants where privacy permits
* Join course community where appropriate

Every action must persist.
47.8 SOCIAL GRAPH
The MVP needs basic network effects.
Required:

* Connection requests
* Accept connection
* Decline connection
* Remove connection
* Following
* Followers where applicable
* Mutual connections
* Shared courses
* Shared organizations
* Blocking
* Reporting

Users should see context that explains why another person may be relevant.
47.9 DIRECT MESSAGING
Messaging is REQUIRED for MVP.
Required:

* One-to-one conversations
* Conversation list
* Persistent messages
* Message timestamps
* Unread state
* Send/receive
* Block enforcement
* Basic reporting

Strongly preferred:

* Real-time message updates

Optional for MVP:

* Attachments
* Reactions
* Voice
* Video
* Advanced group chat

Do not overbuild messaging before core direct messaging is excellent.
47.10 ORGANIZATIONS
Organizations are essential to campus life.
MVP organization pages require:

* Name
* Description
* Category
* Branding/image
* Leadership information
* Membership/follow state
* Upcoming events
* Contact/message ability

Basic administrative functionality:

* Authorized organization admins can edit profile
* Create event
* View membership requests where applicable

Advanced dues, elections, attendance analytics, and document management can come later.
47.11 EVENTS
Events are a key retention mechanic.
Required:

* Browse events
* Search events
* Event detail page
* Date/time
* Location
* Organizer
* Description
* RSVP
* Cancel RSVP
* Save
* Share
* Attendee count where appropriate

Authorized users/organizations should be able to:

* Create event
* Edit event
* Cancel event

Upcoming events must appear in relevant Home and organization views.
47.12 HOME COMMAND CENTER
Home must provide a reason to open Semester.
Required modules:
TODAY

* Upcoming events
* Relevant course activity if available
* Important notifications

FOR YOU
At least one personalized module based on:

* Interests
* Major
* University
* Followed organizations
* Connections

CAMPUS

* Upcoming/trending events
* Relevant organizations

SOCIAL

* Connection requests
* Unread messages

QUICK ACTIONS

* Search
* Message
* Discover events
* Discover organizations

Do not show fake personalized modules.
If there is insufficient data, show useful onboarding/discovery prompts instead.
47.13 NOTIFICATIONS
Required notification types:

* Connection request
* Connection accepted
* New message
* Organization action
* Event RSVP/update
* Important system notification

Required:

* Read/unread
* Notification list
* Deep linking
* Clear all/read all
* Basic preferences

Push notifications can follow after web notification architecture is reliable.
47.14 BASIC CAMPUS DATA
MVP launch requires enough real content that the app does not feel empty.
For the initial university, populate:

* Core academic departments
* Representative courses
* Faculty/professors where legally/publicly available
* Student organizations
* Campus resources
* Buildings/locations where useful
* Events

Prefer authoritative/public data sources where available.
Do not fabricate profiles for real students.
## 48. MVP FEATURES THAT SHOULD WAIT
The following are valuable but should NOT delay the first real MVP unless they already exist and are nearly production-ready.
DEFER: MARKETPLACE PAYMENTS
Marketplace discovery/listings may be included if already mature.
Real-money payments should wait until:

* Authentication is mature
* Messaging works
* Trust/safety exists
* Transaction lifecycle exists
* Security review is complete

DEFER: FULL HOUSING PLATFORM
Basic housing directory/listings may be included.
Advanced:

* Roommate matching
* Lease workflows
* Sublease payments
* Housing verification

can come later.
DEFER: FULL CAREER PLATFORM
Basic career opportunities may be displayed.
Advanced:

* Application tracking
* Recruiter accounts
* Alumni matching
* Career recommendation models

can follow after core campus usage is proven.
DEFER: ADVANCED AI AGENT
A lightweight contextual assistant may exist in MVP.
However, advanced AI should not delay core functionality.
Do NOT build sophisticated agent actions before the underlying application actions exist.
The rule is:
First make the application capable of doing something reliably. Then allow AI to invoke it.
DEFER: ADVANCED RECOMMENDATION MODELS
Use simple deterministic rules initially.
Example:
Recommend organizations when:

```text
organization.interests intersects user.interests
OR
organization.majorAffinity matches user.major
OR
user.connections follow organization
```

Do not require ML infrastructure for MVP.
DEFER: UNIVERSITY ADMIN ANALYTICS
Institutional analytics are strategically valuable but not essential to validating student demand.
Build only the minimal administration needed to operate the platform safely.
DEFER: NATIVE MOBILE APPLICATIONS
The MVP should first be excellent on mobile web.
Do not split engineering effort across:
Web
iOS
Android
until the core product loop works.
A PWA may be considered if straightforward.
## 49. MVP PRODUCT LOOP
The most important metric is whether students repeatedly complete this loop:

```text
Student opens Semester
        ↓
Sees relevant campus activity
        ↓
Discovers something useful
        ↓
Takes an action
        ↓
Another person/organization responds
        ↓
Student receives notification
        ↓
Student returns
```

Examples:

```text
Discover club
→ Follow club
→ RSVP event
→ Event reminder
→ Attend event
→ Follow related students
```

or:

```text
Search course
→ Find classmate
→ Connect
→ Message
→ Create study group
→ Return before exam
```

or:

```text
Open Home
→ See event
→ RSVP
→ Friend also RSVPs
→ Message friend
→ Return later
```

Every MVP feature should strengthen one or more of these loops.
## 50. MVP LAUNCH SCOPE
For the first real launch, optimize Semester for:
One university done extremely well.
Do NOT attempt weak nationwide coverage.
The launch university should have:

* Accurate organization data
* Useful campus resources
* Real events
* Relevant course/faculty data
* Active users
* Reliable discovery
* Messaging
* Notifications
* Strong mobile usability

Architecture must remain multi-campus from day one.
Operational focus can remain single-campus initially.
## 51. MVP LAUNCH PERSONAS
Ensure the MVP works well for at least these personas.
NEW STUDENT
Needs to:

* Understand campus
* Find organizations
* Meet people
* Discover events
* Explore courses/resources

Semester should reduce the friction of entering university life.
ACTIVE STUDENT
Needs to:

* Track campus activity
* Communicate
* Find people
* Participate in organizations
* Discover opportunities

Semester should consolidate fragmented campus tools.
ORGANIZATION LEADER
Needs to:

* Maintain organization profile
* Recruit members
* Create events
* Communicate with students

Semester should make organization discovery and participation easier.
STUDENT LOOKING FOR CONNECTION
Needs to:

* Find classmates
* Find people with shared interests
* Discover study groups
* Message safely

Semester should provide context-aware social discovery.
## 52. MVP NAVIGATION
For MVP, keep primary navigation extremely clear.
Recommended structure:

```text
HOME

DISCOVER

INBOX

PROFILE
```

Semester AI may be a prominent action in the interface if it is useful and functional, but should not create navigation complexity prematurely.
Within DISCOVER:

```text
People
Courses
Organizations
Events
Campus
```

Optional:

```text
Marketplace
Jobs
Services
```

Do not expose dozens of top-level navigation items.
## 53. MVP DATA QUALITY STANDARD
Poor data will destroy trust even if the interface is excellent.
For MVP:

* Normalize organization names.
* Remove duplicates.
* Validate URLs.
* Validate campus locations.
* Use consistent categories.
* Ensure dates are correct.
* Avoid expired events appearing as upcoming.
* Avoid duplicate professors/courses.
* Handle missing images gracefully.
* Track data source where appropriate.

Build data import scripts that are repeatable.
Do not rely on manually editing hundreds of hardcoded frontend objects.
## 54. MVP ANALYTICS
Add privacy-conscious product analytics sufficient to understand product usage.
Track meaningful events such as:

* Account created
* Onboarding completed
* Search performed
* Search result opened
* Connection request sent
* Connection accepted
* Message sent
* Organization followed
* Event viewed
* Event RSVP
* Notification opened

Avoid collecting unnecessary sensitive data.
Create a clean analytics abstraction rather than scattering tracking calls across the codebase.
## 55. MVP SUCCESS METRICS
Do not evaluate MVP success based on number of screens.
Track whether people actually use the product.
Useful metrics include:
Activation
Percentage of new users who complete onboarding.
Percentage who perform at least one meaningful action.
Example meaningful actions:

* Connect with another student
* Follow organization
* RSVP to event
* Send message

Engagement

* Daily active users
* Weekly active users
* Sessions per active user
* Searches per user
* Messages sent
* Event RSVPs
* Organization follows

Retention

* Day 1 retention
* Day 7 retention
* Day 30 retention

Network health

* Connection requests accepted
* Messages receiving responses
* Organizations receiving followers
* Events receiving RSVPs

Discovery health

* Searches producing results
* Search result click-through
* Zero-result searches

Do not optimize vanity metrics such as total page views without context.
## 56. MVP TRUST STANDARD
Students should immediately understand what is real.
Clearly distinguish:

* Verified users
* Verified organizations
* Official university information
* User-generated information
* External links

Do not show fake verification.
Do not imply university endorsement unless it exists.
Do not imply an organization is official unless verified.
## 57. MVP PRIVACY STANDARD
Before launch, ensure users can understand and control:

* Who can see their profile
* Who can message them
* Who can see their courses
* Who can see organizations
* Who can see connections
* What activity is public

Use privacy-conscious defaults.
Never make potentially sensitive information public simply because it exists in the database.
## 58. MVP MODERATION STANDARD
At minimum support:

* Report user
* Report organization
* Report event
* Report message
* Block user
* Review reports through admin interface

Reports must persist and have statuses.
Example:

```text
OPEN
UNDER_REVIEW
RESOLVED
DISMISSED
```

Do not implement report buttons that disappear into nowhere.
## 59. MVP PERFORMANCE STANDARD
Set reasonable performance goals.
Prioritize:

* Fast initial page load
* Fast navigation
* Responsive search
* Optimized images
* Paginated datasets
* Minimal unnecessary API calls

Do not fetch thousands of campus records at startup.
Search/filter on the backend when datasets become large.
## 60. MVP RELEASE GATE
Do NOT consider the MVP production-ready until all critical conditions below are satisfied.
BUILD

* Production build succeeds.
* No critical runtime errors.
* No major console errors.

AUTH

* Signup works.
* Login works.
* Logout works.
* Sessions persist.
* Protected routes work.
* Password recovery works.

DATA

* User changes persist.
* Relationships persist.
* Messages persist.
* RSVPs persist.
* Organization follows persist.

DIRECTORY

* Search works.
* Filters work.
* Entity pages work.
* Invalid entity IDs are handled safely.

SOCIAL

* Connections work.
* Blocking works.
* Privacy rules work.

MESSAGING

* Messages can be sent.
* Messages can be received.
* Conversation history survives refresh.

EVENTS

* Events display correctly.
* RSVP works.
* Cancellation works.
* Organizer permissions work.

MOBILE
Critical flows work at:
375px
390px
430px
SECURITY

* No exposed production secrets.
* Authorization reviewed.
* Basic abuse paths reviewed.
* Input validation implemented.

TRUST

* Reporting works.
* Blocking works.
* Verification labels are truthful.

QA

* Critical E2E tests pass.
* Regression testing completed.
* No P0 bugs remain.
* No known P1 bugs block the core user journey.

## 61. MVP DEMO FLOW
Before declaring MVP complete, verify this exact end-to-end flow manually and with automated tests where practical.
USER A

1. Opens Semester.
2. Creates account.
3. Verifies email.
4. Completes onboarding.
5. Creates profile.
6. Searches for organization.
7. Follows organization.
8. Finds event.
9. RSVPs.
10. Searches for User B.
11. Sends connection request.

USER B

12. Logs in.
13. Receives notification.
14. Accepts connection.
15. Sends User A a message.

USER A

16. Receives message notification.
17. Opens Inbox.
18. Replies.
19. Refreshes browser.
20. Conversation remains intact.
21. Opens Home.
22. Sees upcoming event.
23. Opens event.
24. RSVP status remains intact.

If this workflow is unreliable, MVP is not complete.
## 62. MVP FINAL OBJECTIVE
The MVP should answer this question:
Would a real student have a reason to open Semester several times each week even if no developer were standing beside them demonstrating it?
If the answer is no, continue improving the core loop.
Do not mistake feature quantity for product-market readiness.
A successful Semester MVP should feel like:
"I can see what is happening at my university, find the people and organizations relevant to me, communicate with them, and act on campus opportunities from one place."
That is the product to prove first.
Everything else in this specification should build on top of that foundation.
## 63. EXECUTION INSTRUCTION
After reading this full specification:

1. Audit the current repository.
2. Create/update `SEMESTER_IMPLEMENTATION_PLAN.md`.
3. Create/update `SEMESTER_IMPLEMENTATION_STATUS.md`.
4. Identify the current phase.
5. Fix any P0 issues.
6. Begin the highest-priority incomplete phase.
7. Implement functionality rather than merely describing it.
8. Test each meaningful implementation batch.
9. Keep the application runnable.
10. Preserve functioning existing features.
11. Continue through dependencies in order.
12. Do not skip foundational work to build visually impressive later-stage features.
13. When blocked by missing credentials or third-party configuration, complete every part that can be implemented safely, document the exact blocker, and continue with other unblocked work.
14. Never replace a real integration requirement with fake success behavior.
15. Prefer a smaller number of deeply functional flows over a large number of superficial screens.

The immediate objective is:
Transform the current Semester prototype into a production-quality MVP centered on campus identity, discovery, social connection, communication, organizations, events, and daily student utility.
Then continue evolving it toward:

---

# §64–85 — not supplied

Nothing between the execution instruction and the Academic OS expansion has been
supplied to this repository. The gap is left open rather than closed up, so that
a requirement arriving later lands at its own number.

---

# Part B — Academic OS (§86–128)

## 86. ACADEMIC OS — MAJOR PRODUCT EXPANSION
Academics should become one of Semester's strongest product pillars.
Do NOT treat academics as simply:

* Course directory
* Calendar
* Assignment list
* GPA calculator
* AI chatbot

Build an interconnected Academic Operating System.
The desired loop is:

```
COURSES
   ↓
ASSIGNMENTS
   ↓
CALENDAR
   ↓
STUDY PLAN
   ↓
STUDY SESSION
   ↓
RESOURCES / PEOPLE / AI
   ↓
PROGRESS
   ↓
ADAPTIVE PLAN
```

Semester should help answer:
What do I need to do?
When should I do it?
What should I work on first?
Who can help me?
What resources do I have?
How prepared am I?
What is coming next?
## 87. ACADEMIC DASHBOARD
Create a dedicated Academic dashboard.
Recommended hierarchy:

```
ACADEMICS

TODAY
────────────────
10:00 ECON 301
1:10 PSCI 240
3:00 Study ECON exam

UP NEXT
────────────────
Problem Set 4      Tomorrow
Essay Draft        Thursday
ECON Midterm       Friday

THIS WEEK
────────────────
4 assignments
2 quizzes
1 exam
7 classes

COURSES
────────────────
ECON 301
PSCI 240
STAT 210
FILM 1100

STUDY
────────────────
3h 40m planned
2h 15m completed

ACADEMIC PROGRESS
────────────────
Semester workload
Study consistency
Upcoming pressure

QUICK ACTIONS
────────────────
+ Assignment
+ Study Session
+ Exam
+ Note
+ Study Group
Ask Semester
```

Everything displayed must connect to real data.
## 88. COURSE HUBS 2.0
Every enrolled course should become a full workspace.
Example:

```
ECON 301
Intermediate Macroeconomics

Professor
Schedule
Location
Credits

OVERVIEW

ASSIGNMENTS

CALENDAR

MATERIALS

NOTES

STUDY

CLASSMATES

GROUPS

AI

PROGRESS
```

Course pages should aggregate relevant information rather than forcing students to navigate many unrelated sections.
## 89. COURSE OVERVIEW
Course overview should immediately answer:

* What is happening next?
* What is due?
* What should I study?
* Where is class?
* What materials matter?
* Who is in this course?

Include:
Next class
Next deadline
Next exam
Current study plan
Recent materials
Study groups
Course announcements
Professor/TA information
Recent notes
## 90. SYLLABUS IMPORTER
Build syllabus ingestion.
Allow students to:

* Upload PDF
* Upload DOCX where supported
* Paste syllabus text
* Manually enter syllabus

Extract candidate:

* Course name
* Professor
* Office hours
* Class schedule
* Assignments
* Exams
* Quizzes
* Readings
* Projects
* Deadlines
* Grading weights
* Policies

CRITICAL:
Never silently trust AI extraction.
Show:

```
We found:

✓ Midterm — October 14
✓ Final Paper — December 3
✓ Quiz — September 29

Review before importing.
```

User confirms before academic records/calendar are changed.
## 91. ASSIGNMENT SYSTEM
Build a real assignment manager.
Assignment fields:

* Course
* Name
* Description
* Due date
* Due time
* Type
* Priority
* Estimated effort
* Status
* Grade weight
* Links
* Attachments
* Notes
* Subtasks

Types:

```
HOMEWORK
READING
ESSAY
PROJECT
QUIZ
EXAM
PRESENTATION
LAB
DISCUSSION
OTHER
```

Statuses:

```
NOT_STARTED
PLANNED
IN_PROGRESS
READY_TO_SUBMIT
SUBMITTED
GRADED
MISSED
```

## 92. ASSIGNMENT SUBTASKS
Large assignments should be decomposable.
Example:

```
Research Paper
Due Oct 18

✓ Choose topic
✓ Find sources
○ Read sources
○ Create outline
○ Draft introduction
○ Draft body
○ Edit
○ Proofread
○ Submit
```

Users can create subtasks manually.
Semester AI may suggest subtasks, but the user should approve them.
## 93. SMART ACADEMIC PRIORITY ENGINE
Create a priority system.
Do NOT simply sort by due date.
Consider:

* Due date
* Estimated effort
* User-set priority
* Assignment weight
* Completion percentage
* Existing study schedule
* Exam proximity
* Dependencies

Example:

```
HIGH PRIORITY

ECON Midterm
3 days away
30% of course grade
4h study remaining

MEDIUM

Film Response
Tomorrow
Estimated 25 min

LOW

Reading Chapter 8
4 days away
Estimated 35 min
```

Avoid pretending Semester can mathematically determine a student's academic outcome.
Priority recommendations should remain explainable.
## 94. ACADEMIC CALENDAR
Build a unified academic calendar.
Display:

* Classes
* Assignments
* Exams
* Quizzes
* Office hours
* Study sessions
* Study groups
* Academic events
* Personal events where integrated

Views:

```
DAY
WEEK
MONTH
SEMESTER
AGENDA
```

Allow filters by:
Course
Event type
Priority
## 95. SEMESTER TIMELINE
Add a semester-wide timeline.
Students should visually understand workload across the term.
Example:

```
SEPTEMBER
██████░░

OCTOBER
██████████████
      ↑
   Midterms

NOVEMBER
█████████

DECEMBER
████████████████
       ↑
     Finals
```

Show:

* Exams
* Major assignments
* Projects
* Breaks
* Finals
* Heavy workload periods

This helps students plan weeks ahead.
## 96. WORKLOAD HEATMAP
Create an academic workload visualization.
Example:

```
MON   ██
TUE   █████
WED   ███
THU   ████████
FRI   ██
SAT   █
SUN   ████
```

Calculate from:

* Assignments
* Exams
* Estimated effort
* Study sessions
* Classes

Use this to identify overloaded days.
Allow the student to redistribute flexible study sessions.
## 97. SMART STUDY PLANNER
Build one of Semester's flagship academic features.
Example:
Student has:

```
ECON Midterm
Friday
Estimated preparation: 6 hours
```

Semester knows available study windows.
Generate:

```
MONDAY
4:00–5:00
Review Chapters 1–3

TUESDAY
7:00–8:30
Practice Problems

WEDNESDAY
3:00–4:30
Review Weak Topics

THURSDAY
6:00–7:30
Practice Exam

FRIDAY
9:00–9:30
Final Review
```

Student must be able to:
Accept
Modify
Regenerate
Move session
Skip
Complete
## 98. AUTOMATIC STUDY REBALANCING
When plans change, Semester should adapt.
Example:
Student misses Tuesday study session.
Instead of merely marking it missed:
You missed 60 minutes of ECON study. Want me to redistribute it across Wednesday and Thursday?
Possible result:

```
Wednesday +30 min
Thursday +30 min
```

Never modify the student's calendar invisibly.
Show changes and allow approval.
## 99. STUDY SESSION SYSTEM
Create dedicated study sessions.
Fields:

* Course
* Topic
* Start time
* Duration
* Location
* Goal
* Study method
* Completed
* Notes

At session start:

```
ECON 301

Today's goal:
Complete Practice Problems 1–15

60 minutes

[ START STUDY SESSION ]
```

## 100. FOCUS MODE
Create Focus Mode.
During a study session display only essential information.

```
ECON 301

Practice Problems
Chapter 5

42:18 remaining

[ Pause ]

Session goal:
Complete questions 1–15
```

Optional:

* Pomodoro
* Stopwatch
* Session notes
* Task checklist

Do not overload Focus Mode with social content.
## 101. STUDY TIMER
Support:
STANDARD TIMER
User chooses duration.
POMODORO
Examples:
25 / 5
50 / 10
Custom
OPEN STUDY
Timer counts upward.
Record completed study duration only when the user chooses to track it.
Allow corrections.
## 102. STUDY HISTORY
Create useful academic history.
Example:

```
THIS WEEK

ECON 301        4h 20m
Statistics      2h 45m
Political Sci   1h 50m
Film            55m

TOTAL           9h 50m
```

Views:
Week
Month
Semester
Course
Do not gamify studying so aggressively that time spent becomes more important than actual learning.
## 103. STUDY GOALS
Allow students to create goals.
Examples:

```
Study Economics 5 hours this week

Complete Statistics practice set by Wednesday

Review flashcards 4 times before exam
```

Goals should integrate with planner and progress.
## 104. EXAM CENTER
Create a dedicated Exam Center.
Show:

```
UPCOMING EXAMS

ECON 301 MIDTERM
Friday • 10:00 AM
3 days
Study: 4h / 6h planned

STAT 210 QUIZ
Monday
6 days
Study: 1h / 2h planned
```

Each exam gets a workspace.
## 105. EXAM WORKSPACE
Include:

* Exam date/time
* Location
* Topics
* Materials
* Study plan
* Notes
* Flashcards
* Practice questions
* Study groups
* Progress
* AI tutor

Allow users to mark topics:

```
CONFIDENT
REVIEW
WEAK
NOT_STARTED
```

Use these signals to prioritize review.
## 106. TOPIC MASTERY
Allow students to track topic confidence.
Example:

```
ECON MIDTERM

GDP Accounting       █████   Confident
IS-LM                 ███░░   Review
Inflation             ██░░░   Weak
Monetary Policy       █░░░░   Not ready
```

This is self-reported or practice-derived confidence, not a definitive measurement of mastery.
Label it accordingly.
## 107. FLASHCARD SYSTEM
Build native flashcards.
Students can:

* Create deck
* Add card
* Import cards
* Generate draft cards from authorized notes
* Review cards
* Mark difficulty
* Organize by course/topic

Support:
Front → Back
Term → Definition
Question → Answer
Image-based cards where practical
Cloze-style cards later.
## 108. SPACED REPETITION
Implement a simple spaced-repetition scheduler.
Do not invent unnecessarily complicated algorithms initially.
Track:

* Last reviewed
* Difficulty
* Correct/incorrect
* Next review

Show:

```
DUE TODAY

34 ECON cards
18 Statistics cards
7 Political Science cards
```

## 109. PRACTICE QUESTION GENERATOR
Semester AI can generate practice questions from student-authorized materials.
Support:

* Multiple choice
* Short answer
* Conceptual
* Calculation
* Essay prompts

Allow:
Easy
Medium
Hard
Mixed
Important:
Clearly identify AI-generated practice content.
Do not imply questions are official professor/exam questions.
## 110. PRACTICE EXAMS
Allow students to create practice exams from:

* Notes
* Study guides
* Uploaded materials
* Topic lists

Modes:

```
TIMED

UNTIMED

QUESTION-BY-QUESTION

REVIEW
```

After completion:
Show:

* Correct/incorrect
* Explanations
* Topics needing review

Do not generate grades that pretend to predict actual exam outcomes.
## 111. AI TUTOR MODE
Create course-aware tutoring.
AI should have access only to authorized course materials and relevant context.
Modes:

```
EXPLAIN

QUIZ ME

SOCRATIC

STEP-BY-STEP

PRACTICE

REVIEW
```

Example:
Explain IS-LM simply.
Then:
Give me an example.
Then:
Quiz me without showing the answer.
## 112. SOCRATIC MODE
Instead of immediately giving answers, optionally guide students.
Example:
What happens to interest rates when money supply increases?
Student responds.
AI provides feedback and asks the next question.
This should be optional.
Students can switch to direct explanation.
## 113. NOTES SYSTEM
Build course-connected notes.
Students should create notes linked to:

* Course
* Lecture
* Topic
* Assignment
* Exam

Support:

* Rich text
* Headings
* Lists
* Tables
* Links
* Images where supported
* Search
* Tags
* Pinning

Autosave.
## 114. LECTURE NOTE WORKFLOW
Create:

```
COURSE
   ↓
LECTURE
   ↓
NOTES
   ↓
SUMMARY
   ↓
FLASHCARDS
   ↓
PRACTICE QUESTIONS
```

Example:

```
ECON 301
Lecture — Monetary Policy
September 22

[Notes]

Generate:
• Summary
• Key concepts
• Flashcards
• Practice questions
```

Generated content must remain editable.
## 115. MATERIALS LIBRARY
Each course should have a materials library.
Categories:

* Syllabus
* Lecture slides
* Readings
* Study guides
* Worksheets
* Student notes
* Links

Support:

* Search
* Tags
* Course association
* Date
* File type

Respect copyright and access permissions.
Do not automatically expose private uploaded materials to classmates.
## 116. ACADEMIC SEARCH
Extend universal search to academic content.
Examples:
"inflation notes"
"ECON midterm"
"Chapter 5 reading"
"Professor office hours"
Search across authorized:

* Courses
* Assignments
* Notes
* Materials
* Study groups
* Professors
* Calendar

## 117. READING MANAGER
Create a reading workflow.
Reading assignment:

```
Political Science

Bueno de Mesquita — Chapter 4

Due Thursday

34 pages

Estimated reading time: 55 min
```

Allow:

* Start reading
* Mark progress
* Complete
* Notes
* Key concepts
* Study questions

Estimated reading time should be adjustable.
## 118. PROJECT MANAGEMENT
Large academic projects need more than one assignment entry.
Create project workspace.
Example:

```
FINAL RESEARCH PAPER

Due December 5

PROGRESS 45%

✓ Topic
✓ Research question
✓ Sources
○ Outline
○ Draft
○ Revision
○ Final proofread
○ Submission
```

Support milestones and dependencies.
## 119. GROUP PROJECTS
Create shared academic project spaces.
Support:

* Members
* Tasks
* Deadlines
* Files
* Discussion
* Meetings
* Activity

Example:

```
ECON PRESENTATION

Harrison — Data analysis
Alex — Slides
Maya — Research
Jordan — Presentation notes
```

Avoid duplicating full enterprise project-management software.
Keep it student-focused.
## 120. STUDY GROUPS 2.0
Expand study groups.
Students can search:
ECON 301 study groups
Filter:

* Today
* Tomorrow
* This week
* Location
* Online
* Open seats

Group card:

```
ECON 301 MIDTERM STUDY

Wednesday
7:00–9:00 PM

Central Library
4 / 6 students

Topics:
IS-LM
Inflation
Monetary policy

[ JOIN ]
```

## 121. SMART STUDY GROUP MATCHING
Recommend groups using:

* Same course
* Exam proximity
* Availability
* Group capacity
* User-selected study preferences

Never infer sensitive personal traits.
## 122. STUDY BUDDY
Allow students to indicate:
Looking for study partner
for specific courses.
Profiles can show, when opted in:

```
Looking for:
ECON 301 study partner

Usually available:
Tuesday / Thursday evenings
```

Students can request connection/message.
## 123. OFFICE HOURS
Integrate professor/TA office hours.
Course page:

```
OFFICE HOURS

Professor Smith
Tuesday
2:00–4:00 PM

Calhoun 302

[ Add to Calendar ]
```

Where booking is supported:
[ Request Appointment ]
Do not imply Semester controls faculty schedules unless there is a real integration.
## 124. PROFESSOR & TA DIRECTORY
Academic profiles should support publicly available information such as:

* Department
* Courses
* Office
* Office hours
* Official contact information
* Research interests
* University profile link

Do not scrape or expose private information.
## 125. ACADEMIC CALENDAR INTEGRATION
Design calendar adapters.
Potential integrations:

* Google Calendar
* Outlook
* University calendar
* LMS calendars

Semester should maintain its own internal academic calendar while optionally synchronizing external sources.
Avoid making external integrations mandatory for core functionality.
## 126. LMS INTEGRATION LAYER
Build adapters so Semester can eventually connect to:

* Canvas
* Brightspace
* Blackboard
* Moodle

Possible imports:

* Courses
* Assignments
* Deadlines
* Announcements
* Grades where authorized

Do not tightly couple core academic functionality to one LMS.
Architecture:

```
AcademicIntegrationProvider

├── CanvasProvider
├── BrightspaceProvider
├── BlackboardProvider
└── MoodleProvider
```

Normalize imported data into Semester's internal models.
## 127. IMPORT CONFLICT HANDLING
External integrations can create duplicates.
Example:
Student manually created:
ECON Essay — Oct 14
Then Canvas imports:
Essay #2 — Oct 14
Do not automatically create duplicates.
Build conflict detection based on:

* Course
* Date
* Similar title
* External ID

Allow:
Merge
Keep both
Replace
Ignore
## 128. ACADEMIC SOURCE OF TRUTH
Every imported academic item should track its source.
Example:

```
SOURCE

Canvas
Imported Sep 
```
