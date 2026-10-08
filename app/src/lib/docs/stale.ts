/**
 * Which governed pages are due for a read, given today's date.
 *
 * Takes the date as an argument and never asks for it: the report script
 * passes the real one, and the tests pass a fixed one. The gate itself
 * (`docsystem.test.ts`) does not call this, on purpose — a test that turns red
 * because the calendar moved guards nothing and trains people to ignore red.
 */

import { REVIEW_DAYS, parseCard, type Card } from './card.ts';

export interface Due {
  page: string;
  type: Card['type'];
  owner: string;
  reviewed: string;
  /** Days past the due date; negative is days remaining. */
  overdueDays: number;
}

const DAY = 86_400_000;
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY;

export interface StaleReport {
  overdue: Due[];
  dueSoon: Due[];
  /** Reviewed after `today`: a typo, or a clock that is wrong. */
  future: { page: string; reviewed: string }[];
  unparsed: string[];
}

/** `soonDays`: how far ahead "due soon" looks. */
export function stale(pages: ReadonlyMap<string, string>, today: string, soonDays = 14): StaleReport {
  const out: StaleReport = { overdue: [], dueSoon: [], future: [], unparsed: [] };
  const now = day(today);
  for (const [page, text] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
    if (page.startsWith('docs/documentation/templates/') && !page.endsWith('README.md')) continue;
    const { card } = parseCard(text);
    if (!card) { out.unparsed.push(page); continue; }
    const age = now - day(card.reviewed);
    if (age < 0) { out.future.push({ page, reviewed: card.reviewed }); continue; }
    const overdueDays = Math.floor(age - REVIEW_DAYS[card.type]);
    const due: Due = { page, type: card.type, owner: card.owner, reviewed: card.reviewed, overdueDays };
    if (overdueDays > 0) out.overdue.push(due);
    else if (overdueDays >= -soonDays) out.dueSoon.push(due);
  }
  out.overdue.sort((a, b) => b.overdueDays - a.overdueDays);
  return out;
}
