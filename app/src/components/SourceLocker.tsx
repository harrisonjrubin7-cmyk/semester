import { formatDate } from '../lib/locale';
import { useId, useMemo, useState } from 'react';
import { useFiles } from '../lib/clips';
import { useDeviceLibrary } from '../lib/device-library';
import { openFile, trashFile, TRASH_DAYS } from '../lib/files';
import {
  EMPTY_LOCKER,
  LOCKER_KEY,
  dependents,
  forgetRemoved,
  materials,
  readLocker,
  removalPlan,
  setAiUse,
  type Material,
  type Step,
} from '../lib/source-locker';
import type { Course } from '../lib/types';
import { useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceBadge } from './SourceBadge';

const ACCESS: Record<Material['access'], string> = {
  on_device: 'On this device',
  in_trash: 'In Drive trash',
  link: 'Has a link',
  no_link: 'No link recorded',
  not_on_device: 'Original file not stored on this device',
};

const day = (ms: number) => formatDate(new Date(ms), { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Source Locker (`source_locker`, Phase H), a tab in the course hub.
 *
 * Every material this course draws on, with its type, version, date, where it
 * is, and where it came from — and, per material, what was built from it,
 * whether AI may use it, and Open and Remove. Removing shows every dependent
 * first; notes are only ever detached, and generated items are deleted only if
 * the student ticks that box.
 */
export function SourceLocker({ course }: { course: Course }) {
  const { state, dispatch, catalog } = useStore();
  const files = useFiles();
  const locker = useDeviceLibrary(LOCKER_KEY, readLocker, EMPTY_LOCKER);
  const [removing, setRemoving] = useState<Material | null>(null);
  const [alsoGenerated, setAlsoGenerated] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const headingId = useId();

  const list = useMemo(
    () => materials({ course, files, updates: state.updates, citations: state.sources, locker: locker.value }),
    [course, files, state.updates, state.sources, locker.value],
  );
  const depsOf = (m: Material) =>
    dependents(m.key, {
      courseId: course.id,
      file: m.kind === 'file' ? files.find((f) => `file:${f.id}` === m.key) : undefined,
      updates: state.updates,
      notes: state.notes,
      documents: state.documents,
      built: locker.value.built,
      items: catalog.items,
    });

  const run = async (m: Material) => {
    const deps = depsOf(m);
    let steps: Step[];
    try {
      steps = removalPlan(m, deps, alsoGenerated);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : 'This cannot be removed here.');
      setRemoving(null);
      return;
    }
    // The file goes first, because it is the step that can fail (IndexedDB
    // can be unavailable). If it does, nothing else has happened yet: the
    // generated work is still there and the student is told.
    try {
      for (const s of steps) if (s.do === 'trashFile') await trashFile(s.id);
    } catch (e) {
      setSaid(`${m.title} could not be removed, so nothing was changed. ${e instanceof Error ? e.message : ''}`.trim());
      setRemoving(null);
      return;
    }
    for (const s of steps) {
      if (s.do === 'trashFile') continue;
      else if (s.do === 'detachFile') dispatch({ type: 'detachFile', noteId: s.noteId, fileId: s.fileId });
      else if (s.do === 'deleteUpdate') dispatch({ type: 'deleteUpdate', id: s.id });
      else if (s.do === 'deleteDocument') dispatch({ type: 'deleteDocument', id: s.id });
      else dispatch({ type: 'dropSource', id: s.id });
    }
    locker.update((l) => forgetRemoved(l, m.key, steps));
    const gone = steps.filter((s) => s.do === 'deleteUpdate' || s.do === 'deleteDocument').length;
    setSaid(
      `${m.title} removed${m.kind === 'file' ? ` — it stays in Drive trash for ${TRASH_DAYS} days` : ''}.` +
        (gone ? ` ${gone} generated ${gone === 1 ? 'item was' : 'items were'} deleted.` : '') +
        (deps.attached.length ? ` It was detached from ${deps.attached.length} ${deps.attached.length === 1 ? 'note' : 'notes'}; the notes are kept.` : ''),
    );
    setRemoving(null);
    setAlsoGenerated(false);
  };

  const policyNote =
    course.ai?.stance === 'banned'
      ? 'This course’s AI policy does not allow AI, so no material here is sent to an AI service.'
      : 'Turn AI use off for any material and Study Studio will not offer to send it.';

  return (
    <section className="portal-panel source-locker" aria-labelledby={headingId}>
      <h3 id={headingId}>Sources and materials</h3>
      <p className="portal-muted">Everything this course draws on, what was built from each, and whether AI may use it. {policyNote}</p>
      {locker.error ? <p role="alert">{locker.error}</p> : null}
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      <ul className="locker-list">
        {list.map((m) => {
          const deps = depsOf(m);
          const count = deps.generated.length + deps.attached.length;
          return (
            <li key={m.key} data-kind={m.kind}>
              <div className="locker-head">
                <strong>{m.title}</strong> <SourceBadge label={m.label} at={m.date ?? undefined} />
              </div>
              <dl className="course-v2-facts">
                <div><dt>Type</dt><dd>{m.type}</dd></div>
                <div><dt>Version</dt><dd>{m.version ?? 'Only version'}</dd></div>
                <div><dt>Added</dt><dd>{m.date ? day(m.date) : 'Not recorded'}</dd></div>
                <div><dt>Where</dt><dd>{ACCESS[m.access]}</dd></div>
                <div><dt>From</dt><dd>{m.from}</dd></div>
                <div>
                  <dt>Used by</dt>
                  <dd>
                    {count
                      ? [...deps.generated.map((g) => `${g.title} (${g.detail})`), ...deps.attached.map((a) => `Note: ${a.title}`)].join('; ')
                      : 'Nothing built from it yet'}
                  </dd>
                </div>
              </dl>
              <div className="course-v2-actions">
                {m.open ? (
                  <button
                    type="button"
                    className="balance-button"
                    onClick={() => {
                      const o = m.open!;
                      if (o.kind === 'file') void openFile(o.id);
                      else setLeaving(o.url);
                    }}
                  >
                    Open
                  </button>
                ) : null}
                <label className="portal-check">
                  <input
                    type="checkbox"
                    checked={m.ai === 'allowed'}
                    disabled={m.ai === 'policy'}
                    onChange={(e) => locker.update((l) => setAiUse(l, m.key, e.target.checked))}
                  />
                  Use with AI{m.ai === 'policy' ? ' — not allowed by the course policy' : ''}
                </label>
                {m.cannotRemove ? (
                  <span className="portal-muted">{m.cannotRemove}</span>
                ) : (
                  <button type="button" className="balance-button" onClick={() => setRemoving(m)}>
                    Remove…
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {removing ? (() => {
        const deps = depsOf(removing);
        return (
          <ConfirmDialog
            title={`Remove ${removing.title}?`}
            preview={
              <>
                <p>
                  {removing.kind === 'file'
                    ? `The file moves to Drive trash, where it stays for ${TRASH_DAYS} days before it is deleted.`
                    : removing.kind === 'material'
                      ? 'The added material and its cards and terms are deleted.'
                      : 'The entry leaves your reading list.'}
                </p>
                {deps.attached.length ? (
                  <p>
                    It is detached from {deps.attached.map((a) => a.title).join(', ')}. The {deps.attached.length === 1 ? 'note is' : 'notes are'} kept.
                  </p>
                ) : null}
                {deps.cited.length ? (
                  <p>{deps.cited.length} {deps.cited.length === 1 ? 'deadline was' : 'deadlines were'} checked against it. The dates stay; the page link stops opening.</p>
                ) : null}
                {deps.generated.length ? (
                  <>
                    <p>Built from it:</p>
                    <ul>{deps.generated.map((g) => <li key={g.id}>{g.title} — {g.detail}</li>)}</ul>
                    <label className="portal-check">
                      <input type="checkbox" checked={alsoGenerated} onChange={(e) => setAlsoGenerated(e.target.checked)} />
                      Also delete {deps.generated.length === 1 ? 'this generated item' : `these ${deps.generated.length} generated items`}
                    </label>
                  </>
                ) : (
                  <p>Nothing was built from it.</p>
                )}
              </>
            }
            confirmLabel="Remove"
            onConfirm={() => void run(removing)}
            onCancel={() => {
              setRemoving(null);
              setAlsoGenerated(false);
            }}
          />
        );
      })() : null}
      {leaving ? (
        <ConfirmDialog
          title="Open this reading?"
          tone="external"
          preview={<p className="dialog-url">{leaving}</p>}
          confirmLabel="Open link"
          onConfirm={() => {
            window.open(leaving, '_blank', 'noopener,noreferrer');
            setLeaving(null);
          }}
          onCancel={() => setLeaving(null)}
        />
      ) : null}
    </section>
  );
}
