/**
 * What Semester does if a subprocessor goes away, or has to be let go.
 *
 * `subprocessors.ts` says who can reach student data. This says what happens
 * when one of them can't, or shouldn't, any longer: the behaviour a student
 * sees in the meantime, where the data would move to, and the date the answer
 * was last looked at. A dependency with no exit plan is a dependency nobody
 * has decided to accept.
 *
 * These are engineering notes, not contracts: a replacement named here is a
 * candidate that has been thought about, not one that has been agreed with.
 * `exitplans.test.ts` fails if a subprocessor has no plan, a plan names a
 * party that is not a subprocessor, or a review date has passed.
 */

export interface ExitPlan {
  /** Must match a `subprocessor`-kind party's name exactly. */
  party: string;
  /** What a student sees, and can still do, while it is down. */
  fallback: string;
  /** Where the function would move to. A candidate, not an agreement. */
  replacement: string;
  /** How Semester's data leaves it. */
  exit: string;
  /** The date this row is next due to be re-read, ISO. */
  reviewBy: string;
}

export const EXIT_PLANS: readonly ExitPlan[] = [
  {
    party: 'Supabase',
    fallback: 'Sign-in and sync are unavailable; the data already on the student’s own device stays usable.',
    replacement: 'Any managed PostgreSQL with row-level security, plus the same Edge Functions on Deno.',
    exit: 'The schema is in `supabase/migrations`; rows leave by the student and institution export paths and by database dump.',
    reviewBy: '2027-03-31',
  },
  {
    party: 'GitHub Pages',
    fallback: 'New visitors cannot load the public app or site.',
    replacement: 'Vercel, which already serves the gateway, or any static host.',
    exit: 'The site is a build of this repository (`.github/workflows/pages.yml`); it receives request metadata only, never student content.',
    reviewBy: '2027-03-31',
  },
  {
    party: 'Vercel',
    fallback: 'The institutional gateway is unreachable, so school-connected features are unavailable; the register lists it as institution-enabled only.',
    replacement: 'Any Node host that can run the gateway in `app/server/institution`.',
    exit: 'Gateway code is in `app/server` and `app/api`; its settings are listed in `SECRETS.md`.',
    reviewBy: '2027-03-31',
  },
  {
    party: 'Anthropic (Semester’s key)',
    fallback: 'AI features are unavailable while the kill switch is on or the provider is down; nothing else is.',
    replacement: 'Another provider behind the same gateway, added only after the institution approves it and its terms are on file.',
    exit: 'Semester holds no data at the provider to export; what the provider retains is governed by its terms on file (`provider-terms.ts`), and the kill switch turns the feature off at once.',
    reviewBy: '2027-03-31',
  },
  {
    party: 'Stripe',
    fallback: 'Plus cannot be bought or changed; nothing a free student has built is affected, which `plans.ts` holds as a promise on every plan.',
    replacement: 'Another card processor behind the commercial price catalog; the catalog, not a processor, holds the price.',
    exit: 'Semester keeps only Stripe’s customer and subscription references, never card or bank data, so leaving means re-creating subscriptions with the student’s consent.',
    reviewBy: '2027-03-31',
  },
  {
    party: 'Resend',
    fallback: 'Company-site form submissions are not emailed to the owner; no student-facing feature sends through it.',
    replacement: 'Any transactional email provider with SMTP or an HTTP API.',
    exit: 'It is sent what a visitor typed into a company-site form and nothing else; Semester keeps no mailbox or list there.',
    reviewBy: '2027-03-31',
  },
];
