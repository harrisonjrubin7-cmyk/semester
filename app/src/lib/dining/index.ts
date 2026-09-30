/**
 * Dining and the campus card — the institutional side of what `lib/meals.ts`
 * does by hand. Locations, hours and menus; meal plans and their weeks; an
 * append-only card ledger; mobile ordering; swipe sharing into the
 * basic-needs pool; and the interface a card-office vendor adapter
 * implements. Behind `module.dining` (off by default, high-risk: it moves
 * money), and nothing it shows is the institution's figure until the
 * partner connection is live.
 *
 * The database half is `supabase/migrations/20260929330000_dining.sql`,
 * proved by `supabase/dining.check.sql`.
 */
export * from './decision';
export * from './figures';
export * from './gate';
export * from './ledger';
export * from './locations';
export * from './orders';
export * from './partner';
export * from './plans';
export * from './service';
export * from './sharing';
export * from './time';
