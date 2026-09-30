/**
 * The Semester Connect register: every addition the community brief of
 * 29 September 2026 asks for — ten in the app, six on the company site, the
 * social media ecosystem, the fourteen controls it wants before broad social
 * functions, and the order it wants them built — and where the repository
 * stands on each.
 *
 * `docs/SEMESTER-CONNECT-REGISTER.md` is rendered from this file,
 * `community/connect.ts` and `lib/gtm/social.ts` by `connectregister.test.ts`;
 * edit the data, then `npm run registers` from app/.
 *
 * ## How this relates to what is already here
 *
 * `communitiesregister.ts` read four community blueprints against the tree a
 * day earlier, and most of what this brief asks for in the app is an item
 * there under another name: verified organizations are ORG, study
 * communities are CIR, the mentor network is MNT, the showcase is OPP. Where
 * that is so, the row here names the item it overlaps (`overlaps`), the test
 * holds that the item exists, and the status is read again rather than
 * copied — a day is long enough in this repository for a status to move.
 * What this brief adds that the blueprints did not is where the layer
 * *appears* (the hub), what a suggestion says about itself, the visibility
 * ladder of the showcase, collaboration rooms, the site's six community
 * pages, and the social plan; those rows overlap nothing.
 *
 * The statuses and the evidence rule are the communities register's:
 * `designed` cites a document, `building` cites code, `tested` cites a test,
 * and nothing is above `tested` because nothing has an artifact under
 * `docs/evidence/`.
 *
 * Assessed against `origin/main` at `8f4d38b` on 2026-09-29, with this
 * branch's own files counted where they close an item.
 */
import type { Status } from './communitiesregister';

export { STATUSES, type Status } from './communitiesregister';

export interface Area {
  id: string;
  title: string;
  /** Where the brief puts it: the app, the site, or the plan around both. */
  where: 'app' | 'site' | 'plan' | 'controls';
  /** What the brief says it is for, in one sentence. */
  why: string;
}

export interface Item {
  id: string;
  item: string;
  status: Status;
  evidence: readonly { path: string; shows: string }[];
  gap: string;
  /** Communities-register items this one is the same thing as. */
  overlaps: readonly string[];
}

type Row = [item: string, status: Status, evidence: [path: string, shows: string][], gap: string, overlaps?: string[]];

const CONNECT = 'app/src/community/connect.ts';
const CONNECT_TEST = 'app/src/community/connect.test.ts';
const SITE = 'app/src/site/community.tsx';
const SITE_TEST = 'app/src/site/site.test.tsx';
const SOCIAL = 'app/src/lib/gtm/social.ts';
const SOCIAL_TEST = 'app/src/lib/gtm/social.test.ts';
const COMMUNITY_SQL = 'supabase/migrations/20260928032000_community.sql';
const ORG_SQL = 'supabase/migrations/20260921230000_organizations.sql';
const EXPANSION_SQL = 'supabase/migrations/20260926150000_expansion_roles_and_features.sql';
const MENTOR_SQL = 'supabase/migrations/20260928021700_mentor_rosters.sql';

const AREA_LIST: readonly (Area & { rows: readonly Row[] })[] = [
  {
    id: 'HUB',
    title: 'The Semester Connect hub',
    where: 'app',
    why: 'Connect appears inside Search, the campus hub and Me as a contextual experience, never as a sixth permanent navigation destination.',
    rows: [
      ['Not a sixth root: the hub lives inside screens that exist', 'tested', [[CONNECT, 'HUB_HOMES: search, community, me'], [CONNECT_TEST, 'no root and no destination is a hub'], ['docs/DO-NOT-BUILD.md', 'rule 1']], 'Drawn on the Community screen only; Search and Me do not draw it yet.'],
      ['The hub answers the brief’s five questions from screens a student already has', 'tested', [[CONNECT, 'HUB_SECTIONS: eleven, eight with a screen'], ['app/src/components/ConnectHub.tsx', 'the rows'], ['app/src/screens/Community.tsx', 'drawn whether or not Community is switched on'], [CONNECT_TEST, 'every question has a section with a screen']], 'Three sections have no screen: the showcase, the verified-communities list, and saved things in one place.'],
      ['Recommended events, clubs, study groups, mentors, projects and opportunities', 'building', [['app/src/community/feed.ts', 'why each post is shown'], ['app/src/lib/mentors.ts', 'matchMentors on ticked interests only']], 'No community, event or opportunity recommender exists; the hub is rows that open screens, which need no reason.', ['DSC-011', 'LPS-002']],
      ['Every recommendation discloses why it appeared: “Recommended because you saved…, are enrolled in…, and opted into…”', 'tested', [[CONNECT, 'explainSuggestion, SUGGESTION_INPUTS'], [CONNECT_TEST, 'the sentence; every forbidden input refused by key'], ['docs/DO-NOT-BUILD.md', 'rule 3']], 'The sentence exists before the recommender that will need it.'],
      ['“People you may want to meet” from student-controlled interests, never private performance or hidden profiling', 'tested', [[CONNECT, 'FORBIDDEN_SUGGESTION_INPUTS: grade, attendance, risk label, disability, health, financial, AI history, messages, usage'], [CONNECT_TEST, 'held'], ['app/src/community/circles.ts', 'FORBIDDEN_INPUTS for a circle']], 'No people suggestion exists; the refusal is what any will be held to.', ['DSC-010']],
      ['Saved communities, events, people and opportunities in one place', 'building', [['app/src/components/CampusDirectory.tsx', 'a saved star, on the device'], ['app/src/lib/opportunities.ts', 'the tracker']], 'Two kinds of saved thing in two places; nothing gathers them.'],
    ],
  },
  {
    id: 'VCC',
    title: 'Verified campus communities',
    where: 'app',
    why: 'Every approved organization, department, lab, office and cohort gets a verified space with a named owner, eligibility, events, contacts, resources, visibility and moderation.',
    rows: [
      ['A space for every kind: organizations, residence halls, departments, labs, honors and learning communities, cohorts, cultural and professional groups, career and alumni, campus offices', 'building', [[COMMUNITY_SQL, '`communities.kind`: course, study_group, student_organization, career_alumni, peer_mentorship, support'], ['app/src/community/services.ts', 'the campus service directory’s rules']], 'Six kinds; no residence hall, department, lab, learning community or office kind.', ['DSC-001', 'SRV-002']],
      ['Verified name and an accountable owner on every space', 'building', [[COMMUNITY_SQL, '`communities.verification`']], 'No owner or advisor column anywhere (communities register DSC-004).', ['DSC-003', 'DSC-004']],
      ['Description, mission, eligibility and accessibility information', 'building', [[ORG_SQL, '`about`, 400 characters']], 'Of the profile fields the brief lists, a name and an about exist.', ['ORG-002']],
      ['Upcoming events with RSVP or an official sign-up handoff', 'tested', [[COMMUNITY_SQL, 'community_sessions with places; approved venues only'], ['supabase/community.check.sql', 'held']], 'Study sessions only; no organization event.', ['EVT-003', 'EVT-004']],
      ['Public, campus-only, member-only or invite-only visibility', 'building', [[ORG_SQL, '`organizations.listed`; apply_to_organization'], [COMMUNITY_SQL, 'join_community admits instantly']], 'Two of the four; a community has no join policy.', ['DSC-005']],
      ['Moderation and reporting controls on every space', 'tested', [[COMMUNITY_SQL, 'report_community_post, block_community_author, appeal_community_decision'], ['app/src/community/moderation.ts', 'the queue'], ['app/src/community/moderation.test.ts', 'held']], '', ['SAF-001']],
      ['Calendar integration and Action Center reminders for a community’s events', 'building', [['app/src/lib/notify.ts', 'the reminder engine'], ['app/src/lib/connect.ts', 'addEvent to a linked calendar after a tap']], 'No event rule in NOTIF_DEFS; calendar writes cover deadlines and classes.', ['EVT-002', 'EVT-007']],
    ],
  },
  {
    id: 'CSC',
    title: 'Course-based study communities',
    where: 'app',
    why: 'Students learn together without exposing grades, activity tracking or private materials, and only after opting in.',
    rows: [
      ['Course-section spaces with discussion and question-and-answer threads', 'tested', [[COMMUNITY_SQL, 'course communities; posts'], ['app/src/community/questions.ts', 'the source-labelled answer rules'], ['app/src/community/questions.test.ts', 'held']], 'Questions have a rule and no screen.', ['QNA-001']],
      ['“Looking for a study partner”, study-group creation with topic, time and place or link, shared review-session planning', 'tested', [['app/src/screens/Community.tsx', 'Start a study group'], ['app/src/components/community/Sessions.tsx', 'sessions with 2–12 places'], ['app/src/community/circles.ts', 'StudyPlan'], ['app/src/community/circles.test.ts', 'held']], 'A group is a name and a purpose; the plan has nowhere to live.', ['CIR-005']],
      ['Who else is taking this course', 'tested', [['app/src/lib/classmates.ts', 'rooms per course and term; a profile you choose'], ['app/src/lib/classmates.test.ts', 'held'], ['supabase/classmates.check.sql', 'a stranger to the class sees nothing']], ''],
      ['Opt in before becoming visible; show only first name, programme, preferred times, topic and accessibility preferences', 'tested', [['app/src/community/identity.ts', 'three identities kept apart; peers see the presentation layer only'], ['app/src/community/identity.test.ts', 'held'], ['docs/COMMUNITY-PRIVACY-MODEL.md', 'the model']], 'Preferred study times and accessibility preferences are not fields of the presentation identity.', ['PRV-001']],
      ['Never grades, attendance, disability status, private notes, schedule or risk labels', 'tested', [['app/src/community/circles.ts', 'NEVER_SHARED'], ['app/src/community/circles.test.ts', 'held'], [COMMUNITY_SQL, 'nothing reads a location, a schedule or a grade']], '', ['CIR-006']],
      ['Not a channel for prohibited answers to active graded work', 'tested', [[COMMUNITY_SQL, '`communities.integrity_policy`'], ['app/src/community/circles.ts', 'INTEGRITY_REMINDER'], ['app/src/community/circles.test.ts', 'held']], 'A policy and a reminder; no detector, by design.', ['CIR-006']],
      ['Instructors do not automatically see peer discussion or study activity', 'tested', [[COMMUNITY_SQL, 'no faculty read policy on posts or sessions'], ['supabase/community.check.sql', 'held']], ''],
      ['Office-hours reminders and tutoring discovery', 'building', [['app/src/lib/nowrongdoor.ts', 'describe the problem, be sent to tutoring'], ['app/src/community/services.ts', 'the service directory rules']], 'No office-hours object to remind about.', ['SRV-002']],
    ],
  },
  {
    id: 'PMN',
    title: 'Peer mentor network',
    where: 'app',
    why: 'An intentional, structured, time-limited mentor flow rather than “message anyone”.',
    rows: [
      ['Mentor kinds: first-year, transfer, department, international, athlete, graduate, career, study-abroad, alumni, peer tutor', 'tested', [[CONNECT, 'MENTOR_KINDS'], ['app/src/community/mentorship.ts', 'PROGRAMS: seven programmes with a purpose, a length and a scope'], ['app/src/community/mentorship.test.ts', 'held']], 'Rosters know peer and alumni; the kinds are programmes, not roster types.', ['MNT-003']],
      ['Goal → verified opt-in mentors → structured request → accept or decline → time-limited space → agenda → meet → expires or continues by consent', 'tested', [[CONNECT, 'MENTOR_FLOW'], [MENTOR_SQL, 'only the recipient accepts; capacity at acceptance; 180 days at most'], ['supabase/mentor-rosters.check.sql', 'held'], ['app/src/components/MentorFinder.tsx', 'find, ask, answer']], 'The connection space, the agenda and the follow-up actions have no screen.', ['MNT-001', 'MNT-002', 'MNT-006', 'MNT-008']],
      ['A mentor sees only what the student intentionally shares: never the full plan, grades, private notes, financial, medical or AI data', 'tested', [[CONNECT, 'MENTOR_NEVER_SEES'], ['app/src/community/mentorship.ts', 'FORBIDDEN_MATCH_INPUTS; what a coordinator sees'], ['app/src/community/mentorship.test.ts', 'held'], [MENTOR_SQL, 'a request carries topics and a note, nothing else']], '', ['MNT-007', 'MNT-010']],
      ['Both can schedule, meet and record follow-up actions', 'building', [['app/src/lib/connect.ts', 'addEvent, addTask to a linked calendar']], 'Nothing ties a meeting to a mentorship.'],
    ],
  },
  {
    id: 'APN',
    title: 'Alumni and professional network',
    where: 'app',
    why: 'A student’s university network belongs inside Career and Portfolio, with employer access only for students who opted in, time-limited, and every view visible.',
    rows: [
      ['Verified alumni directory with opt-in participation and alumni mentor offers', 'tested', [[MENTOR_SQL, 'alumni rosters, opt-in'], ['app/src/screens/Opportunities.tsx', 'the alumni mentor finder'], ['supabase/mentor-rosters.check.sql', 'held']], 'A roster, not a directory: no career-path story, no industry community.', ['NET-003']],
      ['Internship, job, fellowship, scholarship and research opportunities', 'tested', [['app/src/lib/listings.ts', 'moderated listings, arranged by deadline only'], ['app/src/lib/listings.test.ts', 'held'], ['app/src/lib/opportunities.ts', 'the tracker']], '', ['OPP-001']],
      ['Employer access only by opt-in, time-limited, with every profile view visible to the student', 'tested', [[EXPANSION_SQL, 'talent_profiles opt-in expires at 180 days; talent_profile_views'], ['supabase/expansion.check.sql', 'held']], 'No student screen for the profile or its views.', ['NET-004']],
      ['Career-path stories, ask-for-advice with structured topics, career office hours, employer events, resume and portfolio feedback, “who can help?” discovery', 'not-started', [], 'None of these objects exists; the register records the ask.'],
    ],
  },
  {
    id: 'SHW',
    title: 'Project and portfolio showcase',
    where: 'app',
    why: 'A student-controlled space to share work, each item with a chosen visibility, never auto-published and never inferred.',
    rows: [
      ['Twelve kinds of work a student can publish from their record', 'tested', [[CONNECT, 'SHOWCASE_KINDS'], [CONNECT_TEST, 'held'], ['app/src/lib/career-evidence.ts', 'the private save']], 'Evidence is saved; nothing publishes it.', ['OPP-005', 'OPP-006']],
      ['Visibility ladder: private, advisor, group, campus-only, public portfolio, approved employers', 'tested', [[CONNECT, 'SHOWCASE_VISIBILITY, VISIBILITY_MEANS, publish, visibleAs'], [CONNECT_TEST, 'only the student publishes; employers only while a talent profile is on; expired or unparseable opt-in becomes private']], 'A rule with no table or screen.'],
      ['Never auto-published; never a portfolio claim inferred from coursework', 'tested', [[CONNECT, 'newShowcaseItem is private; publishedWithoutChoice; NEVER_INFERRED'], [CONNECT_TEST, 'a planted public item is caught']], ''],
      ['Each item connected to verified or student-confirmed skills, coursework, goals and career interests', 'building', [[EXPANSION_SQL, 'skill_records: self-reported → verification requested → verified or declined']], 'Skills verify; nothing links an item to one.', ['OPP-005']],
    ],
  },
  {
    id: 'MAP',
    title: 'Community discovery map',
    where: 'app',
    why: 'One visual map of clubs, departments, events, offices, fairs, volunteering, study spaces and jobs, filterable, every listing with a source, an owner, a review date and an official handoff.',
    rows: [
      ['A campus map a student can open', 'tested', [['app/src/lib/maps.ts', 'hand a destination to a map app'], ['app/src/lib/maps.test.ts', 'held'], ['app/src/screens/Maps.tsx', 'the screen']], 'Places, not communities: nothing on the map is a club, an event or an office listing.'],
      ['Filters: interest, major, career field, location, date, accessibility, format, cost, opt-in community, “fits my schedule”', 'building', [['app/src/components/CampusDirectory.tsx', 'free-text search and a category select']], 'Two filters of eleven.', ['DSC-002']],
      ['Source, official owner, last-reviewed date and an official handoff on every listing', 'building', [['app/src/lib/campusdirectory.ts', 'url and contact per listing; the import date'], ['app/src/lib/provenance.ts', 'source, scope and status as one shape']], 'No owner or review date per listing.', ['DSC-004', 'DSC-008']],
    ],
  },
  {
    id: 'CHL',
    title: 'Community challenges and milestones',
    where: 'app',
    why: 'Optional participation around real outcomes, private by default, with recognition and never a public comparison.',
    rows: [
      ['Eleven challenges, each an outcome: plan your first term, registration readiness, study with intention, portfolio week, an event, three clubs, mentor welcome, career fair, transfer onboarding, reflection, Semester Wrapped', 'tested', [[CONNECT, 'CHALLENGES'], [CONNECT_TEST, 'every challenge is an outcome'], ['app/src/lib/wrapped.ts', 'Semester Wrapped'], ['app/src/lib/wrapped.test.ts', 'held']], 'Wrapped exists; the other ten are named and nothing walks them.', ['LPS-007']],
      ['Rewards: completion badges, campus-recognised certificates, portfolio evidence, verified participation, event access, campus perks only where a school offers them', 'tested', [[CONNECT, 'REWARDS'], ['app/src/community/governance.ts', 'ALLOWED_MECHANICS: verified badges need issuer, criteria, evidence and a correction path'], ['app/src/community/governance.test.ts', 'held']], 'No badge or issuer entity.', ['LPS-006']],
      ['No public comparison: no leaderboard, no streak, no table of study time, grades, popularity or productivity', 'tested', [[CONNECT, 'CHALLENGE_RULES, milestoneLine'], [CONNECT_TEST, 'a count of one student’s steps and nobody else’s'], ['app/src/community/engagement.test.ts', 'the forbidden words never reach a student']], '', ['LPS-008']],
      ['Participate privately, opt out, or share only selected milestones', 'tested', [[CONNECT, 'CHALLENGE_RULES'], ['app/src/lib/wrapped.ts', 'goes nowhere unless the student sends it'], ['app/src/lib/wrapped.test.ts', 'held']], ''],
    ],
  },
  {
    id: 'ROM',
    title: 'Safe collaboration rooms',
    where: 'app',
    why: 'A room combines agenda, actions, files, meetings, notes, threads and a timeline around a real purpose, with an explicit member list and clear closure rules.',
    rows: [
      ['Ten parts of a room and six purposes; a room about nothing is refused', 'tested', [[CONNECT, 'ROOM_PARTS, ROOM_PURPOSES, openRoom'], [CONNECT_TEST, 'every broken bound named']], 'A rule; no room object stores the parts together.'],
      ['Explicit member list, a lead, an end date and an archive-or-delete rule', 'tested', [[CONNECT, 'openRoom: two members, a lead, an end within a year, a closure'], [CONNECT_TEST, 'held'], [COMMUNITY_SQL, 'community_members: your own rows only']], ''],
      ['Group-project rooms today: parts, owners and pace', 'tested', [['app/src/lib/groupwork.ts', 'parts, standing, pace'], ['app/src/lib/groupwork.test.ts', 'held'], ['supabase/groups.check.sql', 'held'], ['app/src/screens/Groupwork.tsx', 'the screen']], 'Parts and a chat; no agenda, files, meetings, notes or timeline in the same place.'],
      ['Study-group and organization rooms', 'building', [[COMMUNITY_SQL, 'study_group and student_organization communities with posts and sessions']], 'A community with posts is the nearest thing; nothing there has actions, files or a closure rule.', ['CIR-002']],
    ],
  },
  {
    id: 'REP',
    title: 'Community contribution reputation',
    where: 'app',
    why: 'Recognition rewards helpfulness, not popularity: modest, hideable, human-verified for anything meaningful, never a ranking and never an inference of ability.',
    rows: [
      ['Eleven contribution signals, each with the verifier that may vouch for it', 'tested', [[CONNECT, 'CONTRIBUTION_SIGNALS, recognise'], [CONNECT_TEST, 'a self-declared badge is refused']], 'No badge is stored anywhere.', ['LPS-006']],
      ['No follower count as the measure, no public ranking, no inference of academic ability or eligibility', 'tested', [[CONNECT, 'NOT_A_MEASURE'], ['app/src/screens/Community.tsx', 'no vote total, follower count or karma score, by design'], ['app/src/community/feed.ts', 'twenty posts, chronological, why each is shown'], ['app/src/community/feed.test.ts', 'held']], ''],
      ['Students can hide recognition from their public profile', 'tested', [[CONNECT, 'hide, shown'], [CONNECT_TEST, 'a hidden recognition is not shown']], 'No public profile draws recognition yet.'],
      ['Human review or a verified organization role behind every meaningful badge', 'tested', [[CONNECT, 'recognise refuses the wrong verifier'], [ORG_SQL, 'officer capabilities as a set'], ['supabase/organizations.check.sql', 'held']], ''],
    ],
  },
  {
    id: 'CSP',
    title: 'The Semester Community page',
    where: 'site',
    why: 'The website as a community-growth engine: one page that speaks to students, organizations, mentors and alumni, educators, ambassadors and institutions, with a real next step for each.',
    rows: [
      ['/community/: six audiences, each with what Semester offers them', 'tested', [[SITE, 'Community: AUDIENCES'], [SITE_TEST, 'the route is built; every link is real']], ''],
      ['Seven calls to action, each leading to a page or a person: join, become an ambassador, register an organization, become a mentor, partner, apply for a pilot', 'tested', [[SITE, 'CALLS'], [SITE_TEST, 'links only to real pages, the app, or mail']], 'Register, mentor and partner are a mail with a subject; no form.'],
      ['The page says what the community layer is not, and that no community programme is switched on for any campus today', 'tested', [[SITE, 'INSTEAD printed; the programme line'], [SITE_TEST, 'the sentence is held'], [COMMUNITY_SQL, 'community_programs default false']], ''],
    ],
  },
  {
    id: 'AMB',
    title: 'Campus ambassador programme',
    where: 'site',
    why: 'Early campus density and authentic social proof, from ambassadors with a code of conduct, training, defined time, recognition, a private community and no access to other students’ data.',
    rows: [
      ['/community/ambassadors/: what an ambassador does, what they get, and the boundaries', 'tested', [[SITE, 'Ambassadors'], [SITE_TEST, 'held']], 'Applications are a mail; the programme opens with the first campus pilot.'],
      ['Never paid per sign-up; a referral link produces two numbers and nothing else', 'tested', [['app/src/lib/referral.ts', 'how many came in, how many are still here'], ['app/src/lib/referral.test.ts', 'held'], ['supabase/referrals.check.sql', 'what one account may learn about another'], ['docs/LAUNCH-CONTENT-AND-TRAINING.md', 'the ambassador kit waits on the pilot']], 'The disclosure text and any stipend structure are not written (expansion register ETH-003).'],
      ['No access to other students’ records or private data', 'tested', [['supabase/referrals.check.sql', 'an ambassador sees counts, never a person'], ['docs/DO-NOT-BUILD.md', 'rule 10']], ''],
      ['Code of conduct, training, time expectations, recognition, private ambassador community', 'designed', [[SITE, 'the page says each'], ['docs/LAUNCH-CONTENT-AND-TRAINING.md', 'the ambassador kit, not started'], ['app/src/lib/launch/content.ts', 'ambassador_kit: NOT_STARTED']], 'Said on the page; none of it exists as a document an ambassador signs or a space they join.'],
    ],
  },
  {
    id: 'STO',
    title: 'Student creator and story programme',
    where: 'site',
    why: 'Authentic, permission-based content around real campus journeys, with a submission and consent process the student controls.',
    rows: [
      ['/community/stories/: eight prompts and the consent choices — anonymous, attributed, campus-only or public', 'tested', [[SITE, 'Stories: PROMPTS, CONSENT'], [SITE_TEST, 'held']], 'Submission is a mail; no form, no story published yet.'],
      ['Never private student data, grades, plans or messages in marketing without explicit written permission', 'tested', [[SOCIAL, 'NEVER_IN_MARKETING'], [SOCIAL_TEST, 'held'], ['docs/DO-NOT-BUILD.md', 'rule 10'], ['app/src/donotbuild.test.ts', 'no ad or tracking host in the source']], ''],
    ],
  },
  {
    id: 'LIB',
    title: 'Community resource library',
    where: 'site',
    why: 'A public, searchable library that attracts students before they sign up, each resource leading into the app: use it free, save it, turn it into a plan, add deadlines, share with an advisor.',
    rows: [
      ['The library on /resources/: fifteen resources, five that exist as tools today and ten named as being written', 'tested', [['app/src/site/pages.tsx', 'Resources: LIBRARY'], [SITE_TEST, 'every link real']], 'Ten of fifteen are not written; each says so rather than linking to a placeholder.'],
      ['Registration checklist, advisor meeting agenda, schedule builder, graduation timeline and the navigation diagnostic, free and sending nothing', 'tested', [['app/src/site/tools/Tools.tsx', 'TOOL_LIST'], [SITE_TEST, 'connect-src none on every tool page']], ''],
      ['Use it free → save to Semester → turn it into a plan → deadlines in the Action Center → share with an advisor or mentor', 'tested', [[SOCIAL, 'the registration funnel'], [SOCIAL_TEST, 'every step is a route or a screen']], 'Saving a tool’s result into an account is a sign-up, not a handoff of the result.'],
    ],
  },
  {
    id: 'PDR',
    title: 'Partner community directory',
    where: 'site',
    why: 'A verified directory of organizations, nonprofits, alumni groups, employers, scholarship providers, labs, departments, mentorship, transfer and study-abroad partners, and local businesses, with verification labels and rules that never let paid visibility pass for official.',
    rows: [
      ['/community/partners/: the twelve kinds, the four labels, and the rules', 'tested', [[SITE, 'Partners: KINDS, LABELS, RULES'], [SITE_TEST, 'held']], 'The directory is empty and says so; no partner is listed.'],
      ['Verification labels that match what the database can say', 'tested', [[COMMUNITY_SQL, '`verification`: institution_verified, organization_verified, faculty_approved, student_created'], ['supabase/community.check.sql', 'held']], 'No partner or independent value yet (communities register DSC-003).', ['DSC-003']],
      ['Default discovery cannot be bought', 'tested', [['app/src/community/governance.ts', 'FORBIDDEN_MECHANICS: pay-to-win club promotion; REVENUE_NOT_TAKEN'], ['app/src/community/governance.test.ts', 'held']], ''],
    ],
  },
  {
    id: 'EVC',
    title: 'Events and livestream center',
    where: 'site',
    why: 'The company site hosts student workshops, registration-prep sessions, career and portfolio workshops, founder demonstrations, ambassador sessions, roundtables and panels, each with registration, calendar save, accessibility, replay, captions, resources and a follow-up path.',
    rows: [
      ['/community/events/: ten kinds of session and what every one carries', 'tested', [[SITE, 'Events: SESSIONS, CARRIES'], [SITE_TEST, 'held']], 'No event is scheduled; the page says so and offers the newsletter by mail.'],
      ['Registration, calendar save, replay, transcript and captions for each event', 'not-started', [], 'No event object, no registration, no replay; the page lists what each will carry.'],
    ],
  },
  {
    id: 'SME',
    title: 'Social media ecosystem',
    where: 'plan',
    why: 'Social media is the public top of the funnel; Semester is where interest turns into action and belonging, and every post leads to a useful next step.',
    rows: [
      ['Ten content pillars, each with a purpose and an example', 'tested', [[SOCIAL, 'PILLARS'], [SOCIAL_TEST, 'held']], 'A plan; no post has been published under it.'],
      ['Seven platforms, each with its role, the in-app community among them', 'tested', [[SOCIAL, 'PLATFORMS'], [SOCIAL_TEST, 'held']], ''],
      ['Three post-to-action paths, every step a route the site builds or a screen the app has', 'tested', [[SOCIAL, 'FUNNELS'], [SOCIAL_TEST, 'every path and screen exists; each ends in an action']], ''],
      ['An owned newsletter, sent only with consent, under the campaign object and the UTM convention', 'tested', [['app/src/lib/gtm/messaging.ts', 'no marketing send without consent; suppression wins'], ['app/src/lib/gtm/messaging.test.ts', 'held'], ['app/src/lib/gtm/utm.ts', 'nothing identifying a person in a link'], ['app/src/lib/gtm/campaign.ts', 'sensitive fields cannot be targeting criteria']], 'No newsletter exists to send.'],
    ],
  },
  {
    id: 'CTL',
    title: 'Required controls before broad social functions',
    where: 'controls',
    why: 'Community features create high value and high responsibility; the brief lists what is built before broad social functions, and this is where each stands.',
    rows: [
      ['Verified institutional identity where available', 'tested', [['app/src/community/identity.ts', 'verification identity held as a vault reference'], ['app/src/community/identity.test.ts', 'held']], '', ['PRV-001']],
      ['Optional pseudonymous display only where a school approves it and moderation supports it', 'tested', [['app/src/community/alias.ts', 'one alias, one approved community'], [COMMUNITY_SQL, 'community_programs.scoped_pseudonymity, default false'], ['app/src/community/safeguards.test.ts', 'held']], '', ['PRV-006']],
      ['Clear community rules and a code of conduct', 'tested', [['app/src/community/constitution.ts', 'the boundary sentences every constitution keeps'], ['app/src/community/constitution.test.ts', 'held'], ['docs/CAMPUS-MODERATION-SOP.md', 'the standard']], 'A student-facing code of conduct with a version is a launch gate not yet passed by any tenant.', ['GOV-002']],
      ['Report, block, mute and appeal workflows', 'tested', [[COMMUNITY_SQL, 'report_community_post, block_community_author, appeal_community_decision'], ['app/src/screens/Community.tsx', 'report, block, mute, appeal'], ['app/src/screens/Community.test.tsx', 'held']], '', ['SAF-001', 'SAF-002']],
      ['Human moderation for public content, course reviews, opportunities and organization listings', 'tested', [['app/src/community/moderation.ts', 'the queue and its actions'], ['app/src/screens/Moderation.tsx', 'the console'], ['app/src/lib/listings.ts', 'only a moderator publishes a listing'], ['supabase/listings.check.sql', 'held']], 'Course reviews have no queue of their own (communities register MOD).', ['MOD-001', 'MOD-002']],
      ['Age-aware safety controls and guardian consent for minors', 'tested', [['supabase/migrations/20260929150000_minimum_age.sql', 'minimum age 13; a minor is not a verified student'], ['supabase/minimum-age.check.sql', 'held']], 'Guardian consent is not built: a minor’s guardian agrees to the terms on paper only, and nothing verifies a guardian (maturity MN-02, MN-09).'],
      ['Explicit consent before a student is discoverable for peer matching, mentoring, employer discovery or group participation', 'tested', [[MENTOR_SQL, 'rosters are opt-in'], [EXPANSION_SQL, 'talent_profiles opt-in'], ['app/src/lib/classmates.ts', 'a profile you choose to show'], ['app/src/community/circles.test.ts', 'a suggestion reads only what was ticked']], '', ['PRV-004', 'PRV-005']],
      ['Time-limited consent and easy revocation', 'tested', [[EXPANSION_SQL, 'opt-in expires at 180 days'], [MENTOR_SQL, 'an assignment lasts 180 days at most'], ['app/src/lib/sharing.ts', 'every share has an end and a way back'], ['app/src/lib/sharing.test.ts', 'held']], ''],
      ['No default access to private academic records, schedules, grades, financial, health or disability data, messages or study behaviour', 'tested', [['app/src/community/circles.ts', 'NEVER_SHARED'], [CONNECT, 'FORBIDDEN_SUGGESTION_INPUTS'], [CONNECT_TEST, 'held'], ['docs/COMMUNITY-PRIVACY-MODEL.md', 'data minimisation']], ''],
      ['Abuse, harassment, impersonation, fraud, spam and academic-integrity reporting', 'tested', [[COMMUNITY_SQL, 'report reasons and cases'], ['app/src/community/detectors.ts', 'the signals'], ['app/src/community/detectors.test.ts', 'held'], ['app/src/community/pii.ts', 'personal information caught before posting']], '', ['SAF-003', 'SAF-004', 'MOD-010']],
      ['Rate limits, spam controls and invitation limits', 'tested', [['supabase/rate-limits.check.sql', 'the database refuses past the limit'], ['app/src/lib/ratelimit.test.ts', 'the refusal speaks to the student']], 'No invitation limit, because nothing invites yet.', ['MOD-009']],
      ['Audit logs for sensitive access and moderation decisions', 'tested', [[COMMUNITY_SQL, 'community_decisions'], ['supabase/moderation-audit.check.sql', 'held']], '', ['MOD-004']],
      ['Clear deletion, export and account closure', 'tested', [['app/src/lib/export.ts', 'everything you added, in files'], ['app/src/lib/deleteaccount.test.ts', 'held'], ['supabase/deletion.check.sql', 'held'], ['docs/DATA-PORTABILITY-AND-OFFBOARDING.md', 'the process']], ''],
      ['Accessible moderation, reporting and community interfaces', 'tested', [['app/src/community/moderation.ts', 'never a colour alone'], ['app/src/screens/Community.tsx', 'status in words'], ['app/src/a11y/labels.ts', 'every control named'], ['app/src/a11y/labels.test.ts', 'held']], 'No accessibility test of the community workflows by a person (launch gate accessibility).'],
    ],
  },
];

export const AREAS: readonly Area[] = AREA_LIST.map(({ rows: _rows, ...a }) => a);

export const ITEMS: readonly Item[] = AREA_LIST.flatMap((a) =>
  a.rows.map(([item, status, evidence, gap, overlaps], i) => ({
    id: `${a.id}-${String(i + 1).padStart(3, '0')}`,
    item,
    status,
    evidence: evidence.map(([path, shows]) => ({ path, shows })),
    gap: gap || 'Held in code; nothing under docs/evidence/ shows it operating.',
    overlaps: overlaps ?? [],
  })),
);

export const areaOf = (id: string) => AREAS.find((a) => a.id === id.split('-')[0])!;

/** The brief's own list of what to build first, each naming the areas here that carry it. */
export const FIRST: readonly { build: string; areas: readonly string[] }[] = [
  { build: 'A Verified Campus Communities directory', areas: ['VCC', 'PDR'] },
  { build: 'A unified Events & Opportunities feed with calendar save and Action Center integration', areas: ['VCC', 'APN', 'MAP'] },
  { build: 'Opt-in study-group matching by course and section', areas: ['CSC'] },
  { build: 'Collaboration Rooms for study groups, clubs, projects and mentor relationships', areas: ['ROM'] },
  { build: 'A structured Peer Mentor Network', areas: ['PMN'] },
  { build: 'A student-controlled Project and Portfolio Showcase', areas: ['SHW'] },
  { build: 'A public Semester Community page on the company site', areas: ['CSP'] },
  { build: 'A Campus Ambassador Program', areas: ['AMB'] },
  { build: 'A free public student-success resource library', areas: ['LIB'] },
  { build: 'A moderated student stories and creator program', areas: ['STO'] },
];

/** The commit the statuses were read against. */
export const ASSESSED_AT = '8f4d38b';
