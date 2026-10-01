import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REFUSALS } from './decision';

/**
 * The dining client's contract with `20260929330000_dining.sql`: which RPC,
 * which argument names, which columns become which fields; that every
 * `dining: <code>: …` the database raises becomes a refusal with that code and
 * plain words; and that no balance is labelled the card office's unless the
 * connection is live.
 */

interface Reply {
  data?: unknown;
  error?: { message: string } | null;
}

const calls: { kind: 'rpc' | 'from'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply>();
const who = vi.hoisted(() => ({ user: 'stu-1' as string | null, school: 'vu', grants: [] as { capability: string; scopeKind: string; scopeId: string }[] }));

function chain(kind: 'rpc' | 'from', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'eq', 'limit', 'gte']) {
    self[m] = (...a: unknown[]) => {
      call.chain.push(`${m}(${a.map((x) => JSON.stringify(x)).join(',')})`);
      return self;
    };
  }
  return self;
}

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: who.user ? { id: who.user } : null } }) },
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
    from: (name: string) => chain('from', name),
  }),
}));
vi.mock('../schoolclaim', () => ({ claimedSchoolOrThrow: async () => who.school }));
vi.mock('../capabilities', async (orig) => ({ ...(await orig<object>()), loadMyCapabilities: async () => who.grants }));

import {
  REFUSAL_WORDS,
  advanceOrder,
  balanceFigures,
  cancelOrder,
  donateSwipes,
  loadBalances,
  loadPlaces,
  loadPoolSummary,
  loadQueue,
  openDining,
  placeOrder,
  refusalOf,
  setOrdering,
  type Balances,
} from './client';

const NOW = Date.parse('2026-09-29T17:00:00Z');

beforeEach(() => {
  calls.length = 0;
  replies.clear();
  who.user = 'stu-1';
  who.school = 'vu';
  who.grants = [];
  // The school names no role and no cohort unless a test says otherwise.
  replies.set('rpc:feature_narrowing', { data: [] });
});

describe('the gate', () => {
  it('is off when the school’s row says off, through the one flag evaluator', async () => {
    replies.set('rpc:feature_state', { data: 'off' });
    replies.set('from:feature_kill_switch', { data: [] });
    const o = await openDining(new Date(NOW));
    expect(calls.find((c) => c.name === 'feature_state')?.args).toEqual({ want_capability: 'module.dining', want_tenant: 'vu' });
    expect(o.kind === 'ready' && o.context.on).toBe(false);
  });

  it('keeps production closed without an activation receipt, with kill switches still taking precedence', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    replies.set('from:feature_kill_switch', { data: [] });
    const on = await openDining(new Date(NOW));
    expect(on.kind === 'ready' && on.context).toMatchObject({ on: false, moduleState: 'production', reason: expect.stringContaining('activation receipt') });
    replies.set('from:feature_kill_switch', { data: [{ switch_key: 'kill.writeback', tenant_id: 'vu', engaged: true }] });
    const killed = await openDining(new Date(NOW));
    expect(killed.kind === 'ready' && killed.context).toMatchObject({ on: false, moduleState: 'production' });
    expect(killed.kind === 'ready' && killed.context.reason).toContain('kill');
  });

  it('reports dining:operate only when it is held over this school', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    who.grants = [{ capability: 'dining:operate', scopeKind: 'school', scopeId: 'other' }];
    const o = await openDining(new Date(NOW));
    expect(o.kind === 'ready' && o.context.capabilities).toEqual([]);
  });

  const narrowed = (row: Record<string, string[]>) =>
    replies.set('rpc:feature_narrowing', { data: [{ permitted_roles: [], permitted_cohorts: [], roles: [], cohorts: [], ...row }] });

  it('asks feature_narrowing about dining at this school, and nothing about anybody else', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    await openDining(new Date(NOW));
    expect(calls.find((c) => c.name === 'feature_narrowing')?.args).toEqual({ want_capability: 'module.dining', want_tenant: 'vu' });
  });

  it('refuses a student outside the dining cohort before requiring activation for a member', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    narrowed({ permitted_cohorts: ['dining-pilot'] });
    const out = await openDining(new Date(NOW));
    expect(out.kind === 'ready' && out.context).toMatchObject({ on: false, moduleState: 'production' });
    expect(out.kind === 'ready' && out.context.reason).toContain('release cohort');
    narrowed({ permitted_cohorts: ['dining-pilot'], cohorts: ['dining-pilot'] });
    const member = await openDining(new Date(NOW));
    expect(member.kind === 'ready' && member.context).toMatchObject({ on: false, reason: expect.stringContaining('activation receipt') });
  });

  it('refuses students in a staff-only preview before requiring activation for staff', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    narrowed({ permitted_roles: ['university_staff'] });
    const student = await openDining(new Date(NOW));
    expect(student.kind === 'ready' && student.context.on).toBe(false);
    expect(student.kind === 'ready' && student.context.reason).toContain('other roles');
    narrowed({ permitted_roles: ['university_staff'], roles: ['university_staff'] });
    const staff = await openDining(new Date(NOW));
    expect(staff.kind === 'ready' && staff.context).toMatchObject({ on: false, reason: expect.stringContaining('activation receipt') });
  });

  it('still requires activation when the school names no role and no cohort', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    narrowed({});
    const o = await openDining(new Date(NOW));
    expect(o.kind === 'ready' && o.context).toMatchObject({ on: false, reason: expect.stringContaining('activation receipt') });
  });

  it('throws, rather than opening, when the narrowing cannot be read', async () => {
    replies.set('rpc:feature_state', { data: 'production' });
    replies.set('rpc:feature_narrowing', { error: { message: 'Failed to fetch' } });
    await expect(openDining(new Date(NOW))).rejects.toMatchObject({ code: 'network' });
    // An answer in the wrong shape is not an answer.
    replies.set('rpc:feature_narrowing', { data: [{ permitted_roles: [], permitted_cohorts: ['dining-pilot'] }] });
    await expect(openDining(new Date(NOW))).rejects.toMatchObject({ code: 'network' });
  });

  it('throws when the flag cannot be read, rather than reading as off', async () => {
    replies.set('rpc:feature_state', { error: { message: 'Failed to fetch' } });
    await expect(openDining(new Date(NOW))).rejects.toMatchObject({ code: 'network' });
  });
});

describe('refusals', () => {
  it('turns every code the database raises into its own plain words', () => {
    for (const code of REFUSALS) {
      const r = refusalOf(`dining: ${code}: the database's sentence`, 'fallback');
      expect(r.code).toBe(code);
      expect(r.message).toBe(REFUSAL_WORDS[code]);
    }
  });

  it('says a lost answer may not have gone through and that retrying is safe', () => {
    const r = refusalOf('TypeError: Failed to fetch', 'fallback');
    expect(r.code).toBe('network');
    expect(r.message).toContain('trying again is safe');
    expect(refusalOf('something else', 'The fallback.').message).toBe('The fallback.');
  });
});

describe('balances', () => {
  const b: Balances = { planTerm: '2026FA', swipesLeft: 3, diningCents: 1000, campusCents: 0, partnerStatus: 'live', partnerLastSuccess: NOW - 10 * 60_000 };

  it('reads my_dining_balances into typed figures', async () => {
    replies.set('rpc:my_dining_balances', {
      data: [{ plan_term: '2026FA', swipes_left: 3, dining_cents: '1000', campus_cents: 0, partner_status: 'degraded', partner_last_success: '2026-09-29T16:50:00Z' }],
    });
    expect(await loadBalances()).toEqual({ ...b, partnerStatus: 'degraded' });
  });

  it('labels live, fresh figures institution verified, with their age', () => {
    const f = balanceFigures(b, NOW);
    expect([f.swipes?.label, f.diningCents?.label, f.campusCents.label]).toEqual(['institution_verified', 'institution_verified', 'institution_verified']);
    expect(f.authoritative).toBe(true);
    expect(f.campusCents.at).toBe(NOW - 10 * 60_000);
  });

  it('labels a live read older than the freshness target for review', () => {
    expect(balanceFigures({ ...b, partnerLastSuccess: NOW - 3 * 3_600_000 }, NOW).campusCents.label).toBe('needs_review');
  });

  it('calls nothing official without a live connection: Semester’s own sums, estimated, with no borrowed age', () => {
    for (const partnerStatus of ['not_connected', 'pending', 'degraded', 'disconnected'] as const) {
      const f = balanceFigures({ ...b, partnerStatus }, NOW);
      expect(f.authoritative).toBe(false);
      expect([f.swipes?.label, f.diningCents?.label, f.campusCents.label]).toEqual(['estimated', 'estimated', 'estimated']);
      expect(f.campusCents.at).toBeNull();
    }
  });

  it('draws no swipe or dining-dollar figure when no plan covers today', () => {
    const f = balanceFigures({ ...b, planTerm: null, swipesLeft: null, diningCents: null }, NOW);
    expect(f.swipes).toBeNull();
    expect(f.diningCents).toBeNull();
  });
});

describe('places', () => {
  it('joins hours to their location and maps the menu', async () => {
    replies.set('from:dining_locations', { data: [{ id: 'l1', tenant_id: 'vu', name: 'Rand', time_zone: 'America/Chicago', capacity: 20, ordering_enabled: true, source_label: 'imported', source_updated_at: null }] });
    replies.set('from:dining_hours', { data: [{ location_id: 'l1', weekday: 2, opens_min: 420, closes_min: 1200 }] });
    replies.set('from:dining_menu_items', { data: [{ id: 'm1', location_id: 'l1', served_on: '2026-09-29', meal: 'lunch', name: 'Bowl', price_cents: 950, swipe_eligible: true, available: true, source_label: 'bogus', source_updated_at: null }] });
    const p = await loadPlaces(new Date(NOW));
    expect(p.locations[0]).toMatchObject({ id: 'l1', hours: [{ weekday: 2, opensAt: 420, closesAt: 1200 }], source: 'imported', sourceAt: null });
    // A label the five do not include is doubtful, never quietly official.
    expect(p.menu[0]).toMatchObject({ priceCents: 950, swipeEligible: true, source: 'needs_review' });
    expect(calls.find((c) => c.name === 'dining_menu_items')?.chain).toContain('gte("served_on","2026-09-28")');
  });
});

describe('writes and the counter', () => {
  it('sends each RPC its argument names; the consent version is the current one', async () => {
    replies.set('rpc:dining_advance_order', { data: 'ready' });
    replies.set('rpc:dining_set_ordering', { data: false });
    await placeOrder('l1', ['m1', 'm2'], 'dining_cents', 'key-0001');
    await cancelOrder('o1', 'Changed my mind');
    await donateSwipes(2, 'key-0002');
    expect(await advanceOrder('o1', 'ready')).toBe('ready');
    expect(await setOrdering('l1', false)).toBe(false);
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['dining_place_order', { want_location: 'l1', want_items: ['m1', 'm2'], want_pay: 'dining_cents', want_key: 'key-0001' }],
      ['dining_cancel_order', { want_order: 'o1', want_reason: 'Changed my mind' }],
      ['dining_donate_swipes', { want_swipes: 2, want_consent: 'dining-share-v1', want_key: 'key-0002' }],
      ['dining_advance_order', { want_order: 'o1', want_status: 'ready' }],
      ['dining_set_ordering', { want_location: 'l1', want_enabled: false }],
    ]);
  });

  it('reads the queue and the pool through their functions, never the tables', async () => {
    replies.set('rpc:dining_order_queue', { data: [{ id: 'o1', location_id: 'l1', student: 's', status: 'placed', paid_with: 'swipe', items: ['m1'], placed_at: '2026-09-29T16:59:00Z' }] });
    replies.set('rpc:dining_pool_summary', { data: [{ donated: 5, drawn: 2, available: 3 }] });
    const q = await loadQueue();
    expect(q[0]).toEqual({ id: 'o1', locationId: 'l1', status: 'placed', paidWith: 'swipe', items: ['m1'], placedAt: Date.parse('2026-09-29T16:59:00Z') });
    expect(await loadPoolSummary()).toEqual({ donated: 5, drawn: 2, available: 3 });
    expect(calls.filter((c) => c.kind === 'from')).toEqual([]);
  });

  it('throws a refusal with the database’s code', async () => {
    replies.set('rpc:dining_place_order', { error: { message: 'dining: partner_unavailable: the card office is not connected, so nothing can be charged' } });
    await expect(placeOrder('l1', ['m1'], 'swipe', 'key-0003')).rejects.toMatchObject({
      code: 'partner_unavailable',
      message: REFUSAL_WORDS.partner_unavailable,
    });
  });
});
