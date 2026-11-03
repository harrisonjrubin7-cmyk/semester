import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime } from '../../lib/locale';
import { formatBytes } from '../../lib/files';
import { shortHash } from '../../lib/gradebook/submissions';
import {
  contentProblem,
  listVersions,
  ObjectsError,
  readVersion,
  saveVersion,
  type ContentType,
  type ObjectVersion,
  type VersionEntry,
} from '../../lib/workspace/objects';
import { DOCUMENT_SCHEMA, FORMATS, ReadOnlyText } from './shared';
import { DocumentShares } from './DocumentShares';

interface Draft {
  title: string;
  body: string;
  contentType: ContentType;
}

const draftOf = (v: ObjectVersion): Draft => ({ title: v.title, body: v.body, contentType: v.contentType });

/**
 * One document: edit and save a new version, see every version, open an
 * earlier one read-only, and share it.
 *
 * Saving names the revision this screen read. When somebody saved in between
 * — the student on another device, or a person they gave edit access — the
 * server answers `stale` and writes nothing. The screen then shows the newer
 * version beside the student's own unsaved text and offers to load it; it
 * never replaces what the student typed without being asked, and after a
 * reload their unsaved text stays on screen until they dismiss it.
 */
export function DocumentDetail({ objectId, me, onBack, note }: { objectId: string; me: string; onBack: () => void; note?: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [current, setCurrent] = useState<ObjectVersion | null | Error>(null);
  const [versions, setVersions] = useState<VersionEntry[] | null | Error>(null);
  const [draft, setDraft] = useState<Draft>({ title: '', body: '', contentType: 'text/plain' });
  const [reads, setReads] = useState(0);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(note ? { tone: 'ok', text: note } : null);
  /** Set when a save came back stale: the student's text, and the newer version once it has loaded. */
  const [stale, setStale] = useState<{ mine: Draft; newer: ObjectVersion | null | Error } | null>(null);
  /** The student's text from before they loaded a newer version, kept on screen until dismissed. */
  const [kept, setKept] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<ObjectVersion | null | 'loading' | Error>(null);
  const viewHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    readVersion(objectId).then(
      (v) => {
        if (!live) return;
        setCurrent(v);
        setDraft(draftOf(v));
      },
      (e: unknown) => { if (live) setCurrent(e instanceof Error ? e : new Error('Could not open it.')); },
    );
    return () => { live = false; };
  }, [objectId, reads]);

  const loadVersions = useCallback(() => {
    listVersions(objectId).then(setVersions, (e: unknown) => setVersions(e instanceof Error ? e : new Error('Could not load its versions.')));
  }, [objectId]);
  useEffect(() => { loadVersions(); }, [loadVersions, reads]);

  useEffect(() => {
    if (viewing && viewing !== 'loading') viewHead.current?.focus();
  }, [viewing]);

  const back = (
    <button type="button" className="bare link-quiet tap-y" onClick={onBack}>
      ← All documents
    </button>
  );

  if (current === null) {
    return (
      <>
        {back}
        <LoadingState what="this document" bars={[40, 200]} />
      </>
    );
  }
  if (current instanceof Error) {
    return (
      <>
        {back}
        <ErrorState
          title="This document did not open"
          body={`${current.message} Nothing in it has changed.`}
          recover={{ label: 'Try again', run: () => { setCurrent(null); setReads((n) => n + 1); } }}
          secondary={{ label: 'All documents', run: onBack }}
        />
      </>
    );
  }

  const base: ObjectVersion = current;
  const revision = base.revision ?? base.versionNumber;
  const next = revision + 1;
  const content = { ...draft, contentSchema: current.contentSchema || DOCUMENT_SCHEMA };
  const problem = contentProblem(content);
  const unchanged = draft.title === current.title && draft.body === current.body && draft.contentType === current.contentType;
  const formats = current.contentType === 'application/json' ? [...FORMATS, { id: 'application/json' as const, label: 'JSON' }] : FORMATS;

  async function save(): Promise<void> {
    setBusy(true);
    setSaid(null);
    const mine = draft;
    try {
      const r = await attempt(`save:${objectId}:${revision}:${mine.contentType}:${mine.title}:${mine.body}`, (key) => saveVersion(objectId, revision, content, key));
      const text = `Saved as version ${r.versionNumber}, at ${formatDateTime(new Date(r.savedAt))}. Its fingerprint is ${shortHash(r.sha256)}. Version ${r.versionNumber - 1} and earlier are unchanged.`;
      setSaid({ tone: 'ok', text });
      say(text);
      setStale(null);
      setCurrent({
        ...base,
        version: r.version,
        versionNumber: r.versionNumber,
        revision: r.revision,
        title: mine.title,
        body: mine.body,
        contentType: mine.contentType,
        sha256: r.sha256,
        byteLength: r.byteLength,
        savedAt: r.savedAt,
        current: true,
      });
      loadVersions();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'The new version was not saved.';
      if (e instanceof ObjectsError && e.kind === 'stale') {
        setSaid({ tone: 'refused', text: `${msg} Your text is still here and nothing was overwritten.` });
        setStale({ mine, newer: null });
        readVersion(objectId).then(
          (v) => setStale((s) => (s ? { ...s, newer: v } : s)),
          (err: unknown) => setStale((s) => (s ? { ...s, newer: err instanceof Error ? err : new Error('Could not load the newer version.') } : s)),
        );
      } else {
        setSaid(settled(e) ? { tone: 'refused', text: msg } : { tone: 'unknown', text: msg, retry: () => void save() });
      }
    } finally {
      setBusy(false);
    }
  }

  /** Load the newer version into the editor, keeping the student's own text on screen. */
  function takeNewer(v: ObjectVersion, mine: Draft): void {
    setKept(mine);
    setCurrent(v);
    setDraft(draftOf(v));
    setStale(null);
    setSaid({ tone: 'ok', text: `Version ${v.versionNumber} is loaded. Your unsaved text is below it, so you can copy back what you need before saving.` });
    loadVersions();
  }

  async function view(v: VersionEntry): Promise<void> {
    setViewing('loading');
    try {
      setViewing(await readVersion(objectId, v.version));
    } catch (e) {
      setViewing(e instanceof Error ? e : new Error('Could not open that version.'));
    }
  }

  if (viewing) {
    return (
      <>
        <button type="button" className="bare link-quiet tap-y" onClick={() => setViewing(null)}>
          ← Back to editing
        </button>
        {viewing === 'loading' ? (
          <LoadingState what="that version" bars={[40, 200]} />
        ) : viewing instanceof Error ? (
          <ErrorState title="That version did not open" body={viewing.message} recover={{ label: 'Back to editing', run: () => setViewing(null) }} />
        ) : (
          <>
            <h2 ref={viewHead} tabIndex={-1} className="section-label" style={{ overflowWrap: 'anywhere' }}>
              {viewing.title} · version {viewing.versionNumber}
            </h2>
            <Notice>
              Read only. This is version {viewing.versionNumber} exactly as it was saved on {formatDateTime(new Date(viewing.savedAt))}
              {viewing.current ? ', and it is the current version.' : '. Saving never changes it.'} Fingerprint {shortHash(viewing.sha256)},{' '}
              {formatBytes(viewing.byteLength)}.
            </Notice>
            <ReadOnlyText body={viewing.body} label={`Version ${viewing.versionNumber} of ${viewing.title}`} />
          </>
        )}
      </>
    );
  }

  return (
    <>
      {back}
      <SectionLabel aside={`Version ${current.versionNumber}`}>
        <span style={{ overflowWrap: 'anywhere' }}>{current.title}</span>
      </SectionLabel>
      <Sub>
        You are editing on top of version {current.versionNumber}, saved {formatDateTime(new Date(current.savedAt))}. Saving adds version {next} and leaves
        every earlier version exactly as it is.
      </Sub>
      <Result said={said} />

      {stale && (
        <section aria-label="The version saved since you opened this">
          <SectionLabel>Saved since you opened it</SectionLabel>
          {stale.newer === null ? (
            <LoadingState what="the newer version" bars={[40, 96]} />
          ) : stale.newer instanceof Error ? (
            <ErrorState
              title="The newer version did not load"
              body={`${stale.newer.message} Your text is still in the editor.`}
              recover={{ label: 'Reload this document', run: () => { setStale(null); setKept(stale.mine); setCurrent(null); setReads((n) => n + 1); } }}
            />
          ) : (
            <Newer newer={stale.newer} mine={stale.mine} onTake={takeNewer} />
          )}
        </section>
      )}
      <Stack label="Edit this document">
        <Field label="Title" hint="Up to 200 characters.">
          {(ids) => (
            <input
              id={ids.id}
              aria-describedby={ids.hint}
              className="input"
              value={draft.title}
              maxLength={200}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          )}
        </Field>
        <Field label="Format">
          {(ids) => (
            <select id={ids.id} className="input" value={draft.contentType} onChange={(e) => setDraft((d) => ({ ...d, contentType: e.target.value as ContentType }))}>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Text">
          {(ids) => (
            <textarea id={ids.id} className="input" rows={14} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          )}
        </Field>
        <div role="status">
          {problem ? <Sub>{problem}</Sub> : unchanged ? <Sub>Nothing has changed since version {current.versionNumber}, so there is nothing to save.</Sub> : null}
        </div>
        <Row>
          <ActionButton tone="primary" disabled={busy || problem !== null || unchanged || stale !== null} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => void save()}>
            {busy ? 'Saving…' : `Save version ${next}`}
          </ActionButton>
        </Row>
        {stale && <Sub>Load the newer version before saving again: a save on top of an old version is refused, so nothing is lost by accident.</Sub>}
      </Stack>

      {kept && (
        <section aria-label="Your text that was not saved">
          <SectionLabel>Your text that was not saved</SectionLabel>
          <Sub>Kept here so nothing you typed is lost. Copy what you need into the editor above, then save.</Sub>
          <ReadOnlyText body={kept.body} label="Your text that was not saved" />
          <Row>
            <ActionButton tone="ghost" style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => setKept(null)}>
              I have what I need — hide this
            </ActionButton>
          </Row>
        </section>
      )}

      <SectionLabel aside={Array.isArray(versions) ? `${versions.length} saved` : undefined}>Versions</SectionLabel>
      {versions === null ? (
        <LoadingState what="its versions" bars={[40, 40]} />
      ) : versions instanceof Error ? (
        <ErrorState title="Its versions did not load" body={versions.message} recover={{ label: 'Load again', run: loadVersions }} />
      ) : (
        <Table
          caption={`Every saved version of ${current.title}, newest first.`}
          captionHidden
          compact="stack"
          rows={versions}
          rowKey={(v) => v.version}
          empty={<Sub>No versions listed yet.</Sub>}
          columns={[
            { id: 'n', header: 'Version', rowHeader: true, cell: (v) => `Version ${v.versionNumber}${v.version === current.version ? ' · current' : ''}` },
            { id: 'title', header: 'Title', cell: (v) => <span style={{ overflowWrap: 'anywhere' }}>{v.title}</span> },
            { id: 'saved', header: 'Saved', cell: (v) => formatDateTime(new Date(v.savedAt)) },
            { id: 'size', header: 'Size', cell: (v) => formatBytes(v.byteLength) },
            { id: 'hash', header: 'Fingerprint', cell: (v) => <code title={v.sha256}>{shortHash(v.sha256)}</code> },
            {
              id: 'view',
              header: 'Open',
              cell: (v) => (
                <button type="button" className="btn" aria-label={`View version ${v.versionNumber} read-only`} onClick={() => void view(v)}>
                  View
                </button>
              ),
            },
          ]}
        />
      )}

      <DocumentShares
        objectId={objectId}
        me={me}
        title={current.title}
        versions={Array.isArray(versions) ? versions : []}
      />
    </>
  );
}

/** The version somebody saved since this screen read the document, and the way to load it. */
function Newer({ newer, mine, onTake }: { newer: ObjectVersion; mine: Draft; onTake: (v: ObjectVersion, mine: Draft) => void }) {
  return (
    <>
      <Sub>
        Version {newer.versionNumber}, saved {formatDateTime(new Date(newer.savedAt))}, titled “{newer.title}”.
      </Sub>
      <ReadOnlyText body={newer.body} label={`Version ${newer.versionNumber}, saved since you opened this`} />
      <Row>
        <ActionButton tone="primary" style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => onTake(newer, mine)}>
          Load version {newer.versionNumber} to edit
        </ActionButton>
      </Row>
    </>
  );
}
