import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { buildCatalog, type Catalog } from '../data/catalog';
import { setSessionToken } from '../lib/claude';
import {
  accountOf,
  cloudConfigured,
  currentSession,
  onAuthChange,
  explainSyncError,
  pull,
  push as pushCloud,
  type Account,
} from '../lib/cloud';
import type { Session } from '@supabase/supabase-js';
import { loadSeed } from '../data/seed';
import { newId } from '../lib/files';
import { dueReminders, fire } from '../lib/notify';
import { datedItems, railFor } from '../lib/select';
import { score, type Reviews } from '../lib/review';
import type { SavedPlace } from '../lib/place';
import type { Commitment } from '../lib/activities';
import { DEFAULT_ORDER } from '../lib/feed';
import { readLook, type Look } from '../lib/look';
import { save, trouble } from '../lib/keep';
import { mergePersisted } from '../lib/merge';
import type { Sitting } from '../lib/sitting';
import type { NewSource, Source } from '../lib/sources';
import { dateToIso, isoToDate } from '../lib/date';

/**
 * The prototype held everything in one component's state and lost it on reload.
 * Here the same shape is split in two: `persisted` is the handful of things a
 * real app has to remember between sessions — what you have ticked off, what
 * you have saved, how you like the app set up — and everything else is
 * ephemeral navigation state that should reset.
 */
interface Persisted {
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
  /** The order of the sections on Today, and which are switched off. */
  feedOrder: string[];
  feedHidden: Record<string, boolean>;
  /** The destinations you opened most recently, newest first. */
  recent: Screen[];
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
  typeface: string;
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
  /** Addresses for the campus links, keyed by id. Yours beat the defaults. */
  linkUrls: Record<string, string>;
  /** Links you added yourself, alongside the campus ones. */
  extraLinks: CampusLink[];
}

interface Ephemeral {
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
  dueTab: 'ahead' | 'overdue' | 'done';
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

const STORAGE_KEY = 'semester.v1';
/** When this device last agreed with the account copy, as epoch ms. */
const SYNCED_KEY = 'semester.synced';

const DEFAULT_PERSISTED: Persisted = {
  nav: 'tabs',
  done: {},
  saved: { e1: true, e16: true },
  notifs: { ...DEFAULT_NOTIFS },
  picked: EXTRACT.reduce<Record<string, boolean>>((a, x) => {
    a[x.id] = true;
    return a;
  }, {}),
  seenOnboarding: false,
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
  waysOpen: true,
  reviews: {},
  grades: {},
  places: [],
  commitments: [],
  feedOrder: DEFAULT_ORDER,
  feedHidden: {},
  recent: [],
  sittings: [],
  sources: [],
  tickedAt: {},
  accent: 'sterling',
  textSize: 'normal',
  ground: 'ink',
  density: 'comfortable',
  corners: 'drawn',
  typeface: 'condensed',
};

/** The look, gathered off the state it is spread across. */
function currentLook(state: Persisted): Look {
  return {
    accent: state.accent,
    textSize: state.textSize,
    ground: state.ground,
    density: state.density,
    corners: state.corners,
    typeface: state.typeface,
  };
}

function initialEphemeral(now: Date): Ephemeral {
  return {
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

function loadPersisted(): Persisted {
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
    waysOpen: saved.waysOpen ?? true,
      reviews: saved.reviews ?? {},
      grades: saved.grades ?? {},
      places: saved.places ?? [],
      commitments: saved.commitments ?? [],
      feedOrder: saved.feedOrder ?? DEFAULT_ORDER,
      feedHidden: saved.feedHidden ?? {},
      recent: saved.recent ?? [],
      sittings: saved.sittings ?? [],
      sources: saved.sources ?? [],
      tickedAt: saved.tickedAt ?? {},
      ...readLook({
        accent: saved.accent,
        textSize: saved.textSize,
        ground: saved.ground,
        density: saved.density,
        corners: saved.corners,
        typeface: saved.typeface,
      }),
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
    waysOpen: state.waysOpen,
    reviews: state.reviews,
    grades: state.grades,
    places: state.places,
    commitments: state.commitments,
    feedOrder: state.feedOrder,
    feedHidden: state.feedHidden,
    recent: state.recent,
    sittings: state.sittings,
    sources: state.sources,
    tickedAt: state.tickedAt,
    accent: state.accent,
    textSize: state.textSize,
    ground: state.ground,
    density: state.density,
    corners: state.corners,
    typeface: state.typeface,
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
  | { type: 'setFeedOrder'; order: string[] }
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
  | { type: 'onbNext' }
  | { type: 'restartOnboarding' }
  | { type: 'finishOnboarding' }
  | { type: 'setLoadStep'; step: number }
  | { type: 'startDrill'; unit: number | null }
  | { type: 'flip' }
  | { type: 'markCard'; got: boolean; key: string }
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
  | { type: 'setDueTab'; tab: 'ahead' | 'overdue' | 'done' }
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
  | { type: 'setSample'; on: boolean }
  | { type: 'removalsPushed'; ids: CourseId[] }
  | { type: 'hydrate'; persisted: Partial<Persisted> };

const ROOTS: Screen[] = ['home', 'courses', 'study', 'calendar', 'mine', 'me'];

/**
 * An installed app's shortcuts open `?screen=study` and the like. Only the
 * roots are addressable — a deep link into a drill would land somewhere with
 * no way back.
 */
function screenFromUrl(): Screen | null {
  try {
    const asked = new URLSearchParams(window.location.search).get('screen') as Screen | null;
    return asked && ROOTS.includes(asked) ? asked : null;
  } catch {
    return null;
  }
}

/**
 * Where you have been lately, for the top of the directory.
 *
 * Kept here rather than in the Me screen because `push` is the one funnel
 * every route in the app goes through — a list built anywhere else would miss
 * whichever way somebody actually got there. Screens are filtered to real
 * destinations at render time rather than on the way in, so the list follows
 * the directory when the directory changes instead of holding ids that no
 * longer mean anything.
 */
function remember(recent: Screen[], screen: Screen): Screen[] {
  return [screen, ...recent.filter((s) => s !== screen)].slice(0, 12);
}

function push(state: State, screen: Screen): State {
  if (screen === state.screen) return state;
  // In tab mode a root screen is a destination, so the back stack resets. In
  // feed mode there is no tab bar, so every screen except the feed itself has
  // to stay reachable backwards or it becomes a dead end.
  const resets = ROOTS.includes(screen) && (state.nav === 'tabs' || screen === 'home');
  const history = resets ? [] : [...state.history, state.screen];
  return { ...state, screen, history, recent: remember(state.recent, screen) };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return push(state, action.screen);

    case 'back': {
      const history = [...state.history];
      const prev = history.pop();
      return { ...state, screen: prev ?? 'home', history };
    }

    case 'openItem':
      return push({ ...state, itemId: action.id }, 'item');

    case 'openCourse':
      return push({ ...state, courseId: action.id }, 'course');

    case 'openEvent':
      return push({ ...state, eventId: action.id }, 'event');

    case 'openGuide':
      return push(
        {
          ...state,
          guideId: action.id,
          mode: action.mode ?? state.mode,
          // Search can name a unit, and landing on the guide with it already
          // open is the difference between finding it and looking for it again.
          openUnit: action.unit ?? 0,
          episodeId: null,
        },
        'guide',
      );

    case 'setMode':
      return { ...state, mode: action.mode };

    case 'addPlace':
      return {
        ...state,
        places: [...state.places, { ...action.place, id: newId(), created: Date.now() }],
      };

    case 'removePlace':
      return { ...state, places: state.places.filter((p) => p.id !== action.id) };

    case 'addCommitment':
      return {
        ...state,
        commitments: [
          ...state.commitments,
          { ...action.commitment, id: newId(), created: Date.now() },
        ],
      };

    case 'patchCommitment':
      return {
        ...state,
        commitments: state.commitments.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };

    case 'removeCommitment':
      return { ...state, commitments: state.commitments.filter((c) => c.id !== action.id) };

    case 'setFeedOrder':
      return { ...state, feedOrder: action.order };

    case 'toggleFeedSection':
      return {
        ...state,
        feedHidden: { ...state.feedHidden, [action.id]: !state.feedHidden[action.id] },
      };

    case 'setLook':
      // Read back through readLook so an id the app does not know cannot be
      // stored — the fallback happens once, here, rather than on every render.
      return { ...state, ...readLook({ ...currentLook(state), ...action.look }) };

    case 'setGrade':
      return { ...state, grades: { ...state.grades, [action.key]: action.value } };

    case 'toggleWays':
      return { ...state, waysOpen: !state.waysOpen };

    case 'setEpisode':
      return { ...state, episodeId: action.id };

    case 'toggleDone': {
      const nowDone = !state.done[action.id];
      // When, as well as whether. Without this the weekly report can only
      // attribute a deadline to the week it was due in, which is wrong for
      // anything finished early or late — and it is the one figure in that
      // report better arithmetic could not have fixed.
      const tickedAt = { ...state.tickedAt };
      if (nowDone) tickedAt[action.id] = Date.now();
      else delete tickedAt[action.id];
      return { ...state, done: { ...state.done, [action.id]: nowDone }, tickedAt };
    }

    case 'toggleSaved':
      return { ...state, saved: { ...state.saved, [action.id]: !state.saved[action.id] } };

    case 'toggleNotif':
      return { ...state, notifs: { ...state.notifs, [action.k]: !state.notifs[action.k] } };

    case 'togglePick':
      return { ...state, picked: { ...state.picked, [action.id]: !state.picked[action.id] } };

    case 'setNav':
      return { ...state, nav: action.nav };

    case 'setFilter':
      return { ...state, filter: action.filter };

    case 'setEvFilter':
      return { ...state, evFilter: action.filter };

    case 'setCalTab':
      return { ...state, calTab: action.tab };

    case 'setQuery':
      return { ...state, query: action.query };

    case 'selectDate':
      return { ...state, selDate: action.date };

    case 'stepMonth': {
      const d = new Date(state.calYear, state.calMonth + action.delta, 1);
      return { ...state, calMonth: d.getMonth(), calYear: d.getFullYear(), selDate: null };
    }

    case 'toggleUnit':
      return { ...state, openUnit: state.openUnit === action.index ? -1 : action.index };

    case 'clearNotifs':
      return { ...state, cleared: true };

    case 'onbNext':
      return state.onb >= 2
        ? { ...state, screen: 'home', history: [], seenOnboarding: true, onb: 0 }
        : { ...state, onb: state.onb + 1 };

    case 'restartOnboarding':
      return { ...state, screen: 'onboarding', history: [], onb: 0 };

    case 'finishOnboarding':
      return { ...state, screen: 'home', history: [], seenOnboarding: true, onb: 0 };

    case 'setLoadStep':
      return { ...state, loadStep: action.step };

    case 'startDrill':
      return push(
        { ...state, drillUnit: action.unit, drillIdx: 0, drillGot: 0, revealed: false },
        'drill',
      );

    case 'flip':
      return { ...state, revealed: true };

    case 'markCard': {
      // The answer is recorded against the card, not just counted for this
      // run — which is the difference between a score and a study system.
      const now = Date.now();
      return {
        ...state,
        revealed: false,
        drillIdx: state.drillIdx + 1,
        drillGot: state.drillGot + (action.got ? 1 : 0),
        reviews: {
          ...state.reviews,
          [action.key]: score(state.reviews[action.key], action.got, now),
        },
      };
    }

    case 'redrill':
      return { ...state, drillIdx: 0, drillGot: 0, revealed: false };

    case 'startQuiz':
      return push(
        {
          ...state,
          quiz: action.quiz,
          quizIdx: 0,
          quizPicked: null,
          quizScore: 0,
          quizSeed: state.quizSeed + 7,
        },
        'quiz',
      );

    case 'pickAnswer': {
      if (state.quizPicked !== null) return state;
      const ok = state.quiz[state.quizIdx]?.opts[action.index]?.ok ?? false;
      return {
        ...state,
        quizPicked: action.index,
        quizScore: state.quizScore + (ok ? 1 : 0),
      };
    }

    case 'nextQuestion':
      return { ...state, quizIdx: state.quizIdx + 1, quizPicked: null };

    case 'setCalView':
      return { ...state, calView: action.view };

    case 'setCalSource':
      return { ...state, calSource: action.source };

    case 'setCalDay':
      return { ...state, calDay: action.date };

    case 'stepDay': {
      const base = state.calDay ? isoToDate(state.calDay) : new Date();
      base.setDate(base.getDate() + action.delta);
      return { ...state, calDay: dateToIso(base) };
    }

    case 'setHomeTab':
      return { ...state, homeTab: action.tab };

    case 'setCoursesTab':
      return { ...state, coursesTab: action.tab };

    case 'setMeGroup':
      return { ...state, meGroup: action.group };

    case 'keepSitting':
      return {
        ...state,
        sittings: [{ ...action.sitting, id: newId() }, ...state.sittings].slice(0, 40),
      };

    case 'dropSitting':
      return { ...state, sittings: state.sittings.filter((s) => s.id !== action.id) };

    case 'addSource':
      return {
        ...state,
        sources: [{ ...action.source, id: newId(), created: Date.now() }, ...state.sources],
      };

    case 'patchSource':
      return {
        ...state,
        sources: state.sources.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };

    case 'dropSource':
      return { ...state, sources: state.sources.filter((s) => s.id !== action.id) };

    case 'sitPaper':
      return push(
        { ...state, examPreset: { minutes: action.minutes, formatId: action.formatId, code: action.code } },
        'exam',
      );

    // Read once and dropped, so coming back to Exam later opens on your own
    // last choice rather than on whatever the quiz asked for an hour ago.
    case 'clearPaperPreset':
      return { ...state, examPreset: null };

    case 'writeRoomDraft':
      return { ...state, roomDraft: action.text };

    case 'clearRoomDraft':
      return { ...state, roomDraft: '' };

    case 'setMeTab':
      return { ...state, meTab: action.tab };

    case 'setDueTab':
      return { ...state, dueTab: action.tab };

    case 'writeMail':
      return {
        ...push(state, 'mail'),
        mailSeed: {
          purposeId: action.purposeId,
          courseId: action.courseId ?? '',
          to: action.to ?? '',
          incoming: action.incoming ?? '',
        },
      };

    case 'setStudyTab':
      return { ...state, studyTab: action.tab };

    case 'setMineTab':
      return { ...state, mineTab: action.tab };

    case 'addTask':
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { ...action.task, id: newId(), created: Date.now(), done: false },
        ],
      };

    case 'toggleTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };

    case 'deleteTask':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case 'addAppointment':
      return {
        ...state,
        appointments: [
          ...state.appointments,
          { ...action.appointment, id: newId(), created: Date.now() },
        ],
      };

    case 'setAppointmentKind':
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.id ? { ...a, kind: action.kind } : a,
        ),
      };

    case 'deleteAppointment':
      return {
        ...state,
        appointments: state.appointments.filter((a) => a.id !== action.id),
      };

    case 'newNote': {
      const note: Note = {
        id: newId(),
        title: '',
        body: '',
        created: Date.now(),
        updated: Date.now(),
        courseId: action.courseId,
        fileIds: [],
      };
      return push({ ...state, notes: [note, ...state.notes], noteId: note.id }, 'note');
    }

    case 'keepNote': {
      // Unlike newNote this does not navigate: it is used from screens where
      // you are mid-task and being thrown into an editor would lose your place.
      const note: Note = {
        id: newId(),
        title: action.title.trim() || 'Untitled',
        body: action.body,
        created: Date.now(),
        updated: Date.now(),
        courseId: action.courseId,
        fileIds: [],
      };
      return { ...state, notes: [note, ...state.notes] };
    }

    case 'openNote':
      return push({ ...state, noteId: action.id }, 'note');

    case 'updateNote':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, ...action.patch, updated: Date.now() } : n,
        ),
      };

    case 'attachFile':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId && !n.fileIds.includes(action.fileId)
            ? { ...n, fileIds: [...n.fileIds, action.fileId], updated: Date.now() }
            : n,
        ),
      };

    case 'detachFile':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.noteId
            ? { ...n, fileIds: n.fileIds.filter((f) => f !== action.fileId), updated: Date.now() }
            : n,
        ),
      };

    case 'deleteNote':
      return {
        ...state,
        notes: state.notes.filter((n) => n.id !== action.id),
        noteId: state.noteId === action.id ? null : state.noteId,
      };

    case 'openLesson':
      return push({ ...state, lessonUnit: action.unit }, 'lesson');

    case 'openDeck':
      return push({ ...state, lessonUnit: action.unit }, 'slides');

    case 'openUpdate':
      return push(
        {
          ...state,
          guideId: action.courseId,
          updateUnit: action.unit === undefined ? state.updateUnit : action.unit,
        },
        'update',
      );

    case 'addUpdate':
      return {
        ...state,
        updates: [...state.updates, { ...action.update, id: newId(), created: Date.now() }],
      };

    case 'deleteUpdate':
      return { ...state, updates: state.updates.filter((u) => u.id !== action.id) };

    case 'addFeed': {
      const feed: FeedSource = { ...action.feed, id: newId(), added: Date.now() };
      return {
        ...state,
        feeds: [...state.feeds, feed],
        // Events carry the feed they came from, so replacing a feed's events
        // never touches another's.
        feedEvents: [
          ...state.feedEvents,
          ...action.events.map((e) => ({ ...e, sourceId: feed.id })),
        ],
      };
    }

    case 'syncFeed':
      return {
        ...state,
        feeds: state.feeds.map((f) =>
          f.id === action.id
            ? { ...f, synced: Date.now(), status: action.status, count: action.events.length }
            : f,
        ),
        feedEvents: [
          ...state.feedEvents.filter((e) => e.sourceId !== action.id),
          ...action.events.map((e) => ({ ...e, sourceId: action.id })),
        ],
      };

    case 'failFeed':
      return {
        ...state,
        feeds: state.feeds.map((f) =>
          f.id === action.id ? { ...f, synced: Date.now(), status: action.status } : f,
        ),
      };

    case 'removeFeed':
      return {
        ...state,
        feeds: state.feeds.filter((f) => f.id !== action.id),
        feedEvents: state.feedEvents.filter((e) => e.sourceId !== action.id),
      };

    case 'setLinkUrl':
      return { ...state, linkUrls: { ...state.linkUrls, [action.id]: action.url.trim() } };

    case 'addLink': {
      const link: CampusLink = {
        id: newId(),
        name: action.name.trim() || 'Link',
        url: action.url.trim(),
        hint: '',
        note: '',
      };
      return { ...state, extraLinks: [...state.extraLinks, link] };
    }

    case 'addCourse':
      return {
        ...state,
        courses: [...state.courses, action.module],
        // A course id is a slug of its code, so re-importing ECON 1020 after
        // deleting it reuses the id. Cancel the pending deletion or the next
        // push would remove the course it had just sent.
        removedCourses: state.removedCourses.filter((id) => id !== action.module.course.id),
      };

    case 'replaceCourse':
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.course.id === action.module.course.id ? action.module : c,
        ),
      };

    case 'removeCourse':
      return {
        ...state,
        courses: state.courses.filter((c) => c.course.id !== action.id),
        // Anything filed against it goes too, or it becomes unreachable data.
        updates: state.updates.filter((u) => u.courseId !== action.id),
        // Named for the next push, so the account deletes this one and only
        // this one. See `removedCourses`.
        removedCourses: state.removedCourses.includes(action.id)
          ? state.removedCourses
          : [...state.removedCourses, action.id],
      };

    // Deleted from the account too; the queue has done its job.
    case 'removalsPushed':
      return {
        ...state,
        removedCourses: state.removedCourses.filter((id) => !action.ids.includes(id)),
      };

    case 'setSample':
      return { ...state, sample: action.on };

    // What the account had, arriving from another device. Navigation is left
    // alone: you should land where you were, not where your laptop was.
    //
    // This used to be `{ ...state, ...action.persisted }`, which replaced every
    // persisted field wholesale. Two devices each writing a note offline meant
    // the one that synced second won its whole list, and the other note was
    // gone with nothing to say so. `lib/merge.ts` merges field by field: lists
    // you add to keep both sides, ticked boxes keep both ticks, settings take
    // the copy that synced later.
    case 'hydrate': {
      const merged = mergePersisted(state, action.persisted);
      // A course deleted here but not yet deleted from the account would
      // otherwise arrive back in the union and look like it un-deleted itself.
      return state.removedCourses.length === 0
        ? merged
        : {
            ...merged,
            courses: merged.courses.filter((c) => !state.removedCourses.includes(c.course.id)),
          };
    }

    case 'removeLink': {
      const { [action.id]: _gone, ...linkUrls } = state.linkUrls;
      return {
        ...state,
        linkUrls,
        extraLinks: state.extraLinks.filter((l) => l.id !== action.id),
      };
    }

    default:
      return state;
  }
}

/** Where the account copy stands, for the Account screen to show honestly. */
export type SyncStatus =
  | 'off'          // no project configured in this build
  | 'signed-out'
  | 'syncing'
  | 'synced'
  | 'error';

interface Store {
  state: State;
  dispatch: (action: Action) => void;
  /** The current time, refreshed each minute so countdowns stay honest. */
  now: Date;
  /** The account's courses, with every lookup derived from them. */
  catalog: Catalog;
  account: Account | null;
  sync: { status: SyncStatus; at: number; error: string };
  /**
   * What went wrong saving to this device, in a sentence, or empty.
   *
   * On the context rather than in a toast because it is not an event — it is
   * a standing condition, and the app should keep saying so for as long as it
   * is true.
   */
  saveTrouble: string;
}

const StoreContext = createContext<Store | null>(null);

function currentMinute(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const startedAt = useRef(currentMinute());
  const [now, tick] = useReducer(currentMinute, startedAt.current);

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const persisted = loadPersisted();
    return {
      ...persisted,
      ...initialEphemeral(startedAt.current),
      screen: persisted.seenOnboarding
        ? (screenFromUrl() ?? ('home' as Screen))
        : ('onboarding' as Screen),
    };
  });

  // Re-render on the minute so "in 1 hr 19 min" and "Today" stay correct
  // without a timer per component.
  useEffect(() => {
    const id = setInterval(() => tick(), 30_000);
    return () => clearInterval(id);
  }, []);



  // Serialise once per dispatch — `state` is one object that changes identity
  // when the reducer runs, so this is not per-render work.
  //
  // This used to be an effect with a hand-written list of sixteen state fields
  // as its dependencies, which is a bug waiting on the next field: adding one
  // to pickPersisted and forgetting it here produced a setting that changed on
  // screen, survived nothing, and gave no hint why. Depending on the
  // serialised result means anything pickPersisted returns is persisted, and
  // the two lists cannot drift apart because there is only one.
  const persisted = useMemo(() => JSON.stringify(pickPersisted(state)), [state]);

  /**
   * Whether the last save worked, and what it cost.
   *
   * Held rather than thrown away because the old catch swallowed a quota
   * error exactly as readily as a private window with storage off. Past the
   * point where the budget ran out the app went on working perfectly, and
   * then a reload took the lot with nothing having suggested a problem.
   */
  const [saveTrouble, setSaveTrouble] = useState('');

  useEffect(() => {
    const result = save(persisted, (value) => localStorage.setItem(STORAGE_KEY, value));
    const said = trouble(result);
    // Only when it changes: setting the same string every dispatch would
    // re-render the whole app on every keystroke.
    setSaveTrouble((was) => (was === said ? was : said));
  }, [persisted]);

  // ── The account copy ────────────────────────────────────────────────────
  const [account, setAccount] = useState<Account | null>(null);
  const [sync, setSync] = useState<{ status: SyncStatus; at: number; error: string }>({
    status: cloudConfigured ? 'signed-out' : 'off',
    at: 0,
    error: '',
  });

  /**
   * Who is signed in — asked for after the first paint, not before it.
   *
   * The account SDK is a lazy chunk now, and asking for the session is what
   * pulls it. Doing that in a boot effect meant the fetch went out alongside
   * the first render and competed with it for the connection, which undoes
   * most of the point of splitting it out. An idle callback puts it after the
   * app is on screen; the two-second timeout is the floor, so a device that
   * never goes idle still syncs promptly.
   *
   * Nothing user-visible waits on it. The app is fully usable signed out, and
   * a signed-in account arriving a moment later is the same shape of delay it
   * always had — `currentSession` was asynchronous before this too.
   */
  useEffect(() => {
    if (!cloudConfigured) return;
    const take = (s: Session | null) => {
      setAccount(accountOf(s));
      // The shared key is only available to a signed-in account, and this is
      // what proves the account to the function.
      setSessionToken(s?.access_token ?? null);
    };

    let stop: (() => void) | null = null;
    let dropped = false;
    const start = () => {
      if (dropped) return;
      void currentSession().then(take);
      stop = onAuthChange(take);
    };

    // Safari only shipped requestIdleCallback recently, so the timeout is a
    // real fallback rather than a formality.
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle
      ? window.requestIdleCallback(start, { timeout: 2000 })
      : window.setTimeout(start, 400);

    return () => {
      dropped = true;
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      stop?.();
    };
  }, []);

  // On sign-in, whichever copy is newer wins — and the app says which.
  useEffect(() => {
    if (!account) {
      if (cloudConfigured) setSync({ status: 'signed-out', at: 0, error: '' });
      return;
    }
    let live = true;
    setSync((s) => ({ ...s, status: 'syncing', error: '' }));
    void (async () => {
      try {
        const remote = await pull(account.id);
        if (!live) return;
        const localStamp = Number(localStorage.getItem(SYNCED_KEY) ?? 0);
        const hasRemote = remote.state !== null || remote.courses.length > 0;

        if (hasRemote && remote.updated > localStamp) {
          dispatch({
            type: 'hydrate',
            persisted: {
              ...(remote.state as Partial<Persisted>),
              courses: remote.courses.map((c) => c.data as CourseModule),
            },
          });
          localStorage.setItem(SYNCED_KEY, String(remote.updated));
        }
        if (live) setSync({ status: 'synced', at: Date.now(), error: '' });
      } catch (e) {
        if (live) {
          setSync({
            status: 'error',
            at: 0,
            error: explainSyncError(e instanceof Error ? e.message : String(e)),
          });
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [account]);

  /**
   * Every later change goes up, once things stop moving.
   *
   * The dependency is the serialised persisted half, for the reason written
   * above the localStorage save: this list used to be seventeen hand-written
   * fields and had fallen a dozen behind. Drilling a card, naming a place,
   * sitting a practice paper and adding a source all changed state that this
   * effect was not watching, so none of them reached the account until some
   * *other* field happened to change. Depending on the same string means what
   * is saved is what is synced, and the two cannot drift again.
   *
   * A pull no longer suppresses the push either. The merge in `hydrate` is a
   * union, so the state after a pull holds this device's work as well as the
   * account's — which is exactly the copy the account is missing. Letting it
   * go back up is the second half of not losing a note.
   */
  useEffect(() => {
    if (!account) return;
    const timer = setTimeout(() => {
      const { courses, ...rest } = pickPersisted(state);
      const removed = state.removedCourses;
      void pushCloud(
        account.id,
        rest as Record<string, unknown>,
        courses.map((c) => ({ id: c.course.id, data: c })),
        removed,
      )
        .then(() => {
          localStorage.setItem(SYNCED_KEY, String(Date.now()));
          setSync({ status: 'synced', at: Date.now(), error: '' });
          if (removed.length > 0) dispatch({ type: 'removalsPushed', ids: removed });
        })
        .catch((e: unknown) =>
          setSync({
            status: 'error',
            at: 0,
            error: explainSyncError(e instanceof Error ? e.message : String(e)),
          }),
        );
    }, 2500);
    return () => clearTimeout(timer);
    // `persisted` stands in for the whole persisted half. `state` is read
    // inside the timer and is deliberately not a dependency — it changes on
    // every navigation, and none of those are worth a write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, persisted]);

  // The sample is fetched the first time it is switched on, and stays in
  // memory after. It is still never copied into storage — an account holds a
  // flag saying it wants the sample, not 330 KB of somebody else's semester.
  const [seed, setSeed] = useState<CourseModule[]>([]);
  useEffect(() => {
    if (!state.sample || seed.length > 0) return;
    let live = true;
    void loadSeed().then((mods) => {
      if (live) setSeed(mods);
    });
    return () => {
      live = false;
    };
  }, [state.sample, seed.length]);

  const catalog = useMemo(
    () => buildCatalog(state.sample ? [...seed, ...state.courses] : state.courses),
    [state.sample, seed, state.courses],
  );

  // Reminders. These toggles existed from the first build and did nothing —
  // no permission was ever asked for and no notification was ever shown. They
  // fire now, on the same tick the clock already runs, from data on the
  // device. What they still cannot do is wake a phone whose browser is closed;
  // the Settings screen says so rather than implying otherwise.
  useEffect(() => {
    if (catalog.empty) return;
    const check = () => {
      fire(
        dueReminders(new Date(), state.notifs, {
          items: datedItems(catalog, new Date()),
          classes: railFor(catalog, new Date(), state.appointments).map((b) => ({
            label: b.title,
            at: b.at,
            where: b.meta,
          })),
        }),
      );
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [catalog, state.notifs, state.appointments]);

  const value = useMemo(
    () => ({ state, dispatch, now, catalog, account, sync, saveTrouble }),
    [state, now, catalog, account, sync, saveTrouble],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/** Convenience: a stable dispatcher for a fixed action. */
export function useGo() {
  const { dispatch } = useStore();
  return useCallback((screen: Screen) => dispatch({ type: 'go', screen }), [dispatch]);
}
