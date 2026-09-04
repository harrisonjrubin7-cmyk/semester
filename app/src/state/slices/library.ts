/**
 * Courses, the material added to them, and the account copy.
 *
 * The largest slice, and the one where losing a write costs the most: a
 * course is a syllabus somebody imported, and `hydrate` is another device's
 * whole semester arriving at once. The merge it uses is in `lib/merge.ts`.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { newId } from '../../lib/files';
import { mergePersisted } from '../../lib/merge';
import { LANDMARKS, apply, sheet } from '../../lib/registrar';
import type { CampusLink, FeedSource } from '../../lib/types';
import type { Action, State } from '../shape';

export function library(state: State, action: Action): State | null {
  switch (action.type) {
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

    // The university's own dates. `sheet` fills in any landmark the saved copy
    // does not have, so setting one date on a fresh account produces a whole
    // sheet with one row filled rather than a list of one.
    case 'setTermDate':
      return {
        ...state,
        registrar: sheet(state.registrar).map((d) =>
          d.id === action.id ? { ...d, iso: action.iso, until: action.until ?? '' } : d,
        ),
      };

    case 'addTermDate': {
      const label = action.label.trim() || 'A date of your own';
      return {
        ...state,
        registrar: [
          ...sheet(state.registrar),
          {
            id: newId(),
            label,
            iso: action.iso,
            until: action.until ?? '',
            cost: '',
            kind: action.until ? 'break' : 'deadline',
          },
        ],
      };
    }

    // A landmark is emptied rather than removed — it is part of the sheet and
    // will be asked for again. One of your own goes for good.
    case 'dropTermDate':
      return {
        ...state,
        registrar: sheet(state.registrar)
          .map((d) => (d.id === action.id ? { ...d, iso: '', until: '' } : d))
          .filter((d) => d.iso !== '' || LANDMARKS.some((l) => l.id === d.id)),
      };

    case 'applyRegistrar':
      return { ...state, registrar: apply(state.registrar, action.found) };

    case 'setTerm':
      return { ...state, term: action.term };

    // Switching term, or deleting a course, can leave the open course and the
    // open guide pointing at something the catalogue no longer holds. The
    // store notices and says what to point at instead; doing it here rather
    // than in the nine screens that read these ids is what keeps them all
    // able to assume the id is good.
    case 'settleCourse':
      return {
        ...state,
        guideId: action.guideId ?? state.guideId,
        courseId: action.courseId ?? state.courseId,
      };

    case 'setSample':
      return { ...state, sample: action.on };

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

    default:
      return null;
  }
}
