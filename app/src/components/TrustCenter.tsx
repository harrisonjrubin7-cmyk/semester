import { formatDate, formatDateTime } from '../lib/locale';
import { useEffect, useRef, useState } from 'react';
import type { ShareEvent, ShareRow, ShareState } from '../lib/advisor-shares';
import { myShares, revokeShare } from '../lib/advisor-shares';
import { record, yours } from '../lib/journal';
import { clearAll as clearConversations, load as loadThreads, loadArchive } from '../lib/threads';
import { useDeviceLibrary } from '../lib/device-library';
import { permission } from '../lib/notify';
import { EMPTY_REGISTRATION, readRegistration } from '../lib/portal-storage';
import { REGISTRATION_KEY } from '../lib/registration-plan';
import { SOURCE_LABELS, SOURCE_MEANING, SOURCE_TEXT } from '../lib/source';
import { EMPTY_LOCKER, LOCKER_KEY, readLocker } from '../lib/source-locker';
import { useNow, useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceBadge } from './SourceBadge';
import { ActionPreview } from './unity/ActionPreview';

const when = (at: number) => formatDateTime(new Date(at), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const dateFrom = (iso: string) => {
  const match = ISO_INSTANT.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const dayOfMonth = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > daysInMonth[month - 1]) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};
const day = (iso: string) => {
  const date = dateFrom(iso);
  return date ? formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
};
const time = (iso: string) => {
  const date = dateFrom(iso);
  return date ? formatDateTime(date, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date unavailable';
};

type DisplayShareState = ShareState | 'unavailable';

const displayShareState = (share: ShareRow, now: number): DisplayShareState => {
  if (share.revoked_at !== null) return dateFrom(share.revoked_at) ? 'revoked' : 'unavailable';
  const expires = dateFrom(share.expires_at);
  if (!expires) return 'unavailable';
  return expires.getTime() <= now ? 'expired' : 'active';
};

const SHARE_STATE_TEXT: Record<DisplayShareState, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
  unavailable: 'State unavailable',
};

function accessHistory(events: ShareEvent[]): string {
  if (events.length === 0) return 'No recorded advisor opens.';
  const valid = events.map((event) => dateFrom(event.read_at)).filter((date): date is Date => date !== null);
  if (valid.length !== events.length) {
    return `${events.length} recorded ${events.length === 1 ? 'open' : 'opens'}. Latest date unavailable.`;
  }
  const latest = valid.sort((a, b) => b.getTime() - a.getTime())[0];
  return `${events.length} recorded ${events.length === 1 ? 'open' : 'opens'}. Latest ${when(latest.getTime())}.`;
}

/** Conversations kept on this device (`lib/threads.ts`), counted; null when there are none. */
function conversationsOnDevice(): { threads: number; messages: number } | null {
  const live = loadThreads().threads.filter((t) => t.turns.length > 0);
  const all = [...live, ...loadArchive().filter((t) => t.turns.length > 0)];
  const messages = all.reduce((n, t) => n + t.turns.length, 0);
  return all.length ? { threads: all.length, messages } : null;
}

type Confirm = { kind: 'revoke'; share: ShareRow } | { kind: 'forget'; id: string; text: string } | { kind: 'conversation' };

const NOTIFY: Record<ReturnType<typeof permission>, string> = {
  granted: 'Allowed on this device.',
  denied: 'Blocked in this browser’s settings.',
  default: 'Not asked yet.',
  unsupported: 'This browser cannot show notifications.',
};

/**
 * The Trust & Data Center (`trust_center`, Phase N), at the top of Your data.
 *
 * One place that says what Semester holds and who can see it, with the
 * control beside each: connected sources and when they last synced; the five
 * source labels; imported materials and which of them AI may use; every loaded
 * advisor share, with its state and access history, and revocation for active
 * shares; what Semester remembers, each line forgettable; notifications;
 * export; and, below it on the same page, account deletion and erasing this
 * device.
 *
 * Nothing here is a new store of anything. It reads the stores that already
 * exist, and every change it makes — revoke, forget, delete — confirms first
 * and says exactly what goes.
 *
 * `accountId` overrides the store's account, for tests.
 */
export function TrustCenter({ accountId }: { accountId?: string | null } = {}) {
  const { state, dispatch, account, sync, school } = useStore();
  const userId = accountId !== undefined ? accountId : (account?.id ?? null);
  const now = useNow().getTime();
  const registration = useDeviceLibrary(REGISTRATION_KEY, readRegistration, EMPTY_REGISTRATION).value;
  const locker = useDeviceLibrary(LOCKER_KEY, readLocker, EMPTY_LOCKER).value;
  const [shares, setShares] = useState<ShareRow[] | null | 'error'>(null);
  const [shareEvents, setShareEvents] = useState<ShareEvent[]>([]);
  const [round, setRound] = useState(0);
  const [conversation, setConversation] = useState(() => conversationsOnDevice());
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [said, setSaid] = useState('');
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    myShares()
      .then((result) => {
        if (!live) return;
        setShares(result.shares);
        setShareEvents(result.events);
      })
      .catch(() => {
        if (!live) return;
        setShares('error');
        setShareEvents([]);
      });
    return () => {
      live = false;
    };
  }, [userId, round]);

  const lastSync = state.lastSync?.at ?? (sync.status === 'synced' ? sync.at : 0);
  const go = (screen: 'export' | 'notifs' | 'profile' | 'family') => dispatch({ type: 'go', screen });

  const confirmed = async () => {
    const c = confirm;
    if (!c || acting.current) return;
    acting.current = true;
    setBusy(true);
    setFailed('');
    if (c.kind !== 'revoke') setConfirm(null);
    try {
      if (c.kind === 'revoke') {
        await revokeShare(c.share.id);
        record(userId, { kind: 'share-revoked', detail: c.share.title, about: { type: 'share', id: c.share.id, label: c.share.title }, provenance: yours('Nobody', 'Revoked') });
        setConfirm(null);
        setSaid(`“${c.share.title}” is revoked. Your advisor can no longer open it.`);
        setRound((r) => r + 1);
      } else if (c.kind === 'forget') {
        dispatch({ type: 'setAboutMe', facts: state.aboutMe.filter((f) => f.id !== c.id) });
        setSaid('Forgotten. Semester no longer has that line.');
      } else {
        clearConversations();
        record(userId, { kind: 'ai-deleted', detail: 'every conversation on this device', provenance: yours('This device only', 'Done') });
        setConversation(null);
        setSaid('Your conversations with Semester are deleted from this device.');
      }
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="portal-panel trust-center" aria-label="Trust and data center">
      <p className="portal-eyebrow">Trust &amp; data</p>
      <h2 className="trust-title">What Semester holds, and who can see it</h2>
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {failed && confirm?.kind !== 'revoke' ? <p role="alert">{failed}</p> : null}

      <section className="trust-section" aria-label="Connected sources">
        <h3>Connected sources</h3>
        <ul className="trust-list">
          <li>
            <strong>Your account</strong> —{' '}
            {userId
              ? `signed in${account?.email ? ` as ${account.email}` : ''}. ${lastSync ? `Last synced ${when(lastSync)}.` : 'Not synced from this device yet.'}`
              : 'not signed in. Everything stays on this device.'}
          </li>
          <li>
            <strong>Your school</strong> — {school?.name ? school.name : 'not set'}.
          </li>
          <li>
            <strong>Course catalog</strong> —{' '}
            {registration.catalog ? (
              <>
                {registration.catalog.institution}, {registration.catalog.courses.length} sections.{' '}
                <SourceBadge label="imported" at={Date.parse(registration.catalog.importedAt)} now={now} />
              </>
            ) : (
              'none imported.'
            )}
          </li>
          <li>
            <strong>Courses</strong> — {state.courses.length} on this device, from syllabi you added.
          </li>
        </ul>
      </section>

      <section className="trust-section" aria-label="Source labels">
        <h3>What the labels mean</h3>
        <dl className="trust-labels">
          {SOURCE_LABELS.map((label) => (
            <div key={label}>
              <dt>
                <SourceBadge label={label} />
              </dt>
              <dd>{SOURCE_MEANING[label] || SOURCE_TEXT[label]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="trust-section" aria-label="Imported materials and AI">
        <h3>Imported materials and AI</h3>
        <p>
          {state.sources.length} source{state.sources.length === 1 ? '' : 's'} saved.{' '}
          {locker.aiBlocked.length
            ? `${locker.aiBlocked.length} material${locker.aiBlocked.length === 1 ? ' is' : 's are'} marked so AI never uses ${locker.aiBlocked.length === 1 ? 'it' : 'them'}.`
            : 'AI may use every material you added; you can stop it per material.'}{' '}
          Choose per material in each course’s Sources tab.
        </p>
      </section>

      <section className="trust-section" aria-label="Shares and access">
        <h3>Shares and access</h3>
        {!userId ? (
          <p>Nothing is shared: this device is not signed in.</p>
        ) : shares === null ? (
          <p role="status">Checking your shares…</p>
        ) : shares === 'error' ? (
          <p role="alert">Could not load your shares. Try again later.</p>
        ) : shares.length === 0 ? (
          <p>No advisor shares are available in this account view.</p>
        ) : (
          <>
            <p className="portal-muted">This list covers advisor shares only. Family and supporter access is managed separately.</p>
            <ul className="trust-list" aria-label="Advisor share history">
              {shares.map((share) => {
                const status = displayShareState(share, now);
                const events = shareEvents.filter((event) => event.share_id === share.id);
                return (
                  <li key={share.id}>
                    <details>
                      <summary><strong>{share.title}</strong> — {SHARE_STATE_TEXT[status]}</summary>
                      <p>Created {time(share.created_at)}.</p>
                      {status === 'active' ? <p>Expires {day(share.expires_at)}.</p> : null}
                      {status === 'expired' ? <p>Expired {day(share.expires_at)}.</p> : null}
                      {status === 'revoked' ? <p>Revoked {time(share.revoked_at!)}.</p> : null}
                      {status === 'unavailable' ? <p>The share state is unavailable because a required date could not be read.</p> : null}
                      <p>{accessHistory(events)}</p>
                      {status === 'active' ? (
                        <button type="button" className="balance-button" onClick={() => { setFailed(''); setConfirm({ kind: 'revoke', share }); }}>
                          Revoke…
                        </button>
                      ) : null}
                    </details>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p>
          Supporter access is further down this page.{' '}
          <button type="button" className="workspace-text-button" onClick={() => go('family')}>
            Family and supporters
          </button>
        </p>
      </section>

      <section className="trust-section" aria-label="What Semester remembers">
        <h3>What Semester remembers</h3>
        {state.aboutMe.length ? (
          <ul className="trust-list">
            {state.aboutMe.map((f) => (
              <li key={f.id}>
                “{f.text}”{' '}
                <button type="button" className="balance-button" onClick={() => setConfirm({ kind: 'forget', id: f.id, text: f.text })}>
                  Forget…
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing you have told it about yourself.</p>
        )}
        <p>
          {conversation
            ? `Your conversations with Semester: ${conversation.threads} conversation${conversation.threads === 1 ? '' : 's'}, ${conversation.messages} message${conversation.messages === 1 ? '' : 's'}, saved on this device.`
            : 'No conversation with Semester is saved on this device.'}{' '}
          {conversation ? (
            <button type="button" className="balance-button" onClick={() => setConfirm({ kind: 'conversation' })}>
              Delete it…
            </button>
          ) : null}
        </p>
        <p className="portal-muted">
          Only what you typed is remembered; Semester infers nothing about you.{' '}
          <button type="button" className="workspace-text-button" onClick={() => go('profile')}>
            Add or edit in Profile
          </button>
        </p>
      </section>

      <section className="trust-section" aria-label="Notifications">
        <h3>Notifications</h3>
        <p>
          {NOTIFY[permission()]}{' '}
          <button type="button" className="workspace-text-button" onClick={() => go('notifs')}>
            Choose which reminders
          </button>
        </p>
      </section>

      <section className="trust-section" aria-label="Your data">
        <h3>Take it with you, or remove it</h3>
        <p>
          <button type="button" className="balance-button" onClick={() => go('export')}>
            Export my data
          </button>{' '}
          The export now includes every plan kept on this device — registration day, graduation scenarios, advisor meetings,
          study readiness, Source Locker choices and career evidence.
        </p>
        <p className="portal-muted">Delete my account and Erase from this device are further down this page, each with its own confirmation.</p>
      </section>

      {confirm?.kind === 'revoke' ? (
        <ConfirmDialog
          title="Revoke this share?"
          preview={
            <>
              <ActionPreview
                subject={confirm.share.title}
                says="Your advisor loses access to this shared meeting immediately."
                doesNotChange="The share and its access log stay in your account. Your meeting preparation, other shares and official advising records stay unchanged."
                recovery={{ kind: 'none', how: 'You can make a new share later.' }}
              />
              {failed ? <p role="alert">{failed} You can try again or cancel.</p> : null}
            </>
          }
          confirmLabel={busy ? 'Revoking…' : 'Revoke'}
          onConfirm={() => void confirmed()}
          onCancel={() => {
            if (!acting.current) {
              setFailed('');
              setConfirm(null);
            }
          }}
        />
      ) : null}
      {confirm?.kind === 'forget' ? (
        <ConfirmDialog
          title="Forget this remembered line?"
          preview={
            <ActionPreview
              subject={`“${confirm.text}”`}
              says="Semester stops using this line straight away on this device and, once it syncs, on your account."
              doesNotChange="Your other remembered lines, conversations, notes and plans stay unchanged."
              recovery={{ kind: 'none', how: 'You can add the line again if you still know it. A data export downloaded before deletion still contains its earlier copy.' }}
            />
          }
          confirmLabel="Forget"
          onConfirm={() => void confirmed()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === 'conversation' ? (
        <ConfirmDialog
          title="Delete your conversations with Semester?"
          preview={
            <ActionPreview
              subject={conversation ? `${conversation.threads} conversation${conversation.threads === 1 ? '' : 's'} · ${conversation.messages} message${conversation.messages === 1 ? '' : 's'}` : undefined}
              says="Every conversation saved on this device is deleted, archived ones included."
              doesNotChange="What you told Semester about yourself, your notes and your plans stay."
              recovery={{ kind: 'none' }}
            />
          }
          confirmLabel="Delete"
          onConfirm={() => void confirmed()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}
