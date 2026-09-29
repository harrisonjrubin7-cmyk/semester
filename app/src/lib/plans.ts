/**
 * Semester's plans, in one place, for the pricing page and the in-app
 * Membership panel.
 *
 * **These are descriptions, not prices anyone is charged.** The figures are
 * the blueprint's *suggested* ones and are shown as "planned". Plus is the one
 * plan that can be bought, from the Membership panel, and it is bought at the
 * price in the server's catalog (`commercial_prices`), which the panel reads —
 * never at a figure here (DECISION-LOG D-127).
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
  /** `planned` until a billing provider is approved and live. */
  priceStatus: 'free' | 'planned' | 'contact';
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
    priceStatus: 'planned',
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
  'Plus and Pro are not on sale yet. During the pilot, every feature a student can use is free.';

export function plan(id: PlanId): Plan {
  const found = PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`No plan ${id}`);
  return found;
}

/** "$7.99 a month or $59 a year (planned)", or the plain word for Free and Institution. */
export function priceLine(p: Plan): string {
  if (p.priceStatus === 'free') return 'Free';
  if (p.priceStatus === 'contact' || !p.price) return 'Through your university';
  const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
  return `${money(p.price.monthly)} a month or ${money(p.price.yearly)} a year (planned)`;
}
