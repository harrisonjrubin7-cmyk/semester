import { describe, expect, it } from 'vitest';
import {
  allowlisted,
  communityRef,
  identityLeaks,
  isOpaqueId,
  isVerified,
  opaqueId,
  publicAuthor,
  viewIdentity,
  type Account,
  type JitGrant,
  type PresentationProfile,
} from './identity';

const now = new Date('2026-09-27T12:00:00Z');
const account: Account = {
  accountId: 'sem_0123456789ABCDEFGHJKMNPQRS',
  tenantId: 'nvu',
  verification: { state: 'verified_student', expiresAt: '2027-05-31' },
  vaultRef: 'vault://nvu/abc',
};
const profile: PresentationProfile = { accountId: account.accountId, displayName: 'Jordan', pronouns: 'they/them' };
const grant: JitGrant = {
  granteeId: 'pro-1',
  caseId: 'case-1',
  reason: 'Doxxing report requires identity check',
  approvedBy: 'pro-2',
  expiresAt: '2026-09-27T13:00:00Z',
};

describe('opaque ids', () => {
  it('are random, prefixed and non-sequential', () => {
    const ids = Array.from({ length: 200 }, () => opaqueId());
    expect(ids.every((id) => isOpaqueId(id))).toBe(true);
    expect(new Set(ids).size).toBe(200);
  });

  it('rejects row numbers and email-derived ids', () => {
    expect(isOpaqueId('sem_42')).toBe(false);
    expect(isOpaqueId('jordan@nvu.edu')).toBe(false);
  });
});

describe('verification', () => {
  it('expires', () => {
    expect(isVerified(account, now)).toBe(true);
    expect(isVerified(account, new Date('2027-06-01'))).toBe(false);
    expect(isVerified({ ...account, verification: { state: 'revoked' } }, now)).toBe(false);
  });
});

describe('peer-facing payloads', () => {
  it('carry a display name and a per-community ref, never the account id', () => {
    const author = publicAuthor(profile, 'c1');
    expect(identityLeaks({ author })).toEqual([]);
    expect(JSON.stringify(author)).not.toContain(account.accountId);
  });

  it('refs differ across communities, so two communities cannot be joined', () => {
    expect(communityRef(account.accountId, 'c1')).not.toBe(communityRef(account.accountId, 'c2'));
    expect(communityRef(account.accountId, 'c1')).toBe(communityRef(account.accountId, 'c1'));
  });

  it('an alias hides pronouns too', () => {
    expect(publicAuthor(profile, 'c1', 'FirstYearNavigator')).not.toHaveProperty('pronouns');
  });

  it('the leak scan finds forbidden fields at any depth (control)', () => {
    const leaky = { items: [{ author: { name: 'x', email: 'j@nvu.edu' } }], meta: { reporterId: 'r' } };
    expect(identityLeaks(leaky)).toEqual(['items[0].author.email', 'meta.reporterId']);
  });

  it('allowlisted drops fields nobody named', () => {
    const out = allowlisted({ ...profile, legalName: 'Jordan R.' } as PresentationProfile & { legalName: string }, [
      'displayName',
    ]);
    expect(out).toEqual({ displayName: 'Jordan' });
  });
});

describe('restricted identity access', () => {
  const base = { account, profile, communityId: 'c1', caseId: 'case-1', now };

  it('peers, volunteers, liaisons and admins get presentation identity only', () => {
    for (const role of ['peer', 'volunteer', 'liaison', 'admin'] as const) {
      const { view } = viewIdentity({ ...base, role, actorId: 'x', grant });
      expect(view.level).toBe('presentation');
      expect(identityLeaks(view)).toEqual([]);
    }
  });

  it('a professional with a valid grant for this case gets a vault reference, audited', () => {
    const { view, audit } = viewIdentity({ ...base, role: 'professional', actorId: 'pro-1', grant });
    expect(view.level).toBe('restricted');
    expect(audit).toMatchObject({ outcome: 'granted', caseId: 'case-1', actorId: 'pro-1' });
  });

  it.each([
    ['expired', { expiresAt: '2026-09-27T11:00:00Z' }],
    ['another case', { caseId: 'case-2' }],
    ['self-approved', { approvedBy: 'pro-1' }],
    ['no real reason', { reason: 'x' }],
    ['someone else’s grant', { granteeId: 'pro-3' }],
  ])('refuses a grant that is %s, and audits the refusal', (_, patch) => {
    const { view, audit } = viewIdentity({ ...base, role: 'professional', actorId: 'pro-1', grant: { ...grant, ...patch } });
    expect(view.level).toBe('presentation');
    expect(audit.outcome).toBe('refused');
  });
});
