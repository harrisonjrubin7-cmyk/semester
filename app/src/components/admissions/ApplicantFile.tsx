import { useEffect, useId, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { correctStatus, linkApplicant, loadHistory, recordStatus } from '../../lib/admissions/client';
import type { AdmissionsCapability, Applicant, ApplicantLink, HistoryEntry } from '../../lib/admissions/model';
import { ADMISSION_STATUSES, capabilityFor, forwardFrom, type AdmissionStatus } from '../../lib/admissions/rules';
import { STATUS_HINT, STATUS_LABEL, enrolmentSentence, historyLine, reasonProblem, studentRefProblem } from '../../lib/admissions/views';

/**
 * One applicant's file: the status history, and the forms to record the next step.
 *
 * A step is chosen from the ones the record allows going forward; the choice is
 * the person's, and nothing here suggests one. A decision (admit, deny, waitlist)
 * is offered only to somebody holding `admissions:decide`, and a correction, the
 * one way a status moves back, only to the same. The database refuses anything
 * the screen offered wrongly. Linking an admitted applicant to a student
 * reference is the registrar's (`admissions:record`) and creates no student.
 */
export function ApplicantFile({
  applicant,
  link,
  caps,
  writable,
  me,
  onChanged,
}: {
  applicant: Applicant;
  link: ApplicantLink | null;
  caps: readonly AdmissionsCapability[];
  writable: boolean;
  me: string;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[] | null | string>(null);
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let live = true;
    loadHistory(applicant.id).then(
      (h) => {
        if (live) setHistory(h);
      },
      (e: unknown) => {
        if (live) setHistory(e instanceof Error ? e.message : 'Could not load the status history.');
      },
    );
    return () => {
      live = false;
    };
  }, [applicant.id, applicant.status, reads]);

  const changed = () => {
    setReads((n) => n + 1);
    onChanged();
  };
  const canRecord = caps.includes('admissions:record');
  const canDecide = caps.includes('admissions:decide');
  const next = forwardFrom(applicant.status).filter((s) => caps.includes(capabilityFor(s)));
  const enrol = enrolmentSentence(applicant, link);

  return (
    <section aria-label={`Applicant ${applicant.applicantRef}`}>
      <SectionLabel>
        {applicant.applicantRef} · {applicant.cycle}
      </SectionLabel>
      <p>
        {applicant.program}. <strong>{STATUS_LABEL[applicant.status]}</strong>. {STATUS_HINT[applicant.status]}
      </p>
      {enrol && <Notice>{enrol}</Notice>}

      {typeof history === 'string' && <Notice alert>{history} Nothing has changed.</Notice>}
      {history === null && <p role="status">Loading the history…</p>}
      {Array.isArray(history) && (
        <ul aria-label="Status history" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {history.map((h) => (
            <li key={h.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
              {historyLine(h, me)}
            </li>
          ))}
        </ul>
      )}

      {writable && next.length > 0 && <RecordStep applicant={applicant} options={next} onDone={changed} />}
      {writable && next.length === 0 && (
        <EmptyState inline title="No further step from here" body={`${STATUS_LABEL[applicant.status]} is as far as this record goes. If an earlier entry was wrong, a correction records that.`} />
      )}
      {writable && canDecide && <Correct applicant={applicant} history={Array.isArray(history) ? history : []} onDone={changed} />}
      {writable && canRecord && applicant.status === 'admitted' && !link && <Link applicant={applicant} onDone={changed} />}
    </section>
  );
}

function RecordStep({ applicant, options, onDone }: { applicant: Applicant; options: AdmissionStatus[]; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['reason'] as const);
  const [to, setTo] = useState<AdmissionStatus>(options[0]);
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const choice = options.includes(to) ? to : options[0];
  const selectId = useId();

  const what = `status:${applicant.id}:${choice}`;
  const run = async () => {
    if (!fields.check({ reason: reasonProblem(reason) ?? '' })) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => recordStatus(applicant.id, choice, reason.trim(), key));
      setSaid({ tone: 'ok', text: `Recorded: ${STATUS_LABEL[choice]}.` });
      setReason('');
      onDone();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The status was not recorded.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };
  const reasonProps = fields.control('reason');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label="Record the next status">
        <div>
          <label htmlFor={selectId}>Next status</label>
          <select id={selectId} className="input" value={choice} onChange={(e) => setTo(e.target.value as AdmissionStatus)}>
            {options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={reasonProps.id}>Reason</label>
          <input
            {...reasonProps}
            aria-label="Reason"
            className="input"
            autoComplete="off"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              fields.clear('reason');
            }}
          />
          <Sub>Kept with your name and the time. A decision is a person’s: say why it was made.</Sub>
          <FieldMessage {...fields.message('reason')} />
        </div>
        <Row>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Recording…' : pending(what) ? 'Try recording again' : 'Record the status'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}

function Correct({ applicant, history, onDone }: { applicant: Applicant; history: HistoryEntry[]; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['reason'] as const);
  const options = ADMISSION_STATUSES.filter((s) => s !== applicant.status);
  const [to, setTo] = useState<AdmissionStatus>(options[0]);
  const [corrects, setCorrects] = useState('');
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const toId = useId();
  const entryId = useId();
  const entry = corrects !== '' ? corrects : String(history[history.length - 1]?.seq ?? '');

  const what = `correct:${applicant.id}:${to}:${entry}`;
  const run = async () => {
    if (!fields.check({ reason: reasonProblem(reason) ?? '' })) return;
    if (!/^[0-9]+$/.test(entry)) {
      setSaid({ tone: 'refused', text: 'Say which entry of the history you are correcting.' });
      return;
    }
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => correctStatus(applicant.id, to, Number(entry), reason.trim(), key));
      setSaid({ tone: 'ok', text: `Corrected to ${STATUS_LABEL[to]}. The earlier entries stay in the history.` });
      setReason('');
      onDone();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The correction was not recorded.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };
  const reasonProps = fields.control('reason');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label="Correct an earlier entry">
        <Sub>A status never goes back except by a correction. It is a new entry; the one it corrects stays.</Sub>
        <div>
          <label htmlFor={toId}>Correct the status to</label>
          <select id={toId} className="input" value={to} onChange={(e) => setTo(e.target.value as AdmissionStatus)}>
            {options.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={entryId}>Entry being corrected</label>
          <input id={entryId} className="input" inputMode="numeric" autoComplete="off" value={entry} onChange={(e) => setCorrects(e.target.value)} />
        </div>
        <div>
          <label htmlFor={reasonProps.id}>Reason for the correction</label>
          <input
            {...reasonProps}
            aria-label="Reason for the correction"
            className="input"
            autoComplete="off"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              fields.clear('reason');
            }}
          />
          <FieldMessage {...fields.message('reason')} />
        </div>
        <Row>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Recording…' : pending(what) ? 'Try the correction again' : 'Record the correction'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}

function Link({ applicant, onDone }: { applicant: Applicant; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['ref'] as const);
  const [ref, setRef] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const what = `link:${applicant.id}:${ref.trim()}`;
  const run = async () => {
    if (!fields.check({ ref: studentRefProblem(ref) ?? '' })) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => linkApplicant(applicant.id, ref.trim(), key));
      setSaid({ tone: 'ok', text: 'Linked. The applicant can now be enrolled. No student or account was created.' });
      onDone();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The applicant was not linked.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };
  const refProps = fields.control('ref');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label="Link to a student reference">
        <Sub>Only the registrar does this. It records the link and nothing else: Semester never creates a student.</Sub>
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
          <FieldMessage {...fields.message('ref')} />
        </div>
        <Row>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Linking…' : pending(what) ? 'Try linking again' : 'Link the applicant'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}
