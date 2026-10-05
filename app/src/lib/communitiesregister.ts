/**
 * The Semester Communities register: every capability the four community
 * blueprints of September 2026 name — discovery, clubs, recognition, events,
 * circles, mentorship, questions, safety, moderation, privacy, services,
 * opportunity, the life graph, accessibility, supporters and employers,
 * integrations, governance and engagement — and where the repository stands
 * on each.
 *
 * `docs/COMMUNITIES-REGISTER.md` is rendered from this file and
 * `community/governance.ts` by `communitiesregister.test.ts`; edit the
 * data, then `npm run registers` from app/.
 *
 * ## How this relates to what is already here
 *
 * `masterregister.ts` is what must be true at launch and
 * `expansionregister.ts` is what makes Semester durable after it. This is
 * narrower than either: one product area, read against four documents that
 * agree with each other. It borrows the master register's rule and its four
 * lower statuses — `designed` cites a document, `building` cites code,
 * `tested` cites a test — and nothing here is above `tested`, because nothing
 * has an artifact under `docs/evidence/`. Where an item overlaps a master or
 * expansion row, the area names it rather than restating it.
 *
 * The phases are the blueprints' own five (`COMMUNITY_PHASES`), not the
 * expansion register's. An area's phase is where the blueprints put its
 * *first* useful build; a later item in an area says so in its gap.
 *
 * Assessed against `origin/main` at `b82df8c` on 2026-09-28, with this
 * branch's community rule modules counted where they close an item.
 */
import type { CommunityPhase } from '../community/governance';

export const STATUSES = ['not-started', 'designed', 'building', 'tested'] as const;
export type Status = (typeof STATUSES)[number];

export interface Area {
  id: string;
  title: string;
  /** Why it matters, in one sentence. */
  why: string;
  phase: CommunityPhase;
  /** Master-register rows that overlap, so the two are read together. */
  master: readonly string[];
}

export interface Item {
  id: string;
  item: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
}

type Row = [item: string, status: Status, evidence: [path: string, shows: string][], gap: string];

const COMMUNITY_SQL = 'supabase/migrations/20260928032000_community.sql';
const ORG_SQL = 'supabase/migrations/20260921230000_organizations.sql';
const EXPANSION_SQL = 'supabase/migrations/20260926150000_expansion_roles_and_features.sql';
const MENTOR_SQL = 'supabase/migrations/20260928021700_mentor_rosters.sql';

const AREA_LIST: readonly (Area & { rows: readonly Row[] })[] = [
  {
    id: 'DSC',
    title: 'Community discovery and listings',
    why: 'Students should browse, not be algorithmically trapped: a listing says what a community is, who stands behind it, what it costs and how to join, before a student gives it anything.',
    phase: 1,
    master: ['UOS-003', 'STU-009'],
    rows: [
      ['Browse communities without an algorithmic feed', 'tested', [['app/src/community/feed.ts', 'twenty posts at most, chronological mode, why each is shown'], ['app/src/community/feed.test.ts', 'held']], 'Posts are browsable; communities themselves are an unfiltered list of kind and verification.'],
      ['Discovery filters: interest, discipline, career, location, format, time commitment, accessibility, first-generation or transfer support, language, event type, beginner-friendly', 'building', [['app/src/components/CampusDirectory.tsx', 'free-text search and a category select over an imported directory']], 'Only text and category; none of the blueprint filters exist on `communities` or `CampusListing`, and location is never a filter by design.'],
      ['Official status on every listing: institution-recognized, partner, student-created, independent', 'building', [[COMMUNITY_SQL, '`communities.verification`: institution_verified, organization_verified, faculty_approved, student_created']], 'No partner or independent value; `organizations` has no status column at all.'],
      ['Advisor or accountable owner on every listing', 'not-started', [], 'Nothing in `organizations`, `communities` or the directory import names an advisor or owner; `CampusListing.contact` is free text.'],
      ['Membership visibility: public, request-to-join, private', 'building', [[ORG_SQL, '`organizations.listed`; `apply_to_organization` puts an applicant before an officer'], [COMMUNITY_SQL, '`join_community` admits instantly']], 'A community has no join policy; an organization has listed or not. Neither is the three-way choice.'],
      ['Meeting format and accessibility information', 'building', [['app/src/lib/campusdirectory.ts', 'free-text details keys in the import template']], 'Free text in a template, not a structured field; master UOS-003 records the same gap.'],
      ['Dues, time commitment and safety or contact expectations', 'building', [['app/server/institution/clubs.ts', 'dues in the sandbox demo only'], ['app/src/lib/campusdirectory.ts', 'a "Membership fee" detail in the template']], 'Nothing in Supabase; time commitment and contact expectations are not modelled anywhere.'],
      ['Last activity and verification date', 'building', [['app/src/components/CampusDirectory.tsx', 'shows the import date']], 'No `last_reviewed_at` or `verified_at` on a community or organization; the master register (UOS-001) records "no owners or review dates".'],
      ['How to join, on the listing', 'building', [['app/src/screens/Community.tsx', 'a Join button'], ['app/src/lib/campusdirectory.ts', 'a "How to join" detail']], 'Words in a template, not a field with a route.'],
      ['Sensitive identity, religion, politics, health, disability, immigration status or orientation never inferred from behaviour', 'tested', [['app/src/community/feed.ts', 'FORBIDDEN_SIGNALS and assertAllowedSignals'], ['app/src/community/feed.test.ts', 'held'], ['app/src/community/circles.ts', 'FORBIDDEN_INPUTS for a circle suggestion'], ['app/src/community/circles.test.ts', 'every forbidden input refused by key']], ''],
      ['"Why this may be relevant" on a community or event suggestion', 'building', [['app/src/community/feed.ts', 'explain() for posts']], 'No community, event or circle recommender exists, so nothing to explain yet; when one does, DO-NOT-BUILD rule 3 applies.'],
    ],
  },
  {
    id: 'ORG',
    title: 'Club profile and officer workspace',
    why: 'Most campus systems treat clubs as directories; Semester can treat them as durable student-led institutions with a complete operating workspace.',
    phase: 2,
    master: ['UOS-003'],
    rows: [
      ['Organization with members, standings and officer capabilities as a set, not a rank', 'tested', [[ORG_SQL, 'organizations, organization_members; FOLLOWER to ALUMNI_MEMBER; six capabilities'], ['app/src/lib/orgs.ts', 'the client, with can() for drawing panels'], ['app/src/lib/orgs.test.ts', 'vocabularies read out of the migration'], ['supabase/organizations.check.sql', 'refusals as the wrong account']], 'No screen imports `orgs.ts`; the layer is reachable by nothing a student can open.'],
      ['Club profile: mission, recognition status, officers and advisor, categories and tags, meeting schedule, accessibility, eligibility, dues, contact route, media policy, official social links, funding status for officers, upcoming events, service record', 'building', [[ORG_SQL, '`about` (400 characters) and a name'], [COMMUNITY_SQL, '`purpose` and `verification`']], 'Of fourteen profile fields, two exist. No advisor, constitution, tags, schedule, accessibility, eligibility, media policy, social links, events or service record.'],
      ['Membership requests reviewed by a membership officer', 'tested', [[ORG_SQL, 'apply_to_organization, set_member_standing'], ['supabase/organizations.check.sql', 'held']], 'No screen.'],
      ['Member roles assigned by an administrator, with a last-administrator guard', 'tested', [[ORG_SQL, 'set_member_capabilities refuses to strip the only ADMIN'], ['app/src/lib/orgs.test.ts', 'CAPABILITY_MEANS in words']], 'No screen.'],
      ['Announcements to members', 'building', [[COMMUNITY_SQL, 'host-only posting in a student_organization community']], 'The COMMUNICATIONS capability has no table; a post in a community is the nearest thing.'],
      ['Room and resource requests', 'building', [['app/server/institution/clubs.ts', 'room holds in the sandbox demo'], ['supabase/migrations/20260928041700_space_availability.sql', 'availability read-only; booking refused by design']], 'Prepare-only against a sandbox; no live request.'],
      ['Budget and funding requests, visible to authorized officers only', 'building', [['app/server/institution/clubs.ts', 'spend states asked, approved, refused, paid; officer sees claims, members see the total'], ['app/server/institution/clubs.test.ts', 'the sandbox flows']], 'Sandbox only; ROLE_REQUIREMENTS 267: "do not attempt to become a bank".'],
      ['Elections and voting: a roll without choices and ballots without voters', 'building', [['app/server/institution/clubs.ts', 'castVote and tally'], ['app/server/institution/clubs.test.ts', 'held']], 'Sandbox only; ROLE_REQUIREMENTS 266 forbids claiming cryptographic election security.'],
      ['Attendance, only where justified and disclosed', 'not-started', [['docs/ROLE_REQUIREMENTS.md', 'items 262 and 263: no public attendance data, no hidden location attendance']], 'Nothing records attendance for an organization, which is the safe default until an event workflow exists.'],
      ['Advisor review, required training, risk forms, document archive, communication preferences, incident handoff', 'not-started', [], 'Six officer-dashboard panels with no table, type or screen.'],
      ['Committee, chapter and affinity subgroups under an organization', 'not-started', [], 'No subgroup scope; the role model has no committee lead.'],
    ],
  },
  {
    id: 'LCY',
    title: 'Recognition lifecycle, officer transition and the constitution',
    why: 'Student organizations fail when officers graduate; continuity has to be built in, and every change of standing has to say who made it, why, and how to appeal.',
    phase: 2,
    master: ['UOS-003'],
    rows: [
      ['Lifecycle states: draft, submitted, under review, active, active with conditions, inactive, archived, dissolved — every legal move written down and the rest refused', 'tested', [['packages/institution/src/workflow.ts', 'ORGANIZATION_RECOGNITION, the machine'], ['packages/institution/src/workflow.test.ts', 'every pair of states; recognition never taken by the organization']], 'The `organizations` table has no status column; the machine is the rule the column will be held to.'],
      ['Every transition records approver, reason, effective date, required follow-up, a student-visible status, an audit event and an appeal route', 'tested', [['app/src/community/lifecycle.ts', 'WHO_MAY, recordTransition, STUDENT_VISIBLE, APPEAL_ROUTE'], ['app/src/community/lifecycle.test.ts', 'every legal move has a seat, no illegal move has one; refusals for no reason, a past date, a conditions move with no follow-up']], 'Nothing stores the record yet.'],
      ['Admin-loss continuity: an organization with no administrator can be claimed by a member', 'tested', [['supabase/migrations/20260921234500_organization_succession.sql', 'claim_abandoned_organization'], ['supabase/organizations.check.sql', 'held']], ''],
      ['End-of-term officer transition: confirm incoming officers, transfer ownership, rotate access, preserve documents, archive by policy, update the advisor, renew recognition, complete training, review commitments', 'tested', [['app/src/community/lifecycle.ts', 'OFFICER_TRANSITION, nextTransitionStep, mayRotateAccess'], ['app/src/community/lifecycle.test.ts', 'access rotates only after confirmation and transfer']], 'A checklist with an order; no screen walks it and no term boundary triggers it.'],
      ['Constitution as a guided, versioned form: eleven sections, required fields, officer and advisor acknowledgement, amendments that keep the version they replaced', 'tested', [['app/src/community/constitution.ts', 'SECTIONS, draft, readyToAdopt, amend'], ['app/src/community/constitution.test.ts', 'boundary sentences cannot be written away; a field the template lacks is refused']], 'No org-owned document store: `public.forms` is user-owned.'],
      ['The no-emergency-service notice and the disciplinary-authority boundary in every constitution', 'tested', [['app/src/community/constitution.ts', 'DISCIPLINE_BOUNDARY; NOT_AN_EMERGENCY_SERVICE from governance.ts'], ['app/src/community/constitution.test.ts', 'adoption refused when either is changed']], ''],
      ['Institution recognition office → campus administrator → organization → advisor → president → officers → committee leads → members → visitors, as seats with powers and limits', 'building', [['app/src/community/lifecycle.ts', 'four seats and which moves each may make'], [ORG_SQL, 'members and officer capabilities']], 'Advisor, campus administrator and committee lead exist only as seats in the lifecycle rule; no role grant or RLS knows them.'],
    ],
  },
  {
    id: 'EVT',
    title: 'Events and the event risk workflow',
    why: 'Club events involve travel, crowds, alcohol, minors and facilities; the workflow supports the approvals and never judges the facts.',
    phase: 2,
    master: ['UOS-003', 'STU-010'],
    rows: [
      ['Event discovery from an imported or static source, past and upcoming', 'tested', [['app/src/lib/campusdirectory.ts', 'parseDirectory for events; upcomingEvents'], ['app/src/lib/campusdirectory.test.ts', 'held'], ['app/src/data/events.ts', 'CAMPUS_CALENDARS shown on the calendar']], 'No verified live source (master UOS-003).'],
      ['Save an event; add it to a calendar only by explicit choice', 'building', [['app/src/components/CampusDirectory.tsx', 'a saved star, on the device'], ['app/src/lib/connect.ts', 'addEvent writes to Google or Microsoft after a tap']], 'Calendar writes cover deadlines and classes, not campus events; ICS export does not reach directory events.'],
      ['RSVP with capacity, at approved venues only', 'tested', [[COMMUNITY_SQL, 'community_sessions 2–12 places, community_venues approved list'], ['supabase/community.check.sql', 'held']], 'Study sessions only, in course and study-group communities. No organization event.'],
      ['Draft → approval and risk workflow → published → RSVP → calendar → optional check-in → feedback → close → evidence', 'not-started', [], 'No events table owned by an organization; no approval state. ADR-0009 says this is a workflow machine.'],
      ['Event risk fields: type and scale, facility confirmation, accessibility plan, travel indicator, required approvals, advisor confirmation, emergency contact, training and waiver checklist, insurance documents, post-event incident link', 'not-started', [], 'None modelled.'],
      ['Check-in only where the host enables it; never location-based or public', 'not-started', [['docs/ROLE_REQUIREMENTS.md', 'item 262']], 'Specification only; a QR encoder exists in lib/qr.ts and nothing uses it for this.'],
      ['Event reminders with an owner, a preference, a cap and a way out', 'tested', [['app/src/lib/notify.ts', 'tiers, caps, quiet hours, the why line'], ['app/src/lib/notify.test.ts', 'held']], 'The engine exists; no event rule is registered in NOTIF_DEFS.'],
    ],
  },
  {
    id: 'CIR',
    title: 'Peer circles and structured study groups',
    why: 'A bounded group with a purpose, a cap, a facilitator and an end date is safer and more useful than an endless anonymous feed.',
    phase: 3,
    master: ['UOS-003'],
    rows: [
      ['Twelve circle types, each with a purpose', 'tested', [['app/src/community/circles.ts', 'CIRCLE_TYPES'], ['app/src/community/circles.test.ts', 'held']], 'No `communities.kind` for a circle; `study_group` is the nearest.'],
      ['A circle opens only with purpose, cap, start and end, a trained facilitator, a code of conduct, cadence, accessibility and time zone, meeting boundaries, a reporting route and a closure plan', 'tested', [['app/src/community/circles.ts', 'openCircle names every bound broken'], ['app/src/community/circles.test.ts', 'a term not a lifetime; not a pair']], 'The `communities` table has no cap, date, facilitator or closure column.'],
      ['Joining refused only by the cap, the end date and being in already; leaving is one tap', 'tested', [['app/src/community/circles.ts', 'join, ALWAYS_SHOWN'], [COMMUNITY_SQL, 'the "leave a community" delete policy'], ['app/src/community/circles.test.ts', 'held']], ''],
      ['Sensitive circles never list their members', 'tested', [['app/src/community/circles.ts', 'SENSITIVE_TYPES, rosterVisible'], [COMMUNITY_SQL, 'community_members: your own rows only'], ['app/src/community/circles.test.ts', 'held']], ''],
      ['Study group: course or topic, term and meeting pattern, format, goals, materials policy, facilitator rotation, calendar links, opt-in notes', 'tested', [['app/src/community/circles.ts', 'StudyPlan, nextFacilitator, notesShared'], ['app/src/community/circles.test.ts', 'held']], 'A study group today is a name and a purpose (`createStudyGroup`); the plan has nowhere to live.'],
      ['No automatic sharing of grades, accommodations, attendance or submissions; attendance optional; the integrity reminder', 'tested', [['app/src/community/circles.ts', 'NEVER_SHARED, ATTENDANCE_OPTIONAL, INTEGRITY_REMINDER'], [COMMUNITY_SQL, 'nothing reads a location, a schedule or a grade'], ['app/src/community/circles.test.ts', 'held']], ''],
      ['No "best student" ranking and no matching on protected or inferred traits', 'tested', [['app/src/lib/groupwork.ts', 'perPerson sorted by name so it is not a league table'], ['app/src/community/circles.ts', 'assertSuggestionInputs'], ['app/src/community/circles.test.ts', 'held']], ''],
      ['Shared focus timer for a study group', 'not-started', [], 'No group timer; the personal timer in Study is not shared.'],
    ],
  },
  {
    id: 'MNT',
    title: 'Peer mentorship',
    why: 'Structured, opt-in and time-bounded, with trained mentors, transparent matching and a way out at every check-in — not an unrestricted matching and chat feature.',
    phase: 3,
    master: ['UOS-007'],
    rows: [
      ['A request needs the mentor\'s yes; capacity is checked at acceptance; nobody writes the request table directly', 'tested', [[MENTOR_SQL, 'request_mentor, answer_mentor_request'], ['supabase/mentor-rosters.check.sql', 'held'], ['app/src/lib/mentors.ts', 'reads and calls only']], ''],
      ['A pairing is time-limited', 'tested', [[EXPANSION_SQL, 'peer_mentor_assignments: 180 days at most; either end ends it'], ['supabase/expansion.check.sql', 'held']], 'No client function or screen ends an accepted match.'],
      ['Seven programme templates with a purpose, weeks and scope, and what mentoring is not for', 'tested', [['app/src/community/mentorship.ts', 'PROGRAMS, OUT_OF_SCOPE, MENTOR_BOUNDARY'], ['app/src/community/mentorship.test.ts', 'held']], 'Only `peer` and `alumni` kinds exist in the database.'],
      ['Mentor eligibility: application, code-of-conduct acknowledgement, four training modules, yearly renewal, capacity', 'tested', [['app/src/community/mentorship.ts', 'TRAINING_MODULES, eligibilityProblems, RENEWAL_DAYS'], ['app/src/community/mentorship.test.ts', 'training expires']], 'No mentor application or training table; `peer_mentor_offers` carries topics and capacity only.'],
      ['Mentee request: programme, goal, topics, availability, format, language, communication style, optional accessibility needs, lived experience only when asked', 'tested', [['app/src/community/mentorship.ts', 'MenteeRequest'], ['app/src/community/mentorship.test.ts', 'held']], '`mentor_requests` carries topics and a note only.'],
      ['Transparent matching: a short explainable set with "why this person may be a fit", mutual acceptance, decline or rematch without penalty', 'tested', [['app/src/community/mentorship.ts', 'explainMatch, move'], ['app/src/lib/launchpad.ts', 'matchMentors on ticked interests'], ['app/src/community/mentorship.test.ts', 'at most three, never a score; lived experience only when asked']], ''],
      ['Never matched on inferred disability, mental health, protected identity, grades, risk labels, behavioural profiles or private records', 'tested', [['app/src/community/mentorship.ts', 'FORBIDDEN_MATCH_INPUTS, assertMatchInputs'], ['app/src/community/mentorship.test.ts', 'every forbidden input refused']], ''],
      ['Mentorship workspace: welcome and boundaries, shared goal, first-meeting agenda, voluntary action items, referral to official services, midpoint and end check-ins, pause, rematch and close, completion reflection', 'tested', [['app/src/community/mentorship.ts', 'checkIns, FIRST_MEETING_AGENDA, PAIRING_NOTICE'], ['app/src/community/mentorship.test.ts', 'four check-ins dated from start and end']], 'After acceptance the screen says only that the programme takes over; nothing shows the check-ins.'],
      ['Coordinator dashboard: applications, trained mentors, waiting, unaccepted matches, active, rematches, and completion figures under the cohort floor', 'tested', [['app/src/community/mentorship.ts', 'coordinatorSummary through suppress()'], ['app/src/community/mentorship.test.ts', 'figures withheld under the floor']], 'No coordinator role or screen; no mentorship metric in the analytics dictionary (D-005 applies).'],
      ['No default recording, no surveillance of private messages, no sentiment or mental-health analysis', 'tested', [['app/src/community/communities.ts', 'messagingMode: structured requests only, no direct messages'], ['app/src/community/feed.test.ts', 'held']], ''],
    ],
  },
  {
    id: 'QNA',
    title: 'Campus questions and answers',
    why: 'A source-aware alternative to the group chat: every answer says whether the institution, an office or a student said it, when it was last checked, and whether it still stands.',
    phase: 1,
    master: ['STU-012', 'TRUST-001', 'TRUST-002'],
    rows: [
      ['Answer kinds: institution-verified, office owner, student experience, official link, outdated or needs review', 'tested', [['app/src/community/questions.ts', 'ANSWER_KINDS'], ['app/src/community/questions.test.ts', 'held']], 'No question or answer table or screen.'],
      ['Source, scope and status on every answer, with the last-reviewed date and the owning office', 'tested', [['app/src/community/questions.ts', 'SCOPES, STATUSES, labelLine'], ['app/src/lib/source.ts', 'the source vocabulary it reuses'], ['app/src/community/questions.test.ts', 'held']], ''],
      ['Only a fact the office confirmed carries the institution\'s label (DO-NOT-BUILD rule 7)', 'tested', [['app/src/community/questions.ts', 'verify refuses without office and confirmation'], ['app/src/community/questions.test.ts', 'held'], ['app/src/lib/source.test.ts', 'the same rule app-wide']], ''],
      ['An answer turns to needs-review after 180 days or two student reports; a re-review clears it', 'tested', [['app/src/community/questions.ts', 'statusOf, reportOutdated, rereview'], ['app/src/community/questions.test.ts', 'held']], ''],
      ['Offices claim and maintain common questions; the institution sees the unclaimed, most-asked first', 'tested', [['app/src/community/questions.ts', 'claim, unclaimed'], ['app/src/community/questions.test.ts', 'held']], 'The nearest live thing is `institution_actions` with an office and a status; it is actions, not answers.'],
      ['Ask → trusted answer → action → report stale → owner updates → the next student gets a better answer', 'building', [['app/src/lib/institution-ops.ts', 'questionThemes: grouped, never who asked'], ['app/src/lib/help-routes.ts', 'a question becomes a request to a named office']], 'The loop has its ends (a request, an aggregate) and not its middle.'],
    ],
  },
  {
    id: 'SAF',
    title: 'Student-facing safety controls and the severity ladder',
    why: 'A safe community layer is a product system, not a report button added at the end.',
    phase: 1,
    master: ['STU-011', 'TRUST-003'],
    rows: [
      ['Block a person', 'tested', [['supabase/migrations/20260901000200_classmates.sql', 'blocks'], [COMMUNITY_SQL, 'block_community_author; blocked_either_way gates reads'], ['supabase/community.check.sql', 'held']], 'Blocks a post\'s author or a classmate; no profile, event or message to block from.'],
      ['Mute a person, thread, group or notification category', 'tested', [[COMMUNITY_SQL, 'community_mutes per author per community'], ['supabase/community.check.sql', 'held'], ['app/src/lib/roomprefs.ts', 'class rooms muted on the device']], 'A person only; no thread, whole-community or category mute.'],
      ['Report a post, comment, message, profile, event, club or opportunity', 'tested', [[COMMUNITY_SQL, 'report_community_post'], ['supabase/migrations/20260901000200_classmates.sql', 'reports on a message or an account'], ['supabase/reports.check.sql', 'held']], 'Posts and class messages only; `community_cases.post_id` is not null, so a case cannot be about a club, an event or a person.'],
      ['Specific report reasons: spam and scam, harassment, hate, threat or self-harm, doxxing, sexual harassment, academic integrity, commercial solicitation, club or event policy, accessibility barrier, outdated information', 'tested', [['app/src/community/moderation.ts', 'REPORT_CATEGORIES, nine; qualifiers for self-harm and sexual'], ['app/src/community/moderation.test.ts', 'covers every category']], 'Four of the blueprint\'s reasons are missing: commercial solicitation, club or event policy, accessibility barrier, outdated information. Self-harm and sexual harassment are qualifiers the SQL does not take.'],
      ['Context and evidence on a report', 'tested', [['app/src/components/community/ReportSheet.tsx', 'details up to 1000 characters and an imminent checkbox'], ['app/src/screens/Community.test.tsx', 'held']], 'No attachment or screenshot.'],
      ['The reporter chooses whether they want a response, and sees a receipt and a case status', 'building', [['app/src/screens/Community.tsx', '"Report sent. A trained reviewer will look at it"'], [COMMUNITY_SQL, 'the reporter reads their own report rows; cases are reviewer-only']], 'No response choice and no status for the reporter, by design: the reporter\'s identity is readable by nobody. The reported author does see status.'],
      ['Leave a group or a match immediately', 'tested', [[COMMUNITY_SQL, 'the "leave a community" policy'], [EXPANSION_SQL, 'either end ends a mentor assignment'], ['supabase/community.check.sql', 'held']], 'No client function ends an accepted mentor match.'],
      ['Localized official emergency guidance; Semester is not an emergency service', 'tested', [['app/src/community/crisis.ts', 'CRISIS_NOTICE'], ['app/src/community/governance.ts', 'NOT_AN_EMERGENCY_SERVICE, never 24/7'], ['app/src/community/governance.test.ts', 'held'], ['app/src/lib/support.ts', 'the safety office and 911/988']], 'Numbers are US-only and not per tenant; the report sheet does not link the tenant\'s route.'],
      ['Five severity levels with an immediate response, a human owner and a target', 'tested', [['app/src/community/governance.ts', 'SEVERITY_LADDER P0–P4'], ['app/src/community/moderation.ts', 'provisionalSeverity P0–P3'], ['app/src/community/governance.test.ts', 'P4 opens no case'], ['docs/CAMPUS-MODERATION-SOP.md', 'the operating table']], '`community_cases.severity` allows P0–P3; P4 is the level that opens no case, which the schema expresses by absence. No target is timed anywhere.'],
      ['Automation triages and never imposes a permanent penalty; human review before suspension or dissolution', 'tested', [['app/src/community/moderation.ts', 'AUTOMATION_ACTIONS: reduce, rate-limit, preserve; protect() throws on anything else'], ['app/src/community/moderation.test.ts', 'automation never decides'], [COMMUNITY_SQL, 'triage holds, reduces or queues']], 'accountReview() recommends but is not wired to SQL or the console; dissolving a community does not exist.'],
    ],
  },
  {
    id: 'MOD',
    title: 'Moderator console, automated safeguards and the evidence vault',
    why: 'Moderators need concrete guidelines, role-based permissions and clear escalation paths; "be respectful" alone is too vague to apply fairly.',
    phase: 1,
    master: ['TRUST-003', 'UOS-008'],
    rows: [
      ['Role-based moderator permissions: reviewer, senior reviewer, community manager, escalation agreements', 'tested', [[COMMUNITY_SQL, 'community:review, review_senior, manage, escalation_agreements'], ['supabase/community.check.sql', 'held'], ['app/src/screens/Moderation.test.tsx', 'the console']], 'Reviewers are platform staff at global scope; no tenant-scoped or club moderator has any power.'],
      ['One queue for reports, automated flags and escalations, by severity then age', 'tested', [['app/src/community/client.ts', 'loadQueue'], ['app/src/screens/Moderation.tsx', 'the queue'], ['app/src/screens/Moderation.test.tsx', 'held']], 'Separate queues remain for class-message reports, opportunities and volunteer work.'],
      ['Severity, status, assignee, service level and escalation timers on a case', 'building', [[COMMUNITY_SQL, 'severity and status open, decided, appealed, closed']], 'No assignee, no due time, no timer. `report_status.sql` deliberately adds no handled_by; a service level is what the `sla` launch gate makes a tenant commit to.'],
      ['Immutable case timeline and audit log', 'tested', [[COMMUNITY_SQL, 'community_case_events: append-only, actor hashed'], ['supabase/migrations/20260924223000_moderation_audit.sql', 'trigger-enforced immutability for class-message reports'], ['supabase/moderation-audit.check.sql', 'held']], 'Case events have no immutability trigger and are deleted with the case at retention; the console does not show the timeline.'],
      ['Redacted evidence preview and controlled access', 'building', [['app/src/community/pii.ts', 'redact() for the author\'s composer']], 'The console shows the full post and image; nothing redacts for a reviewer.'],
      ['Content actions: hide, limit reach, lock, remove, restore; account actions: warn, restrict, suspend, ban, re-acknowledge; group actions; event actions; decision templates', 'tested', [['app/src/community/moderation.ts', 'DECISION_ACTIONS'], [COMMUNITY_SQL, 'apply_community_action; restrictions of 1, 14 and 30 days'], ['app/src/community/moderation.test.ts', 'who may decide']], 'No warn, permanent ban, re-acknowledgement, group or event action; lock and limit remove the post because replies do not exist; the reason code is free text, not a template.'],
      ['Appeal intake, independent review and a final record', 'tested', [[COMMUNITY_SQL, 'decide_community_appeal refuses anyone who decided the case'], ['app/src/community/moderation.test.ts', 'decided by a different professional'], ['supabase/community.check.sql', 'held']], 'Authors appeal; reporters cannot.'],
      ['Moderator notes separate from user-visible communication; search by case id only; privacy-protected trend dashboard', 'not-started', [], 'Only the reason code exists and the author sees it; no search; per-signal outcomes are written and never aggregated.'],
      ['Rate limits for new accounts, messages, posts and invitations', 'tested', [['supabase/migrations/20260928230000_direct_rate_limits.sql', 'per-table limits: posts 30/h, reports 20/h, communities 10/day, mentor requests 20/day'], ['supabase/rate-limits.check.sql', 'held'], [COMMUNITY_SQL, 'per-community posting limits; aliases 3/h']], 'No account-age limit outside volunteer eligibility; there are no invitations or direct messages to limit.'],
      ['Link reputation, spam and duplicate detection, impersonation signals, PII exposure, keyword triage, repeat-offender review', 'tested', [['app/src/community/detectors.ts', 'fifteen seeded rules, versioned'], ['app/src/community/pii.ts', 'detectPii, prePostCheck'], ['app/src/community/detectors.test.ts', 'held'], ['app/src/community/pii.test.ts', 'held']], 'One shortened-link rule is the whole link reputation; no duplicate-text detection; repeat-offender review is TS-only and the safety state programme is off.'],
      ['Malware scanning of uploads', 'building', [['supabase/functions/_shared/mediascan.ts', 'magic bytes, metadata, hashes, known-abuse match']], 'Not a malware scanner and not deployed.'],
      ['Every automated flag records why, which policy, confidence, what happened, whether a human reviewed it, the final decision and the appeal outcome', 'tested', [[COMMUNITY_SQL, 'community_signals: detector, rule, confidence, version, route, human_outcome with the appeal suffix'], ['supabase/community.check.sql', 'held']], 'No explicit policy reference or automated-action field.'],
      ['Evidence vault: redacted snapshots, access logs, retention and legal hold, export controls', 'building', [['supabase/migrations/20260929030000_retention_sweeps.sql', 'sweeps; audit kept three years'], [COMMUNITY_SQL, 'retain_until 90 days or a year'], ['supabase/retention-sweeps.check.sql', 'held']], 'No legal hold on a case, no snapshot, no case export, and a reviewer\'s view of a case is not logged.'],
      ['Break-glass access with reason, approval, logging and review; no shared moderator accounts; time-bound support access', 'designed', [['app/src/lib/ops/console.ts', 'a two-person duty'], ['ops/operations-console/README.md', 'the control']], 'Not modelled in code; the nearest built thing is the two-reviewer, four-hour identity grant.'],
      ['Institution escalation: P0/P1 only, two professionals, a minimum-data payload, one per case', 'tested', [[COMMUNITY_SQL, 'community_escalation_policies and escalations'], ['docs/CAMPUS-ESCALATION-POLICY.md', 'the policy'], ['app/src/screens/Agreements.tsx', 'the agreement screen'], ['supabase/community.check.sql', 'held']], 'Delivery code exists and is not deployed; the programme is off.'],
    ],
  },
  {
    id: 'PRV',
    title: 'Community privacy controls',
    why: 'Academic identity and community identity are different things, and the student decides who sees which.',
    phase: 1,
    master: ['STU-011', 'TRUST-003', 'UOS-007'],
    rows: [
      ['Academic identity separated from community identity', 'tested', [['app/src/community/identity.ts', 'three layers; FORBIDDEN_FIELDS'], ['app/src/community/identity.test.ts', 'held'], ['docs/COMMUNITY-PRIVACY-MODEL.md', 'the model']], ''],
      ['No public member list for sensitive groups', 'tested', [[COMMUNITY_SQL, 'community_members returns your own rows, for every community'], ['supabase/community.check.sql', 'held']], 'Stricter than asked: no member list for any community.'],
      ['Who can message, mention, invite or see RSVPs', 'tested', [['app/src/community/communities.ts', 'no direct messages; structured requests in three types'], ['app/src/community/feed.test.ts', 'held']], 'By absence: there is nothing to control yet, and no control to set when there is.'],
      ['Approve connection requests', 'tested', [[MENTOR_SQL, 'only the recipient accepts'], ['supabase/mentor-rosters.check.sql', 'held']], 'Mentor requests only; no general connection.'],
      ['Default profile privacy per tenant; discoverability by name, programme, club or email; hide activity from classmates; RSVP visibility', 'not-started', [], 'No setting or column for any of the four.'],
      ['Pseudonymous participation where policy and safety allow', 'tested', [[COMMUNITY_SQL, 'aliases, approval, just-in-time reveal by two reviewers'], ['docs/PSEUDONYMITY-POLICY.md', 'the policy'], ['supabase/community.check.sql', 'held']], 'The programme is off and refuses production from the environment.'],
      ['Export or delete eligible student-created content', 'tested', [['supabase/migrations/20260929010000_account_erasure_and_export.sql', 'export_my_data, erase_account'], [COMMUNITY_SQL, 'forget_my_community'], ['supabase/deletion.check.sql', 'held'], ['app/src/screens/Privacy.tsx', 'the buttons']], ''],
      ['Block, mute, report and leave easily', 'tested', [['app/src/screens/Community.tsx', 'all four on a post'], ['app/src/screens/Community.test.tsx', 'held']], ''],
    ],
  },
  {
    id: 'SRV',
    title: 'Campus service directory',
    why: 'A student should be able to say "I need help with X" and receive safe, source-labelled next steps rather than a vague directory.',
    phase: 1,
    master: ['STU-012', 'UOS-001', 'TRUST-002'],
    rows: [
      ['"I need help with" as a route to a named office, with the student holding the pen', 'tested', [['app/src/lib/help-routes.ts', 'NEEDS, seven context fields unticked, DIRECTORY_ONLY'], ['supabase/migrations/20260927230000_help_requests.sql', 'destinations and requests'], ['app/src/lib/help-routes.test.ts', 'CONTEXT_KEYS read from the migration'], ['supabase/help-requests.check.sql', 'held']], 'Wellbeing, accessibility and money are directory-only by design.'],
      ['Fifteen categories: tutoring, writing, library, accessibility, career, money, legal, wellness, basic needs, technology, transportation, childcare, international, jobs, volunteering', 'tested', [['app/src/community/services.ts', 'CATEGORIES'], ['app/src/lib/support.ts', 'the static map with a privacy line per door'], ['app/src/community/services.test.ts', 'held']], '`support.ts` covers about half; the rest exist as office ids or help-route kinds.'],
      ['Every listing: owner, official/partner/peer label, eligibility, cost, hours, accessibility, languages, appointment route, location, last verified, broken-link report', 'tested', [['app/src/community/services.ts', 'ServiceListing, problems, reportBroken'], ['app/src/community/services.test.ts', 'every missing field named']], '`help_destinations` has name, link, hours and accepts-requests; no eligibility, cost, accessibility, languages or verified date.'],
      ['Verified on the same window content governance gives campus services, and stale after it', 'tested', [['app/src/community/services.ts', 'freshness at 90 days'], ['app/src/lib/launch/content.ts', 'campus_services reviewEveryDays 90'], ['app/src/community/services.test.ts', 'the two held equal']], ''],
      ['Next steps: complete listings, official first, stale last, each with its source line; eligibility shown and never evaluated', 'tested', [['app/src/community/services.ts', 'nextSteps'], ['app/src/lib/listings.ts', 'the same rule for opportunities'], ['app/src/community/services.test.ts', 'held']], 'No screen calls it; Support shows the static map.'],
      ['The institution sees stale, reported or incomplete listings, never a student', 'tested', [['app/src/community/services.ts', 'needsAttention'], ['app/src/community/services.test.ts', 'held']], 'Master STU-009 and UOS-001: no resources index with owner, source and freshness.'],
    ],
  },
  {
    id: 'OPP',
    title: 'Opportunity exchange, projects and portfolio',
    why: 'Turn real work into evidence the student controls, and never hide unpaid status or rank students for employers.',
    phase: 4,
    master: ['UOS-004', 'UOS-005'],
    rows: [
      ['Moderated listings from employers, offices and partners, https only, published only after review', 'tested', [[EXPANSION_SQL, 'opportunities: draft, pending_review, published, removed'], ['supabase/migrations/20260928031700_opportunity_links.sql', 'https only'], ['supabase/listings.check.sql', 'held'], ['app/src/lib/listings.ts', 'the client']], ''],
      ['Fourteen opportunity kinds: research, campus jobs, internships, work-study, volunteer, leadership, tutoring, organization roles, competitions, scholarships, fellowships, study abroad, micro-internships, project collaboration', 'building', [['app/src/lib/opportunities.ts', 'seven tracker kinds'], ['app/src/lib/career.ts', 'seven board kinds']], 'Volunteer, leadership, peer tutoring, organization roles, competitions, micro-internships and project collaboration are not kinds anywhere.'],
      ['Listing fields: eligibility, deadline, compensation or unpaid status, time commitment, supervisor, accommodation contact, source and verification, application handoff, save and reminder', 'building', [[EXPANSION_SQL, 'eligibility, deadline, url'], ['app/src/lib/opportunities.ts', 'deadline reminders and hours per week on the device']], 'Compensation, time commitment, supervisor, accommodation contact and a verified date are not on the listing.'],
      ['No opaque ranking of students for employers', 'tested', [['app/src/lib/listings.ts', 'arrange() by deadline only'], ['app/src/lib/listings.test.ts', 'held'], [EXPANSION_SQL, 'talent_profiles has no score']], ''],
      ['Project page: role and contribution, skills, artifacts, consent and visibility, optional verification, team acknowledgements, reflection, badge eligibility, export, employer-sharing controls', 'tested', [['app/src/lib/career-evidence.ts', 'artifacts citing a course or entry; résumé versions'], ['app/src/lib/career-evidence.test.ts', 'held'], ['docs/CREDENTIAL-WALLET.md', 'the share model to come']], 'Device-local; no per-item visibility, team, verification or employer control (expansion CRD and PRF rows).'],
      ['Co-curricular record: participation → reflection → optional verification → issuer metadata → private record → student-controlled share → Open Badges or CLR', 'designed', [['docs/CREDENTIAL-WALLET.md', 'standards order; issuer revocation named as the gap'], [EXPANSION_SQL, 'skill_records with scoped verifiers']], 'No badge entity; nothing exports; check-in is never treated as proof of learning.'],
    ],
  },
  {
    id: 'GRF',
    title: 'Academic life graph, campus pulse and the co-design studio',
    why: 'An explainable map the student edits, aggregate signals the institution can act on without watching anyone, and a channel where students see that Semester listens.',
    phase: 3,
    master: ['UOS-001', 'UOS-008'],
    rows: [
      ['Skills graph with evidence links and reasons; skills confirmed, renamed or rejected by the student', 'tested', [['app/src/lib/skills-graph.ts', 'deriveSkillClaims, explainFit'], ['app/src/lib/skills-graph.test.ts', 'held']], 'Skills only; not courses, clubs, service, jobs, mentors, credentials, goals and support in one editable map (expansion EVG-002).'],
      ['Every connection editable, every recommendation explained; never a black-box ranking', 'tested', [['app/src/lib/actions.ts', 'the Explanation shape every action carries'], ['app/src/lib/actions.test.ts', 'held']], 'The shape exists; the graph that would use it does not.'],
      ['Campus pulse: unfindable resources, unanswered questions, stale links, event-discovery failures, communities lacking accessible information — aggregate only', 'building', [['app/src/lib/institution-ops.ts', 'MIN_COHORT, suppress, FORBIDDEN sources; question_themes, access_barriers defined'], ['app/src/lib/cohortfloor.test.ts', 'suppression held']], 'The metrics are defined; no migration creates their source tables, and none of the five signals is captured.'],
      ['Never an individual engagement score, an at-risk label or behavioural monitoring for faculty, advisors, employers or administrators', 'tested', [['app/src/lib/institution-ops.ts', 'FORBIDDEN: risk_score, attention, wellbeing_score, location'], ['app/src/lib/institution-ops.test.ts', 'held'], ['app/src/lib/expansiongovernance.ts', 'DEFERRED: behavioral risk scoring, student surveillance']], ''],
      ['Co-design studio: propose, vote and comment, paid usability research, plan status, "you said, we did", accessibility friction, suggest a missing service or organization', 'building', [['supabase/migrations/20260921215800_feedback.sql', 'feedback of five kinds, author-only'], ['app/src/lib/whatsnew.ts', 'release notes by module'], ['docs/operating-model/RESEARCH-AND-SERVICE-DESIGN.md', 'compensate participants']], 'Feedback has no status, vote or public plan; release notes are not linked to what was asked for.'],
    ],
  },
  {
    id: 'ACC',
    title: 'Personal accessibility workspace',
    why: 'Semester\'s defining feature can be that a student controls how it reads, without disclosing a diagnosis to anyone.',
    phase: 1,
    master: ['A11Y-004'],
    rows: [
      ['Access modes and presets, never inferred from behaviour', 'building', [['app/src/lib/accessmode.ts', 'plain, chunk, predictable, sensory; focus, reading, low-load'], ['app/src/components/AccessModes.tsx', 'the control']], 'No test of the presets themselves; the master A11Y rows test the components they change. No diagnosis is asked anywhere.'],
      ['Reading mode, font and spacing, reading width, a hyperlegible face', 'tested', [['app/src/lib/look.ts', 'textSize, lineHeight, readingWidth, bodyface'], ['app/src/lib/contrast.test.ts', 'every ground held']], ''],
      ['Text-to-speech on the device', 'tested', [['app/src/lib/speak.ts', 'say, readAloud'], ['app/src/lib/speak.test.ts', 'held']], ''],
      ['Contrast, colour and reduced motion', 'tested', [['app/src/lib/prefers.ts', 'prefersLessMotion, usePrefersContrast'], ['app/src/lib/contrast.test.ts', 'held']], ''],
      ['Keyboard shortcuts and accessible mathematics', 'tested', [['app/src/lib/keys.ts', 'SHORTCUTS'], ['app/src/lib/maths.ts', 'MathML'], ['app/src/lib/keys.test.ts', 'held'], ['app/src/lib/maths.test.ts', 'held']], ''],
      ['Caption and transcript preference; document accessibility checks', 'building', [['app/src/lib/transcript.ts', 'podcast transcripts'], ['app/src/lib/exportqa.ts', 'docx and pdf parity including alt text']], 'No caption preference setting; no student-facing checker for an arbitrary document.'],
      ['Preference portability across every Semester module', 'building', [['app/src/lib/look.ts', 'look keys sync across devices']], 'Not in an exportable profile (expansion PRF-003).'],
      ['One personal accessibility workspace rather than settings scattered under Look', 'not-started', [], 'The settings exist; the single surface does not.'],
    ],
  },
  {
    id: 'NET',
    title: 'Supporters, alumni, employers, and the commerce that waits',
    why: 'Student-granted, time-limited and revocable is the only supporter model; employer access is opt-in and never reaches academic data; marketplace and rides wait for their own trust-and-safety and legal model.',
    phase: 4,
    master: ['UOS-007', 'UOS-005'],
    rows: [
      ['Supporter access: student-granted, scope- and time-limited, one logged reader, easy revocation', 'tested', [['supabase/migrations/20260921161500_roles.sql', 'family_grants'], ['supabase/migrations/20260928306000_family_invites.sql', 'eight-character invite, selected only'], ['supabase/migrations/20260928307000_family_shared_items.sql', 'items and access events'], ['app/src/lib/familyshare.test.ts', 'held']], 'The minors and guardian-consent policy is an open decision (docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md).'],
      ['Parental access never assumed', 'tested', [['ops/strategic-boundaries/README.md', 'boundary 5: no generic parent access, mechanical'], ['app/src/lib/ops/boundaries.test.ts', 'held']], ''],
      ['Alumni and peer mentor offers with capacity, and a mutual yes', 'tested', [[EXPANSION_SQL, 'alumni_mentor_offers'], [MENTOR_SQL, 'request and answer'], ['supabase/mentor-rosters.check.sql', 'held'], ['app/src/components/MentorFinder.tsx', 'the finder']], ''],
      ['Employer participation: opt-in, expiring, a receipt per view; no academic data targeting', 'tested', [[EXPANSION_SQL, 'talent_profiles opt-in expires at 180 days; talent_profile_views'], ['supabase/expansion.check.sql', 'held'], ['docs/DO-NOT-BUILD.md', 'rule 10']], 'No verified-employer vetting outside the sandbox, no office hours, panels, or anti-spam limits; no student screen for the profile.'],
      ['Marketplace, resale, ticketing, payments and ride coordination: only after dedicated trust-and-safety, financial and legal infrastructure', 'designed', [['app/src/lib/expansiongovernance.ts', 'DEFERRED: unreviewed marketplace transactions, payment credential storage'], ['ops/strategic-boundaries/README.md', 'boundary 12: no unmoderated marketplace or public social feed']], 'Not built, and gated by a Tier 4 governance review; `opportunities.kind` already allows deal and housing, which a marketplace would have to be held apart from.'],
    ],
  },
  {
    id: 'INT',
    title: 'Social-media integrations and the social API',
    why: 'Integrations are distribution and import/export tools, never hidden data collection; the API is how an institution takes its community data with it.',
    phase: 5,
    master: ['TRUST-003'],
    rows: [
      ['Seven providers, each with what a student sees, who controls it, a privacy boundary and a minimal scope', 'tested', [['app/src/community/integrations.ts', 'PROVIDERS, REQUIREMENTS'], ['app/src/community/integrations.test.ts', 'held']], '`integration_connections.provider_domain` is a closed list with no social domain; a live connection needs a migration.'],
      ['OAuth only, minimal declared scopes, organization-owned accounts, an owner and a purpose on every connection, disconnect always', 'tested', [['app/src/community/integrations.ts', 'connect refuses a password, a personal account, a wider scope, no purpose; disconnect'], ['app/src/community/integrations.test.ts', 'held'], ['app/src/lib/oauthscopes.ts', 'the student-side minimal scopes']], ''],
      ['External content labelled as hosted outside Semester', 'tested', [['app/src/community/integrations.ts', 'EXTERNAL_NOTICE from the external trust kind'], ['app/src/lib/source.ts', 'TRUST_KINDS external'], ['app/src/community/integrations.test.ts', 'held']], 'The label is not yet used by any embedded content, because none is embedded.'],
      ['No automatic posting: preview and a named confirmation first', 'tested', [['app/src/community/integrations.ts', 'publish'], ['app/src/community/integrations.test.ts', 'nothing after a disconnect either']], ''],
      ['No scraping of direct messages, followers, contacts, browsing or the social graph', 'tested', [['app/src/community/integrations.ts', 'NEVER_INGESTED, assertNothingIngested'], ['app/src/community/integrations.test.ts', 'held'], ['supabase/migrations/20260927170000_integration_control_plane.sql', 'scopes refused by pattern; T4 never ingested']], ''],
      ['Calendar: subscribe or add an approved event by explicit choice, with the write scope explained', 'tested', [['app/src/lib/connect.ts', 'addEvent after a tap; forget() disconnects'], ['app/src/lib/connect.test.ts', 'held']], 'Student calendars only; campus events are not yet what is written.'],
      ['Institution-level connection governance: owner, status, authentication type, last sync, disconnect, approval, audit', 'tested', [['supabase/migrations/20260927170000_integration_control_plane.sql', 'integration_connections and scopes'], ['supabase/integration-control-plane.check.sql', 'held']], 'Tenant-level, not per club.'],
      ['A versioned REST API with organizations, communities, memberships, roles, events, RSVPs, projects, documents, constitutions, opportunities, recognitions, mentorship programmes, matches, reports, cases, policy, integrations and webhooks', 'building', [['app/server/institution/gateway.ts', 'health, auth config, intelligence, records by area, prepare and commit'], ['packages/institution/src/index.ts', 'UNIVERSITY_AREAS including clubs, career, alumni, directory']], 'None of the eighteen social resources exists; ADR-0003 (no application server) and RLS-first (ADR-0002) mean these are edge functions and views, not a gateway.'],
      ['Tenant in the authorization context, idempotency keys, cursor pagination, rate limits, correlation ids, field-level filtering', 'tested', [['app/server/institution/gateway.ts', 'correlationIdFor; the tenant from the verified identity'], ['supabase/migrations/20260928320000_audit_correlation_and_outbox.sql', 'correlation ids and the outbox'], ['packages/institution/src/workflow.test.ts', 'machines held']], 'No general idempotency header; cursor pagination on records only.'],
      ['SCIM provisioning and de-provisioning', 'tested', [['app/server/institution/scim.ts', 'the gateway'], ['supabase/migrations/20260928200000_scim_gateway.sql', 'storage'], ['supabase/scim-gateway.check.sql', 'held']], 'On only with SEMESTER_SCIM=on.'],
      ['Signed outbound webhooks with retries, delivery logs and replay protection; a sandbox with synthetic data for integrators', 'designed', [['docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md', '"outbound webhooks do not exist"'], ['app/server/institution/sandbox.ts', 'the institution sandbox']], 'Inbound LTI and SCIM verify signatures; nothing is sent out. The sandbox is Semester\'s, not a third party\'s.'],
    ],
  },
  {
    id: 'GOV',
    title: 'Governance: the readiness brief, launch gates, packaging and economics',
    why: 'Community products multiply moderation, privacy, safety, content-rights, identity and governance obligations; the discipline is what lets Semester expand into them without becoming a generic campus app.',
    phase: 1,
    master: ['PRG-001', 'PRG-003'],
    rows: [
      ['A Feature Readiness Brief of fourteen questions before any community, AI, campus-life, career, payments or operations feature', 'tested', [['app/src/community/governance.ts', 'READINESS_BRIEF, brief()'], ['app/src/community/governance.test.ts', 'a bare yes is not an answer'], ['app/src/lib/governance/charters.ts', 'the charter it sits beside'], ['app/src/lib/expansiongovernance.ts', 'the admission gate it sits beside']], 'Nothing requires a brief before a flag is added; the pull-request template asks nine of the fourteen.'],
      ['Eleven launch gates per tenant and per programme, each signed, dated and evidenced, before a switch is thrown', 'tested', [['app/src/community/governance.ts', 'LAUNCH_GATES, readyToEnable()'], ['app/src/community/governance.test.ts', 'covers every programme flags.ts names'], [COMMUNITY_SQL, 'community_programs.approved_ref, service role only']], '`approved_ref` is free text; nothing checks it names a passed gate.'],
      ['The five phases, and the rule that nothing in phase 5 ships before trust-and-safety, financial and legal operations are proven', 'tested', [['app/src/community/governance.ts', 'COMMUNITY_PHASES'], ['app/src/community/governance.test.ts', 'no package in phase 5'], ['docs/STRATEGIC-EXPANSION-REGISTER.md', 'what not to expand into early']], ''],
      ['Six institutional packages, none funded by students', 'tested', [['app/src/community/governance.ts', 'PACKAGES'], ['app/src/community/governance.test.ts', 'safety and foundations first'], ['app/src/lib/plans.ts', 'free, plus, pro, institution: nothing for sale (D-009)']], 'No approved price book (master COM-002); the packages are shape, not price.'],
      ['Eight revenue models refused', 'tested', [['app/src/community/governance.ts', 'REVENUE_NOT_TAKEN'], ['docs/DO-NOT-BUILD.md', 'rule 10'], ['ops/strategic-boundaries/README.md', 'boundary 10: no data sale or behavioural ads, mechanical'], ['app/src/community/governance.test.ts', 'held']], 'Pay-to-win visibility, paying mentors per message and lead sale are refused here and nowhere mechanical yet.'],
      ['Outcome measures as the primary metric, never messages, minutes or daily actives', 'tested', [['app/src/community/governance.ts', 'OUTCOME_MEASURES, NOT_PRIMARY_METRICS'], ['app/src/lib/gtm/kpi.ts', 'first_meaningful_action_rate defined'], ['app/src/community/governance.test.ts', 'held']], 'The first-meaningful-action rate is defined and not collected (D-005 governs any new mark).'],
      ['Unit economics in the operations console: contract value, implementation cost, active members, verified organizations, events, mentorship participation, cases by severity, cost per case, coordinator hours, cost per member, margin by module, renewal risk', 'designed', [['ops/operations-console/README.md', '"there is no operations console yet"'], ['app/src/lib/ops/console.ts', 'the controls as data']], 'No measure has a source; cost per moderation case and coordinator hours are not defined anywhere.'],
    ],
  },
  {
    id: 'LPS',
    title: 'Engagement loops and recognition',
    why: 'The right loop is a cycle of useful progress, not notifications engineered to pull students back.',
    phase: 3,
    master: ['STU-012'],
    rows: [
      ['First-value loop: sign in → what matters this week → one useful action → a visible outcome → preferences → return because the next action is clearer', 'building', [['app/src/lib/today-decision.ts', 'the path snapshot and one next step'], ['app/src/lib/brief.ts', 'morning and evening'], ['app/src/lib/gtm/kpi.ts', 'the first-meaningful-action metric']], 'No "what matters this week" surface names itself; the metric is not collected.'],
      ['Discovery loop: chosen interests → browseable suggestions with why → save or RSVP → calendar by choice → attend → next step', 'building', [['app/src/community/feed.ts', 'why each post is shown; feedback applied'], ['app/src/community/circles.ts', 'what a suggestion may not read']], 'No community or event suggestion exists; no streaks by rule, and the rule is tested.'],
      ['Club contribution loop: join → welcome and conduct → a meaningful role → reflect → evidence → eligible to lead → onboard the next member', 'building', [[ORG_SQL, 'standings from follower to alumni'], ['app/src/community/lifecycle.ts', 'officer readiness as the transition checklist']], 'No welcome step, contribution role, reflection or leadership eligibility path.'],
      ['Event-to-opportunity loop', 'not-started', [], 'No RSVP, check-in or reflection object to start from (EVT).'],
      ['Mentorship loop: topic and goal → transparent matches → mutual yes → boundaries → meetings → midpoint → referral → close, rematch or extend → reflect', 'tested', [['app/src/community/mentorship.ts', 'the pairing and its check-ins'], ['app/src/community/mentorship.test.ts', 'held']], 'No screen walks it.'],
      ['Recognition loop: contribution → private save → evidence and reflection → verification only where appropriate → recognition or credential → the life graph → selective share', 'designed', [['docs/CREDENTIAL-WALLET.md', 'the flow'], ['app/src/lib/career-evidence.ts', 'the private save']], 'No badge, issuer or criteria entity; verification tables exist with no screen.'],
      ['Allowed mechanics with their rules: progress paths, verified badges, reflection milestones, community challenges, event passports, officer readiness, recognition wall', 'tested', [['app/src/community/governance.ts', 'ALLOWED_MECHANICS'], ['app/src/community/governance.test.ts', 'none of them forbidden']], 'Only progress paths (Launchpad steps) and private reflection exist; five of seven are not built.'],
      ['Never streaks, attendance or message leaderboards, randomized rewards, hidden rankings, punitive missed-event notices, pay-to-win promotion or rewards for disclosure', 'tested', [['app/src/community/governance.ts', 'FORBIDDEN_MECHANICS'], ['app/src/community/engagement.test.ts', 'the forbidden words never reach a student; a refusal is told from an offer'], ['app/src/lib/wrapped.test.ts', 'no streak, rank or comparison in the recap'], ['docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md', 'the hard boundaries']], ''],
      ['Recap of student-chosen outcomes, never usage', 'tested', [['app/src/lib/wrapped.ts', 'Semester Wrapped'], ['app/src/lib/wrapped.test.ts', 'held']], ''],
    ],
  },
];

export const AREAS: readonly Area[] = AREA_LIST.map(({ rows: _rows, ...a }) => a);

export const ITEMS: readonly Item[] = AREA_LIST.flatMap((a) =>
  a.rows.map(([item, status, evidence, gap], i) => ({
    id: `${a.id}-${String(i + 1).padStart(3, '0')}`,
    item,
    status,
    evidence: evidence.map(([path, shows]) => ({ path, shows })),
    gap: gap || 'Held in code; nothing under docs/evidence/ shows it operating.',
  })),
);

export const areaOf = (id: string) => AREAS.find((a) => a.id === id.split('-')[0])!;

/** The commit the statuses were read against. */
export const ASSESSED_AT = 'b82df8c';
