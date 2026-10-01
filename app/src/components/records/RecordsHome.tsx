import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import { asGradebook, authoredCourses, loadBook, offeringKey, termOf, type Offering } from '../../lib/gradebook/client';
import { finalGrade } from '../../lib/gradebook/compute';
import { releasedFor } from '../../lib/gradebook/ledger';
import {
  RECIPIENT_WORDS, acceptGrades, codeWords, issueDocument, loadClearances, loadDisclosures, loadDocuments, logDisclosure, postGrades,
  recordsCapabilities, revokeDocument, runClearance, transcriptView, type Clearance, type Disclosure, type RecipientKind, type RecordDocument,
  type RecordsCapability,
} from '../../lib/records/client';
import { ActionButton, EmptyState, Notice, SectionLabel, TabList } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
type View = 'mine' | 'grades' | 'office';

/**
 * Records, in a school that runs them in Core: your own documents and who has
 * seen your record, an instructor’s final grades, and the registrar’s office.
 * In Connect it says the school’s own system holds records and stops. What is
 * issued, to whom and whether a student is cleared is the database’s answer
 * (`20261001050000_records_transcripts.sql`); this asks and shows it.
 */
export function RecordsHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);
  const [view, setView] = useState<View>('mine');

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see records. They are your school’s, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs records in Semester…</p>;
  const mode = resolveModuleMode('records', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own system holds your records and issues transcripts. Semester shows them here only when your school switches records to Core. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  const held = recordsCapabilities(grants, school.id);
  const teaching = authoredCourses(grants, school.id).filter((c) => c.capabilities.includes('grades:release'));
  const office = held.size > 0;
  const tabs: { id: View; label: string }[] = [{ id: 'mine', label: 'Your record' }];
  if (teaching.length > 0) tabs.push({ id: 'grades', label: 'Final grades' });
  if (office) tabs.push({ id: 'office', label: 'Records office' });
  const showing: View = tabs.some((t) => t.id === view) ? view : 'mine';
  return (
    <>
      {tabs.length > 1 && <TabList label="Records views" value={showing} onChange={setView} tabs={tabs} />}
      {showing === 'mine' && <MyRecord school={school.id} />}
      {showing === 'grades' && <FinalGrades school={school.id} offerings={teaching} />}
      {showing === 'office' && <Office school={school.id} held={held} />}
    </>
  );
}

function useWrite(): { said: Said | null; busy: boolean; write: <T>(what: string, run: (key: string) => Promise<T>, done: (v: T) => string) => Promise<boolean> } {
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
  return { said, busy, write };
}

function DocumentView({ doc }: { doc: RecordDocument }): ReactNode {
  const t = transcriptView(doc.content);
  return (
    <section aria-label={doc.kind === 'transcript' ? 'Official transcript' : 'Enrollment verification'}>
      <SectionLabel>{doc.kind === 'transcript' ? 'Official transcript' : 'Enrollment verification'} · as of {doc.asOf}</SectionLabel>
      {doc.kind === 'transcript' && (
        <>
          {t.terms.map((term) => (
            <div key={term.term}>
              <strong>{term.term}</strong> · {term.credits} credits{term.gpa === null ? '' : ` · GPA ${term.gpa.toFixed(2)}`}
              <Sub>{term.courses.map((c) => `${c.course} ${c.grade}${c.credits === null ? '' : ` (${c.credits})`}`).join(' · ')}</Sub>
            </div>
          ))}
          {t.transfer.length > 0 && <Sub>Transfer credit: {t.transfer.map((c) => `${c.course}${c.credits === null ? '' : ` (${c.credits})`}`).join(' · ')}</Sub>}
          <p><strong>Cumulative:</strong> {t.cumulative.credits} credits{t.cumulative.gpa === null ? '' : ` · GPA ${t.cumulative.gpa.toFixed(2)}`}</p>
        </>
      )}
      {t.enrollment.length > 0 && <Sub>Enrollment: {t.enrollment.join(' · ')}</Sub>}
      {t.standing.length > 0 && <Sub>Standing: {t.standing.join(' · ')}</Sub>}
      {t.conferred.length > 0 && <Sub>Conferred: {t.conferred.join(' · ')}</Sub>}
      <Sub>Verification code <strong>{codeWords(doc.code)}</strong> · SHA-256 {doc.hash.slice(0, 16)}… · issued {at(doc.issuedAt)} · code valid until {at(doc.expiresAt)}{doc.revoked ? ' · REVOKED' : ''}</Sub>
      <ActionButton tone="ghost" onClick={() => window.print()}>Print</ActionButton>
    </section>
  );
}

function MyRecord({ school }: { school: string }): ReactNode {
  const [docs, setDocs] = useState<RecordDocument[] | string | null>(null);
  const [log, setLog] = useState<Disclosure[]>([]);
  const [clear, setClear] = useState<Clearance[]>([]);
  const [open, setOpen] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([loadDocuments(school), loadDisclosures(school), loadClearances(school)]).then(
      ([d, l, c]) => { if (live) { setDocs(d); setLog(l); setClear(c); } },
      (e: unknown) => { if (live) setDocs(e instanceof Error ? e.message : 'Your record could not be read.'); },
    );
    return () => { live = false; };
  }, [school]);
  if (docs === null) return <p role="status">Reading your documents…</p>;
  if (typeof docs === 'string') return <p role="alert">{docs}</p>;
  const shown = docs.find((d) => d.id === open);
  return (
    <section aria-label="Your record">
      <SectionLabel>Your documents</SectionLabel>
      {docs.length === 0
        ? <EmptyState inline title="Nothing issued yet" body="When your registrar issues you a transcript or a letter, it appears here with a code anyone you share it with can check." />
        : (
          <Rows label="Your documents">
            {docs.map((d) => (
              <RowItem key={d.id}>
                <div><strong>{d.kind === 'transcript' ? 'Transcript' : 'Enrollment letter'}</strong> · {at(d.issuedAt)}{d.recipient ? ` · to ${d.recipient}` : ''}{d.revoked ? ' · revoked' : ''}</div>
                <Row><ActionButton tone="ghost" onClick={() => setOpen(open === d.id ? '' : d.id)}>{open === d.id ? 'Hide' : 'Show'}</ActionButton></Row>
              </RowItem>
            ))}
          </Rows>
        )}
      {shown && <DocumentView doc={shown} />}
      <SectionLabel>Who has seen your record</SectionLabel>
      {log.length === 0
        ? <p>Nothing has been released to anyone but you.</p>
        : (
          <Rows label="Releases of your record">
            {log.map((d) => (
              <RowItem key={d.id}>
                <div><strong>{d.what}</strong> to {d.recipient} · {at(d.releasedAt)}</div>
                <Sub>{RECIPIENT_WORDS[d.recipientKind]} · {d.basis}{d.consentRef ? ` · consent: ${d.consentRef}` : ''}</Sub>
              </RowItem>
            ))}
          </Rows>
        )}
      {clear.length > 0 && (
        <>
          <SectionLabel>Graduation clearance</SectionLabel>
          <Sub>{clear[0].status === 'cleared' ? 'Cleared' : 'Not yet cleared'} · checked {at(clear[0].runAt)}{clear[0].blocks.length > 0 ? ` · ${clear[0].blocks.join(' ')}` : ''}</Sub>
        </>
      )}
    </section>
  );
}

function FinalGrades({ school, offerings }: { school: string; offerings: readonly Offering[] }): ReactNode {
  const now = termOf(new Date());
  const [picked, setPicked] = useState('');
  const chosen = offerings.find((o) => offeringKey(o) === picked) ?? offerings.find((o) => o.term === now) ?? offerings[0];
  const [rows, setRows] = useState<{ student: string; grade: string }[] | string | null>(null);
  const [credits, setCredits] = useState('3');
  const { said, busy, write } = useWrite();
  const key = offeringKey(chosen);

  useEffect(() => {
    let live = true;
    loadBook(chosen.course, chosen.term).then((b) => {
      if (!live) return;
      const book = asGradebook(b);
      const scheme = b.scheme;
      const list = [...book.roster].sort().map((id) => {
        const f = scheme ? finalGrade(scheme, b.items, releasedFor(book, id)) : null;
        return { student: id, grade: f?.letter ?? '' };
      });
      setRows(list);
    }, (e: unknown) => { if (live) setRows(e instanceof Error ? e.message : 'The gradebook could not be read.'); });
    return () => { live = false; };
  }, [chosen.course, chosen.term, school]);

  const postable = Array.isArray(rows) ? rows.filter((r) => r.grade.trim() !== '') : [];
  return (
    <section aria-label="Post final grades">
      <SectionLabel>Final grades · {chosen.course} · {chosen.term}</SectionLabel>
      <Row end>
        <Field label="Course and term">
          {(ids) => (
            <select id={ids.id} className="input" value={key} onChange={(e) => { setRows(null); setPicked(e.target.value); }}>
              {offerings.map((o) => <option key={offeringKey(o)} value={offeringKey(o)}>{o.course} · {o.term}</option>)}
            </select>
          )}
        </Field>
        <Field label="Credits for every student" hint="The course’s credit value.">
          {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value)} />}
        </Field>
      </Row>
      <Result said={said} />
      {rows === null && <p role="status">Reading the gradebook…</p>}
      {typeof rows === 'string' && <p role="alert">{rows}</p>}
      {Array.isArray(rows) && rows.length === 0 && <EmptyState inline title="No released grades yet" body="Final grades come from the grades you have released in the gradebook." />}
      {Array.isArray(rows) && rows.length > 0 && (
        <>
          <Sub>The letters below are worked out from released grades under your scheme. Change one if it is wrong; the registrar sees what you post, and someone other than you decides what reaches the record.</Sub>
          <Rows label="Final grades">
            {rows.map((r, i) => (
              <RowItem key={r.student}>
                <Row end>
                  <span>{r.student}</span>
                  <Field label="Grade">{(ids) => <input id={ids.id} className="input" maxLength={3} value={r.grade} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grade: e.target.value.toUpperCase() } : x)))} />}</Field>
                </Row>
              </RowItem>
            ))}
          </Rows>
          <ActionButton tone="primary" disabled={busy || postable.length === 0 || !(Number(credits) >= 0)}
            onClick={() => void write(`post:${key}:${postable.map((r) => `${r.student}=${r.grade}`).join(',')}:${credits}`,
              (k) => postGrades(chosen.course, chosen.term, postable.map((r) => ({ student: r.student, grade: r.grade.trim(), credits: Number(credits) })), k),
              (v) => `Posted ${v.posted} grade${v.posted === 1 ? '' : 's'}${v.skipped > 0 ? `; ${v.skipped} student${v.skipped === 1 ? ' has' : 's have'} no record link and ${v.skipped === 1 ? 'was' : 'were'} skipped` : ''}. The registrar accepts them onto the record.`)}>
            Post final grades
          </ActionButton>
        </>
      )}
    </section>
  );
}

const EXCEPTIONS = (Object.keys(RECIPIENT_WORDS) as RecipientKind[]).filter((k): k is Exclude<RecipientKind, 'student'> => k !== 'student');

function Office({ school, held }: { school: string; held: ReadonlySet<RecordsCapability> }): ReactNode {
  const { said, busy, write } = useWrite();
  const [reads, setReads] = useState(0);
  const [docs, setDocs] = useState<RecordDocument[]>([]);
  const [log, setLog] = useState<Disclosure[]>([]);
  const [clearances, setClearances] = useState<Clearance[]>([]);
  const [error, setError] = useState('');
  const [accept, setAccept] = useState({ course: '', term: termOf(new Date()) });
  const [issue, setIssue] = useState({ student: '', kind: 'transcript' as 'transcript' | 'enrollment_verification', recipient: '', recipientKind: 'student' as RecipientKind, basis: '', consent: '' });
  const [revoke, setRevoke] = useState({ id: '', reason: '' });
  const [disc, setDisc] = useState({ student: '', recipient: '', recipientKind: 'school_official' as Exclude<RecipientKind, 'student'>, basis: '', consent: '', what: '' });
  const [clearStudent, setClearStudent] = useState('');
  const [shown, setShown] = useState('');
  const refresh = () => setReads((n) => n + 1);

  useEffect(() => {
    let live = true;
    if (!held.has('records:audit')) return;
    Promise.all([loadDocuments(school), loadDisclosures(school), loadClearances(school)]).then(
      ([d, l, c]) => { if (live) { setDocs(d); setLog(l); setClearances(c); setError(''); } },
      (e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'The office’s records could not be read.'); },
    );
    return () => { live = false; };
  }, [school, reads, held]);

  const doc = docs.find((d) => d.id === shown);
  return (
    <section aria-label="Records office">
      <SectionLabel>Records office</SectionLabel>
      <Result said={said} />
      {error !== '' && <p role="alert">{error}</p>}

      {held.has('records:accept') && (
        <Stack label="Accept posted final grades">
          <Row end>
            <Field label="Course">{(ids) => <input id={ids.id} className="input" value={accept.course} placeholder="ECON 1020" onChange={(e) => setAccept({ ...accept, course: e.target.value.toUpperCase() })} />}</Field>
            <Field label="Term">{(ids) => <input id={ids.id} className="input" value={accept.term} placeholder="2026FA" onChange={(e) => setAccept({ ...accept, term: e.target.value.toUpperCase() })} />}</Field>
            <ActionButton tone="primary" disabled={busy || accept.course.trim() === ''}
              onClick={() => void write(`accept:${accept.course}:${accept.term}`, (k) => acceptGrades(accept.course.trim(), accept.term.trim(), k),
                (n) => `${n} student${n === 1 ? '' : 's'} proposed for the record. Someone else approves each change.`)}>
              Propose them for the record
            </ActionButton>
          </Row>
        </Stack>
      )}

      {held.has('records:issue') && (
        <Stack label="Issue a document">
          <Row end>
            <Field label="Student’s record reference">{(ids) => <input id={ids.id} className="input" value={issue.student} onChange={(e) => setIssue({ ...issue, student: e.target.value.trim() })} />}</Field>
            <Field label="Document">
              {(ids) => (
                <select id={ids.id} className="input" value={issue.kind} onChange={(e) => setIssue({ ...issue, kind: e.target.value as 'transcript' | 'enrollment_verification' })}>
                  <option value="transcript">Official transcript</option>
                  <option value="enrollment_verification">Enrollment verification</option>
                </select>
              )}
            </Field>
          </Row>
          <Field label="Released to">
            {(ids) => (
              <select id={ids.id} className="input" value={issue.recipientKind} onChange={(e) => setIssue({ ...issue, recipientKind: e.target.value as RecipientKind })}>
                {(Object.keys(RECIPIENT_WORDS) as RecipientKind[]).map((k) => <option key={k} value={k}>{RECIPIENT_WORDS[k]}</option>)}
              </select>
            )}
          </Field>
          {issue.recipientKind !== 'student' && (
            <>
              <Field label="Recipient">{(ids) => <input id={ids.id} className="input" value={issue.recipient} onChange={(e) => setIssue({ ...issue, recipient: e.target.value })} />}</Field>
              <Field label="Basis" hint="Why this release is allowed. At least ten characters. It goes in the student’s disclosure log.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={issue.basis} onChange={(e) => setIssue({ ...issue, basis: e.target.value })} />}</Field>
              {issue.recipientKind === 'consent' && <Field label="Reference to the written consent">{(ids) => <input id={ids.id} className="input" value={issue.consent} onChange={(e) => setIssue({ ...issue, consent: e.target.value })} />}</Field>}
            </>
          )}
          <ActionButton tone="primary" disabled={busy || issue.student === ''}
            onClick={() => void write(`issue:${issue.student}:${issue.kind}:${issue.recipientKind}:${issue.recipient}:${issue.basis}:${issue.consent}`, (k) => issueDocument(issue, k),
              (r) => `Issued. The verification code is ${codeWords(r.code)}.`).then((ok) => { if (ok) refresh(); })}>
            Issue it
          </ActionButton>
        </Stack>
      )}

      {held.has('records:audit') && (
        <>
          <SectionLabel>Issued documents</SectionLabel>
          {docs.length === 0 ? <p>No documents have been issued.</p> : (
            <Rows label="Issued documents">
              {docs.map((d) => (
                <RowItem key={d.id}>
                  <div><strong>{d.kind === 'transcript' ? 'Transcript' : 'Enrollment letter'}</strong> · {d.studentRef} · {at(d.issuedAt)}{d.recipient ? ` · to ${d.recipient}` : ''}{d.revoked ? ' · revoked' : ''}</div>
                  <Sub>Code {codeWords(d.code)}</Sub>
                  <Row>
                    <ActionButton tone="ghost" onClick={() => setShown(shown === d.id ? '' : d.id)}>{shown === d.id ? 'Hide' : 'Show'}</ActionButton>
                    {held.has('records:issue') && !d.revoked && <ActionButton tone="ghost" onClick={() => setRevoke({ id: revoke.id === d.id ? '' : d.id, reason: '' })}>Revoke…</ActionButton>}
                  </Row>
                  {revoke.id === d.id && (
                    <Stack label="Revoke this document">
                      <Field label="Reason" hint="At least ten characters.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={revoke.reason} onChange={(e) => setRevoke({ ...revoke, reason: e.target.value })} />}</Field>
                      <ActionButton tone="primary" disabled={busy || revoke.reason.trim().length < 10}
                        onClick={() => void write(`revoke:${d.id}:${revoke.reason}`, (k) => revokeDocument(d.id, revoke.reason.trim(), k), () => 'Revoked. Its code opens nothing now.').then((ok) => { if (ok) { setRevoke({ id: '', reason: '' }); refresh(); } })}>
                        Revoke it
                      </ActionButton>
                    </Stack>
                  )}
                </RowItem>
              ))}
            </Rows>
          )}
          {doc && <DocumentView doc={doc} />}
        </>
      )}

      {held.has('records:issue') && (
        <Stack label="Log a release made outside Semester">
          <Row end>
            <Field label="Student’s record reference">{(ids) => <input id={ids.id} className="input" value={disc.student} onChange={(e) => setDisc({ ...disc, student: e.target.value.trim() })} />}</Field>
            <Field label="Recipient">{(ids) => <input id={ids.id} className="input" value={disc.recipient} onChange={(e) => setDisc({ ...disc, recipient: e.target.value })} />}</Field>
          </Row>
          <Row end>
            <Field label="Exception relied on">
              {(ids) => (
                <select id={ids.id} className="input" value={disc.recipientKind} onChange={(e) => setDisc({ ...disc, recipientKind: e.target.value as Exclude<RecipientKind, 'student'> })}>
                  {EXCEPTIONS.map((k) => <option key={k} value={k}>{RECIPIENT_WORDS[k]}</option>)}
                </select>
              )}
            </Field>
            <Field label="What was released">{(ids) => <input id={ids.id} className="input" value={disc.what} onChange={(e) => setDisc({ ...disc, what: e.target.value })} />}</Field>
          </Row>
          <Field label="Basis" hint="At least ten characters.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={disc.basis} onChange={(e) => setDisc({ ...disc, basis: e.target.value })} />}</Field>
          {disc.recipientKind === 'consent' && <Field label="Reference to the written consent">{(ids) => <input id={ids.id} className="input" value={disc.consent} onChange={(e) => setDisc({ ...disc, consent: e.target.value })} />}</Field>}
          <ActionButton tone="primary" disabled={busy || disc.student === '' || disc.recipient.trim() === '' || disc.what.trim().length < 3 || disc.basis.trim().length < 10}
            onClick={() => void write(`disclose:${disc.student}:${disc.recipient}:${disc.what}:${disc.basis}`, (k) => logDisclosure(disc, k), () => 'Logged. The student can read it.').then((ok) => { if (ok) refresh(); })}>
            Log the release
          </ActionButton>
        </Stack>
      )}

      {held.has('records:audit') && log.length > 0 && (
        <Rows label="Disclosure log">
          {log.slice(0, 50).map((d) => (
            <RowItem key={d.id}>
              <div><strong>{d.studentRef}</strong> · {d.what} to {d.recipient} · {at(d.releasedAt)}</div>
              <Sub>{RECIPIENT_WORDS[d.recipientKind]} · {d.basis}{d.consentRef ? ` · consent: ${d.consentRef}` : ''}</Sub>
            </RowItem>
          ))}
        </Rows>
      )}

      {held.has('records:clear') && (
        <Stack label="Graduation clearance">
          <Row end>
            <Field label="Student’s record reference">{(ids) => <input id={ids.id} className="input" value={clearStudent} onChange={(e) => setClearStudent(e.target.value.trim())} />}</Field>
            <ActionButton tone="primary" disabled={busy || clearStudent === ''}
              onClick={() => void write(`clear:${clearStudent}:${Date.now()}`, (k) => runClearance(clearStudent, k),
                (r) => (r.status === 'cleared' ? 'Cleared: nothing blocks graduation.' : `Blocked: ${r.blocks.join(' ')}`)).then((ok) => { if (ok) refresh(); })}>
              Run clearance
            </ActionButton>
          </Row>
          <Sub>Clearance reads a saved degree audit, the record and any holds. Conferral is still proposed and approved on the record by two people.</Sub>
        </Stack>
      )}
      {held.has('records:audit') && clearances.length > 0 && (
        <Rows label="Recent clearances">
          {clearances.slice(0, 20).map((c) => (
            <RowItem key={c.id}><div><strong>{c.studentRef}</strong> · {c.status} · {at(c.runAt)}</div>{c.blocks.length > 0 && <Sub>{c.blocks.join(' ')}</Sub>}</RowItem>
          ))}
        </Rows>
      )}
    </section>
  );
}
