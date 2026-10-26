import { dollars } from '../lib/cost';
import { dateToIso } from '../lib/date';
import { useState } from 'react';
import { cloudConfigured } from '../lib/cloud';
import { useDeviceLibrary } from '../lib/device-library';
import { FAMILY_LABELS } from '../lib/family';
import { SEEN_PREFIX, endedShares, readSeen, readShares, type ShareFrom } from '../lib/familyshare';
import { recipientLine } from '../lib/sharing';
import { useNow, useStore } from '../state/store';
import { SectionLabel } from './ui';
import { GuardianCalendarProjection } from './GuardianProjection';

const NOBODY: Record<string, string> = {};

/**
 * The supporter's page: what students have shared with this account, read
 * only (D-037 slice 3).
 *
 * Nothing is fetched until the person asks, because every fetch is a read the
 * student sees in their log — opening the Family screen for some other reason
 * should not show up there as "your parent looked". What comes back is the
 * copy each student confirmed, exactly; nothing is summarised, counted across
 * categories or dated by activity (design §7).
 */
export function SharedWithYou({ today: suppliedToday }: { today?: string }) {
  const currentTime = useNow();
  const today = suppliedToday ?? dateToIso(currentTime);
  const { account } = useStore();
  const seen = useDeviceLibrary(`${SEEN_PREFIX}:${account?.id || 'device'}`, readSeen, NOBODY);
  const [shares, setShares] = useState<ShareFrom[] | null>(null);
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cloudConfigured || !account) return null;

  const open = async () => {
    setBusy(true);
    setSaid('');
    try {
      const live = await readShares();
      setShares(live);
      if (live.length) seen.update((old) => ({ ...old, ...Object.fromEntries(live.map((s) => [s.studentId, s.shownAs])) }));
    } catch (e) {
      setSaid(`That could not be opened: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const ended = shares ? endedShares(seen.value, shares) : [];

  return (
    <section aria-labelledby="shared-with-you-title" className="family-invite">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="shared-with-you-title">Shared with you</span>
      </SectionLabel>
      <p className="sharing-lead">
        What a student has chosen to show you, read only. Each time you open it, they can see that you did.
      </p>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void open()}>
        {shares ? 'Open it again' : 'Open what is shared with me'}
      </button>
      {said && <p role="alert" className="sharing-lead">{said}</p>}

      {shares && shares.length === 0 && ended.length === 0 && <p className="sharing-lead">Nothing is shared with you right now.</p>}

      {shares?.map((s) => (
        <article key={s.studentId} className="shared-from" aria-labelledby={`from-${s.studentId}`}>
          <h3 id={`from-${s.studentId}`}>From {s.shownAs}</h3>
          <p className="sharing-meta">{recipientLine({ acceptedAt: 'accepted', revokedAt: null, ends: s.ends }, today)}</p>
          <ul className="sharing-list">
            {s.items.map((i) => (
              <li key={i.id}>
                <strong>{i.title}</strong>
                <div className="sharing-meta">
                  {FAMILY_LABELS[i.category] ?? i.category}
                  {i.due ? ` · due ${i.due}` : ''}
                  {i.kind === 'budget' && i.amount > 0 ? ` · ${dollars(i.amount)}` : ''}
                  {i.kind === 'checklist' ? (i.done ? ' · done' : ' · not done yet') : ''}
                </div>
                {i.body && <p className="shared-body">{i.body}</p>}
              </li>
            ))}
          </ul>
          <GuardianCalendarProjection actorId={account.id} studentId={s.studentId} shownAs={s.shownAs} />
        </article>
      ))}

      {ended.map((e) => (
        <article key={e.studentId} className="shared-from">
          <h3>From {e.shownAs}</h3>
          {/* D3: revoked and expired read the same, word for word. */}
          <p className="sharing-meta">{recipientLine({ acceptedAt: null, revokedAt: 'ended', ends: '' }, today)}</p>
        </article>
      ))}
    </section>
  );
}
