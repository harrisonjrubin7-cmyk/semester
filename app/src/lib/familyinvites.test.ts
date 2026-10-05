import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  const order = vi.fn(() => Promise.resolve({ data: [], error: null }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select, update }));
  const rpc = vi.fn();
  return { rpc, from, update, eq };
});
vi.mock('./cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }) }));

const { claimInvite, inviteRequest, inviteState, makeInvite, normaliseCode, revokeInvite, sayClaim } = await import('./familyinvites');
const { newFamilyItem, newFamilyMember } = await import('./family');

const TODAY = '2026-09-27';
const plan = (expires = '2026-12-15') => {
  const m = { ...newFamilyMember(), name: 'Mom', expires };
  m.permissions.finances = 'selected';
  const bill = { ...newFamilyItem(m.id), category: 'finances' as const, title: 'Spring bill' };
  const hidden = { ...newFamilyItem(m.id), category: 'academic' as const, title: 'Not granted' };
  return { m, items: [bill, hidden], bill };
};

beforeEach(() => {
  mock.rpc.mockReset();
  mock.eq.mockClear();
  mock.update.mockClear();
});

describe('what a code is asked for', () => {
  it('carries only the chosen items, and only their categories', () => {
    const { m, items, bill } = plan();
    expect(inviteRequest(m, items, TODAY)).toEqual({ categories: ['finances'], resources: [bill.id], days: 80 });
  });

  it('never asks for more than 200 days, even for a plan ending exactly then', () => {
    const { m, items } = plan('2027-04-15'); // 200 days out
    expect(inviteRequest(m, items, TODAY)).toMatchObject({ days: 200 });
  });

  it('refuses a plan that breaks the sharing rules, and says why', () => {
    const { m, items } = plan('');
    expect(inviteRequest(m, items, TODAY)).toEqual({ problems: [expect.stringMatching(/Needs an end date/)] });
  });

  it('asks the database for selected access, and nothing wider', async () => {
    mock.rpc.mockResolvedValue({ data: 'K7M2Q9ZP', error: null });
    expect(await makeInvite({ categories: ['finances'], resources: ['b1'], days: 80 })).toBe('K7M2Q9ZP');
    expect(mock.rpc).toHaveBeenCalledWith('make_family_invite', { want_categories: ['finances'], want_access: 'selected', want_resources: ['b1'], want_days: 80 });
  });
});

describe('claiming', () => {
  it('reads a code the way people type it, and refuses what cannot be one', () => {
    expect(normaliseCode(' k7m2-q9zp ')).toBe('K7M2Q9ZP');
    expect(normaliseCode('K7M2Q9Z0')).toBe(''); // 0 is not in the alphabet
    expect(normaliseCode('K7M2Q9Z')).toBe('');
  });

  it('passes the database word through, and never says whether a dead code was real', async () => {
    mock.rpc.mockResolvedValue({ data: 'unknown', error: null });
    expect(await claimInvite('K7M2Q9ZP')).toBe('unknown');
    expect(mock.rpc).toHaveBeenCalledWith('claim_family_invite', { given: 'K7M2Q9ZP' });
    expect(sayClaim('unknown')).not.toMatch(/expired|revoked|called off/i);
    expect(sayClaim('taken')).toMatch(/already been used/);
  });
});

describe('the student’s own codes', () => {
  it('calls off a code by setting revoked_at, the one write allowed', async () => {
    await revokeInvite('K7M2Q9ZP');
    expect(mock.update).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
    expect(Object.keys((mock.update.mock.calls[0] as unknown[])[0] as object)).toEqual(['revoked_at']);
    expect(mock.eq).toHaveBeenCalledWith('code', 'K7M2Q9ZP');
  });

  it('says where each code stands', () => {
    const row = { code: 'K7M2Q9ZP', categories: [], resourceIds: [], expiresAt: '2026-10-04T00:00:00Z', grantExpiresAt: '2026-12-15T00:00:00Z', claimedAt: null, revokedAt: null };
    const now = new Date('2026-09-28T00:00:00Z');
    expect(inviteState(row, now)).toBe('Waiting · works until 2026-10-04');
    expect(inviteState({ ...row, claimedAt: '2026-09-29T10:00:00Z' }, now)).toBe('Accepted 2026-09-29');
    expect(inviteState({ ...row, revokedAt: '2026-09-29T10:00:00Z' }, now)).toBe('Called off');
    expect(inviteState(row, new Date('2026-10-05T00:00:00Z'))).toBe('Lapsed unclaimed');
  });
});
