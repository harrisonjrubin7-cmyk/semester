import { useEffect, useId, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { formatDateTime } from '../../lib/locale';
import { loadAudits, runAudit } from '../../lib/degreeaudit/client';
import type { AuditRecord, Program } from '../../lib/degreeaudit/model';
import { VERDICT_LABEL, asOfProblem, studentRefProblem, todayIso } from '../../lib/degreeaudit/views';
import { AuditView } from './AuditView';

/**
 * Run a degree audit and read the ones that were kept.
 *
 * A student runs it for the record the school linked to their account, and
 * that reference is fixed here: the field a staff member types it into is not
 * drawn for them, and the database refuses any other reference anyway. A
 * registrar, dean or advisor types the student's reference as the school
 * writes it and chooses the program.
 *
 * Running an audit writes nothing to the academic record: it reads the ledger
 * as of the date and keeps one row saying what it read and what it found. The
 * request carries an attempt key (`lib/attempt.ts`), so if the connection
 * drops after the server took it, pressing the button again is the same
 * request and answers the same audit, never a second one.
 *
 * Only published programs are offered. A school that has published none is
 * told so; the screen never shows requirements the school did not publish.
 */

const stamp = (iso: string): string => formatDateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
const day = (iso: string): string => formatDateTime(new Date(`${iso}T12:00:00`), { dateStyle: 'medium' });

export function RunAudit({
  studentRef,
  programs,
  writable,
  me,
}: {
  /** The record the school linked to this account; null for staff, who type one. */
  studentRef: string | null;
  programs: Program[];
  /** False while the module is frozen or paused: kept audits can be read and no new one run. */
  writable: boolean;
  me: string;
}) {
  const published = programs.filter((p) => p.state === 'published');
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['ref', 'asOf'] as const);
  const refHint = useId();
  const [ref, setRef] = useState(studentRef ?? '');
  const [programId, setProgramId] = useState(published[0]?.id ?? '');
  const [asOf, setAsOf] = useState(() => todayIso(new Date()));
  const [kept, setKept] = useState<AuditRecord[] | null | string>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);

  // Used from event handlers only: after a run, and when staff ask for a student's audits.
  const read = async (forRef: string, show?: string) => {
    try {
      const list = await loadAudits(forRef);
      setKept(list);
      setShown((was) => show ?? was ?? list[0]?.id ?? null);
    } catch (e) {
      setKept(e instanceof Error ? e.message : 'Could not load the audits.');
    }
  };

  // A student's own audits load with the screen; staff's load when they ask.
  useEffect(() => {
    if (!studentRef) return;
    let live = true;
    loadAudits(studentRef).then(
      (list) => {
        if (!live) return;
        setKept(list);
        setShown((was) => was ?? list[0]?.id ?? null);
      },
      (e: unknown) => {
        if (live) setKept(e instanceof Error ? e.message : 'Could not load the audits.');
      },
    );
    return () => {
      live = false;
    };
  }, [studentRef]);

  const run = async () => {
    const forRef = (studentRef ?? ref).trim();
    const ok = fields.check({
      ref: studentRef ? undefined : (studentRefProblem(forRef) ?? ''),
      asOf: asOfProblem(asOf, todayIso(new Date())) ?? '',
    });
    if (!ok) return;
    if (!programId) {
      setSaid({ tone: 'refused', text: 'Choose a program to audit against.' });
      return;
    }
    setBusy(true);
    setSaid(null);
    const what = `audit:${programId}:${forRef}:${asOf}`;
    try {
      const id = await attempt(what, (key) => runAudit(programId, forRef, asOf, key));
      setSaid({ tone: 'ok', text: 'The audit was run and kept. Nothing was written to the academic record.' });
      await read(forRef, id);
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The audit was not run.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };

  const show = async () => {
    const forRef = ref.trim();
    if (!fields.check({ ref: studentRefProblem(forRef) ?? '' })) return;
    setKept(null);
    setShown(null);
    await read(forRef);
  };

  if (published.length === 0) {
    return (
      <EmptyState
        inline
        title="Your school has published no degree program yet"
        body="The audit runs against requirements your school publishes for a program and catalog year, and none has been published here. Semester does not invent requirements: until your school publishes some, there is nothing to audit against. The calculator under The degree, for requirements you type in yourself, still works."
      />
    );
  }

  const chosen = typeof kept === 'object' && kept ? kept.find((a) => a.id === shown) ?? null : null;
  const refProps = fields.control('ref', refHint);
  const asOfProps = fields.control('asOf');

  return (
    <>
      {/* noValidate: the date's `max` still limits the picker, but a later date is refused in the form's own words, by the field-error component, not by a browser bubble. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Stack label="Run a degree audit">
          {studentRef === null && (
            <div>
              <label htmlFor={refProps.id}>Student reference</label>
              <input
                {...refProps}
                aria-label="Student reference"
                className="input"
                autoComplete="off"
                value={ref}
                onChange={(e) => {
                  setRef(e.target.value);
                  fields.clear('ref');
                }}
              />
              <Sub>
                <span id={refHint}>The identifier your school’s academic record uses for the student, such as S100.</span>
              </Sub>
              <FieldMessage {...fields.message('ref')} />
            </div>
          )}
          <div>
            <label htmlFor="degree-audit-program">Program</label>
            <select id="degree-audit-program" className="input" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · catalog {p.catalogYear} · version {p.version}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={asOfProps.id}>As of</label>
            <input
              {...asOfProps}
              aria-label="As of"
              className="input"
              type="date"
              max={todayIso(new Date())}
              value={asOf}
              onChange={(e) => {
                setAsOf(e.target.value);
                fields.clear('asOf');
              }}
            />
            <FieldMessage {...fields.message('asOf')} />
          </div>
          <Row>
            <button type="submit" className="btn btn-primary" disabled={busy || !writable}>
              {busy ? 'Running…' : pending(`audit:${programId}:${(studentRef ?? ref).trim()}:${asOf}`) ? 'Try the audit again' : 'Run the audit'}
            </button>
            {studentRef === null && (
              <button type="button" className="btn" onClick={() => void show()} disabled={busy}>
                Show the audits kept for this student
              </button>
            )}
          </Row>
        </Stack>
      </form>
      <Result said={said} />

      {kept === null && studentRef !== null && <p role="status">Loading your audits…</p>}
      {typeof kept === 'string' && <Notice alert>{kept} Nothing has changed.</Notice>}
      {Array.isArray(kept) && kept.length === 0 && (
        <EmptyState
          inline
          title="No audit has been kept yet"
          body={studentRef !== null ? 'Run the audit above and it is kept here, with the date it was as of.' : 'No audit has been kept for that reference, or you cannot read the ones that have.'}
        />
      )}
      {Array.isArray(kept) && kept.length > 0 && (
        <>
          <SectionLabel>Audits kept</SectionLabel>
          <ul aria-label="Audits kept" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {kept.map((a) => (
              <li key={a.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
                <button type="button" className="btn" aria-pressed={a.id === shown} onClick={() => setShown(a.id)}>
                  {a.id === shown ? 'Showing' : 'Show'} the audit as of {day(a.asOf)}
                </button>
                <Sub>
                  {a.programTitle}, version {a.programVersion}. {VERDICT_LABEL[a.verdict]}. Run {stamp(a.requestedAt)}
                  {a.requestedBy === me ? ' by you' : ''}.
                </Sub>
              </li>
            ))}
          </ul>
        </>
      )}
      {chosen && <AuditView key={chosen.id} audit={chosen} />}
    </>
  );
}
