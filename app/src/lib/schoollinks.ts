import type { School } from './school';
import type { CampusLink } from './types';

/**
 * The addresses a school profile carries, as rows the Links screen can draw.
 *
 * Six of the profile's fields are addresses — the registrar, the LMS, the
 * organisations portal, the library, health, advising — and until this file
 * existed every one of them was written down and read by nothing. They were
 * filled in for Vanderbilt by somebody who expected them to appear somewhere,
 * and they did not appear anywhere.
 *
 * The screen they belong on is Links, beside the bundled addresses, because
 * that is where somebody goes to open their university rather than to read
 * about it. What this file does not do is give them a second home: they are
 * generated as ordinary `CampusLink` rows and go through the same editing,
 * the same `state.linkUrls` correction and the same grouping as every other
 * row on that screen.
 *
 * ## Why this is better than putting them in `data/campus.ts`
 *
 * `CAMPUS_LINKS` is Vanderbilt's, hard-coded, and right to be — it holds the
 * portals and oddities no schema has a field for. These six come from the
 * profile, so they work for a school somebody added themselves in the same
 * breath as they work for the one that ships. A student at a university this
 * app has never heard of gets their own registrar on the screen.
 */

/** One profile address, and what to call it when the school does not say. */
const ADDRESSES: {
  id: string;
  fallback: string;
  /** The field holding the school's own name for it, where it has one. */
  name?: 'registrarName' | 'lmsName' | 'orgPortalName';
  url: 'registrarUrl' | 'lmsUrl' | 'orgPortalUrl' | 'libraryUrl' | 'healthUrl' | 'advisingUrl';
  note: string;
}[] = [
  {
    id: 'school-registrar',
    fallback: 'Registrar',
    name: 'registrarName',
    url: 'registrarUrl',
    note: 'Registration, the official schedule, transcripts. The dates it publishes are the ones that cost money — Term deadlines is where they go.',
  },
  {
    id: 'school-lms',
    fallback: 'Course site',
    name: 'lmsName',
    url: 'lmsUrl',
    note: 'Course shells, submissions, grades. Its calendar feed is the part the app can read — add it under Connect.',
  },
  {
    id: 'school-orgs',
    fallback: 'Student organisations',
    name: 'orgPortalName',
    url: 'orgPortalUrl',
    note: 'Organisations and campus events. Event pages usually offer an .ics you can add under Connect.',
  },
  {
    id: 'school-library',
    fallback: 'Library',
    url: 'libraryUrl',
    note: 'Catalogue, databases, hours and study rooms.',
  },
  {
    id: 'school-health',
    fallback: 'Student health',
    url: 'healthUrl',
    note: 'Health and counselling. Worth knowing the address of before the week you need it.',
  },
  {
    id: 'school-advising',
    fallback: 'Academic advising',
    url: 'advisingUrl',
    note: 'Your advisor, and the holds only they can lift.',
  },
];

/**
 * An address reduced to the thing that makes two of them the same place.
 *
 * Protocol, a leading `www.`, a trailing slash and case are all noise: a
 * profile saying `https://www.library.vanderbilt.edu` and a bundled row
 * saying `https://library.vanderbilt.edu/` are one library, and drawing both
 * would be the duplication this app spends a whole audit file arguing
 * against. A path is *not* noise — `/dining` and `/dining/meal-plans` are two
 * pages and both belong.
 */
export function sameAddress(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/**
 * The profile's addresses as rows, minus any the screen is drawing already.
 *
 * `taken` is every address already on the screen — the bundled Vanderbilt
 * rows and the ones this student added. For Vanderbilt that suppresses four
 * of the six, because `CAMPUS_LINKS` names YES, Brightspace, AnchorLink and
 * the libraries itself; what survives is the two nothing else had. For a
 * school with no bundled rows at all, all six survive, which is the case this
 * is really for.
 *
 * Empty in, empty out: a school with no profile, or one whose every address
 * is blank, adds no heading and no apology to the screen.
 */
export function schoolLinks(school: School, taken: CampusLink[] = []): CampusLink[] {
  const already = new Set(taken.filter((l) => l.url).map((l) => sameAddress(l.url)));
  const caps = school.capabilities;

  return ADDRESSES.flatMap((row) => {
    const url = (caps[row.url] ?? '').trim();
    if (!url || already.has(sameAddress(url))) return [];
    const named = row.name ? (caps[row.name] ?? '').trim() : '';
    return [
      {
        id: row.id,
        name: named || row.fallback,
        url,
        hint: '',
        note: row.note,
        group: 'Campus' as const,
      },
    ];
  });
}
