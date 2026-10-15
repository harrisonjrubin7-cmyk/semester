/**
 * Advancement: alumni relations and fundraising, described and not built (D-157).
 *
 * The brief (S7 of the 30 September site to-do) asks for an advancement module
 * so a school could run alumni relations and fundraising in Semester. Nothing
 * of it exists. What exists is the mentoring offer an alumnus may make
 * (`alumni_mentor_offers`, consented on both sides) and the exports a
 * graduate takes with them. This file holds what the module would do, in the
 * brief's own three parts, and what each part still needs, so the public pages
 * (`site/advancement.tsx`) print it rather than paraphrase it.
 *
 * ## The rules it keeps
 *
 * - Every row is `planned`. A row moves only when a test holds the thing.
 * - The page says no school uses it, no gift has been taken and no receipt has
 *   been issued. `NOTHING_IS_LIVE` is what the tests forbid the copy to contradict.
 * - Wealth screening and predictive donor scoring are not built and not planned:
 *   DO-NOT-BUILD rule 3 refuses a score nobody can explain, and a donor's
 *   capacity to give is not something the donor has told the school.
 * - Money: D-146 says no money moves through Semester. How a gift would be
 *   paid, and by whom, is the owner's decision and is not made here; the pages
 *   say so rather than name a payment provider.
 */

export type Status = 'planned';

export interface Part {
  id: 'constituents' | 'giving' | 'staff';
  title: string;
  /** What it would do, in the brief's words where they are short enough to keep. */
  would: readonly string[];
  /** What already exists that it would build on, with a path a test can check. */
  restsOn: readonly { path: string; shows: string }[];
  status: Status;
  needs: string;
}

export const PARTS: readonly Part[] = [
  {
    id: 'constituents',
    title: 'Alumni relations',
    would: [
      'An alumni profile created from the academic record at graduation, with the graduate’s own consent',
      'The mentoring offers that exist today, linked from the profile',
      'Class notes, an alumni directory that shows only people who opted in, and reunions and events',
    ],
    restsOn: [
      { path: 'supabase/migrations/20260926150000_expansion_roles_and_features.sql', shows: 'alumni_mentor_offers: a mentoring offer, consented on both sides' },
      { path: 'supabase/migrations/20260929210000_academic_record_ledger.sql', shows: 'the academic record the profile would be created from' },
    ],
    status: 'planned',
    needs: 'A directory that shows nobody who has not opted in, class notes, and reunions and events.',
  },
  {
    id: 'giving',
    title: 'Giving',
    would: [
      'Funds and designations, and campaigns with a goal, dates and progress',
      'Giving days with live progress',
      'Gift receipts and tax acknowledgements generated for the school',
      'A donor portal: giving history, receipts and recurring-gift management',
    ],
    restsOn: [],
    status: 'planned',
    needs: 'Every table, and a decision on how a gift is paid: D-146 says no money moves through Semester. A school’s counsel must also settle charitable-solicitation registration and the wording of tax receipts.',
  },
  {
    id: 'staff',
    title: 'The advancement office’s console',
    would: [
      'Gift entry and batch processing, and pledge tracking',
      'Portfolios for gift officers',
      'Exports for CASE and VSE reporting, and a file or API export to the school’s finance system',
    ],
    restsOn: [
      { path: 'supabase/migrations/20260929220000_student_accounts.sql', shows: 'a ledger a school’s office runs, with a second approver, the pattern a gift ledger would copy' },
    ],
    status: 'planned',
    needs: 'The tables, the roles and a ledger that only a second person’s approval can change. None exists.',
  },
];

/** Refused, not deferred: the page says so beside the list of what is planned. */
export const NOT_BUILT: readonly { what: string; why: string }[] = [
  {
    what: 'Wealth screening',
    why: 'A donor’s capacity to give is inferred about them, not told to the school. DO-NOT-BUILD rule 3 refuses a ranking nobody can explain.',
  },
  {
    what: 'Predictive donor scoring',
    why: 'The same rule: a score with no reason a donor could read and dispute.',
  },
];

/** What a graduate can do today, and none of it is giving. */
export const TODAY: readonly string[] = [
  'Offer to mentor a current student, on both sides’ consent, for a limited time',
  'Take their Semester data with them when they graduate',
];

export const NOTHING_IS_LIVE =
  'No school uses Semester for alumni relations or fundraising. No gift has been taken and no receipt has been issued.';

export const POSITIONING =
  'A school’s alumni and advancement office could run alumni relations and fundraising in the same system its students and faculty use. It is planned. None of it is built.';

/** Prices are the owner’s decision; nothing here is one. */
export const PRICE = 'No price has been set for this module.';

/** Legal review the module waits on before it is offered to a school. */
export const WAITS_ON: readonly string[] = [
  'Counsel’s review of charitable-solicitation registration, state by state',
  'Counsel’s review of the wording of tax receipts and acknowledgements',
  'A decision on how a gift is paid, given that no money moves through Semester (D-146)',
  'A price',
];
