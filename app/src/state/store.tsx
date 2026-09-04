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
import { datedItems, railFor } from '../lib/select';
import { save, trouble } from '../lib/keep';
import { LEGACY_TERM, sortTerms, type Term } from '../lib/term';
import { reducer } from './reducer';
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
    const asked = new URLSearchParams(window.location.search).get('screen') as Screen | null;
    return asked && ROOTS.includes(asked) ? asked : null;
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
    return buildCatalog(wanted.length > 0 || terms.length === 0 ? wanted : allModules);
  }, [allModules, state.term, terms]);

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
          registrar: state.registrar,
        }),
      );
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [catalog, state.notifs, state.appointments, state.registrar]);

  const value = useMemo(
    () => ({ state, dispatch, now, catalog, terms, account, sync, saveTrouble }),
    [state, now, catalog, terms, account, sync, saveTrouble],
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
