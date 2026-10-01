/**
 * The equity review gate: every surface that ranks, recommends, matches or
 * routes something to a person has a written review, and a new one cannot
 * arrive without one.
 *
 * ## What the gate is, and is not
 *
 * A ranking is a decision made on someone's behalf, and the decisions nobody
 * wrote down are the ones that turn out to have treated a group worse. This
 * holds each such surface in the tree to five questions — who is affected,
 * what it reads, who could be left behind, how a person disagrees with it, and
 * how anyone would know if it were unfair — and to one rule the code can
 * check: it reads nothing on the forbidden list.
 *
 * It is a gate on *registration and on what a surface reads*, not a test of
 * outcomes. No demographic data reaches this code, so there is no measured
 * result here to report, and none of these reviews claims one. The owner says
 * some is collected elsewhere (D-1019); this repository holds no record of
 * what, where or under what consent, and nothing feeds `disparity.ts` today.
 * It is the computation to use over data collected with consent.
 *
 * ## Who reviewed them
 *
 * Harrison Rubin, the owner, who named himself reviewer of the findings
 * (D-1019). He is also the founder and directs the work, so that is not
 * independent review and the records say `independent: false`. The council has
 * no equity seat; the trust and safety seat is vacant. Whether a
 * disabled-student and first-generation-student panel also reads these is
 * still his call.
 *
 * `equity.test.ts` scans the source for every exported function that matches
 * the ranking names below, fails if one is neither reviewed nor exempt, fails
 * if a review reads a forbidden input, and fails a review whose date has
 * passed. Findings are open items, each with where it would be fixed; nothing
 * here changes a surface's behaviour.
 */

import { FORBIDDEN_SIGNALS } from '../../community/feed';

/** What a surface is forbidden to read: the feed's own list, plus the brief's. */
export const FORBIDDEN_INPUTS: readonly string[] = [
  ...FORBIDDEN_SIGNALS,
  // The equity brief's additions: a protected characteristic, or a guess at one.
  'race', 'ethnicity', 'gender', 'sex', 'religion', 'nationality', 'age', 'pregnancy', 'sexualOrientation',
  'motivation', 'intelligence', 'ability', 'wellness', 'risk', 'riskScore', 'likelyToDrop', 'persistence',
  // Money as a proxy, and paid placement.
  'income', 'zipcode', 'postcode', 'paidPlacement', 'sponsorship',
];

export interface Finding {
  id: string;
  text: string;
  /** Where it would be fixed, or who would decide. */
  owner: string;
}

export interface Review {
  /** `file#symbol`, which is also how the scan finds it. */
  id: string;
  surface: string;
  affects: string;
  /** Everything it reads, in words. Checked against the forbidden list. */
  inputs: readonly string[];
  /** The inputs the student declared about themselves, a subset of `inputs`. */
  selfDeclared: readonly string[];
  benefit: string;
  /** Who might be left behind, and how. */
  risks: string;
  /** Keyboard, screen reader, low bandwidth, language. */
  access: string;
  /** How a person dismisses, corrects or ignores it. */
  control: string;
  /** Where the reason is shown. */
  explains: string;
  /** How anyone would know if it were unfair. Honest when the answer is "they would not yet". */
  monitoring: string;
  findings: readonly Finding[];
}

export interface Exempt {
  id: string;
  reason: string;
}

export const REVIEWED_ON = '2026-09-30';
export const REVIEW_BY = '2027-03-31';
export const REVIEWER = 'Harrison Rubin, the owner, named reviewer of the findings';
export const INDEPENDENT = false;

const NO_DEMOGRAPHICS = 'None yet: no demographic data reaches this code, so a difference between groups cannot be measured here. Data collected with consent would be read with equity/disparity.ts.';
const OWN_SCREEN = 'Nothing on this surface is a separate control; the ordinary screen-reader and keyboard behaviour of the screen it appears on applies, and it is covered by the responsive and accessibility plans.';

export const REVIEWS: readonly Review[] = [
  {
    id: 'lib/actions.ts#rank',
    surface: 'The Action Center: the one most important thing, then three',
    affects: 'Every student, on Today.',
    inputs: ['due date', 'the priority the proposing module gave it', 'whether it can be done now', 'the source label', 'how many times the student snoozed it'],
    selfDeclared: [],
    benefit: 'One clear next step instead of a list; an estimate ranks below a fact.',
    risks: 'A student who never sets a date sees no urgency on their own items. A source label ranks institution-verified above student-entered, so an unconnected school’s students rank lower on confidence for the same action.',
    access: OWN_SCREEN,
    control: 'Snooze, dismiss, mark wrong, ask for help; nothing is hidden, the rest is behind View all.',
    explains: 'Each term of the score is kept (`parts`) and shown by rankingLine.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [{ id: 'A-1', text: 'The confidence term is 10 for institution-verified and 7 for student-entered: a three-point edge for students whose school is connected. Small next to urgency (0 to 40), and deliberate, but it is an advantage that follows the institution, not the student.', owner: 'Product (D-1019 to decide whether to keep)' }],
  },
  {
    id: 'lib/journeys.ts#recommendJourney',
    surface: 'Which of the six journeys to offer first',
    affects: 'Every student, in the journey picker.',
    inputs: ['confirmed deadlines due soon', 'whether setup is incomplete', 'reviews due', 'collaboration items due', 'career steps due'],
    selfDeclared: [],
    benefit: 'The journey with something waiting comes first, with the reason in words.',
    risks: 'Fixed precedence puts setup, planning and review ahead of collaboration and career, so a student whose need is mostly the later two sees them lower until something is due.',
    access: OWN_SCREEN,
    control: 'Every journey stays present and reachable; the order is a suggestion.',
    explains: 'Each recommended journey carries its reason.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [],
  },
  {
    id: 'lib/learning-loop.ts#recommendLearningActivity',
    surface: 'Which study activity to start with',
    affects: 'A student studying a course’s concepts.',
    inputs: ['retrievals due', 'recurring mistake type', 'how much evidence has been recorded'],
    selfDeclared: [],
    benefit: 'Cards when they are due, reading when nothing has been recorded, practice on a repeated error.',
    risks: 'A student with no recorded evidence is always sent to reading first, which is slower for someone who already knows the material and has not yet used the app.',
    access: OWN_SCREEN,
    control: 'The recommendation is one option among the study modes, all still available.',
    explains: 'The evidence list and a reason sentence.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [],
  },
  {
    id: 'lib/study-readiness.ts#recommend',
    surface: 'The next short study session',
    affects: 'A student who has marked topics in a course.',
    inputs: ['the status the student marked', 'the confidence the student gave', 'cards due'],
    selfDeclared: ['the status the student marked', 'the confidence the student gave'],
    benefit: 'Starts with what the student said needs review, then unmarked, then practising.',
    risks: 'Self-rated confidence differs by student for reasons unrelated to knowing the material; ordering by lowest confidence sends an under-confident student to material they may know.',
    access: OWN_SCREEN,
    control: 'The student changes their own marks, which is the input.',
    explains: 'Each recommendation has a why line.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [{ id: 'S-1', text: 'Confidence is self-rated and is the tie-break after status. It is a known source of uneven advice between students, and the advice is low-stakes and overridable.', owner: 'Product' }],
  },
  {
    id: 'lib/revise.ts#rank',
    surface: 'Units worth an evening',
    affects: 'A student with cards and a test coming.',
    inputs: ['the unit’s mastery', 'cards due', 'how long since the unit was reviewed', 'days until a test in the course'],
    selfDeclared: [],
    benefit: 'Cold material in a course being examined soon is first; every course gets a unit before any gets a second.',
    risks: 'A student who reviews in bursts looks stale more often and is sent to more units; a student with no tests entered sees no test weighting.',
    access: OWN_SCREEN,
    control: 'The plan is a proposal; the budget is a ceiling, never a quota.',
    explains: 'Each stretch carries a sentence saying why.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [],
  },
  {
    id: 'lib/toolkit/recommend.ts#recommend',
    surface: 'Which workspaces to put in front of a student',
    affects: 'A student choosing a workspace.',
    inputs: ['the course', 'the assignment type', 'the topic', 'the goal the student picked', 'the source type', 'a due date', 'the student’s stated preferences'],
    selfDeclared: ['the goal the student picked', 'the student’s stated preferences'],
    benefit: 'At most four, each with its reasons; the ordering is the goal’s own list.',
    risks: 'None specific: it reads only what the student told it, and its own test passes a GPA, a risk score and a location and requires identical output.',
    access: OWN_SCREEN,
    control: 'The student picks the goal; nothing is removed from the full catalogue.',
    explains: '"Why this workspace?" shows the reasons.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [],
  },
  {
    id: 'lib/suggest.ts#suggest',
    surface: 'Fellowships and programmes to look at now',
    affects: 'A student looking for opportunities.',
    inputs: ['the student’s year', 'the fields the student said they care about', 'how near the months a programme is usually open are'],
    selfDeclared: ['the student’s year', 'the fields the student said they care about'],
    benefit: 'Shows what is in season; holds no deadlines, so it cannot state a wrong one.',
    risks: 'A programme more than a season away is dropped, so a student planning a year ahead does not see it; the shipped list is one curator’s and favours what that curator knew.',
    access: OWN_SCREEN,
    control: 'Suggested, never added: nothing enters the pipeline without the student tapping Track.',
    explains: 'Each programme states when it is usually open.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [{ id: 'F-1', text: 'The programme list is shipped data with no stated selection criteria or review of whose opportunities it omits.', owner: 'Content, reviewed by Harrison Rubin' }],
  },
  {
    id: 'lib/launchpad.ts#matchMentors',
    surface: 'Mentors matched to a new student',
    affects: 'A student who opted in to mentor matching.',
    inputs: ['the interests the student chose', 'the student types the student chose', 'the interests and supported types each mentor volunteered'],
    selfDeclared: ['the interests the student chose', 'the student types the student chose'],
    benefit: 'Matches on shared interests and, among equals, on a mentor having volunteered to support the student’s kind of newcomer.',
    risks: 'The student types include international and veteran status. They are self-declared and used only to order matches that already share an interest, never to exclude; but declared status is sensitive, and a student with no mentor volunteering for their type is ordered by name.',
    access: OWN_SCREEN,
    control: 'Opt-in (`mentorOptIn`), and the student chooses the interests and types.',
    explains: 'The shared interests are returned with each match.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [{ id: 'M-1', text: 'Ties after shared interests and type support fall to alphabetical order by mentor name, which advantages names early in the alphabet. A seeded shuffle would be fairer and is not a change this review makes.', owner: 'Engineering' }],
  },
  {
    id: 'lib/behind.ts#triage',
    surface: 'What to do first in a bad week',
    affects: 'A student who is behind.',
    inputs: ['outstanding deadlines and their weight', 'what is done', 'how long this student has taken on similar work', 'the hours the student has'],
    selfDeclared: ['the hours the student has'],
    benefit: 'What has already happened first, then today, then the most valuable that fits; nothing is dropped.',
    risks: 'The estimate of time comes from the student’s own past, so a student who has worked slowly, for any reason, is told a longer time and fits fewer things.',
    access: OWN_SCREEN,
    control: 'The hours are the student’s input; every item stays listed.',
    explains: 'Each step has a says line.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [],
  },
  {
    id: 'lib/triage.ts#orderQueue',
    surface: 'The order of open assignments in the assignment states list',
    affects: 'A student with assignments that have a due date from a syllabus or that they entered themselves.',
    inputs: [
      'the due date',
      'the student’s own effort estimate',
      'minutes free before it is due, only where a calendar is connected',
      'how many other items wait on it',
      'the source label of the date (institution verified, imported, student entered, estimated or needs review)',
      'the student’s own priority for it',
      'minutes the student has already saved for it',
      'the student’s own fatigue setting',
    ],
    selfDeclared: [
      'the student’s own effort estimate',
      'the student’s own priority for it',
      'minutes the student has already saved for it',
      'the student’s own fatigue setting',
    ],
    benefit: 'Offers work in a sensible order without a score: nearer dates first, work with no time saved ahead of work already planned, and what the student marked important lifted. Waiting, blocked, finished and deferred work is left out of the order rather than sorted to the bottom.',
    risks: 'The source label adds a point to dates the institution verified and removes one from dates that need review, so a student whose institution publishes no verified feed, or whose syllabus dates carry no page citation, sees their work ordered slightly lower than a peer’s with the same dates. A date nobody has entered counts as thirty days away. A student with a very full calendar has effort-heavy items lifted by the free-time term, which helps them see what cannot fit and is a different thing from judging them. Ties keep the order the list was given in.',
    access: OWN_SCREEN,
    control: 'The order is a suggestion: every open item stays on the list, the student sets their own priority and fatigue, and can defer, snooze or pass on anything. The priority is theirs, not inferred.',
    explains: 'Each row shows the reasons for its state and what Semester does not know, and a line above the list says what the order was made from and that it is a suggestion, not a verdict.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [
      { id: 'O-1', text: 'The source-label term advantages dates from institutions with verified feeds over students’ own or uncited dates. It is bounded (one point against a due-date term of up to ten) but it is a tilt toward students at better-integrated institutions.', owner: 'Product, with the source-confidence rule in lib/source.ts; the fix is to drop the term or to show it in the explanation' },
    ],
  },
  {
    id: 'lib/toolnow.ts#suggest',
    surface: 'The two or three tools this fortnight asks for',
    affects: 'A student with deadlines in the next fortnight.',
    inputs: ['outstanding deadlines, their kind and their title', 'how many sources the student has kept'],
    selfDeclared: [],
    benefit: 'Suggests the tool a real deadline asks for, each with its reason.',
    risks: 'Matches deadline titles against word lists in English, so a course titled in another language gets fewer suggestions.',
    access: 'English-only title matching (see risks); otherwise the ordinary behaviour of the screen.',
    control: 'Suggestions only; every tool stays reachable.',
    explains: 'Each suggestion states the deadline and why.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [{ id: 'T-1', text: 'Title matching uses English word lists (memo, report, budget, worksheet…); a non-English course title gets fewer suggestions.', owner: 'Engineering, with the localisation plan' }],
  },
  {
    id: 'community/feed.ts#rankItem',
    surface: 'The community feed',
    affects: 'Students in communities, in for-your-courses, for-your-path and the other surfaces.',
    inputs: ['whether it matches a course or path', 'how recent it is', 'whether the student follows the source', 'whether the source is verified', 'the student’s own preferences'],
    selfDeclared: ['the student’s own preferences'],
    benefit: 'Relevance without engagement: popularity, location, attendance, sensitive attributes and inferences are refused at run time by `assertAllowedSignals`.',
    risks: 'Verified sources outrank ones that still need confirmation, which favours institutions and staff over students’ own posts.',
    access: OWN_SCREEN,
    control: 'Hide an item, show less per community (halves the score each step), block a source.',
    explains: '"Why am I seeing this?" with a reason per signal; the ranker version is recorded.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [],
  },
  {
    id: 'community/moderation.ts#triage',
    surface: 'Safety triage of reported posts',
    affects: 'The person a post is about, the reporters, and the author; it can reduce distribution or hold a post.',
    inputs: ['report category and qualifiers', 'distinct reporters in a window', 'detector kind and confidence', 'whether the reporters were clustered as coordinated'],
    selfDeclared: [],
    benefit: 'High-risk reports hold at once; a coordinated cluster is set aside and sent to integrity review; every reason is recorded.',
    risks: 'Three distinct reporters in an hour reduce distribution pending review, which is the lever a coordinated group could use against a student from a group they target; the brigade detector is the guard and it is only as good as its clusters.',
    access: OWN_SCREEN,
    control: 'A reviewer can lift any protection; the outcome is a human decision, not this function’s.',
    explains: 'A plain reason list is kept on the case.',
    monitoring: 'None yet: there is no report of protections applied by community or by reporter cluster, and no demographic data to cut it by. A count of holds lifted on review would be the first honest measure.',
    findings: [{ id: 'C-1', text: 'No measure of how often a protection is lifted on review, which is the nearest thing to a false-positive rate and would show whether the reduce threshold is being gamed.', owner: 'Trust & Safety (seat vacant)' }],
  },
  {
    id: 'lib/moderation.ts#ordered',
    surface: 'The order of the moderators’ report queue',
    affects: 'People who reported something, and the people reported.',
    inputs: ['the report’s status', 'when it was filed'],
    selfDeclared: [],
    benefit: 'Open before under review before closed.',
    risks: 'Newest first inside each status means the oldest open reports are read last; under load, a report filed early may wait longest.',
    access: 'A staff queue; covered by the moderation SOP.',
    control: 'A moderator can open any report.',
    explains: 'The order is fixed and documented here.',
    monitoring: 'None yet: there is no measure of time from report to first read.',
    findings: [{ id: 'Q-1', text: 'Newest first within a status can starve the oldest open reports. Oldest first, or severity then age, is the usual choice; changing it is a moderation-policy decision.', owner: 'Trust & Safety (seat vacant)' }],
  },
  {
    id: 'lib/call.ts#ordered',
    surface: 'Who is shown first in a call’s gallery',
    affects: 'Participants in a call.',
    inputs: ['who was pinned', 'who is sharing a screen', 'who has a hand up, oldest first', 'who spoke in the last half minute', 'whether a camera is on', 'the order people arrived'],
    selfDeclared: [],
    benefit: 'The person being talked about, and whoever is waiting for a turn, come first; your own tile sinks.',
    risks: 'Cameras on come before cameras off, so a participant who keeps the camera off, because of bandwidth, a shared space or a disability, sinks in the gallery.',
    access: 'Gallery order is visual; a participant list is the keyboard route. See the risks for who is disadvantaged.',
    control: 'You can pin anyone in your own gallery, and a pin outranks everything below it.',
    explains: 'The order is documented in the function.',
    monitoring: NO_DEMOGRAPHICS,
    findings: [{ id: 'CA-1', text: 'Camera-off participants sink below camera-on ones. Bandwidth and privacy are common reasons; ordering by arrival after the higher rules would avoid penalising them.', owner: 'Engineering' }],
  },
  {
    id: 'lib/dining/service.ts#orderQueue',
    surface: 'The open-orders queue for dining staff',
    affects: 'Students who have placed an order, and the staff who fill them.',
    inputs: ['when the order was placed', 'whether it is open'],
    selfDeclared: [],
    benefit: 'Oldest first; staff never read how an order was paid.',
    risks: 'None specific: the order is first come, first served and reads nothing about the student.',
    access: 'A staff screen. It is not shown to students and reads no student attribute.',
    control: 'Not a recommendation: the order is by time placed and nothing else.',
    explains: 'The ordering is by time placed.',
    monitoring: 'The time an order was placed is on its record; no cut by student characteristic exists or is collected.',
    findings: [],
  },
];

/** Surfaces that match the ranking names but rank no person or opportunity. */
export const EXEMPT: readonly Exempt[] = [
  { id: 'lib/chart.ts#suggest', reason: 'Guesses a chart type from the cells selected; the guess is overruled on the chart itself.' },
  { id: 'lib/pivot.ts#suggest', reason: 'Guesses which two columns a pivot groups and measures, from the cells; overridable on the card.' },
  { id: 'lib/drivehome.ts#suggest', reason: 'Orders the student’s own files by when they opened, added or starred them.' },
  { id: 'lib/feed.ts#ordered', reason: 'Makes a stored section order safe to render; it is the student’s own arrangement.' },
  { id: 'lib/apply.ts#order', reason: 'Orders the student’s own applications, offers first, by the stage they recorded.' },
];

/** The names the scan treats as a ranking, recommending, matching or routing function. */
export const RANKING_NAMES = ['rank', 'rankItem', 'recommend', 'recommendJourney', 'recommendLearningActivity', 'triage', 'matchMentors', 'orderQueue', 'suggest', 'ordered', 'order'] as const;
