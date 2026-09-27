/**
 * The disabled-by-default pieces: flags, escalation, volunteers, aliases,
 * the private safety state, and community/session rules.
 */
import { describe, expect, it } from 'vitest';
import { AliasRefused, AliasRegistry, ALIAS_RATE_LIMIT, rateLimitFor, type AliasCommunity } from './alias';
import {
  createSession,
  joinSession,
  mayPost,
  membershipVisibleTo,
  messagingMode,
  overlap,
  CommunityRefused,
  type Community,
  type Membership,
  type Venue,
} from './communities';
import {
  CRISIS_NOTICE,
  crisisSignal,
  DEFAULT_ESCALATION_POLICY,
  EscalationRefused,
  prepareEscalation,
  type EscalationApproval,
  type TenantEscalationPolicy,
} from './crisis';
import { communityFlags, COMMUNITY_FLAG_SPECS, type CommunityFlags } from './flags';
import { identityLeaks } from './identity';
import { openCase, type SafetySignal } from './moderation';
import { readSafetyState, recordOutcome, reverse, safetyValue, SafetyStateRefused } from './safety-state';
import { calibrationPassed, eligibility, mustRecuse, quality, status, withinCaps, type VolunteerRecord } from './volunteer';

const now = new Date('2026-09-27T12:00:00Z');

describe('flags', () => {
  it('everything is off with no environment', () => {
    expect(Object.values(communityFlags({})).every((s) => s === 'off')).toBe(true);
  });

  it('a preview build turns on foundations but never high-risk flags', () => {
    const flags = communityFlags({ VITE_INSTITUTIONAL_PREVIEW: 'true' });
    for (const [k, spec] of Object.entries(COMMUNITY_FLAG_SPECS)) {
      expect(flags[k as keyof CommunityFlags]).toBe(spec.highRisk ? 'off' : 'preview');
    }
  });

  it('high-risk flags refuse production and misspellings read as off', () => {
    expect(communityFlags({ VITE_VOLUNTEER_MODERATION: 'production' }).volunteerModeration).toBe('off');
    expect(communityFlags({ VITE_VOLUNTEER_MODERATION: 'sandbox' }).volunteerModeration).toBe('sandbox');
    expect(communityFlags({ VITE_COMMUNITY_FEED: 'on' }).communityFeed).toBe('off');
  });
});

describe('crisis', () => {
  it('the notice says Community is not an emergency service', () => {
    expect(CRISIS_NOTICE).toContain('not monitored as an emergency-response service');
  });

  it('a crisis signal is a possible concern for a human, not a diagnosis', () => {
    expect(crisisSignal()).toMatchObject({ kind: 'possible_concern', route: 'professional' });
  });
});

describe('institution escalation', () => {
  const on = communityFlags({ VITE_INSTITUTION_ESCALATION: 'sandbox' });
  const policy: TenantEscalationPolicy = {
    tenantId: 'nvu',
    enabled: true,
    agreementRef: 'MOU-2026-04',
    categories: ['threat_or_safety_concern'],
    identityRequired: false,
    channel: 'nvu-bit-team',
  };
  const signal: SafetySignal = { id: 's', targetId: 't', source: 'report', at: now.toISOString(), category: 'threat_or_safety_concern', reporterId: 'r' };
  const kase = openCase({ id: 'case-1', targetId: 't', signals: [signal], now });
  const approvals: EscalationApproval[] = [
    { actorId: 'pro-1', actorKind: 'professional', reason: 'Credible specific threat', at: now.toISOString() },
    { actorId: 'pro-2', actorKind: 'senior_professional', reason: 'Concur, meets MOU criteria', at: now.toISOString() },
  ];
  const base = { flags: on, policy, kase, approvals, summary: 'Threat naming a campus event.', alreadyDelivered: false, now };

  it('produces a minimum-data payload with no identity', () => {
    const payload = prepareEscalation(base);
    expect(Object.keys(payload).sort()).toEqual(['agreementRef', 'caseId', 'category', 'occurredAt', 'severity', 'summary', 'tenantId']);
    expect(identityLeaks(payload)).toEqual([]);
  });

  it.each<[string, Partial<typeof base>]>([
    ['flag off', { flags: communityFlags({}) }],
    ['default tenant policy', { policy: DEFAULT_ESCALATION_POLICY('nvu') }],
    ['one approver', { approvals: approvals.slice(0, 1) }],
    ['the same approver twice', { approvals: [approvals[0], { ...approvals[0] }] }],
    ['automation approving', { approvals: [...approvals, { actorId: 'bot', actorKind: 'automation', reason: 'model said so', at: '' }] }],
    ['already delivered', { alreadyDelivered: true }],
    ['uncovered category', { policy: { ...policy, categories: ['impersonation'] } }],
  ])('refuses when %s', (_, patch) => {
    expect(() => prepareEscalation({ ...base, ...patch })).toThrow(EscalationRefused);
  });

  it('refuses P2 and below', () => {
    const p3 = openCase({ id: 'c', targetId: 't', signals: [{ ...signal, category: 'other' }], now });
    expect(() => prepareEscalation({ ...base, kase: p3 })).toThrow(EscalationRefused);
  });

  it('carries a vault reference only when the agreement requires identity', () => {
    const withId = prepareEscalation({ ...base, policy: { ...policy, identityRequired: true }, vaultRef: 'vault://nvu/x' });
    expect(withId.vaultRef).toBe('vault://nvu/x');
    expect(prepareEscalation({ ...base, vaultRef: 'vault://nvu/x' }).vaultRef).toBeUndefined();
  });
});

describe('volunteers', () => {
  const ready: VolunteerRecord = {
    accountId: 'v',
    verified: true,
    accountCreatedAt: '2026-07-01T00:00:00Z',
    activeRestriction: false,
    trainingCompletedAt: '2026-08-01',
    confidentialitySignedAt: '2026-08-01',
    recusalAcknowledgedAt: '2026-08-01',
    calibration: Array(20).fill(true),
    controls: [],
  };

  it('need every eligibility condition, including 30 days of account age', () => {
    expect(eligibility(ready, now).eligible).toBe(true);
    expect(eligibility({ ...ready, accountCreatedAt: '2026-09-10T00:00:00Z' }, now).missing).toContain('30-day account age');
    expect(eligibility({ ...ready, confidentialitySignedAt: undefined }, now).eligible).toBe(false);
  });

  it('pass calibration at 17 of 20, not 16', () => {
    expect(calibrationPassed({ ...ready, calibration: [...Array(17).fill(true), ...Array(3).fill(false)] })).toBe(true);
    expect(calibrationPassed({ ...ready, calibration: [...Array(16).fill(true), ...Array(4).fill(false)] })).toBe(false);
  });

  it('quality is the last 20 controls at 5% each: active ≥85, pause <75', () => {
    const controls = (right: number) => [...Array(right).fill(true), ...Array(20 - right).fill(false)];
    expect(quality({ ...ready, controls: controls(17) })).toBe(85);
    expect(status({ ...ready, controls: controls(17) }, now)).toBe('active');
    expect(status({ ...ready, controls: controls(16) }, now)).toBe('probation');
    expect(status({ ...ready, controls: controls(15) }, now)).toBe('probation');
    expect(status({ ...ready, controls: controls(14) }, now)).toBe('paused');
    expect(status({ ...ready, revokedAt: '2026-09-01' }, now)).toBe('revoked');
  });

  it('caps at 20 an hour and 100 a day', () => {
    const minutes = (n: number, spacing: number) =>
      Array.from({ length: n }, (_, i) => new Date(now.getTime() - (i + 1) * spacing * 60_000).toISOString());
    expect(withinCaps(minutes(19, 1), now)).toBe(true);
    expect(withinCaps(minutes(20, 1), now)).toBe(false);
    expect(withinCaps(minutes(100, 10), now)).toBe(false);
  });

  it('recuse from their own reports, communities they lead, and block relationships', () => {
    const args = { volunteerId: 'v', reporterIds: [], ledCommunities: [], caseCommunityId: 'c', blockedEitherWay: false };
    expect(mustRecuse(args)).toBe(false);
    expect(mustRecuse({ ...args, reporterIds: ['v'] })).toBe(true);
    expect(mustRecuse({ ...args, ledCommunities: ['c'] })).toBe(true);
    expect(mustRecuse({ ...args, blockedEitherWay: true })).toBe(true);
  });
});

describe('scoped aliases', () => {
  const on = communityFlags({ VITE_SCOPED_PSEUDONYMITY: 'sandbox' });
  const support: AliasCommunity = { id: 'firstgen', type: 'support', pseudonymityApproved: true };
  const other: AliasCommunity = { id: 'disab', type: 'support', pseudonymityApproved: true };

  it('are off unless the flag is on and the community approved', () => {
    expect(() => new AliasRegistry(communityFlags({})).claim(support, 'a', 'Navigator1', now)).toThrow(AliasRefused);
    const reg = new AliasRegistry(on);
    expect(() => reg.claim({ ...support, pseudonymityApproved: false }, 'a', 'Navigator1', now)).toThrow(AliasRefused);
    expect(() => reg.claim({ id: 'c', type: 'course', pseudonymityApproved: true }, 'a', 'Navigator1', now)).toThrow(AliasRefused);
  });

  it('are unique within one community and invisible from any other', () => {
    const reg = new AliasRegistry(on);
    reg.claim(support, 'a', 'Navigator1', now);
    expect(() => reg.claim(support, 'b', 'navigator1', now)).toThrow(AliasRefused);
    // The same name elsewhere is a different, unrelated alias.
    reg.claim(other, 'b', 'Navigator1', now);
    expect(reg.aliasIn('firstgen', 'a')).toBe('Navigator1');
    expect(reg.aliasIn('disab', 'a')).toBeUndefined();
    expect(reg.search('disab', 'Nav')).toEqual(['Navigator1']);
    expect(reg.search('elsewhere', 'Nav')).toEqual([]);
  });

  it('rotate unless a preservation hold applies', () => {
    const reg = new AliasRegistry(on);
    reg.claim(support, 'a', 'Navigator1', now);
    expect(() => reg.rotate(support, 'a', 'Pathfinder2', now, true)).toThrow(AliasRefused);
    expect(reg.rotate(support, 'a', 'Pathfinder2', now, false).name).toBe('Pathfinder2');
  });

  it('never message and post under tighter limits', () => {
    const c: Community = { id: 'm', tenantId: 't', type: 'peer_mentorship', name: 'm', purpose: 'p', verification: 'institution_verified', pseudonymityApproved: false };
    expect(messagingMode(c, { alias: 'Navigator1' })).toBe('none');
    expect(messagingMode(c, {})).toBe('structured_request');
    expect(rateLimitFor({ alias: 'x' })).toBe(ALIAS_RATE_LIMIT);
  });
});

describe('account safety state', () => {
  const on = communityFlags({ VITE_ACCOUNT_SAFETY_STATE: 'sandbox' });
  const outcome = { caseId: 'c1', severity: 'P1' as const, reasonCode: 'harassment', actorId: 'pro', actorKind: 'professional', at: now.toISOString() };

  it('does nothing while switched off', () => {
    expect(recordOutcome(communityFlags({}), [], outcome)).toEqual([]);
  });

  it('moves only on professional decisions and reverses on appeal', () => {
    expect(() => recordOutcome(on, [], { ...outcome, actorKind: 'automation' })).toThrow(SafetyStateRefused);
    const entries = recordOutcome(on, [], outcome);
    expect(safetyValue(entries)).toBe(80);
    expect(safetyValue(reverse(entries, 'c1', now.toISOString()))).toBe(100);
  });

  it('staff see a number, the student sees words, nobody else sees anything', () => {
    const entries = recordOutcome(on, [], outcome);
    expect(readSafetyState('trust_and_safety', entries)).toBe(80);
    expect(typeof readSafetyState('student', entries)).toBe('string');
    for (const r of ['peer', 'volunteer', 'advisor', 'admin'] as const) expect(readSafetyState(r, entries)).toBeNull();
  });
});

describe('communities and study sessions', () => {
  const course: Community = { id: 'psy101', tenantId: 't', type: 'course', name: 'PSY 101', purpose: 'Study', verification: 'faculty_approved', pseudonymityApproved: false };
  const support: Community = { ...course, id: 'fg', type: 'support' };
  const bulletin: Community = { ...course, id: 'b', type: 'campus_bulletin' };
  const host: Membership = { communityId: 'psy101', accountId: 'h', role: 'member', joinedAt: '' };
  const library: Venue = { id: 'lib', name: 'Central Library', kind: 'library' };
  const session = { id: 's', community: course, host, venue: library, approvedVenues: [library], startsAt: '2026-09-28T18:00:00Z', endsAt: '2026-09-28T19:00:00Z', capacity: 3 };

  it('support membership is never visible to others', () => {
    expect(membershipVisibleTo(support, true)).toBe(false);
    expect(membershipVisibleTo(course, true)).toBe(true);
    expect(membershipVisibleTo(course, false)).toBe(false);
  });

  it('closed types only let hosts post; restricted members never post', () => {
    expect(mayPost(course, host, false)).toBe(true);
    expect(mayPost(course, host, true)).toBe(false);
    expect(mayPost(bulletin, { ...host, communityId: 'b' }, false)).toBe(false);
    expect(mayPost(bulletin, { ...host, communityId: 'b', role: 'host' }, false)).toBe(true);
  });

  it('sessions need an approved venue — no home addresses', () => {
    expect(() => createSession({ ...session, venue: { id: 'home', name: '12 Elm St', kind: 'library' } })).toThrow(CommunityRefused);
    expect(createSession(session).participants).toEqual(['h']);
  });

  it('sessions have capacity and respect blocks without saying who blocked whom', () => {
    let s = createSession(session);
    s = joinSession(s, 'a', () => false);
    s = joinSession(s, 'b', () => false);
    expect(() => joinSession(s, 'c', () => false)).toThrow('This session is full.');
    const small = createSession(session);
    expect(() => joinSession(small, 'x', (p) => p === 'h')).toThrow('You can’t join this session.');
  });

  it('matching uses coarse volunteered availability', () => {
    expect(overlap(['mon-evening', 'tue-morning'], ['tue-morning', 'wed-evening'])).toEqual(['tue-morning']);
  });
});
