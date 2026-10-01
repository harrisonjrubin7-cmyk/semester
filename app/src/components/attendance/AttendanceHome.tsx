import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { termOf } from '../../lib/gradebook/client';
import { formatDateTime } from '../../lib/locale';
import {
  MARK_WORDS, REASON_WORDS, attendanceOfferings, checkIn, closeSession, currentMarks, loadMarks, loadSessions, markStudent, offeringKey,
  openSession, tally, type Mark, type MarkStatus, type Session,
} from '../../lib/attendance/client';
import { ActionButton, EmptyState, Notice, SectionLabel, TabList } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
type View = 'taking' | 'attending';

/**
 * Attendance, for whoever the database says takes it or is on the roster, in a
 * school that runs it in Core. In Connect it says the school's own system holds
 * attendance and stops. Whether a check-in is accepted is the database's
 * decision (`20261001020000_attendance.sql`); this asks and shows its answer.
 */
export function AttendanceHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [view, setView] = useState<View>('taking');
  const [picked, setPicked] = useState('');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see attendance. It is your school’s record, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs attendance in Semester…</p>;
  const mode = resolveModuleMode('attendance', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own system holds attendance, so there is nothing to check in to here. Semester shows it here only when your school switches attendance to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read which courses you teach or take. Nothing has changed. Try again in a moment.</Notice>;
  const { taking, attending } = attendanceOfferings(grants, school.id);
  if (taking.length === 0 && attending.length === 0) return <Notice>Your account is not on any course’s attendance. Your school assigns course roles; ask your department office if one is missing.</Notice>;

  const both = taking.length > 0 && attending.length > 0;
  const showing: View = both ? view : taking.length > 0 ? 'taking' : 'attending';
  const offerings = showing === 'taking' ? taking : attending;
  const now = termOf(new Date());
  const chosen = offerings.find((o) => offeringKey(o) === picked) ?? offerings.find((o) => o.term === now) ?? offerings[0];
  const key = offeringKey(chosen);

  return (
    <>
      {both && <TabList label="Attendance views" value={view} onChange={setView} tabs={[{ id: 'taking', label: 'Courses you teach' }, { id: 'attending', label: 'Your attendance' }]} />}
      <Row end>
        <Field label="Course and term" hint="Each course in each term your school has given you a role in.">
          {(ids) => (
            <select id={ids.id} aria-describedby={ids.hint} className="input" value={key} onChange={(e) => setPicked(e.target.value)}>
              {offerings.map((o) => <option key={offeringKey(o)} value={offeringKey(o)}>{o.course} · {o.term}</option>)}
            </select>
          )}
        </Field>
      </Row>
      {showing === 'taking'
        ? <TakeAttendance key={key} school={school.id} course={chosen.course} term={chosen.term} />
        : <MyAttendance key={key} school={school.id} course={chosen.course} term={chosen.term} />}
    </>
  );
}

function useWrite(): { said: Said | null; busy: boolean; write: <T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string) => Promise<boolean>; clear: () => void } {
  const { say } = useStore();
  const { attempt } = useAttempts();
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  async function write<T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string): Promise<boolean> {
    setBusy(true); setSaid(null);
    try {
      const v = await attempt(what, run);
      const t = done(v);
      setSaid({ tone: 'ok', text: t }); say(t);
      return true;
    } catch (e) {
      const t = e instanceof Error ? e.message : 'That was not saved.';
      setSaid(e instanceof ServiceError && !e.answered ? { tone: 'unknown', text: t, retry: () => void write(what, run, done) } : { tone: 'refused', text: t });
      return false;
    } finally { setBusy(false); }
  }
  return { said, busy, write, clear: () => setSaid(null) };
}

function TakeAttendance({ school, course, term }: { school: string; course: string; term: string }): ReactNode {
  const [sessions, setSessions] = useState<Session[] | string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [reads, setReads] = useState(0);
  const { said, busy, write } = useWrite();
  const [form, setForm] = useState({ title: '', minutes: '60', lateAfter: '10' });
  const [mark, setMark] = useState({ student: '', status: 'present' as MarkStatus, note: '' });
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [s, m] = await Promise.all([loadSessions(school, course, term), loadMarks(school, course, term)]);
        if (live) { setSessions(s); setMarks(m); }
      } catch (e) { if (live) setSessions(e instanceof Error ? e.message : 'The sessions could not be read.'); }
    })();
    return () => { live = false; };
  }, [school, course, term, reads]);

  const open = () => {
    const now = new Date();
    const closes = new Date(now.getTime() + Math.min(Math.max(Number(form.minutes) || 60, 5), 720) * 60000);
    return write(`open:${course}:${term}:${form.title}:${now.getTime() - (now.getTime() % 60000)}`,
      (k) => openSession(course, term, { title: form.title.trim(), heldOn: now.toISOString().slice(0, 10), opensAt: now.toISOString(), closesAt: closes.toISOString(), lateAfter: Number(form.lateAfter) || 10 }, k),
      (r) => `Open. The code is ${r.code}.`).then((ok) => { if (ok) setReads((n) => n + 1); });
  };

  return (
    <section aria-label="Take attendance">
      <SectionLabel>Attendance · {course} · {term}</SectionLabel>
      <Result said={said} />
      <Stack label="Open a session">
        <Field label="Title (optional)">{(ids) => <input id={ids.id} className="input" value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <Row end>
          <Field label="Open for (minutes)">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />}</Field>
          <Field label="Late after (minutes)">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={form.lateAfter} onChange={(e) => setForm({ ...form, lateAfter: e.target.value })} />}</Field>
        </Row>
        <ActionButton tone="primary" disabled={busy} onClick={() => void open()}>Open a session now</ActionButton>
      </Stack>
      {sessions === null && <p role="status">Reading this course’s sessions…</p>}
      {typeof sessions === 'string' && <p role="alert">{sessions}</p>}
      {Array.isArray(sessions) && sessions.length === 0 && <EmptyState inline title="No sessions yet" body="Open one when class starts; students check in with the code." />}
      {Array.isArray(sessions) && sessions.length > 0 && (
        <Rows label="Sessions">
          {sessions.map((s) => {
            const mine = currentMarks(marks.filter((m) => m.sessionId === s.id));
            return (
              <RowItem key={s.id}>
                <div><strong>{s.title || s.heldOn}</strong> · {s.status}{s.status === 'open' ? <> · code <strong style={{ fontSize: 'var(--type-xl)', letterSpacing: '0.1em' }}>{s.code}</strong></> : null}</div>
                <Sub>{at(s.opensAt)} to {at(s.closesAt)} · late after {s.lateAfter} min · {mine.length} marked ({mine.filter((m) => m.status === 'present' || m.status === 'late').length} here)</Sub>
                <Row>
                  {s.status === 'open' && (
                    <ActionButton disabled={busy} onClick={() => void write(`close:${s.id}`, (k) => closeSession(s.id, k), (n) => `Closed. ${n} student${n === 1 ? '' : 's'} marked absent.`).then((ok) => { if (ok) setReads((n) => n + 1); })}>Close and mark the rest absent</ActionButton>
                  )}
                  <ActionButton tone="ghost" onClick={() => { setMarking(marking === s.id ? null : s.id); setMark({ student: '', status: 'present', note: '' }); }}>Mark a student</ActionButton>
                </Row>
                {marking === s.id && (
                  <Stack label={`Mark a student for ${s.title || s.heldOn}`}>
                    <Field label="Student’s account id" hint="From the roster in the gradebook.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={mark.student} onChange={(e) => setMark({ ...mark, student: e.target.value.trim() })} />}</Field>
                    <Field label="Mark">
                      {(ids) => (
                        <select id={ids.id} className="input" value={mark.status} onChange={(e) => setMark({ ...mark, status: e.target.value as MarkStatus })}>
                          {(Object.keys(MARK_WORDS) as MarkStatus[]).map((k) => <option key={k} value={k}>{MARK_WORDS[k]}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Note" hint={mark.status === 'excused' ? 'Required for an excused absence.' : 'Optional.'}>{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={mark.note} onChange={(e) => setMark({ ...mark, note: e.target.value })} />}</Field>
                    <ActionButton tone="primary" disabled={busy || !mark.student || (mark.status === 'excused' && !mark.note.trim())}
                      onClick={() => void write(`mark:${s.id}:${mark.student}:${mark.status}:${mark.note}`, (k) => markStudent(s.id, mark.student, mark.status, mark.note, k), (v) => `Saved as version ${v}.`).then((ok) => { if (ok) { setMarking(null); setReads((n) => n + 1); } })}>
                      Save the mark
                    </ActionButton>
                  </Stack>
                )}
              </RowItem>
            );
          })}
        </Rows>
      )}
    </section>
  );
}

function MyAttendance({ school, course, term }: { school: string; course: string; term: string }): ReactNode {
  const [marks, setMarks] = useState<Mark[] | string | null>(null);
  const [reads, setReads] = useState(0);
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState<Said | null>(null);
  const [sending, setSending] = useState(false);
  const { attempt } = useAttempts();
  const { say } = useStore();

  useEffect(() => {
    let live = true;
    loadMarks(school, course, term).then((m) => { if (live) setMarks(m); }, (e: unknown) => { if (live) setMarks(e instanceof Error ? e.message : 'Your attendance could not be read.'); });
    return () => { live = false; };
  }, [school, course, term, reads]);

  async function go() {
    setSending(true); setAnswer(null);
    try {
      const r = await attempt(`checkin:${code}`, (k) => checkIn(code, k));
      if (r.ok) { const t = `Checked in: ${MARK_WORDS[r.status].toLowerCase()} for ${r.course}.`; setAnswer({ tone: 'ok', text: t }); say(t); setCode(''); setReads((n) => n + 1); }
      else setAnswer({ tone: 'refused', text: REASON_WORDS[r.reason] });
    } catch (e) {
      const t = e instanceof Error ? e.message : 'Your check-in was not sent.';
      setAnswer(e instanceof ServiceError && !e.answered ? { tone: 'unknown', text: t, retry: () => void go() } : { tone: 'refused', text: t });
    } finally { setSending(false); }
  }

  const current = Array.isArray(marks) ? currentMarks(marks).sort((a, b) => b.heldOn.localeCompare(a.heldOn)) : [];
  const t = tally(Array.isArray(marks) ? marks : []);
  return (
    <section aria-label="Your attendance">
      <SectionLabel>Attendance · {course} · {term}</SectionLabel>
      <Stack label="Check in">
        <Field label="Code from your instructor" hint="Six digits, shown in class.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />}
        </Field>
        <ActionButton tone="primary" disabled={sending || code.length !== 6} onClick={() => void go()}>Check in</ActionButton>
        <Result said={answer} />
      </Stack>
      {marks === null && <p role="status">Reading your attendance…</p>}
      {typeof marks === 'string' && <p role="alert">{marks}</p>}
      {Array.isArray(marks) && current.length === 0 && <EmptyState inline title="No attendance yet" body="Your marks appear here once you check in or your instructor marks you." />}
      {current.length > 0 && (
        <>
          <Sub>{t.present} present · {t.late} late · {t.absent} absent · {t.excused} excused</Sub>
          <Rows label="Your attendance">
            {current.map((m) => (
              <RowItem key={m.id}><div>{m.heldOn} · <strong>{MARK_WORDS[m.status]}</strong>{m.method === 'instructor' ? ' · marked by your instructor' : ''}{m.note ? ` — ${m.note}` : ''}</div></RowItem>
            ))}
          </Rows>
        </>
      )}
    </section>
  );
}
