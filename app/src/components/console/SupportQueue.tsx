import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Notice, SectionLabel } from '../ui';
import {
  CATEGORY_LABELS,
  CONTEXT_KEYS,
  CONTEXT_LABELS,
  supportQueue,
  supportReply,
  supportThread,
  ticketReference,
  type SupportMessage,
  type SupportQueueTicket,
} from '../../lib/supporttickets';
import { matches, said, when, type ViewProps } from './Fields';

const OPERATOR_STATUS_LABELS: Record<SupportQueueTicket['status'], string> = {
  open: 'Open with support',
  waiting_on_student: 'Waiting for student',
  resolved: 'Resolved; student may close',
  closed: 'Closed by student',
};

/**
 * Semester's identity-free support desk.
 *
 * The queue RPC exposes no student, email, account, handle or tenant column.
 * Opening context is limited to the app facts the student reviewed and ticked;
 * the database still capability-gates every read and reply with
 * `support:ticket`, independently of the operations-console gate.
 */
export function SupportQueue({ filter, onStatus, privileged }: ViewProps) {
  const [tickets, setTickets] = useState<SupportQueueTicket[] | null>(null);
  const [queueFailed, setQueueFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportMessage[] | null>(null);
  const [threadFailed, setThreadFailed] = useState(false);
  const [reply, setReply] = useState('');
  const [nextStatus, setNextStatus] = useState<'open' | 'waiting_on_student' | 'resolved'>('waiting_on_student');
  const [busy, setBusy] = useState(false);
  const replyOperation = useRef<string | null>(null);
  const wanted = useRef<string | null>(null);
  const queueRequest = useRef(0);
  const threadRequest = useRef(0);

  const loadThread = useCallback(async (ticketId: string, reportError = true): Promise<boolean> => {
    const request = ++threadRequest.current;
    try {
      const messages = await supportThread(ticketId);
      if (wanted.current !== ticketId || request !== threadRequest.current) return false;
      setThreadFailed(false);
      setThread(messages);
      return true;
    } catch (error) {
      if (wanted.current !== ticketId || request !== threadRequest.current) return false;
      setThreadFailed(true);
      if (reportError) onStatus(said(error, 'Could not read the support conversation.'));
      return false;
    }
  }, [onStatus]);

  const refresh = useCallback(async (): Promise<boolean> => {
    const request = ++queueRequest.current;
    try {
      const next = await supportQueue();
      if (request !== queueRequest.current) return false;
      setTickets(next);
      setQueueFailed(false);
      return true;
    } catch (error) {
      if (request !== queueRequest.current) return false;
      // Keep the last-known queue visible. Replacing it with an empty list
      // would falsely tell an operator that every open ticket disappeared.
      setQueueFailed(true);
      onStatus(said(error, 'Could not read the support queue.'));
      return false;
    }
  }, [onStatus]);

  // Account-backed queue state, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const shown = useMemo(
    () => (tickets ?? []).filter((ticket) => matches(
      filter,
      ticketReference(ticket.id),
      ticket.subject,
      CATEGORY_LABELS[ticket.category],
      OPERATOR_STATUS_LABELS[ticket.status],
      ticket.priority,
    )),
    [tickets, filter],
  );

  const open = (id: string | null) => {
    threadRequest.current += 1;
    wanted.current = id;
    setOpenId(id);
    setThread(null);
    setThreadFailed(false);
    setReply('');
    replyOperation.current = null;
    setNextStatus('waiting_on_student');
    if (!id) return;
    void loadThread(id);
  };

  const refreshVisible = async () => {
    const ticketId = wanted.current;
    await Promise.all([
      refresh(),
      ticketId ? loadThread(ticketId) : Promise.resolve(true),
    ]);
  };

  const send = async () => {
    if (!openId || !reply.trim()) return;
    const ticketId = openId;
    const message = reply;
    const status = nextStatus;
    const operationId = replyOperation.current ?? crypto.randomUUID();
    replyOperation.current = operationId;
    setBusy(true);
    try {
      const delivery = await supportReply(ticketId, message, status, operationId);
      if (wanted.current === ticketId) {
        setReply('');
        replyOperation.current = null;
      }
      const queueFresh = await refresh();
      const outcome = delivery === 'accepted'
        ? `Reply recorded for ${ticketReference(ticketId)}. Email notice accepted by the provider; delivery is not yet confirmed.`
        : delivery === 'queued'
          ? `Reply recorded for ${ticketReference(ticketId)}. Email notice is queued for retry; the reply is available in Help.`
          : delivery === 'in_progress'
            ? `Reply recorded for ${ticketReference(ticketId)}. Email notice is already being delivered; provider acceptance is not yet confirmed.`
          : delivery === 'cancelled'
            ? `Reply recorded for ${ticketReference(ticketId)}. Email notice was cancelled before delivery; the reply is available in Help.`
            : delivery === 'capped'
              ? `Reply recorded for ${ticketReference(ticketId)}. No email was queued because this question reached its three-notice daily cap.`
              : `Reply recorded for ${ticketReference(ticketId)}. The student chose in-app replies without email notices.`;
      onStatus(queueFresh ? outcome : `${outcome} The queue could not be refreshed; retry before acting on its status.`);
      // The write and notification have already succeeded. A later read outage
      // must not invite an operator to retry and send a duplicate response.
      if (wanted.current === ticketId) await loadThread(ticketId, false);
    } catch (error) {
      onStatus(said(error, 'Could not send the support reply.'));
    } finally {
      setBusy(false);
    }
  };

  const current = tickets?.find((ticket) => ticket.id === openId) ?? null;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Identity-free queue. This view receives no student name, email, account, handle or tenant. It shows only the question and app context the student chose to send.
      </Notice>
      <SectionLabel aside={tickets === null ? 'reading' : `${shown.length} open`}>Support queue</SectionLabel>
      <button type="button" className="btn btn-secondary" onClick={() => { void refreshVisible(); }}>Refresh support queue</button>
      {queueFailed && (
        <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <Notice>{tickets === null ? 'Support queue unavailable.' : 'Support queue could not be refreshed; the last-known list remains visible.'}</Notice>
        </div>
      )}
      {tickets === null && !queueFailed && <p role="status">Reading the support queue…</p>}
      {tickets !== null && !queueFailed && shown.length === 0 && <p role="status">No support questions match this view.</p>}
      {shown.map((ticket) => (
        <article key={ticket.id} className="portal-panel" aria-label={`Support ticket ${ticketReference(ticket.id)}`} style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          <strong>{ticketReference(ticket.id)} · {ticket.subject}</strong>
          <div style={{ color: 'var(--app-dim)' }}>
            {CATEGORY_LABELS[ticket.category]} · {OPERATOR_STATUS_LABELS[ticket.status]} · {ticket.priority} priority
          </div>
          <div>
            First reply due {when(ticket.firstResponseDue)}{ticket.overdue ? ' · OVERDUE' : ''}
          </div>
          <button type="button" className="btn btn-secondary" aria-expanded={openId === ticket.id} onClick={() => open(openId === ticket.id ? null : ticket.id)}>
            {openId === ticket.id ? 'Close conversation' : 'Open conversation'}
          </button>
        </article>
      ))}

      {current && (
        <section aria-label={`Conversation ${ticketReference(current.id)}`} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <h3 style={{ margin: 0 }}>{ticketReference(current.id)} · {current.subject}</h3>
          {thread === null && !threadFailed && <p role="status">Reading the conversation…</p>}
          {threadFailed && (
            <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
              <Notice>Conversation unavailable. Replies stay disabled until the full thread can be read.</Notice>
              <button type="button" className="btn btn-secondary" onClick={() => { void loadThread(current.id); }}>Retry conversation</button>
            </div>
          )}
          {thread?.map((message, index) => (
            <article key={`${message.at}-${index}`} style={{ borderTop: '1px solid var(--app-line)', paddingTop: 'var(--sp-3)' }}>
              <strong>{message.from === 'support' ? 'Semester support' : 'Student'}</strong> · {when(message.at)}
              <p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
              {message.context && Object.keys(message.context).length > 0 && (
                <dl aria-label="Student-approved app context">
                  {CONTEXT_KEYS.filter((key) => message.context?.[key]).map((key) => (
                    <div key={key}>
                      <dt>{CONTEXT_LABELS[key]}</dt>
                      <dd>{message.context?.[key]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          ))}
          {thread !== null && !threadFailed && (
            <form
              aria-label={`Reply to ${ticketReference(current.id)}`}
              onSubmit={(event) => { event.preventDefault(); privileged(send); }}
              style={{ display: 'grid', gap: 'var(--sp-3)' }}
            >
              <label>
                Reply
                <textarea className="input" required maxLength={4000} value={reply} disabled={busy} onChange={(event) => { setReply(event.target.value); replyOperation.current = null; }} />
              </label>
              <label>
                After this reply
                <select className="input" value={nextStatus} disabled={busy} onChange={(event) => { setNextStatus(event.target.value as typeof nextStatus); replyOperation.current = null; }}>
                  <option value="waiting_on_student">Wait for the student</option>
                  <option value="resolved">Mark resolved for the student to close</option>
                  <option value="open">Keep open with support</option>
                </select>
              </label>
              <button className="btn btn-primary" disabled={busy || !reply.trim()}>Send support reply</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
