import { useEffect, useRef, useState } from 'react';
import { revealKindly } from '../../lib/prefers';
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
  const { state, dispatch, say, adopt } = useStore();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [refused, setRefused] = useState('');
  /**
   * A move refused because the course is one of the four shipped with the app.
   *
   * Held rather than dropped, so the offer below can be the way out of the
   * refusal instead of a sentence telling somebody to go and find one. Taking
   * the semester on is two taps away in the header strip, and "two taps away"
   * is how a gesture people just tried becomes a gesture they stop trying.
   */
  const [offer, setOffer] = useState<(Movable & { kind: 'item' }) | null>(null);
  /**
   * The drag that was refused, kept until the courses are actually yours.
   *
   * `adopt()` dispatches; the state it writes lands on the next render, so the
   * move cannot simply be retried on the line after. A ref rather than state
   * because it is read by the effect below and never drawn.
   */
  const waiting = useRef<{ what: Movable & { kind: 'item' }; to: Landing } | null>(null);
  /**
   * The notice, so it can be brought on screen when it appears.
   *
   * The drop happens up in the grid and the answer to it renders under the
   * day's list, which on a phone is below the fold — so the first version of
   * this refused a drag and said so somewhere nobody was looking, which reads
   * exactly like a gesture that silently does nothing. The confirm takes focus
   * as well as the scroll, because it is a question and the reader has to be
   * told it was asked; the refusal only scrolls, because `role="status"`
   * announces it politely and taking focus for a sentence would be rude.
   */
  const notes = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

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
        `${what.code} is one of the four courses built into the app rather than held in your account, so its dates are fixed.`,
      );
      setOffer(what);
      waiting.current = { what, to };
      return;
    }
    const item = module.items.find((i) => i.id === what.id);
    if (!item) return;
    const from = new Date(item.year ?? new Date().getFullYear(), item.month, item.day);
    setAsking({ what, to, was: longLabel(from) });
  };

  /*
   * The refused drag, picked back up once the courses are yours.
   *
   * Adopting is not the thing somebody wanted — moving a deadline was — so
   * the move they made is what happens next, and it still goes through the
   * confirm below, because it is still a claim about what a syllabus says.
   */
  useEffect(() => {
    const held = waiting.current;
    if (!held) return;
    if (!state.courses.some((c) => c.course.id === held.what.courseId)) return;
    waiting.current = null;
    setOffer(null);
    setRefused('');
    move(held.what, held.to);
    // `move` is rebuilt on every render, so depending on it would run this on
    // every render. What decides whether the move can go through is the course
    // list, and that is what this watches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courses]);

  useEffect(() => {
    if (!asking && !refused) return;
    // `center`, not `nearest`: nearest counts the viewport, and the bottom of
    // it is under the tab bar — so the button that answers the refusal came to
    // rest half behind the navigation.
    revealKindly(notes.current, { block: 'center' });
    if (asking) dialog.current?.focus();
  }, [asking, refused]);

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
    setOffer(null);
    waiting.current = null;
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
    <div ref={notes}>
      {asking && (
        // The role and the focus go on a wrapper: `Blueprint` is a drawn frame
        // and does not forward a ref, and giving one component two jobs to
        // save an element is how a frame ends up with an ARIA role.
        <div ref={dialog} tabIndex={-1} role="alertdialog" aria-label="Move a deadline the syllabus set">
        <Blueprint style={{ padding: 'var(--sp-6) var(--sp-7)', marginTop: 'var(--sp-5)' }}>
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
        </div>
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
          {offer && (
            <>
              {' '}
              Take the semester on and all four become yours — every tick, grade and card already
              filed against them stays filed.
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  adopt();
                  say('Taken on · They are your courses now, editable like any you import.', 'courses');
                }}
                style={{ height: 40, marginTop: 'var(--sp-5)' }}
              >
                Take the semester on, and move it
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return { move, refuse, notice, asking: asking !== null };
}
