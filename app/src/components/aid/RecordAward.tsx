import { useId, useState } from 'react';
import { Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { parseCents } from '../../lib/finance/accounts';
import { recordAward } from '../../lib/aid/client';
import { AWARD_TYPES, type AwardType } from '../../lib/aid/rules';
import { TYPE_LABEL, aidYearProblem, amountProblem, fundProblem, reasonProblem } from '../../lib/aid/views';

/**
 * Record an award for the student reference being looked at.
 *
 * The school decides the fund, the type and the amount; this records it, as
 * offered. At or above the school's high-value threshold the award is recorded
 * and then waits for a second person (the database decides, from the threshold
 * the school set for its student accounts), and a student does not see it until
 * then. Federal aid data, tax data and any identifier have no field here.
 */
export function RecordAward({ studentRef, writable, onDone }: { studentRef: string; writable: boolean; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['year', 'fund', 'amount', 'reason'] as const);
  const typeId = useId();
  const [year, setYear] = useState('');
  const [fund, setFund] = useState('');
  const [type, setType] = useState<AwardType>('grant');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);

  const what = `award:${studentRef}:${year.trim()}:${fund.trim()}:${type}:${amount.trim()}`;
  const run = async () => {
    const ok = fields.check({
      year: aidYearProblem(year) ?? '',
      fund: fundProblem(fund) ?? '',
      amount: amountProblem(amount) ?? '',
      reason: reasonProblem(reason) ?? '',
    });
    if (!ok) return;
    const cents = parseCents(amount);
    if (cents === null) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => recordAward(studentRef, year.trim(), fund.trim(), type, cents, reason.trim(), key));
      setSaid({ tone: 'ok', text: 'The award was recorded as offered.' });
      setFund('');
      setAmount('');
      setReason('');
      onDone();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The award was not recorded.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };

  const yearProps = fields.control('year');
  const fundProps = fields.control('fund');
  const amountProps = fields.control('amount');
  const reasonProps = fields.control('reason');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label={`Record an award for ${studentRef}`}>
        <div>
          <label htmlFor={yearProps.id}>Aid year</label>
          <input
            {...yearProps}
            aria-label="Aid year"
            className="input"
            autoComplete="off"
            placeholder="2026-2027"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              fields.clear('year');
            }}
          />
          <FieldMessage {...fields.message('year')} />
        </div>
        <div>
          <label htmlFor={fundProps.id}>Fund</label>
          <input
            {...fundProps}
            aria-label="Fund"
            className="input"
            autoComplete="off"
            value={fund}
            onChange={(e) => {
              setFund(e.target.value);
              fields.clear('fund');
            }}
          />
          <FieldMessage {...fields.message('fund')} />
        </div>
        <div>
          <label htmlFor={typeId}>Type</label>
          <select id={typeId} className="input" value={type} onChange={(e) => setType(e.target.value as AwardType)}>
            {AWARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={amountProps.id}>Amount in dollars</label>
          <input
            {...amountProps}
            aria-label="Amount in dollars"
            className="input"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              fields.clear('amount');
            }}
          />
          <FieldMessage {...fields.message('amount')} />
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
          <Sub>Kept with your name and the time.</Sub>
          <FieldMessage {...fields.message('reason')} />
        </div>
        <Row>
          <button type="submit" className="btn btn-primary" disabled={busy || !writable}>
            {busy ? 'Recording…' : pending(what) ? 'Try recording again' : 'Record the award'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}
