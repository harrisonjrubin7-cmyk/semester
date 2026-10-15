import { describe, expect, it } from 'vitest';
import { FLAGS, flagDefinition, type FlagContext } from '../flags';
import type { Balance } from '../meals';
import {
  append, advanceOrder, balance, cancelOrder, CARD_TERM, claimedThisWeek, diningDollarsAtTermEnd, diningGate,
  donateSwipes, donorView, EMPTY_POOL, localParts, menuToday, mockPartner, openAt, orderQueue, placeOrder, poolAvailable,
  poolSummary, readBalances, recipientView, requireDining, SHARE_CONSENT_VERSION, swipesAvailable, activePlan,
  weekStartOf, type DiningContext, type DiningLocation, type DiningState, type LedgerEntry, type MealPlan,
  type MenuItem, type Order, type Student,
} from './index';

// ── Fixtures ────────────────────────────────────────────────────────────────
//
// One school in Chicago, whose plan week starts on Monday. In October Chicago
// is UTC−5, so a local time is that string at −05:00.

const TZ = 'America/Chicago';
const chi = (local: string) => Date.parse(`${local}:00-05:00`);

const NOON_MON = chi('2026-10-05T12:00'); // Monday
const SUN_LATE = chi('2026-10-11T23:50'); // the last ten minutes of that plan week
const MON_EARLY = chi('2026-10-12T00:10'); // the first ten of the next

const ANA: Student = { tenantId: 'vu', studentId: 'ana' };
const BO: Student = { tenantId: 'vu', studentId: 'bo' };
const CY: Student = { tenantId: 'vu', studentId: 'cy' }; // no meal plan
const ELSEWHERE: Student = { tenantId: 'other-u', studentId: 'dee' };
const STAFF = { tenantId: 'vu', mayOperate: true };

const RAND: DiningLocation = {
  id: 'rand', tenantId: 'vu', name: 'Rand', timeZone: TZ,
  // Every day 07:00 to midnight, and the late window after it.
  hours: [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => [
    { weekday, opensAt: 0, closesAt: 120 },
    { weekday, opensAt: 420, closesAt: 1440 },
  ]),
  capacity: 3, orderingEnabled: true, source: 'imported', sourceAt: chi('2026-10-01T09:00'),
};
const KISSAM: DiningLocation = {
  id: 'kissam', tenantId: 'vu', name: 'Kissam', timeZone: TZ,
  hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensAt: 660, closesAt: 840 })),
  capacity: 10, orderingEnabled: true, source: 'imported', sourceAt: chi('2026-10-01T09:00'),
};
const FAR: DiningLocation = { ...RAND, id: 'far', tenantId: 'other-u', name: 'Far' };

function menuFor(date: string, locationId = 'rand'): MenuItem[] {
  const base = { locationId, servedOn: date, available: true, source: 'imported' as const, sourceAt: chi('2026-10-01T09:00') };
  return [
    { ...base, id: `${locationId}.${date}.bowl`, meal: 'all_day', name: 'Grain bowl', priceCents: 895, swipeEligible: true },
    { ...base, id: `${locationId}.${date}.soup`, meal: 'all_day', name: 'Soup', priceCents: 450, swipeEligible: true },
    { ...base, id: `${locationId}.${date}.cake`, meal: 'all_day', name: 'Cake', priceCents: 375, swipeEligible: false },
    { ...base, id: `${locationId}.${date}.gone`, meal: 'all_day', name: 'Sold out', priceCents: 100, swipeEligible: true, available: false },
  ];
}

const plan = (studentId: string, over: Partial<MealPlan> = {}): MealPlan => ({
  id: `plan.${studentId}`, tenantId: 'vu', studentId, term: '2026FA', startsOn: '2026-08-24', endsOn: '2026-12-12',
  timeZone: TZ, weekStartsOn: 1, swipes: { kind: 'weekly', perWeek: 2 }, swipeRollover: 'none', diningCentsRollover: 'carry',
  ...over,
});

const deposit = (studentId: string, kind: LedgerEntry['kind'], delta: number, term = '2026FA'): LedgerEntry => ({
  id: `dep.${studentId}.${kind}`, tenantId: 'vu', studentId, term, kind, delta, appliesAt: chi('2026-08-24T08:00'),
  at: chi('2026-08-24T08:00'), reason: 'partner_sync', idempotencyKey: `sync.${studentId}.${kind}`, source: 'institution_verified',
});

function world(over: Partial<DiningState> = {}): DiningState {
  return {
    locations: [RAND, KISSAM, FAR],
    menu: [
      ...menuFor('2026-10-05'), ...menuFor('2026-10-11'), ...menuFor('2026-10-12'),
      ...menuFor('2026-10-05', 'kissam'), ...menuFor('2026-10-05', 'far'),
    ],
    plans: [plan('ana'), plan('bo')],
    ledger: [deposit('ana', 'dining_cents', 2000), deposit('ana', 'campus_cents', 500, CARD_TERM), deposit('bo', 'dining_cents', 300)],
    orders: [],
    pool: EMPTY_POOL,
    ...over,
  };
}

function flagCtx(over: Partial<FlagContext> = {}): FlagContext {
  const now = over.now ?? new Date(NOON_MON);
  return {
    environment: 'production', tenantId: 'vu', now, killSwitches: [],
    // Synthetic gate fixture only; this is not evidence of a live dining activation.
    activationReceipt: {
      decisionKey: 'activation:v1:test-dining', requestId: 'test-dining', tenantId: 'vu',
      capabilityId: 'CAP-047', operation: 'module.dining', policyVersion: 'test-policy', configurationVersion: 1,
      issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    },
    tenantPolicy: { 'module.dining': { state: 'production', permittedRoles: [], permittedCohorts: [] } }, capabilities: [], ...over,
  };
}

function ctx(now = NOON_MON, over: Partial<DiningContext> = {}, flag: Partial<FlagContext> = {}): DiningContext {
  return { flag: diningGate(flagCtx({ now: new Date(now), ...flag })), partner: { status: 'live', lastSuccessAt: now }, now, ...over };
}

const order = (items: string[], pay: Order['pay'] = 'swipe', key = 'key-order-0001') => ({ locationId: 'rand', items, pay, idempotencyKey: key });
const bowl = (date = '2026-10-05') => `rand.${date}.bowl`;

function must<T>(d: { ok: true; value: T } | { ok: false; code: string; reason: string }): T {
  if (!d.ok) throw new Error(`refused: ${d.code} — ${d.reason}`);
  return d.value;
}

// ── The flag ────────────────────────────────────────────────────────────────

describe('module.dining', () => {
  it('is registered off, high-risk, with both money switches', () => {
    const f = flagDefinition('module.dining')!;
    expect(f).toMatchObject({ type: 'module', defaultEnabled: false, highRisk: true });
    expect(f.killSwitches).toEqual(['kill.writeback', 'kill.integration_sync']);
    expect(FLAGS.filter((x) => x.key === 'module.dining')).toHaveLength(1);
  });

  it('is off for a school with no policy row, and says which gate', () => {
    const d = diningGate(flagCtx({ tenantPolicy: {} }));
    expect(d).toMatchObject({ allowed: false, step: 'tenant_entitlement' });
    expect(requireDining(d)).toMatchObject({ ok: false, code: 'flag_off' });
  });

  it('is off in production for a school only in preview', () => {
    expect(diningGate(flagCtx({ tenantPolicy: { 'module.dining': { state: 'preview', permittedRoles: [], permittedCohorts: [] } } })).allowed).toBe(false);
  });

  it('is stopped by the school’s kill.writeback, and reports it as a kill switch', () => {
    const d = diningGate(flagCtx({ killSwitches: [{ key: 'kill.writeback', tenantId: 'vu', engaged: true }] }));
    expect(requireDining(d)).toMatchObject({ ok: false, code: 'kill_switch' });
  });

  it('is on for a school in production with a scoped receipt (control)', () => {
    expect(diningGate(flagCtx()).allowed).toBe(true);
    expect(diningGate(flagCtx({ activationReceipt: null }))).toMatchObject({ allowed: false, step: 'activation_contract' });
  });
});

// ── Time ────────────────────────────────────────────────────────────────────

describe('local time and the plan week', () => {
  it('reads the school’s wall clock, not UTC', () => {
    // 04:30 UTC on the 12th is still the 11th in Chicago.
    expect(localParts(Date.parse('2026-10-12T04:30:00Z'), TZ)).toEqual({ date: '2026-10-11', weekday: 0, minutes: 23 * 60 + 30 });
  });

  it('starts a Monday week on the Monday, from any day in it', () => {
    expect(weekStartOf('2026-10-11', 1)).toBe('2026-10-05');
    expect(weekStartOf('2026-10-12', 1)).toBe('2026-10-12');
    expect(weekStartOf('2026-10-11', 0)).toBe('2026-10-11');
  });
});

// ── Locations and menus ─────────────────────────────────────────────────────

describe('locations', () => {
  it('is open inside a window and closed at its closing minute', () => {
    expect(openAt(KISSAM, chi('2026-10-05T13:59')).ok).toBe(true);
    const shut = openAt(KISSAM, chi('2026-10-05T14:00'));
    expect(shut).toMatchObject({ ok: false, code: 'closed' });
  });

  it('says where its hours came from when it refuses', () => {
    const shut = openAt(KISSAM, chi('2026-10-11T12:00'));
    expect(!shut.ok && shut.reason).toMatch(/Imported · Updated/);
  });

  it('shows today’s available items only, each price labelled with its source', () => {
    const lines = menuToday(RAND, world().menu, NOON_MON);
    expect(lines.map((l) => l.item.name)).toEqual(['Grain bowl', 'Soup', 'Cake']);
    expect(lines[0].price).toMatchObject({ value: 895, label: 'imported', authoritative: false });
    expect(lines[0].price.line).toMatch(/^\$8\.95 · Imported · Updated/);
  });
});

// ── The ledger ──────────────────────────────────────────────────────────────

describe('the card ledger', () => {
  const base = deposit('ana', 'dining_cents', 1000);
  const spend = (delta: number, key = 'spend-0001'): LedgerEntry => ({ ...base, id: key, delta, idempotencyKey: key, reason: 'order' });

  it('derives the balance by summing, and never edits', () => {
    const one = must(append([base], spend(-250)));
    expect(balance(one.ledger, base)).toBe(750);
    expect(Object.isFrozen(one.ledger)).toBe(true);
    expect(Object.isFrozen(one.entry)).toBe(true);
    expect(() => (one.entry as { delta: number }).delta = 0).toThrow();
  });

  it('refuses fractional, zero and non-finite money', () => {
    for (const delta of [-2.5, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(append([base], spend(delta)), String(delta)).toMatchObject({ ok: false, code: 'invalid' });
    }
  });

  it('refuses to go below zero', () => {
    expect(append([base], spend(-1001))).toMatchObject({ ok: false, code: 'insufficient_funds' });
    expect(append([base], spend(-1000)).ok).toBe(true);
  });

  it('answers a replay with the first entry, and refuses the key reused for something else', () => {
    const first = must(append([base], spend(-100)));
    const again = must(append(first.ledger, spend(-100)));
    expect(again.replayed).toBe(true);
    expect(again.ledger).toBe(first.ledger);
    expect(balance(again.ledger, base)).toBe(900);
    expect(append(first.ledger, spend(-200))).toMatchObject({ ok: false, code: 'idempotency_conflict' });
  });
});

// ── Plans ───────────────────────────────────────────────────────────────────

describe('meal plans', () => {
  it('finds no plan for a student without one, or outside its dates', () => {
    expect(activePlan([plan('ana')], 'vu', 'cy', NOON_MON)).toMatchObject({ ok: false, code: 'no_plan' });
    expect(activePlan([plan('ana')], 'vu', 'ana', chi('2026-12-13T12:00'))).toMatchObject({ ok: false, code: 'no_plan' });
    expect(activePlan([plan('ana')], 'other-u', 'ana', NOON_MON)).toMatchObject({ ok: false, code: 'no_plan' });
  });

  it('resets a weekly allowance at the week boundary, local midnight Monday', () => {
    let s = world();
    s = must(placeOrder(s, ctx(SUN_LATE), ANA, order([bowl('2026-10-11')], 'swipe', 'late-sun-0001'))).state;
    s = must(placeOrder(s, ctx(SUN_LATE), ANA, order([bowl('2026-10-11')], 'swipe', 'late-sun-0002'))).state;
    expect(swipesAvailable(plan('ana'), s.ledger, SUN_LATE)).toMatchObject({ ok: false, code: 'swipes_exhausted' });
    // Twenty minutes later it is a new plan week.
    expect(must(swipesAvailable(plan('ana'), s.ledger, MON_EARLY))).toMatchObject({ from: '2026-10-12', entitled: 2, used: 0, available: 2 });
  });

  it('carries unused swipes forward within the term when the plan says so', () => {
    const p = plan('ana', { swipeRollover: 'within_term' });
    // Week 7 of the term (from Monday 24 August): 7 × 2 entitled, none used.
    expect(must(swipesAvailable(p, [], NOON_MON))).toMatchObject({ from: '2026-08-24', to: '2026-10-12', entitled: 14, available: 14 });
  });

  it('counts a block plan over the whole term, with no weekly limit', () => {
    const p = plan('ana', { swipes: { kind: 'term', perTerm: 90 } });
    expect(must(swipesAvailable(p, [], NOON_MON))).toMatchObject({ entitled: 90, available: 90, to: '2026-12-13' });
  });

  it('has no swipes on a dollars-only plan', () => {
    expect(swipesAvailable(plan('ana', { swipes: { kind: 'none' } }), [], NOON_MON)).toMatchObject({ ok: false, code: 'swipes_exhausted' });
  });

  it('carries or forfeits dining dollars at the end of term, by the plan’s rule', () => {
    const ledger = [deposit('ana', 'dining_cents', 1234)];
    expect(diningDollarsAtTermEnd(plan('ana'), ledger)).toEqual({ balanceCents: 1234, carriedCents: 1234, forfeitedCents: 0 });
    expect(diningDollarsAtTermEnd(plan('ana', { diningCentsRollover: 'forfeit' }), ledger)).toEqual({ balanceCents: 1234, carriedCents: 0, forfeitedCents: 1234 });
  });
});

// ── Ordering ────────────────────────────────────────────────────────────────

describe('placing an order', () => {
  it('charges one swipe and queues the order (control)', () => {
    const r = must(placeOrder(world(), ctx(), ANA, order([bowl(), 'rand.2026-10-05.soup'])));
    expect(r.value).toMatchObject({ status: 'placed', pay: 'swipe', amount: 1, term: '2026FA' });
    expect(balance(r.state.ledger, { tenantId: 'vu', studentId: 'ana', term: '2026FA', kind: 'swipe' })).toBe(-1);
  });

  it('answers a duplicate with the same order and charges once', () => {
    const first = must(placeOrder(world(), ctx(), ANA, order([bowl()])));
    const again = must(placeOrder(first.state, ctx(NOON_MON + 5_000), ANA, order([bowl()])));
    expect(again.replayed).toBe(true);
    expect(again.value.id).toBe(first.value.id);
    expect(again.state.orders).toHaveLength(1);
    expect(again.state.ledger.filter((e) => e.reason === 'order')).toHaveLength(1);
  });

  it('answers a duplicate even after the location has closed', () => {
    const first = must(placeOrder(world(), ctx(), ANA, order([bowl()])));
    const closedAt = chi('2026-10-06T03:00');
    expect(must(placeOrder(first.state, ctx(closedAt), ANA, order([bowl()]))).replayed).toBe(true);
  });

  it('refuses the same key for a different order', () => {
    const first = must(placeOrder(world(), ctx(), ANA, order([bowl()])));
    expect(placeOrder(first.state, ctx(), ANA, order(['rand.2026-10-05.soup']))).toMatchObject({ ok: false, code: 'idempotency_conflict' });
  });

  it('refuses when the flag is off, or killed, and charges nothing', () => {
    const off = placeOrder(world(), ctx(NOON_MON, {}, { tenantPolicy: {} }), ANA, order([bowl()]));
    expect(off).toMatchObject({ ok: false, code: 'flag_off' });
    const killed = placeOrder(world(), ctx(NOON_MON, {}, { killSwitches: [{ key: 'kill.integration_sync', tenantId: null, engaged: true }] }), ANA, order([bowl()]));
    expect(killed).toMatchObject({ ok: false, code: 'kill_switch' });
  });

  it('refuses when the card office is not live', () => {
    for (const status of ['not_connected', 'pending', 'degraded', 'disconnected'] as const) {
      const r = placeOrder(world(), ctx(NOON_MON, { partner: { status, lastSuccessAt: null } }), ANA, order([bowl()]));
      expect(r, status).toMatchObject({ ok: false, code: 'partner_unavailable' });
    }
  });

  it('refuses at a closed location', () => {
    const r = placeOrder(world(), ctx(chi('2026-10-05T15:00')), ANA, { ...order(['kissam.2026-10-05.bowl']), locationId: 'kissam' });
    expect(r).toMatchObject({ ok: false, code: 'closed' });
  });

  it('refuses where ordering is paused', () => {
    const r = placeOrder(world({ locations: [{ ...RAND, orderingEnabled: false }] }), ctx(), ANA, order([bowl()]));
    expect(r).toMatchObject({ ok: false, code: 'ordering_paused' });
  });

  it('does not find another school’s location', () => {
    const r = placeOrder(world(), ctx(), ANA, { ...order(['far.2026-10-05.bowl']), locationId: 'far' });
    expect(r).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('refuses an item not on today’s menu, or sold out', () => {
    expect(placeOrder(world(), ctx(), ANA, order([bowl('2026-10-12')]))).toMatchObject({ ok: false, code: 'item_unavailable' });
    expect(placeOrder(world(), ctx(), ANA, order(['rand.2026-10-05.gone']))).toMatchObject({ ok: false, code: 'item_unavailable' });
  });

  it('refuses a swipe for an item a swipe does not cover', () => {
    expect(placeOrder(world(), ctx(), ANA, order(['rand.2026-10-05.cake']))).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('holds a location to its capacity of open orders, and frees a place when one is picked up', () => {
    let s = world({ plans: ['a', 'b', 'c', 'd'].map((id) => plan(id)) });
    for (const id of ['a', 'b', 'c']) s = must(placeOrder(s, ctx(), { tenantId: 'vu', studentId: id }, order([bowl()]))).state;
    const full = placeOrder(s, ctx(), { tenantId: 'vu', studentId: 'd' }, order([bowl()]));
    expect(full).toMatchObject({ ok: false, code: 'at_capacity' });
    const first = s.orders[0].id;
    for (const to of ['accepted', 'ready', 'picked_up'] as const) s = must(advanceOrder(s, ctx(), STAFF, { orderId: first, to })).state;
    expect(placeOrder(s, ctx(), { tenantId: 'vu', studentId: 'd' }, order([bowl()])).ok).toBe(true);
  });

  it('refuses a third swipe in a two-swipe week', () => {
    let s = world();
    s = must(placeOrder(s, ctx(), ANA, order([bowl()], 'swipe', 'week-swipe-1'))).state;
    s = must(placeOrder(s, ctx(), ANA, order([bowl()], 'swipe', 'week-swipe-2'))).state;
    expect(placeOrder(s, ctx(), ANA, order([bowl()], 'swipe', 'week-swipe-3'))).toMatchObject({ ok: false, code: 'swipes_exhausted' });
  });

  it('prices a dining-dollars order from the menu, never from the request', () => {
    const r = must(placeOrder(world(), ctx(), ANA, order([bowl(), 'rand.2026-10-05.cake'], 'dining_cents')));
    expect(r.value.amount).toBe(895 + 375);
    expect(balance(r.state.ledger, { tenantId: 'vu', studentId: 'ana', term: '2026FA', kind: 'dining_cents' })).toBe(2000 - 1270);
  });

  it('refuses dining dollars the balance does not cover', () => {
    expect(placeOrder(world(), ctx(), BO, order([bowl()], 'dining_cents'))).toMatchObject({ ok: false, code: 'insufficient_funds' });
  });

  it('charges campus cash to the card, not to a term', () => {
    const r = must(placeOrder(world(), ctx(), ANA, order(['rand.2026-10-05.soup'], 'campus_cents')));
    expect(r.value.term).toBe(CARD_TERM);
    expect(balance(r.state.ledger, { tenantId: 'vu', studentId: 'ana', term: CARD_TERM, kind: 'campus_cents' })).toBe(50);
  });

  it('refuses a student with no plan a swipe', () => {
    expect(placeOrder(world(), ctx(), CY, order([bowl()]))).toMatchObject({ ok: false, code: 'no_plan' });
  });
});

describe('moving and cancelling an order', () => {
  const placed = () => must(placeOrder(world(), ctx(), ANA, order([bowl()])));

  it('walks placed → accepted → ready → picked up, and not backwards', () => {
    let { state, value } = placed();
    for (const to of ['accepted', 'ready', 'picked_up'] as const) state = must(advanceOrder(state, ctx(), STAFF, { orderId: value.id, to })).state;
    const done = state.orders[0];
    expect(done.history.map((h) => h.status)).toEqual(['placed', 'accepted', 'ready', 'picked_up']);
    expect(advanceOrder(state, ctx(), STAFF, { orderId: value.id, to: 'ready' })).toMatchObject({ ok: false, code: 'bad_transition' });
    expect(cancelOrder(state, ctx(), { kind: 'staff', ...STAFF }, { orderId: value.id, reason: '' })).toMatchObject({ ok: false, code: 'bad_transition' });
  });

  it('answers a repeated move without a second history row', () => {
    const { state, value } = placed();
    const once = must(advanceOrder(state, ctx(), STAFF, { orderId: value.id, to: 'accepted' }));
    const twice = must(advanceOrder(once.state, ctx(), STAFF, { orderId: value.id, to: 'accepted' }));
    expect(twice.replayed).toBe(true);
    expect(twice.value.history).toHaveLength(2);
  });

  it('refuses staff without dining:operate, and staff at another school', () => {
    const { state, value } = placed();
    expect(advanceOrder(state, ctx(), { tenantId: 'vu', mayOperate: false }, { orderId: value.id, to: 'accepted' })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(advanceOrder(state, ctx(), { tenantId: 'other-u', mayOperate: true }, { orderId: value.id, to: 'accepted' })).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('lets a student cancel until the counter accepts, and refunds the swipe', () => {
    const { state, value } = placed();
    const r = must(cancelOrder(state, ctx(), { kind: 'student', ...ANA }, { orderId: value.id, reason: 'Changed my mind' }));
    expect(r.value.status).toBe('cancelled');
    expect(balance(r.state.ledger, { tenantId: 'vu', studentId: 'ana', term: '2026FA', kind: 'swipe' })).toBe(0);
    const again = must(cancelOrder(r.state, ctx(), { kind: 'student', ...ANA }, { orderId: value.id, reason: '' }));
    expect(again.replayed).toBe(true);
    expect(again.state.ledger.filter((e) => e.reason === 'refund')).toHaveLength(1);
  });

  it('does not let a student cancel once accepted, or cancel somebody else’s', () => {
    const { state, value } = placed();
    const accepted = must(advanceOrder(state, ctx(), STAFF, { orderId: value.id, to: 'accepted' })).state;
    expect(cancelOrder(accepted, ctx(), { kind: 'student', ...ANA }, { orderId: value.id, reason: '' })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(cancelOrder(state, ctx(), { kind: 'student', ...BO }, { orderId: value.id, reason: '' })).toMatchObject({ ok: false, code: 'not_found' });
    expect(must(cancelOrder(accepted, ctx(), { kind: 'staff', ...STAFF }, { orderId: value.id, reason: 'Out of bowls' })).value.status).toBe('cancelled');
  });

  it('still cancels and refunds with the kill switch engaged and the card office down', () => {
    const { state, value } = placed();
    const stopped = ctx(NOON_MON, { partner: { status: 'disconnected', lastSuccessAt: null } }, {
      killSwitches: [{ key: 'kill.writeback', tenantId: 'vu', engaged: true }],
    });
    const r = must(cancelOrder(state, stopped, { kind: 'student', ...ANA }, { orderId: value.id, reason: '' }));
    expect(balance(r.state.ledger, { tenantId: 'vu', studentId: 'ana', term: '2026FA', kind: 'swipe' })).toBe(0);
  });

  it('gives a swipe cancelled after midnight back to the week it came from, not the new one', () => {
    let s = world();
    const late = must(placeOrder(s, ctx(SUN_LATE), ANA, order([bowl('2026-10-11')], 'swipe', 'late-sun-0001')));
    s = late.state;
    s = must(cancelOrder(s, ctx(MON_EARLY), { kind: 'student', ...ANA }, { orderId: late.value.id, reason: '' })).state;
    // The new week has its own two, and no more: the refund did not land in it.
    expect(must(swipesAvailable(plan('ana'), s.ledger, MON_EARLY))).toMatchObject({ entitled: 2, used: 0, available: 2 });
    const refund = s.ledger.find((e) => e.reason === 'refund')!;
    expect(localParts(refund.appliesAt, TZ).date).toBe('2026-10-11');
  });

  it('refunds dining dollars to the cent', () => {
    const r = must(placeOrder(world(), ctx(), ANA, order([bowl()], 'dining_cents')));
    const back = must(cancelOrder(r.state, ctx(), { kind: 'student', ...ANA }, { orderId: r.value.id, reason: '' }));
    expect(balance(back.state.ledger, { tenantId: 'vu', studentId: 'ana', term: '2026FA', kind: 'dining_cents' })).toBe(2000);
  });
});

// ── Sharing ─────────────────────────────────────────────────────────────────

describe('swipe sharing', () => {
  const consent = { version: SHARE_CONSENT_VERSION, given: true };
  const give = (s: DiningState, n: number, key = 'give-00001', who = ANA) =>
    donateSwipes(s, ctx(), who, { swipes: n, consent, idempotencyKey: key });

  it('refuses a gift without consent, or to an old wording', () => {
    expect(donateSwipes(world(), ctx(), ANA, { swipes: 1, consent: null, idempotencyKey: 'give-00001' })).toMatchObject({ ok: false, code: 'consent_required' });
    expect(donateSwipes(world(), ctx(), ANA, { swipes: 1, consent: { version: 'dining-share-v0', given: true }, idempotencyKey: 'give-00001' })).toMatchObject({ ok: false, code: 'consent_required' });
    expect(donateSwipes(world(), ctx(), ANA, { swipes: 1, consent: { version: SHARE_CONSENT_VERSION, given: false }, idempotencyKey: 'give-00001' })).toMatchObject({ ok: false, code: 'consent_required' });
  });

  it('takes the gift out of the donor’s week and puts it in the pool, once', () => {
    const r = must(give(world(), 2));
    expect(poolAvailable(r.state.pool, 'vu')).toBe(2);
    expect(swipesAvailable(plan('ana'), r.state.ledger, NOON_MON)).toMatchObject({ ok: false, code: 'swipes_exhausted' });
    const again = must(give(r.state, 2));
    expect(again.replayed).toBe(true);
    expect(poolAvailable(again.state.pool, 'vu')).toBe(2);
  });

  it('refuses to give more than the week has left', () => {
    expect(give(world(), 3)).toMatchObject({ ok: false, code: 'swipes_exhausted' });
  });

  it('lets a student with no plan eat on a shared swipe, and never tells them whose', () => {
    const s = must(give(world(), 2)).state;
    const r = must(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe')));
    expect(r.value.term).toBeNull();
    expect(poolAvailable(r.state.pool, 'vu')).toBe(1);
    const shown = recipientView(r.state.pool, 'vu', 'cy', NOON_MON);
    expect(shown).toEqual({ usedThisWeek: 1, limit: 2 });
    // Nothing the recipient's order or claim carries names the donor.
    const carried = JSON.stringify([r.value, r.state.pool.claims]);
    expect(carried).not.toContain('ana');
    expect(r.state.pool.claims.every((c) => !('donorId' in c))).toBe(true);
  });

  it('shows the donor what they gave and nothing about who used it', () => {
    const s = must(give(world(), 2)).state;
    const used = must(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe'))).state;
    expect(donorView(used.pool, 'vu', 'ana')).toEqual({ given: 2 });
    expect(poolSummary(used.pool, 'vu')).toEqual({ donated: 2, drawn: 1, available: 1 });
  });

  it('refuses an empty pool, and a third shared swipe in seven days', () => {
    expect(placeOrder(world(), ctx(), CY, order([bowl()], 'pool_swipe'))).toMatchObject({ ok: false, code: 'pool_empty' });
    let s = must(give(world(), 2)).state;
    s = must(give(s, 2, 'give-00002', BO)).state;
    s = must(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe', 'pool-order-1'))).state;
    s = must(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe', 'pool-order-2'))).state;
    expect(claimedThisWeek(s.pool, 'vu', 'cy', NOON_MON)).toBe(2);
    expect(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe', 'pool-order-3'))).toMatchObject({ ok: false, code: 'claim_limit' });
  });

  it('returns a cancelled shared swipe to the pool', () => {
    const s = must(give(world(), 1)).state;
    const r = must(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe')));
    const back = must(cancelOrder(r.state, ctx(), { kind: 'student', ...CY }, { orderId: r.value.id, reason: '' }));
    expect(poolAvailable(back.state.pool, 'vu')).toBe(1);
  });

  it('keeps a deleted donor’s gift in the pool', () => {
    const s = must(give(world(), 2)).state;
    const erased = { ...s.pool, donations: s.pool.donations.map((d) => ({ ...d, donorId: null })) };
    expect(poolAvailable(erased, 'vu')).toBe(2);
  });

  it('shows the counter an order a shared swipe paid for as a swipe, like any other', () => {
    let s = must(give(world(), 1)).state;
    s = must(placeOrder(s, ctx(), CY, order([bowl()], 'pool_swipe', 'cy-order-01'))).state;
    s = must(placeOrder(s, ctx(), ANA, order([bowl()], 'swipe', 'own-order-01'))).state;
    // Control: the orders themselves do tell the two apart.
    expect(s.orders.map((o) => o.pay)).toEqual(['pool_swipe', 'swipe']);
    const queue = must(orderQueue(s, STAFF));
    expect(queue.map((l) => [l.studentId, l.paidWith])).toEqual([['cy', 'swipe'], ['ana', 'swipe']]);
    expect(JSON.stringify(queue)).not.toContain('pool');
  });

  it('keeps the queue to staff with dining:operate, at their own school, and to open orders', () => {
    let s = must(placeOrder(world(), ctx(), ANA, order([bowl()], 'swipe', 'own-order-01'))).state;
    expect(orderQueue(s, { ...STAFF, mayOperate: false })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(must(orderQueue(s, { tenantId: 'other-u', mayOperate: true }))).toEqual([]);
    const id = s.orders[0].id;
    for (const to of ['accepted', 'ready', 'picked_up'] as const) s = must(advanceOrder(s, ctx(), STAFF, { orderId: id, to })).state;
    expect(must(orderQueue(s, STAFF))).toEqual([]);
  });

  it('keeps each school’s pool to itself', () => {
    const s = must(give(world(), 2)).state;
    expect(poolAvailable(s.pool, 'other-u')).toBe(0);
    expect(placeOrder(s, ctx(), ELSEWHERE, { ...order(['far.2026-10-05.bowl'], 'pool_swipe'), locationId: 'far' })).toMatchObject({ ok: false });
  });
});

// ── The partner ─────────────────────────────────────────────────────────────

describe('the card-office partner', () => {
  const reading: Balance = { id: 'r1', at: chi('2026-10-03T09:00'), swipes: 40, cashCents: 1200, diningCents: 5000, term: '2026FA' };
  const vendor = { ana: { swipesRemaining: 38, diningCents: 4800, campusCents: 1100, asOf: NOON_MON - 60_000 } };

  it('labels a live read institution-verified, and only that', async () => {
    const r = must(await readBalances(mockPartner({ balances: vendor }), 'ana', null, reading, NOON_MON));
    expect(r.figures.basis).toBe('partner_live');
    expect(r.figures.diningCents).toMatchObject({ value: 4800, label: 'institution_verified', authoritative: true });
    expect(r.figures.diningCents.line).toMatch(/^\$48\.00 · Institution verified · Updated/);
  });

  it('with no connection, shows what the student typed, labelled as theirs', async () => {
    const r = must(await readBalances(null, 'ana', null, reading, NOON_MON));
    expect(r.figures.basis).toBe('student_entered');
    expect(r.figures.swipes).toMatchObject({ value: 40, label: 'student_entered', authoritative: false });
    expect(r.figures.swipes!.line).toMatch(/Student entered · Updated 2 days ago/);
  });

  it('with no connection and nothing typed, refuses rather than showing zero', async () => {
    expect(await readBalances(null, 'ana', null, undefined, NOON_MON)).toMatchObject({ ok: false, code: 'no_figure' });
  });

  it('when the partner fails, shows the last good read labelled for review, with its age', async () => {
    const partner = mockPartner({ balances: vendor });
    const first = must(await readBalances(partner, 'ana', null, reading, NOON_MON));
    partner.setFailing(true);
    const later = NOON_MON + 3 * 3_600_000;
    const r = must(await readBalances(partner, 'ana', first.cache, reading, later));
    expect(r.figures.basis).toBe('partner_cache');
    expect(r.figures.diningCents).toMatchObject({ value: 4800, label: 'needs_review', authoritative: false });
    expect(r.figures.diningCents.line).toMatch(/Needs review · Updated 3 hours ago/);
  });

  it('when the partner fails and nothing was ever read, says the partner is unavailable', async () => {
    const partner = mockPartner({ balances: vendor, failing: true });
    expect(await readBalances(partner, 'ana', null, undefined, NOON_MON)).toMatchObject({ ok: false, code: 'partner_unavailable' });
  });

  it('labels a live read of old figures for review, not verified', async () => {
    const old = { ana: { ...vendor.ana, asOf: NOON_MON - 2 * 3_600_000 } };
    const r = must(await readBalances(mockPartner({ balances: old }), 'ana', null, reading, NOON_MON));
    // The read was just now; the figures are what the vendor says was true two hours ago.
    expect(r.figures.basis).toBe('partner_live');
    expect(r.figures.diningCents).toMatchObject({ at: NOON_MON - 2 * 3_600_000, label: 'needs_review', authoritative: false });
  });

  it('treats a degraded or disconnected partner as not live', async () => {
    const partner = mockPartner({ balances: vendor, status: 'degraded' });
    const r = must(await readBalances(partner, 'ana', null, reading, NOON_MON));
    expect(r.figures.basis).toBe('student_entered');
    await partner.disconnect(NOON_MON);
    expect((await partner.health(NOON_MON)).status).toBe('disconnected');
  });

  it('posts a transaction once per key, and refuses the key reused', async () => {
    const partner = mockPartner();
    const p = { idempotencyKey: 'o.key-order-0001', cardholderRef: 'ana', kind: 'dining_cents' as const, delta: -895, at: NOON_MON };
    expect(await partner.postTransaction(p, NOON_MON)).toMatchObject({ accepted: true, replayed: false });
    expect(await partner.postTransaction(p, NOON_MON)).toMatchObject({ accepted: true, replayed: true });
    expect(await partner.postTransaction({ ...p, delta: -1 }, NOON_MON)).toMatchObject({ accepted: false });
    expect(partner.postings).toHaveLength(1);
  });

  it('posts nothing over a connection that is not live', async () => {
    const partner = mockPartner({ status: 'pending' });
    const r = await partner.postTransaction({ idempotencyKey: 'o.key-order-0001', cardholderRef: 'ana', kind: 'swipe', delta: -1, at: NOON_MON }, NOON_MON);
    expect(r.accepted).toBe(false);
    expect(partner.postings).toHaveLength(0);
  });
});
