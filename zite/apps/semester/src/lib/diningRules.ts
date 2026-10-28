// Dining (role register: Dining Staff): locations, hours, menus with allergens, meal-plan entitlements, orders, fulfillment,
// inventory and daily reconciliation. Pure; mirrors lib/dngMigration.ts and is unit-tested in tests/dining.test.ts.
// Opening hours and service dates are read in the institution's recorded time zone (Institutions "Time Zone"), with a
// fallback until the institution sets one. Rules: an order is paid only from the student's own meal-plan entitlement for the term (a swipe, or dining dollars) — no card
// payment and no money movement here; stock and balance never go negative; an item containing an allergen the student has
// declared needs an explicit acknowledgement; a cancelled or rejected order restores stock and balance exactly; a location's
// day closes once, with a note when the counted totals differ from the system's; a closed day's orders cannot change.
export const ALLERGENS = ['milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soy', 'sesame', 'gluten', 'mustard', 'celery', 'sulphites', 'lupin'] as const;
export type Allergen = (typeof ALLERGENS)[number];
export type OrderState = 'placed' | 'preparing' | 'ready' | 'picked_up' | 'cancelled' | 'rejected';
export type OrderStep = 'prepare' | 'ready' | 'pick_up' | 'cancel' | 'reject';
export type Tender = 'swipe' | 'dollars';

export function next(state: OrderState, step: OrderStep, actor: 'student' | 'staff'): OrderState | null {
  if (step === 'cancel') return actor === 'student' && state === 'placed' ? 'cancelled' : null;
  if (actor !== 'staff') return null;
  if (step === 'prepare') return state === 'placed' ? 'preparing' : null;
  if (step === 'ready') return state === 'preparing' ? 'ready' : null;
  if (step === 'pick_up') return state === 'ready' ? 'picked_up' : null;
  if (step === 'reject') return ['placed', 'preparing'].includes(state) ? 'rejected' : null;
  return null;
}
export const RESTORES: OrderState[] = ['cancelled', 'rejected'];

/** Allergens in the order that the student declared and has not acknowledged. */
export const unacknowledged = (itemAllergens: string[][], declared: string[], acknowledged: boolean) =>
  acknowledged ? [] : [...new Set(itemAllergens.flat().filter((a) => declared.includes(a)))];

export type Line = { priceCents: number; qty: number; stock: number | null; available: boolean };
export function orderBlocker(lines: Line[], tender: Tender, balance: { swipes: number; dollarsCents: number } | null, open: boolean) {
  if (!open) return 'This location is closed now.';
  if (!lines.length || lines.some((l) => !(l.qty >= 1 && l.qty <= 10))) return 'Choose 1 to 10 of each item.';
  if (lines.some((l) => !l.available)) return 'An item is no longer available.';
  if (lines.some((l) => l.stock !== null && l.stock < l.qty)) return 'Not enough left of an item.';
  if (!balance) return 'You have no meal plan for this term.';
  if (tender === 'swipe' && balance.swipes < 1) return 'You have no swipes left.';
  const total = lines.reduce((t, l) => t + l.priceCents * l.qty, 0);
  if (tender === 'dollars' && balance.dollarsCents < total) return 'Not enough dining dollars.';
  return null;
}

/** Open now? hours: weekday (0=Sun) -> [openHHMM, closeHHMM] in the location's local time. */
export function isOpen(hours: Record<string, [string, string] | null>, weekday: number, hhmm: string) {
  const h = hours[String(weekday)];
  return !!h && h[0] <= hhmm && hhmm < h[1];
}

export const closeBlocker = (expected: { swipes: number; dollarsCents: number }, counted: { swipes: number; dollarsCents: number }, note: string) =>
  (expected.swipes !== counted.swipes || expected.dollarsCents !== counted.dollarsCents) && note.trim().length < 10 ? 'The counts differ from the system; explain the difference (10+ characters).' : null;

/** Where an institution has not recorded a time zone, dining hours are read in this zone. */
export const FALLBACK_ZONE = 'America/Chicago';

/** A zone name is usable only when the runtime's Intl data knows it. */
export function isValidZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** The zone to read local times in: the institution's recorded zone, or the fallback. */
export const zoneOrFallback = (tz: unknown): string => (isValidZone(tz) ? tz : FALLBACK_ZONE);

export type LocalNow = { weekday: number; hhmm: string; date: string };

/** "Now" in a zone: weekday (0=Sun), HH:MM and YYYY-MM-DD, for open-hours and service-date checks. */
export function localNowIn(zone: string, now: Date = new Date()): LocalNow {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map((p) => [p.type, p.value]));
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hhmm: `${parts.hour}:${parts.minute}`, date: `${parts.year}-${parts.month}-${parts.day}` };
}
