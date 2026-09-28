import { useState } from 'react';
import { SUMMARY_MAX } from '../../community/crisis';
import type { ReportCategory, Severity } from '../../community/moderation';
import {
  decideEscalation,
  requestEscalation,
  type CaseRow,
  type Escalation,
  type EscalationPolicy,
} from '../../community/client';
import { Trouble } from '../Trouble';
import { formatDateTime } from '../../lib/locale';

/** Fewer than this and the server refuses; said here so the button agrees. */
export const REASON_MIN = 10;

/** Said under every reason box, so a disabled button is never unexplained. */
export function ReasonHint({ reason, keptWith = 'the case' }: { reason: string; keptWith?: string }) {
  const short = REASON_MIN - reason.trim().length;
  const kept = `It is kept with ${keptWith}.`;
  return (
    <p style={{ margin: 0, color: 'var(--app-dim)' }}>
      {short > 0 ? `Write at least ${REASON_MIN} characters — ${short} to go. ${kept}` : kept}
    </p>
  );
}

/**
 * Whether a case can be escalated, and if not, the one reason why — the same
 * conditions `private.escalation_allowed` asks, in the order it asks them, so
 * the console never offers what the server will refuse. The server still asks.
 */
export function escalationBlock(
  kase: Pick<CaseRow, 'severity' | 'category'>,
  policy: EscalationPolicy | undefined,
  live: Escalation | undefined,
): string | null {
  if (!policy || !policy.enabled || !policy.agreementRef || !policy.hasChannel) {
    return 'This school has no escalation agreement in force.';
  }
  if (kase.severity !== 'P0' && kase.severity !== 'P1') return 'Only P0 and P1 cases can be escalated.';
  if (!policy.categories.includes(kase.category)) return 'The school’s agreement doesn’t cover this category.';
  if (live) return live.status === 'approved' ? 'This case has already been escalated.' : 'An escalation is already waiting for a second reviewer.';
  return null;
}

/**
 * Asking for an escalation. What would leave is shown before anybody asks,
 * field by field, because it is fixed: the reviewer supplies only the reason,
 * which becomes the summary.
 */
export function EscalationRequest({
  kase,
  policy,
  live,
  onDone,
}: {
  kase: CaseRow;
  policy: EscalationPolicy | undefined;
  live: Escalation | undefined;
  onDone: (said: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blocked = escalationBlock(kase, policy, live);

  return (
    <details>
      <summary>Escalate to the university</summary>
      <div style={{ display: 'grid', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
        {blocked ? (
          <p style={{ margin: 0 }}>{blocked}</p>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Only for a credible risk to somebody’s safety that the school has agreed to receive. You ask; a different
              reviewer approves or refuses. Nothing is sent until they approve.
            </p>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>What would be sent</p>
              <ul style={{ margin: 0 }}>
                <li>A case reference, the category and the severity</li>
                <li>Your reason below, as the summary (up to {SUMMARY_MAX} characters)</li>
                <li>When it was approved, and the agreement {policy?.agreementRef}</li>
                <li>
                  {policy?.identityRequired
                    ? 'A reference the agreement lets the school resolve to the author — never a name, an email or an account id'
                    : 'Nothing that identifies the author'}
                </li>
              </ul>
            </div>
            <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              Why this needs the university
              <textarea
                className="input"
                rows={3}
                maxLength={SUMMARY_MAX}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <ReasonHint reason={reason} />
            <div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || reason.trim().length < REASON_MIN}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  void requestEscalation(kase.id, reason.trim())
                    .then(() => onDone('Escalation requested. A different reviewer must approve it before anything is sent.'))
                    .catch((e: unknown) => setError(e instanceof Error ? e.message : 'The escalation was not requested.'))
                    .finally(() => setBusy(false));
                }}
              >
                Ask a second reviewer to approve
              </button>
            </div>
          </>
        )}
        {error && <Trouble said={error} />}
      </div>
    </details>
  );
}

/** What each adapter failure code means, for the reviewer reading it. */
export const FAILURE_TEXT: Record<string, string> = {
  timeout: 'the university’s system did not answer in time',
  network: 'the university’s system could not be reached',
  channel_not_configured: 'the delivery channel in the agreement has not been set up on Semester’s side',
  payload_rejected: 'the adapter refused to send it because it held a field the agreement does not allow',
  signing_failed: 'it could not be signed',
  unknown: 'an unrecognised error',
};

export function failureText(code: string): string {
  const http = /^http_(\d{3})$/.exec(code);
  if (http) return `the university’s system answered ${http[1]}`;
  return FAILURE_TEXT[code] ?? FAILURE_TEXT.unknown;
}

/** Where an approved escalation's one delivery stands, in a sentence. */
export function deliveryText(delivery: Escalation['delivery'], when: (iso: string) => string): string {
  if (!delivery) return 'Approved; the delivery record is no longer kept.';
  if (delivery.deliveredAt) return `Delivered ${when(delivery.deliveredAt)}.`;
  if (!delivery.lastError) return 'Queued for delivery; not sent yet.';
  const why = failureText(delivery.lastError);
  if (delivery.attempts >= 5) {
    return `Not delivered — ${why}. No more attempts will be made; tell whoever runs the delivery adapter, and reach the university another way if it is urgent.`;
  }
  return `Not delivered yet — ${why}. Next attempt ${delivery.nextAttemptAt ? when(delivery.nextAttemptAt) : 'soon'}.`;
}

const STATUS_TEXT: Record<Escalation['status'], string> = {
  requested: 'Waiting for a second reviewer',
  approved: 'Approved',
  refused: 'Refused',
};

/**
 * One escalation, as the list of them shows it. A request is decided here by
 * somebody other than whoever asked — the server compares the two, and the
 * console says so rather than offering buttons that will be refused.
 */
export function EscalationItem({
  item,
  mine,
  categoryText,
  severityText,
  onDone,
}: {
  item: Escalation;
  mine: boolean;
  categoryText: (c: ReportCategory) => string;
  severityText: (s: Severity) => string;
  onDone: (said: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const when = (iso: string) =>
    formatDateTime(new Date(iso), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const decide = (approve: boolean) => {
    setBusy(true);
    setError('');
    void decideEscalation(item.id, approve, reason.trim())
      .then(() => onDone(approve ? 'Escalation approved and queued for delivery.' : 'Escalation refused. Nothing was sent.'))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'The decision was not recorded.'))
      .finally(() => setBusy(false));
  };

  return (
    <article
      className="portal-panel"
      aria-label={`Escalation, ${STATUS_TEXT[item.status].toLowerCase()}`}
      style={{ display: 'grid', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}
    >
      <strong>
        {item.severity ? severityText(item.severity) : 'Case no longer kept'}
        {item.category ? ` · ${categoryText(item.category)}` : ''}
      </strong>
      <span style={{ color: 'var(--app-dim)' }}>
        {STATUS_TEXT[item.status]} · asked {when(item.requestedAt)}
        {item.decidedAt ? ` · decided ${when(item.decidedAt)}` : ''}
      </span>
      <p style={{ margin: 0 }}>Reason given: “{item.requestedReason}”</p>
      {item.decidedReason && <p style={{ margin: 0 }}>Second reviewer: “{item.decidedReason}”</p>}
      {item.status === 'approved' && <p style={{ margin: 0 }}>{deliveryText(item.delivery, when)}</p>}
      {item.status === 'requested' &&
        (mine ? (
          <p style={{ margin: 0 }}>You asked for this one. A different reviewer has to approve or refuse it.</p>
        ) : (
          <>
            <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              Your reason
              <textarea className="input" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <ReasonHint reason={reason} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
              <button type="button" className="btn btn-primary" disabled={busy || reason.trim().length < REASON_MIN} onClick={() => decide(true)}>
                Approve and send
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy || reason.trim().length < REASON_MIN} onClick={() => decide(false)}>
                Refuse
              </button>
            </div>
          </>
        ))}
      {error && <Trouble said={error} />}
    </article>
  );
}
