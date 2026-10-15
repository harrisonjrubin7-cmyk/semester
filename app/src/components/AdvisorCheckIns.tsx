import { useCallback, useEffect, useId, useState } from 'react';
import { checkInProblem, checkInsOn, readSteps, recordCheckIn, type CheckIn, MAX_NOTE, MAX_STEPS } from '../lib/advisor-checkins';
import { formatDate } from '../lib/locale';
import { FieldMessage, fieldProps } from './FieldMessage';
import { Notice } from './ui';

const day = (iso: string) => formatDate(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' });
const newKey = () => crypto.randomUUID();

/**
 * The advisor writing back on a share they opened (Advising #5 and part of #6;
 * D-1448): what was talked about, and up to five next steps the student can
 * turn into their own actions.
 *
 * A draft keeps one key until it is recorded, so pressing the button again
 * after a failure, or twice, records one check-in. The server refuses a share
 * that has expired or been revoked, or an advisor whose role has lapsed; the
 * form says so and keeps the draft.
 */
export function AdvisorCheckInForm({ shareId, sharedAs }: { shareId: string; sharedAs: string }) {
  const id = useId();
  const [note, setNote] = useState('');
  const [steps, setSteps] = useState('');
  const [key, setKey] = useState(newKey);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [said, setSaid] = useState('');
  const [earlier, setEarlier] = useState<Omit<CheckIn, 'share_id'>[] | null>(null);

  const load = useCallback(() => {
    checkInsOn(shareId).then(setEarlier, (e: unknown) => setError(e instanceof Error ? e.message : 'Earlier check-ins could not be loaded.'));
  }, [shareId]);
  useEffect(load, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaid('');
    setError('');
    const list = readSteps(steps);
    const wrong = checkInProblem(note, list);
    setProblem(wrong ?? '');
    if (wrong) return;
    setSending(true);
    try {
      await recordCheckIn(shareId, note, list, key);
      setNote('');
      setSteps('');
      setKey(newKey());
      setSaid(`Check-in recorded. ${sharedAs || 'The student'} can see it on their share.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check-in was not recorded. Try again.');
    } finally {
      setSending(false);
    }
  };

  const noteError = problem && !note.trim() ? problem : undefined;
  const stepsError = problem && note.trim() ? problem : undefined;

  return (
    <section className="advisor-checkins" aria-label="Check-ins">
      <h5>Check-ins</h5>
      {earlier === null ? null : earlier.length ? (
        <ul className="advisor-share-list">
          {earlier.map((c) => (
            <li key={c.id}>
              {day(c.created_at)}: {c.note}
              {c.next_steps.length ? <ul>{c.next_steps.map((s) => <li key={s}>{s}</li>)}</ul> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-muted">No check-ins on this share yet.</p>
      )}
      <form onSubmit={(e) => void submit(e)} noValidate>
        <label className="portal-check">
          What you talked about
          <textarea
            className="input"
            rows={3}
            maxLength={MAX_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            {...fieldProps(`${id}-note`, noteError)}
          />
        </label>
        <FieldMessage id={`${id}-note`} error={noteError} />
        <p className="portal-muted" id={`${id}-steps-hint`}>
          Up to {MAX_STEPS} next steps. The student can add each one to their own actions.
        </p>
        <label className="portal-check">
          Next steps, one per line
          <textarea
            className="input"
            rows={3}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            {...fieldProps(`${id}-steps`, stepsError, `${id}-steps-hint`)}
          />
        </label>
        <FieldMessage id={`${id}-steps`} error={stepsError} />
        <button type="submit" className="balance-button" disabled={sending}>
          {sending ? 'Recording…' : 'Record check-in'}
        </button>
      </form>
      {error ? <Notice alert>{error}</Notice> : null}
      {said ? <Notice>{said}</Notice> : null}
    </section>
  );
}

/**
 * The student's view of the check-ins on one share: each note, and each next
 * step with a button that adds it to their own actions. A step already added
 * says so instead of adding it twice.
 */
export function ShareCheckIns({
  checkIns,
  added,
  onAdd,
  onDelete,
}: {
  checkIns: CheckIn[];
  added: ReadonlySet<string>;
  onAdd: (step: string) => void;
  onDelete: (c: CheckIn) => void;
}) {
  if (!checkIns.length) return null;
  return (
    <ul className="advisor-checkin-list" aria-label="Check-ins from your advisor">
      {checkIns.map((c) => (
        <li key={c.id}>
          Check-in, {day(c.created_at)}: {c.note}{' '}
          <button type="button" className="workspace-text-button" onClick={() => onDelete(c)}>
            Delete check-in…
          </button>
          {c.next_steps.length ? (
            <ul>
              {c.next_steps.map((s) => (
                <li key={s}>
                  {s}{' '}
                  {added.has(s) ? (
                    <span className="portal-muted">In your actions</span>
                  ) : (
                    <button type="button" className="workspace-text-button" aria-label={`Add “${s}” to my actions`} onClick={() => onAdd(s)}>
                      Add to my actions
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
