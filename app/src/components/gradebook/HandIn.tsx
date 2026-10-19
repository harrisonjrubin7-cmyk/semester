import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionPreview } from '../unity/ActionPreview';
import { Table } from '../unity/Table';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime, formatNumber } from '../../lib/locale';
import type { Item } from '../../lib/gradebook/model';
import { handIns, handInProblem, MAX_SUBMISSION, shortHash, submitWork, type LoadedSubmissions } from '../../lib/gradebook/submissions';

/**
 * A student hands in work on one of the course's graded items.
 *
 * What is handed in is a fixed copy: the server keeps it as a numbered
 * version with a fingerprint (its SHA-256), and handing in again adds the next
 * version without touching the last. The text box is only the student's own
 * working space — changing it after handing in changes nothing the instructor
 * sees, and the screen says so.
 *
 * The preview before handing in is `ActionPreview` in `ConfirmDialog`, the
 * pattern every consequential action here uses: what happens, exactly what,
 * what stays the same, and how it can be taken back (it cannot; a new version
 * can be added). The write goes through `useAttempts`, so a lost answer is
 * retried with the same key and cannot hand in twice.
 */
export function HandIn({
  items,
  me,
  loaded,
  onHandedIn,
}: {
  items: readonly Item[];
  me: string;
  /** Null while loading; a string when it failed. */
  loaded: LoadedSubmissions | null | string;
  onHandedIn: () => void;
}) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [itemId, setItemId] = useState('');
  const [body, setBody] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);

  const item = items.find((i) => i.id === itemId) ?? items[0] ?? null;
  const mine = useMemo(
    () => (loaded && typeof loaded === 'object' && item ? handIns(loaded.submissions, item.id, me) : []),
    [loaded, item, me],
  );
  const all = useMemo(
    () => (loaded && typeof loaded === 'object' ? loaded.submissions.filter((s) => s.studentId === me).sort((a, b) => b.at.localeCompare(a.at)) : []),
    [loaded, me],
  );
  const gradedIds = useMemo(() => new Set(loaded && typeof loaded === 'object' ? Object.values(loaded.graded) : []), [loaded]);

  if (typeof loaded === 'string') {
    return (
      <>
        <SectionLabel>Hand in work</SectionLabel>
        <Notice alert>{loaded} Nothing you handed in has changed.</Notice>
        <button type="button" className="btn" onClick={onHandedIn}>
          Load again
        </button>
      </>
    );
  }
  if (loaded === null) return <p role="status">Loading what you have handed in…</p>;
  if (!loaded.available) {
    return (
      <>
        <SectionLabel>Hand in work</SectionLabel>
        <Notice>Handing in work through Semester is not set up at your school yet. Hand in the way your instructor has told you to.</Notice>
      </>
    );
  }
  if (items.length === 0 || item === null) {
    return (
      <>
        <SectionLabel>Hand in work</SectionLabel>
        <EmptyState inline title="Nothing assigned yet" body="When your instructor adds an assignment to this course, you can hand it in here." />
      </>
    );
  }

  const problem = handInProblem(body);
  const next = (mine[0]?.version ?? 0) + 1;
  const trimmed = body.trim();

  async function handIn(): Promise<void> {
    if (!item) return;
    setBusy(true);
    setSaid(null);
    try {
      const r = await attempt(`submit:${item.id}:${trimmed}`, (key) => submitWork(item.id, trimmed, key));
      const done = `${item.title} is handed in as version ${r.version}, at ${formatDateTime(new Date(r.at))}. Its fingerprint is ${shortHash(r.contentHash)}. Your instructor sees exactly this copy.`;
      setSaid({ tone: 'ok', text: done });
      say(done);
      setReviewing(false);
      onHandedIn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Your work was not handed in.';
      setReviewing(false);
      setSaid(settled(e) ? { tone: 'refused', text: msg } : { tone: 'unknown', text: msg, retry: () => void handIn() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionLabel>Hand in work</SectionLabel>
      <Result said={said} />
      <Stack>
        <Field label="Assignment">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={item.id} onChange={(e) => { setItemId(e.target.value); setSaid(null); }}>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Your work"
          hint={`Write or paste it here, up to ${formatNumber(MAX_SUBMISSION)} characters. Handing in keeps a fixed copy; changing this box afterwards does not change it.`}
        >
          {(ids) => (
            <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          )}
        </Field>
        {/* Always present, so a reader is already listening when the reason appears. */}
        <div role="status">{body !== '' && problem && <Sub>{problem}</Sub>}</div>
        {mine.length > 0 && (
          <Sub>
            You have handed in {item.title} {mine.length === 1 ? 'once' : `${mine.length} times`}. The latest is version {mine[0].version}, from {formatDateTime(new Date(mine[0].at))}.
          </Sub>
        )}
        <Row>
          <ActionButton tone="primary" disabled={busy || problem !== null} style={{ width: 'auto', flex: '1 1 auto' }} onClick={() => setReviewing(true)}>
            Review and hand in {item.title}
          </ActionButton>
        </Row>
      </Stack>

      {reviewing && (
        <ConfirmDialog
          title={`Hand in ${item.title}?`}
          preview={
            <ActionPreview
              subject={`${item.title} · version ${next}`}
              says={`Hands in this text as version ${next}. Your instructor and the course’s graders can read it; other students cannot.`}
              exactly={`${formatNumber(trimmed.length)} characters, starting “${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}”`}
              doesNotChange={
                mine.length > 0
                  ? `Version ${mine[0].version} and earlier stay exactly as they were, and a grade already given on one of them still names it. Nothing is graded until your instructor grades it.`
                  : 'Nothing is graded until your instructor grades it. Editing the box afterwards does not change what you handed in.'
              }
              recovery={{ kind: 'none', how: 'You can hand in again; that adds a new version and keeps this one.' }}
            />
          }
          confirmLabel={busy ? 'Handing in…' : `Hand in version ${next}`}
          onCancel={() => { if (!busy) setReviewing(false); }}
          onConfirm={() => { if (!busy) void handIn(); }}
        />
      )}

      {all.length > 0 && (
        <>
          <SectionLabel aside={`${all.length} ${all.length === 1 ? 'hand-in' : 'hand-ins'}`}>What you have handed in</SectionLabel>
          <Table
            caption="Everything you have handed in on this course, latest first."
            captionHidden
            rows={all}
            rowKey={(s) => s.id}
            empty={null}
            columns={[
              { id: 'item', header: 'Assignment', rowHeader: true, cell: (s) => items.find((i) => i.id === s.itemId)?.title ?? 'An assignment' },
              { id: 'version', header: 'Version', cell: (s) => `Version ${s.version}` },
              { id: 'at', header: 'Handed in', cell: (s) => formatDateTime(new Date(s.at)) },
              { id: 'hash', header: 'Fingerprint', cell: (s) => <code title={s.contentHash}>{shortHash(s.contentHash)}</code> },
              { id: 'graded', header: 'Graded', cell: (s) => (gradedIds.has(s.id) ? 'A released grade names this version' : '—') },
            ]}
          />
        </>
      )}
    </>
  );
}
