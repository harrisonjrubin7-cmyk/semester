# Semester Connect Register

<!-- Rendered from app/src/lib/connectregister.ts, app/src/community/connect.ts and app/src/lib/gtm/social.ts by connectregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Every addition the community brief of 29 September 2026 asks for — ten in
the app, six on the company site, the social media ecosystem, the fourteen
controls it wants before broad social functions, and the order it wants
them built — and where the repository stands on each. Most of what it asks
for in the app is an item of the [communities
register](COMMUNITIES-REGISTER.md) under another name; a row here names the
item it overlaps rather than restating it.

**Positioning:** Semester Connect: the trusted network for campus life, learning, opportunity, and belonging.

**What it helps a student answer:**

- Who else is taking this course or preparing for this exam?
- Where can I find a study group, mentor, club, event, or campus community?
- What opportunities fit my interests, skills, pathway, or goals?
- How can I contribute a project, question, recommendation, or useful resource?
- Which people or organizations can help me take the next step?

**The distinction:**

| Avoid | Build instead |
| --- | --- |
| An endless, engagement-driven feed | Relevant updates connected to courses, interests, goals and campus moments |
| Anonymous broad chat | Verified, opt-in, contextual community spaces |
| Student popularity rankings | Discovery, contribution and helpfulness without public comparison |
| Social activity used for risk scoring | Private, student-controlled participation only |
| Open direct messages between anyone | Consent-based requests, group channels and safe boundaries |
| A generic “friends” network | Study groups, clubs, cohorts, mentors, project teams and professional connections |

Statuses were assessed against `origin/main` at `8f4d38b`; a test holds each
to the kind of file it cites. Nothing is above `tested`, because nothing has
an artifact under `docs/evidence/`.

## Where it stands

| Area | Where | Items | not-started | designed | building | tested |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| [HUB](#hub) The Semester Connect hub | In the app | 6 | 0 | 0 | 2 | 4 |
| [VCC](#vcc) Verified campus communities | In the app | 7 | 0 | 0 | 5 | 2 |
| [CSC](#csc) Course-based study communities | In the app | 8 | 0 | 0 | 1 | 7 |
| [PMN](#pmn) Peer mentor network | In the app | 4 | 0 | 0 | 1 | 3 |
| [APN](#apn) Alumni and professional network | In the app | 4 | 1 | 0 | 0 | 3 |
| [SHW](#shw) Project and portfolio showcase | In the app | 4 | 0 | 0 | 1 | 3 |
| [MAP](#map) Community discovery map | In the app | 3 | 0 | 0 | 2 | 1 |
| [CHL](#chl) Community challenges and milestones | In the app | 4 | 0 | 0 | 0 | 4 |
| [ROM](#rom) Safe collaboration rooms | In the app | 4 | 0 | 0 | 1 | 3 |
| [REP](#rep) Community contribution reputation | In the app | 4 | 0 | 0 | 0 | 4 |
| [CSP](#csp) The Semester Community page | On the company site | 3 | 0 | 0 | 0 | 3 |
| [AMB](#amb) Campus ambassador programme | On the company site | 4 | 0 | 1 | 0 | 3 |
| [STO](#sto) Student creator and story programme | On the company site | 2 | 0 | 0 | 0 | 2 |
| [LIB](#lib) Community resource library | On the company site | 3 | 0 | 0 | 0 | 3 |
| [PDR](#pdr) Partner community directory | On the company site | 3 | 0 | 0 | 0 | 3 |
| [EVC](#evc) Events and livestream center | On the company site | 2 | 1 | 0 | 0 | 1 |
| [SME](#sme) Social media ecosystem | The plan around both | 4 | 0 | 0 | 0 | 4 |
| [CTL](#ctl) Required controls before broad social functions | The controls | 14 | 0 | 0 | 0 | 14 |
| **total** | | **83** | **2** | **1** | **13** | **67** |

## The register

### HUB

**The Semester Connect hub.** Connect appears inside Search, the campus hub and Me as a contextual experience, never as a sixth permanent navigation destination. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| HUB-001 | Not a sixth root: the hub lives inside screens that exist | tested | `app/src/community/connect.ts` — HUB_HOMES: search, community, me<br>`app/src/community/connect.test.ts` — no root and no destination is a hub<br>`docs/DO-NOT-BUILD.md` — rule 1 | Drawn on the Community screen only; Search and Me do not draw it yet. | — |
| HUB-002 | The hub answers the brief’s five questions from screens a student already has | tested | `app/src/community/connect.ts` — HUB_SECTIONS: eleven, eight with a screen<br>`app/src/components/ConnectHub.tsx` — the rows<br>`app/src/screens/Community.tsx` — drawn whether or not Community is switched on<br>`app/src/community/connect.test.ts` — every question has a section with a screen | Three sections have no screen: the showcase, the verified-communities list, and saved things in one place. | — |
| HUB-003 | Recommended events, clubs, study groups, mentors, projects and opportunities | building | `app/src/community/feed.ts` — why each post is shown<br>`app/src/lib/mentors.ts` — matchMentors on ticked interests only | No community, event or opportunity recommender exists; the hub is rows that open screens, which need no reason. | [DSC-011](COMMUNITIES-REGISTER.md#dsc), [LPS-002](COMMUNITIES-REGISTER.md#lps) |
| HUB-004 | Every recommendation discloses why it appeared: “Recommended because you saved…, are enrolled in…, and opted into…” | tested | `app/src/community/connect.ts` — explainSuggestion, SUGGESTION_INPUTS<br>`app/src/community/connect.test.ts` — the sentence; every forbidden input refused by key<br>`docs/DO-NOT-BUILD.md` — rule 3 | The sentence exists before the recommender that will need it. | — |
| HUB-005 | “People you may want to meet” from student-controlled interests, never private performance or hidden profiling | tested | `app/src/community/connect.ts` — FORBIDDEN_SUGGESTION_INPUTS: grade, attendance, risk label, disability, health, financial, AI history, messages, usage<br>`app/src/community/connect.test.ts` — held<br>`app/src/community/circles.ts` — FORBIDDEN_INPUTS for a circle | No people suggestion exists; the refusal is what any will be held to. | [DSC-010](COMMUNITIES-REGISTER.md#dsc) |
| HUB-006 | Saved communities, events, people and opportunities in one place | building | `app/src/components/CampusDirectory.tsx` — a saved star, on the device<br>`app/src/lib/opportunities.ts` — the tracker | Two kinds of saved thing in two places; nothing gathers them. | — |

### VCC

**Verified campus communities.** Every approved organization, department, lab, office and cohort gets a verified space with a named owner, eligibility, events, contacts, resources, visibility and moderation. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| VCC-001 | A space for every kind: organizations, residence halls, departments, labs, honors and learning communities, cohorts, cultural and professional groups, career and alumni, campus offices | building | `supabase/migrations/20260928032000_community.sql` — `communities.kind`: course, study_group, student_organization, career_alumni, peer_mentorship, support<br>`app/src/community/services.ts` — the campus service directory’s rules | Six kinds; no residence hall, department, lab, learning community or office kind. | [DSC-001](COMMUNITIES-REGISTER.md#dsc), [SRV-002](COMMUNITIES-REGISTER.md#srv) |
| VCC-002 | Verified name and an accountable owner on every space | building | `supabase/migrations/20260928032000_community.sql` — `communities.verification` | No owner or advisor column anywhere (communities register DSC-004). | [DSC-003](COMMUNITIES-REGISTER.md#dsc), [DSC-004](COMMUNITIES-REGISTER.md#dsc) |
| VCC-003 | Description, mission, eligibility and accessibility information | building | `supabase/migrations/20260921230000_organizations.sql` — `about`, 400 characters | Of the profile fields the brief lists, a name and an about exist. | [ORG-002](COMMUNITIES-REGISTER.md#org) |
| VCC-004 | Upcoming events with RSVP or an official sign-up handoff | tested | `supabase/migrations/20260928032000_community.sql` — community_sessions with places; approved venues only<br>`supabase/community.check.sql` — held | Study sessions only; no organization event. | [EVT-003](COMMUNITIES-REGISTER.md#evt), [EVT-004](COMMUNITIES-REGISTER.md#evt) |
| VCC-005 | Public, campus-only, member-only or invite-only visibility | building | `supabase/migrations/20260921230000_organizations.sql` — `organizations.listed`; apply_to_organization<br>`supabase/migrations/20260928032000_community.sql` — join_community admits instantly | Two of the four; a community has no join policy. | [DSC-005](COMMUNITIES-REGISTER.md#dsc) |
| VCC-006 | Moderation and reporting controls on every space | tested | `supabase/migrations/20260928032000_community.sql` — report_community_post, block_community_author, appeal_community_decision<br>`app/src/community/moderation.ts` — the queue<br>`app/src/community/moderation.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | [SAF-001](COMMUNITIES-REGISTER.md#saf) |
| VCC-007 | Calendar integration and Action Center reminders for a community’s events | building | `app/src/lib/notify.ts` — the reminder engine<br>`app/src/lib/connect.ts` — addEvent to a linked calendar after a tap | No event rule in NOTIF_DEFS; calendar writes cover deadlines and classes. | [EVT-002](COMMUNITIES-REGISTER.md#evt), [EVT-007](COMMUNITIES-REGISTER.md#evt) |

### CSC

**Course-based study communities.** Students learn together without exposing grades, activity tracking or private materials, and only after opting in. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| CSC-001 | Course-section spaces with discussion and question-and-answer threads | tested | `supabase/migrations/20260928032000_community.sql` — course communities; posts<br>`app/src/community/questions.ts` — the source-labelled answer rules<br>`app/src/community/questions.test.ts` — held | Questions have a rule and no screen. | [QNA-001](COMMUNITIES-REGISTER.md#qna) |
| CSC-002 | “Looking for a study partner”, study-group creation with topic, time and place or link, shared review-session planning | tested | `app/src/screens/Community.tsx` — Start a study group<br>`app/src/components/community/Sessions.tsx` — sessions with 2–12 places<br>`app/src/community/circles.ts` — StudyPlan<br>`app/src/community/circles.test.ts` — held | A group is a name and a purpose; the plan has nowhere to live. | [CIR-005](COMMUNITIES-REGISTER.md#cir) |
| CSC-003 | Who else is taking this course | tested | `app/src/lib/classmates.ts` — rooms per course and term; a profile you choose<br>`app/src/lib/classmates.test.ts` — held<br>`supabase/classmates.check.sql` — a stranger to the class sees nothing | Held in code; nothing under docs/evidence/ shows it operating. | — |
| CSC-004 | Opt in before becoming visible; show only first name, programme, preferred times, topic and accessibility preferences | tested | `app/src/community/identity.ts` — three identities kept apart; peers see the presentation layer only<br>`app/src/community/identity.test.ts` — held<br>`docs/COMMUNITY-PRIVACY-MODEL.md` — the model | Preferred study times and accessibility preferences are not fields of the presentation identity. | [PRV-001](COMMUNITIES-REGISTER.md#prv) |
| CSC-005 | Never grades, attendance, disability status, private notes, schedule or risk labels | tested | `app/src/community/circles.ts` — NEVER_SHARED<br>`app/src/community/circles.test.ts` — held<br>`supabase/migrations/20260928032000_community.sql` — nothing reads a location, a schedule or a grade | Held in code; nothing under docs/evidence/ shows it operating. | [CIR-006](COMMUNITIES-REGISTER.md#cir) |
| CSC-006 | Not a channel for prohibited answers to active graded work | tested | `supabase/migrations/20260928032000_community.sql` — `communities.integrity_policy`<br>`app/src/community/circles.ts` — INTEGRITY_REMINDER<br>`app/src/community/circles.test.ts` — held | A policy and a reminder; no detector, by design. | [CIR-006](COMMUNITIES-REGISTER.md#cir) |
| CSC-007 | Instructors do not automatically see peer discussion or study activity | tested | `supabase/migrations/20260928032000_community.sql` — no faculty read policy on posts or sessions<br>`supabase/community.check.sql` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |
| CSC-008 | Office-hours reminders and tutoring discovery | building | `app/src/lib/nowrongdoor.ts` — describe the problem, be sent to tutoring<br>`app/src/community/services.ts` — the service directory rules | No office-hours object to remind about. | [SRV-002](COMMUNITIES-REGISTER.md#srv) |

### PMN

**Peer mentor network.** An intentional, structured, time-limited mentor flow rather than “message anyone”. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| PMN-001 | Mentor kinds: first-year, transfer, department, international, athlete, graduate, career, study-abroad, alumni, peer tutor | tested | `app/src/community/connect.ts` — MENTOR_KINDS<br>`app/src/community/mentorship.ts` — PROGRAMS: seven programmes with a purpose, a length and a scope<br>`app/src/community/mentorship.test.ts` — held | Rosters know peer and alumni; the kinds are programmes, not roster types. | [MNT-003](COMMUNITIES-REGISTER.md#mnt) |
| PMN-002 | Goal → verified opt-in mentors → structured request → accept or decline → time-limited space → agenda → meet → expires or continues by consent | tested | `app/src/community/connect.ts` — MENTOR_FLOW<br>`supabase/migrations/20260928021700_mentor_rosters.sql` — only the recipient accepts; capacity at acceptance; 180 days at most<br>`supabase/mentor-rosters.check.sql` — held<br>`app/src/components/MentorFinder.tsx` — find, ask, answer | The connection space, the agenda and the follow-up actions have no screen. | [MNT-001](COMMUNITIES-REGISTER.md#mnt), [MNT-002](COMMUNITIES-REGISTER.md#mnt), [MNT-006](COMMUNITIES-REGISTER.md#mnt), [MNT-008](COMMUNITIES-REGISTER.md#mnt) |
| PMN-003 | A mentor sees only what the student intentionally shares: never the full plan, grades, private notes, financial, medical or AI data | tested | `app/src/community/connect.ts` — MENTOR_NEVER_SEES<br>`app/src/community/mentorship.ts` — FORBIDDEN_MATCH_INPUTS; what a coordinator sees<br>`app/src/community/mentorship.test.ts` — held<br>`supabase/migrations/20260928021700_mentor_rosters.sql` — a request carries topics and a note, nothing else | Held in code; nothing under docs/evidence/ shows it operating. | [MNT-007](COMMUNITIES-REGISTER.md#mnt), [MNT-010](COMMUNITIES-REGISTER.md#mnt) |
| PMN-004 | Both can schedule, meet and record follow-up actions | building | `app/src/lib/connect.ts` — addEvent, addTask to a linked calendar | Nothing ties a meeting to a mentorship. | — |

### APN

**Alumni and professional network.** A student’s university network belongs inside Career and Portfolio, with employer access only for students who opted in, time-limited, and every view visible. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| APN-001 | Verified alumni directory with opt-in participation and alumni mentor offers | tested | `supabase/migrations/20260928021700_mentor_rosters.sql` — alumni rosters, opt-in<br>`app/src/screens/Opportunities.tsx` — the alumni mentor finder<br>`supabase/mentor-rosters.check.sql` — held | A roster, not a directory: no career-path story, no industry community. | [NET-003](COMMUNITIES-REGISTER.md#net) |
| APN-002 | Internship, job, fellowship, scholarship and research opportunities | tested | `app/src/lib/listings.ts` — moderated listings, arranged by deadline only<br>`app/src/lib/listings.test.ts` — held<br>`app/src/lib/opportunities.ts` — the tracker | Held in code; nothing under docs/evidence/ shows it operating. | [OPP-001](COMMUNITIES-REGISTER.md#opp) |
| APN-003 | Employer access only by opt-in, time-limited, with every profile view visible to the student | tested | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — talent_profiles opt-in expires at 180 days; talent_profile_views<br>`supabase/expansion.check.sql` — held | No student screen for the profile or its views. | [NET-004](COMMUNITIES-REGISTER.md#net) |
| APN-004 | Career-path stories, ask-for-advice with structured topics, career office hours, employer events, resume and portfolio feedback, “who can help?” discovery | not-started | — | None of these objects exists; the register records the ask. | — |

### SHW

**Project and portfolio showcase.** A student-controlled space to share work, each item with a chosen visibility, never auto-published and never inferred. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| SHW-001 | Twelve kinds of work a student can publish from their record | tested | `app/src/community/connect.ts` — SHOWCASE_KINDS<br>`app/src/community/connect.test.ts` — held<br>`app/src/lib/career-evidence.ts` — the private save | Evidence is saved; nothing publishes it. | [OPP-005](COMMUNITIES-REGISTER.md#opp), [OPP-006](COMMUNITIES-REGISTER.md#opp) |
| SHW-002 | Visibility ladder: private, advisor, group, campus-only, public portfolio, approved employers | tested | `app/src/community/connect.ts` — SHOWCASE_VISIBILITY, VISIBILITY_MEANS, publish, visibleAs<br>`app/src/community/connect.test.ts` — only the student publishes; employers only while a talent profile is on; expired or unparseable opt-in becomes private | A rule with no table or screen. | — |
| SHW-003 | Never auto-published; never a portfolio claim inferred from coursework | tested | `app/src/community/connect.ts` — newShowcaseItem is private; publishedWithoutChoice; NEVER_INFERRED<br>`app/src/community/connect.test.ts` — a planted public item is caught | Held in code; nothing under docs/evidence/ shows it operating. | — |
| SHW-004 | Each item connected to verified or student-confirmed skills, coursework, goals and career interests | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — skill_records: self-reported → verification requested → verified or declined | Skills verify; nothing links an item to one. | [OPP-005](COMMUNITIES-REGISTER.md#opp) |

### MAP

**Community discovery map.** One visual map of clubs, departments, events, offices, fairs, volunteering, study spaces and jobs, filterable, every listing with a source, an owner, a review date and an official handoff. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| MAP-001 | A campus map a student can open | tested | `app/src/lib/maps.ts` — hand a destination to a map app<br>`app/src/lib/maps.test.ts` — held<br>`app/src/screens/Maps.tsx` — the screen | Places, not communities: nothing on the map is a club, an event or an office listing. | — |
| MAP-002 | Filters: interest, major, career field, location, date, accessibility, format, cost, opt-in community, “fits my schedule” | building | `app/src/components/CampusDirectory.tsx` — free-text search and a category select | Two filters of eleven. | [DSC-002](COMMUNITIES-REGISTER.md#dsc) |
| MAP-003 | Source, official owner, last-reviewed date and an official handoff on every listing | building | `app/src/lib/campusdirectory.ts` — url and contact per listing; the import date<br>`app/src/lib/provenance.ts` — source, scope and status as one shape | No owner or review date per listing. | [DSC-004](COMMUNITIES-REGISTER.md#dsc), [DSC-008](COMMUNITIES-REGISTER.md#dsc) |

### CHL

**Community challenges and milestones.** Optional participation around real outcomes, private by default, with recognition and never a public comparison. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| CHL-001 | Eleven challenges, each an outcome: plan your first term, registration readiness, study with intention, portfolio week, an event, three clubs, mentor welcome, career fair, transfer onboarding, reflection, Semester Wrapped | tested | `app/src/community/connect.ts` — CHALLENGES<br>`app/src/community/connect.test.ts` — every challenge is an outcome<br>`app/src/lib/wrapped.ts` — Semester Wrapped<br>`app/src/lib/wrapped.test.ts` — held | Wrapped exists; the other ten are named and nothing walks them. | [LPS-007](COMMUNITIES-REGISTER.md#lps) |
| CHL-002 | Rewards: completion badges, campus-recognised certificates, portfolio evidence, verified participation, event access, campus perks only where a school offers them | tested | `app/src/community/connect.ts` — REWARDS<br>`app/src/community/governance.ts` — ALLOWED_MECHANICS: verified badges need issuer, criteria, evidence and a correction path<br>`app/src/community/governance.test.ts` — held | No badge or issuer entity. | [LPS-006](COMMUNITIES-REGISTER.md#lps) |
| CHL-003 | No public comparison: no leaderboard, no streak, no table of study time, grades, popularity or productivity | tested | `app/src/community/connect.ts` — CHALLENGE_RULES, milestoneLine<br>`app/src/community/connect.test.ts` — a count of one student’s steps and nobody else’s<br>`app/src/community/engagement.test.ts` — the forbidden words never reach a student | Held in code; nothing under docs/evidence/ shows it operating. | [LPS-008](COMMUNITIES-REGISTER.md#lps) |
| CHL-004 | Participate privately, opt out, or share only selected milestones | tested | `app/src/community/connect.ts` — CHALLENGE_RULES<br>`app/src/lib/wrapped.ts` — goes nowhere unless the student sends it<br>`app/src/lib/wrapped.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |

### ROM

**Safe collaboration rooms.** A room combines agenda, actions, files, meetings, notes, threads and a timeline around a real purpose, with an explicit member list and clear closure rules. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| ROM-001 | Ten parts of a room and six purposes; a room about nothing is refused | tested | `app/src/community/connect.ts` — ROOM_PARTS, ROOM_PURPOSES, openRoom<br>`app/src/community/connect.test.ts` — every broken bound named | A rule; no room object stores the parts together. | — |
| ROM-002 | Explicit member list, a lead, an end date and an archive-or-delete rule | tested | `app/src/community/connect.ts` — openRoom: two members, a lead, an end within a year, a closure<br>`app/src/community/connect.test.ts` — held<br>`supabase/migrations/20260928032000_community.sql` — community_members: your own rows only | Held in code; nothing under docs/evidence/ shows it operating. | — |
| ROM-003 | Group-project rooms today: parts, owners and pace | tested | `app/src/lib/groupwork.ts` — parts, standing, pace<br>`app/src/lib/groupwork.test.ts` — held<br>`supabase/groups.check.sql` — held<br>`app/src/screens/Groupwork.tsx` — the screen | Parts and a chat; no agenda, files, meetings, notes or timeline in the same place. | — |
| ROM-004 | Study-group and organization rooms | building | `supabase/migrations/20260928032000_community.sql` — study_group and student_organization communities with posts and sessions | A community with posts is the nearest thing; nothing there has actions, files or a closure rule. | [CIR-002](COMMUNITIES-REGISTER.md#cir) |

### REP

**Community contribution reputation.** Recognition rewards helpfulness, not popularity: modest, hideable, human-verified for anything meaningful, never a ranking and never an inference of ability. In the app.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| REP-001 | Eleven contribution signals, each with the verifier that may vouch for it | tested | `app/src/community/connect.ts` — CONTRIBUTION_SIGNALS, recognise<br>`app/src/community/connect.test.ts` — a self-declared badge is refused | No badge is stored anywhere. | [LPS-006](COMMUNITIES-REGISTER.md#lps) |
| REP-002 | No follower count as the measure, no public ranking, no inference of academic ability or eligibility | tested | `app/src/community/connect.ts` — NOT_A_MEASURE<br>`app/src/screens/Community.tsx` — no vote total, follower count or karma score, by design<br>`app/src/community/feed.ts` — twenty posts, chronological, why each is shown<br>`app/src/community/feed.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |
| REP-003 | Students can hide recognition from their public profile | tested | `app/src/community/connect.ts` — hide, shown<br>`app/src/community/connect.test.ts` — a hidden recognition is not shown | No public profile draws recognition yet. | — |
| REP-004 | Human review or a verified organization role behind every meaningful badge | tested | `app/src/community/connect.ts` — recognise refuses the wrong verifier<br>`supabase/migrations/20260921230000_organizations.sql` — officer capabilities as a set<br>`supabase/organizations.check.sql` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |

### CSP

**The Semester Community page.** The website as a community-growth engine: one page that speaks to students, organizations, mentors and alumni, educators, ambassadors and institutions, with a real next step for each. On the company site.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| CSP-001 | /community/: six audiences, each with what Semester offers them | tested | `app/src/site/community.tsx` — Community: AUDIENCES<br>`app/src/site/site.test.tsx` — the route is built; every link is real | Held in code; nothing under docs/evidence/ shows it operating. | — |
| CSP-002 | Seven calls to action, each leading to a page or a person: join, become an ambassador, register an organization, become a mentor, partner, apply for a pilot | tested | `app/src/site/community.tsx` — CALLS<br>`app/src/site/site.test.tsx` — links only to real pages, the app, or mail | Register, mentor and partner are a mail with a subject; no form. | — |
| CSP-003 | The page says what the community layer is not, and that no community programme is switched on for any campus today | tested | `app/src/site/community.tsx` — INSTEAD printed; the programme line<br>`app/src/site/site.test.tsx` — the sentence is held<br>`supabase/migrations/20260928032000_community.sql` — community_programs default false | Held in code; nothing under docs/evidence/ shows it operating. | — |

### AMB

**Campus ambassador programme.** Early campus density and authentic social proof, from ambassadors with a code of conduct, training, defined time, recognition, a private community and no access to other students’ data. On the company site.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| AMB-001 | /community/ambassadors/: what an ambassador does, what they get, and the boundaries | tested | `app/src/site/community.tsx` — Ambassadors<br>`app/src/site/site.test.tsx` — held | Applications are a mail; the programme opens with the first campus pilot. | — |
| AMB-002 | Never paid per sign-up; a referral link produces two numbers and nothing else | tested | `app/src/lib/referral.ts` — how many came in, how many are still here<br>`app/src/lib/referral.test.ts` — held<br>`supabase/referrals.check.sql` — what one account may learn about another<br>`docs/LAUNCH-CONTENT-AND-TRAINING.md` — the ambassador kit waits on the pilot | The disclosure text and any stipend structure are not written (expansion register ETH-003). | — |
| AMB-003 | No access to other students’ records or private data | tested | `supabase/referrals.check.sql` — an ambassador sees counts, never a person<br>`docs/DO-NOT-BUILD.md` — rule 10 | Held in code; nothing under docs/evidence/ shows it operating. | — |
| AMB-004 | Code of conduct, training, time expectations, recognition, private ambassador community | designed | `app/src/site/community.tsx` — the page says each<br>`docs/LAUNCH-CONTENT-AND-TRAINING.md` — the ambassador kit, not started<br>`app/src/lib/launch/content.ts` — ambassador_kit: NOT_STARTED | Said on the page; none of it exists as a document an ambassador signs or a space they join. | — |

### STO

**Student creator and story programme.** Authentic, permission-based content around real campus journeys, with a submission and consent process the student controls. On the company site.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| STO-001 | /community/stories/: eight prompts and the consent choices — anonymous, attributed, campus-only or public | tested | `app/src/site/community.tsx` — Stories: PROMPTS, CONSENT<br>`app/src/site/site.test.tsx` — held | Submission is a mail; no form, no story published yet. | — |
| STO-002 | Never private student data, grades, plans or messages in marketing without explicit written permission | tested | `app/src/lib/gtm/social.ts` — NEVER_IN_MARKETING<br>`app/src/lib/gtm/social.test.ts` — held<br>`docs/DO-NOT-BUILD.md` — rule 10<br>`app/src/donotbuild.test.ts` — no ad or tracking host in the source | Held in code; nothing under docs/evidence/ shows it operating. | — |

### LIB

**Community resource library.** A public, searchable library that attracts students before they sign up, each resource leading into the app: use it free, save it, turn it into a plan, add deadlines, share with an advisor. On the company site.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| LIB-001 | The library on /resources/: fifteen resources, five that exist as tools today and ten named as being written | tested | `app/src/site/pages.tsx` — Resources: LIBRARY<br>`app/src/site/site.test.tsx` — every link real | Ten of fifteen are not written; each says so rather than linking to a placeholder. | — |
| LIB-002 | Registration checklist, advisor meeting agenda, schedule builder, graduation timeline and the navigation diagnostic, free and sending nothing | tested | `app/src/site/tools/Tools.tsx` — TOOL_LIST<br>`app/src/site/site.test.tsx` — connect-src none on every tool page | Held in code; nothing under docs/evidence/ shows it operating. | — |
| LIB-003 | Use it free → save to Semester → turn it into a plan → deadlines in the Action Center → share with an advisor or mentor | tested | `app/src/lib/gtm/social.ts` — the registration funnel<br>`app/src/lib/gtm/social.test.ts` — every step is a route or a screen | Saving a tool’s result into an account is a sign-up, not a handoff of the result. | — |

### PDR

**Partner community directory.** A verified directory of organizations, nonprofits, alumni groups, employers, scholarship providers, labs, departments, mentorship, transfer and study-abroad partners, and local businesses, with verification labels and rules that never let paid visibility pass for official. On the company site.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| PDR-001 | /community/partners/: the twelve kinds, the four labels, and the rules | tested | `app/src/site/community.tsx` — Partners: KINDS, LABELS, RULES<br>`app/src/site/site.test.tsx` — held | The directory is empty and says so; no partner is listed. | — |
| PDR-002 | Verification labels that match what the database can say | tested | `supabase/migrations/20260928032000_community.sql` — `verification`: institution_verified, organization_verified, faculty_approved, student_created<br>`supabase/community.check.sql` — held | No partner or independent value yet (communities register DSC-003). | [DSC-003](COMMUNITIES-REGISTER.md#dsc) |
| PDR-003 | Default discovery cannot be bought | tested | `app/src/community/governance.ts` — FORBIDDEN_MECHANICS: pay-to-win club promotion; REVENUE_NOT_TAKEN<br>`app/src/community/governance.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |

### EVC

**Events and livestream center.** The company site hosts student workshops, registration-prep sessions, career and portfolio workshops, founder demonstrations, ambassador sessions, roundtables and panels, each with registration, calendar save, accessibility, replay, captions, resources and a follow-up path. On the company site.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| EVC-001 | /community/events/: ten kinds of session and what every one carries | tested | `app/src/site/community.tsx` — Events: SESSIONS, CARRIES<br>`app/src/site/site.test.tsx` — held | No event is scheduled; the page says so and offers the newsletter by mail. | — |
| EVC-002 | Registration, calendar save, replay, transcript and captions for each event | not-started | — | No event object, no registration, no replay; the page lists what each will carry. | — |

### SME

**Social media ecosystem.** Social media is the public top of the funnel; Semester is where interest turns into action and belonging, and every post leads to a useful next step. The plan around both.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| SME-001 | Ten content pillars, each with a purpose and an example | tested | `app/src/lib/gtm/social.ts` — PILLARS<br>`app/src/lib/gtm/social.test.ts` — held | A plan; no post has been published under it. | — |
| SME-002 | Seven platforms, each with its role, the in-app community among them | tested | `app/src/lib/gtm/social.ts` — PLATFORMS<br>`app/src/lib/gtm/social.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |
| SME-003 | Three post-to-action paths, every step a route the site builds or a screen the app has | tested | `app/src/lib/gtm/social.ts` — FUNNELS<br>`app/src/lib/gtm/social.test.ts` — every path and screen exists; each ends in an action | Held in code; nothing under docs/evidence/ shows it operating. | — |
| SME-004 | An owned newsletter, sent only with consent, under the campaign object and the UTM convention | tested | `app/src/lib/gtm/messaging.ts` — no marketing send without consent; suppression wins<br>`app/src/lib/gtm/messaging.test.ts` — held<br>`app/src/lib/gtm/utm.ts` — nothing identifying a person in a link<br>`app/src/lib/gtm/campaign.ts` — sensitive fields cannot be targeting criteria | No newsletter exists to send. | — |

### CTL

**Required controls before broad social functions.** Community features create high value and high responsibility; the brief lists what is built before broad social functions, and this is where each stands. The controls.

| ID | Item | Status | Evidence | Gap | Overlaps |
| --- | --- | --- | --- | --- | --- |
| CTL-001 | Verified institutional identity where available | tested | `app/src/community/identity.ts` — verification identity held as a vault reference<br>`app/src/community/identity.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | [PRV-001](COMMUNITIES-REGISTER.md#prv) |
| CTL-002 | Optional pseudonymous display only where a school approves it and moderation supports it | tested | `app/src/community/alias.ts` — one alias, one approved community<br>`supabase/migrations/20260928032000_community.sql` — community_programs.scoped_pseudonymity, default false<br>`app/src/community/safeguards.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | [PRV-006](COMMUNITIES-REGISTER.md#prv) |
| CTL-003 | Clear community rules and a code of conduct | tested | `app/src/community/constitution.ts` — the boundary sentences every constitution keeps<br>`app/src/community/constitution.test.ts` — held<br>`docs/CAMPUS-MODERATION-SOP.md` — the standard | A student-facing code of conduct with a version is a launch gate not yet passed by any tenant. | [GOV-002](COMMUNITIES-REGISTER.md#gov) |
| CTL-004 | Report, block, mute and appeal workflows | tested | `supabase/migrations/20260928032000_community.sql` — report_community_post, block_community_author, appeal_community_decision<br>`app/src/screens/Community.tsx` — report, block, mute, appeal<br>`app/src/screens/Community.test.tsx` — held | Held in code; nothing under docs/evidence/ shows it operating. | [SAF-001](COMMUNITIES-REGISTER.md#saf), [SAF-002](COMMUNITIES-REGISTER.md#saf) |
| CTL-005 | Human moderation for public content, course reviews, opportunities and organization listings | tested | `app/src/community/moderation.ts` — the queue and its actions<br>`app/src/screens/Moderation.tsx` — the console<br>`app/src/lib/listings.ts` — only a moderator publishes a listing<br>`supabase/listings.check.sql` — held | Course reviews have no queue of their own (communities register MOD). | [MOD-001](COMMUNITIES-REGISTER.md#mod), [MOD-002](COMMUNITIES-REGISTER.md#mod) |
| CTL-006 | Age-aware safety controls and guardian consent for minors | tested | `supabase/migrations/20260929150000_minimum_age.sql` — minimum age 13; a minor is not a verified student<br>`supabase/minimum-age.check.sql` — held | Guardian consent is not built: a minor’s guardian agrees to the terms on paper only, and nothing verifies a guardian (maturity MN-02, MN-09). | — |
| CTL-007 | Explicit consent before a student is discoverable for peer matching, mentoring, employer discovery or group participation | tested | `supabase/migrations/20260928021700_mentor_rosters.sql` — rosters are opt-in<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — talent_profiles opt-in<br>`app/src/lib/classmates.ts` — a profile you choose to show<br>`app/src/community/circles.test.ts` — a suggestion reads only what was ticked | Held in code; nothing under docs/evidence/ shows it operating. | [PRV-004](COMMUNITIES-REGISTER.md#prv), [PRV-005](COMMUNITIES-REGISTER.md#prv) |
| CTL-008 | Time-limited consent and easy revocation | tested | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — opt-in expires at 180 days<br>`supabase/migrations/20260928021700_mentor_rosters.sql` — an assignment lasts 180 days at most<br>`app/src/lib/sharing.ts` — every share has an end and a way back<br>`app/src/lib/sharing.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. | — |
| CTL-009 | No default access to private academic records, schedules, grades, financial, health or disability data, messages or study behaviour | tested | `app/src/community/circles.ts` — NEVER_SHARED<br>`app/src/community/connect.ts` — FORBIDDEN_SUGGESTION_INPUTS<br>`app/src/community/connect.test.ts` — held<br>`docs/COMMUNITY-PRIVACY-MODEL.md` — data minimisation | Held in code; nothing under docs/evidence/ shows it operating. | — |
| CTL-010 | Abuse, harassment, impersonation, fraud, spam and academic-integrity reporting | tested | `supabase/migrations/20260928032000_community.sql` — report reasons and cases<br>`app/src/community/detectors.ts` — the signals<br>`app/src/community/detectors.test.ts` — held<br>`app/src/community/pii.ts` — personal information caught before posting | Held in code; nothing under docs/evidence/ shows it operating. | [SAF-003](COMMUNITIES-REGISTER.md#saf), [SAF-004](COMMUNITIES-REGISTER.md#saf), [MOD-010](COMMUNITIES-REGISTER.md#mod) |
| CTL-011 | Rate limits, spam controls and invitation limits | tested | `supabase/rate-limits.check.sql` — the database refuses past the limit<br>`app/src/lib/ratelimit.test.ts` — the refusal speaks to the student | No invitation limit, because nothing invites yet. | [MOD-009](COMMUNITIES-REGISTER.md#mod) |
| CTL-012 | Audit logs for sensitive access and moderation decisions | tested | `supabase/migrations/20260928032000_community.sql` — community_decisions<br>`supabase/moderation-audit.check.sql` — held | Held in code; nothing under docs/evidence/ shows it operating. | [MOD-004](COMMUNITIES-REGISTER.md#mod) |
| CTL-013 | Clear deletion, export and account closure | tested | `app/src/lib/export.ts` — everything you added, in files<br>`app/src/lib/deleteaccount.test.ts` — held<br>`supabase/deletion.check.sql` — held<br>`docs/DATA-PORTABILITY-AND-OFFBOARDING.md` — the process | Held in code; nothing under docs/evidence/ shows it operating. | — |
| CTL-014 | Accessible moderation, reporting and community interfaces | tested | `app/src/community/moderation.ts` — never a colour alone<br>`app/src/screens/Community.tsx` — status in words<br>`app/src/a11y/labels.ts` — every control named<br>`app/src/a11y/labels.test.ts` — held | No accessibility test of the community workflows by a person (launch gate accessibility). | — |

## The hub

Where Connect appears: inside Search, the Community screen and Me, never as
a root. Its sections, and the screen each opens today:

| Section | Answers | Screen | Gap |
| --- | --- | --- | --- |
| Who else is in your classes | Who else is taking this course or preparing for this exam? | `classmates` | — |
| Study groups and course spaces | Where can I find a study group, mentor, club, event, or campus community? | `community` | — |
| Clubs, events and everything that is not a class | Where can I find a study group, mentor, club, event, or campus community? | `activities` | — |
| Project teams | How can I contribute a project, question, recommendation, or useful resource? | `groupwork` | — |
| Peer and alumni mentors | Which people or organizations can help me take the next step? | `launchpad` | — |
| Research, internships, jobs, funding and study abroad | What opportunities fit my interests, skills, pathway, or goals? | `opportunities` | — |
| People who will write about you | Which people or organizations can help me take the next step? | `people` | — |
| Campus map | Where can I find a study group, mentor, club, event, or campus community? | `maps` | — |
| Your projects and portfolio | How can I contribute a project, question, recommendation, or useful resource? | — | Evidence is saved privately (lib/career-evidence.ts); nothing publishes it to a chosen audience yet. |
| Verified campus communities | Where can I find a study group, mentor, club, event, or campus community? | — | Organizations exist in the database with no screen that lists them (communities register ORG-001). |
| Saved communities, events, people and opportunities | Where can I find a study group, mentor, club, event, or campus community? | — | Saved events live on the directory and saved opportunities on the tracker; nothing gathers them. |

## The showcase

An item starts private and only the student moves it. Employer visibility
rests on a talent-profile opt-in that expires.

| Visibility | Who sees it |
| --- | --- |
| private | Only you |
| advisor | You and an advisor you named |
| group | A course or project group you are in |
| campus | Signed-in students at your school |
| public | Anyone with the link, as your public portfolio |
| employers | Employers your school approved, while your talent profile is switched on |

## A collaboration room

- Shared agenda
- Actions and who owns each
- Shared files and links
- Meeting scheduling
- Notes
- Calendar events
- Discussion threads
- Event or project timeline
- An explicit member list and role permissions
- Clear archive and deletion rules

## The mentor flow

1. The student chooses a goal
2. Semester shows verified, opt-in mentors for it
3. The student sends a structured connection request
4. The mentor accepts or declines; nothing happens until they answer
5. Semester opens a time-limited connection space
6. The student writes their questions and a meeting agenda
7. Both can schedule, meet, and record follow-up actions
8. The connection expires, or continues only with consent from both

## Challenges

Optional, private by default, shared a milestone at a time, and never a comparison.

| Challenge | Outcome |
| --- | --- |
| Plan your first term | A term plan with every deadline on it |
| Registration-readiness week | A schedule, backups for sections that fill, and the checklist done |
| Study with intention | A study plan for one exam, followed |
| Resume and portfolio week | One piece of evidence written up and ready to use |
| Attend a campus event | One event saved, attended and reflected on |
| Explore three clubs | Three organizations looked at; one joined or not, by choice |
| Peer mentor welcome series | A first conversation with a mentor |
| Career fair preparation | A target list, a resume and three questions |
| Transfer student onboarding | Credits reviewed, an advisor met, a community found |
| End-of-term reflection | What the term taught, written down |
| Semester Wrapped | A private recap of milestones you selected, shared only if you choose |

## Recognition

| Signal | Verified by |
| --- | --- |
| Verified club officer | organization role |
| Peer mentor | organization role |
| Resource contributor | human review |
| Event organizer | organization role |
| Study-group facilitator | human review |
| Project collaborator | human review |
| Campus ambassador | organization role |
| Alumni mentor | organization role |
| Helpful answer, accepted by the student who asked | student acceptance |
| Accessibility advocate | human review |
| Volunteer or community-service contributor | human review |

## The social media ecosystem

Use social media as the public top of the funnel; use Semester as the place where social interest turns into meaningful action and belonging.

No private student data, grades, plans or messages in marketing without explicit written permission; no ad or tracking SDK in the app; no student data used for ad targeting.

| Pillar | Purpose | Example |
| --- | --- | --- |
| Student clarity | Show that Semester understands real student friction | “College should not require 20 tabs.” |
| Planning | Give immediate practical value | Course-planning, registration, deadline and advisor tips |
| Study | Demonstrate learning support | Study workflows, active recall, exam planning, source-aware learning |
| Campus connection | Promote community and opportunities | Club discovery, events, mentors, support resources |
| Career momentum | Connect university life to the future | Portfolio, internships, networking, resume and career-fair content |
| Student stories | Build trust and emotional relevance | Ambassador stories, first-year experiences, transfer pathways |
| Product building | Attract employees, partners and early adopters | Feature previews, product principles, behind-the-scenes building |
| Institutional insight | Attract university leaders | Fragmentation, accessibility, privacy, student experience, implementation |
| Community spotlights | Give others reasons to share | Clubs, mentors, campus partners, student projects |
| Responsible technology | Build credibility | Privacy, source labels, student control, accessible design, AI boundaries |

| Platform | Best role for Semester |
| --- | --- |
| Instagram | Visual student-facing identity, short tips, creator stories, carousels, Reels, community spotlights |
| TikTok | Practical student content, relatable university problems, short product demos, student ambassador content |
| LinkedIn | Institutions, employees, advisors, investors, partnerships, product strategy, hiring, thought leadership |
| YouTube | Product walkthroughs, longer student guides, webinars, career workshops, advisor training |
| Facebook | Parent and supporter outreach, campus groups, community announcements, events, local partnerships |
| Email newsletter | Owned audience for product updates, useful resources, events, student stories and pilot news |
| In-app community | Contextual connection, events, groups, mentors, opportunities and collaboration |

Every post leads to a useful next step, and `social.test.ts` holds every
step to a route the site builds or a screen the app has:

- Instagram Reel about registration → Free registration checklist on the site (`/tools/checklist/`) → Save the checklist to a Semester account (`/signup/`) → Build a term plan (`courses`) → Join a registration-prep community event (`/community/events/`) → Bring a Path Snapshot and your questions to your advisor (`degree`)
- LinkedIn post about fragmented student systems → Institution landing page (`/institutions/`) → Product architecture demo (`/demo/`) → Pilot overview (`/start/`) → Schedule a partnership conversation (`/contact/`)
- TikTok study tip → Free study-plan template (`/resources/`) → Create an account (`/signup/`) → Save a study session (`study`) → Find or create a course study group (`community`)

## The order things are built

Density around useful, verified connections before anything broad; commerce last.

1. Verified clubs, organizations, events and campus opportunities
2. Event calendar, RSVP handoff, saved events and Action Center reminders
3. Course-based opt-in study-group matching
4. Structured collaboration rooms for study groups and projects
5. Peer mentors and orientation communities
6. Alumni mentors and career communities
7. Student-controlled project and portfolio showcases
8. Moderated course reviews and shared study resources
9. Ambassador programme and creator community
10. Optional marketplace, employer talent pool and broader alumni network

**Best immediate additions**, in the brief’s words, and the areas that carry each:

- A Verified Campus Communities directory — [VCC](#vcc), [PDR](#pdr)
- A unified Events & Opportunities feed with calendar save and Action Center integration — [VCC](#vcc), [APN](#apn), [MAP](#map)
- Opt-in study-group matching by course and section — [CSC](#csc)
- Collaboration Rooms for study groups, clubs, projects and mentor relationships — [ROM](#rom)
- A structured Peer Mentor Network — [PMN](#pmn)
- A student-controlled Project and Portfolio Showcase — [SHW](#shw)
- A public Semester Community page on the company site — [CSP](#csp)
- A Campus Ambassador Program — [AMB](#amb)
- A free public student-success resource library — [LIB](#lib)
- A moderated student stories and creator program — [STO](#sto)
