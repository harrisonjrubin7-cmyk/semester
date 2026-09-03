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
import { SEED_MODULES } from '../data/seed';
import { newId } from '../lib/files';
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
  calView: 'day' | 'month' | 'semester';
  /** Which sources the calendar is showing — combined, or one at a time. */
  calSource: 'all' | 'classes' | 'deadlines' | 'campus';
  /** Day the Day view is on, as an ISO date. Null means today. */
  calDay: string | null;
  /** Which section of the Mine screen is open. */
  mineTab: 'tasks' | 'appointments' | 'notes' | 'files';
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
};

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
  | { type: 'markCard'; got: boolean }
  | { type: 'redrill' }
  | { type: 'startQuiz'; quiz: QuizQuestion[] }
  | { type: 'pickAnswer'; index: number }
  | { type: 'nextQuestion' }
  | { type: 'setCalView'; view: 'day' | 'month' | 'semester' }
  | { type: 'setCalSource'; source: 'all' | 'classes' | 'deadlines' | 'campus' }
  | { type: 'setCalDay'; date: string | null }
  | { type: 'stepDay'; delta: number }
  | { type: 'setMineTab'; tab: 'tasks' | 'appointments' | 'notes' | 'files' }
  | { type: 'addTask'; task: Omit<PersonalTask, 'id' | 'created' | 'done'> }
  | { type: 'toggleTask'; id: string }
  | { type: 'deleteTask'; id: string }
  | { type: 'addAppointment'; appointment: Omit<Appointment, 'id' | 'created'> }
  | { type: 'deleteAppointment'; id: string }
  | { type: 'newNote'; courseId: CourseId | null }
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

function push(state: State, screen: Screen): State {
  if (screen === state.screen) return state;
  // In tab mode a root screen is a destination, so the back stack resets. In
  // feed mode there is no tab bar, so every screen except the feed itself has
  // to stay reachable backwards or it becomes a dead end.
  const resets = ROOTS.includes(screen) && (state.nav === 'tabs' || screen === 'home');
  const history = resets ? [] : [...state.history, state.screen];
  return { ...state, screen, history };
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

    case 'toggleWays':
      return { ...state, waysOpen: !state.waysOpen };

    case 'setEpisode':
      return { ...state, episodeId: action.id };

    case 'toggleDone':
      return { ...state, done: { ...state.done, [action.id]: !state.done[action.id] } };

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

    case 'markCard':
      return {
        ...state,
        revealed: false,
        drillIdx: state.drillIdx + 1,
        drillGot: state.drillGot + (action.got ? 1 : 0),
      };

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
      return { ...state, courses: [...state.courses, action.module] };

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
      };

    case 'setSample':
      return { ...state, sample: action.on };

    // What the account had, arriving from another device. Navigation is left
    // alone: you should land where you were, not where your laptop was.
    case 'hydrate':
      return { ...state, ...action.persisted };

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, persisted);
    } catch {
      // Storage unavailable; the app still works for this session.
    }
  }, [persisted]);

  // ── The account copy ────────────────────────────────────────────────────
  const [account, setAccount] = useState<Account | null>(null);
  const [sync, setSync] = useState<{ status: SyncStatus; at: number; error: string }>({
    status: cloudConfigured ? 'signed-out' : 'off',
    at: 0,
    error: '',
  });
  // Set while hydrating, so the pull's own state change does not bounce
  // straight back as a push.
  const settling = useRef(false);

  useEffect(() => {
    if (!cloudConfigured) return;
    const take = (s: Session | null) => {
      setAccount(accountOf(s));
      // The shared key is only available to a signed-in account, and this is
      // what proves the account to the function.
      setSessionToken(s?.access_token ?? null);
    };
    void currentSession().then(take);
    return onAuthChange(take);
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
          settling.current = true;
          dispatch({
            type: 'hydrate',
            persisted: {
              ...(remote.state as Partial<Persisted>),
              courses: remote.courses.map((c) => c.data as CourseModule),
            },
          });
          localStorage.setItem(SYNCED_KEY, String(remote.updated));
          setTimeout(() => (settling.current = false), 0);
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

  // Every later change goes up, once things stop moving.
  useEffect(() => {
    if (!account || settling.current) return;
    const timer = setTimeout(() => {
      const { courses, ...rest } = pickPersisted(state);
      void pushCloud(
        account.id,
        rest as Record<string, unknown>,
        courses.map((c) => ({ id: c.course.id, data: c })),
      )
        .then(() => {
          localStorage.setItem(SYNCED_KEY, String(Date.now()));
          setSync({ status: 'synced', at: Date.now(), error: '' });
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
    // The same fields localStorage watches: what is worth keeping is what is
    // worth syncing.
  }, [
    account,
    state.nav,
    state.done,
    state.saved,
    state.notifs,
    state.seenOnboarding,
    state.cleared,
    state.tasks,
    state.appointments,
    state.notes,
    state.updates,
    state.feeds,
    state.feedEvents,
    state.linkUrls,
    state.extraLinks,
    state.courses,
    state.sample,
  ]);

  // The sample stays compiled in rather than copied into storage, so switching
  // it on costs a flag rather than 300 KB.
  const catalog = useMemo(
    () => buildCatalog(state.sample ? [...SEED_MODULES, ...state.courses] : state.courses),
    [state.sample, state.courses],
  );

  const value = useMemo(
    () => ({ state, dispatch, now, catalog, account, sync }),
    [state, now, catalog, account, sync],
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
