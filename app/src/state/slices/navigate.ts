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
import { ROOTS, type Action, type State } from '../shape';
import { ONB_STEPS } from '../../data/misc';
import { dayOf } from '../../lib/date';

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

/** Go somewhere, and leave a way back. Used by four of the eight slices. */
export function push(state: State, screen: Screen): State {
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
    visited: state.visited[screen] ? state.visited : { ...state.visited, [screen]: true },
    // Rounded to the day it happened. See `lastOpened` in `state/shape.ts`
    // for why the finer number is deliberately not kept, and why this is
    // written on the way in rather than counted.
    lastOpened: { ...state.lastOpened, [screen]: dayOf(Date.now()) },
  };
}

export function navigate(state: State, action: Action): State | null {
  switch (action.type) {
    case 'quickAdd':
      return { ...state, quickAdd: action.open };

    case 'finder':
      return { ...state, finder: action.open };

    case 'apps':
      return { ...state, apps: action.open };

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
      if (action.screen === state.screen && !action.id && !action.mode) return state;
      const back = state.history[state.history.length - 1] === action.screen;
      const field = action.id
        ? {
            course: 'courseId',
            edit: 'courseId',
            grades: 'courseId',
            item: 'itemId',
            event: 'eventId',
            guide: 'guideId',
            drill: 'guideId',
            quiz: 'guideId',
            lesson: 'guideId',
            slides: 'guideId',
            note: 'noteId',
          }[action.screen as string]
        : undefined;
      return {
        ...state,
        screen: action.screen,
        history: back ? state.history.slice(0, -1) : state.history,
        ...(field ? { [field]: action.id } : {}),
        ...(action.mode ? { mode: action.mode } : {}),
      };
    }

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

    case 'setFilter':
      return { ...state, filter: action.filter };

    case 'setEvFilter':
      return { ...state, evFilter: action.filter };

    case 'setQuery':
      return { ...state, query: action.query };

    case 'setCalTab':
      return { ...state, calTab: action.tab };

    case 'setHomeTab':
      return { ...state, homeTab: action.tab };

    case 'setCoursesTab':
      return { ...state, coursesTab: action.tab };

    case 'setCostsTab':
      return { ...state, costsTab: action.tab };

    case 'setMeTab':
      return { ...state, meTab: action.tab };

    case 'setMeGroup':
      return { ...state, meGroup: action.group };

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

    case 'onbNext':
      return state.onb >= ONB_STEPS - 1
        ? { ...state, screen: 'home', history: [], seenOnboarding: true, onb: 0 }
        : { ...state, onb: state.onb + 1 };

    case 'restartOnboarding':
      return { ...state, screen: 'onboarding', history: [], onb: 0 };

    case 'finishOnboarding':
      return { ...state, screen: 'home', history: [], seenOnboarding: true, onb: 0 };

    case 'setLoadStep':
      return { ...state, loadStep: action.step };

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

    case 'writeMail':
      return {
        ...push(state, 'mail'),
        mailSeed: {
          purposeId: action.purposeId,
          courseId: action.courseId ?? '',
          to: action.to ?? '',
          incoming: action.incoming ?? '',
          // Carried so an email opened from a deadline arrives with that
          // deadline already named. Naming the assignment and its date is
          // most of what turns a vague email into an answerable one, and
          // re-picking it from a list of thirty-eight is the step at which
          // people gave up.
          itemId: action.itemId ?? '',
        },
      };

    default:
      return null;
  }
}
