Items 239–301 of the master specification: the role and permission architecture. Semester is no longer a single-user student app. It has students, faculty, advisors, organizations, tutors, businesses, employers, university departments, moderators and institutional administrators, and all of them have to live in **one account system** rather than in separate disconnected applications.

Nothing previous is replaced or retired. This is a new document beside the ones that exist, and it is deliberately the *authorization* document: the layer every other requirement in the repository turns out to sit on.

# What this document is, and what the others already cover

Three existing documents describe roles from three other directions, and each remains authoritative for its own subject:

| Document | What it specifies | Its relationship to this one |
|---|---|---|
| `docs/INSTITUTIONAL_REQUIREMENTS.md` | §6 faculty workspace, §7 administrative operating system, §15 human tutoring marketplace, §21 alumni continuity, §23 graduate and professional education, §24 parent and authorized-user access | The *products* those roles get. This document specifies who is allowed to open them. |
| `docs/PRODUCTIVITY_REQUIREMENTS.md` | The tools — documents, slides, spreadsheets, forms, video | Tools are role-neutral. A professor's spreadsheet is a spreadsheet. |
| `docs/PRODUCT_REQUIREMENTS.md` | The student product | Item 241 is that product, stated as one role among many rather than as the whole app. |

The layer beneath the tools — one file entity carrying course, assignment, organization, project and source — is items 129–183, open separately. That document and this one meet at exactly one place, and it is worth naming because it decides the order both get built in: **a file's permissions are a role question, and a role's scope is a resource question.** Neither can be finished first, so both have to agree on the resource identifiers from the start.

# What is here today

This section is measured against the tree rather than remembered, because the adjacent requirements document was written with three plausible-looking module paths that did not exist, and a table of paths that are not there is worse than no table. Every path below is resolved, and `app/src/lib/rolespec.test.ts` is the guard that keeps it that way.

## Three role vocabularies, and they disagree

The repository already has three lists of what a person can be. They were written for different purposes and none of them is wrong on its own; the problem is that there are three.

| Where | Values | Count | Enforced by |
|---|---|---|---|
| `app/src/lib/role.ts` | `student`, `faculty`, `advisor`, `admin`, `payer`, `staff` | 6 | Nothing. It is a client-side statement of intent — see below. |
| `packages/institution/src/index.ts` (`UNIVERSITY_ROLES`) | `student`, `faculty`, `advisor`, `admin`, `payer`, `staff` | 6 | Nothing yet. It is the contract the institutional half will speak. |
| `supabase/migrations/20260921161500_roles.sql` (`profiles.account_role`) | `student`, `parent`, `mentor` | 3 | A `check` constraint in Postgres. This one is real. |

The first two agree. The third does not agree with either: it has `parent` where they have `payer`, it has `mentor` where they have nothing, and it has no `faculty`, `advisor`, `admin` or `staff` at all. **The one vocabulary a server actually enforces is the one that shares a single value with the other two.**

And "enforces" means the value set, not any authority. `supabase/migrations/20260921211500_pin_profile_school.sql` had to decide whether to take the client's write privilege on that column away, and deliberately did not:

> `account_role` … is what an account *says* it is — chosen at sign-up, writable by its owner, and it decides nothing about authorization; it picks which dashboard the app draws. Every value it can hold is one anybody may give themselves.

That is the correct decision for that column, and it settles the shape of everything below: **a permission its subject can write is not a permission.** Any role that grants something has to live somewhere its holder cannot reach.

There is now a fourth list, and it is the one that decides authorization: `role` in `public.role_grants`, added by `supabase/migrations/20260921223000_role_grants.sql`, which carries item 239's twenty values and is written by the service key alone. The other three are unchanged by it on purpose — reconciling them is the rest of item 239's work, and doing it quietly inside a migration about a new table would be a behaviour change riding along with a schema addition.

None of the original three is the twenty roles item 239 asks for, and the difference is not a matter of adding strings. All three are *one role per account*: a `text` column, a union type, a single `Role` in application state (`app/src/state/shape.ts`). Item 239 requires a person to hold several at once, which is a different shape, not a longer list.

## The global admin capability, and the thing it got right

Item 239 says: do not implement one global `isAdmin` boolean. The repository has one global admin capability, and it is worth being exact about what is and is not wrong with it.

What it got right, in `supabase/migrations/20260921161500_roles.sql`:

- `admin` is deliberately **not** one of `account_role`'s values. Its comment says why — "an account that could name itself an administrator is an administrator, whatever the rest of the system believes".
- Administrators live in `public.app_admins`, a separate table with row-level security on, no select policy, no insert policy, and `revoke all … from anon, authenticated`. The only way in is a migration or the service key.
- The predicate is `private.is_app_admin()`, in the `private` schema rather than `public`, and its comment explains the choice: a function in `public` that `authenticated` may execute is a URL, because PostgREST publishes it. A `public.is_app_admin()` would hand every signed-in visitor an oracle about their own account and would be exactly the client-side flag the specification says an admin dashboard must never be guarded by. A function the client cannot call cannot become one.

That is a correct single-tier admin gate, and the reasoning behind it is the reasoning items 297–301 need. What is still missing is that it is **one** capability. `private.is_app_admin()` answers one question — is this person an administrator — and items 294 through 301 need at least four different answers: a moderator may read a report and act on it but may not configure a university; a platform admin may set a feature flag but should not read a private note; a superadmin action needs re-authentication; support impersonation needs a reason and a banner. One boolean cannot express those, and a boolean that gets asked to will grow into the thing item 239 opens by refusing.

## What the LMS already tells us, and what happens to it

This is the most surprising finding, and it changes the order of the work.

Semester already receives authoritative role information on every LTI launch. `supabase/functions/_shared/lti.ts` reads the `roles` claim, keeps unrecognised role URIs rather than dropping them, and carries a set of the ones that mean "can see other people's work":

```
Instructor  Administrator  ContentDeveloper  Mentor  TeachingAssistant
```

It collapses them into a single `teaching` boolean, and then nothing persists. `public.lti_identity` stores `issuer`, `subject`, `user_id`, `origin` and `created_at` — and no roles. So the one role source in the entire system that an institution actually vouches for is read, reduced to one bit, used for the length of one request, and discarded.

Items 246, 250, 251 and 274 all say the same thing in different words: faculty, TA, advisor and department access **must be institutionally authorized**. The authorization those items require is already arriving. It is being thrown away. Persisting it is a smaller piece of work than any of the workspaces those items describe, and every one of those workspaces is blocked on it.

## The one authorization model that works

`family_grants`, in the same migration, is the only server-enforced, resource-scoped, consent-gated permission in the repository, and it is the model items 299 and 300 should generalise rather than replace. Its predicate is `allowsFamilyRequest` in `packages/institution/src/index.ts`, and four of its decisions are the right ones for every role:

1. **A category alone grants nothing.** `resourceIds` names the individual things. This is item 300 — an organization admin can edit Finance Club and not Consulting Club — already solved once.
2. **A grant nobody accepted is not one.** `acceptedAt` is null until the recipient accepts. Consent is a field, not a convention.
3. **It expires and it is revocable.** `expiresAt` and `revokedAt`, both read by the predicate.
4. **The levels are not an ordinal scale.** `payment` lets a payer pay and read nothing. A permission model built as tiers cannot express that, and tiers are what "officer < admin" would be.

The predicate's own comment states the rule the rest of this document assumes: it is written as a single predicate with no partial results, because "an authorization that can be half-computed is one a caller can use half of."

## What exists to build on, and what does not

Resolved against the tree. "Present" means the file or table exists and does the thing named, not that the item is satisfied.

| Item | Needs | Present today |
|---|---|---|
| 239 role model | Multi-role account | **Built** — `public.role_grants`, scoped and provenanced, twenty roles. `profiles.account_role` remains what an account says it is |
| 240 role switching | Context switch | `app/src/lib/role.ts` + `setRole` in `app/src/state/shape.ts`, single role, no contexts |
| 241 student role | The core product | Built — this is the app |
| 246–250 faculty, TA | Course-scoped authority | `supabase/functions/_shared/lti.ts` knows the roles; nothing stores them |
| 249 office hours | Two-party booking | `public.appointments` is a per-user synced record, not a booking between two people |
| 251–253 advisor | Reading another person's plan | Nothing. `app/src/lib/role.ts` marks `advisor` not ready and says why |
| 254 tutor | Tutor profile, booking, reviews | Nothing under `app/src/lib/` |
| 255–258 organizations | Organization entity, officer tier | `public.groups` and `public.group_members` — course-scoped study groups, flat membership, no roles column |
| 259 applications | Configurable forms with review | `public.forms` — owner-scoped, with `questions`, `accepting`, `opens`, `closes` and an answer key excluded from every view |
| 262 QR check-in | QR generation | `app/src/lib/qr.ts` — a real encoder, `qrMatrix` and `qrSvg` |
| 264 organization files | Org-scoped storage | Nothing org-scoped |
| 268–269 business, discounts | Business profile | Nothing |
| 270–271 employer | Semester Recruit | `app/src/lib/career.ts` and `app/src/screens/Career.tsx` are the student's side |
| 277–287 campus services | Service profiles | `app/src/lib/meals.ts`, `app/src/lib/housing.ts`, `app/src/lib/maps.ts`, `app/src/lib/athletics.ts` — all student-facing readers |
| 291–292 registrar | Process translation | `app/src/lib/registrar.ts`, `app/src/lib/transcript.ts`, `app/src/screens/Registrar.tsx` |
| 294–296 moderation | Case system | `public.reports` stores `reporter`, `about`, `message_id`, `reason`, `copy`, `created_at` — and no status, category, assignee or resolution. A sink, not a queue |
| 297–298 platform admin | Differentiated capability | `public.app_admins` + `private.is_app_admin()`, one tier |
| 299 permission matrix | Central definitions | Still nothing central. `app/src/lib/school.ts` (`allowed`) and `app/src/lib/role.ts` (`forRole`) gate *screens*, and both say they are not permissions. `private.holds_role()` is what a capability map would be built on |
| 300 resource authorization | Server-side ownership check | **Built** — `private.holds_role()`, beside `family_grants`' policies and `private.in_group()` |
| 301 impersonation | Controlled support mode | Nothing, which is the right amount for now |

## Two locks that do not behave alike

Worth knowing before building any of the tables below, because it was learned by writing the assertion the wrong way round first.

A table closed to clients is closed twice over here: the relation privilege is revoked from `anon` and `authenticated`, *and* there is no write policy. Those two refuse differently, and only one of them raises:

| | `insert` | `update` | `delete` |
|---|---|---|---|
| privilege revoked | refuses (`42501`) | refuses (`42501`) | refuses (`42501`) |
| privilege granted, no policy | refuses (`42501`) | **succeeds, matches no row** | **succeeds, matches no row** |

So a suite asserting "refused outright" for all three passes for the wrong reason as soon as the revoke is in place, and would keep passing if the policy half were removed. `supabase/rolegrants.check.sql` asserts the first row with `pg_temp.refused` and the second with `pg_temp.untouched`, which reads `row_count`. The first version of that file did not, and the suite caught it.

## The audit-log position this repository already holds

Items 296, 298 and 301 all require audit logs, and the repository has one: `public.access_log`, in `supabase/migrations/20260921143653_access_log.sql`. Its design is an argument, and the argument constrains what the logs below may be.

It records a **day**, not a timestamp, and its comment says why: "a timestamp per fetch answers a question nobody asked and records one nobody should." Its `what` column is a `check` against a fixed list rather than a string from the wire, and so is `client`.

So an audit log here is not "record everything and decide later". It records the minimum that answers the question it was built for, in fields with closed vocabularies. Item 263 — organizations tracking attendance — and item 301 — impersonation logging — both have to be built to that standard, and item 263 in particular is where a log that felt harmless becomes a location history.

# 239. Complete user role system

Semester must support multiple user types without creating separate disconnected applications. One unified account architecture, with role-based capabilities.

The primary roles:

```
PROSPECTIVE_STUDENT        ORGANIZATION_MEMBER       UNIVERSITY_STAFF
UNDERGRADUATE_STUDENT      ORGANIZATION_OFFICER      DEPARTMENT_ADMIN
GRADUATE_STUDENT           ORGANIZATION_ADMIN        UNIVERSITY_ADMIN
TRANSFER_STUDENT
ALUMNI                     EMPLOYER                  MODERATOR
                           BUSINESS_ADMIN            PLATFORM_ADMIN
FACULTY
TEACHING_ASSISTANT
ACADEMIC_ADVISOR
TUTOR
```

Users may hold several simultaneously:

```
USER
├── STUDENT
├── ORGANIZATION_ADMIN
└── TUTOR
```

**Do not implement one global `isAdmin` boolean.** Use roles and permissions.

Three consequences that follow from the current schema, and each is a change rather than an addition:

- `profiles.account_role` is a single `text` column with a three-value `check`. A person holding three roles cannot be represented in it at all, so the grant of a role becomes a **row**, not a column value: one table keyed by person, role and the resource the role is held over.
- A role held over nothing is meaningless for most of this list. `ORGANIZATION_ADMIN` is always admin *of a particular organization*; `FACULTY` is faculty *of particular courses*. Only `PLATFORM_ADMIN` and `MODERATOR` are genuinely global, and those two are the ones that need the strongest controls (items 297–298). The scope column is therefore not optional metadata — it is half the primary key.
- A role has a **provenance**. `UNDERGRADUATE_STUDENT` asserted by the holder is a preference; asserted by an LTI launch or a student-information system it is a fact. Items 246, 250, 251, 274 and 286 all require institutional authorization, which is unenforceable unless the row records where it came from. Three provenances are enough to start: self-asserted, institution-asserted, and platform-granted.

**Built**, as `public.role_grants` in `supabase/migrations/20260921223000_role_grants.sql`: one row per role per scope, the twenty values above, `scope_kind` and `scope_id`, `provenance`, `granted_by`, `expires_at` and `revoked_at`. It is revoked from `anon` and `authenticated` and has no write policy, so there is no route to granting yourself anything — the two locks are tested independently in `supabase/rolegrants.check.sql`. What it does **not** yet have is any way for a row to come into existence apart from the service key; the one self-service path item 254 needs (`tutor`, and nothing else) is still to write.

# 240. Role switching

Where a user holds several roles, provide contextual workspace switching:

```
Harrison Rubin

PERSONAL
  Student

MANAGE
  Finance Club
  Economics Society

WORK
  Peer Tutor
```

Switching context changes the administrative tools on offer. It does **not** create another account, another login, or another copy of the person's data.

The grouping in that sketch is the resource scope of item 239 made visible: PERSONAL is the roles held over oneself, MANAGE is the roles held over an organization, WORK is the roles held over a service one provides. The switcher is therefore a view of the grant rows, not a separate configuration — which is what keeps it honest when a role is revoked.

Switching context must never be the thing that authorises an action. The active context decides which tools are *shown*; the server decides what may be *done*, per item 300. A context switcher that grants anything is a client-side permission with extra steps.

# 241. Student role

Students receive the complete core Semester experience: profile, courses, academic dashboard, degree tracker, calendar, assignments, study planner, notes, documents, slides, spreadsheets, Drive, AI tutor, flashcards, practice exams, study groups, messaging, organizations, events, marketplace, housing, career, university systems, email, notifications and registration planning.

Students control appropriate privacy settings.

This is the application as it exists. Stating it as one role among twenty is the point of the item: every capability listed above is currently reachable because there is only one kind of person, and each one becomes a permission the moment there is more than one. The distinction that matters most, and the one items 251 and 275 turn on, is that **a student's planning is theirs and a student's record is the institution's**. Nothing in this list may quietly become readable by an advisor, a department or a university administrator because a role was added.

# 242. Prospective student role

Semester should eventually support students before enrolment, as **Semester Explore**: university discovery, academic programs, majors and minors, campus organizations, campus resources, housing information, student life, events open to prospective students, application resources, campus tours and admissions deadlines.

Prospective users must **not** receive access to private enrolled-student information.

This is the only role in the list with no institutional identity behind it, which makes it the one where the default must be inverted: an Explore account sees what the university has published for the public, and the test for each surface is not "is this sensitive" but "has the institution published this". `app/src/screens/Applying.tsx` is the student-side counterpart and is where the two meet.

# 243. Transfer student experience

Transfer students need specialised functionality: transfer credit tracking, course equivalency, degree requirement mapping, orientation information, transfer-specific events, advisor information, registration preparation and community discovery.

```
TRANSFER DASHBOARD

Credits accepted
Credits pending
Degree progress
Orientation tasks
Registration
Transfer events
Recommended organizations
```

Credits accepted and credits pending are institutional facts, not student-entered ones, and the difference has to be visible on the dashboard rather than implied — a transfer student reading "credits pending" is asking a question about a decision somebody else is making, and an app that shows their own guess back to them in the same typeface as a registrar's answer has made the worse of the two mistakes available.

# 244. Graduate student role

Graduate students need additional academic structures: graduate courses, research groups, advisor, thesis or dissertation, research milestones, teaching responsibilities, funding opportunities, fellowships, conferences and research documents.

**Do not assume undergraduate degree structures apply to graduate programs.** A degree audit that counts credits toward a fixed requirement set is an undergraduate instrument; a doctoral program is milestones, a committee and a defence. `app/src/screens/Degree.tsx` is written for the first, which is correct for who uses it today and is not extensible to the second by adding requirement rows.

Teaching responsibilities are the item's hinge: a graduate student is frequently a `TEACHING_ASSISTANT` as well, over particular courses, and that is item 239's multi-role case arriving in the most ordinary way rather than as an edge case.

# 245. Alumni role

Alumni can remain part of the network: alumni profile, career, mentorship, university events, organizations, alumni groups, networking and recruiting.

Privacy controls remain essential, and alumni status is where they are easiest to get wrong. Graduation must not silently widen what a person's profile shows or who may contact them, and it must not silently narrow their access to their own records either. Both defaults have to be chosen deliberately, because the transition happens on a date rather than by an action anybody takes.

# 246. Faculty role

Faculty receive a specialised workspace:

```
FACULTY HOME

TODAY
  ECON 301        10:00 AM
  OFFICE HOURS    2:00–4:00 PM

COURSES     STUDENTS     ANNOUNCEMENTS
MEETINGS    DOCUMENTS    CALENDAR
```

Faculty functionality **complements** the institutional LMS. It does not attempt to replace it immediately.

`app/src/lib/role.ts` already marks `faculty` as a role the app can serve today, and its reasoning is worth preserving rather than overriding: a professor preparing a course — turning a syllabus into modules and deadlines, writing a practice paper, making slides and a handout — is doing what a student does with the same screens for a different reason, and that half needs no server. The half that does is the STUDENTS panel above. Those are two separable pieces of work and the first is already most of the way done.

# 247. Faculty course management

Authorised faculty can manage Semester course communities: course profile, announcements, resources, office hours, course events, study resources, Q&A, course discussions and optional study guides.

The institutional LMS remains authoritative for official grading and submissions unless Semester has an approved integration.

"Authorised" is the load-bearing word, and the authorisation already arrives: the LTI `roles` claim carries `Instructor` per launch. Course-scoped faculty authority should be derived from that claim rather than from an assertion made in Semester, which means persisting what the launch said — see *What the LMS already tells us* above.

# 248. Faculty announcements

Faculty can create course announcements. Students receive a course notification, an inbox item, and optionally email or push according to their preferences. Announcements may carry text, a link, an attachment and a date/time.

**Do not silently alter official LMS announcements.** An announcement written in Semester is a Semester announcement; if an integration ever writes into the LMS, that has to be a stated, visible action rather than a side effect of posting.

# 249. Office hours management

Faculty and TAs can optionally manage office hours, in four shapes:

```
WALK-IN        APPOINTMENT
ONLINE         IN PERSON
```

Fields: location, meeting link, start, end, recurrence, capacity. Students can add them to their calendar.

This is the first item in the document that needs a **two-party** record, and the repository has nothing of the shape. `public.appointments` looks like the right table and is not: it is `(user_id, id, data jsonb)` — one person's own synced records, like notes. A booking is one row two people can both see, one of whom may cancel it, and that is a new table with policies on both sides rather than a new `kind` in an existing one.

# 250. Teaching assistant role

TA permissions are **course-specific**: announcements, discussion moderation, office hours, resources, study sessions, student questions.

TA access must not automatically include sensitive institutional grade information. The LTI vocabulary makes this easy to get wrong in one direction: `supabase/functions/_shared/lti.ts` groups `TeachingAssistant` into the same `TEACHING` set as `Instructor`, because for the question that set answers — can this person see other people's work — they belong together. For this item they do not, and a permission model that reuses that boolean will hand every TA whatever a professor gets.

# 251. Academic advisor role

An advisor workspace:

```
ADVISOR DASHBOARD

APPOINTMENTS    STUDENTS    DEGREE PLANS
REGISTRATION PLANS    NOTES    RESOURCES
```

Access to student information must be institutionally authorized.

`app/src/lib/role.ts` marks `advisor` as not ready and states its blocker exactly: "reading a student's record, which needs a server, an identity on both sides and their consent." All three now exist in part — there is a server, there are authenticated identities, and `family_grants` is a working consent record — so this is no longer a missing foundation but a specific piece of work.

# 252. Advisor student view

With authorization, an advisor can view relevant planning information: degree progress, planned courses, registration plan, academic goals, questions and appointment history.

Keep separate:

- **student-shared planning information** — what the student put into Semester and chose to share
- **official institutional records** — what the registrar holds

These must not be presented as one list. A planned course is an intention; an enrolment is a fact; and an advisor acting on the first as though it were the second is the failure mode this separation exists to prevent. Where both are shown, each needs to say which it is.

# 253. Advising notes

Three visibilities:

```
PRIVATE ADVISOR NOTE       SHARED WITH STUDENT       STUDENT NOTE
```

**Never accidentally expose private institutional notes.** This is the item where a default is a disclosure: a note whose visibility is unset must not be readable by the student, and a note's visibility must not be changeable by whoever is reading it. Both are policy questions rather than interface ones, and both belong in the row.

# 254. Tutor role

Users can optionally become tutors. A tutor profile carries courses, subjects, experience, availability, price, reviews, online/in-person and verification.

Students can search for a tutor, view a profile, message, request a session, book and review.

Payments can be added after payment infrastructure is production-ready — and `docs/INSTITUTIONAL_REQUIREMENTS.md` §15 already specifies this marketplace, so this item is the role and permission half of that one rather than a second design.

Two things make this the most self-contained role on the list, and a reasonable first one to build after the model itself:

- A tutor is a **student who has opted in**. It is item 239's multi-role case with no institution in the loop and nothing to integrate, so it exercises the whole architecture — a second role, a scope, a profile only that role can edit — without waiting on anybody.
- **`verification` is not a boolean the tutor sets.** It is a claim about a claim, and the only party who can make it is Semester or the university. A verified badge a user can grant themselves is worse than no badge, because students will reasonably read it as checked.

Reviews need the same care: a review is about a person, so it is the first place where one user's writing becomes part of another user's reputation, and item 295's case system should be reachable from it on day one rather than added after the first dispute.

# 255. Organization member role

Organization members can view private member information where allowed, receive announcements, access organization files, join organization events, participate in group chat and view meetings. Permissions depend on the organization's settings.

"Depend on the organization's settings" is a per-resource permission set, which is the shape `public.groups` does not have: `group_members` is `(group_id, user_id, joined_at)` with no role and no settings, and `private.in_group()` answers only whether somebody is in. That predicate is the right pattern — a security-definer function a policy reads, which exists so the policy on `group_members` does not have to read `group_members` and deadlock on itself — and an organization version needs the same trick for the same reason.

# 256. Organization officer role

Officers may receive **delegated** permissions:

```
EVENTS_MANAGER      MEMBERSHIP_MANAGER      TREASURER
COMMUNICATIONS      SECRETARY
```

**Do not require every officer to receive full admin access.** This is the item that decides whether the permission model is tiers or sets. Tiers cannot express a treasurer who sees finances and cannot admit members, or a communications officer who posts announcements and sees no budget. `allowsFamilyRequest` in `packages/institution/src/index.ts` already made this choice correctly for family access, where `payment` is deliberately not a level of reading, and its comment says as much. The same reasoning applies here, so officer permissions are a **set of capabilities granted per organization**, and the named roles above are presets over that set rather than positions in an order.

# 257. Organization admin role

The admin dashboard:

```
ORGANIZATION

OVERVIEW    MEMBERS      APPLICATIONS    EVENTS
ANNOUNCEMENTS    MESSAGES    FILES       MEETINGS
FINANCES    ANALYTICS    SETTINGS
```

Every panel there is a capability from item 256's set, which is what makes the dashboard a view of permissions rather than a separate thing to secure: an officer with three capabilities sees three panels, and nothing else needs to know why.

# 258. Organization membership management

The lifecycle:

```
DISCOVERED → FOLLOWER → APPLICANT → ACCEPTED → MEMBER → OFFICER
```

with alternative states:

```
DECLINED    WAITLISTED    REMOVED    ALUMNI_MEMBER
```

Two properties of that list are worth stating because they are easy to lose in an implementation. It is **not** a single ordered progression — `WAITLISTED` can precede `ACCEPTED` or terminate, and `ALUMNI_MEMBER` follows `MEMBER` without being a demotion. And `DISCOVERED` is not a stored state at all; it is the absence of one. Storing it would mean recording that a person looked at an organization, which is a browsing history nobody asked for and which the `access_log` position above argues against.

# 259. Organization applications

Organizations can create configurable application forms. Field types: short text, long text, multiple choice, checkbox, number, date.

Admins can review, comment internally, accept, decline and waitlist.

**Sensitive application information must not become public profile information.** That sentence is a schema requirement, not a caution: an application answer lives with the application, and a profile reads from the profile.

`public.forms` is most of the machinery already, and its existing header records the right instinct for exactly this problem — `marking`, the answer key, "is in no view, in no grant, and read only by the owner." An application's internal comments need the same treatment for the same reason. What has to change is ownership: `forms.owner` is a `uuid` referencing `auth.users`, so a form belongs to a person. An organization's application outlives the officer who created it, which makes this the first place an owning **resource** rather than an owning **user** is needed — and the same change items 264 and 271 need.

# 260. Club recruitment system

Recruitment workflows:

```
INTEREST FORM → APPLICATION → INTERVIEW → DECISION → MEMBERSHIP
```

Organizations choose which stages apply. Students see their status.

"Students see their status" is the requirement that costs something. A stage a student can see is a stage the organization has to keep honest, and the useful version of this is an applicant knowing they are at INTERVIEW rather than being able to read the interview notes. Item 253's split — private note, shared note — is the same distinction and should use the same mechanism.

# 261. Organization event management

Admins and officers can create, edit, publish and cancel events, set capacity, create a waitlist, check in attendees, message attendees and view attendance.

Publish and cancel are the two that need care: a cancelled event has to reach the people who RSVP'd, through the notification preferences item 248 describes, and a published event is the first organization-authored thing that appears on a stranger's screen.

# 262. QR event check-in

Generate event-specific QR codes. Depending on implementation, an authorised organiser scans an attendee's code or an attendee scans the event's code.

Store the RSVP, the check-in time, and optionally check-out.

**Do not expose unnecessary attendance data publicly.**

`app/src/lib/qr.ts` already generates codes — `qrMatrix` and `qrSvg`, a real encoder rather than a hosted image — so the client half needs nothing new. What needs designing is the code's contents: an event QR that encodes a stable secret is a secret anybody who photographs the screen can reuse, so the code identifies the event and the *check-in* is authorised by who scanned it, not by possession of the image.

# 263. Organization attendance

Organizations may track member attendance for legitimate internal purposes. **Students should understand when attendance is being recorded.**

**Do not create hidden location-based attendance tracking.**

This is the item most likely to be built into something nobody intended, so it is worth naming the line. Attendance recorded by a person checking in is a record of an action somebody took. Attendance inferred from where a device is, is a location history — and once several organizations do it, it is a location history of a student's week held by their peers. The repository's existing audit-log position applies directly: record the minimum that answers the question, in fields with closed vocabularies, and prefer a day to a timestamp where a day will do.

If attendance is ever derived from anything other than a deliberate check-in, that has to be visible at the moment of collection and not only in a policy document.

# 264. Organization files

An organization Drive:

```
GENERAL    MEETING NOTES    EVENTS    MARKETING
FINANCES   CONSTITUTION     LEADERSHIP
```

Permissions can restrict sensitive folders — FINANCES and LEADERSHIP being the obvious two, which means folder-level permission is part of this item rather than a later refinement.

This is the meeting point with the file-entity work of items 129–183 noted at the top. A file owned by an organization rather than a person is the same ownership change item 259 needs, and building it twice in two shapes is the outcome worth avoiding.

# 265. Organization calendar

Combine meetings, events, deadlines, recruitment, elections and internal events. Members can overlay the organization calendar on their personal Semester Calendar.

Overlay, not copy. `public.calendar_feeds` and the calendar-feed path already exist, and the access log that watches them (`what in ('calendar_feed', 'push_send')`) is a reminder of what a subscribable calendar is: a URL that answers without a session. An organization calendar containing internal events must not become one of those by default.

# 266. Organization elections

Future organization governance: election creation, positions, candidate statements, a voting window and eligibility.

**Do not claim cryptographic or governmental-election security.** This is ordinary student organization governance, and saying so plainly in the interface is part of the requirement. What it should do honestly: record who was eligible, keep the window, prevent double voting, and be clear about whether the ballot is secret — because "secret" in a system where an administrator can read the table is a claim that has to be either made true or not made.

# 267. Organization finances

An optional lightweight financial-management workspace: budget, expenses, income, dues, reimbursements.

**Do not attempt to become a bank.** Financial transactions use appropriate providers. This is a ledger of what the organization believes, useful because a treasurer currently keeps it in a spreadsheet, and it must not present its own totals as the authority on what is in an account.

Dues are the one that touches another person's money, and a dues record naming who has not paid is sensitive within the organization, not only outside it — item 256's capability set is what keeps it to the treasurer.

# 268. Business user role

Verified local businesses can hold Semester Business profiles — restaurants, cafes, gyms, student services, retail, entertainment.

Capabilities: manage profile, hours, location, offers, events, student discounts, messages, analytics.

**Verified** is the whole role. A business profile is a commercial claim made to students on their university's app, and an unverified one is an advertisement anybody can place. Verification is Semester's assertion, like a tutor's in item 254, and it belongs to the same mechanism.

Analytics here must be aggregate. A business learning how many students viewed an offer is ordinary; a business learning which students did is a disclosure the student never agreed to.

# 269. Student discounts

Businesses can publish verified offers:

```
20% STUDENT DISCOUNT

Monday–Thursday
Valid student verification required
```

Track expiration. Display terms clearly.

An expired offer shown as live is the failure students will actually meet — at a counter, being told no — so expiry is a displayed field rather than a cleanup job. "Valid student verification required" is also a promise about item 293: it means the business expects Semester to be able to say this person is a student, and Semester may only say so where it genuinely knows.

# 270. Employer role

**Semester Recruit.** Employer capabilities: employer profile, jobs, internships, career events, applications where supported, student outreach under appropriate rules, and recruiting analytics.

Students retain privacy control. "Under appropriate rules" needs to be written down before outreach is built, because an employer messaging channel into a student body is the feature most likely to be abused by design rather than by accident. The defensible default is that students are reachable when they have applied or opted in, and that a student can stop it without leaving the platform.

`app/src/lib/career.ts` and `app/src/screens/Career.tsx` are the student's side of this and are already substantial; Recruit is the counterpart, and the two must share one representation of a role rather than each keeping its own.

# 271. Employer job management

The employer dashboard:

```
OPEN ROLES    DRAFTS    APPLICANTS
EVENTS        MESSAGES  ANALYTICS
```

A job requires a title, description, location, type, requirements, application process and deadline.

DRAFTS is a permission question as much as a state: a draft is visible to the employer's own staff and to nobody else, which is the third instance of resource-owned rather than user-owned content, after items 259 and 264.

# 272. University staff role

University staff accounts can represent offices and services — registrar, career center, housing, financial aid, student affairs, library, academic departments. Staff capabilities depend on the assigned office.

"Assigned office" is the scope, and it is what stops this role being an administrator. A housing staff account has housing's capabilities over housing's resources, and no view of a student's grades, because nothing granted it one.

# 273. University office admin

An office dashboard:

```
PROFILE    ANNOUNCEMENTS    EVENTS    RESOURCES
FORMS      APPOINTMENTS     FAQ       ANALYTICS
```

This gives university offices a direct Semester presence. FORMS and APPOINTMENTS are the two that need the work already named — an organization-owned form (item 259) and a two-party booking (item 249) — so an office is largely those two items plus a profile.

# 274. Department admin

Academic departments can manage a department profile, faculty, public course information, department events, advising information, resources and opportunities.

**Official institutional data must remain synchronized appropriately rather than being silently overwritten.** This is the sharpest instance of a rule the repository already enforces elsewhere: where an authoritative source exists, Semester holds a copy that can be refreshed, and a local edit to a synchronised field is either rejected or clearly marked as a local override. The failure to avoid is a department's edit winning silently until the next sync reverts it, which reads to everybody as data loss.

# 275. University admin role

University administrators must **not** automatically see private student activity. Their workspace emphasises aggregate operations:

```
UNIVERSITY OVERVIEW

ORGANIZATIONS    EVENTS    DEPARTMENTS    RESOURCES
VERIFICATION     ANNOUNCEMENTS
AGGREGATE ANALYTICS    INTEGRATIONS
```

This is the most important negative requirement in the document, and it is the one an implementation will drift out of without a guard, because every individual request for "just this one student's data" is reasonable in isolation.

Two things follow. Aggregate analytics must be aggregate in the query, not in the presentation — a dashboard that fetches rows and sums them client-side has already read the rows. And a university administrator is not a platform administrator: `private.is_app_admin()` is Semester's own staff, and a university admin holding it would have exactly the access this item refuses.

# 276. University announcements

Authorised university staff can publish campus notices, academic notices, registration reminders, weather-related operational notices, event information and service interruptions.

**Emergency alerts may only be represented as official where Semester has an authoritative integration or source.** An app that looks like it would tell you about an emergency and does not is worse than one that never claimed to, so the absence has to be legible: where Semester is not an emergency channel, it should say where the real one is rather than leaving a space an unofficial notice can fill.

# 277. Campus service role

Campus services may maintain profiles:

```
LIBRARY    DINING     TRANSPORTATION    RECREATION
HEALTH     IT         HOUSING           CAREER        REGISTRAR
```

Each can expose service-specific functionality. Several already have a student-facing reader in the app — `app/src/lib/meals.ts`, `app/src/lib/housing.ts`, `app/src/lib/maps.ts`, `app/src/lib/athletics.ts`, `app/src/lib/registrar.ts` — so this role is in most cases the authoring side of a screen that already exists, which is a smaller job than the list suggests and a good reason to do them one at a time.

HEALTH is the exception on that list and should be treated as one: anything a health service knows about a named student is the most sensitive data in the system, and a service profile — hours, location, how to be seen — needs none of it.

# 278. Library system

A Semester Library integration layer: library locations, hours, study spaces, catalogue search integration, research guides, librarians, reservations where supported, and saved resources.

**Do not claim a book is available unless backed by current library data.** Availability is the field a student acts on by walking across campus, so where the catalogue cannot be read live, the honest surface is a search that hands off rather than a result that guesses.

# 279. Study room reservations

Where university APIs support it:

```
FIND STUDY ROOM

Today, 4–6 PM, 4 people

Available:
  Central Library 214
  Science Library 302
```

A reservation must return a **real institutional confirmation**. Where it cannot, link to the official reservation system.

The failure this forbids is the one that costs a student a study session: a booking that succeeded in Semester and exists nowhere else. A confirmation shown must come from the system that holds the room.

# 280. Dining role and system

Campus dining: locations, hours, menus, dietary filters, current status, meal plan information, and mobile ordering links or integration.

**Do not claim real-time menu or availability without appropriate data.** `app/src/lib/meals.ts` is the existing reader and the place this rule has to hold, because "current status" is the kind of field that starts as a schedule lookup and gets described as live.

# 281. Meal plan dashboard

Where authorized data exists:

```
MEAL PLAN

Meals remaining    Dining dollars
Guest passes       Plan details
```

Sensitive financial and account information remains private. This is a balance, which makes it item 252's distinction again: a number Semester was told by the institution, never one it inferred, and never shared with a family member except through an accepted grant (item 245 and `family_grants`).

# 282. Campus transportation

Shuttle routes, stops, schedules, campus transportation information, and live vehicle data where available.

Route planning — *how do I get from Commons to Engineering before 2 PM?* — is the useful surface, and `app/src/lib/maps.ts` and `app/src/screens/Maps.tsx` are where it would live.

**Only claim live arrival information when backed by real-time data.** A scheduled time presented as an arrival is the same class of error as an available book: the student finds out at the stop.

# 283. Campus recreation

Gym hours, facilities, classes, intramurals, reservations, club sports, and facility capacity where legitimately available.

`app/src/lib/athletics.ts` and `app/src/screens/Athletics.tsx` exist. Capacity is the field with the caveat attached, for the same reason as every other live number in this section.

# 284. Intramural sports

An optional intramural system: teams, rosters, schedules, games, standings and registration.

**Do not duplicate official systems unnecessarily where integration is possible.** Intramurals are usually already run by a recreation department in a system of record, and a second set of standings is worse than none. Where a team is Semester's own, this is close to item 255's organization with a schedule attached, and should reuse it rather than grow a parallel membership model.

# 285. Housing admin and residential life

Housing profiles provide residence halls, staff contacts, events, resources, maintenance links, policies and move-in information.

**Private resident information must be protected.** Who lives where is the single most sensitive directory in a university, and a housing profile needs none of it to be useful. `app/src/lib/housing.ts` is the student-side reader today.

# 286. Resident assistant role

Where institutionally supported, an RA can manage limited community features: residence announcements, events, resources and community communication.

**RAs must not receive broad student administrative access.** An RA is a student, which makes this the clearest case for item 239's scoped roles: the same person is a resident of their building and an authority within it, and the second must not leak into a view of the first's neighbours. Whatever an RA can see about residents has to be enumerated deliberately, not inherited from a staff role.

# 287. Career center role

The career center can manage career events, resources, appointments, employer information, workshops and recruiting timelines, connected to Semester Career.

This office sits between students and the employers of item 270, which makes it the natural verifier of employer profiles — a university career center vouching for a recruiter is a stronger signal than Semester vouching alone.

# 288. IT services

An IT help center, searchable:

```
Wi-Fi    Password reset    Printing    VPN
Email    Software          Device support
```

Provide official resources. Where integrated, support ticket creation and status.

**Password reset is the one to be careful with.** A Semester screen that looks like a university password prompt is a phishing template, and the only safe shape is a link to the institution's own page — never a field in Semester that accepts an institutional credential.

# 289. Financial aid information

An informational Financial Aid workspace: office, deadlines, required forms, resources, appointments.

**Personal award data appears only through authorized integrations.** Deadlines and forms are public information and are most of the value; an award letter is not, and a workspace that shows the first well is worth building before the second is possible.

# 290. Student account and billing

Where legitimate integration exists, students may view balance, charges, payment deadlines and statements.

**Do not process tuition payments directly** unless an appropriate institutional or payment integration exists. Prefer routing to the official payment portal.

`app/src/screens/Bill.tsx` and `app/src/screens/Costs.tsx` are the existing surfaces. This is also where `family_grants` earns its design: `FamilyAccess` has a `payment` level that lets a payer pay and read nothing, which is exactly the authorized-payer relationship item 245 and `docs/INSTITUTIONAL_REQUIREMENTS.md` §24 describe, and it is already written and enforced.

# 291. Registrar workspace

Registrar information: registration, academic calendar, transcript, enrollment verification, graduation, forms, records, add/drop and withdrawal.

Semester should **translate complicated university processes into understandable workflows** — which is the sentence that makes this role worth building before any integration exists. `app/src/lib/registrar.ts` and `app/src/screens/Registrar.tsx` already do this for some processes, and explaining a withdrawal deadline correctly is valuable with no API at all.

# 292. Transcript request

```
I need a transcript
        ↓
Semester identifies the official process
        ↓
Shows the requirements
        ↓
Routes to the authorized transcript provider
```

**Do not pretend Semester generated an official transcript** unless institutionally authorized. `app/src/lib/transcript.ts` exists; the rule is that anything it produces is the student's own record of their own courses, and must not be presentable as an official document — which includes not looking like one.

# 293. Student ID system

Future institutional integration may expose a digital student ID, verification, and campus access where officially supported.

**Never create fake credentials or access passes.** This is the strongest prohibition in the document and it is not only about honesty: a convincing image of a student ID is a physical access credential, and a door or a dining hall that accepts a screen accepts a screenshot. Item 269's "valid student verification required" is the legitimate version — Semester answering *is this person a student* to a party that asked, where an institution told Semester so.

# 294. Platform moderator role

Moderators handle trust and safety:

```
REPORT QUEUE

USERS    MESSAGES    MARKETPLACE
EVENTS   HOUSING     ORGANIZATIONS
```

**Access is limited to the data required for moderation.** A moderator reviewing a reported message needs that message and its context, not the reporter's course list — and `public.reports` already anticipated part of this by storing `copy`, a copy of the reported message, "because a report about a deleted message is otherwise unreadable". That column is the pattern: give the queue what it needs, rather than a key to everything the report points at.

# 295. Moderation case system

Every report becomes a case:

```
reporter            reported_entity     category
description         evidence            status
assigned_moderator  resolution          timestamps
```

Statuses:

```
OPEN → UNDER_REVIEW → ACTION_REQUIRED → RESOLVED
                                      → DISMISSED
```

`public.reports` today has `reporter`, `about`, `message_id`, `reason`, `copy` and `created_at`. It has no status, no category, no assignee and no resolution — so it is a place reports arrive, not a queue anything can be worked from, and a report filed today is read by nobody and answered never.

Two fields deserve a decision rather than a default. `reported_entity` has to be polymorphic — a user, a message, a listing, an event, an organization — and the honest options are a column per kind or a kind plus an id; the second is smaller and the first is what a foreign key can enforce. And `evidence` must be captured at report time, like `copy` already is, because a reported listing gets edited the moment its author suspects a report.

# 296. Moderation actions

Depending on permission: warning, content removal, temporary restriction, account suspension, verification removal.

**Actions create audit logs.** Note that this list is itself graduated — a warning and an account suspension should not be the same permission — which is item 299's matrix arriving inside a single role.

The audit log has a standard to meet, and `public.access_log` sets it: the minimum that answers the question, in fields with closed vocabularies. A moderation log's closed vocabulary is this list of five, plus who acted, on what, and when — and unlike the access log, this one needs a timestamp rather than a day, because "which of two moderators acted first" is a question somebody will genuinely have to answer.

# 297. Platform admin

Platform admins manage Semester itself: university configuration, feature flags, integration status, roles, moderation, platform settings, system health, data import and analytics.

**Avoid giving admins unnecessary direct access to private content.** Every capability in that list is about the platform's own configuration, and none of them requires reading a student's notes. The current `private.is_app_admin()` is a single answer for all of it, and splitting it is item 299.

# 298. Superadmin safety

Highly privileged actions require stronger controls: changing a user's role, suspending an administrator, modifying a university integration, deleting a university, exporting sensitive data.

Consider re-authentication, audit logs, confirmation, and restricted permissions.

What makes these five different from the rest is not their blast radius but that each one is **an action taken on the system's own trust machinery**. Changing a role is granting permission; suspending an administrator is removing it; exporting sensitive data is the one action that cannot be undone by any subsequent action, because the data is already out.

Re-authentication is the control worth insisting on, because it is the only one on that list that defends against the realistic attack: not a malicious administrator, but a borrowed session.

# 299. Permission matrix

Implement **permissions**, not interface assumptions:

```
USER
  profile:read
  profile:update:self

ORGANIZATION_OFFICER
  organization:read
  event:create
  event:update

ORGANIZATION_ADMIN
  organization:update
  member:manage
  application:manage

MODERATOR
  report:read
  moderation:action

PLATFORM_ADMIN
  platform:configure
```

Maintain permission definitions **centrally**.

Three notes on where that central place is, given what the repository already has:

- There are currently two screen gates and neither is a permission, which both say so in their own comments: `allowed` in `app/src/lib/school.ts` decides whether a school has a feature at all, and `forRole` in `app/src/lib/role.ts` decides whether a screen is addressed to this person. `lib/role.ts` states the rule plainly — "this file will be what the client asks for, never what grants it" — and the permission matrix must not be built on top of either, because a third client-side gate is not an authorization model.
- The definitions belong somewhere both halves can read. `packages/contract` and `packages/institution` exist for exactly that reason, and `UNIVERSITY_ROLES` already lives in the second one.
- The matrix has to be enforced in Postgres, because that is where the data is and row-level security is what protects it. The repository has seventeen policy suites under `supabase/*.check.sql` asserting what each role can and cannot reach; a permission matrix that is not expressed as policies is a matrix nothing checks, and `grants.check.sql`'s allowlist is the pattern — every reachable function named deliberately, so a new one is refused until somebody decides which side it is on.

# 300. Resource-level authorization

Permissions must consider the **resource**. An organization admin can edit Finance Club and not Consulting Club. Faculty can manage their authorized course and not every university course.

**Always verify resource ownership and membership server-side.**

The repository has two working instances to copy, and they are both security-definer predicates a policy reads:

- `private.in_group(want_group uuid)` — whether the caller is in this group. Its comment records why the pattern exists: so the policy on `group_members` does not have to read `group_members` and deadlock on itself.
- `allowsFamilyRequest(grant, request)` — whether one grant permits one operation on one resource, right now. Written deliberately as a single predicate with no partial results, "because an authorization that can be half-computed is one a caller can use half of."

A general version answers one question — *may this person do this thing to this resource* — and returns one boolean. Every dashboard in this document is then a query over what that predicate permits, rather than a place where the question is asked again in a different way.

**Built**, as `private.holds_role(want_role, want_scope_kind, want_scope_id)` in `supabase/migrations/20260921223000_role_grants.sql`. It answers the narrower question — does this person hold this role over this scope, right now — because the capability mapping is item 299 and is not written yet; a capability check is built *on* this answer rather than instead of it. Live only: a revoked or expired grant is absent inside the predicate rather than at the call sites, since the call site that forgets is the one nobody finds. In `private` for the reason `is_app_admin()` is, and `grants.check.sql` independently fails on a `public` twin — measured by moving it there and watching that suite go red, not assumed.

# 301. Impersonation and support mode

If support impersonation is ever implemented, it must be highly controlled:

- a specific support permission, held by few
- a recorded **reason**, entered per session
- an audit log
- a clear UI banner

The right amount of this to have built today is none, which is what exists. When it is built, the property that matters is that impersonation is **visible from the other side**: a student should be able to find out that their account was accessed, because a support mode only the support team can see is indistinguishable from an undisclosed one.

The banner is not decoration either. It is what stops a support engineer forgetting whose account they are in and taking an action the student will be told they took themselves.

# Sequencing

Four things come first, and everything else in this document reads or writes them. **The first two are built**; the remaining two are unchanged and are now the front of the queue.

1. ~~**The grant row** (item 239)~~ — **done.** `public.role_grants`, in `supabase/migrations/20260921223000_role_grants.sql`. Person, role, scope, provenance, expiry, revocation; no write route through the API.
2. ~~**The predicate** (item 300)~~ — **done.** `private.holds_role()`, in the same migration, with `supabase/rolegrants.check.sql` as the suite.
3. **Persisting what the LTI launch already says** (items 246–250, 274) — the only institutionally-vouched role data the platform receives, currently discarded per request. Every faculty, TA, advisor and department item is blocked on it, it is the smallest of the four, and it now has somewhere to be written to: a launch carrying `Instructor` becomes a `faculty` grant over that course with `provenance = 'institution'`.
4. **Splitting `private.is_app_admin()`** into named capabilities (items 294–299) — before, not after, the moderator queue and the platform dashboard are built against it, because both will otherwise be written to ask a boolean. `role_grants` can already carry `moderator` and `platform_admin`; what is missing is the capability map of item 299 and the migration that moves the existing admin rows onto it.

After those, the roles that need no institutional integration are the ones to build first, because they exercise the whole architecture without waiting on anybody: **tutor** (item 254) and **organization officer and admin** (items 255–258). Both are students holding a second role over a scope, which is item 239's case in its most ordinary form.

Deferred deliberately, and each for a stated reason rather than for effort: prospective student (item 242) until there is a published-data source; elections (266) until organizations exist to hold them; digital ID (293) until an institution authorises it and never before; impersonation (301) until there is a support team to control.

# The refusals worth keeping

Eighteen of these sixty-three items state a prohibition, collected here as twelve rules. They are the ones that will be under pressure, because each is a thing the app could appear to do sooner than it can do it — and each is easiest to break by building something that works:

| Item | The refusal |
|---|---|
| 239 | No global `isAdmin` boolean |
| 242 | Prospective users see no private enrolled-student data |
| 248 | No silent alteration of official LMS announcements |
| 250 | TA access does not include institutional grades by default |
| 253 | Private advising notes are never accidentally exposed |
| 263 | No hidden location-based attendance tracking |
| 266 | No claim of cryptographic or election-grade security |
| 267 | Not a bank |
| 274 | Institutional data is synchronised, never silently overwritten |
| 275 | University admins do not see private student activity |
| 276, 278–280, 282–283 | Nothing is called live, available or official without a real source behind it |
| 292–293 | No official transcript and no credential Semester is not authorised to issue |

The last two rows are the same rule the repository already applies to campus data, and `app/src/lib/role.ts` states the general case better than a list can: shipping a role as screens that look right and hold only what you typed into them would be "a confident thing that is not true."
