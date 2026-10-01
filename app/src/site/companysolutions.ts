/**
 * Two pages of the company site, printed from the same data as the app's own
 * prerendered pages: K–12, and alumni relations and fundraising.
 *
 * The company site is one hand-written file with one generic "solution" page
 * template (`SOL` in `company-site/index.html`). Neither module exists as a
 * product a school can buy, so these pages are described as planned and say
 * what each still waits on, in the words `lib/k12/edition.ts` and
 * `lib/advancement/edition.ts` hold and their tests police. They are not
 * paraphrased here: the text is built from that data, the site carries a copy
 * between two markers, and `companysolutions.test.ts` holds the copy equal to
 * what this returns and holds what it says to what is true. Change the data,
 * then `REGISTERS=write npx vitest run src/site/companysolutions.test.ts`.
 *
 * What neither page does: name a price (none has been set), name a payment
 * provider (D-146: no money moves through Semester), or say anything is live.
 */
import { DOES_NOT_REPLACE, LEADS_WITH, NOT_A_SEGMENT, POSITIONING as K12_POSITIONING, SEGMENTS, mayTakeDistrictData } from '../lib/k12/edition';
import { districtReady } from '../lib/k12/requirements';
import { NOTHING_IS_LIVE, NOT_BUILT, PARTS, POSITIONING as ADV_POSITIONING, PRICE, TODAY, WAITS_ON } from '../lib/advancement/edition';

/** One entry of the company site's `SOL` table. */
export interface Solution {
  crumb: string;
  eye: string;
  h: string;
  lede: string;
  /** The last headline; the page adds the full stop. */
  cta: [string, string];
  /** A heading for the first list, where "What you get" would promise more than is true. */
  listHead: string;
  /** The large heading over it, where "Scoped to your workflow." would too. */
  listTitle: string;
  list: string[];
  /** A heading for the second box. */
  qualHead: string;
  qual: string[];
}

export const K12_NOW = 'No district or school uses Semester today, and Semester does not take a district’s student data.';

export function k12(): Solution {
  const ready = mayTakeDistrictData();
  const short = districtReady().short.length;
  return {
    crumb: 'K–12',
    eye: 'For school districts, high schools and CTE',
    h: 'Semester for high school: described, planned and not yet taking a district’s student data.',
    lede: `${K12_NOW} ${K12_POSITIONING}`,
    cta: ['Tell us what a district would need first', '#contact'],
    listHead: 'What it would lead with',
    listTitle: 'Described and planned. Not yet for a district.',
    list: [
      ...LEADS_WITH,
      ...SEGMENTS.map((s) => `${s.segment}: ${s.offer}`),
    ],
    qualHead: 'What it will not do, and what it waits on',
    qual: [
      ...DOES_NOT_REPLACE.map((x) => `It does not replace ${x.charAt(0).toLowerCase()}${x.slice(1)}`),
      NOT_A_SEGMENT,
      ready
        ? 'The district baseline is met.'
        : `A district’s student data is not accepted until a baseline of sixteen things is tested. ${short} of them are short today.`,
    ],
  };
}

export function advancement(): Solution {
  return {
    crumb: 'Advancement',
    eye: 'For alumni relations and fundraising offices',
    h: 'Alumni relations and fundraising: planned, and none of it built.',
    lede: `${NOTHING_IS_LIVE} ${ADV_POSITIONING} ${PRICE}`,
    cta: ['Tell us what your office would need first', '#contact'],
    listHead: 'What it would do, none of it built',
    listTitle: 'Planned. Nothing here exists yet.',
    list: PARTS.flatMap((p) => [`${p.title}: ${p.would[0]}`, ...p.would.slice(1).map((w) => `${p.title}: ${w}`)]),
    qualHead: 'What it will not do, what it waits on, and what a graduate can do today',
    qual: [
      ...NOT_BUILT.map((n) => `Not planned: ${n.what.toLowerCase()}. ${n.why}`),
      ...WAITS_ON.map((w) => `It waits on: ${w.charAt(0).toLowerCase()}${w.slice(1)}`),
      ...TODAY.map((t) => `A graduate can today: ${t.charAt(0).toLowerCase()}${t.slice(1)}`),
    ],
  };
}

/** The keys the company site routes to, and what each prints. */
export const SOLUTIONS: Record<'k12' | 'advancement', () => Solution> = { k12, advancement };

export const START = '/*solutions-k12-adv:start*/';
export const END = '/*solutions-k12-adv:end*/';

/** The block the company site carries: one statement, between two markers. */
export function block(): string {
  const entries = Object.fromEntries(Object.entries(SOLUTIONS).map(([k, f]) => [k, f()]));
  return `${START}Object.assign(SOL,${JSON.stringify(entries)});${END}`;
}
