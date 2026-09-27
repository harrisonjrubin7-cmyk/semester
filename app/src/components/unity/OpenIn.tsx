import { useStore } from '../../state/store';
import type { CourseId, Screen } from '../../lib/types';

/** One place a thing can be opened in, carrying the context it is opened with. */
export interface OpenTarget {
  /** "Plan", "Study", "Calendar" — the destination, as the student would say it. */
  label: string;
  screen: Screen;
  /** The course this is about, so the destination opens on it rather than on a list. */
  courseId?: CourseId;
}

/**
 * "Open in" — the way from one thing to every place it matters.
 *
 * A course is also a plan, a study guide and a week on the calendar, and a
 * student should never have to go home and start again to get from one to
 * the other. Each target is an ordinary navigation, so it follows the app's
 * one history rule (`push` in `state/slices/navigate.ts`): opening a screen
 * inside a section writes an entry and Back returns to exactly where this
 * was pressed — the "return route" the brief asks for. Opening one of the
 * tab bar's own roots is a tab switch, and resets the stack the way pressing
 * that tab does; it would be a second rule for the same move otherwise.
 *
 * Buttons with words, never icons alone, and a row that wraps on a phone.
 */
export function OpenIn({ targets, about }: { targets: OpenTarget[]; about: string }) {
  const { dispatch } = useStore();
  if (targets.length === 0) return null;
  const go = (t: OpenTarget) => {
    if (t.courseId && t.screen === 'course') dispatch({ type: 'openCourse', id: t.courseId });
    else if (t.courseId && t.screen === 'guide') dispatch({ type: 'openGuide', id: t.courseId });
    else dispatch({ type: 'go', screen: t.screen, courseId: t.courseId });
  };
  return (
    <div className="open-in" role="group" aria-label={`Open ${about} in`}>
      <span className="open-in-label" aria-hidden="true">
        Open in
      </span>
      {targets.map((t) => (
        <button key={`${t.screen}-${t.label}`} type="button" className="pill-soft tap-y" onClick={() => go(t)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
