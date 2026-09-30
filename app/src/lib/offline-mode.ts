import { formatDateTime, formatTime } from './locale';
import { useEffect, useState } from 'react';
import { MODULE_FLAGS, moduleOn } from './experience-flags';
import { offline, watchConnection } from './offline';
import type { SyncStatus } from '../state/store';

/**
 * Offline mode (`offline_mode`, Phase M, D-055).
 *
 * The app was already local-first: every change is saved on the device first
 * (IndexedDB, or localStorage where that is missing), and the account copy is
 * pushed after it (`state/store.tsx`). What it did not do was *say* any of
 * that when the connection went, or catch up when it came back. This module
 * is the part that says and catches up:
 *
 * - **The ledger** is a small record per account: when the account last took
 *   this device's copy, and since when it has not. A failed push while
 *   offline sets `unsyncedSince`; a successful one clears it.
 * - **The queue is the device.** Safe local changes are already saved there;
 *   nothing is copied into a second outbox that could disagree with it (the
 *   held sends below are requests the student has not yet made, not copies
 *   of changes already saved). On
 *   reconnect the store's own `refresh()` pulls, merges by `lib/merge.ts`'s
 *   per-field policy, and pushes the result.
 * - **High-risk actions are never sent later by themselves.** Sharing,
 *   sending to the school, publishing, deleting an account, and opening an
 *   official site are refused offline with a sentence saying nothing was sent
 *   and nothing is waiting — `requireOnline`. A queued share that fires hours
 *   later, after the student has changed their mind, is exactly the surprise
 *   this avoids. That reasoning stands. What was added on top of it
 *   (`lib/sync/outbox.ts`) is a way to *keep* two of them, a share with an
 *   advisor and a course plan, without sending: the request is held on the
 *   device, visible and dated, and coming back online makes it ready, not
 *   sent. The student sends it, one tap; a held request older than three
 *   days is never sent; and publishing, deleting an account, an official
 *   site, and anything that writes an official or financial record are still
 *   refused and never held (`lib/sync/classes.ts`).
 * - **Imported data is dated.** Offline, anything that came from outside is
 *   "as of" its time, never current (`asOf`).
 */

export const offlineModeOn = () => moduleOn(MODULE_FLAGS.offline_mode);

export interface Ledger {
  version: 1;
  /** When the account last took this device's copy, epoch ms. */
  lastSyncedAt: number | null;
  /** Since when changes here have not reached the account; null when caught up. */
  unsyncedSince: number | null;
}

export const EMPTY_LEDGER: Ledger = { version: 1, lastSyncedAt: null, unsyncedSince: null };
export const LEDGER_PREFIX = 'semester.offline-ledger.v1';

const stamp = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
export function readLedger(value: unknown): Ledger {
  if (!value || typeof value !== 'object') throw new Error('The saved sync record is not valid.');
  const v = value as Record<string, unknown>;
  return { version: 1, lastSyncedAt: stamp(v.lastSyncedAt), unsyncedSince: stamp(v.unsyncedSince) };
}

export type SyncState = { status: SyncStatus; at: number };

/**
 * The ledger after the store reports a sync result. `review` is synced with a
 * choice waiting, so it counts as synced; `queued` and `conflict` mean changes
 * have not reached the account yet, the same as a failure.
 */
export function afterSync(l: Ledger, sync: SyncState, now: number): Ledger {
  if (sync.status === 'synced' || sync.status === 'review') return { version: 1, lastSyncedAt: sync.at || now, unsyncedSince: null };
  if (sync.status === 'error' || sync.status === 'queued' || sync.status === 'conflict') return { ...l, unsyncedSince: l.unsyncedSince ?? now };
  return l;
}

/** Whether coming back online should pull, merge and push. */
export const syncOnReconnect = (l: Ledger, signedIn: boolean) => signedIn && l.unsyncedSince !== null;

const clock = (at: number, now: number) => {
  const d = new Date(at);
  const today = new Date(now).toDateString() === d.toDateString();
  return today
    ? formatTime(d, { hour: 'numeric', minute: '2-digit' })
    : formatDateTime(d, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export interface Badge {
  tone: 'offline' | 'waiting' | 'syncing';
  label: string;
  text: string;
}

/**
 * What the badge says, or null when there is nothing to say. Online and caught
 * up is the ordinary case and gets no badge.
 */
export function badge(input: { online: boolean; signedIn: boolean; ledger: Ledger; sync: SyncState; now: number }): Badge | null {
  const { online, signedIn, ledger, sync, now } = input;
  const last = ledger.lastSyncedAt ? `Last synced ${clock(ledger.lastSyncedAt, now)}.` : signedIn ? 'Not synced from this device yet.' : '';
  if (!online) {
    return {
      tone: 'offline',
      label: 'Offline mode',
      text: [
        last,
        signedIn
          ? 'Everything you change is saved on this device and syncs when you are back online.'
          : 'Everything you change is saved on this device.',
        'Sharing an advisor meeting and sending your course plan can be kept here and sent by you when you are back. Publishing, deleting your account and official sites wait until you are connected.',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }
  if (signedIn && sync.status === 'syncing' && ledger.unsyncedSince !== null) {
    return { tone: 'syncing', label: 'Back online', text: 'Syncing the changes you made offline…' };
  }
  if (signedIn && ledger.unsyncedSince !== null) {
    return {
      tone: 'waiting',
      label: 'Not synced yet',
      text: `${last} Your changes since ${clock(ledger.unsyncedSince, now)} are saved on this device and will sync.`.trim(),
    };
  }
  return null;
}

// ── High-risk actions ─────────────────────────────────────────────────────

export const HIGH_RISK = {
  share: 'Sharing',
  send: 'Sending this to your school',
  publish: 'Publishing',
  delete: 'Deleting your account',
  handoff: 'Opening an official site',
} as const;
export type HighRisk = keyof typeof HIGH_RISK;

export class OfflineRefusal extends Error {
  constructor(kind: HighRisk) {
    super(`${HIGH_RISK[kind]} needs a connection. You are offline, so nothing was sent and nothing is waiting to be sent.`);
    this.name = 'OfflineRefusal';
  }
}

/** Throws before a high-risk action runs offline. Never queues it. */
export function requireOnline(kind: HighRisk): void {
  if (offlineModeOn() && offline()) throw new OfflineRefusal(kind);
}

/** "as of Sep 27, 3:42 PM": imported data offline is dated, never current. */
export const asOf = (at: number, now: number) => `as of ${clock(at, now)}`;

/** Whether the browser says it is online, kept current. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => !offline());
  useEffect(() => watchConnection(setOnline), []);
  return online;
}

/**
 * Where each thing the command asks to be available offline lives. Every one
 * is on the device already; none needs the network to open once the app has
 * loaded once. `offline-mode.test.ts` reads each back with the network gone.
 */
export const AVAILABLE_OFFLINE = [
  { what: 'Today snapshot', where: 'The saved state (`semester.v1` or IndexedDB `semester-store`): deadlines, actions, the plan' },
  { what: 'Saved schedules', where: '`semester.registration.v1` (the cart and potential schedules)' },
  { what: 'Saved degree plan', where: 'The saved state: `requirements` and `taken`' },
  { what: 'Registration checklist', where: '`semester.registration-day.v1`' },
  { what: 'Advisor agenda', where: '`semester.advisor-meeting.v1`' },
  { what: 'Downloaded study packs', where: 'The service worker’s media cache (decks, handouts, audio), cache-first' },
  { what: 'Flashcards', where: 'The saved state: `decks` and `reviews`' },
  { what: 'Selected sources', where: 'The saved state: `sources`, with Source Locker’s choices in `semester.source-locker.v1`' },
] as const;
