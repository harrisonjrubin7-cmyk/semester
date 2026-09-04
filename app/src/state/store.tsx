/**
 * The store: the provider, the hooks, and the two copies it keeps in step.
 *
 * The shape of the state and the reducer that changes it live next door, in
 * `shape.ts` and `reducer.ts`. What is left here is the part that genuinely
 * needs React and the network — the context, the clock, the catalogue, the
 * localStorage save, the reminders and the account sync.
 */

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
import type { CourseModule, Screen } from '../lib/types';
import { buildCatalog, type Catalog } from '../data/catalog';
import { arrange } from '../lib/yours';
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
import { dueReminders, fire } from '../lib/notify';
import { myReminders } from '../lib/myrules';
import { datedItems, railFor } from '../lib/select';
import { save, trouble } from '../lib/keep';
import { LEGACY_TERM, sortTerms, type Term } from '../lib/term';
import { readSeen, writeSeen } from '../lib/since';
import { badge } from '../lib/device';
import { SHARE_FLAG } from '../lib/shared';
import { onOtherTab, tellOtherTabs } from '../lib/tabs';
import { itemsDueToday } from '../lib/select';
import { reducer } from './reducer';
import { resolveSchool } from '../data/schools';
import type { School } from '../lib/school';
// Aliased: an effect below has its own local `said` for a save error.
import { said as refreshSaid } from '../lib/refresh';
import {
  ROOTS,
  STORAGE_KEY,
  SYNCED_KEY,
  initialEphemeral,
  loadPersisted,
  pickPersisted,
  type Action,
  type Persisted,
  type State,
} from './shape';

// The shape is defined next door; screens reach it through this file, which is
// the one they already import.
export type { Action, Persisted, QuizQuestion, State } from './shape';
export { pickPersisted } from './shape';
export { reducer } from './reducer';


/**
 * An installed app's shortcuts open `?screen=study` and the like. Only the
 * roots are addressable — a deep link into a drill would land somewhere with
 * no way back.
 */
function screenFromUrl(): Screen | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get('screen') as Screen | null;
    if (asked && ROOTS.includes(asked)) return asked;
    // A syllabus shared in from another app, or a file opened with this one,
    // lands on the importer — which is not a root, so it needs saying
    // explicitly. Only for a real share: `?screen=import` typed by hand is
    // still refused, the same as any other non-root.
    if (asked === 'import' && params.get(SHARE_FLAG) === '1') return 'import' as Screen;
    return null;
  } catch {
    return null;
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
  /** The current term's courses, with every lookup derived from them. */
  catalog: Catalog;
  /** Every term the account has a course in, newest first. */
  terms: Term[];
  /** When this device last had the app open, epoch ms. Zero on a first run. */
  lastSeen: number;
  /**
   * A course code, from any term.
   *
   * The catalogue holds one term, so `catalog.byId` returns nothing for a
   * course from another — and a note filed against last semester's ECON then
   * rendered its label as "undefined". Anything filed against a course needs
   * this rather than the catalogue.
   */
  courseCode: (id: string) => string;
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
  /**
   * Check the account now, and get back a sentence saying what came of it.
   *
   * Used by the pull-down gesture and by "Sync now". Safe to call signed out —
   * it says so rather than pretending to be up to date.
   */
  refresh: () => Promise<string>;
  /**
   * Where this student studies, and therefore what the app offers.
   *
   * Resolved once here rather than looked up per screen, so the directory,
   * search and the tab chooser cannot disagree about whether a screen exists.
   * See `lib/school.ts` — screens ask what a school has, never which it is.
   */
  school: School;
}

const StoreContext = createContext<Store | null>(null);

function currentMinute(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const startedAt = useRef(currentMinute());

  /**
   * When this device last had the app open.
   *
   * Read once, at boot, and kept fixed for the session — it is the mark that
   * "what changed since you last looked" counts against, and a mark moving
   * while you read it would make the answer disappear as you looked at it.
   */
  const lastSeen = useRef(readSeen());
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

  // The mark moves forward as the app runs, so closing the tab and coming
  // back tomorrow compares against today rather than against last week. On a
  // timer rather than on unload, which browsers no longer reliably fire on a
  // phone.
  useEffect(() => {
    const stamp = () => writeSeen(Date.now());
    const id = setInterval(stamp, 60_000);
    return () => {
      clearInterval(id);
      stamp();
    };
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
    // A second tab of this app is now told, so it can re-read rather than
    // sit on a deadline you ticked a minute ago somewhere else. Only the
    // fact is sent; the disk stays the single copy both tabs agree on. See
    // `lib/tabs.ts`.
    tellOtherTabs();
  }, [persisted]);

  /**
   * Take what another tab wrote.
   *
   * Re-read from disk and hydrate, which is the same path a sync pull takes —
   * so the merge, the removed-course guard and everything else that already
   * decides how two copies reconcile applies unchanged.
   */
  useEffect(() => onOtherTab(() => dispatch({ type: 'hydrate', persisted: loadPersisted() })), []);

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

  /**
   * Check the account for a newer copy, and say plainly what came of it.
   *
   * This used to be the body of an effect that ran once, on sign-in, and never
   * again while the app was open. Somebody who imports a syllabus on their
   * laptop and then looks at their phone saw yesterday's app with no way to
   * ask it to look — and leaving a tab open for a week is how most people use
   * this. It is a callable now so the pull-down gesture and the effect are the
   * same code rather than two that drift.
   *
   * It returns a sentence rather than nothing, because a refresh that finds
   * nothing and a refresh that failed look identical otherwise. See
   * `lib/refresh.ts`.
   *
   * What it will not do is overwrite local data with an empty account.
   * `hasRemote` is what stops a signed-in device with a blank account from
   * hydrating a semester's work away.
   */
  const refresh = useCallback(async (): Promise<string> => {
    const base = { cloud: cloudConfigured, signedIn: Boolean(account), took: false, courses: 0, error: '', at: 0 };
    if (!account) {
      if (cloudConfigured) setSync({ status: 'signed-out', at: 0, error: '' });
      return refreshSaid(base, Date.now());
    }
    setSync((s) => ({ ...s, status: 'syncing', error: '' }));
    try {
      const remote = await pull(account.id);
      const localStamp = Number(localStorage.getItem(SYNCED_KEY) ?? 0);
      const hasRemote = remote.state !== null || remote.courses.length > 0;
      const take = hasRemote && remote.updated > localStamp;

      if (take) {
        dispatch({
          type: 'hydrate',
          persisted: {
            ...(remote.state as Partial<Persisted>),
            courses: remote.courses.map((c) => c.data as CourseModule),
          },
        });
        localStorage.setItem(SYNCED_KEY, String(remote.updated));
      }
      setSync({ status: 'synced', at: Date.now(), error: '' });
      return refreshSaid(
        { ...base, took: take, courses: take ? remote.courses.length : 0, at: take ? remote.updated : 0 },
        Date.now(),
      );
    } catch (e) {
      const error = explainSyncError(e instanceof Error ? e.message : String(e));
      setSync({ status: 'error', at: 0, error });
      return refreshSaid({ ...base, error }, Date.now());
    }
  }, [account]);

  // On sign-in, whichever copy is newer wins — and the app says which.
  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  /**
   * Every course the account holds, across every term.
   *
   * Kept separately from the catalogue because the term switcher has to know
   * what terms exist, and a catalogue filtered to one term by definition
   * cannot say.
   */
  const allModules = useMemo(
    () => (state.sample ? [...seed, ...state.courses] : state.courses),
    [state.sample, seed, state.courses],
  );

  const terms = useMemo(
    () => sortTerms(allModules.map((m) => m.course.term ?? LEGACY_TERM)),
    [allModules],
  );

  const codes = useMemo(
    () => Object.fromEntries(allModules.map((m) => [m.course.id, m.course.code])),
    [allModules],
  );
  const courseCode = useCallback((id: string) => codes[id] ?? id.toUpperCase(), [codes]);

  /**
   * The catalogue is one term's worth.
   *
   * Everything downstream — Today, the rail, the hour arithmetic, the weekly
   * report — reads the catalogue and therefore sees one semester, which is
   * what it always assumed it was seeing. A term nobody has a course in falls
   * back to showing everything rather than an empty app, which is the state a
   * saved `term` from a deleted semester would otherwise leave somebody in.
   */
  const catalog = useMemo(() => {
    const wanted = allModules.filter((m) => (m.course.term ?? LEGACY_TERM) === state.term);
    const showing = wanted.length > 0 || terms.length === 0 ? wanted : allModules;
    // Sorted here and nowhere else. Every list of courses in the app — the
    // Courses screen, the study picker, the filter chips, the week's colours —
    // is derived from `catalog.modules`, so ordering at the source reaches all
    // of them at once instead of being reapplied, and forgotten, in each.
    return buildCatalog(arrange(showing, state.yours, state.courseOrder));
  }, [allModules, state.term, terms, state.yours, state.courseOrder]);

  /**
   * Keep the open course and guide inside the catalogue.
   *
   * `guideId` starts life as 'econ' — a sample course id — and a term switch
   * or a deletion can leave either pointer aimed at a course this catalogue
   * does not hold. The guide screen then renders an empty guide and the
   * course screen has nothing to read at all. One place fixes it.
   */
  useEffect(() => {
    if (catalog.empty) return;
    const first = catalog.courses[0].id;
    const guideId = catalog.byId[state.guideId] ? undefined : first;
    const courseId = catalog.byId[state.courseId] ? undefined : first;
    if (guideId || courseId) dispatch({ type: 'settleCourse', guideId, courseId });
  }, [catalog, state.guideId, state.courseId]);

  // Reminders. These toggles existed from the first build and did nothing —
  // no permission was ever asked for and no notification was ever shown. They
  // fire now, on the same tick the clock already runs, from data on the
  // device. What they still cannot do is wake a phone whose browser is closed;
  // the Settings screen says so rather than implying otherwise.
  useEffect(() => {
    if (catalog.empty) return;
    const check = () => {
      const at = new Date();
      const items = datedItems(catalog, at);
      fire(
        dueReminders(at, state.notifs, {
          items,
          classes: railFor(catalog, at, state.appointments).map((b) => ({
            label: b.title,
            at: b.at,
            where: b.meta,
          })),
          registrar: state.registrar,
        }),
      );
      // The student's own rules, fired through the same `fire` — which keeps
      // the seen list, so a custom reminder is subject to the same "once" as
      // every built-in one. They add and never subtract: see `lib/myrules.ts`.
      fire(
        myReminders(at, state.myRules, items).map((f) => ({
          id: f.id,
          rule: 'today' as const,
          title: f.title,
          body: f.body,
        })),
      );
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [catalog, state.notifs, state.appointments, state.registrar, state.myRules]);

  // The number on the installed icon: things due today and not ticked. In the
  // provider rather than on Today, because the count has to be right whatever
  // screen you left the app on — and it is the count you can act on, never a
  // tally of notifications. See `lib/device.ts`.
  useEffect(() => {
    // "None" means none, including the one on the installed icon — that is
    // the badge people actually mean when they say they want them off.
    // "Everything" and "Only what is due" are the same number here: the icon
    // has only ever carried a count you can act on today, never a tally.
    badge(
      state.badges === 'none'
        ? 0
        : itemsDueToday(catalog, now).filter((i) => !state.done[i.id]).length,
    );
  }, [catalog, now, state.done, state.badges]);

  /*
   * The bundled profile is the fallback, not the loser.
   *
   * Nothing is fetched here yet — the account row lands in a later phase. What
   * matters now is that a Vanderbilt student opening this offline, signed out,
   * on a first launch gets the full profile with no network call, which is the
   * guarantee the rest of the app already keeps.
   */
  const school = useMemo(() => resolveSchool(state.schoolId, null), [state.schoolId]);

  const value = useMemo(
    () => ({ state, dispatch, now, catalog, terms, courseCode, lastSeen: lastSeen.current, account, sync, saveTrouble, refresh, school }),
    [state, now, catalog, terms, courseCode, account, sync, saveTrouble, refresh, school],
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
