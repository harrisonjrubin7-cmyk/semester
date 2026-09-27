import { useRef, useState } from 'react';
import { useModal } from '../../a11y/modal';
import { DESKTOP, useMedia } from '../../lib/media';
import { statusOf } from '../../lib/status';
import { SESSION_MINUTES, closeOverlay, useOverlay, type SourceDetail } from '../../lib/unity';
import { FocusBar } from './modes';
import { useStore } from '../../state/store';
import { courseFieldFor } from '../../lib/parent';
import { useModernShell } from '../shell-context';
import { SaveState, StatusChip } from './Status';
import { Visibility } from './Visibility';
import { Answers } from './ScreenGuide';

/**
 * The shared overlays, mounted once per layout beside `QuickAdd`.
 *
 * Positioned the way `QuickAdd` explains at length: absolute inside
 * `.device` on a phone, fixed over the window on a desk or in the browser
 * shell. Both are sheets over a scrim, both trap focus and hand it back
 * (`a11y/modal.ts`), both close on Escape and on the scrim.
 */
export function UnityLayer() {
  const overlay = useOverlay();
  return (
    <>
      <FocusBar />
      {overlay.kind === 'source' && <SourceDrawer detail={overlay.detail} />}
      {overlay.kind === 'capture' && <QuickCapture context={overlay.context} />}
      {overlay.kind === 'explain' && (
        <Sheet label="About this screen">
          <div className="screen-guide-body">
            <Answers screen={overlay.screen} />
          </div>
        </Sheet>
      )}
    </>
  );
}

function Sheet({ label, children, initial }: { label: string; children: React.ReactNode; initial?: React.RefObject<HTMLElement | null> }) {
  const wide = useMedia(DESKTOP);
  const modern = useModernShell();
  const { ref, onKeyDown } = useModal<HTMLDivElement>({ onClose: closeOverlay, initial });
  return (
    <div className={`unity-scrim ${wide || modern ? 'is-window' : 'is-pane'}`} onClick={closeOverlay}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={ref}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        className="unity-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="unity-sheet-head">
          <span className="kicker">{label}</span>
          <button type="button" className="btn btn-ghost" onClick={closeOverlay}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Source & details — where a thing came from, and how far to rely on it.
 *
 * One drawer for planning, study, research, AI output and campus data, so
 * that "where did this come from" has the same answer shape everywhere:
 * origin, source, freshness, what it is used in, what it was made from,
 * limitations, who can see it, and what to do about it.
 */
export function SourceDrawer({ detail }: { detail: SourceDetail }) {
  const origin = statusOf(detail.origin);
  return (
    <Sheet label="Source & details">
      <h2 className="unity-sheet-title">{detail.title}</h2>
      <dl className="source-list">
        <dt>Origin</dt>
        <dd>
          <StatusChip status={detail.origin} />
          <span className="source-about">{origin.about}</span>
        </dd>
        {detail.sourceName && (
          <>
            <dt>Source</dt>
            <dd>{detail.sourceName}</dd>
          </>
        )}
        {detail.freshness && (
          <>
            <dt>Freshness</dt>
            <dd className="nums">{detail.freshness}</dd>
          </>
        )}
        {detail.sourcesUsed && detail.sourcesUsed.length > 0 && (
          <>
            <dt>Sources used</dt>
            <dd>
              <ul>
                {detail.sourcesUsed.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {detail.usedIn && detail.usedIn.length > 0 && (
          <>
            <dt>Used in</dt>
            <dd>
              <ul>
                {detail.usedIn.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
        {detail.limitations && (
          <>
            <dt>Limitations</dt>
            <dd>{detail.limitations}</dd>
          </>
        )}
        <dt>Who can see this</dt>
        <dd>{detail.visibility ?? 'Only you'}</dd>
      </dl>
      <div className="unity-sheet-actions">
        {detail.openSource && (
          <button type="button" className="btn btn-primary" onClick={detail.openSource.run}>
            {detail.openSource.label}
          </button>
        )}
        {detail.report && (
          <button type="button" className="btn btn-ghost" onClick={detail.report}>
            Report an issue
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** What a capture can be. Each lands in a store the app already has. */
export const CAPTURE_KINDS = [
  { id: 'task', label: 'Task' },
  { id: 'note', label: 'Course note' },
  { id: 'source', label: 'Source' },
  { id: 'session', label: 'Study session' },
  { id: 'advisor', label: 'Question for advisor' },
  { id: 'idea', label: 'Idea' },
] as const;

export type CaptureKind = (typeof CAPTURE_KINDS)[number]['id'];

/**
 * Global Quick Capture — one line, from anywhere, into the right place.
 *
 * A task goes to your tasks, a study session starts a 25-minute timer, and
 * the rest are kept as private notes labelled with what they are, so a
 * question for an advisor is findable as one. It attaches to the course you
 * are looking at, and says so, and lets you change it — the brief's "attach
 * to current context while always allowing the student to change context".
 *
 * Nothing captured here is shared: every destination is private to the
 * student, which the sheet states rather than leaving to be assumed.
 *
 * A dated deadline is `QuickAdd`'s job — it reads dates and courses out of a
 * sentence and shows what it read before writing — so "Has a due date?"
 * hands the line over to it rather than growing a second date parser here.
 */
export function QuickCapture({ context }: { context?: string }) {
  const { state, dispatch, catalog } = useStore();
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<CaptureKind>('task');
  // The course you are standing in, and only then. `state.courseId` is the
  // last course *opened*, which on Today is a course you are not looking at
  // — `lib/parent.ts` makes the same distinction for the header's way up.
  const within = courseFieldFor(state.screen);
  const standing = within ? state[within] : '';
  const here = context ?? (catalog.byId[standing] ? standing : '');
  const [courseId, setCourseId] = useState<string>(here);
  const [saved, setSaved] = useState<string | null>(null);

  const save = () => {
    const title = text.trim();
    if (!title) return;
    const course = courseId || null;
    const said = CAPTURE_KINDS.find((k) => k.id === kind)!.label;
    if (kind === 'task') {
      dispatch({ type: 'addTask', task: { title, date: null, time: '', note: '', courseId: course } });
    } else if (kind === 'session') {
      dispatch({ type: 'addTimer', label: `Study: ${title}`, seconds: SESSION_MINUTES * 60, at: Date.now() });
    } else {
      dispatch({ type: 'keepNote', title, body: `Captured as: ${said}`, courseId: course });
    }
    setSaved(said);
    setText('');
    field.current?.focus();
  };

  return (
    <Sheet label="Capture" initial={field}>
      <form
        className="capture-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="capture-field">
          <span className="kicker">What is it?</span>
          <input
            ref={field}
            className="input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(null);
            }}
            placeholder="One line is enough"
          />
        </label>
        <fieldset className="capture-kinds">
          <legend className="kicker">Keep it as</legend>
          {CAPTURE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className="pill-soft tap-y"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </fieldset>
        <label className="capture-field">
          <span className="kicker">Attached to</span>
          <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">No course</option>
            {catalog.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <Visibility value="only-me" locked />
        <div className="unity-sheet-actions">
          <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
            Save
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              closeOverlay();
              dispatch({ type: 'quickAdd', open: true });
            }}
          >
            Has a due date?
          </button>
        </div>
        {saved && <SaveState status="saved" />}
        {saved && <p className="capture-next">Kept as a {saved.toLowerCase()}. Add another, or close.</p>}
      </form>
    </Sheet>
  );
}
