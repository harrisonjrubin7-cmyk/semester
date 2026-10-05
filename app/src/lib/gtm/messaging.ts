/**
 * Whether one outbound message may be sent (GTM plan §7.1, §8.1, §16.2).
 *
 * The acceptance criteria this answers, one check each:
 * - Every outbound message has template version, campaign ID, consent version
 *   and an audit event.
 * - SMS cannot send without demonstrable opt-in, a quiet-hour check and a
 *   frequency-cap pass.
 * - Email/SMS preference changes apply immediately: the latest record wins,
 *   read at send time, never cached on the campaign.
 *
 * Transactional email (a receipt for something the person did) is separate
 * from marketing, as §11.6 requires, and does not need marketing consent. It is
 * still refused to a suppressed address. SMS has no transactional exemption.
 */

export type Channel = 'email' | 'sms' | 'push';
export type Purpose = 'transactional' | 'marketing';

export interface ConsentRecord {
  channel: Channel;
  /** A topic subscription; absent means the whole channel. */
  topic?: string;
  granted: boolean;
  /** The consent-language version the person saw. */
  version: string;
  at: string;
  source: 'form' | 'preference_center' | 'sms_keyword' | 'staff_import';
}

export interface OutboundMessage {
  campaignId: string;
  templateId: string;
  templateVersion: string;
  channel: Channel;
  purpose: Purpose;
  topic: string;
}

export interface FrequencyCap {
  max: number;
  windowDays: number;
}

export interface QuietHours {
  /** Local hour quiet time starts, 0–23. */
  start: number;
  /** Local hour quiet time ends, 0–23. */
  end: number;
}

export interface SendContext {
  now: Date;
  recipientTimeZone: string;
  consents: readonly ConsentRecord[];
  suppressed: boolean;
  /** Timestamps of messages already sent to this person on this channel, other than transactional email. */
  recentSends: readonly string[];
  cap: FrequencyCap;
  quiet: QuietHours;
}

export type SendRefusal =
  | 'missing_identifiers'
  | 'suppressed'
  | 'no_consent'
  | 'topic_unsubscribed'
  | 'quiet_hours'
  | 'frequency_cap';

export type SendDecision =
  | { allowed: true; consentVersion: string | null; audit: SendAudit }
  | { allowed: false; reason: SendRefusal; audit: SendAudit };

export interface SendAudit {
  event: 'communication.send_decision';
  at: string;
  campaignId: string;
  templateId: string;
  templateVersion: string;
  channel: Channel;
  purpose: Purpose;
  allowed: boolean;
  reason?: SendRefusal;
  consentVersion: string | null;
}

export const DEFAULT_QUIET_HOURS: QuietHours = { start: 21, end: 8 };

/** The most recent record for a channel (and topic, when given). Later `at` wins. */
export function latestConsent(consents: readonly ConsentRecord[], channel: Channel, topic?: string): ConsentRecord | undefined {
  let best: ConsentRecord | undefined;
  for (const c of consents) {
    if (c.channel !== channel) continue;
    if ((c.topic ?? undefined) !== topic) continue;
    if (!best || Date.parse(c.at) >= Date.parse(best.at)) best = c;
  }
  return best;
}

export function localHour(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(h) % 24;
}

export function inQuietHours(now: Date, timeZone: string, q: QuietHours): boolean {
  const h = localHour(now, timeZone);
  if (q.start === q.end) return false;
  return q.start < q.end ? h >= q.start && h < q.end : h >= q.start || h < q.end;
}

export function withinCap(now: Date, recentSends: readonly string[], cap: FrequencyCap): boolean {
  const since = now.getTime() - cap.windowDays * 86_400_000;
  const inWindow = recentSends.filter((t) => Date.parse(t) > since).length;
  return inWindow < cap.max;
}

export function decideSend(m: OutboundMessage, ctx: SendContext): SendDecision {
  const audit = (allowed: boolean, consentVersion: string | null, reason?: SendRefusal): SendAudit => ({
    event: 'communication.send_decision',
    at: ctx.now.toISOString(),
    campaignId: m.campaignId,
    templateId: m.templateId,
    templateVersion: m.templateVersion,
    channel: m.channel,
    purpose: m.purpose,
    allowed,
    ...(reason ? { reason } : {}),
    consentVersion,
  });
  const refuse = (reason: SendRefusal, v: string | null = null): SendDecision =>
    ({ allowed: false, reason, audit: audit(false, v, reason) });

  if (!m.campaignId.trim() || !m.templateId.trim() || !m.templateVersion.trim()) return refuse('missing_identifiers');
  if (ctx.suppressed) return refuse('suppressed');

  const transactionalEmail = m.channel === 'email' && m.purpose === 'transactional';
  if (transactionalEmail) return { allowed: true, consentVersion: null, audit: audit(true, null) };

  const channelConsent = latestConsent(ctx.consents, m.channel);
  if (!channelConsent?.granted) return refuse('no_consent', channelConsent?.version ?? null);
  const topicConsent = latestConsent(ctx.consents, m.channel, m.topic);
  if (topicConsent && !topicConsent.granted) return refuse('topic_unsubscribed', topicConsent.version);

  const interrupts = m.channel === 'sms' || m.channel === 'push';
  if (interrupts && inQuietHours(ctx.now, ctx.recipientTimeZone, ctx.quiet)) return refuse('quiet_hours', channelConsent.version);
  if (!withinCap(ctx.now, ctx.recentSends, ctx.cap)) return refuse('frequency_cap', channelConsent.version);

  return { allowed: true, consentVersion: channelConsent.version, audit: audit(true, channelConsent.version) };
}

/**
 * Inbound SMS keywords. STOP and its carrier synonyms withdraw consent at once;
 * HELP answers without changing anything; START re-subscribes only because the
 * person typed it.
 */
const STOP = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'revoke']);
const HELP = new Set(['help', 'info']);
// Not "yes": a reply to an unrelated question must never re-subscribe anyone.
const START = new Set(['start', 'unstop']);

export type Keyword = 'stop' | 'help' | 'start';

export function parseKeyword(body: string): Keyword | null {
  const word = body.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (STOP.has(word)) return 'stop';
  if (HELP.has(word)) return 'help';
  if (START.has(word)) return 'start';
  return null;
}

/** The consent record an inbound keyword writes, or null for HELP and ordinary replies. */
export function consentFromKeyword(body: string, at: Date, version: string): ConsentRecord | null {
  const k = parseKeyword(body);
  if (k === 'stop') return { channel: 'sms', granted: false, version, at: at.toISOString(), source: 'sms_keyword' };
  if (k === 'start') return { channel: 'sms', granted: true, version, at: at.toISOString(), source: 'sms_keyword' };
  return null;
}
