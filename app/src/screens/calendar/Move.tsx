import { useState } from 'react';
import { useStore } from '../../state/store';
import { Blueprint } from '../../components/Blueprint';
import { isoToDate, longLabel } from '../../lib/date';
import { timeLabel } from '../../lib/drag';
import type { CourseId } from '../../lib/types';

/**
 * What a drag on the calendar is allowed to move, and what happens when it lands.
 *
 * Four kinds of thing are drawn on this calendar and they are not the same
 * kind of fact, so they do not behave the same under a finger. That difference
 * is the whole design here — a calendar where everything slides equally would
 * be a calendar that had quietly stopped distinguishing between what you wrote
 * down and what a professor stated.
 *
 *   **Your tasks and your appointments** move freely. They are yours; nobody
 *   else's record of them exists; a mis-drop costs one Undo.
 *
 *   **A syllabus deadline** moves only after you say so, in a sentence naming
 *   both dates. It is a claim about what a document says, and the app's whole
 *   premise is being right about that. So the move goes through the same door
 *   `screens/EditCourse.tsx` uses, it records where the date came from, and it
 *   never touches the quote or its page citation — the sentence out of the PDF
 *   is not the student's to edit, only the date they keep beside it.
 *
 *   **A class or a campus event** does not move at all. A class is a recurring
 *   pattern and dragging one instance would either rewrite the timetable or
 *   invent a one-off the data has no room for; a campus event is somebody
 *   else's. Both refuse, and say what you can do instead rather than sitting
 *   there inert.
 */
export type Movable =
  | { kind: 'task'; id: string; title: string }
  | { kind: 'appointment'; id: string; title: string; minutes: number }
  | { kind: 'item'; id: string; courseId: CourseId; title: string; code: string };

/** Where a drop landed: a day, and an hour when the view has one. */
export interface Landing {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Minutes past midnight, on the grids with an hour axis. */
  at?: number;
}

/** A syllabus move, waiting to be confirmed. */
interface Asking {
  what: Movable & { kind: 'item' };
  to: Landing;
  was: string;
}

export function useCalendarMove() {
  const { state, dispatch, say } = useStore();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [refused, setRefused] = useState('');

  /** Only a course you own can be changed — the sample four are compiled in. */
  const owned = (courseId: CourseId) => state.courses.find((c) => c.course.id === courseId);

  const move = (what: Movable, to: Landing) => {
    setRefused('');
    const when = longLabel(isoToDate(to.date));

    if (what.kind === 'task') {
      dispatch({ type: 'moveTask', id: what.id, date: to.date });
      say(`Moved · ${what.title} to ${when}.`, 'mine');
      return;
    }

    if (what.kind === 'appointment') {
      const at = to.at ?? what.minutes;
      dispatch({
        type: 'moveAppointment',
        id: what.id,
        date: to.date,
        at,
        time: timeLabel(at),
      });
      say(`Moved · ${what.title} to ${when}, ${timeLabel(at)}.`, 'calendar');
      return;
    }

    // A deadline out of a syllabus. Never silently.
    const module = owned(what.courseId);
    if (!module) {
      setRefused(
        `${what.code} is one of the courses built into the app, so its dates are fixed. Take the semester on under Edit the course to change one.`,
      );
      return;
    }
    const item = module.items.find((i) => i.id === what.id);
    if (!item) return;
    const from = new Date(item.year ?? new Date().getFullYear(), item.month, item.day);
    setAsking({ what, to, was: longLabel(from) });
  };

  const confirm = () => {
    if (!asking) return;
    const date = isoToDate(asking.to.date);
    dispatch({
      type: 'moveItem',
      courseId: asking.what.courseId,
      itemId: asking.what.id,
      month: date.getMonth(),
      day: date.getDate(),
      year: date.getFullYear(),
    });
    say(`Moved · ${asking.what.code} ${asking.what.title} to ${longLabel(date)}.`, 'calendar');
    setAsking(null);
  };

  /**
   * What a drop on a class or a campus event says.
   *
   * A gesture that does nothing reads as a broken gesture, so the refusal
   * names the reason and the thing you can actually do.
   */
  const refuse = (why: 'class' | 'event') => {
    setRefused(
      why === 'class'
        ? 'A class is the timetable repeating, not a single entry — moving one here would either rewrite every week or invent a one-off. Cancel this one, or change the pattern, under Edit the course.'
        : 'A campus event is somebody else’s date. You can save it, and it will follow whatever they do with it.',
    );
  };

  /**
   * The two things a move has to be able to draw.
   *
   * Rendered by whichever view is on screen, so the question appears over the
   * calendar the drop happened on rather than in a dialog somewhere else.
   */
  const notice = (
    <>
      {asking && (
        <Blueprint
          role="alertdialog"
          aria-label="Move a deadline the syllabus set"
          style={{ padding: 'var(--sp-6) var(--sp-7)', marginTop: 'var(--sp-5)' }}
        >
          <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
            Move <strong>{asking.what.code} {asking.what.title}</strong> to{' '}
            {longLabel(isoToDate(asking.to.date))}?
          </div>
          <div style={{ fontSize: 'var(--type-sm)', opacity: 0.65, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
            The syllabus says {asking.was}. Both dates are kept, and the sentence it came from is
            not touched.
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirm}
              style={{ flex: 1, height: 40 }}
            >
              Move it
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAsking(null)}
              style={{ flex: 1, height: 40 }}
            >
              Leave it
            </button>
          </div>
        </Blueprint>
      )}

      {refused && (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-sm)',
            opacity: 0.75,
            marginTop: 'var(--sp-5)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {refused}
        </div>
      )}
    </>
  );

  return { move, refuse, notice, asking: asking !== null };
}
