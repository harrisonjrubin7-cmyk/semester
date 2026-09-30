import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ActionButton, EmptyState, Notice } from '../ui';
import { Field, Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime, formatNumber } from '../../lib/locale';
import {
  closeAssignment,
  createAssignment,
  extendAssignment,
  loadAssignments,
  publishAssignment,
  reviseAssignment,
  type Loaded,
} from '../../lib/assignments/client';
import { LIMITS, STATUS_TEXT } from '../../lib/assignments/model';
import type { Assignment, AssignmentCapability, Draft } from '../../lib/assignments/model';
import { byUrgency, draftProblem, extensionProblem, fingerprint, latest, publishProblem, windowFor } from '../../lib/assignments/views';

/**
 * An instructor's assignments for one course and term: write one, publish it,
 * read what has been submitted, grant an extension, close it.
 *
 * What a person may do comes from their own course-and-term grants
 * (`caps`), and the database checks the same thing again on every write: a
 * teaching assistant holds `assignments:review`, sees every submission and
 * never gets a button that authors. Only a draft can be revised, because a
 * student may already have read a published one; after publication what
 * changes is a close or a per-student extension, each with its own record.
 *
 * The roster is not readable by a client (the gradebook's precedent), so the
 * students listed are those who have submitted or been given an extension,
 * and another can be added by account id. Semester checks they are enrolled in
 * this course before granting anything.
 */

const when = (iso: string): string => formatDateTime(new Date(iso), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** An ISO time as the value of a `datetime-local` field, in the viewer's own zone. */
function local(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocal = (v: string): string => (v ? new Date(v).toISOString() : '');

const BLANK: Draft = { title: '', instructions: '', dueAt: '', closesAt: null, allowResubmission: true, maxVersions: LIMITS.versionsDefault };

export function InstructorAssignments({
  course, term, caps, writable,
}: { course: string; term: string; caps: readonly AssignmentCapability[]; writable: boolean }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [data, setData] = useState<Loaded | null | string>(null);
  const [reads, setReads] = useState(0);
  const [form, setForm] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<Said | null>(null);
  const formHead = useRef<HTMLHeadingElement>(null);
  const author = caps.includes('assignments:author');

  useEffect(() => {
    let live = true;
    loadAssignments(course, term).then(
      (d) => { if (live) setData(d); },
      (e: unknown) => { if (live) setData(e instanceof Error ? e.message : 'Could not load these assignments.'); },
    );
    return () => { live = false; };
  }, [course, term, reads]);

  useEffect(() => { if (form) formHead.current?.focus(); }, [form]);

  const list = useMemo(() => (data && typeof data === 'object' ? [...data.assignments].sort(byUrgency) : []), [data]);

  async function write(what: string, run: (key: string) => Promise<unknown>, done: string, after?: () => void): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, run);
      setSaid({ tone: 'ok', text: done });
      say(done);
      after?.();
      setReads((n) => n + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'That did not go through.';
      setSaid(settled(e) ? { tone: 'refused', text: msg } : { tone: 'unknown', text: `${msg} It may have gone through; try again and it will not be done twice.`, retry: () => void write(what, run, done, after) });
    } finally {
      setBusy(false);
    }
  }

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
  if (data === null) return <p role="status">Loading the assignments for {course}…</p>;

  if (form) {
    const problem = draftProblem(form.draft);
    const set = (patch: Partial<Draft>) => setForm({ id: form.id, draft: { ...form.draft, ...patch } });
    return (
      <section aria-labelledby="assignment-form-head">
        <h3 id="assignment-form-head" ref={formHead} tabIndex={-1}>
          {form.id ? 'Revise the draft' : 'New assignment'}
        </h3>
        <Result said={said} />
        <Stack>
          <Field label="Title" hint={`Up to ${LIMITS.title} characters.`}>
            {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" maxLength={LIMITS.title} value={form.draft.title} onChange={(e) => set({ title: e.target.value })} />}
          </Field>
          <Field label="Instructions" hint={`What students should do. Up to ${formatNumber(LIMITS.instructions)} characters.`}>
            {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={6} value={form.draft.instructions} onChange={(e) => set({ instructions: e.target.value })} />}
          </Field>
          <Field label="Due" hint="In your own time zone. Work after this is taken and marked late.">
            {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={local(form.draft.dueAt)} onChange={(e) => set({ dueAt: fromLocal(e.target.value) })} />}
          </Field>
          <Field label="Stops taking work (optional)" hint="Leave empty to keep taking late work until you close it.">
            {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={local(form.draft.closesAt)} onChange={(e) => set({ closesAt: e.target.value ? fromLocal(e.target.value) : null })} />}
          </Field>
          <Field label="Resubmission" hint="Whether a student may submit again. Every version is kept.">
            {(ids) => (
              <label htmlFor={ids.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input id={ids.id} aria-describedby={ids.hint} type="checkbox" checked={form.draft.allowResubmission} onChange={(e) => set({ allowResubmission: e.target.checked, maxVersions: e.target.checked ? LIMITS.versionsDefault : 1 })} />
                Students may submit more than once
              </label>
            )}
          </Field>
          {form.draft.allowResubmission && (
            <Field label="Most versions" hint={`Between 1 and ${LIMITS.versionsMax}.`}>
              {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" type="number" min={1} max={LIMITS.versionsMax} value={form.draft.maxVersions} onChange={(e) => set({ maxVersions: Number.parseInt(e.target.value, 10) || 0 })} />}
            </Field>
          )}
          {problem && form.draft.title.length + form.draft.dueAt.length > 0 && <p role="alert">{problem}</p>}
          <Row>
            <ActionButton
              tone="primary"
              disabled={busy || problem !== null}
              style={{ width: 'auto', flex: '1 1 auto' }}
              onClick={() =>
                void write(
                  `${form.id ? 'revise' : 'create'}:${form.id ?? course}:${fingerprint(JSON.stringify(form.draft))}`,
                  (key) => (form.id ? reviseAssignment(form.id, form.draft, key) : createAssignment(course, term, form.draft, key)),
                  form.id ? 'The draft is changed.' : 'The draft is saved. Students cannot see it until you publish it.',
                  () => setForm(null),
                )
              }
            >
              {form.id ? 'Save the changes' : 'Save the draft'}
            </ActionButton>
            <button type="button" className="btn" disabled={busy} onClick={() => setForm(null)}>
              Cancel
            </button>
          </Row>
        </Stack>
      </section>
    );
  }

  return (
    <>
      <Result said={said} />
      {author && (
        <Row>
          <button type="button" className="btn" disabled={!writable} onClick={() => { setForm({ id: null, draft: BLANK }); setSaid(null); }}>
            New assignment
          </button>
        </Row>
      )}
      {!author && <Notice>You can read every submission in this course. Only an instructor can write or publish assignments.</Notice>}
      {list.length === 0 ? (
        <EmptyState inline title="No assignments yet" body={author ? `Write the first ${course} assignment for ${term}. It stays a draft until you publish it.` : `No ${course} assignments have been written for ${term}.`} />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label={`Assignments in ${course}, ${term}`}>
          {list.map((a) => (
            <li key={a.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--app-rule)' }}>
              <Line
                a={a}
                data={data}
                author={author}
                writable={writable}
                busy={busy}
                viewing={viewing === a.id}
                onView={() => setViewing(viewing === a.id ? null : a.id)}
                onRevise={() => { setForm({ id: a.id, draft: { title: a.title, instructions: a.instructions, dueAt: a.dueAt, closesAt: a.closesAt, allowResubmission: a.allowResubmission, maxVersions: a.maxVersions } }); setSaid(null); }}
                onPublish={() => void write(`publish:${a.id}`, (key) => publishAssignment(a.id, key), `${a.title} is published. Students can see it now.`)}
                onClose={() => void write(`close:${a.id}`, (key) => closeAssignment(a.id, key), `${a.title} is closed. It takes nothing more.`)}
                onExtend={() => setExtending(extending === a.id ? null : a.id)}
                extending={extending === a.id}
                write={write}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Line({
  a, data, author, writable, busy, viewing, extending, onView, onRevise, onPublish, onClose, onExtend, write,
}: {
  a: Assignment;
  data: Loaded;
  author: boolean;
  writable: boolean;
  busy: boolean;
  viewing: boolean;
  extending: boolean;
  onView: () => void;
  onRevise: () => void;
  onPublish: () => void;
  onClose: () => void;
  onExtend: () => void;
  write: (what: string, run: (key: string) => Promise<unknown>, done: string, after?: () => void) => Promise<void>;
}) {
  const versions = data.versions.filter((v) => v.assignmentId === a.id);
  const students = [...new Set([...versions.map((v) => v.studentId), ...data.extensions.filter((e) => e.assignmentId === a.id).map((e) => e.studentId)])].sort();
  const late = new Set(versions.filter((v) => v.late).map((v) => v.studentId)).size;
  const can = publishProblem(a, new Date());
  return (
    <>
      <strong>{a.title}</strong> · {STATUS_TEXT[a.status]}
      <Sub>
        Due {when(a.dueAt)}
        {a.closesAt ? ` · stops taking work ${when(a.closesAt)}` : ''}
      </Sub>
      <Sub>
        {students.length === 0 ? 'No submissions yet.' : `${students.length} ${students.length === 1 ? 'student has' : 'students have'} submitted; ${late} late.`}
      </Sub>
      <Row>
        <button type="button" className="btn" aria-expanded={viewing} onClick={onView}>
          {viewing ? `Hide submissions to ${a.title}` : `Read submissions to ${a.title}`}
        </button>
        {author && a.status === 'draft' && (
          <>
            <button type="button" className="btn" disabled={!writable || busy} onClick={onRevise}>
              Revise {a.title}
            </button>
            <button type="button" className="btn" disabled={!writable || busy || can !== null} aria-describedby={can ? `why-${a.id}` : undefined} onClick={onPublish}>
              Publish {a.title}
            </button>
          </>
        )}
        {author && a.status === 'published' && (
          <>
            <button type="button" className="btn" disabled={!writable || busy} onClick={onExtend} aria-expanded={extending}>
              Extend {a.title} for a student
            </button>
            <button type="button" className="btn" disabled={!writable || busy} onClick={onClose}>
              Close {a.title}
            </button>
          </>
        )}
      </Row>
      {a.status === 'draft' && can && <p id={`why-${a.id}`}><Sub>{can}</Sub></p>}
      {extending && <Extend a={a} data={data} students={students} busy={busy} write={write} />}
      {viewing && <Submissions data={data} a={a} students={students} />}
      <History data={data} a={a} />
    </>
  );
}

function Submissions({ data, a, students }: { data: Loaded; a: Assignment; students: string[] }) {
  if (students.length === 0) return <Sub>Nothing has been submitted to this yet.</Sub>;
  return (
    <div className="integration-table-wrap">
      <table className="integration-table">
        <caption className="sr-only">Submissions to {a.title}, one row per student.</caption>
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Versions</th>
            <th scope="col">Latest taken</th>
            <th scope="col">Receipt</th>
            <th scope="col">Read</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const mine = data.versions.filter((v) => v.assignmentId === a.id && v.studentId === s);
            const last = latest(mine);
            const r = last ? data.receipts.find((x) => x.versionId === last.id) : null;
            const w = windowFor(a, data.extensions, s);
            return (
              <tr key={s}>
                <th scope="row">
                  <code>{s.slice(0, 8)}</code>
                  {w.extended ? <Sub>Extended to {when(w.dueAt)}</Sub> : null}
                </th>
                <td>{mine.length}</td>
                <td>{last ? `${when(last.submittedAt)}${last.late ? ' · late' : ''}` : '—'}</td>
                <td>{r ? <code>{r.code}</code> : '—'}</td>
                <td>
                  {last ? (
                    <details>
                      <summary>Version {last.version}</summary>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{last.body}</p>
                    </details>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Extend({
  a, data, students, busy, write,
}: {
  a: Assignment;
  data: Loaded;
  students: string[];
  busy: boolean;
  write: (what: string, run: (key: string) => Promise<unknown>, done: string, after?: () => void) => Promise<void>;
}) {
  const [who, setWho] = useState(students[0] ?? '');
  const [typed, setTyped] = useState('');
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('');
  const student = typed.trim() || who;
  const w = windowFor(a, data.extensions, student);
  const problem = student ? extensionProblem(w, fromLocal(due), null, reason) : 'Choose a student.';
  return (
    <Stack label={`Extend ${a.title} for one student`}>
      {students.length > 0 && (
        <Field label="Student who has submitted" hint="Or add another by account id below.">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={who} onChange={(e) => setWho(e.target.value)}>
              {students.map((s) => <option key={s} value={s}>{s.slice(0, 8)}</option>)}
            </select>
          )}
        </Field>
      )}
      <Field label="Another student’s account id" hint="The roster is not readable here. Semester checks this student is enrolled in this course.">
        {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />}
      </Field>
      <Field label="New due time" hint={`Later than the time that already applies to them: ${when(w.dueAt)}.`}>
        {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />}
      </Field>
      <Field label="Reason" hint={`Kept with the extension. Up to ${LIMITS.reason} characters.`}>
        {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={3} maxLength={LIMITS.reason} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      {problem && (due || reason) && <p role="alert">{problem}</p>}
      <ActionButton
        tone="primary"
        disabled={busy || problem !== null}
        style={{ width: 'auto' }}
        onClick={() => void write(`extend:${a.id}:${student}:${fingerprint(due + reason)}`, (key) => extendAssignment(a.id, student, fromLocal(due), null, reason.trim(), key), 'The extension is granted and recorded with its reason.')}
      >
        Grant the extension
      </ActionButton>
    </Stack>
  );
}

function History({ data, a }: { data: Loaded; a: Assignment }) {
  const events = data.events.filter((e) => e.assignmentId === a.id);
  if (events.length === 0) return null;
  return (
    <details>
      <summary>What has happened to {a.title}</summary>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {e.action[0].toUpperCase() + e.action.slice(1)} · {when(e.at)}
          </li>
        ))}
      </ul>
    </details>
  );
}

