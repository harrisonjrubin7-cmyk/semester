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
import { over, timed } from '../lib/timing';
import type { Named } from '../lib/forwork';
import { arrange } from '../lib/yours';
import { setSessionToken } from '../lib/token';
import { type Mark, marksFor, noteToday } from '../lib/activity';
import { claimPending } from '../lib/referral';
import {
  accountOf,
  cloudConfigured,
  currentSession,
  onAuthChange,
  explainSync,
  pull,
  push as pushCloud,
  type Account,
} from '../lib/cloud';
import type { Session } from '@supabase/supabase-js';
import { loadSeed } from '../data/seed';
import { nextPayment } from '../lib/bill';
import { classesToNudge, dueReminders, fire } from '../lib/notify';
import { atRiskToday } from '../lib/atrisk';
import { beginNow, planFrom } from '../lib/start';
import { myReminders } from '../lib/myrules';
import { datedItems, railFor } from '../lib/select';
import { save, trouble } from '../lib/keep';
import { CHECK_EVERY_MS, WRITE_FAILED, room, roomLine } from '../lib/quota';
import {
  available as dbAvailable,
  whileWriting,
  flushNow,
  load as loadFromDb,
  persist as persistToDb,
} from './persist';
import { backupOf } from '../lib/export';
import { countsOf, takeDaily } from '../lib/snapshots';
import { LEGACY_TERM, sortTerms, type Term } from '../lib/term';
import { readSeen, writeSeen } from '../lib/since';
import { recordVisit } from '../lib/trail.hook';
import { badge } from '../lib/device';
import { SHARE_FLAG } from '../lib/shared';
import { linkedScreen } from '../lib/deeplink';
import { NAMED, fromHash, replaces, same, toHash, type Route } from '../lib/route';
import { onOtherTab, tellOtherTabs } from '../lib/tabs';
import { itemsDueToday } from '../lib/select';
import { reducer } from './reducer';
import { firstScreen } from '../lib/chrome';
import { resolveSchool } from '../data/schools';
import { ACCENT_TINT, anchorHue, tintsFor, type CourseTint } from '../lib/tint';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { USAGE_KEY, note as noteUsage, read as readUsage } from '../lib/usage';
import { hold as holdAboutMe } from '../lib/aboutme';
import { countRows, decide, type Choice, type Sides } from '../lib/adopt';
import type { Facts } from '../lib/reveal';
import type { School } from '../lib/school';
// Aliased: an effect below has its own local `said` for a save error.
import { said as refreshSaid } from '../lib/refresh';
import {
  STORAGE_KEY,
  initialEphemeral,
  loadPersisted,
  markSeen,
  pickPersisted,
  seenRows,
  unseen,
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
 * An installed app's shortcuts open `?screen=study` and the like.
 *
 * Which screens a link may name is `lib/deeplink.ts`, which is where the
 * reasoning and the tests live. This is only the part that needs a browser:
 * reading the query string, and refusing to throw if there isn't one.
 */
function screenFromUrl(): Screen | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return linkedScreen(params.get('screen'), params.get(SHARE_FLAG) === '1');
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
  /**
   * Every deadline the account holds, from every term — an id and a title each.
   *
   * The deadline half of `courseCode` above, and it exists for exactly the
   * same reason. The catalogue is one term, so a document filed against last
   * semester's essay resolved to nothing the moment the term switched, and
   * `lib/forwork.ts`'s rule turned that into "filed against no deadline" — a
   * live link reported as a dangling one, on the screen whose whole job is to
   * say what a file is for.
   *
   * Titles only, and undecorated. Anything that needs a date or a course —
   * the picker — is choosing from the open term by definition and reads the
   * catalogue instead.
   */
  allItems: Named[];
  /**
   * The colour this course is drawn in, everywhere it appears.
   *
   * On the store rather than worked out per screen because it depends on
   * three things a screen has no business gathering — the whole course list,
   * the reader's accent, and which ground is actually resolved right now —
   * and because a course that was one colour on Today and another on the
   * calendar would be worse than no colour at all. Anything with no course
   * (a personal task, a university event) asks with `null` and gets the plain
   * accent, which is what those have always been drawn in. See `lib/tint.ts`.
   */
  tint: (id: string | null | undefined) => CourseTint;
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
   * Announce one outcome, to the live region and to the change strip.
   *
   * For things somebody would otherwise have to look at the screen to
   * confirm — a card marked, an absence recorded, a sync finished. Not for
   * edits: a grade field that saves on every keystroke has no outcome yet,
   * only typing, which is why `ScoreField` says its piece on blur instead.
   *
   * `to` is the screen the record lives on, where naming one helps. Most
   * outcomes happen on the screen you are already looking at and want none.
   * See `components/Said.tsx`.
   */
  say: (said: string, to?: Screen) => void;
  /**
   * Where this student studies, and therefore what the app offers.
   *
   * Resolved once here rather than looked up per screen, so the directory,
   * search and the tab chooser cannot disagree about whether a screen exists.
   * See `lib/school.ts` — screens ask what a school has, never which it is.
   */
  school: School;
  /** How far along the semester is, for what the directory lists. */
  facts: Facts;
  /**
   * The first-sign-in question, or null.
   *
   * On the store rather than on a screen because it has to be answerable from
   * wherever somebody happened to be when the sign-in came back. See
   * `lib/adopt.ts` and `components/Adopting.tsx`.
   */
  asking: { sides: Sides; say: string } | null;
  settle: (choice: Choice, backup: string | null) => void;
  /**
   * Take the semester the app ships with on as your own courses.
   *
   * On the store because the seed is loaded here and nowhere else. See the
   * `adoptSeed` case in `state/slices/library.ts` for why it is worth doing.
   */
  adopt: () => void;
}

const StoreContext = createContext<Store | null>(null);

/**
 * The minute, on a context of its own.
 *
 * It used to be a field on the store's one context value, and the store's
 * value is read at 195 call sites. So every tick — twice a minute, because the
 * timer checks twice as often as the thing it watches — made a new context
 * value and re-rendered all of them, including the ninety-five that have
 * nothing to do with time. There is no `React.memo` anywhere in this app to
 * stop that, which is a deliberate choice and a reasonable one; what was not
 * reasonable was the clock making it expensive.
 *
 * Split, a tick reaches only what asks for the clock. The store's own effects
 * — reminders, the class rail, the daily snapshot — keep using the local
 * `now`, so there is still exactly one timer and one source. See
 * `ENGINEERING-AUDIT.md` §2.
 *
 * The default is a real date rather than null: `useNow()` outside the provider
 * is a programming error, but it is the kind that should render a stale label
 * rather than take the app down, and the value below is replaced on the first
 * tick anyway.
 */
const NowContext = createContext<Date>(currentMinute());

/**
 * The current time, to the minute.
 *
 * Ask for this rather than pulling `now` off `useStore()` — that is what the
 * split is for. A component that reads both re-renders on the minute, which is
 * correct and is what it is for; a component that reads only the store no
 * longer does.
 */
export function useNow(): Date {
  return useContext(NowContext);
}

function currentMinute(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

/**
 * The same minute is the same value, and React needs to be told so.
 *
 * The clock below fires twice a minute, and `currentMinute()` hands back a
 * fresh `Date` every time it is called. `useReducer` bails out of a re-render
 * only when the reducer returns something `Object.is`-equal to what it already
 * held, and two `Date` objects never are — so half of these ticks published a
 * minute that had not changed, and every one of them was a full re-render.
 *
 * Not a small one, either: `now` is a member of the single context value built
 * at the foot of this file, `useStore()` is read at 298 call sites, and there
 * is no `React.memo` anywhere in the app to stop the cascade. So the whole
 * mounted tree re-rendered twice a minute, on a phone, on battery, while
 * somebody read a field guide.
 *
 * Returning the previous `Date` when the minute has not moved is the whole
 * fix, and it is correct on its own terms whatever else happens to the
 * context: the value is the minute, and the minute has not changed.
 *
 * It halves the cost rather than removing it. The other half is that a minute
 * boundary is still an app-wide event, and that wants `now` in a provider of
 * its own — a larger change, argued in `ENGINEERING-AUDIT.md` §2.
 */
export function nextMinute(was: Date): Date {
  const d = currentMinute();
  return d.getTime() === was.getTime() ? was : d;
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
  const [now, tick] = useReducer(nextMinute, startedAt.current);

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const persisted = loadPersisted();
    const ephemeral = initialEphemeral();
    if (!persisted.seenOnboarding) {
      return { ...persisted, ...ephemeral, screen: 'onboarding' as Screen };
    }
    /*
     * A refresh, a bookmark, or a link somebody sent.
     *
     * The hash wins, because it is the more specific of the two and it is the
     * one this build writes. `?screen=` is still honoured underneath it: an
     * installed app's shortcuts and the share target were built against it,
     * and they are out in the world on people's home screens.
     */
    const landed = fromHash(window.location.hash);
    if (landed) {
      const field = NAMED[landed.screen];
      return {
        ...persisted,
        ...ephemeral,
        screen: landed.screen,
        ...(field && landed.id ? { [field]: landed.id } : {}),
        ...(landed.mode ? { mode: landed.mode } : {}),
        // A link to a screen that has since merged says which part of its
        // survivor it meant — see `RETIRED` in `lib/route.ts`.
        ...(landed.opens?.report ? { report: landed.opens.report } : {}),
        ...(landed.opens?.changes ? { changes: landed.opens.changes } : {}),
        ...(landed.opens?.courses ? { coursesTab: landed.opens.courses } : {}),
        ...(landed.opens?.home ? { homeTab: landed.opens.home } : {}),
      };
    }
    /*
     * And with no address at all, wherever the navigation opens.
     *
     * `home` for four of the five, and the search page for the workspace —
     * which is the one navigation shaped like a browser, and a browser opens
     * on a new tab. `lib/chrome.ts` holds the rule, beside the rest of what a
     * navigation decides.
     */
    return { ...persisted, ...ephemeral, screen: screenFromUrl() ?? firstScreen(persisted.nav) };
  });

  // Re-render on the minute so "in 1 hr 19 min" and "Today" stay correct
  // without a timer per component.
  //
  // Still every 30 seconds rather than every 60, and deliberately: a timer
  // that fires exactly on the period drifts, so a minute boundary could be
  // missed for a whole minute. Checking twice as often as the thing being
  // watched is what keeps the label at most 30 seconds stale — and now that
  // `nextMinute` returns the same value when the minute has not moved, the
  // extra check costs one comparison rather than a re-render of the app.
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

  /*
   * The standing preferences, handed to the one thing that cannot ask for them.
   *
   * `lib/claude.ts:ask` builds every outgoing request and is not a hook, so it
   * reads this list from a module-level value rather than from the store. This
   * is the only thing that writes it. It runs on the list itself rather than on
   * every render, so a keystroke anywhere else in the app does not touch it.
   *
   * Placed here, above the router, because the alternative — each assistant
   * screen passing its own copy — is the twenty-five call sites this design
   * exists to avoid. See `lib/aboutme.ts`.
   */
  useEffect(() => {
    holdAboutMe(state.aboutMe);
  }, [state.aboutMe]);

  /*
   * A count per screen, on this device and nowhere else.
   *
   * Written straight to its own storage key rather than through the reducer,
   * because it is deliberately outside everything that syncs — see
   * `lib/usage.ts` for why that is a decision rather than an omission. Keyed
   * on the screen alone, so navigating back to a screen already on the stack
   * counts once per arrival and never per render.
   */
  useEffect(() => {
    if (!state.countScreens || !state.screen) return;
    try {
      const now = noteUsage(readUsage(localStorage.getItem(USAGE_KEY)), state.screen);
      localStorage.setItem(USAGE_KEY, JSON.stringify(now));
    } catch {
      // A private window, or storage full. Losing a count matters to nobody,
      // and the save that does matter reports its own trouble below.
    }
  }, [state.screen, state.countScreens]);

  // Serialise once per dispatch — `state` is one object that changes identity
  // when the reducer runs, so this is not per-render work.
  //
  // This used to be an effect with a hand-written list of sixteen state fields
  // as its dependencies, which is a bug waiting on the next field: adding one
  // to pickPersisted and forgetting it here produced a setting that changed on
  // screen, survived nothing, and gave no hint why. Depending on the
  // serialised result means anything pickPersisted returns is persisted, and
  // the two lists cannot drift apart because there is only one.
  const picked = useMemo(() => pickPersisted(state), [state]);
  /**
   * The same thing as a string, for the localStorage path only.
   *
   * On the database path it is never built. Serialising the whole account on
   * every change is half of what this move is removing, and the diffing writer
   * compares references rather than text.
   */
  const persisted = useMemo(() => (dbAvailable() ? '' : JSON.stringify(picked)), [picked]);
  /** What was last written to localStorage, so an unchanged store is not rewritten. */
  const wrote = useRef('');
  /** When the browser was last asked how much room is left. */
  const checkedRoom = useRef(0);

  /**
   * Whether the last save worked, and what it cost.
   *
   * Held rather than thrown away because the old catch swallowed a quota
   * error exactly as readily as a private window with storage off. Past the
   * point where the budget ran out the app went on working perfectly, and
   * then a reload took the lot with nothing having suggested a problem.
   */
  const [saveTrouble, setSaveTrouble] = useState('');
  /*
   * Two things can fill that banner, and a failed write outranks a full-ish
   * disk: one is what is about to happen and the other is what is happening.
   * Kept apart so clearing either does not clear the other — a write landing
   * again should not take down a "getting full" warning that is still true.
   */
  const [roomSaid, setRoomSaid] = useState('');
  const [writeFailing, setWriteFailing] = useState(false);
  useEffect(() => {
    setSaveTrouble(writeFailing ? WRITE_FAILED : roomSaid);
  }, [writeFailing, roomSaid]);
  /*
   * The writer says whether it is landing.
   *
   * Measured before this, with the database refusing writes the way a full
   * disk refuses them: a task added through the quick-add sheet drew, stayed
   * in memory, and was gone after a reload — nothing on screen either time.
   * The banner in `App.tsx` was written for exactly that case and could only
   * be turned on by an estimate. See `state/persist/index.ts`.
   */
  useEffect(() => {
    whileWriting((failing) => setWriteFailing(failing));
    return () => whileWriting(null);
  }, []);

  /**
   * The first-sign-in question, while it is waiting to be answered.
   *
   * Held here rather than on the persisted state: it is about this moment, and
   * a half-answered question surviving a reload would be worse than being
   * asked again.
   */
  /*
   * The current state, for the callbacks that must not re-create on it.
   *
   * `refresh` counts this device's rows, and `settle` writes them to a backup
   * file — both need the state as it is *now*. Depending on it directly would
   * give `refresh` a new identity on every dispatch, and the effect that calls
   * it on sign-in would then re-pull the account on every keystroke.
   */
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });

  /**
   * Whether the next write is this tab's own change or another tab's.
   *
   * `lib/tabs.ts` states the rule: "A tab that receives a nudge takes what is
   * on disk. It never pushes back, never merges, and never argues." Answering
   * a nudge with a nudge is pushing back, and two tabs doing it to each other
   * is a loop with no exit — measured at about forty-three round trips a
   * second with both tabs sitting idle.
   *
   * The cost is not the noise. `persist` clears its timer on every call, so at
   * that rate the quarter second never elapsed, `flush` never ran, and a note
   * typed in either tab was drawn on screen, held in memory, and gone on
   * reload. Closing the second tab started saving again, which is what made it
   * possible to disbelieve.
   *
   * A ref rather than state: it is read by the effect that the same dispatch
   * schedules, and it must not itself cause a render.
   */
  const fromOtherTab = useRef(false);

  const [asking, setAsking] = useState<{
    sides: Sides;
    say: string;
    remote: Awaited<ReturnType<typeof pull>>;
  } | null>(null);

  useEffect(() => {
    /*
     * Two paths, and only one of them can lose anything.
     *
     * On IndexedDB the write is a diff: ticking one box writes one row, it
     * happens a quarter of a second after the last change, and it is
     * asynchronous, so nothing here blocks a render. There is no shedding,
     * because there is no 5MB ceiling to shed against.
     *
     * The localStorage path is what a device with no usable database still
     * gets, unchanged — including `lib/keep.ts` throwing away old practice
     * papers to make room, which is the behaviour this whole change exists to
     * stop being normal. See `state/persist/`.
     */
    if (dbAvailable()) {
      // Whether this write is allowed to tell anyone, decided now and spent
      // by the write itself: a run caused by taking another tab's change
      // still writes — the merge may have kept something of this tab's own —
      // but it stays quiet. See `fromOtherTab` above.
      const quiet = fromOtherTab.current;
      fromOtherTab.current = false;
      persistToDb(picked, quiet ? undefined : tellOtherTabs);
      // Occasionally, because the number moves slowly and a warning somebody
      // sees every day is one they stop reading. Nothing is shed on this path
      // — this is a warning while there is still room to act on it, which is
      // the whole difference from what localStorage forced. See `lib/quota.ts`.
      const now = Date.now();
      if (now - checkedRoom.current > CHECK_EVERY_MS) {
        checkedRoom.current = now;
        void room().then((r) => {
          const said = roomLine(r);
          setRoomSaid((was) => (was === said ? was : said));
        });
      }
      return;
    }
    // Unchanged text means nothing to write, which is what the string dep used
    // to give for free before the database path took the dep over.
    if (persisted === wrote.current) return;
    const quiet = fromOtherTab.current;
    fromOtherTab.current = false;
    wrote.current = persisted;
    const result = save(persisted, (value) => localStorage.setItem(STORAGE_KEY, value));
    const said = trouble(result);
    // Only when it changes: setting the same string every dispatch would
    // re-render the whole app on every keystroke.
    setSaveTrouble((was) => (was === said ? was : said));
    // A second tab of this app is now told, so it can re-read rather than
    // sit on a deadline you ticked a minute ago somewhere else. Only the
    // fact is sent; the disk stays the single copy both tabs agree on. See
    // `lib/tabs.ts`. This write is synchronous and already finished, so
    // unlike the database path there is nothing to wait for.
    if (!quiet) tellOtherTabs();
  }, [picked, persisted]);

  /**
   * Ask for the last write before the page goes away.
   *
   * `flushNow` was written for exactly this — its own docblock says "For a tab
   * closing, and for tests" — and until now only the tests called it. A write
   * settles a quarter of a second after the last change, so a note typed and
   * the tab closed 120ms later came back with an empty title: the row was
   * there, because creating the note had settled, and the words were not.
   *
   * `visibilitychange` rather than `beforeunload` alone, for the reason
   * `lib/draft.hook.ts` already gives about the same hazard: backgrounding on
   * a phone fires `visibilitychange` and may never fire anything else before
   * the page is discarded.
   *
   * No dependencies: this is about the page, not about what is in it, and
   * `flushNow` writes whatever is owing at the moment it is called.
   */
  useEffect(() => {
    const last = () => {
      void flushNow();
    };
    const hidden = () => {
      if (document.visibilityState === 'hidden') last();
    };
    window.addEventListener('beforeunload', last);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', last);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  /**
   * Take what another tab wrote.
   *
   * Re-read from disk and hydrate, which is the same path a sync pull takes —
   * so the merge, the removed-course guard and everything else that already
   * decides how two copies reconcile applies unchanged.
   */
  /*
   * Another tab of this app changed something.
   *
   * Re-read rather than guess. On the database path the read is asynchronous,
   * so this waits for it; on the old path `loadPersisted` still answers
   * straight away. Either way what arrives goes through `hydrate`, which
   * merges — a second tab is another device as far as the merge is concerned.
   */
  useEffect(
    () =>
      onOtherTab(() => {
        if (!dbAvailable()) {
          fromOtherTab.current = true;
          dispatch({ type: 'hydrate', persisted: loadPersisted() });
          return;
        }
        void loadFromDb().then((fresh) => {
          if (!fresh) return;
          // Set immediately before the dispatch that the write effect will
          // see, not when the nudge arrived: the read in between is
          // asynchronous, and this tab's own edit landing during it would
          // otherwise be silenced.
          fromOtherTab.current = true;
          dispatch({ type: 'hydrate', persisted: fresh });
        });
      }),
    [],
  );

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
      // A session is proof there is an account, however it was arrived at —
      // the Google round trip, a confirmation link opened in another tab, or a
      // browser that still held one from last term. The credentials form marks
      // this too, because with email confirmation on there is no session at
      // the moment the account is made. See `state/shape.ts`.
      if (s) {
        dispatch({ type: 'registered' });
        /*
         * A classmate's referral code waiting on this device, now that there
         * is an account to attach it to. This is the hook because there is no
         * single moment in this app where an account is made — a form, a
         * confirmation link opened in another tab, and three OAuth round trips
         * all end here and nowhere else.
         *
         * It costs a localStorage read and nothing more when there is no code
         * waiting, which is every sign-in but the one after somebody followed
         * a link. A failure leaves the code pending for the next one; nothing
         * on screen is waiting for this. See `lib/referral.ts`.
         */
        void claimPending().catch(() => {});
      }
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
      // The account is `useState` and goes with this provider; the token is a
      // module-level variable in `lib/token.ts` and does not. Left set, it
      // outlives the thing that knows what it is for — and the next provider
      // to mount starts with `account` null and a token still in hand, which
      // is the inverse of the disagreement `lib/assistant.ts` has a whole
      // paragraph about. Clearing it here keeps the two with the same
      // lifetime, which is the only reason they can be reasoned about
      // together. The next mount re-reads the session, so nothing is lost.
      setSessionToken(null);
    };
  }, []);

  /**
   * The pilot's three figures, from what is already true of this account.
   *
   * Signed in only, and there is nothing to decide about that: the call is in
   * this branch and `note_activity` reads the account out of the verified
   * token rather than taking one, so signed out there is neither a caller nor
   * a row. `lib/privacy.ts` says so on the screen, and it is the sentence the
   * whole privacy position rests on.
   *
   * The dependency is the derived marks rather than the state, which is the
   * point of deriving them: this fires when the account arrives and again
   * when one of three facts about it changes — a first course, a first card
   * answered — and on no other render. `lib/activity.ts` is the argument for
   * reading state instead of putting a call at each moment worth counting.
   *
   * Nothing on screen waits for it and a failure is dropped: the guard inside
   * is written only after the call succeeds, so an offline open is retried on
   * the next one rather than counted as done.
   */
  const said = marksFor(state).join(',');
  const marks = useMemo(() => said.split(',') as Mark[], [said]);
  useEffect(() => {
    if (!cloudConfigured || !account) return;
    void noteToday(marks).catch(() => {});
    // `state` is deliberately not a dependency, and the memo above is what
    // makes that honest rather than a suppressed warning: `marks` is a new
    // array only when one of the three facts changes, so this effect cannot
    // fire on a keystroke in a note and cannot miss a course being added.
  }, [account, marks]);

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
      const seen = seenRows();
      const hasRemote = remote.state !== null || remote.courses.length > 0;

      /*
       * A first sign-in with a semester on both sides is the one moment this
       * feature can ruin a term, so it asks instead of deciding.
       *
       * Only on a *first* one — `seenRows()` is null until this device has
       * taken something, and after that the ordinary newest-wins path is right
       * and a dialogue every time would be intolerable. See `lib/adopt.ts`.
       */
      if (hasRemote && seen === null) {
        const here = countRows(pickPersisted(latest.current));
        const there = countRows({
          ...(remote.state as Record<string, unknown>),
          courses: remote.courses,
        });
        const both: Sides = {
          cloud: there.rows,
          local: here.rows,
          cloudCourses: there.courses,
          localCourses: here.courses,
        };
        if (decide(both).do === 'ask') {
          setAsking({ sides: both, say: decide(both).say, remote });
          setSync({ status: 'synced', at: Date.now(), error: '' });
          return refreshSaid({ ...base, took: false }, Date.now());
        }
      }

      /*
       * Rows this device has not taken, rather than a stamp beating a clock.
       * `state/shape.ts` sets out the two ways the old comparison lost work:
       * a device clock on one side of it, and a row that commits after the
       * pull that should have seen it. Neither survives asking this instead.
       */
      const take = hasRemote && unseen(remote.seen, seen);

      if (take) {
        dispatch({
          type: 'hydrate',
          persisted: {
            ...(remote.state as Partial<Persisted>),
            courses: remote.courses.map((c) => c.data as CourseModule),
          },
        });
        markSeen(remote.seen);
      }
      setSync({ status: 'synced', at: Date.now(), error: '' });
      return refreshSaid(
        { ...base, took: take, courses: take ? remote.courses.length : 0, at: take ? remote.updated : 0 },
        Date.now(),
      );
    } catch (e) {
      // The object, not its message: `explainSync` reads PostgREST's `code`
      // and Supabase's `status`, which this line used to drop one step early.
      const { said: error } = explainSync(e);
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
        .then((seen) => {
          // What the database stamped, not what this device's clock says.
          markSeen(seen);
          setSync({ status: 'synced', at: Date.now(), error: '' });
          if (removed.length > 0) dispatch({ type: 'removalsPushed', ids: removed });
        })
        .catch((e: unknown) =>
          setSync({
            status: 'error',
            at: 0,
            error: explainSync(e).said,
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
  /**
   * Whether the sample has finished arriving — landed, or failed.
   *
   * Not the same question as `seed.length > 0`, and the difference is the
   * whole point: before the fetch settles, an empty `seed` means "not yet",
   * and after it fails it means "never". Only one of those is worth waiting
   * on, and the effect that settles the open-course pointer has to tell them
   * apart or it stalls forever on a device with no connection.
   */
  const [sampleIn, setSampleIn] = useState(false);
  useEffect(() => {
    if (!state.sample || seed.length > 0) return;
    let live = true;
    void loadSeed()
      .then((mods) => {
        if (live) setSeed(mods);
      })
      /*
       * Caught, because an uncaught one is worse than the failure.
       *
       * `loadSeed` is four dynamic imports and they reject for the two honest
       * reasons in `data/seed.ts` — no connection, or a deploy since this copy
       * opened. Without this that is an unhandled rejection: noise in a
       * browser console, and a red test run whenever a test unmounts before
       * the imports land, which `npm test` was hitting intermittently on main.
       *
       * There is nothing to show. The sample is an offer, the courses the
       * account actually holds are unaffected, and the next time the toggle is
       * touched the fetch is tried again for real.
       */
      .catch(() => {})
      // Either way the question has been answered, and the pointer below can
      // stop waiting on it.
      .finally(() => {
        if (live) setSampleIn(true);
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

  /*
   * Every term worth switching between.
   *
   * Derived from the courses, plus the one currently open and any that have
   * been closed out. Without those two, closing a term left somebody in a
   * Spring with no courses in it and no switcher — because a switcher of one
   * hides itself — and therefore no way back to the Autumn they had just
   * filed. See `lib/rollover.ts`.
   */
  const terms = useMemo(
    () =>
      sortTerms([
        ...allModules.map((m) => m.course.term ?? LEGACY_TERM),
        ...state.archivedTerms,
        state.term,
      ]),
    [allModules, state.archivedTerms, state.term],
  );

  const codes = useMemo(
    () => Object.fromEntries(allModules.map((m) => [m.course.id, m.course.code])),
    [allModules],
  );
  const courseCode = useCallback((id: string) => codes[id] ?? id.toUpperCase(), [codes]);

  /*
   * Every deadline in the account, across terms. See the note on the field.
   *
   * From `allModules` rather than from the catalogue, which is one term. Flat
   * and unsorted: it is read by id, never drawn in order.
   */
  const allItems = useMemo(
    () => allModules.flatMap((m) => m.items.map((i) => ({ id: i.id, title: i.title }))),
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
   *
   * That fallback stops once a term has been closed out. Somebody who has
   * closed one has said what their terms are, and an empty new term is the
   * point of closing the old one — falling back there put the whole of last
   * semester back on the screen, which is the opposite of what the button
   * says it does. See `lib/rollover.ts`.
   */
  const catalog = useMemo(() => {
    const wanted = allModules.filter((m) => (m.course.term ?? LEGACY_TERM) === state.term);
    const stale = terms.length === 0 || state.archivedTerms.length === 0;
    const showing = wanted.length > 0 || !stale ? wanted : allModules;
    // Sorted here and nowhere else. Every list of courses in the app — the
    // Courses screen, the study picker, the filter chips, the week's colours —
    // is derived from `catalog.modules`, so ordering at the source reaches all
    // of them at once instead of being reapplied, and forgotten, in each.
    /*
     * Timed, because §7.1 names this as the first thing that will slow down:
     * a student with seven courses and their own added readings runs it over
     * an order of magnitude more material than the four shipped ones. The
     * measurement is in memory and goes no further — see `lib/timing.ts`.
     */
    return timed('Catalogue build', over(showing.length, 'course'), () =>
      buildCatalog(arrange(showing, state.yours, state.courseOrder)),
    );
  }, [allModules, state.term, terms, state.archivedTerms, state.yours, state.courseOrder]);

  /**
   * Keep the open course and guide inside the catalogue.
   *
   * `guideId` starts life as 'econ' — a sample course id — and a term switch
   * or a deletion can leave either pointer aimed at a course this catalogue
   * does not hold. The guide screen then renders an empty guide and the
   * course screen has nothing to read at all. One place fixes it.
   *
   * ## Not while the sample is still on its way
   *
   * This is also the effect a deep link lands in front of, and it used to
   * answer before it could know. `#/course/bus` names a sample course; the
   * sample is four dynamic imports that are deliberately not awaited; so on a
   * cold open — a refresh, a bookmark, a link somebody sent, an installed copy
   * reopening — there is one render where `allModules` is the account's own
   * courses alone. The catalogue is not empty, `bus` is not in it *yet*, and
   * this rewrote the pointer to whatever course was to hand. The sample landed
   * a moment later carrying `bus`, and nothing was pointing at it any more.
   *
   * Measured against an account holding one hand-made course: `#/course/bus`
   * opened cold drew that hand-made course instead — no error, no empty state,
   * just somebody else's course under BUS 1600's own address, and the address
   * rewritten to match. Two times out of two.
   *
   * `sampleIn` is the difference between "not in the catalogue" and "not in
   * the catalogue yet", and waiting for it costs nothing: a pointer at a
   * course that has not arrived is a pointer at the course that is arriving.
   * `state/deeplink.test.tsx` holds both halves, the wait and the settling.
   */
  const awaitingSample = state.sample && !sampleIn;
  useEffect(() => {
    if (catalog.empty || awaitingSample) return;
    const first = catalog.courses[0].id;
    const guideId = catalog.byId[state.guideId] ? undefined : first;
    const courseId = catalog.byId[state.courseId] ? undefined : first;
    if (guideId || courseId) dispatch({ type: 'settleCourse', guideId, courseId });
  }, [catalog, state.guideId, state.courseId, awaitingSample]);

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
          done: state.done,
          classes: classesToNudge(railFor(catalog, at, state.appointments)),
          muted: state.mutedCourses,
          registrar: state.registrar,
          /*
           * The four lists `nextPayment` reads, named rather than passed as
           * the whole store. `Held` in `lib/bill.ts` is structural, so this
           * satisfies it — and it is the difference between a dependency
           * array that can be checked and one that says `state` and so
           * re-creates this interval on every keystroke anywhere in the app.
           */
          bill: nextPayment(
            {
              charges: state.charges,
              aid: state.aid,
              payments: state.payments,
              plans: state.plans,
            },
            state.term,
            at,
          ),
          quiet: state.quiet,
          atRisk: atRiskToday(
            railFor(catalog, at, state.appointments),
            state.attendance,
            state.attendPolicy,
            courseCode,
          ),
          // What has to begin, worked out here for the same reason `atRisk`
          // and `bill` are: `lib/notify.ts` decides when to say a thing and
          // never what is true. `planFrom` is the one calibration, so the
          // reminder and the card on Today cannot disagree about the date.
          starts: beginNow(
            planFrom({
              items,
              done: state.done,
              spent: state.spent,
              windows: state.windows,
              now: at,
            }),
          ),
        }),
      );
      // The student's own rules, fired through the same `fire` — which keeps
      // the seen list, so a custom reminder is subject to the same "once" as
      // every built-in one. They add and never subtract: see `lib/myrules.ts`.
      fire(
        myReminders(at, state.myRules, items, state.done).map((f) => ({
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
    // `state.done` is in here for a reason: the interval closes over it, so
    // without it a tick made after the effect was set up would not be seen
    // until something else in this list changed, and the reminders would keep
    // naming work already handed in. Re-creating the interval is free — the
    // list of what has already fired lives in storage, not in this closure.
    //
    // The same reasoning covers the six below, which were missing.
    // `state.quiet` is the worst of them: quiet hours gate whether anything
    // fires at all, so a student who set them at eleven at night went on
    // being notified through the night — the interval was still holding the
    // window as it stood when the effect last ran. `state.term` and the four
    // it reads through `nextPayment` — charges, aid, payments and plans — are
    // the same failure one screen over: a bill paid in full kept being
    // nudged about until an unrelated part of this list happened to change.
    //
    // `state.spent` and `state.windows` join them for the start rule, and they
    // are the same hazard again rather than a new one: both feed the runway,
    // so an interval holding a stale copy would go on working backwards
    // through last week's working hours, and the start date it named would be
    // a day the student had already changed their mind about.
  }, [catalog, state.notifs, state.mutedCourses, state.appointments, state.registrar, state.myRules, state.attendance, state.attendPolicy, state.done, state.quiet, state.term, state.charges, state.aid, state.payments, state.plans, state.spent, state.windows, courseCode]);

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
   * The address bar follows the app, and the app follows the address bar.
   *
   * Every screen had the same URL, which costs the four things anybody expects
   * of a browser: Back and Forward, a refresh that lands where you were, a
   * bookmark of the thing rather than of the app, and a link somebody can
   * send. `lib/route.ts` has the shape and says why it is a hash.
   *
   * Writing is the easy half: whenever the route changes, push an entry —
   * except when only the study mode moved, which is the same place read a
   * different way and would otherwise make Back walk somebody through every
   * mode they tried.
   */
  // Read during render rather than inside the memo, so the dependency is the
  // one field that actually matters rather than all five of them.
  const named = NAMED[state.screen];
  const routeId = named && typeof state[named] === 'string' ? (state[named] as string) : '';
  const route = useMemo<Route>(
    () => ({
      screen: state.screen,
      id: routeId,
      ...(state.screen === 'guide' ? { mode: state.mode } : {}),
    }),
    [state.screen, routeId, state.mode],
  );
  const shown = useRef<Route | null>(null);

  useEffect(() => {
    if (same(shown.current, route)) return;
    const url = toHash(route);
    try {
      if (replaces(shown.current, route)) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    } catch {
      // A sandboxed frame refuses to write history. The app still works; it
      // just does not get an address, which is the thing being added rather
      // than a thing being taken away.
    }
    shown.current = route;
  }, [route]);

  /*
   * And the trail follows it, which is the same event said once more.
   *
   * Here rather than in a component of its own, and here rather than in
   * `push`: this effect is the only thing in the app that already knows *where
   * the app is* as one value — `NAMED` against the state, the id included,
   * once per place rather than once per render. `push` cannot do it because a
   * reducer is pure and the trail is on the device, and a second computation
   * of "where are we" somewhere else would be a second answer to drift out of
   * step with the address bar. `lib/trail.hook.ts` says the rest.
   *
   * The mode is deliberately not passed. Reading a guide as slides is the same
   * place read differently — the reason `replaces` exists two lines up — and a
   * history with four rows for one course guide is one nobody scrolls twice.
   */
  useEffect(() => {
    recordVisit(route.screen, route.id);
  }, [route.screen, route.id]);

  /*
   * And the other way: Back, Forward, or a hash typed by hand.
   *
   * `landed` rather than `go`, because the entry already exists — pushing
   * another would mean Back stopped working the second time it was pressed.
   */
  useEffect(() => {
    const moved = () => {
      const asked = fromHash(window.location.hash);
      if (!asked) return;

      /*
       * Which part of a merged screen the link meant — *before* the identity
       * check below, not after it.
       *
       * `same()` compares screen, id and mode, and two routes differing only
       * in `opens` are equal to it. That was harmless while every retired
       * screen merged into a *different* screen: `#/weekly` lands on `brief`,
       * which is never where you already were, so the guard never fired and
       * the grain was always applied.
       *
       * `#/ahead` and `#/tonight` merged into `home`, and Today is exactly the
       * screen somebody is most likely to already be standing on. Then the
       * guard reads "same place, nothing to do" and returns before the tab is
       * ever set, so the link lands on Today's default tab — the promise
       * technically kept and actually broken, from the one line written to
       * prevent it. Measured: both addresses came up on the Today tab.
       *
       * Dispatching first is safe because `hashchange` only fires when the
       * hash actually changed, and every one of these is idempotent.
       */
      if (asked.opens?.report) dispatch({ type: 'setReport', grain: asked.opens.report });
      if (asked.opens?.changes) dispatch({ type: 'setChanges', source: asked.opens.changes });
      if (asked.opens?.courses) dispatch({ type: 'setCoursesTab', tab: asked.opens.courses });
      if (asked.opens?.home) dispatch({ type: 'setHomeTab', tab: asked.opens.home });

      if (same(asked, shown.current)) return;
      shown.current = asked;
      dispatch({ type: 'landed', screen: asked.screen, id: asked.id, mode: asked.mode });
    };
    window.addEventListener('popstate', moved);
    window.addEventListener('hashchange', moved);
    return () => {
      window.removeEventListener('popstate', moved);
      window.removeEventListener('hashchange', moved);
    };
  }, []);

  /*
   * One copy of the account per day, taken by the app rather than remembered
   * by the person.
   *
   * Once, on the first render of a session, and only if today has not had one.
   * Not on every dispatch: a snapshot on every keystroke would be a write
   * storm and a week of history that spans four hours. The copy is of the
   * state as it stands when the app opens — before the day's mistakes rather
   * than after them, which is the whole point.
   *
   * Deliberately not awaited and deliberately unable to fail loudly:
   * `takeSnapshot` swallows its own errors and returns null, because a device
   * that will not store history must still be a device that runs the app.
   */
  useEffect(() => {
    // Nothing to protect yet. Measured across everything a backup carries
    // rather than by counting courses: somebody running on the bundled sample
    // semester has no rows in `courses` at all, and their ticks, notes and
    // grades are exactly as much their own work as an imported course is.
    const mine = backupOf(latest.current) as unknown as Record<string, unknown>;
    if (Object.values(countsOf(mine)).every((n) => n === 0)) return;
    void takeDaily(mine);
  }, []);

  /*
   * The bundled profile is the fallback, not the loser.
   *
   * Nothing is fetched here yet — the account row lands in a later phase. What
   * matters now is that a Vanderbilt student opening this offline, signed out,
   * on a first launch gets the full profile with no network call, which is the
   * guarantee the rest of the app already keeps.
   */
  const school = useMemo(
    () => resolveSchool(state.schoolId, null, state.mySchools, state.schoolPack?.school ?? null),
    [state.schoolId, state.mySchools, state.schoolPack],
  );

  /**
   * How far along this semester is, for progressive disclosure.
   *
   * Facts about the coursework, never about how often the app has been opened
   * — "you have used this five times" is not a reason to be shown anything.
   * See `lib/reveal.ts`.
   */
  const facts = useMemo<Facts>(
    () => ({
      courses: catalog.courses.length,
      hasExam: catalog.items.some((i) => /exam|midterm|final/i.test(`${i.kind} ${i.title}`)),
      notes: state.notes.length,
      sittings: state.sittings.length,
      ownThings: state.tasks.length + state.appointments.length,
      terms: terms.length || 1,
      signedIn: Boolean(account),
      athlete: state.athlete,
    }),
    [catalog, state.notes, state.sittings, state.tasks, state.appointments, terms, account, state.athlete],
  );

  /**
   * Acting on the answer, and writing the file before either overwrite.
   *
   * The backup is what is on the device right now, saved to the student's
   * downloads before anything replaces it. It is written first and awaited by
   * nothing — a browser that refuses the download must not stop somebody
   * getting on with their term, and the two options that need it both say so
   * on the button.
   */
  const settle = useCallback(
    (choice: Choice, backup: string | null) => {
      if (!asking) return;
      const { remote } = asking;
      if (backup) {
        try {
          const blob = new Blob([JSON.stringify(pickPersisted(latest.current), null, 2)], {
            type: 'application/json',
          });
          const url = globalThis.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = backup;
          a.click();
          setTimeout(() => globalThis.URL.revokeObjectURL(url), 30_000);
        } catch {
          // A browser that will not save a file is not a reason to lose the
          // choice; the two destructive options are still the student's.
        }
      }

      // `merge` and `cloud` both hydrate — the difference is that a merge keeps
      // this device's rows because `hydrate`'s merge is a union, while `cloud`
      // clears them first so the account's copy is what is left.
      if (choice === 'device') {
        // Nothing to take, so what is recorded is the account as it was just
        // read — this device has seen it and chosen against it. The push effect
        // sends this device up on its next run, which is what makes it the
        // account's copy too, and records its own stamps when it does.
        markSeen(remote.seen);
      } else {
        if (choice === 'cloud') dispatch({ type: 'wipeLocalForAdopt' });
        dispatch({
          type: 'hydrate',
          persisted: {
            ...(remote.state as Partial<Persisted>),
            courses: remote.courses.map((c) => c.data as CourseModule),
          },
        });
        markSeen(remote.seen);
      }
      setAsking(null);
    },
    [asking],
  );

  /**
   * Take the shipped semester on as your own.
   *
   * Here rather than in a screen because `seed` is loaded lazily in this file
   * and a screen has no way to reach it. Does nothing when there is nothing
   * loaded, so a tap before the modules arrive is a no-op rather than an
   * adoption of an empty list.
   */
  const adopt = useCallback(() => {
    if (seed.length === 0) return;
    dispatch({ type: 'adoptSeed', modules: seed });
  }, [seed]);

  const say = useCallback(
    (said: string, to?: Screen) => dispatch({ type: 'say', said, at: Date.now(), to }),
    [dispatch],
  );

  /*
   * The course palette, worked out once per look and once per course list.
   *
   * `prefersDark` is read here for the same reason `App.tsx` reads it: the
   * stored ground can be "match my device", and a tint drawn for a light
   * ground on a dark screen is the one failure this whole file is arranged to
   * avoid.
   */
  const prefersDark = usePrefersDark();
  const tints = useMemo(
    () =>
      tintsFor(
        catalog.courses.map((c) => c.id),
        {
          accent: state.accent,
          hue: state.hue,
          light: groundOf(resolveGround(state.ground, prefersDark)).light,
          on: state.courseColours !== 'off',
          /*
           * A colour somebody chose for a course themselves.
           *
           * `state.yours` has held one since long before the palette existed —
           * an accent id, opt-in, and drawn on exactly two screens. It is the
           * override now rather than a second scheme: the accent names a hue,
           * the hue joins the palette, and the course wears it everywhere the
           * derived ones are worn. One home for "this course is orange", which
           * is the home it was already in.
           */
          pinned: Object.fromEntries(
            Object.entries(state.yours)
              .filter(([, mine]) => mine?.tint)
              .map(([id, mine]) => [id, anchorHue(mine.tint, -1)]),
          ),
        },
      ),
    [catalog, state.accent, state.hue, state.ground, prefersDark, state.courseColours, state.yours],
  );
  const tint = useCallback(
    (id: string | null | undefined): CourseTint => (id ? (tints[id] ?? ACCENT_TINT) : ACCENT_TINT),
    [tints],
  );

  const value = useMemo(
    () => ({ state, dispatch, catalog, terms, courseCode, allItems, tint, lastSeen: lastSeen.current, account, sync, saveTrouble, refresh, say, school, facts, asking, settle, adopt }),
    [state, catalog, terms, courseCode, allItems, tint, account, sync, saveTrouble, refresh, say, school, facts, asking, settle, adopt],
  );
  /*
   * The clock is published beside the store, not inside it.
   *
   * Nested rather than side by side, and that is the whole mechanism: when the
   * minute changes, only this provider's value is new. `StoreContext`'s is
   * unchanged, so the ninety-five components that read the store without
   * reading the clock are not re-rendered — and `children` is a prop whose
   * element identity does not change, so React bails out of the subtree and
   * visits only the `useNow()` consumers.
   */
  return (
    <StoreContext.Provider value={value}>
      <NowContext.Provider value={now}>{children}</NowContext.Provider>
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

