import { describe, expect, it } from 'vitest';
import {
  accountReview,
  APPEAL_RULES,
  blindView,
  decide,
  decideAppeal,
  DECISION_ACTIONS,
  fileAppeal,
  mayDecide,
  ModerationRefused,
  openCase,
  protect,
  provisionalSeverity,
  REPORT_CATEGORIES,
  studentNotice,
  triage,
  type Actor,
  type SafetySignal,
} from './moderation';

const now = new Date('2026-09-27T12:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

function report(reporterId: string, category: SafetySignal['category'], at = minsAgo(5), qualifiers = {}): SafetySignal {
  return { id: `s-${reporterId}-${at}`, targetId: 'post-1', source: 'report', at, category, reporterId, qualifiers };
}

const pro: Actor = { id: 'pro-1', kind: 'professional' };
const pro2: Actor = { id: 'pro-2', kind: 'professional' };
const vol1: Actor = { id: 'vol-1', kind: 'volunteer' };
const vol2: Actor = { id: 'vol-2', kind: 'volunteer' };
const bot: Actor = { id: 'triage', kind: 'automation' };

describe('provisional severity', () => {
  it('puts doxxing and nonconsensual media at P0', () => {
    expect(provisionalSeverity('private_information_or_doxxing')).toBe('P0');
    expect(provisionalSeverity('nonconsensual_media')).toBe('P0');
  });
  it('raises on qualifiers', () => {
    expect(provisionalSeverity('harassment_or_bullying')).toBe('P2');
    expect(provisionalSeverity('harassment_or_bullying', { stalking: true })).toBe('P1');
    expect(provisionalSeverity('other', { imminent: true })).toBe('P0');
  });
  it('covers every category', () => {
    for (const c of REPORT_CATEGORIES) expect(['P0', 'P1', 'P2', 'P3']).toContain(provisionalSeverity(c));
  });
});

describe('triage thresholds', () => {
  it('one ordinary report: queue only', () => {
    expect(triage([report('r1', 'other')], now)).toMatchObject({ protection: 'queue', severity: 'P3', route: 'standard' });
  });

  it('two distinct signals in 30 minutes: monitor', () => {
    const t = triage([report('r1', 'other', minsAgo(10)), report('r2', 'other', minsAgo(20))], now);
    expect(t.protection).toBe('monitor');
  });

  it('the same reporter twice is one signal', () => {
    const t = triage([report('r1', 'other', minsAgo(10)), report('r1', 'other', minsAgo(20))], now);
    expect(t.protection).toBe('queue');
  });

  it('three distinct reporters in 60 minutes: reduced distribution, not removal', () => {
    const t = triage(
      [report('r1', 'spam_scam_or_phishing', minsAgo(10)), report('r2', 'spam_scam_or_phishing', minsAgo(40)), report('r3', 'spam_scam_or_phishing', minsAgo(55))],
      now,
    );
    expect(t.protection).toBe('reduce_distribution');
  });

  it('three reports spread over more than an hour do not reduce', () => {
    const t = triage(
      [report('r1', 'other', minsAgo(10)), report('r2', 'other', minsAgo(70)), report('r3', 'other', minsAgo(90))],
      now,
    );
    expect(t.protection).not.toBe('reduce_distribution');
  });

  it('one high-risk report: temporary hold and professional route', () => {
    const t = triage([report('r1', 'private_information_or_doxxing')], now);
    expect(t).toMatchObject({ protection: 'temporary_hold', severity: 'P0', route: 'professional_urgent' });
  });

  it('high-confidence PII detection: temporary hold', () => {
    const s: SafetySignal = { id: 'd', targetId: 'post-1', source: 'detector', detector: 'pii_doxxing', confidence: 0.95, version: 'v', at: minsAgo(1), category: 'private_information_or_doxxing' };
    expect(triage([s], now).protection).toBe('temporary_hold');
    expect(triage([{ ...s, confidence: 0.5 }], now).protection).toBe('queue');
  });

  it('a brigade is set aside for integrity review and does not punish the target', () => {
    const brigade = new Set(['b1', 'b2', 'b3', 'b4']);
    const t = triage(['b1', 'b2', 'b3', 'b4'].map((r) => report(r, 'harassment_or_bullying')), now, brigade);
    expect(t.route).toBe('integrity_review');
    expect(t.protection).toBe('none');
  });

  it('a brigade still cannot stop a high-risk report from holding the post', () => {
    const brigade = new Set(['b1', 'b2', 'b3']);
    const t = triage(['b1', 'b2', 'b3'].map((r) => report(r, 'private_information_or_doxxing')), now, brigade);
    expect(t.protection).toBe('temporary_hold');
    expect(t.route).toBe('integrity_review');
  });

  it('a brigade does not bury a genuine high-risk report', () => {
    const brigade = new Set(['b1', 'b2']);
    const t = triage([report('b1', 'other'), report('b2', 'other'), report('r1', 'threat_or_safety_concern')], now, brigade);
    expect(t.route).toBe('professional');
    expect(t.protection).toBe('temporary_hold');
  });
});

describe('account review triggers recommend, never restrict', () => {
  it.each([
    [[{ severity: 'P2' as const }, { severity: 'P2' as const }], 'none'],
    [[{ severity: 'P2' as const }, { severity: 'P2' as const }, { severity: 'P2' as const }], 'professional_restriction_review'],
    [[{ severity: 'P1' as const }], 'temporary_restriction_senior_review'],
    [[{ severity: 'P0' as const }], 'immediate_hold_urgent_review'],
  ])('%j → %s', (cases, expected) => {
    expect(accountReview(cases.map((c) => ({ ...c, decidedAt: minsAgo(60) })), now)).toBe(expected);
  });

  it('only counts the last 30 days', () => {
    const old = new Date(now.getTime() - 31 * 86_400_000).toISOString();
    expect(accountReview([{ severity: 'P1', decidedAt: old }], now)).toBe('none');
  });
});

describe('who may decide', () => {
  const p0 = openCase({ id: 'c0', targetId: 't', signals: [report('r1', 'private_information_or_doxxing')], now });
  const p1 = openCase({ id: 'c1', targetId: 't', signals: [report('r1', 'hate_or_discrimination')], now });
  const p2spam = openCase({ id: 'c2', targetId: 't', signals: [report('r1', 'spam_scam_or_phishing')], now });
  const p2harass = openCase({ id: 'c3', targetId: 't', signals: [report('r1', 'harassment_or_bullying')], now });
  const p3 = openCase({ id: 'c4', targetId: 't', signals: [report('r1', 'other')], now });

  it('volunteers never see P0/P1 or contextual P2', () => {
    expect(mayDecide(p0, vol1)).toBe(false);
    expect(mayDecide(p1, vol1)).toBe(false);
    expect(mayDecide(p2harass, vol1)).toBe(false);
    expect(mayDecide(p2spam, vol1)).toBe(true);
    expect(mayDecide(p3, vol1)).toBe(true);
  });

  it('automation never decides anything', () => {
    for (const a of DECISION_ACTIONS) expect(() => decide(p3, bot, a, 'x', now)).toThrow(ModerationRefused);
  });

  it('automation can only apply reversible protections', () => {
    expect(() => protect(p3, 'reduce_distribution', now)).not.toThrow();
    for (const a of ['remove', 'account_restriction', 'escalate', 'community_restriction'] as const) {
      expect(() => protect(p3, a, now)).toThrow(ModerationRefused);
    }
  });

  it('only professionals escalate', () => {
    expect(() => decide(p3, vol1, 'escalate', 'x', now)).toThrow(ModerationRefused);
    expect(decide(p1, pro, 'escalate', 'threat.credible', now).status).toBe('decided');
  });

  it('a P0 account restriction needs a senior professional', () => {
    expect(() => decide(p0, pro, 'account_restriction', 'dox', now)).toThrow(ModerationRefused);
    expect(decide(p0, { id: 's', kind: 'senior_professional' }, 'account_restriction', 'dox', now).status).toBe('decided');
  });
});

describe('volunteer removal needs two independent agreeing volunteers', () => {
  const p3 = openCase({ id: 'c', targetId: 't', signals: [report('r1', 'other')], now });

  it('one vote is pending, two agreeing votes decide', () => {
    const once = decide(p3, vol1, 'remove', 'offtopic', now);
    expect(once.status).toBe('in_review');
    expect(once.decisions).toHaveLength(0);
    const twice = decide(once, vol2, 'remove', 'offtopic', now);
    expect(twice.status).toBe('decided');
    expect(twice.decisions.map((d) => d.actorId)).toEqual(['vol-1', 'vol-2']);
  });

  it('the same volunteer cannot count twice', () => {
    const once = decide(p3, vol1, 'remove', 'offtopic', now);
    expect(() => decide(once, vol1, 'remove', 'offtopic', now)).toThrow(ModerationRefused);
  });

  it('disagreement goes to a professional', () => {
    const once = decide(p3, vol1, 'remove', 'offtopic', now);
    const split = decide(once, vol2, 'allow', 'fine', now);
    expect(split.route).toBe('professional');
    expect(split.status).toBe('in_review');
    expect(mayDecide(split, { id: 'vol-3', kind: 'volunteer' })).toBe(false);
  });

  it('volunteers cannot restrict accounts', () => {
    expect(() => decide(p3, vol1, 'account_restriction', 'x', now)).toThrow(ModerationRefused);
  });
});

describe('appeals', () => {
  const decided = decide(openCase({ id: 'c', targetId: 't', signals: [report('r1', 'harassment_or_bullying')], now }), pro, 'remove', 'harassment.targeted', now);

  it('are decided by a different professional', () => {
    const appealed = fileAppeal(decided, 'student-1', now);
    expect(() => decideAppeal(appealed, pro, 'allow', 'x', now)).toThrow(ModerationRefused);
    expect(() => decideAppeal(appealed, vol1, 'allow', 'x', now)).toThrow(ModerationRefused);
    expect(decideAppeal(appealed, pro2, 'allow', 'context.satire', now).status).toBe('closed');
  });

  it('can be filed on the last day of the window and not after it', () => {
    const day = 86_400_000;
    const lastDay = new Date(now.getTime() + APPEAL_RULES.filingWindowDays * day);
    expect(fileAppeal(decided, 'student-1', lastDay).status).toBe('appealed');
    const late = new Date(lastDay.getTime() + 1);
    expect(() => fileAppeal(decided, 'student-1', late)).toThrow(/window/);
  });

  it('the window is measured from the decision, not from the report or from today', () => {
    const reportedLongAgo = decide(
      openCase({ id: 'c2', targetId: 't', signals: [report('r1', 'harassment_or_bullying', minsAgo(60 * 24 * 90))], now }),
      pro, 'remove', 'harassment.targeted', now,
    );
    expect(fileAppeal(reportedLongAgo, 'student-1', now).status).toBe('appealed');
  });

  it('the window is one number in two forms, and the notice says it in words', () => {
    expect([APPEAL_RULES.filingWindowDays, APPEAL_RULES.filingWindowWords]).toEqual([30, 'thirty days']);
    expect(studentNotice(decided)).toContain(`within ${APPEAL_RULES.filingWindowWords}`);
  });

  it('nothing to appeal after "allow"', () => {
    const allowed = decide(openCase({ id: 'c', targetId: 't', signals: [report('r1', 'other')], now }), pro, 'allow', 'ok', now);
    expect(() => fileAppeal(allowed, 's', now)).toThrow(ModerationRefused);
  });
});

describe('audit', () => {
  it('records every transition, frozen, with actor role and before/after', () => {
    let c = openCase({ id: 'c', targetId: 't', signals: [report('r1', 'harassment_or_bullying')], now });
    c = decide(c, pro, 'remove', 'harassment.targeted', now);
    c = fileAppeal(c, 'student-1', now);
    c = decideAppeal(c, pro2, 'allow', 'context', now);
    expect(c.audit.map((e) => [e.event, e.actorKind, e.before, e.after])).toEqual([
      ['case_opened', 'automation', 'open', 'open'],
      ['decided:remove', 'professional', 'open', 'decided'],
      ['appeal_filed', 'student', 'decided', 'appealed'],
      ['appeal_decided:allow', 'professional', 'appealed', 'closed'],
    ]);
    expect(Object.isFrozen(c.audit)).toBe(true);
    expect(Object.isFrozen(c.audit[0])).toBe(true);
  });

  it('a decision needs a reason code', () => {
    const c = openCase({ id: 'c', targetId: 't', signals: [report('r1', 'other')], now });
    expect(() => decide(c, pro, 'remove', ' ', now)).toThrow(ModerationRefused);
  });
});

describe('what people see', () => {
  it('the blind view has no reporter, target or decisions', () => {
    const c = openCase({ id: 'c', targetId: 't', signals: [report('r1', 'other')], now });
    expect(Object.keys(blindView(c)).sort()).toEqual(['category', 'id', 'severity', 'status']);
  });

  it('the student notice is words and an appeal route, never a score', () => {
    const c = decide(openCase({ id: 'c', targetId: 't', signals: [report('r1', 'other')], now }), pro, 'remove', 'spam', now);
    const notice = studentNotice(c) ?? '';
    expect(notice).toContain('You can appeal');
    expect(notice).not.toMatch(/\d{2,}/);
  });
});
