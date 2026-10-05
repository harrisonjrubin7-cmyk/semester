import { afterEach, describe, expect, it } from 'vitest';
import { MODULE_FLAGS } from './experience-flags';
import { mergePersisted } from './merge';
import {
  EMPTY_LEDGER,
  OfflineRefusal,
  afterSync,
  asOf,
  badge,
  readLedger,
  requireOnline,
  syncOnReconnect,
  type Ledger,
} from './offline-mode';

/**
 * Phase M's model. The ledger records when the account last took this
 * device's copy and since when it has not; the badge says so, and says
 * nothing when there is nothing to say; high-risk actions are refused
 * offline, never queued; and a change made offline meets one made elsewhere
 * by the per-field policy the app already syncs with, losing neither.
 */

const NOW = new Date('2026-10-01T15:42:00').getTime();
const EARLIER = new Date('2026-10-01T09:05:00').getTime();
const flag = MODULE_FLAGS.offline_mode;
const setOnline = (on: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on });

afterEach(() => {
  MODULE_FLAGS.offline_mode = flag;
  setOnline(true);
});

describe('the ledger', () => {
  it('reads back what it wrote, and refuses junk', () => {
    expect(readLedger({ lastSyncedAt: EARLIER, unsyncedSince: null })).toEqual({ version: 1, lastSyncedAt: EARLIER, unsyncedSince: null });
    expect(readLedger({ lastSyncedAt: 'yesterday', unsyncedSince: -3 })).toEqual(EMPTY_LEDGER);
    expect(() => readLedger(null)).toThrow();
  });

  it('starts "not synced" at the first failure and keeps that time', () => {
    const one = afterSync(EMPTY_LEDGER, { status: 'error', at: 0 }, EARLIER);
    expect(one.unsyncedSince).toBe(EARLIER);
    expect(afterSync(one, { status: 'error', at: 0 }, NOW).unsyncedSince).toBe(EARLIER);
  });

  it('clears when the account takes the copy', () => {
    const waiting: Ledger = { version: 1, lastSyncedAt: null, unsyncedSince: EARLIER };
    expect(afterSync(waiting, { status: 'synced', at: NOW }, NOW)).toEqual({ version: 1, lastSyncedAt: NOW, unsyncedSince: null });
    expect(afterSync(waiting, { status: 'syncing', at: 0 }, NOW)).toBe(waiting);
    // The statuses the store gained after this was written (main's sync work).
    expect(afterSync(waiting, { status: 'review', at: NOW }, NOW).unsyncedSince).toBeNull();
    expect(afterSync(EMPTY_LEDGER, { status: 'queued', at: 0 }, NOW).unsyncedSince).toBe(NOW);
    expect(afterSync(EMPTY_LEDGER, { status: 'conflict', at: 0 }, NOW).unsyncedSince).toBe(NOW);
    expect(afterSync(waiting, { status: 'offline', at: 0 }, NOW)).toBe(waiting);
  });

  it('syncs on reconnect only with an account and something waiting', () => {
    const waiting: Ledger = { version: 1, lastSyncedAt: null, unsyncedSince: EARLIER };
    expect(syncOnReconnect(waiting, true)).toBe(true);
    expect(syncOnReconnect(waiting, false)).toBe(false);
    expect(syncOnReconnect(EMPTY_LEDGER, true)).toBe(false);
  });
});

describe('the badge', () => {
  const synced: Ledger = { version: 1, lastSyncedAt: EARLIER, unsyncedSince: null };

  it('says offline, when it last synced, that changes are safe, and what can be kept to send and what must wait', () => {
    const b = badge({ online: false, signedIn: true, ledger: synced, sync: { status: 'error', at: 0 }, now: NOW })!;
    expect(b.label).toBe('Offline mode');
    expect(b.text).toContain('Last synced 9:05 AM.');
    expect(b.text).toContain('saved on this device and syncs when you are back online');
    expect(b.text).toContain('can be kept here and sent by you when you are back');
    expect(b.text).toContain('Publishing, deleting your account and official sites wait until you are connected');
  });

  it('does not promise a sync to a device with no account', () => {
    const b = badge({ online: false, signedIn: false, ledger: EMPTY_LEDGER, sync: { status: 'signed-out', at: 0 }, now: NOW })!;
    expect(b.text).toContain('Everything you change is saved on this device.');
    expect(b.text).not.toContain('syncs');
    expect(b.text).not.toContain('Last synced');
  });

  it('says it is catching up, and then what is still waiting', () => {
    const waiting: Ledger = { version: 1, lastSyncedAt: EARLIER, unsyncedSince: EARLIER + 60_000 };
    expect(badge({ online: true, signedIn: true, ledger: waiting, sync: { status: 'syncing', at: 0 }, now: NOW })!.text).toBe('Syncing the changes you made offline…');
    expect(badge({ online: true, signedIn: true, ledger: waiting, sync: { status: 'error', at: 0 }, now: NOW })!.label).toBe('Not synced yet');
  });

  it('says nothing online and caught up', () => {
    expect(badge({ online: true, signedIn: true, ledger: synced, sync: { status: 'synced', at: EARLIER }, now: NOW })).toBeNull();
    expect(badge({ online: true, signedIn: false, ledger: EMPTY_LEDGER, sync: { status: 'off', at: 0 }, now: NOW })).toBeNull();
  });
});

describe('high-risk actions', () => {
  it('are refused offline with the flag on, saying nothing was sent or queued', () => {
    MODULE_FLAGS.offline_mode = 'production';
    setOnline(false);
    expect(() => requireOnline('share')).toThrow(OfflineRefusal);
    expect(() => requireOnline('delete')).toThrow('Deleting your account needs a connection. You are offline, so nothing was sent and nothing is waiting to be sent.');
  });

  it('run online (the control), and are untouched with the flag off', () => {
    MODULE_FLAGS.offline_mode = 'production';
    setOnline(true);
    expect(() => requireOnline('share')).not.toThrow();
    MODULE_FLAGS.offline_mode = 'off';
    setOnline(false);
    expect(() => requireOnline('share')).not.toThrow();
  });
});

describe('imported data offline', () => {
  it('is dated, never current', () => {
    expect(asOf(EARLIER, NOW)).toBe('as of 9:05 AM');
    expect(asOf(new Date('2026-09-20T08:00:00').getTime(), NOW)).toBe('as of Sep 20, 8:00 AM');
  });
});

describe('the conflict strategy', () => {
  it('keeps a change made offline and one made on another device, by the app’s own per-field policy', () => {
    const task = (id: string) => ({ id, title: id, date: '2026-10-02', done: false });
    const offlineHere = { tasks: [task('written-offline')], done: { d1: true } as Record<string, boolean>, accent: 'teal' };
    const elsewhere = { tasks: [task('written-on-laptop')], done: { d2: true } as Record<string, boolean>, accent: 'rose' };
    const merged = mergePersisted(offlineHere, elsewhere);
    expect(merged.tasks.map((t) => t.id).sort()).toEqual(['written-offline', 'written-on-laptop']);
    expect(merged.done).toEqual({ d1: true, d2: true });
    // A setting is not a list: the copy that synced later wins.
    expect(merged.accent).toBe('rose');
  });
});
