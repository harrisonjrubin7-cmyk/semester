import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { lines as handoffLines, withHandoff, type Handoff } from '../lib/tickethandoff';
import type { Account } from '../lib/cloud';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CONTEXT_KEYS,
  CONTEXT_LABELS,
  STATUS_LABELS,
  closeTicket,
  contextToSend,
  firstResponseHours,
  myThread,
  myTickets,
  openTicket,
  replyToTicket,
  setSupportEmailNotice,
  ticketReference,
  type Category,
  type ContextKey,
  type Message,
  type Ticket,
} from '../lib/supporttickets';
import { ActionButton, Notice, SectionLabel } from './ui';

/**
 * Asking Semester itself for help — the app, not a campus office.
 *
 * Campus offices are the Action Center's "Ask for help" and the Support
 * screen's map; this is for "sync is broken" and "I can't reach the drill
 * buttons with my switch". Two rules are drawn on screen rather than kept in a
 * policy: every app detail starts unticked and is shown with its value before
 * it is sent, and the student is told what support will and will not see
 * before they write a word.
 */
/** What `public.support_tickets.body` accepts after trimming. */
const BODY_LIMIT = 4000;

export function SupportTicketsPanel({
  account,
  context,
  handoff,
}: {
  /** What the student was doing, offered as lines they read before sending; null offers nothing. */
  handoff?: Handoff | null;
  account: Account | null;
  context: Record<ContextKey, string>;
}) {
  // Everything below belongs to one account. Keyed by it, a change of
  // account — another tab signing out and someone else in — starts from
  // nothing, and an answer still in flight for the old one lands on a panel
  // that no longer exists rather than on the new student's screen.
  return account ? <AccountTickets key={account.id} context={context} handoff={handoff ?? null} /> : null;
}

function AccountTickets({ context, handoff }: { context: Record<ContextKey, string>; handoff: Handoff | null }) {
  const emailNoticesAvailable = EXPERIENCE_FLAGS.supportEmailNotices !== 'off';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [writing, setWriting] = useState(false);
  const [category, setCategory] = useState<Category>('how_to');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ticked, setTicked] = useState<ReadonlySet<ContextKey>>(new Set());
  // Whether the handoff lines (`lib/tickethandoff.ts`) go in the body. Off until ticked, like every context key.
  const [withDetails, setWithDetails] = useState(false);
  const [emailNotice, setEmailNotice] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const heading = useId();
  /** The conversation last asked for; any other answer is stale. */
  const wanted = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTickets(await myTickets());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your questions.');
      throw error;
    }
  }, []);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);

  const run = <T,>(work: () => Promise<T>, done: string | ((result: T) => string), onCommitted?: () => void) => {
    setBusy(true);
    void work()
      .then(async (result) => {
        const committed = typeof done === 'function' ? done(result) : done;
        onCommitted?.();
        try {
          await refresh();
          setNotice(committed);
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Could not load your questions.';
          setNotice(onCommitted ? `${committed} ${detail} The saved setting is shown.` : detail);
        }
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  const show = (id: string | null) => {
    wanted.current = id;
    setOpenId(id);
    setThread([]);
    if (id === null) return;
    // Opening one question and then another before the first answers must
    // not end with the first one's messages under the second one's reply box.
    void myThread(id)
      .then((messages) => { if (wanted.current === id) setThread(messages); })
      .catch((error: unknown) => {
        if (wanted.current === id) setNotice(error instanceof Error ? error.message : 'Could not load the conversation.');
      });
  };

  const toggle = (key: ContextKey) => {
    const next = new Set(ticked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setTicked(next);
  };

  const reset = () => {
    setWriting(false);
    setReviewing(false);
    setSubject('');
    setBody('');
    setTicked(new Set());
    setWithDetails(false);
    setEmailNotice(false);
  };

  // The database holds the body to 4000 characters after trimming. The lines
  // go in the body, so when they are ticked the editable limit shrinks by
  // their length, and the review step cannot send a body the database would
  // refuse (Codex, #922).
  const composed = withHandoff(body, withDetails ? handoff : null);
  const room = withDetails && handoff ? Math.max(0, BODY_LIMIT - (composed.length - body.trim().length)) : BODY_LIMIT;

  const sending = contextToSend(context, ticked);
  const current = tickets.find((t) => t.id === openId) ?? null;

  return (
    <section aria-labelledby={heading} style={{ marginBottom: 'var(--sp-7)' }}>
      <SectionLabel>Semester support</SectionLabel>
      <h2 id={heading} style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>Ask Semester for help with the app</h2>
      <p style={{ color: 'var(--app-dim)' }}>
        For a question about your courses, advising or campus services, the <a href="#/support">Support</a> screen
        shows which office to go to. This is for the app itself.
      </p>
      <ul style={{ lineHeight: 'var(--leading-relaxed-plus)' }}>
        <li>Semester’s support staff read what you write, without your name or email address.</li>
        <li>Details about the app go only if you tick them, and you see each one first.</li>
        <li>We aim to reply to accessibility and privacy questions within a day, and other questions within three. These are targets, not guaranteed coverage.</li>
        <li>Deleting your account deletes classified questions. Older unclassified records are detached and preserved only for evidence-backed retention review.</li>
      </ul>
      {notice && <Notice>{notice}</Notice>}

      {!writing ? (
        <ActionButton tone="primary" disabled={busy} onClick={() => setWriting(true)}>Ask a question</ActionButton>
      ) : !reviewing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setReviewing(true);
          }}
          style={{ display: 'grid', gap: 'var(--sp-4)' }}
        >
          <label>
            What is it about
            <select className="input" value={category} onChange={(event) => setCategory(event.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label>
            In a few words
            <input className="input" required maxLength={140} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label>
            What happened, or what you want to do
            <textarea className="input" required maxLength={room} value={body} onChange={(event) => setBody(event.target.value.slice(0, room))} />
          </label>
          <p style={{ color: 'var(--app-dim)' }}>Please leave out grades, health details and anything about other people. Support does not need them to help with the app.</p>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend>Details about the app to include (optional)</legend>
            {CONTEXT_KEYS.map((key) => (
              <label key={key} style={{ display: 'block' }}>
                <input type="checkbox" checked={ticked.has(key)} onChange={() => toggle(key)} />
                {' '}{CONTEXT_LABELS[key]}: <code>{context[key]}</code>
              </label>
            ))}
          </fieldset>
          {handoff ? (
            <fieldset style={{ border: 0, padding: 0 }}>
              <legend>What I was doing (optional)</legend>
              <label style={{ display: 'block' }}>
                <input type="checkbox" checked={withDetails} onChange={() => setWithDetails((v) => !v)} />
                {' '}Add these lines to my message, exactly as shown:
              </label>
              <ul style={{ margin: 'var(--sp-2) 0 0', paddingLeft: 'var(--sp-6)', color: 'var(--app-dim)' }}>
                {handoffLines(handoff).map((l) => <li key={l}>{l}</li>)}
              </ul>
              <p style={{ color: 'var(--app-dim)', margin: 'var(--sp-2) 0 0' }}>Never included: your notes, files, grades, conversations with the assistant, or anything from your student record.</p>
            </fieldset>
          ) : null}
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend>When support replies (optional)</legend>
            {emailNoticesAvailable ? <label style={{ display: 'block' }}>
              <input type="checkbox" checked={emailNotice} onChange={() => setEmailNotice((value) => !value)} />
              {' '}Email me a generic notice. The reply itself stays in Semester.
            </label> : <p style={{ color: 'var(--app-dim)', margin: 0 }}>
              Email notices are unavailable while the email provider review and terms are incomplete. Replies stay in Help.
            </p>}
            <p style={{ color: 'var(--app-dim)', margin: 'var(--sp-2) 0 0' }}>
              {emailNoticesAvailable
                ? 'Off by default. At most three notices per question in 24 hours. You can turn it off anytime.'
                : 'No account email is sent while this gate is closed.'}
            </p>
          </fieldset>
          <button className="btn btn-primary btn-block" disabled={!subject.trim() || !body.trim() || composed.length > BODY_LIMIT}>Check before sending</button>
          <button type="button" className="btn btn-secondary btn-block" onClick={reset}>Cancel</button>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <h3 style={{ fontSize: 'var(--type-lg)' }}>This is everything that will be sent</h3>
          <dl aria-label="What will be sent">
            <dt>About</dt><dd>{CATEGORY_LABELS[category]}</dd>
            <dt>Subject</dt><dd>{subject.trim()}</dd>
            <dt>Your question</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{composed}</dd>
            <dt>App details</dt>
            <dd>
              {Object.keys(sending).length === 0
                ? 'None'
                : CONTEXT_KEYS.filter((k) => k in sending).map((k) => `${CONTEXT_LABELS[k]}: ${sending[k]}`).join(' · ')}
            </dd>
            <dt>Email notice</dt><dd>{emailNotice ? 'On — generic notice only' : 'Off'}</dd>
          </dl>
          <p style={{ color: 'var(--app-dim)' }}>Our first-reply target is {firstResponseHours(category)} hours. It is not a guaranteed SLA.</p>
          <ActionButton
            tone="primary"
            disabled={busy}
            onClick={() => run(async () => { await openTicket(category, subject, composed, sending, emailNotice); reset(); }, 'Sent. The reply will appear here.')}
          >
            Send to Semester support
          </ActionButton>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setReviewing(false)}>Change something</button>
        </div>
      )}

      {tickets.length > 0 && (
        <>
          <h3 style={{ fontSize: 'var(--type-lg)', marginTop: 'var(--sp-5)' }}>Your questions</h3>
          <ul aria-label="Your questions" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {tickets.map((t) => (
              <li key={t.id} className="portal-panel" style={{ marginBlock: 'var(--sp-3)' }}>
                <div style={{ color: 'var(--app-dim)', marginBottom: 'var(--sp-2)' }}>Reference {ticketReference(t.id)}</div>
                <button type="button" className="btn btn-secondary btn-block" aria-expanded={openId === t.id} onClick={() => show(openId === t.id ? null : t.id)}>
                  {t.subject} · {STATUS_LABELS[t.status]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {current && (
        <div aria-label="Conversation" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <label className="portal-panel">
            <input
              type="checkbox"
              checked={current.emailNoticeEnabled}
              disabled={busy || (!emailNoticesAvailable && !current.emailNoticeEnabled)}
              onChange={(event) => {
                const enabled = event.currentTarget.checked;
                run(
                  () => setSupportEmailNotice(current.id, enabled),
                  (outcome) => enabled
                    ? 'Generic email notices are on for this question.'
                    : outcome === 'off_with_in_flight'
                      ? 'Email notices are off for this question. One notice was already being delivered and may still arrive.'
                      : 'Email notices are off for this question.',
                  () => setTickets((items) => items.map((ticket) => (
                    ticket.id === current.id ? { ...ticket, emailNoticeEnabled: enabled } : ticket
                  ))),
                );
              }}
            />
            {' '}Email me a generic notice when support replies
            <span style={{ display: 'block', color: 'var(--app-dim)' }}>
              {emailNoticesAvailable
                ? 'At most three notices in 24 hours. Turn off anytime; replies remain here.'
                : current.emailNoticeEnabled
                  ? 'Email delivery is gated. You can turn this saved preference off; replies remain here.'
                  : 'Unavailable until the email provider review and terms are complete; replies remain here.'}
            </span>
          </label>
          {thread.map((m, i) => (
            <p key={i} className="portal-panel">
              <strong>{m.from === 'support' ? 'Semester support' : 'You'}</strong>{' · '}{m.body}
            </p>
          ))}
          {current.status !== 'closed' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => { await replyToTicket(current.id, reply); setReply(''); show(current.id); }, 'Reply sent.');
              }}
              style={{ display: 'grid', gap: 'var(--sp-3)' }}
            >
              <label>
                Reply
                <textarea className="input" required maxLength={4000} value={reply} onChange={(event) => setReply(event.target.value)} />
              </label>
              <button className="btn btn-primary btn-block" disabled={busy || !reply.trim()}>Send reply</button>
              <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={() => run(() => closeTicket(current.id), 'Closed.')}>
                Close this question
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
