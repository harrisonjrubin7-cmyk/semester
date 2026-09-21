/**
 * A private record of name, image and likeness deals, and the clock each one
 * starts.
 *
 * ## What this is, and the much larger thing it is not
 *
 * It is a notebook with arithmetic in it, for one student, on one device. It
 * records deals somebody has already agreed, adds them up, works out a date
 * from a threshold, and writes down what four pieces of jargon mean.
 *
 * It is not a marketplace, it does not match anybody to a brand, no money
 * moves through it, and — the one that matters most — **nothing here issues a
 * verdict.** It does not say a deal is permissible, or impermissible, or
 * reportable, or clear. Those are determinations, they belong to a compliance
 * office and to the College Sports Commission's own review, and a student who
 * acted on a verdict from a study app would find that out at the worst
 * possible moment. Every screen over this says so, in those words, at the top.
 *
 * ## The two numbers that *are* hardcoded, and why these and not the others
 *
 * `lib/cara.ts` refuses to hardcode a weekly hours cap, and the reason is that
 * the figure genuinely differs per student — by division, sport, season and
 * year — so any constant would be wrong for somebody. The $600 threshold and
 * the five business days are a different case: they are a single published
 * figure applying to Division I student-athletes under the House settlement's
 * reporting rules, and leaving them blank would make the countdown — the whole
 * point of this file — impossible to compute.
 *
 * So they are written down *with the date they were read and the source they
 * were read from*, `NIL_AS_AT` is shown on the screen beside them, and the
 * explainer says plainly that rules change and that a compliance office is the
 * place that knows the current one. That is the same treatment `lib/spend.ts`
 * gives API prices: "the meter shows tokens as a fact and money as an
 * estimate, says which rates it used, and never rounds a guess up into a
 * number that looks measured."
 *
 * ## Aggregate over what, exactly
 *
 * The rule is usually stated as deals "of $600 or more", and the word
 * *aggregate* is doing real work: several small payments from one company
 * across a year are the case the threshold exists to catch, and a single $600
 * deal is the easy one. This file sums **per counterparty, per calendar
 * year**, which is the reading that matches how the same threshold works for a
 * 1099-NEC — and it says so on screen, shows the plain running total beside
 * it, and tells the student to check the grouping with their office rather
 * than assuming this one.
 *
 * ## Nothing leaves the device
 *
 * A device library like Athletics, Career and Family — see
 * `lib/device-library.ts`. It is not in `state/shape.ts`, so it does not sync,
 * is not in a backup, and is not in an export unless the student exports it
 * themselves. A record of what somebody was paid is not something to put in an
 * account without being asked.
 */

import { obj, textValue } from './device-library';

/**
 * When the figures and the explainer below were last read against their
 * sources. Shown on screen, never hidden.
 *
 * A date that is a year old is not a bug to be suppressed — it is the single
 * most useful thing the screen can tell somebody about how much to trust what
 * is under it.
 */
export const NIL_AS_AT = '2026-09-21';

/**
 * The disclosure threshold, in cents.
 *
 * Division I student-athletes report third-party NIL contracts or payments of
 * $600 or more to NIL Go, the designated reporting entity created under the
 * House v. NCAA settlement. Read 21 September 2026 from the College Sports
 * Commission's own material and the NCAA's implementation Q&A; see
 * `NIL_TERMS` below, which carries the sources the screen shows.
 */
export const DISCLOSURE_CENTS = 60_000;

/**
 * How long after the agreement the report is due, in business days.
 *
 * Five, from the same source: written documentation goes to NIL Go within
 * five business days of executing the contract or agreeing the payment terms.
 */
export const DISCLOSURE_DAYS = 5;

/** Where NIL Go actually is, for the link-out. Submission happens there, not here. */
export const NIL_GO_URL = 'https://nilgo.com/';

/** And the body that publishes the rules the explainer paraphrases. */
export const CSC_URL = 'https://www.collegesportscommission.org/';

/** One term, in plain language, with the place it came from. */
export interface NilTerm {
  term: string;
  /** What it means, said the way somebody would say it out loud. */
  plain: string;
  /** What it does not mean, where that is the part people get wrong. */
  careful: string;
  source: string;
  url: string;
}

/**
 * The four pieces of jargon a student meets in their first week of this, in
 * the order they meet them.
 *
 * Paraphrase, deliberately — a quotation of a rule invites somebody to read
 * this as the rule. Every entry names where it came from and every screen
 * showing them shows `NIL_AS_AT`.
 */
export const NIL_TERMS: NilTerm[] = [
  {
    term: '$600 aggregate',
    plain:
      'Third-party NIL deals worth $600 or more have to be reported. “Aggregate” matters: several smaller payments from the same company in a year can add up past it, and the total is what counts rather than any one payment.',
    careful:
      'Exactly what gets added to what — per company, per year, per contract — is worth confirming with your compliance office. This app groups by company and calendar year and shows your plain total beside it, so you can see both.',
    source: 'College Sports Commission and NCAA House-settlement implementation materials',
    url: 'https://www.collegesportscommission.org/',
  },
  {
    term: '5 business days',
    plain:
      'The written documentation goes to NIL Go within five business days of signing the contract or agreeing the payment terms — not five days after you are paid, and not five days after the work is done.',
    careful:
      'Business days skip weekends. This app counts weekdays only: it does not know your school’s calendar or a federal holiday, so treat the date it shows as the latest it could be and go earlier.',
    source: 'College Sports Commission and NCAA House-settlement implementation materials',
    url: 'https://www.collegesportscommission.org/',
  },
  {
    term: 'Valid business purpose',
    plain:
      'The company has to be buying something real: your name or likeness promoting a good or service they actually sell to the public, for profit. An appearance, a post, an autograph session, a camp — things with a commercial point to them.',
    careful:
      'Money that is really there to get you to a school, or to keep you at one, is not this. That is the distinction the review is looking for, and it is the reason a deal from an entity connected to your school gets looked at harder than one from an unconnected company.',
    source: 'College Sports Commission guidance on NIL deal review',
    url: 'https://www.collegesportscommission.org/',
  },
  {
    term: 'Fair market value',
    plain:
      'Roughly: would this company pay about this much to somebody else with your reach and your audience for the same work? The review asks whether the amount sits in a reasonable range for what is actually being delivered.',
    careful:
      'A number well above what the work would fetch from an unconnected buyer is what draws attention, and “my collective offered it” is not an answer to that question. If you are unsure where yours sits, that is a conversation to have before you sign, not after.',
    source: 'College Sports Commission guidance on NIL deal review',
    url: 'https://www.collegesportscommission.org/',
  },
];

/** Whether the money came from somewhere connected to the school. The student's own reading. */
export type Associated = 'yes' | 'no' | 'unsure';

export interface NilDeal {
  id: string;
  /** `YYYY-MM-DD`. The day the agreement was made — which is when the clock starts. */
  date: string;
  /** Who is paying. The name matters: the aggregate is counted per payer. */
  counterparty: string;
  /** Cents, always an integer. `lib/cost.ts` says why money is never a float here. */
  cents: number;
  description: string;
  /** School-associated, as far as the student can tell. Never decided by the app. */
  associated: Associated;
  /** Ticked by the student once they have reported it. The app cannot know. */
  reported: boolean;
}

export interface NilLibrary {
  version: 1;
  deals: NilDeal[];
}

export const EMPTY_NIL: NilLibrary = { version: 1, deals: [] };

export const NIL_LIMITS = {
  deals: 500,
  counterparty: 200,
  description: 2000,
  /** A deal this app will record. Past it, somebody has an agent and an accountant. */
  cents: 100_000_000,
} as const;

const LOCAL_DAY = /^\d{4}-\d\d-\d\d$/;

/** Where a student's own NIL record lives. Per account, not per term — a
 * threshold is counted over a calendar year and a term is not one. */
export function nilKey(accountId: string | undefined): string {
  return `semester.nil.v1:${accountId || 'device'}`;
}

export function readNil(value: unknown): NilLibrary {
  if (
    !obj(value) ||
    value.version !== 1 ||
    !Array.isArray(value.deals) ||
    value.deals.length > NIL_LIMITS.deals
  ) {
    throw new Error(`Use a version 1 NIL record with up to ${NIL_LIMITS.deals} entries.`);
  }
  const ids = new Set<string>();
  for (const d of value.deals) {
    const shaped =
      obj(d) &&
      textValue(d.id, 100) &&
      !ids.has(d.id as string) &&
      textValue(d.date, 30) &&
      LOCAL_DAY.test(d.date as string) &&
      Number.isFinite(Date.parse(d.date as string)) &&
      textValue(d.counterparty, NIL_LIMITS.counterparty) &&
      textValue(d.description, NIL_LIMITS.description) &&
      typeof d.cents === 'number' &&
      Number.isInteger(d.cents) &&
      d.cents >= 0 &&
      d.cents <= NIL_LIMITS.cents &&
      (d.associated === 'yes' || d.associated === 'no' || d.associated === 'unsure') &&
      typeof d.reported === 'boolean';
    if (!shaped) {
      throw new Error(
        'Check each deal: a date, who paid, a whole number of cents, and whether it is school-associated.',
      );
    }
    ids.add(d.id as string);
  }
  return value as unknown as NilLibrary;
}

/**
 * `YYYY-MM-DD`, `n` business days later.
 *
 * Weekdays only. It does not know a federal holiday or a school's own
 * calendar, and it is not going to pretend to — a date shown as the deadline
 * that is one holiday late is worse than no date. So the screen says this is
 * the latest it could be and to go earlier, and `NIL_TERMS` says it again.
 */
export function businessDaysAfter(day: string, n: number): string {
  const d = new Date(`${day}T12:00`);
  if (Number.isNaN(d.getTime())) return day;
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The counterparty name, compared the way a person would compare two of them. */
function samePayer(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The calendar year a deal falls in. */
const yearOf = (day: string): string => day.slice(0, 4);

/**
 * A payer and a year whose deals add up to the threshold, and the deal that
 * took them there.
 */
export interface Crossing {
  counterparty: string;
  year: string;
  /** The deal that took the running total to or past the threshold. */
  deal: NilDeal;
  /** The running total at that point, in cents. */
  cents: number;
  /** `YYYY-MM-DD`, five business days after that deal. */
  due: string;
}

/**
 * Every point at which one payer's deals in one year reached the threshold.
 *
 * Deals are walked in date order and the running total is checked *after* each
 * one, so the crossing is attributed to the deal that caused it — which is the
 * deal whose date starts the clock. A later deal with the same payer in the
 * same year does not produce a second crossing here: the obligation began at
 * the first one, and a second reminder for the same year would read as a
 * second deadline.
 */
export function crossings(deals: NilDeal[]): Crossing[] {
  const groups = new Map<string, NilDeal[]>();
  for (const d of deals) {
    const key = `${yearOf(d.date)}::${d.counterparty.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  const out: Crossing[] = [];
  for (const held of groups.values()) {
    const ordered = [...held].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    for (const d of ordered) {
      const before = running;
      running += d.cents;
      if (before < DISCLOSURE_CENTS && running >= DISCLOSURE_CENTS) {
        out.push({
          counterparty: d.counterparty,
          year: yearOf(d.date),
          deal: d,
          cents: running,
          due: businessDaysAfter(d.date, DISCLOSURE_DAYS),
        });
      }
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** What one payer has paid this student in one calendar year. */
export function aggregate(deals: NilDeal[], counterparty: string, year: string): number {
  return deals
    .filter((d) => yearOf(d.date) === year && samePayer(d.counterparty, counterparty))
    .reduce((n, d) => n + d.cents, 0);
}

/** Everything in a calendar year, from every payer. Shown beside the grouped
 * figure so the student can see both readings rather than only this app's. */
export function yearTotal(deals: NilDeal[], year: string): number {
  return deals.filter((d) => yearOf(d.date) === year).reduce((n, d) => n + d.cents, 0);
}

/** The years there is anything recorded in, most recent first. */
export function years(deals: NilDeal[]): string[] {
  return [...new Set(deals.map((d) => yearOf(d.date)))].sort((a, b) => b.localeCompare(a));
}

/**
 * The prompts that decide whether this is a conversation to have now.
 *
 * Questions, with the student's own answers read back — never a verdict, and
 * the wording is the whole of the care taken here. "Worth asking about" is a
 * prompt to go and ask a person. "This deal is non-compliant" would be a
 * determination, and it is not one this app is entitled to make about a
 * contract it has seen a one-line description of.
 */
export interface Prompt {
  ask: string;
  /** What the student's own record says about it. */
  says: string;
  /** Whether this is one of the answers that points at a conversation. */
  points: boolean;
}

export function prompts(deal: NilDeal, all: NilDeal[]): Prompt[] {
  const total = aggregate(all, deal.counterparty, yearOf(deal.date));
  return [
    {
      ask: 'Is the money from an entity associated with your school — a collective, a booster, a sponsor of the athletics department?',
      says:
        deal.associated === 'yes'
          ? 'You recorded it as school-associated.'
          : deal.associated === 'unsure'
            ? 'You were not sure.'
            : 'You recorded it as not school-associated.',
      // Unsure points as hard as yes. Somebody who cannot tell is exactly the
      // person who should ask, and an app that only flagged the confident
      // answer would flag nobody.
      points: deal.associated !== 'no',
    },
    {
      ask: 'Is the company buying something they would buy from somebody else — a post, an appearance, a camp — or does the payment look like it is really for playing, or for being at this school?',
      says: deal.description.trim()
        ? `You described it as: ${deal.description.trim().slice(0, 200)}`
        : 'You have not written down what the deal is for, which is the first thing anybody will ask.',
      points: !deal.description.trim(),
    },
    {
      ask: `Does this payer’s total for ${yearOf(deal.date)} reach $600?`,
      says:
        total >= DISCLOSURE_CENTS
          ? `Your record says ${(total / 100).toFixed(2)} from them this year, which is at or above it.`
          : `Your record says ${(total / 100).toFixed(2)} from them this year, which is below it — a later deal from the same payer could take it over.`,
      points: total >= DISCLOSURE_CENTS,
    },
  ];
}
