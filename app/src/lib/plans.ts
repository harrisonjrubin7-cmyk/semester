/**
 * Semester's plans, in one place, for the pricing page and the in-app
 * Membership panel.
 *
 * Plus is the one plan that can be bought (`priceStatus: 'in-app'`): from the
 * Membership panel on the Account screen, at the price in the server's catalog
 * (`commercial_prices`), which the panel reads and which `plans.test.ts` holds
 * equal to the figure here (DECISION-LOG D-128, D-134). Every other paid figure
 * is the blueprint's *suggested* one and is shown as "planned". The public site
 * sells nothing; it says where Plus is bought.
 *
 * Two promises are written into the data rather than the copy, so no plan can
 * drop them by accident (blueprint §12, `plans.test.ts`):
 *  - a student's own data export, deletion and saved plan are on every plan;
 *  - nothing a free student has built is taken away if a paid plan lapses.
 */

export type PlanId = 'free' | 'plus' | 'pro' | 'institution';

export interface Plan {
  id: PlanId;
  name: string;
  forWhom: string;
  /** Planned list price, or null when there is none (Free) or it is negotiated (Institution). */
  price: { monthly: number; yearly: number } | null;
  /** `in-app`: bought from the Membership panel at the catalog's price. `planned`: not on sale. */
  priceStatus: 'free' | 'in-app' | 'planned' | 'contact';
  includes: string[];
}

/** On every plan, including Free. Never behind a paywall. */
export const ALWAYS_INCLUDED = [
  'Export all of your data',
  'Delete your account and your data',
  'Keep access to every plan you saved',
] as const;

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Semester Free',
    forWhom: 'Every student',
    price: null,
    priceStatus: 'free',
    includes: [
      'Today, with one clear next step',
      'Your courses, deadlines and calendar',
      'My Path with a Path Snapshot',
      'Registration planning with conflict checks and backups',
      'Study tools for your own course material',
    ],
  },
  {
    id: 'plus',
    name: 'Semester Plus',
    forWhom: 'Students who plan several terms ahead',
    price: { monthly: 7.99, yearly: 59 },
    priceStatus: 'in-app',
    includes: [
      'Unlimited saved plans and schedules',
      'Side-by-side plan comparison',
      'Graduation scenarios',
      'Calendar sync, exports and sharing',
    ],
  },
  {
    id: 'pro',
    name: 'Semester Pro',
    forWhom: 'Students weighing majors, minors and careers',
    price: { monthly: 14.99, yearly: 99 },
    priceStatus: 'planned',
    includes: [
      'Everything in Plus',
      'What-if scenarios for majors and minors',
      'Career and portfolio planning',
      'Sharing with your advisor',
    ],
  },
  {
    id: 'institution',
    name: 'Institution Access',
    forWhom: 'Students whose university provides Semester',
    price: null,
    priceStatus: 'contact',
    includes: [
      'Sign in with your university account',
      'Information your university has verified',
      'Campus directory and resources',
      'The features your university turns on',
    ],
  },
];

export const PILOT_NOTE =
  'Plus is bought in the app, signed in, from the Account screen. Pro is not on sale yet. Free stays free.';

export function plan(id: PlanId): Plan {
  const found = PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`No plan ${id}`);
  return found;
}

/** "$7.99 a month or $59 a year, bought in the app", "… (planned)", or the plain word for Free and Institution. */
export function priceLine(p: Plan): string {
  if (p.priceStatus === 'free') return 'Free';
  if (p.priceStatus === 'contact' || !p.price) return 'Through your university';
  const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  const amount = `${money(p.price.monthly)} a month or ${money(p.price.yearly)} a year`;
  return p.priceStatus === 'in-app' ? `${amount}, bought in the app` : `${amount} (planned)`;
}
