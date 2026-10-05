/**
 * Dining's reads and writes, typed, over the account service.
 *
 * Every function wraps one RPC or one table in
 * `supabase/migrations/20260929330000_dining.sql`, and the database is the
 * authorization: a student reads only their own plan, ledger and orders; the
 * counter reads the queue through `dining_order_queue()`, which reports a
 * shared swipe as a swipe; and every write checks the flag, the kill switches
 * and the card office itself. What this adds is the shape — rows become the
 * records `lib/dining/` already speaks — and one rule: a refusal is thrown as
 * a `DiningRefusal` carrying the database's code and a plain sentence, never
 * returned as an empty list.
 *
 * Nothing is cached and nothing reaches browser storage.
 */

import { cloud, cloudConfigured } from '../cloud';
import { forSchool, loadMyCapabilities } from '../capabilities';
import { readNarrowing } from '../featurepolicy';
import { claimedSchoolOrThrow } from '../schoolclaim';
import { buildEnvironment } from '../integration/school-records';
import { formatNumber } from '../locale';
import { SOURCE_LABELS, type SourceLabel } from '../source';
import type { FeatureState } from '../../intelligence/contracts';
import type { ActivationReceipt } from '../governance/activation';
import { REFUSALS, type Refusal } from './decision';
import { figure, partnerLabel, type Figure } from './figures';
import { DINING_FLAG, diningGate, requireDining } from './gate';
import type { DiningLocation, HoursWindow, MenuItem } from './locations';
import { ORDER_STATUSES, PAY_KINDS, type OrderStatus, type PayKind } from './orders';
import { PARTNER_STATUSES, type PartnerStatus } from './partner';
import { SHARE_CONSENT_VERSION } from './sharing';

type Row = Record<string, unknown>;
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
const at = (v: unknown): number | null => (v == null ? null : Date.parse(String(v)) || null);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const label = (v: unknown): SourceLabel => pick<SourceLabel>(v, SOURCE_LABELS, 'needs_review');

/** The capability that works the counter. */
export const DINING_STAFF = 'dining:operate';

/** Integer cents, as the reader's locale writes a dollar amount. */
export function diningCents(n: number): string {
  return formatNumber(n / 100, { style: 'currency', currency: 'USD' });
}

// ── Refusals ───────────────────────────────────────────────────────────────

/** What each refusal code means to the person who pressed the button. */
export const REFUSAL_WORDS: Record<Refusal, string> = {
  flag_off: 'Your school has not turned on dining in Semester, so nothing was ordered or charged.',
  kill_switch: 'Your school has stopped new orders and gifts for now. Nothing was charged.',
  partner_unavailable: 'The card office is not connected, so nothing can be charged. Nothing was.',
  not_found: 'That is not here any more. Refresh and look again.',
  ordering_paused: 'This location has paused mobile orders. Order at the counter, or try another location.',
  closed: 'This location is closed now. Its hours are listed with it.',
  item_unavailable: 'Something in the order is not on today’s menu here any more. Nothing was charged.',
  at_capacity: 'This location has as many orders in progress as it can take. Try again in a few minutes.',
  no_plan: 'No meal plan covers today, so there is nothing to pay with from a plan.',
  swipes_exhausted: 'The swipes for this plan week are used.',
  insufficient_funds: 'The balance does not cover this order. Nothing was charged.',
  pool_empty: 'The shared pool has no swipes right now.',
  claim_limit: 'The pool allows 2 shared swipes in any seven days.',
  consent_required: 'Giving swipes needs you to agree to the sentence above it.',
  invalid: 'That request is not one the dining service accepts.',
  idempotency_conflict: 'This clashed with an earlier request. Nothing was charged; start it again.',
  not_allowed: 'Your account cannot do that here.',
  bad_transition: 'That order cannot move that way from where it is now.',
  no_figure: 'There is no figure to show yet.',
};

export class DiningRefusal extends Error {
  readonly code: Refusal | 'network' | 'unknown';
  constructor(code: Refusal | 'network' | 'unknown', message: string) {
    super(message);
    this.code = code;
    this.name = 'DiningRefusal';
  }
}

const NETWORK = /fetch|network|timed? ?out|load failed/i;

/**
 * The database's `dining: <code>: <sentence>`, as a refusal a screen can
 * show. The code's own words win over the sentence, except where the
 * sentence carries a detail the words do not (the transition refused).
 */
export function refusalOf(message: string | undefined, fallback: string): DiningRefusal {
  const said = (message ?? '').trim();
  const m = /dining:\s*([a-z_]+):\s*(.*)$/s.exec(said);
  if (m && (REFUSALS as readonly string[]).includes(m[1])) {
    const code = m[1] as Refusal;
    return new DiningRefusal(code, REFUSAL_WORDS[code]);
  }
  if (said && NETWORK.test(said)) {
    return new DiningRefusal(
      'network',
      'The dining service did not answer. It may not have gone through; trying again is safe, because the retry is recognised as the same request.',
    );
  }
  return new DiningRefusal('unknown', fallback);
}

function fail(error: { message?: string } | null | undefined, fallback: string): never {
  throw refusalOf(error?.message, fallback);
}

// ── The gate ───────────────────────────────────────────────────────────────

export interface DiningContext {
  userId: string;
  school: string;
  moduleState: FeatureState;
  /** Whether the flag, the environment and the kill switches let dining open. */
  on: boolean;
  reason: string;
  capabilities: string[];
}

export type DiningOpening =
  | { kind: 'no_service' }
  | { kind: 'signed_out' }
  | { kind: 'no_school' }
  | { kind: 'ready'; context: DiningContext };

/**
 * Who is asking, at which school, and whether `module.dining` is on there —
 * through the one flag evaluator, so a kill switch or an environment answers
 * here as it does everywhere. A failed read throws rather than reading as off.
 */
export async function openDining(now = new Date(), activationReceipt: ActivationReceipt | null = null): Promise<DiningOpening> {
  if (!cloudConfigured) return { kind: 'no_service' };
  const db = await cloud();
  const { data: user } = await db.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return { kind: 'signed_out' };
  const school = await claimedSchoolOrThrow();
  if (!school) return { kind: 'no_school' };
  const [{ data: state, error }, { data: switches, error: switchError }, grants, narrowing] = await Promise.all([
    db.rpc('feature_state', { want_capability: DINING_FLAG, want_tenant: school }),
    db.from('feature_kill_switch').select('switch_key,tenant_id,engaged'),
    loadMyCapabilities(),
    // The school's role and cohort limits on dining, and the caller's own
    // roles and cohorts there. A read that fails throws, so a staff-only
    // preview never reads as open to every student.
    readNarrowing(db, DINING_FLAG, school).catch((e: unknown) => {
      throw new DiningRefusal('network', e instanceof Error ? e.message : 'Could not read who dining is open to at your school.');
    }),
  ]);
  if (error || switchError) fail(error ?? switchError, 'Could not read whether your school has dining on.');
  const moduleState = (typeof state === 'string' ? state : 'off') as FeatureState;
  const capabilities = forSchool(grants, school);
  const decision = requireDining(
    diningGate({
      environment: buildEnvironment(import.meta.env.MODE),
      tenantId: school,
      now,
      killSwitches: rows(switches).map((k) => ({ key: text(k.switch_key), tenantId: k.tenant_id == null ? null : text(k.tenant_id), engaged: k.engaged === true })),
      tenantPolicy: {
        [DINING_FLAG]: { state: moduleState, permittedRoles: narrowing.permittedRoles, permittedCohorts: narrowing.permittedCohorts },
      },
      roles: narrowing.roles,
      cohorts: narrowing.cohorts,
      capabilities,
      activationReceipt,
    }),
  );
  return { kind: 'ready', context: { userId, school, moduleState, on: decision.ok, reason: decision.reason, capabilities } };
}

// ── Balances ───────────────────────────────────────────────────────────────

export interface Balances {
  /** The plan in force, or null when none covers today. */
  planTerm: string | null;
  swipesLeft: number | null;
  diningCents: number | null;
  campusCents: number;
  partnerStatus: PartnerStatus;
  partnerLastSuccess: number | null;
}

export async function loadBalances(): Promise<Balances> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_dining_balances');
  if (error) fail(error, 'Could not read your dining balances.');
  const r = rows(data)[0] ?? {};
  return {
    planTerm: r.plan_term == null ? null : text(r.plan_term),
    swipesLeft: r.swipes_left == null ? null : num(r.swipes_left),
    diningCents: r.dining_cents == null ? null : num(r.dining_cents),
    campusCents: num(r.campus_cents),
    partnerStatus: pick<PartnerStatus>(r.partner_status, PARTNER_STATUSES, 'not_connected'),
    partnerLastSuccess: at(r.partner_last_success),
  };
}

export interface BalanceFigures {
  swipes: Figure | null;
  diningCents: Figure | null;
  campusCents: Figure;
  /** Whether any of these is the card office's own figure. */
  authoritative: boolean;
}

/**
 * Each balance with its source and age.
 *
 * Over a live connection, the figures are the card office's, labelled by how
 * long ago it last answered (`partnerLabel`). Without one they are Semester's
 * own sums of what it recorded — estimated, with no age that could be
 * mistaken for the card office's — and nothing on screen calls them official.
 */
export function balanceFigures(b: Balances, now: number): BalanceFigures {
  const live = b.partnerStatus === 'live';
  const source: SourceLabel = live ? partnerLabel(b.partnerLastSuccess, true, now) : 'estimated';
  const when = live ? b.partnerLastSuccess : null;
  const swipes = b.swipesLeft === null ? null : figure(b.swipesLeft, 'swipes', source, when, now);
  const dining = b.diningCents === null ? null : figure(b.diningCents, 'cents', source, when, now);
  const campus = figure(b.campusCents, 'cents', source, when, now);
  return { swipes, diningCents: dining, campusCents: campus, authoritative: campus.authoritative };
}

/** The window the swipes figure covers: the plan week, or the whole term. */
export type SwipeKind = 'weekly' | 'term' | 'none';

export interface PlanSummary {
  term: string;
  swipeKind: SwipeKind;
  perWeek: number | null;
  perTerm: number | null;
  source: SourceLabel;
  sourceAt: number | null;
}

/** The caller's own plans, newest first. */
export async function loadMyPlans(): Promise<PlanSummary[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('dining_plans')
    .select('term,swipe_kind,swipes_per_week,swipes_per_term,source_label,source_updated_at')
    .order('starts_on', { ascending: false });
  if (error) fail(error, 'Could not read your meal plan.');
  return rows(data).map((r) => ({
    term: text(r.term),
    swipeKind: pick<SwipeKind>(r.swipe_kind, ['weekly', 'term', 'none'], 'none'),
    perWeek: r.swipes_per_week == null ? null : num(r.swipes_per_week),
    perTerm: r.swipes_per_term == null ? null : num(r.swipes_per_term),
    source: label(r.source_label),
    sourceAt: at(r.source_updated_at),
  }));
}

// ── Locations, hours, menus ────────────────────────────────────────────────

export interface Places {
  locations: DiningLocation[];
  menu: MenuItem[];
}

const MEALS = ['breakfast', 'lunch', 'dinner', 'late', 'all_day'] as const;

/** Every location at the school, with its hours, and the menus served from yesterday on. */
export async function loadPlaces(now = new Date()): Promise<Places> {
  const db = await cloud();
  // A day either side of today in UTC covers "today" in every time zone a
  // location can be in; `menuToday` then picks each location's own today.
  const from = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const [locs, hours, menu] = await Promise.all([
    db.from('dining_locations').select('*').order('name'),
    db.from('dining_hours').select('*'),
    db.from('dining_menu_items').select('*').gte('served_on', from).order('name'),
  ]);
  if (locs.error) fail(locs.error, 'Could not read the dining locations.');
  if (hours.error) fail(hours.error, 'Could not read the dining hours.');
  if (menu.error) fail(menu.error, 'Could not read the menus.');
  const windows = new Map<string, HoursWindow[]>();
  for (const h of rows(hours.data)) {
    const id = text(h.location_id);
    windows.set(id, [...(windows.get(id) ?? []), { weekday: num(h.weekday), opensAt: num(h.opens_min), closesAt: num(h.closes_min) }]);
  }
  return {
    locations: rows(locs.data).map((r) => ({
      id: text(r.id),
      tenantId: text(r.tenant_id),
      name: text(r.name),
      timeZone: text(r.time_zone),
      hours: windows.get(text(r.id)) ?? [],
      capacity: num(r.capacity),
      orderingEnabled: r.ordering_enabled === true,
      source: label(r.source_label),
      sourceAt: at(r.source_updated_at),
    })),
    menu: rows(menu.data).map((r) => ({
      id: text(r.id),
      locationId: text(r.location_id),
      servedOn: text(r.served_on),
      meal: pick(r.meal, MEALS, 'all_day'),
      name: text(r.name),
      priceCents: num(r.price_cents),
      swipeEligible: r.swipe_eligible === true,
      available: r.available === true,
      source: label(r.source_label),
      sourceAt: at(r.source_updated_at),
    })),
  };
}

// ── Orders ─────────────────────────────────────────────────────────────────

export interface MyOrder {
  id: string;
  locationId: string;
  status: OrderStatus;
  pay: PayKind;
  /** 1 for a swipe, cents otherwise. */
  amount: number;
  items: string[];
  placedAt: number;
  updatedAt: number;
}

export function readOrder(r: Row): MyOrder {
  return {
    id: text(r.id),
    locationId: text(r.location_id),
    status: pick<OrderStatus>(r.status, ORDER_STATUSES, 'placed'),
    pay: pick<PayKind>(r.pay, PAY_KINDS, 'swipe'),
    amount: num(r.amount),
    items: Array.isArray(r.items) ? r.items.map(text) : [],
    placedAt: at(r.placed_at) ?? 0,
    updatedAt: at(r.updated_at) ?? 0,
  };
}

/** The caller's own orders, newest first. */
export async function loadMyOrders(): Promise<MyOrder[]> {
  const db = await cloud();
  const { data, error } = await db.from('dining_orders').select('*').order('placed_at', { ascending: false }).limit(20);
  if (error) fail(error, 'Could not read your orders.');
  return rows(data).map(readOrder);
}

/**
 * Place an order. The price is the database's, summed from the menu; this
 * says what is wanted, never what it costs. The same key for the same order
 * returns the first order's id and charges nothing twice.
 */
export async function placeOrder(locationId: string, items: readonly string[], pay: PayKind, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_place_order', { want_location: locationId, want_items: [...items], want_pay: pay, want_key: key });
  if (error) fail(error, 'The order was not placed.');
  return text(data);
}

/** Cancel an order, which refunds what it took. Not behind the flag or the card office. */
export async function cancelOrder(orderId: string, reason: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_cancel_order', { want_order: orderId, want_reason: reason });
  if (error) fail(error, 'The order was not cancelled.');
  return text(data);
}

/** Give swipes to the basic-needs pool, under the consent sentence's current version. */
export async function donateSwipes(swipes: number, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_donate_swipes', { want_swipes: swipes, want_consent: SHARE_CONSENT_VERSION, want_key: key });
  if (error) fail(error, 'The swipes were not given.');
  return num(data);
}

// ── The counter ────────────────────────────────────────────────────────────

/** An open order as the counter sees it: paid, and never how a shared swipe paid. */
export interface QueuedOrder {
  id: string;
  locationId: string;
  status: OrderStatus;
  /** `swipe` for a shared swipe too: the queue does not say which. */
  paidWith: Exclude<PayKind, 'pool_swipe'>;
  items: string[];
  placedAt: number;
}

export async function loadQueue(): Promise<QueuedOrder[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_order_queue');
  if (error) fail(error, 'Could not read the order queue.');
  return rows(data).map((r) => ({
    id: text(r.id),
    locationId: text(r.location_id),
    status: pick<OrderStatus>(r.status, ORDER_STATUSES, 'placed'),
    paidWith: pick(r.paid_with, ['swipe', 'dining_cents', 'campus_cents'] as const, 'swipe'),
    items: Array.isArray(r.items) ? r.items.map(text) : [],
    placedAt: at(r.placed_at) ?? 0,
  }));
}

export async function advanceOrder(orderId: string, status: 'accepted' | 'ready' | 'picked_up'): Promise<OrderStatus> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_advance_order', { want_order: orderId, want_status: status });
  if (error) fail(error, 'The order did not move.');
  return pick<OrderStatus>(data, ORDER_STATUSES, status);
}

export async function setOrdering(locationId: string, enabled: boolean): Promise<boolean> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_set_ordering', { want_location: locationId, want_enabled: enabled });
  if (error) fail(error, 'Ordering was not changed.');
  return data === true;
}

export interface PoolSummary {
  donated: number;
  drawn: number;
  available: number;
}

export async function loadPoolSummary(): Promise<PoolSummary> {
  const db = await cloud();
  const { data, error } = await db.rpc('dining_pool_summary');
  if (error) fail(error, 'Could not read the pool.');
  const r = rows(data)[0] ?? {};
  return { donated: num(r.donated), drawn: num(r.drawn), available: num(r.available) };
}
