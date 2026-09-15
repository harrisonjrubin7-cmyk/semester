import { useEffect, useRef, useState } from 'react';
import { useNow, useStore } from '../../state/store';
import { Blueprint } from '../../components/Blueprint';
import { capture, enough, readBack } from '../../lib/capture';
import { isoToDate, longLabel } from '../../lib/date';
import { timeLabel } from '../../lib/drag';

/**
 * Double-tap an empty part of the calendar, and put something there.
 *
 * The gap this fills is the ordinary one: you are looking at a Thursday, you
 * have just agreed to something on it, and the way to record that was to leave
 * the calendar, find a capture box, and type the day back in — on the screen
 * that was already showing the day.
 *
 * ## It opens over the calendar rather than navigating
 *
 * Going somewhere to add a thing to a day loses the day, and the second-most
 * common next action is adding another one. This appears under the grid with
 * the date already filled in, and stays open after each addition.
 *
 * ## It shows what it read before it writes
 *
 * The parser is `lib/capture.ts`, the same one the one-line capture box uses,
 * and so is the reason for the preview: every rule in it can misfire — "march"
 * is a month and a verb, a course called CORE collides with an ordinary
 * English word — and a parse that silently created something on the wrong day
 * would be the app quietly corrupting the one thing it exists to be right
 * about. The date read from the tap wins over anything the sentence says,
 * because the tap is the more deliberate statement of the two.
 *
 * ## It writes one of yours, never a syllabus entry
 *
 * With an hour it is an appointment, without one a task. Neither is an `Item`:
 * a re-imported syllabus rewrites its own items and would eat anything written
 * into that list. `components/QuickAdd.tsx` holds the same line for the same
 * reason.
 */
export function AddHere({
  date,
  at,
  onClose,
}: {
  /** ISO date the tap landed on. */
  date: string;
  /** Minutes past midnight, on the views with an hour axis. */
  at?: number;
  onClose: () => void;
}) {
  const { catalog, dispatch, say } = useStore();
  const now = useNow();
  const [text, setText] = useState('');
  const [said, setSaid] = useState('');
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const named = catalog.courses.map((c) => ({ id: c.id, code: c.code, title: c.name ?? '' }));
  const caught = capture(text, named, now);
  const ready = enough(caught);
  const codeOf = (id: string) => catalog.byId[id]?.code ?? id;
  const when = longLabel(isoToDate(date));

  const add = () => {
    if (!ready) return;
    if (at === undefined) {
      dispatch({
        type: 'addTask',
        task: {
          title: caught.title,
          // The tap, not the sentence: tapping Thursday and typing "friday" is
          // a person correcting themselves mid-thought, and the calendar knows
          // which of the two they did last.
          date,
          time: caught.time,
          note: caught.kind ? `${caught.kind}, added on the calendar` : 'Added on the calendar',
          courseId: caught.courseId,
        },
      });
    } else {
      dispatch({
        type: 'addAppointment',
        appointment: {
          title: caught.title,
          kind: caught.kind || 'other',
          date,
          at,
          time: timeLabel(at),
          where: '',
          note: '',
        },
      });
    }
    setSaid(`Added to ${when}${at === undefined ? '' : `, ${timeLabel(at)}`}.`);
    say(`Added · ${caught.title} on ${when}.`, 'calendar');
    setText('');
    box.current?.focus();
  };

  return (
    <Blueprint style={{ padding: 'var(--sp-6) var(--sp-7)', marginTop: 'var(--sp-5)' }}>
      <div className="kicker">
        {when}
        {at === undefined ? '' : ` · ${timeLabel(at)}`}
      </div>
      <input
        ref={box}
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder={at === undefined ? 'econ ps4' : 'coffee with Sam'}
        aria-label={`What is on ${when}`}
        style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-base)' }}
      />

      {text.trim() && (
        <ul
          style={{
            listStyle: 'none',
            margin: 'var(--sp-4) 0 0',
            padding: 0,
            fontSize: 'var(--type-xs)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          {readBack(caught, codeOf)
            // The date is the tap's, so the parser's reading of one would be a
            // second answer to a question already settled. Written out rather
            // than `startsWith(date || sentinel)`: `startsWith('')` is true of
            // every string, and the sentinel existed only to dodge that.
            .filter(
              (line) =>
                !line.includes('→ ') ||
                !caught.from.date ||
                !line.startsWith(caught.from.date),
            )
            .map((line) => (
              <li key={line}>{line}</li>
            ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={add}
          disabled={!ready}
          style={{ flex: 1, height: 40 }}
        >
          Add it
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1, height: 40 }}>
          Done
        </button>
      </div>

      {said && (
        <div role="status" style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
          {said}
        </div>
      )}
    </Blueprint>
  );
}
