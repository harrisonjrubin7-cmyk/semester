/**
 * Present, absent, excused — three taps on a class that has happened.
 *
 * It sits on the day rail, where the classes already are, rather than on a
 * screen of its own. A separate attendance screen is a thing you visit on
 * purpose, which nobody does daily; the rail is where a student already looks
 * to see what today holds.
 *
 * ## Only for a class that has started
 *
 * Marking Friday's lecture on Tuesday is not a record of anything. The control
 * appears once the class has begun and stays available afterwards, because the
 * honest moment to record an absence is usually the evening, not the hour.
 *
 * ## Nothing is filled in for you
 *
 * No default once a class ends, no inference from anything. An unmarked class
 * is unmarked and the budget says how many are — see `lib/attend.ts`. The one
 * number a student cannot afford the app to be confidently wrong about is how
 * many absences they have left.
 */

import { useStore } from '../state/store';
import { markOn, type Mark } from '../lib/attend';
import type { CourseId } from '../lib/types';

const CHOICES: { mark: Mark; label: string; short: string }[] = [
  { mark: 'present', label: 'Went', short: 'Went' },
  { mark: 'absent', label: 'Missed', short: 'Missed' },
  { mark: 'excused', label: 'Excused', short: 'Excused' },
];

export function MarkClass({
  courseId,
  date,
  started,
}: {
  courseId: CourseId;
  /** The day, as `YYYY-MM-DD`. */
  date: string;
  /** Whether the class has begun. Nothing to record before it has. */
  started: boolean;
}) {
  const { state, dispatch, courseCode } = useStore();
  const now = markOn(state.attendance, courseId, date);

  if (!started) return null;

  return (
    <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
      {CHOICES.map((c) => {
        const on = now === c.mark;
        return (
          <button
            key={c.mark}
            type="button"
            className="bare tappable"
            // Tapping the mark it already has clears it. A log with no way
            // back is a log mistakes accumulate in, and the mistake here
            // costs a percentage of somebody's grade.
            onClick={() =>
              dispatch({
                type: 'markAttendance',
                courseId,
                date,
                mark: on ? null : c.mark,
              })
            }
            aria-pressed={on}
            aria-label={`${courseCode(courseId)} on ${date}: ${on ? `clear ${c.label}` : c.label}`}
            style={{
              width: 'auto',
              flex: 'none',
              padding: '4px 10px',
              height: 28,
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
              background: on ? 'var(--app-accent-wash)' : 'transparent',
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: on ? 1 : 0.65,
            }}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}
