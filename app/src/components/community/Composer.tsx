import { useState } from 'react';
import { prePostCheck, redact, type PrePostDecision } from '../../community/pii';
import { composerPrompts } from '../../community/detectors';
import { Trouble } from '../Trouble';

/**
 * Writing a post, with the privacy check in front of it.
 *
 * The check runs on the device before anything is sent. A likely phone number,
 * address or email stops the post with two ways forward — take it out for me,
 * or say it is mine to share — because most personal details in a post are the
 * author's own, shared without thinking, and a prompt is the right answer to
 * that. The server runs its own narrower check behind this one, for clients
 * that skip it.
 */
export function Composer({
  label,
  initial = '',
  submitText = 'Post',
  onSubmit,
  onCancel,
  integrityPolicy = '',
}: {
  label: string;
  initial?: string;
  submitText?: string;
  onSubmit: (body: string, confirmedOwn: boolean) => Promise<void>;
  onCancel?: () => void;
  /** The course's policy on assessment answers, quoted by the integrity prompt. */
  integrityPolicy?: string;
}) {
  const [body, setBody] = useState(initial);
  const [check, setCheck] = useState<PrePostDecision | null>(null);
  const [integrity, setIntegrity] = useState<{ message: string; confirmedOwn: boolean } | null>(null);
  const [support, setSupport] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = (confirmedOwn: boolean, afterwards: string) => {
    setBusy(true);
    setError('');
    void onSubmit(body.trim(), confirmedOwn)
      .then(() => {
        setBody('');
        setCheck(null);
        setIntegrity(null);
        // Crisis language never stops a post. The support notice is shown
        // once it has gone, and stays until the author writes again.
        setSupport(afterwards);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not post.'))
      .finally(() => setBusy(false));
  };

  /** After the privacy check: the integrity prompt, then send. */
  const proceed = (confirmedOwn: boolean, integrityAcknowledged = false) => {
    const prompts = composerPrompts(body, integrityPolicy);
    const asks = prompts.find((p) => p.kind === 'integrity');
    if (asks && !integrityAcknowledged) {
      setCheck(null);
      setIntegrity({ message: asks.message, confirmedOwn });
      return;
    }
    send(confirmedOwn, prompts.find((p) => p.kind === 'support')?.message ?? '');
  };

  return (
    <form
      aria-label={label}
      style={{ display: 'grid', gap: 'var(--sp-3)', marginBlock: 'var(--sp-4)' }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        const result = prePostCheck(body);
        if (result.action === 'allow') proceed(false);
        else setCheck(result);
      }}
    >
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        {label}
        <textarea
          className="input"
          maxLength={4000}
          rows={3}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setCheck(null);
            setIntegrity(null);
            setSupport('');
          }}
        />
      </label>
      {check && check.action !== 'allow' && (
        <div role="alert" className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <p style={{ margin: 0 }}>{check.message}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setBody(redact(body, check.findings));
                setCheck(null);
              }}
            >
              Remove it for me
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => proceed(true)}>
              {check.action === 'edit_required' ? 'It’s mine — post anyway' : 'Post anyway'}
            </button>
          </div>
        </div>
      )}
      {integrity && (
        <div role="alert" className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <p style={{ margin: 0 }}>{integrity.message}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <button type="button" className="btn btn-primary" onClick={() => setIntegrity(null)}>
              Edit it
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => proceed(integrity.confirmedOwn, true)}>
              Post anyway
            </button>
          </div>
        </div>
      )}
      {support && (
        <p role="status" className="portal-panel" style={{ margin: 0 }}>
          {support}
        </p>
      )}
      {error && <Trouble said={error} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <button className="btn btn-primary" disabled={busy || !body.trim() || (check !== null && check.action !== 'allow') || integrity !== null}>
          {busy ? 'Posting…' : submitText}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
