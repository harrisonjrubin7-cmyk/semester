import { useRef, useState } from 'react';
import { FixThis } from '../FixThis';
import { useModal } from '../../a11y/modal';
import { DESKTOP, useMedia } from '../../lib/media';
import { statusOf } from '../../lib/status';
import { SESSION_MINUTES, closeOverlay, showCapture, useOverlay, type SourceDetail } from '../../lib/unity';
import { FocusBar } from './modes';
import { useStore } from '../../state/store';
import { useTaskActions } from '../../state/taskactions';
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
      {overlay.kind === 'capture' && <QuickCapture context={overlay.context} as={overlay.as} text={overlay.text} />}
      {overlay.kind === 'explain' && (
        <Sheet label="About this screen">
          <div className="screen-guide-body">
            <Answers screen={overlay.screen} />
            <FixThis />
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
    <Sheet label={detail.kind ? 'Details' : 'Source & details'}>
      {detail.kind && <div className="kicker">{detail.kind}</div>}
      <h2 className="unity-sheet-title">{detail.title}</h2>
      <dl className="source-list">
        {detail.context && (
          <>
            <dt>Context</dt>
            <dd>{detail.context}</dd>
          </>
        )}
        {detail.status && (
          <>
            <dt>Status</dt>
            <dd>{detail.status}</dd>
          </>
        )}
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
        {detail.location && <><dt>Source location</dt><dd>{detail.location}</dd></>}
        {detail.owner && <><dt>Source owner</dt><dd>{detail.owner}</dd></>}
        {detail.excerpt && <><dt>Supporting excerpt</dt><dd><blockquote>{detail.excerpt}</blockquote></dd></>}
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
        {detail.relationships && detail.relationships.length > 0 && (
          <>
            <dt>Connected to</dt>
            <dd>
              <ul>
                {detail.relationships.map((relationship) => <li key={relationship}>{relationship}</li>)}
              </ul>
            </dd>
          </>
        )}
        {detail.history && detail.history.length > 0 && (
          <>
            <dt>Recent activity</dt>
            <dd>
              <ol className="object-history">
                {detail.history.map((event) => <li key={`${event.at}:${event.label}`}><span className="nums">{event.at}</span> · {event.label}</li>)}
              </ol>
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
        {detail.actions?.map((action) => (
          <button key={action.label} type="button" className="btn btn-secondary" onClick={action.run}>
            {action.label}
          </button>
        ))}
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
  { id: 'task', label: 'Action, no date' },
  { id: 'note', label: 'Course note' },
  { id: 'source', label: 'Source' },
  { id: 'session', label: 'Study session' },
  { id: 'advisor', label: 'Question for advisor' },
  { id: 'idea', label: 'Idea' },
] as const;

export type CaptureKind = (typeof CAPTURE_KINDS)[number]['id'];

/**
 * The other kinds, offered from the `+` box.
 *
 * The header's `+` is the one launcher — it is on every screen in every
 * layout, `q` opens it, and `lib/onframe.test.ts` holds that it means one
 * thing. That box reads a dated line ("econ ps4 friday 5pm") and refuses
 * rather than guessing when there is no date. This row is where everything
 * else goes: pick what it is and the Capture sheet opens with what was
 * typed carried over, so nothing is typed twice.
 */
export function KeepItAs({ text, onLeave }: { text: string; onLeave: () => void }) {
  return (
    <div className="keep-it-as" role="group" aria-label="Keep it as something else">
      <span className="kicker">Or keep it as</span>
      <div className="quick-actions-row">
        {CAPTURE_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className="pill-soft tap-y"
            onClick={() => {
              onLeave();
              showCapture(undefined, { as: k.id, text: text.trim() });
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
export function QuickCapture({ context, as, text: carried = '' }: { context?: string; as?: string; text?: string }) {
  const { state, dispatch, catalog } = useStore();
  const taskActions = useTaskActions();
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(carried);
  const [kind, setKind] = useState<CaptureKind>(
    CAPTURE_KINDS.some((k) => k.id === as) ? (as as CaptureKind) : 'task',
  );
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
      taskActions.add({ title, date: null, time: '', note: '', courseId: course });
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
        {/* A timer has no course of its own (`addTimer` takes a label and a
            length), so the choice is not offered where it would be dropped. */}
        {kind !== 'session' && (
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
        )}
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
