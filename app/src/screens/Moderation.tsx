import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, Notice, SectionLabel } from '../components/ui';
import { CATEGORY_TEXT } from '../components/community/ReportSheet';
import { cloudConfigured } from '../lib/cloud';
import { COMMUNITY_FLAGS, enabled } from '../community/flags';
import { CRISIS_NOTICE } from '../community/crisis';
import type { DecisionAction } from '../community/moderation';
import { decideAppeal, decideCase, lastSweep, loadQueue, reviewerStanding, type CaseRow, type Standing } from '../community/client';

const CATEGORY = Object.fromEntries(CATEGORY_TEXT);

const SEVERITY_TEXT: Record<CaseRow['severity'], string> = {
  P0: 'P0 · urgent',
  P1: 'P1 · serious',
  P2: 'P2 · standard',
  P3: 'P3 · minor',
};

const PROTECTION_TEXT: Record<CaseRow['protection'], string> = {
  queue: 'In the queue — nothing applied',
  monitor: 'Being monitored',
  reduce_distribution: 'Shown to fewer people pending review',
  temporary_hold: 'Hidden pending review',
};

const DETECTOR_TEXT: Record<string, string> = {
  pii_doxxing: 'Private information',
  threat_crisis_language: 'Threat or crisis language',
  hate_slur_risk: 'Hate or slur risk',
  scam_phishing_link: 'Scam or phishing',
  media_safety: 'Media safety',
  bot_rate_brigading: 'Posting burst or coordinated reports',
  academic_integrity: 'Academic integrity',
  impersonation: 'Impersonation',
};

const ROUTE_TEXT: Record<CaseRow['route'], string> = {
  professional_urgent: 'urgent professional review',
  professional: 'professional review',
  standard: 'standard queue',
  integrity_review: 'integrity review — reports may be coordinated',
};

const ACTIONS: [DecisionAction, string][] = [
  ['allow', 'Allow — restore and close'],
  ['label', 'Add a label'],
  ['reduce_distribution', 'Reduce distribution'],
  ['remove', 'Remove the post'],
  ['rate_limit', 'Rate limit the author (1 day)'],
  ['community_restriction', 'Pause the author in this community (14 days)'],
  ['account_restriction', 'Pause the author in all of Community (30 days)'],
  ['preserve_evidence', 'Preserve evidence and restore'],
  ['close_no_action', 'Close with no action'],
];

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/**
 * The professional Trust & Safety console.
 *
 * Most severe first, then oldest. It shows the post, the category and details
 * of each report, and what triage already did — and never who reported. Every
 * decision needs a policy reason code; the database refuses a P0 account
 * restriction without a senior reviewer, and an appeal to anybody who decided
 * the case.
 */
export function Moderation() {
  const { account } = useStore();
  if (!enabled(COMMUNITY_FLAGS, 'moderationConsole')) {
    return (
      <Page blurb="The Trust & Safety review queue for Community.">
        <Notice>The moderation console isn’t switched on in this build.</Notice>
      </Page>
    );
  }
  if (!cloudConfigured || !account) {
    return (
      <Page blurb="The Trust & Safety review queue for Community.">
        <Notice>Sign in with a Trust & Safety account to review cases.</Notice>
      </Page>
    );
  }
  return <Console />;
}

function Console() {
  const [standing, setStanding] = useState<Standing | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [status, setStatus] = useState('');
  const [sweep, setSweep] = useState<{ ranAt: string; removed: number } | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const who = await reviewerStanding();
      setStanding(who);
      if (who !== 'none') {
        setCases(await loadQueue());
        setSweep(await lastSweep());
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not load the queue.');
    }
  }, []);

  // An account-backed resource, not render-derived state.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  if (standing === 'none') {
    return (
      <Page blurb="The Trust & Safety review queue for Community.">
        <Notice>This account doesn’t hold a Trust & Safety reviewer role, so there is no queue to show.</Notice>
      </Page>
    );
  }

  const open = cases.filter((c) => c.status === 'open');
  const appeals = cases.filter((c) => c.status === 'appealed');

  return (
    <Page blurb="Most severe first, then oldest. Reporters are never shown. Automation only queued, held or reduced these — every decision is yours.">
      <Notice>{CRISIS_NOTICE}</Notice>
      {status && <p role="status">{status}</p>}
      {sweep !== undefined && (
        <p style={{ color: 'var(--app-dim)' }}>
          {sweep
            ? `Evidence retention last ran ${when(sweep.ranAt)} and removed ${sweep.removed} record${sweep.removed === 1 ? '' : 's'}.`
            : 'The evidence retention sweep has not run yet.'}
        </p>
      )}
      <SectionLabel aside={`${open.length}`}>Open cases</SectionLabel>
      {open.length === 0 && <p style={{ color: 'var(--app-dim)' }}>The queue is empty.</p>}
      {open.map((c) => (
        <CaseCard key={c.id} kase={c} senior={standing === 'senior'} onDone={refresh} onStatus={setStatus} />
      ))}
      <SectionLabel aside={`${appeals.length}`} style={{ marginTop: 'var(--sp-7)' }}>
        Appeals
      </SectionLabel>
      {appeals.length === 0 && <p style={{ color: 'var(--app-dim)' }}>No appeals are waiting.</p>}
      {appeals.map((c) => (
        <CaseCard key={c.id} kase={c} senior={standing === 'senior'} onDone={refresh} onStatus={setStatus} />
      ))}
    </Page>
  );
}

function CaseCard({
  kase,
  senior,
  onDone,
  onStatus,
}: {
  kase: CaseRow;
  senior: boolean;
  onDone: () => Promise<void>;
  onStatus: (s: string) => void;
}) {
  const [action, setAction] = useState<DecisionAction>('allow');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const appealed = kase.status === 'appealed';
  const choices = ACTIONS.filter(([a]) => !(a === 'account_restriction' && kase.severity === 'P0' && !senior));

  const finish = (work: Promise<void>, done: string) => {
    setBusy(true);
    void work
      .then(async () => {
        onStatus(done);
        await onDone();
      })
      .catch((e: unknown) => onStatus(e instanceof Error ? e.message : 'The decision was not recorded.'))
      .finally(() => setBusy(false));
  };

  return (
    <article className="portal-panel" aria-label={`Case ${SEVERITY_TEXT[kase.severity]}`} style={{ display: 'grid', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
      <strong>
        {SEVERITY_TEXT[kase.severity]} · {CATEGORY[kase.category] ?? kase.category}
      </strong>
      <span style={{ color: 'var(--app-dim)' }}>
        Opened {when(kase.createdAt)} · {PROTECTION_TEXT[kase.protection]} · {ROUTE_TEXT[kase.route]}
        {kase.post ? ` · in ${kase.post.communityName}` : ''}
      </span>
      {kase.post ? (
        <blockquote style={{ margin: 0, paddingInlineStart: 'var(--sp-4)', borderInlineStart: '3px solid var(--app-line)' }}>
          <p style={{ margin: 0 }}>
            <strong>{kase.post.authorName}</strong>
          </p>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{kase.post.body}</p>
        </blockquote>
      ) : (
        <p>The post is no longer available.</p>
      )}
      {kase.signals.length > 0 && (
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>Automated signals — triage only, never a decision</p>
          <ul style={{ margin: 0 }}>
            {kase.signals.map((sig, i) => (
              <li key={i}>
                {DETECTOR_TEXT[sig.detector] ?? sig.detector} · rule {sig.ruleId} · confidence {Math.round(sig.confidence * 100)}% ·{' '}
                {sig.version}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary>
          {kase.reports.length} report{kase.reports.length === 1 ? '' : 's'}
        </summary>
        <ul>
          {kase.reports.map((r, i) => (
            <li key={i}>
              {CATEGORY[r.category] ?? r.category}
              {r.imminent ? ' · marked urgent' : ''} · {when(r.createdAt)}
              {r.details ? ` — “${r.details}”` : ''}
            </li>
          ))}
        </ul>
      </details>

      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Policy reason code
        <input className="input" required minLength={2} maxLength={80} placeholder="e.g. privacy.dox" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>

      {appealed ? (
        <>
          <p style={{ margin: 0 }}>
            The author appealed. If you took part in the original decision, the server will refuse yours — an appeal
            goes to somebody else.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            <ActionButton disabled={busy || reason.trim().length < 2} onClick={() => finish(decideAppeal(kase.id, false, reason.trim()), 'Appeal granted; the decision was reversed.')}>
              Grant appeal and restore
            </ActionButton>
            <ActionButton disabled={busy || reason.trim().length < 2} onClick={() => finish(decideAppeal(kase.id, true, reason.trim()), 'Appeal upheld.')}>
              Uphold the decision
            </ActionButton>
          </div>
        </>
      ) : (
        <>
          <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            Decision
            <select className="input" value={action} onChange={(e) => setAction(e.target.value as DecisionAction)}>
              {choices.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          {kase.severity === 'P0' && !senior && (
            <p style={{ margin: 0, color: 'var(--app-dim)' }}>A P0 account-wide pause needs a senior reviewer.</p>
          )}
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || reason.trim().length < 2}
              onClick={() => finish(decideCase(kase.id, action, reason.trim()), 'Decision recorded.')}
            >
              Record decision
            </button>
          </div>
        </>
      )}
    </article>
  );
}
