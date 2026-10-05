/**
 * A mobile order's life: placed → accepted → ready → picked up, or cancelled
 * from any state before pickup. Nothing else, and nothing backwards — an
 * order that was handed over cannot become "ready" again, and a cancelled one
 * cannot come back. `public.dining_orders.status` is checked against the same
 * five, and `migration.test.ts` holds the SQL transition table to this one.
 */

export const ORDER_STATUSES = ['placed', 'accepted', 'ready', 'picked_up', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['picked_up', 'cancelled'],
  picked_up: [],
  cancelled: [],
};

/** Statuses that hold a place in the location's queue. */
export const OPEN_STATUSES: readonly OrderStatus[] = ['placed', 'accepted', 'ready'];

export const PAY_KINDS = ['swipe', 'pool_swipe', 'dining_cents', 'campus_cents'] as const;
export type PayKind = (typeof PAY_KINDS)[number];

/** Items in one order. A swipe covers one meal, and a meal is not a catering tray. */
export const MAX_ITEMS = 6;

export interface OrderEvent {
  status: OrderStatus;
  at: number;
  by: 'student' | 'staff';
  reason: string;
}

export interface Order {
  id: string;
  tenantId: string;
  locationId: string;
  studentId: string;
  idempotencyKey: string;
  status: OrderStatus;
  pay: PayKind;
  /** 1 for a swipe, cents otherwise. */
  amount: number;
  items: readonly string[];
  placedAt: number;
  /** The term the payment was charged to; null for a pool swipe. */
  term: string | null;
  history: readonly OrderEvent[];
}

export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isOpen(order: Order): boolean {
  return OPEN_STATUSES.includes(order.status);
}
