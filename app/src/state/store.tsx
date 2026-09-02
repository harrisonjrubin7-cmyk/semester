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
import type { CourseId, NavMode, Screen, StudyMode } from '../lib/types';
import { DEFAULT_NOTIFS, type NotifKey, EXTRACT } from '../data/misc';

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
  | { type: 'nextQuestion' };

const ROOTS: Screen[] = ['home', 'courses', 'study', 'calendar', 'me'];

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
      screen: persisted.seenOnboarding ? ('home' as Screen) : ('onboarding' as Screen),
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
