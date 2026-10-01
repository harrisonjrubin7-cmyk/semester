import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { settled, useAttempts } from '../../lib/attempt';
import {
  closeAssignment, createAssignment, extendAssignment, loadAssignments, publishAssignment, when,
  type Assignment,
} from '../../lib/assignments/client';
import { ActionButton, EmptyState, SectionLabel } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

/** A `datetime-local` value (the person's own clock) as an ISO instant. */
const iso = (local: string): string => new Date(local).toISOString();

const BLANK = { title: '', instructions: '', points: '', due: '', latePolicy: 'refuse' as 'refuse' | 'accept', lateUntil: '', attempts: '1' };

/**
 * An instructor's assignments for one course and term: write one, publish it,
 * close it, and give one student more time with a reason.
 *
 * The database decides everything (`20261001010000_assignments.sql`): who may,
 * whether the school runs assignments in Core, the late rules. This asks, and
 * shows the server's own sentence when it refuses. A write that gets no answer
 * keeps its key, so the retry is the same request and cannot double.
 */
export function InstructorAssignments({ school, course, term, timeZone }: { school: string; course: string; term: string; timeZone: string }) {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [list, setList] = useState<Assignment[] | string | null>(null);
  const [reads, setReads] = useState(0);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [extending, setExtending] = useState<string | null>(null);
  const [ext, setExt] = useState({ student: '', due: '', reason: '' });

  useEffect(() => {
    let live = true;
    loadAssignments(school, course, term).then(
      (a) => { if (live) setList(a); },
      (e: unknown) => { if (live) setList(e instanceof Error ? e.message : 'The assignments could not be read.'); },
    );
    return () => { live = false; };
  }, [school, course, term, reads]);

  async function write<T>(what: string, run: (key: string) => Promise<T>, done: string): Promise<boolean> {
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, run);
      setSaid({ tone: 'ok', text: done });
      say(done);
      setReads((n) => n + 1);
      return true;
    } catch (e) {
      const text = e instanceof Error ? e.message : 'That was not saved.';
      setSaid(settled(e) ? { tone: 'refused', text } : { tone: 'unknown', text, retry: () => void write(what, run, done) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const canCreate = form.title.trim() !== '' && form.due !== '';

  return (
    <section aria-label="Assignments">
      <SectionLabel>Assignments · {course} · {term}</SectionLabel>
      <Result said={said} />
      {list === null && <p role="status">Reading this course’s assignments…</p>}
      {typeof list === 'string' && <p role="alert">{list}</p>}
      {Array.isArray(list) && list.length === 0 && (
        <EmptyState inline title="No assignments yet" body="Write the first one below. A student sees it only once you publish it." />
      )}
      {Array.isArray(list) && list.length > 0 && (
        <Rows label="Assignments">
          {list.map((a) => (
            <RowItem key={a.id}>
              <div><strong>{a.title}</strong> · {a.status}</div>
              <Sub>
                Due {when(a.dueAt, timeZone)} ({timeZone}) · {a.attempts} attempt{a.attempts === 1 ? '' : 's'} ·{' '}
                {a.latePolicy === 'refuse' ? 'no late work' : a.lateUntil ? `late work until ${when(a.lateUntil, timeZone)}` : 'late work taken, flagged late'}
                {a.points != null ? ` · ${a.points} points` : ''}
              </Sub>
              <Row>
                {a.status === 'draft' && (
                  <ActionButton disabled={busy} onClick={() => void write(`publish:${a.id}`, (k) => publishAssignment(a.id, k), `${a.title} is published.`)}>
                    Publish
                  </ActionButton>
                )}
                {a.status === 'published' && (
                  <>
                    <ActionButton disabled={busy} onClick={() => void write(`close:${a.id}`, (k) => closeAssignment(a.id, k), `${a.title} is closed.`)}>
                      Close
                    </ActionButton>
                    <ActionButton tone="ghost" onClick={() => { setExtending(extending === a.id ? null : a.id); setExt({ student: '', due: '', reason: '' }); }}>
                      Give a student more time
                    </ActionButton>
                  </>
                )}
              </Row>
              {extending === a.id && (
                <Stack label={`Extension for ${a.title}`}>
                  <Field label="Student’s account id" hint="From the roster in the gradebook.">
                    {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={ext.student} onChange={(e) => setExt({ ...ext, student: e.target.value.trim() })} />}
                  </Field>
                  <Field label="New due date">
                    {(ids) => <input id={ids.id} className="input" type="datetime-local" value={ext.due} onChange={(e) => setExt({ ...ext, due: e.target.value })} />}
                  </Field>
                  <Field label="Reason" hint="Kept with the extension; the student sees it.">
                    {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={ext.reason} onChange={(e) => setExt({ ...ext, reason: e.target.value })} />}
                  </Field>
                  <ActionButton
                    tone="primary"
                    disabled={busy || !ext.student || !ext.due || !ext.reason.trim()}
                    onClick={() =>
                      void write(`extend:${a.id}:${ext.student}`, (k) => extendAssignment(a.id, ext.student, iso(ext.due), null, ext.reason, k), 'Extension granted.').then((ok) => { if (ok) setExtending(null); })
                    }
                  >
                    Grant the extension
                  </ActionButton>
                </Stack>
              )}
            </RowItem>
          ))}
        </Rows>
      )}

      <SectionLabel>New assignment</SectionLabel>
      <Stack label="New assignment">
        <Field label="Title">
          {(ids) => <input id={ids.id} className="input" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
        </Field>
        <Field label="Instructions">
          {(ids) => <textarea id={ids.id} className="input" rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />}
        </Field>
        <Row end>
          <Field label="Due" hint={`Your own clock; kept as an exact moment and shown in ${timeZone}.`}>
            {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" type="datetime-local" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />}
          </Field>
          <Field label="Points (optional)">
            {(ids) => <input id={ids.id} className="input" inputMode="decimal" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />}
          </Field>
          <Field label="Attempts">
            {(ids) => (
              <select id={ids.id} className="input" value={form.attempts} onChange={(e) => setForm({ ...form, attempts: e.target.value })}>
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </Field>
        </Row>
        <Row end>
          <Field label="Late work">
            {(ids) => (
              <select id={ids.id} className="input" value={form.latePolicy} onChange={(e) => setForm({ ...form, latePolicy: e.target.value as 'refuse' | 'accept' })}>
                <option value="refuse">Not taken after the due date</option>
                <option value="accept">Taken, flagged late</option>
              </select>
            )}
          </Field>
          {form.latePolicy === 'accept' && (
            <Field label="Last time late work is taken (optional)">
              {(ids) => <input id={ids.id} className="input" type="datetime-local" value={form.lateUntil} onChange={(e) => setForm({ ...form, lateUntil: e.target.value })} />}
            </Field>
          )}
        </Row>
        <ActionButton
          tone="primary"
          disabled={busy || !canCreate}
          onClick={() =>
            void write(
              `create:${course}:${term}:${form.title}:${form.due}`,
              (k) => createAssignment(course, term, {
                title: form.title.trim(), instructions: form.instructions, points: form.points.trim() === '' ? null : Number(form.points),
                dueAt: iso(form.due), latePolicy: form.latePolicy, lateUntil: form.latePolicy === 'accept' && form.lateUntil ? iso(form.lateUntil) : null,
                attempts: Number(form.attempts),
              }, k),
              'Saved as a draft. Publish it when students should see it.',
            ).then((ok) => { if (ok) setForm(BLANK); })
          }
        >
          Save as a draft
        </ActionButton>
      </Stack>
    </section>
  );
}
