import { useCallback, useEffect, useState } from 'react';
import { Notice, SectionLabel } from './ui';
import type { Account } from '../lib/cloud';
import {
  MOVES,
  NO_ACCESS,
  STATUS_LABEL,
  ACTIVE_LIMIT,
  CLOSED_LIMIT,
  counts,
  loadQueue,
  moderationAccess,
  moveReport,
  ordered,
  type ModerationAccess,
  type QueuedReport,
  type ReportStatus,
} from '../lib/moderation';
import { formatDateTime } from '../lib/locale';

/**
 * The trust-and-safety queue, for whoever the database says may read it.
 *
 * Draws nothing at all for anybody else — not a locked panel, not a count —
 * because `my_moderation_access()` answered no and there is no queue for them.
 * A moderator with nothing waiting is told so, which is the case the access
 * check exists to tell apart from "no access". See `lib/moderation.ts` for why
 * no reporter or subject is shown.
 */
export function ReportQueue({ account }: { account: Account | null }) {
  const [access, setAccess] = useState<ModerationAccess>(NO_ACCESS);
  const [reports, setReports] = useState<QueuedReport[]>([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [limits, setLimits] = useState({ moreWaiting: false, closedCapped: false });

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const got = await moderationAccess();
      setAccess(got);
      if (got.canRead) {
        const q = await loadQueue();
        setReports(q.reports);
        setLimits({ moreWaiting: q.moreWaiting, closedCapped: q.closedCapped });
      }
    } catch (error) {
      // An error is not access: say nothing to a student whose call failed,
      // and tell a known moderator what went wrong.
      setNotice(error instanceof Error ? error.message : 'Could not load the report queue.');
    }
  }, [account]);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  if (!account || !access.canRead) return null;

  const move = (id: string, to: ReportStatus) => {
    setBusy(id);
    setNotice('');
    moveReport(id, to)
      .then(() => setReports((rs) => ordered(rs.map((r) => (r.id === id ? { ...r, status: to } : r)))))
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not move that report.'))
      .finally(() => setBusy(''));
  };

  const n = counts(reports);
  const shown = reports.filter((r) => showClosed || r.status === 'open' || r.status === 'under_review');

  return (
    <section className="jx-card" aria-labelledby="report-queue-heading">
      <SectionLabel>Trust and safety</SectionLabel>
      <h2 id="report-queue-heading" className="jx-card-title">
        Reported messages
      </h2>
      <p className="jx-muted">
        {n.open} open · {n.under_review} under review · {n.resolved + n.dismissed}{limits.closedCapped ? ` most recent` : ''} closed. Each shows the reason given and the
        message as it stood. Who reported it and who it is about are not shown here. Every status change is recorded.
        {access.canAct ? '' : ' You can read this queue but not move reports.'}
      </p>
      {limits.moreWaiting ? (
        <Notice alert>More than {ACTIVE_LIMIT} reports are waiting. The oldest {ACTIVE_LIMIT} are shown; close some and reload to see the rest.</Notice>
      ) : null}
      {notice ? <Notice alert>{notice}</Notice> : null}
      {!shown.length ? <p className="jx-muted">Nothing waiting.</p> : null}
      {shown.map((r) => (
        <article key={r.id} className="jx-entry">
          <div className="jx-entry-head">
            <span className={r.status === 'open' ? 'jx-tag jx-pri-required' : 'jx-tag'}>{STATUS_LABEL[r.status]}</span>
            <span className="jx-tag">{r.createdAt ? formatDateTime(r.createdAt) : 'undated'}</span>
            {r.messageGone ? <span className="jx-tag">Message since deleted</span> : null}
          </div>
          <div className="jx-entry-title">{r.reason}</div>
          <blockquote className="jx-privacy">{r.copy || 'No copy of the message was kept.'}</blockquote>
          {access.canAct ? (
            <div className="jx-actions">
              {MOVES[r.status].map((m) => (
                <button key={m.to} type="button" className="jx-go" disabled={busy === r.id} onClick={() => move(r.id, m.to)}>
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}
        </article>
      ))}
      <button type="button" className="jx-go" aria-pressed={showClosed} onClick={() => setShowClosed(!showClosed)}>
        {showClosed ? 'Hide closed reports' : limits.closedCapped ? `Show the latest ${CLOSED_LIMIT} closed reports` : `Show closed reports (${n.resolved + n.dismissed})`}
      </button>
    </section>
  );
}
