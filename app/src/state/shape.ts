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
  ChangeSource,
  CoursesTab,
  CourseId,
  CourseModule,
  CourseUpdate,
  FeedEvent,
  FeedSource,
  NavMode,
  Note,
  PersonalTask,
  ReportGrain,
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
import { readTone, type Tone } from '../lib/tone';
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
import { navOf, readLook, type Look } from '../lib/look';
import { readStarted } from '../lib/underway';
import { SCHEMA, migrate, type Migrated } from '../lib/migrate';
import { readOverrides, type GradeSystem } from '../lib/cutoffs';
import { readPretested } from '../lib/pretest';
import type { PostMortem } from '../lib/postmortem';
import { NOTHING_WANTED, readWanted, type Wanted } from '../lib/suggest';
import { readLastSync, type MergeNote } from '../lib/merge';
import { readSchool, type School } from '../lib/school';
import { list, readList, readModule, readWindow, record } from '../lib/stored';

/**
 * What the last load's migration did, for the diagnostics dump.
 *
 * A module-level note rather than state: nothing renders it, and it is about
 * this boot rather than about the semester.
 */
let lastMigration: Migrated | null = null;

export function migrationReport(): Migrated | null {
  return lastMigration;
}

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
   * The grading cutoffs a course uses, where its syllabus differs.
   *
   * Keyed by course id. Empty is the normal state: the app then reads the
   * school's published scale, and where the school has not published one it
   * shows the common American table and says on the screen that it is
   * assuming. Professors deviate from their own university often enough that
   * a per-course override is the level this belongs at. See `lib/cutoffs.ts`.
   */
  gradeSystems: Record<string, GradeSystem>;
  /**
   * Schools somebody added because the app did not have theirs.
   *
   * Local, unverified, and searched alongside the bundled ones. The app knows
   * one university properly and will never know all of them; a school profile
   * is a handful of names, links and yes/no answers, so the person who knows
   * the answers fills them in. See `lib/findschool.ts`.
   */
  mySchools: School[];
  /**
   * Whether the app keeps a count of which screens get opened.
   *
   * On by default and switchable off. The counts themselves are not in here —
   * they live in their own storage key, outside everything that syncs, which
   * is the whole point of them. See `lib/usage.ts`. This flag is a choice
   * about the person rather than the device, so it follows them.
   */
  countScreens: boolean;
  /**
   * Units somebody has guessed at before reading, and when.
   *
   * Keyed `courseId:unit`. The *only* thing a pretest records: guesses
   * themselves are never scored, because being wrong is the mechanism and
   * nothing may punish it. See `lib/pretest.ts`.
   */
  pretested: Record<string, number>;
  /**
   * What to suggest from the shipped list of programmes, and what not to.
   *
   * Empty in every field is the honest starting state and shows everything
   * opening soon. See `lib/suggest.ts` — none of this produces a deadline;
   * it only decides what is worth hearing about.
   */
  wanted: Wanted;
  /**
   * Terms that have been closed out.
   *
   * The only new state a term rollover needs. Terms themselves are derived
   * from the courses rather than stored — a course has carried `course.term`
   * since terms existed — so there is nothing to migrate, and an empty list
   * here is exactly what every store written before this already meant. See
   * `lib/rollover.ts`.
   */
  archivedTerms: string[];
  /**
   * What the last sync did, so it can be said rather than guessed at.
   *
   * `mine` rather than the `latest` the plan named: what this device last
   * merged is a fact about this device, and `latest` expects a map of records
   * carrying their own timestamps, which this is not — it would have compared
   * `at` against `notes` and produced nonsense. See `lib/merge.ts`.
   */
  lastSync: { at: number; notes: MergeNote[]; told?: boolean } | null;
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
  /**
   * What an exam covers, in your words, keyed by the deadline's id.
   *
   * Free text — "units 1 to 8", "5-9", "all" — rather than a pair of numbers,
   * because what persists is what you typed, and because the same reader in
   * `lib/covers.ts` then handles the syllabus's phrasing and yours. Absent
   * means nobody has said, which is a different thing from "everything" and
   * the runway says which of the two it is looking at.
   */
  examCovers: Record<string, string>;
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
   * When each screen was last opened, to the day.
   *
   * `visited` answers "ever?" and that is all the app needed until the
   * Everything directory wanted to say "three weeks ago" beside a row and to
   * separate a screen nobody has opened from one abandoned in September.
   *
   * To the day, and not to the second, deliberately. The finer number is a
   * record of somebody's evenings that no screen has a use for, and rounding
   * it is the difference between a directory that knows what you have tried
   * and a log of when you were awake. It never leaves the device — the same
   * as everything else here — but that is not a reason to keep more of it
   * than the feature needs.
   */
  lastOpened: Record<string, number>;
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
  /**
   * How the app phrases what it tells you. See `lib/tone.ts`.
   *
   * Saved and synced like any other preference. The figures are identical in
   * all three tones — only the words around them change — so this can never
   * make the app less accurate, only easier or harder to read at 1am.
   */
  tone: Tone;
  badges: string;
  feed: string;
  /**
   * `on` or `off`. Whether each course is drawn in its own turn of the accent.
   *
   * Part of the look and stored with it, so it syncs with the account and
   * survives a reinstall like every other appearance choice. The colours it
   * decides are `lib/tint.ts`.
   */
  courseColours: string;
  /** `plain`, `grouped` or `soft`. Which layout every screen is drawn in. */
  shell: string;
  /**
   * `list` or `tiles`. How the directory of everything is drawn.
   *
   * Empty is the third state and the one that matters: nobody has chosen, so
   * the layout answers — see `directoryOf` in `lib/look.ts`. Read it through
   * that function rather than directly, or a soft account that has never
   * opened this setting gets the list the empty string sorts to.
   */
  directory: string;
  /**
   * How the tiles inside each shelf are arranged, where somebody has said.
   *
   * A look key like the rest of these, flat on the state like the rest of
   * them, and serialised because that is what a look key holds — see
   * `lib/launcher.ts`, which owns the format.
   */
  groupOrder: string;
  /**
   * How the home screen's icons are arranged, where somebody has moved one.
   *
   * The same kind of key, owned by `lib/springboard.ts`. Separate from
   * `groupOrder` because they arrange different things — shelves of screens
   * against pages of icons — and one string holding both would make a shelf
   * called `dock` a real possibility.
   */
  boardOrder: string;
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
  /**
   * Whether the calendar's colour key is unrolled.
   *
   * Closed to begin with, and it persists. The key explains eleven marks —
   * four courses and seven kinds — which on a phone is two or three lines
   * above the grid, every time you open the calendar, forever. It is read
   * once or twice while the colours are being learned and then never again,
   * so it folds to one line and stays where you left it. See
   * `components/KindKey.tsx`.
   */
  keyOpen: boolean;
  done: Record<string, boolean>;
  saved: Record<string, boolean>;
  notifs: Record<NotifKey, boolean>;
  picked: Record<string, boolean>;
  seenOnboarding: boolean;
  /**
   * Whether an account has ever been made or signed into on this device.
   *
   * Not a session and not a claim about being signed in — `store.account` is
   * that, and it is deliberately not persisted. This is the one bit the sign-in
   * form needs and cannot ask anybody for: whether the person in front of it
   * has an account yet. Without it the form has to guess, and a form that opens
   * on "sign in" for somebody who has never registered is a wall with no door
   * in it.
   *
   * It only ever goes from false to true. Signing out does not un-make the
   * account, so it does not clear this either.
   */
  registered: boolean;
  /**
   * Which university, as an id rather than a name.
   *
   * Empty is a normal state, not an error: it means the universal eighty per
   * cent of the app, which is most of it. See `lib/school.ts` — no screen ever
   * asks which school this is, only what the school has.
   */
  schoolId: string;
  /**
   * Whether the directory lists every screen, or only what is useful yet.
   *
   * Default is to reveal as you go — see `lib/reveal.ts`. A screen you have
   * opened never goes back, and search finds everything either way, so this is
   * about a first morning rather than about permanently hiding anything.
   */
  showAll: boolean;
  /** The shape this copy was written in. See `lib/migrate.ts`. */
  schemaVersion: number;
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
  /**
   * Which grain the report screen is showing — the day, the week, the term.
   *
   * A field rather than the screen's own state because it is addressed from
   * outside: a Sunday reminder opens the week, and the day report's "this
   * week" row switches grain rather than navigating. Not persisted, for the
   * same reason `calView` is not — coming back tomorrow should open today.
   */
  report: ReportGrain;
  /**
   * Which post a change arrived in — an email, or a calendar.
   *
   * A field for the same reason the report's grain is one: the two used to be
   * two screens, so the links that pointed at "Check the dates" have to be
   * able to land on that half rather than on the other one.
   */
  changes: ChangeSource;
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
  mineTab: 'tasks' | 'appointments' | 'notes' | 'files';
  homeTab: 'today' | 'hours' | 'week' | 'done';
  coursesTab: CoursesTab;
  /** Me follows the same shape as every other tab: a switcher, then one view. */
  meTab: 'you' | 'all' | 'task';
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
  mailSeed: {
    purposeId: string;
    courseId: CourseId | '';
    to: string;
    incoming: string;
    /** The deadline the email is about, when it was opened from one. */
    itemId: string;
  } | null;
  /**
   * Whether the search overlay is up.
   *
   * Ephemeral, and deliberately: an app that reopens a search box because you
   * had one open yesterday is an app that has misread what a search is for.
   */
  finder: boolean;
  studyTab: 'guides' | 'revise' | 'ask';
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
  /**
   * Whether a drill mixes courses instead of running one at a time.
   *
   * Ephemeral: it is a choice about the run you are about to do, and a setting
   * that persisted would silently change what "Drill" means weeks later. See
   * `lib/interleave.ts`.
   */
  drillMix: boolean;
  drillIdx: number;
  drillGot: number;
  revealed: boolean;
  /**
   * One sentence for the app's live region, or empty.
   *
   * Ephemeral, and set only for outcomes somebody would otherwise have to look
   * at the screen to confirm: a card marked, an absence recorded, a course
   * imported, a sync finished. Not for edits — a grade field that saves on
   * every keystroke has no outcome to announce, only typing.
   *
   * Carries a `saidAt` so two identical announcements in a row are still two
   * announcements. A live region ignores a text node that has not changed.
   */
  said: string;
  saidAt: number;
  /**
   * The screen the last announcement is about, where there is one.
   *
   * So the change strip can be tapped through to the record it names — "moved
   * to Friday" is worth a good deal more when the thing that moved is one tap
   * away. Optional because most outcomes are already on the screen you are
   * looking at, and a strip that navigates somewhere you already are is a
   * strip that punishes you for reading it.
   */
  saidTo: Screen | null;
  /** The unit a guess-first run is on, and how far through it is. */
  guessUnit: number;
  guessIdx: number;
  guessRight: number;
  guessSaid: boolean;
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
  registered: false,
  // Vanderbilt by default, because that is who this was built for and a fresh
  // install should be the app they already have. Changed in Settings.
  schoolId: 'vanderbilt',
  showAll: false,
  schemaVersion: SCHEMA,
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
  /**
   * A fresh install opens with the semester in it.
   *
   * This was `false`, on the reasoning that nobody's first impression should
   * be somebody else's timetable. That reasoning is sound and the consequence
   * was not: a genuinely new install — a cleared browser, a second device, a
   * private window — opened completely empty, with four courses' worth of
   * readings, dates and cards sitting in the build and nothing on screen.
   *
   * It is also wrong for the person this was written for, whose real Fall 2026
   * *is* those four courses. For them an empty first run is not a clean slate,
   * it is their semester missing.
   *
   * The banner is what makes this safe rather than presumptuous: it says
   * where the courses came from and offers both answers — take them on, or
   * remove them. See `components/SampleMark.tsx`.
   */
  sample: true,
  term: LEGACY_TERM,
  waysOpen: true,
  keyOpen: false,
  reviews: {},
  grades: {},
  gradeSystems: {},
  mySchools: [],
  countScreens: true,
  pretested: {},
  wanted: NOTHING_WANTED,
  archivedTerms: [],
  lastSync: null,
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
  lastOpened: {},
  yours: {},
  courseOrder: [],
  myRules: [],
  myName: '',
  attendance: [],
  attendPolicy: {},
  pieces: {},
  drops: {},
  examCovers: {},
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
  tone: 'direct',
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
  courseColours: 'on',
  shell: 'plain',
  // Not `list`. Writing a default in here made "never chosen" unreachable —
  // the first save stamped `list` on everybody, and `directoryOf`'s soft
  // fallback could never fire again for anyone who had opened the app once.
  directory: '',
  groupOrder: '',
  boardOrder: '',
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
    courseColours: state.courseColours,
    shell: state.shell,
    directory: state.directory,
    groupOrder: state.groupOrder,
    boardOrder: state.boardOrder,
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
    report: 'day',
    changes: 'told',
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
    finder: false,
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
    drillMix: false,
    drillIdx: 0,
    drillGot: 0,
    revealed: false,
    said: '',
    saidTo: null,
    saidAt: 0,
    guessUnit: 0,
    guessIdx: 0,
    guessRight: 0,
    guessSaid: false,
    quiz: [],
    quizIdx: 0,
    quizPicked: null,
    quizScore: 0,
    quizSeed: 1,
    removedCourses: [],
  };
}

/**
 * What the database read at boot, if it read anything.
 *
 * `loadPersisted` is called synchronously by the reducer's initialiser, and
 * IndexedDB cannot answer synchronously. So the boot in `main.tsx` reads it
 * first, leaves the answer here, and the initialiser finds it already waiting.
 * Nothing about the shape of what is returned changes; only where it came
 * from. See `state/persist/`.
 */
let primed: Persisted | null = null;

export function primePersisted(state: Persisted | null): void {
  primed = state;
}

/*
 * The two readers every list and record on this screen's state goes through
 * are `list` and `record` in `lib/stored.ts`, imported above.
 *
 * They used to live here, and the file they live in now is the one written
 * about this exact bug one layer down — so keeping a second copy here meant
 * the rule was stated twice and applied at one door out of three. A backup
 * somebody opens and a sync from another device never touch `loadPersisted`
 * at all; they arrive through `readIncoming`, which is where the rule had to
 * be if it was going to be the rule.
 *
 * What they do, and why, is written over each of them there.
 */

export function loadPersisted(): Persisted {
  if (primed) return primed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PERSISTED };
    /*
     * Through the migration before anything reads a field.
     *
     * While this app had one user a shape change was free — change the code,
     * clear the storage if it looks wrong. It stops being free the moment
     * somebody else has a semester in here, written by whichever build they
     * last opened. See `lib/migrate.ts`; a copy newer than this build knows
     * about is deliberately left alone rather than walked backwards.
     */
    const moved = migrate(JSON.parse(raw));
    lastMigration = moved;
    const saved = moved.state as Partial<Persisted>;
    return {
      ...DEFAULT_PERSISTED,
      ...saved,
      notifs: { ...DEFAULT_PERSISTED.notifs, ...record(saved.notifs) },
      done: record(saved.done),
      saved: record(saved.saved ?? DEFAULT_PERSISTED.saved),
      picked: { ...DEFAULT_PERSISTED.picked, ...record(saved.picked) },
      tasks: list(saved.tasks),
      appointments: list(saved.appointments),
      notes: list(saved.notes),
      updates: list(saved.updates),
      feeds: list(saved.feeds),
      feedEvents: list(saved.feedEvents),
      linkUrls: record(saved.linkUrls),
      extraLinks: list(saved.extraLinks),
      // Not `list()`: that checks the list is a list and casts what is in it.
      // The catalogue is built from these before any screen is drawn, so there
      // is no error boundary between a damaged course and a blank document.
      // See `lib/stored.ts`.
      courses: readList(saved.courses, readModule),
      // An install that predates courses-as-data was running the four built-in
      // ones; it keeps them, or the app would look wiped on the next load. A
      // genuinely new account starts empty.
      sample: saved.sample ?? saved.courses === undefined,
      /*
       * A term id names a term; anything else is not one.
       *
       * `?? LEGACY_TERM` catches null and undefined only, so a term that came
       * back as an array or an object went into the app as the id of the term
       * being shown, and the first lookup on it threw
       * `(id ?? "").trim is not a function` — before a screen, so blank, and
       * on every reload, because the id that kills it is the id being read.
       */
      term: typeof saved.term === 'string' ? saved.term : LEGACY_TERM,
      waysOpen: saved.waysOpen ?? true,
      keyOpen: saved.keyOpen ?? false,
      reviews: record(saved.reviews),
      grades: record(saved.grades),
      gradeSystems: readOverrides(saved.gradeSystems),
      mySchools: Array.isArray(saved.mySchools)
        ? saved.mySchools.map(readSchool).filter((s) => s.id && s.name)
        : [],
      countScreens: saved.countScreens !== false,
      pretested: readPretested(saved.pretested),
      wanted: readWanted(saved.wanted),
      archivedTerms: Array.isArray(saved.archivedTerms)
        ? saved.archivedTerms.filter((t): t is string => typeof t === 'string')
        : [],
      lastSync: readLastSync(saved.lastSync),
      places: list(saved.places),
      commitments: list(saved.commitments),
      timers: list(saved.timers),
      alarms: list(saved.alarms),
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
      // Not `?? DEFAULT_ORDER`: that catches a missing order and passes a
      // corrupted one straight through. `ordered` drops what it does not
      // know and appends what is missing, so an empty list becomes the
      // default anyway — see `lib/feed.ts`.
      feedOrder: Array.isArray(saved.feedOrder) ? saved.feedOrder : DEFAULT_ORDER,
      feedHidden: saved.feedHidden ?? {},
      // Not `?? DEFAULT_TABS`: a stored list can be stale, duplicated by a
      // sync, or one entry long, and any of those renders a broken bar.
      tabs: readTabs(saved.tabs),
      /*
       * Read back through `navOf` for the same reason the tabs are.
       *
       * The navigation used to come out of storage untouched, and every place
       * that draws chrome asks it by name — `nav === 'tabs'`, `=== 'feed'`,
       * and so on. A value none of them matches is not a fallback to the
       * default, it is *no navigation at all*: no bar, no rail, no pills, and
       * on a phone no way off the screen you happen to be on. A stale build,
       * a half-applied sync or a hand-edited key is enough to produce one.
       * `navOf` turns anything it does not recognise back into the bar.
       */
      nav: navOf(typeof saved.nav === 'string' ? saved.nav : undefined),
      tone: readTone(saved.tone),
      yours: saved.yours ?? {},
      myRules: readRules(saved.myRules),
      myName: typeof saved.myName === 'string' ? saved.myName : '',
      attendance: readLog(saved.attendance),
      attendPolicy: Object.fromEntries(
        Object.entries(saved.attendPolicy ?? {}).map(([k, v]) => [k, readPolicy(v)]),
      ),
      pieces: saved.pieces ?? {},
      examCovers: Object.fromEntries(
        Object.entries(saved.examCovers ?? {})
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k, String(v).slice(0, 80)]),
      ),
      dayBudget:
        typeof saved.dayBudget === 'number' && saved.dayBudget > 0 && saved.dayBudget <= 16
          ? saved.dayBudget
          : DEFAULT_BUDGET,
      drops: Object.fromEntries(
        Object.entries(saved.drops ?? {}).map(([k, v]) => [k, readDrop(v)]),
      ),
      courseOrder: list(saved.courseOrder),
      recent: list(saved.recent),
      // Seeded from `recent` for anybody upgrading: without this the app
      // would tell somebody who has used it all term that they have never
      // opened Today, which is both wrong and the sort of wrong that makes
      // the rest of the sentence untrustworthy.
      visited:
        saved.visited ??
        Object.fromEntries(list<Screen>(saved.recent).map((s) => [s, true])),
      // No seeding from `recent`, unlike `visited` above: `recent` carries no
      // times, so any date invented here would be today's, and "opened
      // today" beside a screen somebody last saw in August is worse than
      // "opened at some point", which is what an empty entry says.
      lastOpened: saved.lastOpened ?? {},
      sittings: list(saved.sittings),
      sources: list(saved.sources),
      registrar: list(saved.registrar),
      spent: list(saved.spent),
      windows: readList(saved.windows, readWindow),
      costs: list(saved.costs),
      balances: list(saved.balances),
      residences: list(saved.residences),
      accessLeadDays: saved.accessLeadDays ?? 0,
      tickedAt: saved.tickedAt ?? {},
      started: readStarted(saved.started),
      schoolId: typeof saved.schoolId === 'string' ? saved.schoolId : DEFAULT_PERSISTED.schoolId,
      showAll: saved.showAll === true,
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
    tone: state.tone,
    done: state.done,
    saved: state.saved,
    notifs: state.notifs,
    picked: state.picked,
    seenOnboarding: state.seenOnboarding,
    registered: state.registered,
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
    keyOpen: state.keyOpen,
    reviews: state.reviews,
    grades: state.grades,
    gradeSystems: state.gradeSystems,
    mySchools: state.mySchools,
    countScreens: state.countScreens,
    pretested: state.pretested,
    wanted: state.wanted,
    archivedTerms: state.archivedTerms,
    lastSync: state.lastSync,
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
    examCovers: state.examCovers,
    courseOrder: state.courseOrder,
    feedHidden: state.feedHidden,
    recent: state.recent,
    visited: state.visited,
    lastOpened: state.lastOpened,
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
    schoolId: state.schoolId,
    showAll: state.showAll,
    // Stamped on the way out, so the next build to read this knows what shape
    // it is in without having to guess from which fields are present.
    schemaVersion: SCHEMA,
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
    courseColours: state.courseColours,
    shell: state.shell,
    directory: state.directory,
    groupOrder: state.groupOrder,
    boardOrder: state.boardOrder,
    hue: state.hue,
  };
}

export type Action =
  /**
   * Go to a screen.
   *
   * `courseId` is optional and sets which course the screen opens on — every
   * course-bound tool (the paper, the solver, the deck, the diagram, the
   * runway, the breakdown) reads `guideId`, so a tool suggested *because* of
   * one course's deadline can arrive on that course instead of on whichever
   * guide was last looked at. It sets `guideId` only; `courseId`, which is the
   * course *page*, is not a tool's idea of where it is.
   */
  | { type: 'go'; screen: Screen; courseId?: CourseId }
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
  | { type: 'toggleKey' }
  | { type: 'setGrade'; key: string; value: string }
  // `system` null clears the override, so a course falls back to the school's
  // scale rather than being stuck with a corrected one forever.
  | { type: 'setCutoffs'; courseId: string; system: GradeSystem | null }
  // Adds the school and selects it in one action: nobody fills in that form
  // and then wants to be handed a list to pick from.
  | { type: 'addSchool'; school: School }
  | { type: 'forgetSchool'; id: string }
  | { type: 'countScreens'; on: boolean }
  // Opens a guess-first run on one unit. `at` is passed in rather than read
  // from Date.now() inside the reducer, like every other timestamped action.
  | { type: 'guessFirst'; courseId: string; unit: number }
  // `to` widens the existing action rather than adding a second one: the
  // strip and the live region are one announcement, and two actions would be
  // two things to keep in step. See `components/Said.tsx`.
  | { type: 'say'; said: string; at: number; to?: Screen }
  // The change strip's clock, run the way the undo toast's is: the component
  // sets a timeout and dispatches this, so what is on screen stays a fact
  // about the state rather than a boolean hidden inside a component.
  | { type: 'forgetSaid' }
  | { type: 'forgetSyncNote' }
  | { type: 'setWanted'; patch: Partial<Wanted> }
  | { type: 'dismissProgramme'; id: string }
  // Closes a term: files its courses into the record, marks it archived, and
  // moves to the next one. `taken` is built by the screen, which has the
  // catalogue and the typed grades; the reducer has neither.
  | { type: 'closeTerm'; term: string; taken: Taken[]; next: string }
  | { type: 'postMortem'; id: string; mortem: PostMortem; keys: string[] }
  | { type: 'guessShow' }
  | { type: 'guessNext'; right: boolean }
  | { type: 'guessDone'; courseId: string; unit: number; at: number }
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
  | { type: 'finder'; open: boolean }
  | { type: 'setFeedOrder'; order: string[] }
  | { type: 'setTabs'; tabs: Screen[] }
  | { type: 'setYours'; yours: YoursBy }
  | { type: 'setMyRules'; rules: MyRule[] }
  | { type: 'setMyName'; name: string }
  | { type: 'markAttendance'; courseId: CourseId; date: string; mark: Attended['mark'] | null }
  | { type: 'setAttendPolicy'; courseId: CourseId; policy: AttendPolicy }
  | { type: 'setPieces'; key: string; text: string }
  | { type: 'setExamCovers'; id: string; text: string }
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
  | { type: 'setSchool'; id: string }
  | { type: 'showEverything'; on: boolean }
  | { type: 'mixCourses'; on: boolean }
  /**
   * Clear this device's own rows so the account's copy is what is left.
   *
   * Only ever dispatched by the first-sign-in chooser, and only for the option
   * that says out loud that it replaces what is here — with a backup file
   * written first. See `lib/adopt.ts`. It clears the coursework and leaves the
   * settings, because "use the account's semester" is not a request to have
   * your colours changed.
   */
  | { type: 'wipeLocalForAdopt' }
  /**
   * An account was made, or signed into, on this device.
   *
   * Idempotent and one-way: it is dispatched by the credentials form the
   * moment either call comes back without an error, and again by the store
   * when a session arrives from anywhere else — the OAuth round trip, or a
   * confirmation link opened in another tab.
   */
  | { type: 'registered' }
  | { type: 'onbNext' }
  | { type: 'restartOnboarding' }
  | { type: 'finishOnboarding' }
  | { type: 'setLoadStep'; step: number }
  /**
   * Start a run of cards.
   *
   * `courseId` is optional and means what it says: drill *that* course's unit,
   * rather than whichever guide happens to be open. Revise ranks units across
   * the whole catalogue, so the course it wants is usually not the one last
   * looked at — without this it had to open the guide first and the student
   * arrived at a screen they did not ask for on the way to the cards.
   */
  | { type: 'startDrill'; unit: number | null; courseId?: CourseId }
  | { type: 'flip' }
  | { type: 'markCard'; got: boolean; key: string; sure?: Sure; courseId?: string }
  /** An answer recorded against a card, with no drill run around it. */
  | { type: 'recordCard'; got: boolean; key: string }
  | { type: 'redrill' }
  | { type: 'startQuiz'; quiz: QuizQuestion[] }
  | { type: 'pickAnswer'; index: number }
  | { type: 'nextQuestion' }
  | { type: 'setCalView'; view: 'day' | 'week' | 'month' | 'semester' }
  | { type: 'setReport'; grain: ReportGrain }
  | { type: 'setChanges'; source: ChangeSource }
  /*
   * The three things a drag on the calendar can move, one action each.
   *
   * Not `editTask` with a date in it: an edit is undoable by editing it back,
   * which is why `lib/undo.ts` leaves edits alone — but a drag is a change
   * whose *previous* value is exactly what nobody remembers. So a move is its
   * own action, and its own action is what the undo table can name.
   */
  | { type: 'moveTask'; id: string; date: string; time?: string }
  | { type: 'moveAppointment'; id: string; date: string; at: number; time: string }
  | { type: 'moveItem'; courseId: CourseId; itemId: string; month: number; day: number; year: number }
  | { type: 'setCalSource'; source: 'all' | 'classes' | 'deadlines' | 'campus' }
  | { type: 'setCalDay'; date: string | null }
  | { type: 'stepDay'; delta: number }
  | { type: 'setMineTab'; tab: 'tasks' | 'appointments' | 'notes' | 'files' }
  | { type: 'setHomeTab'; tab: 'today' | 'hours' | 'week' | 'done' }
  | { type: 'setCoursesTab'; tab: CoursesTab }
  | { type: 'setMeTab'; tab: 'you' | 'all' | 'task' }
  | { type: 'setMeGroup'; group: string }
  | { type: 'setTone'; tone: Tone }
  /**
   * Take the shipped semester on as your own courses.
   *
   * Carries the modules because the seed is loaded lazily in the store and the
   * reducer has no way to reach it.
   */
  | { type: 'adoptSeed'; modules: CourseModule[] }
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
      itemId?: string;
      to?: string;
      incoming?: string;
    }
  | { type: 'setStudyTab'; tab: 'guides' | 'revise' | 'ask' }
  | { type: 'addTask'; task: Omit<PersonalTask, 'id' | 'created' | 'done'> }
  /**
   * Change a task after it exists.
   *
   * A task could be added, ticked and deleted, and nothing else — so a date
   * typed wrong, a paper that moved a week, or a step in a plan that needs to
   * land on a different evening all had the same remedy: delete it and type it
   * again, losing whether it was done and when it was made. Everything else
   * the app holds has been editable since it existed; this was the one thing
   * that was not.
   */
  | { type: 'editTask'; id: string; patch: Partial<Omit<PersonalTask, 'id' | 'created'>> }
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
  | { type: 'hydrate'; persisted: Partial<Persisted>; at?: number }
  | { type: 'restore'; persisted: Partial<Persisted> }
  /**
   * The browser moved, so the app follows.
   *
   * Distinct from `go` because `go` pushes a history entry and this one is
   * the answer to somebody having already used one. Dispatching `go` here
   * would push an entry for the entry they just went back past, and Back
   * would stop working the second time. See `lib/route.ts`.
   */
  | { type: 'landed'; screen: Screen; id?: string; mode?: StudyMode };

export const ROOTS: Screen[] = ['home', 'courses', 'study', 'calendar', 'mine', 'me'];
