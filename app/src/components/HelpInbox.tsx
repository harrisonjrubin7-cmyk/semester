import { useCallback, useEffect, useState } from 'react';
import type { Account } from '../lib/cloud';
import {
  CONTEXT_KEYS,
  CONTEXT_TEXT,
  INBOX_FILTERS,
  INBOX_FILTER_TEXT,
  REPLY_MAX,
  STAFF_MOVES,
  STATUS_TEXT,
  answerRequest,
  inFilter,
  loadInboxes,
  openRequest,
  replyAfter,
  type InboxFilter,
  type OpenedRequest,
  type RequestStatus,
  type StaffInbox,
} from '../lib/help-routes';
import { ActionButton, ChipRow, Notice, SectionLabel } from './ui';
import { dateFormatter } from '../lib/locale';

const when = (value: string) =>
  dateFormatter({ dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

/** What an office's list says when this filter leaves nothing in it. */
const EMPTY_TEXT: Record<InboxFilter, string> = {
  new: 'Nothing new.',
  open: 'Nothing waiting.',
  closed: 'Nothing closed yet.',
  all: 'No requests yet.',
};

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
 * opened. The opened request names the student and their confirmed email,
 * because their confirm screen listed both as always sent (`IDENTITY_SENT`);
 * the list before it names nobody. The reply goes back through the app, where
 * the student reads it beside their question.
 */
export function HelpInbox({
  account,
  onInboxes,
}: {
  account: Account | null;
  /** Told each time the inboxes load, so the Get help tab's count follows moves made here. */
  onInboxes?: (inboxes: StaffInbox[]) => void;
}) {
  const [inboxes, setInboxes] = useState<StaffInbox[]>([]);
  const [opened, setOpened] = useState<Record<string, OpenedRequest>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  /*
   * Requests moved while this filter is showing. They stay on screen, with
   * their new status and reply, until the filter changes, so closing one
   * under "Open" does not make the card and its reply vanish mid-task.
   */
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState<InboxFilter>('open');

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const next = await loadInboxes();
      setInboxes(next);
      onInboxes?.(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your inboxes.');
    }
  }, [account, onInboxes]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  if (!account || inboxes.length === 0) return null;

  const counts = Object.fromEntries(
    INBOX_FILTERS.map((f) => [
      f,
      inboxes.reduce((n, box) => n + box.items.filter((it) => inFilter(it.status, f)).length, 0),
    ]),
  ) as Record<InboxFilter, number>;
  const labels = Object.fromEntries(
    INBOX_FILTERS.map((f) => [f, `${INBOX_FILTER_TEXT[f]} (${counts[f]})`]),
  );

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
          Each request holds the student's name and university email, and otherwise only what they
          wrote and chose to include. Opening one is recorded, and the student sees that it was opened.
          Replies go back to them here.
        </p>
      </div>

      <div role="group" aria-label="Show requests">
        <ChipRow
          options={INBOX_FILTERS}
          value={filter}
          labels={labels}
          onChange={(f) => {
            // The chip already chosen reports a change too; only a new filter lets go of kept cards.
            if (f === filter) return;
            setFilter(f);
            setKept(new Set());
          }}
        />
      </div>

      {notice && <Notice alert>{notice}</Notice>}

      {inboxes.map(({ destination, items }) => {
        const shown = items.filter((it) => inFilter(it.status, filter) || kept.has(it.id));
        return (
        <div key={destination.id} style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <SectionLabel aside={`${shown.length}`}>{destination.name}</SectionLabel>
          {shown.length === 0 && <p style={{ color: 'var(--app-dim)', margin: 0 }}>{EMPTY_TEXT[filter]}</p>}
          {shown.map((item) => {
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
                        <dt style={{ fontWeight: 600 }}>From</dt>
                        <dd style={{ margin: 0 }}>
                          {open.studentName || 'A student'}
                          {open.studentEmail && (
                            <> · <a href={`mailto:${open.studentEmail}`}>{open.studentEmail}</a></>
                          )}
                        </dd>
                      </div>
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

                    {open.reply && (
                      <div className="portal-panel" style={{ margin: 0 }}>
                        <strong style={{ display: 'block', marginBottom: 'var(--sp-1)' }}>Your office's reply</strong>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} data-reply>{open.reply}</p>
                      </div>
                    )}

                    {moves.length > 0 && (
                      <>
                        <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
                          {open.reply ? 'Replace your reply (optional)' : 'Reply to the student (optional)'}
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
                                const sent = replies[item.id] ?? '';
                                setOpened((o) => ({ ...o, [item.id]: { ...open, status: to, reply: replyAfter(open.reply, sent) } }));
                                setReplies((r) => ({ ...r, [item.id]: '' }));
                                // The move is saved: say so to the tab's count now, so a
                                // reload that fails after it cannot leave the count behind.
                                const moved = inboxes.map((box) => ({
                                  ...box,
                                  items: box.items.map((it) => (it.id === item.id ? { ...it, status: to } : it)),
                                }));
                                setInboxes(moved);
                                onInboxes?.(moved);
                                setKept((k) => new Set(k).add(item.id));
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
        );
      })}
    </section>
  );
}
