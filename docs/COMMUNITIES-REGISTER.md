# Semester Communities Register

<!-- Rendered from app/src/lib/communitiesregister.ts and app/src/community/governance.ts by communitiesregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Every capability the four community blueprints of September 2026 name —
discovery, clubs, recognition, events, circles, mentorship, questions, safety,
moderation, privacy, services, opportunity, the life graph, accessibility,
supporters and employers, integrations, governance and engagement — and
where the repository stands on each. What must be true **at launch** is the
[master register](MASTER-LAUNCH-READINESS-REGISTER.md) and what makes
Semester durable after it is the [strategic expansion
register](STRATEGIC-EXPANSION-REGISTER.md); each area here names the master
rows it overlaps rather than restating them.

**The design principle:** Do not optimize for endless scrolling. Optimize for belonging, useful connection, real-world participation, accessible information, and safe next actions.

**What it is not:**

- Not a replacement for official campus emergency services
- Not an unrestricted anonymous social network
- Not a student-risk surveillance product
- Not a behavioral-advertising network
- Not an automated disciplinary-decision system
- Not a default public record of student identity, activity, or affiliations

Statuses were assessed against `origin/main` at `b82df8c`; a test holds each
to the kind of file it cites. Nothing is above `tested`, because nothing has
an artifact under `docs/evidence/`.

## Where it stands

| Area | Phase | Items | not-started | designed | building | tested |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [DSC](#dsc) Community discovery and listings | 1 | 11 | 1 | 0 | 8 | 2 |
| [ORG](#org) Club profile and officer workspace | 2 | 11 | 3 | 0 | 5 | 3 |
| [LCY](#lcy) Recognition lifecycle, officer transition and the constitution | 2 | 7 | 0 | 0 | 1 | 6 |
| [EVT](#evt) Events and the event risk workflow | 2 | 7 | 3 | 0 | 1 | 3 |
| [CIR](#cir) Peer circles and structured study groups | 3 | 8 | 1 | 0 | 0 | 7 |
| [MNT](#mnt) Peer mentorship | 3 | 10 | 0 | 0 | 0 | 10 |
| [QNA](#qna) Campus questions and answers | 1 | 6 | 0 | 0 | 1 | 5 |
| [SAF](#saf) Student-facing safety controls and the severity ladder | 1 | 10 | 0 | 0 | 1 | 9 |
| [MOD](#mod) Moderator console, automated safeguards and the evidence vault | 1 | 15 | 1 | 1 | 4 | 9 |
| [PRV](#prv) Community privacy controls | 1 | 8 | 1 | 0 | 0 | 7 |
| [SRV](#srv) Campus service directory | 1 | 6 | 0 | 0 | 0 | 6 |
| [OPP](#opp) Opportunity exchange, projects and portfolio | 4 | 6 | 0 | 1 | 2 | 3 |
| [GRF](#grf) Academic life graph, campus pulse and the co-design studio | 3 | 5 | 0 | 0 | 2 | 3 |
| [ACC](#acc) Personal accessibility workspace | 1 | 8 | 1 | 0 | 3 | 4 |
| [NET](#net) Supporters, alumni, employers, and the commerce that waits | 4 | 5 | 0 | 1 | 0 | 4 |
| [INT](#int) Social-media integrations and the social API | 5 | 11 | 0 | 1 | 1 | 9 |
| [GOV](#gov) Governance: the readiness brief, launch gates, packaging and economics | 1 | 7 | 0 | 1 | 0 | 6 |
| [LPS](#lps) Engagement loops and recognition | 3 | 9 | 1 | 1 | 3 | 4 |
| **total** | | **150** | **12** | **6** | **32** | **100** |

## The five phases

Do not launch every social and community function at once. An area sits in the phase of its first useful build.

| Phase | Build | Why | Areas |
| ---: | --- | --- | --- |
| 1 — Safe foundations | Official club and service directory, events, source-labeled questions and answers, accessible discovery, privacy controls, block, mute and report, a basic moderation queue | High value; lower risk; reinforces academic navigation | DSC, QNA, SAF, MOD, PRV, SRV, ACC, GOV |
| 2 — Organization operations | Officer workspace, recognition workflow, event approvals, membership requests, forms, documents, officer transition, training acknowledgements | Real operating value for organizations and students | ORG, LCY, EVT |
| 3 — Structured belonging | Peer circles, structured study groups, trained mentorship with transparent matching, coordinator dashboard, co-design studio | Strong belonging and retention once safety operations are mature | CIR, MNT, GRF, LPS |
| 4 — Network value | Opportunity exchange, project and portfolio evidence, alumni and employer programmes, credentials | Connects academic life to career and long-term value | OPP, NET |
| 5 — Higher-risk commerce and social | Marketplace, resale, payments, ticketing, ride coordination, external social publishing, broad social feed | Only after dedicated trust-and-safety, financial and legal infrastructure exists | INT |

## The register

### DSC

**Community discovery and listings.** Students should browse, not be algorithmically trapped: a listing says what a community is, who stands behind it, what it costs and how to join, before a student gives it anything. Phase 1. Overlaps master rows `UOS-003`, `STU-009`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| DSC-001 | Browse communities without an algorithmic feed | tested | `app/src/community/feed.ts` — twenty posts at most, chronological mode, why each is shown<br>`app/src/community/feed.test.ts` — held | Posts are browsable; communities themselves are an unfiltered list of kind and verification. |
| DSC-002 | Discovery filters: interest, discipline, career, location, format, time commitment, accessibility, first-generation or transfer support, language, event type, beginner-friendly | building | `app/src/components/CampusDirectory.tsx` — free-text search and a category select over an imported directory | Only text and category; none of the blueprint filters exist on `communities` or `CampusListing`, and location is never a filter by design. |
| DSC-003 | Official status on every listing: institution-recognized, partner, student-created, independent | building | `supabase/migrations/20260928032000_community.sql` — `communities.verification`: institution_verified, organization_verified, faculty_approved, student_created | No partner or independent value; `organizations` has no status column at all. |
| DSC-004 | Advisor or accountable owner on every listing | not-started | — | Nothing in `organizations`, `communities` or the directory import names an advisor or owner; `CampusListing.contact` is free text. |
| DSC-005 | Membership visibility: public, request-to-join, private | building | `supabase/migrations/20260921230000_organizations.sql` — `organizations.listed`; `apply_to_organization` puts an applicant before an officer<br>`supabase/migrations/20260928032000_community.sql` — `join_community` admits instantly | A community has no join policy; an organization has listed or not. Neither is the three-way choice. |
| DSC-006 | Meeting format and accessibility information | building | `app/src/lib/campusdirectory.ts` — free-text details keys in the import template | Free text in a template, not a structured field; master UOS-003 records the same gap. |
| DSC-007 | Dues, time commitment and safety or contact expectations | building | `app/server/institution/clubs.ts` — dues in the sandbox demo only<br>`app/src/lib/campusdirectory.ts` — a "Membership fee" detail in the template | Nothing in Supabase; time commitment and contact expectations are not modelled anywhere. |
| DSC-008 | Last activity and verification date | building | `app/src/components/CampusDirectory.tsx` — shows the import date | No `last_reviewed_at` or `verified_at` on a community or organization; the master register (UOS-001) records "no owners or review dates". |
| DSC-009 | How to join, on the listing | building | `app/src/screens/Community.tsx` — a Join button<br>`app/src/lib/campusdirectory.ts` — a "How to join" detail | Words in a template, not a field with a route. |
| DSC-010 | Sensitive identity, religion, politics, health, disability, immigration status or orientation never inferred from behaviour | tested | `app/src/community/feed.ts` — FORBIDDEN_SIGNALS and assertAllowedSignals<br>`app/src/community/feed.test.ts` — held<br>`app/src/community/circles.ts` — FORBIDDEN_INPUTS for a circle suggestion<br>`app/src/community/circles.test.ts` — every forbidden input refused by key | Held in code; nothing under docs/evidence/ shows it operating. |
| DSC-011 | "Why this may be relevant" on a community or event suggestion | building | `app/src/community/feed.ts` — explain() for posts | No community, event or circle recommender exists, so nothing to explain yet; when one does, DO-NOT-BUILD rule 3 applies. |

### ORG

**Club profile and officer workspace.** Most campus systems treat clubs as directories; Semester can treat them as durable student-led institutions with a complete operating workspace. Phase 2. Overlaps master rows `UOS-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ORG-001 | Organization with members, standings and officer capabilities as a set, not a rank | tested | `supabase/migrations/20260921230000_organizations.sql` — organizations, organization_members; FOLLOWER to ALUMNI_MEMBER; six capabilities<br>`app/src/lib/orgs.ts` — the client, with can() for drawing panels<br>`app/src/lib/orgs.test.ts` — vocabularies read out of the migration<br>`supabase/organizations.check.sql` — refusals as the wrong account | No screen imports `orgs.ts`; the layer is reachable by nothing a student can open. |
| ORG-002 | Club profile: mission, recognition status, officers and advisor, categories and tags, meeting schedule, accessibility, eligibility, dues, contact route, media policy, official social links, funding status for officers, upcoming events, service record | building | `supabase/migrations/20260921230000_organizations.sql` — `about` (400 characters) and a name<br>`supabase/migrations/20260928032000_community.sql` — `purpose` and `verification` | Of fourteen profile fields, two exist. No advisor, constitution, tags, schedule, accessibility, eligibility, media policy, social links, events or service record. |
| ORG-003 | Membership requests reviewed by a membership officer | tested | `supabase/migrations/20260921230000_organizations.sql` — apply_to_organization, set_member_standing<br>`supabase/organizations.check.sql` — held | No screen. |
| ORG-004 | Member roles assigned by an administrator, with a last-administrator guard | tested | `supabase/migrations/20260921230000_organizations.sql` — set_member_capabilities refuses to strip the only ADMIN<br>`app/src/lib/orgs.test.ts` — CAPABILITY_MEANS in words | No screen. |
| ORG-005 | Announcements to members | building | `supabase/migrations/20260928032000_community.sql` — host-only posting in a student_organization community | The COMMUNICATIONS capability has no table; a post in a community is the nearest thing. |
| ORG-006 | Room and resource requests | building | `app/server/institution/clubs.ts` — room holds in the sandbox demo<br>`supabase/migrations/20260928041700_space_availability.sql` — availability read-only; booking refused by design | Prepare-only against a sandbox; no live request. |
| ORG-007 | Budget and funding requests, visible to authorized officers only | building | `app/server/institution/clubs.ts` — spend states asked, approved, refused, paid; officer sees claims, members see the total<br>`app/server/institution/clubs.test.ts` — the sandbox flows | Sandbox only; ROLE_REQUIREMENTS 267: "do not attempt to become a bank". |
| ORG-008 | Elections and voting: a roll without choices and ballots without voters | building | `app/server/institution/clubs.ts` — castVote and tally<br>`app/server/institution/clubs.test.ts` — held | Sandbox only; ROLE_REQUIREMENTS 266 forbids claiming cryptographic election security. |
| ORG-009 | Attendance, only where justified and disclosed | not-started | `docs/ROLE_REQUIREMENTS.md` — items 262 and 263: no public attendance data, no hidden location attendance | Nothing records attendance for an organization, which is the safe default until an event workflow exists. |
| ORG-010 | Advisor review, required training, risk forms, document archive, communication preferences, incident handoff | not-started | — | Six officer-dashboard panels with no table, type or screen. |
| ORG-011 | Committee, chapter and affinity subgroups under an organization | not-started | — | No subgroup scope; the role model has no committee lead. |

### LCY

**Recognition lifecycle, officer transition and the constitution.** Student organizations fail when officers graduate; continuity has to be built in, and every change of standing has to say who made it, why, and how to appeal. Phase 2. Overlaps master rows `UOS-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LCY-001 | Lifecycle states: draft, submitted, under review, active, active with conditions, inactive, archived, dissolved — every legal move written down and the rest refused | tested | `packages/institution/src/workflow.ts` — ORGANIZATION_RECOGNITION, the machine<br>`packages/institution/src/workflow.test.ts` — every pair of states; recognition never taken by the organization | The `organizations` table has no status column; the machine is the rule the column will be held to. |
| LCY-002 | Every transition records approver, reason, effective date, required follow-up, a student-visible status, an audit event and an appeal route | tested | `app/src/community/lifecycle.ts` — WHO_MAY, recordTransition, STUDENT_VISIBLE, APPEAL_ROUTE<br>`app/src/community/lifecycle.test.ts` — every legal move has a seat, no illegal move has one; refusals for no reason, a past date, a conditions move with no follow-up | Nothing stores the record yet. |
| LCY-003 | Admin-loss continuity: an organization with no administrator can be claimed by a member | tested | `supabase/migrations/20260921234500_organization_succession.sql` — claim_abandoned_organization<br>`supabase/organizations.check.sql` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| LCY-004 | End-of-term officer transition: confirm incoming officers, transfer ownership, rotate access, preserve documents, archive by policy, update the advisor, renew recognition, complete training, review commitments | tested | `app/src/community/lifecycle.ts` — OFFICER_TRANSITION, nextTransitionStep, mayRotateAccess<br>`app/src/community/lifecycle.test.ts` — access rotates only after confirmation and transfer | A checklist with an order; no screen walks it and no term boundary triggers it. |
| LCY-005 | Constitution as a guided, versioned form: eleven sections, required fields, officer and advisor acknowledgement, amendments that keep the version they replaced | tested | `app/src/community/constitution.ts` — SECTIONS, draft, readyToAdopt, amend<br>`app/src/community/constitution.test.ts` — boundary sentences cannot be written away; a field the template lacks is refused | No org-owned document store: `public.forms` is user-owned. |
| LCY-006 | The no-emergency-service notice and the disciplinary-authority boundary in every constitution | tested | `app/src/community/constitution.ts` — DISCIPLINE_BOUNDARY; NOT_AN_EMERGENCY_SERVICE from governance.ts<br>`app/src/community/constitution.test.ts` — adoption refused when either is changed | Held in code; nothing under docs/evidence/ shows it operating. |
| LCY-007 | Institution recognition office → campus administrator → organization → advisor → president → officers → committee leads → members → visitors, as seats with powers and limits | building | `app/src/community/lifecycle.ts` — four seats and which moves each may make<br>`supabase/migrations/20260921230000_organizations.sql` — members and officer capabilities | Advisor, campus administrator and committee lead exist only as seats in the lifecycle rule; no role grant or RLS knows them. |

### EVT

**Events and the event risk workflow.** Club events involve travel, crowds, alcohol, minors and facilities; the workflow supports the approvals and never judges the facts. Phase 2. Overlaps master rows `UOS-003`, `STU-010`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| EVT-001 | Event discovery from an imported or static source, past and upcoming | tested | `app/src/lib/campusdirectory.ts` — parseDirectory for events; upcomingEvents<br>`app/src/lib/campusdirectory.test.ts` — held<br>`app/src/data/events.ts` — CAMPUS_CALENDARS shown on the calendar | No verified live source (master UOS-003). |
| EVT-002 | Save an event; add it to a calendar only by explicit choice | building | `app/src/components/CampusDirectory.tsx` — a saved star, on the device<br>`app/src/lib/connect.ts` — addEvent writes to Google or Microsoft after a tap | Calendar writes cover deadlines and classes, not campus events; ICS export does not reach directory events. |
| EVT-003 | RSVP with capacity, at approved venues only | tested | `supabase/migrations/20260928032000_community.sql` — community_sessions 2–12 places, community_venues approved list<br>`supabase/community.check.sql` — held | Study sessions only, in course and study-group communities. No organization event. |
| EVT-004 | Draft → approval and risk workflow → published → RSVP → calendar → optional check-in → feedback → close → evidence | not-started | — | No events table owned by an organization; no approval state. ADR-0009 says this is a workflow machine. |
| EVT-005 | Event risk fields: type and scale, facility confirmation, accessibility plan, travel indicator, required approvals, advisor confirmation, emergency contact, training and waiver checklist, insurance documents, post-event incident link | not-started | — | None modelled. |
| EVT-006 | Check-in only where the host enables it; never location-based or public | not-started | `docs/ROLE_REQUIREMENTS.md` — item 262 | Specification only; a QR encoder exists in lib/qr.ts and nothing uses it for this. |
| EVT-007 | Event reminders with an owner, a preference, a cap and a way out | tested | `app/src/lib/notify.ts` — tiers, caps, quiet hours, the why line<br>`app/src/lib/notify.test.ts` — held | The engine exists; no event rule is registered in NOTIF_DEFS. |

### CIR

**Peer circles and structured study groups.** A bounded group with a purpose, a cap, a facilitator and an end date is safer and more useful than an endless anonymous feed. Phase 3. Overlaps master rows `UOS-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| CIR-001 | Twelve circle types, each with a purpose | tested | `app/src/community/circles.ts` — CIRCLE_TYPES<br>`app/src/community/circles.test.ts` — held | No `communities.kind` for a circle; `study_group` is the nearest. |
| CIR-002 | A circle opens only with purpose, cap, start and end, a trained facilitator, a code of conduct, cadence, accessibility and time zone, meeting boundaries, a reporting route and a closure plan | tested | `app/src/community/circles.ts` — openCircle names every bound broken<br>`app/src/community/circles.test.ts` — a term not a lifetime; not a pair | The `communities` table has no cap, date, facilitator or closure column. |
| CIR-003 | Joining refused only by the cap, the end date and being in already; leaving is one tap | tested | `app/src/community/circles.ts` — join, ALWAYS_SHOWN<br>`supabase/migrations/20260928032000_community.sql` — the "leave a community" delete policy<br>`app/src/community/circles.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| CIR-004 | Sensitive circles never list their members | tested | `app/src/community/circles.ts` — SENSITIVE_TYPES, rosterVisible<br>`supabase/migrations/20260928032000_community.sql` — community_members: your own rows only<br>`app/src/community/circles.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| CIR-005 | Study group: course or topic, term and meeting pattern, format, goals, materials policy, facilitator rotation, calendar links, opt-in notes | tested | `app/src/community/circles.ts` — StudyPlan, nextFacilitator, notesShared<br>`app/src/community/circles.test.ts` — held | A study group today is a name and a purpose (`createStudyGroup`); the plan has nowhere to live. |
| CIR-006 | No automatic sharing of grades, accommodations, attendance or submissions; attendance optional; the integrity reminder | tested | `app/src/community/circles.ts` — NEVER_SHARED, ATTENDANCE_OPTIONAL, INTEGRITY_REMINDER<br>`supabase/migrations/20260928032000_community.sql` — nothing reads a location, a schedule or a grade<br>`app/src/community/circles.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| CIR-007 | No "best student" ranking and no matching on protected or inferred traits | tested | `app/src/lib/groupwork.ts` — perPerson sorted by name so it is not a league table<br>`app/src/community/circles.ts` — assertSuggestionInputs<br>`app/src/community/circles.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| CIR-008 | Shared focus timer for a study group | not-started | — | No group timer; the personal timer in Study is not shared. |

### MNT

**Peer mentorship.** Structured, opt-in and time-bounded, with trained mentors, transparent matching and a way out at every check-in — not an unrestricted matching and chat feature. Phase 3. Overlaps master rows `UOS-007`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MNT-001 | A request needs the mentor's yes; capacity is checked at acceptance; nobody writes the request table directly | tested | `supabase/migrations/20260928021700_mentor_rosters.sql` — request_mentor, answer_mentor_request<br>`supabase/mentor-rosters.check.sql` — held<br>`app/src/lib/mentors.ts` — reads and calls only | Held in code; nothing under docs/evidence/ shows it operating. |
| MNT-002 | A pairing is time-limited | tested | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — peer_mentor_assignments: 180 days at most; either end ends it<br>`supabase/expansion.check.sql` — held | No client function or screen ends an accepted match. |
| MNT-003 | Seven programme templates with a purpose, weeks and scope, and what mentoring is not for | tested | `app/src/community/mentorship.ts` — PROGRAMS, OUT_OF_SCOPE, MENTOR_BOUNDARY<br>`app/src/community/mentorship.test.ts` — held | Only `peer` and `alumni` kinds exist in the database. |
| MNT-004 | Mentor eligibility: application, code-of-conduct acknowledgement, four training modules, yearly renewal, capacity | tested | `app/src/community/mentorship.ts` — TRAINING_MODULES, eligibilityProblems, RENEWAL_DAYS<br>`app/src/community/mentorship.test.ts` — training expires | No mentor application or training table; `peer_mentor_offers` carries topics and capacity only. |
| MNT-005 | Mentee request: programme, goal, topics, availability, format, language, communication style, optional accessibility needs, lived experience only when asked | tested | `app/src/community/mentorship.ts` — MenteeRequest<br>`app/src/community/mentorship.test.ts` — held | `mentor_requests` carries topics and a note only. |
| MNT-006 | Transparent matching: a short explainable set with "why this person may be a fit", mutual acceptance, decline or rematch without penalty | tested | `app/src/community/mentorship.ts` — explainMatch, move<br>`app/src/lib/launchpad.ts` — matchMentors on ticked interests<br>`app/src/community/mentorship.test.ts` — at most three, never a score; lived experience only when asked | Held in code; nothing under docs/evidence/ shows it operating. |
| MNT-007 | Never matched on inferred disability, mental health, protected identity, grades, risk labels, behavioural profiles or private records | tested | `app/src/community/mentorship.ts` — FORBIDDEN_MATCH_INPUTS, assertMatchInputs<br>`app/src/community/mentorship.test.ts` — every forbidden input refused | Held in code; nothing under docs/evidence/ shows it operating. |
| MNT-008 | Mentorship workspace: welcome and boundaries, shared goal, first-meeting agenda, voluntary action items, referral to official services, midpoint and end check-ins, pause, rematch and close, completion reflection | tested | `app/src/community/mentorship.ts` — checkIns, FIRST_MEETING_AGENDA, PAIRING_NOTICE<br>`app/src/community/mentorship.test.ts` — four check-ins dated from start and end | After acceptance the screen says only that the programme takes over; nothing shows the check-ins. |
| MNT-009 | Coordinator dashboard: applications, trained mentors, waiting, unaccepted matches, active, rematches, and completion figures under the cohort floor | tested | `app/src/community/mentorship.ts` — coordinatorSummary through suppress()<br>`app/src/community/mentorship.test.ts` — figures withheld under the floor | No coordinator role or screen; no mentorship metric in the analytics dictionary (D-005 applies). |
| MNT-010 | No default recording, no surveillance of private messages, no sentiment or mental-health analysis | tested | `app/src/community/communities.ts` — messagingMode: structured requests only, no direct messages<br>`app/src/community/feed.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |

### QNA

**Campus questions and answers.** A source-aware alternative to the group chat: every answer says whether the institution, an office or a student said it, when it was last checked, and whether it still stands. Phase 1. Overlaps master rows `STU-012`, `TRUST-001`, `TRUST-002`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| QNA-001 | Answer kinds: institution-verified, office owner, student experience, official link, outdated or needs review | tested | `app/src/community/questions.ts` — ANSWER_KINDS<br>`app/src/community/questions.test.ts` — held | No question or answer table or screen. |
| QNA-002 | Source, scope and status on every answer, with the last-reviewed date and the owning office | tested | `app/src/community/questions.ts` — SCOPES, STATUSES, labelLine<br>`app/src/lib/source.ts` — the source vocabulary it reuses<br>`app/src/community/questions.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| QNA-003 | Only a fact the office confirmed carries the institution's label (DO-NOT-BUILD rule 7) | tested | `app/src/community/questions.ts` — verify refuses without office and confirmation<br>`app/src/community/questions.test.ts` — held<br>`app/src/lib/source.test.ts` — the same rule app-wide | Held in code; nothing under docs/evidence/ shows it operating. |
| QNA-004 | An answer turns to needs-review after 180 days or two student reports; a re-review clears it | tested | `app/src/community/questions.ts` — statusOf, reportOutdated, rereview<br>`app/src/community/questions.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| QNA-005 | Offices claim and maintain common questions; the institution sees the unclaimed, most-asked first | tested | `app/src/community/questions.ts` — claim, unclaimed<br>`app/src/community/questions.test.ts` — held | The nearest live thing is `institution_actions` with an office and a status; it is actions, not answers. |
| QNA-006 | Ask → trusted answer → action → report stale → owner updates → the next student gets a better answer | building | `app/src/lib/institution-ops.ts` — questionThemes: grouped, never who asked<br>`app/src/lib/help-routes.ts` — a question becomes a request to a named office | The loop has its ends (a request, an aggregate) and not its middle. |

### SAF

**Student-facing safety controls and the severity ladder.** A safe community layer is a product system, not a report button added at the end. Phase 1. Overlaps master rows `STU-011`, `TRUST-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| SAF-001 | Block a person | tested | `supabase/migrations/20260901000200_classmates.sql` — blocks<br>`supabase/migrations/20260928032000_community.sql` — block_community_author; blocked_either_way gates reads<br>`supabase/community.check.sql` — held | Blocks a post's author or a classmate; no profile, event or message to block from. |
| SAF-002 | Mute a person, thread, group or notification category | tested | `supabase/migrations/20260928032000_community.sql` — community_mutes per author per community<br>`supabase/community.check.sql` — held<br>`app/src/lib/roomprefs.ts` — class rooms muted on the device | A person only; no thread, whole-community or category mute. |
| SAF-003 | Report a post, comment, message, profile, event, club or opportunity | tested | `supabase/migrations/20260928032000_community.sql` — report_community_post<br>`supabase/migrations/20260901000200_classmates.sql` — reports on a message or an account<br>`supabase/reports.check.sql` — held | Posts and class messages only; `community_cases.post_id` is not null, so a case cannot be about a club, an event or a person. |
| SAF-004 | Specific report reasons: spam and scam, harassment, hate, threat or self-harm, doxxing, sexual harassment, academic integrity, commercial solicitation, club or event policy, accessibility barrier, outdated information | tested | `app/src/community/moderation.ts` — REPORT_CATEGORIES, nine; qualifiers for self-harm and sexual<br>`app/src/community/moderation.test.ts` — covers every category | Four of the blueprint's reasons are missing: commercial solicitation, club or event policy, accessibility barrier, outdated information. Self-harm and sexual harassment are qualifiers the SQL does not take. |
| SAF-005 | Context and evidence on a report | tested | `app/src/components/community/ReportSheet.tsx` — details up to 1000 characters and an imminent checkbox<br>`app/src/screens/Community.test.tsx` — held | No attachment or screenshot. |
| SAF-006 | The reporter chooses whether they want a response, and sees a receipt and a case status | building | `app/src/screens/Community.tsx` — "Report sent. A trained reviewer will look at it"<br>`supabase/migrations/20260928032000_community.sql` — the reporter reads their own report rows; cases are reviewer-only | No response choice and no status for the reporter, by design: the reporter's identity is readable by nobody. The reported author does see status. |
| SAF-007 | Leave a group or a match immediately | tested | `supabase/migrations/20260928032000_community.sql` — the "leave a community" policy<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — either end ends a mentor assignment<br>`supabase/community.check.sql` — held | No client function ends an accepted mentor match. |
| SAF-008 | Localized official emergency guidance; Semester is not an emergency service | tested | `app/src/community/crisis.ts` — CRISIS_NOTICE<br>`app/src/community/governance.ts` — NOT_AN_EMERGENCY_SERVICE, never 24/7<br>`app/src/community/governance.test.ts` — held<br>`app/src/lib/support.ts` — the safety office and 911/988 | Numbers are US-only and not per tenant; the report sheet does not link the tenant's route. |
| SAF-009 | Five severity levels with an immediate response, a human owner and a target | tested | `app/src/community/governance.ts` — SEVERITY_LADDER P0–P4<br>`app/src/community/moderation.ts` — provisionalSeverity P0–P3<br>`app/src/community/governance.test.ts` — P4 opens no case<br>`docs/CAMPUS-MODERATION-SOP.md` — the operating table | `community_cases.severity` allows P0–P3; P4 is the level that opens no case, which the schema expresses by absence. No target is timed anywhere. |
| SAF-010 | Automation triages and never imposes a permanent penalty; human review before suspension or dissolution | tested | `app/src/community/moderation.ts` — AUTOMATION_ACTIONS: reduce, rate-limit, preserve; protect() throws on anything else<br>`app/src/community/moderation.test.ts` — automation never decides<br>`supabase/migrations/20260928032000_community.sql` — triage holds, reduces or queues | accountReview() recommends but is not wired to SQL or the console; dissolving a community does not exist. |

### MOD

**Moderator console, automated safeguards and the evidence vault.** Moderators need concrete guidelines, role-based permissions and clear escalation paths; "be respectful" alone is too vague to apply fairly. Phase 1. Overlaps master rows `TRUST-003`, `UOS-008`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| MOD-001 | Role-based moderator permissions: reviewer, senior reviewer, community manager, escalation agreements | tested | `supabase/migrations/20260928032000_community.sql` — community:review, review_senior, manage, escalation_agreements<br>`supabase/community.check.sql` — held<br>`app/src/screens/Moderation.test.tsx` — the console | Reviewers are platform staff at global scope; no tenant-scoped or club moderator has any power. |
| MOD-002 | One queue for reports, automated flags and escalations, by severity then age | tested | `app/src/community/client.ts` — loadQueue<br>`app/src/screens/Moderation.tsx` — the queue<br>`app/src/screens/Moderation.test.tsx` — held | Separate queues remain for class-message reports, opportunities and volunteer work. |
| MOD-003 | Severity, status, assignee, service level and escalation timers on a case | building | `supabase/migrations/20260928032000_community.sql` — severity and status open, decided, appealed, closed | No assignee, no due time, no timer. `report_status.sql` deliberately adds no handled_by; a service level is what the `sla` launch gate makes a tenant commit to. |
| MOD-004 | Immutable case timeline and audit log | tested | `supabase/migrations/20260928032000_community.sql` — community_case_events: append-only, actor hashed<br>`supabase/migrations/20260924223000_moderation_audit.sql` — trigger-enforced immutability for class-message reports<br>`supabase/moderation-audit.check.sql` — held | Case events have no immutability trigger and are deleted with the case at retention; the console does not show the timeline. |
| MOD-005 | Redacted evidence preview and controlled access | building | `app/src/community/pii.ts` — redact() for the author's composer | The console shows the full post and image; nothing redacts for a reviewer. |
| MOD-006 | Content actions: hide, limit reach, lock, remove, restore; account actions: warn, restrict, suspend, ban, re-acknowledge; group actions; event actions; decision templates | tested | `app/src/community/moderation.ts` — DECISION_ACTIONS<br>`supabase/migrations/20260928032000_community.sql` — apply_community_action; restrictions of 1, 14 and 30 days<br>`app/src/community/moderation.test.ts` — who may decide | No warn, permanent ban, re-acknowledgement, group or event action; lock and limit remove the post because replies do not exist; the reason code is free text, not a template. |
| MOD-007 | Appeal intake, independent review and a final record | tested | `supabase/migrations/20260928032000_community.sql` — decide_community_appeal refuses anyone who decided the case<br>`app/src/community/moderation.test.ts` — decided by a different professional<br>`supabase/community.check.sql` — held | Authors appeal; reporters cannot. |
| MOD-008 | Moderator notes separate from user-visible communication; search by case id only; privacy-protected trend dashboard | not-started | — | Only the reason code exists and the author sees it; no search; per-signal outcomes are written and never aggregated. |
| MOD-009 | Rate limits for new accounts, messages, posts and invitations | tested | `supabase/migrations/20260928230000_direct_rate_limits.sql` — per-table limits: posts 30/h, reports 20/h, communities 10/day, mentor requests 20/day<br>`supabase/rate-limits.check.sql` — held<br>`supabase/migrations/20260928032000_community.sql` — per-community posting limits; aliases 3/h | No account-age limit outside volunteer eligibility; there are no invitations or direct messages to limit. |
| MOD-010 | Link reputation, spam and duplicate detection, impersonation signals, PII exposure, keyword triage, repeat-offender review | tested | `app/src/community/detectors.ts` — fifteen seeded rules, versioned<br>`app/src/community/pii.ts` — detectPii, prePostCheck<br>`app/src/community/detectors.test.ts` — held<br>`app/src/community/pii.test.ts` — held | One shortened-link rule is the whole link reputation; no duplicate-text detection; repeat-offender review is TS-only and the safety state programme is off. |
| MOD-011 | Malware scanning of uploads | building | `supabase/functions/_shared/mediascan.ts` — magic bytes, metadata, hashes, known-abuse match | Not a malware scanner and not deployed. |
| MOD-012 | Every automated flag records why, which policy, confidence, what happened, whether a human reviewed it, the final decision and the appeal outcome | tested | `supabase/migrations/20260928032000_community.sql` — community_signals: detector, rule, confidence, version, route, human_outcome with the appeal suffix<br>`supabase/community.check.sql` — held | No explicit policy reference or automated-action field. |
| MOD-013 | Evidence vault: redacted snapshots, access logs, retention and legal hold, export controls | building | `supabase/migrations/20260929030000_retention_sweeps.sql` — sweeps; audit kept three years<br>`supabase/migrations/20260928032000_community.sql` — retain_until 90 days or a year<br>`supabase/retention-sweeps.check.sql` — held | No legal hold on a case, no snapshot, no case export, and a reviewer's view of a case is not logged. |
| MOD-014 | Break-glass access with reason, approval, logging and review; no shared moderator accounts; time-bound support access | designed | `app/src/lib/ops/console.ts` — a two-person duty<br>`ops/operations-console/README.md` — the control | Not modelled in code; the nearest built thing is the two-reviewer, four-hour identity grant. |
| MOD-015 | Institution escalation: P0/P1 only, two professionals, a minimum-data payload, one per case | tested | `supabase/migrations/20260928032000_community.sql` — community_escalation_policies and escalations<br>`docs/CAMPUS-ESCALATION-POLICY.md` — the policy<br>`app/src/screens/Agreements.tsx` — the agreement screen<br>`supabase/community.check.sql` — held | Delivery code exists and is not deployed; the programme is off. |

### PRV

**Community privacy controls.** Academic identity and community identity are different things, and the student decides who sees which. Phase 1. Overlaps master rows `STU-011`, `TRUST-003`, `UOS-007`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| PRV-001 | Academic identity separated from community identity | tested | `app/src/community/identity.ts` — three layers; FORBIDDEN_FIELDS<br>`app/src/community/identity.test.ts` — held<br>`docs/COMMUNITY-PRIVACY-MODEL.md` — the model | Held in code; nothing under docs/evidence/ shows it operating. |
| PRV-002 | No public member list for sensitive groups | tested | `supabase/migrations/20260928032000_community.sql` — community_members returns your own rows, for every community<br>`supabase/community.check.sql` — held | Stricter than asked: no member list for any community. |
| PRV-003 | Who can message, mention, invite or see RSVPs | tested | `app/src/community/communities.ts` — no direct messages; structured requests in three types<br>`app/src/community/feed.test.ts` — held | By absence: there is nothing to control yet, and no control to set when there is. |
| PRV-004 | Approve connection requests | tested | `supabase/migrations/20260928021700_mentor_rosters.sql` — only the recipient accepts<br>`supabase/mentor-rosters.check.sql` — held | Mentor requests only; no general connection. |
| PRV-005 | Default profile privacy per tenant; discoverability by name, programme, club or email; hide activity from classmates; RSVP visibility | not-started | — | No setting or column for any of the four. |
| PRV-006 | Pseudonymous participation where policy and safety allow | tested | `supabase/migrations/20260928032000_community.sql` — aliases, approval, just-in-time reveal by two reviewers<br>`docs/PSEUDONYMITY-POLICY.md` — the policy<br>`supabase/community.check.sql` — held | The programme is off and refuses production from the environment. |
| PRV-007 | Export or delete eligible student-created content | tested | `supabase/migrations/20260929010000_account_erasure_and_export.sql` — export_my_data, erase_account<br>`supabase/migrations/20260928032000_community.sql` — forget_my_community<br>`supabase/deletion.check.sql` — held<br>`app/src/screens/Privacy.tsx` — the buttons | Held in code; nothing under docs/evidence/ shows it operating. |
| PRV-008 | Block, mute, report and leave easily | tested | `app/src/screens/Community.tsx` — all four on a post<br>`app/src/screens/Community.test.tsx` — held | Held in code; nothing under docs/evidence/ shows it operating. |

### SRV

**Campus service directory.** A student should be able to say "I need help with X" and receive safe, source-labelled next steps rather than a vague directory. Phase 1. Overlaps master rows `STU-012`, `UOS-001`, `TRUST-002`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| SRV-001 | "I need help with" as a route to a named office, with the student holding the pen | tested | `app/src/lib/help-routes.ts` — NEEDS, seven context fields unticked, DIRECTORY_ONLY<br>`supabase/migrations/20260927230000_help_requests.sql` — destinations and requests<br>`app/src/lib/help-routes.test.ts` — CONTEXT_KEYS read from the migration<br>`supabase/help-requests.check.sql` — held | Wellbeing, accessibility and money are directory-only by design. |
| SRV-002 | Fifteen categories: tutoring, writing, library, accessibility, career, money, legal, wellness, basic needs, technology, transportation, childcare, international, jobs, volunteering | tested | `app/src/community/services.ts` — CATEGORIES<br>`app/src/lib/support.ts` — the static map with a privacy line per door<br>`app/src/community/services.test.ts` — held | `support.ts` covers about half; the rest exist as office ids or help-route kinds. |
| SRV-003 | Every listing: owner, official/partner/peer label, eligibility, cost, hours, accessibility, languages, appointment route, location, last verified, broken-link report | tested | `app/src/community/services.ts` — ServiceListing, problems, reportBroken<br>`app/src/community/services.test.ts` — every missing field named | `help_destinations` has name, link, hours and accepts-requests; no eligibility, cost, accessibility, languages or verified date. |
| SRV-004 | Verified on the same window content governance gives campus services, and stale after it | tested | `app/src/community/services.ts` — freshness at 90 days<br>`app/src/lib/launch/content.ts` — campus_services reviewEveryDays 90<br>`app/src/community/services.test.ts` — the two held equal | Held in code; nothing under docs/evidence/ shows it operating. |
| SRV-005 | Next steps: complete listings, official first, stale last, each with its source line; eligibility shown and never evaluated | tested | `app/src/community/services.ts` — nextSteps<br>`app/src/lib/listings.ts` — the same rule for opportunities<br>`app/src/community/services.test.ts` — held | No screen calls it; Support shows the static map. |
| SRV-006 | The institution sees stale, reported or incomplete listings, never a student | tested | `app/src/community/services.ts` — needsAttention<br>`app/src/community/services.test.ts` — held | Master STU-009 and UOS-001: no resources index with owner, source and freshness. |

### OPP

**Opportunity exchange, projects and portfolio.** Turn real work into evidence the student controls, and never hide unpaid status or rank students for employers. Phase 4. Overlaps master rows `UOS-004`, `UOS-005`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| OPP-001 | Moderated listings from employers, offices and partners, https only, published only after review | tested | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — opportunities: draft, pending_review, published, removed<br>`supabase/migrations/20260928031700_opportunity_links.sql` — https only<br>`supabase/listings.check.sql` — held<br>`app/src/lib/listings.ts` — the client | Held in code; nothing under docs/evidence/ shows it operating. |
| OPP-002 | Fourteen opportunity kinds: research, campus jobs, internships, work-study, volunteer, leadership, tutoring, organization roles, competitions, scholarships, fellowships, study abroad, micro-internships, project collaboration | building | `app/src/lib/opportunities.ts` — seven tracker kinds<br>`app/src/lib/career.ts` — seven board kinds | Volunteer, leadership, peer tutoring, organization roles, competitions, micro-internships and project collaboration are not kinds anywhere. |
| OPP-003 | Listing fields: eligibility, deadline, compensation or unpaid status, time commitment, supervisor, accommodation contact, source and verification, application handoff, save and reminder | building | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — eligibility, deadline, url<br>`app/src/lib/opportunities.ts` — deadline reminders and hours per week on the device | Compensation, time commitment, supervisor, accommodation contact and a verified date are not on the listing. |
| OPP-004 | No opaque ranking of students for employers | tested | `app/src/lib/listings.ts` — arrange() by deadline only<br>`app/src/lib/listings.test.ts` — held<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — talent_profiles has no score | Held in code; nothing under docs/evidence/ shows it operating. |
| OPP-005 | Project page: role and contribution, skills, artifacts, consent and visibility, optional verification, team acknowledgements, reflection, badge eligibility, export, employer-sharing controls | tested | `app/src/lib/career-evidence.ts` — artifacts citing a course or entry; résumé versions<br>`app/src/lib/career-evidence.test.ts` — held<br>`docs/CREDENTIAL-WALLET.md` — the share model to come | Device-local; no per-item visibility, team, verification or employer control (expansion CRD and PRF rows). |
| OPP-006 | Co-curricular record: participation → reflection → optional verification → issuer metadata → private record → student-controlled share → Open Badges or CLR | designed | `docs/CREDENTIAL-WALLET.md` — standards order; issuer revocation named as the gap<br>`supabase/migrations/20260926150000_expansion_roles_and_features.sql` — skill_records with scoped verifiers | No badge entity; nothing exports; check-in is never treated as proof of learning. |

### GRF

**Academic life graph, campus pulse and the co-design studio.** An explainable map the student edits, aggregate signals the institution can act on without watching anyone, and a channel where students see that Semester listens. Phase 3. Overlaps master rows `UOS-001`, `UOS-008`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| GRF-001 | Skills graph with evidence links and reasons; skills confirmed, renamed or rejected by the student | tested | `app/src/lib/skills-graph.ts` — deriveSkillClaims, explainFit<br>`app/src/lib/skills-graph.test.ts` — held | Skills only; not courses, clubs, service, jobs, mentors, credentials, goals and support in one editable map (expansion EVG-002). |
| GRF-002 | Every connection editable, every recommendation explained; never a black-box ranking | tested | `app/src/lib/actions.ts` — the Explanation shape every action carries<br>`app/src/lib/actions.test.ts` — held | The shape exists; the graph that would use it does not. |
| GRF-003 | Campus pulse: unfindable resources, unanswered questions, stale links, event-discovery failures, communities lacking accessible information — aggregate only | building | `app/src/lib/institution-ops.ts` — MIN_COHORT, suppress, FORBIDDEN sources; question_themes, access_barriers defined<br>`app/src/lib/cohortfloor.test.ts` — suppression held | The metrics are defined; no migration creates their source tables, and none of the five signals is captured. |
| GRF-004 | Never an individual engagement score, an at-risk label or behavioural monitoring for faculty, advisors, employers or administrators | tested | `app/src/lib/institution-ops.ts` — FORBIDDEN: risk_score, attention, wellbeing_score, location<br>`app/src/lib/institution-ops.test.ts` — held<br>`app/src/lib/expansiongovernance.ts` — DEFERRED: behavioral risk scoring, student surveillance | Held in code; nothing under docs/evidence/ shows it operating. |
| GRF-005 | Co-design studio: propose, vote and comment, paid usability research, plan status, "you said, we did", accessibility friction, suggest a missing service or organization | building | `supabase/migrations/20260921215800_feedback.sql` — feedback of five kinds, author-only<br>`app/src/lib/whatsnew.ts` — release notes by module<br>`docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md` — compensate participants | Feedback has no status, vote or public plan; release notes are not linked to what was asked for. |

### ACC

**Personal accessibility workspace.** Semester's defining feature can be that a student controls how it reads, without disclosing a diagnosis to anyone. Phase 1. Overlaps master rows `A11Y-004`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| ACC-001 | Access modes and presets, never inferred from behaviour | building | `app/src/lib/accessmode.ts` — plain, chunk, predictable, sensory; focus, reading, low-load<br>`app/src/components/AccessModes.tsx` — the control | No test of the presets themselves; the master A11Y rows test the components they change. No diagnosis is asked anywhere. |
| ACC-002 | Reading mode, font and spacing, reading width, a hyperlegible face | tested | `app/src/lib/look.ts` — textSize, lineHeight, readingWidth, bodyface<br>`app/src/lib/contrast.test.ts` — every ground held | Held in code; nothing under docs/evidence/ shows it operating. |
| ACC-003 | Text-to-speech on the device | tested | `app/src/lib/speak.ts` — say, readAloud<br>`app/src/lib/speak.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| ACC-004 | Contrast, colour and reduced motion | tested | `app/src/lib/prefers.ts` — prefersLessMotion, usePrefersContrast<br>`app/src/lib/contrast.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| ACC-005 | Keyboard shortcuts and accessible mathematics | tested | `app/src/lib/keys.ts` — SHORTCUTS<br>`app/src/lib/maths.ts` — MathML<br>`app/src/lib/keys.test.ts` — held<br>`app/src/lib/maths.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| ACC-006 | Caption and transcript preference; document accessibility checks | building | `app/src/lib/transcript.ts` — podcast transcripts<br>`app/src/lib/exportqa.ts` — docx and pdf parity including alt text | No caption preference setting; no student-facing checker for an arbitrary document. |
| ACC-007 | Preference portability across every Semester module | building | `app/src/lib/look.ts` — look keys sync across devices | Not in an exportable profile (expansion PRF-003). |
| ACC-008 | One personal accessibility workspace rather than settings scattered under Look | not-started | — | The settings exist; the single surface does not. |

### NET

**Supporters, alumni, employers, and the commerce that waits.** Student-granted, time-limited and revocable is the only supporter model; employer access is opt-in and never reaches academic data; marketplace and rides wait for their own trust-and-safety and legal model. Phase 4. Overlaps master rows `UOS-007`, `UOS-005`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| NET-001 | Supporter access: student-granted, scope- and time-limited, one logged reader, easy revocation | tested | `supabase/migrations/20260921161500_roles.sql` — family_grants<br>`supabase/migrations/20260928306000_family_invites.sql` — eight-character invite, selected only<br>`supabase/migrations/20260928307000_family_shared_items.sql` — items and access events<br>`app/src/lib/familyshare.test.ts` — held | The minors and guardian-consent policy is an open decision (docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md). |
| NET-002 | Parental access never assumed | tested | `ops/strategic-boundaries/README.md` — boundary 5: no generic parent access, mechanical<br>`app/src/lib/ops/boundaries.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |
| NET-003 | Alumni and peer mentor offers with capacity, and a mutual yes | tested | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — alumni_mentor_offers<br>`supabase/migrations/20260928021700_mentor_rosters.sql` — request and answer<br>`supabase/mentor-rosters.check.sql` — held<br>`app/src/components/MentorFinder.tsx` — the finder | Held in code; nothing under docs/evidence/ shows it operating. |
| NET-004 | Employer participation: opt-in, expiring, a receipt per view; no academic data targeting | tested | `supabase/migrations/20260926150000_expansion_roles_and_features.sql` — talent_profiles opt-in expires at 180 days; talent_profile_views<br>`supabase/expansion.check.sql` — held<br>`docs/DO-NOT-BUILD.md` — rule 10 | No verified-employer vetting outside the sandbox, no office hours, panels, or anti-spam limits; no student screen for the profile. |
| NET-005 | Marketplace, resale, ticketing, payments and ride coordination: only after dedicated trust-and-safety, financial and legal infrastructure | designed | `app/src/lib/expansiongovernance.ts` — DEFERRED: unreviewed marketplace transactions, payment credential storage<br>`ops/strategic-boundaries/README.md` — boundary 12: no unmoderated marketplace or public social feed | Not built, and gated by a Tier 4 governance review; `opportunities.kind` already allows deal and housing, which a marketplace would have to be held apart from. |

### INT

**Social-media integrations and the social API.** Integrations are distribution and import/export tools, never hidden data collection; the API is how an institution takes its community data with it. Phase 5. Overlaps master rows `TRUST-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| INT-001 | Seven providers, each with what a student sees, who controls it, a privacy boundary and a minimal scope | tested | `app/src/community/integrations.ts` — PROVIDERS, REQUIREMENTS<br>`app/src/community/integrations.test.ts` — held | `integration_connections.provider_domain` is a closed list with no social domain; a live connection needs a migration. |
| INT-002 | OAuth only, minimal declared scopes, organization-owned accounts, an owner and a purpose on every connection, disconnect always | tested | `app/src/community/integrations.ts` — connect refuses a password, a personal account, a wider scope, no purpose; disconnect<br>`app/src/community/integrations.test.ts` — held<br>`app/src/lib/oauthscopes.ts` — the student-side minimal scopes | Held in code; nothing under docs/evidence/ shows it operating. |
| INT-003 | External content labelled as hosted outside Semester | tested | `app/src/community/integrations.ts` — EXTERNAL_NOTICE from the external trust kind<br>`app/src/lib/source.ts` — TRUST_KINDS external<br>`app/src/community/integrations.test.ts` — held | The label is not yet used by any embedded content, because none is embedded. |
| INT-004 | No automatic posting: preview and a named confirmation first | tested | `app/src/community/integrations.ts` — publish<br>`app/src/community/integrations.test.ts` — nothing after a disconnect either | Held in code; nothing under docs/evidence/ shows it operating. |
| INT-005 | No scraping of direct messages, followers, contacts, browsing or the social graph | tested | `app/src/community/integrations.ts` — NEVER_INGESTED, assertNothingIngested<br>`app/src/community/integrations.test.ts` — held<br>`supabase/migrations/20260927170000_integration_control_plane.sql` — scopes refused by pattern; T4 never ingested | Held in code; nothing under docs/evidence/ shows it operating. |
| INT-006 | Calendar: subscribe or add an approved event by explicit choice, with the write scope explained | tested | `app/src/lib/connect.ts` — addEvent after a tap; forget() disconnects<br>`app/src/lib/connect.test.ts` — held | Student calendars only; campus events are not yet what is written. |
| INT-007 | Institution-level connection governance: owner, status, authentication type, last sync, disconnect, approval, audit | tested | `supabase/migrations/20260927170000_integration_control_plane.sql` — integration_connections and scopes<br>`supabase/integration-control-plane.check.sql` — held | Tenant-level, not per club. |
| INT-008 | A versioned REST API with organizations, communities, memberships, roles, events, RSVPs, projects, documents, constitutions, opportunities, recognitions, mentorship programmes, matches, reports, cases, policy, integrations and webhooks | building | `app/server/institution/gateway.ts` — health, auth config, intelligence, records by area, prepare and commit<br>`packages/institution/src/index.ts` — UNIVERSITY_AREAS including clubs, career, alumni, directory | None of the eighteen social resources exists; ADR-0003 (no application server) and RLS-first (ADR-0002) mean these are edge functions and views, not a gateway. |
| INT-009 | Tenant in the authorization context, idempotency keys, cursor pagination, rate limits, correlation ids, field-level filtering | tested | `app/server/institution/gateway.ts` — correlationIdFor; the tenant from the verified identity<br>`supabase/migrations/20260928320000_audit_correlation_and_outbox.sql` — correlation ids and the outbox<br>`packages/institution/src/workflow.test.ts` — machines held | No general idempotency header; cursor pagination on records only. |
| INT-010 | SCIM provisioning and de-provisioning | tested | `app/server/institution/scim.ts` — the gateway<br>`supabase/migrations/20260928200000_scim_gateway.sql` — storage<br>`supabase/scim-gateway.check.sql` — held | On only with SEMESTER_SCIM=on. |
| INT-011 | Signed outbound webhooks with retries, delivery logs and replay protection; a sandbox with synthetic data for integrators | designed | `docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md` — "outbound webhooks do not exist"<br>`app/server/institution/sandbox.ts` — the institution sandbox | Inbound LTI and SCIM verify signatures; nothing is sent out. The sandbox is Semester's, not a third party's. |

### GOV

**Governance: the readiness brief, launch gates, packaging and economics.** Community products multiply moderation, privacy, safety, content-rights, identity and governance obligations; the discipline is what lets Semester expand into them without becoming a generic campus app. Phase 1. Overlaps master rows `PRG-001`, `PRG-003`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| GOV-001 | A Feature Readiness Brief of fourteen questions before any community, AI, campus-life, career, payments or operations feature | tested | `app/src/community/governance.ts` — READINESS_BRIEF, brief()<br>`app/src/community/governance.test.ts` — a bare yes is not an answer<br>`app/src/lib/governance/charters.ts` — the charter it sits beside<br>`app/src/lib/expansiongovernance.ts` — the admission gate it sits beside | Nothing requires a brief before a flag is added; the pull-request template asks nine of the fourteen. |
| GOV-002 | Eleven launch gates per tenant and per programme, each signed, dated and evidenced, before a switch is thrown | tested | `app/src/community/governance.ts` — LAUNCH_GATES, readyToEnable()<br>`app/src/community/governance.test.ts` — covers every programme flags.ts names<br>`supabase/migrations/20260928032000_community.sql` — community_programs.approved_ref, service role only | `approved_ref` is free text; nothing checks it names a passed gate. |
| GOV-003 | The five phases, and the rule that nothing in phase 5 ships before trust-and-safety, financial and legal operations are proven | tested | `app/src/community/governance.ts` — COMMUNITY_PHASES<br>`app/src/community/governance.test.ts` — no package in phase 5<br>`docs/STRATEGIC-EXPANSION-REGISTER.md` — what not to expand into early | Held in code; nothing under docs/evidence/ shows it operating. |
| GOV-004 | Six institutional packages, none funded by students | tested | `app/src/community/governance.ts` — PACKAGES<br>`app/src/community/governance.test.ts` — safety and foundations first<br>`app/src/lib/plans.ts` — free, plus, pro, institution: nothing for sale (D-009) | No approved price book (master COM-002); the packages are shape, not price. |
| GOV-005 | Eight revenue models refused | tested | `app/src/community/governance.ts` — REVENUE_NOT_TAKEN<br>`docs/DO-NOT-BUILD.md` — rule 10<br>`ops/strategic-boundaries/README.md` — boundary 10: no data sale or behavioural ads, mechanical<br>`app/src/community/governance.test.ts` — held | Pay-to-win visibility, paying mentors per message and lead sale are refused here and nowhere mechanical yet. |
| GOV-006 | Outcome measures as the primary metric, never messages, minutes or daily actives | tested | `app/src/community/governance.ts` — OUTCOME_MEASURES, NOT_PRIMARY_METRICS<br>`app/src/lib/gtm/kpi.ts` — first_meaningful_action_rate defined<br>`app/src/community/governance.test.ts` — held | The first-meaningful-action rate is defined and not collected (D-005 governs any new mark). |
| GOV-007 | Unit economics in the operations console: contract value, implementation cost, active members, verified organizations, events, mentorship participation, cases by severity, cost per case, coordinator hours, cost per member, margin by module, renewal risk | designed | `ops/operations-console/README.md` — "there is no operations console yet"<br>`app/src/lib/ops/console.ts` — the controls as data | No measure has a source; cost per moderation case and coordinator hours are not defined anywhere. |

### LPS

**Engagement loops and recognition.** The right loop is a cycle of useful progress, not notifications engineered to pull students back. Phase 3. Overlaps master rows `STU-012`.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| LPS-001 | First-value loop: sign in → what matters this week → one useful action → a visible outcome → preferences → return because the next action is clearer | building | `app/src/lib/today-decision.ts` — the path snapshot and one next step<br>`app/src/lib/brief.ts` — morning and evening<br>`app/src/lib/gtm/kpi.ts` — the first-meaningful-action metric | No "what matters this week" surface names itself; the metric is not collected. |
| LPS-002 | Discovery loop: chosen interests → browseable suggestions with why → save or RSVP → calendar by choice → attend → next step | building | `app/src/community/feed.ts` — why each post is shown; feedback applied<br>`app/src/community/circles.ts` — what a suggestion may not read | No community or event suggestion exists; no streaks by rule, and the rule is tested. |
| LPS-003 | Club contribution loop: join → welcome and conduct → a meaningful role → reflect → evidence → eligible to lead → onboard the next member | building | `supabase/migrations/20260921230000_organizations.sql` — standings from follower to alumni<br>`app/src/community/lifecycle.ts` — officer readiness as the transition checklist | No welcome step, contribution role, reflection or leadership eligibility path. |
| LPS-004 | Event-to-opportunity loop | not-started | — | No RSVP, check-in or reflection object to start from (EVT). |
| LPS-005 | Mentorship loop: topic and goal → transparent matches → mutual yes → boundaries → meetings → midpoint → referral → close, rematch or extend → reflect | tested | `app/src/community/mentorship.ts` — the pairing and its check-ins<br>`app/src/community/mentorship.test.ts` — held | No screen walks it. |
| LPS-006 | Recognition loop: contribution → private save → evidence and reflection → verification only where appropriate → recognition or credential → the life graph → selective share | designed | `docs/CREDENTIAL-WALLET.md` — the flow<br>`app/src/lib/career-evidence.ts` — the private save | No badge, issuer or criteria entity; verification tables exist with no screen. |
| LPS-007 | Allowed mechanics with their rules: progress paths, verified badges, reflection milestones, community challenges, event passports, officer readiness, recognition wall | tested | `app/src/community/governance.ts` — ALLOWED_MECHANICS<br>`app/src/community/governance.test.ts` — none of them forbidden | Only progress paths (Launchpad steps) and private reflection exist; five of seven are not built. |
| LPS-008 | Never streaks, attendance or message leaderboards, randomized rewards, hidden rankings, punitive missed-event notices, pay-to-win promotion or rewards for disclosure | tested | `app/src/community/governance.ts` — FORBIDDEN_MECHANICS<br>`app/src/community/engagement.test.ts` — the forbidden words never reach a student; a refusal is told from an offer<br>`app/src/lib/wrapped.test.ts` — no streak, rank or comparison in the recap<br>`docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md` — the hard boundaries | Held in code; nothing under docs/evidence/ shows it operating. |
| LPS-009 | Recap of student-chosen outcomes, never usage | tested | `app/src/lib/wrapped.ts` — Semester Wrapped<br>`app/src/lib/wrapped.test.ts` — held | Held in code; nothing under docs/evidence/ shows it operating. |

## The Feature Readiness Brief

Before any community, AI, campus-life, career, payments or operations feature
is developed, `brief()` in `community/governance.ts` needs a written answer to
each of these. A blank is a no; so is a bare "yes".

- [ ] Who is this for?
- [ ] What real problem does it solve?
- [ ] What is the first useful outcome?
- [ ] What must Semester not decide or infer?
- [ ] What data is required, optional, sensitive, or prohibited?
- [ ] What is the source, authority, scope, and freshness model?
- [ ] What are the accessibility requirements?
- [ ] What are the safety and abuse cases?
- [ ] Who moderates or owns it?
- [ ] What is the escalation path?
- [ ] What is the failure and recovery path?
- [ ] How do users export, delete, or revoke access?
- [ ] What metric proves it creates value?
- [ ] What evidence would make us stop or redesign it?

## Launch gates

Before a community or mentorship programme is enabled for a tenant,
`readyToEnable()` needs each of these signed, dated and evidenced.
`community_programs.approved_ref` is where the record is cited.

- [ ] A named institutional owner
- [ ] An approved policy and code of conduct, with a version
- [ ] Moderator roles assigned and training complete
- [ ] An escalation and emergency-routing plan
- [ ] A defined support and response service level
- [ ] Privacy, retention and deletion configured
- [ ] An accessibility test of the core workflows
- [ ] A tenant-specific risk review
- [ ] Student-facing disclosure and consent language
- [ ] A metrics and programme-evaluation plan
- [ ] A closure and offboarding procedure

## Severity

Semester is not an emergency service and does not promise 24/7 crisis response. If someone is in danger now, use the official emergency route shown here.

| Level | Example | Immediate response | Human owner | Target | Opens a case |
| --- | --- | --- | --- | --- | --- |
| P0 | Credible imminent danger, active threat, severe exploitation | Show official emergency guidance; preserve restricted evidence; trigger the approved escalation path | Authorized safety or emergency process | Immediate, according to institutional protocol | yes |
| P1 | Doxxing, credible threat, severe harassment, sexual exploitation | Restrict content and relevant account capabilities pending review | Trust and safety lead | Minutes to hours | yes |
| P2 | Targeted bullying, hate, repeated harassment, serious scam | Queue for trained review; proportionate protective action | Trained moderator | Same business day or the defined service level | yes |
| P3 | Spam, off-topic promotion, impersonation concern, ordinary conduct breach | Filter or limit distribution; moderator review | Moderator or club administrator | The defined routine service level | yes |
| P4 | Duplicate post, low-risk disagreement, minor etiquette issue | Member controls or light moderation | Community or club moderator | As capacity permits | no |

The target is what a tenant's staffed operation commits to at the `sla` gate,
never a promise the app makes; `community_cases` implements P0–P3, and P4 is
the level that opens no case.

## Engagement mechanics

| Mechanic | Use | Rule |
| --- | --- | --- |
| Progress pathways | Orientation, leadership, service, career, transfer transition, officer readiness | Optional, non-punitive, transparent; never implies deficit or failure |
| Verified contribution badges | Training, service, project work, leadership, skills | Only with issuer, criteria, evidence and a correction path; portable where possible |
| Reflection milestones | Articulating what an experience taught | Private by default; shared only by the student's choice |
| Community challenges | Collaborative service, learning or resource-discovery goals | Team-based; no scarcity pressure and no public shaming |
| Event passports | Exploring campus services and opportunities | Never requires disclosing a sensitive affiliation or an attendance history |
| Officer readiness checklist | Organizations surviving turnover | Administrative readiness, not surveillance |
| Recognition wall | Celebrating accomplishments | Explicit consent; private by default |

Never built, and `community/engagement.test.ts` reads the app's rendered text for the words they arrive as:

- **Daily streaks.** Pressure on students with work, caregiving, disability, commuting or money constraints
- **Leaderboards based on attendance or messages.** A league table of people
- **Randomized reward loops.** A slot machine
- **Hidden ranking systems.** DO-NOT-BUILD rule 3: nothing ranked without its reason
- **Punitive missed-event notifications.** Shame is not a reminder
- **Pay-to-win club promotion.** Default discovery cannot be bought
- **Rewards tied to disclosures or sensitive data.** Nothing is earned by telling the app who you are

## Packaging

Sold to institutions; never funded by students. Shape, not price: there is no approved price book.

| Package | Includes | Buyer | Pricing logic | Phase |
| --- | --- | --- | --- | ---: |
| Community Foundations | Club and service directory, events, source-labeled questions and answers, accessibility fields, basic reporting | Student affairs, enrollment, campus experience | Annual platform fee by institution size and enabled modules | 1 |
| Organizations and Events | Officer workspace, recognition workflow, elections, event approvals, forms, resource requests, transition tools | Student affairs, campus activities | Base platform plus the organization and event administration module | 2 |
| Belonging and Mentorship | Structured circles, peer-mentor programmes, training, matching, coordinator dashboard, outcome reporting | Student success, orientation, accessibility, international office | Annual module fee by active programme capacity | 3 |
| Trust and Safety | Moderator console, reporting, case routing, audit evidence, policy templates, safety analytics | Student affairs, IT and security, legal and risk | Governance module plus an implementation and support tier | 1 |
| Campus Opportunity Network | Jobs, research, service, leadership, alumni and employer office hours, portfolio evidence | Career services, experiential learning | Annual module fee plus an optional verified-employer package | 4 |
| Enterprise Campus OS | Community plus academic navigation, AI governance, integrations, operations and enterprise support | Institution executive sponsor | Multi-year agreement with implementation and support scope | 4 |

**Revenue not taken:**

- Selling student behavioral data
- Targeted advertising based on academic, support, accessibility or sensitive data
- Charging students to report a safety concern
- Pay-to-win visibility for clubs in default discovery
- Paying mentors by number of messages or confidential disclosures
- Opaque referral or lead-sale arrangements
- Charging students to export their own eligible data
- Gating essential institution-provided resources behind a premium student plan

## What it is measured by

Never messages sent, minutes scrolled, daily active users as the primary metric. Activity is paired with an outcome:

- Students found the right service
- Students joined a relevant community
- Organizations completed a required workflow
- A mentor and mentee completed a useful meeting
- A student received an accurate, source-labeled answer
- A harmful interaction was handled fairly and promptly
