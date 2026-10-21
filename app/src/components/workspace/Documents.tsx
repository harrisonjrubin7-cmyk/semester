import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { cloudConfigured } from '../../lib/cloud';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { ErrorState, LoadingState, PermissionState } from '../unity/States';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, fieldProps } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime, formatNumber } from '../../lib/locale';
import { shortHash } from '../../lib/gradebook/submissions';
import {
  contentProblem,
  createObject,
  listMine,
  MAX_VERSION_BYTES,
  ObjectsError,
  type ContentType,
  type WorkspaceObject,
} from '../../lib/workspace/objects';
import { DocumentDetail } from './DocumentDetail';
import { DOCUMENT_SCHEMA, FORMATS, notSetUp } from './shared';

/**
 * Documents kept in Semester: Mine › Documents.
 *
 * The server half (`lib/workspace/objects.ts`, D-1661) keeps every saved
 * version exactly and never changes one. This is the list of the student's own
 * documents and the way to make one; opening one is `DocumentDetail`, which
 * edits, saves, shows history and shares.
 *
 * It sits in Mine because Mine is "everything you added yourself" — notes and
 * files on the device are the tabs beside it, and this is the same kind of
 * thing kept on the school's service instead. Nothing here touches the device
 * editor in Write, whose documents stay on the device.
 */
export function Documents() {
  const { account, dispatch } = useStore();
  const me = account?.id ?? '';

  if (!cloudConfigured) {
    return (
      <>
        <SectionLabel>Documents</SectionLabel>
        <Notice>
          This copy of Semester is not connected to a school’s Semester service, so documents cannot be kept there. Notes and Files keep your work on
          this device.
        </Notice>
      </>
    );
  }
  if (!me) {
    return (
      <>
        <SectionLabel>Documents</SectionLabel>
        <PermissionState
          title="Sign in to keep documents in Semester"
          body="Documents kept in Semester belong to your account, so they need you signed in. Notes and Files on this device work without it."
          owner="you, through your Semester account"
          recover={{ label: 'Open Account', run: () => dispatch({ type: 'go', screen: 'account' }) }}
        />
      </>
    );
  }
  return <Signed me={me} />;
}

function Signed({ me }: { me: string }) {
  const [loaded, setLoaded] = useState<WorkspaceObject[] | null | ObjectsError | Error>(null);
  const [reads, setReads] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);

  useEffect(() => {
    let live = true;
    listMine().then(
      (r) => { if (live) setLoaded(r); },
      (e: unknown) => { if (live) setLoaded(e instanceof Error ? e : new Error('Could not load your documents.')); },
    );
    return () => { live = false; };
  }, [reads]);

  const reload = () => { setLoaded(null); setReads((n) => n + 1); };

  if (open) {
    return (
      <DocumentDetail
        objectId={open}
        me={me}
        note={said?.tone === 'ok' ? said.text : undefined}
        onBack={() => { setOpen(null); setSaid(null); setReads((n) => n + 1); }}
      />
    );
  }

  if (loaded === null) {
    return (
      <>
        <SectionLabel>Documents</SectionLabel>
        <LoadingState what="your documents" bars={[40, 96, 96]} />
      </>
    );
  }
  if (notSetUp(loaded)) {
    return (
      <>
        <SectionLabel>Documents</SectionLabel>
        <Notice>{loaded.message} Notes and Files on this device are unchanged.</Notice>
      </>
    );
  }
  if (loaded instanceof Error) {
    return (
      <>
        <SectionLabel>Documents</SectionLabel>
        <ErrorState title="Your documents did not load" body={`${loaded.message} Nothing you kept has changed.`} recover={{ label: 'Load again', run: reload }} />
      </>
    );
  }

  if (creating) {
    return (
      <Create
        onCancel={() => setCreating(false)}
        onCreated={(id, text) => {
          setCreating(false);
          setSaid({ tone: 'ok', text });
          setOpen(id);
        }}
      />
    );
  }

  return (
    <>
      <SectionLabel aside={loaded.length > 0 ? `${loaded.length} ${loaded.length === 1 ? 'document' : 'documents'}` : undefined}>Documents</SectionLabel>
      <Sub>Kept on your school’s Semester service under your account, and private until you share one. Every save adds a version; a saved version never changes.</Sub>
      <Result said={said} />
      <Row>
        <ActionButton tone="primary" style={{ width: 'auto', flex: '1 1 auto', marginBlock: 'var(--sp-4)' }} onClick={() => { setSaid(null); setCreating(true); }}>
          New document
        </ActionButton>
      </Row>
      <Table
        caption="Your documents kept in Semester, most recently saved first."
        captionHidden
        compact="stack"
        rows={loaded}
        rowKey={(d) => d.id}
        empty={
          <EmptyState
            inline
            title="No documents kept in Semester yet"
            body="Make one with New document. It stays private to you until you share it, and every version you save is kept."
          />
        }
        columns={[
          {
            id: 'title',
            header: 'Document',
            rowHeader: true,
            cell: (d) => (
              <button type="button" className="bare link-quiet tap-y" style={{ textAlign: 'start', overflowWrap: 'anywhere' }} onClick={() => { setSaid(null); setOpen(d.id); }}>
                {d.title}
              </button>
            ),
          },
          { id: 'versions', header: 'Versions', cell: (d) => formatNumber(d.revision) },
          { id: 'saved', header: 'Last saved', cell: (d) => (d.updatedAt ? formatDateTime(new Date(d.updatedAt)) : '—') },
        ]}
      />
      <YourId me={me} />
    </>
  );
}

/**
 * The student's own account id, which is what somebody sharing a document
 * with them has to type. Nowhere else in the app shows it.
 */
function YourId({ me }: { me: string }) {
  const [copied, setCopied] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(me);
      setCopied('Copied.');
    } catch {
      setCopied('Could not copy here. Select the id and copy it yourself.');
    }
  };
  return (
    <Stack label="Your account id">
      <Sub>
        For someone sharing a document with you, your account id is <code style={{ overflowWrap: 'anywhere' }}>{me}</code>.
      </Sub>
      <Row>
        <button type="button" className="btn" aria-label="Copy your account id" onClick={() => void copy()}>
          Copy
        </button>
        <span role="status">{copied}</span>
      </Row>
    </Stack>
  );
}

/** Making a document: its title, its format and its first version. */
function Create({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string, said: string) => void }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text/plain');
  const [body, setBody] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const titleBox = useRef<HTMLInputElement>(null);

  useEffect(() => { head.current?.focus(); }, []);

  const content = { title, body, contentType, contentSchema: DOCUMENT_SCHEMA };
  const problem = contentProblem(content);
  const titleProblem = tried && title.trim() === '' ? 'Give it a title first.' : undefined;

  async function create(): Promise<void> {
    setTried(true);
    if (problem) {
      if (title.trim() === '') titleBox.current?.focus();
      return;
    }
    setBusy(true);
    setSaid(null);
    try {
      const r = await attempt(`create:${title.trim()}:${contentType}:${body}`, (key) => createObject('document', { ...content, title: title.trim() }, key));
      const text = `${title.trim()} is kept in Semester as version 1, at ${formatDateTime(new Date(r.savedAt))}. Its fingerprint is ${shortHash(r.sha256)}.`;
      say(text);
      onCreated(r.object, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'It was not saved to Semester.';
      setSaid(settled(e) ? { tone: 'refused', text: msg } : { tone: 'unknown', text: msg, retry: () => void create() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 ref={head} tabIndex={-1} className="section-label">
        New document
      </h2>
      <Result said={said} />
      <Stack>
        <Field label="Title" hint="Up to 200 characters.">
          {(ids) => (
            <>
              <input ref={titleBox} className="input" {...fieldProps(ids.id, titleProblem, ids.hint)} id={ids.id} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              <FieldMessage id={ids.id} error={titleProblem} />
            </>
          )}
        </Field>
        <Field label="Format">
          {(ids) => (
            <select id={ids.id} className="input" value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)}>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Text" hint={`Up to ${formatNumber(MAX_VERSION_BYTES / 1_048_576)} MB. Markdown is kept as you write it.`}>
          {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        {/* Always present, so a reader is already listening when the reason appears. */}
        <div role="status">{(tried || body !== '') && problem && problem !== 'Give it a title first.' && <Sub>{problem}</Sub>}</div>
        <Row>
          <ActionButton tone="primary" disabled={busy} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => void create()}>
            {busy ? 'Saving…' : 'Create document'}
          </ActionButton>
          <ActionButton tone="ghost" disabled={busy} style={{ width: 'auto', flex: '1 1 auto' }} onClick={onCancel}>
            Cancel
          </ActionButton>
        </Row>
      </Stack>
    </>
  );
}
