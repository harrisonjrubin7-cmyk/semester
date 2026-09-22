/**
 * Getting from one screen to another.
 *
 * Every route in the app funnels through `push`, which is why the back stack,
 * the tab-mode reset and the list of where you have been lately all live here
 * rather than in whichever screen happened to need them first.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import type { Screen } from '../../lib/types';
import { LIBRARIES, NAMED } from '../../lib/route';
import { ROOTS, type Action, type State } from '../shape';
import { ONB_STEPS } from '../../data/misc';
import { firstScreen } from '../../lib/chrome';

/**
 * Where the run lets somebody out, which is not the same as where the app
 * opens.
 *
 * It used to be `firstScreen` for everybody, and on a fresh install that is
 * Today with the shipped semester in it. Driven end to end, pressing the
 * primary button five times and reading the screen it landed on:
 *
 *     NEXT CLASS · IN 9 HR 46 MIN · 11:00a · BUS 1600 · Alumni Hall 201
 *     DUE TODAY · 0 of 1 done · "One thing left. Finish it."
 *       CORE 2500 QUIZ — Quiz #3 — Foer, "How Soccer Explains…"
 *       Before class, 1:15p · Brightspace
 *     6 deadlines went by unticked in the last three weeks.
 *
 * `SampleMark` says at the top of that screen which semester it is, and says
 * it well. What no part of it says is how to get your own — the only route is
 * the `+` in the header, and a student who has just been told "drop one in"
 * has to go looking for the door they were promised.
 *
 * So a run that ends with nothing of the student's own ends **on** that door.
 * With courses already in, nothing changes: somebody reopening the run from
 * the guidebook is not being set up, and lands where the app opens.
 *
 * `finishOnboarding` — the Skip below it — is deliberately not this. Skip
 * means stop showing me things, and answering it with a form would be the
 * opposite of what was asked.
 */
function doneScreen(state: State): Screen {
  return state.courses.length === 0 ? 'import' : firstScreen(state.nav);
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

/**
 * The two panels that must never outlive the screen they were opened over.
 *
 * `finder` and `apps` are drawn above everything, are not persisted, and have
 * no idea the app moved underneath them — so without this a search opened on
 * Today was still covering Courses a moment later, and the browser's Back
 * button left it there too. Closing them belongs here, in the funnel every
 * route goes through, rather than in an effect inside each panel: there are
 * three ways to navigate and a panel that listens for one of them is a panel
 * that survives the other two.
 *
 * Returns the same object when neither is open, so the ordinary navigation
 * allocates nothing.
 */
function dismiss(state: State): State {
  return state.finder || state.apps ? { ...state, finder: false, apps: false } : state;
}

/** Go somewhere, and leave a way back. Used by four of the eight slices. */
export function push(state: State, screen: Screen): State {
  state = dismiss(state);
  if (screen === state.screen) return state;
  // In tab mode a root screen is a destination, so the back stack resets. In
  // feed mode there is no tab bar, so every screen except the feed itself has
  // to stay reachable backwards or it becomes a dead end.
  const resets = ROOTS.includes(screen) && (state.nav === 'tabs' || screen === 'home');
  const history = resets ? [] : [...state.history, state.screen];
  return {
    ...state,
    screen,
    history,
    recent: remember(state.recent, screen),
    // Written on the way in rather than counted: how many times somebody
    // opened the map is not the app's business, and whether they ever did is
    // the only part that makes a difference to what it offers them.
    /*
     * Whether, not when.
     *
     * `lastOpened` was written here too — the day each screen was opened, on
     * every navigation — and the twenty-third simplify pass cut it: no
     * screen in this repository's history ever read it. Its own docblock
     * carried the rule that condemned it, *what a feature does not need is
     * not stored*, and there was no feature. This line is the whole of what
     * the app actually asks about where somebody has been, beside `recent`
     * just above, which is the order rather than the dates.
     */
    visited: state.visited[screen] ? state.visited : { ...state.visited, [screen]: true },
  };
}

export function navigate(state: State, action: Action): State | null {
  switch (action.type) {
    /*
     * One shared panel at a time.
     *
     * All three of these cover the screen, and opening one over another left
     * two stacked with only the top one dismissable — the app launcher opened
     * from behind the search panel could not be reached to close it. Opening
     * any one closes the others; closing one is left alone, because a close
     * is never ambiguous.
     */
    case 'quickAdd':
      return { ...state, quickAdd: action.open, ...(action.open ? { finder: false, apps: false } : {}) };

    case 'finder':
      return { ...state, finder: action.open, ...(action.open ? { apps: false } : {}) };

    case 'apps':
      return { ...state, apps: action.open, ...(action.open ? { finder: false } : {}) };

    case 'customize':
      return { ...state, customize: action.open };

    case 'go':
      return push(
        action.courseId ? { ...state, guideId: action.courseId } : state,
        action.screen,
      );

    /**
     * The browser went somewhere, so the app follows it there.
     *
     * No `push`: the entry already exists, and pushing another would mean
     * Back stopped working the second time somebody pressed it. The internal
     * stack is popped when the landing is a step backwards, so the in-app
     * chevron and the browser button keep saying the same thing.
     */
    case 'landed': {
      /*
       * A library screen is never a no-op landing.
       *
       * `#/write` and `#/write/<id>` are the same screen with different
       * contents, so the early return below — right for every screen whose id
       * cannot change without the screen changing — would drop the whole
       * point of the address. It is what made opening a second document from
       * a bookmark leave the first one on screen.
       */
      // The browser moved, which is a navigation like any other. See `dismiss`.
      state = dismiss(state);
      const library = LIBRARIES.includes(action.screen);
      if (action.screen === state.screen && !action.id && !action.mode && !library) return state;
      const back = state.history[state.history.length - 1] === action.screen;
      /*
       * Which field the id in the address belongs in.
       *
       * `NAMED` in `lib/route.ts`, not a copy of it. This was a second table
       * with the same ten rows in it, which is the arrangement where a screen
       * added to one is missing from the other: the address bar would carry
       * `#/call/bcd-fghj-kmn` and Back would land on the call screen with no
       * code in it. `lib/route.ts` imports nothing at runtime, so reading the
       * one table here costs nothing and cannot drift.
       */
      const field = action.id || library ? NAMED[action.screen] : undefined;
      return {
        ...state,
        screen: action.screen,
        history: back ? state.history.slice(0, -1) : state.history,
        // `|| null` for the library case: landing on the shelf means no file
        // is open, and leaving the old id in place would reopen it instead.
        ...(field ? { [field]: action.id || null } : {}),
        ...(action.mode ? { mode: action.mode } : {}),
      };
    }

    case 'back': {
      const history = [...state.history];
      const prev = history.pop();
      return { ...dismiss(state), screen: prev ?? 'home', history };
    }

    case 'openItem':
      return push({ ...state, itemId: action.id }, 'item');

    case 'openCourse':
      return push({ ...state, courseId: action.id }, 'course');

    case 'openEvent':
      return push({ ...state, eventId: action.id }, 'event');

    case 'openCall': {
      /*
       * `push` refuses to move to the screen you are already on, which is
       * right for every other screen and wrong for this one: joining a call
       * from the lobby changes the code without changing the screen, and the
       * early return would drop the code on the floor.
       */
      const next = { ...state, callCode: action.code };
      return state.screen === 'call' ? next : push(next, 'call' as Screen);
    }

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

    case 'setFilter':
      return { ...state, filter: action.filter };

    case 'setEvFilter':
      return { ...state, evFilter: action.filter };

    case 'setHomeTab':
      return { ...state, homeTab: action.tab };

    case 'setCoursesTab':
      return { ...state, coursesTab: action.tab };

    case 'setCostsTab':
      return { ...state, costsTab: action.tab };

    case 'setMeTab':
      return { ...state, meTab: action.tab };

    case 'setTone':
      return { ...state, tone: action.tone };

    case 'setDueTab':
      return { ...state, dueTab: action.tab };

    case 'setStudyTab':
      return { ...state, studyTab: action.tab };

    case 'setMineTab':
      return { ...state, mineTab: action.tab };

    case 'setMathTab':
      return { ...state, mathTab: action.tab };

    /*
     * Where setting up lets you out.
     *
     * `firstScreen` rather than a literal `home`, so finishing onboarding
     * lands where opening the app lands. The workspace opens on its search
     * page, and hard-coding home here was the difference between "the app
     * opens on the search home" and "the app opens on the search home unless
     * you have just set it up" — which is the first thing anybody sees.
     */
    case 'onbNext':
      return state.onb >= ONB_STEPS - 1
        ? { ...state, screen: doneScreen(state), history: [], seenOnboarding: true, onb: 0 }
        : { ...state, onb: state.onb + 1 };

    case 'restartOnboarding':
      return { ...state, screen: 'onboarding', history: [], onb: 0 };

    case 'finishOnboarding':
      return { ...state, screen: firstScreen(state.nav), history: [], seenOnboarding: true, onb: 0 };

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

    /*
     * `writeMail` was here, and is in `slices/mailbox.ts` now.
     *
     * It navigated to the mailbox and wrote a `mailSeed` that nothing read,
     * so it opened no composer — `SIMPLIFY-AUDIT.md` F1. Making it open one
     * means creating a `MailDraft`, which is what the mailbox slice already
     * does for `composeMail`, so it belongs beside that rather than here with
     * a second copy of it. It still navigates: `push` is exported from this
     * file and that slice already imports it.
     */

    default:
      return null;
  }
}
