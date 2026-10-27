import { useId, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { cloudConfigured } from '../lib/cloud';
import { SUPPORT } from '../lib/privacy';
import {
  ACCOMMODATION_PRIVACY_NOTICE,
  correctAccommodationRequest,
  myAccommodationRequests,
  raiseAccommodationRequest,
  withdrawAccommodationRequest,
  type AccommodationRequestInput,
  type AccommodationRequestReceipt,
  type AccommodationRequestStatus,
} from '../lib/accommodation-request';

const KINDS = [
  ['accommodation_support', 'Help requesting an accommodation'],
  ['accessibility_barrier', 'A barrier is blocking me'],
  ['alternate_format', 'Accessible or alternate format'],
  ['communication_access', 'Communication access'],
  ['other', 'Something else'],
] as const;

const words = (value: string) => value.replaceAll('_', ' ');

export function AccommodationRequestPanel({
  available,
  submitter = raiseAccommodationRequest,
  statusLoader = myAccommodationRequests,
  corrector = correctAccommodationRequest,
  withdrawer = withdrawAccommodationRequest,
}: {
  available?: boolean;
  submitter?: (input: AccommodationRequestInput) => Promise<AccommodationRequestReceipt>;
  statusLoader?: () => Promise<AccommodationRequestStatus[]>;
  corrector?: (id: string, summary: string) => Promise<void>;
  withdrawer?: (id: string) => Promise<void>;
}) {
  const { account } = useStore();
  const base = useId();
  const canSend = available ?? (cloudConfigured && Boolean(account));
  const [kind, setKind] = useState<AccommodationRequestInput['kind']>('accommodation_support');
  const [summary, setSummary] = useState('');
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [statuses, setStatuses] = useState<AccommodationRequestStatus[] | null>(null);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correction, setCorrection] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);

  async function refresh() {
    setProblem('');
    try {
      setStatuses(await statusLoader());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Request status is unavailable.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem('');
    setSending(true);
    try {
      const receipt = await submitter({ kind, summary, consent });
      setNotice(`Request ${receipt.id} was submitted for human review by your school’s access office.`);
      setSummary('');
      setConsent(false);
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The request could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (!canSend) {
    return (
      <section aria-labelledby={`${base}-title`}>
        <h3 id={`${base}-title`}>Ask your access office</h3>
        <div role="status">
          <p>A verified school account is required for this private request path. No request was sent.</p>
          <p>Safe fallback: contact your school’s access office directly, or write to {SUPPORT} without including a diagnosis or another person’s information.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${base}-title`}>
      <h3 id={`${base}-title`}>Ask your access office</h3>
      <p>
        This sends a private routing request to an authorized person at your school. Semester does not decide whether you qualify,
        approve or deny an accommodation, or change a course or academic record.
      </p>
      <form onSubmit={submit}>
        <label className="jx-field" htmlFor={`${base}-kind`}>
          <span>What kind of help do you need?</span>
          <select id={`${base}-kind`} className="input" value={kind} onChange={(event) => setKind(event.target.value as AccommodationRequestInput['kind'])}>
            {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="jx-field" htmlFor={`${base}-summary`}>
          <span>What should the access office know?</span>
          <textarea id={`${base}-summary`} className="input jx-area" required maxLength={1000} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <p id={`${base}-privacy`} className="jx-muted">
          Privacy notice {ACCOMMODATION_PRIVACY_NOTICE}: share only the barrier or support you need. Do not include a diagnosis,
          medical document, grades, or another person’s information. Your school’s access office owns the human follow-up.
        </p>
        <label className="jx-check">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} aria-describedby={`${base}-privacy`} />
          <span className="jx-check-body"><span className="jx-check-title">I understand what will be sent and who will receive it.</span></span>
        </label>
        <button type="submit" className="btn btn-secondary" disabled={sending || !summary.trim() || !consent}>
          {sending ? 'Sending…' : 'Send private request'}
        </button>
      </form>

      <button type="button" className="bare link-quiet" onClick={() => { void refresh(); }}>Check my request status</button>
      {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
      {problem ? <p role="alert">{problem} Safe fallback: contact the access office directly or write to {SUPPORT} without sensitive records.</p> : null}
      {statuses?.length === 0 ? <p role="status">No access-office requests were found for this account.</p> : null}
      {statuses?.map((item) => {
        const open = !['resolved', 'withdrawn'].includes(item.status);
        return (
          <article key={item.id} className="jx-entry" aria-label={`Access request ${item.id}`}>
            <strong>{words(item.kind)}</strong>
            <p>Status: {words(item.status)} · Owner: your school’s access office · Response due {item.responseDueAt}</p>
            {item.status === 'needs_student' ? (
              <p role="status">Your access office requested more information. Add a correction below; the request remains open.</p>
            ) : null}
            <p>{item.summary}</p>
            {open && correcting !== item.id ? (
              <button type="button" className="bare link-quiet" onClick={() => { setCorrecting(item.id); setCorrection(item.summary); }}>Correct this request</button>
            ) : null}
            {open && correcting === item.id ? (
              <form onSubmit={(event) => {
                event.preventDefault();
                setProblem('');
                void corrector(item.id, correction).then(() => {
                  setCorrecting(null);
                  setCorrection('');
                  setNotice('Your correction was added without deleting the original request.');
                  void refresh();
                }).catch((error: unknown) => setProblem(error instanceof Error ? error.message : 'The correction could not be sent.'));
              }}>
                <label className="jx-field"><span>Corrected request</span><textarea className="input jx-area" required maxLength={1000} value={correction} onChange={(event) => setCorrection(event.target.value)} /></label>
                <button type="submit" className="btn btn-secondary" disabled={!correction.trim()}>Add correction</button>
                <button type="button" className="bare" onClick={() => setCorrecting(null)}>Cancel</button>
              </form>
            ) : null}
            {open && confirmWithdraw !== item.id ? (
              <button type="button" className="bare link-quiet" onClick={() => setConfirmWithdraw(item.id)}>Withdraw this request</button>
            ) : null}
            {open && confirmWithdraw === item.id ? (
              <div role="group" aria-label="Confirm withdrawal">
                <p>Withdraw this request? Its audit history remains, but the access office will stop reviewing it.</p>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setProblem('');
                  void withdrawer(item.id).then(() => {
                    setConfirmWithdraw(null);
                    setNotice('The request was withdrawn.');
                    void refresh();
                  }).catch((error: unknown) => setProblem(error instanceof Error ? error.message : 'The request could not be withdrawn.'));
                }}>Confirm withdrawal</button>
                <button type="button" className="bare" onClick={() => setConfirmWithdraw(null)}>Keep request</button>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
