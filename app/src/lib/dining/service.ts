/**
 * The dining service: placing, cancelling and moving orders, and giving
 * swipes to the pool. Pure — every function takes the state and `now` and
 * returns a new state or a refusal with its reason; nothing is mutated and
 * nothing reads a clock.
 *
 * The order of the checks is the order the SQL makes them in
 * (`public.dining_place_order`), and it is deliberate:
 *
 * 1. **The request key first.** A retry of an order that was placed gets the
 *    order back, even if the location has since closed or the flag gone off.
 *    Refusing a retry of something that already happened would tell the
 *    student it did not.
 * 2. **The flag and its kill switches**, then **the partner connection**:
 *    nothing that moves money happens unless the school turned dining on and
 *    the card office's system is live, because that system is the record.
 * 3. **The location** — this school's, taking orders, open now.
 * 4. **The items** — on today's menu there, available.
 * 5. **Capacity** — open orders at that location below its limit.
 * 6. **Payment** — a swipe within the plan's window, a shared swipe within
 *    the pool's limit, or cents within the derived balance.
 *
 * Cancelling and refunding are deliberately *not* behind the flag, the kill
 * switch or the partner: a switch that stops new money must never trap money
 * already taken.
 */
import type { FlagDecision } from '../flags';
import { IDEMPOTENCY_KEY, no, yes, type Decision } from './decision';
import { requireDining } from './gate';
import { append, CARD_TERM, type Ledger, type LedgerEntry, type LedgerKind } from './ledger';
import { openAt, type DiningLocation, type MenuItem } from './locations';
import { canMove, isOpen, MAX_ITEMS, type Order, type OrderStatus, type PayKind } from './orders';
import type { PartnerStatus } from './partner';
import { activePlan, swipesAvailable, type MealPlan } from './plans';
import { checkDonation, mayClaim, type DonationRequest, type Pool } from './sharing';
import { localParts } from './time';

export interface DiningState {
  locations: readonly DiningLocation[];
  menu: readonly MenuItem[];
  plans: readonly MealPlan[];
  ledger: Ledger;
  orders: readonly Order[];
  pool: Pool;
}

export interface DiningContext {
  /** `diningGate(...)` for this school, evaluated by the caller. */
  flag: FlagDecision;
  partner: { status: PartnerStatus; lastSuccessAt: number | null };
  now: number;
}

/** The caller, with the school their verified profile says — never a school they asked for. */
export interface Student {
  tenantId: string;
  studentId: string;
}

export interface Staff {
  tenantId: string;
  /** Whether they hold `dining:operate` over this school. */
  mayOperate: boolean;
}

export interface OrderRequest {
  locationId: string;
  items: readonly string[];
  pay: PayKind;
  idempotencyKey: string;
}

export interface Changed<T> {
  state: DiningState;
  value: T;
  /** True when the request key had already been used for this, and nothing changed. */
  replayed: boolean;
}

const sameItems = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function requireLive(ctx: DiningContext): Decision<true> {
  if (ctx.partner.status !== 'live') {
    return no('partner_unavailable', `The card office connection is ${ctx.partner.status.replace('_', ' ')}, so nothing can be charged.`);
  }
  return yes(true, 'The card office connection is live.');
}

// ── Placing ───────────────────────────────────────────────────────────────

export function placeOrder(state: DiningState, ctx: DiningContext, who: Student, req: OrderRequest): Decision<Changed<Order>> {
  const { now } = ctx;
  if (!IDEMPOTENCY_KEY.test(req.idempotencyKey)) return no('invalid', 'The request key is not one this service accepts.');

  const prior = state.orders.find((o) => o.studentId === who.studentId && o.idempotencyKey === req.idempotencyKey);
  if (prior) {
    if (prior.locationId === req.locationId && prior.pay === req.pay && sameItems(prior.items, req.items)) {
      return yes({ state, value: prior, replayed: true }, 'That order was already placed; here it is.');
    }
    return no('idempotency_conflict', 'That request key was already used for a different order.');
  }

  const gate = requireDining(ctx.flag);
  if (!gate.ok) return gate;
  const live = requireLive(ctx);
  if (!live.ok) return live;

  const location = state.locations.find((l) => l.id === req.locationId && l.tenantId === who.tenantId);
  if (!location) return no('not_found', 'There is no such dining location at your school.');
  if (!location.orderingEnabled) return no('ordering_paused', `${location.name} has paused mobile orders.`);
  const open = openAt(location, now);
  if (!open.ok) return open;

  if (req.items.length < 1 || req.items.length > MAX_ITEMS) return no('invalid', `An order has 1 to ${MAX_ITEMS} items.`);
  const today = localParts(now, location.timeZone).date;
  const items: MenuItem[] = [];
  for (const id of req.items) {
    const item = state.menu.find((m) => m.id === id && m.locationId === location.id && m.servedOn === today && m.available);
    if (!item) return no('item_unavailable', `An item is not on today’s menu at ${location.name}.`);
    items.push(item);
  }

  const queued = state.orders.filter((o) => o.locationId === location.id && isOpen(o)).length;
  if (queued >= location.capacity) {
    return no('at_capacity', `${location.name} has ${queued} orders in progress, its limit. Try again in a few minutes.`);
  }

  const id = `ord.${who.studentId}.${req.idempotencyKey}`;
  let ledger = state.ledger;
  let pool = state.pool;
  let amount: number;
  let term: string | null;

  const swipeCovered = items.every((i) => i.swipeEligible);
  const debit = (kind: LedgerKind, delta: number, accountTerm: string): Decision<Ledger> => {
    const entry: LedgerEntry = {
      id: `led.o.${req.idempotencyKey}`, tenantId: who.tenantId, studentId: who.studentId, term: accountTerm,
      kind, delta, appliesAt: now, at: now, reason: 'order', idempotencyKey: `o.${req.idempotencyKey}`,
      source: 'estimated', orderId: id,
    };
    const r = append(ledger, entry);
    return r.ok ? yes(r.value.ledger, r.reason) : r;
  };

  switch (req.pay) {
    case 'swipe': {
      if (!swipeCovered) return no('invalid', 'A meal swipe does not cover every item in this order.');
      const plan = activePlan(state.plans, who.tenantId, who.studentId, now);
      if (!plan.ok) return plan;
      const window = swipesAvailable(plan.value, ledger, now);
      if (!window.ok) return window;
      const r = debit('swipe', -1, plan.value.term);
      if (!r.ok) return r;
      ledger = r.value;
      amount = 1;
      term = plan.value.term;
      break;
    }
    case 'pool_swipe': {
      if (!swipeCovered) return no('invalid', 'A shared swipe does not cover every item in this order.');
      const may = mayClaim(pool, who.tenantId, who.studentId, now);
      if (!may.ok) return may;
      pool = { ...pool, claims: [...pool.claims, { id: `claim.${id}`, tenantId: who.tenantId, recipientId: who.studentId, swipes: 1, orderId: id, at: now }] };
      amount = 1;
      term = null;
      break;
    }
    case 'dining_cents':
    case 'campus_cents': {
      amount = items.reduce((sum, i) => sum + i.priceCents, 0);
      if (!Number.isSafeInteger(amount) || amount <= 0) return no('invalid', 'The order has no price to charge.');
      if (req.pay === 'dining_cents') {
        const plan = activePlan(state.plans, who.tenantId, who.studentId, now);
        if (!plan.ok) return plan;
        term = plan.value.term;
      } else {
        term = CARD_TERM;
      }
      const r = debit(req.pay, -amount, term);
      if (!r.ok) return r;
      ledger = r.value;
      break;
    }
  }

  const order: Order = Object.freeze({
    id, tenantId: who.tenantId, locationId: location.id, studentId: who.studentId,
    idempotencyKey: req.idempotencyKey, status: 'placed' as const, pay: req.pay, amount, items: [...req.items],
    placedAt: now, term, history: [{ status: 'placed' as const, at: now, by: 'student' as const, reason: 'Placed.' }],
  });
  return yes(
    { state: { ...state, ledger, pool, orders: [...state.orders, order] }, value: order, replayed: false },
    `Order placed at ${location.name}.`,
  );
}

// ── The counter's queue ───────────────────────────────────────────────────

/** An open order as the counter sees it. */
export interface QueueLine {
  id: string;
  locationId: string;
  studentId: string;
  status: OrderStatus;
  /** A shared swipe reads as `swipe`: the counter learns the order is paid for, not how. */
  paidWith: Exclude<PayKind, 'pool_swipe'>;
  items: readonly string[];
  placedAt: number;
}

/**
 * The school's open orders, oldest first, for staff with `dining:operate`.
 * The same answer as `public.dining_order_queue()`: staff never read the
 * orders themselves, because an order's `pay` says who ate on a shared swipe.
 */
export function orderQueue(state: DiningState, staff: Staff): Decision<QueueLine[]> {
  if (!staff.mayOperate) return no('not_allowed', 'The order queue needs dining:operate at this school.');
  const lines = state.orders
    .filter((o) => o.tenantId === staff.tenantId && isOpen(o))
    .sort((a, b) => a.placedAt - b.placedAt)
    .map((o) => ({
      id: o.id, locationId: o.locationId, studentId: o.studentId, status: o.status,
      paidWith: o.pay === 'pool_swipe' ? ('swipe' as const) : o.pay, items: o.items, placedAt: o.placedAt,
    }));
  return yes(lines, `${lines.length} open ${lines.length === 1 ? 'order' : 'orders'}.`);
}

// ── Moving ────────────────────────────────────────────────────────────────

function moved(order: Order, to: OrderStatus, at: number, by: 'student' | 'staff', reason: string): Order {
  return Object.freeze({ ...order, status: to, history: [...order.history, { status: to, at, by, reason }] });
}

function replace(state: DiningState, order: Order): DiningState {
  return { ...state, orders: state.orders.map((o) => (o.id === order.id ? order : o)) };
}

/** Staff move an order forward. Cancelling is `cancelOrder`, which refunds. */
export function advanceOrder(
  state: DiningState, ctx: DiningContext, staff: Staff, req: { orderId: string; to: OrderStatus },
): Decision<Changed<Order>> {
  if (!staff.mayOperate) return no('not_allowed', 'Moving orders needs dining:operate at this school.');
  const order = state.orders.find((o) => o.id === req.orderId && o.tenantId === staff.tenantId);
  if (!order) return no('not_found', 'There is no such order at this school.');
  if (req.to === 'cancelled') return no('invalid', 'Cancel an order with cancel, which refunds it.');
  if (order.status === req.to) return yes({ state, value: order, replayed: true }, `Already ${req.to.replace('_', ' ')}.`);
  if (!canMove(order.status, req.to)) {
    return no('bad_transition', `An order that is ${order.status.replace('_', ' ')} cannot become ${req.to.replace('_', ' ')}.`);
  }
  const next = moved(order, req.to, ctx.now, 'staff', `Marked ${req.to.replace('_', ' ')}.`);
  return yes({ state: replace(state, next), value: next, replayed: false }, `Marked ${req.to.replace('_', ' ')}.`);
}

export type Canceller = ({ kind: 'student' } & Student) | ({ kind: 'staff' } & Staff);

/**
 * Cancel and refund. A student may cancel their own order until the counter
 * accepts it; staff with `dining:operate` may cancel any order before pickup.
 * The refund names the debit it reverses and carries its `appliesAt`, so a
 * swipe goes back to the week it came out of.
 */
export function cancelOrder(
  state: DiningState, ctx: DiningContext, actor: Canceller, req: { orderId: string; reason: string },
): Decision<Changed<Order>> {
  const order = state.orders.find((o) => o.id === req.orderId && o.tenantId === actor.tenantId);
  if (!order || (actor.kind === 'student' && order.studentId !== actor.studentId)) {
    return no('not_found', 'There is no such order.');
  }
  if (actor.kind === 'staff' && !actor.mayOperate) return no('not_allowed', 'Cancelling orders needs dining:operate at this school.');
  if (order.status === 'cancelled') return yes({ state, value: order, replayed: true }, 'Already cancelled.');
  if (actor.kind === 'student' && order.status !== 'placed') {
    return no('not_allowed', 'The counter has accepted this order; ask them to cancel it.');
  }
  if (!canMove(order.status, 'cancelled')) return no('bad_transition', 'An order that was picked up cannot be cancelled.');

  let ledger = state.ledger;
  let pool = state.pool;
  if (order.pay === 'pool_swipe') {
    pool = { ...pool, claims: [...pool.claims, { id: `unclaim.${order.id}`, tenantId: order.tenantId, recipientId: order.studentId, swipes: -1, orderId: order.id, at: ctx.now }] };
  } else {
    const paid = ledger.find((e) => e.orderId === order.id && e.reason === 'order');
    if (!paid) return no('not_found', 'The payment for this order is not in the ledger.');
    const refund = append(ledger, {
      id: `led.r.${paid.idempotencyKey}`, tenantId: paid.tenantId, studentId: paid.studentId, term: paid.term, kind: paid.kind,
      delta: -paid.delta, appliesAt: paid.appliesAt, at: ctx.now, reason: 'refund', idempotencyKey: `r.${paid.idempotencyKey}`,
      source: 'estimated', orderId: order.id,
    });
    if (!refund.ok) return refund;
    ledger = refund.value.ledger;
  }
  const next = moved(order, 'cancelled', ctx.now, actor.kind, req.reason.trim() || 'Cancelled.');
  return yes({ state: { ...replace(state, next), ledger, pool }, value: next, replayed: false }, 'Cancelled and refunded.');
}

// ── Giving ────────────────────────────────────────────────────────────────

/** Give swipes from this week's allowance to the school's pool. */
export function donateSwipes(
  state: DiningState, ctx: DiningContext, who: Student, req: Omit<DonationRequest, 'tenantId' | 'donorId'>,
): Decision<Changed<number>> {
  const full: DonationRequest = { ...req, tenantId: who.tenantId, donorId: who.studentId };
  const checked = checkDonation(full);
  if (!checked.ok) return checked;

  const prior = state.pool.donations.find((d) => d.donorId === who.studentId && d.idempotencyKey === req.idempotencyKey);
  if (prior) {
    if (prior.swipes === req.swipes) return yes({ state, value: prior.swipes, replayed: true }, 'Already given; nothing changed.');
    return no('idempotency_conflict', 'That request key was already used for a different gift.');
  }

  const gate = requireDining(ctx.flag);
  if (!gate.ok) return gate;
  const live = requireLive(ctx);
  if (!live.ok) return live;

  const plan = activePlan(state.plans, who.tenantId, who.studentId, ctx.now);
  if (!plan.ok) return plan;
  const window = swipesAvailable(plan.value, state.ledger, ctx.now);
  if (!window.ok) return window;
  if (window.value.available < req.swipes) {
    return no('swipes_exhausted', `You have ${window.value.available} swipes to give until ${window.value.to}.`);
  }
  const r = append(state.ledger, {
    id: `led.d.${req.idempotencyKey}`, tenantId: who.tenantId, studentId: who.studentId, term: plan.value.term, kind: 'swipe',
    delta: -req.swipes, appliesAt: ctx.now, at: ctx.now, reason: 'donation', idempotencyKey: `d.${req.idempotencyKey}`,
    source: 'estimated',
  });
  if (!r.ok) return r;
  const pool: Pool = {
    ...state.pool,
    donations: [...state.pool.donations, {
      id: `don.${who.studentId}.${req.idempotencyKey}`, tenantId: who.tenantId, donorId: who.studentId, swipes: req.swipes,
      consentVersion: full.consent!.version, at: ctx.now, idempotencyKey: req.idempotencyKey,
    }],
  };
  return yes({ state: { ...state, ledger: r.value.ledger, pool }, value: req.swipes, replayed: false }, `Gave ${req.swipes} to the pool.`);
}
