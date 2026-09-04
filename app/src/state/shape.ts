/**
 * The shape of everything the app remembers, and the actions that change it.
 *
 * Split out of `store.tsx` so the reducer can be read, tested and extended
 * without loading React. The store file had grown to fourteen hundred lines
 * holding four different jobs at once — the shape, the reducer, the provider
 * and the sync effects — and the reducer was the part nobody could test,
 * because reaching it meant importing a React context and, behind it, the
 * whole Supabase client.
 *
 * Nothing here has any dependency beyond types and small pure helpers.
 */

import type {
  Appointment,
  CampusLink,
  CourseId,
  CourseModule,
  CourseUpdate,
  FeedEvent,
  FeedSource,
  NavMode,
  Note,
  PersonalTask,
  Screen,
  StudyMode,
} from '../lib/types';
import { DEFAULT_NOTIFS, type NotifKey, EXTRACT } from '../data/misc';
import type { SavedPlace } from '../lib/place';
import type { Commitment } from '../lib/activities';
import type { Alarm, Timer } from '../lib/clocks';
import { readApplications, type Application, type Stage } from '../lib/apply';
import { readProgress, type Progress, type Unit } from '../lib/progress';
import { readReturned, readWindows, type RegradeWindow, type Returned } from '../lib/returned';
import { readSettings as readGeocode, type Settings as Geocode } from '../lib/geocode';
import { COMMON_SCALE, readRequirements, readTaken, type Requirement, type Scale, type Taken } from '../lib/degree';
import { readLetters, readPeople, readVisits, type Letter, type Person, type Visit } from '../lib/letters';
import { readAnswers, type Answer, type Sure } from '../lib/sure';
import { readContract, readFloor, readRest, type Contract, type Floor, type Rest } from '../lib/rest';
import type { Taken as Undone } from '../lib/undo';
import { DEFAULT_TABS, readTabs } from '../lib/tabbar';
import type { YoursBy } from '../lib/yours';
import { readRules, type MyRule } from '../lib/myrules';
import { readLog, readPolicy, type AttendPolicy, type Attended } from '../lib/attend';
import { readDrop } from '../lib/drop';
import { DEFAULT_BUDGET } from '../lib/clash';
import type { Sitting } from '../lib/sitting';
import type { NewSource, Source } from '../lib/sources';
import { type Reviews } from '../lib/review';
import { DEFAULT_ORDER } from '../lib/feed';
import type { Found, TermDate } from '../lib/registrar';
import type { Spent } from '../lib/pace';
import type { Window } from '../lib/windows';
import type { Cost } from '../lib/cost';
import type { Balance } from '../lib/meals';
import type { Residence } from '../lib/housing';
import { LEGACY_TERM } from '../lib/term';
import { readLook, type Look } from '../lib/look';
import { readStarted } from '../lib/underway';

/**
 * The prototype held everything in one component's state and lost it on reload.
 * Here the same shape is split in two: `persisted` is the handful of things a
 * real app has to remember between sessions — what you have ticked off, what
 * you have saved, how you like the app set up — and everything else is
 * ephemeral navigation state that should reset.
 */
export interface Persisted {
  nav: NavMode;
  /**
   * Every answer you have given, keyed by card.
   *
   * This is the app's memory of what you know. Before it existed, drilling
   * changed nothing that outlived the screen.
   */
  reviews: Reviews;
  /** Your own scores per course grading category, as you typed them. */
  grades: Record<string, string>;
  /**
   * Places you named, so a coordinate can mean something.
   *
   * The app never geocodes — there is no free way to turn a position into a
   * building name that does not mean sending your position to somebody else.
   * You stand somewhere and name it once; everything else is arithmetic on
   * this list, done on the device.
   */
  places: SavedPlace[];
  /**
   * Clubs, a job, research, a chapter, a team — everything you do that is not
   * a class. Persisted because it is yours, and because a week without it in
   * the picture is a week the app is wrong about.
   */
  commitments: Commitment[];
  /**
   * Countdowns and alarms of the ordinary kind — see `lib/clocks.ts`. Nothing
   * to do with the work-session clock in `lib/session.ts`, which measures a
   * piece of coursework and feeds `lib/pace.ts`. These belong to nothing and
   * are for anything.
   */
  timers: Timer[];
  alarms: Alarm[];
  /**
   * Internships, jobs, research posts — the other deadline set. See
   * `lib/apply.ts`. Here rather than in a spreadsheet because those deadlines
   * land on the same days as coursework, and until both were in one place
   * nothing could say so.
   */
  applications: Application[];
  /**
   * Where you are inside a reading, keyed by the deadline it belongs to. See
   * `lib/progress.ts` — a checkbox is a terrible instrument for a two-hundred
   * page book, and a page number is one somebody already has in front of them.
   */
  progress: Record<string, Progress>;
  /**
   * Work that has come back, and the window each course allows for saying
   * something about it. See `lib/returned.ts` — the most consequential
   * deadline in a syllabus and the only one nobody puts in a calendar, because
   * it does not exist until a grade appears.
   */
  returned: Returned[];
  regradeWindows: Record<string, RegradeWindow>;
  /**
   * Whether the app may look an address up, and how. Off by default and
   * off in two directions independently — see `lib/geocode.ts`. With it off
   * the app behaves exactly as it always has: you name places yourself and
   * nothing leaves the device.
   */
  geocode: Geocode;
  /**
   * The degree, as *you* recorded it — see `lib/degree.ts`. There is no
   * built-in list of requirements and there will not be one: they are specific
   * to a university, a college and a catalogue year, and a confidently wrong
   * one is found out in a final year when nothing can be done.
   */
  requirements: Requirement[];
  taken: Taken[];
  /** Letter grades to points. Entered, because plus and minus values differ. */
  scale: Scale;
  /**
   * The people who will write about you, the conversations, and what you asked
   * them for. See `lib/letters.ts` — the highest-cost thing a student can start
   * late and the one with no deadline attached to warn them.
   */
  people: Person[];
  visits: Visit[];
  letters: Letter[];
  /**
   * Every answer with how sure you were. See `lib/sure.ts` — a lucky guess and
   * a settled fact look identical to the scheduler otherwise, and so do a
   * confident miss and a shrug.
   */
  answers: Answer[];
  /**
   * The hours that are not available. See `lib/rest.ts` — rest that is not
   * written down is the residual, and the residual is what gets eaten.
   */
  floor: Floor;
  rest: Rest[];
  /** How many hours a week you decided school gets. Zero means none set. */
  contract: Contract;
  /** The order of the sections on Today, and which are switched off. */
  feedOrder: string[];
  feedHidden: Record<string, boolean>;
  /**
   * The screens in the bottom bar, in order. Validated on the way in and out
   * by `lib/tabbar.ts` — a navigation bar cannot afford to render nothing.
   */
  tabs: Screen[];
  /**
   * What the student has said about each course — their name for it, a
   * colour, whether it is pinned. A side table rather than an edit, because
   * the sample courses cannot be edited and a re-import rewrites the rest.
   * See `lib/yours.ts`.
   */
  yours: YoursBy;
  /** Reminder rules the student wrote. See `lib/myrules.ts`. */
  myRules: MyRule[];
  /**
   * What to call them. Empty until they say, and never guessed at from an
   * email address — a name is a thing you ask for, not derive.
   */
  myName: string;
  /** Every class marked present, absent or excused. See `lib/attend.ts`. */
  attendance: Attended[];
  /** What each course's syllabus says about turning up, keyed by course id. */
  attendPolicy: Record<string, AttendPolicy>;
  /** Individual scores inside a grading category, keyed like a grade. */
  pieces: Record<string, string>;
  /** How many lowest pieces a category drops. See `lib/drop.ts`. */
  drops: Record<string, number>;
  /** Hours of coursework in a day before it stops being a normal day. */
  dayBudget: number;
  /** The order they put their courses in. Ids not listed keep import order. */
  courseOrder: CourseId[];
  /** The destinations you opened most recently, newest first. */
  recent: Screen[];
  /**
   * Every screen ever opened, so the app can say what has not been.
   *
   * Separate from `recent`, which keeps twelve — a screen opened once in
   * August and not since falls off that list and would then be offered back
   * as though it were new. See `lib/unseen.ts`.
   */
  visited: Record<string, boolean>;
  /**
   * Practice papers you have sat.
   *
   * Capped, and the cap is real rather than cautious: a sitting keeps its
   * missed questions, and an account has a five-megabyte budget shared with
   * every note and course in it. Forty papers is more than a semester
   * produces and the oldest is the least useful.
   */
  sittings: Sitting[];
  /**
   * Sources you have collected, per course and per project.
   *
   * Four tools refuse to invent a citation and ask for yours; this is so that
   * asking happens once rather than every session.
   */
  sources: Source[];
  /**
   * The university's own dates — add/drop, withdrawal, registration.
   *
   * Ships empty and is filled in by the student from their own registrar. See
   * `lib/registrar.ts` for why the app refuses to guess these.
   */
  registrar: TermDate[];
  /**
   * How long each finished piece of work took, as you reported it.
   *
   * The one number the app could never compute and can only be told. See
   * `lib/pace.ts` — it is asked for once, at the moment you tick a box, and
   * it is what lets the week ahead compare hours asked against hours there
   * are instead of listing five assignments of unknown size.
   */
  spent: Spent[];
  /**
   * The hours you actually work in.
   *
   * Empty means the app falls back to a sixteen-hour day, and says so rather
   * than presenting a constant as a fact. See `lib/windows.ts`.
   */
  windows: Window[];
  /**
   * What this semester cost — books, fees, access codes.
   *
   * Entered, never fetched: prices differ by edition, by seller and by the
   * week, and a wrong one shown confidently is worse than a blank field. See
   * `lib/cost.ts`.
   */
  costs: Cost[];
  /**
   * Meal-plan balances, as read off CBORD GET.
   *
   * Logged rather than overwritten: one balance is a fact about today and
   * says nothing about eating, and two a few days apart say everything. See
   * `lib/meals.ts`.
   */
  balances: Balance[];
  /**
   * Where you live, per term.
   *
   * Entered rather than fetched: the housing portal is behind single sign-on
   * and publishes no interface a student can use. Two fields once a year buy
   * the move-out arithmetic and the first walk of the day. See
   * `lib/housing.ts`.
   */
  residences: Residence[];
  /**
   * Testing-centre lead time, in business days. Zero means not used.
   *
   * Student Access states a lead time for a booking — "five business days
   * before the exam" — and counting those backwards over a weekend is the
   * arithmetic somebody gets wrong at eleven at night. The exam runway does
   * it. Zero for everybody who does not use one; this is not a thing to ask
   * every student about.
   */
  accessLeadDays: number;
  /**
   * When each deadline was ticked, epoch ms.
   *
   * Deliberately a second map rather than a change to `done`, which a dozen
   * files read as `Record<string, boolean>`. Nothing that reads `done` has to
   * know this exists, a saved store from before it simply has none, and the
   * weekly report falls back to the due date where an entry is missing.
   */
  tickedAt: Record<string, number>;
  /**
   * How the app looks. Every one of these is an id into a list in `lib/look.ts`
   * rather than a value, so a look saved today survives the palette being
   * retuned tomorrow, and an id from a future version falls back rather than
   * writing a broken colour onto the root element.
   */
  accent: string;
  textSize: string;
  ground: string;
  density: string;
  corners: string;
  /** The heading face. The body face is separate — see `bodyface`. */
  typeface: string;
  bodyface: string;
  lineHeight: string;
  readingWidth: string;
  iconShape: string;
  labels: string;
  badges: string;
  feed: string;
  /** A dragged accent hue, 0–360, or -1 for "use the named accent". */
  hue: number;
  /**
   * Whether the ten ways to study stay unrolled on a guide.
   *
   * Open is right the first time — otherwise six of the ten are a feature
   * nobody knows exists. Closed is right on the hundredth night, when you came
   * to drill cards and do not want to scroll past a menu to reach them. So it
   * is a preference, and it remembers.
   */
  waysOpen: boolean;
  done: Record<string, boolean>;
  saved: Record<string, boolean>;
  notifs: Record<NotifKey, boolean>;
  picked: Record<string, boolean>;
  seenOnboarding: boolean;
  /**
   * Deadline id to when work on it began.
   *
   * A tick box has two positions and coursework has three — see
   * `lib/underway.ts`. Separate from `done` rather than a third value on it,
   * because "started" and "finished" are independent facts and collapsing them
   * into one enum makes un-ticking a finished thing lose that it was ever
   * started.
   */
  started: Record<string, number>;
  cleared: boolean;
  /** Things you added yourself — kept apart from anything a syllabus produced. */
  tasks: PersonalTask[];
  appointments: Appointment[];
  notes: Note[];
  /** Material added to a course since it was imported. See `lib/live.ts`. */
  updates: CourseUpdate[];
  /** External calendars — Brightspace, Outlook, any .ics. */
  feeds: FeedSource[];
  feedEvents: FeedEvent[];
  /**
   * The courses this account holds. Generated from uploaded syllabi, or added
   * by hand — either way they are data, not code.
   */
  courses: CourseModule[];
  /** Whether the sample semester is switched on alongside them. */
  sample: boolean;
  /**
   * The term being shown — '2026FA'.
   *
   * Courses from other terms stay in the account and out of the way: off
   * Today, out of the hour arithmetic, one tap from the shelf. See
   * `lib/term.ts`.
   */
  term: string;
  /** Addresses for the campus links, keyed by id. Yours beat the defaults. */
  linkUrls: Record<string, string>;
  /** Links you added yourself, alongside the campus ones. */
  extraLinks: CampusLink[];
}

export interface Ephemeral {
  /**
   * The last destructive thing, for as long as the toast is up.
   *
   * Ephemeral on purpose: an undo restored onto a copy that has synced and
   * moved on is worse than no undo, and an offer to take back something from
   * last Tuesday is not an offer anybody wants. See `lib/undo.ts`.
   */
  undone: Undone | null;
  /** Whether the one-line capture box is open. See `lib/capture.ts`. */
  quickAdd: boolean;
  screen: Screen;
  /** Back stack, so Back walks history rather than one remembered screen. */
  history: Screen[];
  courseId: CourseId;
  itemId: string;
  eventId: string;
  guideId: CourseId;
  mode: StudyMode;
  episodeId: string | null;
  filter: string;
  evFilter: string;
  calTab: 'deadlines' | 'campus';
  /** Which schedule view the calendar is showing. */
  calView: 'day' | 'week' | 'month' | 'semester';
  /** Which sources the calendar is showing — combined, or one at a time. */
  calSource: 'all' | 'classes' | 'deadlines' | 'campus';
  /** Day the Day view is on, as an ISO date. Null means today. */
  calDay: string | null;
  /**
   * Which section of a tab is open.
   *
   * Calendar and Mine both open on a segmented control that switches between
   * views of the same subject, and that turned out to be the clearest shape in
   * the app — so Today, Courses and Study use it too rather than each being a
   * single long scroll with everything on it.
   */
  mineTab: 'tasks' | 'appointments' | 'notes' | 'places' | 'files';
  homeTab: 'today' | 'hours' | 'week' | 'done' | 'brief';
  coursesTab: 'courses' | 'due' | 'grades';
  /** Me follows the same shape as every other tab: a switcher, then one view. */
  meTab: 'you' | 'all' | 'settings';
  /** Which shelf of the directory is showing under Everything. */
  meGroup: string;
  /**
   * A paper the guide's Quiz mode asked for, read once by the Exam screen.
   *
   * The two used to be separate systems that did not know about each other:
   * ten fixed multiple-choice questions in the guide, and the timed paper.
   * Both are one tap from Study and nothing said which to use. They stay
   * distinct — marked as you go is a different exercise from sat against a
   * clock — but each offers the other now, and this is how the handover
   * carries the shape across.
   */
  examPreset: { minutes: number; formatId: string; code?: string } | null;
  /**
   * A message queued for a class room, read once by Classmates.
   *
   * How a shared practice paper gets from the Exam screen to the room without
   * a new table: the code already reproduces the questions, so the share is a
   * message and everybody's marks stay on their own device.
   */
  roomDraft: string;
  /** Which standing the Coming-up list is showing: ahead, missed or finished. */
  /** `working` is a filter over the other three, not a fourth bucket. */
  dueTab: 'ahead' | 'working' | 'overdue' | 'done';
  /**
   * What the Email screen should open already filled in.
   *
   * Set by whoever sent you there — a course page knows the professor, a
   * message in the Mail tab knows what you are replying to — and read once.
   */
  mailSeed: { purposeId: string; courseId: CourseId | ''; to: string; incoming: string } | null;
  studyTab: 'guides' | 'tonight' | 'ask';
  /** Note currently open in the editor. */
  noteId: string | null;
  /** Unit whose lesson is playing. */
  lessonUnit: number;
  /** Unit the Add-material screen is filing against; null for a new one. */
  updateUnit: number | null;
  query: string;
  onb: number;
  loadStep: number;
  selDate: string | null;
  calMonth: number;
  calYear: number;
  openUnit: number;
  drillUnit: number | null;
  drillIdx: number;
  drillGot: number;
  revealed: boolean;
  quiz: QuizQuestion[];
  quizIdx: number;
  quizPicked: number | null;
  quizScore: number;
  quizSeed: number;
  /**
   * Courses deleted on this device and not yet deleted from the account.
   *
   * Ephemeral on purpose. A push tells the account exactly what this device
   * removed, and nothing else — the alternative, and what this replaces, was
   * a push that deleted every course the account held and the pushing device
   * did not, which meant a phone that had never synced could wipe a course
   * imported on the laptop. It is not persisted because a synced deletion is
   * finished business, and an unsynced one coming back on the next pull is a
   * visible, fixable outcome rather than a silent loss.
   */
  removedCourses: string[];
}

export interface QuizQuestion {
  q: string;
  unit: string;
  full: string;
  opts: { text: string; ok: boolean }[];
}

export type State = Persisted & Ephemeral;

export const STORAGE_KEY = 'semester.v1';
/** When this device last agreed with the account copy, as epoch ms. */
export const SYNCED_KEY = 'semester.synced';

export const DEFAULT_PERSISTED: Persisted = {
  nav: 'tabs',
  done: {},
  saved: { e1: true, e16: true },
  notifs: { ...DEFAULT_NOTIFS },
  picked: EXTRACT.reduce<Record<string, boolean>>((a, x) => {
    a[x.id] = true;
    return a;
  }, {}),
  seenOnboarding: false,
  started: {},
  cleared: false,
  tasks: [],
  appointments: [],
  notes: [],
  updates: [],
  feeds: [],
  feedEvents: [],
  linkUrls: {},
  extraLinks: [],
  courses: [],
  // A new account starts empty and is walked through its first syllabus. The
  // sample is a button, not a default: nobody's first impression of the app
  // should be somebody else's timetable.
  sample: false,
  term: LEGACY_TERM,
  waysOpen: true,
  reviews: {},
  grades: {},
  places: [],
  commitments: [],
  timers: [],
  alarms: [],
  applications: [],
  progress: {},
  returned: [],
  regradeWindows: {},
  geocode: { on: false, reverseOn: false, service: 'nominatim' },
  requirements: [],
  taken: [],
  scale: { ...COMMON_SCALE },
  people: [],
  visits: [],
  letters: [],
  answers: [],
  floor: { from: 23 * 60, to: 7 * 60, on: false },
  rest: [],
  contract: { hours: 0, at: 0 },
  feedOrder: DEFAULT_ORDER,
  feedHidden: {},
  tabs: DEFAULT_TABS,
  visited: {},
  yours: {},
  courseOrder: [],
  myRules: [],
  myName: '',
  attendance: [],
  attendPolicy: {},
  pieces: {},
  drops: {},
  dayBudget: DEFAULT_BUDGET,
  recent: [],
  sittings: [],
  sources: [],
  registrar: [],
  spent: [],
  windows: [],
  costs: [],
  balances: [],
  residences: [],
  accessLeadDays: 0,
  tickedAt: {},
  accent: 'sterling',
  textSize: 'normal',
  ground: 'ink',
  density: 'comfortable',
  corners: 'drawn',
  typeface: 'condensed',
  bodyface: 'barlow',
  lineHeight: 'normal',
  readingWidth: 'normal',
  iconShape: 'none',
  labels: 'on',
  badges: 'due',
  feed: 'cards',
  hue: -1,
};

/** The look, gathered off the state it is spread across. */
export function currentLook(state: Persisted): Look {
  return {
    accent: state.accent,
    textSize: state.textSize,
    ground: state.ground,
    density: state.density,
    corners: state.corners,
    typeface: state.typeface,
    bodyface: state.bodyface,
    lineHeight: state.lineHeight,
    readingWidth: state.readingWidth,
    iconShape: state.iconShape,
    labels: state.labels,
    badges: state.badges,
    feed: state.feed,
    hue: state.hue,
  };
}

export function initialEphemeral(now: Date): Ephemeral {
  return {
    // Ephemeral on purpose: a capture box left open is not a state worth
    // restoring, and reopening the app into a modal is a way to lose people.
    quickAdd: false,
    undone: null,
    screen: 'home',
    history: [],
    courseId: 'core',
    itemId: 'bus-ga1',
    eventId: 'e1',
    guideId: 'econ',
    mode: 'cards',
    episodeId: null,
    filter: 'All',
    evFilter: 'All',
    calTab: 'deadlines',
    calView: 'month',
    calSource: 'all',
    calDay: null,
    mineTab: 'tasks',
    homeTab: 'today',
    coursesTab: 'courses',
    meTab: 'you',
    meGroup: 'Study',
    examPreset: null,
    roomDraft: '',
    dueTab: 'ahead',
    mailSeed: null,
    studyTab: 'guides',
    noteId: null,
    lessonUnit: 0,
    updateUnit: null,
    query: '',
    onb: 0,
    loadStep: 0,
    selDate: null,
    calMonth: now.getMonth(),
    calYear: now.getFullYear(),
    openUnit: 0,
    drillUnit: null,
    drillIdx: 0,
    drillGot: 0,
    revealed: false,
    quiz: [],
    quizIdx: 0,
    quizPicked: null,
    quizScore: 0,
    quizSeed: 1,
    removedCourses: [],
  };
}

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PERSISTED };
    const saved = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...DEFAULT_PERSISTED,
      ...saved,
      notifs: { ...DEFAULT_PERSISTED.notifs, ...(saved.notifs ?? {}) },
      done: saved.done ?? {},
      saved: saved.saved ?? DEFAULT_PERSISTED.saved,
      picked: { ...DEFAULT_PERSISTED.picked, ...(saved.picked ?? {}) },
      tasks: saved.tasks ?? [],
      appointments: saved.appointments ?? [],
      notes: saved.notes ?? [],
      updates: saved.updates ?? [],
      feeds: saved.feeds ?? [],
      feedEvents: saved.feedEvents ?? [],
      linkUrls: saved.linkUrls ?? {},
      extraLinks: saved.extraLinks ?? [],
      courses: saved.courses ?? [],
      // An install that predates courses-as-data was running the four built-in
      // ones; it keeps them, or the app would look wiped on the next load. A
      // genuinely new account starts empty.
      sample: saved.sample ?? saved.courses === undefined,
      term: saved.term ?? LEGACY_TERM,
    waysOpen: saved.waysOpen ?? true,
      reviews: saved.reviews ?? {},
      grades: saved.grades ?? {},
      places: saved.places ?? [],
      commitments: saved.commitments ?? [],
      timers: saved.timers ?? [],
      alarms: saved.alarms ?? [],
      applications: readApplications(saved.applications),
      progress: readProgress(saved.progress),
      returned: readReturned(saved.returned),
      regradeWindows: readWindows(saved.regradeWindows),
      geocode: readGeocode(saved.geocode),
      requirements: readRequirements(saved.requirements),
      taken: readTaken(saved.taken),
      people: readPeople(saved.people),
      visits: readVisits(saved.visits),
      letters: readLetters(saved.letters),
      answers: readAnswers(saved.answers),
      floor: readFloor(saved.floor),
      rest: readRest(saved.rest),
      contract: readContract(saved.contract),
      scale:
        saved.scale && typeof saved.scale === 'object' && Object.keys(saved.scale).length > 0
          ? (saved.scale as Scale)
          : { ...COMMON_SCALE },
      feedOrder: saved.feedOrder ?? DEFAULT_ORDER,
      feedHidden: saved.feedHidden ?? {},
      // Not `?? DEFAULT_TABS`: a stored list can be stale, duplicated by a
      // sync, or one entry long, and any of those renders a broken bar.
      tabs: readTabs(saved.tabs),
      yours: saved.yours ?? {},
      myRules: readRules(saved.myRules),
      myName: typeof saved.myName === 'string' ? saved.myName : '',
      attendance: readLog(saved.attendance),
      attendPolicy: Object.fromEntries(
        Object.entries(saved.attendPolicy ?? {}).map(([k, v]) => [k, readPolicy(v)]),
      ),
      pieces: saved.pieces ?? {},
      dayBudget:
        typeof saved.dayBudget === 'number' && saved.dayBudget > 0 && saved.dayBudget <= 16
          ? saved.dayBudget
          : DEFAULT_BUDGET,
      drops: Object.fromEntries(
        Object.entries(saved.drops ?? {}).map(([k, v]) => [k, readDrop(v)]),
      ),
      courseOrder: saved.courseOrder ?? [],
      recent: saved.recent ?? [],
      // Seeded from `recent` for anybody upgrading: without this the app
      // would tell somebody who has used it all term that they have never
      // opened Today, which is both wrong and the sort of wrong that makes
      // the rest of the sentence untrustworthy.
      visited:
        saved.visited ??
        Object.fromEntries((saved.recent ?? []).map((s: Screen) => [s, true])),
      sittings: saved.sittings ?? [],
      sources: saved.sources ?? [],
      registrar: saved.registrar ?? [],
      spent: saved.spent ?? [],
      windows: saved.windows ?? [],
      costs: saved.costs ?? [],
      balances: saved.balances ?? [],
      residences: saved.residences ?? [],
      accessLeadDays: saved.accessLeadDays ?? 0,
      tickedAt: saved.tickedAt ?? {},
      started: readStarted(saved.started),
      // Every field readLook knows about, handed straight through. Naming
      // them one by one here is how a new control gets added, saved, and then
      // silently dropped on the next reload.
      ...readLook(saved as Look),
    };
  } catch {
    // A private window, or storage disabled. Run with defaults.
    return { ...DEFAULT_PERSISTED };
  }
}

/**
 * The half of the state that outlives the session — what localStorage keeps,
 * and what an account syncs. Written once here so the two can never drift.
 */
export function pickPersisted(state: State): Persisted {
  return {
    nav: state.nav,
    done: state.done,
    saved: state.saved,
    notifs: state.notifs,
    picked: state.picked,
    seenOnboarding: state.seenOnboarding,
    cleared: state.cleared,
    tasks: state.tasks,
    appointments: state.appointments,
    notes: state.notes,
    updates: state.updates,
    feeds: state.feeds,
    feedEvents: state.feedEvents,
    linkUrls: state.linkUrls,
    extraLinks: state.extraLinks,
    courses: state.courses,
    sample: state.sample,
    term: state.term,
    waysOpen: state.waysOpen,
    reviews: state.reviews,
    grades: state.grades,
    places: state.places,
    commitments: state.commitments,
    timers: state.timers,
    alarms: state.alarms,
    applications: state.applications,
    progress: state.progress,
    returned: state.returned,
    regradeWindows: state.regradeWindows,
    geocode: state.geocode,
    requirements: state.requirements,
    taken: state.taken,
    people: state.people,
    visits: state.visits,
    letters: state.letters,
    answers: state.answers,
    floor: state.floor,
    rest: state.rest,
    contract: state.contract,
    scale: state.scale,
    feedOrder: state.feedOrder,
    tabs: state.tabs,
    yours: state.yours,
    myRules: state.myRules,
    myName: state.myName,
    attendance: state.attendance,
    attendPolicy: state.attendPolicy,
    pieces: state.pieces,
    dayBudget: state.dayBudget,
    drops: state.drops,
    courseOrder: state.courseOrder,
    feedHidden: state.feedHidden,
    recent: state.recent,
    visited: state.visited,
    sittings: state.sittings,
    sources: state.sources,
    registrar: state.registrar,
    spent: state.spent,
    windows: state.windows,
    costs: state.costs,
    balances: state.balances,
    residences: state.residences,
    accessLeadDays: state.accessLeadDays,
    tickedAt: state.tickedAt,
    started: state.started,
    accent: state.accent,
    textSize: state.textSize,
    ground: state.ground,
    density: state.density,
    corners: state.corners,
    typeface: state.typeface,
    bodyface: state.bodyface,
    lineHeight: state.lineHeight,
    readingWidth: state.readingWidth,
    iconShape: state.iconShape,
    labels: state.labels,
    badges: state.badges,
    feed: state.feed,
    hue: state.hue,
  };
}

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'back' }
  | { type: 'openItem'; id: string }
  | { type: 'openCourse'; id: CourseId }
  | { type: 'openEvent'; id: string }
  | { type: 'openGuide'; id: CourseId; mode?: StudyMode; from?: Screen; unit?: number }
  | { type: 'setMode'; mode: StudyMode }
  | { type: 'setEpisode'; id: string }
  | { type: 'toggleDone'; id: string }
  | { type: 'toggleSaved'; id: string }
  | { type: 'toggleNotif'; k: NotifKey }
  | { type: 'togglePick'; id: string }
  | { type: 'setNav'; nav: NavMode }
  | { type: 'toggleWays' }
  | { type: 'setGrade'; key: string; value: string }
  | { type: 'addPlace'; place: Omit<SavedPlace, 'id' | 'created'> }
  | { type: 'removePlace'; id: string }
  | { type: 'addCommitment'; commitment: Omit<Commitment, 'id' | 'created'> }
  | { type: 'patchCommitment'; id: string; patch: Partial<Commitment> }
  | { type: 'removeCommitment'; id: string }
  // Timers and alarms. `at` is passed in rather than read from `Date.now()`
  // inside the reducer, so a timer records the same instant the screen showed
  // — the bug the work-session clock had, where Stop wrote a different number
  // from the one it had been displaying.
  | { type: 'addTimer'; label: string; seconds: number; at: number }
  | { type: 'patchTimer'; id: string; timer: Timer }
  | { type: 'removeTimer'; id: string }
  | { type: 'addAlarm'; label: string; at: number; days: number[] }
  | { type: 'patchAlarm'; id: string; patch: Partial<Alarm> }
  | { type: 'removeAlarm'; id: string }
  | { type: 'addApplication'; patch: Partial<Application> }
  | { type: 'patchApplication'; id: string; patch: Partial<Application> }
  | { type: 'moveApplication'; id: string; stage: Stage }
  | { type: 'removeApplication'; id: string }
  | { type: 'setReadingLength'; id: string; unit: Unit; total: number }
  | { type: 'markReading'; id: string; done: number }
  | { type: 'clearReading'; id: string }
  | { type: 'markReturned'; id: string; courseId: string }
  | { type: 'patchReturned'; id: string; patch: Partial<Returned> }
  | { type: 'unmarkReturned'; id: string }
  | { type: 'setRegradeWindow'; courseId: string; window: RegradeWindow }
  | { type: 'setGeocode'; patch: Partial<Geocode> }
  | { type: 'addRequirement'; patch: Partial<Requirement> }
  | { type: 'patchRequirement'; id: string; patch: Partial<Requirement> }
  | { type: 'dropRequirement'; id: string }
  | { type: 'addTaken'; patch: Partial<Taken> }
  | { type: 'patchTaken'; id: string; patch: Partial<Taken> }
  | { type: 'dropTaken'; id: string }
  | { type: 'setScale'; scale: Scale }
  | { type: 'addPerson'; patch: Partial<Person> }
  | { type: 'patchPerson'; id: string; patch: Partial<Person> }
  | { type: 'dropPerson'; id: string }
  | { type: 'addVisit'; patch: Partial<Visit> }
  | { type: 'dropVisit'; id: string }
  | { type: 'addLetter'; patch: Partial<Letter> }
  | { type: 'patchLetter'; id: string; patch: Partial<Letter> }
  | { type: 'dropLetter'; id: string }
  | { type: 'setFloor'; patch: Partial<Floor> }
  | { type: 'addRest'; patch: Partial<Rest> }
  | { type: 'dropRest'; id: string }
  | { type: 'setContract'; hours: number }
  | { type: 'undo' }
  | { type: 'forgetUndo' }
  | { type: 'quickAdd'; open: boolean }
  | { type: 'setFeedOrder'; order: string[] }
  | { type: 'setTabs'; tabs: Screen[] }
  | { type: 'setYours'; yours: YoursBy }
  | { type: 'setMyRules'; rules: MyRule[] }
  | { type: 'setMyName'; name: string }
  | { type: 'markAttendance'; courseId: CourseId; date: string; mark: Attended['mark'] | null }
  | { type: 'setAttendPolicy'; courseId: CourseId; policy: AttendPolicy }
  | { type: 'setPieces'; key: string; text: string }
  | { type: 'setDrop'; key: string; drop: number }
  | { type: 'setDayBudget'; hours: number }
  | { type: 'setCourseOrder'; order: CourseId[] }
  | { type: 'toggleFeedSection'; id: string }
  | { type: 'setLook'; look: Partial<Look> }
  | { type: 'setFilter'; filter: string }
  | { type: 'setEvFilter'; filter: string }
  | { type: 'setCalTab'; tab: 'deadlines' | 'campus' }
  | { type: 'setQuery'; query: string }
  | { type: 'selectDate'; date: string | null }
  | { type: 'stepMonth'; delta: number }
  | { type: 'toggleUnit'; index: number }
  | { type: 'clearNotifs' }
  | { type: 'toggleStarted'; id: string }
  | { type: 'onbNext' }
  | { type: 'restartOnboarding' }
  | { type: 'finishOnboarding' }
  | { type: 'setLoadStep'; step: number }
  | { type: 'startDrill'; unit: number | null }
  | { type: 'flip' }
  | { type: 'markCard'; got: boolean; key: string; sure?: Sure; courseId?: string }
  /** An answer recorded against a card, with no drill run around it. */
  | { type: 'recordCard'; got: boolean; key: string }
  | { type: 'redrill' }
  | { type: 'startQuiz'; quiz: QuizQuestion[] }
  | { type: 'pickAnswer'; index: number }
  | { type: 'nextQuestion' }
  | { type: 'setCalView'; view: 'day' | 'week' | 'month' | 'semester' }
  | { type: 'setCalSource'; source: 'all' | 'classes' | 'deadlines' | 'campus' }
  | { type: 'setCalDay'; date: string | null }
  | { type: 'stepDay'; delta: number }
  | { type: 'setMineTab'; tab: 'tasks' | 'appointments' | 'notes' | 'places' | 'files' }
  | { type: 'setHomeTab'; tab: 'today' | 'hours' | 'week' | 'done' | 'brief' }
  | { type: 'setCoursesTab'; tab: 'courses' | 'due' | 'grades' }
  | { type: 'setMeTab'; tab: 'you' | 'all' | 'settings' }
  | { type: 'setMeGroup'; group: string }
  | { type: 'keepSitting'; sitting: Omit<Sitting, 'id'> }
  | { type: 'dropSitting'; id: string }
  | { type: 'addSource'; source: NewSource }
  | { type: 'patchSource'; id: string; patch: Partial<Source> }
  | { type: 'dropSource'; id: string }
  | { type: 'sitPaper'; minutes: number; formatId: string; code?: string }
  | { type: 'clearPaperPreset' }
  | { type: 'writeRoomDraft'; text: string }
  | { type: 'clearRoomDraft' }
  | { type: 'setDueTab'; tab: 'ahead' | 'working' | 'overdue' | 'done' }
  | {
      type: 'writeMail';
      purposeId: string;
      courseId?: CourseId | '';
      to?: string;
      incoming?: string;
    }
  | { type: 'setStudyTab'; tab: 'guides' | 'tonight' | 'ask' }
  | { type: 'addTask'; task: Omit<PersonalTask, 'id' | 'created' | 'done'> }
  | { type: 'toggleTask'; id: string }
  | { type: 'deleteTask'; id: string }
  | { type: 'addAppointment'; appointment: Omit<Appointment, 'id' | 'created'> }
  | { type: 'setAppointmentKind'; id: string; kind: string }
  | { type: 'deleteAppointment'; id: string }
  | { type: 'newNote'; courseId: CourseId | null }
  /** Save a finished piece of text as a note without leaving the screen. */
  | { type: 'keepNote'; title: string; body: string; courseId: CourseId | null }
  | { type: 'openNote'; id: string }
  | { type: 'updateNote'; id: string; patch: Partial<Pick<Note, 'title' | 'body' | 'courseId'>> }
  | { type: 'attachFile'; noteId: string; fileId: string }
  | { type: 'detachFile'; noteId: string; fileId: string }
  | { type: 'deleteNote'; id: string }
  | { type: 'openLesson'; unit: number }
  | { type: 'openDeck'; unit: number }
  | { type: 'openUpdate'; courseId: CourseId; unit?: number | null }
  | { type: 'addUpdate'; update: Omit<CourseUpdate, 'id' | 'created'> }
  | { type: 'deleteUpdate'; id: string }
  | { type: 'addFeed'; feed: Omit<FeedSource, 'id' | 'added'>; events: FeedEvent[] }
  | { type: 'syncFeed'; id: string; events: FeedEvent[]; status: string }
  | { type: 'failFeed'; id: string; status: string }
  | { type: 'removeFeed'; id: string }
  | { type: 'setLinkUrl'; id: string; url: string }
  | { type: 'addLink'; name: string; url: string }
  | { type: 'removeLink'; id: string }
  | { type: 'addCourse'; module: CourseModule }
  | { type: 'replaceCourse'; module: CourseModule }
  | { type: 'removeCourse'; id: CourseId }
  | {
      type: 'timeSpent';
      id: string;
      courseId: string;
      kind: string;
      /** A tapped bucket, or measured minutes from a timed session. */
      bucketId?: string;
      minutes?: number;
      /**
       * What you thought it would take, said before starting. Only present on
       * a timed session that asked — see `lib/worth.ts` for why a guess has to
       * be asked for rather than derived.
       */
      guess?: number;
    }
  | { type: 'addWindow'; window: Omit<Window, 'id'> }
  | { type: 'patchWindow'; id: string; patch: Partial<Window> }
  | { type: 'dropWindow'; id: string }
  | { type: 'addCost'; cost: Omit<Cost, 'id' | 'at'> }
  | { type: 'patchCost'; id: string; patch: Partial<Cost> }
  | { type: 'dropCost'; id: string }
  | { type: 'setAccessLead'; days: number }
  /** Where you live this term, from the housing portal. */
  | { type: 'setResidence'; residence: Omit<Residence, 'id' | 'created'> }
  | { type: 'dropResidence'; id: string }
  | { type: 'logBalance'; balance: Omit<Balance, 'id'> }
  | { type: 'dropBalance'; id: string }
  | { type: 'setTermDate'; id: string; iso: string; until?: string }
  | { type: 'addTermDate'; label: string; iso: string; until?: string }
  | { type: 'dropTermDate'; id: string }
  | { type: 'applyRegistrar'; found: Found[] }
  | { type: 'setSample'; on: boolean }
  | { type: 'setTerm'; term: string }
  /** Point the open course and guide at something this catalogue holds. */
  | { type: 'settleCourse'; guideId?: CourseId; courseId?: CourseId }
  | { type: 'removalsPushed'; ids: CourseId[] }
  | { type: 'hydrate'; persisted: Partial<Persisted> };

export const ROOTS: Screen[] = ['home', 'courses', 'study', 'calendar', 'mine', 'me'];
