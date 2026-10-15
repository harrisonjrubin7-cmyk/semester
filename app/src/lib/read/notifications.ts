/**
 * The notifications read model: today's real reminders, as an envelope.
 *
 * The screen used to render `NOTIFICATIONS` from `data/misc.ts`, four fixed
 * lines about courses the student may not be in, commented "a demonstration of
 * the alert style, not a live feed". This reads the same reminders the device
 * fires (`state/reminders.ts`), so the list and the buzz cannot disagree, and
 * says what it knows about them: they are worked out on this device from the
 * student's own calendar, so authority is `derived` and the label is
 * `estimated` — never `institution_verified`.
 */

import { TIER, whyFor, type Permission, type Reminder, type Tier } from '../notify';
import type { NotifKey } from '../../data/misc';
import { envelope, type ReadEnvelope } from './envelope';

export interface FeedItem {
  id: string;
  rule: NotifKey;
  tier: Tier;
  title: string;
  body: string;
  why: string;
}

export const NOTIFICATIONS_SOURCE = {
  id: 'device.reminders',
  label: 'Worked out on this device',
  kind: 'estimated',
} as const;

const TIER_ORDER: Record<Tier, number> = { critical: 0, important: 1, helpful: 2 };

export interface FeedInput {
  /** The store has a term to read. False while it loads, which is not "nothing due". */
  ready: boolean;
  reminders: Reminder[];
  /** Ids the student has put away today. */
  dismissed: ReadonlySet<string>;
  online: boolean;
  /** The browser's notification permission, which decides whether these also pop up. */
  permission: Permission;
  now: number;
}

/** Most urgent first; order within a tier is the order the rules produced. */
export function feedItems(reminders: Reminder[]): FeedItem[] {
  return reminders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => TIER_ORDER[TIER[a.r.rule]] - TIER_ORDER[TIER[b.r.rule]] || a.i - b.i)
    .map(({ r }) => ({
      id: r.id,
      rule: r.rule,
      tier: TIER[r.rule],
      title: r.title,
      body: r.body,
      why: whyFor(r),
    }));
}

export function notificationsEnvelope(input: FeedInput): ReadEnvelope<FeedItem[]> {
  const { ready, reminders, dismissed, online, permission, now } = input;
  const common = {
    authority: 'derived' as const,
    source: NOTIFICATIONS_SOURCE,
    permission: { canRead: true, allowedActions: ['dismiss', 'restore'] },
  };
  if (!ready) return envelope<FeedItem[]>({ ...common, state: 'loading' });

  const all = feedItems(reminders);
  const shown = all.filter((i) => !dismissed.has(i.id));
  const limitations = ['Worked out on this device from your own calendar. Not confirmed by your school.'];
  if (permission === 'denied') limitations.push('This browser is blocking pop-ups, so these appear here only.');
  if (permission === 'unsupported') limitations.push('This browser cannot show pop-up notifications, so these appear here only.');

  const observedAt = new Date(now).toISOString();
  if (shown.length === 0) {
    return envelope<FeedItem[]>({
      ...common,
      state: 'empty',
      observedAt,
      limitations: all.length > 0 ? ['You put everything away for today.', ...limitations] : limitations,
      recovery: all.length > 0 ? [{ action: 'restore', label: 'Bring back what you put away' }] : [],
    });
  }
  return envelope<FeedItem[]>({
    ...common,
    // Computed on the device, so being offline does not make it stale — but
    // the screen should still say that nothing from outside can arrive.
    state: online ? 'connected' : 'offline',
    data: shown,
    observedAt,
    limitations: online ? limitations : ['You are offline. Nothing new from outside this device can arrive; these are worked out locally.', ...limitations],
  });
}
