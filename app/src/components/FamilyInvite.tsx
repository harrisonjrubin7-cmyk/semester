import { dateToIso } from '../lib/date';
import { useEffect, useState } from 'react';
import { cloudConfigured } from '../lib/cloud';
import type { FamilyItem, FamilyMember } from '../lib/family';
import {
  claimInvite,
  inviteRequest,
  inviteState,
  listInvites,
  normaliseCode,
  revokeInvite,
  sayClaim,
  type InviteRow,
} from '../lib/familyinvites';
import { localMinute, makeShare, readLog, readsOf, stopSharing, type ReadEvent } from '../lib/familyshare';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';

/**
 * Turning a finished plan into a share code, on the Preview tab — under the
 * exact recipient view, so the confirmation is given looking at what will be
 * shared. See `lib/familyinvites.ts` and docs/CONSENT-SHARING-DESIGN.md §6.
 */
export function FamilyInvite({ member, items, today = dateToIso(new Date()) }: { member: FamilyMember; items: FamilyItem[]; today?: string }) {
  const { account } = useStore();
  const [step, setStep] = useState<'idle' | 'confirm' | 'made'>('idle');
  const [code, setCode] = useState('');
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<InviteRow[]>([]);
  const [log, setLog] = useState<ReadEvent[]>([]);
  const [shownAs, setShownAs] = useState('');
  const [stopping, setStopping] = useState(false);
  const signedIn = cloudConfigured && !!account;

  const refresh = () => {
    if (!signedIn) return;
    void listInvites().then(setCodes, () => setCodes([]));
    void readLog().then(setLog, () => setLog([]));
  };
  // Re-listed whenever the account changes; the list is the student's own codes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [signedIn]);

  const req = inviteRequest(member, items, today);
  const name = member.name || 'this person';
  const chosen = 'problems' in req ? [] : items.filter((i) => req.resources.includes(i.id));
  // Every item planned for this person, shared or not: stopping has to reach
  // an item that was shared before and has since been taken off the plan.
  const theirs = items.filter((i) => i.memberId === member.id).map((i) => i.id);
  const reads = readsOf(log, theirs);
  const shared = codes.some((c) => c.claimedAt && c.resourceIds.some((id) => theirs.includes(id)));

  return (
    <section aria-labelledby="family-invite-title" className="family-invite">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="family-invite-title">Share it with {name}</span>
      </SectionLabel>
      {!signedIn ? (
        <p className="sharing-lead">Sharing with a real person needs you signed in. Until then this stays a plan on this device.</p>
      ) : 'problems' in req ? (
        <>
          <p className="sharing-lead">Not yet. Before this plan can be shared:</p>
          <ul className="sharing-problems">
            {req.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      ) : step === 'made' ? (
        <div role="status">
          <p className="family-code" aria-label={`Code ${code.split('').join(' ')}`}>
            {code}
          </p>
          <p className="sharing-lead">
            Hand this to {name} yourself — say it, text it or write it down. Semester sends nothing. It works once, for
            seven days, and you can call it off below until it is used.
          </p>
        </div>
      ) : step === 'confirm' ? (
        <div className="family-confirm">
          <p>
            Share <strong>{req.resources.length} {req.resources.length === 1 ? 'item' : 'items'}</strong> with{' '}
            <strong>{name}</strong> until <strong>{member.expires}</strong>?
          </p>
          <ul className="sharing-list" aria-label="What they will see">
            {chosen.map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
          <ul className="sharing-problems">
            <li>They see a copy of these items as they are now. A later change reaches them only if you share again.</li>
            <li>You see every time they open it, and you can stop it at any time.</li>
            <li>Anything shared can be copied by the person who sees it.</li>
          </ul>
          <label className="family-claim">
            <span className="sharing-meta">Your name, as {name} will see it</span>
            <input className="input" value={shownAs} maxLength={80} autoComplete="given-name" onChange={(e) => setShownAs(e.target.value)} />
          </label>
          <div className="portal-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !shownAs.trim()}
              onClick={async () => {
                setBusy(true);
                setSaid('');
                try {
                  const made = await makeShare(req, items, shownAs);
                  setCode(made);
                  setStep('made');
                  refresh();
                } catch (e) {
                  setSaid(`The code was not made: ${(e as Error).message}`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create the code
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep('idle')}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setStep('confirm')}>
          Create a share code for {name}
        </button>
      )}
      {said && <p role="alert" className="sharing-lead">{said}</p>}

      {signedIn && (shared || reads.length > 0) && (
        <>
          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>When they opened it</SectionLabel>
          {reads.length === 0 ? (
            <p className="sharing-lead">Not opened yet.</p>
          ) : (
            <ul className="sharing-list" aria-label={`Times ${name} opened what you shared`}>
              {reads.slice(0, 20).map((e) => (
                <li key={e.readAt}>
                  {localMinute(e.readAt)} · {e.itemIds.length} {e.itemIds.length === 1 ? 'item' : 'items'}
                </li>
              ))}
            </ul>
          )}
          {stopping ? (
            <div className="family-confirm">
              <p>
                Stop sharing with <strong>{name}</strong>? From their next look they see only “This share has ended.”, the
                same words as when a share runs out. The copies are removed.
              </p>
              <div className="portal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await stopSharing(theirs);
                      setSaid(`Stopped. ${name} can no longer see what you shared.`);
                      setStopping(false);
                      refresh();
                    } catch (e) {
                      setSaid(`Sharing did not stop: ${(e as Error).message}`);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Stop sharing
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setStopping(false)}>
                  Keep sharing
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setStopping(true)}>
              Stop sharing with {name}
            </button>
          )}
        </>
      )}

      {codes.length > 0 && (
        <>
          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>Your codes</SectionLabel>
          <ul className="sharing-list">
            {codes.map((c) => (
              <li key={c.code}>
                <strong>{c.code}</strong>
                <div className="sharing-meta">
                  {inviteState(c)} · shares until {c.grantExpiresAt.slice(0, 10)}
                </div>
                {!c.revokedAt && !c.claimedAt && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void revokeInvite(c.code).then(refresh, (e: Error) => setSaid(`Could not call it off: ${e.message}`))}
                  >
                    Call off {c.code}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** For the person on the other end: enter the code a student handed you. */
export function ClaimFamilyCode() {
  const { account } = useStore();
  const [typed, setTyped] = useState('');
  const [said, setSaid] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cloudConfigured) return null;
  const code = normaliseCode(typed);
  return (
    <section aria-labelledby="family-claim-title" className="family-invite">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="family-claim-title">Were you given a code?</span>
      </SectionLabel>
      {!account ? (
        <p className="sharing-lead">Sign in first, then enter the eight characters a student gave you.</p>
      ) : (
        <>
          <label className="family-claim">
            <span className="sharing-meta">The eight characters</span>
            <input className="input" value={typed} maxLength={12} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!code || busy}
            onClick={async () => {
              setBusy(true);
              try {
                setSaid(sayClaim(await claimInvite(code)));
              } catch (e) {
                setSaid(`That did not go through: ${(e as Error).message}`);
              } finally {
                setBusy(false);
              }
            }}
          >
            Accept
          </button>
          {said && <p role="status" className="sharing-lead">{said}</p>}
        </>
      )}
    </section>
  );
}
