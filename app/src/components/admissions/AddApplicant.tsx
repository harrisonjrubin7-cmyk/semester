import { useId, useState } from 'react';
import { Row, Result, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { addApplicant } from '../../lib/admissions/client';
import { applicantRefProblem, cycleProblem, programProblem, reasonProblem } from '../../lib/admissions/views';

/**
 * Add an applicant the school has received.
 *
 * The reference is the school's own: Semester does not number applicants, and a
 * nine-digit run in it is refused because it has the shape of a social security
 * number. The reason is how the application arrived, in the school's words. The
 * request carries an attempt key (`lib/attempt.ts`), so if the connection drops
 * after the server took it, pressing the button again is the same request and
 * answers the same applicant, never a second one.
 */
export function AddApplicant({ cycles, writable, onAdded }: { cycles: readonly string[]; writable: boolean; onAdded: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['cycle', 'ref', 'program', 'reason'] as const);
  const refHint = useId();
  const [cycle, setCycle] = useState(cycles[0] ?? '');
  const [ref, setRef] = useState('');
  const [program, setProgram] = useState('');
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);

  const what = `applicant:${cycle.trim()}:${ref.trim()}:${program.trim()}`;
  const run = async () => {
    const ok = fields.check({
      cycle: cycleProblem(cycle) ?? '',
      ref: applicantRefProblem(ref) ?? '',
      program: programProblem(program) ?? '',
      reason: reasonProblem(reason) ?? '',
    });
    if (!ok) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => addApplicant(cycle.trim(), ref.trim(), program.trim(), reason.trim(), key));
      setSaid({ tone: 'ok', text: 'The applicant was added as submitted.' });
      setRef('');
      setProgram('');
      setReason('');
      onAdded();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The applicant was not added.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };

  const cycleProps = fields.control('cycle');
  const refProps = fields.control('ref', refHint);
  const programProps = fields.control('program');
  const reasonProps = fields.control('reason');

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label="Add an applicant">
        <div>
          <label htmlFor={cycleProps.id}>Cycle</label>
          <input
            {...cycleProps}
            aria-label="Cycle"
            className="input"
            list={`${cycleProps.id}-cycles`}
            autoComplete="off"
            value={cycle}
            onChange={(e) => {
              setCycle(e.target.value);
              fields.clear('cycle');
            }}
          />
          <datalist id={`${cycleProps.id}-cycles`}>
            {cycles.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Sub>Your school’s own name for the cycle, such as Fall 2027.</Sub>
          <FieldMessage {...fields.message('cycle')} />
        </div>
        <div>
          <label htmlFor={refProps.id}>Applicant reference</label>
          <input
            {...refProps}
            aria-label="Applicant reference"
            className="input"
            autoComplete="off"
            value={ref}
            onChange={(e) => {
              setRef(e.target.value);
              fields.clear('ref');
            }}
          />
          <Sub>
            <span id={refHint}>The reference your school gives the application. Never a social security number.</span>
          </Sub>
          <FieldMessage {...fields.message('ref')} />
        </div>
        <div>
          <label htmlFor={programProps.id}>Program applied to</label>
          <input
            {...programProps}
            aria-label="Program applied to"
            className="input"
            autoComplete="off"
            value={program}
            onChange={(e) => {
              setProgram(e.target.value);
              fields.clear('program');
            }}
          />
          <FieldMessage {...fields.message('program')} />
        </div>
        <div>
          <label htmlFor={reasonProps.id}>How it arrived</label>
          <input
            {...reasonProps}
            aria-label="How it arrived"
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
          <button type="submit" className="btn btn-primary" disabled={busy || !writable}>
            {busy ? 'Adding…' : pending(what) ? 'Try adding again' : 'Add the applicant'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}
