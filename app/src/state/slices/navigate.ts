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
  };
}

export function navigate(state: State, action: Action): State | null {
  switch (action.type) {
    case 'quickAdd':
      return { ...state, quickAdd: action.open };

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

    case 'setMeTab':
      return { ...state, meTab: action.tab };

    case 'setMeGroup':
      return { ...state, meGroup: action.group };

    case 'setDueTab':
      return { ...state, dueTab: action.tab };

    case 'setStudyTab':
      return { ...state, studyTab: action.tab };

    case 'setMineTab':
      return { ...state, mineTab: action.tab };

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
        },
      };

    default:
      return null;
  }
}
