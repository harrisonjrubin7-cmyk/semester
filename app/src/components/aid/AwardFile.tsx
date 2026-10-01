import { useEffect, useId, useState } from 'react';
import { EmptyState, Notice, SectionLabel } from '../ui';
import { Result, Row, Stack, Sub, type Said } from '../academic/Form';
import { FieldMessage, useFieldErrors } from '../FieldMessage';
import { settled, useAttempts } from '../../lib/attempt';
import { money, parseCents } from '../../lib/finance/accounts';
import { approveAward, loadDisbursements, loadHistory, recordAwardStatus, recordDisbursement } from '../../lib/aid/client';
import type { AidCapability, Award, AwardHistoryEntry, Disbursement } from '../../lib/aid/model';
import { recordableFrom, type AidStatus } from '../../lib/aid/rules';
import {
  STATUS_LABEL,
  TYPE_LABEL,
  amountProblem,
  dayOf,
  disbursedOf,
  historyLine,
  noteProblem,
  reasonProblem,
  waitingSentence,
} from '../../lib/aid/views';

/**
 * One award as staff see it: where it stands, its history, what has been
 * disbursed, and the forms for the next step.
 *
 * A disbursement may name the student-accounts aid credit it reconciles with, by
 * the entry's id. The database reads that entry and checks it is this student's
 * aid credit at this school, for this amount, not reversed and not used twice;
 * nothing here writes to the ledger. A high award waits for a second person, and
 * the approve button is offered only to somebody who holds `aid:approve_high`:
 * the database also refuses the person who recorded the award.
 */
export function AwardFile({
  award,
  caps,
  writable,
  me,
  onChanged,
}: {
  award: Award;
  caps: readonly AidCapability[];
  writable: boolean;
  me: string;
  onChanged: () => void;
}) {
  const [history, setHistory] = useState<AwardHistoryEntry[] | null | string>(null);
  const [paid, setPaid] = useState<Disbursement[] | null | string>(null);
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let live = true;
    loadHistory(award.id).then(
      (h) => {
        if (live) setHistory(h);
      },
      (e: unknown) => {
        if (live) setHistory(e instanceof Error ? e.message : 'Could not load the history.');
      },
    );
    loadDisbursements(award.id).then(
      (d) => {
        if (live) setPaid(d);
      },
      (e: unknown) => {
        if (live) setPaid(e instanceof Error ? e.message : 'Could not load the disbursements.');
      },
    );
    return () => {
      live = false;
    };
  }, [award.id, award.status, reads]);

  const changed = () => {
    setReads((n) => n + 1);
    onChanged();
  };
  const waiting = waitingSentence(award);
  const list = Array.isArray(paid) ? paid : [];
  const { paid: total, left } = disbursedOf(award, list);
  const steps = recordableFrom(award.status);

  return (
    <section aria-label={`Award ${award.fundName}`}>
      <SectionLabel>
        {award.fundName} · {award.aidYear}
      </SectionLabel>
      <p>
        {TYPE_LABEL[award.awardType]}, {money(award.amountCents)}. <strong>{STATUS_LABEL[award.status]}</strong>. {money(total)} disbursed, {money(left)} not yet.
      </p>
      {waiting && <Notice>{waiting}</Notice>}
      {waiting && writable && caps.includes('aid:approve_high') && <Approve award={award} onDone={changed} />}

      {typeof history === 'string' && <Notice alert>{history} Nothing has changed.</Notice>}
      {Array.isArray(history) && (
        <ul aria-label="Award history" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {history.map((h) => (
            <li key={h.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
              {historyLine(h, me)}
            </li>
          ))}
        </ul>
      )}

      <SectionLabel>Disbursements</SectionLabel>
      {typeof paid === 'string' && <Notice alert>{paid}</Notice>}
      {Array.isArray(paid) && paid.length === 0 && <EmptyState inline title="Nothing has been disbursed" body="Disbursements the school records against this award appear here." />}
      {Array.isArray(paid) && paid.length > 0 && (
        <ul aria-label="Disbursements" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {paid.map((d) => (
            <li key={d.id} style={{ paddingBlock: 'var(--sp-3)', borderBottom: '1px solid var(--app-line-soft)' }}>
              {money(d.amountCents)} on {dayOf(d.disbursedOn)}.{' '}
              {d.ledgerEntryId ? `Linked to student-account entry ${d.ledgerEntryId.slice(0, 8)}.` : 'Not linked to a student-account entry.'}
            </li>
          ))}
        </ul>
      )}

      {writable && caps.includes('aid:record') && steps.length > 0 && <Step award={award} options={steps} onDone={changed} />}
      {writable && caps.includes('aid:record') && award.status === 'accepted' && left > 0 && <Disburse award={award} left={left} onDone={changed} />}
    </section>
  );
}

function Approve({ award, onDone }: { award: Award; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['note'] as const);
  const [note, setNote] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const what = `approve:${award.id}`;
  const run = async () => {
    if (!fields.check({ note: noteProblem(note) ?? '' })) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => approveAward(award.id, note.trim(), key));
      setSaid({ tone: 'ok', text: 'Approved. The award can now be accepted and disbursed.' });
      onDone();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The award was not approved.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };
  const noteProps = fields.control('note');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label="Approve as the second person">
        <Sub>You cannot approve an award you recorded.</Sub>
        <div>
          <label htmlFor={noteProps.id}>Note (optional)</label>
          <input
            {...noteProps}
            aria-label="Note"
            className="input"
            autoComplete="off"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              fields.clear('note');
            }}
          />
          <FieldMessage {...fields.message('note')} />
        </div>
        <Row>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Approving…' : pending(what) ? 'Try approving again' : 'Approve this award'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}

function Step({ award, options, onDone }: { award: Award; options: AidStatus[]; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['reason'] as const);
  const selectId = useId();
  const [to, setTo] = useState<AidStatus>(options[0]);
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const choice = options.includes(to) ? to : options[0];
  const what = `aidstatus:${award.id}:${choice}`;
  const run = async () => {
    if (!fields.check({ reason: reasonProblem(reason) ?? '' })) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => recordAwardStatus(award.id, choice, reason.trim(), key));
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
        <Sub>Disbursed is reached by recording the disbursements, not by saying so.</Sub>
        <div>
          <label htmlFor={selectId}>Next status</label>
          <select id={selectId} className="input" value={choice} onChange={(e) => setTo(e.target.value as AidStatus)}>
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
          <FieldMessage {...fields.message('reason')} />
        </div>
        <Row>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Recording…' : pending(what) ? 'Try recording again' : 'Record the status'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}

function Disburse({ award, left, onDone }: { award: Award; left: number; onDone: () => void }) {
  const { attempt, pending } = useAttempts();
  const fields = useFieldErrors(['amount', 'on', 'entry'] as const);
  const [amount, setAmount] = useState('');
  const [on, setOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [entry, setEntry] = useState('');
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, setBusy] = useState(false);
  const what = `disburse:${award.id}:${amount.trim()}:${on}:${entry.trim()}`;
  const run = async () => {
    const cents = parseCents(amount);
    const ok = fields.check({
      amount: amountProblem(amount) ?? (cents !== null && cents > left ? `At most ${money(left)} of this award is left to disburse.` : ''),
      on: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(on) ? '' : 'Give the date it was paid out.',
      entry: entry.trim() === '' || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.trim()) ? '' : 'A student-account entry is identified by the id the ledger shows.',
    });
    if (!ok || cents === null) return;
    setBusy(true);
    setSaid(null);
    try {
      await attempt(what, (key) => recordDisbursement(award.id, cents, on, entry.trim() === '' ? null : entry.trim(), key));
      setSaid({ tone: 'ok', text: 'The disbursement was recorded. Nothing was written to the student account.' });
      setAmount('');
      setEntry('');
      onDone();
    } catch (e) {
      const answered = settled(e);
      setSaid({
        tone: answered ? 'refused' : 'unknown',
        text: e instanceof Error ? e.message : 'The disbursement was not recorded.',
        retry: answered ? undefined : () => void run(),
      });
    } finally {
      setBusy(false);
    }
  };
  const amountProps = fields.control('amount');
  const onProps = fields.control('on');
  const entryProps = fields.control('entry');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
    >
      <Stack label="Record a disbursement">
        <Sub>No money moves here. This records what the school paid out, and may name the student-account aid credit it matches.</Sub>
        <div>
          <label htmlFor={amountProps.id}>Amount paid out, in dollars</label>
          <input
            {...amountProps}
            aria-label="Amount paid out, in dollars"
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
          <label htmlFor={onProps.id}>Paid out on</label>
          <input
            {...onProps}
            aria-label="Paid out on"
            className="input"
            type="date"
            value={on}
            onChange={(e) => {
              setOn(e.target.value);
              fields.clear('on');
            }}
          />
          <FieldMessage {...fields.message('on')} />
        </div>
        <div>
          <label htmlFor={entryProps.id}>Student-account aid credit (optional)</label>
          <input
            {...entryProps}
            aria-label="Student-account aid credit"
            className="input"
            autoComplete="off"
            value={entry}
            onChange={(e) => {
              setEntry(e.target.value);
              fields.clear('entry');
            }}
          />
          <FieldMessage {...fields.message('entry')} />
        </div>
        <Row>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Recording…' : pending(what) ? 'Try recording again' : 'Record the disbursement'}
          </button>
        </Row>
      </Stack>
      <Result said={said} />
    </form>
  );
}
