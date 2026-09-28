/**
 * What the platform pages say, as data.
 *
 * Four public pages — availability, the service map, system boundaries and the
 * demo handoff — are tables a buyer reads to find out what Semester does, what
 * it does not do, and what stays authoritative elsewhere. Each is data here
 * rather than prose in a component, for the reason the pricing page reads
 * `lib/plans.ts`: a claim in a table is a claim a test can hold to, and the
 * rule for this site (`pages.tsx`) is that nothing is said that is not true of
 * the tree today. `platform.test.ts` checks the vocabulary and the one claim
 * that matters most: nothing is called *Available* to an institution while no
 * institutional connection is live.
 */

/** Who is buying. The four columns of the availability matrix. */
export type Tier = 'individual' | 'department' | 'institution' | 'enterprise';

export const TIERS: { id: Tier; label: string }[] = [
  { id: 'individual', label: 'Individual students' },
  { id: 'department', label: 'Department' },
  { id: 'institution', label: 'Institution' },
  { id: 'enterprise', label: 'Enterprise' },
];

/**
 * How far along a capability is. Four words, and the page defines each one
 * beside the table, so a buyer cannot mistake a plan for a product.
 */
export type Status = 'available' | 'pilot' | 'planned' | 'services';

export const STATUS: Record<Status, { label: string; means: string }> = {
  available: { label: 'Available', means: 'In the app today, on the live page, for anyone on the plan.' },
  pilot: { label: 'Pilot', means: 'Built and switched on one institution at a time, under a written agreement. Not on by default.' },
  planned: { label: 'Planned', means: 'Designed and documented. Not in the app yet, and not a promise of a date.' },
  services: { label: 'Services-led', means: 'Done with the institution as project work, not as a self-serve feature.' },
};

export interface Capability {
  name: string;
  /** What the column gets. Short: a word or two a table cell can hold. */
  tiers: Record<Tier, string>;
  status: Status;
  /** The sentence behind the row, so the table is not the whole story. */
  note: string;
}

export const AVAILABILITY: Capability[] = [
  {
    name: 'Personal planning',
    tiers: { individual: 'Yes', department: 'Yes', institution: 'Yes', enterprise: 'Yes' },
    status: 'available',
    note: 'Today, My Path, the registration plan with backups, the calendar and the study tools, from what the student adds. No account is needed.',
  },
  {
    name: 'Sign in with a university account',
    tiers: { individual: 'No', department: 'Optional', institution: 'Yes', enterprise: 'Yes' },
    status: 'planned',
    note: 'Single sign-on through the institution’s own identity provider, configured per institution. Designed; no institution is connected today.',
  },
  {
    name: 'Course Studio for faculty',
    tiers: { individual: 'No', department: 'Optional', institution: 'Yes', enterprise: 'Yes' },
    status: 'pilot',
    note: 'An instructor publishes the course’s rules and guidance; students see them beside the course. Switched on per institution.',
  },
  {
    name: 'Grade passback',
    tiers: { individual: 'No', department: 'No', institution: 'Configured', enterprise: 'Configured' },
    status: 'planned',
    note: 'A grade written back to the institution’s learning system needs that system’s approval and a write scope Semester does not hold today.',
  },
  {
    name: 'Learning-system migration',
    tiers: { individual: 'No', department: 'No', institution: 'Optional', enterprise: 'Yes' },
    status: 'services',
    note: 'Moving courses from an existing learning system is project work with the institution, run twice before it counts. No migration has been run.',
  },
  {
    name: 'Student credential wallet',
    tiers: { individual: 'Yes', department: 'Yes', institution: 'Yes', enterprise: 'Yes' },
    status: 'planned',
    note: 'A student’s own record of what they have earned, shared on their terms. Designed; not in the app.',
  },
  {
    name: 'AI course policy',
    tiers: { individual: 'Personal controls', department: 'Department policy', institution: 'Institution and course policy', enterprise: 'Multi-campus policy' },
    status: 'pilot',
    note: 'A student always controls what the assistant may see. A course policy set in Course Studio is shown before the assistant answers; department and multi-campus policy are planned.',
  },
];

/** The services, in the order a student meets them, for the service map. */
export const SERVICES: [string, string][] = [
  ['Identity', 'Who you are: your device alone, or an account, or later your university’s sign-in.'],
  ['Planning', 'Today, My Path, the registration plan and the calendar — where you stand and what is next.'],
  ['Course learning', 'Your syllabi, deadlines and study material, and what an instructor publishes about the course.'],
  ['AI', 'Ask Semester: answers with their sources shown, under your controls and the course’s policy.'],
  ['Integrations', 'Calendars you subscribe to today; official systems, read-only and under agreement, when an institution connects one.'],
  ['Support', 'Help on every screen, and a person to write to.'],
  ['Status', 'A page that checks the service from your own browser, and says so in the app when something is slow.'],
  ['Export and leaving', 'Everything you added, in files you can open elsewhere, and deletion that means deletion.'],
];

/** Who decides what. Semester coordinates; each of these is the authority. */
export const AUTHORITIES: [string, string][] = [
  ['Semester', 'Coordinates: shows where you stand, what is next and where each fact came from.'],
  ['The student information system', 'Certifies the record: enrolment, credits, grades of record.'],
  ['The learning system', 'Stays authoritative for course content and grades unless Semester’s own course tools are contracted to replace it.'],
  ['The registrar', 'Owns official registration. Semester prepares and hands off; it never registers anyone.'],
  ['Faculty', 'Own course policy, including how AI may be used in the course.'],
  ['Students', 'Control their personal plans and what they share, for how long, with whom.'],
];

/** One row of the system-boundaries table: what Semester does, and who is official. */
export interface Boundary {
  area: string;
  does: string;
  authority: string;
}

export const BOUNDARIES: Boundary[] = [
  { area: 'Registration', does: 'Prepares, explains, checks conflicts and hands off', authority: 'The registrar and the student information system' },
  { area: 'Degree progress', does: 'Plans and estimates, as a Path Snapshot', authority: 'The official degree audit' },
  { area: 'Grades', does: 'Shows what you record; a course gradebook only where an institution contracts one', authority: 'The learning system or the student information system, as the institution decides' },
  { area: 'Financial aid', does: 'Shows the action and the checklist', authority: 'The financial-aid office and its system' },
  { area: 'Housing', does: 'Shows status and the route to act', authority: 'The housing system' },
  { area: 'Health and emergencies', does: 'No student workflow by default', authority: 'The university’s authorised systems' },
  { area: 'Career', does: 'The student’s own portfolio and evidence', authority: 'Employers and the institution, for decisions' },
  { area: 'AI', does: 'Explains, practises, drafts and plans, with sources shown', authority: 'People and institutions make official decisions' },
];

/**
 * Where the demo should end for each kind of visitor.
 *
 * Every demo used to end at "Contact us". A registrar and a first-year student
 * did not come with the same problem, so they should not leave with the same
 * next step. `next` is the page, or the address, that matches the problem;
 * `app` marks a link into the app rather than a page of the site.
 */
export interface DemoPath {
  who: string;
  came: string;
  action: string;
  /** A site path, or an app hash when `app` is set, or a mailto subject when `mail` is set. */
  to: string;
  app?: boolean;
  mail?: boolean;
}

export const DEMO_PATHS: DemoPath[] = [
  { who: 'Student', came: 'to see what your own semester would look like', action: 'Start planning free', to: '/signup/' },
  { who: 'Advisor', came: 'to see what a student brings to a meeting', action: 'Try the advisor meeting planner', to: '/tools/advisor/' },
  { who: 'Faculty', came: 'to see how a course’s rules reach students', action: 'Read what Course Studio is, and its status', to: '/platform/availability/' },
  { who: 'Registrar', came: 'to see how registration is prepared and handed off', action: 'Read the system boundaries', to: '/platform/system-boundaries/' },
  { who: 'IT and security', came: 'to see how data is held and what is not done yet', action: 'Request the architecture and procurement package', to: 'Architecture%20and%20procurement%20package', mail: true },
  { who: 'Enterprise', came: 'to see how a multi-campus arrangement would run', action: 'Ask for an enterprise briefing', to: 'Enterprise%20briefing', mail: true },
];
