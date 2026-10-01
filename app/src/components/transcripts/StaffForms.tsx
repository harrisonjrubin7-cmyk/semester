import { useId, useState } from 'react';
import { Notice } from '../ui';
import { Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { discloseTranscript, issueTranscript } from '../../lib/transcripts/client';
import { LIMITS, type Transcript } from '../../lib/transcripts/model';
import { asOfProblem, releaseProblems, replacesProblem, studentRefProblem, todayIso } from '../../lib/transcripts/views';

/**
 * Issue a transcript: a student reference and the date it is as of. Issuing
 * reads the academic record as of that date and keeps one row; it writes nothing
 * to the record. To correct an earlier one, give its serial and why: the new
 * transcript is a new issue, and the earlier one is marked replaced and is not
 * edited.
 *
 * The request carries an attempt key (`lib/attempt.ts`), so if the connection
 * drops after the server took it, pressing the button again is the same request
 * and answers the same transcript, never a second one with the next serial.
 */
export function IssueForm({ writable, onIssued }: { writable: boolean; onIssued: (studentRef: string) => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['ref', 'asOf', 'replaces'] as const);
  const refHint = useId();
  const [ref, setRef] = useState('');
  const [asOf, setAsOf] = useState(() => todayIso(new Date()));
  const [replaces, setReplaces] = useState('');
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);

  const issue = async () => {
    const forRef = ref.trim();
    const ok = fields.check({
      ref: studentRefProblem(forRef) ?? '',
      asOf: asOfProblem(asOf, todayIso(new Date())) ?? '',
      replaces: replacesProblem(replaces, reason) ?? '',
    });
    if (!ok) return;
    setBusy(true);
    setSaid(null);
    const replacing = replaces.trim() === '' ? null : Number.parseInt(replaces.trim(), 10);
    const what = `issue:${forRef}:${asOf}:${replacing ?? 'new'}`;
    try {
      await attempt(what, (key) => issueTranscript(forRef, asOf, replacing, replacing === null ? null : reason.trim(), key));
      setSaid({ tone: 'ok', text: 'The transcript was issued and kept. Nothing was written to the academic record.' });
      onIssued(forRef);
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The transcript was not issued.',
        retry: answered ? undefined : () => void issue(),
      });
    } finally {
      setBusy(false);
    }
  };

  const refProps = fields.control('ref', refHint);
  const asOfProps = fields.control('asOf');
  const replacesProps = fields.control('replaces');
  const retrying = pending(`issue:${ref.trim()}:${asOf}:${replaces.trim() === '' ? 'new' : Number.parseInt(replaces.trim(), 10)}`);

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void issue();
        }}
      >
        <Stack label="Issue a transcript">
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
          <div>
            <label htmlFor={replacesProps.id}>Replaces serial (only to correct an earlier transcript)</label>
            <input
              {...replacesProps}
              aria-label="Replaces serial"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              value={replaces}
              onChange={(e) => {
                setReplaces(e.target.value);
                fields.clear('replaces');
              }}
            />
            <FieldMessage {...fields.message('replaces')} />
          </div>
          <div>
            <label htmlFor="transcript-reason">Why it is replaced</label>
            <input
              id="transcript-reason"
              className="input"
              autoComplete="off"
              maxLength={LIMITS.reason}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                fields.clear('replaces');
              }}
            />
          </div>
          <Row>
            <button type="submit" className="btn btn-primary" disabled={busy || !writable}>
              {busy ? 'Issuing…' : retrying ? 'Try issuing again' : 'Issue the transcript'}
            </button>
          </Row>
        </Stack>
      </form>
      <Result said={said} />
    </>
  );
}

/**
 * Log that a transcript was released, to the student or to somebody else.
 * Semester sends nothing: this is the record that a release happened, written by
 * the person who released it, and nobody can edit or delete a row afterwards.
 */
export function ReleaseForm({ transcripts, writable, onLogged }: { transcripts: Transcript[]; writable: boolean; onLogged: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['name', 'kind', 'purpose'] as const);
  const [serial, setSerial] = useState(transcripts[0] ? String(transcripts[0].serial) : '');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [purpose, setPurpose] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = transcripts.some((t) => String(t.serial) === serial) ? serial : String(transcripts[0]?.serial ?? '');

  const log = async () => {
    const p = releaseProblems(name, kind, purpose);
    if (!fields.check({ name: p.name ?? '', kind: p.kind ?? '', purpose: p.purpose ?? '' })) return;
    setBusy(true);
    setSaid(null);
    const what = `release:${chosen}:${name.trim()}:${kind.trim()}:${purpose.trim()}`;
    try {
      await attempt(what, (key) => discloseTranscript(Number.parseInt(chosen, 10), name.trim(), kind.trim(), purpose.trim(), key));
      setSaid({ tone: 'ok', text: 'The release was logged. Semester sent nothing; this is the record that it happened.' });
      setName('');
      setKind('');
      setPurpose('');
      onLogged();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The release was not logged.',
        retry: answered ? undefined : () => void log(),
      });
    } finally {
      setBusy(false);
    }
  };

  if (transcripts.length === 0) return null;
  const nameProps = fields.control('name');
  const kindProps = fields.control('kind');
  const purposeProps = fields.control('purpose');
  const retrying = pending(`release:${chosen}:${name.trim()}:${kind.trim()}:${purpose.trim()}`);

  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void log();
        }}
      >
        <Stack label="Log a release">
          <div>
            <label htmlFor="release-serial">Transcript</label>
            <select id="release-serial" className="input" value={chosen} onChange={(e) => setSerial(e.target.value)}>
              {transcripts.map((t) => (
                <option key={t.id} value={t.serial}>
                  Serial {t.serial}, as of {t.asOf}
                  {t.replacedBy !== null ? ' (replaced)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={nameProps.id}>Released to</label>
            <input
              {...nameProps}
              aria-label="Released to"
              className="input"
              autoComplete="off"
              maxLength={LIMITS.recipientName}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                fields.clear('name');
              }}
            />
            <FieldMessage {...fields.message('name')} />
          </div>
          <div>
            <label htmlFor={kindProps.id}>What kind of recipient</label>
            <input
              {...kindProps}
              aria-label="What kind of recipient"
              className="input"
              autoComplete="off"
              maxLength={LIMITS.recipientKind}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                fields.clear('kind');
              }}
            />
            <Sub>In your own words, such as the student, another school or an employer. Semester does not choose the categories.</Sub>
            <FieldMessage {...fields.message('kind')} />
          </div>
          <div>
            <label htmlFor={purposeProps.id}>Why it was released</label>
            <input
              {...purposeProps}
              aria-label="Why it was released"
              className="input"
              autoComplete="off"
              maxLength={LIMITS.purpose}
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                fields.clear('purpose');
              }}
            />
            <FieldMessage {...fields.message('purpose')} />
          </div>
          <Row>
            <button type="submit" className="btn btn-primary" disabled={busy || !writable}>
              {busy ? 'Logging…' : retrying ? 'Try logging again' : 'Log the release'}
            </button>
          </Row>
        </Stack>
      </form>
      <Notice>Nothing is sent from here. A logged release cannot be edited or removed by anybody.</Notice>
      <Result said={said} />
    </>
  );
}
