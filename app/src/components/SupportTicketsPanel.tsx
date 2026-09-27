import { useCallback, useEffect, useId, useState } from 'react';
import type { Account } from '../lib/cloud';
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
export function SupportTicketsPanel({
  account,
  context,
}: {
  account: Account | null;
  context: Record<ContextKey, string>;
}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [writing, setWriting] = useState(false);
  const [category, setCategory] = useState<Category>('how_to');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [ticked, setTicked] = useState<ReadonlySet<ContextKey>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const heading = useId();

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      setTickets(await myTickets());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your questions.');
    }
  }, [account]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const run = (work: () => Promise<void>, done: string) => {
    setBusy(true);
    void work()
      .then(async () => {
        await refresh();
        setNotice(done);
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'That did not work.'))
      .finally(() => setBusy(false));
  };

  const show = (id: string) => {
    setOpenId(id);
    setThread([]);
    void myThread(id)
      .then(setThread)
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not load the conversation.'));
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
  };

  if (!account) return null;
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
        <li>Accessibility and privacy questions get a first reply within a day; the rest within three.</li>
        <li>Deleting your account deletes these too.</li>
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
            <textarea className="input" required maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} />
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
          <button className="btn btn-primary btn-block" disabled={!subject.trim() || !body.trim()}>Check before sending</button>
          <button type="button" className="btn btn-secondary btn-block" onClick={reset}>Cancel</button>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <h3 style={{ fontSize: 'var(--type-lg)' }}>This is everything that will be sent</h3>
          <dl aria-label="What will be sent">
            <dt>About</dt><dd>{CATEGORY_LABELS[category]}</dd>
            <dt>Subject</dt><dd>{subject.trim()}</dd>
            <dt>Your question</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{body.trim()}</dd>
            <dt>App details</dt>
            <dd>
              {Object.keys(sending).length === 0
                ? 'None'
                : CONTEXT_KEYS.filter((k) => k in sending).map((k) => `${CONTEXT_LABELS[k]}: ${sending[k]}`).join(' · ')}
            </dd>
          </dl>
          <p style={{ color: 'var(--app-dim)' }}>A first reply is due within {firstResponseHours(category)} hours.</p>
          <ActionButton
            tone="primary"
            disabled={busy}
            onClick={() => run(async () => { await openTicket(category, subject, body, sending); reset(); }, 'Sent. The reply will appear here.')}
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
                <button type="button" className="btn btn-secondary btn-block" aria-expanded={openId === t.id} onClick={() => (openId === t.id ? setOpenId(null) : show(t.id))}>
                  {t.subject} · {STATUS_LABELS[t.status]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {current && (
        <div aria-label="Conversation" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
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
