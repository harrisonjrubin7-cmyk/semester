import { useState } from 'react';
import { Notice } from '../ui';
import { Row, Stack, Sub } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { verifyTranscript } from '../../lib/transcripts/client';
import { LIMITS, type Verification } from '../../lib/transcripts/model';
import { VERIFY_LABEL, checkProblems, verificationSentence } from '../../lib/transcripts/views';

/**
 * Check a serial and a hash somebody gave you.
 *
 * The answer is one of three words, the school that issued it and the day it was
 * issued. It never returns the transcript or the student, and it needs an
 * account: there is nothing in Semester that rate-limits a signed-out check, so
 * this is not one. Each check counts against the account that makes it.
 */
export function CheckForm() {
  const fields = useFieldErrors(['serial', 'hash'] as const);
  const [serial, setSerial] = useState('');
  const [hash, setHash] = useState('');
  const [answer, setAnswer] = useState<Verification | string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const p = checkProblems(serial, hash);
    if (!fields.check({ serial: p.serial ?? '', hash: p.hash ?? '' })) return;
    setBusy(true);
    setAnswer(null);
    try {
      setAnswer(await verifyTranscript(Number.parseInt(serial.trim(), 10), hash.trim().toLowerCase()));
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : 'The transcript was not checked.');
    } finally {
      setBusy(false);
    }
  };

  const serialProps = fields.control('serial');
  const hashProps = fields.control('hash');
  return (
    <>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <Stack label="Check a transcript">
          <div>
            <label htmlFor={serialProps.id}>Serial</label>
            <input
              {...serialProps}
              aria-label="Serial"
              className="input"
              inputMode="numeric"
              autoComplete="off"
              value={serial}
              onChange={(e) => {
                setSerial(e.target.value);
                fields.clear('serial');
              }}
            />
            <FieldMessage {...fields.message('serial')} />
          </div>
          <div>
            <label htmlFor={hashProps.id}>SHA-256</label>
            <input
              {...hashProps}
              aria-label="SHA-256"
              className="input"
              autoComplete="off"
              spellCheck={false}
              value={hash}
              onChange={(e) => {
                setHash(e.target.value);
                fields.clear('hash');
              }}
            />
            <FieldMessage {...fields.message('hash')} />
          </div>
          <Row>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking…' : 'Check it'}
            </button>
          </Row>
          <Sub>
            This answers matches, matches but replaced since, or no match, with the school and the day it was issued. It never shows the transcript or the
            student, and it needs you to be signed in: each account may check {LIMITS.checksPerHour} an hour. A match shows the text has not changed since it
            was issued. It does not show who issued it.
          </Sub>
        </Stack>
      </form>
      {typeof answer === 'string' && <Notice alert>{answer}</Notice>}
      {answer !== null && typeof answer === 'object' && (
        <Notice>
          <strong>{VERIFY_LABEL[answer.status]}.</strong> {verificationSentence(answer)}
        </Notice>
      )}
    </>
  );
}
