import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../../state/store';
import { ServiceError, useAttempts } from '../../lib/attempt';
import { loadMyCapabilities, type Grant } from '../../lib/capabilities';
import { moduleModes, resolveModuleMode, SOURCE_TEXT, type ModuleModeRow } from '../../lib/modulemode';
import { formatDateTime } from '../../lib/locale';
import {
  decideException, declareStudent, degreeCapabilities, loadExceptions, loadVersions, myStudentRef, needWords, parseGroups, proposeException,
  publishVersion, runAudit, saveVersion, type Audit, type DegreeCapability, type Exception, type Version,
} from '../../lib/degreeaudit/client';
import { ActionButton, EmptyState, Notice, SectionLabel } from '../ui';
import { Field, Result, Row, RowItem, Rows, Stack, Sub, type Said } from '../academic/Form';

const at = (iso: string): string => { try { return formatDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

/**
 * The official degree audit, in a school that runs it in Core. In Connect it
 * says the school’s own audit is the record and stops. What is met and what is
 * not is the database’s answer (`20261001040000_degree_audit.sql`); this asks
 * and shows it, with the courses behind every line. Your Path Snapshot in the
 * other tabs is your own estimate and is not touched by anything here.
 */
export function DegreeAuditHome() {
  const { school, account } = useStore();
  const me = account?.id ?? '';
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null | undefined>(undefined);
  const [grants, setGrants] = useState<Grant[] | null | 'error'>(null);

  useEffect(() => {
    let live = true;
    void moduleModes(school.id).then((r) => { if (live) setRows(r); });
    loadMyCapabilities().then((g) => { if (live) setGrants(g); }, () => { if (live) setGrants('error'); });
    return () => { live = false; };
  }, [school.id]);

  if (!me || !school.id) return <Notice>Sign in with your school account to see the official audit. It is your school’s record, so Semester needs to know who you are first.</Notice>;
  if (rows === undefined || grants === null) return <p role="status">Checking whether your school runs the degree audit in Semester…</p>;
  const mode = resolveModuleMode('degree_audit', rows);
  if (mode.mode !== 'core') {
    return <Notice>Your school’s own degree audit is the official one. Semester shows an official audit here only when your school switches the degree audit to Core. The estimate in the other tabs is yours. {SOURCE_TEXT[mode.source]}.</Notice>;
  }
  if (grants === 'error') return <Notice alert>Could not read your roles at this school. Nothing has changed. Try again in a moment.</Notice>;
  const held = degreeCapabilities(grants, school.id);
  return (
    <>
      <MyAudit school={school.id} me={me} />
      {held.size > 0 && <Staff school={school.id} me={me} held={held} />}
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

function AuditView({ audit }: { audit: Audit }): ReactNode {
  return (
    <section aria-label={`Audit for ${audit.programName}`}>
      <SectionLabel>{audit.programName} · catalog {audit.catalogYear}{audit.whatIf ? ' · what-if, not saved' : ''}</SectionLabel>
      <p><strong>{audit.status === 'complete' ? 'Every requirement is met.' : 'In progress.'}</strong>{' '}
        {audit.credits.have} of {audit.credits.need} credits{audit.credits.met ? '' : ' so far'}
        {audit.gpa.have === null ? ' · no graded courses yet' : ` · GPA ${audit.gpa.have.toFixed(2)} (needs ${audit.gpa.need.toFixed(2)})`}. As of {audit.asOf}.</p>
      {audit.warnings.map((w) => <Notice key={w}>{w}</Notice>)}
      <Rows label="Requirement groups">
        {audit.groups.map((g) => (
          <RowItem key={g.position}>
            <div><strong>{g.name}</strong> · {g.met ? (g.waived ? 'waived' : 'met') : 'not met'} · {needWords(g)}{g.kind === 'credits' ? ` (${g.have} so far)` : ` (${g.have} so far)`}</div>
            <Sub>{g.courses.length > 0 ? g.courses.join(', ') : 'No courses counted here yet.'}{g.substituted.length > 0 ? ` · substituted: ${g.substituted.join(', ')}` : ''}</Sub>
          </RowItem>
        ))}
      </Rows>
      {audit.unused.length > 0 && <Sub>Counted nowhere: {audit.unused.join(', ')}. A course counts once, in the first group it fits.</Sub>}
    </section>
  );
}

function MyAudit({ school, me }: { school: string; me: string }): ReactNode {
  const [ref, setRef] = useState<string | null | undefined>(undefined);
  const [audit, setAudit] = useState<Audit | string | null>(null);
  const { attempt } = useAttempts();

  useEffect(() => {
    let live = true;
    myStudentRef(school).then(async (r) => {
      if (!live) return;
      setRef(r);
      if (r === null) return;
      try { const a = await attempt(`audit:${me}:${r}`, (k) => runAudit(r, null, false, k)); if (live) setAudit(a); }
      catch (e) { if (live) setAudit(e instanceof Error ? e.message : 'The audit could not be run.'); }
    }, () => { if (live) setRef(null); });
    return () => { live = false; };
  }, [school, me, attempt]);

  if (ref === undefined) return <p role="status">Reading your record link…</p>;
  if (ref === null) return null;
  if (audit === null) return <p role="status">Running your official audit…</p>;
  if (typeof audit === 'string') return <Notice>{audit}</Notice>;
  return <AuditView audit={audit} />;
}

function Staff({ school, me, held }: { school: string; me: string; held: ReadonlySet<DegreeCapability> }): ReactNode {
  const [versions, setVersions] = useState<Version[] | string | null>(null);
  const [reads, setReads] = useState(0);
  const { said, busy, write } = useWrite();
  const [student, setStudent] = useState('');
  const [audit, setAudit] = useState<Audit | null>(null);
  const [whatIf, setWhatIf] = useState('');
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [prop, setProp] = useState({ position: '1', kind: 'waive' as 'waive' | 'substitute', course: '', credits: '3', reason: '' });
  const [draft, setDraft] = useState({ program: '', name: '', year: String(new Date().getFullYear()), total: '120', minGpa: '2.0', groups: '' });
  const [draftError, setDraftError] = useState('');

  useEffect(() => {
    let live = true;
    loadVersions(school).then((v) => { if (live) setVersions(v); }, (e: unknown) => { if (live) setVersions(e instanceof Error ? e.message : 'The catalog years could not be read.'); });
    return () => { live = false; };
  }, [school, reads]);

  const refresh = () => setReads((n) => n + 1);
  const published = Array.isArray(versions) ? versions.filter((v) => v.status === 'published') : [];
  const label = (v: Version) => `${v.programName} · ${v.catalogYear}`;

  async function look(version: string | null) {
    const ref = student.trim();
    if (ref === '') return;
    const ok = await write(`audit:${ref}:${version ?? 'declared'}:${Date.now()}`, (k) => runAudit(ref, version, false, k), (a) => { setAudit(a); return `Audit run for ${ref}${a.whatIf ? ' as a what-if; nothing was saved' : ''}.`; });
    if (ok && held.has('degree:read')) loadExceptions(school, ref, me).then(setExceptions, () => setExceptions([]));
  }

  return (
    <section aria-label="Degree audit, for staff">
      <SectionLabel>Degree audit · staff</SectionLabel>
      <Result said={said} />

      {held.has('degree:read') && (
        <Stack label="Look at a student">
          <Field label="Student’s record reference" hint="The reference your school’s record uses, as in the ledger.">
            {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={student} onChange={(e) => setStudent(e.target.value.trim())} />}
          </Field>
          <Row end>
            <ActionButton tone="primary" disabled={busy || student === ''} onClick={() => void look(null)}>Run the audit</ActionButton>
            {held.has('degree:declare') && audit && !audit.whatIf && (
              <ActionButton disabled={busy} onClick={() => void write(`save:${student}:${audit.version}:${audit.asOf}`, (k) => runAudit(student, audit.version, true, k), () => `Saved as the official run for ${student}.`)}>Save this run</ActionButton>
            )}
          </Row>
          {published.length > 0 && (
            <Row end>
              <Field label="What if they were held to">
                {(ids) => (
                  <select id={ids.id} className="input" value={whatIf} onChange={(e) => setWhatIf(e.target.value)}>
                    <option value="">Choose a catalog year</option>
                    {published.map((v) => <option key={v.id} value={v.id}>{label(v)}</option>)}
                  </select>
                )}
              </Field>
              <ActionButton disabled={busy || student === '' || whatIf === ''} onClick={() => void look(whatIf)}>Run as a what-if</ActionButton>
              {held.has('degree:declare') && (
                <ActionButton disabled={busy || student === '' || whatIf === ''} onClick={() => void write(`declare:${student}:${whatIf}`, (k) => declareStudent(student, whatIf, k), () => `${student} is now held to that catalog year.`)}>Hold them to it</ActionButton>
              )}
            </Row>
          )}
        </Stack>
      )}

      {audit && <AuditView audit={audit} />}

      {audit && !audit.whatIf && held.has('degree:propose') && (
        <Stack label="Propose a waiver or a substitution">
          <Row end>
            <Field label="Group">
              {(ids) => (
                <select id={ids.id} className="input" value={prop.position} onChange={(e) => setProp({ ...prop, position: e.target.value })}>
                  {audit.groups.map((g) => <option key={g.position} value={g.position}>{g.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Kind">
              {(ids) => (
                <select id={ids.id} className="input" value={prop.kind} onChange={(e) => setProp({ ...prop, kind: e.target.value as 'waive' | 'substitute' })}>
                  <option value="waive">Waive the group</option>
                  <option value="substitute">Count another course</option>
                </select>
              )}
            </Field>
          </Row>
          {prop.kind === 'substitute' && (
            <Row end>
              <Field label="Course">{(ids) => <input id={ids.id} className="input" value={prop.course} placeholder="MATH 2010" onChange={(e) => setProp({ ...prop, course: e.target.value.toUpperCase() })} />}</Field>
              <Field label="Credits">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={prop.credits} onChange={(e) => setProp({ ...prop, credits: e.target.value })} />}</Field>
            </Row>
          )}
          <Field label="Reason" hint="At least ten characters. Shown with the exception wherever it is read.">
            {(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={prop.reason} onChange={(e) => setProp({ ...prop, reason: e.target.value })} />}
          </Field>
          <ActionButton tone="primary" disabled={busy || prop.reason.trim().length < 10 || (prop.kind === 'substitute' && prop.course.trim() === '')}
            onClick={() => void write(`propose:${student}:${audit.version}:${prop.position}:${prop.kind}:${prop.course}:${prop.reason}`,
              (k) => proposeException({ student, version: audit.version, position: Number(prop.position), kind: prop.kind, course: prop.course.trim(), credits: Number(prop.credits) || null, reason: prop.reason.trim() }, k),
              () => 'Proposed. Someone else holding approval decides it; nothing changes until they do.').then((ok) => { if (ok) loadExceptions(school, student, me).then(setExceptions, () => undefined); })}>
            Propose it
          </ActionButton>
        </Stack>
      )}

      {exceptions.length > 0 && (
        <Rows label="Exceptions on this student">
          {exceptions.map((x) => (
            <RowItem key={x.id}>
              <div><strong>{x.kind === 'waive' ? 'Waiver' : `Substitute ${x.courseCode} (${x.credits} credits)`}</strong> · {x.status}</div>
              <Sub>{x.reason} · proposed {at(x.proposedAt)}{x.note ? ` · ${x.note}` : ''}</Sub>
              {x.status === 'proposed' && held.has('degree:approve') && (
                x.mine
                  ? <Sub>You proposed this, so someone else decides it.</Sub>
                  : (
                    <Row>
                      <ActionButton disabled={busy} onClick={() => void write(`decide:${x.id}:yes`, (k) => decideException(x.id, true, '', k), () => 'Approved.').then((ok) => { if (ok) { loadExceptions(school, student, me).then(setExceptions, () => undefined); void look(null); } })}>Approve</ActionButton>
                      <ActionButton tone="ghost" disabled={busy} onClick={() => void write(`decide:${x.id}:no`, (k) => decideException(x.id, false, '', k), () => 'Rejected.').then((ok) => { if (ok) loadExceptions(school, student, me).then(setExceptions, () => undefined); })}>Reject</ActionButton>
                    </Row>
                  )
              )}
            </RowItem>
          ))}
        </Rows>
      )}

      {held.has('degree:author') && (
        <Stack label="Catalog years">
          {typeof versions === 'string' && <p role="alert">{versions}</p>}
          {Array.isArray(versions) && versions.length === 0 && <EmptyState inline title="No catalog years yet" body="Write a program’s requirements below, then publish them." />}
          {Array.isArray(versions) && versions.length > 0 && (
            <Rows label="Catalog years">
              {versions.map((v) => (
                <RowItem key={v.id}>
                  <div><strong>{label(v)}</strong> · {v.status} · {v.totalCredits} credits · GPA {v.minGpa.toFixed(2)}</div>
                  {v.status === 'draft' && <Row><ActionButton disabled={busy} onClick={() => void write(`publish:${v.id}`, (k) => publishVersion(v.id, k), () => 'Published. It is never edited after this; a correction is a new version.').then((ok) => { if (ok) refresh(); })}>Publish</ActionButton></Row>}
                </RowItem>
              ))}
            </Rows>
          )}
          <Field label="Program code" hint="Letters, digits and hyphens, for example ECON.">{(ids) => <input id={ids.id} aria-describedby={ids.hint} className="input" value={draft.program} onChange={(e) => setDraft({ ...draft, program: e.target.value.toUpperCase() })} />}</Field>
          <Field label="Program name">{(ids) => <input id={ids.id} className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
          <Row end>
            <Field label="Catalog year">{(ids) => <input id={ids.id} className="input" inputMode="numeric" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />}</Field>
            <Field label="Total credits">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={draft.total} onChange={(e) => setDraft({ ...draft, total: e.target.value })} />}</Field>
            <Field label="Minimum GPA">{(ids) => <input id={ids.id} className="input" inputMode="decimal" value={draft.minGpa} onChange={(e) => setDraft({ ...draft, minGpa: e.target.value })} />}</Field>
          </Row>
          <Field label="Requirement groups" hint="One per line: Name | all, 2 of or 6 credits | rules. A rule is a course (ECON 1010), a subject (HIST) or a subject with a range (ECON 2000-4999).">
            {(ids) => <textarea id={ids.id} aria-describedby={ids.hint} className="input" rows={5} value={draft.groups} onChange={(e) => setDraft({ ...draft, groups: e.target.value })} />}
          </Field>
          {draftError !== '' && <p role="alert">{draftError}</p>}
          <ActionButton tone="primary" disabled={busy || draft.program === '' || draft.name.trim() === ''}
            onClick={() => {
              const parsed = parseGroups(draft.groups);
              if ('error' in parsed) { setDraftError(parsed.error); return; }
              setDraftError('');
              void write(`save:${draft.program}:${draft.year}:${draft.groups}`,
                (k) => saveVersion({ program: draft.program, name: draft.name.trim(), kind: 'major', year: Number(draft.year), total: Number(draft.total), minGpa: Number(draft.minGpa), groups: parsed.groups }, k),
                () => 'Saved as a draft. Publish it when it is right; it is never edited after.').then((ok) => { if (ok) refresh(); });
            }}>
            Save as a draft
          </ActionButton>
        </Stack>
      )}
    </section>
  );
}
