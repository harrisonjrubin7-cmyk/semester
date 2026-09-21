/**
 * One line, anywhere: "econ ps4 friday 5pm".
 *
 * Adding something you were just told about used to take a screen, a course
 * picker, a date picker and four taps, and the honest consequence is that
 * walking out of a lecture nobody does it. An app with stale data is worse
 * than no app, because it is trusted and wrong.
 *
 * ## It shows what it read before it writes anything
 *
 * The preview is not decoration. Every rule in `lib/capture.ts` can misfire —
 * "march" is a month and a verb, a course called CORE collides with the
 * ordinary English word — and a parse that silently created a deadline on the
 * wrong day would be the app quietly corrupting the one thing it exists to be
 * right about. So the reading is shown with the words it came from, and the
 * student presses the button.
 *
 * ## Three things said at once are three things
 *
 * One line is the right shape for something you were just told. Walking out of
 * a lecture you have three, and this box takes them one at a time: type,
 * confirm, clear, type, confirm, clear. The third one does not get added.
 *
 * Speaking is the natural shape for that moment and the browser already
 * transcribes speech. What comes back is one run with three things in it, and
 * `capture` on the whole run produces one deadline called "econ problem set
 * four friday psci reading tuesday pick up my library book" — worse than
 * nothing, because it is plausible enough to commit while the other two are
 * lost. `lib/aloud.ts` cuts the run up first, and what appears is rows.
 *
 * The rows are the same promise as the single preview, repeated: each shows
 * what was read from it, and each is added by its own press. Nothing is
 * written by the splitter being confident.
 *
 * ## It writes a task, not a syllabus entry
 *
 * What comes out is one of *your* things filed against a course, not a line
 * pretending the syllabus said it. The app has kept that boundary everywhere
 * else and a capture box is exactly where it would be easiest to blur: a
 * re-imported syllabus rewrites its own items and would silently eat anything
 * added here if this wrote into that list.
 */

import { useEffect, useRef, useState } from 'react';
import { useModal } from '../a11y/modal';
import { useModernShell } from './shell-context';
import { useNow, useStore } from '../state/store';
import { capture, enough, readBack, type Caught } from '../lib/capture';
import { heardLine, readAloud } from '../lib/aloud';
import { dictate, dictationSupported } from '../lib/mic';
import { ActionButton } from './ui';
import { DESKTOP, useMedia } from '../lib/media';
import { DIMMED_ROW } from '../lib/dim';

/**
 * How wide the box gets, the same measure the whole-app search uses.
 *
 * Both are overlays that are a field and what the field produced, and on a
 * wide window both cover the whole thing — so a different width for each
 * would be two answers to one question. It never binds on a phone, where the
 * app is already narrower than this.
 */
const COLUMN = 620;

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const { catalog, dispatch } = useStore();
  const now = useNow();
  const [text, setText] = useState('');
  const [said, setSaid] = useState('');
  // Which rows of a split run have been added, by their text — not by their
  // index, because editing the box re-splits it and an index would then point
  // at a different thing and grey out the wrong row.
  const [done, setDone] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const stopMic = useRef<(() => void) | null>(null);
  const wide = useMedia(DESKTOP);
  /* In the browser shell this is mounted beside the shell's own chrome
     rather than inside a pane, so it is laid out against the window at every
     width — otherwise it covers the pane and the shell's strip paints over
     its field and its Close button. */
  const modern = useModernShell();
  const box = useRef<HTMLInputElement>(null);
  // The field, for the same reason the search palette opens on its own: a
  // capture box that opens on its Close button is one you have to tab into
  // before you can type the thing you opened it to say.
  const { ref: modalRef, onKeyDown } = useModal<HTMLDivElement>({ onClose, initial: box });

  const named = catalog.courses.map((c) => ({ id: c.id, code: c.code, title: c.name ?? '' }));
  const caught = capture(text, named, now);
  const ready = enough(caught);
  const codeOf = (id: string) => catalog.byId[id]?.code ?? id;

  // The run, cut into the things it is made of. One piece is the ordinary
  // case and keeps the single preview it always had; two or more is a
  // braindump, and gets a row each.
  const rows = readAloud(text, named, now);
  const many = rows.length > 1;

  /** File one reading. The one place a task is written, whichever view called. */
  const file = (c: Caught) => {
    dispatch({
      type: 'addTask',
      task: {
        title: c.title,
        date: c.date || null,
        time: c.time,
        note: c.kind ? `${c.kind}, captured` : 'Captured',
        courseId: c.courseId,
      },
    });
  };

  const add = () => {
    if (!ready) return;
    file(caught);
    setSaid(`Added${caught.courseId ? ` to ${codeOf(caught.courseId)}` : ''}.`);
    setText('');
    setDone([]);
    box.current?.focus();
  };

  const addRow = (row: (typeof rows)[number]) => {
    if (!enough(row.caught) || done.includes(row.text)) return;
    file(row.caught);
    setDone((was) => [...was, row.text]);
    setSaid(`Added${row.caught.courseId ? ` to ${codeOf(row.caught.courseId)}` : ''}.`);
  };

  const addAll = () => {
    const left = rows.filter((r) => enough(r.caught) && !done.includes(r.text));
    for (const row of left) file(row.caught);
    setDone((was) => [...was, ...left.map((r) => r.text)]);
    setSaid(`${left.length} added.`);
  };

  const listen = () => {
    if (listening) {
      stopMic.current?.();
      stopMic.current = null;
      setListening(false);
      return;
    }
    setMicError('');
    setSaid('');
    setDone([]);
    // Appended to whatever is already in the box rather than replacing it, so
    // saying a fourth thing after typing three does not wipe the three.
    const before = text.trim();
    stopMic.current = dictate(
      (heard) => setText(before ? `${before}. ${heard}` : heard),
      (message) => {
        setMicError(message);
        setListening(false);
        stopMic.current = null;
      },
    );
    setListening(true);
  };

  // A live microphone must not outlive the box it was opened in.
  useEffect(() => () => stopMic.current?.(), []);

  return (
    <div
      role="dialog"
      aria-label="Add something quickly"
      /*
       * `aria-modal` was missing, and would have been a lie before the trap
       * was: this covers the whole app on a phone and the whole window on a
       * desk, so a reader offering the screen underneath is describing
       * something nobody can see or reach. It is true now.
       */
      aria-modal="true"
      ref={modalRef}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      style={{
        /*
         * Where the box ends, which is not the same edge on both layouts.
         *
         * This is mounted inside `.device` because that is where the app's
         * controls are drawn — `.input`, `.btn` and `.bare` are every one of
         * them scoped to it, and mounted beside the pane this reached none of
         * them: the field a student types the whole capture into was a white
         * browser textbox with a blue focus ring, on a laptop.
         *
         * Below 760px `.device` is a column with ground either side, and the
         * box fills the column, as it always has. At 760px and up the pane is
         * a strip in the middle of the window and shrinking to it would leave
         * the box hanging in the middle of the screen, so it is `fixed` there
         * and covers the window — which is what it did before this moved.
         * The content draws itself in a column either way, which is the other
         * half of what was wrong on a wide window: with nothing capping it,
         * the explanation ran the full 1280px in one line.
         *
         * Safe because nothing above this transforms; a transformed ancestor
         * would become the containing block and this would go back to
         * covering the pane.
         */
        position: wide || modern ? 'fixed' : 'absolute',
        inset: 0,
        zIndex: 80,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--page-pad)',
      }}
    >
      <div style={{ width: '100%', maxWidth: COLUMN, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
        <span className="kicker" style={{ flex: 1 }}>
          {many ? 'Several things' : 'One line'}
        </span>
        {/* Dictation where the browser has it, and nothing where it has not —
            Chrome and Safari do, Firefox does not, and a button that cannot
            work is worse than an absent one. */}
        {dictationSupported() ? (
          <button
            type="button"
            className={listening ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={listen}
            aria-pressed={listening}
            style={{ width: 'auto', height: 30, fontSize: 'var(--type-xs)', paddingInline: 'var(--sp-6)' }}
          >
            {listening ? 'Stop' : 'Say it'}
          </button>
        ) : null}
        <button
          type="button"
          className="bare"
          onClick={onClose}
          style={{ width: 'auto', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}
        >
          Close
        </button>
      </div>

      <input
        ref={box}
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaid('');
        }}
        onKeyDown={(e) => {
          // Escape is the dialog's, not the field's — it was on this input
          // alone, so pressing it with focus on Close did nothing at all.
          if (e.key === 'Enter') add();
        }}
        placeholder="econ ps4 friday 5pm"
        aria-label="What to add"
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%',
          height: 52,
          marginTop: 'var(--sp-5)',
          fontSize: 'var(--type-display-xs)',
        }}
      />

      {micError ? (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-sm-plus)',
            color: 'var(--app-warn)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {micError}
        </div>
      ) : null}

      {text.trim() && many ? (
        <div style={{ marginTop: 'var(--sp-7)' }}>
          <div className="kicker">What it heard</div>
          <div
            style={{
              fontSize: 'var(--type-sm-plus)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
          >
            {heardLine(rows)}
          </div>

          {rows.map((row) => {
            const added = done.includes(row.text);
            const can = enough(row.caught);
            return (
              <div
                key={row.text}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-5)',
                  alignItems: 'flex-start',
                  paddingBlock: 'var(--sp-5)',
                  borderBottom: '1px solid var(--app-line-soft)',
                  opacity: added ? DIMMED_ROW : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--type-base-plus)',
                      lineHeight: 'var(--leading-tight)',
                      textWrap: 'pretty',
                    }}
                  >
                    {row.caught.title || row.text}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--type-xs-plus)',
                      color: 'var(--app-dim)',
                      marginTop: 'var(--sp-2)',
                      lineHeight: 'var(--leading-normal)',
                      textWrap: 'pretty',
                    }}
                  >
                    {/* The same promise the single preview makes, repeated
                        per row: what was read, before anything is written. */}
                    {readBack(row.caught, codeOf).join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={added || !can}
                  onClick={() => addRow(row)}
                  style={{ width: 'auto', height: 32, fontSize: 'var(--type-xs)', paddingInline: 'var(--sp-7)', flex: 'none' }}
                >
                  {added ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}

          {/* Editing the box re-splits it, which is the way a wrong cut is
              undone: there is no merge button because the text is the thing,
              and it is still there to be corrected. */}
          <div
            style={{
              fontSize: 'var(--type-xs-plus)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
          >
            Cut in the wrong place? Edit the line above and it is read again.
          </div>

          <ActionButton
            onClick={addAll}
            disabled={rows.every((r) => done.includes(r.text) || !enough(r.caught))}
            tone="primary"
            spacing="0.09em"
            style={{ marginTop: 'var(--sp-6)' }}
          >
            Add the rest
          </ActionButton>
        </div>
      ) : text.trim() ? (
        <div style={{ marginTop: 'calc(14px * var(--density, 1))' }}>
          <div className="kicker">What it read</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(5px * var(--density, 1))', marginTop: 'calc(7px * var(--density, 1))' }}>
            {readBack(caught, codeOf).map((line) => (
              <div
                key={line}
                style={{
                  fontSize: 'var(--type-sm-plus)',
                  color: line.startsWith('No ') ? 'var(--app-dim)' : 'var(--app-fg)',
                  lineHeight: 'var(--leading-normal)',
                  textWrap: 'pretty',
                }}
              >
                {line}
              </div>
            ))}
            <div
              style={{
                fontSize: 'var(--type-sm-plus)',
                marginTop: 'var(--sp-2)',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              It will be called <strong>{caught.title || '—'}</strong>.
            </div>
          </div>

          <ActionButton
            onClick={add}
            disabled={!ready}
            tone="primary" spacing="0.09em"
            style={{ marginTop: 'var(--sp-7)' }}
          >
            Add it
          </ActionButton>
        </div>
      ) : (
        <div
          style={{
            fontSize: 'var(--type-sm-plus)',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-7)',
            lineHeight: 'var(--leading-loose)',
            textWrap: 'pretty',
          }}
        >
          A course, what it is, when. Any order, and any part can be left out — “psci essay oct
          6”, “core quiz tomorrow”, “dentist tuesday 9am”. What it understood is shown before
          anything is written, because a deadline on the wrong day is worse than no deadline.
          {dictationSupported()
            ? ' Say it instead and list several — they come back as separate rows to check, not as one line.'
            : ''}
        </div>
      )}

      {said ? (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-sm-plus)',
            color: 'var(--app-dim)',
            marginTop: 'calc(14px * var(--density, 1))',
          }}
        >
          {said} It is one of yours, filed against the course — not a line pretending the
          syllabus said it.
        </div>
      ) : null}
      </div>
    </div>
  );
}
