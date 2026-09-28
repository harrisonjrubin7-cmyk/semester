/**
 * The campus service directory: a trusted, configurable list of the help a
 * student can get, not a marketplace.
 *
 * `lib/help-routes.ts` is how a student says "I need help with X" and sends
 * a request; `lib/support.ts` is the static map of who to talk to. Neither
 * has a listing with the fields the blueprints require: an owner, an
 * official/partner/peer label, eligibility, cost, hours, accessibility,
 * languages, an appointment route, a location, a last-verified date and a
 * way to say the link is broken. This is that listing, and the rules on it:
 *
 * - `problems` says what a listing is missing before it is shown;
 * - `freshness` turns a listing nobody has verified in `REVIEW_EVERY_DAYS`
 *   to `stale`, the same number `lib/launch/content.ts` gives campus
 *   services, and `services.test.ts` holds the two equal;
 * - `nextSteps` answers "I need help with X" with listings labelled by
 *   source, official first, and never with one whose owner is unknown;
 * - eligibility is shown as written and never evaluated, the rule
 *   `lib/listings.ts` already keeps for opportunities.
 */

export const CATEGORIES = [
  { id: 'tutoring', name: 'Tutoring' },
  { id: 'writing', name: 'Writing support' },
  { id: 'library', name: 'Library research help' },
  { id: 'accessibility', name: 'Disability and accessibility services' },
  { id: 'career', name: 'Career coaching' },
  { id: 'money', name: 'Financial aid and student accounts' },
  { id: 'legal', name: 'Legal aid' },
  { id: 'wellness', name: 'Health and wellness' },
  { id: 'basic_needs', name: 'Food, housing and basic needs' },
  { id: 'technology', name: 'Technology help' },
  { id: 'transportation', name: 'Transportation' },
  { id: 'childcare', name: 'Childcare' },
  { id: 'international', name: 'International student services' },
  { id: 'jobs', name: 'Campus jobs' },
  { id: 'volunteering', name: 'Volunteer opportunities' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Who stands behind a listing. Shown on every one; never inferred. */
export const LABELS = { official: 'Official campus service', partner: 'Partner service', peer: 'Peer-run' } as const;
export type Label = keyof typeof LABELS;

export const REVIEW_EVERY_DAYS = 90;

export interface ServiceListing {
  id: string;
  category: CategoryId;
  name: string;
  owner: string;
  label: Label;
  /** Shown as written. Never evaluated against a student. */
  eligibility: string;
  cost: string;
  hours: string;
  accessibility: string;
  languages: readonly string[];
  appointmentRoute: string;
  location: string;
  /** https only. */
  url: string | null;
  verifiedOn: string;
  /** Student reports that the link or the listing is wrong. */
  brokenReports: number;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Why a listing is not ready to show. Empty when it is. */
export function problems(l: ServiceListing): string[] {
  const out: string[] = [];
  if (!CATEGORIES.some((c) => c.id === l.category)) out.push('not a category');
  if (!l.name.trim()) out.push('a name');
  if (!l.owner.trim()) out.push('an owner');
  if (!(l.label in LABELS)) out.push('an official, partner or peer label');
  if (!l.eligibility.trim()) out.push('eligibility, even "everyone"');
  if (!l.cost.trim()) out.push('cost, even "free"');
  if (!l.hours.trim()) out.push('hours');
  if (!l.accessibility.trim()) out.push('accessibility details');
  if (!l.languages.length) out.push('at least one language');
  if (!l.appointmentRoute.trim()) out.push('how to get an appointment');
  if (!l.location.trim()) out.push('a location, even "online"');
  if (l.url !== null && !/^https:\/\//.test(l.url)) out.push('an https link, or none');
  if (!ISO.test(l.verifiedOn)) out.push('a last-verified date');
  return out;
}

export type Freshness = 'fresh' | 'due' | 'stale';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Fresh inside the window, due in its last two weeks, stale past it. */
export function freshness(l: ServiceListing, today: string): Freshness {
  const age = daysBetween(l.verifiedOn, today);
  if (age > REVIEW_EVERY_DAYS) return 'stale';
  if (age > REVIEW_EVERY_DAYS - 14) return 'due';
  return 'fresh';
}

export function reportBroken(l: ServiceListing): ServiceListing {
  return { ...l, brokenReports: l.brokenReports + 1 };
}

export function verify(l: ServiceListing, today: string): ServiceListing {
  return { ...l, verifiedOn: today, brokenReports: 0 };
}

export interface NextStep {
  listing: ServiceListing;
  /** "Official campus service · verified 2026-09-12" */
  sourceLine: string;
  freshness: Freshness;
}

const LABEL_ORDER: Record<Label, number> = { official: 0, partner: 1, peer: 2 };

/**
 * "I need help with X": the listings in that category that are complete,
 * official first, fresh before stale, and never one that is missing its
 * owner or its label. A stale listing is still shown — a stale phone number
 * beats no phone number — and says it is stale.
 */
export function nextSteps(category: CategoryId, listings: readonly ServiceListing[], today: string): NextStep[] {
  return listings
    .filter((l) => l.category === category && problems(l).length === 0)
    .map((l) => ({ listing: l, freshness: freshness(l, today), sourceLine: `${LABELS[l.label]} · ${l.owner} · verified ${l.verifiedOn}` }))
    .sort((a, b) => LABEL_ORDER[a.listing.label] - LABEL_ORDER[b.listing.label] || Number(a.freshness === 'stale') - Number(b.freshness === 'stale') || a.listing.name.localeCompare(b.listing.name));
}

/** What the institution reads: listings past their window or reported broken, by category. Never a student. */
export function needsAttention(listings: readonly ServiceListing[], today: string): ServiceListing[] {
  return listings.filter((l) => freshness(l, today) === 'stale' || l.brokenReports > 0 || problems(l).length > 0);
}
