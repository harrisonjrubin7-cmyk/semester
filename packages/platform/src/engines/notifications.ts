/**
 * The notification engine: *whether*, *where* and *when* a message goes —
 * decided in one place, from the person's preferences and the institution's
 * rules, and recorded with the reason.
 *
 * Every product surface wants to tell someone something: a deadline, a grade,
 * a guardian's agenda, an incident. Left to each surface, that becomes dark
 * patterns by accident — nudges at 2 a.m., a marketing message to a minor,
 * a "security" email that is really a promotion. So surfaces do not send. They
 * ask `planNotification`, which answers with deliveries and with the reasons
 * for any it withheld.
 *
 * Rules (the audit's "no unexplained profiling, dark patterns or guardian
 * access beyond consent"):
 *
 * - **Categories** carry a kind. `safety` and `account_security` cannot be
 *   turned off and ignore quiet hours. `transactional` (a receipt, a requested
 *   export) is always sent but respects quiet hours unless urgent. `academic`
 *   follows preferences. `marketing` needs a live marketing consent *and*
 *   an opt-in channel preference, and is never sent to a guardian recipient
 *   about a student, nor ever during quiet hours.
 * - **Recipients who are not the subject** (a guardian) need a live consent for
 *   the category's purpose; without it nothing is sent and the reason says so.
 * - **Quiet hours** defer, they do not drop: the delivery gets `deliverAfter`.
 * - **Channels** are limited to what the tenant has enabled.
 * - **Dedupe**: one `dedupeKey` is delivered at most once per recipient per
 *   window, so a retried consumer does not send the same reminder twice.
 * - Content is a **template id and data**, never rendered free text here; the
 *   data is minimised by the caller and never logged.
 */

export const NOTIFICATION_CHANNELS = ['in_app', 'push', 'email', 'sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_KINDS = ['safety', 'account_security', 'transactional', 'academic', 'marketing'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface QuietHours {
  /** 0–23, local. If start > end the window crosses midnight. */
  startHour: number;
  endHour: number;
  timeZone: string;
}

export interface NotificationPreferences {
  personId: string;
  tenantId: string;
  /** Per kind, channels the person wants. Absent kind = the defaults below. */
  channels: Partial<Record<NotificationKind, readonly NotificationChannel[]>>;
  quietHours?: QuietHours;
}

export interface TenantNotificationPolicy {
  tenantId: string;
  enabledChannels: readonly NotificationChannel[];
  /** Channels a guardian may be notified on at all. */
  guardianChannels: readonly NotificationChannel[];
}

export interface NotificationRequest {
  tenantId: string;
  recipientId: string;
  /** The student the message is about. Equal to the recipient unless the recipient is a guardian or advisor. */
  subjectId: string;
  kind: NotificationKind;
  /** The consent purpose a non-subject recipient needs. */
  consentPurpose?: string;
  template: string;
  data: Record<string, string | number | boolean>;
  dedupeKey: string;
  urgent?: boolean;
}

export type SuppressionReason =
  | 'tenant_mismatch'
  | 'no_consent'
  | 'marketing_not_consented'
  | 'marketing_to_guardian'
  | 'no_channel'
  | 'duplicate';

export interface PlannedDelivery {
  channel: NotificationChannel;
  deliverAfter: string | null;
  deferredBy?: 'quiet_hours';
}

export interface NotificationPlan {
  deliveries: PlannedDelivery[];
  suppressed: { channel: NotificationChannel | 'all'; reason: SuppressionReason }[];
}

const DEFAULT_CHANNELS: Record<NotificationKind, readonly NotificationChannel[]> = {
  safety: ['in_app', 'push', 'sms', 'email'],
  account_security: ['in_app', 'email'],
  transactional: ['in_app', 'email'],
  academic: ['in_app', 'push'],
  marketing: [],
};

/** Kinds a person cannot switch off. */
export const NON_OPTIONAL: readonly NotificationKind[] = ['safety', 'account_security', 'transactional'];

/** Kinds that ignore quiet hours. */
const IGNORES_QUIET_HOURS: readonly NotificationKind[] = ['safety', 'account_security'];

function localHour(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).formatToParts(at);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
}

/** The next instant, on or after `at`, outside the window. Steps hourly: windows are whole hours. */
export function endOfQuietHours(at: Date, q: QuietHours): Date | null {
  const inside = (d: Date) => {
    const h = localHour(d, q.timeZone);
    return q.startHour <= q.endHour ? h >= q.startHour && h < q.endHour : h >= q.startHour || h < q.endHour;
  };
  if (!inside(at)) return null;
  const d = new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000);
  for (let i = 0; i < 48; i++) {
    d.setTime(d.getTime() + 3_600_000);
    if (!inside(d)) return d;
  }
  return null;
}

export interface NotificationPlanInput {
  request: NotificationRequest;
  preferences: NotificationPreferences | undefined;
  tenant: TenantNotificationPolicy;
  /** Whether a live consent covers a non-subject recipient. */
  consented: boolean;
  /** Whether the person holds a live marketing consent. */
  marketingConsented: boolean;
  /** `dedupeKey`s already delivered to this recipient inside the window. */
  alreadySent: ReadonlySet<string>;
  now: Date;
}

export function planNotification(input: NotificationPlanInput): NotificationPlan {
  const { request: r, preferences: p, tenant: t, now } = input;
  const none = (reason: SuppressionReason): NotificationPlan => ({ deliveries: [], suppressed: [{ channel: 'all', reason }] });

  if (r.tenantId !== t.tenantId || (p !== undefined && p.tenantId !== r.tenantId)) return none('tenant_mismatch');
  if (input.alreadySent.has(r.dedupeKey)) return none('duplicate');

  const aboutSomeoneElse = r.recipientId !== r.subjectId;
  if (aboutSomeoneElse && r.kind !== 'safety' && !input.consented) return none('no_consent');
  if (r.kind === 'marketing') {
    if (aboutSomeoneElse) return none('marketing_to_guardian');
    if (!input.marketingConsented) return none('marketing_not_consented');
  }

  const wanted = NON_OPTIONAL.includes(r.kind) ? DEFAULT_CHANNELS[r.kind] : (p?.channels[r.kind] ?? DEFAULT_CHANNELS[r.kind]);
  const allowedForRecipient = aboutSomeoneElse ? t.guardianChannels : t.enabledChannels;
  const suppressed: NotificationPlan['suppressed'] = [];
  const channels = wanted.filter((c) => {
    const ok = t.enabledChannels.includes(c) && allowedForRecipient.includes(c);
    if (!ok) suppressed.push({ channel: c, reason: 'no_channel' });
    return ok;
  });
  if (channels.length === 0) return { deliveries: [], suppressed: suppressed.length ? suppressed : [{ channel: 'all', reason: 'no_channel' }] };

  const quiet = p?.quietHours;
  const deferUntil =
    quiet && !IGNORES_QUIET_HOURS.includes(r.kind) && !(r.urgent && r.kind === 'transactional') ? endOfQuietHours(now, quiet) : null;

  return {
    deliveries: channels.map((channel) =>
      // In-app items sit in the inbox silently, so quiet hours do not delay them.
      deferUntil && channel !== 'in_app'
        ? { channel, deliverAfter: deferUntil.toISOString(), deferredBy: 'quiet_hours' as const }
        : { channel, deliverAfter: null },
    ),
    suppressed,
  };
}
