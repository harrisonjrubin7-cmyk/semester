import type { OfficeId } from './offices';
import type { Screen } from './types';

/**
 * Where to go, for everything that is not a course.
 *
 * Care, basic needs, access, safety, the campus itself and the ways into its
 * governance. Every one of these already has an office that runs it; what a
 * student lacks is the map — which door, what happens behind it, and whether
 * what they say there stays there. That map is all this is.
 *
 * ## What it is not
 *
 * Not a clinical system, not a safety system, not a tracker. It diagnoses
 * nothing, scores nothing, and infers nothing from how the app is used — there
 * is no "wellbeing" number anywhere, and `support.test.ts` holds that no entry
 * offers one. It does not know where anybody is. It does not monitor, and says
 * so on the one card where somebody might assume it does.
 *
 * ## Confidentiality is said before the door, not after
 *
 * Every entry that routes to a person carries `privacy`, and the screen draws
 * it *before* the link. "Confidential" means the counselor cannot share what you
 * say except where law requires; "private" means the office shares it only with
 * those who need it to help; "reports" means the office may be obliged to act on
 * what it hears. A student deciding whether to walk in should know which it is.
 */

export type Privacy = 'confidential' | 'private' | 'reports' | 'public';

export const PRIVACY_SAYS: Record<Privacy, string> = {
  confidential: 'Confidential — what you say stays with them, except where the law requires otherwise.',
  private: 'Private — shared only with the staff who need it to help you.',
  reports: 'May have to act — some staff are required to report certain things they are told.',
  public: 'Public information — no need to share anything about yourself.',
};

export interface Entry {
  id: string;
  title: string;
  what: string;
  /** Who runs it. `undefined` only for national lines that are not an office. */
  office?: OfficeId;
  /** A national number, for the few services that have one. */
  call?: string;
  privacy: Privacy;
  /** Student-run rather than an official service — labelled on screen. */
  studentRun?: boolean;
  /** An in-app place that helps with it. */
  screen?: Screen;
  /** Quiet, low-stimulation — shown first when sensory-friendly is on. */
  quiet?: boolean;
}

export interface Section {
  id: 'now' | 'care' | 'access' | 'campus' | 'involved';
  label: string;
  intro: string;
  groups: { heading: string; entries: Entry[] }[];
  /** What this section will never do, said on screen. */
  never: string[];
}

export const SECTIONS: readonly Section[] = [
  {
    id: 'now',
    label: 'Right now',
    intro: 'If you or someone else is in danger, call emergency services first.',
    groups: [
      {
        heading: 'Emergency and crisis',
        entries: [
          { id: '911', title: 'Emergency services', what: 'Immediate danger, fire or a medical emergency (U.S.).', call: '911', privacy: 'public' },
          { id: '988', title: '988 Suicide and Crisis Lifeline', what: 'Call or text, any hour, for yourself or someone else (U.S.).', call: '988', privacy: 'confidential' },
          { id: 'campus-safety', title: 'Campus public safety', what: 'Campus emergencies, safety escorts and the official alert system.', office: 'safety', privacy: 'reports' },
          { id: 'after-hours', title: 'After-hours counseling line', what: 'Most counseling centers answer after hours. Their site lists the number.', office: 'counseling', privacy: 'confidential' },
        ],
      },
      {
        heading: 'If campus closes or is disrupted',
        entries: [
          { id: 'alerts', title: 'Official emergency alerts', what: 'Sign up through public safety. Closures and weather notices come from there, not from this app.', office: 'safety', privacy: 'public' },
          { id: 'deadlines', title: 'Ask how deadlines change', what: 'Write to each instructor once, in one email, asking what moves.', screen: 'mail', privacy: 'private' },
          { id: 'remote', title: 'Remote access to course tools', what: 'The course site, library databases and your saved sources work off campus.', office: 'it', privacy: 'public' },
        ],
      },
    ],
    never: [
      'Semester does not monitor anyone, at any hour. It is not an emergency service.',
      'It never tracks your location or anyone else’s.',
      'Alerts here are copies of official ones — the official channel is the source.',
    ],
  },
  {
    id: 'care',
    label: 'Care',
    intro: 'Somewhere to start, for how you are doing and for what you need to get by.',
    groups: [
      {
        heading: 'Wellbeing',
        entries: [
          { id: 'counseling', title: 'Counseling', what: 'Short-term counseling, groups and referrals.', office: 'counseling', privacy: 'confidential' },
          { id: 'health', title: 'Student health', what: 'Medical care, prescriptions and health insurance questions.', office: 'health', privacy: 'confidential' },
          { id: 'care-network', title: 'Not sure where to start', what: 'The care network routes you to the right office.', office: 'care', privacy: 'private' },
          { id: 'peer', title: 'Peer support programs', what: 'Trained students to talk to. Check how the program handles privacy.', office: 'care', privacy: 'private', studentRun: true },
          { id: 'rec', title: 'Recreation and wellness events', what: 'Classes, open hours and quiet spaces.', office: 'recreation', privacy: 'public', quiet: true },
        ],
      },
      {
        heading: 'Basic needs',
        entries: [
          { id: 'food', title: 'Food pantry and meal help', what: 'Free groceries and emergency meal swipes, where your school offers them.', office: 'basicneeds', privacy: 'private' },
          { id: 'housing-insecurity', title: 'Emergency housing', what: 'Short-term housing if you lose a place to stay.', office: 'basicneeds', privacy: 'private' },
          { id: 'emergency-grant', title: 'Emergency grants and loans', what: 'One-time help with an unexpected cost. Asked for privately.', office: 'deanofstudents', privacy: 'private' },
          { id: 'transport-help', title: 'Transportation help', what: 'Transit passes and emergency travel support.', office: 'transit', privacy: 'private' },
          { id: 'childcare', title: 'Childcare and family support', what: 'Campus childcare, subsidies and lactation spaces.', office: 'basicneeds', privacy: 'private' },
          { id: 'legal', title: 'Legal aid', what: 'Free or low-cost legal advice for students, where offered.', office: 'deanofstudents', privacy: 'confidential' },
        ],
      },
    ],
    never: [
      'No wellbeing score, no mood tracking, no diagnosis and no therapy.',
      'Nothing about how you use the app is read as a sign of how you are.',
      'Nobody is told that you opened this page.',
    ],
  },
  {
    id: 'access',
    label: 'Access',
    intro: 'Accommodations and accessible tools. Your status stays with the access office unless you share it.',
    groups: [
      {
        heading: 'Requesting accommodations',
        entries: [
          { id: 'request', title: 'How to request accommodations', what: 'Apply to the access office. They decide, and they tell instructors only what you authorize.', office: 'access', privacy: 'private' },
          { id: 'documents', title: 'What documentation they need', what: 'The access office publishes its own list. Ask before paying for new testing.', office: 'access', privacy: 'private' },
          { id: 'exams', title: 'Exam accommodations', what: 'Booking the testing center, and the deadline for each exam.', office: 'access', privacy: 'private' },
          { id: 'materials', title: 'Accessible course materials', what: 'Alternate formats, captions and transcripts, requested through the access office.', office: 'access', privacy: 'private' },
        ],
      },
      {
        heading: 'Tools and spaces',
        entries: [
          { id: 'at', title: 'Assistive technology', what: 'Screen readers, text-to-speech and dictation on campus machines.', office: 'it', privacy: 'public' },
          { id: 'notes', title: 'Note-taking support', what: 'Peer notes or recording, where approved.', office: 'access', privacy: 'private' },
          { id: 'quiet-rooms', title: 'Low-stimulation study rooms', what: 'Quiet, dimmable rooms in the library.', office: 'library', privacy: 'public', quiet: true },
          { id: 'report-barrier', title: 'Report an access barrier', what: 'A broken door, an uncaptioned video, an inaccessible page.', office: 'facilities', privacy: 'private' },
        ],
      },
    ],
    never: [
      'Semester never stores your accommodation status or shows it to faculty or classmates.',
      'It never guesses a disability from how you use it.',
      'Your planning notes below are yours alone, and separate from any official record.',
    ],
  },
  {
    id: 'campus',
    label: 'Campus',
    intro: 'Getting around, finding a room, and the equipment you can borrow.',
    groups: [
      {
        heading: 'Getting around',
        entries: [
          { id: 'map', title: 'Campus map and accessible routes', what: 'Buildings, entrances and step-free routes.', screen: 'maps', office: 'facilities', privacy: 'public' },
          { id: 'transit', title: 'Shuttles, transit and parking', what: 'Schedules, disruption notices and permits.', office: 'transit', privacy: 'public' },
          { id: 'hours', title: 'Building and service hours', what: 'When libraries, labs, dining and offices open.', office: 'facilities', privacy: 'public' },
          { id: 'dining', title: 'Food on campus', what: 'Dining hours and your meal plan.', screen: 'meals', office: 'dining', privacy: 'public' },
          { id: 'housing', title: 'Housing deadlines and move-in', what: 'Your room and the dates that matter.', screen: 'housing', office: 'housing', privacy: 'private' },
        ],
      },
      {
        heading: 'Spaces and equipment',
        entries: [
          { id: 'study-space', title: 'Find a study space', what: 'Group rooms, silent floors and late-night spaces.', office: 'library', privacy: 'public', quiet: true },
          { id: 'room-booking', title: 'Book a library room', what: 'Reserved through the library’s own booking system.', office: 'library', privacy: 'public' },
          { id: 'labs', title: 'Computer labs and printing', what: 'Where, when, and what it costs to print.', office: 'it', privacy: 'public' },
          { id: 'maker', title: 'Makerspaces and studios', what: 'Equipment training comes first; the space lists what each tool needs.', office: 'library', privacy: 'public' },
          { id: 'equipment', title: 'Equipment loans', what: 'Cameras, laptops, calculators and accessible equipment.', office: 'library', privacy: 'public' },
          { id: 'lab-safety', title: 'Lab safety training', what: 'Required before most lab and shop access.', office: 'research', privacy: 'public' },
        ],
      },
    ],
    never: [
      'Availability comes from the official booking systems — this app books nothing itself.',
      'No location tracking, and nobody can see where you live or study.',
    ],
  },
  {
    id: 'involved',
    label: 'Get involved',
    intro: 'Student government, committees and sustainability — with official and student voices labelled.',
    groups: [
      {
        heading: 'Governance and civic life',
        entries: [
          { id: 'elections', title: 'Student government elections', what: 'Official dates, rules and candidate information.', office: 'government', privacy: 'public' },
          { id: 'committees', title: 'Committees and leadership roles', what: 'Seats for students on university committees.', office: 'government', privacy: 'public' },
          { id: 'budget', title: 'Student funding and participatory budgeting', what: 'How student fees are allocated, and how to propose something.', office: 'government', privacy: 'public' },
          { id: 'comment', title: 'Comment on a proposed policy', what: 'Open comment periods the university publishes.', office: 'deanofstudents', privacy: 'public' },
          { id: 'orgs', title: 'Running a student organization', what: 'Registration, officer training and funding rules.', office: 'involvement', privacy: 'public', screen: 'activities' },
        ],
      },
      {
        heading: 'Sustainability',
        entries: [
          { id: 'green-events', title: 'Sustainability events and groups', what: 'Official programs and student groups, labelled as which.', office: 'sustainability', privacy: 'public' },
          { id: 'bike', title: 'Bikes, shuttles and transit passes', what: 'Lower-carbon ways around campus.', office: 'transit', privacy: 'public' },
          { id: 'green-lab', title: 'Green labs and project grants', what: 'Help making a lab or project use less.', office: 'sustainability', privacy: 'public' },
          { id: 'green-careers', title: 'Sustainability credentials and careers', what: 'Track one in Opportunities.', screen: 'opportunities', privacy: 'public' },
        ],
      },
    ],
    never: [
      'No political ads, no targeting and no popularity rankings.',
      'Challenges are personal — nobody is ranked or named.',
      'Official information and student opinion are always labelled as which.',
    ],
  },
];

/** Every entry, for search and for the test. */
export function allEntries(): Entry[] {
  return SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));
}

/** With sensory-friendly on, quiet entries come first in each group; nothing is hidden. */
export function arranged(entries: readonly Entry[], sensory: boolean): Entry[] {
  if (!sensory) return [...entries];
  return [...entries.filter((e) => e.quiet), ...entries.filter((e) => !e.quiet)];
}

/** "What to do during…" — the shape of a plan, deferring to the official guide. */
export const PREPAREDNESS: readonly { id: string; during: string; steps: string[] }[] = [
  { id: 'weather', during: 'Severe weather', steps: ['Follow the official alert.', 'Go to the building’s designated shelter area.', 'Tell instructors afterwards if it cost you a deadline.'] },
  { id: 'closure', during: 'A campus closure', steps: ['Check the official status page before travelling.', 'Open your saved sources and course site from home.', 'Ask each instructor once which deadlines move.'] },
  { id: 'outage', during: 'A power or network outage', steps: ['Keep a charged phone and your downloaded readings.', 'Note what you could not submit, and when.', 'Email the instructor as soon as you can.'] },
  { id: 'emergency', during: 'An emergency on campus', steps: ['Call 911 if anyone is in danger.', 'Follow official alerts and the instructions of responders.', 'Let people know you are safe through your own channels.'] },
];

/** A checklist for keeping the term going when campus is not. Student-owned. */
export const CONTINUITY: readonly { id: string; title: string; screen?: Screen }[] = [
  { id: 'sources', title: 'Readings and sources saved to this device', screen: 'sources' },
  { id: 'plan', title: 'A study plan that works from home', screen: 'work' },
  { id: 'contacts', title: 'Instructor contact details in one place', screen: 'people' },
  { id: 'backup', title: 'A current backup of your work', screen: 'export' },
  { id: 'alerts', title: 'Signed up for official alerts' },
];

/**
 * When to leave, for a commute.
 *
 * Class start minus travel minus buffer, in minutes since midnight. A bad
 * weather day doubles the buffer — a rule of thumb the student can overrule by
 * changing the buffer, not a forecast.
 */
export function leaveBy(classStart: number, travel: number, buffer: number, badWeather = false): number {
  const b = Math.max(0, buffer) * (badWeather ? 2 : 1);
  return Math.max(0, classStart - Math.max(0, travel) - b);
}

export interface SupportLibrary {
  /** Personal emergency contacts, on this device only. */
  contacts: { id: string; name: string; phone: string }[];
  /** Access planning notes. Never an official record, never shared. */
  accessNotes: string;
  /** Routines the student chose to keep in view. */
  routines: string[];
  continuity: Record<string, boolean>;
  commute: { travel: number; buffer: number };
}

export const ROUTINE_IDEAS = [
  'A break every 90 minutes of study',
  'A regular bedtime on weeknights',
  'A walk between classes',
  'Meals at roughly the same times',
  'One evening a week with nothing due',
] as const;

export const EMPTY_SUPPORT: SupportLibrary = {
  contacts: [],
  accessNotes: '',
  routines: [],
  continuity: {},
  commute: { travel: 20, buffer: 10 },
};

export function readSupport(v: unknown): SupportLibrary {
  if (!v || typeof v !== 'object') return EMPTY_SUPPORT;
  const o = v as Record<string, unknown>;
  const c = (o.commute && typeof o.commute === 'object' ? o.commute : {}) as Record<string, unknown>;
  const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 600 ? x : d);
  const ids = new Set(CONTINUITY.map((x) => x.id));
  return {
    contacts: (Array.isArray(o.contacts) ? o.contacts : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')
      .slice(0, 10)
      .map((x) => ({ id: String(x.id), name: String(x.name ?? '').slice(0, 80), phone: String(x.phone ?? '').slice(0, 40) })),
    accessNotes: typeof o.accessNotes === 'string' ? o.accessNotes.slice(0, 5000) : '',
    routines: (Array.isArray(o.routines) ? o.routines : []).filter((r): r is string => typeof r === 'string').slice(0, 12).map((r) => r.slice(0, 120)),
    continuity: Object.fromEntries(
      Object.entries(o.continuity && typeof o.continuity === 'object' ? o.continuity : {}).filter(([k, x]) => ids.has(k) && x === true),
    ) as Record<string, boolean>,
    commute: { travel: n(c.travel, EMPTY_SUPPORT.commute.travel), buffer: n(c.buffer, EMPTY_SUPPORT.commute.buffer) },
  };
}
