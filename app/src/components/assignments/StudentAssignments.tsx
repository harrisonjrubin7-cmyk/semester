import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { download } from '../../lib/deliver';
import {
  FILE_TYPES, MAX_FILES, fileProblem, loadAssignments, loadMyAttempts, loadMyExtensions, openness, receiptText,
  submitAssignment, uploadFile, when, type Assignment, type Attempt, type UploadedFile,
} from '../../lib/assignments/client';
import { ActionButton, EmptyState, FilePick, SectionLabel } from '../ui';
import { Field, Result, Row, RowItem, Rows, Sub, type Said } from '../academic/Form';

/**
 * A student's assignments for one course and term: what is open, what it
 * asks, the due date they are held to (an extension, if they have one), and a
 * place to hand work in with a receipt they can keep.
 *
 * Only the database decides whether work is accepted; `openness` says what it
 * will say before the press, so the button is not offered for work that cannot
 * be taken. Row-level security returns the student's own attempts and nobody
 * else's. A hand-in that gets no answer keeps its key, so a retry after a lost
 * reply is the same submission and never a second one.
 */
export function StudentAssignments({ school, course, term, me, timeZone }: { school: string; course: string; term: string; me: string; timeZone: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [list, setList] = useState<Assignment[] | string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [exts, setExts] = useState<Map<string, { dueAt: string; lateUntil: string | null; reason: string }>>(new Map());
  const [reads, setReads] = useState(0);
  const [said, setSaid] = useState<Record<string, Said | null>>({});
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const a = await loadAssignments(school, course, term);
        const ids = a.map((x) => x.id);
        const [mine, ext] = await Promise.all([loadMyAttempts(ids), loadMyExtensions(ids, me)]);
        if (live) { setList(a); setAttempts(mine); setExts(ext); }
      } catch (e) {
        if (live) setList(e instanceof Error ? e.message : 'The assignments could not be read.');
      }
    })();
    return () => { live = false; };
  }, [school, course, term, me, reads]);

  async function hand(a: Assignment) {
    const what = `submit:${a.id}:${body.length}:${files.map((f) => f.name + f.size).join(',')}`;
    setBusy(a.id);
    setSaid((s) => ({ ...s, [a.id]: null }));
    try {
      const receipt = await attempt(what, async (key) => {
        const uploaded: UploadedFile[] = [];
        for (const f of files) uploaded.push(await uploadFile(school, a.id, me, f));
        return submitAssignment(a.id, body, uploaded, key);
      });
      const text = `Handed in${receipt.late ? ' (marked late)' : ''}. Attempt ${receipt.attempt}, received ${when(receipt.submittedAt, timeZone)}.`;
      setSaid((s) => ({ ...s, [a.id]: { tone: 'ok', text } }));
      say(text);
      setOpen(null); setBody(''); setFiles([]);
      setReads((n) => n + 1);
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Your work was not handed in.';
      setSaid((s) => ({ ...s, [a.id]: e instanceof ServiceError && !e.answered ? { tone: 'unknown', text, retry: () => void hand(a) } : { tone: 'refused', text } }));
    } finally {
      setBusy('');
    }
  }

  const visible = Array.isArray(list) ? list.filter((a) => a.status !== 'draft') : [];
  const now = new Date();

  return (
    <section aria-label="Assignments">
      <SectionLabel>Assignments · {course} · {term}</SectionLabel>
      {list === null && <p role="status">Reading your assignments…</p>}
      {typeof list === 'string' && <p role="alert">{list}</p>}
      {Array.isArray(list) && visible.length === 0 && (
        <EmptyState inline title="Nothing to hand in" body="Your instructor has not published an assignment for this course yet." />
      )}
      {visible.length > 0 && (
        <Rows label="Assignments">
          {visible.map((a) => {
            const mine = attempts.filter((x) => x.assignmentId === a.id);
            const ext = exts.get(a.id);
            const gate = openness(a, ext, mine.length, now);
            return (
              <RowItem key={a.id}>
                <div><strong>{a.title}</strong> · {a.status === 'closed' ? 'closed' : 'open'}</div>
                <Sub>
                  Due {when(ext?.dueAt ?? a.dueAt, timeZone)} ({timeZone})
                  {ext ? ` — extended for you: ${ext.reason}` : ''} · {mine.length} of {a.attempts} attempt{a.attempts === 1 ? '' : 's'} used
                  {a.points != null ? ` · ${a.points} points` : ''}
                </Sub>
                {a.instructions && <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{a.instructions}</p>}
                {mine.map((m) => (
                  <Sub key={m.id}>
                    Attempt {m.attempt}: received {when(m.submittedAt, timeZone)}{m.late ? ', marked late' : ''}{m.files ? `, ${m.files} file${m.files === 1 ? '' : 's'}` : ''} ·{' '}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => download({
                        name: `receipt-${course.replace(/\s+/g, '')}-${a.title.replace(/[^A-Za-z0-9]+/g, '-')}-attempt-${m.attempt}.txt`,
                        mime: 'text/plain',
                        body: receiptText(a.title, course, term, m),
                      })}
                    >
                      Download receipt
                    </button>
                  </Sub>
                ))}
                <Result said={said[a.id] ?? null} />
                {!gate.ok && <Sub>{gate.why}</Sub>}
                {gate.ok && gate.why && <Sub>{gate.why}</Sub>}
                {gate.ok && open !== a.id && (
                  <Row><ActionButton onClick={() => { setOpen(a.id); setBody(''); setFiles([]); }}>{mine.length ? 'Hand in another attempt' : 'Hand in your work'}</ActionButton></Row>
                )}
                {gate.ok && open === a.id && (
                  <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
                    <Field label="Your answer">
                      {(ids) => <textarea id={ids.id} className="input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />}
                    </Field>
                    <div>
                      <FilePick
                        multiple
                        tone="secondary"
                        block={false}
                        accept={Object.keys(FILE_TYPES).join(',')}
                        onPick={(picked) => setFiles((was) => [...was, ...picked].slice(0, MAX_FILES))}
                      >
                        Add files (optional)
                      </FilePick>
                      <Sub>Up to {MAX_FILES}: {Object.values(FILE_TYPES).join(', ')}; 25 MB each.</Sub>
                    </div>
                    {files.map((f) => {
                      const p = fileProblem(f);
                      return <Sub key={f.name + f.size}>{f.name}{p ? ` — ${p}` : ''}</Sub>;
                    })}
                    <Row>
                      <ActionButton
                        tone="primary"
                        disabled={busy === a.id || (body.trim() === '' && files.length === 0) || files.some((f) => fileProblem(f) !== null)}
                        onClick={() => void hand(a)}
                      >
                        Hand it in
                      </ActionButton>
                      <ActionButton tone="ghost" onClick={() => setOpen(null)}>Cancel</ActionButton>
                    </Row>
                  </div>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}
    </section>
  );
}
