import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUIET_HOURS, consentFromKeyword, decideSend, inQuietHours, parseKeyword,
  type ConsentRecord, type OutboundMessage, type SendContext,
} from './messaging';

// 18:00 UTC = 13:00 in Nashville (CDT) — outside quiet hours.
const AFTERNOON = new Date('2026-10-01T18:00:00Z');
// 04:00 UTC = 23:00 in Nashville — inside quiet hours.
const NIGHT = new Date('2026-10-02T04:00:00Z');

const SMS_OPT_IN: ConsentRecord = { channel: 'sms', granted: true, version: 'sms-v3', at: '2026-09-01T00:00:00Z', source: 'form' };
const EMAIL_OPT_IN: ConsentRecord = { channel: 'email', granted: true, version: 'email-v2', at: '2026-09-01T00:00:00Z', source: 'form' };

const SMS: OutboundMessage = { campaignId: 'c1', templateId: 't1', templateVersion: '4', channel: 'sms', purpose: 'marketing', topic: 'deadlines' };

function ctx(over: Partial<SendContext> = {}): SendContext {
  return {
    now: AFTERNOON, recipientTimeZone: 'America/Chicago', consents: [SMS_OPT_IN, EMAIL_OPT_IN], suppressed: false,
    recentSends: [], cap: { max: 2, windowDays: 7 }, quiet: DEFAULT_QUIET_HOURS, ...over,
  };
}

describe('the send decision', () => {
  it('sends an opted-in SMS in the afternoon under the cap, recording the consent version', () => {
    const d = decideSend(SMS, ctx());
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.consentVersion).toBe('sms-v3');
    expect(d.audit).toMatchObject({ campaignId: 'c1', templateVersion: '4', consentVersion: 'sms-v3', allowed: true });
  });

  it('refuses SMS with no opt-in, even when it calls itself transactional', () => {
    expect(decideSend(SMS, ctx({ consents: [EMAIL_OPT_IN] }))).toMatchObject({ allowed: false, reason: 'no_consent' });
    expect(decideSend({ ...SMS, purpose: 'transactional' }, ctx({ consents: [] }))).toMatchObject({ allowed: false, reason: 'no_consent' });
  });

  it('holds SMS in the recipient’s quiet hours, judged in their own time zone', () => {
    expect(decideSend(SMS, ctx({ now: NIGHT }))).toMatchObject({ allowed: false, reason: 'quiet_hours' });
    // The same instant is 13:00 the next day in Seoul.
    expect(decideSend(SMS, ctx({ now: NIGHT, recipientTimeZone: 'Asia/Seoul' })).allowed).toBe(true);
  });

  it('stops at the frequency cap and counts only the window', () => {
    const two = ['2026-09-29T12:00:00Z', '2026-09-30T12:00:00Z'];
    expect(decideSend(SMS, ctx({ recentSends: two }))).toMatchObject({ allowed: false, reason: 'frequency_cap' });
    expect(decideSend(SMS, ctx({ recentSends: ['2026-09-01T00:00:00Z', ...two.slice(1)] })).allowed).toBe(true);
  });

  it('applies a STOP immediately: the later withdrawal wins', () => {
    const stop = consentFromKeyword('  Stop ', new Date('2026-09-30T00:00:00Z'), 'sms-v3')!;
    expect(stop).toMatchObject({ granted: false, source: 'sms_keyword' });
    expect(decideSend(SMS, ctx({ consents: [SMS_OPT_IN, stop] }))).toMatchObject({ allowed: false, reason: 'no_consent' });
  });

  it('honours a topic unsubscribe while the channel stays on', () => {
    const offTopic: ConsentRecord = { ...SMS_OPT_IN, topic: 'deadlines', granted: false, at: '2026-09-15T00:00:00Z', source: 'preference_center' };
    expect(decideSend(SMS, ctx({ consents: [SMS_OPT_IN, offTopic] }))).toMatchObject({ reason: 'topic_unsubscribed' });
    expect(decideSend({ ...SMS, topic: 'events' }, ctx({ consents: [SMS_OPT_IN, offTopic] })).allowed).toBe(true);
  });

  it('lets transactional email through without marketing consent but never to a suppressed address', () => {
    const receipt: OutboundMessage = { ...SMS, channel: 'email', purpose: 'transactional' };
    expect(decideSend(receipt, ctx({ consents: [] })).allowed).toBe(true);
    expect(decideSend(receipt, ctx({ suppressed: true }))).toMatchObject({ reason: 'suppressed' });
    expect(decideSend({ ...receipt, purpose: 'marketing' }, ctx({ consents: [] }))).toMatchObject({ reason: 'no_consent' });
  });

  it('does not hold email for quiet hours — it does not interrupt', () => {
    expect(decideSend({ ...SMS, channel: 'email' }, ctx({ now: NIGHT })).allowed).toBe(true);
  });

  it('refuses a message missing its campaign, template or version', () => {
    expect(decideSend({ ...SMS, templateVersion: ' ' }, ctx())).toMatchObject({ reason: 'missing_identifiers' });
    expect(decideSend({ ...SMS, campaignId: '' }, ctx())).toMatchObject({ reason: 'missing_identifiers' });
  });
});

describe('quiet hours and keywords', () => {
  it('handles windows that cross midnight and ones that do not', () => {
    expect(inQuietHours(NIGHT, 'America/Chicago', { start: 21, end: 8 })).toBe(true);
    expect(inQuietHours(AFTERNOON, 'America/Chicago', { start: 12, end: 14 })).toBe(true);
    expect(inQuietHours(AFTERNOON, 'America/Chicago', { start: 8, end: 8 })).toBe(false);
  });

  it('reads carrier keywords and nothing else', () => {
    expect(parseKeyword('STOP')).toBe('stop');
    expect(parseKeyword('unsubscribe.')).toBe('stop');
    expect(parseKeyword('help')).toBe('help');
    expect(parseKeyword('START')).toBe('start');
    expect(parseKeyword('yes')).toBeNull();
    expect(parseKeyword('can you stop by the office?')).toBeNull();
    expect(consentFromKeyword('HELP', AFTERNOON, 'v')).toBeNull();
  });
});
