import { useEffect, useRef } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { EMPTY_LEDGER, LEDGER_PREFIX, afterSync, badge, readLedger, syncOnReconnect, useOnline } from '../lib/offline-mode';
import { useNow, useStore } from '../state/store';

/**
 * The offline badge (`offline_mode`, Phase M), under the header with the
 * save-trouble notice, because both are standing conditions rather than
 * events.
 *
 * It keeps the ledger — when this account last took this device's copy, and
 * since when it has not — and, when the connection comes back with changes
 * waiting, asks the store to `refresh()`: pull, merge by the per-field policy
 * in `lib/merge.ts`, push. Nothing else is queued, and nothing high-risk ever
 * is (`requireOnline`).
 *
 * `online`, `signedIn` and `syncNow` exist for tests; each defaults to the
 * real thing.
 */
export function OfflineBanner({
  online: forced,
  signedIn: forcedSignedIn,
  syncNow,
}: { online?: boolean; signedIn?: boolean; syncNow?: () => Promise<unknown> } = {}) {
  const { account, sync, refresh, pushNow } = useStore();
  const live = useOnline();
  const online = forced ?? live;
  const signedIn = forcedSignedIn ?? Boolean(account);
  const now = useNow().getTime();
  const ledger = useDeviceLibrary(`${LEDGER_PREFIX}:${account?.id || 'device'}`, readLedger, EMPTY_LEDGER);

  // Record each sync result. A failure while offline is the start of "not synced".
  const seen = useRef(`${sync.status}:${sync.at}`);
  useEffect(() => {
    const key = `${sync.status}:${sync.at}`;
    if (key === seen.current && sync.status !== 'error') return;
    seen.current = key;
    const next = afterSync(ledger.value, sync, Date.now());
    if (next.lastSyncedAt !== ledger.value.lastSyncedAt || next.unsyncedSince !== ledger.value.unsyncedSince) ledger.update(() => next);
  }, [sync, ledger]);

  // Going offline with an account means the next push will fail: mark it now,
  // so the badge says so without waiting for the attempt.
  useEffect(() => {
    if (!online && signedIn && ledger.value.unsyncedSince === null) {
      ledger.update((l) => ({ ...l, unsyncedSince: Date.now() }));
    }
  }, [online, signedIn, ledger]);

  // Back online with changes waiting: pull, merge, push. The push is asked
  // for explicitly — `refresh` only pulls, and when the account had nothing
  // new it changes nothing that would set off the ordinary push, so an edit
  // whose push failed offline would otherwise stay on the device.
  const wasOnline = useRef(online);
  useEffect(() => {
    const cameBack = online && !wasOnline.current;
    wasOnline.current = online;
    if (!cameBack || !syncOnReconnect(ledger.value, signedIn)) return;
    const catchUp = async () => {
      await refresh();
      // Let a merged copy from the pull render first, so it is the one sent.
      await new Promise((r) => setTimeout(r, 0));
      await pushNow();
    };
    void (syncNow ?? catchUp)();
  }, [online, signedIn, ledger.value, syncNow, refresh, pushNow]);

  const b = badge({ online, signedIn, ledger: ledger.value, sync, now });
  if (!b) return null;
  return (
    <div role="status" className={b.tone === 'offline' ? 'offline-banner is-offline' : 'offline-banner'}>
      <span className="offline-chip">{b.label}</span> <span>{b.text}</span>
    </div>
  );
}
