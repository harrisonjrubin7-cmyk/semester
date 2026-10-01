import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime, formatNumber } from '../../lib/locale';
import { useDraft } from '../../lib/draft.hook';
import { KEPT_LINE } from '../../lib/draft';
import { loadAssignments, submitWork, type Loaded } from '../../lib/assignments/client';
import { LIMITS } from '../../lib/assignments/model';
import type { Assignment, Receipt, Version } from '../../lib/assignments/model';
import {
  bodyProblem,
  byUrgency,
  canSubmit,
  fingerprint,
  receiptMatches,
  receiptText,
  standing,
  standingText,
  windowFor,
} from '../../lib/assignments/views';

/**
 * A student's assignments for one course and term: what is open, what is due,
 * submitting work, and the receipt that proves what was taken and when.
 *
 * Row-level security returns the published assignments of the courses this
 * student is on the roster of and their own submissions and nobody else's, so
 * there is no way for this component to show a draft or a classmate's answer.
 * `loadAssignments` is the same read the instructor's screen makes; what it
 * returns is what the database lets this caller see.
 *
 * The text is typed into a field that autosaves on the device (`useDraft`), so
 * leaving the screen does not lose it, and it is cleared only after the
 * database has answered with a receipt. A submission carries an attempt key
 * (`lib/attempt.ts`): if the connection drops after the server took it, the
 * next press of Submit is the same request and answers the same receipt, never
 * a second version. Nothing here is a grade.
 *
 * This is not the planner (`lib/assignment.ts`), which is a student's own
 * list of work they typed in.
 */

const when = (iso: string): string => formatDateTime(new Date(iso), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function StudentAssignments({ course, term, me, writable }: { course: string; term: string; me: string; writable: boolean }) {
  const { say } = useStore();
  const [data, setData] = useState<Loaded | null | string>(null);
  const [reads, setReads] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadAssignments(course, term).then(
      (d) => { if (live) setData(d); },
      (e: unknown) => { if (live) setData(e instanceof Error ? e.message : 'Could not load your assignments.'); },
    );
    return () => { live = false; };
  }, [course, term, reads]);

  const mine = useMemo(() => {
    if (!data || typeof data === 'string') return null;
    return {
      ...data,
      versions: data.versions.filter((v) => v.studentId === me),
      receipts: data.receipts.filter((r) => r.studentId === me),
    };
  }, [data, me]);

  if (typeof data === 'string') {
    return (
      <>
        <Notice alert>{data} Nothing has changed. Try again in a moment.</Notice>
        <button type="button" className="btn" onClick={() => setReads((n) => n + 1)}>
          Load again
        </button>
      </>
    );
  }
  if (data === null || mine === null) return <p role="status">Loading your assignments for {course}…</p>;

  const now = new Date();
  const list = [...mine.assignments].sort(byUrgency);
  const chosen = list.find((a) => a.id === open) ?? null;

  if (chosen) {
    return (
      <Submit
        key={chosen.id}
        a={chosen}
        loaded={mine}
        me={me}
        writable={writable}
        onBack={() => setOpen(null)}
        onTaken={(line) => { say(line); setReads((n) => n + 1); }}
      />
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        inline
        title="No assignments yet"
        body={`Your instructor has not published any ${course} assignments for ${term}. They appear here once they do.`}
      />
    );
  }

  return (
    <>
      <SectionLabel>Assignments</SectionLabel>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={`Assignments in ${course}, ${term}`}>
        {list.map((a) => {
          const w = windowFor(a, mine.extensions, me);
          const vs = mine.versions.filter((v) => v.assignmentId === a.id);
          const s = standing(a, w, vs, now);
          return (
            <li key={a.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--app-rule)' }}>
              <strong>{a.title}</strong>
              <Sub>
                Due {when(w.dueAt)}
                {w.extended ? ' (extended for you)' : ''}
              </Sub>
              <Sub>{standingText(s, w, vs)}</Sub>
              <button type="button" className="btn" onClick={() => setOpen(a.id)}>
                {writable && (s === 'open' || s === 'open-late') ? `Open ${a.title} to submit` : `Open ${a.title}`}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Submit({
  a, loaded, me, writable, onBack, onTaken,
}: {
  a: Assignment;
  loaded: Loaded;
  me: string;
  writable: boolean;
  onBack: () => void;
  onTaken: (line: string) => void;
}) {
  const { attempt } = useAttempts();
  const draft = useDraft('assignment-submit', 'body', a.id);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);

  const versions = loaded.versions.filter((v) => v.assignmentId === a.id).sort((x, y) => y.version - x.version);
  const receipts = loaded.receipts.filter((r) => r.assignmentId === a.id);
  const w = windowFor(a, loaded.extensions, me);
  const now = new Date();
  const s = standing(a, w, versions, now);
  const may = canSubmit(a, w, versions, now);
  const problem = draft.value.length > 0 ? bodyProblem(draft.value, versions) : null;
  const allowed = writable && may.ok;

  async function send(text: string): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      const got = await attempt(`submit:${a.id}:${fingerprint(text)}`, (key) => submitWork(a.id, text, key));
      const done = `Submitted. Receipt ${got.receipt}${got.late ? ', marked late' : ''}.`;
      setSaid({ tone: 'ok', text: done });
      draft.done();
      onTaken(done);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Your submission was not taken.';
      setSaid(settled(e) ? { tone: 'refused', text: msg } : { tone: 'unknown', text: `${msg} It may have gone through; try again and you will get the same receipt, not a second submission.`, retry: () => void send(text) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="assignment-head">
      <h3 id="assignment-head" ref={head} tabIndex={-1}>
        {a.title}
      </h3>
      <Sub>
        Due {when(w.dueAt)}
        {w.extended ? ' (extended for you)' : ''}
        {w.closesAt ? ` · stops taking work ${when(w.closesAt)}` : ''}
      </Sub>
      <p role="status">{standingText(s, w, versions)}</p>
      {a.instructions ? <p style={{ whiteSpace: 'pre-wrap' }}>{a.instructions}</p> : <Sub>No instructions were written.</Sub>}
      <Sub>
        {a.allowResubmission ? `You can submit up to ${a.maxVersions} ${a.maxVersions === 1 ? 'version' : 'versions'}; the latest is the one your instructor reads.` : 'This takes one submission.'}
      </Sub>

      <Result said={said} />

      {!writable && <Notice>You can read this, but it cannot be changed here right now. What you submitted is kept.</Notice>}
      {writable && !may.ok && <Notice>{may.reason}</Notice>}

      {allowed && (
        <Stack>
          <Field
            label="Your work"
            hint={`Plain text, up to ${formatNumber(LIMITS.body)} characters. ${KEPT_LINE} It leaves this device only when you submit.`}
          >
            {(ids) => (
              <textarea
                id={ids.id}
                aria-describedby={ids.hint}
                className="input"
                rows={10}
                value={draft.value}
                onChange={(e) => draft.set(e.target.value)}
              />
            )}
          </Field>
          {draft.said && <p role="status">{draft.said}</p>}
          {problem && <p role="alert">{problem}</p>}
          <Row>
            <ActionButton
              tone="primary"
              disabled={busy || draft.value.trim().length === 0 || problem !== null}
              style={{ width: 'auto', flex: '1 1 auto' }}
              onClick={() => void send(draft.value)}
            >
              {busy ? 'Submitting…' : versions.length === 0 ? 'Submit' : `Submit version ${versions.length + 1}`}
            </ActionButton>
            <button type="button" className="btn" disabled={busy} onClick={onBack}>
              Back to the list
            </button>
          </Row>
        </Stack>
      )}
      {!allowed && (
        <Row>
          <button type="button" className="btn" onClick={onBack}>
            Back to the list
          </button>
        </Row>
      )}

      {versions.length > 0 && (
        <>
          <SectionLabel>What you submitted</SectionLabel>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Your submissions, newest first">
            {versions.map((v) => (
              <li key={v.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--app-rule)' }}>
                <ReceiptRow a={a} v={v} r={receipts.find((x) => x.versionId === v.id) ?? null} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ReceiptRow({ a, v, r }: { a: Assignment; v: Version; r: Receipt | null }) {
  const [check, setCheck] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [shown, setShown] = useState(false);
  return (
    <>
      <strong>Version {v.version}</strong>
      <Sub>
        Taken {when(v.submittedAt)}
        {v.late ? ' · late' : ' · on time'}
      </Sub>
      {r ? (
        <>
          <Sub>
            Receipt <code>{r.code}</code>
          </Sub>
          <Row>
            <button type="button" className="btn" aria-expanded={shown} onClick={() => setShown((x) => !x)}>
              {shown ? `Hide the receipt for version ${v.version}` : `Show the receipt for version ${v.version}`}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => { void receiptMatches(r, v).then((ok) => setCheck(ok ? 'ok' : 'bad')); }}
            >
              Check the receipt against your text
            </button>
          </Row>
          {check === 'ok' && <p role="status">The receipt matches this text exactly: it is what Semester took.</p>}
          {check === 'bad' && <p role="alert">The receipt does not match this text. Keep this and tell your instructor.</p>}
          {shown && (
            <pre tabIndex={0} aria-label={`Receipt for version ${v.version}`} style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
              {receiptText(r, { course: a.course, term: a.term, title: a.title }, v.version)}
            </pre>
          )}
        </>
      ) : (
        <Sub>No receipt could be read for this version.</Sub>
      )}
      <details>
        <summary>Read this version</summary>
        <p style={{ whiteSpace: 'pre-wrap' }}>{v.body}</p>
      </details>
    </>
  );
}

