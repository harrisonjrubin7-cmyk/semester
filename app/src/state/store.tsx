import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Appointment,
  CampusLink,
  CourseId,
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
    };
  } catch {
    // A private window, or storage disabled. Run with defaults.
    return { ...DEFAULT_PERSISTED };
  }
}

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'back' }
  | { type: 'openItem'; id: string }
  | { type: 'openCourse'; id: CourseId }
  | { type: 'openEvent'; id: string }
  | { type: 'openGuide'; id: CourseId; mode?: StudyMode; from?: Screen }
  | { type: 'setMode'; mode: StudyMode }
  | { type: 'setEpisode'; id: string }
  | { type: 'toggleDone'; id: string }
  | { type: 'toggleSaved'; id: string }
  | { type: 'toggleNotif'; k: NotifKey }
  | { type: 'togglePick'; id: string }
  | { type: 'setNav'; nav: NavMode }
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
  | { type: 'removeLink'; id: string };

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
        { ...state, guideId: action.id, mode: action.mode ?? state.mode, openUnit: 0, episodeId: null },
        'guide',
      );

    case 'setMode':
      return { ...state, mode: action.mode };

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

interface Store {
  state: State;
  dispatch: (action: Action) => void;
  /** The current time, refreshed each minute so countdowns stay honest. */
  now: Date;
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

  useEffect(() => {
    const persisted: Persisted = {
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
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Storage unavailable; the app still works for this session.
    }
  }, [
    state.nav,
    state.done,
    state.saved,
    state.notifs,
    state.picked,
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
  ]);

  const value = useMemo(() => ({ state, dispatch, now }), [state, now]);
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
