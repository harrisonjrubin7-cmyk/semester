# Semester — implementation status

Every requirement in [`SEMESTER-MASTER-COMMAND.md`](SEMESTER-MASTER-COMMAND.md),
measured against this repository, with the file that settles it. Step 1 of §63.

Measured at `origin/main` `387dcfb`, 21 September 2026.

## How to read a verdict

| | means |
| --- | --- |
| **Built** | the requirement is met, and the file named does it |
| **Partly** | some of it is met; the row says which part is not |
| **Absent** | nothing in the repository does this |
| **Conflict** | the repository does something else *on purpose*, and says so in writing |

**Conflict is the row that matters most, and it is not a synonym for Absent.**
Four requirements here are contradicted by decisions this codebase argues for
at length in its own comments and states to students on screen. A status
document that filed those as "not built yet" would be recording a schedule
slip where what exists is a disagreement, and the disagreement is the author's
to settle rather than a program's. Each one names the file and quotes it.

Counts, so that the shape is visible before the detail:

| | Part A (§46–63) | Part B (§86–128) |
| --- | --- | --- |
| Built | 4 | 24 |
| Partly | 14 | 13 |
| Absent | 3 | 6 |
| Conflict | 2 | 0 |
| Cannot run | 1 | — |

Part A is counted by the twenty-four rows below rather than by its eighteen
numbered sections, because §47 alone carries fourteen of the requirements and
collapsing them to one would hide thirteen. A third Part A conflict —
protected routes, §47.1 — is recorded inside a **Built** row, since the
authentication it conflicts with is built.

Part B is the built half. That is not an accident of effort: §86–128 describes
the thing this application has been for two hundred merges, and §46–63
describes a campus social network it has never been.

---

# Part A — MVP (§46–63)

## §47.1 Authentication — **Built**, with one conflict and one blocker

`lib/cloud.ts` carries real Supabase auth and no stand-in for it:

| requirement | where |
| --- | --- |
| Sign up | `signUp`, `cloud.ts:181` |
| Login | `signInWithPassword`, `cloud.ts:205` |
| Logout | `signOut`, `cloud.ts:351` |
| Email verification | Supabase confirm, plus `private.verified_student()` in the policies |
| Password reset | `resetPasswordForEmail`, `cloud.ts:344` |
| Persistent sessions | Supabase session, restored on load |
| Account settings | `screens/Account.tsx` |
| Account deletion | `deleteEverything`, `cloud.ts:814`, and `supabase/deletion.check.sql` — 21 checks |

§47.1's "No mock login. No hardcoded current user." is satisfied: there is no
fake user anywhere in the tree.

**Conflict — protected routes.** §47.1 lists them; this app has none, because
it is usable in full without an account. `lib/privacy.ts:185` says so to the
student:

> Everything in this app runs on your device. Signing in adds one thing: the
> same semester on your phone and your laptop. Signed out, nothing leaves the
> device at all — no courses, no grades, no notes, no analytics.

Gating the app behind an account is a product decision, not an implementation
task. See **The three conflicts** below.

**Blocked on the author — Google OAuth.** `signInWith` (`cloud.ts:318`) calls
`signInWithOAuth` and works; the Google provider is not enabled in the Supabase
dashboard. `SETUP.md:268` has the steps — Authentication → Providers, client id and
secret. The app asks the project which providers are on and draws a button only
for those, so nothing needs deploying once it is switched on. Nothing in this repository can do
it.

## §47.2 University identity — **Built**, as of `20260921170000_schools.sql`

Both halves, and the second one landed while this audit was being written.

**The client half** was already there and is genuinely not hardcoded.
`lib/school.ts` resolves a school from `state.schoolId`, `state.mySchools` and
`state.schoolPack`; `lib/classmates.ts` records that it used to hold
`DOMAIN = 'vanderbilt.edu'` and no longer does —

> Which domain is a fact about the school, not a constant. This file used to
> hold `DOMAIN = 'vanderbilt.edu'` and refuse everyone else outright, which is
> the one thing the ground rules for school support say never to do.

**The server half** is `public.schools` and `profiles.school_id`, the
thirty-third table:

| §47.2 requirement | where |
| --- | --- |
| University selection | `lib/school.ts`, and `schools_read` is `using (true)` so the picker can read the list before anybody signs in |
| University record | `public.schools` — slug id, name, short name, `email_domains[]` |
| User ↔ University relationship | `profiles.school_id`, `references public.schools on delete set null` |
| Multi-university architecture | no school is seeded, deliberately |

It is stronger than §47.2 asks, and the strength is the point: the column is
pinned against a direct write — `revoke update (school_id) on public.profiles
from anon, authenticated` — and the only way in is `claim_school()`, which
checks the address the *server* confirmed against that school's published
domains. A student cannot declare themselves into a university. `private.school_of()`
and `private.same_school(uuid)` then let a row-level policy ask the question,
null-safe on both sides so two students who have claimed nothing are not
thereby classmates.

The migration says why nothing is seeded:

> Seeding Vanderbilt would put one university's name in the schema every other
> university has to live in, which is the thing the multi-campus rule exists to
> stop.

So the table is empty until an admin writes a row, which is §47.14's work and
not an implementation gap.

## §47.3 Student onboarding — **Partly**

`screens/Onboarding.tsx` and `screens/FirstRun.tsx` exist and collect a name
and a school. Major, graduation year, student/faculty status and interests are
not collected there; `state.aboutMe` (`Fact[]`) and `state.myName` are the
nearest stores. Nothing is written to `public.profiles`.

## §47.4 Student profiles — **Partly**, and the gap is the schema

`public.profiles` is four columns:

```sql
create table if not exists public.profiles (
  user_id     uuid        primary key references auth.users on delete cascade,
  handle      text        not null check (length(trim(handle)) between 2 and 40),
  about       text        not null default '' check (length(about) <= 140),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

plus `school_id`, added by `20260921170000_schools.sql`.

Against §47.4's required list that supplies three of eleven — a handle, a
140-character bio, and now the university:

| §47.4 field | column |
| --- | --- |
| University | `school_id` ✓, and verified rather than declared |
| Bio | `about`, capped at 140 |
| Name, photo, major, graduation year, interests | **absent** |
| Courses, organizations, connections | **absent**, and each waits on §47.8 or §47.10 |
| Basic privacy controls | **absent** |

`screens/Profile.tsx` is a device-local profile and does not read this table.

## §47.5 Directory 2.0 — **Partly**

`screens/Directory.tsx` and `lib/campusdirectory.ts` exist. By required entity
type:

| entity | state |
| --- | --- |
| Students | course rooms only — `public.messages`, `lib/classmates.ts` |
| Professors/faculty | `Course.prof` and `Course.email`, per course; no directory record |
| Courses | **Built** |
| Organizations | **Absent** — see §47.10 |
| Events | **Absent** — see §47.11 |
| Campus resources | `lib/university.templates.ts`, partial |

## §47.6 Universal search — **Partly**

`screens/Search.tsx` searches the fifty-nine destinations (`lib/nav.ts`), the
guidebook and the student's own data. It does not search stored campus
entities, because §47.5's missing three are what there would be to search.

## §47.7 Actionable entity pages — **Partly**

Students: block **Built** (`public.blocks`, enforced by row-level policy so a
blocked person's words never reach the device), report **Built but unread** (see
§58), message **Partly** (course rooms, not one-to-one), connect **Absent**.
Organizations and Events: absent entirely. Courses: **Built**.

## §47.8 Social graph — **Partly**

| | |
| --- | --- |
| Blocking | **Built** — `public.blocks`, RLS-enforced |
| Reporting | **Built**, stored — §58 |
| Shared courses | **Built** — the room *is* the shared course |
| Connection requests, accept, decline, remove | **Absent** — no table |
| Following, followers, mutual connections | **Absent** — no table |
| Shared organizations | **Absent** — no organizations |

## §47.9 Direct messaging — **Absent** as specified

`public.messages` exists and is not a conversation:

```sql
create table if not exists public.messages (
  id          uuid        primary key default gen_random_uuid(),
  term        text        not null,
  code        text        not null,
  user_id     uuid        not null references auth.users on delete cascade,
  body        text        not null check (length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
```

The key is `(term, code)` — a course room, posted into by everyone who says
they are in that class. **There is no recipient column**, so §47.9's
one-to-one conversation has nowhere to put the other person. Conversation list,
unread state and block enforcement for a DM all follow from a model that does
not exist yet. Timestamps and persistence are there; `public.message_reactions`
exists, which §47.9 lists as optional.

## §47.10 Organizations — **Conflict**

Absent, and deliberately. `lib/activities.ts` refuses the data source and gives
its reasons:

> It does not read AnchorLink. AnchorLink is behind single sign-on, and no
> browser will let this app read a page it does not own — correctly. There is
> no list of Vanderbilt organisations compiled into this file either, and there
> will not be: there are several hundred, they change every year, and a list of
> invented or stale ones would be worse than no list, because somebody would
> email a president who graduated in 2021.

What exists instead is the private half: `state.commitments` records what *you*
are in, with the hours it costs, on the same grids as your classes. That is
§47.10 inverted — a personal record rather than a public page.

§53's "Do not rely on manually editing hundreds of hardcoded frontend objects"
and §47.14's "Do not fabricate profiles for real students" both point the same
way as this comment does. The requirement and the refusal are compatible only
if there is a real, repeatable source of organization data, and naming that
source is the decision to be made.

## §47.11 Events — **Absent** as a shared entity

No `events` table. Built instead: personal commitments with times
(`lib/activities.ts`), external calendar feeds (`public.calendar_feeds`,
`lib/calsource.ts`, any `.ics`), and term dates (`screens/Registrar.tsx`).
Browse, RSVP, attendee count and organizer all require the table.

## §47.12 Home command center — **Partly**

`screens/Today.tsx` is four tabs — Today, Week, Hours, Done. TODAY is **Built**.
FOR YOU is **Partly**: the personalisation is academic (`lib/worth.ts`,
`lib/revise.ts`) rather than interest- or organization-based. CAMPUS and SOCIAL
are **Absent**, following from §47.10, §47.11 and §47.8.

§47.12's "Do not show fake personalized modules" is already this repository's
own standard — `lib/review.ts` exists precisely because mastery used to be
asserted rather than measured.

## §47.13 Notifications — **Partly**

Built: `lib/notify.ts`, `lib/push.ts`, `public.push_devices`, `public.push_queue`,
and the `notifs` destination with preferences and quiet hours (`state.quiet`).
The types are academic — a deadline, a study plan, an office-hours nudge. None
of §47.13's six required types (connection request, connection accepted, new
message, organization action, event RSVP, system) can fire, because five of the
six have no underlying entity.

## §47.14 Basic campus data — **Partly**

Built: `lib/university.templates.ts`, `lib/campusdirectory.ts`, seeded courses,
buildings and walking times (`screens/Maps.tsx`, `lib/geocode`). Absent: student
organizations and events, per §47.10.

## §48–52 — **Partly**

§49's MVP product loop and §52's navigation describe a social loop; the app's
loop is academic. §50 and §51 are scope and persona statements rather than
implementable requirements. §52's navigation exists in a different shape:
fifty-nine destinations across eight groups, gated three ways
(`lib/school.ts`, `lib/role.ts`, `lib/reveal.ts`).

## §53 Data quality standard — **Partly**

Strong where there is data: an imported deadline carries the sentence it came
from, the page it was on and the file that page is in (`Item.quote`,
`Item.checked.{page,doc}`, `lib/topage.ts`), and a date somebody moved keeps
what it was moved from (`Item.movedFrom`). `lib/import-review.ts` makes the
student confirm before anything is written.

Not applicable where there is none: normalising organization names, duplicate
professors, expired events.

## §54 Analytics — **Conflict**

Absent, and promised absent in two places the student reads:

> It has **no account requirement and no analytics**, and signed out nothing
> leaves this device. — `lib/guidebook.ts:222`

> Signed out, nothing leaves the device at all — no courses, no grades, no
> notes, **no analytics**. — `lib/privacy.ts:185`

§54 asks for eleven tracked events. Adding any of them means changing what the
app tells people about itself. `public.usage` exists and counts assistant
calls against a quota, which is metering rather than product analytics.

## §55 Success metrics — **Absent**

Follows from §54. Nothing counts activation, retention or network health
because nothing counts anything.

## §56 Trust standard — **Built**

This is the requirement the repository most clearly already meets, and it meets
it by refusing to overclaim:

> **Verification proves an address, not an enrolment.** A confirmed address at
> a school's own domain means somebody controls a mailbox there. It does not
> mean they are in ECON 1020, because nothing here can read the registrar — no
> student-usable API exposes a class roster, and there will not be one. So a
> room is people who say they are in that class, and the screen says exactly
> that rather than implying a roster. — `lib/classmates.ts`

No fake verification, no implied university endorsement.

## §57 Privacy standard — **Partly**

`screens/Privacy.tsx` and `lib/privacy.ts` explain what is where and what
leaves the device; `screens/Export.tsx` takes it all with you; `screens/Data.tsx`
shows what is running. Controls for who sees your profile, courses,
organizations and connections are absent because those entities are.

## §58 Moderation standard — **P0. Partly built, and the gap is named in the spec**

§58 says: *"Reports must persist and have statuses"*, *"Review reports through
admin interface"*, and *"Do not implement report buttons that disappear into
nowhere."*

What exists:

```sql
create table if not exists public.reports (
  id          uuid        primary key default gen_random_uuid(),
  reporter    uuid        not null references auth.users on delete cascade,
  message_id  uuid        references public.messages on delete set null,
  about       uuid        references auth.users on delete set null,
  reason      text        not null check (length(trim(reason)) between 1 and 500),
  copy        text        not null default '',
  created_at  timestamptz not null default now()
);
```

Three things are true at once and all three matter:

1. **There is no status column.** `OPEN / UNDER_REVIEW / RESOLVED / DISMISSED`
   has nowhere to go.
2. **There is no select policy at all.** The migration says so in a comment —
   `-- No select policy at all, which means no client can read this table.` So
   no admin interface can be built against it as it stands, only inserted into.
3. **The app does not pretend otherwise.** `lib/classmates.ts`:

   > **Reports are stored, not moderated.** Nobody is watching a queue. Saying
   > otherwise would be the worst kind of lie in a feature like this — somebody
   > would rely on it. Blocking is the remedy that works, and it is immediate.

So the button does not disappear into nowhere *silently* — the screen says
where it goes. It still goes nowhere. `public.app_admins` and
`private.is_app_admin()` arrived on 21 September
(`20260921161500_roles.sql:244`) and give the admin identity this needs; what
is missing is a status column, a read policy for admins, and a screen. **This
is the one P0 in Part A that requires no product decision from the author**:
the spec asks for it, the honesty comment does not argue against it, and the
admin identity is already in the database.

## §59 Performance standard — **Built**

The Supabase SDK is dynamically imported so it is not in front of somebody
opening Today (`lib/cloud.ts:40-52`); the build code-splits; nothing fetches
campus records at startup because there are none to fetch.

## §60 Release gate — **Partly**

BUILD is green: `npx tsc -b`, `npm run lint`, `npm test` (11,822 across 598
files), `npm run test:shuffle`, `npm run build` — all zero, plus seventeen
Supabase policy suites. AUTH is green. The gate's social rows follow their
features.

## §61 Demo flow — **Cannot run**

Twenty-four steps. Steps 1–5 work. Step 6 is *"Searches for organization"* and
steps 6–24 need organizations, events, connections and direct messages, which
are §47.10, §47.11, §47.8 and §47.9. This is the clearest single statement of
the distance between Part A and the application.

## §62–63 — this document, and its siblings

§63 steps 1–3 are done: the audit is this file,
[`SEMESTER_IMPLEMENTATION_PLAN.md`](SEMESTER_IMPLEMENTATION_PLAN.md) is the
plan, and [`SEMESTER-MASTER-COMMAND.md`](SEMESTER-MASTER-COMMAND.md) holds the
requirements. Step 4, the current phase, is in the plan. Step 5, the P0s, is
below.

---

# The three conflicts, and one blocker

§63 step 13 says: *"When blocked by missing credentials or third-party
configuration, complete every part that can be implemented safely, document the
exact blocker, and continue with other unblocked work."* These are those, plus
three of a different kind that step 13 does not cover — not a missing
credential, but a requirement the codebase already argues against in writing.

**1. Accounts (§47.1) versus "no account requirement".** The app works signed
out and says so. §47.1 wants protected routes. Either the promise changes or
the requirement does.

**2. Analytics (§54) versus "no analytics".** Promised absent in two
user-facing strings. Eleven tracked events cannot be added without editing
both.

**3. Organizations (§47.10) versus `lib/activities.ts`.** The refusal to
compile a list is argued from staleness and from harm — emailing a president
who graduated in 2021. The requirement stands only with a real, repeatable
source named.

**Blocker: Google OAuth.** Dashboard configuration, `SETUP.md:268`. Not
reachable from this repository.

None of these is a reason to stop. Everything in the plan that does not touch
them proceeds.

---

# Part B — Academic OS (§86–128)

The short version: this is what the application is. Twenty-four of forty-three
sections are built, and several are built past what the section asks for.

## Built, and worth naming for what the section did not ask

**§90 Syllabus importer.** §90 marks one requirement CRITICAL — *"Never
silently trust AI extraction. Show: We found... Review before importing."*
`lib/import-review.ts` and `screens/Import.tsx` do exactly that.
`lib/extract.ts` reads PDF, DOCX, PPTX, text and zip. Past the requirement: a
deadline keeps the sentence it came from and the page number in the named file
(`Item.quote`, `Item.checked`), so the student can check the app against the
document in ten seconds.

**§93 Smart academic priority engine.** `lib/worth.ts` ranks by weight,
standing in that course and how long that kind of work takes you — not by due
date. §93 says *"Avoid pretending Semester can mathematically determine a
student's academic outcome. Priority recommendations should remain
explainable."* `worth.ts` opens with *"A range, because a point estimate here
is a lie."*

**§106 Topic mastery and §108 spaced repetition.** `lib/review.ts` is an SM-2
variant, and mastery is computed from answers rather than asserted. Its own
docblock records the version that was not:

> Until now every mastery figure in the app was a static number that shipped
> with the guide. Drilling a unit twenty times moved nothing... The app looked
> adaptive and was not.

**§127 Import conflict handling.** `lib/rediff.ts` — `diff`, `keepIds`,
`movedLine`, `ticksKept` — reconciles a re-imported syllabus against what you
have already ticked off.

**§128 Academic source of truth.** `Item.source`, `Item.quote`,
`Item.checked.{confirmed,page,doc}`, and `Item.movedFrom` for when the student
disagrees with the document. §128 asks that every imported item track its
source; this tracks the sentence.

**§123 Office hours.** `lib/officehours.ts`, and the nudge is evidence rather
than a weekly reminder: deadlines that went by unticked, a practice paper that
went badly, a deck you are missing more than getting.

## The full table

| § | subject | state | where |
| --- | --- | --- | --- |
| 86 | Academic OS loop | Partly | the loop exists; §96, §100, §103 are its gaps |
| 87 | Academic dashboard | Built | `screens/Today.tsx` — Today, Week, Hours, Done |
| 88 | Course hubs 2.0 | Partly | `screens/Courses.tsx` has three grains, not ten sections |
| 89 | Course overview | Partly | next class, next deadline, materials ✓; announcements, groups, notes not aggregated |
| 90 | Syllabus importer | **Built** | `lib/extract.ts`, `lib/generate.ts`, `lib/import-review.ts` |
| 91 | Assignment system | Partly | `Item` in `lib/types.ts` — see below |
| 92 | Assignment subtasks | Partly | `lib/assignment.ts` plans and saves as tasks; no subtask field on an item |
| 93 | Priority engine | **Built** | `lib/worth.ts`, `lib/revise.ts`, `lib/atrisk.ts` |
| 94 | Academic calendar | Partly | `screens/Calendar.tsx` — Day, Week, Month, Semester; no Agenda view |
| 95 | Semester timeline | Built | the Semester view |
| 96 | Workload heatmap | **Absent** | nearest is Today's Week tab, `lib/ahead.ts` |
| 97 | Smart study planner | **Built** | `lib/revise.ts` `planFor`, `lib/sessions.ts` |
| 98 | Automatic rebalancing | Partly | `lib/sessions.ts` — a plan that can be missed; rebalancing is manual |
| 99 | Study session system | **Built** | `lib/session.ts`, `state.sessions`, `state.liveSession` |
| 100 | Focus mode | **Absent** | |
| 101 | Study timer | **Built** | `lib/clocks.ts`, `screens/Clocks.tsx`, `state.timers` |
| 102 | Study history | **Built** | `state.sessions`, the Reports destination |
| 103 | Study goals | **Absent** | `state.dayBudget` is the nearest thing — tonight's hours, not a goal |
| 104 | Exam center | **Built** | `lib/runway.ts` — four weeks counted backwards from the exam |
| 105 | Exam workspace | **Built** | `screens/Exam.tsx`, `state.examCovers`, `state.sittings` |
| 106 | Topic mastery | **Built** | `lib/review.ts`, `state.reviews` |
| 107 | Flashcards | **Built** | `StudyCard`, `lib/drilldeck.ts`, `screens/Drill.tsx` |
| 108 | Spaced repetition | **Built** | SM-2 variant, `lib/review.ts` |
| 109 | Practice questions | **Built** | `screens/Exam.tsx` |
| 110 | Practice exams | **Built** | shape, total, clock, marked against a key |
| 111 | AI tutor mode | **Built** | the `ask` destination, `lib/assistant.ts`, `ai/` |
| 112 | Socratic mode | **Absent** | nothing in the tree names it |
| 113 | Notes system | **Built** | `state.notes`, `state/slices/notes.ts`, files in IndexedDB |
| 114 | Lecture note workflow | Partly | notes and materials exist; no lecture-shaped flow |
| 115 | Materials library | **Built** | `lib/shelf.ts`, `screens/Sources.tsx`, `state.sources/documents/folders` |
| 116 | Academic search | Partly | `screens/Search.tsx` — app-wide, not scoped to one course's materials |
| 117 | Reading manager | **Built** | `lib/reading.ts`, `lib/progress.ts` — page numbers, a real measure |
| 118 | Project management | Partly | `lib/assignment.ts` plans; no project entity |
| 119 | Group projects | **Built** | `lib/groupwork.ts`, `public.groups`, `group_members`, `group_tasks` |
| 120 | Study groups 2.0 | Partly | course rooms and groups exist; not the §120 shape |
| 121 | Smart group matching | **Absent** | needs the §47.8 social graph |
| 122 | Study buddy | **Absent** | same |
| 123 | Office hours | **Built** | `lib/officehours.ts` |
| 124 | Professor & TA directory | Partly | `Course.prof`, `Course.email`, `lib/campusdirectory.ts`; no TA record |
| 125 | Calendar integration | **Built** | `public.calendar_feeds`, `lib/calsource.ts`, any `.ics` |
| 126 | LMS integration | Partly | LTI 1.3 built (`lib/lti*`, `public.lti_*`); Brightspace linked, not read |
| 127 | Import conflict handling | **Built** | `lib/rediff.ts`, `Item.movedFrom` |
| 128 | Academic source of truth | **Built** | `Item.source`, `Item.quote`, `Item.checked` |

## §91, in detail, because it is the load-bearing gap

`Item` (`lib/types.ts:64`) is what a deadline is. Against §91's field list:

| §91 field | `Item` |
| --- | --- |
| Course | `c` ✓ |
| Name | `title` ✓ |
| Description | `detail` ✓ |
| Due date | `month`, `day`, `year` ✓ |
| Due time | `dueTime` ✓ |
| Type | `kind` ✓ |
| Grade weight | `weight` ✓ |
| Links | `source`, `checked.doc` — the source document, not arbitrary links |
| Notes | via `state.notes`, not on the item |
| **Priority** | **absent** — computed by `lib/worth.ts`, never stored |
| **Estimated effort** | **absent** — inferred per kind, never stored per item |
| **Attachments** | **absent** |
| **Subtasks** | **absent** |

Status is the sharper gap. §91 names seven; the app has two and a half:
`done` (a tick), `started` (`state.started`, and `lib/underway.ts` explains why
it is separate rather than a third enum value), and `lib/progress.ts`'s page
count for readings. `PLANNED`, `READY_TO_SUBMIT`, `SUBMITTED`, `GRADED` and
`MISSED` have nowhere to go.

`lib/underway.ts` already made this argument once, for one of the five:

> A tick box has two positions and coursework has three. A paper you have
> written two pages of is not "not done" in any sense a person recognises, and
> it is certainly not done.

§91 is that argument continued to seven, and the rest of Part B — §92 subtasks,
§93's completion percentage, §98's rebalancing — reads from it. It is the first
thing to build.

## §126, in detail, because "Partly" hides two different answers

| platform | state | why |
| --- | --- | --- |
| LTI 1.3 | **Built** | `public.lti_platform`, `lti_identity`, `lti_link_ticket`, `lti_nonce`; `lib/ltiarrival.ts`, `lib/ltilanding.ts`; 52 policy checks |
| Canvas | Partly | `lib/canvas.ts` |
| Brightspace / D2L | **Refused, with a reason** | `Course.lms` links to the shell rather than reading it: *"D2L exposes no API a student can use alone, so the app links rather than reads."* |

§126 should be read against that third row before it is scheduled. It is the
same shape as §47.10: not unbuilt, but blocked on somebody else's API, and the
codebase already wrote down why.

---

# The measured baseline

Added by a second Phase 0 pass, which had §36–45 of the command but not §1–35 —
so it could not do the section-by-section conformance audit above, and did the
thing that audit does not: **ran everything, at `e4cf671`.**

Every figure here was taken by running the app or the repository's own
instruments. None is quoted.

## Gates

| Check | Result |
| --- | --- |
| `npx tsc -b` · `npm run check:university` · `npm run lint` | clean |
| `npm test` | 11,788 passed · 10 skipped · **0 failed** |
| `npm run test:shuffle` | identical |
| `npm run build` | clean |
| `node pipeline/validate.mjs` | 4 courses, 48 items, 8 episodes |
| `SEMESTER_CHECK_PG_ANY=1 supabase/check.sh` | **17 suites, 354 policy checks**, all passing |

## Driven in a browser, all 59 destinations

- **59 of 59 render. 0 page errors. 0 application console errors. 0 dead
  routes.** (Proxy refusals for outbound fonts and map tiles excluded — those are
  the container, not the app.)
- The three thinnest screens — `groupwork`, `classmates`, `account` — draw zero
  controls signed out. All three are correctly auth-gated, rendering a heading
  and an explanation rather than a broken form.
- `npm run sweep:walls` — 59/59 plus 71 tabs within them, **0 walls**, 0 screens
  with competing filled actions.
- `npm run smoke:cold` — 5 cold boots against the built app, no findings.

## Responsive, at every width §37 names

59 screens × 7 widths = **413 combinations, 0 with horizontal page scroll.**

| 320 | 375 | 390 | 430 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 | 0 | 0 |

§37's "do not wait until the end to fix mobile" is already satisfied.

## Tap targets and type

```
under 24px — WCAG 2.5.8 AA, the failure line
  phone    Comfortable 0/1500 · Snug 0/1500 · Tight 0/1500
  desktop  Comfortable 0/2112 · Snug 0/2112 · Tight 0/2112

under 44px — WCAG 2.5.5 AAA, an aim and not a failure
  phone     810/1500 ·  879/1500 ·  870/1500
  desktop  1438/2112 · 1486/2112 · 1486/2112
```

Zero AA failures at every density. Sub-12px text reads 1,173 of 3,122 — **not** a
WCAG failure, since there is no minimum font size and 1.4.4 Resize Text is
satisfied, but a design decision worth making deliberately before nine more
surfaces are added.

## Mock functionality, secrets

- `TODO`/`FIXME`/`HACK` in non-test source: **2**, across 644 files.
- No "coming soon" or "not implemented" screens. No payment code at all, which
  is the correct state.
- **No secret is reachable from the client.** `ANTHROPIC_API_KEY` is deliberately
  *not* prefixed `VITE_`, so Vite cannot compile it into the page;
  `VITE_SUPABASE_KEY` is publishable and row-level security is the boundary.

## Two findings this pass adds, both infrastructural

**1 · 212 MB of the 223 MB build is committed audio.**

```
dist total    223 MB
  audio       212 MB   ← 8 MP3s, 15–24 MB each, for 4 seeded courses
  assets      9.8 MB   (7.5 MB JS across 290 code-split chunks)
  decks       952 KB
```

Fine for four bundled demo courses; impossible for real ones. Needs object
storage and generation on demand before any multi-user pilot imports a real
syllabus.

**2 · No edge function is declared in `config.toml`.**

There are six — `claude`, `calendar`, `canvas`, `fetchcal`, `push`, `lti` — and
`config.toml` declares none, so **Supabase preview branches deploy the database
and none of the functions.** Every preview branch therefore exercises the schema
and never the request path, including the Claude gateway and the LTI handshake.
The gateway has never run outside a manual test. This is the cheapest
high-value fix available, and it is a cost decision rather than a code one, so it
belongs with the author.

## Three notes on the instruments themselves

1. **`supabase/check.sh` was red twice during this pass and is green now** — a
   *missing* covering index on `lti_link_ticket(provisioned_user_id)`, then forty
   minutes later a *duplicate* one after two sessions each added it, then #660.
   No fix was written either time, because one was in flight both times. The
   finding that outlasts it: the parallel-agent workflow is now producing
   duplicate **schema**, not just duplicate documents.
2. **Only CI can see that.** `check.sh` needs Postgres 17 and correctly refuses a
   major mismatch locally, so most contributors never run it.
   `SEMESTER_CHECK_PG_ANY=1` exists, says on every run that a pass on the wrong
   major is not a statement about production, and is easy to miss. These figures
   were taken that way, on 16.
3. **This pass duplicated the two documents above before discovering they
   existed**, having checked `main` for the *spec* and not for the *documents*.
   Theirs landed first and is better grounded — it has §1–35. Only the additive
   part survives: this section, and `docs/architecture/`, which §43 asks for and
   which nothing else in the repository provides.
