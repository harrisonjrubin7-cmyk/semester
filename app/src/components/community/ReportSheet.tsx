import { useState } from 'react';
import { CRISIS_NOTICE } from '../../community/crisis';
import type { ReportCategory } from '../../community/moderation';
import { ActionButton, Notice } from '../ui';
import { Trouble } from '../Trouble';

/** Plain words for each category, in the order a reporter is most likely to need them. */
export const CATEGORY_TEXT: [ReportCategory, string][] = [
  ['private_information_or_doxxing', 'Shares someone’s private information'],
  ['harassment_or_bullying', 'Harassment or bullying'],
  ['threat_or_safety_concern', 'A threat, or a safety concern'],
  ['hate_or_discrimination', 'Hate or discrimination'],
  ['nonconsensual_media', 'An intimate or private image shared without consent'],
  ['impersonation', 'Pretending to be someone else'],
  ['spam_scam_or_phishing', 'Spam, a scam or a phishing link'],
  ['academic_integrity', 'Shares answers the course doesn’t allow'],
  ['other', 'Something else'],
];

/**
 * The report form. The emergency notice comes first, before any choice,
 * because the person most in need of it is the one least likely to read to
 * the bottom of a form.
 */
export function ReportSheet({
  onSend,
  onCancel,
}: {
  onSend: (category: ReportCategory, imminent: boolean, details: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [imminent, setImminent] = useState(false);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <form
      aria-label="Report this post"
      className="portal-panel"
      style={{ display: 'grid', gap: 'var(--sp-4)', marginBlock: 'var(--sp-4)' }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!category) return;
        setBusy(true);
        setError('');
        void onSend(category, imminent, details.trim())
          .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not send the report.'))
          .finally(() => setBusy(false));
      }}
    >
      <Notice alert>{CRISIS_NOTICE}</Notice>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--sp-2)' }}>
        <legend style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>What is wrong with this post?</legend>
        {CATEGORY_TEXT.map(([value, text]) => (
          <label key={value} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', minHeight: 44 }}>
            <input
              type="radio"
              name="report-category"
              value={value}
              checked={category === value}
              onChange={() => setCategory(value)}
            />
            {text}
          </label>
        ))}
      </fieldset>
      <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', minHeight: 44 }}>
        <input type="checkbox" checked={imminent} onChange={(e) => setImminent(e.target.checked)} />
        Someone could be hurt soon
      </label>
      <label style={{ display: 'grid', gap: 'var(--sp-2)' }}>
        Anything a reviewer should know (optional)
        <textarea className="input" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </label>
      <p style={{ color: 'var(--app-dim)', margin: 0 }}>
        The person you report is never told who reported them. A trained reviewer decides what happens — a report on
        its own never removes anything.
      </p>
      {error && <Trouble said={error} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <button className="btn btn-primary" disabled={busy || !category}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
        <ActionButton onClick={onCancel}>
          Cancel
        </ActionButton>
      </div>
    </form>
  );
}
