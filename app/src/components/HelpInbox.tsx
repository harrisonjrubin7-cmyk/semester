import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../lib/cloud';
import {
  CONTEXT_KEYS,
  CONTEXT_TEXT,
  REPLY_MAX,
  STAFF_MOVES,
  STATUS_TEXT,
  answerRequest,
  loadInboxes,
  openRequest,
  type OpenedRequest,
  type RequestStatus,
  type StaffInbox,
} from '../lib/help-routes';
import { ActionButton, Notice, SectionLabel } from './ui';

const when = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

/** What each staff move is called on its button. */
const MOVE_TEXT: Record<RequestStatus, string> = {
  sent: 'Sent',
  acknowledged: 'Mark as seen',
  scheduled: 'Mark as scheduled',
  closed: 'Close',
  withdrawn: 'Withdrawn',
};

/**
 * The staff half of `lib/help-routes.ts`: the inboxes this account answers for.
 *
 * Draws nothing for an account that answers for no office, so it can sit
 * under the student's own route without a role check of its own — the
 * database decides, through `my_help_destinations`.
 *
 * ## What staff see, and what they do not
 *
 * The list is statuses and times. A request's words appear only after
 * **Open**, and the button says beforehand that the student will see it was
 * opened. There is no name on a request: the student's confirm screen listed
 * exactly what would be sent, and who they are was not on it. The reply goes
 * back through the app, where the student reads it beside their question.
 */
export function HelpInbox({ account }: { account: Account | null }) {
  const [inboxes, setInboxes] = useState<StaffInbox[]>([]);
  const [opened, setOpened] = useState<Record<string, OpenedRequest>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      setInboxes(await loadInboxes());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your inboxes.');
    }
  }, [account]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  if (!account || inboxes.length === 0) return null;

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    void work()
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Something went wrong.'))
      .finally(() => setBusy(false));
  };

  return (
    <section aria-labelledby="help-inbox-heading" style={{ display: 'grid', gap: 'var(--sp-5)', marginTop: 'var(--sp-7)' }}>
      <div>
        <SectionLabel>Your offices</SectionLabel>
        <h2 id="help-inbox-heading" style={{ fontSize: 'var(--type-xl)', marginBlock: 'var(--sp-3)' }}>
          Help requests sent to you
        </h2>
        <p style={{ color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed-plus)' }}>
          Each request holds only what the student wrote and chose to include. Opening one is recorded,
          and the student sees that it was opened. Replies go back to them here.
        </p>
      </div>

      {notice && <Notice alert>{notice}</Notice>}

      {inboxes.map(({ destination, items }) => (
        <div key={destination.id} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <SectionLabel aside={`${items.length}`}>{destination.name}</SectionLabel>
          {items.length === 0 && <p style={{ color: 'var(--app-dim)', margin: 0 }}>Nothing waiting.</p>}
          {items.map((item) => {
            const open = opened[item.id];
            const status = open?.status ?? item.status;
            const moves = STAFF_MOVES[status];
            return (
              <article key={item.id} className="portal-panel" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
                <strong>{STATUS_TEXT[status]} · {when(item.createdAt)}</strong>

                {!open ? (
                  <ActionButton
                    disabled={busy}
                    onClick={() => run(async () => {
                      const got = await openRequest(item.id);
                      setOpened((o) => ({ ...o, [item.id]: got }));
                    })}
                  >
                    Open (the student will see this)
                  </ActionButton>
                ) : (
                  <>
                    <dl style={{ display: 'grid', gap: 'var(--sp-2)', margin: 0 }}>
                      <div>
                        <dt style={{ fontWeight: 600 }}>Question</dt>
                        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{open.question}</dd>
                      </div>
                      {CONTEXT_KEYS.filter((k) => open.context[k]).map((k) => (
                        <div key={k}>
                          <dt style={{ fontWeight: 600 }}>{CONTEXT_TEXT[k]}</dt>
                          <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{open.context[k]}</dd>
                        </div>
                      ))}
                    </dl>

                    {moves.length > 0 && (
                      <>
                        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                          Reply to the student (optional)
                          <textarea
                            className="input"
                            maxLength={REPLY_MAX}
                            value={replies[item.id] ?? ''}
                            onChange={(e) => setReplies((r) => ({ ...r, [item.id]: e.target.value }))}
                          />
                        </label>
                        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                          {moves.map((to) => (
                            <ActionButton
                              key={to}
                              tone={to === 'scheduled' ? 'primary' : 'secondary'}
                              disabled={busy}
                              onClick={() => run(async () => {
                                await answerRequest(item.id, status, to, replies[item.id] ?? '');
                                setOpened((o) => ({ ...o, [item.id]: { ...open, status: to } }));
                                setReplies((r) => ({ ...r, [item.id]: '' }));
                                await refresh();
                              })}
                            >
                              {MOVE_TEXT[to]}
                            </ActionButton>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
}
